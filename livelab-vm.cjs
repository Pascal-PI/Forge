'use strict';
const path=require('node:path');
const {Worker}=require('node:worker_threads');

// Guest code runs in a bounded worker and returns data to the validated scene
// protocol. It is never executed in the application renderer.
function runLiveLabCode({source,state=null,event=null,timeoutMs=250}={}) {
  if(typeof source!=='string' || !source.trim() || Buffer.byteLength(source,'utf8')>32768) return Promise.reject(Error('Invalid activity code.'));
  if(!Number.isInteger(timeoutMs) || timeoutMs<50 || timeoutMs>1000) return Promise.reject(Error('Invalid activity execution budget.'));
  let input;
  try {input=JSON.stringify({state,event});} catch {return Promise.reject(Error('Activity input must be JSON data.'));}
  if(typeof input!=='string' || Buffer.byteLength(input,'utf8')>65536) return Promise.reject(Error('Activity input is too large.'));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(path.join(__dirname,'livelab-vm-worker.cjs'),{resourceLimits:{maxOldGenerationSizeMb:64,maxYoungGenerationSizeMb:16,stackSizeMb:2}});
    let settled=false;
    const timer=setTimeout(()=>finish(Error('The activity exceeded its execution limit.')),5000);
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate().catch(()=>{});if(error)reject(error);else resolve(value);};
    worker.once('error',()=>finish(Error('The activity worker failed.')));
    worker.once('exit',code=>{if(!settled)finish(Error(`The activity worker stopped (${code}).`));});
    worker.once('message',result=>{if(!result || result.ok!==true)finish(Error(result?.error||'The activity failed.'));else finish(null,result.value);});
    worker.postMessage({source,...JSON.parse(input),timeoutMs});
  });
}
module.exports={runLiveLabCode};
