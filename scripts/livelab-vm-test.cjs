'use strict';
const assert=require('node:assert/strict');
const {runLiveLabCode}=require('../livelab-vm.cjs');
(async()=>{
  const source='function update(state,event){return {count:state.count+event.delta, labels:["growth", "time"]}}';
  assert.deepEqual(await runLiveLabCode({source,state:{count:2},event:{delta:3}}),{count:5,labels:['growth','time']});
  const capabilities=await runLiveLabCode({source:'function update(){return {process:typeof process,require:typeof require,fetch:typeof fetch,document:typeof document,websocket:typeof WebSocket}}'});
  assert.deepEqual(capabilities,{process:'undefined',require:'undefined',fetch:'undefined',document:'undefined',websocket:'undefined'});
  await assert.rejects(runLiveLabCode({source:'function update(){while(true){}}',timeoutMs:100}),/failed|limit/);
  await assert.rejects(runLiveLabCode({source:'function update(){let a=[];while(true)a.push("x".repeat(10000))}',timeoutMs:200}),/failed|limit/);
  await assert.rejects(runLiveLabCode({source:'function update(){return "x".repeat(100000)}'}),/too much data/);
  await assert.rejects(runLiveLabCode({source:'function update(){return undefined}'}),/JSON value/);
  await assert.rejects(runLiveLabCode({source:'x'.repeat(32769)}),/Invalid activity code/);
  assert.equal(await runLiveLabCode({source:'function update(){return 42}'}),42);
  console.log('LiveLab JS runtime: interaction, capability isolation, time and memory limits passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
