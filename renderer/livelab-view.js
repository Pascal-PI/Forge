(function(root){
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  function render(container,scene,onEvent,options={}){
    if(!(container instanceof Element) || typeof onEvent!=='function')throw Error('Invalid LiveLab view');
    // Reuse the same schema as the host. Text is always inserted as text nodes.
    root.LiveLabScene.validate({state:{},scene});
    const fragment=document.createDocumentFragment();
    const labels=[];
    const title=document.createElement('h2');title.textContent=scene.title;fragment.append(title);
    // Put the visual first while keeping source-order among visuals and controls.
    const blocks=[...scene.blocks.filter(block=>block.type==='diagram'),...scene.blocks.filter(block=>block.type!=='diagram')];
    for(const block of blocks){
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
      if(block.type==='input'){
        const label=document.createElement('label'),name=document.createElement('span'),input=document.createElement('textarea'),submit=document.createElement('button');
        name.textContent=block.label;input.maxLength=block.maxLength;input.value=options.drafts?.get(block.id) ?? block.value;input.rows=4;input.spellcheck=false;input.setAttribute('data-livelab-input',block.id);
        input.addEventListener('input',()=>options.drafts?.set(block.id,input.value));
        submit.type='button';submit.textContent='Submit response';submit.addEventListener('click',()=>onEvent({type:'submit',id:block.id,value:input.value}));
        label.append(name,input);fragment.append(label,submit);continue;
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
      const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1000 1000');svg.setAttribute('role',block.shapes.some(shape=>shape.draggable)?'group':'img');svg.setAttribute('aria-label',block.label);svg.setAttribute('data-livelab-diagram-index',String(scene.blocks.indexOf(block)));
      for(const [shapeIndex,shape] of block.shapes.entries()){
        const tag=shape.type==='label'?'text':shape.type,el=document.createElementNS(ns,tag);
        el.setAttribute('data-livelab-shape-index',String(shapeIndex));
        const fields=shape.type==='circle'?['x','y','r']:shape.type==='rect'?['x','y','width','height']:shape.type==='line'?['x1','y1','x2','y2','width']:shape.type==='label'?['x','y','size']:[];
        for(const field of fields){const attr=shape.type==='circle'&&field==='x'?'cx':shape.type==='circle'&&field==='y'?'cy':shape.type==='line'&&field==='width'?'stroke-width':field==='size'?'font-size':field;el.setAttribute(attr,String(shape[field]));}
        if(shape.type==='polyline'||shape.type==='polygon')el.setAttribute('points',shape.points.map(point=>point.join(',')).join(' '));
        if(shape.type==='line'||shape.type==='polyline'){el.setAttribute('stroke',shape.color);if(shape.type==='polyline'){el.setAttribute('stroke-width',String(shape.width));el.setAttribute('fill','none');el.setAttribute('stroke-linejoin','round');el.setAttribute('stroke-linecap','round');}}else el.setAttribute('fill',shape.color);
        if(shape.type==='label'){
          const insideCircle=shape.text.length<=12 && block.shapes.some(other=>other.type==='circle' && Math.abs(other.x-shape.x)<1 && Math.abs(other.y-shape.y)<other.r*0.5);
          const anchor=shape.anchor || (insideCircle?'middle':'start');
          el.textContent=shape.text;el.setAttribute('text-anchor',anchor);labels.push({element:el,x:shape.x,y:shape.y,anchor});
        }
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
    // Generated labels use start anchoring. Keep the complete label inside the
    // 1000-unit canvas even when its author placed a long caption near an edge.
    for(const {element,x,y,anchor} of labels){
      const measured=element.getComputedTextLength();
      if(!Number.isFinite(measured)||measured<=0)continue;
      const width=Math.min(measured,960);
      if(measured>960){element.setAttribute('textLength','960');element.setAttribute('lengthAdjust','spacingAndGlyphs');}
      const offset=anchor==='middle'?width/2:anchor==='end'?width:0;
      const left=Math.max(20,Math.min(x-offset,980-width));
      element.setAttribute('x',String(left+offset));
      const bounds=element.getBBox();
      if(bounds.y<10)element.setAttribute('y',String(y+10-bounds.y));
      else if(bounds.y+bounds.height>990)element.setAttribute('y',String(y+990-bounds.y-bounds.height));
    }
  }
  function animateTransition(container,before,after,duration){
    if(!(container instanceof Element)||!Number.isFinite(duration)||duration<1||duration>2000)return;
    for(const svg of container.querySelectorAll('[data-livelab-diagram-index]')){
      const i=Number(svg.getAttribute('data-livelab-diagram-index'));
      const oldBlock=before?.blocks?.[i],newBlock=after?.blocks?.[i];
      if(oldBlock?.type!=='diagram'||newBlock?.type!=='diagram'||oldBlock.label!==newBlock.label)continue;
      for(const el of svg.querySelectorAll('[data-livelab-shape-index]')){
        const index=Number(el.getAttribute('data-livelab-shape-index')),old=oldBlock.shapes[index],next=newBlock.shapes[index];
        if(!old||!next||old.type!==next.type||!['circle','rect','label'].includes(next.type)||old.id!==next.id||old.color!==next.color)continue;
        if(next.type==='circle' && old.r!==next.r || next.type==='rect' && (old.width!==next.width||old.height!==next.height))continue;
        if(next.type==='label' && (old.text!==next.text || old.size!==next.size || old.anchor!==next.anchor || next.text.length>12 || old.x<100 || old.x>900 || next.x<100 || next.x>900))continue;
        const dx=old.x-next.x,dy=old.y-next.y;
        if(!Number.isFinite(dx)||!Number.isFinite(dy)||(!dx&&!dy)||Math.abs(dx)>1000||Math.abs(dy)>1000)continue;
        const animation=document.createElementNS(ns,'animateTransform');
        animation.setAttribute('attributeName','transform');animation.setAttribute('type','translate');animation.setAttribute('from',`${dx} ${dy}`);animation.setAttribute('to','0 0');animation.setAttribute('dur',`${duration}ms`);animation.setAttribute('fill','remove');animation.setAttribute('begin','indefinite');
        el.append(animation);animation.beginElement();
      }
    }
  }
  root.LiveLabView={render,animateTransition};
})(window);
