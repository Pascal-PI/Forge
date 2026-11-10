(function(root){
  'use strict';
  const TARGETS=['USACO','LeetCode','Codeforces','YoungWonks','Hackathons','AtCoder','Other'];
  const LEVELS=['New to competitions','Beginner','Intermediate','Advanced'];
  const DIFFICULTIES=['Beginner','Intermediate','Advanced','Varies'];
  const LANGUAGES=['Python','C++','Java','JavaScript','Pseudocode'];
  const SUBJECTS=['Coding','Math'];
  const MINUTES=[15,25,40];
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
  function readiness(level,difficulty,evidence={}){
    const practiced=Math.max(0,Math.min(500,Number.isInteger(evidence.practiceMarks)?evidence.practiceMarks:0));
    const quizzes=Math.max(0,Math.min(100,Number.isInteger(evidence.codingLessonQuizzes)?evidence.codingLessonQuizzes:0));
    const selected=LEVELS.includes(level)?level:'New to competitions';
    const target=DIFFICULTIES.includes(difficulty)?difficulty:'Varies';
    const evidenceNote=`Based on your ${selected.toLowerCase()} self-rating, ${practiced} self-marked coding practice ${practiced===1?'item':'items'}, and ${quizzes} checked coding lesson ${quizzes===1?'quiz':'quizzes'}. This is a planning signal, not a placement or qualification.`;
    if(target==='Varies')return {label:'Review event format',detail:`The organizer has no single difficulty level listed. Check prerequisites, eligibility, and format. ${evidenceNote}`};
    const rank={Beginner:0,Intermediate:1,Advanced:2};
    if(selected==='New to competitions'&&target==='Beginner')return {label:'Good first step',detail:`This event is listed as beginner level. Try a practice set first to learn its format. ${evidenceNote}`};
    const learner=selected==='New to competitions'?0:rank[selected];
    const gap=rank[target]-learner;
    if(gap<=-1)return {label:'Skill warm-up',detail:`This event is below your self-rated level and may work as a timed warm-up. ${evidenceNote}`};
    if(gap===0)return {label:'Within your self-rated range',detail:`This event is at your selected level. The comparison is based on your self-rating, not a contest result. ${evidenceNote}`};
    if(gap===1)return {label:'Stretch goal',detail:`This event is one level above your self-rating. The suggested prep lessons can help you decide what to review first. ${evidenceNote}`};
    return {label:'Build foundations first',detail:`This event is more than one level above your self-rating. Start with a lower-level event or the suggested basics. ${evidenceNote}`};
  }
  function normalizePreparation(value){
    if(!Array.isArray(value)||value.length!==3)throw Error('The competition prep response must contain exactly three choices.');
    const choices=value.map((item,index)=>{
      if(!record(item)||!text(item.title,160)||!text(item.topic,100)||!SUBJECTS.includes(item.subject)||!LEVELS.slice(1).includes(item.level)||!MINUTES.includes(item.minutes)||!LANGUAGES.includes(item.language)||!text(item.goal,500)||!text(item.reason,700)||!Number.isInteger(item.relevance)||item.relevance<1||item.relevance>5)throw Error(`Competition prep choice ${index+1} did not pass its content checks.`);
      return {title:item.title.trim(),topic:item.topic.trim(),subject:item.subject,level:item.level,minutes:item.minutes,language:item.language,goal:item.goal.trim(),reason:item.reason.trim(),relevance:item.relevance};
    });
    const topics=choices.map(item=>item.topic.toLowerCase());
    if(new Set(topics).size!==topics.length)throw Error('The competition prep response repeated a lesson topic.');
    return choices.map((item,index)=>({...item,_order:index})).sort((a,b)=>b.relevance-a.relevance||a._order-b._order).map(({_order,...item})=>item);
  }
  function normalizeProfile(value={}){
    const target=TARGETS.includes(value.competitionTarget)?value.competitionTarget:'';
    const level=LEVELS.includes(value.competitionLevel)?value.competitionLevel:'New to competitions';
    const language=LANGUAGES.includes(value.competitionLanguage)?value.competitionLanguage:'Python';
    const custom=typeof value.competitionCustomTarget==='string'?value.competitionCustomTarget.trim().slice(0,80):'';
    return {competitionTarget:target,competitionLevel:level,competitionLanguage:language,competitionCustomTarget:custom};
  }
  const api={TARGETS,LEVELS,DIFFICULTIES,LANGUAGES,SUBJECTS,MINUTES,readiness,normalizePreparation,normalizeProfile};
  root.CompetitionCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
