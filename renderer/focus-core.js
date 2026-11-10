'use strict';
(function(root){
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
  const validText=(value,max)=>typeof value==='string'&&value.length<=max;
  const remaining=(active,now=Date.now())=>!active?.running?Math.max(0,active?.remainingSeconds||0):Math.max(0,Math.ceil((active.lastResumedAt+active.remainingSeconds*1000-now)/1000));
  function empty(){return {active:null,history:[]};}
  function normalize(value){
    if(!record(value))return empty();
    const history=[];
    for(const item of Array.isArray(value.history)?value.history.slice(-200):[]){
      if(!record(item)||!validText(item.id,100)||!validText(item.taskTitle,160)||!integer(item.plannedMinutes,1,180)||!integer(item.actualSeconds,0,10800)||!integer(item.interruptions,0,10000)||!Number.isFinite(item.startedAt)||!Number.isFinite(item.endedAt)||item.endedAt<item.startedAt||!['completed','stopped'].includes(item.status))continue;
      history.push({id:item.id,taskTitle:item.taskTitle,plannedMinutes:item.plannedMinutes,actualSeconds:item.actualSeconds,interruptions:item.interruptions,startedAt:item.startedAt,endedAt:item.endedAt,status:item.status});
    }
    let active=null;const item=value.active;
    if(record(item)&&validText(item.id,100)&&(item.taskId===null||validText(item.taskId,100))&&validText(item.taskTitle,160)&&integer(item.plannedMinutes,1,180)&&integer(item.remainingSeconds,0,10800)&&integer(item.interruptions,0,10000)&&Number.isFinite(item.startedAt)&&typeof item.running==='boolean'&&(!item.running||Number.isFinite(item.lastResumedAt))){
      active={id:item.id,taskId:item.taskId,taskTitle:item.taskTitle,plannedMinutes:item.plannedMinutes,remainingSeconds:item.remainingSeconds,interruptions:item.interruptions,startedAt:item.startedAt,running:item.running,lastResumedAt:item.running?item.lastResumedAt:null};
    }
    return {active,history};
  }
  function start(value,options,now=Date.now()){
    const state=normalize(value),minutes=Number(options?.durationMinutes);
    if(state.active||!integer(minutes,1,180))return state;
    const taskId=typeof options?.taskId==='string'&&options.taskId.length<=100?options.taskId:null;
    const taskTitle=typeof options?.taskTitle==='string'?options.taskTitle.slice(0,160):'';
    state.active={id:`focus-${now}-${Math.random().toString(36).slice(2,8)}`,taskId,taskTitle,plannedMinutes:minutes,remainingSeconds:minutes*60,interruptions:0,startedAt:now,running:true,lastResumedAt:now};
    return state;
  }
  function checkpoint(value,now=Date.now()){
    const state=normalize(value);if(!state.active?.running)return state;
    const active={...state.active,remainingSeconds:remaining(state.active,now),lastResumedAt:now};
    if(active.remainingSeconds===0)active.running=false;
    state.active=active;return state;
  }
  function pause(value,now=Date.now(),interruption=false){
    const state=normalize(value);if(!state.active?.running)return state;
    const seconds=remaining(state.active,now);
    state.active={...state.active,remainingSeconds:seconds,running:false,lastResumedAt:null,interruptions:state.active.interruptions+(interruption?1:0)};
    return state;
  }
  function resume(value,now=Date.now()){
    const state=normalize(value);if(!state.active||state.active.running||state.active.remainingSeconds<=0)return state;
    state.active={...state.active,running:true,lastResumedAt:now};return state;
  }
  function recover(value){
    const state=normalize(value);if(!state.active?.running)return state;
    state.active={...state.active,running:false,lastResumedAt:null,interruptions:state.active.interruptions+1};return state;
  }
  function finish(value,status='stopped',now=Date.now()){
    const state=normalize(value),active=state.active;if(!active||!['completed','stopped'].includes(status))return state;
    const seconds=remaining(active,now);
    state.history.push({id:active.id,taskTitle:active.taskTitle,plannedMinutes:active.plannedMinutes,actualSeconds:Math.max(0,active.plannedMinutes*60-seconds),interruptions:active.interruptions,startedAt:active.startedAt,endedAt:now,status});
    state.history=state.history.slice(-200);state.active=null;return state;
  }
  const api={empty,normalize,remaining,start,checkpoint,pause,resume,recover,finish};
  root.FocusCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
