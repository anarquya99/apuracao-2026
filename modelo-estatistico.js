/* Conexão Sertão — motor estatístico experimental v0.1
   Motor genérico, não conectado ao painel público. NÃO publicar como projeção validada.
   Entrada: {units:[{id,region,expectedSections,reportedSections,
     historicalValidVotes, historicalShares:{id:share}, observedVotes:{id:votes}}]}
   Histórico deve corresponder a uma eleição comparável e ser pré-processado.
   Limitações: agregados de municípios/UF não permitem saber quais seções chegaram;
   a ausência desse detalhe pode enviesar a estimativa. Sem calibração de intervalos.
*/
(function(root){
 'use strict';
 const finite=x=>Number.isFinite(x)&&x>=0;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function evaluate(input){
  const units=input&&input.units;
  if(!Array.isArray(units)||!units.length)return {status:'insufficient_data',reason:'Unidades ausentes'};
  const errors=[],coverage=[];
  for(const u of units){
   if(!u.id||!u.region||!finite(u.expectedSections)||u.expectedSections<=0||!finite(u.reportedSections)||u.reportedSections>u.expectedSections||!finite(u.historicalValidVotes)||!u.historicalShares||!u.observedVotes){
    errors.push('Unidade inválida: '+String(u.id));continue;
   }
   const keys=Object.keys(u.historicalShares);
   if(!keys.length||keys.some(k=>!finite(u.historicalShares[k])||u.historicalShares[k]>1||!finite(Number(u.observedVotes[k]||0))))errors.push('Dados de opções inválidos: '+u.id);
   const hs=keys.reduce((a,k)=>a+u.historicalShares[k],0);
   if(Math.abs(hs-1)>0.015)errors.push('Participações históricas não somam 100%: '+u.id);
   const obs=Object.values(u.observedVotes).reduce((a,v)=>a+Number(v||0),0);
   if(u.reportedSections===0&&obs>0)errors.push('Votos sem seções reportadas: '+u.id);
   coverage.push({id:u.id,region:u.region,reported:u.reportedSections,total:u.expectedSections,completion:u.reportedSections/u.expectedSections,hasVotes:obs>0});
  }
  if(errors.length)return {status:'invalid_input',errors};
  const total=coverage.reduce((a,x)=>a+x.total,0),done=coverage.reduce((a,x)=>a+x.reported,0);
  const byRegion={};
  for(const x of coverage){
   const z=byRegion[x.region]||(byRegion[x.region]={reported:0,total:0,units:0,unitsWithVotes:0});
   z.reported+=x.reported;z.total+=x.total;z.units++;if(x.hasVotes)z.unitsWithVotes++;
  }
  const regions=Object.fromEntries(Object.entries(byRegion).map(([k,v])=>[k,{...v,completion:v.reported/v.total}]));
  const warnings=[];
  if(done===0)warnings.push('Nenhuma seção totalizada');
  if(Object.values(regions).some(r=>r.reported===0))warnings.push('Há regiões sem dados de apuração');
  if(coverage.some(x=>x.reported>0&&!x.hasVotes))warnings.push('Seções reportadas sem votos válidos observados');
  warnings.push('O modelo não dispõe da sequência de chegada das seções, nem de calibração retrospectiva');
  return {status:done===0?'awaiting_data':'experimental_unvalidated',coverage:done/total,reportedSections:done,expectedSections:total,regions,warnings,forecast:null};
 }
 root.ConexaoModeloEstatistico={version:'0.1.0',evaluate};

/* Estimador experimental por pós-estratificação.
   Exige que observedVotes represente uma amostra representativa da unidade.
   historicalValidVotes é proxy de tamanho, não previsão de comparecimento.
   O método retorna somente resultados técnicos, nunca chamadas eleitorais.
   Intervalos NÃO são calculados até existir calibração com backtesting.
*/
function estimate(input){
 const validation=evaluate(input);
 if(validation.status==='invalid_input'||validation.status==='insufficient_data')return validation;
 const units=input.units;
 const candidates=[...new Set(units.flatMap(u=>Object.keys(u.historicalShares)))];
 const result=Object.fromEntries(candidates.map(k=>[k,0]));
 let estimatedTotal=0,observedTotal=0,usable=0;
 const diagnostics=[];
 for(const u of units){
  const progress=u.reportedSections/u.expectedSections;
  const obs=Object.values(u.observedVotes).reduce((a,v)=>a+Number(v||0),0);
  const expected=u.historicalValidVotes;
  const prior=u.historicalShares;
  const minSections=Math.max(5,Math.ceil(u.expectedSections*0.05));
  const reliable=u.reportedSections>=minSections&&obs>0;
  const effective=Math.min(obs,Math.max(0,expected*0.12));
  const weight=reliable?effective/(effective+Math.max(1,expected*0.04)):0;
  const remaining=Math.max(0,expected-obs);
  for(const k of candidates){
   const observed=Number(u.observedVotes[k]||0);
   const observedShare=obs?observed/obs:0;
   const share=weight*observedShare+(1-weight)*(prior[k]||0);
   result[k]+=observed+remaining*share;
  }
  estimatedTotal+=Math.max(expected,obs);
  observedTotal+=obs;
  if(reliable)usable++;
  diagnostics.push({id:u.id,progress,usable:reliable,observedValidVotes:obs,baselineValidVotes:expected});
 }
 return {status:'experimental_unvalidated',method:'poststratification_shrinkage_v0.2',estimatedVotes:result,estimatedTotalValidVotes:estimatedTotal,observedValidVotes:observedTotal,unitsWithUsableSample:usable,totalUnits:units.length,diagnostics,coverage:validation.coverage,regions:validation.regions,intervals:null,publicRelease:false,warnings:[...validation.warnings,'Estimativa de participação e de viés da ordem de apuração não calibradas','Intervalos de confiança indisponíveis: backtesting necessário']};
}
root.ConexaoModeloEstatistico.estimate=estimate;
root.ConexaoModeloEstatistico.version='0.2.0';
})(typeof window!=='undefined'?window:globalThis);
