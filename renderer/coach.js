(function(){
  'use strict';
  let topicData=[],exams=[],connection=null,busy=false,busyTarget='coach',selected=null,profileSnapshot='',generation=0;
  const titles={practice:'Practice next',week:'Plan my week',competitions:'Find competitions',feedback:'Question feedback',hint:'Question hint',lesson:'AI lesson'};
  const topicById=new Map();
  const examName=id=>exams.find(x=>x.id===id)?.title||id;
  function error(message,target='coach'){const el=byId(target==='lessons'?'lessonError':'coachError');if(!el)return;el.textContent=message;el.classList.remove('hide');}
  function clearError(target='coach'){const el=byId(target==='lessons'?'lessonError':'coachError');if(el)el.classList.add('hide');}
  function updateConnection(value){connection=value;byId('coachConnectionStatus').textContent=value.configured?'Key file connected · GPT-6 Luna':'Connect GPT-6 Luna';byId('coachConnectionDetail').textContent=value.configured?`Reading ${value.fileName} locally. The key is excluded from app downloads and progress backups.`:value.message||'Choose the text file containing your OpenAI API key.';byId('coachCheck').disabled=!value.configured;byId('coachDisconnect').disabled=!value.configured;updateBusy();}
  function updateBusy(){byId('coachBusy').classList.toggle('hide',!busy||busyTarget!=='coach');const lessonBusy=byId('lessonBusy');if(lessonBusy)lessonBusy.classList.toggle('hide',!busy||busyTarget!=='lessons');document.querySelectorAll('[data-coach-action]').forEach(x=>x.disabled=busy||!connection?.configured);const generate=byId('lessonGenerate');if(generate)generate.disabled=busy||!connection?.configured;byId('coachConnect').disabled=busy;byId('coachDisconnect').disabled=busy||!connection?.configured;byId('coachCheck').disabled=busy||!connection?.configured;}
  function readProfile(){
    const form=byId('coachProfile');if(!form.reportValidity())return null;
    const age=byId('coachAge').value;
    const p={grade:byId('coachGrade').value,age,location:byId('coachLocation').value.trim().slice(0,120),interest:byId('coachInterest').value,minutes:Math.max(10,Math.min(240,Number(byId('coachMinutes').value)||45)),goal:byId('coachGoal').value.trim().slice(0,1000),...CompetitionCore.normalizeProfile({competitionTarget:byId('coachCompetitionTarget').value,competitionLevel:byId('coachCompetitionLevel').value,competitionLanguage:byId('coachCompetitionLanguage').value,competitionCustomTarget:byId('coachCompetitionCustom').value})};
    state.coach.profile=p;profileSnapshot=JSON.stringify(p);save();return p;
  }
  function refresh(){
    const next=JSON.stringify(state.coach.profile);
    if(next!==profileSnapshot){
      const p=state.coach.profile;for(const [id,key] of [['coachGrade','grade'],['coachAge','age'],['coachLocation','location'],['coachInterest','interest'],['coachMinutes','minutes'],['coachGoal','goal']])byId(id).value=p[key];
      const competition=CompetitionCore.normalizeProfile(p);byId('coachCompetitionTarget').value=competition.competitionTarget;byId('coachCompetitionLevel').value=competition.competitionLevel;byId('coachCompetitionLanguage').value=competition.competitionLanguage;byId('coachCompetitionCustom').value=competition.competitionCustomTarget;byId('coachCompetitionCustomWrap').classList.toggle('hide',competition.competitionTarget!=='Other');profileSnapshot=next;
    }
    if(selected&&!state.coach.history.some(x=>x.id===selected))selected=null;
    if(!selected&&state.coach.history.length)selected=state.coach.history[0].id;
    byId('coachHistory').innerHTML=state.coach.history.length?state.coach.history.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(titles[x.kind])} · ${new Date(x.createdAt).toLocaleString()}</option>`).join(''):'<option value="">No saved responses yet</option>';
    renderResponse();
  }
  function progress(){
    const attempts=state.amc.attempts.slice(-80),stats=new Map(),questionStats=new Map(),latestByQuestion=new Map();
    for(const attempt of [...attempts].sort((a,b)=>a.completedAt-b.completedAt)){const exam=exams.find(x=>x.id===attempt.examId);if(!exam||!Array.isArray(attempt.answers))continue;attempt.answers.forEach((answer,i)=>{
      const key=attempt.examId+'/'+(i+1);const metadata=topicById.get(key);latestByQuestion.set(key,{topic:metadata?.topic||'Mixed math',answer,correctAnswer:exam.answers[i]});
    });}
    for(const [key,item] of latestByQuestion){
      const row=stats.get(item.topic)||{topic:item.topic,correct:0,wrong:0,blank:0};if(!item.answer)row.blank++;else if(item.answer===item.correctAnswer)row.correct++;else row.wrong++;stats.set(item.topic,row);
      const q={correct:0,wrong:0,blank:0};if(!item.answer)q.blank++;else if(item.answer===item.correctAnswer)q.correct++;else q.wrong++;questionStats.set(key,q);
    }
    for(const row of stats.values()){row.sampleCount=row.correct+row.wrong;row.confidence=row.sampleCount>=10?'strong':row.sampleCount>=5?'moderate':'early';row.accuracy=row.sampleCount?Math.round(row.correct/row.sampleCount*100):null;}
    const preferred=state.amc.active?.mode==='practice'?state.amc.active.examId:attempts.at(-1)?.examId||'amc10-2022A';
    const candidates=topicData.filter(x=>x.examId===preferred).map(x=>({...x,title:examName(x.examId),history:questionStats.get(x.examId+'/'+x.question)||null}));
    const result={
      topicPerformance:[...stats.values()],
      amcResults:attempts.slice(-8).map(x=>({exam:examName(x.examId),examId:x.examId,mode:x.mode,score:x.score,correct:x.correct,wrong:x.wrong,blank:x.blank,elapsedMinutes:Math.round(x.elapsedSeconds/60),completedDate:new Date(x.completedAt).toLocaleDateString('en-CA')})),
      reviewsDue:state.amc.reviews.filter(x=>x.stage<3&&x.next<=todayKey()).slice(0,15).map(x=>({examId:x.examId,question:x.question,topic:topicById.get(x.examId+'/'+x.question)?.topic,stage:x.stage})),
      originalDrills:{attempts:state.mathAttempts.length,correct:state.mathAttempts.filter(x=>x.correct).length},
      coding:challenges.map(x=>({title:x.title,topic:x.topic,difficulty:x.level,selfMarkedComplete:!!state.codeDone[x.id]})),
      plannedMissions:state.tasks.filter(x=>!x.done&&x.date>=todayKey()&&x.date<=dateAdd(todayKey(),6)).slice(0,18).map(x=>({title:x.name,subject:x.category,date:x.date,minutes:x.minutes})),
      activePaper:state.amc.active?{examId:state.amc.active.examId,mode:state.amc.active.mode}:null
    };
    return {result,candidates};
  }
  function competitionEvidence(target){
    const relevant=CompetitionCore.TARGETS.includes(target)?TrainingCore.CATALOG.filter(item=>target==='LeetCode'?item.platform==='LeetCode':target==='Codeforces'?item.platform==='Codeforces':true):TrainingCore.CATALOG;
    const pathMarks=relevant.filter(item=>state.training.completed[item.id]).length;
    const selfMarked=Object.values(state.codeDone).filter(Boolean).length;
    const quizzes=state.coach.history.filter(item=>item.kind==='lesson'&&['Coding','Math + Coding'].includes(item.result?.lesson?.subject)&&item.lessonProgress?.attempts?.length).map(item=>item.lessonProgress.attempts.at(-1).correct).slice(-12);
    return {practiceMarks:Math.min(500,pathMarks+selfMarked),codingLessonQuizzes:quizzes.length,recentLessonAccuracy:quizzes.length?Math.round(quizzes.reduce((sum,value)=>sum+value,0)/(quizzes.length*3)*100):null};
  }
  async function ask(kind,questionRequest,destination='coach'){
    if(busy)return;
    go(destination);clearError(destination);
    if(!connection?.configured){error(destination==='lessons'?'Connect GPT-6 Luna in AI Coach before creating a lesson.':'Choose your OpenAI key file above to enable the coach.',destination);return;}
    const profile=destination==='lessons'?state.coach.profile:readProfile();if(!profile){byId('coachProfileDetails').open=true;return;}
    if(kind==='competitions'){
      if(!profile.competitionTarget){error('Choose the competition family you want to prepare for.');byId('coachCompetitionTarget').focus();return;}
      if(profile.competitionTarget==='Other'&&profile.competitionCustomTarget.length<2){error('Enter the competition name or organizer you want to prepare for.');byId('coachCompetitionCustomWrap').classList.remove('hide');byId('coachCompetitionCustom').focus();return;}
    }
    if(kind!=='lesson'&&(!exams.length||!topicData.length)){error('The practice library is still loading. Try again in a moment.',destination);return;}
    const token=++generation;busy=true;busyTarget=destination;updateBusy();
    const busyText=destination==='lessons'?'GPT-6 Luna is building a structured lesson…':questionRequest?'Preparing this question and your working notes…':kind==='competitions'?'Checking official competition sources…':'Looking at your progress and building your next steps…';
    const busyElement=byId(destination==='lessons'?'lessonBusy':'coachBusy');const textElement=byId(destination==='lessons'?'lessonBusyText':'coachBusyText');if(textElement)textElement.textContent=busyText;busyElement?.scrollIntoView({behavior:'smooth',block:'center'});
    try{
      let extra={};if(questionRequest)extra=await questionRequest();if(token!==generation)return;
      const p=kind==='competitions'?null:progress();
      const hintLevel=extra.question?Math.min(3,1+state.coach.history.filter(x=>x.kind==='hint'&&x.origin?.examId===extra.question.examId&&x.origin?.number===extra.question.number).length):1;
      let payload;
      if(kind==='lesson'){
        const requested=extra.lesson;
        if(requested.mode==='adaptive'){
          const recentLessons=state.coach.history.filter(x=>x.kind==='lesson'&&x.result?.lesson).slice(0,8).map(x=>({topic:x.result.lesson.topic,level:x.result.lesson.level,quizCorrect:x.lessonProgress?.attempts?.at(-1)?.correct??null,completed:!!x.lessonProgress?.completedAt}));
          const codingPractice=p.result.coding.slice(0,8).map(x=>({topic:x.topic,selfMarkedComplete:x.selfMarkedComplete}));
          const topicPerformance=[...p.result.topicPerformance].sort((a,b)=>{
            const rank=x=>x.sampleCount>=3?0:x.sampleCount>0?1:2;
            return rank(a)-rank(b)||(a.accuracy??101)-(b.accuracy??101)||b.sampleCount-a.sampleCount||b.blank-a.blank;
          }).slice(0,12);
          payload={action:kind,profile:{grade:profile.grade,goal:profile.goal},progress:{topicPerformance,recentLessons,codingPractice,learnerContext:window.OnboardingUI?.context?.()||null},lesson:requested};
        }else{
          const match=p.result.topicPerformance.find(x=>x.topic.toLowerCase()===requested.topic.toLowerCase());
          payload={action:kind,profile:{grade:profile.grade,minutes:profile.minutes,interest:profile.interest,goal:profile.goal},progress:{topicPerformance:match?[match]:[]},lesson:requested};
        }
      }else if(kind==='competitions'){
        payload={action:kind,today:todayKey(),competitionTarget:profile.competitionTarget,competitionCustomTarget:profile.competitionCustomTarget,competitionLevel:profile.competitionLevel,competitionLanguage:profile.competitionLanguage,profile:{grade:profile.grade,age:profile.age,location:profile.location,interest:profile.interest,minutes:profile.minutes,goal:profile.goal},competitionEvidence:competitionEvidence(profile.competitionTarget)};
      }else payload={action:kind,today:todayKey(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,profile,progress:p.result,candidates:['practice','week'].includes(kind)?p.candidates:[],hintLevel,...extra};
      if(destination==='coach')byId('coachBusyText').textContent=kind==='competitions'?'Researching current competitions and eligibility…':'GPT-6 Luna is preparing your coaching notes…';
      const response=await window.forgeDesktop.coachRequest(payload);if(token!==generation)return;
      const generated=response.result.lesson;
      const lessonInput=kind==='lesson'?{subject:generated.subject,topic:generated.topic,level:generated.level,minutes:extra.lesson.minutes,goal:extra.lesson.mode==='adaptive'?'':extra.lesson.goal,language:generated.codingChallenge?.language||extra.lesson.language||'Python',...(extra.lesson.mode==='adaptive'?{mode:'adaptive'}:{})}:null;
      const entry={id:crypto.randomUUID(),kind,createdAt:response.createdAt,result:response.result,usage:response.usage,origin:extra.question?{examId:extra.question.examId,number:extra.question.number}:null,...(kind==='lesson'?{lessonInput,lessonProgress:CoachCore.blankProgress(response.result.lesson)}:{})};
      state.coach.history.unshift(entry);state.coach.history=state.coach.history.slice(0,30);selected=entry.id;save();refresh();
      if(kind==='lesson'){window.LessonsUI?.open(entry.id);byId('lessonContent')?.scrollIntoView({behavior:'smooth',block:'start'});}else byId('coachResponse').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){if(token===generation)error(String(e.message||'The coach request failed.').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''),destination);}
    finally{if(token===generation){busy=false;updateBusy();}}
  }

  function generateLesson(input,options={}){
    if(!input||typeof input!=='object')return;
    const normalized={subject:input.subject,topic:String(input.topic||'').trim(),level:input.level,minutes:Number(input.minutes),goal:String(input.goal||'').trim().slice(0,500),language:input.language};
    const cutoff=Date.now()-7*86400000;
    const cached=state.coach.history.find(x=>x.kind==='lesson'&&x.createdAt>=cutoff&&JSON.stringify(x.lessonInput)===JSON.stringify(normalized));
    if(cached&&!options.fresh){window.LessonsUI?.open(cached.id);toast('Opened your saved lesson; no new AI request was used.');return Promise.resolve(cached);}
    return ask('lesson',()=>Promise.resolve({lesson:normalized}),'lessons');
  }
  function generateAdaptiveLesson(minutes,options={}){
    const length=Number(minutes);
    if(![15,25,40].includes(length)){error('Choose a 15, 25, or 40 minute lesson.','lessons');return Promise.resolve();}
    const competitionTarget=typeof options.competitionTarget==='string'?options.competitionTarget.slice(0,80):'';
    const preparationIdea=typeof options.preparationIdea==='string'?options.preparationIdea.slice(0,100):'';
    return ask('lesson',()=>Promise.resolve({lesson:{mode:'adaptive',minutes:length,competitionTarget,preparationIdea}}),'lessons');
  }
  function recommendationHtml(entry,item,i){
    const added=state.tasks.some(x=>x.id===`coach-${entry.id}-${i}`);
    const date=dateAdd(new Date(entry.createdAt).toLocaleDateString('en-CA'),item.dayOffset);
    return `<div class="coach-recommendation"><div class="row wrap">${categoryPill(item.subject)}<span class="tiny muted">${item.minutes} min · ${fmtDate(date)}</span></div><h3>${esc(item.title)}</h3>${item.examId?`<span class="small-badge">${esc(examName(item.examId))} · Q${item.question}</span>`:''}<p>${esc(item.reason)}</p><div class="row wrap"><button class="btn primary sm" data-coach-add="${i}" ${added?'disabled':''}>${added?'✓ Added to plan':'+ Add to plan'}</button>${item.examId?`<button class="btn sm" data-coach-practice="${i}">Open question →</button>`:item.subject==='Coding'?`<button class="btn sm" data-coach-coding="${i}">Open coding →</button>`:''}</div></div>`;
  }
  function competitionHtml(item,index){
    const match=item.relevance?`Target fit ${item.relevance}/5`:'Fit not scored';
    const readiness=item.readiness||{label:'Not assessed',detail:'Open the organizer page to review the event.'};
    return `<div class="coach-competition"><div class="row wrap"><h3>${esc(item.name)}</h3><span class="small-badge">${item.verified?'Official source checked':'Check official details'}</span></div><div class="row wrap"><span class="small-badge">${match}</span><span class="small-badge">Difficulty: ${esc(item.difficulty||'Varies')}</span><span class="small-badge">Readiness: ${esc(readiness.label)}</span></div><p>${esc(item.fit)}</p><p><strong>Eligibility:</strong> ${esc(item.eligibility)}</p><p><strong>Readiness signal:</strong> ${esc(readiness.detail)}</p>${item.eventDate?`<span class="coach-date">Event: ${fmtDate(item.eventDate,{month:'short',day:'numeric',year:'numeric'})}</span>`:''}${item.deadline?`<span class="coach-date">Registration: ${fmtDate(item.deadline,{month:'short',day:'numeric',year:'numeric'})}</span>`:''}<p class="tiny muted">${esc(item.dateNote)}</p><div class="row wrap"><button class="btn sm" data-coach-url="${esc(item.officialUrl)}">Official website ↗</button>${item.eventDate&&item.verified?`<button class="btn primary sm" data-coach-contest="${index}">+ Track date</button>`:''}</div></div>`;
  }
  function preparationHtml(item,index){
    return `<article class="coach-preparation"><div class="row wrap"><span class="pill mixed">Math + Coding</span><span class="small-badge">Target fit ${item.relevance}/5</span></div><h3>${esc(item.title)}</h3><p class="tiny muted">Prep idea: ${esc(item.topic)} · ${item.minutes} min</p><p>${esc(item.reason)}</p><button class="btn primary sm" data-coach-preparation="${index}">Build integrated lesson</button></article>`;
  }
  function renderResponse(){
    const entry=state.coach.history.find(x=>x.id===selected);
    if(!entry){byId('coachResponse').innerHTML='<div class="empty">Choose a coaching action above. For feedback on one question, open a reviewed AMC question and select Explain my mistake.</div>';return;}
    const r=entry.result;
    const openLesson=entry.kind==='lesson'?`<div class="info-banner gold section"><strong>${esc(r.lesson?.topic||'Saved lesson')}</strong><p>Open this lesson to continue its exercises, quiz, and scheduled reviews.</p><button class="btn primary sm" data-open-lesson="${esc(entry.id)}">Open lesson →</button></div>`:'';
    const competitionCards=r.competitions.map(competitionHtml).join('');
    const preparationSection=r.preparation?.length?`<section class="section" aria-labelledby="prepChoicesHeading"><div class="section-head"><div><h3 id="prepChoicesHeading">Prep ideas for your next lesson</h3><p class="tiny muted">The AI uses the idea as context, then chooses an integrated math and programming lesson. Each generation uses one lesson request.</p></div></div><div class="coach-preparation-grid">${r.preparation.map(preparationHtml).join('')}</div></section>`:'';
    byId('coachResponse').innerHTML=`<div class="card coach-output"><div class="coach-title-row"><span class="eyebrow">${esc(titles[entry.kind])} · ${new Date(entry.createdAt).toLocaleString()}</span><span class="small-badge">GPT-6 Luna${r.liveSearch?' · live sources':''}</span></div><h2>${esc(r.title)}</h2><p class="coach-summary">${esc(r.summary)}</p>${openLesson}${entry.origin?`<div class="row wrap"><span class="pill math">${esc(examName(entry.origin.examId))} · Q${entry.origin.number}</span><button class="btn sm" id="coachBackToQuestion">Back to question →</button>${entry.kind==='hint'?'<button class="btn sm" id="coachNextHint">Give another hint</button>':''}</div>`:''}${r.sections.map(s=>`<div class="coach-section"><h3>${esc(s.heading)}</h3><ul>${s.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul></div>`).join('')}${r.recommendations.length?`<div class="section-head section"><h3>Suggested missions</h3><button class="btn sm" id="coachAddAll">Add all to plan</button></div><div class="coach-recommendations">${r.recommendations.map((x,i)=>recommendationHtml(entry,x,i)).join('')}</div>`:''}${competitionCards}${preparationSection}${r.sources.length?`<div class="coach-sources"><strong>Sources</strong>${r.sources.map(s=>`<button class="linkish tiny" data-coach-url="${esc(s.url)}">${esc(s.title)} ↗</button>`).join('')}</div>`:''}<p class="coach-disclaimer">AI coaching is guidance. Competition eligibility and registration are confirmed by the organizer. Readiness compares your self-rating to the estimated event difficulty; it is not an ability score or qualification prediction.</p></div>`;
    if(byId('coachAddAll'))byId('coachAddAll').onclick=()=>{r.recommendations.forEach((_,i)=>addMission(entry,i,false));save();renderAll();toast('Suggested missions added to your plan.');};
    if(byId('coachBackToQuestion'))byId('coachBackToQuestion').onclick=()=>{
      if(!byId('amcWorkspace').classList.contains('hide')){go('math');byId('showPastPapers').click();byId('amcWorkspace').scrollIntoView({behavior:'smooth'});}
      else window.AMCController.openPractice(entry.origin.examId,entry.origin.number);
    };
    if(byId('coachNextHint'))byId('coachNextHint').onclick=()=>{
      const origin=window.AMCController.origin();
      if(origin?.examId!==entry.origin.examId||origin?.number!==entry.origin.number){window.AMCController.openPractice(entry.origin.examId,entry.origin.number);toast('Open this question and request the next hint there.');return;}
      askQuestion('hint');
    };
  }
  function addMission(entry,index,notify=true){
    const item=entry.result.recommendations[index];if(!item)return;
    const id=`coach-${entry.id}-${index}`;if(state.tasks.some(x=>x.id===id))return;
    const base=new Date(entry.createdAt).toLocaleDateString('en-CA');
    state.tasks.push({id,name:item.title,category:item.subject,date:dateAdd(base,item.dayOffset),minutes:item.minutes,done:false});
    if(notify){save();renderAll();toast('Mission added to your plan.');}
  }
  function askQuestion(kind){return ask(kind,()=>window.AMCController.coachContext(kind));}
  function saveCompetitionPreferences(){
    const preferences=CompetitionCore.normalizeProfile({competitionTarget:byId('coachCompetitionTarget').value,competitionLevel:byId('coachCompetitionLevel').value,competitionLanguage:byId('coachCompetitionLanguage').value,competitionCustomTarget:byId('coachCompetitionCustom').value});
    state.coach.profile={...state.coach.profile,...preferences};profileSnapshot=JSON.stringify(state.coach.profile);byId('coachCompetitionCustomWrap').classList.toggle('hide',preferences.competitionTarget!=='Other');save();
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.coachAction){ask(button.dataset.coachAction);return;}
    const entry=state.coach.history.find(x=>x.id===selected);if(!entry)return;
    if(button.dataset.coachAdd!==undefined)addMission(entry,Number(button.dataset.coachAdd));
    else if(button.dataset.coachPractice!==undefined){const item=entry.result.recommendations[Number(button.dataset.coachPractice)];if(item)window.AMCController.openPractice(item.examId,item.question);}
    else if(button.dataset.coachPreparation!==undefined){
      const item=entry.result.preparation?.[Number(button.dataset.coachPreparation)];if(!item)return;
      const target=entry.result.competitionTarget==='Other'?entry.result.competitionCustomTarget:entry.result.competitionTarget;
      generateAdaptiveLesson(item.minutes,{competitionTarget:target,preparationIdea:item.topic});
    }
    else if(button.dataset.coachCoding!==undefined){const item=entry.result.recommendations[Number(button.dataset.coachCoding)];const match=challenges.find(x=>item.title.toLowerCase().includes(x.title.toLowerCase()));if(match)selectedCode=match.id;renderCoding();go('coding');}
    else if(button.dataset.coachUrl)window.forgeDesktop.coachOpenSource(button.dataset.coachUrl).catch(()=>error('That source link could not be opened.'));
    else if(button.dataset.coachContest!==undefined){
      const item=entry.result.competitions[Number(button.dataset.coachContest)];if(!item||!item.eventDate||!item.verified)return;
      if(state.contests.some(x=>x.name===item.name&&x.date===item.eventDate)){toast('This date is already in your competitions.');return;}
      state.contests.push({id:'coach-contest-'+crypto.randomUUID(),name:item.name,date:item.eventDate,kind:'Competition',sourceUrl:item.officialUrl});save();renderAll();toast('Competition date added. Registration is completed on the organizer’s website.');
    }
  });
  function cancel(target=busyTarget){if(!busy)return;generation++;busy=false;window.forgeDesktop.coachCancel().catch(()=>{});updateBusy();error('Coach request canceled. Your practice progress is saved.',target);}
  byId('coachConnect').onclick=async()=>{clearError();try{updateConnection(await window.forgeDesktop.coachConnect());}catch(e){error(e.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}};
  byId('coachCheck').onclick=async()=>{clearError();byId('coachCheck').disabled=true;try{await window.forgeDesktop.coachCheck();toast('GPT-6 Luna is available with this key.');}catch(e){error(e.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}finally{updateBusy();}};
  byId('coachDisconnect').onclick=async()=>{try{updateConnection(await window.forgeDesktop.coachDisconnect());toast('The key file connection was removed.');}catch{error('Could not disconnect the key file.');}};
  byId('coachCancel').onclick=()=>cancel('coach');
  byId('lessonCancel').onclick=()=>cancel('lessons');
  byId('coachProfile').onsubmit=event=>{event.preventDefault();if(readProfile())toast('Coach profile saved.');};
  byId('coachProfile').onchange=()=>{if(byId('coachProfile').checkValidity())readProfile();};
  for(const id of ['coachCompetitionTarget','coachCompetitionLevel','coachCompetitionLanguage'])byId(id).onchange=saveCompetitionPreferences;
  byId('coachCompetitionCustom').oninput=saveCompetitionPreferences;
  byId('coachHistory').onchange=()=>{selected=byId('coachHistory').value;renderResponse();};
  window.CoachUI={refresh,askQuestion,generateLesson,generateAdaptiveLesson,cancel};refresh();
  window.forgeDesktop.coachStatus().then(updateConnection).catch(()=>error('The coach connection could not be checked.'));
  Promise.all([window.forgeDesktop.coachTopics(),window.forgeDesktop.getAmcCatalog()]).then(([topics,library])=>{topicData=topics;exams=library;for(const item of topics)topicById.set(item.examId+'/'+item.question,item);refresh();}).catch(()=>error('The coaching question library could not be loaded.'));
})();
