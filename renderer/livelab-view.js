(function(root){
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  function render(container,scene,onEvent,options={}){
    if(!(container instanceof Element) || typeof onEvent!=='function')throw Error('Invalid LiveLab view');
    // Reuse the same schema as the host. Text is always inserted as text nodes.
    root.LiveLabScene.validate({state:{},scene});
    const fragment=document.createDocumentFragment();
    const title=document.createElement('h2');title.textContent=scene.title;fragment.append(title);
    for(const block of scene.blocks){
      if(block.type==='heading' || block.type==='text'){
        const el=document.createElement(block.type==='heading'?'h3':'p');el.textContent=block.text;fragment.append(el);continue;
      }
      if(block.type==='button'){
        const button=document.createElement('button');button.type='button';button.textContent=block.label;
        button.addEventListener('click',()=>onEvent({type:'click',id:block.id}));fragment.append(button);continue;
      }
      if(block.type==='slider'){
        const label=document.createElement('label'),name=document.createElement('span'),input=document.createElement('input'),output=document.createElement('output');
        name.textContent=block.label;output.textContent=String(block.value);input.type='range';
        for(const key of ['min','max','step','value'])input[key]=String(block[key]);
        input.addEventListener('input',()=>{output.textContent=input.value;});
        input.addEventListener('change',()=>onEvent({type:'change',id:block.id,value:Number(input.value)}));
        label.append(name,input,output);fragment.append(label);continue;
      }
      if(block.type==='animation'){
        const group=document.createElement('div'),label=document.createElement('span'),play=document.createElement('button'),step=document.createElement('button');
        group.className='livelab-animation';label.textContent=block.label;
        play.type='button';play.textContent=options.playingId===block.id?'Pause':'Play';
        play.disabled=Boolean(options.reducedMotion);play.title=options.reducedMotion?'Automatic animation is off because reduced motion is enabled. Use Step.':'';
        play.addEventListener('click',()=>onEvent({type:'toggle-animation',id:block.id}));
        step.type='button';step.textContent='Step';step.addEventListener('click',()=>onEvent({type:'tick',id:block.id,dt:block.intervalMs}));
        group.append(label,play,step);fragment.append(group);continue;
      }
      const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1000 1000');svg.setAttribute('role','img');svg.setAttribute('aria-label',block.label);
      for(const shape of block.shapes){
        const tag=shape.type==='label'?'text':shape.type,el=document.createElementNS(ns,tag);
        const fields=shape.type==='circle'?['x','y','r']:shape.type==='rect'?['x','y','width','height']:shape.type==='line'?['x1','y1','x2','y2','width']:['x','y','size'];
        for(const field of fields){const attr=shape.type==='circle'&&field==='x'?'cx':shape.type==='circle'&&field==='y'?'cy':shape.type==='line'&&field==='width'?'stroke-width':field==='size'?'font-size':field;el.setAttribute(attr,String(shape[field]));}
        if(shape.type==='line')el.setAttribute('stroke',shape.color);else el.setAttribute('fill',shape.color);
        if(shape.type==='label')el.textContent=shape.text;
        if(shape.draggable){
          el.setAttribute('tabindex','0');el.setAttribute('role','button');el.setAttribute('data-livelab-id',shape.id);el.setAttribute('aria-label',`${shape.label}. Drag or use arrow keys to move.`);
          el.style.cursor='grab';el.style.touchAction='none';
          let pointer=null,position=null;
          const setPosition=p=>{el.setAttribute(shape.type==='circle'?'cx':'x',String(p.x));el.setAttribute(shape.type==='circle'?'cy':'y',String(p.y));};
          const point=e=>{const matrix=svg.getScreenCTM();if(!matrix)return null;const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(matrix.inverse());return {x:Math.round(Math.max(0,Math.min(1000,q.x))),y:Math.round(Math.max(0,Math.min(1000,q.y)))};};
          el.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer=e.pointerId;position=point(e);el.setPointerCapture(e.pointerId);e.preventDefault();});
          el.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;position=point(e);if(position)setPosition(position);});
          el.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;position=point(e)||position;pointer=null;if(position)onEvent({type:'drag',id:shape.id,x:position.x,y:position.y});});
          el.addEventListener('pointercancel',()=>{pointer=null;setPosition(shape);});
          el.addEventListener('keydown',e=>{const delta={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[e.key];if(!delta)return;e.preventDefault();onEvent({type:'drag',id:shape.id,x:Math.max(0,Math.min(1000,shape.x+delta[0])),y:Math.max(0,Math.min(1000,shape.y+delta[1]))});});
        }
        svg.append(el);
      }
      fragment.append(svg);
    }
    container.replaceChildren(fragment);
  }
  root.LiveLabView={render};
})(window);
