(function(){
  'use strict';
  let topicData=[],exams=[],currentId=null,libraryReady=false,speechToken=0,speechActive=false,speechStatus='Speech is off. Playback uses an installed local voice only.';
  const topicById=new Map(),examById=new Map();
  const lessonEntries=()=>state.coach.history.filter(x=>x.kind==='lesson'&&x.result?.lesson);
  const dayText=date=>date?fmtDate(date,{weekday:'short',month:'short',day:'numeric'}):'';
  const inputFields=()=>({minutes:Number(byId('lessonMinutes').value)});

  function selectedProgress(entry){
    if(!entry.lessonProgress){entry.lessonProgress=CoachCore.blankProgress(entry.result.lesson);save();}
    return entry.lessonProgress;
  }

  function learningSignal(){
    const unique=new Map();
    const attempts=[...(state.amc?.attempts||[])].slice(-80).sort((a,b)=>a.completedAt-b.completedAt);
    for(const attempt of attempts){
      const exam=examById.get(attempt.examId);if(!exam||!Array.isArray(attempt.answers))continue;
      attempt.answers.forEach((answer,index)=>{
        const key=attempt.examId+'/'+(index+1),metadata=topicById.get(key);if(!metadata)return;
        unique.set(key,{topic:metadata.topic,answer,correct:exam.answers[index]});
      });
    }
    const byTopic=new Map();
    for(const item of unique.values()){
      const row=byTopic.get(item.topic)||{topic:item.topic,correct:0,wrong:0,blank:0};
      if(!item.answer)row.blank++;else if(item.answer===item.correct)row.correct++;else row.wrong++;
      byTopic.set(item.topic,row);
    }
    const values=[...byTopic.values()].map(x=>({...x,sampleCount:x.correct+x.wrong,accuracy:x.correct+x.wrong?Math.round(x.correct/(x.correct+x.wrong)*100):null}));
    const answered=values.filter(x=>x.sampleCount>0);
    const reliable=answered.filter(x=>x.sampleCount>=3).sort((a,b)=>a.accuracy-b.accuracy||b.sampleCount-a.sampleCount);
    const early=answered.sort((a,b)=>a.accuracy-b.accuracy||b.sampleCount-a.sampleCount);
    const blankOnly=values.filter(x=>x.blank>0).sort((a,b)=>b.blank-a.blank);
    return {focus:reliable[0]||early[0]||null,confidence:reliable.length?'Measured signal':early.length?'Early signal':'Starting baseline',values,blankOnly};
  }

  function renderRecommendation(){
    const signal=learningSignal(),focus=signal.focus;
    byId('lessonConfidence').textContent=signal.confidence;
    if(focus){
      const confidence=focus.sampleCount>=3?'needs review':`${focus.sampleCount} answered sample${focus.sampleCount===1?'':'s'}`;
      byId('lessonRecommendation').innerHTML=`<div class="lesson-focus"><span class="pill math">AMC 10 · ${esc(confidence)}</span><h3>${esc(focus.topic)}</h3><p>${focus.sampleCount?`${focus.accuracy}% accuracy across ${focus.sampleCount} unique answered questions. Blank answers are tracked separately and do not count as wrong.`:`${focus.blank} blank responses; there is not enough evidence to estimate accuracy.`}</p><p class="tiny muted">The AI considers this alongside your saved lessons and coding practice when it builds your next integrated lesson.${focus.sampleCount<3?' This is an early signal.':''}</p></div>`;
    }else{
      const due=(state.amc?.reviews||[]).filter(x=>x.stage<3&&x.next<=todayKey()).length;
      byId('lessonRecommendation').innerHTML=`<div class="empty"><strong>Start with a baseline.</strong><p class="tiny">${due?`${due} AMC review question${due===1?' is':'s are'} due. `:''}The AI can choose a beginner-friendly math and programming lesson now. Scored AMC questions and completed lessons will improve its next choice.</p><button class="btn sm" data-go="math">Open AMC practice →</button></div>`;
    }
  }

  function renderDue(){
    const due=lessonEntries().filter(x=>x.lessonProgress?.completedAt&&x.lessonProgress.nextReview&&x.lessonProgress.nextReview<=todayKey());
    byId('lessonDueCount').textContent=`${due.length} due`;
    byId('lessonDue').innerHTML=due.length?due.slice(0,5).map(x=>`<div class="lesson-list-row"><div><strong>${esc(x.result.lesson.topic)}</strong><small>${esc(x.result.lesson.subject)} · ${dayText(x.lessonProgress.nextReview)}</small></div><button class="btn sm" data-open-lesson="${esc(x.id)}">Review →</button></div>`).join(''):'<div class="empty">No lesson reviews due. Your quiz results will schedule the next review.</div>';
  }

  function renderLibrary(){
    const entries=lessonEntries().slice(0,8);
    byId('lessonSavedCount').textContent=`${lessonEntries().length} saved`;
    byId('lessonLibrary').innerHTML=entries.length?entries.map(x=>{
      const p=x.lessonProgress||{},last=p.attempts?.at(-1),status=!p.completedAt?'Not started':p.reviewStage>=3?'Mastered':p.nextReview?`Review ${dayText(p.nextReview)}`:'Completed';
      return `<div class="lesson-list-row"><div><strong>${esc(x.result.lesson.topic)}</strong><small>${esc(x.result.lesson.subject)} · ${last?`${last.correct}/3 last quiz · `:''}${esc(status)}</small></div><button class="btn sm" data-open-lesson="${esc(x.id)}">Open</button></div>`;
    }).join(''):'<div class="empty">Generated lessons appear here so you can return to them later.</div>';
  }

  function speechSupported(){return Boolean(window.speechSynthesis&&window.SpeechSynthesisUtterance);}
  function renderSpeechControls(){
    const read=byId('lessonReadAloud'),stop=byId('lessonStopReading'),status=byId('lessonSpeechStatus');if(!read||!stop||!status)return;
    read.disabled=!speechSupported();stop.disabled=!speechActive;
    if(!speechSupported())status.textContent='Local text-to-speech is unavailable here. The lesson text remains available on this device.';
    else status.textContent=speechStatus;
  }
  function stopSpeech(message='Playback stopped.'){
    speechToken++;if(window.speechSynthesis)window.speechSynthesis.cancel();speechActive=false;speechStatus=message;renderSpeechControls();
  }
  function lessonSpeechText(entry){
    const lesson=entry.result.lesson,parts=[entry.result.title,entry.result.summary,'Learning objectives.',...lesson.objectives];
    if(lesson.prerequisites.length)parts.push('Useful background.',...lesson.prerequisites);
    lesson.modules.forEach((module,index)=>parts.push(`Module ${index+1}. ${module.heading}.`,module.explanation,'Key idea.',module.keyIdea,'Worked example.',module.examplePrompt,...module.exampleSteps,`Example answer: ${module.exampleAnswer}.`,'Try it yourself.',module.exercisePrompt));
    parts.push('Check your understanding.',...lesson.quiz.map((question,index)=>`Question ${index+1}. ${question.prompt}`));
    return parts.filter(x=>typeof x==='string'&&x.trim()).join(' ').slice(0,16000);
  }
  async function localVoices(synth){
    const current=()=>synth.getVoices().filter(voice=>voice&&voice.localService===true);
    let available=current();if(available.length)return available;
    await new Promise(resolve=>{let finished=false,timer;const done=()=>{if(finished)return;finished=true;clearTimeout(timer);synth.removeEventListener?.('voiceschanged',done);resolve();};timer=setTimeout(done,1000);synth.addEventListener?.('voiceschanged',done,{once:true});});
    return current();
  }
  async function readLessonAloud(entry){
    if(!speechSupported()){renderSpeechControls();return;}
    const token=++speechToken,synth=window.speechSynthesis;synth.cancel();speechActive=true;speechStatus='Looking for an installed local voice…';renderSpeechControls();
    const voices=await localVoices(synth);if(token!==speechToken)return;
    if(!voices.length){speechActive=false;speechStatus='No installed local voice is available. Nothing was sent to a speech service; the text stays on this device.';renderSpeechControls();return;}
    const voice=voices.find(item=>/^en[-_]?us$/i.test(item.lang||''))||voices[0];
    try{
      const utterance=new window.SpeechSynthesisUtterance(lessonSpeechText(entry));utterance.voice=voice;
      utterance.onstart=()=>{if(token===speechToken){speechActive=true;speechStatus=`Reading aloud with local voice: ${voice.name||voice.lang||'installed voice'}.`;renderSpeechControls();}};
      utterance.onend=()=>{if(token===speechToken){speechActive=false;speechStatus='Finished reading. Playback used an installed local voice.';renderSpeechControls();}};
      utterance.onerror=()=>{if(token===speechToken){speechActive=false;speechStatus='Local speech playback could not start. The lesson text remains available.';renderSpeechControls();}};
      synth.speak(utterance);
    }catch{if(token===speechToken){speechActive=false;speechStatus='Local speech playback could not start. The lesson text remains available.';renderSpeechControls();}}
  }

  function renderLesson(entry){
    const lesson=entry.result.lesson,p=selectedProgress(entry),last=p.attempts.at(-1),due=p.nextReview&&p.nextReview<=todayKey(),taskId=`lesson-${entry.id}`;
    const taskAdded=state.tasks.some(x=>x.id===taskId);
    const objectiveList=lesson.objectives.map(x=>`<li>${esc(x)}</li>`).join('');
    const prerequisiteList=lesson.prerequisites.length?`<div class="lesson-prerequisites"><strong>Useful background</strong><ul>${lesson.prerequisites.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';
    const modules=lesson.modules.map((m,i)=>`<article class="lesson-module"><div class="lesson-module-title"><span class="lesson-number">${i+1}</span><h3>${esc(m.focus?m.focus+' · '+m.heading:m.heading)}</h3></div><p class="lesson-explanation">${esc(m.explanation)}</p><div class="lesson-key"><strong>Key idea</strong><p>${esc(m.keyIdea)}</p></div><div class="lesson-example"><h4>Worked example</h4><p><strong>${esc(m.examplePrompt)}</strong></p><ol>${m.exampleSteps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p class="lesson-answer"><strong>Answer:</strong> ${esc(m.exampleAnswer)}</p></div><div class="lesson-exercise"><h4>Try it yourself</h4><p>${esc(m.exercisePrompt)}</p><label class="sr-only" for="lessonExercise${i}">Your working for ${esc(m.heading)}</label><textarea id="lessonExercise${i}" class="lesson-answer-box" maxlength="2000" data-exercise-answer="${i}" placeholder="Write your approach or answer here. Saved locally.">${esc(p.exerciseAnswers[i]||'')}</textarea><button class="btn sm" data-exercise-reveal="${i}">${p.exerciseRevealed[i]?'Hide walkthrough':'Show walkthrough'}</button>${p.exerciseRevealed[i]?`<div class="explanation"><strong>One correct approach</strong><p>${esc(m.exerciseAnswer)}</p><p>${esc(m.exerciseExplanation)}</p></div>`:''}</div></article>`).join('');
    const quiz=lesson.quiz.map((q,i)=>`<div class="lesson-quiz-question"><h4>${i+1}. ${esc(q.focus?q.focus+' · '+q.prompt:q.prompt)}</h4><div class="lesson-choices">${q.choices.map((choice,index)=>`<button class="option ${p.quizChecked&&index===q.correctIndex?'correct':''} ${p.quizChecked&&p.quizAnswers[i]===index&&index!==q.correctIndex?'incorrect':''} ${!p.quizChecked&&p.quizAnswers[i]===index?'chosen':''}" data-lesson-choice="${i}" data-choice="${index}" ${p.quizChecked?'disabled':''}><span>${'ABCD'[index]}.</span> ${esc(choice)}</button>`).join('')}</div>${p.quizChecked?`<div class="explanation"><strong>${p.quizAnswers[i]===q.correctIndex?'Correct':'Review this idea'}</strong><p>${esc(q.explanation)}</p></div>`:''}</div>`).join('');
    const coding=lesson.codingChallenge?`<section class="lesson-code-challenge"><div class="section-head"><h3>${esc(lesson.codingChallenge.title)}</h3><span class="small-badge">${esc(lesson.codingChallenge.language)} · draft only</span></div><p>${esc(lesson.codingChallenge.prompt)}</p><p class="tiny muted">Target complexity: ${esc(lesson.codingChallenge.expectedComplexity)}</p><div class="examples"><strong>Starter code</strong>\n${esc(lesson.codingChallenge.starterCode)}</div><div class="lesson-code-tests"><strong>Sample tests (compare manually)</strong>${lesson.codingChallenge.publicTests.map((t,i)=>`<div><span>Test ${i+1} input</span><pre>${esc(t.input)}</pre><span>Expected output</span><pre>${esc(t.expectedOutput)}</pre></div>`).join('')}</div><label for="lessonCodeDraft" class="field-label">Your solution draft</label><textarea id="lessonCodeDraft" class="editor lesson-code-editor" maxlength="10000" spellcheck="false" aria-label="Coding challenge draft. This app does not run it.">${esc(p.codingDraft||'')}</textarea><div class="row wrap"><span class="tiny muted" id="lessonCodeSaved">Saved locally. FORGE does not execute or grade this code.</span><button class="btn sm" data-restore-starter>Restore starter</button></div><details class="lesson-hints"><summary>Show a hint</summary><ol>${lesson.codingChallenge.hints.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></details></section>`:'';
    const followUps=lesson.followUps.map((f,i)=>`<div class="lesson-follow-up"><div><span class="pill ${f.subject==='Math + Coding'?'mixed':f.subject==='Coding'?'code':'math'}">${esc(f.subject)}</span><h4>${esc(f.topic)}</h4><p>${esc(f.reason)}</p></div></div>`).join('');
    const quizStatus=last?`<div class="lesson-review-status"><strong>Last quiz: ${last.correct}/3</strong><span>${p.reviewStage>=3?'Mastered':due?'Review due now':p.nextReview?`Next review ${dayText(p.nextReview)}`:'Review scheduled'}</span>${due?'<button class="btn sm" data-start-review>Start due review</button>':''}</div>`:p.quizChecked?'':`<p class="tiny muted">Choose all three answers before checking. Answers stay hidden until you submit.</p>`;
    byId('lessonContent').classList.remove('hide');
    byId('lessonContent').innerHTML=`<div class="lesson-header"><div class="row wrap"><span class="pill ${lesson.subject==='Math + Coding'?'mixed':lesson.subject==='Coding'?'code':'math'}">${esc(lesson.subject)}</span><span class="small-badge">${esc(lesson.level)} · ${entry.lessonInput.minutes} minutes</span><span class="tiny muted">Generated ${dayText(new Date(entry.createdAt).toLocaleDateString('en-CA'))}</span></div><h2>${esc(entry.result.title)}</h2><p class="lesson-summary">${esc(entry.result.summary)}</p><div class="row wrap"><button class="btn primary sm" data-add-lesson-task ${taskAdded?'disabled':''}>${taskAdded?'✓ Added to plan':'+ Add lesson to plan'}</button><button class="btn sm" data-export-lesson aria-label="Export this lesson as a PowerPoint file">Export PowerPoint</button><button class="btn sm" id="lessonReadAloud" data-read-aloud>Read aloud</button><button class="btn sm" id="lessonStopReading" data-stop-reading disabled>Stop</button><button class="btn sm" data-close-lesson>Close lesson</button></div><p id="lessonSpeechStatus" class="mini-note" role="status" aria-live="polite"></p></div><div class="lesson-objectives"><h3>By the end, you can…</h3><ul>${objectiveList}</ul>${prerequisiteList}</div><div class="lesson-modules">${modules}</div>${coding}<section class="lesson-quiz"><div class="section-head"><div><span class="eyebrow">CHECK YOUR UNDERSTANDING</span><h3>Three-question check</h3></div><span class="small-badge">No penalty for a wrong answer</span></div>${quiz}${p.quizChecked?quizStatus:`<div class="row wrap extra-space"><span id="lessonQuizMessage" class="tiny muted">Select one answer for each question.</span><button class="btn primary" data-check-quiz ${p.quizAnswers.every(x=>x!==null)?'':'disabled'}>${p.attempts.length?'Check review':'Check my answers'}</button></div>`}</section><section class="lesson-next section"><div class="section-head"><div><span class="eyebrow">KEEP GOING</span><h3>Ideas for future lessons</h3></div></div><div class="lesson-follow-ups">${followUps}</div></section><p class="coach-disclaimer">AI-generated instruction may contain mistakes. Quiz scores and code drafts are saved locally; FORGE does not run or grade lesson code.</p>`;
    renderSpeechControls();
  }

  function open(id){
    const entry=state.coach.history.find(x=>x.id===id&&x.kind==='lesson'&&x.result?.lesson);if(!entry)return;
    stopSpeech('Speech is off. Playback uses an installed local voice only.');
    currentId=id;go('lessons');byId('lessonMinutes').value=String(entry.lessonInput.minutes);renderLesson(entry);renderDue();renderLibrary();
  }

  function refresh(){
    if(!byId('lessonForm'))return;
    renderRecommendation();renderDue();renderLibrary();
    if(currentId&&!state.coach.history.some(x=>x.id===currentId&&x.kind==='lesson')){currentId=null;byId('lessonContent').classList.add('hide');}
  }

  function checkQuiz(entry){
    const p=selectedProgress(entry),lesson=entry.result.lesson;
    if(!p.quizAnswers.every(x=>x!==null)){byId('lessonQuizMessage').textContent='Choose one answer for each question first.';return;}
    const correct=p.quizAnswers.reduce((n,answer,i)=>n+(answer===lesson.quiz[i].correctIndex?1:0),0),first=p.attempts.length===0,now=Date.now();
    p.quizChecked=true;p.completedAt=now;p.attempts.push({at:now,correct});p.attempts=p.attempts.slice(-12);
    if(correct>=2){p.reviewStage=Math.min(3,p.reviewStage+1);p.nextReview=p.reviewStage>=3?null:dateAdd(todayKey(),p.reviewStage===1?3:6);}
    else{p.reviewStage=0;p.nextReview=dateAdd(todayKey(),1);}
    if(first)addActivity('lesson');
    save();renderLesson(entry);refresh();renderInsights();
    const advice=correct>=2?(p.reviewStage>=3?'Lesson mastered!':`Strong work. Your next review is ${dayText(p.nextReview)}.`):`You got ${correct}/3. Review is scheduled for ${dayText(p.nextReview)}.`;
    toast(advice);
  }

  function addToPlan(entry){
    const id=`lesson-${entry.id}`;if(state.tasks.some(x=>x.id===id)){toast('This lesson is already in your plan.');return;}
    state.tasks.push({id,name:`Lesson: ${entry.result.lesson.topic}`,category:entry.result.lesson.subject==='Math + Coding'?'Coding':entry.result.lesson.subject,date:todayKey(),minutes:entry.lessonInput.minutes,done:false});save();renderAll();toast('Lesson added to today’s plan.');
  }

  byId('lessonForm').onsubmit=event=>{
    event.preventDefault();const input=inputFields();
    if(![15,25,40].includes(input.minutes)){byId('lessonError').textContent='Choose a lesson length from the list.';byId('lessonError').classList.remove('hide');return;}
    window.CoachUI.generateAdaptiveLesson(input.minutes);
  };
  document.addEventListener('input',event=>{
    const entry=state.coach.history.find(x=>x.id===currentId&&x.kind==='lesson');if(!entry)return;
    const p=selectedProgress(entry);
    if(event.target.matches('[data-exercise-answer]')){const i=Number(event.target.dataset.exerciseAnswer);if(i>=0&&i<p.exerciseAnswers.length){p.exerciseAnswers[i]=event.target.value.slice(0,2000);save();}}
    else if(event.target.id==='lessonCodeDraft'){p.codingDraft=event.target.value.slice(0,10000);save();byId('lessonCodeSaved').textContent='Draft saved locally. FORGE does not execute or grade this code.';}
  });
  document.addEventListener('keydown',event=>{if(event.target.id==='lessonCodeDraft'&&event.key==='Tab'){event.preventDefault();const input=event.target,start=input.selectionStart,end=input.selectionEnd;input.setRangeText('    ',start,end,'end');input.dispatchEvent(new Event('input',{bubbles:true}));}});
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.openLesson){open(button.dataset.openLesson);return;}
    const entry=state.coach.history.find(x=>x.id===currentId&&x.kind==='lesson');if(!entry)return;
    if(button.dataset.readAloud!==undefined){readLessonAloud(entry);return;}
    if(button.dataset.stopReading!==undefined){stopSpeech();return;}
    const p=selectedProgress(entry);
    if(button.dataset.lessonChoice!==undefined){const i=Number(button.dataset.lessonChoice),choice=Number(button.dataset.choice);if(!p.quizChecked&&i>=0&&i<p.quizAnswers.length&&choice>=0&&choice<4){p.quizAnswers[i]=choice;save();renderLesson(entry);}return;}
    if(button.dataset.checkQuiz!==undefined){checkQuiz(entry);return;}
    if(button.dataset.startReview!==undefined){if(!p.nextReview||p.nextReview>todayKey())return;p.quizAnswers=Array(entry.result.lesson.quiz.length).fill(null);p.quizChecked=false;p.exerciseRevealed=Array(entry.result.lesson.modules.length).fill(false);save();renderLesson(entry);return;}
    if(button.dataset.exerciseReveal!==undefined){const i=Number(button.dataset.exerciseReveal);if(i>=0&&i<p.exerciseRevealed.length){p.exerciseRevealed[i]=!p.exerciseRevealed[i];save();renderLesson(entry);}return;}
    if(button.dataset.addLessonTask!==undefined){addToPlan(entry);return;}
    if(button.dataset.exportLesson!==undefined){
      const control=button;control.disabled=true;control.textContent='Preparing slides…';
      const payload={title:entry.result.title,summary:entry.result.summary,minutes:entry.lessonInput.minutes,createdAt:entry.createdAt,lesson:entry.result.lesson};
      window.forgeDesktop.exportLessonPptx(payload).then(result=>{if(result?.saved)toast(`Saved ${result.fileName}`);}).catch(()=>toast('Could not create the PowerPoint. The lesson is still saved in FORGE.')).finally(()=>{if(control.isConnected){control.disabled=false;control.textContent='Export PowerPoint';}});
      return;
    }
    if(button.dataset.closeLesson!==undefined){stopSpeech('Speech is off. Playback uses an installed local voice only.');currentId=null;byId('lessonContent').classList.add('hide');return;}
    if(button.dataset.restoreStarter!==undefined){const starter=entry.result.lesson.codingChallenge?.starterCode;if(starter){p.codingDraft=starter;save();renderLesson(entry);}return;}
  });

  window.LessonsUI={refresh,open};
  refresh();
  Promise.all([window.forgeDesktop.coachTopics(),window.forgeDesktop.getAmcCatalog()]).then(([topics,library])=>{
    topicData=topics;exams=library;for(const item of topics)topicById.set(item.examId+'/'+item.question,item);for(const exam of library)examById.set(exam.id,exam);libraryReady=true;refresh();
  }).catch(()=>{libraryReady=false;byId('lessonRecommendation').innerHTML='<div class="empty">AMC performance metadata is unavailable. The AI can still build a baseline lesson from your saved lessons and coding practice.</div>';});
})();
