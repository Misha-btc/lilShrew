import { useCallback } from 'react';
import { useOutspendsMulticall } from './useOutspendsMulticall';
import { useOutspends } from './useOutspends';

export const useAssembler = () => {
  const { fetchOutspendsMulticall } = useOutspendsMulticall();
  const { fetchOutspends } = useOutspends();


  const fetchAssembler = useCallback(async (txid) => {
    let totalUnspentOutputs = [];
    let totalSpentOutputs = [];
    let totalFeeOutputs = [];


    try {
      let currentTxid = txid;
      let x = 1;

   
      let spentOutputs = [];
      
      
      // Возвращает состояние каждого выхода транзакции (выход не потрачен или потрачен) (Инициализация)
      const txOutspends = await fetchOutspends([currentTxid]);
      console.log(txOutspends);

      // Обрабатываем txOutspends и добавляем в массивы unspentOutputs или spentOutputs
      txOutspends.result.forEach((output, index) => {
        if (!output.spent) {
          totalUnspentOutputs.push({ ...output, index, level: 0 });
        } else {
          spentOutputs.push({ ...output, index, level: 0 });
        }
      });

      while (x <= 100) {
        console.log(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
        console.log(x)
        
        let spentOutputsTx = [];
        
        let spentOutputsList = [];

        if (x >= 3) {
          console.log(`spentOutputsSTART`)
          console.log(JSON.stringify(spentOutputs))
        }

        
        // Глубина сат ренжа
        let level = x;

        // Если никакой выход не потрачен, то выходим из цикла
        if (spentOutputs.length === 0) {
          break;
        }

        // Большой цикл для обработки каждого потраченного выхода


        // Получим новую транзакцию для каждого потраченного выхода используя multicall
        const multicallParams = spentOutputs.map(tx => ['esplora_tx', [tx.txid]]);
        const multicallResult = await fetchOutspendsMulticall(multicallParams);



        for (let i = 0; i < multicallResult.result.length; i++) {
          const tx = multicallResult.result[i].result;
          spentOutputsTx.push({...tx, index: spentOutputs[i].index, level: level});
        }


         // Обновим spentOutputs значениями из новой транзакции
        for (let i = 0; i < spentOutputsTx.length; i++) {
          // Сумма потраченных входов включая целевой UTXO и оффсеты
          let vinSumUpTo = 0;
          for (let j = 0; j < spentOutputsTx[i].vin.length; j++) {
            const tx = spentOutputsTx[i];
            vinSumUpTo += tx.vin[j].prevout.value;
            if (j === spentOutputs[i].vin) {

              // Значение потраченного входа
              let startOffset = spentOutputs[i].startOffset ? spentOutputs[i].startOffset : 0;
              // Значение целевых сатов
              let value = spentOutputs[i].value ? spentOutputs[i].value : tx.vin[j].prevout.value;
              // Сумма Значений потраченных входов с учетом стартового оффсета до начала потраченного сатов
              let vinSumBeforeTarget = vinSumUpTo - tx.vin[j].prevout.value + startOffset;
              // Целевое значение потраченного входа
              let vinTargetValue = tx.vin[j].prevout.value;
              
             
              spentOutputs[i] = { 
                ...spentOutputs[i],
                vinTargetValue: vinTargetValue,
                value: value,
                vinSumUpTo: vinSumUpTo,
                vinSumBeforeTarget: vinSumBeforeTarget
              }
              break;
            }  
            
          }
        }

        // vinTargetValue - целевое значение потраченного входа включая оффсеты.
        // vinSumBeforeTarget - сумма значений потраченных входов с учетом СтартОффсета до начала потраченного входа
        // vinSumUpTo - сумма значений потраченных входов включая потраченый вход и оффсеты
        // startOffset - значение предшествующее целевым сатам в потраченном входе
        // startVout - первый индекс выхода содержащего целевые саты
        // endOffset - значение после целевых сатов в потраченном входе
        // endVout - последний индекс выхода содержащего целевые саты
        // vinVoutDiff - разница между целевым значением потраченного входа и суммой значений выходов в потраченном входе
        // value - отслеживаемое значение целевых сатов
        

         // Найдем в каком новом выходе начинается потраченный вход (индекс выхода, и оффсет)
         // ПЕРЕБОР ЗНАЧЕНИЙ ВЫХОДОВ
         //////////////////////////////////////////////////////////////
        for (let i = 0; i < spentOutputsTx.length; i++) {
          let startOffset = spentOutputs[i].startOffset ? spentOutputs[i].startOffset : 0;
          let voutSum = 0;
          for (let j = 0; j < spentOutputsTx[i].vout.length; j++) {
            const tx = spentOutputsTx[i];
            voutSum += tx.vout[j].value;

              // 
              if (voutSum > spentOutputs[i].vinSumBeforeTarget) {
                startOffset = Math.abs(voutSum - spentOutputs[i].vinSumBeforeTarget - tx.vout[j].value);
                spentOutputs[i] = {
                ...spentOutputs[i],
                startOffset: startOffset,
                startVout: j
              }
              break;


            } else if (voutSum < spentOutputs[i].vinSumBeforeTarget){
              if (j !== spentOutputsTx[i].vout.length - 1) {
                continue;
              } else {
                // В этом условии все наши целевые саты потрачены в качестве комиссии
                // Добавляем в массив totalFeeOutputs и удаляем из spentOutputs и spentOutputsTx
                totalFeeOutputs.push({...spentOutputs[i]});
                spentOutputs = spentOutputs.slice(0, i).concat(spentOutputs.slice(i + 1));
                spentOutputsTx = spentOutputsTx.slice(0, i).concat(spentOutputsTx.slice(i + 1));
                break;
              }
            } else {
              if (j === spentOutputsTx[i].vout.length - 1) {
                // В этом условии все наши целевые саты потрачены в качестве комиссии
                // Добавляем в массив totalFeeOutputs и удаляем из spentOutputs и spentOutputsTx
                totalFeeOutputs.push({...spentOutputs[i]});
                spentOutputs = spentOutputs.slice(0, i).concat(spentOutputs.slice(i + 1));
                spentOutputsTx = spentOutputsTx.slice(0, i).concat(spentOutputsTx.slice(i + 1));
              } else {
                // Если voutSum равен vinSumBeforeTarget, то startVout на единицу больше
                spentOutputs[i] = {
                ...spentOutputs[i],
                startOffset: 0,
                startVout: j + 1
              }
              }
              break;
            }
          }
        }


        // Найдем в каком новом выходе заканчивается потраченный вход (индекс выхода, и оффсет)
        for (let i = 0; i < spentOutputsTx.length; i++) {
          let endOffset = spentOutputs[i].endOffset ? spentOutputs[i].endOffset : 0; 
          let voutSum = 0;
          let voutTargetValue = spentOutputs[i].startOffset + spentOutputs[i].value;
          
          for (let j = spentOutputs[i].startVout; j < spentOutputsTx[i].vout.length; j++) {
            const tx = spentOutputsTx[i];
            voutSum += tx.vout[j].value;
           
            // В этом случае целевые саты и стартоффсет НЕ потрачены в качестве комиссии, енофссет возможно
            if (voutSum >= voutTargetValue) { 
              endOffset = Math.abs(voutSum - voutTargetValue);
              spentOutputs[i] = {
                ...spentOutputs[i],
                endOffset: endOffset,
                endVout: j
              }
              break;
            } else {
              // Не последний выход
              if (j !== spentOutputsTx[i].vout.length - 1) {
                continue;
              } else {
                // Last output voutSum меньше целевого значения + start оффсет
                // Целевые саты будут потрачены полностью или частично в качестве комиссии
                if (voutSum > spentOutputs[i].startOffset) {

                  let newValue = voutSum - spentOutputs[i].startOffset;
                  // Целевые саты потрачены частично в качестве комиссии
                  spentOutputs[i] = {
                    ...spentOutputs[i],
                    endOffset: 0,
                    endVout: j,
                    value: newValue
                  }
                  totalFeeOutputs.push({...spentOutputs[i]});
                  break;

                  
                } else if (voutSum <= spentOutputs[i].startOffset) {
                  // Целевые саты потрачены полностью в качестве комиссии
                  totalFeeOutputs.push({...spentOutputs[i]});
                  spentOutputs = spentOutputs.slice(0, i).concat(spentOutputs.slice(i + 1));
                  spentOutputsTx = spentOutputsTx.slice(0, i).concat(spentOutputsTx.slice(i + 1));
                  break;
                }
                
              }
            } 
          }
        }



        for (let i = 0; i < spentOutputs.length; i++) {
          if (spentOutputs[i].startVout === spentOutputs[i].endVout) {
            spentOutputsList.push({
              ...spentOutputs[i],
              vout: spentOutputs[i].startVout
            });
          } else {
            // Найдем потраченные выходы в транзакциях
            for (let j = spentOutputs[i].startVout; j <= spentOutputs[i].endVout; j++) {
              spentOutputsList.push({
                ...spentOutputs[i],
                vout: j
              });
              break;
            }
          }
        }

        const multicallOutParams = spentOutputsList.map(id => ['esplora_tx::outspend', [id.txid, id.vout]]);
        const multicallOutResult = await fetchOutspendsMulticall(multicallOutParams);


        if (x >= 3) {
          console.log(`multicallOutResult`)
          console.log(JSON.stringify(multicallOutResult))
        }


        // Перепакуем spentOutputs, очистив его, и добавив spentOutputsList с соответствубщим ответом мультикола
        // Проверим потрачен ли выход и распределим по спискам
        for (let i = 0; i < multicallOutResult.result.length; i++) {
          const output = multicallOutResult.result[i].result;
          if (output && output.spent) {
            spentOutputsList[i] = {
              ...spentOutputsList[i],
              txid: output.txid,
              vin: output.vin
            };
          } else if (output && !output.spent) {
            spentOutputs = spentOutputs.slice(0, i).concat(spentOutputs.slice(i + 1));
            totalUnspentOutputs.push({ ...spentOutputsList[i], index: i, level: level });
            spentOutputsList = spentOutputsList.slice(0, i).concat(spentOutputsList.slice(i + 1));
          }
        }

        spentOutputs = [...spentOutputsList];

        spentOutputsTx.length = 0;
        spentOutputsList.length = 0;

        if (x >= 3) {
          console.log(`spentOutputs`)
          console.log(JSON.stringify(spentOutputs))
          console.log(`totalFeeOutputs`)
          console.log(totalFeeOutputs)
          console.log(`totalUnspentOutputs`)
          console.log(totalUnspentOutputs)
        }

        x++;
      }

      // Вывод результатов...
    } catch (error) {
      console.error('Error in fetchAssembler:', error);
    }
  }, [fetchOutspends]);

  return { fetchAssembler };
};