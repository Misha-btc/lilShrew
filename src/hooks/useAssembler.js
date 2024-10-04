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

    //ОБНОВИТЬ В КОНЦЕ ОБРАБОТКИ
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

      console.log(`ACCCproccesSpends`, JSON.stringify(proccesSpends))

      while (x <= 2) {
        console.log(`x`, x)
        console.log(`proccesSpendsSTART`,JSON.stringify(proccesSpends))
        let interProccesSpends = []
        let proccesLength = 0

        if (Object.keys(proccesSpends).length > 0) {
          const multicallParams = Object.values(proccesSpends).map(tx => ['esplora_tx', [tx.txid]]);
        
          const multicallResult = await fetchOutspendsMulticall(multicallParams);
          if (multicallResult.result && Array.isArray(multicallResult.result)) {
            console.log(`multicallResult`, multicallResult)

            //В ЭТОТ ЦИКЛ ОБЕРНУТА ВСЯ ЛОГИКА ПОСТРОЕНИЯ СПЕНДОВ. НАМ НУЖНО ОТДЕЛИТЬ ЕГО ОТ ОСТАЛЬНОЙ ЛОГИКИ
            for (const [index, item] of multicallResult.result.entries()) {
              if (item.result) {
                const currentUTXO = Object.values(proccesSpends)[index];
                console.log(`currentUTXO`, JSON.stringify(currentUTXO))

                let vinVolume = 0;
                let lastVin = 0;
                // Здесь мы вычисляем общий объем входов (vinVolume) и значение последнего входа (lastVin)
                // для текущей транзакции. Мы проходим по всем входам до индекса currentTx.vin включительно.
                for (let i = 0; i <= currentUTXO.vin; i++) {
                  vinVolume += item.result.vin[i].prevout.value;
                  // Суммируем значения всех входов
                  
                  if (i === currentUTXO.vin) {
                    lastVin = item.result.vin[i].prevout.value;
                    break;
                  }
                }
                console.log(`currentUTXO.vin`, currentUTXO.vin)
                console.log(`vinVolume`, vinVolume)
                console.log(`lastVin`, lastVin)

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
                console.log(`volumeBeforeTarget`, volumeBeforeTarget)
                console.log(`vinVolume`, vinVolume)
                console.log(`lastVin`, lastVin)
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
                        }
                      } else if (item.result.vout[j].value === 0) {
                        continue
                      } else {
                        /*                       console.log(`НЕПОЛНОЕ СЛОВИЕ`)
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
                        */
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
                    vin: currentUTXO.vin,
                    vout: startVout,
                    value: lastVin,
                    startOffset: startOffset,
                    endOffset: endOffset,

                  });
                } else {
                  for (let i = startVout; i <= endVout; i++) {
                    let spend = {
                      txid: item.result.txid,
                      vin: currentUTXO.vin,
                      vout: i,
                      value: item.result.vout[i].value,
                      startOffset: startOffset,
                      endOffset: endOffset,
                    };
                    newSpends.push(spend);
                  }
                }
                

                if (!Array.isArray(interProccesSpends)) {
                  interProccesSpends = [];
                }
                
                interProccesSpends.push(...newSpends);

                const multicallParams = interProccesSpends.map(spend => ['esplora_tx::outspend', [spend.txid, spend.vout]]);

                // Изменим условие, чтобы запрос выполнялся, если есть хотя бы один параметр
                if (multicallParams.length > 0) {
                  try {
                    
                    const multicallResult = await fetchOutspendsMulticall(multicallParams);
                    console.log(`multicallResult`, multicallResult)
                    
                    console.log(index,`proccesSpendsBEFORE`,JSON.stringify(proccesSpends[index]))
                    if (Array.isArray(multicallResult.result)) {
                      for (const [index, item] of multicallResult.result.entries()) {

                        if (item.result && !spentAsFee) {
                          if (item.result.spent === true) {
                            console.log(`INDEX`, index)
                            proccesSpends[index] = {
                              ...interProccesSpends[index],
                              ...item.result[interProccesSpends[index].vout],
                              index: index,
                              vin: item.result.vin,
                              txid: item.result.txid,
                              spent: true,
                              level: x,
                            };
                          } else if (item.result.spent === false) {
                            receivedUnspends[index] = {
                              ...interProccesSpends[index],
                              index: index,
                              spent: false,
                              level: x,
                            };
                            delete proccesSpends[index];
                          }
                        console.log(index,`proccesSpendsEND`,JSON.stringify(proccesSpends[index]))
                        } else if (spentAsFee && item.result){
                          feeSpent[index] = {
                            ...interProccesSpends[index],
                            ...item.result[interProccesSpends[index].vout],
                            index: index,
                            vin: item.result.vin,
                            txid: item.result.txid,
                            spent: true,
                            level: x,
                          }
                          console.log(`feeSpent`, JSON.stringify(proccesSpends[index]))
                        }
                          else if (item.error) {
                          console.error(`Ошибка для txid ${interProccesSpends[index].txid}:`, item.error);
                        }
                      }
                    } else {
                      console.error('Неожиданный формат результата multicall:', multicallResult);
                    }
                  } catch (error) {
                    console.error('Ошибка при выполнении fetchOutspendsMulticall:', error);
                    console.error('Стек ошибки:', error.stack);
                  } finally {
                    console.log(`Завершение выполнения fetchOutspendsMulticall`);
                  }
                } else {
                  console.log('Нет параметров для выполнения multicall');
                }
              } else if (item.error) {
                console.error(`Error for txid ${proccesSpends[index].txid}:`, item.error);
              }
            }
                      // Удаляем первый и второй элемент из proccesSpends
                    /*    console.log(`proccesSpends`, JSON.stringify(proccesSpends))
                      let afterLength = Object.keys(proccesSpends).length - proccesLength;
                      console.log(`afterLength`, afterLength)
                      if (afterLength > 0) {
                        const keys = Object.keys(proccesSpends);
                        for (let i = afterLength - 1; i >= 0; i--) {
                          delete proccesSpends[keys[i]];
                        }
                      } */

          } else {
              console.error('Unexpected multicall result format:', multicallResult);
            }
        }
        x++
      }
      console.log(`unspentOutputs`, unspentOutputs)
      console.log(`proccesSpends`, JSON.stringify(proccesSpends))
      console.log(`spentOutputs`, spentOutputs)
      console.log(`receivedUnspends`, receivedUnspends)
      console.log(`feeSpent`, feeSpent)
    } catch (error) {
      console.error('Error in fetchAssembler:', error);
    }
  }, [fetchOutspends, fetchOutspendsMulticall]);

  return { fetchAssembler, MulticallData };
};