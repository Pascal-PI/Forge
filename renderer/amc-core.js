(function(root){
  'use strict';
  const empty=()=>({active:null,attempts:[],reviews:[]});
  function score(answers,key){
    if(!Array.isArray(answers)||answers.length!==25||!/^[A-E]{25}$/.test(key))throw Error('Invalid exam');
    let correct=0,blank=0;
    answers.forEach((answer,i)=>{if(!answer)blank++;else if(answer===key[i])correct++;});
    return {correct,blank,wrong:25-correct-blank,score:correct*6+blank*1.5};
  }
  function normalize(value){
    if(value===undefined)return empty();
    const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
    const num=x=>Number.isFinite(x)&&x>=0;
    const id=x=>typeof x==='string'&&/^amc10-\d{4}[A-D]$/.test(x);
    const text=x=>typeof x==='string'&&x.length<=100000;
    const answers=x=>Array.isArray(x)&&x.length===25&&x.every(a=>typeof a==='string'&&/^[A-E]?$/.test(a));
    const bools=x=>Array.isArray(x)&&x.length===25&&x.every(a=>typeof a==='boolean');
    const session=x=>obj(x)&&text(x.id)&&id(x.examId)&&['timed','practice'].includes(x.mode)&&num(x.startedAt)&&answers(x.answers)&&Array.isArray(x.notes)&&x.notes.length===25&&x.notes.every(text)&&bools(x.flags)&&bools(x.checked);
    const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00'));
    if(!obj(value)||!Array.isArray(value.attempts)||!Array.isArray(value.reviews)||value.attempts.length>10000||value.reviews.length>10000)throw Error('Invalid AMC practice backup');
    if(value.active!==null&&(!session(value.active)||!(value.active.deadline===null||num(value.active.deadline))||(value.active.mode==='timed'&&!num(value.active.deadline))))throw Error('Invalid AMC session');
    if(!value.attempts.every(x=>session(x)&&num(x.completedAt)&&num(x.elapsedSeconds)&&num(x.score)&&x.score<=150))throw Error('Invalid AMC attempt');
    if(!value.reviews.every(x=>obj(x)&&text(x.id)&&id(x.examId)&&Number.isInteger(x.question)&&x.question>=1&&x.question<=25&&Number.isInteger(x.stage)&&x.stage>=0&&x.stage<=3&&validDate(x.next)))throw Error('Invalid AMC reviews');
    return {active:value.active,attempts:value.attempts,reviews:value.reviews};
  }
  const api={empty,score,normalize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AmcCore=api;
})(globalThis);
