(function(root){
  'use strict';
  const text=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
  function visible(shape){
    if(shape.type==='circle')return shape.x+shape.r>=0&&shape.x-shape.r<=1000&&shape.y+shape.r>=0&&shape.y-shape.r<=1000;
    if(shape.type==='rect')return shape.x+shape.width>=0&&shape.x<=1000&&shape.y+shape.height>=0&&shape.y<=1000;
    if(shape.type==='line')return Math.max(shape.x1,shape.x2)>=0&&Math.min(shape.x1,shape.x2)<=1000&&Math.max(shape.y1,shape.y2)>=0&&Math.min(shape.y1,shape.y2)<=1000;
    if(shape.type==='polygon'||shape.type==='polyline')return shape.points.some(([x,y])=>x>=0&&x<=1000&&y>=0&&y<=1000);
    return false;
  }
  function normalize(value){
    if(!value||!text(value.title,120)||!Array.isArray(value.scenes)||value.scenes.length<2||value.scenes.length>4||!Number.isInteger(value.sceneIndex)||value.sceneIndex<0||value.sceneIndex>=value.scenes.length||!Array.isArray(value.passed)||value.passed.length>value.scenes.length)throw Error('Invalid StudyShow');
    const sceneCore=root.LiveLabScene||(typeof require==='function'?require('./livelab-scene.js'):null);
    const scenes=value.scenes.map((scene,index)=>{
      const prefix=`Invalid StudyShow scene ${index+1}: `;
      if(!scene || typeof scene!=='object' || Array.isArray(scene))throw Error(prefix+'provide a scene object');
      if(!text(scene.title,120))throw Error(prefix+'title must be a nonempty string of at most 120 characters');
      if(!Array.isArray(scene.captions) || scene.captions.length<1 || scene.captions.length>4 || !scene.captions.every(x=>text(x,250)))throw Error(prefix+'captions must be an array of 1 to 4 nonempty strings, each at most 250 characters');
      if(!scene.diagram || scene.diagram.type!=='diagram')throw Error(prefix+'the first frame must be a diagram object with type diagram');
      if(!Array.isArray(scene.diagram.shapes) || scene.diagram.shapes.filter(x=>x && x.type!=='label').length<2)throw Error(prefix+'the first frame needs at least two non-label shapes');
      function checkedDiagram(diagram,frame){if(!diagram||diagram.type!=='diagram')throw Error(prefix+frame+' must be a diagram object');try{sceneCore.validate({state:{},scene:{title:scene.title,blocks:[diagram]}});}catch(error){throw Error(prefix+frame+': '+error.message);}if(diagram.shapes.filter(visible).length<2)throw Error(prefix+frame+' needs at least two visible non-label shapes');return JSON.parse(JSON.stringify(diagram));}
      const diagram=checkedDiagram(scene.diagram,'first frame');
      let frames=null;if(scene.frames!=null){if(!Array.isArray(scene.frames)||scene.frames.length!==scene.captions.length)throw Error('StudyShow frames must match the captions');frames=scene.frames.map((frame,index)=>checkedDiagram(frame,`frame ${index+1}`));}
      let checkpoint=null;
      if(scene.checkpoint!=null){const c=scene.checkpoint;if(!text(c.question,600)||!Array.isArray(c.choices)||c.choices.length<3||c.choices.length>4||!c.choices.every(x=>text(x,250))||new Set(c.choices.map(x=>x.trim().toLowerCase())).size!==c.choices.length||!Number.isInteger(c.correctIndex)||c.correctIndex<0||c.correctIndex>=c.choices.length||!text(c.explanation,700))throw Error('Invalid StudyShow checkpoint');checkpoint={question:c.question,choices:[...c.choices],correctIndex:c.correctIndex,explanation:c.explanation};}
      return {title:scene.title,captions:[...scene.captions],diagram,checkpoint,...(frames?{frames}:{})};
    });
    if(!scenes.some(s=>s.checkpoint))throw Error('StudyShow needs a checkpoint');
    if(!value.passed.every(i=>Number.isInteger(i)&&i>=0&&i<scenes.length&&scenes[i].checkpoint)||new Set(value.passed).size!==value.passed.length)throw Error('Invalid StudyShow progress');
    return {title:value.title,scenes,sceneIndex:value.sceneIndex,passed:[...value.passed]};
  }
  root.StudyShowCore={normalize};if(typeof module!=='undefined')module.exports=root.StudyShowCore;
})(typeof window!=='undefined'?window:globalThis);
