/* Conexão Sertão — validador retrospectivo v0.1
   Não usa dados eleitorais simulados como se fossem reais.
   Entrada: array de casos históricos, cada um com:
   {label, units:[...formato do modelo...], actualFinalVotes:{id:votos}}
   Os snapshots devem representar apenas informações conhecidas naquele instante.
*/
(function(root){
'use strict';
function backtest(cases,model){
 if(!Array.isArray(cases)||!cases.length)return {status:'missing_historical_cases',cases:0};
 if(!model||typeof model.estimate!=='function')return {status:'missing_model'};
 const rows=[],errors=[];
 for(const test of cases){
  if(!test||!Array.isArray(test.units)||!test.actualFinalVotes){errors.push('Caso sem entrada ou resultado final');continue}
  const pred=model.estimate({units:test.units});
  if(pred.status!=='experimental_unvalidated'){errors.push((test.label||'Sem nome')+': '+pred.status);continue}
  const actual=test.actualFinalVotes;
  const keys=Object.keys(actual);
  const actualTotal=keys.reduce((s,k)=>s+Number(actual[k]||0),0);
  const predTotal=keys.reduce((s,k)=>s+Number(pred.estimatedVotes[k]||0),0);
  if(!(actualTotal>0&&predTotal>0)||keys.some(k=>!Number.isFinite(Number(actual[k]))||Number(actual[k])<0)){errors.push((test.label||'Sem nome')+': totais inválidos');continue}
  const errorsByOption={};
  for(const k of keys){
   const a=Number(actual[k])/actualTotal,p=Number(pred.estimatedVotes[k]||0)/predTotal;
   errorsByOption[k]={actualShare:a,estimatedShare:p,absoluteErrorPercentagePoints:Math.abs(a-p)*100};
  }
  const maxError=Math.max(...Object.values(errorsByOption).map(x=>x.absoluteErrorPercentagePoints));
  rows.push({label:test.label||'Caso histórico',coverage:pred.coverage,unitsWithUsableSample:pred.unitsWithUsableSample,maxErrorPercentagePoints:maxError,errorsByOption});
 }
 if(!rows.length)return {status:'no_valid_cases',errors};
 const mae=rows.reduce((s,r)=>s+r.maxErrorPercentagePoints,0)/rows.length;
 const worst=Math.max(...rows.map(r=>r.maxErrorPercentagePoints));
 const bands=[0,.1,.25,.5,.75,1].map((low,i,arr)=>i===arr.length-1?null:{
  from:low,to:arr[i+1],cases:rows.filter(r=>r.coverage>=low&&(i===arr.length-2?r.coverage<=arr[i+1]:r.coverage<arr[i+1])).length,
  meanMaxError:null
 }).filter(Boolean);
 for(const band of bands){
  const subset=rows.filter(r=>r.coverage>=band.from&&(band.to===1?r.coverage<=band.to:r.coverage<band.to));
  band.meanMaxError=subset.length?subset.reduce((s,r)=>s+r.maxErrorPercentagePoints,0)/subset.length:null;
 }
 return {status:'backtest_complete_not_certified',cases:rows.length,meanMaxErrorPercentagePoints:mae,worstMaxErrorPercentagePoints:worst,coverageBands:bands,rows,errors,publicRelease:false,warning:'Resultados retrospectivos não garantem desempenho futuro; avaliar viés temporal, regional e tamanho amostral.'};
}
root.ConexaoBacktest={version:'0.1.0',backtest};
})(typeof window!=='undefined'?window:globalThis);
