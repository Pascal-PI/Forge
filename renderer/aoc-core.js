'use strict';
(function(root){
  const MIN_YEAR=2015,MAX_YEAR=new Date().getFullYear();
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const yearValue=value=>Number.isInteger(Number(value))&&Number(value)>=MIN_YEAR&&Number(value)<=MAX_YEAR?Number(value):null;
  function blank(){return {selectedYear:MAX_YEAR,years:{}};}
  function normalize(value){
    if(!record(value))return blank();
    const normalized={selectedYear:yearValue(value.selectedYear)||MAX_YEAR,years:{}};
    if(!record(value.years))return normalized;
    for(const [key,days] of Object.entries(value.years)){
      const year=yearValue(key);if(year===null||!record(days))continue;
      const kept={};
      for(const [dayKey,stars] of Object.entries(days)){
        const day=Number(dayKey);if(!Number.isInteger(day)||day<1||day>25||![1,2].includes(stars))continue;
        kept[String(day)]=stars;
      }
      if(Object.keys(kept).length)normalized.years[String(year)]=kept;
    }
    return normalized;
  }
  function stats(value,year){
    const normalized=normalize(value),chosen=yearValue(year)??normalized.selectedYear,days=normalized.years[String(chosen)]||{};
    return {year:chosen,days:{...days},completedDays:Object.keys(days).length,stars:Object.values(days).reduce((sum,count)=>sum+count,0)};
  }
  function setStars(value,year,day,stars){
    const normalized=normalize(value),chosen=yearValue(year),n=Number(day),count=Number(stars);
    if(chosen===null||!Number.isInteger(n)||n<1||n>25||![0,1,2].includes(count))return normalized;
    normalized.selectedYear=chosen;const days={...(normalized.years[String(chosen)]||{})};
    if(count===0)delete days[String(n)];else days[String(n)]=count;
    if(Object.keys(days).length)normalized.years[String(chosen)]=days;else delete normalized.years[String(chosen)];
    return normalized;
  }
  const api={MIN_YEAR,MAX_YEAR,blank,normalize,stats,setStars};
  root.AocCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
