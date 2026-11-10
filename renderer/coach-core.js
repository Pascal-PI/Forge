(function(root){
  'use strict';
  const CompetitionCore=root.CompetitionCore||(typeof require==='function'?require('./competition-core.js'):null);
  const profile=()=>({grade:'',age:'',location:'',interest:'Both',minutes:45,goal:'',competitionTarget:'',competitionLevel:'New to competitions',competitionLanguage:'Python',competitionCustomTarget:''});
  const empty=()=>({profile:profile(),history:[]});
  const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00'));
  const text=(x,max=5000)=>typeof x==='string'&&x.length<=max;
  const nonempty=(x,max)=>text(x,max)&&x.trim().length>0;
  const LEVELS=['Beginner','Intermediate','Advanced'];
  const SUBJECTS=['Math','Coding','Math + Coding'];

  function normalizeLesson(value){
    if(value===undefined||value===null)return null;
    if(!isObject(value)||!SUBJECTS.includes(value.subject)||!nonempty(value.topic,100)||!LEVELS.includes(value.level))throw Error('Invalid saved lesson');
    if(!Array.isArray(value.objectives)||value.objectives.length<2||value.objectives.length>4||!value.objectives.every(x=>nonempty(x,300)))throw Error('Invalid saved lesson objectives');
    if(!Array.isArray(value.prerequisites)||value.prerequisites.length>4||!value.prerequisites.every(x=>nonempty(x,300)))throw Error('Invalid saved lesson prerequisites');
    if(!Array.isArray(value.modules)||value.modules.length<3||value.modules.length>5)throw Error('Invalid saved lesson modules');
    const modules=value.modules.map(m=>{
      const fields=['heading','explanation','keyIdea','examplePrompt','exampleAnswer','exercisePrompt','exerciseAnswer','exerciseExplanation'];
      if(!isObject(m)||!fields.every(k=>nonempty(m[k],k==='explanation'?3000:k==='exerciseExplanation'?2000:1200))||!Array.isArray(m.exampleSteps)||m.exampleSteps.length<2||m.exampleSteps.length>6||!m.exampleSteps.every(x=>nonempty(x,1000)))throw Error('Invalid saved lesson module');
      if(value.subject==='Math + Coding'&&!['Math','Coding','Bridge'].includes(m.focus))throw Error('Invalid integrated lesson module focus');
      return {heading:m.heading,explanation:m.explanation,keyIdea:m.keyIdea,examplePrompt:m.examplePrompt,exampleSteps:m.exampleSteps,exampleAnswer:m.exampleAnswer,exercisePrompt:m.exercisePrompt,exerciseAnswer:m.exerciseAnswer,exerciseExplanation:m.exerciseExplanation,...(m.focus?{focus:m.focus}:{})};
    });
    if(value.subject==='Math + Coding'&&!['Math','Coding','Bridge'].every(focus=>modules.some(module=>module.focus===focus)))throw Error('Invalid integrated lesson module coverage');
    if(!Array.isArray(value.quiz)||value.quiz.length!==3||!value.quiz.every(q=>isObject(q)&&nonempty(q.prompt,1000)&&Array.isArray(q.choices)&&q.choices.length===4&&q.choices.every(x=>nonempty(x,300))&&Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<4&&nonempty(q.explanation,1200)))throw Error('Invalid saved lesson quiz');
    if(value.subject==='Math + Coding'&&!['Math','Coding','Bridge'].every(focus=>value.quiz.some(question=>question.focus===focus)))throw Error('Invalid integrated lesson quiz coverage');
    let challenge=null;
    if(value.subject==='Coding'||value.subject==='Math + Coding'){
      const c=value.codingChallenge;
      if(!isObject(c)||!nonempty(c.title,160)||!nonempty(c.prompt,2000)||!['Python','Java','C++','JavaScript','Pseudocode'].includes(c.language)||value.subject==='Math + Coding'&&c.language!=='Python'||!nonempty(c.starterCode,5000)||!nonempty(c.expectedComplexity,300)||!Array.isArray(c.publicTests)||c.publicTests.length<1||c.publicTests.length>4||!c.publicTests.every(t=>isObject(t)&&nonempty(t.input,500)&&nonempty(t.expectedOutput,500))||!Array.isArray(c.hints)||c.hints.length<2||c.hints.length>4||!c.hints.every(x=>nonempty(x,500)))throw Error('Invalid saved coding challenge');
      challenge={title:c.title,prompt:c.prompt,language:c.language,starterCode:c.starterCode,expectedComplexity:c.expectedComplexity,publicTests:c.publicTests,hints:c.hints};
    }else if(value.codingChallenge!==null)throw Error('Invalid saved math lesson');
    if(!Array.isArray(value.followUps)||value.followUps.length<1||value.followUps.length>3||!value.followUps.every(x=>isObject(x)&&SUBJECTS.includes(x.subject)&&nonempty(x.topic,100)&&LEVELS.includes(x.level)&&nonempty(x.reason,500)))throw Error('Invalid saved lesson follow-ups');
    return {subject:value.subject,topic:value.topic,level:value.level,objectives:value.objectives,prerequisites:value.prerequisites,modules,quiz:value.quiz,codingChallenge:challenge,followUps:value.followUps};
  }

  function blankProgress(lesson){
    return {quizAnswers:Array(lesson.quiz.length).fill(null),quizChecked:false,exerciseAnswers:Array(lesson.modules.length).fill(''),exerciseRevealed:Array(lesson.modules.length).fill(false),codingDraft:lesson.codingChallenge?.starterCode||'',attempts:[],reviewStage:0,nextReview:null,completedAt:null};
  }

  function normalizeProgress(value,lesson){
    if(value===undefined)return blankProgress(lesson);
    if(!isObject(value)||!Array.isArray(value.quizAnswers)||value.quizAnswers.length!==lesson.quiz.length||!value.quizAnswers.every(x=>x===null||Number.isInteger(x)&&x>=0&&x<4)||typeof value.quizChecked!=='boolean'||!Array.isArray(value.exerciseAnswers)||value.exerciseAnswers.length!==lesson.modules.length||!value.exerciseAnswers.every(x=>text(x,2000))||!Array.isArray(value.exerciseRevealed)||value.exerciseRevealed.length!==lesson.modules.length||!value.exerciseRevealed.every(x=>typeof x==='boolean')||!text(value.codingDraft,10000)||!Array.isArray(value.attempts)||value.attempts.length>12||!value.attempts.every(x=>isObject(x)&&Number.isFinite(x.at)&&x.at>0&&Number.isInteger(x.correct)&&x.correct>=0&&x.correct<=3)||!Number.isInteger(value.reviewStage)||value.reviewStage<0||value.reviewStage>3||(value.nextReview!==null&&!validDate(value.nextReview))||(value.completedAt!==null&&(!Number.isFinite(value.completedAt)||value.completedAt<=0)))throw Error('Invalid saved lesson progress');
    if(value.quizChecked&&(!value.quizAnswers.every(x=>x!==null)||!value.attempts.length||value.completedAt===null))throw Error('Invalid saved quiz completion');
    return {quizAnswers:value.quizAnswers,quizChecked:value.quizChecked,exerciseAnswers:value.exerciseAnswers,exerciseRevealed:value.exerciseRevealed,codingDraft:value.codingDraft,attempts:value.attempts,reviewStage:value.reviewStage,nextReview:value.nextReview,completedAt:value.completedAt};
  }

  function normalize(value){
    if(value===undefined)return empty();
    if(!isObject(value)||!isObject(value.profile)||!Array.isArray(value.history)||value.history.length>30)throw Error('Invalid AI Coach backup');
    const p=value.profile;
    if(p.age!==''&&(!/^\d{1,3}$/.test(p.age)||Number(p.age)<5||Number(p.age)>100))throw Error('Invalid coach age');
    if(!['','6','7','8','9','10','11','12','College'].includes(p.grade)||!text(p.age,3)||!text(p.location,120)||!['Both','Math','Coding'].includes(p.interest)||!Number.isInteger(p.minutes)||p.minutes<10||p.minutes>240||!text(p.goal,1000))throw Error('Invalid coach profile');
    const competitionProfile=CompetitionCore.normalizeProfile(p);
    const history=value.history.map(entry=>{
      if(!isObject(entry)||!text(entry.id,100)||!['practice','week','competitions','feedback','hint','lesson'].includes(entry.kind)||!Number.isFinite(entry.createdAt)||!isObject(entry.result))throw Error('Invalid coach history');
      const r=entry.result,lesson=normalizeLesson(r.lesson);
      if(entry.kind==='lesson'&&!lesson)throw Error('Missing saved lesson content');
      if(!text(r.title)||!text(r.summary)||!Array.isArray(r.sections)||r.sections.length>12||!r.sections.every(x=>isObject(x)&&text(x.heading)&&Array.isArray(x.bullets)&&x.bullets.length<=12&&x.bullets.every(y=>text(y))))throw Error('Invalid coach response');
      if(!Array.isArray(r.recommendations)||r.recommendations.length>12||!r.recommendations.every(x=>isObject(x)&&text(x.title)&&text(x.reason)&&['Math','Coding','Competition'].includes(x.subject)&&Number.isInteger(x.minutes)&&x.minutes>=5&&x.minutes<=300&&Number.isInteger(x.dayOffset)&&x.dayOffset>=0&&x.dayOffset<=6&&(x.examId===null||text(x.examId,40))&&(x.question===null||Number.isInteger(x.question)&&x.question>=1&&x.question<=25)))throw Error('Invalid coach practice recommendations');
      if(!Array.isArray(r.competitions)||r.competitions.length>8||!r.competitions.every(x=>isObject(x)&&['name','fit','eligibility','dateNote','officialUrl'].every(k=>text(x[k]))&&(x.eventDate===null||text(x.eventDate,20))&&(x.deadline===null||text(x.deadline,20))&&Array.isArray(x.sourceUrls)&&x.sourceUrls.length<=10&&x.sourceUrls.every(y=>text(y,2000))))throw Error('Invalid coach competitions');
      const competitions=r.competitions.map(x=>{
        if(x.relevance!==undefined&&(!Number.isInteger(x.relevance)||x.relevance<0||x.relevance>5))throw Error('Invalid competition relevance');
        if(x.difficulty!==undefined&&!CompetitionCore.DIFFICULTIES.includes(x.difficulty))throw Error('Invalid competition difficulty');
        const readiness=isObject(x.readiness)&&text(x.readiness.label,100)&&text(x.readiness.detail,1500)?{label:x.readiness.label,detail:x.readiness.detail}:{label:'Not assessed',detail:'This saved recommendation predates competition readiness indicators.'};
        return {...x,relevance:Number.isInteger(x.relevance)?x.relevance:0,difficulty:CompetitionCore.DIFFICULTIES.includes(x.difficulty)?x.difficulty:'Varies',readiness};
      });
      if(r.competitionTarget!==undefined&&!CompetitionCore.TARGETS.includes(r.competitionTarget))throw Error('Invalid saved competition target');
      if(r.competitionCustomTarget!==undefined&&!text(r.competitionCustomTarget,80)&&r.competitionCustomTarget!=='')throw Error('Invalid saved custom competition target');
      if(r.competitionLevel!==undefined&&!CompetitionCore.LEVELS.includes(r.competitionLevel))throw Error('Invalid saved competition level');
      if(r.competitionLanguage!==undefined&&!CompetitionCore.LANGUAGES.includes(r.competitionLanguage))throw Error('Invalid saved competition language');
      let preparation=[];
      if(r.competitionTarget)preparation=CompetitionCore.normalizePreparation(r.preparation);
      else if(r.preparation!==undefined&&(!Array.isArray(r.preparation)||r.preparation.length!==0))throw Error('Saved prep choices require a competition target');
      if(!Array.isArray(r.sources)||r.sources.length>30||!r.sources.every(x=>isObject(x)&&text(x.title)&&text(x.url,2000)))throw Error('Invalid coach sources');
      let lessonInput=null,lessonProgress=null;
      if(entry.kind==='lesson'){
        const input=entry.lessonInput;
        if(!isObject(input)||input.subject!==lesson.subject||input.topic!==lesson.topic||input.level!==lesson.level||!Number.isInteger(input.minutes)||input.minutes<10||input.minutes>60||!text(input.goal,500)||!['Python','Java','C++','JavaScript','Pseudocode'].includes(input.language))throw Error('Invalid saved lesson request');
        lessonInput={subject:input.subject,topic:input.topic,level:input.level,minutes:input.minutes,goal:input.goal,language:input.language,...(input.mode==='adaptive'?{mode:'adaptive'}:{})};
        lessonProgress=normalizeProgress(entry.lessonProgress,lesson);
      }
      return {...entry,lessonInput,lessonProgress,result:{...r,competitions,preparation,lesson}};
    });
    return {profile:{grade:p.grade,age:p.age,location:p.location,interest:p.interest,minutes:p.minutes,goal:p.goal,...competitionProfile},history};
  }

  const api={empty,normalize,profile,normalizeLesson,blankProgress};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CoachCore=api;
})(globalThis);
