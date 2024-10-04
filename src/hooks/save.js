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
      let x = 0;

   
      let spentOutputs = [];
      
      
      // Возвращает состояние каждого выхода транзакции (выход не потрачен или потрачен) (Инициализация)
      const txOutspends = await fetchOutspends([currentTxid]);
      console.log(txOutspends);

      // Обрабатываем txOutspends как объект и добавляем в массивы unspentOutputs или spentOutputs
      txOutspends.result.forEach((output, index) => {
        if (!output.spent) {
          totalUnspentOutputs.push({ ...output, index, level: 0 });
        } else {
          spentOutputs.push({ ...output, index, level: 0 });
        }
      });

      while (x <= 2) {
        console.log(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
        console.log(x)
        
        let spentOutputsTx = [];
        
        let spentOutputsList = [];

        console.log(`spentOutputsSTART`)
        console.log(JSON.stringify(spentOutputs))
        
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

        // Сумма вплоть до входа + оффсет

         // Обновим spentOutputs значением потраченного входа, и суммой вплоть до потраченного входа
        for (let i = 0; i < spentOutputsTx.length; i++) {
          // Сумма потраченных входов включая потраченый вход
          let vinSumUpTo = 0;
          for (let j = 0; j < spentOutputsTx[i].vin.length; j++) {
            const tx = spentOutputsTx[i];
            vinSumUpTo += tx.vin[j].prevout.value;
            if (j === spentOutputs[i].vin) {
              // Значение потраченного входа
              let startOffset = spentOutputs[i].startOffset ? spentOutputs[i].startOffset : 0;
              // Сумма Значений потраченных входов с учетом оффсета до начала потраченного сатов
              let vinSumBeforeTarget = vinSumUpTo - tx.vin[j].prevout.value + startOffset;
              let vinTargetValue = spentOutputs[i].vinTargetValue ? spentOutputs[i].vinTargetValue : tx.vin[j].prevout.value;
              spentOutputs[i] = { 
                ...spentOutputs[i],
                vinTargetValue: vinTargetValue,
                vinSumUpTo: vinSumUpTo,
                vinSumBeforeTarget: vinSumBeforeTarget
              }
              break;
            }  
            
          }
        }


        
        
         // Найдем в каком новом выходе начинается потраченный вход (индекс выхода, и оффсет)

        for (let i = 0; i < spentOutputsTx.length; i++) {
          spentOutputs[i].startOffset = spentOutputs[i].startOffset ? spentOutputs[i].startOffset : 0;
          let voutSum = 0;
          for (let j = 0; j < spentOutputsTx[i].vout.length; j++) {
            const tx = spentOutputsTx[i];
            voutSum += tx.vout[j].value;
            
            
              // если целевой выход первый
            if (spentOutputs[i].vinSumBeforeTarget === 0) {
              if (spentOutputs[i].startOffset === 0) {
                spentOutputs[i].startOffset = 0;
              } else if (voutSum < spentOutputs[i].startOffset) {
                continue;
              }
              spentOutputs[i].startVout = j;
              break; 

              // Условие должно включать обработку полной траты в качестве комиссии
            } else if (voutSum < spentOutputs[i].vinSumBeforeTarget + spentOutputs[i].startOffset){
              if (j !== spentOutputsTx[i].vout.length - 1) {
                continue;
                // ПОЧЕМУ СРАБАТЫВАЕТСЯ ЭТО УСЛОВИЕ?
              } else {
                // Добавляем в массив totalFeeOutputs и удаляем из spentOutputs и spentOutputsTx
                totalFeeOutputs.push({...spentOutputs[i]});
                spentOutputs = spentOutputs.slice(0, i).concat(spentOutputs.slice(i + 1));
                spentOutputsTx = spentOutputsTx.slice(0, i).concat(spentOutputsTx.slice(i + 1));
                
                break;
              }

            
              

            } else if (voutSum >= spentOutputs[i].vinSumBeforeTarget + spentOutputs[i].startOffset) {
              let startOffset = Math.abs(voutSum - spentOutputs[i].startOffset - spentOutputs[i].vinSumBeforeTarget - tx.vout[j].value);
              spentOutputs[i] = {
                ...spentOutputs[i],
                startOffset: startOffset,
                startVout: j
              }
              break;
            }
          }
        }

        console.log(`spentOutputs Найдем в каком новом выходе начинается потраченный вход (индекс выхода, и оффсет)`)
        console.log(JSON.stringify(spentOutputs))

        // Найдем в каком новом выходе заканчивается потраченный вход (индекс выхода, и оффсет)
        for (let i = 0; i < spentOutputsTx.length; i++) {
          spentOutputs[i].endOffset = spentOutputs[i].endOffset ? spentOutputs[i].endOffset : 0;
          let voutSum = 0;
          for (let j = spentOutputs[i].startVout; j < spentOutputsTx[i].vout.length; j++) {
            const tx = spentOutputsTx[i];
            voutSum += tx.vout[j].value;
            // 
            if (voutSum - spentOutputs[i].startOffset < spentOutputs[i].vinTargetValue - spentOutputs[i].endOffset) {
              if (j !== spentOutputsTx[i].vout.length - 1) {
                continue;
              } else {
                // Часть выхода потрачена в качестве комиссии
                let vinTargetValue = spentOutputs[i].vinTargetValue - (voutSum - spentOutputs[i].startOffset);
                let endOffset = 0;
                spentOutputs[i] = {
                  ...spentOutputs[i],
                  endOffset: endOffset,
                  endVout: j,
                  vinTargetValue: vinTargetValue
                }
                totalFeeOutputs.push({...spentOutputs[i]});
                break;
              }
            } else if (voutSum - spentOutputs[i].startOffset >= spentOutputs[i].vinTargetValue - spentOutputs[i].endOffset) {
              let endOffset = voutSum - spentOutputs[i].startOffset - spentOutputs[i].vinTargetValue;
              spentOutputs[i] = {
                ...spentOutputs[i],
                endOffset: spentOutputs[i].endOffset + endOffset,
                endVout: j
              }
              break;
            }
          }
        }

        console.log(`spentOutputs Найдем в каком новом выходе заканчивается потраченный вход (индекс выхода, и оффсет)`)
        console.log(JSON.stringify(spentOutputs))
        console.log(spentOutputs)

        console.log(`spentOutputs.length`)
        console.log(spentOutputs.length)

        console.log(`spentOutputs.length`)
        console.log(spentOutputs)


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
        console.log(`spentOutputsList`)
        console.log(JSON.stringify(spentOutputsList))
        const multicallOutParams = spentOutputsList.map(id => ['esplora_tx::outspend', [id.txid, id.vout]]);
        const multicallOutResult = await fetchOutspendsMulticall(multicallOutParams);
        console.log(`multicallOutResult`)
        console.log(JSON.stringify(multicallOutResult))

        


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
          }
        }

        spentOutputs = [...spentOutputsList];

        spentOutputsTx.length = 0;
        spentOutputsList.length = 0;

        console.log(`spentOutputsList`)
        console.log(spentOutputsList)
        console.log(`spentOutputs`)
        console.log(spentOutputs)
        console.log(`spentOutputsTx`)
        console.log(spentOutputsTx)
        console.log(`totalFeeOutputs`)
        console.log(totalFeeOutputs)
/*         console.log(totalUnspentOutputs);
        console.log(spentOutputs); */
        x++;
      }

      // Вывод результатов...
    } catch (error) {
      console.error('Error in fetchAssembler:', error);
    }
  }, [fetchOutspends]);

  return { fetchAssembler };
};