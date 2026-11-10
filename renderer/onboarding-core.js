(function(root){
  'use strict';
  const GOALS=['amc10','amc12','math','programming','coding-competitions','problem-solving','projects','explore'];
  const EXPERIENCE=['new','some','intermediate','advanced'];
  const STYLES=['examples','doing','visual','steps'];
  const SCHEDULES=['minutes-daily','hours-weekly','several-weekly','unsure'];
  const QUESTIONS={
    algebra:{id:'algebra',track:'Math',prompt:'If x² − 5x + 6 = 0, what are the possible values of x?',choices:['2 or 3','−2 or −3','1 or 6','−1 or −6'],answer:0,skill:'factoring quadratics',difficulty:'baseline',explanation:'The expression factors as (x − 2)(x − 3), so x can be 2 or 3.'},
    loop:{id:'loop',track:'Programming',prompt:'How many times does this loop run: for i in range(4)?',choices:['3','4','5','It never stops'],answer:1,skill:'loop bounds',difficulty:'baseline',explanation:'range(4) produces 0, 1, 2, and 3: four iterations.'},
    mathEasy:{id:'math-easy',track:'Math',prompt:'What is 3/4 of 20?',choices:['12','15','16','18'],answer:1,skill:'fractions',difficulty:'foundation',explanation:'Divide 20 into four equal groups, then take three: 20 ÷ 4 × 3 = 15.'},
    mathStretch:{id:'math-stretch',track:'Math',prompt:'What is the remainder when 2⁵ is divided by 5?',choices:['0','1','2','3'],answer:2,skill:'modular arithmetic',difficulty:'stretch',explanation:'2⁵ = 32, and 32 = 6 × 5 + 2, so the remainder is 2.'},
    codeEasy:{id:'code-easy',track:'Programming',prompt:'What does len([4, 7, 9]) return?',choices:['2','3','4','20'],answer:1,skill:'lists',difficulty:'foundation',explanation:'The list contains three items, so its length is 3.'},
    codeStretch:{id:'code-stretch',track:'Programming',prompt:'What value does total have after: total = 0; for n in [1, 2, 3]: total += n?',choices:['3','5','6','7'],answer:2,skill:'loop accumulation',difficulty:'stretch',explanation:'The loop adds 1 + 2 + 3, producing 6.'}
  };
  const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const cleanText=(value,max=120)=>typeof value==='string'?value.trim().slice(0,max):'';
  const unique=(values,allowed,max=allowed.length)=>Array.isArray(values)?[...new Set(values.filter(value=>allowed.includes(value)))].slice(0,max):[];
  function blank(){return {version:2,status:'new',completedAt:null,displayName:'',ageRange:'',learnerType:'Student',goals:[],experience:{math:'',programming:'',competition:''},learningStyles:[],schedule:'',diagnostic:{skipped:false,answers:[]},path:{id:'',level:'',title:'',reason:'',firstLesson:''},plan:{firstLesson:'',missions:[]}};}
  function legacy(){const value=blank();value.status='legacy';value.completedAt=Date.now();return value;}
  function normalize(value,options={}){
    if(value==null)return options.legacy?legacy():blank();
    if(!isRecord(value))throw Error('Invalid onboarding data');
    const base=blank();
    const status=['new','in-progress','complete','legacy'].includes(value.status)?value.status:'new';
    const experience=isRecord(value.experience)?value.experience:{};
    const answers=Array.isArray(value.diagnostic?.answers)?value.diagnostic.answers.slice(0,6).map(item=>{
      const question=Object.values(QUESTIONS).find(entry=>entry.id===item?.id);
      if(!question||!Number.isInteger(item.choice)||item.choice<0||item.choice>=question.choices.length)throw Error('Invalid diagnostic answer');
      return {id:question.id,choice:item.choice,correct:item.choice===question.answer,track:question.track,skill:question.skill,difficulty:question.difficulty};
    }):[];
    const path=isRecord(value.path)?value.path:{};
    const plan=isRecord(value.plan)?value.plan:{};
    const missions=Array.isArray(plan.missions)?plan.missions.slice(0,8).filter(item=>isRecord(item)&&typeof item.name==='string'&&['Coding','Math','Competition'].includes(item.category)&&Number.isInteger(item.dayOffset)&&item.dayOffset>=0&&item.dayOffset<=30&&Number.isInteger(item.minutes)&&item.minutes>=10&&item.minutes<=180).map(item=>({name:item.name.slice(0,300),category:item.category,dayOffset:item.dayOffset,minutes:item.minutes})):[];
    return {...base,version:2,status,completedAt:Number.isFinite(value.completedAt)?value.completedAt:null,displayName:cleanText(value.displayName,60),ageRange:['','12-under','13-14','15-16','17-18','19-plus'].includes(value.ageRange)?value.ageRange:'',learnerType:['Student','Homeschooler','Self-learner','Other'].includes(value.learnerType)?value.learnerType:'Student',goals:unique(value.goals,GOALS),experience:{math:EXPERIENCE.includes(experience.math)?experience.math:'',programming:EXPERIENCE.includes(experience.programming)?experience.programming:'',competition:EXPERIENCE.includes(experience.competition)?experience.competition:''},learningStyles:unique(value.learningStyles,STYLES,4),schedule:SCHEDULES.includes(value.schedule)?value.schedule:'',diagnostic:{skipped:Boolean(value.diagnostic?.skipped),answers},path:{id:cleanText(path.id,40),level:['','Foundation','Intermediate','Advanced'].includes(path.level)?path.level:'',title:cleanText(path.title,100),reason:cleanText(path.reason,300),firstLesson:cleanText(path.firstLesson,160)},plan:{firstLesson:cleanText(plan.firstLesson,160),missions}};
  }
  function questionSequence(onboarding){
    const answers=onboarding?.diagnostic?.answers||[];
    const firstMath=answers.find(item=>item.id==='algebra');
    const firstCode=answers.find(item=>item.id==='loop');
    return [QUESTIONS.algebra,QUESTIONS.loop,firstMath?.correct?QUESTIONS.mathStretch:QUESTIONS.mathEasy,firstCode?.correct?QUESTIONS.codeStretch:QUESTIONS.codeEasy];
  }
  function scheduleDetails(schedule){return ({'minutes-daily':{minutes:20,sessions:6,label:'A few minutes a day'},'hours-weekly':{minutes:35,sessions:4,label:'A few hours per week'},'several-weekly':{minutes:55,sessions:6,label:'Several hours per week'},unsure:{minutes:25,sessions:3,label:'A flexible starting plan'}})[schedule]||{minutes:25,sessions:3,label:'A flexible starting plan'};}
  function recommend(onboarding){
    const value=normalize(onboarding);
    const ranks={new:0,some:1,intermediate:2,advanced:3};
    const self=[value.experience.math,value.experience.programming,value.experience.competition].filter(Boolean).map(item=>ranks[item]);
    const selfAverage=self.length?self.reduce((sum,item)=>sum+item,0)/self.length:1;
    const evidence=value.diagnostic.answers;
    const evidenceScore=evidence.length?evidence.filter(item=>item.correct).length/evidence.length:null;
    const combined=evidenceScore==null?selfAverage:(selfAverage+(evidenceScore*3))/2;
    let level='Foundation';if(combined>=2.35)level='Advanced';else if(combined>=1.15)level='Intermediate';
    const competition=value.goals.some(goal=>['amc10','amc12','coding-competitions','explore'].includes(goal));
    const title=level==='Foundation'?'Foundations: Patterns into Programs':level==='Intermediate'?'Applied Problem Solving':competition?'Competition Strategy Lab':'Advanced Problem-Solving Studio';
    const firstLesson=level==='Foundation'?'Functions, loops, and number patterns':level==='Intermediate'?'Remainders, search, and efficient code':'Invariants, optimization, and proof-driven code';
    const evidencePhrase=evidenceScore==null?'your self-reported experience':`${evidence.filter(item=>item.correct).length} of ${evidence.length} optional check answers plus your self-report`;
    return {id:level.toLowerCase(),level,title,firstLesson,reason:`Suggested from ${evidencePhrase}. This is an adjustable starting point, not an ability score.`};
  }
  function buildPlan(onboarding){
    const value=normalize(onboarding);const path=value.path.id?value.path:recommend(value);const timing=scheduleDetails(value.schedule);const minutes=Math.max(15,Math.min(timing.minutes,45));
    const amc=value.goals.some(goal=>['amc10','amc12'].includes(goal));const coding=value.goals.some(goal=>['programming','coding-competitions','projects'].includes(goal));
    const missions=[{name:`Integrated lesson: ${path.firstLesson}`,category:'Coding',dayOffset:0,minutes},{name:amc?'AMC past-paper diagnostic set':'Math reasoning practice',category:amc?'Competition':'Math',dayOffset:1,minutes:Math.max(20,minutes)},{name:coding?'Programming challenge: explain, code, and test':'Turn a math pattern into a small Python program',category:'Coding',dayOffset:2,minutes},{name:'Review mistakes and choose the next focus',category:'Math',dayOffset:4,minutes:20}];
    return {firstLesson:path.firstLesson,missions};
  }
  function context(onboarding){const value=normalize(onboarding);const path=value.path.id?value.path:recommend(value);return {goals:value.goals,experience:value.experience,learningStyles:value.learningStyles,schedule:scheduleDetails(value.schedule),diagnostic:value.diagnostic.answers.map(({track,skill,difficulty,correct})=>({track,skill,difficulty,correct})),startingPath:{level:path.level,title:path.title,reason:path.reason}};}
  root.OnboardingCore={GOALS,EXPERIENCE,STYLES,SCHEDULES,QUESTIONS,blank,legacy,normalize,questionSequence,scheduleDetails,recommend,buildPlan,context};
})(typeof window!=='undefined'?window:globalThis);
