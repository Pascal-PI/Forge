
'use strict';
const STORAGE_KEY='forge_mvp_v1';
const todayKey=()=>new Date().toLocaleDateString('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'});
const dateAdd=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toLocaleDateString('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'});};
const fmtDate=(s,opts={month:'short',day:'numeric'})=>new Date(s+'T12:00:00').toLocaleDateString('en-US',opts);
const today=todayKey();
const seed=()=>({version:1,tasks:[
{id:'t1',name:'AMC 10: timed 75-minute mock',category:'Competition',date:today,minutes:75,done:false},
{id:'t2',name:'Review mock errors and alternative methods',category:'Math',date:today,minutes:35,done:false},
{id:'t3',name:'Solve one two-pointers coding challenge',category:'Coding',date:today,minutes:30,done:false},
{id:'t4',name:'Review modular arithmetic and remainders',category:'Math',date:dateAdd(today,1),minutes:25,done:false},
{id:'t5',name:'C++ polymorphism and OOP practice',category:'Coding',date:dateAdd(today,1),minutes:35,done:false},
{id:'t6',name:'AMC 10: 15-question pacing drill',category:'Competition',date:dateAdd(today,2),minutes:40,done:false}],
contests:[{id:'amca',name:'AMC 10A',date:'2026-11-05',kind:'Math'},{id:'amcb',name:'AMC 10B',date:'2026-11-13',kind:'Math'}],
codeDone:{},codeNotes:{},mistakes:[],mathAttempts:[],mocks:[],activity:{},settings:{theme:'system',progressionTarget:120,lessonTarget:3},aoc:AocCore.blank(),focus:FocusCore.empty(),training:TrainingCore.empty(),amc:AmcCore.empty(),coach:CoachCore.empty(),projects:ProjectCore.blank(),onboarding:OnboardingCore.blank(),school:SchoolCore.blank(),sparkLab:ForgeSpark.normalizeState(null)});
const byId=id=>document.getElementById(id);

function normalizeBackup(obj){
  const fail=()=>{throw Error('Invalid FORGE backup format')};
  const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const text=x=>typeof x==='string'&&x.length<=2000000;
  const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00'));
  const number=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
  const list=(x,valid)=>Array.isArray(x)&&x.length<=100000&&x.every(y=>record(y)&&valid(y));
  const dict=(x,valid)=>record(x)&&Object.entries(x).every(([k,v])=>!['__proto__','prototype','constructor'].includes(k)&&valid(v,k));
  if(!record(obj)||obj.version!==1)fail();
  if(!list(obj.tasks,x=>text(x.id)&&text(x.name)&&['Coding','Math','Competition'].includes(x.category)&&date(x.date)&&number(x.minutes)&&typeof x.done==='boolean'))fail();
  if(!list(obj.contests,x=>text(x.id)&&text(x.name)&&date(x.date)&&(x.kind==null||text(x.kind))))fail();
  if(!list(obj.mistakes,x=>text(x.id)&&text(x.questionId)&&Number.isInteger(x.stage)&&x.stage>=0&&x.stage<=3&&date(x.next)))fail();
  if(!list(obj.mathAttempts,x=>text(x.id)&&text(x.topic)&&date(x.date)&&typeof x.correct==='boolean'))fail();
  const codeDone=obj.codeDone??{},codeNotes=obj.codeNotes??{},activity=obj.activity??{},mocks=obj.mocks??[];
  if(!dict(codeDone,x=>typeof x==='boolean')||!dict(codeNotes,x=>dict(x,text))||!dict(activity,(x,k)=>date(k)&&dict(x,number)))fail();
  if(!list(mocks,x=>text(x.name)&&date(x.date)&&['correct','wrong','blank','score'].every(k=>number(x[k]))))fail();
  const theme=['system','dark','light'].includes(obj.settings?.theme)?obj.settings.theme:'system';
  const progressionTarget=ProgressionCore.normalizeTarget(obj.settings?.progressionTarget);
  const lessonTarget=ProgressionCore.normalizeLessonTarget(obj.settings?.lessonTarget);
  return {version:1,tasks:obj.tasks,contests:obj.contests,mistakes:obj.mistakes,mathAttempts:obj.mathAttempts,codeDone,codeNotes,activity,mocks,settings:{theme,progressionTarget,lessonTarget},aoc:AocCore.normalize(obj.aoc),focus:FocusCore.normalize(obj.focus),training:TrainingCore.normalize(obj.training),amc:AmcCore.normalize(obj.amc),coach:CoachCore.normalize(obj.coach),projects:ProjectCore.normalize(obj.projects),onboarding:OnboardingCore.normalize(obj.onboarding,{legacy:true}),school:SchoolCore.normalize(obj.school),sparkLab:ForgeSpark.normalizeState(obj.sparkLab)};
}

let state;
let codeforcesSchedule=null,codeforcesLoading=false,codeforcesLoadError='';
let selectedTimelineMonth='',timelineExamNames=new Map();
let modalReturnTarget=null,modalAfterClose=null;
try{const saved=localStorage.getItem(STORAGE_KEY);state=saved?normalizeBackup(JSON.parse(saved)):seed();if(state.focus.active?.running){state.focus=FocusCore.recover(state.focus);localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}}catch{state=seed();}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{toast('Could not save progress; export a backup.');}}
function applyTheme(){
  const mode=['system','dark','light'].includes(state.settings?.theme)?state.settings.theme:'system';
  const light=mode==='light'||(mode==='system'&&window.matchMedia?.('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme=light?'light':'dark';
  const select=byId('themeSelect');if(select)select.value=mode;
  const color=byId('themeColorMeta');if(color)color.content=light?'#f4f6fa':'#0a1020';
}
const systemThemeQuery=window.matchMedia?.('(prefers-color-scheme: light)');
systemThemeQuery?.addEventListener?.('change',()=>{if(state.settings?.theme==='system')applyTheme()});
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(msg){const el=byId('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2500)}
function addActivity(type){const k=todayKey();state.activity[k]=state.activity[k]||{task:0,code:0,practice:0,math:0,review:0,lesson:0};state.activity[k][type]=(state.activity[k][type]||0)+1;}
function dueMistakes(){return state.mistakes.filter(x=>x.stage<3&&x.next<=todayKey())}
function daysUntil(date){const a=new Date(todayKey()+'T12:00:00'),b=new Date(date+'T12:00:00');return Math.round((b-a)/86400000)}
function contestsSorted(){return [...state.contests].sort((a,b)=>a.date.localeCompare(b.date))}
function upcoming(){return contestsSorted().filter(x=>daysUntil(x.date)>=0)}
function categoryPill(c){return `<span class="pill ${c==='Coding'?'code':c==='Math'?'math':'contest'}">${esc(c.toUpperCase())}</span>`}
function taskHTML(t){return `<div class="task ${t.done?'done':''}"><input class="tick" type="checkbox" aria-label="Mark ${esc(t.name)} complete" data-task-check="${esc(t.id)}" ${t.done?'checked':''}><div class="task-body"><div class="task-title">${esc(t.name)}</div><div class="task-meta">${categoryPill(t.category)} <span>· ${t.minutes} min</span> <span>· ${fmtDate(t.date)}</span></div></div><div class="task-actions"><button class="linkish task-edit" data-task-edit="${esc(t.id)}" aria-label="Edit mission ${esc(t.name)}">Edit</button><button class="delete" data-task-delete="${esc(t.id)}" aria-label="Delete mission ${esc(t.name)}">×</button></div></div>`}
function renderToday(){byId('todayDate').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}).toUpperCase();
const c=upcoming().slice(0,2);byId('heroCountdowns').innerHTML=c.map(x=>`<div class="count"><div class="eyebrow">${esc(x.name)}</div><div class="num">${daysUntil(x.date)} <span>days</span></div><div class="sub">${fmtDate(x.date,{weekday:'short',month:'short',day:'numeric'})}</div></div>`).join('')||'<div class="count">No upcoming contests yet</div>';
const done=state.tasks.filter(t=>t.done).length,solved=Object.keys(state.codeDone).filter(k=>state.codeDone[k]).length,correct=state.mathAttempts.filter(x=>x.correct).length;const todayTasks=state.tasks.filter(t=>t.date===todayKey());const pct=todayTasks.length?Math.round(100*todayTasks.filter(x=>x.done).length/todayTasks.length):0;
byId('metrics').innerHTML=[['✓','Tasks done',done,'Total completed'],['⌨','Coding solved',solved,'Challenge library'],['∑','Math correct',correct,'Practice attempts'],['↻','Reviews due',dueMistakes().length,'Spaced repetition']].map(z=>`<div class="card metric"><div class="row"><div class="eyebrow">${z[1]}</div><div class="icon">${z[0]}</div></div><div class="value">${z[2]}</div><div class="small">${z[3]}</div></div>`).join('');
byId('todayTasks').innerHTML=todayTasks.length?todayTasks.map(taskHTML).join(''):'<div class="empty">No missions for today. Add one to get started!</div>';byId('todayProgress').style.width=pct+'%';byId('todayPercent').textContent=pct+'%';byId('missionHint').textContent=`${todayTasks.length} planned · ${todayTasks.filter(x=>x.done).length} completed`;
const due=dueMistakes();byId('dueBadge').textContent=`${due.length} due`;byId('todayReview').innerHTML=due.length?`<div class="feature-box"><strong>${due.length} math problem${due.length!==1?'s':''} ready</strong><div class="mini-note">Redo them without peeking at the answer.</div></div>`:'<div class="feature-box"><strong>All caught up ✨</strong><div class="mini-note">Your review queue will populate after missed math questions.</div></div>';
const nc=upcoming()[0];byId('nextContest').innerHTML=nc?`<div class="row"><div><strong>${esc(nc.name)}</strong><div class="muted tiny">${fmtDate(nc.date,{weekday:'long',month:'short',day:'numeric',year:'numeric'})}</div></div><div style="text-align:right"><b style="font-size:28px">${daysUntil(nc.date)}</b><div class="tiny muted">days</div></div></div><button class="btn sm extra-space" data-go="contests">Competition tracker →</button>`:'<div class="empty">Add a competition to see your countdown.</div>';
window.DashboardUI?.refresh();
}
function renderPlan(){const f=byId('taskFilter').value;const tasks=[...state.tasks].filter(t=>f==='all'||t.category===f).sort((a,b)=>a.date.localeCompare(b.date)||Number(a.done)-Number(b.done));const groups=[...new Set(tasks.map(x=>x.date))];byId('planTasks').innerHTML=groups.length?groups.map(day=>`<div class="row" style="margin:18px 0 6px"><strong>${fmtDate(day,{weekday:'long',month:'short',day:'numeric'})}</strong><span class="small-badge">${tasks.filter(x=>x.date===day&&x.done).length}/${tasks.filter(x=>x.date===day).length}</span></div>${tasks.filter(x=>x.date===day).map(taskHTML).join('')}`).join(''):'<div class="empty">No missions in this category.</div>';
byId('planContests').innerHTML=upcoming().map(x=>`<div class="topic" style="margin:8px 0"><div><h3>${esc(x.name)}</h3><p>${fmtDate(x.date)}</p></div><strong>${daysUntil(x.date)}d</strong></div>`).join('')||'<div class="empty">No upcoming contests.</div>'}
function renderProjects(){
  const prefs=state.projects.preferences,defaults=prefs||{track:'Coding',level:'Beginner',purpose:'learning'};
  byId('projectTrack').value=defaults.track;byId('projectExperience').value=defaults.level;byId('projectPurpose').value=defaults.purpose;
  byId('projectProfileStatus').textContent=prefs?`${prefs.track} · ${prefs.level}`:'Choose a starting point';
  byId('projectRecommendationLabel').textContent=`${defaults.track} · ${defaults.level} · ${purposeLabel(defaults.purpose)}`;
  const recommendations=ProjectCore.recommendations(state.projects);
  byId('projectRecommendations').innerHTML=recommendations.map(item=>`<article class="project-card">
    <div class="row wrap"><span class="pill ${item.track==='Coding'?'code':item.track==='Math'?'math':'contest'}">${esc(item.track)}</span><span class="small-badge">${esc(item.level)} · about ${item.minutes} min</span></div>
    <h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p>
    <div class="project-purpose-row">Good for: ${item.purposes.map(p=>`<span>${esc(purposeLabel(p))}</span>`).join('')}</div>
    <dl class="project-outline"><dt>First 30 minutes</dt><dd>${esc(item.starter)}</dd><dt>Check the result</dt><dd>${esc(item.check)}</dd></dl>
    <div class="row wrap"><button class="btn primary sm" data-project-plan="${esc(item.id)}">${state.projects.plans.some(plan=>plan.projectId===item.id)?'View project plan':'Plan project'}</button><button class="btn sm" data-project-add="${esc(item.id)}">Add starter mission</button><button class="btn sm" data-project-vote="${esc(item.id)}" aria-pressed="${item.fitVote}">${item.fitVote?'✓ Fits my goals':'Fits my goals'}</button></div>
  </article>`).join('')||'<div class="empty">No projects match this level yet. Try another focus or experience level.</div>';
  byId('projectLadderLevel').textContent=`${defaults.track} · ${defaults.level}`;
  byId('projectLadder').innerHTML=ProjectCore.ladder(defaults.track,defaults.level).map((step,index)=>`<div class="ladder-step"><span>${index+1}</span><strong>${esc(step)}</strong><small>${index===0?'Start here':index===1?'Next':'Then'}</small></div>`).join('');
  const selectedLevel=ProjectCore.LEVELS.indexOf(byId('projectIdeaLevel').value),available=ProjectCore.LEVELS.indexOf(defaults.level),gate=!prefs?'Save your project preferences first.':selectedLevel>available?`Your saved experience level is ${prefs.level}. Choose an idea at or below that level.`:'';
  byId('saveProjectIdea').disabled=Boolean(gate);byId('projectIdeaStatus').textContent=gate||'Ideas are private and stay on this device.';
  const proposals=state.projects.proposals.slice(0,10);
  byId('projectIdeaCount').textContent=`${state.projects.proposals.length} idea${state.projects.proposals.length===1?'':'s'}`;
  byId('projectIdeas').innerHTML=proposals.length?proposals.map(item=>`<div class="project-idea-row"><div><span class="small-badge">${esc(item.kind)} · ${esc(item.track)} · ${esc(item.level)}</span><strong>${esc(item.title)}</strong><p>${esc(item.description)}</p><small>Saved ${fmtDate(new Date(item.createdAt).toLocaleDateString('en-CA'))}</small></div><div class="row wrap"><button class="btn sm" data-project-idea-add="${esc(item.id)}">Add to plan</button><button class="btn sm danger" data-project-idea-delete="${esc(item.id)}" aria-label="Delete idea ${esc(item.title)}">Delete</button></div></div>`).join(''):'<div class="empty">Your saved project and study-topic ideas will appear here.</div>';
  window.ProjectPlannerUI?.render();
}
function purposeLabel(purpose){return ({learning:'learn',competition:'compete',portfolio:'portfolio',career:'career exploration',fun:'for fun'})[purpose]||purpose;}
function addProjectMission(item){
  const category=item.track==='Competition'?'Competition':item.track,id=`project-${item.id}-${todayKey()}`;
  if(state.tasks.some(task=>task.id===id)){toast('This starter mission is already on today’s plan.');return;}
  const name=item.kind==='Topic'?`Study topic: ${item.title}`:`Project: ${item.title}${item.starter?' — '+item.starter:''}`;
  state.tasks.push({id,name,category,date:todayKey(),minutes:item.kind==='Topic'?25:30,done:false});save();renderAll();toast('Added a starter mission to today’s plan.');
}
const challenges=[
{id:'two',title:'Two Sum in a Sorted Array',level:'Easy',topic:'Two pointers',prompt:'Given a sorted array of integers and a target, return the 0-based indices of two different elements whose sum equals the target. Exactly one valid pair exists.',example:'Input: nums = [1,2,4,7,11], target = 9\nOutput: [1,3]',hint:'Move the left pointer right to increase the sum, or the right pointer left to decrease it.',complexity:'Aim for O(n) time and O(1) extra space.'},
{id:'prefix',title:'Range Sum Queries',level:'Easy',topic:'Prefix sums',prompt:'Given an array and multiple inclusive [left, right] index queries, calculate the sum for every query efficiently.',example:'Input: nums=[3,1,4,1,5], queries=[[0,2],[2,4]]\nOutput: [8,10]',hint:'Build prefix[0]=0 and prefix[i+1]=prefix[i]+nums[i].',complexity:'Aim for O(n + q) total time.'},
{id:'binary',title:'First Position at Least K',level:'Easy',topic:'Binary search',prompt:'For a sorted list of integers and number k, find the first index with value at least k; return the array length if no such index exists.',example:'Input: nums=[1,2,2,5,8], k=3\nOutput: 3',hint:'Maintain a half-open interval and repeatedly narrow the search.',complexity:'Aim for O(log n) time.'},
{id:'islands',title:'Count Connected Islands',level:'Medium',topic:'DFS / graph traversal',prompt:'Given a grid of 0 (water) and 1 (land), return the number of islands. Cells connect vertically or horizontally.',example:'Input: [[1,1,0],[0,1,0],[1,0,1]]\nOutput: 3',hint:'Explore each unseen land component with DFS or BFS.',complexity:'Aim for O(rows × cols) time.'},
{id:'window',title:'Longest Unique Substring',level:'Medium',topic:'Sliding window',prompt:'Given a string, find the length of its longest substring with no repeated characters.',example:'Input: "abcabcbb"\nOutput: 3',hint:'Use a left boundary and record the most recent index of each character.',complexity:'Aim for O(n) time.'},
{id:'coin',title:'Minimum Coins',level:'Hard',topic:'Dynamic programming',prompt:'Given a list of positive coin denominations and a target amount, find the fewest coins required to make it. Return -1 if impossible.',example:'Input: coins=[1,3,4], amount=6\nOutput: 2',hint:'Define dp[a] as the minimum coins needed for amount a.',complexity:'Aim for O(amount × number of coins) time.'}
];
const codingLanguages=['Python','C++','C','C#','Go','Swift','Java','JavaScript','Pascal','Rust','Ruby','Assembly','Elixir','Racket','HTML','CSS','TypeScript'];
let selectedCode='two',codeLang='Python',runnerBusy=false;
function renderLanguageGuide(){
  const language=byId('languageGuideSelect').value,info=window.LanguageGuide?.[language];
  if(!info){byId('languageGuideDetails').textContent='Guide details are unavailable.';return;}
  byId('languageGuideDetails').innerHTML=`<div class="language-guide-summary"><div><span class="eyebrow">TYPICAL LEARNING CURVE</span><p>${esc(info.curve)}</p></div><div><span class="eyebrow">COMMON USES</span><p>${esc(info.uses)}</p></div></div><div class="language-guide-summary"><div><span class="eyebrow">RELATED DIRECTIONS</span><p>${esc(info.directions)}</p></div><div class="language-guide-note">${esc(info.note)}</div></div>`;
}
function renderTrainingPaths(){
  const platform=byId('trainingProvider').value,level=byId('trainingLevel').value,progress=TrainingCore.normalize(state.training);
  const items=TrainingCore.CATALOG.filter(item=>(platform==='all'||item.platform===platform)&&(level==='all'||item.level===level));
  const marked=items.filter(item=>progress.completed[item.id]).length,totalMarked=Object.keys(progress.completed).length;
  byId('trainingSummary').textContent=`${marked} of ${items.length} shown problems marked practiced · ${totalMarked} marked across both platforms. These are self-reported practice notes, not verified submissions.`;
  byId('trainingCards').innerHTML=items.map(item=>{
    const added=state.tasks.some(task=>task.id===`training-${item.id}`),done=progress.completed[item.id]===true;
    return `<article class="card card-pad training-path-card"><div class="row wrap"><span class="pill code">${item.platform}</span><span class="small-badge">${item.level} · ${item.platform==='Codeforces'?`${item.rating} rating`:`${item.rating}`} · ~${item.minutes} min</span></div><h3>${esc(item.title)}</h3><p class="tiny muted">${esc(item.topic)}</p><div class="row wrap"><button class="btn sm" data-training-open="${item.id}">Official problem ↗</button><button class="btn sm" data-training-done="${item.id}" aria-pressed="${done}">${done?'✓ Practiced':'Mark practiced'}</button><button class="btn primary sm" data-training-plan="${item.id}" ${added?'disabled':''}>${added?'✓ Added to plan':'Add to plan'}</button></div></article>`;
  }).join('')||'<div class="empty">No problems match these filters.</div>';
}
function renderCoding(){const f=byId('codeFilter').value;byId('codeLibrary').innerHTML=challenges.filter(x=>f==='all'||x.level===f).map(x=>`<button data-code="${x.id}" class="topic ${selectedCode===x.id?'selected-code':''}" style="text-align:left;width:100%;cursor:pointer"><div><h3>${esc(x.title)} ${state.codeDone[x.id]?'✓':''}</h3><p>${esc(x.topic)}</p></div><span class="small-badge ${x.level==='Hard'?'difficulty-hard':''}">${x.level}</span></button>`).join('')||'<div class="empty">No matching challenges.</div>';renderTrainingPaths();renderWorkbench()}
function renderWorkbench(){
  const c=challenges.find(x=>x.id===selectedCode)||challenges[0],note=state.codeNotes[c.id]||{};
  const languageOptions=codingLanguages.map(language=>`<option value="${esc(language)}" ${codeLang===language?'selected':''}>${esc(language)}${language==='HTML'||language==='CSS'?' · local preview':''}</option>`).join('');
  byId('codeWorkbench').innerHTML=`<div class="coding-problem"><div class="card-heading"><span class="pill code">${esc(c.topic)}</span><span class="small-badge">${c.level}</span></div><div class="problem-sheet" style="margin-top:12px"><h3>${esc(c.title)}</h3><p>${esc(c.prompt)}</p><div class="examples">${esc(c.example)}</div><p class="tiny muted">${esc(c.complexity)}</p><details><summary class="code-hint">Show a hint</summary><p class="tiny">${esc(c.hint)}</p></details></div><div class="coding-coach-note"><span aria-hidden="true">✦</span><div><strong>Find your next step</strong><p>Use the challenge hint for a nudge, or open AI Coach to plan your practice.</p><button class="btn sm" data-go="coach">Open AI Coach →</button></div></div></div><div class="coding-editor"><div class="row"><label for="codeLang"><strong>Code language</strong></label><select class="filter" id="codeLang" aria-label="Code language">${languageOptions}</select></div><div class="field extra-space"><label for="codeEditor"><strong>Your solution</strong></label><textarea id="codeEditor" class="editor" spellcheck="false" placeholder="Write your solution here. It will save locally…">${esc(note[codeLang]||'')}</textarea></div><div class="row wrap extra-space"><div><button class="btn primary" id="saveCode">Save solution</button> <button class="btn" id="codeDone">${state.codeDone[c.id]?'✓ Completed · Undo':'Mark solved ✓'}</button></div><span class="tiny muted">Drafts save on this device.</span></div><section class="runner-panel section" aria-labelledby="runnerHeading"><div class="section-head"><h3 id="runnerHeading">Run or preview</h3><span class="small-badge">No code runs on this computer</span></div><p class="tiny muted" id="runnerModeNote">Remote execution is optional. No code is sent until you check the consent box and click Run.</p><div id="remoteRunnerFields"><div class="field"><label for="runnerInput">Standard input · sent with a remote run</label><textarea id="runnerInput" class="runner-input" spellcheck="false" maxlength="12000" placeholder="Optional input for your program"></textarea></div><label class="runner-consent"><input id="runnerConsent" type="checkbox"><span>I agree to send this code and input to Judge0 Community Edition for execution. Judge0 stores submissions. FORGE cannot control retention or guarantee deletion. Do not send private code, passwords, API keys, or personal information.</span></label><div class="row wrap"><button class="btn primary" id="runnerRun">Run remotely</button><button class="btn hide" id="runnerStop">Stop waiting</button><button class="btn sm" id="runnerCheck">Check service and languages</button><button class="linkish tiny" id="runnerPrivacy">Judge0 privacy details ↗</button></div></div><div id="localPreviewFields" class="hide"><div class="row wrap"><span class="tiny muted">This sandboxed preview stays on this device. Scripts, network requests, forms, and embedded frames are disabled.</span><button class="btn primary" id="runnerPreview">Update local preview</button></div><iframe id="codePreview" class="code-preview" title="Local HTML or CSS preview" sandbox=""></iframe></div><div id="runnerStatus" class="tiny muted section" role="status" aria-live="polite">The service and currently available language versions are checked when requested.</div><pre id="runnerResult" class="runner-result hide" aria-live="polite"></pre></section></div>`;
  byId('codeLang').addEventListener('change',()=>{saveCode(false);codeLang=byId('codeLang').value;renderWorkbench()});
  byId('saveCode').onclick=()=>saveCode(true);
  byId('codeDone').onclick=()=>{saveCode(false);const was=!!state.codeDone[c.id];state.codeDone[c.id]=!was;if(!was)addActivity('code');save();renderAll();toast(was?'Challenge reopened.':'Challenge completed!')};
  const localPreview=['HTML','CSS'].includes(codeLang);byId('remoteRunnerFields').classList.toggle('hide',localPreview);byId('localPreviewFields').classList.toggle('hide',!localPreview);byId('runnerModeNote').classList.toggle('hide',localPreview);
  byId('runnerCheck').onclick=refreshRunnerStatus;byId('runnerRun').onclick=runRemoteCode;byId('runnerPreview').onclick=previewCodeLocally;
  byId('runnerStop').onclick=()=>window.forgeDesktop.runnerCancel().then(()=>{byId('runnerStatus').textContent='Stopped waiting. The provider may finish the already-submitted job within its fixed limits.'}).catch(()=>{});
  byId('runnerPrivacy').onclick=()=>window.forgeDesktop.runnerPrivacy().catch(()=>toast('Could not open Judge0 privacy details.'));
}
function saveCode(notify){const ta=byId('codeEditor');if(!ta)return;state.codeNotes[selectedCode]=state.codeNotes[selectedCode]||{};state.codeNotes[selectedCode][codeLang]=ta.value;save();if(notify)toast('Solution saved locally.');}
async function refreshRunnerStatus(){const status=byId('runnerStatus');if(!status)return;status.textContent='Checking Judge0 security settings and language versions…';byId('runnerCheck').disabled=true;try{const result=await window.forgeDesktop.runnerStatus(true);const available=result.availableLanguages.join(', ')||'none';const missing=result.unavailableLanguages.join(', ')||'none';for(const option of byId('codeLang').options)option.disabled=!['HTML','CSS'].includes(option.value)&&result.unavailableLanguages.includes(option.value);status.textContent=`${result.provider} ${result.version}: ${result.ready?'ready for opt-in runs':'not ready; runs will remain blocked'}. Network disabled in the sandbox: ${result.networkDisabled?'yes':'no'}. Submission deletion enabled: ${result.submissionDeleteEnabled?'yes':'no'}. Available: ${available}. Not on this service: ${missing}. ${result.remainingRuns}/${result.dailyLimit} runs left today.`;}catch(error){status.textContent=error.message||'Could not check the remote service.'}finally{byId('runnerCheck').disabled=false}}
async function runRemoteCode(){if(runnerBusy)return;const consent=byId('runnerConsent');if(!consent?.checked){byId('runnerStatus').textContent='Check the consent box after reviewing the external-service storage notice. No code has been sent.';return}saveCode(false);const source=byId('codeEditor')?.value||'',stdin=byId('runnerInput')?.value||'',runButton=byId('runnerRun'),stopButton=byId('runnerStop');runnerBusy=true;runButton.disabled=true;stopButton.classList.remove('hide');byId('runnerStatus').textContent='Checking service security and sending this run to Judge0…';byId('runnerResult').classList.add('hide');try{const result=await window.forgeDesktop.runnerRun({language:codeLang,sourceCode:source,stdin,remoteConsent:true});const output=[`Result: ${result.status}`,`Language: ${result.language}`,`Time: ${result.time||'—'} s · Memory: ${result.memoryKb??'—'} KB`,result.stdout?`\nSTDOUT\n${result.stdout}`:'',result.stderr?`\nSTDERR\n${result.stderr}`:'',result.compileOutput?`\nCOMPILE OUTPUT\n${result.compileOutput}`:'',result.message?`\nMESSAGE\n${result.message}`:''].filter(Boolean).join('\n');byId('runnerResult').textContent=output;byId('runnerResult').classList.remove('hide');byId('runnerStatus').textContent=`Completed on Judge0 ${result.providerVersion}. ${result.notice}`;addActivity('practice');save();renderInsights()}catch(error){byId('runnerStatus').textContent=error.message||'The remote run did not complete.'}finally{runnerBusy=false;runButton.disabled=false;stopButton.classList.add('hide')}}
function previewCodeLocally(){const source=byId('codeEditor')?.value||'',frame=byId('codePreview'),csp=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline' data:; font-src data:; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'">`,preview=codeLang==='HTML'?`${csp}${source}`:`${csp}<meta charset="utf-8"><style>body{font:16px system-ui,sans-serif;margin:32px;color:#111;background:#fff}main{max-width:680px;margin:auto;padding:24px;border:1px solid #bbb;border-radius:12px}code{font-family:ui-monospace,monospace}</style><style>${source}</style><main><h1>CSS preview</h1><p>Edit the stylesheet to change this example.</p><button>Sample button</button><p><code>.class</code> · color · spacing · layout</p></main>`;frame.srcdoc=preview;byId('runnerStatus').textContent=codeLang==='HTML'?'Local preview updated. Scripts and external resources are blocked.':'Local CSS preview updated. Network and script execution are blocked.';}
const questions=[
{id:'m1',topic:'Number theory',q:'What is the remainder when 7^2026 is divided by 10?',options:['1','3','7','9'],ans:3,why:'The last digits of powers of 7 cycle 7, 9, 3, 1 every four powers. Since 2026 leaves remainder 2 upon division by 4, the last digit is 9.'},
{id:'m2',topic:'Algebra',q:'If x + 1/x = 5 and x ≠ 0, what is x² + 1/x²?',options:['10','23','25','27'],ans:1,why:'Square both sides: (x + 1/x)² = x² + 2 + 1/x² = 25. Subtract 2 to get 23.'},
{id:'m3',topic:'Counting',q:'How many three-digit numbers can be formed using distinct digits from 1, 2, 3, 4, and 5?',options:['15','60','100','125'],ans:1,why:'There are 5 choices for the first digit, 4 for the second, and 3 for the third: 5×4×3=60.'},
{id:'m4',topic:'Geometry',q:'A right triangle has legs 6 and 8. What is its inradius?',options:['1','2','3','4'],ans:1,why:'The hypotenuse is 10. For a right triangle, r=(a+b−c)/2=(6+8−10)/2=2.'},
{id:'m5',topic:'Number theory',q:'What is the smallest positive integer divisible by both 12 and 18?',options:['24','30','36','72'],ans:2,why:'LCM(12,18)=2²×3²=36.'},
{id:'m6',topic:'Algebra',q:'The roots of x²−7x+10=0 are a and b. What is a²+b²?',options:['19','29','39','49'],ans:1,why:'By Vieta, a+b=7 and ab=10. So a²+b²=(a+b)²−2ab=49−20=29.'},
{id:'m7',topic:'Counting',q:'Two fair six-sided dice are rolled. What is the probability the sum is 7?',options:['1/12','1/9','1/6','1/4'],ans:2,why:'There are six favorable ordered pairs among 36 equally likely results. Thus the probability is 6/36=1/6.'},
{id:'m8',topic:'Geometry',q:'Two similar triangles have corresponding side lengths in the ratio 2:5. What is the ratio of their areas?',options:['2:5','4:10','4:25','8:125'],ans:2,why:'Areas of similar figures scale by the square of the side ratio: 2²:5²=4:25.'},
{id:'m9',topic:'Number theory',q:'How many positive divisors does 72 have?',options:['8','10','12','14'],ans:2,why:'72=2³×3², so the number of positive divisors is (3+1)(2+1)=12.'},
{id:'m10',topic:'Algebra',q:'If 3x−2=2x+9, what is 2x−5?',options:['11','15','17','22'],ans:2,why:'3x−2=2x+9 gives x=11. Therefore 2x−5=22−5=17.'},
{id:'m11',topic:'Geometry',q:'A square has diagonal length 10. What is its area?',options:['25','50','75','100'],ans:1,why:'The diagonal d and side s satisfy d²=2s². Thus the area s²=d²/2=100/2=50.'},
{id:'m12',topic:'Counting',q:'A class has 6 students. How many ways can a team of 2 be selected?',options:['12','15','24','30'],ans:1,why:'Order does not matter. The number is C(6,2)=6×5/2=15.'}
];
let selectedQuestion='m1',mathRevealed=false,mathChosen=null;
function currentQuestion(){return questions.find(x=>x.id===selectedQuestion)||questions[0]}
function renderMath(){const latest=state.mathAttempts;byId('mathCount').textContent=`${latest.length} answered`;byId('mathStats').innerHTML=`<div class="grid-2"><div class="feature-box"><div class="eyebrow">Answers checked</div><div class="value" style="font-size:30px;font-weight:900">${latest.length}</div></div><div class="feature-box"><div class="eyebrow">Accuracy</div><div class="value" style="font-size:30px;font-weight:900">${latest.length?Math.round(100*latest.filter(a=>a.correct).length/latest.length)+'%':'—'}</div></div></div><p class="tiny muted">Accuracy is calculated over all practice attempts, including repeats.</p>`;renderMathQuestion()}
function renderMathQuestion(){const q=currentQuestion();byId('mathQuestion').innerHTML=`<div class="problem-sheet"><div class="row"><span class="pill math">${esc(q.topic)}</span><span class="tiny muted">Original practice • ${questions.findIndex(x=>x.id===q.id)+1}/${questions.length}</span></div><h3 style="font-size:19px;margin:22px 0">${esc(q.q)}</h3><div class="answers">${q.options.map((o,i)=>`<button class="option ${mathRevealed?(i===q.ans?'correct':i===mathChosen?'incorrect':''):i===mathChosen?'chosen':''}" data-answer="${i}" ${mathRevealed?'disabled':''}><span class="muted">${'ABCD'[i]}.</span> &nbsp;${esc(o)}</button>`).join('')}</div>${mathRevealed?`<div class="explanation"><strong>${mathChosen===q.ans?'✓ Correct!':'Not quite—here is the reasoning.'}</strong><p style="margin-bottom:0">${esc(q.why)}</p></div>`:''}<div class="row wrap extra-space"><button class="btn" id="prevMath">← Previous</button><button class="btn primary" id="nextMath">Next problem →</button></div></div>`;
byId('mathQuestion').querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>answerMath(Number(b.dataset.answer)));byId('prevMath').onclick=()=>moveMath(-1);byId('nextMath').onclick=()=>moveMath(1)}
function moveMath(delta){const allowed=questions.filter(x=>byId('mathFilter').value==='all'||x.topic===byId('mathFilter').value);let i=allowed.findIndex(x=>x.id===selectedQuestion);selectedQuestion=allowed[(i+delta+allowed.length)%allowed.length].id;mathChosen=null;mathRevealed=false;renderMathQuestion()}
function answerMath(idx){if(mathRevealed)return;mathChosen=idx;mathRevealed=true;const q=currentQuestion(),ok=idx===q.ans;state.mathAttempts.push({id:q.id,topic:q.topic,date:todayKey(),correct:ok});addActivity('practice');if(ok)addActivity('math');else if(!state.mistakes.find(m=>m.questionId===q.id&&m.stage<3)){state.mistakes.push({id:'err-'+q.id+'-'+Date.now(),questionId:q.id,stage:0,next:dateAdd(todayKey(),1),origin:todayKey()})}save();renderMath();renderToday();renderMistakes();renderInsights();toast(ok?'Great reasoning!':'Added to your review queue for tomorrow.');}
function renderContests(){byId('contestCards').innerHTML=contestsSorted().map(x=>{const diff=daysUntil(x.date);return `<div class="card contest-item"><div class="row"><span class="pill contest">${esc(x.kind||'Competition')}</span><button class="delete btn sm ghost" data-contest-delete="${esc(x.id)}" title="Remove competition">×</button></div><h2 style="font-size:22px;margin:12px 0 5px">${esc(x.name)}</h2><div class="date">${fmtDate(x.date,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div><div class="big">${diff<0?'✓':diff}<span> ${diff<0?'past':diff===0?'today':'days remaining'}</span></div></div>`}).join('')||'<div class="empty">No competitions yet. Add one to start tracking!</div>';
byId('mockHistory').innerHTML=state.mocks.length?[...state.mocks].reverse().map(m=>`<div class="topic" style="margin:8px 0"><div><h3>${esc(m.name)}</h3><p>${fmtDate(m.date)} • ${m.correct} correct / ${m.blank} blank / ${m.wrong} wrong</p></div><div style="text-align:right"><strong style="font-size:20px">${m.score}</strong><div class="tiny muted">/150</div></div></div>`).join(''):'<div class="empty">No mock scores logged yet. Your first score will appear here.</div>'}
function renderAoc(){
  const select=byId('aocYear');
  if(select.dataset.ready!=='true'){
    const options=[];for(let year=AocCore.MAX_YEAR;year>=AocCore.MIN_YEAR;year--)options.push(`<option value="${year}">${year}</option>`);
    select.innerHTML=options.join('');select.dataset.ready='true';
  }
  const year=state.aoc.selectedYear;select.value=String(year);const progress=AocCore.stats(state.aoc,year);
  byId('aocSummary').textContent=`${progress.completedDays}/25 days marked · ${progress.stars} ${progress.stars===1?'star':'stars'} recorded for ${year}. This is your manual local tracker, not a verified competition result.`;
  byId('aocDays').innerHTML=Array.from({length:25},(_,index)=>{
    const day=index+1,stars=progress.days[String(day)]||0,label=stars===1?'1 star':`${stars} stars`;
    return `<article class="aoc-day"><button class="aoc-open" data-aoc-open="${day}" aria-label="Open Advent of Code ${year} day ${day} on the official site">Day ${day} ↗</button><button class="aoc-star" data-aoc-star="${day}" aria-label="Update local stars for ${year} day ${day}; currently ${label}. Click to cycle between no stars, one star and two stars." title="Cycle local star count">${stars===0?'☆☆':stars===1?'★☆':'★★'}</button></article>`;
  }).join('');
}
function renderCodeforces(){
  const status=byId('codeforcesStatus'),cards=byId('codeforcesCards'),button=byId('codeforcesRefresh');
  if(!status||!cards||!button)return;
  button.disabled=codeforcesLoading;button.textContent=codeforcesLoading?'Loading…':'Refresh schedule';
  if(codeforcesLoading){status.textContent='Loading the public Codeforces schedule…';return;}
  if(codeforcesLoadError){status.textContent=codeforcesLoadError;cards.innerHTML='';return;}
  if(!codeforcesSchedule){status.textContent='The schedule loads only when you request it.';cards.innerHTML='';return;}
  const fetched=new Date(codeforcesSchedule.fetchedAt).toLocaleString();
  status.textContent=codeforcesSchedule.stale?`Showing saved schedule data from ${fetched}; a live refresh was unavailable.`:codeforcesSchedule.cached?`Using the recent cached schedule, checked ${fetched}.`:`Updated ${fetched}.`;
  cards.innerHTML=codeforcesSchedule.contests.length?codeforcesSchedule.contests.map(contest=>{
    const date=new Date(contest.startTimeSeconds*1000),id=`codeforces-${contest.id}`,tracked=state.contests.some(x=>x.id===id);
    const duration=Math.round(contest.durationSeconds/60);
    return `<article class="card contest-item codeforces-contest"><div class="row"><span class="pill code">Codeforces</span><span class="small-badge">${Math.floor(duration/60)}h ${duration%60}m</span></div><h3>${esc(contest.name)}</h3><p class="muted tiny">${esc(date.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))} · local time</p><div class="row wrap"><button class="btn sm" data-codeforces-open="${contest.id}">Official page ↗</button><button class="btn primary sm" data-codeforces-track="${contest.id}" ${tracked?'disabled':''}>${tracked?'✓ Tracked':'Track date'}</button></div></article>`;
  }).join(''):'<div class="empty">Codeforces has not announced a future contest in the current public schedule.</div>';
}
async function loadCodeforces(){
  if(codeforcesLoading)return;
  codeforcesLoading=true;codeforcesLoadError='';renderCodeforces();
  try{codeforcesSchedule=await window.forgeDesktop.codeforcesContests();}
  catch{codeforcesLoadError='Could not load the public schedule. Check your internet connection and try again.';}
  finally{codeforcesLoading=false;renderCodeforces();}
}
function trackCodeforcesContest(id){
  const contest=codeforcesSchedule?.contests.find(x=>String(x.id)===String(id));if(!contest)return;
  const key=`codeforces-${contest.id}`;if(state.contests.some(x=>x.id===key)){toast('This Codeforces contest is already tracked.');return;}
  const date=new Date(contest.startTimeSeconds*1000).toLocaleDateString('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'});
  state.contests.push({id:key,name:contest.name,date,kind:'Coding',sourceUrl:contest.url});save();renderAll();toast('Codeforces contest added to your tracker.');
}
function renderMistakes(){const due=dueMistakes();byId('navMistakes').textContent=due.length?`(${due.length})`:'';byId('mistakesDue').textContent=due.length;byId('mistakesActive').textContent=state.mistakes.filter(x=>x.stage<3).length;byId('mistakesMastered').textContent=state.mistakes.filter(x=>x.stage===3).length;byId('reviewCount').textContent=`${state.mistakes.length} entries`;const arr=[...state.mistakes].sort((a,b)=>a.next.localeCompare(b.next));byId('reviewList').innerHTML=arr.length?`<div class="list-header"><span>Question</span><span>Progress</span><span>Action</span></div>${arr.map(m=>{const q=questions.find(x=>x.id===m.questionId);return `<div class="review-row"><div><b>${esc(q?q.topic+': '+q.q:'Unknown question')}</b><small>Next: ${m.stage===3?'Mastered':fmtDate(m.next)} ${m.next<=todayKey()&&m.stage<3?'• DUE':''}</small></div><span class="small-badge ${m.stage===3?'':'alert'}">${m.stage} of 3</span><button class="btn sm" data-redo="${esc(m.id)}" ${m.stage===3?'disabled':''}>${m.stage===3?'Done':'Redo'}</button></div>`}).join('')}`:'<div class="empty">Your error log is empty. Mistakes made during math practice will appear here.</div>'}
function reviewModal(id){const m=state.mistakes.find(x=>x.id===id),q=m&&questions.find(x=>x.id===m.questionId);if(!m||!q)return;let choice=null;openModal('Review: '+q.topic,`<p>${esc(q.q)}</p><div class="answers">${q.options.map((x,i)=>`<button class="option" data-review-choice="${i}">${'ABCD'[i]}. ${esc(x)}</button>`).join('')}</div><div class="extra-space" id="reviewFeedback"></div><div class="row extra-space"><span class="tiny muted">Stage ${m.stage+1} of 3</span><button class="btn primary" id="submitReview" disabled>Check answer</button></div>`);
byId('modalBody').querySelectorAll('[data-review-choice]').forEach(b=>b.onclick=()=>{choice=Number(b.dataset.reviewChoice);byId('modalBody').querySelectorAll('[data-review-choice]').forEach(x=>x.classList.toggle('chosen',x===b));byId('submitReview').disabled=false});
byId('submitReview').onclick=()=>{const correct=choice===q.ans;if(correct){m.stage++;m.next=m.stage>=3?todayKey():dateAdd(todayKey(),m.stage===1?3:6);if(m.stage===3)addActivity('review')}else{m.stage=0;m.next=dateAdd(todayKey(),1)}save();byId('reviewFeedback').innerHTML=`<div class="explanation"><strong>${correct?'✓ Correct! '+(m.stage===3?'Mastered!':'Next review scheduled.'):'Try again later; the interval has restarted.'}</strong><p>${esc(q.why)}</p><button class="btn sm" id="finishReview">Close</button></div>`;byId('modalBody').querySelectorAll('[data-review-choice]').forEach(x=>x.disabled=true);byId('submitReview').disabled=true;byId('finishReview').onclick=()=>{closeModal();renderAll()};renderMistakes();};}
function hasRecordedActivity(day){const item=state.activity?.[day]||{};return ['practice','task','code','math','review','lesson','focus'].some(key=>Number(item[key])>0)}
function streakStats(){
  const dates=Object.keys(state.activity||{}).filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&hasRecordedActivity(day)).sort();
  let longest=0,run=0,previous=null;
  for(const day of dates){run=previous&&dateAdd(previous,1)===day?run+1:1;longest=Math.max(longest,run);previous=day;}
  let cursor=todayKey();if(!hasRecordedActivity(cursor))cursor=dateAdd(cursor,-1);
  let current=0;while(current<3650&&hasRecordedActivity(cursor)){current++;cursor=dateAdd(cursor,-1);}
  return {current,longest,activeDays:dates.length};
}
function timedScoreEstimate(){
  const latestByExam=new Map();
  for(const attempt of [...(state.amc?.attempts||[])].filter(x=>x.mode==='timed'&&Number.isFinite(x.score)&&x.score>=0&&x.score<=150).sort((a,b)=>a.completedAt-b.completedAt))latestByExam.set(attempt.examId,attempt);
  const recent=[...latestByExam.values()].sort((a,b)=>b.completedAt-a.completedAt).slice(0,3);
  if(recent.length<3)return {recent,count:recent.length,median:null,low:null,high:null};
  const scores=recent.map(x=>x.score).sort((a,b)=>a-b);
  return {recent,count:recent.length,median:scores[1],low:scores[0],high:scores[2]};
}
function monthlyProgress(){
  const months=new Map();const localMonth=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  for(let offset=5;offset>=0;offset--){const date=new Date();date.setDate(1);date.setMonth(date.getMonth()-offset);const key=localMonth(date);months.set(key,{key,label:date.toLocaleDateString('en-US',{month:'short',year:'numeric'}),activeDays:0,activityDates:[],timed:new Map(),lessons:[],lessonChecks:[]});}
  for(const day of Object.keys(state.activity||{})){const row=months.get(day.slice(0,7));if(row&&Object.values(state.activity[day]||{}).some(count=>Number(count)>0)){row.activeDays++;row.activityDates.push({date:day,counts:state.activity[day]});}}
  const latestTimed=new Map();
  for(const attempt of state.amc?.attempts||[]){if(attempt.mode!=='timed'||!Number.isFinite(attempt.completedAt)||!Number.isFinite(attempt.score)||typeof attempt.examId!=='string')continue;const previous=latestTimed.get(attempt.examId);if(!previous||previous.completedAt<attempt.completedAt)latestTimed.set(attempt.examId,attempt);}
  for(const [examId,attempt] of latestTimed){const month=localMonth(new Date(attempt.completedAt)),row=months.get(month);if(row)row.timed.set(examId,attempt);}
  const latestLessonChecks=new Map();
  for(const entry of state.coach?.history||[]){if(entry.kind!=='lesson'||!Array.isArray(entry.lessonProgress?.attempts))continue;const lessonId=typeof entry.id==='string'?entry.id:`${entry.createdAt}:${entry.result?.lesson?.topic||''}`;for(const attempt of entry.lessonProgress.attempts){if(!Number.isFinite(attempt.at)||!Number.isInteger(attempt.correct)||attempt.correct<0||attempt.correct>3)continue;const previous=latestLessonChecks.get(lessonId);if(!previous||previous.at<attempt.at)latestLessonChecks.set(lessonId,{...attempt,lessonId,title:entry.result?.title||entry.result?.lesson?.topic||'Saved lesson'});}}
  for(const attempt of latestLessonChecks.values()){const row=months.get(localMonth(new Date(attempt.at)));if(row){row.lessons.push(attempt.correct);row.lessonChecks.push(attempt);}}
  const median=values=>{if(!values.length)return null;const ordered=[...values].sort((a,b)=>a-b),mid=Math.floor(ordered.length/2);return ordered.length%2?ordered[mid]:(ordered[mid-1]+ordered[mid])/2;};
  return [...months.values()].map(row=>({...row,timedScores:[...row.timed.values()].map(x=>x.score),timedMedian:median([...row.timed.values()].map(x=>x.score)),lessonMedian:median(row.lessons),paperCount:row.timed.size,lessonCount:row.lessons.length}));
}
function renderGoalTimeline(months,value,{selectId,outputId,label,scoreKey,countKey,minimumSamples,maximumScore,sampleLabel}){
  const result=ProgressionCore.estimate(months,value,{scoreKey,countKey,minimumSamples,maximumScore}),target=result.target,targetSelect=byId(selectId);
  if(targetSelect)targetSelect.value=String(target);
  const score=result.currentScore,progress=score===null?0:Math.max(0,Math.min(100,Math.round(score/target*100)));
  const shownScore=score===null?null:Number(score.toFixed(1));
  let heading,detail;
  if(result.status==='insufficient'){
    heading='Build a little more history';
    detail=`${result.evidenceMonths}/3 months include at least ${minimumSamples} ${sampleLabel} each. A directional estimate needs three qualifying months.`;
  }else if(result.status==='reached'){
    heading='Your recent median meets this goal';
    detail=`The latest qualifying monthly median is ${shownScore} / ${maximumScore}. Keep practicing to see whether it holds on new work.`;
  }else if(result.status==='unclear'){
    heading='No steady upward trend yet';
    detail='Monthly results are flat or uneven, so FORGE is not assigning a date. More practice may clarify the pattern.';
  }else if(result.status==='long-horizon'){
    heading='Outside the estimate window';
    detail='The current trend does not support a useful estimate within two years. Keep practicing; no longer-range date is shown.';
  }else{
    const range=result.fastMonths===result.slowMonths?`${result.fastMonths} month${result.fastMonths===1?'':'s'}`:`${result.fastMonths}–${result.slowMonths} months`;
    heading=`About ${range} at the recent trend`;
    detail=`Based on ${result.evidenceMonths} months with at least ${minimumSamples} ${sampleLabel} each. Difficulty and practice conditions vary, so this is a directional planning estimate.`;
  }
  byId(outputId).innerHTML=`<div class="progression-estimate-head"><div><span class="eyebrow">${esc(label)} · ${target} / ${maximumScore}</span><strong>${esc(heading)}</strong></div><span class="small-badge">${shownScore===null?'No score yet':`${shownScore} / ${target}`}</span></div><div class="timeline-track" role="progressbar" aria-label="Latest monthly median toward ${esc(label)} goal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="timeline-fill progression-fill" style="width:${progress}%"></div></div><p class="tiny muted">${esc(detail)}</p>`;
}
function renderProgressionEstimate(months){
  renderGoalTimeline(months,ProgressionCore.normalizeTarget(state.settings?.progressionTarget),{selectId:'progressionTarget',outputId:'progressionEstimate',label:'AMC 10 goal timeline',scoreKey:'timedMedian',countKey:'paperCount',minimumSamples:2,maximumScore:150,sampleLabel:'distinct timed papers'});
  renderGoalTimeline(months,ProgressionCore.normalizeLessonTarget(state.settings?.lessonTarget),{selectId:'lessonProgressionTarget',outputId:'lessonProgressionEstimate',label:'Lesson quiz goal timeline',scoreKey:'lessonMedian',countKey:'lessonCount',minimumSamples:3,maximumScore:3,sampleLabel:'distinct lesson quizzes'});
}
function renderSkillTimeline(){
  const months=monthlyProgress(),activeMonths=months.filter(x=>x.activeDays>0).length,scoreMonths=months.filter(x=>x.paperCount>0).length,lessonMonths=months.filter(x=>x.lessonCount>0).length;
  if(!months.some(month=>month.key===selectedTimelineMonth))selectedTimelineMonth=months.at(-1)?.key||'';
  const evidenceMonths=Math.max(activeMonths,scoreMonths,lessonMonths);byId('timelineConfidence').textContent=evidenceMonths>=4?'Multi-month record':evidenceMonths>=2?'Early history':'Starting history';
  byId('skillTimelineSummary').textContent=scoreMonths>=2&&lessonMonths>=2?`${scoreMonths} months include timed AMC papers and ${lessonMonths} include lesson quiz attempts. Goal estimates use separate evidence thresholds for each.`:scoreMonths>=2?`${scoreMonths} months include timed AMC papers. The separate lesson estimate uses quiz attempts and requires its own three-month evidence.`:lessonMonths>=2?`${lessonMonths} months include lesson quiz attempts. Add timed papers to build evidence for an AMC goal timeline.`:evidenceMonths>=2?`${evidenceMonths} months include recorded activity. Goal timelines need repeated timed-paper or lesson-check results.`:'A longer practice history will make this timeline more useful. Sparse results do not receive a goal date.';
  renderProgressionEstimate(months);
  byId('skillTimeline').innerHTML=months.map(month=>{
    const dayWidth=Math.round(month.activeDays/31*100),scoreWidth=month.timedMedian===null?0:Math.round(month.timedMedian/150*100),lessonWidth=month.lessonMedian===null?0:Math.round(month.lessonMedian/3*100);
    return `<article class="timeline-month ${month.key===selectedTimelineMonth?'selected':''}"><button class="timeline-month-select" data-timeline-month="${esc(month.key)}" aria-pressed="${month.key===selectedTimelineMonth}" aria-controls="timelineDetails" aria-label="View ${esc(month.label)} evidence"><span class="timeline-month-head"><strong>${esc(month.label)}</strong><span class="tiny">View evidence →</span></span></button><div class="timeline-metric"><div class="row"><span>Practice days</span><span>${month.activeDays}</span></div><div class="timeline-track"><div class="timeline-fill activity-fill" style="width:${dayWidth}%"></div></div></div><div class="timeline-metric"><div class="row"><span>Timed AMC median</span><span>${month.timedMedian===null?'—':`${month.timedMedian} / 150 · ${month.paperCount} paper${month.paperCount===1?"":"s"}`}</span></div><div class="timeline-track"><div class="timeline-fill score-fill" style="width:${scoreWidth}%"></div></div></div><div class="timeline-metric"><div class="row"><span>Lesson quiz median</span><span>${month.lessonMedian===null?'—':`${month.lessonMedian} / 3 · ${month.lessonCount} quiz${month.lessonCount===1?"":"zes"}`}</span></div><div class="timeline-track"><div class="timeline-fill lesson-fill" style="width:${lessonWidth}%"></div></div></div></article>`;
  }).join('');
  renderTimelineEvidence(months);
}
function renderTimelineEvidence(months=monthlyProgress()){
  const month=months.find(item=>item.key===selectedTimelineMonth),panel=byId('timelineDetails');if(!month||!panel)return;
  const activityOpen=panel.dataset.month===month.key&&byId('timelineActivityDetails')?.open;
  panel.dataset.month=month.key;
  const dateText=at=>new Date(at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const papers=[...month.timed.entries()].sort((a,b)=>b[1].completedAt-a[1].completedAt);
  const lessons=[...month.lessonChecks].sort((a,b)=>b.at-a.at);
  const paperRows=papers.map(([id,item])=>`<li><div><strong>${esc(timelineExamNames.get(id)||id)}</strong><span>${esc(dateText(item.completedAt))}</span></div><b>${esc(item.score)} / 150</b></li>`).join('');
  const lessonRows=lessons.map(item=>`<li><div><strong>${esc(item.title)}</strong><span>${esc(dateText(item.at))}</span></div><b>${item.correct} / 3</b></li>`).join('');
  const activityNames={task:['task completed','tasks completed'],code:['coding mark','coding marks'],practice:['practice attempt','practice attempts'],math:['correct math answer','correct math answers'],review:['review','reviews'],lesson:['lesson','lessons'],focus:['focus session','focus sessions']};
  const activityRows=[...month.activityDates].sort((a,b)=>b.date.localeCompare(a.date)).map(item=>{
    const events=Object.entries(item.counts).filter(([,count])=>Number(count)>0).map(([kind,count])=>`${count} ${(activityNames[kind]||['other recorded event','other recorded events'])[Number(count)===1?0:1]}`);
    return `<li><strong>${esc(fmtDate(item.date))}</strong><span>${esc(events.join(' · '))}</span></li>`;
  }).join('');
  const selectionStatus=byId('timelineSelectionStatus'),announcement=`${month.label} selected: ${month.paperCount} timed paper result${month.paperCount===1?'':'s'}, ${month.lessonCount} lesson check result${month.lessonCount===1?'':'s'} and ${month.activeDays} recorded active day${month.activeDays===1?'':'s'}.`;
  if(selectionStatus&&selectionStatus.textContent!==announcement)selectionStatus.textContent=announcement;
  panel.innerHTML=`<div class="section-head wrap"><h3 id="timelineDetailHeading">${esc(month.label)} evidence</h3><span class="small-badge">Latest distinct results</span></div>
    <p class="tiny muted">${month.paperCount} timed paper${month.paperCount===1?'':'s'} · ${month.lessonCount} lesson check${month.lessonCount===1?'':'s'} · ${month.activeDays} recorded active day${month.activeDays===1?'':'s'}</p>
    <div class="timeline-evidence-grid"><section><h4>Timed AMC papers</h4><p class="tiny muted">At least two distinct papers make a month count toward the AMC goal estimate.</p><ul class="timeline-evidence-list" id="timelineTimedRecords">${paperRows||'<li class="timeline-evidence-empty">No distinct timed-paper results in this month.</li>'}</ul></section><section><h4>Lesson checks</h4><p class="tiny muted">At least three distinct saved lessons make a month count toward the lesson goal estimate.</p><ul class="timeline-evidence-list" id="timelineLessonRecords">${lessonRows||'<li class="timeline-evidence-empty">No distinct lesson-check results in this month.</li>'}</ul></section></div>
    <details id="timelineActivityDetails" ${activityOpen?'open':''}><summary>Recorded activity days (${month.activeDays})</summary><ul class="timeline-activity-list">${activityRows||'<li>No activity recorded in this month.</li>'}</ul></details>
    <p class="tiny muted">Each paper and saved lesson contributes its latest result once. A retake replaces the earlier result and may move it to a different month. Untimed practice and manually logged mock scores do not enter the AMC median. These are local practice records, not verified ability ratings.</p>`;
}
function selectTimelineMonth(key){
  const months=monthlyProgress();if(!months.some(month=>month.key===key))return;
  selectedTimelineMonth=key;
  document.querySelectorAll('[data-timeline-month]').forEach(button=>{const selected=button.dataset.timelineMonth===key;button.setAttribute('aria-pressed',String(selected));button.closest('.timeline-month').classList.toggle('selected',selected)});
  renderTimelineEvidence(months);
}
function renderFocusHistory(){
  const history=state.focus.history,completed=history.filter(item=>item.status==='completed');
  const totalSeconds=completed.reduce((sum,item)=>sum+item.actualSeconds,0),interruptions=completed.reduce((sum,item)=>sum+item.interruptions,0);
  byId('focusSessionCount').textContent=`${completed.length} completed`;
  byId('focusSummary').textContent=completed.length?`${Math.round(totalSeconds/60)} focused minutes across ${completed.length} completed session${completed.length===1?'':'s'} · ${interruptions} interruption${interruptions===1?'':'s'} during those sessions.`:'0 completed sessions · 0 focused minutes. Ending a session early keeps it in the history but excludes it from completed totals.';
  byId('focusHistory').innerHTML=history.length?[...history].reverse().slice(0,8).map(item=>{
    const mins=Math.floor(item.actualSeconds/60),seconds=item.actualSeconds%60,duration=mins?`${mins} min${seconds?` ${seconds} sec`:''}`:`${seconds} sec`;
    const status=item.status==='completed'?'Completed':'Ended early';
    return `<div class="focus-history-row"><div><strong>${esc(item.taskTitle||'Unlinked focus session')}</strong><div class="tiny muted">${new Date(item.startedAt).toLocaleDateString()} · ${status}</div></div><div class="focus-history-meta"><strong>${duration}</strong><div class="tiny muted">${item.interruptions} interruption${item.interruptions===1?'':'s'}</div></div></div>`;
  }).join(''):'<div class="empty">No focus sessions recorded yet.</div>';
}
function renderInsights(){
  const done=state.tasks.filter(x=>x.done).length,math=state.mathAttempts.length,code=Object.values(state.codeDone).filter(Boolean).length,master=state.mistakes.filter(x=>x.stage===3).length,lessonEntries=state.coach.history.filter(x=>x.kind==='lesson'&&x.result?.lesson),lessons=lessonEntries.filter(x=>x.lessonProgress?.completedAt).length;
  byId('insightsMetrics').innerHTML=[['Missions completed',done],['Code challenges',code],['Math attempts',math],['Lessons completed',lessons],['Errors mastered',master]].map(x=>`<div class="card metric"><div class="eyebrow">${x[0]}</div><div class="value">${x[1]}</div></div>`).join('');
  renderFocusHistory();
  const streak=streakStats();byId('longestStreak').textContent=`Longest: ${streak.longest} day${streak.longest===1?'':'s'}`;
  byId('streakSummary').innerHTML=`<div class="streak-number">${streak.current}<span>${streak.current===1?'day':'days'}</span></div><p class="tiny muted">Current recorded activity streak. Practice a question, finish a mission or focus session, complete a lesson check or review, or mark a coding challenge to keep it going.</p><p class="tiny muted">${streak.activeDays} active calendar day${streak.activeDays===1?'':'s'} recorded on this device.</p>`;
  const forecast=timedScoreEstimate();
  renderSkillTimeline();
  byId('forecastSummary').innerHTML=forecast.median===null?`<div class="forecast-empty"><strong>${forecast.count}/3 distinct timed papers logged</strong><p class="tiny muted">Complete timed AMC 10 past papers to build a local score range. Untimed practice and manual mock entries are not used.</p><button class="btn sm" data-go="math">Choose a past paper →</button></div>`:`<div class="forecast-number">${forecast.median}<span> / 150 recent median</span></div><p class="tiny muted">Your last three distinct timed papers ranged from ${forecast.low} to ${forecast.high} points. This is a short-history estimate, not a promise or a prediction of a future contest score.</p><div class="forecast-papers">${forecast.recent.map(x=>`<span class="small-badge">${esc(window.AMCController?.examTitle(x.examId)||x.examId)} · ${x.score}</span>`).join('')}</div>`;
  const timed=state.amc.attempts.filter(x=>x.mode==='timed'),best=timed.length?Math.max(...timed.map(x=>x.score)):0,masteredCount=master+state.amc.reviews.filter(x=>x.stage===3).length+lessonEntries.filter(x=>x.lessonProgress?.reviewStage>=3).length;
  const achievements=[
    ['First real paper',state.amc.attempts.length>0,`${state.amc.attempts.length} past-paper attempts`],
    ['Three timed papers',new Set(timed.map(x=>x.examId)).size>=3,`${new Set(timed.map(x=>x.examId)).size}/3 distinct timed exams`],
    ['100-point paper',best>=100,best?`Best timed score: ${best}/150`:'Complete a timed paper to start'],
    ['120-point paper',best>=120,best?`Best timed score: ${best}/150`:'Complete a timed paper to start'],
    ['First lesson check',lessons>0,`${lessons} lesson quiz${lessons===1?'':'zes'} completed`],
    ['Review mastery',masteredCount>0,`${masteredCount} review path${masteredCount===1?'':'s'} mastered`],
    ['Seven active days',streak.longest>=7,`${streak.longest}/7 consecutive recorded days`],
    ['30-day streak',streak.longest>=30,`${Math.min(streak.longest,30)}/30 consecutive recorded days`],
    ['100-day streak',streak.longest>=100,`${Math.min(streak.longest,100)}/100 consecutive recorded days`],
    ['10 completed missions',done>=10,`${Math.min(done,10)}/10 completed`]
  ];
  byId('achievementGrid').innerHTML=achievements.map(([name,unlocked,detail])=>`<div class="achievement ${unlocked?'unlocked':''}"><div class="achievement-icon" aria-hidden="true">${unlocked?'✓':'○'}</div><div><strong>${name}</strong><p>${esc(detail)}</p></div><span class="small-badge">${unlocked?'Earned':'In progress'}</span></div>`).join('');
  const days=Array.from({length:7},(_,i)=>dateAdd(todayKey(),i-6));const values=days.map(d=>{const a=state.activity[d]||{};return (a.task||0)+(a.code||0)+(a.practice||0)+(a.math||0)+(a.review||0)+(a.lesson||0)+(a.focus||0)}),max=Math.max(4,...values);byId('activityChart').innerHTML=days.map((d,i)=>`<div class="group"><strong class="tiny muted">${values[i]||''}</strong><div class="bar" style="height:${Math.max(4,Math.round(values[i]/max*109))}px"></div><span>${fmtDate(d,{weekday:'short'})}</span></div>`).join('');
  const categories=['Coding','Math','Competition'];byId('focusAreas').innerHTML=categories.map(cat=>{const x=state.tasks.filter(t=>t.category===cat),n=x.filter(t=>t.done).length,rate=x.length?Math.round(100*n/x.length):0;return `<div style="margin:17px 0"><div class="row"><strong>${cat}</strong><span class="tiny muted">${n}/${x.length} missions</span></div><div class="progress" style="margin-top:8px"><div class="fill" style="width:${rate}%"></div></div></div>`}).join('');
window.DashboardUI?.refresh();
}
function renderAll(){applyTheme();renderToday();renderFocusTaskOptions();renderFocusSession();renderPlan();renderProjects();renderCoding();renderMath();renderContests();renderAoc();renderCodeforces();renderMistakes();renderInsights();window.AMCController?.render();window.CoachUI?.refresh();window.LessonsUI?.refresh();window.OnboardingUI?.refresh();window.SchoolUI?.refresh();window.SparkLabUI?.render()}
function go(view){const code=byId('codeEditor');if(code)saveCode(false);document.querySelectorAll('.tab').forEach(x=>{const active=x.dataset.view===view;x.classList.toggle('active',active);if(active)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});document.querySelectorAll('.nav-more').forEach(group=>{group.open=Boolean(group.querySelector('.tab.active'))});document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+view));if(view==='today')window.DashboardUI?.refresh();window.scrollTo({top:0,behavior:'instant'});}
function trapDialogTab(dialog,event){
  if(event.key!=='Tab')return;
  const controls=Array.from(dialog.querySelectorAll('button,input:not([type="hidden"]),select,textarea,a[href],[tabindex]:not([tabindex="-1"])')).filter(control=>!control.disabled&&!control.hidden&&control.getClientRects().length);
  const first=controls[0],last=controls.at(-1);if(!first)return;
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
function openModal(title,html){
  const dialog=byId('modalCover');if(!dialog.open)modalReturnTarget=document.activeElement;
  modalAfterClose=null;byId('modalTitle').textContent=title;byId('modalBody').innerHTML=html;
  document.documentElement.classList.add('app-modal-open');if(!dialog.open)dialog.showModal();
  (byId('modalBody').querySelector('input,select,textarea,button')||byId('closeModal')).focus();
}
function closeModal(afterClose=null){const dialog=byId('modalCover');if(!dialog.open)return;modalAfterClose=typeof afterClose==='function'?afterClose:null;dialog.close()}
function focusTaskControl(taskId,viewId,attribute='taskEdit'){
  const view=byId(viewId),target=Array.from(view?.querySelectorAll(attribute==='taskEdit'?'[data-task-edit]':'[data-task-check]')||[]).find(item=>item.dataset[attribute]===taskId);
  target?.focus({preventScroll:true});
}
function editTask(taskId){
  const task=state.tasks.find(item=>item.id===taskId);if(!task)return;const viewId=document.querySelector('.view.active')?.id;
  openModal('Edit mission',`<form id="taskForm" class="form-grid"><div class="field full"><label for="taskName">Mission name</label><input id="taskName" maxlength="300" value="${esc(task.name)}" required></div><div class="field"><label for="taskCat">Subject</label><select id="taskCat">${['Coding','Math','Competition'].map(category=>`<option ${category===task.category?'selected':''}>${category}</option>`).join('')}</select></div><div class="field"><label for="taskMins">Minutes</label><input type="number" id="taskMins" min="1" max="300" value="${task.minutes}" required></div><div class="field full"><label for="taskDate">Date</label><input id="taskDate" type="date" value="${esc(task.date)}" required></div><button class="btn primary" type="submit">Save mission</button></form>`);
  byId('taskForm').onsubmit=event=>{event.preventDefault();const name=byId('taskName').value.trim(),date=byId('taskDate').value,minutes=Number(byId('taskMins').value),category=byId('taskCat').value;if(!name||!date||!Number.isInteger(minutes)||minutes<1||minutes>300||!['Coding','Math','Competition'].includes(category))return;Object.assign(task,{name,date,minutes,category});save();closeModal(()=>{renderAll();focusTaskControl(task.id,viewId);toast('Mission updated.')})};
}
function createTask(){openModal('Create a mission',`<form id="taskForm" class="form-grid"><div class="field full"><label for="taskName">Mission name</label><input id="taskName" maxlength="120" required placeholder="e.g. Solve a Codeforces div. 3 problem"></div><div class="field"><label for="taskCat">Subject</label><select id="taskCat"><option>Coding</option><option>Math</option><option>Competition</option></select></div><div class="field"><label for="taskMins">Minutes</label><input type="number" id="taskMins" min="5" max="300" value="30" required></div><div class="field full"><label for="taskDate">Date</label><input id="taskDate" type="date" required value="${todayKey()}"></div><div class="full"><button class="btn primary" type="submit">Add mission</button></div></form>`);byId('taskForm').onsubmit=e=>{e.preventDefault();const name=byId('taskName').value.trim(),date=byId('taskDate').value,minutes=Number(byId('taskMins').value);if(!name||!date||!(minutes>=5&&minutes<=300))return;state.tasks.push({id:'task-'+Date.now(),name,category:byId('taskCat').value,date,minutes,done:false});save();closeModal();renderAll();toast('Mission added!')}}
function createContest(){openModal('Add a competition',`<form id="contestForm" class="form-grid"><div class="field full"><label for="contestName">Competition name</label><input id="contestName" placeholder="USACO, Codeforces, AMC..." maxlength="75" required></div><div class="field"><label for="contestDate">Contest date</label><input id="contestDate" type="date" required value="${todayKey()}"></div><div class="field"><label for="contestKind">Type</label><select id="contestKind"><option>Math</option><option>Coding</option><option>Other</option></select></div><div class="full"><button class="btn primary" type="submit">Add competition</button></div></form>`);byId('contestForm').onsubmit=e=>{e.preventDefault();const name=byId('contestName').value.trim();if(!name)return;state.contests.push({id:'contest-'+Date.now(),name,date:byId('contestDate').value,kind:byId('contestKind').value});save();closeModal();renderAll();toast('Competition added!')}}
function logMock(){openModal('Log an AMC 10 mock',`<form id="mockForm" class="form-grid"><div class="field full"><label for="mockName">Test name</label><input id="mockName" placeholder="e.g. 2021 AMC 10A" maxlength="75" required></div><div class="field"><label for="mockCorrect">Correct answers</label><input type="number" id="mockCorrect" min="0" max="25" value="0" required></div><div class="field"><label for="mockWrong">Wrong answers</label><input type="number" id="mockWrong" min="0" max="25" value="0" required></div><div class="field full"><label for="mockDate">Date taken</label><input type="date" id="mockDate" value="${todayKey()}" required></div><div class="full"><p class="tiny muted">Blank answers = 25 − correct − wrong. Score = 6×correct + 1.5×blank.</p><div id="mockError" class="tiny" style="color:var(--red)"></div><button class="btn primary" type="submit">Save mock score</button></div></form>`);byId('mockForm').onsubmit=e=>{e.preventDefault();const c=Number(byId('mockCorrect').value),w=Number(byId('mockWrong').value),b=25-c-w;if(!Number.isInteger(c)||!Number.isInteger(w)||c<0||w<0||b<0){byId('mockError').textContent='Correct + wrong must be at most 25.';return}state.mocks.push({name:byId('mockName').value.trim(),date:byId('mockDate').value,correct:c,wrong:w,blank:b,score:6*c+1.5*b});save();closeModal();renderAll();toast('Mock score saved!')}}
// Delegate app actions so widgets still work after rendering.
document.addEventListener('click',e=>{const goBtn=e.target.closest('[data-go]');if(goBtn){go(goBtn.dataset.go);return}const tab=e.target.closest('[data-view]');if(tab){go(tab.dataset.view);return}const del=e.target.closest('[data-task-delete]');if(del){const id=del.dataset.taskDelete;if(confirm('Remove this mission?')){state.tasks=state.tasks.filter(t=>t.id!==id);save();renderAll()}return}const challenge=e.target.closest('[data-code]');if(challenge){saveCode(false);selectedCode=challenge.dataset.code;renderCoding();return}const redo=e.target.closest('[data-redo]');if(redo){reviewModal(redo.dataset.redo);return}const contest=e.target.closest('[data-contest-delete]');if(contest){if(confirm('Remove this competition?')){state.contests=state.contests.filter(c=>c.id!==contest.dataset.contestDelete);save();renderAll()}return}});
document.addEventListener('click',e=>{const vote=e.target.closest('[data-project-vote]');if(vote){const id=vote.dataset.projectVote;state.projects.votes[id]=!state.projects.votes[id];save();renderProjects();return}const project=e.target.closest('[data-project-add]');if(project){const item=ProjectCore.catalog.find(x=>x.id===project.dataset.projectAdd);if(item)addProjectMission({...item,kind:'Project'});return}const idea=e.target.closest('[data-project-idea-add]');if(idea){const item=state.projects.proposals.find(x=>x.id===idea.dataset.projectIdeaAdd);if(item)addProjectMission(item);return}const remove=e.target.closest('[data-project-idea-delete]');if(remove){state.projects.proposals=state.projects.proposals.filter(x=>x.id!==remove.dataset.projectIdeaDelete);save();renderProjects();return}});
document.addEventListener('click',e=>{const track=e.target.closest('[data-codeforces-track]');if(track){trackCodeforcesContest(track.dataset.codeforcesTrack);return}const open=e.target.closest('[data-codeforces-open]');if(open){const contest=codeforcesSchedule?.contests.find(x=>String(x.id)===open.dataset.codeforcesOpen);if(contest)window.forgeDesktop.coachOpenSource(contest.url).catch(()=>toast('Could not open the official Codeforces page.'));}});
document.addEventListener('click',e=>{
  const open=e.target.closest('[data-training-open]');if(open){const item=TrainingCore.item(open.dataset.trainingOpen);if(item)window.forgeDesktop.coachOpenSource(item.url).catch(()=>toast('Could not open the official problem page.'));return;}
  const mark=e.target.closest('[data-training-done]');if(mark){const item=TrainingCore.item(mark.dataset.trainingDone);if(!item)return;const wasDone=TrainingCore.normalize(state.training).completed[item.id]===true;state.training=TrainingCore.setDone(state.training,item.id,!wasDone);if(!wasDone)addActivity('practice');save();renderTrainingPaths();renderInsights();return;}
  const add=e.target.closest('[data-training-plan]');if(add){const item=TrainingCore.item(add.dataset.trainingPlan);if(!item)return;const id=`training-${item.id}`;if(!state.tasks.some(task=>task.id===id)){state.tasks.push({id,name:`Practice: ${item.title}`,category:'Coding',date:todayKey(),minutes:item.minutes,done:false});save();renderAll();toast('Problem added to today’s plan.');}return;}
});
document.addEventListener('click',e=>{const star=e.target.closest('[data-aoc-star]');if(star){const day=Number(star.dataset.aocStar),current=AocCore.stats(state.aoc,state.aoc.selectedYear).days[String(day)]||0;state.aoc=AocCore.setStars(state.aoc,state.aoc.selectedYear,day,(current+1)%3);save();renderAoc();return}const day=e.target.closest('[data-aoc-open]');if(day){const year=state.aoc.selectedYear;window.forgeDesktop.coachOpenSource(`https://adventofcode.com/${year}/day/${day.dataset.aocOpen}`).catch(()=>toast('Could not open the official Advent of Code page.'));}});
document.addEventListener('change',e=>{if(e.target.matches('[data-task-check]')){const t=state.tasks.find(x=>x.id===e.target.dataset.taskCheck);if(!t)return;const viewId=e.target.closest('.view')?.id,before=t.done;t.done=e.target.checked;if(!before&&t.done)addActivity('task');save();renderAll();focusTaskControl(t.id,viewId,'taskCheck');window.ProjectPlannerUI?.announceTask(t.id)}});
document.addEventListener('click',event=>{const button=event.target.closest('[data-task-edit]');if(button)editTask(button.dataset.taskEdit)});
byId('closeModal').onclick=()=>closeModal();byId('modalCover').onclick=e=>{if(e.target===byId('modalCover'))closeModal()};
byId('modalCover').addEventListener('keydown',event=>trapDialogTab(byId('modalCover'),event));
byId('modalCover').addEventListener('close',()=>{
  document.documentElement.classList.remove('app-modal-open');const after=modalAfterClose,target=modalReturnTarget;modalAfterClose=null;modalReturnTarget=null;
  if(after){after();return;}
  if(target?.isConnected&&target.getClientRects().length&&!target.disabled)target.focus({preventScroll:true});else document.querySelector('.tab.active')?.focus();
});
byId('addTaskToday').onclick=createTask;byId('addTaskPlan').onclick=createTask;byId('addContest').onclick=createContest;byId('logMock').onclick=logMock;
byId('taskFilter').onchange=renderPlan;
byId('codeFilter').onchange=renderCoding;
byId('trainingProvider').onchange=renderTrainingPaths;
byId('trainingLevel').onchange=renderTrainingPaths;
byId('languageGuideSelect').onchange=renderLanguageGuide;
byId('themeSelect').onchange=()=>{state.settings.theme=byId('themeSelect').value;save();applyTheme()};
byId('progressionTarget').onchange=()=>{state.settings.progressionTarget=ProgressionCore.normalizeTarget(Number(byId('progressionTarget').value));save();renderSkillTimeline()};
document.addEventListener('click',event=>{const button=event.target.closest('[data-timeline-month]');if(button)selectTimelineMonth(button.dataset.timelineMonth)});
byId('lessonProgressionTarget').onchange=()=>{state.settings.lessonTarget=ProgressionCore.normalizeLessonTarget(Number(byId('lessonProgressionTarget').value));save();renderSkillTimeline()};
byId('aocYear').onchange=()=>{state.aoc=AocCore.normalize({...state.aoc,selectedYear:Number(byId('aocYear').value)});save();renderAoc()};
byId('aocOpenHome').onclick=()=>window.forgeDesktop.coachOpenSource('https://adventofcode.com/').catch(()=>toast('Could not open Advent of Code.'));
byId('mathFilter').onchange=()=>{const topic=byId('mathFilter').value;selectedQuestion=questions.find(x=>topic==='all'||x.topic===topic).id;mathRevealed=false;mathChosen=null;renderMathQuestion()};
byId('codeforcesRefresh').onclick=loadCodeforces;
byId('projectPreferenceForm').onsubmit=e=>{e.preventDefault();state.projects.preferences={track:byId('projectTrack').value,level:byId('projectExperience').value,purpose:byId('projectPurpose').value};byId('projectIdeaTrack').value=state.projects.preferences.track;byId('projectIdeaLevel').value=state.projects.preferences.level;save();renderProjects();toast('Project preferences saved on this device.')};
byId('projectIdeaLevel').onchange=()=>{const prefs=state.projects.preferences,selected=ProjectCore.LEVELS.indexOf(byId('projectIdeaLevel').value),available=ProjectCore.LEVELS.indexOf(prefs?.level||'Beginner'),gate=!prefs?'Save your project preferences first.':selected>available?`Your saved experience level is ${prefs.level}. Choose an idea at or below that level.`:'';byId('saveProjectIdea').disabled=Boolean(gate);byId('projectIdeaStatus').textContent=gate||'Ideas are private and stay on this device.'};
byId('projectIdeaForm').onsubmit=e=>{e.preventDefault();const prefs=state.projects.preferences,level=byId('projectIdeaLevel').value,title=byId('projectIdeaTitle').value.trim(),description=byId('projectIdeaDescription').value.trim();if(!prefs){byId('projectIdeaStatus').textContent='Save your project preferences first.';return}if(ProjectCore.LEVELS.indexOf(level)>ProjectCore.LEVELS.indexOf(prefs.level)){byId('projectIdeaStatus').textContent=`Choose an idea at or below your self-rated ${prefs.level} level.`;return}if(!title||!description||state.projects.proposals.length>=50)return;state.projects.proposals.unshift({id:`idea-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,kind:byId('projectIdeaKind').value,title:title.slice(0,100),description:description.slice(0,500),track:byId('projectIdeaTrack').value,level,createdAt:Date.now()});save();byId('projectIdeaTitle').value='';byId('projectIdeaDescription').value='';renderProjects();toast('Idea saved privately on this device.')};
let focusTimerHandle=null,focusPauseReason='',focusModeSessionId=null;
function renderFocusTaskOptions(){
  const select=byId('focusTaskSelect');if(!select)return;
  const active=state.focus.active,selected=active?(active.taskId||''):select.value;
  const tasks=state.tasks.filter(task=>!task.done).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
  const options=['<option value="">No linked mission</option>',...tasks.map(task=>`<option value="${esc(task.id)}">${esc(task.name)} · ${fmtDate(task.date)}</option>`)];
  if(active?.taskId&&!tasks.some(task=>task.id===active.taskId))options.push(`<option value="${esc(active.taskId)}">${esc(active.taskTitle||'Saved mission')}</option>`);
  select.innerHTML=options.join('');select.value=selected;
}
function syncFocusDurationOptions(){
  const select=byId('timerLength'),active=state.focus.active,task=state.tasks.find(item=>item.id===byId('focusTaskSelect').value);
  const previous=Number(select.value)||25,wasMission=select.selectedOptions[0]?.hasAttribute('data-mission-duration');
  select.querySelectorAll('[data-mission-duration]').forEach(option=>option.remove());
  const minutes=active?.plannedMinutes??task?.minutes,valid=Number.isInteger(minutes)&&minutes>=1&&minutes<=180;
  if(valid&&![25,40,75].includes(minutes)){const option=document.createElement('option');option.value=String(minutes);option.textContent=`${minutes} min (${active&&!task?'saved session':'mission'})`;option.setAttribute('data-mission-duration','');select.append(option);}
  const chosen=active?active.plannedMinutes:wasMission&&valid?minutes:previous;
  select.value=Array.from(select.options).some(option=>Number(option.value)===chosen)?String(chosen):'25';
}
function selectPlannedFocusDuration(){
  if(state.focus.active)return;
  syncFocusDurationOptions();const task=state.tasks.find(item=>item.id===byId('focusTaskSelect').value);
  if(task&&Number.isInteger(task.minutes)&&task.minutes>=1&&task.minutes<=180)byId('timerLength').value=String(task.minutes);
  renderFocusSession();
}
function renderFocusSession(){
  syncFocusDurationOptions();
  const active=state.focus.active,readout=byId('timerReadout'),toggle=byId('timerToggle'),end=byId('timerReset'),duration=byId('timerLength'),task=byId('focusTaskSelect');
  const seconds=active?FocusCore.remaining(active):Number(duration.value)*60;
  readout.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  toggle.textContent=!active?'Start session':active.running?'Pause':'Resume';end.disabled=!active;
  byId('focusModeOpen').hidden=!active;
  duration.disabled=Boolean(active);task.disabled=Boolean(active);
  if(active){
    duration.value=String(active.plannedMinutes);
    const label=active.taskTitle?` · ${active.taskTitle}`:'';
    byId('focusStatus').textContent=active.running?`In progress${label} · ${active.interruptions} interruption${active.interruptions===1?'':'s'}. Leaving FORGE pauses the timer.`:`${focusPauseReason||'Paused'}${label} · ${active.interruptions} interruption${active.interruptions===1?'':'s'}. Resume when ready.`;
  }else byId('focusStatus').textContent='Choose an optional mission. Start a session to open focus mode. If FORGE loses focus, the timer pauses and records one interruption. Only this window’s focus state is observed; FORGE does not monitor screens, keystrokes or other apps.';
  renderFocusMode();
}
function renderFocusMode(){
  const actionHadFocus=['focusModeToggle','focusModeEnd'].includes(document.activeElement?.id);
  const active=state.focus.active,finished=state.focus.history.find(item=>item.id===focusModeSessionId),session=active||finished;
  const planned=(session?.plannedMinutes||25)*60,seconds=active?FocusCore.remaining(active):Math.max(0,planned-(finished?.actualSeconds||0));
  const elapsed=planned-seconds,percent=Math.min(100,Math.max(0,Math.round(elapsed/planned*100)));
  byId('focusModeTask').textContent=session?.taskTitle||'Independent focus session';
  byId('focusModeTimer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  byId('focusModeProgress').setAttribute('aria-valuenow',String(percent));
  byId('focusModeProgressFill').style.width=percent+'%';
  byId('focusModeProgressText').textContent=`${percent}% of ${session?.plannedMinutes||25} minutes · ${session?.interruptions||0} interruption${session?.interruptions===1?'':'s'}`;
  byId('focusModeBadge').textContent=active?(active.running?'Session in progress':'Session paused'):finished?.status==='completed'?'Session complete':'Session ended';
  byId('focusModeTitle').textContent=active?'One thing at a time.':finished?.status==='completed'?'Session complete.':'Session ended early.';
  byId('focusModeDescription').textContent=active?'Work on the session you chose. Leaving FORGE pauses the timer.':finished?.status==='completed'?'Your completed session is saved in Insights. Take a short break before choosing what comes next.':'Your session is saved in Insights and excluded from completed focus totals.';
  const message=active?(active.running?'Timer running. You can pause at any time.':`${focusPauseReason||'Paused'}. Resume when ready.`):'Another session will start only when you choose it.';
  if(byId('focusModeState').textContent!==message)byId('focusModeState').textContent=message;
  byId('focusModeToggle').textContent=active?.running?'Pause':'Resume';
  byId('focusModeToggle').hidden=!active;byId('focusModeEnd').hidden=!active;byId('focusModeDone').hidden=Boolean(active);
  if(!active&&byId('focusModeDialog').open&&actionHadFocus)byId('focusModeDone').focus();
}
function openFocusMode(){
  if(!state.focus.active)return;
  focusModeSessionId=state.focus.active.id;renderFocusMode();
  const dialog=byId('focusModeDialog');document.documentElement.classList.add('focus-mode-open');if(!dialog.open)dialog.showModal();
  byId('focusModeToggle').focus();
}
function restoreFocusModeFocus(){document.documentElement.classList.remove('focus-mode-open');const target=byId('focusModeOpen').hidden?byId('timerReadout'):byId('focusModeOpen');if(document.activeElement!==target)target.focus()}
function closeFocusMode(){const dialog=byId('focusModeDialog');if(dialog.open){dialog.close();restoreFocusModeFocus()}}
function stopFocusTicker(){clearInterval(focusTimerHandle);focusTimerHandle=null}
function updateFocusSession(){
  const active=state.focus.active;if(!active?.running){stopFocusTicker();return}
  const now=Date.now(),left=FocusCore.remaining(active,now);
  if(left<=0){state.focus=FocusCore.finish(state.focus,'completed',now);addActivity('focus');save();focusPauseReason='';stopFocusTicker();renderAll();toast('Focus session complete! 🎉');return}
  if(left!==active.remainingSeconds){state.focus=FocusCore.checkpoint(state.focus,now);save();}
  renderFocusSession();
}
function startFocusTicker(){stopFocusTicker();focusTimerHandle=setInterval(updateFocusSession,250)}
function pauseFocusSession(interruption=false,reason=''){
  if(!state.focus.active?.running)return;
  const now=Date.now();state.focus=FocusCore.pause(state.focus,now,interruption);stopFocusTicker();
  if(state.focus.active.remainingSeconds===0){state.focus=FocusCore.finish(state.focus,'completed',now);addActivity('focus');toast('Focus session complete! 🎉');}
  focusPauseReason=interruption?'The timer paused when FORGE lost window focus':reason;save();renderAll();
}
function toggleFocusSession(){
  const active=state.focus.active;
  if(active?.running){pauseFocusSession(false,'Paused by you');return}
  if(active){state.focus=FocusCore.resume(state.focus,Date.now());focusPauseReason='';save();renderFocusSession();startFocusTicker();return}
  const minutes=Number(byId('timerLength').value),taskId=byId('focusTaskSelect').value,task=state.tasks.find(item=>item.id===taskId);
  state.focus=FocusCore.start(state.focus,{durationMinutes:minutes,taskId:task?.id||null,taskTitle:task?.name||''},Date.now());
  focusPauseReason='';save();renderFocusSession();startFocusTicker();
}
function endFocusSession(){
  if(!state.focus.active)return;
  const now=Date.now();state.focus=FocusCore.finish(state.focus,'stopped',now);focusPauseReason='';stopFocusTicker();save();renderAll();toast('Focus session saved in your history.');
}
byId('timerLength').onchange=()=>renderFocusSession();
byId('focusTaskSelect').onchange=selectPlannedFocusDuration;
byId('timerToggle').onclick=toggleFocusSession;
byId('timerReset').onclick=endFocusSession;
byId('focusModeOpen').onclick=openFocusMode;
byId('focusModeExit').onclick=closeFocusMode;
byId('focusModeDone').onclick=closeFocusMode;
byId('focusModeToggle').onclick=toggleFocusSession;
byId('focusModeEnd').onclick=endFocusSession;
byId('focusModeDialog').addEventListener('close',restoreFocusModeFocus);
byId('focusModeDialog').addEventListener('cancel',event=>{event.preventDefault();closeFocusMode()});
byId('focusModeDialog').addEventListener('keydown',event=>trapDialogTab(byId('focusModeDialog'),event));
window.addEventListener('blur',()=>pauseFocusSession(true,'Paused when FORGE lost window focus'));
window.addEventListener('focus',()=>{if(state.focus.active&&!state.focus.active.running)renderFocusSession()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseFocusSession(true,'Paused when FORGE left the foreground')});
byId('exportData').onclick=async()=>{
  saveCode(false);
  try{const saved=await window.forgeDesktop.exportBackup(JSON.stringify(state,null,2));if(saved)toast('Backup saved.');}
  catch{toast('Could not save backup. Try another location.');}
};
window.addEventListener('forge-export',()=>byId('exportData').click());
byId('importData').onclick=()=>byId('importFile').click();
byId('importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error('Backup is larger than 5 MB');const obj=normalizeBackup(JSON.parse(await f.text()));if(!confirm('Replace your current local data with this backup?'))return;stopFocusTicker();state=obj;if(state.focus.active?.running)state.focus=FocusCore.recover(state.focus);state.codeDone||={};state.codeNotes||={};state.activity||={};state.mocks||=[];focusPauseReason='Restored focus session is paused';save();renderAll();toast('Backup imported successfully.')}catch(err){toast('Could not import: '+err.message)}finally{e.target.value=''}};
byId('resetData').onclick=()=>{if(confirm('Reset all FORGE data on this device? This cannot be undone without a backup.')){stopFocusTicker();focusPauseReason='';state=seed();save();renderAll();toast('Workspace reset.')}};
renderAll();renderLanguageGuide();
window.forgeDesktop.getAmcCatalog().then(catalog=>{timelineExamNames=new Map(catalog.map(exam=>[exam.id,exam.title]));renderTimelineEvidence()}).catch(()=>{});

// Save code as it is edited, including when the window is closed directly.
document.addEventListener('input',event=>{if(event.target.id==='codeEditor')saveCode(false)});
window.addEventListener('beforeunload',()=>{if(state.focus.active?.running){state.focus=FocusCore.pause(state.focus,Date.now(),true);save()}saveCode(false)});
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveCode(false)});
