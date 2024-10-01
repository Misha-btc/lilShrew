import { useState, useCallback } from 'react';
import { useOutspendsMulticall } from './useOutspendsMulticall';
import { useOrdOut } from './useOrdOut';
import { useOutspends } from './useOutspends';
import { useTx } from './useTx';

export const useAssembler = () => {
  const { fetchOutspendsMulticall } = useOutspendsMulticall();
  const { fetchOrdOut } = useOrdOut();
  const { fetchOutspends } = useOutspends();
  const { fetchTx } = useTx();

  const [MulticallData, setMulticallData] = useState(null);

  const fetchAssembler = useCallback(async (outputId) => {
    let unspentOutputs = {};
    let spentOutputs = {};
    let receivedUnspends = {};
    let feeSpent = {}

    try {
      const txOutspends = await fetchOutspends([outputId]);
      setMulticallData(txOutspends);

      txOutspends.result.forEach((outspend, index) => {
        if (!outspend.spent) {
          unspentOutputs[index] = {
            spent: false,
            level: 0,
            startOffset: 0,
            endOffset: 0,
          }
        } else {
          spentOutputs[index] = {
            spent: true,
            txid: outspend.txid,
            vin: outspend.vin,
            level: 0,
            startOffset: 0,
            endOffset: 0,
          }
        }
      });
      let x = 0

      let proccesSpends = Object.values(spentOutputs).reduce((acc, value, index) => {
        acc[index] = value;
        return acc;
      }, {});

      while (x <= 2) {
        console.log(`x`, x)
        let interProccesSpends = []
        let proccesLength = 0
        
        console.log(`proccesSpends`, JSON.stringify(proccesSpends))
        if (Object.keys(proccesSpends).length > 0) {
          const multicallParams = Object.values(proccesSpends).map(tx => ['esplora_tx', [tx.txid]]);
        
        const multicallResult = await fetchOutspendsMulticall(multicallParams);
        if (multicallResult.result && Array.isArray(multicallResult.result)) {
          multicallResult.result.forEach((item, index) => {
            if (item.result) {
              console.log(`item.result`, item.result)
              const currentTx = Object.values(proccesSpends)[index];

              let vinVolume = 0;
              let lastVin = 0;
              // Здесь мы вычисляем общий объем входов (vinVolume) и значение последнего входа (lastVin)
              // для текущей транзакции. Мы проходим по всем входам до индекса currentTx.vin включительно.
              for (let i = 0; i <= currentTx.vin; i++) {
                vinVolume += item.result.vin[i].prevout.value;
                 // Суммируем значения всех входов
                
                if (i === currentTx.vin) {
                  lastVin = item.result.vin[i].prevout.value;
                  break;
                }
              }

              // Удаляем обработанный элемент из proccesSpends
              proccesLength = Object.keys(proccesSpends).length
              let voutVolume = 0
              let startVout = 0
              let startOffset = 0
              let endVout = 0
              let endOffset = 0

              let spentAsFee = false

              let proccesStartOffset = proccesSpends[index].startOffset
              let proccesEndOffset = proccesSpends[index].endOffset

              let volumeBeforeTarget = vinVolume - lastVin

              let volumePlusOffset = volumeBeforeTarget + proccesStartOffset

              let currentVout = 0
              let voutLength = item.result.vout.length

              // Здесь мы определяем начальный и конечный индексы выходов (vout) для текущей транзакции
              
              // Определяем startVout - индекс, с которого начинаем учитывать выходы
              if (volumeBeforeTarget === 0) {
                startVout = 0
              } else {
                // Ищем индекс, где сумма выходов превышает или равна volumeBeforeTarget
                for (let j = 0; j < voutLength || voutVolume <= volumePlusOffset; j++) {

                  currentVout = item.result.vout[j].value
                  voutVolume += currentVout

                  // Если ЦЕЛЕВЫЕ САТЫ ПОТРАЧЕНЫ в качестве комиссии 
                  if (j === voutLength - 1) {
                    if (voutVolume <= volumePlusOffset) {
                      spentAsFee = true
                      console.log(`ВСЕ ЦЕЛЕВЫЕ САТЫ ПОТРАЧЕНЫ в качестве комиссии`)
                    } else if (voutVolume > volumePlusOffset) {
                      startVout = j
                      startOffset = Math.abs(voutVolume - volumePlusOffset - currentVout)
                      console.log(`ВОЗМОЖНО ЦЕЛЕВЫЕ САТЫ ПОТРАЧЕНЫ в качестве комиссии`)
                    }
                    break
                  } else {
                    if (voutVolume === volumePlusOffset) {
                      startVout = j + 1
                      startOffset = 0
                      break
                    } else if (voutVolume > volumePlusOffset) {
                      startVout = j
                      if (j > 0) {
                        startOffset = Math.abs(voutVolume - volumePlusOffset - currentVout)
                        break
                      } else if (j === 0){
                        startOffset = volumePlusOffset
                        break
                      }
                      break
                    }
                  }
                }
              }

              if (startOffset === 0 && !spentAsFee) {
                // Если размер стартового выхода равен последнему входу, то конечный выход - это стартовый выход
                if (item.result.vout[startVout].value === lastVin) {
                  endOffset = 0 + proccesEndOffset
                  endVout = startVout;
                } else {
                  // Ищем конечный выход, суммируя значения выходов, начиная с startVout
                  let accumulatedValue = 0;

                  for (let j = startVout; j < item.result.vout.length; j++) {
                    accumulatedValue += item.result.vout[j].value;

                    if (accumulatedValue - startOffset === lastVin) {
                      endVout = j;
                      endOffset = 0 + proccesEndOffset
                      break;
                    } else if (accumulatedValue - startOffset > lastVin) {
                      endVout = j;
                      endOffset = accumulatedValue - lastVin + proccesEndOffset
                      break;
                      // Если последний выход
                    } else if (j === item.result.vout.length - 1) {
                      if (accumulatedValue < (lastVin - proccesEndOffset)) {
                        spentAsFee = true
                        break
                        endVout = item.result.vout.length - 1;
                      }
                    } else if (item.result.vout[j].value === 0) {
                      continue
                    } else {
                      console.log(`НЕПОЛНОЕ УСЛОВИЕ`)
                      console.log(`j`, j)
                      console.log(`item.result.vout[j].value`, item.result.vout[j].value)
                      console.log(`item.result`, item.result)
                      console.log(`accumulatedValue`, accumulatedValue)
                      console.log(`lastVin`, lastVin)
                      console.log(`proccesEndOffset`, proccesEndOffset)
                      console.log(`startOffset`, startOffset)
                      console.log(`startVout`, startVout)
                      console.log(`endVout`, endVout)
                      console.log(`volumeBeforeTarget`, volumeBeforeTarget)
                      console.log(`volumePlusOffset`, volumePlusOffset)
                      console.log(`НЕПОЛНОЕ УСЛОВИЕ`)

                      break
                    }
                  }
                }
              } else if (startOffset > 0 && !spentAsFee) {

                let accumulatedValue = 0

                for (let j = startVout; j < item.result.vout.length; j++) {
                  accumulatedValue += item.result.vout[j].value;

                  if (accumulatedValue === lastVin ) {
                    endVout = j;
                    endOffset = 0
                    break;
                  } else if (accumulatedValue - startOffset > lastVin) {
                    endVout = j;
                    endOffset = accumulatedValue - startOffset - lastVin
                    break;
                  }
                }
              } 
              let newSpends = [];
              if (startVout === endVout) {
                newSpends.push({
                  txid: item.result.txid,
                  vin: currentTx.vin,
                  vout: startVout,
                  value: lastVin,
                  startOffset: startOffset,
                  endOffset: endOffset
                });
              } else {
                for (let i = startVout; i <= endVout; i++) {
                  let spend = {
                    txid: item.result.txid,
                    vin: currentTx.vin,
                    vout: i,
                    value: item.result.vout[i].value,
                    startOffset: i === startVout ? startOffset : 0,
                    endOffset: i === endVout ? endOffset : 0
                  };
                  newSpends.push(spend);
                }
              }
              

              if (!Array.isArray(interProccesSpends)) {
                interProccesSpends = [];
              }
              
              interProccesSpends.push(...newSpends);

              const multicallParams = interProccesSpends.map(spend => ['esplora_tx::outspend', [spend.txid, spend.vout]]);
              console.log(`multicallParams`, multicallParams)
              console.log(`multicallParams.length === Object.keys(proccesSpends).length`, multicallParams.length === Object.keys(proccesSpends).length)
              console.log(`Object.keys(proccesSpends).length`, Object.keys(proccesSpends).length)
              if (multicallParams.length === Object.keys(proccesSpends).length) {
                fetchOutspendsMulticall(multicallParams).then(multicallResult => {
                  console.log(`multicallResult`, multicallResult)




                  // Определяем тип multicallResult
                  if (Array.isArray(multicallResult.result)) {
                    console.log('multicallResult - это массив результатов');
                  } else if (typeof multicallResult.result === 'object' && multicallResult.result !== null) {
                    console.log('multicallResult - это объект');
                  } else {
                    console.log('Неожиданный тип multicallResult:', typeof multicallResult.result);
                  }



                  if (Array.isArray(multicallResult.result)) {
                    multicallResult.result.forEach((item, index) => {
                      if (item.result) {
                        console.log(`item.resultEND`, item.result)
                        if (item.result.spent === true) {
                          proccesSpends[index] = {
                            ...interProccesSpends[index],
                            ...item.result[interProccesSpends[index].vout],
                            index: index,
                            vin: item.result.vin,
                            txid: item.result.txid,
                            spent: true,
                            ddd: `spent`
                          };
                          
                        } else if (item.result.spent === false) {
                          receivedUnspends[index] = {
                            ...interProccesSpends[index],
                            index: index,
                            spent: false,
                            ddd: `received`

                          };
                        }
                      
                      } else if (item.error) {
                        console.error(`Ошибка для txid ${interProccesSpends[index].txid}:`, item.error);
                      }
                    });
                  } else {
                    console.error('Неожиданный формат результата multicall:', multicallResult);
                  }
                }).catch(error => {
                  console.error('Ошибка при выполнении multicall:', error);
                });
              }
            } else if (item.error) {
              console.error(`Error for txid ${proccesSpends[index].txid}:`, item.error);
            }
          });
        // Удаляем первый и второй элемент из proccesSpends

        let afterLength = Object.keys(proccesSpends).length - proccesLength;
        if (afterLength > 0) {
          const keys = Object.keys(proccesSpends);
          for (let i = afterLength - 1; i >= 0; i--) {
            delete proccesSpends[keys[i]];
          }
        }

        } else {
            console.error('Unexpected multicall result format:', multicallResult);
          }
        }
        x++
      }
    } catch (error) {
      console.error('Error in fetchAssembler:', error);
    }
  }, [fetchOutspends, fetchOutspendsMulticall]);

  return { fetchAssembler, MulticallData };
};