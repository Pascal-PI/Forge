(function(){
  'use strict';
  let catalog=[],loadingId=null,context=null,question=1,doc=null,docKind='problems',pageNumber=1,zoom=100,renderTask=null,pdfModule=null,loadToken=0,renderToken=0,selectedReport=null;
  const docs=new Map();
  const examById=id=>catalog.find(x=>x.id===id);
  const current=()=>context?.type==='session'?state.amc.active:context?.type==='attempt'?state.amc.attempts.find(x=>x.id===context.id):null;
  const currentExam=()=>examById(context?.type==='review'?context.review.examId:current()?.examId);
  const shortTime=seconds=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  const modeName=mode=>mode==='timed'?'75-minute mock':'Untimed practice';
  const dueReviews=()=>state.amc.reviews.filter(x=>x.stage<3&&x.next<=todayKey());
  function message(text){byId('amcNotice').textContent=text;byId('amcNotice').classList.remove('hide');}
  function clearMessage(){byId('amcNotice').classList.add('hide');}
  function showPast(){byId('amcPractice').classList.remove('hide');byId('mathQuick').classList.add('hide');byId('showPastPapers').classList.add('primary');byId('showQuickDrills').classList.remove('primary');byId('showPastPapers').setAttribute('aria-pressed','true');byId('showQuickDrills').setAttribute('aria-pressed','false');}
  function library(){context=null;loadToken++;renderToken++;renderTask?.cancel();byId('amcWorkspace').classList.add('hide');byId('amcLibrary').classList.remove('hide');render();}
  function renderLibrary(){
    const year=byId('amcYear').value,paper=byId('amcPaper').value;
    const list=catalog.filter(x=>(year==='all'||String(x.year)===year)&&(paper==='all'||x.paper===paper));
    byId('amcExamCards').innerHTML=list.map(exam=>{
      const attempts=state.amc.attempts.filter(x=>x.examId===exam.id),timed=attempts.filter(x=>x.mode==='timed');
      const best=timed.length?Math.max(...timed.map(x=>x.score)):'—';
      return `<div class="amc-exam" data-exam-id="${exam.id}"><div class="row"><h3>${esc(exam.title)}</h3><span class="pill math">25 Q</span></div><div class="tiny muted amc-exam-state">${exam.cached?'✓ Paper saved offline':'Download on first practice'} · ${attempts.length} attempts</div><div class="tiny muted">Best timed score: <strong>${best}</strong>${timed.length?' / 150':''}</div><div class="row"><button class="btn primary sm" data-amc-start="${exam.id}" data-mode="timed" ${loadingId||state.amc.active?'disabled':''}>Timed mock</button><button class="btn sm" data-amc-start="${exam.id}" data-mode="practice" ${loadingId||state.amc.active?'disabled':''}>Untimed</button></div><div class="row"><button class="linkish tiny" data-amc-download="${exam.id}" ${loadingId?'disabled':''}>${loadingId===exam.id?'Downloading…':exam.cached&&exam.solutionsCached?'✓ Paper + solutions saved':'↓ Save paper + solutions offline'}</button><button class="linkish tiny" data-amc-source="${exam.id}">Source ↗</button></div></div>`;
    }).join('')||'<div class="empty">No papers match these filters.</div>';
  }
  function render(){
    if(!catalog.length)return;
    const attempts=state.amc.attempts,timed=attempts.filter(x=>x.mode==='timed'),reviews=state.amc.reviews.filter(x=>x.stage<3);
    byId('amcStats').innerHTML=[['Past papers',catalog.length,'550 real questions'],['Tests completed',attempts.length,`${timed.length} timed mocks`],['Best timed score',timed.length?Math.max(...timed.map(x=>x.score)):'—','Out of 150'],['AMC reviews due',dueReviews().length,`${reviews.length} questions to master`]].map(x=>`<div class="card metric"><div class="eyebrow">${x[0]}</div><div class="value">${x[1]}</div><div class="small">${x[2]}</div></div>`).join('');
    const active=state.amc.active;
    if(active||(selectedReport&&!attempts.some(x=>x.id===selectedReport)))byId('amcResults').classList.add('hide');
    byId('amcResume').classList.toggle('hide',!active);
    if(active)byId('amcResume').innerHTML=`<div class="row wrap"><div><strong>${esc(examById(active.examId)?.title||'Saved paper')} in progress</strong><div class="tiny">${modeName(active.mode)} · ${active.answers.filter(Boolean).length}/25 answered. ${active.mode==='timed'?'The clock continues if you close FORGE.':'Your answers and notes are saved.'}</div></div><button class="btn primary sm" id="amcResumeButton">Resume paper →</button></div>`;
    if(active)byId('amcResumeButton').onclick=()=>openSession();
    renderLibrary();renderHistory();renderReviews();
    if(context?.type==='session'&&!active)library();
    if(context?.type==='attempt'&&!current())library();
    if(context?.type==='review'&&!state.amc.reviews.some(x=>x.id===context.review.id))library();
    if(context&&currentExam()){renderSide();renderHeading();}
    const totalDue=dueMistakes().length+dueReviews().length;
    byId('navMistakes').textContent=totalDue?`(${totalDue})`:'';
    byId('mistakesDue').textContent=totalDue;
    byId('mistakesActive').textContent=state.mistakes.filter(x=>x.stage<3).length+reviews.length;
    byId('mistakesMastered').textContent=state.mistakes.filter(x=>x.stage===3).length+state.amc.reviews.filter(x=>x.stage===3).length;
    byId('dueBadge').textContent=`${totalDue} due`;
    const todayValues=byId('metrics').querySelectorAll('.value');
    if(todayValues[2])todayValues[2].textContent=state.mathAttempts.filter(x=>x.correct).length+attempts.reduce((sum,x)=>sum+(x.correct||0),0);
    if(todayValues[3])todayValues[3].textContent=totalDue;
    const insightValues=byId('insightsMetrics').querySelectorAll('.value');
    if(insightValues[2])insightValues[2].textContent=state.mathAttempts.length+attempts.length*25;
    if(dueReviews().length)byId('todayReview').innerHTML=`<div class="feature-box"><strong>${totalDue} questions ready</strong><div class="mini-note">Includes ${dueReviews().length} past AMC questions. Open Mistakes to review.</div></div>`;
  }
  function renderHistory(){
    const attempts=[...state.amc.attempts].reverse();
    byId('amcHistory').innerHTML=`<div class="section-head"><h2>Past-paper results</h2><span class="small-badge">${attempts.length} attempts</span></div>${state.amc.active?'<p class="tiny muted">Finish the current paper to review previous answers.</p>':''}`+(attempts.length?attempts.map(x=>`<div class="amc-history-row"><div><strong>${esc(examById(x.examId)?.title||x.examId)}</strong><div class="tiny muted">${modeName(x.mode)} · ${new Date(x.completedAt).toLocaleDateString()} · ${shortTime(x.elapsedSeconds)}${x.timedOut?' · time expired':''}</div></div><strong>${x.score} / 150</strong><button class="btn sm" data-amc-result="${esc(x.id)}" ${state.amc.active?'disabled':''}>Review</button></div>`).join(''):'<div class="empty">Finish a real past paper to see your score and question-by-question review.</div>');
  }
  function reviewMarkup(){
    const rows=[...state.amc.reviews].sort((a,b)=>Number(a.stage===3)-Number(b.stage===3)||a.next.localeCompare(b.next));
    return `<div class="section-head"><h2>Past AMC review queue</h2><span class="small-badge">${dueReviews().length} due today</span></div><p class="tiny muted">Missed and blank questions return for spaced review. Correct redos advance through three stages.</p>`+(rows.length?rows.map(x=>`<div class="amc-review-row"><div><strong>${esc(examById(x.examId)?.title||x.examId)} · Q${x.question}</strong><div class="tiny muted">${x.stage===3?'Mastered':`Next: ${fmtDate(x.next)}${x.next<=todayKey()?' · DUE':''}`}</div></div><span class="small-badge">${x.stage}/3</span><button class="btn sm" data-amc-review="${esc(x.id)}" ${x.stage===3||state.amc.active?'disabled':''}>${x.stage===3?'Done':'Redo'}</button></div>`).join(''):'<div class="empty">Missed and blank questions from submitted AMC papers will appear here.</div>');
  }
  function renderReviews(){byId('amcReviewQueue').innerHTML=reviewMarkup();byId('amcMistakes').innerHTML=reviewMarkup();}
  async function downloadExam(id,only=false,mode){
    if(loadingId)return;
    const exam=examById(id);if(!exam)return;
    if(!only&&state.amc.active){message('Finish or resume the current paper before starting another.');return;}
    loadingId=id;clearMessage();renderLibrary();
    try{
      const results=await Promise.allSettled([window.forgeDesktop.getAmcPdf(id,'problems'),window.forgeDesktop.getAmcPdf(id,'solutions')]);
      if(results[0].status==='rejected')throw results[0].reason;
      exam.cached=true;exam.solutionsCached=results[1].status==='fulfilled';
      if(only){toast(exam.solutionsCached?'Paper and solutions saved for offline practice.':'Paper saved. Solutions could not be downloaded.');return;}
      const now=Date.now();
      state.amc.active={id:crypto.randomUUID(),examId:id,mode,startedAt:now,deadline:mode==='timed'?now+75*60*1000:null,answers:Array(25).fill(''),notes:Array(25).fill(''),flags:Array(25).fill(false),checked:Array(25).fill(false),position:1};
      save();await openSession();
      if(!exam.solutionsCached)message('The paper is ready. Solutions need an internet connection when you open them.');
    }catch(error){message('This paper could not be loaded. Check your internet connection and try again. Your saved progress is unchanged.');}
    finally{loadingId=null;render();}
  }
  async function openSession(){
    if(!state.amc.active)return;
    if(expired()){finish(true);return;}
    context={type:'session'};question=Math.min(25,Math.max(1,state.amc.active.position||1));
    await openWorkspace('problems');
  }
  async function openAttempt(id,q=1){
    if(state.amc.active){toast('Finish the current paper before reviewing answers.');return;}
    const attempt=state.amc.attempts.find(x=>x.id===id);if(!attempt)return;
    context={type:'attempt',id};question=q;showResults(attempt);
    await openWorkspace('problems');
  }
  async function openReview(id){
    if(state.amc.active){toast('Finish the current paper before reviewing answers.');return;}
    const review=state.amc.reviews.find(x=>x.id===id);if(!review||review.stage===3)return;
    context={type:'review',review,answer:'',checked:false,correct:false};question=review.question;
    await openWorkspace('problems');
  }
  async function openWorkspace(kind){
    go('math');showPast();clearMessage();byId('amcWorkspace').classList.remove('hide');byId('amcLibrary').classList.add('hide');
    renderSide();renderHeading();render();
    await showDocument(kind);
    byId('amcWorkspace').scrollIntoView({behavior:'instant',block:'start'});
  }
  function renderHeading(){
    const exam=currentExam();if(!exam)return;
    byId('amcSessionTitle').textContent=exam.title;
    byId('amcSessionMeta').textContent=context.type==='review'?`Spaced review · question ${question}`:context.type==='attempt'?`Submitted ${modeName(current().mode).toLowerCase()} · ${current().score}/150`:`${modeName(current().mode)} · Answers and notes save automatically${current().mode==='timed'?' · The clock continues if you close the app':''}`;
    const actions=byId('amcSessionActions');
    actions.innerHTML=context.type==='session'?`<span class="tiny muted" id="amcAnsweredCount">${current().answers.filter(Boolean).length}/25 answered</span><button class="btn primary" id="amcSubmit">Submit and score →</button>`:context.type==='attempt'?`<button class="btn" id="amcBackToResults">View score report</button><span class="tiny muted">Choose any question to compare your answer and open its solution.</span>`:'<span class="tiny muted">Solve the question again before revealing the solution.</span>';
    if(byId('amcSubmit'))byId('amcSubmit').onclick=()=>{const a=current();if(!a)return;const blank=a.answers.filter(x=>!x).length;if(confirm(`Submit this paper? ${25-blank} answered, ${blank} blank. You cannot change submitted answers.`))finish(false);};
    if(byId('amcBackToResults'))byId('amcBackToResults').onclick=()=>byId('amcResults').scrollIntoView({behavior:'smooth'});
    tick();
  }
  function renderSide(){
    const exam=currentExam();if(!exam)return;
    const session=current(),i=question-1;
    const isReview=context.type==='review',isAttempt=context.type==='attempt';
    const answer=isReview?context.answer:session.answers[i];
    const revealed=isAttempt||(isReview?context.checked:session.mode==='practice'&&session.checked[i]);
    byId('amcQuestionNav').innerHTML=Array.from({length:25},(_,n)=>{
      const a=isReview?'':session.answers[n];
      const result=isAttempt?(a===exam.answers[n]?' right':' wrong'):'';
      return `<button class="amc-q${n===i?' selected':''}${a?' answered':''}${session?.flags[n]?' flagged':''}${result}" data-amc-question="${n+1}" aria-label="Question ${n+1}${a?', answered '+a:', blank'}" aria-current="${n===i?'true':'false'}" ${isReview&&n!==i?'disabled':''}>${n+1}</button>`;
    }).join('');
    const locked=isAttempt||revealed;
    byId('amcQuestionAnswer').innerHTML=`<div class="row"><h3>Question ${question}</h3>${!isReview?`<button class="linkish tiny" id="amcFlag" ${isAttempt?'disabled':''}>${session.flags[i]?'★ Flagged':'☆ Flag'}</button>`:''}</div><p class="tiny muted">Read the question and choices in the paper. Select your answer below.</p><div class="amc-options">${[...'ABCDE'].map(letter=>`<button class="amc-option${answer===letter?' chosen':''}${revealed&&exam.answers[i]===letter?' right':''}${revealed&&answer===letter&&answer!==exam.answers[i]?' wrong':''}" data-amc-answer="${letter}" aria-label="Answer ${letter}" aria-pressed="${answer===letter}" ${locked?'disabled':''}>${letter}</button>`).join('')}</div><div class="row wrap"><button class="btn ghost sm" id="amcBlank" ${locked?'disabled':''}>${answer?'Clear / leave blank':'Left blank'}</button>${isReview||session?.mode==='practice'?`<button class="btn primary sm" id="amcCheck" ${revealed?'disabled':''}>Check answer</button>`:''}</div>${revealed?`<div class="amc-feedback${answer===exam.answers[i]?'':' missed'}"><strong>${answer===exam.answers[i]?'✓ Correct':answer?'Not quite':'Left blank'} · Answer ${exam.answers[i]}</strong><div class="tiny">Your answer: ${answer||'blank'}${isReview?` · ${context.correct?'Next review scheduled.':'Review restarts tomorrow.'}`:''}</div></div><button class="btn sm" id="amcShowSolution">Read solution →</button> <button class="linkish tiny" id="amcShowProblem">Question paper</button>`:''}${!isReview?`<div class="amc-next-prev"><button class="btn sm" data-amc-question="${question-1}" ${question===1?'disabled':''}>← Previous</button><button class="btn sm" data-amc-question="${question+1}" ${question===25?'disabled':''}>Next →</button></div><label class="tiny muted" for="amcNotes">Working notes ${isAttempt?'':'(saved automatically)'}</label><textarea class="amc-notes" id="amcNotes" maxlength="100000" ${isAttempt?'readonly':''} placeholder="Record your reasoning or what to review…">${esc(session.notes[i])}</textarea>`:''}`;
    if(byId('amcFlag'))byId('amcFlag').onclick=()=>{if(!session||expired())return;session.flags[i]=!session.flags[i];save();renderSide();};
    byId('amcBlank').onclick=()=>choose('');
    if(byId('amcCheck'))byId('amcCheck').onclick=checkAnswer;
    if(byId('amcShowSolution'))byId('amcShowSolution').onclick=()=>showDocument('solutions');
    if(byId('amcShowProblem'))byId('amcShowProblem').onclick=()=>showDocument('problems');
    if(byId('amcNotes')&&!isAttempt)byId('amcNotes').oninput=event=>{if(!expired()){session.notes[i]=event.target.value;save();}};
    if(isAttempt||revealed||isReview||session?.mode==='practice'){
      const box=document.createElement('div');box.className='coach-question-tools';
      box.innerHTML=`<div class="eyebrow">GPT-6 LUNA COACH</div><button class="btn sm" id="amcAiHelp">${revealed?'Explain my mistake':'Give me a hint'}</button><p class="tiny muted">Sends this question${revealed?', its solution':''} and your notes to OpenAI when requested.</p>`;
      byId('amcQuestionAnswer').append(box);
      byId('amcAiHelp').onclick=()=>window.CoachUI?.askQuestion(revealed?'feedback':'hint');
    }
  }
  function choose(answer){
    if(!context||context.type==='attempt')return;
    if(expired()){finish(true);return;}
    if(context.type==='review'){if(context.checked)return;context.answer=answer;}
    else{const active=state.amc.active;if(!active||active.checked[question-1])return;active.answers[question-1]=answer;save();}
    renderSide();if(context.type==='session')byId('amcAnsweredCount').textContent=`${current().answers.filter(Boolean).length}/25 answered`;
  }
  function checkAnswer(){
    const exam=currentExam();if(!exam)return;
    if(context.type==='review'){
      if(context.checked)return;
      const review=context.review,correct=context.answer===exam.answers[question-1];
      context.checked=true;context.correct=correct;
      addActivity('practice');
      if(correct){review.stage++;review.next=review.stage>=3?todayKey():dateAdd(todayKey(),review.stage===1?3:6);if(review.stage===3)addActivity('review');}
      else{review.stage=0;review.next=dateAdd(todayKey(),1);}
      save();renderReviews();renderSide();render();
    }else if(context.type==='session'&&current()?.mode==='practice'){
      current().checked[question-1]=true;addActivity('practice');save();renderSide();
    }
  }
  function expired(){return !!(state.amc.active?.mode==='timed'&&state.amc.active.deadline<=Date.now());}
  function finish(timedOut){
    const active=state.amc.active;if(!active)return;
    const exam=examById(active.examId);if(!exam){message('This saved paper is not in the current library. Export a backup before resetting it.');return;}
    const completedAt=timedOut?active.deadline:Date.now();
    const result=AmcCore.score(active.answers,exam.answers);
    const attempt={...active,...result,completedAt,elapsedSeconds:Math.max(0,Math.round((completedAt-active.startedAt)/1000)),timedOut:!!timedOut};
    state.amc.attempts.push(attempt);
    addActivity('practice');
    active.answers.forEach((answer,i)=>{
      if(answer!==exam.answers[i]&&!state.amc.reviews.some(x=>x.examId===exam.id&&x.question===i+1&&x.stage<3))state.amc.reviews.push({id:crypto.randomUUID(),examId:exam.id,question:i+1,stage:0,next:dateAdd(todayKey(),1)});
    });
    state.mocks.push({name:`${exam.title} (${active.mode==='timed'?'timed mock':'untimed practice'})`,date:todayKey(),...result});
    for(let i=0;i<result.correct;i++)addActivity('math');
    state.amc.active=null;
    context=null;save();renderAll();library();go('math');showPast();showResults(attempt);
    byId('amcResults').scrollIntoView({behavior:'instant',block:'start'});
    if(timedOut)toast('Time is up. Your answers were scored automatically.');
  }
  function showResults(attempt){
    const exam=examById(attempt.examId);if(!exam)return;
    selectedReport=attempt.id;
    const result=AmcCore.score(attempt.answers,exam.answers);
    byId('amcResults').classList.remove('hide');
    byId('amcResults').innerHTML=`<div class="section-head"><div><div class="eyebrow">${esc(modeName(attempt.mode))} · ${shortTime(attempt.elapsedSeconds)}</div><h2>${esc(exam.title)} · ${result.score} / 150</h2></div><button class="btn sm" id="amcCloseResults">Close report</button></div><p class="muted">${result.correct} correct · ${result.wrong} wrong · ${result.blank} blank${attempt.timedOut?' · Submitted when time expired.':'.'}${attempt.mode==='practice'?' Untimed practice can include answer checks.':''}</p><p class="tiny muted">Select a question to reopen the paper and read its solution. Missed and blank questions have been added to your review queue.</p><div class="amc-result-grid">${attempt.answers.map((answer,i)=>`<button class="amc-result-question ${answer===exam.answers[i]?'right':'wrong'}" data-amc-result="${esc(attempt.id)}" data-question="${i+1}"><b>Q${i+1} ${answer===exam.answers[i]?'✓':answer?'×':'—'}</b><span>Your: ${answer||'blank'} · Key: ${exam.answers[i]}</span></button>`).join('')}</div><div class="mini-note">Score: 6 × ${result.correct} correct + 1.5 × ${result.blank} blank. Answer key verified against <button class="linkish tiny" data-amc-answer-source="${exam.id}">the source archive ↗</button>.</div>`;
    byId('amcCloseResults').onclick=()=>byId('amcResults').classList.add('hide');
  }
  async function getDoc(exam,kind){
    const key=exam.id+kind;
    if(docs.has(key))return docs.get(key);
    const promise=(async()=>{
      const payload=await window.forgeDesktop.getAmcPdf(exam.id,kind);
      if(kind==='problems')exam.cached=true;else exam.solutionsCached=true;
      if(!pdfModule){pdfModule=await import('./vendor/pdf.mjs');pdfModule.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',location.href).href;}
      const base=new URL('./vendor/',location.href).href;
      return pdfModule.getDocument({data:new Uint8Array(payload.bytes),isEvalSupported:false,useWasm:false,useWorkerFetch:false,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',iccUrl:base+'iccs/'}).promise;
    })();
    docs.set(key,promise);try{return await promise;}catch(error){docs.delete(key);throw error;}
  }
  async function showDocument(kind){
    const exam=currentExam();if(!exam)return;
    const token=++loadToken;docKind=kind;
    byId('amcPdfStatus').textContent=`Loading ${kind==='problems'?'question paper':'solutions'}…`;byId('amcPdfStatus').classList.remove('hide');byId('amcCanvas').classList.add('hide');
    try{
      const loaded=await getDoc(exam,kind);if(token!==loadToken)return;
      doc=loaded;pageNumber=(kind==='problems'?exam.questionPages:exam.solutionPages)[question-1]||1;
      byId('amcPdfPage').innerHTML=Array.from({length:doc.numPages},(_,i)=>`<option value="${i+1}">Page ${i+1} / ${doc.numPages}</option>`).join('');
      byId('amcPdfCaption').textContent=`${exam.title} · ${kind==='problems'?'Question paper':'Worked solutions'} · Q${question}`;
      byId('amcPdfCache').textContent='Saved for offline use on this device';
      await paintPdf();renderLibrary();
    }catch(error){
      if(token!==loadToken)return;
      doc=null;byId('amcPdfStatus').textContent='Could not display this PDF. Connect to the internet and retry, or use View source website to read it in your browser.';
      byId('amcPdfCache').innerHTML='<button class="linkish tiny" id="amcRetryPdf">Retry PDF</button>';
      byId('amcRetryPdf').onclick=()=>showDocument(kind);
      console.warn('FORGE PDF:',error.message);
    }
  }
  async function paintPdf(){
    if(!doc)return;
    const token=++renderToken;renderTask?.cancel();
    try{
      const pdfPage=await doc.getPage(pageNumber);if(token!==renderToken)return;
      const scroller=byId('amcPdfScroll');
      const natural=pdfPage.getViewport({scale:1});
      const width=Math.max(280,scroller.clientWidth-34)*(zoom/100);
      const viewport=pdfPage.getViewport({scale:width/natural.width});
      const canvas=byId('amcCanvas'),ratio=Math.min(2,window.devicePixelRatio||1);
      canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);
      canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
      canvas.setAttribute('aria-label',`${currentExam()?.title} ${docKind}, page ${pageNumber}`);
      renderTask=pdfPage.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
      await renderTask.promise;if(token!==renderToken)return;
      canvas.classList.remove('hide');byId('amcPdfStatus').classList.add('hide');scroller.scrollTop=0;
      byId('amcPdfPage').value=String(pageNumber);byId('amcZoom').textContent=`${zoom}%`;
      byId('amcPdfPrev').disabled=pageNumber===1;byId('amcPdfNext').disabled=pageNumber===doc.numPages;
    }catch(error){if(error.name!=='RenderingCancelledException')throw error;}
  }
  async function selectQuestion(number){
    if(number<1||number>25||context?.type==='review')return;
    if(expired()){finish(true);return;}
    question=number;if(context.type==='session'){current().position=number;save();}
    renderSide();await showDocument(docKind);
  }
  function tick(){
    if(expired()&&catalog.length){finish(true);return;}
    if(!context)return;
    const active=context.type==='session'?state.amc.active:null;
    byId('amcClockLabel').textContent=active?.mode==='timed'?'TIME REMAINING':context.type==='attempt'?'TIME USED':active?'PRACTICE TIME':'SPACED REVIEW';
    byId('amcClock').textContent=active?shortTime(Math.max(0,Math.ceil((active.mode==='timed'?active.deadline-Date.now():Date.now()-active.startedAt)/1000))):context.type==='attempt'?shortTime(current()?.elapsedSeconds||0):`Q${question}`;
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target||target.disabled)return;
    if(target.dataset.amcStart)downloadExam(target.dataset.amcStart,false,target.dataset.mode);
    else if(target.dataset.amcDownload)downloadExam(target.dataset.amcDownload,true);
    else if(target.dataset.amcQuestion)selectQuestion(Number(target.dataset.amcQuestion));
    else if(target.dataset.amcAnswer)choose(target.dataset.amcAnswer);
    else if(target.dataset.amcResult)openAttempt(target.dataset.amcResult,Number(target.dataset.question)||1);
    else if(target.dataset.amcReview)openReview(target.dataset.amcReview);
    else if(target.dataset.amcSource)window.forgeDesktop.openAmcSource(target.dataset.amcSource,'paper').catch(()=>toast('Could not open the source website.'));
    else if(target.dataset.amcAnswerSource)window.forgeDesktop.openAmcSource(target.dataset.amcAnswerSource,'answers').catch(()=>toast('Could not open the answer key.'));
  });
  byId('showPastPapers').onclick=showPast;
  byId('showQuickDrills').onclick=()=>{byId('amcPractice').classList.add('hide');byId('mathQuick').classList.remove('hide');byId('showPastPapers').classList.remove('primary');byId('showQuickDrills').classList.add('primary');byId('showPastPapers').setAttribute('aria-pressed','false');byId('showQuickDrills').setAttribute('aria-pressed','true');};
  byId('amcYear').onchange=renderLibrary;byId('amcPaper').onchange=renderLibrary;
  byId('amcBack').onclick=library;
  byId('amcPdfPage').onchange=()=>{pageNumber=Number(byId('amcPdfPage').value);paintPdf().catch(()=>toast('Could not render the page.'));};
  byId('amcPdfPrev').onclick=()=>{if(doc&&pageNumber>1){pageNumber--;paintPdf().catch(()=>{});}};
  byId('amcPdfNext').onclick=()=>{if(doc&&pageNumber<doc.numPages){pageNumber++;paintPdf().catch(()=>{});}};
  byId('amcZoomIn').onclick=()=>{zoom=Math.min(200,zoom+25);paintPdf().catch(()=>{});};
  byId('amcZoomOut').onclick=()=>{zoom=Math.max(50,zoom-25);paintPdf().catch(()=>{});};
  byId('amcSource').onclick=()=>{const exam=currentExam();if(exam)window.forgeDesktop.openAmcSource(exam.id,'paper').catch(()=>toast('Could not open the source website.'));};
  const notice=document.createElement('div');notice.id='amcNotice';notice.className='amc-error hide';notice.setAttribute('role','alert');byId('amcPractice').prepend(notice);
  async function coachContext(action){
    const exam=currentExam();if(!exam)throw Error('Open an AMC question first.');
    const session=current(),review=context.type==='review';
    if(session?.mode==='timed'&&context.type==='session')throw Error('AI feedback unlocks after you submit the timed mock.');
    const revealed=context.type==='attempt'||(review?context.checked:session?.checked[question-1]);
    if(action==='feedback'&&!revealed)throw Error('Check or submit your answer before requesting an explanation.');
    const images=[];
    for(const kind of action==='hint'?['problems']:['problems','solutions']){
      const pdf=await getDoc(exam,kind),pages=kind==='problems'?exam.questionPages:exam.solutionPages;
      const start=pages[question-1],next=pages[question]||pdf.numPages+1;
      const last=Math.min(pdf.numPages,Math.max(start,next-1),start+(kind==='problems'?1:2));
      for(let n=start;n<=last;n++){
        const p=await pdf.getPage(n),v=p.getViewport({scale:1}),viewport=p.getViewport({scale:1100/v.width});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await p.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        images.push({label:`${exam.title} ${kind}, page ${n}. Focus on question ${question}.`,data:canvas.toDataURL('image/png')});
      }
    }
    return {question:{examId:exam.id,title:exam.title,number:question,answer:review?context.answer:session.answers[question-1],notes:(review?'':session.notes[question-1]).slice(0,6000),revealed:!!revealed,timedActive:false},images};
  }
  async function openPractice(examId,number){
    if(!examById(examId)||!Number.isInteger(number)||number<1||number>25)return;
    if(state.amc.active){
      if(state.amc.active.examId!==examId||state.amc.active.mode==='timed'){toast('Finish the current paper before starting another practice.');return;}
      await openSession();
    }else await downloadExam(examId,false,'practice');
    if(context?.type==='session')await selectQuestion(number);
  }
  window.AMCController={render,coachContext,openPractice,examTitle:id=>examById(id)?.title||id,origin:()=>currentExam()?{examId:currentExam().id,number:question}:null};
  window.forgeDesktop.getAmcCatalog().then(exams=>{
    catalog=exams;byId('amcYear').innerHTML='<option value="all">All years</option>'+[...new Set(catalog.map(x=>x.year))].map(y=>`<option>${y}</option>`).join('');
    render();renderInsights();tick();
  }).catch(()=>message('The past-paper catalog could not be opened. Restart FORGE to try again.'));
  setInterval(tick,500);
})();
