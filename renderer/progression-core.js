(function(root){
  'use strict';
  const TARGETS=[90,105,120,135];
  const MAX_MONTHS=24;

  function normalizeTarget(value){return TARGETS.includes(value)?value:120;}
  function monthOrdinal(key){
    const match=typeof key==='string'&&key.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    return match?Number(match[1])*12+Number(match[2])-1:null;
  }
  function quantile(values,p){
    if(!values.length)return null;
    const sorted=[...values].sort((a,b)=>a-b),position=(sorted.length-1)*p,low=Math.floor(position),high=Math.ceil(position);
    return sorted[low]+(sorted[high]-sorted[low])*(position-low);
  }
  function normalizeLessonTarget(value){return [2,3].includes(value)?value:3;}
  function estimate(months,value,{scoreKey='timedMedian',countKey='paperCount',minimumSamples=2,maximumScore=150}={}){
    const target=Number.isFinite(value)?Math.max(0,Math.min(maximumScore,value)):maximumScore;
    const evidence=(Array.isArray(months)?months:[])
      .filter(item=>item&&monthOrdinal(item.key)!==null&&Number.isFinite(item[scoreKey])&&item[scoreKey]>=0&&item[scoreKey]<=maximumScore&&Number.isInteger(item[countKey])&&item[countKey]>=minimumSamples)
      .map(item=>({key:item.key,ordinal:monthOrdinal(item.key),score:item[scoreKey],papers:item[countKey]}))
      .sort((a,b)=>a.ordinal-b.ordinal);
    const base={target,evidenceMonths:evidence.length,currentScore:evidence.at(-1)?.score??null,currentPapers:evidence.at(-1)?.papers??0};
    if(base.currentScore>=target)return {...base,status:'reached'};
    if(evidence.length<3)return {...base,status:'insufficient'};

    const slopes=[];
    for(let i=0;i<evidence.length;i++)for(let j=i+1;j<evidence.length;j++){
      const elapsed=evidence[j].ordinal-evidence[i].ordinal;
      if(elapsed>0)slopes.push((evidence[j].score-evidence[i].score)/elapsed);
    }
    const medianSlope=quantile(slopes,.5),lowSlope=quantile(slopes,.25),highSlope=quantile(slopes,.75);
    const overallSlope=(evidence.at(-1).score-evidence[0].score)/(evidence.at(-1).ordinal-evidence[0].ordinal);
    if(!(overallSlope>0&&medianSlope>0&&lowSlope>0&&highSlope>0))return {...base,status:'unclear'};

    const gap=target-base.currentScore,fast=Math.max(1,Math.ceil(gap/highSlope)),slow=Math.max(fast,Math.ceil(gap/lowSlope));
    if(slow>MAX_MONTHS)return {...base,status:'long-horizon',fastMonths:fast,maxMonths:MAX_MONTHS};
    return {...base,status:'estimate',fastMonths:fast,slowMonths:slow,medianSlope};
  }

  const api=Object.freeze({TARGETS,MAX_MONTHS,normalizeTarget,normalizeLessonTarget,estimate});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.ProgressionCore=api;
})(globalThis);
