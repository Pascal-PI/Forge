'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');

// Simulation only: this ledger does not connect to billing or real plans.
const KINDS=new Set(['new','unlock','reopen','interaction','minor','major']);
// FORGE permits one app instance per profile; share the queue across all ledger
// objects in that process so concurrent reservations cannot overwrite each other.
const fileQueues=new Map();
const token=value=>typeof value==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const month=value=>typeof value==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
function validateEntry(e){
  if(!e||!token(e.id)||!token(e.account)||!token(e.lab)||!month(e.period)||!KINDS.has(e.kind)||!['pending','committed','released'].includes(e.status)||![0,1].includes(e.amount)||!(e.limit===null||Number.isInteger(e.limit)&&e.limit>=0&&e.limit<=100000)||typeof e.consent!=='boolean')throw Error('Invalid LiveLab usage record.');
}
function validateState(value){
  if(!value||value.version!==1||!Array.isArray(value.entries)||value.entries.length>10000)throw Error('Invalid LiveLab usage ledger.');
  const ids=new Set();for(const e of value.entries){validateEntry(e);if(ids.has(e.id))throw Error('Duplicate LiveLab usage record.');ids.add(e.id);}
  return value;
}
function reserve(state,request){
  validateState(state);
  const {id,account,lab,period,kind,limit=null,consent=false}=request||{};
  const base={id,account,lab,period,kind,limit,consent,status:'pending',amount:0};validateEntry(base);
  const existing=state.entries.find(e=>e.id===id);
  if(existing){if(['account','lab','period','kind','limit','consent'].some(k=>existing[k]!==base[k]))throw Error('Reservation ID was already used for a different request.');return existing;}
  if(state.entries.length>=10000)throw Error('LiveLab usage ledger is full.');
  const relevant=state.entries.filter(e=>e.account===account),unlocked=relevant.some(e=>e.lab===lab&&e.status==='committed'&&['new','unlock'].includes(e.kind));
  if(['reopen','interaction','minor','major'].includes(kind)&&!unlocked)throw Error('This simulated account has not unlocked the lab.');
  if(kind==='major'&&!consent)throw Error('Major regeneration requires explicit consent.');
  if(kind==='minor'&&relevant.filter(e=>e.lab===lab&&e.kind==='minor'&&e.status!=='released').length>=2)throw Error('The two included minor revisions are already reserved or used.');
  base.amount=kind==='major'||(kind==='new'||kind==='unlock')&&!unlocked?1:0;
  const reserved=relevant.filter(e=>e.period===period&&e.status!=='released').reduce((sum,e)=>sum+e.amount,0);
  if(limit!==null&&reserved+base.amount>limit)throw Error('The simulated monthly LiveLab allowance is exhausted.');
  state.entries.push(base);return base;
}
function finish(state,id,commit){
  validateState(state);if(!token(id))throw Error('Invalid reservation ID.');
  const entry=state.entries.find(e=>e.id===id);if(!entry)throw Error('Unknown reservation.');
  if(entry.status!=='pending')return entry;
  if(commit&&['new','unlock'].includes(entry.kind)&&state.entries.some(e=>e.id!==entry.id&&e.account===entry.account&&e.lab===entry.lab&&e.status==='committed'&&['new','unlock'].includes(e.kind)))entry.amount=0;
  entry.status=commit?'committed':'released';return entry;
}
function summary(state,account,period){
  validateState(state);if(!token(account)||!month(period))throw Error('Invalid usage query.');
  const entries=state.entries.filter(e=>e.account===account&&e.period===period);
  return {committed:entries.filter(e=>e.status==='committed').reduce((n,e)=>n+e.amount,0),reserved:entries.filter(e=>e.status==='pending').reduce((n,e)=>n+e.amount,0)};
}
function createSimulatedLedger(file){
  file=path.resolve(file);
  async function read(){
    try{const info=await fs.stat(file);if(info.size>5*1024*1024)throw Error('LiveLab usage ledger is too large.');return validateState(JSON.parse(await fs.readFile(file,'utf8')));}
    catch(e){if(e.code==='ENOENT')return {version:1,entries:[]};throw e;}
  }
  function transact(fn,write=true){
    const run=(fileQueues.get(file)||Promise.resolve()).then(async()=>{
      const state=await read(),result=fn(state);
      if(write){
        await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';
        try{await fs.writeFile(temp,JSON.stringify(state),{flag:'wx',mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true}).catch(()=>{});}
      }
      return JSON.parse(JSON.stringify(result));
    });
    const tail=run.catch(()=>{});fileQueues.set(file,tail);
    tail.finally(()=>{if(fileQueues.get(file)===tail)fileQueues.delete(file);});
    return run;
  }
  return {reserve:request=>transact(s=>reserve(s,request)),commit:id=>transact(s=>finish(s,id,true)),release:id=>transact(s=>finish(s,id,false)),summary:(account,period)=>transact(s=>summary(s,account,period),false)};
}
module.exports={createSimulatedLedger,reserve,finish,summary,validateState};
