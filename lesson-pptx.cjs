'use strict';

const PptxGenJS=require('pptxgenjs');

const LEVELS=['Beginner','Intermediate','Advanced'];
const SUBJECTS=['Math','Coding','Math + Coding'];
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function cleanText(value,max,label,{empty=false}={}){
  if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))throw Error(`Invalid lesson ${label}.`);
  return value.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'');
}

function normalizeLessonExport(input){
  if(!record(input))throw Error('Invalid lesson export.');
  let serialized;
  try{serialized=JSON.stringify(input);}catch{throw Error('Invalid lesson export.');}
  if(Buffer.byteLength(serialized,'utf8')>256*1024)throw Error('This lesson is too large to export.');
  const title=cleanText(input.title,160,'title'),summary=cleanText(input.summary,1200,'summary');
  const lesson=input.lesson;
  if(!record(lesson)||!SUBJECTS.includes(lesson.subject)||!LEVELS.includes(lesson.level))throw Error('Invalid lesson details.');
  const topic=cleanText(lesson.topic,100,'topic');
  if(!Number.isInteger(input.minutes)||input.minutes<10||input.minutes>60)throw Error('Invalid lesson length.');
  if(!Number.isFinite(input.createdAt)||input.createdAt<=0)throw Error('Invalid lesson date.');
  if(!Array.isArray(lesson.objectives)||lesson.objectives.length<2||lesson.objectives.length>4)throw Error('Invalid lesson objectives.');
  const objectives=lesson.objectives.map((x,i)=>cleanText(x,300,`objective ${i+1}`));
  if(!Array.isArray(lesson.prerequisites)||lesson.prerequisites.length>4)throw Error('Invalid lesson prerequisites.');
  const prerequisites=lesson.prerequisites.map((x,i)=>cleanText(x,300,`prerequisite ${i+1}`));
  if(!Array.isArray(lesson.modules)||lesson.modules.length<3||lesson.modules.length>5)throw Error('Invalid lesson modules.');
  const modules=lesson.modules.map((module,index)=>{
    if(!record(module)||!Array.isArray(module.exampleSteps)||module.exampleSteps.length<2||module.exampleSteps.length>6)throw Error(`Invalid lesson module ${index+1}.`);
    const field=(name,max=1200)=>cleanText(module[name],max,`module ${index+1} ${name}`);
    if(lesson.subject==='Math + Coding'&&!['Math','Coding','Bridge'].includes(module.focus))throw Error(`Invalid lesson module ${index+1} focus.`);
    return {heading:field('heading'),explanation:field('explanation',3000),keyIdea:field('keyIdea'),examplePrompt:field('examplePrompt'),exampleSteps:module.exampleSteps.map((x,i)=>cleanText(x,1000,`module ${index+1} step ${i+1}`)),exampleAnswer:field('exampleAnswer'),exercisePrompt:field('exercisePrompt'),exerciseAnswer:field('exerciseAnswer'),exerciseExplanation:field('exerciseExplanation',2000),...(module.focus?{focus:module.focus}:{})};
  });
  if(lesson.subject==='Math + Coding'&&!['Math','Coding','Bridge'].every(focus=>modules.some(module=>module.focus===focus)))throw Error('Invalid integrated lesson modules.');
  if(!Array.isArray(lesson.quiz)||lesson.quiz.length!==3)throw Error('Invalid lesson quiz.');
  const quiz=lesson.quiz.map((question,index)=>{
    if(!record(question)||!Array.isArray(question.choices)||question.choices.length!==4||!Number.isInteger(question.correctIndex)||question.correctIndex<0||question.correctIndex>3)throw Error(`Invalid quiz question ${index+1}.`);
    if(lesson.subject==='Math + Coding'&&!['Math','Coding','Bridge'].includes(question.focus))throw Error(`Invalid quiz question ${index+1} focus.`);
    return {prompt:cleanText(question.prompt,1000,`quiz question ${index+1}`),choices:question.choices.map((x,i)=>cleanText(x,300,`quiz choice ${index+1}.${i+1}`)),correctIndex:question.correctIndex,explanation:cleanText(question.explanation,1200,`quiz explanation ${index+1}`),...(question.focus?{focus:question.focus}:{})};
  });
  if(lesson.subject==='Math + Coding'&&!['Math','Coding','Bridge'].every(focus=>quiz.some(question=>question.focus===focus)))throw Error('Invalid integrated lesson quiz.');
  if(!Array.isArray(lesson.followUps)||lesson.followUps.length<1||lesson.followUps.length>3)throw Error('Invalid follow-up lessons.');
  const followUps=lesson.followUps.map((item,index)=>{
    if(!record(item)||!SUBJECTS.includes(item.subject)||!LEVELS.includes(item.level))throw Error(`Invalid follow-up ${index+1}.`);
    return {subject:item.subject,topic:cleanText(item.topic,100,`follow-up ${index+1} topic`),level:item.level,reason:cleanText(item.reason,500,`follow-up ${index+1} reason`)};
  });
  let codingChallenge=null;
  if(lesson.subject==='Coding'||lesson.subject==='Math + Coding'){
    const challenge=lesson.codingChallenge;
    const languages=['Python','Java','C++','JavaScript','Pseudocode'];
    if(!record(challenge)||!languages.includes(challenge.language)||lesson.subject==='Math + Coding'&&challenge.language!=='Python'||!Array.isArray(challenge.publicTests)||challenge.publicTests.length<1||challenge.publicTests.length>4||!Array.isArray(challenge.hints)||challenge.hints.length<2||challenge.hints.length>4)throw Error('Invalid coding challenge.');
    codingChallenge={title:cleanText(challenge.title,160,'challenge title'),prompt:cleanText(challenge.prompt,2000,'challenge prompt'),language:challenge.language,starterCode:cleanText(challenge.starterCode,5000,'starter code'),expectedComplexity:cleanText(challenge.expectedComplexity,300,'expected complexity'),publicTests:challenge.publicTests.map((test,i)=>{
      if(!record(test))throw Error(`Invalid sample test ${i+1}.`);
      return {input:cleanText(test.input,500,`sample input ${i+1}`),expectedOutput:cleanText(test.expectedOutput,500,`sample output ${i+1}`)};
    }),hints:challenge.hints.map((x,i)=>cleanText(x,500,`challenge hint ${i+1}`))};
  }else if(lesson.codingChallenge!==null)throw Error('Invalid Math lesson coding challenge.');
  return {title,summary,minutes:input.minutes,createdAt:input.createdAt,lesson:{subject:lesson.subject,topic,level:lesson.level,objectives,prerequisites,modules,quiz,codingChallenge,followUps}};
}

function chunks(value,max=720){
  const words=String(value).split(/\s+/);const result=[];let current='';
  for(const word of words){
    if(!word)continue;
    if(word.length>max){if(current){result.push(current);current='';}for(let i=0;i<word.length;i+=max)result.push(word.slice(i,i+max));continue;}
    const next=current?`${current} ${word}`:word;
    if(next.length>max){result.push(current);current=word;}else current=next;
  }
  if(current)result.push(current);
  return result.length?result:[''];
}

function createLessonPresentation(input){
  const data=normalizeLessonExport(input),lesson=data.lesson;
  const pptx=new PptxGenJS();
  pptx.layout='LAYOUT_WIDE';pptx.author='FORGE';pptx.subject=`${lesson.subject} lesson: ${lesson.topic}`;pptx.title=data.title;pptx.company='FORGE';pptx.lang='en-US';
  pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'en-US'};
  const C={ink:'142238',muted:'52617A',paper:'F5F7FB',white:'FFFFFF',line:'DCE3EE',purple:'6246C8',purplePale:'EEE9FF',teal:'16796C',tealPale:'E5F5F1',navy:'111A2C',light:'D9E4F4'};
  const W=13.333,H=7.5;
  const shape=(slide,x,y,w,h,fill,line=C.line,radius=true)=>slide.addShape(radius?pptx.ShapeType.roundRect:pptx.ShapeType.rect,{x,y,w,h,rectRadius:0.12,fill:{color:fill},line:{color:line,width:1}});
  const text=(slide,value,x,y,w,h,{size=18,color=C.ink,bold=false,font='Aptos',align='left',valign='middle',margin=0.1,italic=false,breakLine=false}={})=>slide.addText(value,{x,y,w,h,fontFace:font,fontSize:size,color,bold,italic,align,valign,margin,breakLine,fit:'shrink',wrap:true,paraSpaceAfter:4});
  const base=(section,heading,sub='')=>{
    const slide=pptx.addSlide();slide.background={color:C.paper};
    slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:W,h:0.14,fill:{color:C.purple},line:{color:C.purple}});
    text(slide,section.toUpperCase(),0.7,0.4,11.9,0.25,{size:10,color:C.purple,bold:true,margin:0});
    text(slide,heading,0.7,0.73,11.95,0.68,{size:28,bold:true,margin:0});
    if(sub)text(slide,sub,0.72,1.43,11.9,0.38,{size:13,color:C.muted,margin:0});
    slide.addShape(pptx.ShapeType.line,{x:0.7,y:6.95,w:11.95,h:0,line:{color:C.line,width:1}});
    text(slide,`FORGE  •  ${lesson.subject}  •  ${lesson.topic}`,0.7,7.03,11.95,0.2,{size:9,color:C.muted,margin:0});
    return slide;
  };
  const addBulletCard=(slide,value,index,y)=>{
    shape(slide,0.8,y,11.72,0.86,C.white);
    slide.addShape(pptx.ShapeType.ellipse,{x:1.03,y:y+0.22,w:0.38,h:0.38,fill:{color:C.purplePale},line:{color:C.purplePale}});
    text(slide,String(index+1),1.03,y+0.22,0.38,0.38,{size:13,color:C.purple,bold:true,align:'center',margin:0});
    text(slide,value,1.6,y+0.11,10.65,0.64,{size:18,margin:0.03});
  };

  const cover=pptx.addSlide();cover.background={color:C.navy};
  cover.addShape(pptx.ShapeType.rect,{x:0.78,y:0.82,w:0.16,h:5.85,fill:{color:C.purple},line:{color:C.purple}});
  text(cover,'FORGE  •  LEARNING STUDIO',1.28,1.02,10.8,0.35,{size:12,color:'BBAAFF',bold:true,margin:0});
  text(cover,lesson.subject.toUpperCase()+`  /  ${lesson.level.toUpperCase()}`,1.28,1.65,10.8,0.35,{size:12,color:'8CE0C7',bold:true,margin:0});
  text(cover,data.title,1.25,2.15,10.95,0.95,{size:30,color:C.white,bold:true,margin:0.02});
  text(cover,lesson.topic,1.27,3.12,10.9,0.72,{size:26,color:'D8E2F3',bold:true,margin:0.02});
  const summaryParts=chunks(data.summary,420);
  text(cover,summaryParts[0],1.29,4.05,10.35,1.2,{size:16,color:'C0CDE2',valign:'top',margin:0.02});
  text(cover,`${data.minutes} minute lesson  •  ${new Date(data.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}`,1.29,6.25,10.5,0.35,{size:12,color:'A5B4CA',margin:0});
  cover.addNotes('Generated by FORGE. Review the educational content and verify important facts before presenting.');
  summaryParts.slice(1).forEach((part,index)=>{
    const overview=base(`Lesson overview  •  Part ${index+2}`,data.title,'A little more context before the worked examples.');
    shape(overview,0.85,2.0,11.62,3.85,C.white);
    text(overview,part,1.2,2.32,10.95,3.2,{size:20,valign:'top',margin:0.04});
  });

  const objectives=base('Start here','By the end, you can…','Learning objectives and useful background');
  lesson.objectives.forEach((item,index)=>addBulletCard(objectives,item,index,1.92+index*0.94));
  if(lesson.prerequisites.length){
    shape(objectives,0.8,5.87,11.72,0.78,C.tealPale,C.tealPale);
    text(objectives,'USEFUL BACKGROUND',1.02,5.98,2.1,0.2,{size:9,color:C.teal,bold:true,margin:0});
    text(objectives,lesson.prerequisites.join('  •  '),3.0,5.93,9.15,0.58,{size:13,color:C.ink,margin:0.02});
  }

  lesson.modules.forEach((module,index)=>{
    const ideaPages=chunks(module.explanation,820);
    ideaPages.forEach((part,pageIndex)=>{
      const slide=base(`Module ${index+1}${module.focus?`  •  ${module.focus}`:''}  •  Core idea${ideaPages.length>1?`  •  Part ${pageIndex+1}`:''}`,module.heading);
      shape(slide,0.82,1.78,11.68,3.83,C.white);
      text(slide,part,1.16,2.06,11.0,3.26,{size:19,color:C.ink,valign:'top',margin:0.04});
      if(pageIndex===ideaPages.length-1){
        shape(slide,0.82,5.85,11.68,0.76,C.purplePale,C.purplePale);
        text(slide,'KEY IDEA',1.05,5.97,1.25,0.18,{size:9,color:C.purple,bold:true,margin:0});
        text(slide,module.keyIdea,2.35,5.9,9.83,0.52,{size:15,bold:true,margin:0.02});
      }
    });
    const prompt=base(`Module ${index+1}  •  Worked example`,module.heading,'Follow the steps, then compare the result.');
    shape(prompt,0.82,1.96,11.68,0.78,C.purplePale,C.purplePale);
    text(prompt,module.examplePrompt,1.12,2.05,11.05,0.58,{size:18,bold:true,margin:0.02});
    const stepParts=[];
    module.exampleSteps.forEach((step,stepIndex)=>chunks(step,500).forEach((part,partIndex)=>stepParts.push({step,stepIndex,part,partIndex,total:chunks(step,500).length})));
    const groups=[];for(let i=0;i<stepParts.length;i+=3)groups.push(stepParts.slice(i,i+3));
    groups.forEach((group,groupIndex)=>{
      const slide=groupIndex===0?prompt:base(`Module ${index+1}  •  Worked example  •  Continued`,module.examplePrompt);
      const startY=groupIndex===0?3.0:1.8;
      group.forEach((item,localIndex)=>{
        const y=startY+localIndex*0.92;shape(slide,0.9,y,11.48,0.78,C.white);
        text(slide,`${item.stepIndex+1}${item.total>1?String.fromCharCode(97+item.partIndex):''}`,1.07,y+0.17,0.42,0.36,{size:14,color:C.purple,bold:true,align:'center',margin:0});
        text(slide,item.part,1.62,y+0.08,10.5,0.62,{size:15,margin:0.02});
      });
      if(groupIndex===groups.length-1){
        shape(slide,0.9,6.03,11.48,0.56,C.tealPale,C.tealPale);
        text(slide,`ANSWER  •  ${module.exampleAnswer}`,1.12,6.13,11.02,0.34,{size:14,color:C.teal,bold:true,margin:0.02});
      }
    });
    const practice=base(`Module ${index+1}  •  Your turn`,module.exercisePrompt,'Pause here and work it out before opening the presenter notes.');
    shape(practice,0.9,2.05,11.5,2.15,C.white);
    text(practice,module.exercisePrompt,1.2,2.3,10.9,1.65,{size:21,bold:true,valign:'top',margin:0.04});
    slideLines(practice,0.95,4.62,11.4,2);
    practice.addNotes(`Suggested answer: ${module.exerciseAnswer}\n\nOne correct approach: ${module.exerciseExplanation}`);
  });

  if(lesson.codingChallenge){
    const challenge=lesson.codingChallenge;
    const intro=base('Coding challenge',challenge.title,`${challenge.language}  •  target complexity: ${challenge.expectedComplexity}`);
    shape(intro,0.85,2.0,11.62,2.25,C.white);
    text(intro,challenge.prompt,1.16,2.25,11.0,1.7,{size:19,valign:'top',margin:0.04});
    intro.addNotes(`Hints:\n${challenge.hints.map((hint,i)=>`${i+1}. ${hint}`).join('\n')}`);
    const lines=challenge.starterCode.split(/\r?\n/),linePages=[];
    for(let i=0;i<lines.length;i+=18)linePages.push(lines.slice(i,i+18).join('\n'));
    linePages.forEach((code,index)=>{
      const slide=base(`Starter code${linePages.length>1?`  •  Part ${index+1}`:''}`,challenge.title,`${challenge.language}  •  edit a copy to try your solution`);
      shape(slide,0.85,1.95,11.62,4.55,'172237','172237');
      text(slide,code,1.13,2.2,11.08,4.05,{size:12,color:'E4F1EA',font:'Cascadia Code',valign:'top',margin:0.06});
      slide.addNotes(`This deck shows starter code only. FORGE does not include your saved draft in the export.\n\nHints:\n${challenge.hints.map((hint,i)=>`${i+1}. ${hint}`).join('\n')}`);
    });
    const tests=base('Coding challenge  •  Sample tests','Check the input and expected output');
    challenge.publicTests.forEach((test,index)=>{
      const y=1.93+index*1.08;shape(tests,0.9,y,11.45,0.9,C.white);
      text(tests,`TEST ${index+1}`,1.1,y+0.12,1.05,0.2,{size:9,color:C.purple,bold:true,margin:0});
      text(tests,`Input\n${test.input}`,2.2,y+0.08,4.5,0.68,{size:12,font:'Cascadia Code',margin:0.02});
      text(tests,`Expected output\n${test.expectedOutput}`,7.0,y+0.08,4.9,0.68,{size:12,font:'Cascadia Code',margin:0.02});
    });
  }

  lesson.quiz.forEach((question,index)=>{
    const slide=base(`Knowledge check  •  Question ${index+1} of ${lesson.quiz.length}`,'Choose one answer');
    shape(slide,0.86,1.85,11.6,1.25,C.white);
    text(slide,question.prompt,1.15,2.04,11.0,0.88,{size:19,bold:true,margin:0.03});
    question.choices.forEach((choice,choiceIndex)=>{
      const col=choiceIndex%2,row=Math.floor(choiceIndex/2),x=0.9+col*5.86,y=3.42+row*1.16;
      shape(slide,x,y,5.58,0.92,C.white);
      text(slide,`${'ABCD'[choiceIndex]}.`,x+0.19,y+0.19,0.48,0.45,{size:15,color:C.purple,bold:true,margin:0});
      text(slide,choice,x+0.78,y+0.1,4.57,0.68,{size:15,margin:0.02});
    });
    slide.addNotes(`Correct answer: ${'ABCD'[question.correctIndex]}. ${question.choices[question.correctIndex]}\n\nExplanation: ${question.explanation}`);
  });
  lesson.quiz.forEach((question,index)=>{
    const slide=base('Knowledge check  •  Presenter answer key',`Question ${index+1}  •  ${'ABCD'[question.correctIndex]}`);
    shape(slide,0.88,1.95,11.58,1.35,C.tealPale,C.tealPale);
    text(slide,question.choices[question.correctIndex],1.18,2.22,10.95,0.8,{size:22,color:C.teal,bold:true,margin:0.02});
    text(slide,question.prompt,0.96,3.58,11.45,0.95,{size:16,bold:true,valign:'top',margin:0.02});
    shape(slide,0.9,4.72,11.52,1.38,C.white);
    text(slide,question.explanation,1.18,4.98,10.95,0.88,{size:16,valign:'top',margin:0.02});
  });

  const next=base('Keep learning','Recommended next steps','Continue from this lesson with a focused follow-up.');
  lesson.followUps.forEach((item,index)=>{
    const y=1.95+index*1.42;shape(next,0.9,y,11.52,1.18,index%2?C.white:C.purplePale,index%2?C.line:C.purplePale);
    text(next,`${item.subject}  •  ${item.level}`,1.15,y+0.14,10.95,0.22,{size:10,color:C.purple,bold:true,margin:0});
    text(next,item.topic,1.15,y+0.42,10.95,0.34,{size:18,bold:true,margin:0});
    text(next,item.reason,1.15,y+0.8,10.95,0.25,{size:11,color:C.muted,margin:0});
  });
  next.addNotes('Use the FORGE Learn page to build another adaptive lesson. The AI considers these ideas alongside saved progress.');
  return pptx;

  function slideLines(slide,x,y,w,count){
    for(let i=0;i<count;i++)slide.addShape(pptx.ShapeType.line,{x,y:y+i*0.55,w,h:0,line:{color:C.line,width:1}});
  }
}

function lessonFilename(topic,date=new Date()){
  const slug=String(topic||'lesson').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'lesson';
  return `FORGE-${slug}-${date.toLocaleDateString('en-CA')}.pptx`;
}

module.exports={normalizeLessonExport,createLessonPresentation,lessonFilename};
