'use strict';
const {runLiveLabCode}=require('./livelab-vm.cjs');
const Scene=require('./renderer/livelab-scene.js');

// Host-owned state: guest code only returns data, and a failed step never
// replaces the last usable scene. The IPC boundary validates the sender and
// restores a validated snapshot before forwarding an event.
function createLiveLabSession(source,initialSnapshot=null){
  let state=null,scene=null,busy=false,closed=false;
  if(initialSnapshot!==null){
    Scene.validate(initialSnapshot);
    const copy=JSON.parse(JSON.stringify(initialSnapshot)); state=copy.state;scene=copy.scene;
  }
  async function step(event){
    if(closed)throw Error('The activity is closed.');
    if(busy)throw Error('The activity is already updating.');
    if(!scene && event?.type!=='init')throw Error('The activity has not started.');
    if(scene && event?.type==='init')throw Error('The activity has already started.');
    Scene.validateEvent(scene,event);
    busy=true;
    try {
      const result=await runLiveLabCode({source,state,event});
      Scene.validate(result);
      if(closed)throw Error('The activity is closed.');
      state=JSON.parse(JSON.stringify(result.state)); scene=JSON.parse(JSON.stringify(result.scene));
      return JSON.parse(JSON.stringify(scene));
    } finally {busy=false;}
  }
  return {step,close(){closed=true;},snapshot(){return scene ? JSON.parse(JSON.stringify({state,scene})) : null;}};
}
module.exports={createLiveLabSession};
