'use strict';
const assert=require('node:assert/strict');
const {createLiveLabSession}=require('../livelab-session.cjs');
const Scene=require('../renderer/livelab-scene.js');

(async()=>{
  const motion=`function update(state,event){
    let speed=state ? state.speed : 2;
    if(event.type==='change')speed=event.value;
    return {state:{speed},scene:{title:'Moving object',blocks:[
      {type:'text',text:'Change the speed.'},
      {type:'slider',id:'speed',label:'Speed',min:1,max:5,step:1,value:speed},
      {type:'diagram',label:'Position after ten seconds',shapes:[{type:'circle',x:speed*10,y:50,r:5,color:'#ff8844'}]}
    ]}};
  }`;
  const simulation=createLiveLabSession(motion);
  let scene=await simulation.step({type:'init'});
  assert.equal(scene.blocks[2].shapes[0].x,20);
  scene=await simulation.step({type:'change',id:'speed',value:4});
  assert.equal(scene.blocks[2].shapes[0].x,40);
  await assert.rejects(simulation.step({type:'change',id:'speed',value:40}),/Invalid activity event/);
  assert.equal(simulation.snapshot().state.speed,4);
  scene.blocks[1].value=1;
  assert.equal(simulation.snapshot().scene.blocks[1].value,4);
  const restored=createLiveLabSession(motion,simulation.snapshot());
  assert.equal(restored.snapshot().state.speed,4);
  assert.equal((await restored.step({type:'change',id:'speed',value:5})).blocks[2].shapes[0].x,50);
  assert.throws(()=>createLiveLabSession(motion,{state:{},scene:{title:'x',blocks:[{type:'html',text:'bad'}]}}),/Unknown activity block/);

  const story=`function update(state,event){
    const day=state ? state.day+(event.type==='click'?1:0) : 0;
    return {state:{day},scene:{title:'History explorer',blocks:[
      {type:'heading',text:day?'The next event':'The first event'},
      {type:'button',id:'next',label:'Continue'},
      {type:'text',text:'Step '+day}
    ]}};
  }`;
  const timeline=createLiveLabSession(story);
  assert.equal((await timeline.step({type:'init'})).blocks[0].text,'The first event');
  assert.equal((await timeline.step({type:'click',id:'next'})).blocks[0].text,'The next event');
  await assert.rejects(timeline.step({type:'click',id:'missing'}),/Invalid activity event/);
  const animated=`function update(state,event){let s=state||{x:100,y:200,time:0};if(event.type==='tick')s.time+=event.dt;if(event.type==='drag'){s.x=event.x;s.y=event.y}return {state:s,scene:{title:'Moving point',blocks:[{type:'animation',id:'clock',label:'Motion',intervalMs:500},{type:'diagram',label:'Move the point',shapes:[{type:'circle',id:'point',label:'Point',draggable:true,x:s.x,y:s.y,r:20,color:'#ffaa00'}]},{type:'text',text:'Time '+s.time}]}}}`;
  const motionSession=createLiveLabSession(animated);await motionSession.step({type:'init'});
  scene=await motionSession.step({type:'tick',id:'clock',dt:500});assert.equal(scene.blocks[2].text,'Time 500');
  scene=await motionSession.step({type:'drag',id:'point',x:400,y:300});assert.equal(scene.blocks[1].shapes[0].x,400);
  await assert.rejects(motionSession.step({type:'tick',id:'clock',dt:1}),/Invalid activity event/);
  await assert.rejects(motionSession.step({type:'drag',id:'point',x:1001,y:0}),/Invalid activity event/);
  assert.equal(motionSession.snapshot().state.time,500);
  motionSession.close();
  const inputSource=`function update(s,e){let answer=e.type==='submit'?e.value:(s?s.answer:'');return {state:{answer},scene:{title:'Try an answer',blocks:[{type:'input',id:'answer',label:'Your answer',value:answer,maxLength:40},{type:'text',text:'You entered: '+answer}]}}}`;
  const inputSession=createLiveLabSession(inputSource);await inputSession.step({type:'init'});
  scene=await inputSession.step({type:'submit',id:'answer',value:'<script>alert(1)</script>'});assert.equal(scene.blocks[1].text,'You entered: <script>alert(1)</script>');
  await assert.rejects(inputSession.step({type:'submit',id:'answer',value:'x'.repeat(41)}),/Invalid activity event/);
  assert.equal(inputSession.snapshot().state.answer,'<script>alert(1)</script>');inputSession.close();
  const bad=createLiveLabSession(`function update(s,e){if(e.type==='click')return {state:{broken:true},scene:{title:'Oops',blocks:[{type:'html',text:'<script>'}]}};return {state:{safe:true},scene:{title:'Safe',blocks:[{type:'button',id:'next',label:'Next'}]}}}`);
  await bad.step({type:'init'});await assert.rejects(bad.step({type:'click',id:'next'}),/Unknown activity block/);
  assert.equal(bad.snapshot().state.safe,true);
  assert.throws(()=>Scene.validate({state:{},scene:{title:'x',blocks:[{type:'diagram',label:'x',shapes:[{type:'circle',x:0,y:0,r:5,color:'url(evil)'}]}]}}),/Invalid diagram shape/);
  const curve={state:{},scene:{title:'Curve',blocks:[{type:'diagram',label:'Curve',shapes:[{type:'polyline',points:[[0,0],[100,50],[200,200]],width:5,color:'#123456'},{type:'polygon',points:[[0,0],[20,0],[10,20]],color:'#abcdef'}]}]}};
  assert.equal(Scene.validate(curve),curve);
  assert.throws(()=>Scene.validate({...curve,scene:{...curve.scene,blocks:[{...curve.scene.blocks[0],shapes:[{type:'polyline',points:[[0,0],[Infinity,2]],width:5,color:'#123456'}]}]}}),/Invalid diagram shape/);
  simulation.close();await assert.rejects(simulation.step({type:'change',id:'speed',value:2}),/closed/);
  console.log('Generated activity sessions: simulation, story, event validation and rollback passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
