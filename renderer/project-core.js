(function(root){
  'use strict';
  const TRACKS=['Coding','Math','Competition'];
  const LEVELS=['Beginner','Intermediate','Advanced'];
  const PURPOSES=['learning','competition','portfolio','career','fun'];
  const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const catalog=[
  {
    "id": "math-visualizer",
    "title": "Modular arithmetic visualizer",
    "track": "Math",
    "level": "Beginner",
    "minutes": 90,
    "purposes": [
      "learning",
      "fun"
    ],
    "summary": "Build a small interactive tool that shows remainders, cycles, and last-digit patterns.",
    "starter": "Draw a remainder cycle for one modulus before building controls.",
    "check": "Compare the visual output with hand calculations, including zero and wraparound."
  },
  {
    "id": "amc-error-atlas",
    "title": "AMC mistake atlas",
    "track": "Math",
    "level": "Beginner",
    "minutes": 120,
    "purposes": [
      "learning",
      "competition"
    ],
    "summary": "Turn reviewed questions into a private topic map with a worked solution for each mistake.",
    "starter": "Classify three reviewed errors and explain one corrected solution.",
    "check": "Include the error cause, a corrected argument and a fresh check without copying archived problem text."
  },
  {
    "id": "math-topic-notebook",
    "title": "Math topic notebook",
    "track": "Math",
    "level": "Beginner",
    "minutes": 75,
    "purposes": [
      "learning",
      "portfolio"
    ],
    "summary": "Collect short explanations, diagrams, and one original example for each topic you study.",
    "starter": "Write one topic page with a definition and an original example.",
    "check": "Check the example independently and include one common misconception."
  },
  {
    "id": "amc-strategy-board",
    "title": "AMC strategy board",
    "track": "Math",
    "level": "Intermediate",
    "minutes": 180,
    "purposes": [
      "competition",
      "portfolio"
    ],
    "summary": "Compare timed-paper pacing, question accuracy, and review outcomes across real exams.",
    "starter": "Sketch a comparison table for two timed practice papers.",
    "check": "Label paper dates and sample sizes; distinguish retakes from new timed evidence."
  },
  {
    "id": "geometry-sketchpad",
    "title": "Geometry sketchpad",
    "track": "Math",
    "level": "Intermediate",
    "minutes": 180,
    "purposes": [
      "learning",
      "fun"
    ],
    "summary": "Create a visual notebook for angle, area, and symmetry investigations.",
    "starter": "Sketch a draggable triangle and choose one angle or area question.",
    "check": "Test degenerate and symmetric cases, and distinguish a visual pattern from a proof."
  },
  {
    "id": "contest-round-journal",
    "title": "Contest round journal",
    "track": "Competition",
    "level": "Beginner",
    "minutes": 90,
    "purposes": [
      "competition",
      "learning"
    ],
    "summary": "Plan a virtual contest, track solved problems, and record what to review afterward.",
    "starter": "Choose one round and draft a before-and-after review template.",
    "check": "Record attempts, time and the next review action without claiming unverified solves."
  },
  {
    "id": "contest-debrief",
    "title": "Contest debrief template",
    "track": "Competition",
    "level": "Beginner",
    "minutes": 60,
    "purposes": [
      "competition",
      "learning"
    ],
    "summary": "Create a repeatable post-contest review with time spent, missed ideas, and next steps.",
    "starter": "Write prompts for what worked, what failed and what to try next.",
    "check": "Complete the template with one real or clearly labeled sample practice round."
  },
  {
    "id": "aoc-solution-journal",
    "title": "Advent of Code solution journal",
    "track": "Competition",
    "level": "Intermediate",
    "minutes": 150,
    "purposes": [
      "competition",
      "fun"
    ],
    "summary": "Organize daily puzzle notes, test cases, and language-specific solution ideas.",
    "starter": "Create a page for one puzzle with an official link and your own notes.",
    "check": "Keep puzzle text on the organizer site and add your own tests and reasoning."
  },
  {
    "id": "pathfinding-lab",
    "title": "Pathfinding algorithm lab",
    "track": "Coding",
    "level": "Intermediate",
    "minutes": 180,
    "purposes": [
      "learning",
      "portfolio"
    ],
    "summary": "Animate breadth-first search and Dijkstra’s algorithm across a grid you can edit.",
    "starter": "Draw a small grid and trace breadth-first search by hand.",
    "check": "Compare path lengths with known answers and test blocked, unreachable and identical endpoints."
  },
  {
    "id": "portfolio-site",
    "title": "Developer portfolio site",
    "track": "Coding",
    "level": "Beginner",
    "minutes": 150,
    "purposes": [
      "portfolio",
      "career"
    ],
    "summary": "Present a few projects with clear explanations, screenshots, and a short build log.",
    "starter": "Outline one project page with its goal, your role and a screenshot placeholder.",
    "check": "Check keyboard navigation, small screens and source attribution; remove private details before sharing."
  },
  {
    "id": "coding-algorithm-notes",
    "title": "Algorithm notes collection",
    "track": "Coding",
    "level": "Beginner",
    "minutes": 75,
    "purposes": [
      "learning",
      "portfolio"
    ],
    "summary": "Write compact notes with a clear example for each algorithm you learn.",
    "starter": "Explain one algorithm with a small worked trace.",
    "check": "State prerequisites, complexity and a case where the method does not apply."
  },
  {
    "id": "local-flashcards",
    "title": "Local coding flashcards",
    "track": "Coding",
    "level": "Beginner",
    "minutes": 75,
    "purposes": [
      "learning",
      "fun"
    ],
    "summary": "Make a small offline review tool for syntax, data structures, and complexity ideas.",
    "starter": "Create five question-and-answer cards for one coding topic.",
    "check": "Test reveal, navigation and reload; review each answer against a reliable reference."
  },
  {
    "id": "codeforces-review-tool",
    "title": "Codeforces round review tool",
    "track": "Coding",
    "level": "Intermediate",
    "minutes": 180,
    "purposes": [
      "competition",
      "portfolio"
    ],
    "summary": "Record a round’s attempts, identify recurring topics, and schedule targeted practice.",
    "starter": "Design a local record for one round and one missed technique.",
    "check": "Check dates and topic labels, and separate manual practice marks from judge verdicts."
  },
  {
    "id": "mini-interpreter",
    "title": "Tiny expression interpreter",
    "track": "Coding",
    "level": "Advanced",
    "minutes": 300,
    "purposes": [
      "learning",
      "career",
      "fun"
    ],
    "summary": "Parse and evaluate arithmetic expressions to learn tokens, syntax trees, and errors.",
    "starter": "Tokenize numbers and addition before adding more grammar rules.",
    "check": "Test precedence, parentheses and malformed input without using unrestricted evaluation."
  },
  {
    "id": "study-planner-cli",
    "title": "Study planner command line app",
    "track": "Coding",
    "level": "Intermediate",
    "minutes": 180,
    "purposes": [
      "portfolio",
      "career"
    ],
    "summary": "Build a local command line tool that schedules practice and summarizes completed work.",
    "starter": "Sketch commands to add and list one practice task.",
    "check": "Test invalid dates, duplicate entries and safe persistence without losing earlier tasks."
  },
  {
    "id": "problem-explainer",
    "title": "Problem explanation collection",
    "track": "Competition",
    "level": "Beginner",
    "minutes": 120,
    "purposes": [
      "learning",
      "portfolio"
    ],
    "summary": "Write concise explanations that compare a direct solution with a more efficient one.",
    "starter": "Outline a direct approach and one improvement for a chosen task.",
    "check": "Explain correctness and complexity in your own words, with an official source link."
  },
  {
    "id": "local-search-engine",
    "title": "Local document search engine",
    "track": "Coding",
    "level": "Advanced",
    "minutes": 300,
    "purposes": [
      "learning",
      "portfolio",
      "career"
    ],
    "summary": "Build a tokenizer, inverted index and ranked search over a small collection of local text files.",
    "starter": "Index ten sample documents and print matching document IDs.",
    "check": "Compare results against hand-checked queries, including punctuation, empty input and repeated words."
  },
  {
    "id": "differential-testing-lab",
    "title": "Differential testing lab",
    "track": "Coding",
    "level": "Advanced",
    "minutes": 240,
    "purposes": [
      "learning",
      "competition",
      "portfolio"
    ],
    "summary": "Compare a simple reference solution with an optimized algorithm using reproducible generated cases.",
    "starter": "Write a tiny reference solution and five hand-checked cases.",
    "check": "Record random seeds, reduce one failing case, and explain why the optimized version is correct."
  },
  {
    "id": "counting-enumeration-lab",
    "title": "Combinatorics enumeration lab",
    "track": "Math",
    "level": "Intermediate",
    "minutes": 150,
    "purposes": [
      "learning",
      "competition",
      "fun"
    ],
    "summary": "Enumerate small arrangements and compare the counts with combinatorial formulas and casework.",
    "starter": "List all arrangements for one small counting problem.",
    "check": "Match enumeration to a formula and explain where double counting could occur."
  },
  {
    "id": "number-theory-conjecture-lab",
    "title": "Number theory conjecture lab",
    "track": "Math",
    "level": "Advanced",
    "minutes": 240,
    "purposes": [
      "learning",
      "competition",
      "fun"
    ],
    "summary": "Investigate modular patterns with small computations, then separate experimental evidence from proof.",
    "starter": "Choose a divisibility claim and test its first twenty cases.",
    "check": "Find a counterexample or write a proof; clearly label observations that remain unproved."
  },
  {
    "id": "geometry-proof-portfolio",
    "title": "Geometry proof portfolio",
    "track": "Math",
    "level": "Advanced",
    "minutes": 240,
    "purposes": [
      "learning",
      "portfolio",
      "career"
    ],
    "summary": "Create a small collection of precise geometry arguments with diagrams, stated assumptions and alternative approaches.",
    "starter": "Draw one configuration and list its givens and target claim.",
    "check": "Justify each inference and test whether the argument survives a changed diagram."
  },
  {
    "id": "competition-decision-lab",
    "title": "Contest decision model",
    "track": "Math",
    "level": "Advanced",
    "minutes": 240,
    "purposes": [
      "competition",
      "portfolio",
      "career"
    ],
    "summary": "Model pacing and answer-or-skip decisions with explicit assumptions, then compare them with held-out practice results.",
    "starter": "Write a toy scoring model with three confidence levels.",
    "check": "Test sensitivity to wrong assumptions and distinguish simulated results from observed performance."
  },
  {
    "id": "usaco-practice-roadmap",
    "title": "USACO practice roadmap",
    "track": "Competition",
    "level": "Intermediate",
    "minutes": 120,
    "purposes": [
      "competition",
      "learning"
    ],
    "summary": "Build a topic-balanced practice plan from official USACO tasks, with review checkpoints and realistic weekly limits.",
    "starter": "Choose three official tasks and record the skill each practices.",
    "check": "Include an easier warm-up, a stretch task and a review day; confirm every source link."
  },
  {
    "id": "virtual-round-dashboard",
    "title": "Virtual round pacing dashboard",
    "track": "Competition",
    "level": "Intermediate",
    "minutes": 180,
    "purposes": [
      "competition",
      "portfolio",
      "career"
    ],
    "summary": "Turn a practice round's local time log into a readable timeline of attempts, decisions and review actions.",
    "starter": "Sketch a round timeline using one sample practice log.",
    "check": "Reconcile all minutes with the log and keep self-reported attempts separate from verified solves."
  },
  {
    "id": "contest-set-curator",
    "title": "Contest set curator",
    "track": "Competition",
    "level": "Advanced",
    "minutes": 180,
    "purposes": [
      "competition",
      "portfolio",
      "fun"
    ],
    "summary": "Curate a coherent practice set with diverse techniques, defensible difficulty choices and links to official tasks.",
    "starter": "Choose a theme and outline three complementary problem roles.",
    "check": "Verify links and prerequisites, avoid copying statements, and explain each problem's place in the set."
  },
  {
    "id": "editorial-proof-study",
    "title": "Editorial proof comparison",
    "track": "Competition",
    "level": "Advanced",
    "minutes": 180,
    "purposes": [
      "learning",
      "portfolio",
      "career"
    ],
    "summary": "Compare two approaches to the same contest task through invariants, proof obligations, complexity and failure cases.",
    "starter": "Write a plain-language outline of two solution approaches.",
    "check": "Give a correctness argument, a boundary-case test and a complexity bound for each approach."
  },
  {
    "id": "season-evidence-report",
    "title": "Competition season evidence report",
    "track": "Competition",
    "level": "Advanced",
    "minutes": 180,
    "purposes": [
      "competition",
      "learning",
      "career"
    ],
    "summary": "Summarize a season of local practice evidence, recurring mistakes and a justified next training plan.",
    "starter": "Collect three dated practice records and label their limitations.",
    "check": "Show sample counts and retakes, separate facts from forecasts, and connect each next step to evidence."
  }
];
  const validDay=value=>{
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const date=new Date(value+'T12:00:00'),parts=value.split('-').map(Number);
    return Number.isFinite(date.getTime())&&date.getFullYear()===parts[0]&&date.getMonth()+1===parts[1]&&date.getDate()===parts[2];
  };
  const dayKey=date=>`${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const validPlanId=value=>typeof value==='string'&&/^plan-[a-zA-Z0-9-]{1,70}$/.test(value);
  function normalizePlans(value){
    const plans=value??[];
    if(!Array.isArray(plans)||plans.length>catalog.length)throw Error('Invalid project plans');
    const ids=new Set(),projects=new Set();
    return plans.map(plan=>{
      if(!isRecord(plan)||!validPlanId(plan.id)||ids.has(plan.id)||projects.has(plan.projectId)||!catalog.some(item=>item.id===plan.projectId)||!validDay(plan.startDate)||!['daily','weekdays'].includes(plan.workdays)||!Number.isFinite(plan.createdAt)||plan.createdAt<=0||!Number.isFinite(new Date(plan.createdAt).getTime())||!Array.isArray(plan.milestones)||plan.milestones.length<3||plan.milestones.length>10)throw Error('Invalid project plan');
      ids.add(plan.id);projects.add(plan.projectId);let previous='';
      const milestones=plan.milestones.map((item,index)=>{
        const stage=index===0?'start':index===plan.milestones.length-1?'review':'build';
        if(!isRecord(item)||item.taskId!==`${plan.id}-m${index+1}`||item.stage!==stage||typeof item.name!=='string'||!item.name.trim()||item.name.length>300||!validDay(item.date)||item.date<plan.startDate||item.date<=previous||!Number.isInteger(item.minutes)||item.minutes<1||item.minutes>180||(plan.workdays==='weekdays'&&[0,6].includes(new Date(item.date+'T12:00:00').getDay())))throw Error('Invalid project milestone');
        previous=item.date;return {taskId:item.taskId,stage,name:item.name,date:item.date,minutes:item.minutes};
      });
      return {id:plan.id,projectId:plan.projectId,startDate:plan.startDate,workdays:plan.workdays,createdAt:plan.createdAt,milestones};
    });
  }
  function blank(){return {preferences:null,votes:{},proposals:[],plans:[]};}
  function normalize(value){
    if(value==null)return blank();
    if(!isRecord(value))throw Error('Invalid project planner data');
    let preferences=null;
    if(value.preferences!=null){
      const p=value.preferences;
      if(!isRecord(p)||!TRACKS.includes(p.track)||!LEVELS.includes(p.level)||!PURPOSES.includes(p.purpose))throw Error('Invalid project preferences');
      preferences={track:p.track,level:p.level,purpose:p.purpose};
    }
    const votes=value.votes??{};
    if(!isRecord(votes)||Object.keys(votes).length>catalog.length||Object.entries(votes).some(([id,vote])=>!catalog.some(x=>x.id===id)||typeof vote!=='boolean'))throw Error('Invalid project recommendations');
    const proposals=value.proposals??[];
    const validText=(text,max)=>typeof text==='string'&&text.trim().length>0&&text.length<=max;
    if(!Array.isArray(proposals)||proposals.length>50||proposals.some(item=>!isRecord(item)||typeof item.id!=='string'||!/^idea-[a-zA-Z0-9-]{1,80}$/.test(item.id)||!['Project','Topic'].includes(item.kind)||!validText(item.title,100)||!validText(item.description,500)||!TRACKS.includes(item.track)||!LEVELS.includes(item.level)||!Number.isFinite(item.createdAt)||item.createdAt<=0))throw Error('Invalid saved project ideas');
    return {preferences,votes:{...votes},proposals:proposals.map(x=>({id:x.id,kind:x.kind,title:x.title,description:x.description,track:x.track,level:x.level,createdAt:x.createdAt})),plans:normalizePlans(value.plans)};
  }
  function makePlan(projectId,options,now=Date.now()){
    const project=catalog.find(item=>item.id===projectId);
    if(!project||!isRecord(options)||!validPlanId(options.id)||!validDay(options.startDate)||!['daily','weekdays'].includes(options.workdays)||!Number.isFinite(now)||now<=0)throw Error('Choose a valid project, start date and work pattern.');
    const review=Math.min(30,Math.floor((project.minutes-30)/2));let remaining=project.minutes-30-review;
    const blocks=[];while(remaining>0){const minutes=Math.min(45,remaining);blocks.push(minutes);remaining-=minutes;}
    const steps=[{stage:'start',minutes:30,instruction:'Start: '+project.starter},...blocks.map((minutes,index)=>({stage:'build',minutes,instruction:`Build work block ${index+1}/${blocks.length}`})),{stage:'review',minutes:review,instruction:'Check: '+project.check}];
    const date=new Date(options.startDate+'T12:00:00');
    const nextWorkday=()=>{if(options.workdays==='weekdays')while([0,6].includes(date.getDay()))date.setDate(date.getDate()+1);};
    const milestones=steps.map((step,index)=>{nextWorkday();const result={taskId:`${options.id}-m${index+1}`,stage:step.stage,name:`Project: ${project.title} — ${step.instruction}`,date:dayKey(date),minutes:step.minutes};date.setDate(date.getDate()+1);return result;});
    const plan=normalizePlans([{id:options.id,projectId,startDate:options.startDate,workdays:options.workdays,createdAt:now,milestones}])[0];
    const tasks=plan.milestones.map(item=>({id:item.taskId,name:item.name,category:project.track,date:item.date,minutes:item.minutes,done:false}));
    return {plan,tasks};
  }
  function planProgress(plan,tasks){
    const byId=new Map(tasks.map(task=>[task.id,task]));
    const total=plan.milestones.length,done=plan.milestones.filter(item=>byId.get(item.taskId)?.done===true).length,missing=plan.milestones.filter(item=>!byId.has(item.taskId)).length;
    return {total,done,missing,complete:total>0&&done===total&&missing===0};
  }
  function recommendations(data){
    const saved=normalize(data),prefs=saved.preferences||{track:'Coding',level:'Beginner',purpose:'learning'};
    return catalog.filter(x=>x.track===prefs.track&&x.level===prefs.level).map(item=>({
      ...item,fitVote:saved.votes[item.id]===true,
      score:(item.purposes.includes(prefs.purpose)?5:0)+(saved.votes[item.id]===true?4:0)
    })).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,3);
  }
  function ladder(track,level){
    if(!TRACKS.includes(track)||!LEVELS.includes(level))return [];
    const paths={
      Coding:{Beginner:['Variables and input','Conditions and loops','Functions and arrays','Simple search and sorting'],Intermediate:['Data structures','Two pointers and windows','Graphs and traversal','Dynamic programming'],Advanced:['Complexity analysis','Advanced graph algorithms','Proofs and invariants','Systems and language tooling']},
      Math:{Beginner:['Arithmetic and ratios','Algebra fundamentals','Counting strategies','Geometry foundations'],Intermediate:['Modular arithmetic','Functional equations','Combinatorics','Coordinate geometry'],Advanced:['Olympiad inequalities','Advanced number theory','Invariants and extremal ideas','Proof construction']},
      Competition:{Beginner:['Understand contest format','Practice one topic at a time','Try a short timed set','Review every miss'],Intermediate:['Plan a full practice round','Track accuracy by topic','Practice pacing decisions','Compare solution approaches'],Advanced:['Simulate contest conditions','Prioritize by expected value','Analyze score trends','Build a season plan']}
    };
    return paths[track][level].slice();
  }
  root.ProjectCore={TRACKS,LEVELS,PURPOSES,catalog,blank,normalize,recommendations,ladder,makePlan,planProgress};
})(typeof window!=='undefined'?window:globalThis);
