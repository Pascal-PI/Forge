'use strict';
const {parentPort}=require('node:worker_threads');
const {getQuickJS,shouldInterruptAfterDeadline}=require('quickjs-emscripten');

parentPort.once('message',async ({source,state,event,timeoutMs})=>{
  let runtime,context;
  try {
    const quickjs=await getQuickJS();
    runtime=quickjs.newRuntime();
    runtime.setMemoryLimit(16*1024*1024);
    runtime.setMaxStackSize(512*1024);
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now()+timeoutMs));
    context=runtime.newContext();
    // The guest receives only JSON values. No filesystem, network, Node, DOM,
    // callbacks, module loader, or other host objects are installed in the VM.
    const program=`'use strict';\n${source}\n;JSON.stringify({value:update(${JSON.stringify(state)},${JSON.stringify(event)})})`;
    const result=context.evalCode(program,'livelab.js');
    if(result.error){result.error.dispose();throw Error('The activity code failed or exceeded its execution limit.');}
    const value=context.getString(result.value); result.value.dispose();
    if(typeof value!=='string' || Buffer.byteLength(value,'utf8')>65536)throw Error('The activity returned too much data.');
    const parsed=JSON.parse(value);
    if(!parsed || !Object.hasOwn(parsed,'value'))throw Error('The activity must return a JSON value.');
    parentPort.postMessage({ok:true,value:parsed.value});
  } catch(error){parentPort.postMessage({ok:false,error:String(error.message||'Activity failed.').slice(0,500)});}
  finally { context?.dispose(); runtime?.dispose(); }
});
