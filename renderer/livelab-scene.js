(function(root){
  'use strict';
  const text=(v,max)=>typeof v==='string' && v.length<=max;
  const finite=n=>typeof n==='number' && Number.isFinite(n) && Math.abs(n)<=10000;
  const id=s=>typeof s==='string' && /^[a-z][a-z0-9_-]{0,39}$/.test(s);
  const color=s=>typeof s==='string' && /^#[0-9a-f]{6}$/i.test(s);
  function validate(result){
    if(!result || JSON.stringify(result).length>65536)throw Error('Activity scene is too large');
    if(!result || typeof result!=='object' || Array.isArray(result) || !result.state || typeof result.state!=='object' || Array.isArray(result.state) || JSON.stringify(result.state).length>16000) throw Error('Invalid activity state');
    const scene=result.scene;
    if(!scene || !text(scene.title,120) || !scene.title.trim() || !Array.isArray(scene.blocks) || scene.blocks.length>30) throw Error('Invalid activity scene');
    const ids=new Set();
    for(const b of scene.blocks){
      if(!b || typeof b!=='object' || Array.isArray(b)) throw Error('Invalid activity block');
      if(b.type==='text' || b.type==='heading') { if(!text(b.text,1200)) throw Error('Invalid text block'); continue; }
      if(b.type==='button' || b.type==='slider' || b.type==='animation'){
        if(!id(b.id) || ids.has(b.id) || !text(b.label,120) || !b.label.trim()) throw Error('Invalid activity control');
        ids.add(b.id);
        if(b.type==='slider' && (![b.min,b.max,b.step,b.value].every(finite) || b.min>=b.max || b.step<=0 || b.step>b.max-b.min || (b.max-b.min)/b.step>10000 || b.value<b.min || b.value>b.max)) throw Error('Invalid slider');
        if(b.type==='animation' && (!Number.isInteger(b.intervalMs) || b.intervalMs<500 || b.intervalMs>2000))throw Error('Invalid animation interval');
        continue;
      }
      if(b.type==='diagram'){
        if(!text(b.label,200) || !b.label.trim() || !Array.isArray(b.shapes) || b.shapes.length>100) throw Error('Invalid diagram');
        for(const s of b.shapes){
          if(!s || typeof s!=='object' || !color(s.color)) throw Error('Invalid diagram shape');
          if(s.draggable!==undefined && typeof s.draggable!=='boolean')throw Error('Invalid draggable shape');
          if(s.draggable){
            if(!['circle','rect'].includes(s.type) || !id(s.id) || ids.has(s.id) || !text(s.label,120) || !s.label.trim() || !finite(s.x) || !finite(s.y) || s.x<0 || s.x>1000 || s.y<0 || s.y>1000)throw Error('Invalid draggable shape');
            ids.add(s.id);
          }
          if(s.type==='circle' && [s.x,s.y,s.r].every(finite) && s.r>0 && s.r<=1000) continue;
          if(s.type==='rect' && [s.x,s.y,s.width,s.height].every(finite) && s.width>0 && s.width<=1000 && s.height>0 && s.height<=1000) continue;
          if(s.type==='line' && [s.x1,s.y1,s.x2,s.y2,s.width].every(finite) && s.width>0 && s.width<=30) continue;
          if(s.type==='label' && [s.x,s.y,s.size].every(finite) && s.size>=8 && s.size<=80 && text(s.text,120)) continue;
          throw Error('Invalid diagram shape');
        }
        continue;
      }
      throw Error('Unknown activity block');
    }
    return result;
  }
  function validateEvent(scene,event){
    if(!event || typeof event!=='object' || Array.isArray(event))throw Error('Invalid activity event');
    if(event.type==='init' && Object.keys(event).length===1)return event;
    if(!scene || !Array.isArray(scene.blocks) || !id(event.id))throw Error('Invalid activity event');
    const b=scene.blocks.find(block=>block.id===event.id);
    if(event.type==='click' && b?.type==='button' && Object.keys(event).length===2)return event;
    if(event.type==='change' && b?.type==='slider' && Object.keys(event).length===3 && finite(event.value) && event.value>=b.min && event.value<=b.max && Math.abs((event.value-b.min)/b.step-Math.round((event.value-b.min)/b.step))<1e-6)return event;
    if(event.type==='tick' && b?.type==='animation' && Object.keys(event).length===3 && event.dt===b.intervalMs)return event;
    if(event.type==='drag' && Object.keys(event).length===4 && finite(event.x) && finite(event.y) && event.x>=0 && event.x<=1000 && event.y>=0 && event.y<=1000 && scene.blocks.some(block=>block.type==='diagram' && block.shapes.some(shape=>shape.draggable===true && shape.id===event.id)))return event;
    throw Error('Invalid activity event');
  }
  root.LiveLabScene={validate,validateEvent};
  if(typeof module!=='undefined')module.exports=root.LiveLabScene;
})(typeof window!=='undefined'?window:globalThis);
