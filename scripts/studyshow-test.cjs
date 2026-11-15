'use strict';const assert=require('node:assert/strict');const C=require('../renderer/studyshow-core.js');
const shape={type:'diagram',label:'A line and point',shapes:[{type:'line',x1:10,y1:100,x2:900,y2:100,width:4,color:'#123456'},{type:'circle',x:200,y:100,r:20,color:'#123456'}]},check={question:'Which?',choices:['A','B','C'],correctIndex:1,explanation:'B is correct.'},show={title:'A show',sceneIndex:0,passed:[],scenes:[{title:'First',captions:['One sentence.'],diagram:shape,checkpoint:check},{title:'Second',captions:['Another sentence.'],diagram:shape,checkpoint:null}]};
assert.deepEqual(C.normalize(show),show);assert.throws(()=>C.normalize({...show,passed:[1]}),/progress/);assert.throws(()=>C.normalize({...show,scenes:show.scenes.map(s=>({...s,checkpoint:null}))}),/checkpoint/);assert.throws(()=>C.normalize({...show,scenes:[{...show.scenes[0],checkpoint:{...check,correctIndex:8}},show.scenes[1]]}),/checkpoint/);assert.throws(()=>C.normalize({...show,scenes:[{...show.scenes[0],diagram:{...shape,shapes:[{type:'label',x:1,y:1,size:40,text:'Hi',color:'#000000'}]}},show.scenes[1]]}),/scene/);console.log('StudyShow storyboard, diagrams, checkpoints and progress validation passed');
const moved={...shape,shapes:[shape.shapes[0],{...shape.shapes[1],x:400}]};
const animated={...show,scenes:[{...show.scenes[0],captions:['First.','Second.'],frames:[shape,moved]},show.scenes[1]]};
assert.equal(C.normalize(animated).scenes[0].frames[1].shapes[1].x,400);
assert.throws(()=>C.normalize({...animated,scenes:[{...animated.scenes[0],frames:[shape]},show.scenes[1]]}),/match the captions/);

assert.throws(()=>C.normalize({...show,scenes:[{...show.scenes[0],captions:[{text:'wrong'}]},show.scenes[1]]}),/scene 1: captions must be an array/);
assert.throws(()=>C.normalize({...show,scenes:[{...show.scenes[0],diagram:{...shape,shapes:[shape.shapes[0]]}},show.scenes[1]]}),/scene 1: the first frame needs at least two non-label shapes/);
assert.throws(()=>C.normalize({...animated,scenes:[{...animated.scenes[0],frames:[shape,{...moved,shapes:[moved.shapes[0]]}]},show.scenes[1]]}),/scene 1: frame 2 needs at least two visible non-label shapes/);
