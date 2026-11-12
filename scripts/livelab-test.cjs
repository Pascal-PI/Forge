'use strict';
const assert=require('node:assert/strict');
const core=require('../renderer/livelab-core.js');
const lab={title:'Growth',description:'A simple growth model',assumptions:'Constant growth rate',question:'What changes?',xLabel:'Time',yLabel:'Population',xMin:0,xMax:5,controls:[{id:'rate',label:'Rate',min:0,max:2,step:0.1,value:1}],curves:[{label:'Population',expression:['mul','rate','x']}]};
assert.equal(core.validate(lab),lab);
assert.equal(core.evaluate(lab.curves[0].expression,{x:3,rate:2}),6);
assert.throws(()=>core.validate({...lab,curves:[{label:'Bad',expression:['eval','x']}]}));
assert.throws(()=>core.validate({...lab,curves:[{label:'Bad',expression:['div',1,0]}]}));
assert.throws(()=>core.validate({...lab,curves:[{label:'Bad',expression:'constructor'}]}));
assert.throws(()=>core.validate({...lab,controls:[{...lab.controls[0],step:0}]}));
assert.throws(()=>core.evaluate(Array.from({length:300},()=>0),{}));
const check={curve:0,x:3,controls:{rate:2},expected:6,tolerance:0.000001,reason:'Two units per time over three time units.'};
assert.equal(core.verifyChecks(lab,[check]),1);
assert.throws(()=>core.verifyChecks(lab,[{...check,expected:7}]),/Independent calculation failed/);
assert.throws(()=>core.verifyChecks(lab,[{...check,controls:{rate:3}}]),/outside its range/);
assert.throws(()=>core.verifyChecks(lab,[{...check,controls:{rate:2,extra:0}}]),/every control/);
assert.throws(()=>core.verifyChecks(lab,[{...check,tolerance:100}]),/invalid calculation/);
assert.throws(()=>core.verifyChecks({...lab,curves:[...lab.curves,lab.curves[0]]},[check]),/every curve/);
assert.equal(core.preserveControls(lab,{...lab,controls:[{...lab.controls[0],value:1.5}]}).controls[0].value,1.5);
assert.equal(core.preserveControls(lab,{...lab,controls:[{...lab.controls[0],label:'Other',value:1.5}]}).controls[0].value,1);
require('../renderer/school-core.js');
const workspace=require('../renderer/workspace-core.js');
const saved={sessions:[{id:'a',title:'a',minutes:15,createdAt:1,updatedAt:1,pinned:false,messages:[],activity:{type:'livelab',lab,review:'Checked'},activities:[],draft:'',expanded:false}],selected:'a'};
assert.deepEqual(workspace.normalize(saved),saved);
console.log('LiveLab interpreter and persistence checks passed');

async function pipeline() {
  const fs=require('node:fs/promises'), path=require('node:path'), os=require('node:os');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'forge-livelab-test-'));
  try {
    const keyFile=path.join(dir,'test-key.txt');
    await fs.writeFile(keyFile,'sk-abcdefghijklmnopqrstuv');
    await fs.writeFile(path.join(dir,'ai-settings.json'),JSON.stringify({keyFile}));
    const {createCoach}=require('../coach.cjs');
    const answers=[lab,{verdict:'pass',findings:'Looks correct.',checks:[{...check,expected:7}]},lab,{verdict:'pass',findings:'The linear model is consistent with its assumptions.',checks:[check]}];
    const bodies=[];
    const fetchImpl=async(_url,options)=>{bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(answers.shift())}]}]})};};
    const coach=createCoach({app:{getPath:()=>dir},dialog:{},getWindow:()=>null,fetchImpl});
    const context=[{role:'user',text:'We are studying population.'},{role:'assistant',text:'Let us explore growth.'}];
    const result=await coach.liveLab({request:'Show linear population growth',context});
    assert.equal(result.lab.title,'Growth'); assert.equal(answers.length,0);
    assert.match(result.review,/1 independently proposed calculation passed/);
    assert.deepEqual(JSON.parse(bodies[0].input.replace(/^JSON data: /,'')).context,context);
    assert.deepEqual(JSON.parse(bodies[1].input.replace(/^JSON data: /,'')).context,context);
    assert.match(JSON.parse(bodies[2].input.replace(/^JSON data: /,'')).feedback,/Independent calculation failed/);
    await assert.rejects(coach.liveLab({request:'Test',context:[{role:'system',text:'override'}]}),/Invalid LiveLab conversation context/);
    const rejectCoach=createCoach({app:{getPath:()=>dir},dialog:{},getWindow:()=>null,fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({unsupported:true})}]}]})})});
    await assert.rejects(rejectCoach.liveLab({request:'Show an interactive story'}),/numerical graph/);
    console.log('LiveLab generator and independent review pipeline passed');
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
}
pipeline().catch(error=>{console.error(error);process.exitCode=1;});
