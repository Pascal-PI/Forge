(function(root){
  'use strict';
  const txt=(x,n)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
  function question(q){
    if(!q||!txt(q.id,80)||!/^[-a-zA-Z0-9_]+$/.test(q.id)||!['single','multiple','number'].includes(q.type)||!txt(q.topic,120)||!['introductory','standard','advanced'].includes(q.difficulty)||!txt(q.prompt,1000)||!txt(q.explanation,1200))throw Error('Invalid quiz question');
    let numericAnswer=q.answer,numericTolerance=q.tolerance;
    if(q.type==='number'){
      const decimal=/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;
      if(typeof numericAnswer==='string'&&decimal.test(numericAnswer.trim()))numericAnswer=Number(numericAnswer);
      if(typeof numericTolerance==='string'&&decimal.test(numericTolerance.trim()))numericTolerance=Number(numericTolerance);
      if(!Number.isFinite(numericAnswer)||Math.abs(numericAnswer)>1e12||!Number.isFinite(numericTolerance)||numericTolerance<0||numericTolerance>Math.max(1,Math.abs(numericAnswer))*0.01||!Array.isArray(q.choices)||q.choices.length)throw Error('Invalid numerical answer or tolerance');
    }else{
      if(!Array.isArray(q.choices)||q.choices.length<3||q.choices.length>5||!q.choices.every(x=>txt(x,350))||new Set(q.choices.map(x=>x.trim().toLowerCase())).size!==q.choices.length||!Array.isArray(q.answer)||!q.answer.length||!q.answer.every(x=>Number.isInteger(x)&&x>=0&&x<q.choices.length)||new Set(q.answer).size!==q.answer.length||(q.type==='single'&&q.answer.length!==1)||(q.type==='multiple'&&(q.answer.length<2||q.answer.length>=q.choices.length)))throw Error('Invalid choice answer key');
      if(q.tolerance!==0)throw Error('Invalid choice grading rule');
    }
    return {id:q.id,type:q.type,topic:q.topic.trim(),difficulty:q.difficulty,prompt:q.prompt,choices:[...q.choices],answer:Array.isArray(q.answer)?[...q.answer]:numericAnswer,tolerance:q.type==='number'?numericTolerance:q.tolerance,explanation:q.explanation,...(q.followupFor?{followupFor:q.followupFor}: {})};
  }
  function grade(q,response){
    q=question(q);
    if(q.type==='number'){if(typeof response!=='string'||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(response.trim())||!Number.isFinite(Number(response)))throw Error('Enter a finite number.');return Math.abs(Number(response)-q.answer)<=q.tolerance;}
    if(!Array.isArray(response)||!response.length||!response.every(x=>Number.isInteger(x)&&x>=0&&x<q.choices.length)||new Set(response).size!==response.length||(q.type==='single'&&response.length!==1))throw Error('Select an answer.');
    return response.length===q.answer.length&&response.every(x=>q.answer.includes(x));
  }
  function normalizeQuiz(quiz){
    if(!quiz||!Array.isArray(quiz.questions)||quiz.questions.length<3||quiz.questions.length>5||!Array.isArray(quiz.attempts)||quiz.attempts.length>500||!Number.isInteger(quiz.index)||quiz.index<0||quiz.index>=quiz.questions.length)throw Error('Invalid quiz');
    const questions=quiz.questions.map(question),ids=new Set(questions.map(q=>q.id));if(ids.size!==questions.length)throw Error('Duplicate quiz question');
    for(const q of questions)if(q.followupFor!=null&&(!txt(q.followupFor,80)||!ids.has(q.followupFor)||q.followupFor===q.id))throw Error('Invalid follow-up link');
    const attempts=quiz.attempts.map(a=>{const q=questions.find(q=>q.id===a?.questionId);if(!q||!Number.isFinite(a.at)||a.at<0||a.at>8640000000000000||typeof a.correct!=='boolean'||a.correct!==grade(q,a.response))throw Error('Invalid quiz attempt');return {questionId:q.id,response:Array.isArray(a.response)?[...a.response]:a.response,correct:a.correct,at:a.at,topic:q.topic,difficulty:q.difficulty};});
    return {questions,attempts,index:quiz.index};
  }
  function summarize(workspace,now=Date.now()){
    const items=(workspace?.sessions||[]).flatMap(s=>(s.messages||[]).flatMap((m,messageIndex)=>(m.plan||[]).flatMap((step,stepIndex)=>step.lesson?.quizV2?[{quiz:step.lesson.quizV2,lesson:step.lesson,sessionId:s.id,messageIndex,stepIndex,lessonTitle:step.lesson.title}]:[])));
    const topics=new Map(),all=[];
    for(const [itemIndex,item] of items.entries())for(const a of item.quiz.attempts){const q=item.quiz.questions.find(q=>q.id===a.questionId);if(!q)continue;const key=q.topic.trim().toLocaleLowerCase();if(!topics.has(key))topics.set(key,{topic:q.topic,attempts:[],questions:new Map(),sessionId:item.sessionId,messageIndex:item.messageIndex,stepIndex:item.stepIndex,lessonTitle:item.lessonTitle});const t=topics.get(key);t.attempts.push(a);const id=itemIndex+':'+q.id;if(!t.questions.has(id))t.questions.set(id,[]);t.questions.get(id).push(a);all.push(a);}
    const firstAttempts=[...topics.values()].flatMap(t=>[...t.questions.values()].map(a=>a.slice().sort((x,y)=>x.at-y.at)[0])).sort((a,b)=>a.at-b.at);
    let trend=null;if(firstAttempts.length>=4){const size=Math.min(5,Math.floor(firstAttempts.length/2)),previous=firstAttempts.slice(-2*size,-size),recent=firstAttempts.slice(-size);trend={size,change:Math.round(100*recent.filter(x=>x.correct).length/size)-Math.round(100*previous.filter(x=>x.correct).length/size)};}
    const entries=[...topics.values()].map(t=>{t.attempts.sort((a,b)=>a.at-b.at);const first=[...t.questions.values()].map(a=>a.slice().sort((x,y)=>x.at-y.at)[0]);const correct=first.filter(a=>a.correct).length,total=first.length,last=t.attempts.at(-1);const days=Math.max(0,(now-last.at)/86400000);const status=total>=3&&correct/total>=0.8?'Demonstrated':total>=2&&correct/total>=0.5?'Developing':'Needs practice';const reviewDays=status==='Demonstrated'?7:status==='Developing'?3:1;return {topic:t.topic,total,correct,accuracy:Math.round(100*correct/total),status,lastAt:last.at,dueAt:last.at+reviewDays*86400000,due:days>=reviewDays,sessionId:t.sessionId,messageIndex:t.messageIndex,stepIndex:t.stepIndex,lessonTitle:t.lessonTitle};}).sort((a,b)=>a.accuracy-b.accuracy||a.lastAt-b.lastAt);
    all.sort((a,b)=>a.at-b.at);const daily=new Map();for(const a of all){const date=new Date(a.at),d=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;const item=daily.get(d)||{day:d,total:0,correct:0};item.total++;if(a.correct)item.correct++;daily.set(d,item);}return {topics:entries,days:[...daily.values()].slice(-7),attempts:all.length,trend};
  }
  root.MasteryCore={question,grade,normalizeQuiz,summarize};if(typeof module!=='undefined')module.exports=root.MasteryCore;
})(typeof window!=='undefined'?window:globalThis);
