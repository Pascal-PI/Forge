'use strict';
const {runLiveLabCode}=require('./livelab-vm.cjs');
async function runCoding({source,stdin=''}){
  if(typeof source!=='string'||!source.trim()||source.length>8000||typeof stdin!=='string'||stdin.length>4000)throw Error('Provide code under 8,000 characters and input under 4,000 characters.');
  const wrapped=`function update(state,event){const lines=event.input.split(/\\r?\\n/);let cursor=0,output='';const input=()=>lines[cursor++] ?? '';const console={log:(...args)=>{output+=args.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')+'\\n';if(output.length>4000)throw Error('Output limit exceeded');}};try{(function(){\n${source}\n})();return {output:output.slice(0,4000),error:''};}catch(e){return {output:output.slice(0,4000),error:String(e && e.message || e).slice(0,500)};}}`;
  try{const result=await runLiveLabCode({source:wrapped,event:{input:stdin},timeoutMs:500});if(!result||typeof result.output!=='string'||typeof result.error!=='string')throw Error('Invalid result');return {output:result.output.slice(0,4000),error:result.error.slice(0,500)};}catch(e){return {output:'',error:'Execution failed or exceeded the time or memory limit.'};}
}
function validateAssignment(a){
  const valid=(v,max)=>typeof v==='string'&&!!v.trim()&&v.length<=max;
  if(!a||!valid(a.title,120)||!valid(a.prompt,1200)||!valid(a.starter,4000)||!valid(a.reference,6000)||!Array.isArray(a.tests)||a.tests.length<2||a.tests.length>3||!a.tests.every(t=>t&&typeof t.input==='string'&&t.input.length<=1000&&typeof t.expected==='string'&&t.expected.length<=1000))throw Error('Invalid coding assignment.');
  return {title:a.title,prompt:a.prompt,starter:a.starter,reference:a.reference,tests:a.tests.map(t=>({input:t.input,expected:t.expected}))};
}
module.exports={runCoding,validateAssignment};
