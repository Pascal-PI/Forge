(function () {
  'use strict';
  const root = document.getElementById('workspaceRoot');
  const sidebar = document.getElementById('workspaceSidebar');
  let busy = false;
  let liveLabBusy = false;
  let liveLabSession = null;
  let liveLabStepBusy = false;
  const liveLabDrafts = new WeakMap();
  let liveLabAnimation = null;
  let pendingStream = null;
  let codeBusy = null;
  let codeError = null;
  let codeCancelRequested = false;
  let projectilePythonOpen = false;
  let error = '';
  let filter = '';
  let workspacePage = 'learn';
  let lessonPointer = null, lessonLoading = false, lessonLabBusy = false, lessonError = '', lessonPlaying = null;
  let quizSelection=[],quizNumber='',quizFollowupBusy=false;
  let showOpen=false, showLoading=false, showLesson=null, showPhase='idle', showCaption=0, showFeedback=null, showTimer=null, showToken=0, showMode='voice', showMessage='', showAudio=null, showVisual=null;
  let renderedSession = null, renameSessionId = null, renameDraft = '';
  const current = () => state.workspace.sessions.find(item => item.id === state.workspace.selected);
  const touch = session => { session.updatedAt = Date.now(); return save(); };
  const memorySettings = () => state.workspace.memory || {enabled:true,notes:''};
  function recentMemory(session) { return state.workspace.sessions.filter(item => item !== session && item.messages.some(message => message.role === 'user')).sort((a,b) => b.updatedAt - a.updatedAt).slice(0,3).map(item => ({title:item.title,excerpt:item.messages.filter(message => message.role === 'user').slice(-1)[0].text.slice(0,350)})); }
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  function stopLiveLabAnimation(){if(liveLabAnimation){clearTimeout(liveLabAnimation.timer);liveLabAnimation=null;}}
  function scheduleLiveLabAnimation(session,activity){
    const animation=liveLabAnimation;
    if(!animation || animation.session!==session || animation.activity!==activity)return;
    if(current()!==session || session.activity!==activity || workspacePage!=='learn' || document.hidden || reducedMotion.matches || animation.ticks>=120){stopLiveLabAnimation();render();return;}
    const block=activity.snapshot.scene.blocks.find(b=>b.type==='animation' && b.id===animation.id);
    if(!block){stopLiveLabAnimation();render();return;}
    clearTimeout(animation.timer);
    animation.timer=setTimeout(()=>{if(liveLabAnimation!==animation)return;animation.ticks++;performLiveLabEvent(session,activity,{type:'tick',id:block.id,dt:block.intervalMs});},block.intervalMs);
  }
  function performLiveLabEvent(session,activity,event){
    if(liveLabStepBusy)return;
    if(liveLabAnimation?.activity===activity)clearTimeout(liveLabAnimation.timer);
    liveLabStepBusy=true;
    const target=current()===session ? root.querySelector('[data-livelab-view]') : null;
    const restoreFocus=event.type==='drag' && target?.contains(document.activeElement) && document.activeElement?.getAttribute('data-livelab-id')===event.id;
    if(target){target.setAttribute('aria-busy','true');target.querySelectorAll(event.type==='tick'?'button,input':'button,input,textarea').forEach(el=>el.disabled=true);}
    let transition=null;
    window.forgeDesktop.liveLabStep({source:activity.source,snapshot:activity.snapshot,event}).then(snapshot=>{
      if(!state.workspace.sessions.includes(session)||session.activity!==activity)return;
      LiveLabScene.validate(snapshot);
      const previousSnapshot=activity.snapshot,previousUpdatedAt=session.updatedAt,previousInteraction=activity.lastInteraction;
      activity.snapshot=snapshot;
      if(event.type!=='tick')activity.lastInteraction=JSON.stringify({...event,...(typeof event.value==='string'?{value:event.value.slice(0,500)}:{})}).slice(0,700);
      if(!touch(session)){activity.snapshot=previousSnapshot;session.updatedAt=previousUpdatedAt;if(previousInteraction===undefined)delete activity.lastInteraction;else activity.lastInteraction=previousInteraction;throw Error('The LiveLab change could not be saved. The previous state was kept.');}
      if(event.type==='tick' && liveLabAnimation?.activity===activity && !reducedMotion.matches)transition={before:previousSnapshot.scene,after:snapshot.scene,duration:event.dt};
      if(event.type==='submit')liveLabDrafts.get(activity)?.delete(event.id);
    }).catch(failure=>{stopLiveLabAnimation();if(current()===session)error=String(failure.message||failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');})
      .finally(()=>{liveLabStepBusy=false;render();if(transition && liveLabAnimation?.activity===activity && current()===session && session.activity===activity){const view=root.querySelector('[data-livelab-view]');if(view)LiveLabView.animateTransition(view,transition.before,transition.after,transition.duration);}if(restoreFocus && current()===session && session.activity===activity)Array.from(root.querySelectorAll('[data-livelab-id]')).find(el=>el.getAttribute('data-livelab-id')===event.id)?.focus();if(liveLabAnimation?.activity===activity)scheduleLiveLabAnimation(session,activity);});
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden && showOpen && showPhase==='playing'){stopStudyShow('Playback paused while FORGE is in the background.');render();}if(document.hidden && liveLabAnimation){stopLiveLabAnimation();render();}});
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)stopLiveLabAnimation();render();});
  let codingGenerating=null;
  const activityNames = { livelab: 'LiveLab', 'livelab-creative':'LiveLab', 'binary-search': 'Binary search lab', 'school-question': 'Practice question', sorting: 'Sorting lab', 'number-line': 'Number line', coding: 'Coding challenge', 'coding-workspace': 'Coding workspace', 'equation-balance': 'Equation balance', projectile: 'Projectile playground' };
  const activityActions = { livelab:'livelab', 'binary-search': 'binary', 'school-question': 'practice', sorting: 'sorting', 'number-line': 'number-line', coding: 'coding-challenge', 'equation-balance': 'equation-balance', projectile: 'projectile' };
  function archiveActivity(session) {
    if (!session.activity) return true;
    session.activities ||= [];
    if (session.activities.length >= 100) { error = 'This session has 100 saved activities. Start another session to continue.'; render(); return false; }
    session.activities.push(session.activity);
    session.activity = null;
    return true;
  }

  function activityMarkup(session) {
    const activity = session?.activity;
    if (!activity) return '';
    if (activity.type === 'livelab-creative') return `<aside class="workspace-activity workspace-livelab-creative" aria-label="LiveLab"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">LiveLab</h2><button data-action="close-activity" aria-label="Close LiveLab">×</button></div><div class="livelab-utility"><span>INTERACTIVE LEARNING</span><div><button data-action="ask-livelab">Ask FORGE</button>${activity.initialSnapshot ? `<button data-action="reset-livelab" ${liveLabStepBusy ? 'disabled' : ''}>Reset lab</button>` : ''}</div></div><div data-livelab-view></div><h3>Try a prediction</h3><p>${esc(activity.question)}</p><details><summary>About, assumptions and checks</summary><p>${esc(activity.description)}</p><p>${esc(activity.assumptions)}</p><p>AI review: ${esc(activity.review)} These checks do not guarantee accuracy.</p></details></aside>`;
    if (activity.type === 'livelab') {
      const lab=activity.lab, vars=Object.create(null); lab.controls.forEach(c=>vars[c.id]=c.value);
      let graph='';
      try {
        const sets=lab.curves.map(curve=>Array.from({length:81},(_,i)=>{vars.x=lab.xMin+(lab.xMax-lab.xMin)*i/80;return LiveLabCore.evaluate(curve.expression,vars);}));
        const all=sets.flat(), low=Math.min(...all), high=Math.max(...all), span=high-low||1;
        graph=`<svg viewBox="0 0 400 220" role="img" aria-label="${esc(lab.yLabel)} plotted against ${esc(lab.xLabel)}"><path d="M20 10V200H390" fill="none" stroke="currentColor" opacity=".35"/>${sets.map((values,index)=>`<polyline points="${values.map((y,i)=>`${20+i*4.5},${195-(y-low)/span*180}`).join(' ')}" fill="none" stroke="${['#ed7958','#68a8e3','#55b98e'][index]}" stroke-width="3"/>`).join('')}</svg><p>${esc(lab.xLabel)}: ${lab.xMin}–${lab.xMax} · ${esc(lab.yLabel)}: ${low.toPrecision(4)}–${high.toPrecision(4)}</p><p>${lab.curves.map((c,i)=>`${['●','●','●'][i]} ${esc(c.label)}`).join(' · ')}</p>`;
      } catch { graph='<p role="alert">The model cannot calculate these settings. Change a control to continue.</p>'; }
      return `<aside class="workspace-activity workspace-livelab" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">${esc(lab.title)}</h2><button data-action="close-activity" aria-label="Close LiveLab">×</button></div><p>${esc(lab.description)}</p><div class="livelab-graph">${graph}</div>${lab.controls.map((c,i)=>`<label>${esc(c.label)}: <strong>${c.value}</strong><input type="range" data-livelab-control="${i}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}"></label>`).join('')}<h3>Try a prediction</h3><p>${esc(lab.question)}</p><details><summary>Model assumptions and checks</summary><p>${esc(lab.assumptions)}</p><p>AI review: ${esc(activity.review)} Model checks do not guarantee accuracy.</p></details></aside>`;
    }
    if (activity.type === 'projectile') {
      if (activity.stage === 'practice') {
        const choices = ['The range doubles', 'The range becomes four times larger', 'The range stays the same'];
        return `<aside class="workspace-activity workspace-projectile" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">Check your understanding</h2><button data-action="close-activity" aria-label="Close activity">×</button></div><p>Keep the angle at 45°. If you double the launch speed, what happens to the range?</p><div class="workspace-answers">${choices.map((choice, i) => `<button data-projectile-answer="${i}" aria-pressed="${activity.answer === i}">${String.fromCharCode(65 + i)}. ${choice}</button>`).join('')}</div>${activity.answer === null ? '<p>Think about how speed appears in the range equation.</p>' : activity.answer === 1 ? '<p role="status"><strong>Correct.</strong> Range is proportional to speed squared: doubling speed multiplies the range by four.</p><button data-action="projectile-build">Build the simulation</button>' : '<p role="status">Not quite. Range is proportional to speed squared. What is two squared? Try again.</p>'}<button data-action="projectile-explore">Back to the lab</button></aside>`;
      }
      if (activity.stage === 'build') {
        const result = activity.result === null ? null : activity.result ** 2 / 9.81;
        const endX = result === null ? 20 : 20 + 360 * result / (900 / 9.81);
        const peak = result === null ? 0 : 105 * (result / 4) / (900 / (4 * 9.81));
        const trajectory = `M 20 160 Q ${((20 + endX) / 2).toFixed(2)} ${(160 - 2 * peak).toFixed(2)} ${endX.toFixed(2)} 160`;
        const graph = result === null ? '<div class="projectile-ready">Run the simulation to see the launch.</div>' : `<svg class="projectile-simulation" viewBox="0 0 400 180" role="img" aria-label="Launch at ${activity.result} meters per second, predicted range ${result.toFixed(1)} meters"><path d="M 20 160 H 385" stroke="currentColor" opacity=".3"/><path d="${trajectory}" fill="none" stroke="#df7756" stroke-width="3"/><circle r="6" fill="#df7756" class="projectile-flight" style="offset-path:path('${trajectory}')"/><circle cx="${endX.toFixed(2)}" cy="160" r="3" fill="#47755b"/></svg>`;
        const python = activity.python ?? WorkspaceCore.projectileStarter, last = activity.lastPythonRun, running = codeBusy === activity;
        const numeric = last && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(last.output.trim()) ? Number(last.output.trim()) : NaN;
        const match = last && last.status === 'Accepted' && Number.isFinite(numeric) && Math.abs(numeric - last.speed ** 2 / 9.81) <= .051;
        const pythonPanel = `<details class="projectile-python" ${projectilePythonOpen || running || last || codeError?.activity === activity ? 'open' : ''}><summary>Edit and test the Python project</summary><p>Read a launch speed from input and print its range to one decimal place. The test uses the slider’s speed. Your code does not control the local diagram.</p><label for="projectilePython">Python code</label><textarea id="projectilePython" maxlength="8000" spellcheck="false" ${running ? 'disabled' : ''}>${esc(python)}</textarea><p>Your draft and last result are saved on this device and included in backups.</p><label class="workspace-run-consent"><input id="projectileConsent" type="checkbox" ${running ? 'disabled' : ''}> I agree to send this code and the speed to Judge0 Community Edition. Judge0 stores submissions. Do not include secrets or personal information.</label><button data-action="projectile-test-python" ${codeBusy ? 'disabled' : ''}>${running ? 'Running…' : 'Run Python test'}</button>${running ? '<button data-action="stop-code">Stop waiting</button><p role="status">Running Python test…</p>' : codeError?.activity === activity ? `<p role="alert">${esc(codeError.message)}</p>` : ''}${last ? `<div class="projectile-python-result"><h3>Last Python test</h3><p class="projectile-run-stale" ${last.code !== python || last.speed !== activity.speed ? '' : 'hidden'}>This result is from an earlier draft or speed.</p><p>${match ? 'Matches the model.' : 'Does not match the model.'} Expected ${(last.speed ** 2 / 9.81).toFixed(1)} m for ${last.speed} m/s.</p><p>Status: ${esc(last.status)}</p><pre>${esc(last.output || '(no output)')}</pre></div>` : ''}</details>`;
        return `<aside class="workspace-activity workspace-projectile" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">Build a launch simulation</h2><button data-action="close-activity" aria-label="Close activity">×</button></div><p>Choose a launch speed and run the model. This simulation uses a 45° angle, Earth gravity and level ground.</p><label for="projectileSpeed">Launch speed: <strong>${activity.speed} m/s</strong></label><input id="projectileSpeed" type="range" min="5" max="30" value="${activity.speed}"><pre class="projectile-code"><code>speed = ${activity.speed}\ngravity = 9.81\nrange_m = speed ** 2 / gravity\nprint(range_m)</code></pre><button data-action="projectile-run">Run simulation</button>${graph}${result === null ? '' : `<p role="status"><strong>${result.toFixed(1)} m</strong> predicted range at ${activity.result} m/s.${activity.result !== activity.speed ? ' Change the speed and run again to update the result.' : ''}</p>`}<p>The diagram above is calculated locally in FORGE.</p>${pythonPanel}<button data-action="projectile-explore">Return to the lab</button></aside>`;
      }
      const angle = activity.angle * Math.PI / 180;
      const range = 324 * Math.sin(2 * angle) / 9.81;
      const height = 324 * Math.sin(angle) ** 2 / 19.62;
      const points = Array.from({ length: 41 }, (_, i) => { const f = i / 40; return `${(20 + f * range / 33.03 * 360).toFixed(1)},${(200 - 4 * f * (1 - f) * height / 16.5 * 160).toFixed(1)}`; }).join(' ');
      return `<aside class="workspace-activity workspace-projectile" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">Projectile playground</h2><button data-action="close-activity" aria-label="Close activity">×</button></div><p>How does launch angle change the distance? Move the slider and compare the shape and range.</p><svg viewBox="0 0 400 220" role="img" aria-label="Trajectory for ${activity.angle} degrees, range ${range.toFixed(1)} meters"><path d="M20 15V200H385" fill="none" stroke="currentColor" opacity=".35"/><polyline points="${points}" fill="none" stroke="#ed7958" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><label for="projectileAngle">Launch angle: <strong>${activity.angle}°</strong></label><input id="projectileAngle" type="range" min="10" max="80" step="1" value="${activity.angle}"><div class="projectile-metrics"><p>Range <strong>${range.toFixed(1)} m</strong></p><p>Maximum height <strong>${height.toFixed(1)} m</strong></p><p>Launch speed <strong>18 m/s</strong></p></div><p>Earth gravity · Level ground · Air resistance excluded</p><p>At 45°, horizontal speed and flight time balance to maximize range on level ground.</p><button data-action="projectile-practice">Try a challenge</button></aside>`;
    }
    if (activity.type === 'equation-balance') {
      const result = WorkspaceCore.balanceState(activity);
      const left = result.constant === 0 ? 'x' : `x ${result.constant < 0 ? '−' : '+'} ${Math.abs(result.constant)}`;
      const hint = Math.abs(result.constant) <= 10 ? `Add ${-result.constant} to both sides to remove the constant.` : 'Move the constant toward zero in steps of at most 10.';
      const choices = Array.from({ length: 21 }, (_, index) => index - 10).filter(value => value !== 0).map(value => `<option value="${value}" ${value === -1 ? 'selected' : ''}>${value > 0 ? '+' : ''}${value}</option>`).join('');
      return `<aside class="workspace-activity" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">Equation balance</h2><button data-action="close-activity" aria-label="Close activity">×</button></div>
        <p>Isolate x by adding the same number to both sides. Each step keeps the equation balanced.</p><div class="workspace-equation" aria-label="${esc(left)} equals ${result.right}"><span>${esc(left)}</span><span>=</span><span>${result.right}</span></div>
        <p role="status">${result.finished ? `Solved. x = ${result.right}.` : `The equation is balanced after ${activity.moves.length} ${activity.moves.length === 1 ? 'step' : 'steps'}.`}</p>
        ${result.finished || activity.moves.length >= 30 ? '<button data-action="equation-balance">Try another equation</button>' : `<label for="balanceDelta">Add to both sides</label><select id="balanceDelta">${choices}</select><button data-action="balance-apply">Apply</button><button data-action="balance-hint" aria-expanded="${activity.hint}">Hint</button>${activity.hint ? `<p>${esc(hint)}</p>` : ''}`}</aside>`;
    }
    if (activity.type === 'coding-workspace') {
      const running=codeBusy===activity,exercise=activity.exercise,language=activity.language||'JavaScript',remote=['Python','C++','Java'].includes(language),matching=exercise && (exercise.language||'JavaScript')===language;
      return `<aside class="workspace-activity workspace-coding" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">${esc(matching?exercise.title:'Coding workspace')}</h2><button data-action="close-activity" aria-label="Close coding workspace">×</button></div>
        ${matching?`<p>${esc(exercise.prompt)}</p>`:'<p>Write code and supply input below.</p>'}
        <label for="codingLanguage">Language</label><select id="codingLanguage" ${running?'disabled':''}>${['JavaScript','TypeScript','Python','C++','Java'].map(x=>`<option value="${esc(x)}" ${language===x?'selected':''}>${esc(x)}</option>`).join('')}</select>
        <p>${remote?'Runs through Judge0 Community Edition. Internet required; the provider stores submissions. FORGE allows 20 remote runs per day; each test and reference check counts as one run.':'Runs locally in an isolated sandbox. Use console.log() for output and input() to read a line.'}</p><label for="workspaceCode">Your code</label><textarea id="workspaceCode" maxlength="8000" spellcheck="false" ${running?'disabled':''}>${esc(activity.code)}</textarea>
        <label for="codingInput">Program input (standard input)</label><textarea id="codingInput" maxlength="4000" ${running?'disabled':''}>${esc(activity.stdin)}</textarea>
        ${remote?`<label class="workspace-run-consent"><input type="checkbox" id="codingRemoteConsent" ${running?'disabled':''}> I agree to send code and input to Judge0, where submissions are stored. Creating an exercise also sends its AI-generated reference solution and test inputs.</label>`:''}
        ${activity.assignmentTopic?`<p>Exercise topic: ${esc(activity.assignmentTopic)}</p><button data-action="coding-assign" ${running?'disabled':''}>Create ${esc(language)} exercise</button>`:''}
        <div class="workspace-search-controls"><button data-action="coding-run" ${running?'disabled':''}>${running?'Running…':'Run code'}</button>${matching?`<button data-action="coding-test" ${running?'disabled':''}>Check exercise</button>`:''}</div>
        <section aria-live="polite"><h3>Output</h3><pre>${esc(activity.output || '(no output yet)')}</pre>${activity.runError?`<p role="alert">${esc(activity.runError)}</p>`:''}${activity.results.length?`<ol>${activity.results.map((r,i)=>`<li>${r.passed?'Passed':'Try again'} · input ${esc(exercise.tests[i].input || '(empty)')} · expected ${esc(exercise.tests[i].expected)} · received ${esc(r.error || r.output || '(empty)')}</li>`).join('')}</ol>`:''}</section><p>Draft, inputs and results are saved locally.</p></aside>`;
    }
    if (activity.type === 'coding') {
      const challenge = WorkspaceCore.codingChallenge;
      const running = codeBusy === activity;
      const last = activity.attempts.at(-1);
      const results = last ? last.tests.map((test, index) => {
        const expected = challenge.tests[index].expected;
        const passed = test.status === 'Accepted' && test.output.trim() === expected;
        return `<li>${passed ? 'Passed' : 'Not passed'} · input ${esc(challenge.tests[index].input.trim())} · expected ${esc(expected)} · output ${esc(test.output.trim() || '(empty)')} · ${esc(test.status)}</li>`;
      }).join('') : '';
      return `<aside class="workspace-activity workspace-coding" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">${esc(challenge.title)}</h2><button data-action="close-activity" aria-label="Close coding challenge">×</button></div>
        <p>${esc(challenge.prompt)}</p><p>Python · ${challenge.tests.length} public tests</p><label for="workspaceCode">Your solution</label><textarea id="workspaceCode" maxlength="8000" spellcheck="false" ${running ? 'disabled' : ''}>${esc(activity.code)}</textarea>
        <p>Your draft and test results are saved on this device and included in backups.</p><label class="workspace-run-consent"><input id="workspaceRunConsent" type="checkbox" ${running ? 'disabled' : ''}> I agree to send this code and the test inputs to Judge0 Community Edition. Judge0 stores submissions.</label>
        <div class="workspace-search-controls"><button data-action="run-code" ${codeBusy ? 'disabled' : ''}>${running ? 'Running tests…' : 'Run public tests'}</button>${running ? '<button data-action="stop-code">Stop waiting</button>' : ''}</div>
        ${running ? '<p role="status">Running public tests…</p>' : codeError?.activity === activity ? `<p role="alert">${esc(codeError.message)}</p>` : ''}${last ? `<section><h3>Last run</h3>${last.code !== activity.code ? '<p>These results are from an earlier draft.</p>' : ''}<ol>${results}</ol>${last.tests.length < challenge.tests.length ? '<p>The run did not finish all tests.</p>' : ''}</section>` : ''}</aside>`;
    }
    if (activity.type === 'sorting') {
      const result = WorkspaceCore.sortingState(activity);
      const cells = result.values.map((value, index) => `<li class="${!result.finished && (index === result.index || index === result.index + 1) ? 'middle' : ''}"><span>${index}</span><strong>${value}</strong></li>`).join('');
      const prior = activity.moves.length ? WorkspaceCore.sortingState({ ...activity, moves: activity.moves.slice(0, -1) }) : result;
      const feedback = result.finished ? 'The list is in ascending order.' : result.mistakes > prior.mistakes ? 'Try again. The smaller value should be on the left.' : activity.moves.length ? 'Correct. Compare the next pair.' : 'Compare the highlighted adjacent values.';
      return `<aside class="workspace-activity" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">Sorting lab</h2><button data-action="close-activity" aria-label="Close activity">×</button></div>
        <p>Use bubble sort to put the values in ascending order. Compare each highlighted pair and decide whether to swap it.</p>
        <ol class="workspace-search-array" aria-label="Values and indices">${cells}</ol><p>Comparisons ${result.comparisons} · Tries to revisit ${result.mistakes}</p><p role="status">${esc(feedback)}</p>
        ${result.finished || activity.moves.length >= 50 ? '<button data-action="sorting">Try another list</button>' : '<div class="workspace-search-controls"><button data-sort-move="keep">Keep in order</button><button data-sort-move="swap">Swap values</button></div>'}</aside>`;
    }
    if (activity.type === 'number-line') {
      const result = WorkspaceCore.lineState(activity);
      const last = activity.attempts.at(-1);
      const feedback = result.finished ? `Correct. The point is at ${activity.target}.` : last !== undefined ? `${last} is ${last < activity.target ? 'left' : 'right'} of the target. Try again.` : 'Move the point, then check your answer.';
      return `<aside class="workspace-activity" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">Number line</h2><button data-action="close-activity" aria-label="Close activity">×</button></div>
        <p>Place the point at <strong>${activity.target}</strong>. Use the slider or arrow keys to move it.</p><div class="workspace-number-line"><div class="workspace-line-labels"><span>−10</span><span>0</span><span>10</span></div><input id="workspaceLine" type="range" min="-10" max="10" step="1" value="${activity.position}" aria-label="Point on number line" ${result.finished ? 'disabled' : ''}><output id="workspaceLineValue" for="workspaceLine">${activity.position}</output></div>
        <p role="status">${esc(feedback)}</p>${result.finished || activity.attempts.length >= 50 ? '<button data-action="number-line">Try another number</button>' : '<button data-action="check-line">Check point</button>'}</aside>`;
    }
    if (activity.type === 'binary-search') {
      const result = WorkspaceCore.searchState(activity);
      const mid = Math.floor((result.low + result.high) / 2);
      const cells = WorkspaceCore.searchValues.map((value, index) => `<li class="${index < result.low || index > result.high ? 'ruled-out' : index === mid && !result.finished ? 'middle' : ''}"><span>${index}</span><strong>${value}</strong></li>`).join('');
      const lastMove = activity.moves.at(-1);
      let feedback = '';
      if (lastMove && !result.finished) {
        const previous = WorkspaceCore.searchState({ ...activity, moves: activity.moves.slice(0, -1) });
        feedback = result.mistakes > previous.mistakes ? 'Try again. Compare the target with the middle value.' : 'Correct. The remaining range has changed.';
      }
      if (result.finished) feedback = result.found ? `Found ${activity.target} in ${result.comparisons} comparisons.` : `${activity.target} is absent. The remaining range is empty.`;
      return `<aside class="workspace-activity" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">Binary search</h2><button data-action="close-activity" aria-label="Close activity">×</button></div>
        <p>Find <strong>${activity.target}</strong> in the sorted list. Compare it with the middle value, then choose where to search.</p>
        <ol class="workspace-search-array" aria-label="Sorted values and their indices">${cells}</ol>
        <p>Comparisons ${result.comparisons} · Tries to revisit ${result.mistakes}</p>
        <p role="status">${esc(feedback)}</p>
        ${result.finished || activity.moves.length >= 50 ? `<button data-action="binary">Try another target</button>` : `<div class="workspace-search-controls"><button data-search-move="left">Search left</button><button data-search-move="found">Found it</button><button data-search-move="right">Search right</button></div>`}</aside>`;
    }
    const question = SchoolCore.byId.get(activity.questionId);
    const answered = activity.answer !== null;
    return `<aside class="workspace-activity" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">Practice</h2><button data-action="close-activity" aria-label="Close practice">×</button></div>
      <p class="workspace-kicker">${esc(question.subject)} · ${esc(question.topic)}</p>
      ${question.passage ? `<blockquote>${esc(question.passage)}</blockquote>` : ''}
      <h3>${esc(question.prompt)}</h3><div class="workspace-answers">${question.choices.map((choice, index) => `<button data-answer="${index}" ${answered ? 'disabled' : ''}>${String.fromCharCode(65 + index)}. ${esc(choice)}</button>`).join('')}</div>
      ${!answered ? `<button data-action="hint" aria-expanded="${activity.hint}">Hint</button>${activity.hint ? `<p>Think about the main idea in ${esc(question.topic)}. Eliminate choices that contradict it.</p>` : ''}` : `<p role="status"><strong>${activity.answer === question.answer ? 'Correct.' : 'Not quite.'}</strong> ${esc(question.explanation)}</p><button data-action="practice">Try another question</button>`}</aside>`;
  }

  function renderTutorPath(plan, messageIndex, minutes) {
    const done = plan.filter(step => step.done).length;
    const next = plan.findIndex(step => !step.done);
    const estimate = Math.max(1, Math.round(minutes / plan.length));
    return `<section class="workspace-tutor-plan" id="workspace-plan-${messageIndex}" tabindex="-1" aria-label="Suggested learning path">
      <div class="path-plan-heading"><div><span class="path-eyebrow">YOUR LEARNING JOURNEY</span><h3>A path made for you</h3><p>Suggested by FORGE · about ${minutes} min total</p></div><span class="path-progress">${done} / ${plan.length} completed</span></div>
      <ol class="path-timeline">${plan.map((step, index) => `<li class="path-lesson ${step.done ? 'is-done' : index === next ? 'is-next' : 'is-upcoming'}"><div class="path-marker" aria-hidden="true"><span>${step.done ? '✓' : index + 1}</span></div><div class="path-lesson-content"><div class="path-lesson-meta">${step.done ? (step.completedBy === 'ai' ? 'COMPLETED BY FORGE' : 'PREVIOUSLY SELF-MARKED') : index === next ? 'RECOMMENDED NEXT' : 'UP NEXT'} <span>· ~${estimate} min</span></div><strong>${esc(step.text)}</strong><div class="path-lesson-actions"><button type="button" data-path-start-message="${messageIndex}" data-path-start-step="${index}">${step.done ? 'Review lesson' : index === next ? 'Start lesson' : 'Explore lesson'}</button></div></div></li>`).join('')}</ol>
      <p class="path-note">Times are rough estimates based on your session length. Open a lesson to learn, create a StudyShow, explore a LiveLab, and check your understanding. Progress is saved on this device.</p><button type="button" data-action="revise-path">Ask FORGE to adjust this path</button></section>`;
  }

  function selectedLesson(session) {
    if(!lessonPointer || lessonPointer.sessionId!==session?.id)return null;
    const step=session.messages[lessonPointer.messageIndex]?.plan?.[lessonPointer.stepIndex];
    return step ? {step,lesson:step.lesson} : null;
  }
  function stopLessonPlayback(){if(lessonPlaying){clearTimeout(lessonPlaying.timer);lessonPlaying=null;}}
  function lessonTick(session,lesson,id,dt){
    const playing=lessonPlaying;
    if(!playing || playing.lesson!==lesson || workspacePage!=='lesson' || current()!==session || document.hidden || reducedMotion.matches || playing.ticks>=120){stopLessonPlayback();return;}
    playing.timer=setTimeout(()=>{if(lessonPlaying!==playing)return;playing.ticks++;runLessonLabEvent(session,lesson,{type:'tick',id,dt});},dt);
  }
  function runLessonLabEvent(session,lesson,event){
    if(lessonLabBusy || !lesson.lab)return;
    lessonLabBusy=true; const lab=lesson.lab;render();
    window.forgeDesktop.liveLabStep({source:lab.source,snapshot:lab.snapshot,event}).then(snapshot=>{
      if(!state.workspace.sessions.includes(session)||selectedLesson(session)?.lesson!==lesson||lesson.lab!==lab)return;
      LiveLabScene.validate(snapshot);const before=lab.snapshot,previous=lab.lastInteraction,updated=session.updatedAt;lab.snapshot=snapshot;
      if(event.type!=='tick')lab.lastInteraction=JSON.stringify(event).slice(0,700);
      if(!touch(session)){lab.snapshot=before;session.updatedAt=updated;if(previous===undefined)delete lab.lastInteraction;else lab.lastInteraction=previous;throw Error('Could not save the lab. The previous state was kept.');}
      if(event.type==='submit')liveLabDrafts.get(lab)?.delete(event.id);
    }).catch(failure=>{stopLessonPlayback();lessonError=String(failure.message||failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');})
    .finally(()=>{lessonLabBusy=false;render();if(lessonPlaying?.lesson===lesson)lessonTick(session,lesson,lessonPlaying.id,lessonPlaying.dt);});
  }
  function renderQuizStats(lesson){
    const attempts=lesson.attempts || [], correct=attempts.filter(choice=>choice===lesson.correctIndex).length;
    if(!attempts.length)return lesson.passed ? '<p class="quiz-legacy">This lesson was completed before attempt tracking was available.</p>' : '<p class="quiz-legacy">Your attempt statistics will appear after you answer.</p>';
    return `<section class="quiz-stat-card" aria-label="This check’s statistics"><div class="quiz-stat-heading"><div><span>YOUR CHECK-IN</span><h3>How you did</h3></div><strong>${lesson.passed?'Completed':'In progress'}</strong></div><div class="quiz-stat-grid"><div><b>${attempts.length}</b><span>answer ${attempts.length===1?'attempt':'attempts'}</span></div><div><b>${Math.round(100*correct/attempts.length)}%</b><span>answers correct</span></div><div><b>${lesson.historyComplete===false?'—':attempts[0]===lesson.correctIndex?'Yes':'No'}</b><span>correct first try</span></div></div><div class="quiz-attempt-history"><strong>Attempt history</strong><ol>${attempts.map((choice,index)=>`<li><span>${index+1}</span><div>Choice ${String.fromCharCode(65+choice)} <small>${choice===lesson.correctIndex?'Correct':'Not quite'}</small></div></li>`).join('')}</ol></div><p>${lesson.historyComplete===false?'Earlier attempts were not recorded. ':''}Based on this single knowledge check, including retries; not a mastery score.</p></section>`;
  }
  function quizScreen(lesson){
    const quiz=lesson.quizV2,q=quiz.questions[quiz.index],attempts=quiz.attempts.filter(a=>a.questionId===q.id),last=attempts.at(-1),solved=attempts.some(a=>a.correct),completed=quiz.questions.every(x=>quiz.attempts.some(a=>a.questionId===x.id&&a.correct));
    const selection=solved&&Array.isArray(last?.response)?last.response:quizSelection;
    const controls=q.type==='number'?`<label for="quizNumber">Your answer</label><input id="quizNumber" inputmode="decimal" type="text" value="${esc(solved ? last.response : quizNumber)}" placeholder="Enter a number" ${solved?'disabled':''}>`:`<div class="lesson-choices" role="group" aria-label="Answer choices">${q.choices.map((choice,index)=>`<button type="button" data-quiz-option="${index}" aria-pressed="${selection.includes(index)}" ${solved?'disabled':''}><span>${String.fromCharCode(65+index)}</span>${esc(choice)}</button>`).join('')}</div>`;
    return `<div class="lesson-screen quiz-v2"><span class="lesson-eyebrow">KNOWLEDGE CHECK · QUESTION ${quiz.index+1} OF ${quiz.questions.length}</span><div class="quiz-meta"><span>${esc(q.topic)}</span><span>${esc(q.difficulty)}</span><span>${q.type==='multiple'?'Select all that apply':q.type==='number'?'Numerical answer':'Choose one'}</span></div><h2>${esc(q.prompt)}</h2>${controls}${!solved?`<button class="lesson-primary" data-action="quiz-submit">Check answer</button>`:''}${last?`<div class="lesson-feedback ${last.correct?'correct':'incorrect'}" role="status"><strong>${last.correct?'That’s right':'Not quite yet'}</strong><p>${esc(q.explanation)}</p>${!last.correct?'<p>Try again when you’re ready.</p>':''}</div>`:''}${last && !last.correct && quiz.questions.length<5 && !quiz.questions.some(x=>x.followupFor===q.id)?`<button data-action="quiz-followup" ${quizFollowupBusy?'disabled':''}>${quizFollowupBusy?'Preparing practice…':'Create a targeted follow-up'}</button><p class="quiz-help">Uses your connected AI account and the mistake shown here.</p>`:''}<div class="quiz-nav">${solved && quiz.index<quiz.questions.length-1?'<button class="lesson-primary" data-action="quiz-next">Next question</button>':''}${quiz.index>0?'<button data-action="quiz-prev">Previous question</button>':''}</div>${completed?`<section class="quiz-complete"><strong>Lesson complete</strong><p>You answered all ${quiz.questions.length} questions correctly. Mastery is tracked separately using first attempts across questions.</p></section>`:''}${renderMultiQuizStats(quiz)}</div>`;
  }
  function renderMultiQuizStats(quiz){
    const attempts=quiz.attempts,correct=attempts.filter(a=>a.correct).length,first=quiz.questions.map(q=>attempts.find(a=>a.questionId===q.id)).filter(Boolean),firstCorrect=first.filter(a=>a.correct).length;
    return `<section class="quiz-stat-card" aria-label="Quiz results"><div class="quiz-stat-heading"><div><span>YOUR CHECK-IN</span><h3>Quiz results</h3></div><strong>${first.length} / ${quiz.questions.length} questions tried</strong></div><div class="quiz-stat-grid"><div><b>${attempts.length}</b><span>answer attempts</span></div><div><b>${attempts.length?Math.round(100*correct/attempts.length)+'%':'—'}</b><span>answer accuracy</span></div><div><b>${first.length?Math.round(100*firstCorrect/first.length)+'%':'—'}</b><span>first-try accuracy</span></div></div><p>Based on recorded attempts, including retries. Mastery uses separate evidence and is not a grade.</p></section>`;
  }
  function stopStudyShow(message=''){
    showToken++;if(showTimer){clearTimeout(showTimer);showTimer=null;}if(showAudio){showAudio.pause();showAudio.removeAttribute('src');showAudio=null;}if(showPhase==='playing' && showMode==='voice' && window.speechSynthesis)window.speechSynthesis.cancel();
    if(showPhase==='playing')showPhase='paused';if(message)showMessage=message;
  }
  async function studyVoices(){
    const synth=window.speechSynthesis;if(!synth||!window.SpeechSynthesisUtterance)return [];
    let voices=synth.getVoices().filter(v=>v.localService===true);if(voices.length)return voices;
    await new Promise(resolve=>{let done=false,timer;const finish=()=>{if(done)return;done=true;clearTimeout(timer);synth.removeEventListener?.('voiceschanged',finish);resolve();};timer=setTimeout(finish,1000);synth.addEventListener?.('voiceschanged',finish,{once:true});});
    return synth.getVoices().filter(v=>v.localService===true);
  }
  async function playStudyCaption(session,lesson,token){
    const show=lesson.studyShow;if(token!==showToken||!showOpen||showLesson!==lesson||current()!==session||showPhase!=='playing')return;
    const scene=show.scenes[show.sceneIndex];
    if(showCaption>=scene.captions.length){
      if(scene.checkpoint&&!show.passed.includes(show.sceneIndex)){showPhase='checkpoint';showFeedback=null;render();return;}
      if(show.sceneIndex===show.scenes.length-1){showPhase='finished';render();return;}
      const before=show.sceneIndex,updated=session.updatedAt;show.sceneIndex++;
      if(!touch(session)){show.sceneIndex=before;session.updatedAt=updated;stopStudyShow('Could not save your StudyShow progress.');render();return;}
      showCaption=0;render();return playStudyCaption(session,lesson,token);
    }
    const caption=scene.captions[showCaption];render();
    if(showMode==='captions'){
      showTimer=setTimeout(()=>{showTimer=null;if(token!==showToken)return;showCaption++;playStudyCaption(session,lesson,token);},Math.max(1800,Math.min(9000,caption.length*65)));return;
    }
    const voices=await studyVoices();if(token!==showToken||showPhase!=='playing')return;
    if(!voices.length){
      try{
        showMessage='Preparing narration with a local Windows voice…';render();const result=await window.forgeDesktop.studyNarration(caption);
        if(token!==showToken||showPhase!=='playing')return;if(!result||typeof result.audio!=='string'||result.audio.length>6*1024*1024)throw Error('Invalid local narration.');
        const audio=new Audio('data:audio/wav;base64,'+result.audio);showAudio=audio;
        audio.onplaying=()=>{if(token===showToken){showMessage='Narration uses a local Windows voice.';render();}};
        audio.onended=()=>{if(token!==showToken||showPhase!=='playing')return;showAudio=null;showCaption++;playStudyCaption(session,lesson,token);};
        audio.onerror=()=>{if(token!==showToken)return;showAudio=null;showPhase='paused';showMessage='Local narration could not play. Choose captions-only playback to continue.';render();};
        await audio.play();return;
      }catch{if(token!==showToken)return;showAudio=null;showPhase='paused';showMessage='Local narration is unavailable. Choose captions-only playback to continue.';render();return;}
    }
    try{const utterance=new SpeechSynthesisUtterance(caption);utterance.voice=voices.find(v=>/^en[-_]?us$/i.test(v.lang||''))||voices[0];
      utterance.onstart=()=>{if(token===showToken&&showPhase==='playing'){showMessage='Narration uses an installed local voice.';render();}};
      utterance.onend=()=>{if(token!==showToken||showPhase!=='playing')return;showCaption++;playStudyCaption(session,lesson,token);};
      utterance.onerror=()=>{if(token!==showToken)return;showPhase='paused';showMessage='Narration could not play. Choose captions-only playback to continue.';render();};window.speechSynthesis.speak(utterance);
    }catch{showPhase='paused';showMessage='Narration could not play. Choose captions-only playback to continue.';render();}
  }
  function fitStudyDiagram(target){
    const svg=target.querySelector('svg');if(!svg)return;
    try{const box=svg.getBBox();if(!Number.isFinite(box.x)||!Number.isFinite(box.y)||box.width<=0||box.height<=0)return;
      let left=Math.max(0,box.x-90),top=Math.max(0,box.y-90),right=Math.min(1000,box.x+box.width+90),bottom=Math.min(1000,box.y+box.height+90);
      if(right<=left||bottom<=top)return;
      if(right-left<320){const mid=(left+right)/2;left=Math.max(0,mid-160);right=Math.min(1000,mid+160);}
      if(bottom-top<320){const mid=(top+bottom)/2;top=Math.max(0,mid-160);bottom=Math.min(1000,mid+160);}
      svg.setAttribute('viewBox',`${left} ${top} ${right-left} ${bottom-top}`);
    }catch{ /* Keep the original canvas if the browser cannot measure it. */ }
  }
  function renderStudyShow(session,selected){
    const shell=root.querySelector('.workspace-layout'),lesson=selected?.lesson,show=lesson?.studyShow;
    if(!selected||!lesson){showOpen=false;stopStudyShow();render();return;}
    if(showLoading){shell.innerHTML='<section class="lesson-player"><button data-action="show-exit">← Back to lesson</button><p role="status">FORGE is creating and checking your StudyShow…</p></section>';return;}
    if(!show){shell.innerHTML=`<section class="lesson-player"><button data-action="show-exit">← Back to lesson</button><h2>StudyShow could not be created</h2>${lessonError?`<p role="alert">${esc(lessonError)}</p>`:''}<button data-action="show-retry">Try again</button></section>`;return;}
    const scene=show.scenes[show.sceneIndex],checkpoint=scene.checkpoint,frameIndex=Math.min(showCaption,scene.captions.length-1),caption=scene.captions[frameIndex],frame=scene.frames?.[frameIndex]||scene.diagram;
    shell.classList.remove('workspace-expanded');shell.innerHTML=`<section class="lesson-player studyshow-player" aria-label="StudyShow"><header class="studyshow-top"><button data-action="show-exit">← Back to lesson</button><div><span>FORGE STUDYSHOW</span><h2>${esc(show.title)}</h2></div><span>${show.sceneIndex+1} / ${show.scenes.length}</span></header><ol class="studyshow-timeline" aria-label="StudyShow scenes">${show.scenes.map((item,index)=>`<li><button data-show-scene="${index}" ${index>show.sceneIndex?'disabled':''} ${index===show.sceneIndex?'aria-current="step"':''}><span>${index+1}</span>${esc(item.title)}</button></li>`).join('')}</ol><div class="studyshow-stage"><div class="studyshow-scene-label">SCENE ${show.sceneIndex+1} · ${esc(scene.title)}</div><div data-studyshow-diagram></div><div class="studyshow-captions" aria-live="polite">${esc(caption)}</div></div>${showMessage?`<p class="studyshow-note" role="status">${esc(showMessage)}</p>`:''}${showPhase==='checkpoint'&&checkpoint?`<section class="studyshow-checkpoint"><span>PAUSE &amp; THINK</span><h3>${esc(checkpoint.question)}</h3><div>${checkpoint.choices.map((choice,index)=>`<button data-show-choice="${index}" aria-pressed="${showFeedback===index}">${esc(choice)}</button>`).join('')}</div>${showFeedback!==null?`<p role="status">${showFeedback===checkpoint.correctIndex?'Correct.':'Not quite. Try another answer.'} ${esc(checkpoint.explanation)}</p>`:''}</section>`:''}<div class="studyshow-controls">${showPhase==='playing'?'<button data-action="show-pause">Pause</button>':showPhase==='checkpoint'?'':showPhase==='finished'?'<button data-action="show-replay">Replay</button>':`<button data-action="show-play">${showPhase==='paused'?'Resume narration':'Play narration'}</button><button data-action="show-captions">Play captions only</button>`}<button data-action="show-restart-scene">Replay scene</button><button data-action="show-lab">${showPhase==='finished'?'Continue to LiveLab':'Open LiveLab'}</button></div><p class="studyshow-note">Captions follow each spoken sentence. Narration uses an installed voice or Windows speech on this device. AI content may contain mistakes.</p></section>`;
    const target=shell.querySelector('[data-studyshow-diagram]'), visualKey=JSON.stringify([show.sceneIndex,frame]);LiveLabView.render(target,{title:scene.title,blocks:[frame]},()=>{});fitStudyDiagram(target);
    if(!showVisual || showVisual.key!==visualKey){if(!reducedMotion.matches){target.classList.add('studyshow-transition');if(showVisual)LiveLabView.animateTransition(target,{blocks:[showVisual.frame]},{blocks:[frame]},700);}showVisual={key:visualKey,frame};}
  }
  async function createStudyShow(session,step,lesson){
    if(busy)return;busy=true;showLoading=true;lessonError='';render();
    try{const data=await window.forgeDesktop.studyShow({topic:step.text,screens:lesson.screens});if(!state.workspace.sessions.includes(session)||step.lesson!==lesson)return;const show=StudyShowCore.normalize(data);lesson.studyShow=show;if(!touch(session)){delete lesson.studyShow;throw Error('Could not save StudyShow. Try again after freeing storage.');}}
    catch(failure){lessonError=String(failure.message||failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}
    finally{busy=false;showLoading=false;render();}
  }
  function renderLessonPlayer(session){
    const selected=selectedLesson(session),lesson=selected?.lesson;
    if(showOpen && showLesson===lesson){renderStudyShow(session,selected);return;}
    if(!selected){workspacePage='learn';lessonPointer=null;render();return;}
    const body=lessonLoading ? '<div class="lesson-loading" role="status">FORGE is preparing and checking your lesson…</div>' : !lesson ? '<p>Your lesson could not be prepared. Try again.</p><button data-action="lesson-retry">Try again</button>' : lesson.screen<2 ? `<div class="lesson-screen"><span class="lesson-eyebrow">${lesson.screen===0?'DISCOVER':'SEE IT IN ACTION'}</span><h2>${esc(lesson.screens[lesson.screen].heading)}</h2><p>${esc(lesson.screens[lesson.screen].body)}</p></div>` : lesson.screen===2 ? `<div class="lesson-screen"><span class="lesson-eyebrow">EXPLORE</span><h2>Try it in a LiveLab</h2><p>Experiment with this idea before the knowledge check.</p>${/\b(cod(?:e|ing)|program(?:ming)?|javascript|typescript|python|algorithm|function|software)\b/i.test(selected.step.text+' '+lesson.title)?'<button data-action="lesson-coding">Create coding exercise</button>':''}${lesson.lab ? `<div class="lesson-lab workspace-livelab-creative"><div data-lesson-livelab></div><h3>Try a prediction</h3><p>${esc(lesson.lab.question)}</p><details><summary>About this model</summary><p>${esc(lesson.lab.assumptions)}</p><p>${esc(lesson.lab.review)}</p></details></div>` : `<div class="lesson-lab-empty">${lessonLabBusy ? '<p role="status">Building and checking your LiveLab…</p>' : '<p>Create an interactive lab for this lesson. This uses your connected AI account.</p><button data-action="lesson-create-lab">Create LiveLab</button>'}</div>`}</div>` : lesson.quizV2 ? quizScreen(lesson) : `<div class="lesson-screen"><span class="lesson-eyebrow">KNOWLEDGE CHECK</span><h2>${esc(lesson.question)}</h2><div class="lesson-choices" role="group" aria-label="Answer choices">${lesson.choices.map((choice,index)=>`<button type="button" data-lesson-choice="${index}" aria-pressed="${lesson.selected===index}" ${lesson.passed ? 'disabled' : ''}><span>${String.fromCharCode(65+index)}</span>${esc(choice)}</button>`).join('')}</div>${lesson.selected!==null ? `<div class="lesson-feedback ${lesson.selected===lesson.correctIndex?'correct':'incorrect'}" role="status"><strong>${lesson.selected===lesson.correctIndex?'That’s right':'Not quite yet'}</strong><p>${esc(lesson.explanations[lesson.selected])}</p>${lesson.selected!==lesson.correctIndex?'<p>Choose another answer when you’re ready.</p>':''}</div>` : ''}${lesson.passed ? '<p class="lesson-complete">Lesson complete · You can review it anytime.</p>' : ''}${renderQuizStats(lesson)}</div>`;
    const shell=root.querySelector('.workspace-layout');
    shell.classList.remove('workspace-expanded');shell.innerHTML=`<section class="lesson-player" aria-label="Interactive lesson"><header class="lesson-player-top"><button data-action="lesson-exit">← Back to path</button><div><span>FORGE LESSON</span><strong>${esc(lesson?.title || selected.step.text)}</strong></div>${lesson ? `<button data-action="show-open">${lesson.studyShow?'Open StudyShow':'Create StudyShow'}</button><span class="lesson-count">${lesson.screen+1} / 4</span>` : ''}</header>${lesson ? `<div class="lesson-progress" aria-label="Screen ${lesson.screen+1} of 4"><span style="width:${(lesson.screen+1)*25}%"></span></div>` : ''}${lessonError?`<p class="workspace-error" role="alert">${esc(lessonError)}</p>`:''}${body}${lesson ? `<footer class="lesson-footer"><button data-action="lesson-back" ${lesson.screen===0 || lessonLabBusy?'disabled':''}>Back</button>${lesson.screen<3 ? `<button class="lesson-primary" data-action="lesson-next" ${lessonLabBusy?'disabled':''}>${lesson.screen===2 && !lesson.lab?'Continue without lab':'Continue'}</button>` : `<button class="lesson-primary" data-action="lesson-exit">${lesson.passed?'Return to path':'Finish later'}</button>`}</footer>`:''}</section>`;
    if(lesson?.screen===2 && lesson.lab){const lab=lesson.lab,target=shell.querySelector('[data-lesson-livelab]');if(!liveLabDrafts.has(lab))liveLabDrafts.set(lab,new Map());LiveLabView.render(target,lab.snapshot.scene,event=>{if(event.type==='toggle-animation'){if(reducedMotion.matches||lessonLabBusy)return;if(lessonPlaying?.lesson===lesson&&lessonPlaying.id===event.id){stopLessonPlayback();render();return;}stopLessonPlayback();const block=lab.snapshot.scene.blocks.find(b=>b.type==='animation'&&b.id===event.id);if(block){lessonPlaying={lesson,id:event.id,dt:block.intervalMs,ticks:0,timer:null};render();lessonTick(session,lesson,event.id,block.intervalMs);}return;}runLessonLabEvent(session,lesson,event);},{playingId:lessonPlaying?.lesson===lesson?lessonPlaying.id:null,reducedMotion:reducedMotion.matches,drafts:liveLabDrafts.get(lab)});if(lessonLabBusy)target.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true);}
  }
  async function createPathLesson(session,step){
    if(busy)return;lessonLoading=true;busy=true;lessonError='';render();
    try{
      const context=session.messages.filter(m=>m.role==='user'||m.role==='assistant').slice(-6).map(({role,text})=>({role,text:text.slice(0,800)}));
      const data=await window.forgeDesktop.pathLesson({topic:step.text,minutes:session.minutes,context});
      if(!state.workspace.sessions.includes(session)||!session.messages.some(m=>m.plan?.includes(step)))return;
      const q=data.questions?.find(item=>item.type==='single');if(!q || q.choices.length!==4)throw Error('The lesson response was incomplete.');
      const lesson=WorkspaceCore.normalizePathLesson({...data,question:q.prompt,choices:q.choices,correctIndex:q.answer[0],explanations:q.choices.map(()=>q.explanation),quizV2:{questions:data.questions,attempts:[],index:0},screen:0,selected:null,passed:false,lab:null,attempts:[],historyComplete:true});step.lesson=lesson;
      if(!touch(session)){delete step.lesson;throw Error('Could not save the lesson. Try again after freeing storage.');}
    }catch(failure){lessonError=String(failure.message||failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}
    finally{lessonLoading=false;busy=false;render();}
  }
  async function createQuizFollowup(session,step,lesson){
    const quiz=lesson.quizV2,q=quiz?.questions[quiz.index],last=quiz?.attempts.filter(a=>a.questionId===q.id).at(-1);
    if(!q||!last||last.correct||busy||quizFollowupBusy||quiz.questions.length>=5||quiz.questions.some(x=>x.followupFor===q.id))return;
    busy=true;quizFollowupBusy=true;lessonError='';render();
    try{const response=await window.forgeDesktop.pathLesson({mode:'followup',topic:q.topic,minutes:session.minutes,context:[],mistake:JSON.stringify({prompt:q.prompt,choices:q.choices,response:Array.isArray(last.response)?last.response.map(i=>q.choices[i]):last.response,explanation:q.explanation,difficulty:q.difficulty,demonstrated:quiz.questions.slice(0,5).map(item=>({topic:item.topic,firstCorrect:quiz.attempts.find(a=>a.questionId===item.id)?.correct??null,solved:quiz.attempts.some(a=>a.questionId===item.id&&a.correct)}))}).slice(0,1200)});if(!state.workspace.sessions.includes(session)||step.lesson!==lesson)return;const next=MasteryCore.question({...response.question,id:`followup_${crypto.randomUUID().replace(/-/g,'').slice(0,16)}`,followupFor:q.id});const before=quiz.questions.slice(),oldTime=session.updatedAt;quiz.questions.push(next);try{MasteryCore.normalizeQuiz(quiz);}catch(e){quiz.questions=before;throw e;}if(!touch(session)){quiz.questions=before;session.updatedAt=oldTime;throw Error('Could not save follow-up practice.');}}
    catch(e){lessonError=String(e.message||e).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}
    finally{busy=false;quizFollowupBusy=false;render();}
  }
  async function createLessonLab(session,step,lesson){
    if(busy||lessonLabBusy)return;busy=true;lessonLabBusy=true;lessonError='';render();
    try{
      const request=`Create an interactive educational LiveLab for this lesson: ${step.text}. Help the learner explore this idea: ${lesson.screens.map(x=>x.heading).join('; ')}.`;
      const result=await window.forgeDesktop.liveLab({request,context:[],kind:'creative',reuseCandidates:[]});
      if(!state.workspace.sessions.includes(session)||step.lesson!==lesson)return;
      if(result?.kind!=='creative' || typeof result.source!=='string' || !['description','assumptions','question','review'].every(k=>typeof result[k]==='string'))throw Error('The LiveLab response was invalid.');
      LiveLabScene.validate(result.snapshot);
      const lab={type:'livelab-creative',source:result.source,description:result.description,assumptions:result.assumptions,question:result.question,review:result.review,snapshot:result.snapshot,initialSnapshot:JSON.parse(JSON.stringify(result.snapshot)),...(result.reuse?{reuse:result.reuse}:{})};
      lesson.lab=lab;try{WorkspaceCore.normalizePathLesson(lesson);}catch(e){lesson.lab=null;throw e;}
      if(!touch(session)){lesson.lab=null;throw Error('Could not save the LiveLab. Try again after freeing storage.');}
    }catch(failure){lessonError=String(failure.message||failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}
    finally{busy=false;lessonLabBusy=false;render();}
  }

  function render() {
    const session = current();
    if(showOpen && (workspacePage!=='lesson'||selectedLesson(session)?.lesson!==showLesson)){stopStudyShow();showOpen=false;showLesson=null;}
    if(liveLabAnimation && (liveLabAnimation.session!==session || session?.activity!==liveLabAnimation.activity || workspacePage!=='learn'))stopLiveLabAnimation();
    const oldMessages = document.getElementById('workspaceMessages');
    const sameSession = renderedSession === (session?.id || null);
    const focusedLabInput=sameSession && session?.activity?.type==='livelab-creative' ? document.activeElement?.getAttribute('data-livelab-input') : null;
    const labSelection=focusedLabInput ? [document.activeElement.selectionStart,document.activeElement.selectionEnd] : null;
    const scrollTop = oldMessages?.scrollTop || 0;
    const followLatest = !sameSession || !oldMessages || oldMessages.scrollHeight - oldMessages.scrollTop - oldMessages.clientHeight < 32;
    const focused = sameSession && ['workspaceInput', 'workspaceCode', 'codingInput', 'workspaceRenameInput', 'workspaceSearch', 'workspaceLearningGoal', 'projectilePython'].includes(document.activeElement?.id) ? document.activeElement.id : null;
    const selectionStart = focused ? document.activeElement.selectionStart : null;
    const selectionEnd = focused ? document.activeElement.selectionEnd : null;
    const sessions = [...state.workspace.sessions].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
      .filter(item => item.title.toLowerCase().includes(filter.toLowerCase()));
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString();
    const welcome = `<section class="workspace-welcome" aria-label="Start learning"><div class="welcome-copy"><span class="workspace-kicker">MAKE ROOM FOR CURIOSITY</span><h2>Bring the question.<br>Build understanding.</h2><p>Ask your tutor, explore an interactive lab, and practice what you learn. Start by choosing how much time you have.</p><div class="welcome-steps"><span>01 <strong>Ask</strong></span><span>02 <strong>Explore</strong></span><span>03 <strong>Practice</strong></span></div></div><div class="welcome-art"><div><span>YOUR NEXT DISCOVERY</span><strong>From curiosity<br>to capability.</strong><small>One question can lead anywhere.</small></div></div></section>`;
    const sessionGroups = [
      ['Pinned', sessions.filter(item => item.pinned)],
      ['Today', sessions.filter(item => !item.pinned && new Date(item.updatedAt).toDateString() === today)],
      ['Yesterday', sessions.filter(item => !item.pinned && new Date(item.updatedAt).toDateString() === yesterday)],
      ['Earlier', sessions.filter(item => !item.pinned && ![today, yesterday].includes(new Date(item.updatedAt).toDateString()))]
    ];
    root.innerHTML = `<div class="workspace-layout${session?.expanded && session.activity ? ' workspace-expanded' : ''}"><aside class="workspace-sessions" aria-label="Learning sessions">
      <h2>Sessions</h2><button class="workspace-new" data-action="new">+ New learning session</button><label for="workspaceSearch">Search conversations</label><input id="workspaceSearch" value="${esc(filter)}" placeholder="Search">
      <div class="workspace-list">${sessionGroups.filter(([, items]) => items.length).map(([label, items]) => `<section aria-label="${label}"><h3>${label}</h3>${items.map(item => `<button data-session="${esc(item.id)}" ${item.id === session?.id ? 'aria-current="true"' : ''}>${esc(item.title)}<small>${new Date(item.updatedAt).toLocaleDateString()}</small></button>`).join('')}</section>`).join('')}</div>
      <div class="workspace-links"><button data-action="workspace-learn">Learning workspace</button>${session?'<button data-action="open-coding-workspace">Coding workspace</button>':''}<button data-action="workspace-progress">Progress</button><button data-action="workspace-settings">Settings and backups</button></div></aside>
      <div class="workspace-chat"><header><div><span class="workspace-kicker">FORGE LEARNING</span>${session && renameSessionId===session.id ? `<form id="workspaceRenameForm"><label for="workspaceRenameInput">Chat name</label><input id="workspaceRenameInput" maxlength="100" value="${esc(renameDraft)}" required><button type="submit">Save name</button><button type="button" data-action="rename-cancel">Cancel</button></form>` : `<h1>${esc(session?.title || 'What would you like to learn?')}</h1>`}${session ? `<span>${session.minutes} minute plan</span>` : ''}</div>${session ? '<div class="workspace-actions"><button data-action="pin">'+(session.pinned?'Unpin':'Pin')+'</button><button data-action="rename">Rename</button><button data-action="delete">Delete</button></div>' : ''}</header>
      <div class="workspace-messages" id="workspaceMessages" aria-live="polite">${session ? session.messages.map((message, messageIndex) => `<article class="workspace-message ${message.role}"><strong>${message.role === 'user' ? 'You' : 'FORGE'}</strong>${message.role === 'assistant' ? `<div class="workspace-rich-text">${WorkspaceMarkup.render(message.text)}</div>` : `<p>${esc(message.text)}</p>`}${message.plan ? renderTutorPath(message.plan, messageIndex, session.minutes) : ''}${message.activity ? `<button data-action="${activityActions[message.activity]}" ${message.activity === 'livelab' ? `data-livelab-message="${messageIndex}"` : ''}>${message.activity === 'livelab' ? 'Create' : 'Open'} ${activityNames[message.activity]}</button>` : ''}</article>`).join('') : welcome}${pendingStream && pendingStream.session === session ? `<article class="workspace-message streaming"><strong>FORGE</strong><p id="workspaceStream" aria-live="off">${esc(pendingStream.text)}</p></article><p role="status">FORGE is responding…</p>` : ''}${codingGenerating===session?'<p role="status">FORGE is preparing your coding exercise…</p>':''}${liveLabBusy && liveLabSession === session ? '<div class="workspace-lab-pending"><span role="status">Building and checking your LiveLab…</span><button type="button" data-action="stop-livelab">Cancel</button></div>' : ''}${error ? `<p class="workspace-error" role="alert">${esc(error)}</p>` : ''}</div>
      ${!session ? '<div class="workspace-durations"><button data-minutes="15">15 minutes</button><button data-minutes="25">25 minutes</button><button data-minutes="40">40 minutes</button></div>' : `<form id="workspaceForm"><label for="workspaceInput">Your message</label><textarea id="workspaceInput" maxlength="4000" required placeholder="Ask a question or describe what you want to learn…">${esc(session.draft || '')}</textarea><div><button type="submit" ${busy ? 'disabled' : ''}>Send</button>${pendingStream?.session === session ? '<button type="button" data-action="stop-tutor">Stop response</button>' : ''}${session.messages.at(-1)?.role === 'user' && !busy ? '<button type="button" data-action="retry">Retry last message</button>' : ''}<button type="button" data-action="draft-path">Plan my learning path</button>${session.messages.length === 0 ? `<button type="button" data-action="suggest" ${busy ? 'disabled' : ''}>Suggest a starting point</button>` : ''}</div><p class="workspace-privacy">Sending shares this chat, your learning goal, and short School, activity and path summaries with OpenAI. When cross-chat memory is on, your memory notes and excerpts from up to three recent chats are shared too; manage them in Settings and backups. LiveLab summaries can include your last submitted response and displayed feedback. API usage is billed to your key. Drafts stay on this device until sent.</p></form>`}
      ${session?.activities?.length ? `<details class="workspace-history"><summary>Saved activities (${session.activities.length})</summary><div>${session.activities.map((item, index) => `<button data-activity-index="${index}">${esc(activityNames[item.type])}${item.type === 'livelab-creative' ? ' · ' + esc(item.snapshot.scene.title) : item.type === 'livelab' ? ' · ' + esc(item.lab.title) : item.type === 'school-question' ? ' · ' + esc(SchoolCore.byId.get(item.questionId).topic) : item.target !== undefined ? ' · target ' + item.target : ''}</button>`).join('')}</div></details>` : ''}
      </div>${activityMarkup(session)}</div>`;
    sidebar.replaceChildren(root.querySelector('.workspace-sessions'));
    if(workspacePage==='lesson'){renderLessonPlayer(session);return;}
    if(session?.activity?.type==='livelab-creative') {
      const activity=session.activity, target=root.querySelector('[data-livelab-view]');
      if(!liveLabDrafts.has(activity))liveLabDrafts.set(activity,new Map());
      if(target)LiveLabView.render(target,activity.snapshot.scene,event=>{
        if(event.type==='toggle-animation'){
          if(liveLabStepBusy || reducedMotion.matches)return;
          if(liveLabAnimation?.activity===activity && liveLabAnimation.id===event.id){stopLiveLabAnimation();render();return;}
          stopLiveLabAnimation();liveLabAnimation={session,activity,id:event.id,ticks:0,timer:null};render();scheduleLiveLabAnimation(session,activity);return;
        }
        performLiveLabEvent(session,activity,event);
      },{playingId:liveLabAnimation?.activity===activity?liveLabAnimation.id:null,reducedMotion:reducedMotion.matches,drafts:liveLabDrafts.get(activity)});
    }
    if (session) {
      const historyIndex = session.activities?.findLastIndex(item => item.type === 'projectile') ?? -1;
      const active = session.activity?.type === 'projectile';
      const path = active ? session.activity : historyIndex >= 0 ? session.activities[historyIndex] : null;
      if (path) {
        const steps = [
          ['Explore a trajectory', path.explored ? 'Angle adjusted' : 'Try changing the launch angle', Boolean(path.explored)],
          ['Check your understanding', path.answer === 1 ? 'Answered correctly' : path.answer === null ? 'Ready when you are' : 'Try the question again', path.answer === 1],
          ['Run the simulation', path.result === null ? 'Build and run the model' : `Ran at ${path.result} m/s · ${(path.result ** 2 / 9.81).toFixed(1)} m`, path.result !== null]
        ];
        const panel = document.createElement('section');
        panel.className = 'workspace-path';
        panel.setAttribute('aria-label', 'Projectile learning path');
        panel.innerHTML = `<div class="workspace-path-heading"><div><span class="workspace-kicker">YOUR LEARNING PATH</span><h2>From question to project</h2></div><span>${steps.filter(step => step[2]).length} / 3 steps</span></div><ol>${steps.map(([title, detail, done]) => `<li><span class="path-check" aria-hidden="true">${done ? '✓' : '○'}</span><div><strong>${title}</strong><small>${detail}</small></div></li>`).join('')}</ol>${active ? '<button data-action="projectile-resume">Continue learning</button>' : `<button data-activity-index="${historyIndex}">Resume saved path</button>`}<p>Progress reflects actions recorded in this session.</p>`;
        root.querySelector('#workspaceForm')?.after(panel);
      }
    }
    root.querySelectorAll('.workspace-rich-text pre').forEach(pre => {
      if (!pre.querySelector('code')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'workspace-code-block';
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.copyCode = '';
      button.textContent = 'Copy code';
      pre.replaceWith(wrapper);
      wrapper.append(button, pre);
    });
    const activityHeader = root.querySelector('.workspace-activity-header');
    if (activityHeader) {
      const expand = document.createElement('button');
      expand.type = 'button';
      expand.dataset.action = 'expand-activity';
      expand.setAttribute('aria-pressed', String(Boolean(session.expanded)));
      expand.textContent = session.expanded ? 'Exit expanded view' : 'Expand';
      activityHeader.insertBefore(expand, activityHeader.lastElementChild);
    }
    const search = document.getElementById('workspaceSearch');
    search.addEventListener('input', () => { filter = search.value; render(); });
    if (workspacePage !== 'learn') {
      const layout = root.querySelector('.workspace-layout');
      layout.classList.remove('workspace-expanded');
      const panel = workspacePage === 'progress' ? progress : settings;
      layout.replaceChildren(panel);
      if (workspacePage === 'progress') renderProgress(); else renderSettings();
      renderedSession = session?.id || null;
      return;
    }
    const composer = document.getElementById('workspaceForm');
    if (composer) {
      const importer = document.createElement('div');
      importer.className = 'workspace-import';
      importer.innerHTML = `<label for="workspaceLearningGoal">What do you want to learn or build? <span>(optional)</span></label><input id="workspaceLearningGoal" type="text" maxlength="300" value="${esc(session.learningGoal || '')}" placeholder="e.g. Build a launch simulator"><button type="button" data-action="prepare-learning-path">Use goal in draft</button><label for="workspaceNotes">Drop notes here or choose a file (.txt or .pdf)</label><input id="workspaceNotes" type="file" accept=".txt,text/plain,.pdf,application/pdf"><p>Your goal and notes stay on this device until you send the draft to the tutor.</p>`;
      composer.querySelector('textarea').after(importer);
    }
    document.getElementById('workspaceRenameForm')?.addEventListener('submit', event => {
      event.preventDefault();
      if(!session || renameSessionId!==session.id)return;
      const title=document.getElementById('workspaceRenameInput').value.trim();
      if(!title){document.getElementById('workspaceRenameInput').focus();return;}
      const oldTitle=session.title,oldEdited=session.titleEdited,oldUpdated=session.updatedAt;
      session.title=title.slice(0,100);session.titleEdited=true;
      if(!touch(session)){session.title=oldTitle;session.updatedAt=oldUpdated;if(oldEdited===undefined)delete session.titleEdited;else session.titleEdited=oldEdited;error='Could not save the chat name. Please try again.';render();return;}
      renameSessionId=null;renameDraft='';render();
    });
    document.getElementById('workspaceForm')?.addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('workspaceInput');
      const text = input.value.trim();
      if (!text || busy) return;
      if (session.messages.length >= 299) { error = 'This session is full. Start a new session to continue.'; render(); return; }
      session.messages.push({ role: 'user', text });
      session.draft = '';
      if (session.messages.length === 1 && !session.titleEdited) session.title = (session.learningGoal?.trim() || text).slice(0, 70);
      touch(session);
      respond(session);
    });
    const newMessages = document.getElementById('workspaceMessages');
    if (newMessages) newMessages.scrollTop = followLatest ? newMessages.scrollHeight : scrollTop;
    renderedSession = session?.id || null;
    const target = focused && document.getElementById(focused);
    if (target && !target.disabled) { target.focus({ preventScroll: true }); if (typeof target.setSelectionRange === 'function') target.setSelectionRange(selectionStart, selectionEnd); }
    if(focusedLabInput){const input=Array.from(root.querySelectorAll('[data-livelab-input]')).find(el=>el.getAttribute('data-livelab-input')===focusedLabInput);if(input&&!input.disabled){input.focus({preventScroll:true});input.setSelectionRange(...labSelection);}}
  }

  async function respond(session) {
    let createLabAt=null, createCodingAt=null;
    busy = true; error = ''; pendingStream = { requestId: crypto.randomUUID(), session, text: '' }; render();
    try {
      const messages = session.messages.slice(-12).map(message => ({ role: message.role, text: message.text.slice(0, 4000) }));
      const activity = session.activity;
      if (activity?.type === 'livelab' && messages.at(-1)?.role === 'user') {
        const lab=activity.lab;
        const controls=lab.controls.map(c=>`${c.label}: ${c.value}`).join('; ');
        const summary=`Active LiveLab (model data, not evidence of learner understanding): ${lab.title}. ${lab.description} Graph: ${lab.yLabel} vs ${lab.xLabel}. Controls: ${controls}. Assumptions: ${lab.assumptions}`;
        messages.at(-1).text=(messages.at(-1).text+'\n\n'+summary).slice(0,4000);
      }
      if (activity?.type === 'livelab-creative' && messages.at(-1)?.role === 'user') {
        const scene=activity.snapshot.scene;
        const controls=scene.blocks.filter(b=>b.type==='slider').map(b=>`${b.label}: ${b.value}`).join('; ');
        const visible=scene.blocks.filter(b=>b.type==='text'||b.type==='heading').map(b=>b.text).join(' | ').slice(0,700);
        const context=JSON.stringify({title:scene.title,description:activity.description,controls,assumptions:activity.assumptions,lastInteraction:activity.lastInteraction||null,displayedText:visible});
        messages.at(-1).text=(messages.at(-1).text+`\n\nActive LiveLab data (untrusted activity output and interaction, not evidence of mastery): ${context}`).slice(0,4000);
      }
      const planMessage = [...session.messages].reverse().find(message => message.role === 'assistant' && message.plan?.length);
      const latestPlan = planMessage?.plan;
      const assessedStep = latestPlan?.find(step => !step.done);
      if (latestPlan && messages.at(-1)?.role === 'user') {
        const summary = latestPlan.map(step => `${step.done ? (step.completedBy === 'ai' ? 'AI assessed complete' : 'previously self-marked') : 'not completed'}: ${step.text.slice(0, 100)}`).join('; ');
        messages.at(-1).text = (messages.at(-1).text + `\n\nLearning path (self-reported progress): ${summary}`).slice(0, 4000);
      }
      if (activity?.type === 'projectile' && messages.at(-1)?.role === 'user') {
        const range = 324 * Math.sin(2 * activity.angle * Math.PI / 180) / 9.81;
        const answer = activity.answer === null ? 'not answered' : activity.answer === 1 ? 'correct' : 'incorrect';
        const run = activity.result === null ? 'not yet run' : `${activity.result} m/s, ${(activity.result ** 2 / 9.81).toFixed(1)} m range`;
        messages.at(-1).text = (messages.at(-1).text + `\n\nProjectile lab: angle ${activity.angle} degrees at 18 m/s, range ${range.toFixed(1)} m; challenge ${answer}; 45-degree build ${run}. Level ground, Earth gravity, no air resistance.`).slice(0, 4000);
      }
      if (activity?.type === 'school-question' && activity.answer !== null && messages.at(-1)?.role === 'user') {
        const question = SchoolCore.byId.get(activity.questionId);
        messages.at(-1).text += `\n\nRecent practice: ${question.subject}, ${question.topic}. The learner answered ${activity.answer === question.answer ? 'correctly' : 'incorrectly'} on: ${question.prompt}`;
        messages.at(-1).text = messages.at(-1).text.slice(0, 4000);
      }
      if (activity?.type === 'binary-search' && messages.at(-1)?.role === 'user') {
        const result = WorkspaceCore.searchState(activity);
        messages.at(-1).text += `\n\nRecent binary search practice: target ${activity.target}, ${result.comparisons} correct comparisons, ${result.mistakes} incorrect choices, ${result.finished ? (result.found ? 'found' : 'not present') : 'in progress'}.`;
        messages.at(-1).text = messages.at(-1).text.slice(0, 4000);
      }
      if (activity?.type === 'sorting' && messages.at(-1)?.role === 'user') {
        const result = WorkspaceCore.sortingState(activity);
        messages.at(-1).text = (messages.at(-1).text + `\n\nSorting practice: ${result.comparisons} correct comparisons, ${result.mistakes} incorrect choices, ${result.finished ? 'completed' : 'in progress'}.`).slice(0, 4000);
      }
      if (activity?.type === 'number-line' && messages.at(-1)?.role === 'user') {
        const result = WorkspaceCore.lineState(activity);
        messages.at(-1).text = (messages.at(-1).text + `\n\nNumber line practice: target ${activity.target}, ${result.attempts} attempts, ${result.finished ? 'completed' : 'in progress'}.`).slice(0, 4000);
      }
      if (activity?.type === 'equation-balance' && messages.at(-1)?.role === 'user') {
        const result = WorkspaceCore.balanceState(activity);
        messages.at(-1).text = (messages.at(-1).text + `\n\nEquation balance practice: ${activity.moves.length} equal operations on both sides; ${result.finished ? `solved with x = ${result.right}` : `remaining equation x + (${result.constant}) = ${result.right}`}.`).slice(0, 4000);
      }
      if (activity?.type === 'coding' && activity.attempts.length && messages.at(-1)?.role === 'user') {
        const tests = activity.attempts.at(-1).tests;
        const passed = tests.filter((test, index) => test.status === 'Accepted' && test.output.trim() === WorkspaceCore.codingChallenge.tests[index].expected).length;
        const draftChanged = activity.attempts.at(-1).code !== activity.code;
        messages.at(-1).text = (messages.at(-1).text + `\n\nCoding practice: ${passed} of ${WorkspaceCore.codingChallenge.tests.length} public tests passed; ${tests.length} tests completed${draftChanged ? ' on an earlier draft' : ''}.`).slice(0, 4000);
      }
      const schoolTopics = SchoolCore.weakTopics(state.school).filter(item => item.answered > 0).slice(0, 6).map(({ subject, topic, answered, correct }) => ({ subject, topic, answered, correct }));
      const memory = memorySettings();
      const response = await window.forgeDesktop.coachConversation({ ...(memory.enabled ? {memory:{notes:memory.notes,recentChats:recentMemory(session)}} : {}), requestId: pendingStream.requestId, minutes: session.minutes, goal: state.coach.profile?.goal || '', schoolTopics, messages, ...(assessedStep ? {lesson:assessedStep.text} : {}) });
      if (!response || typeof response.reply !== 'string' || !response.reply.trim() || response.reply.length > 8000 || response.activity !== 'none' && !Object.hasOwn(activityActions, response.activity) || response.steps != null && (!Array.isArray(response.steps) || response.steps.length === 1 || response.steps.length > 5 || !response.steps.every(step => typeof step === 'string' && step.trim() && step.length <= 500))) throw Error('The tutor returned an invalid response. Please retry.');
      if (response.lessonAssessment != null && !['complete','not_yet'].includes(response.lessonAssessment)) throw Error('The tutor returned an invalid lesson assessment. Please retry.');
      if (state.workspace.sessions.includes(session)) { if (session.messages.length === 1 && !session.titleEdited && typeof response.chatTitle === 'string' && response.chatTitle.trim()) session.title = response.chatTitle.trim().replace(/\s+/g,' ').slice(0,70); if (response.lessonAssessment === 'complete' && assessedStep && !response.steps?.length && session.messages.includes(planMessage) && !assessedStep.done) { assessedStep.done = true; assessedStep.completedBy = 'ai'; } session.messages.push({ role: 'assistant', text: response.reply, ...(response.activity !== 'none' ? { activity: response.activity } : {}), ...(response.steps?.length ? { plan: response.steps.map(text => ({text,done:false})) } : {}) }); if(response.activity==='livelab')createLabAt=session.messages.length-1; if(response.activity==='coding')createCodingAt=session.messages.length-1; touch(session); }
    } catch (failure) { if (current() === session) error = String(failure.message || failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''); }
    finally { busy = false; pendingStream = null; render(); }
    if(createLabAt!==null && state.workspace.sessions.includes(session)) startLiveLab(session,createLabAt);
    if(createCodingAt!==null && current()===session && workspacePage==='learn'){const topic=session.messages.slice(0,createCodingAt).reverse().find(m=>m.role==='user')?.text;if(topic)startCodingExercise(session,topic);}
  }

  function startLiveLab(session,sourceIndex){
    if(busy || !Number.isInteger(sourceIndex) || sourceIndex<0 || sourceIndex>=session.messages.length)return;
    if(session.activity && (session.activities?.length||0)>=100){if(current()===session)error='This session has 100 saved activities. Start another session to continue.';render();return;}
    const prior=session.messages.slice(0,sourceIndex+1);
    const request=[...prior].reverse().find(m=>m.role==='user')?.text;
    if (!request) { if(current()===session)error='Send a message about what you want to explore first.'; render(); return; }
    const context=prior.slice(-8).map(({role,text})=>({role,text:text.slice(0,1000)}));
    const original=session.activity, previous=sourceIndex===session.messages.length-1 && original?.type==='livelab-creative' ? {source:original.source,snapshot:original.snapshot} : null;
    busy=true; liveLabBusy=true; liveLabSession=session; error=''; render();
    Promise.resolve().then(async()=>{
      let reuseCandidates=[];
      if(!previous){
        try{
          const bytes=new TextEncoder().encode(JSON.stringify({version:8,request,context}));
          const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
          const activities=[...state.workspace.sessions].sort((a,b)=>b.updatedAt-a.updatedAt).flatMap(item=>[...(item.activity?[item.activity]:[]),...(item.activities||[]).slice().reverse()]);
          reuseCandidates=activities.filter(item=>item.type==='livelab-creative'&&item.reuse?.fingerprint===hash).slice(0,8).map(found=>({fingerprint:hash,seal:found.reuse.seal,artifact:{kind:'creative',source:found.source,description:found.description,assumptions:found.assumptions,question:found.question,review:found.review,snapshot:found.reuse.snapshot}}));
        }catch{ /* A cache miss must not prevent a new generation. */ }
      }
      return window.forgeDesktop.liveLab({request,context,previous,kind:'creative',reuseCandidates});
    }).then(result=>{
      if (!state.workspace.sessions.includes(session) || session.activity !== original) return;
      if(result?.kind!=='creative' || typeof result.source!=='string' || !result.source.trim() || new TextEncoder().encode(result.source).length>32768 || !['description','assumptions','question','review'].every(k=>typeof result[k]==='string' && result[k].length<=1500))throw Error('The LiveLab response was invalid.');
      LiveLabScene.validate(result.snapshot);
      if(result.reuse!=null){if(typeof result.reuse.fingerprint!=='string'||typeof result.reuse.seal!=='string'||!/^[a-f0-9]{64}$/.test(result.reuse.fingerprint)||!/^[a-f0-9]{64}$/.test(result.reuse.seal))throw Error('Invalid LiveLab reuse record.');LiveLabScene.validate(result.reuse.snapshot);}
      const priorActivities=session.activities?.slice(), priorMessages=session.messages.length, priorUpdatedAt=session.updatedAt;
      const trigger=session.messages[sourceIndex], priorSuggestion=trigger?.activity;
      if (!archiveActivity(session)) return;
      session.activity={type:'livelab-creative',source:result.source,description:result.description,assumptions:result.assumptions,question:result.question,review:result.review,snapshot:result.snapshot,initialSnapshot:JSON.parse(JSON.stringify(result.snapshot)),...(result.reuse?{reuse:result.reuse}:{})};
      if(trigger?.activity==='livelab')delete trigger.activity;
      if(session.messages.length<300) session.messages.push({role:'assistant',text:'Your LiveLab is ready. Explore the controls and consider the prediction question. Its assumptions are shown in the lab.'});
      if(!touch(session)){
        session.activity=original;session.updatedAt=priorUpdatedAt;session.messages.length=priorMessages;
        if(priorActivities)session.activities=priorActivities;else delete session.activities;
        if(priorSuggestion)trigger.activity=priorSuggestion;
        throw Error('The LiveLab could not be saved. Your previous activity is still available. Free local storage or export a backup, then retry.');
      }
    }).catch(failure=>{if(current()===session)error=String(failure.message||failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}).finally(()=>{busy=false;liveLabBusy=false;liveLabSession=null;render();});
  }

  async function startCodingExercise(session,topic,selectedLanguage,remoteConsent=false){
    if(busy || codeBusy)return;
    let original=session.activity;
    const language=selectedLanguage || (/\bpython\b/i.test(topic)?'Python':/c\+\+/i.test(topic)?'C++':/\btypescript\b/i.test(topic)?'TypeScript':/\bjava\b/i.test(topic)?'Java':'JavaScript');
    if(['Python','C++','Java'].includes(language) && !remoteConsent){
      if(original?.type!=='coding-workspace'){if(!archiveActivity(session))return;session.activity={type:'coding-workspace',language,assignmentTopic:topic.slice(0,500),code:'',stdin:'',output:'',runError:'',results:[],exercise:null};}
      else {original.language=language;original.assignmentTopic=topic.slice(0,500);}
      workspacePage='learn';lessonPointer=null;touch(session);render();return;
    }
    if(original?.type!=='coding-workspace'){
      if(!archiveActivity(session))return;
      session.activity={type:'coding-workspace',language,assignmentTopic:'',code:'console.log("Hello, FORGE!");',stdin:'',output:'',runError:'',results:[],exercise:null};
      original=session.activity;touch(session);
    }
    busy=true;codingGenerating=session;error='';lessonError='';
    if(workspacePage==='lesson'){workspacePage='learn';lessonPointer=null;}
    render();
    try{
      const exercise=await window.forgeDesktop.codingAssignment({topic:topic.slice(0,500),language,remoteConsent});
      if(!state.workspace.sessions.includes(session)||session.activity!==original)return;
      if(!exercise||typeof exercise.starter!=='string'||!Array.isArray(exercise.tests))throw Error('The coding exercise was incomplete.');
      if(!archiveActivity(session))return;
      session.activity={type:'coding-workspace',language,assignmentTopic:'',code:exercise.starter,stdin:'',output:'',runError:'',results:[],exercise:{title:exercise.title,prompt:exercise.prompt,language,tests:exercise.tests}};
      touch(session);
    }catch(failure){if(current()===session)error=String(failure.message||failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}
    finally{busy=false;codingGenerating=null;render();}
  }
  async function runLocalCoding(session,activity,check,remoteConsent=false){
    codeBusy=activity;activity.runError='';activity.results=[];render();
    try{
      const remote=['Python','C++','Java'].includes(activity.language);
      const execute=async stdin=>{if(!remote)return window.forgeDesktop.codingRun({source:activity.code,stdin});const result=await window.forgeDesktop.runnerRun({language:activity.language,sourceCode:activity.code,stdin,remoteConsent});return {output:String(result.stdout||'').slice(0,4000),error:result.status==='Accepted'?'':String(result.stderr||result.compileOutput||result.message||result.status).slice(0,500)};};
      if(check && activity.exercise){
        for(const test of activity.exercise.tests){const result=await execute(test.input);if(!state.workspace.sessions.includes(session)||session.activity!==activity)return;activity.results.push({output:result.output.slice(0,1000),error:result.error.slice(0,500),passed:!result.error&&result.output.trim()===test.expected.trim()});}
      }else{const result=await execute(activity.stdin);if(!state.workspace.sessions.includes(session)||session.activity!==activity)return;activity.output=result.output;activity.runError=result.error;}
      touch(session);
    }catch(failure){activity.runError=String(failure.message||failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'').slice(0,500);}
    finally{codeBusy=null;render();}
  }

  async function runCode(session, activity) {
    const source = activity.code;
    const attempt = { code: source, createdAt: Date.now(), tests: [] };
    activity.attempts.push(attempt);
    activity.attempts = activity.attempts.slice(-10);
    codeBusy = activity;
    codeError = null;
    codeCancelRequested = false;
    touch(session);
    render();
    try {
      for (const test of WorkspaceCore.codingChallenge.tests) {
        if (codeCancelRequested) throw Error('Stopped waiting. Judge0 may finish a submitted test.');
        const result = await window.forgeDesktop.runnerRun({ language: 'Python', sourceCode: source, stdin: test.input, remoteConsent: true });
        if (!state.workspace.sessions.includes(session)) return;
        attempt.tests.push({ status: String(result.status || 'Unknown').slice(0, 100), output: String(result.stdout || result.stderr || result.compileOutput || result.message || '').slice(0, 1000) });
        touch(session);
      }
      if (state.workspace.sessions.includes(session)) { addActivity('practice'); touch(session); }
    } catch (failure) {
      codeError = { activity, message: String(failure.message || failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') };
    } finally {
      codeBusy = null;
      render();
    }
  }
  async function runProjectilePython(session, activity) {
    const source = activity.python ?? WorkspaceCore.projectileStarter, speed = activity.speed;
    codeBusy = activity; codeError = null; codeCancelRequested = false; projectilePythonOpen = true; render();
    try {
      const result = await window.forgeDesktop.runnerRun({ language:'Python', sourceCode:source, stdin:`${speed}\n`, remoteConsent:true });
      if (codeCancelRequested) throw Error('Stopped waiting. Judge0 may finish a submitted test.');
      if (!state.workspace.sessions.includes(session)) return;
      activity.lastPythonRun = { code:source, speed, status:String(result.status || 'Unknown').slice(0,100), output:String(result.stdout || result.stderr || result.compileOutput || result.message || '').slice(0,1000) };
      touch(session);
    } catch (failure) {
      codeError = { activity, message:String(failure.message || failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') };
    } finally { codeBusy = null; render(); }
  }

  async function importNotes(file, session) {
    if (!file || !session) return;
    try {
      const pdf = /\.pdf$/i.test(file.name), textFile = /\.txt$/i.test(file.name);
      if (!pdf && !textFile) throw Error('Choose a .txt or .pdf file.');
      if (file.size > (pdf ? 10 * 1024 * 1024 : 1024 * 1024)) throw Error(pdf ? 'Choose a PDF under 10 MB.' : 'Choose a text file under 1 MB.');
      let content = '', partial = false;
      if (pdf) {
        const module = await import('./vendor/pdf.mjs');
        module.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', location.href).href;
        const base = new URL('./vendor/', location.href).href;
        const task = module.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useWasm: false, useWorkerFetch: false, cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', iccUrl: base + 'iccs/' });
        try {
          const doc = await task.promise;
          const pages = Math.min(doc.numPages, 15);
          partial = doc.numPages > pages;
          for (let i = 1; i <= pages; i++) {
            const page = await doc.getPage(i), text = await page.getTextContent();
            content += text.items.map(item => item.str || '').join(' ') + '\n';
            page.cleanup();
            if (content.length > 4000) { partial = true; break; }
          }
        } finally { await task.destroy(); }
      } else content = await file.text();
      content = content.trim();
      if (!content) throw Error('No selectable text found. Scanned PDFs need text recognition before importing.');
      if (!state.workspace.sessions.includes(session)) return;
      const goal = (session.learningGoal || '').trim();
      const prefix = 'Please create a clear learning path with a first step, practice, and a small project.' + (goal ? `\n\nMy learning goal:\n${goal}` : '') + '\n\nNotes:\n';
      const previous = session.draft || '', separator = previous ? '\n\n' : '';
      const available = 4000 - previous.length - separator.length - prefix.length;
      if (available < 100) throw Error('Your draft is nearly full. Shorten it before adding notes.');
      partial ||= content.length > available;
      session.draft = previous + separator + prefix + content.slice(0, available);
      touch(session);
      if (current() === session) { error = ''; render(); document.getElementById('workspaceInput')?.focus(); }
      toast(partial ? 'Part of the notes was added. Review the draft before sending.' : 'Notes added to your draft. Review before sending.');
    } catch (failure) {
      if (current() === session) { error = String(failure.message || 'Could not read those notes.'); render(); }
    }
  }
  root.addEventListener('change', event => {
    if (event.target.id !== 'workspaceNotes') return;
    const file = event.target.files?.[0];
    event.target.value = '';
    importNotes(file, current());
  });
  root.addEventListener('dragover', event => {
    const zone = event.target.closest('.workspace-import');
    if (!zone || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    zone.classList.add('workspace-import-over');
  });
  root.addEventListener('dragleave', event => {
    const zone = event.target.closest('.workspace-import');
    if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('workspace-import-over');
  });
  root.addEventListener('drop', event => {
    const zone = event.target.closest('.workspace-import');
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove('workspace-import-over');
    const files = event.dataTransfer?.files;
    if (files?.length !== 1) { error = 'Drop one .txt or .pdf file at a time.'; render(); return; }
    importNotes(files[0], current());
  });

  root.addEventListener('input', event => {
    if(event.target.id==='workspaceRenameInput'){renameDraft=event.target.value.slice(0,100);return;}
    if(event.target.id==='quizNumber'){quizNumber=event.target.value.slice(0,80);return;}
    if (event.target.dataset.livelabControl !== undefined && current()?.activity?.type === 'livelab') {
      const session=current(), control=session.activity.lab.controls[Number(event.target.dataset.livelabControl)], value=Number(event.target.value);
      if (!control || !Number.isFinite(value) || value<control.min || value>control.max) return;
      control.value=value; touch(session);
      const panel=root.querySelector('.workspace-livelab'), template=document.createElement('template');
      template.innerHTML=activityMarkup(session);
      const updated=template.content.querySelector('.workspace-livelab');
      panel.querySelector('.livelab-graph').replaceWith(updated.querySelector('.livelab-graph'));
      event.target.parentElement.querySelector('strong').textContent=String(value); return;
    }
    if (event.target.id === 'projectilePython' && current()?.activity?.type === 'projectile') {
      const session = current(), activity = session.activity;
      activity.python = event.target.value.slice(0, 8000);
      const stale = root.querySelector('.projectile-run-stale');
      if (stale && activity.lastPythonRun) stale.hidden = activity.lastPythonRun.code === activity.python && activity.lastPythonRun.speed === activity.speed;
      touch(session); return;
    }
    if (event.target.id === 'workspaceLearningGoal' && current()) {
      current().learningGoal = event.target.value.slice(0, 300);
      touch(current());
      return;
    }
    if (event.target.id === 'projectileSpeed' && current()?.activity?.type === 'projectile' && current().activity.stage === 'build') {
      const speed = Number(event.target.value);
      if (!Number.isInteger(speed) || speed < 5 || speed > 30) return;
      const activity = current().activity;
      activity.speed = speed;
      touch(current());
      const panel = root.querySelector('.workspace-projectile');
      panel.querySelector('label strong').textContent = `${speed} m/s`;
      panel.querySelector('.projectile-code code').textContent = `speed = ${speed}\ngravity = 9.81\nrange_m = speed ** 2 / gravity\nprint(range_m)`;
      const stale = panel.querySelector('.projectile-run-stale');
      if (stale && activity.lastPythonRun) stale.hidden = activity.lastPythonRun.code === (activity.python ?? WorkspaceCore.projectileStarter) && activity.lastPythonRun.speed === speed;
      const status = panel.querySelector('[role="status"]');
      if (status && activity.result !== speed) status.textContent = `Previous run: ${(activity.result ** 2 / 9.81).toFixed(1)} m at ${activity.result} m/s. Run again to update.`;
      return;
    }
    if (event.target.id === 'projectileAngle' && current()?.activity?.type === 'projectile') {
      const angle = Number(event.target.value);
      if (!Number.isInteger(angle) || angle < 10 || angle > 80) return;
      current().activity.angle = angle;
      current().activity.explored = true;
      const pathSummary = root.querySelector('.workspace-path');
      if (pathSummary) {
        pathSummary.querySelector('li:first-child small').textContent = 'Angle adjusted';
        pathSummary.querySelector('li:first-child .path-check').textContent = '✓';
        pathSummary.querySelector('.workspace-path-heading > span').textContent = `${1 + Number(current().activity.answer === 1) + Number(current().activity.result !== null)} / 3 steps`;
      }
      touch(current());
      const panel = root.querySelector('.workspace-projectile');
      if (panel) {
        const template = document.createElement('template');
        template.innerHTML = activityMarkup(current());
        const updated = template.content.querySelector('.workspace-projectile');
        panel.querySelector('svg').replaceWith(updated.querySelector('svg'));
        panel.querySelector('label strong').textContent = `${angle}°`;
        panel.querySelector('.projectile-metrics').replaceWith(updated.querySelector('.projectile-metrics'));
      }
      return;
    }
    if (event.target.id === 'workspaceInput' && current()) {
      const session = current();
      session.draft = event.target.value.slice(0, 4000);
      touch(session);
      return;
    }
    if (event.target.id === 'workspaceCode' && ['coding','coding-workspace'].includes(current()?.activity?.type)) {
      const session = current();
      session.activity.code = event.target.value.slice(0, 8000);
      if(session.activity.type==='coding-workspace'){session.activity.results=[];session.activity.output='';session.activity.runError='';}
      touch(session);
      return;
    }
    if(event.target.id==='codingLanguage' && current()?.activity?.type==='coding-workspace'){
      const session=current(),activity=session.activity,value=event.target.value;
      if(!['JavaScript','TypeScript','Python','C++','Java'].includes(value))return;
      const examples={JavaScript:'console.log("Hello, FORGE!");',TypeScript:'console.log("Hello, FORGE!");',Python:'print("Hello, FORGE!")', 'C++':'#include <iostream>\nint main() { std::cout << "Hello, FORGE!" << std::endl; }',Java:'class Main { public static void main(String[] args) { System.out.println("Hello, FORGE!"); } }'};
      if(Object.values(examples).includes(activity.code))activity.code=examples[value];
      activity.language=value;activity.output='';activity.runError='';activity.results=[];touch(session);render();return;
    }
    if(event.target.id==='codingInput' && current()?.activity?.type==='coding-workspace'){const session=current();session.activity.stdin=event.target.value.slice(0,4000);touch(session);return;}
    if (event.target.id !== 'workspaceLine' || current()?.activity?.type !== 'number-line') return;
    const session = current();
    const position = Number(event.target.value);
    if (!Number.isInteger(position) || position < -10 || position > 10) return;
    session.activity.position = position;
    document.getElementById('workspaceLineValue').textContent = String(position);
    touch(session);
  });

  function handleWorkspaceClick(event) {
    const link = event.target.closest('a[data-learning-link]');
    if (link) { event.preventDefault(); window.forgeDesktop.openLearningLink(link.getAttribute('href')).catch(() => toast('Could not open the link.')); return; }
    const copy = event.target.closest('button[data-copy-code]');
    if (copy) { const code = copy.closest('.workspace-code-block')?.querySelector('code')?.textContent; if (typeof code === 'string') window.forgeDesktop.copyText(code).then(() => toast('Code copied.')).catch(() => toast('Could not copy code.')); return; }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.session) { workspacePage = 'learn'; state.workspace.selected = button.dataset.session; error = ''; save(); render(); document.body.classList.remove('workspace-sessions-open'); document.getElementById('workspaceSidebarToggle').setAttribute('aria-expanded','false'); return; }
    if (button.dataset.minutes) {
      if (state.workspace.sessions.length >= 100) { error = 'Delete a session before creating another.'; render(); return; }
      const now = Date.now();
      const session = { id: crypto.randomUUID(), title: 'New learning session', minutes: Number(button.dataset.minutes), createdAt: now, updatedAt: now, pinned: false, messages: [], activity: null, activities: [], draft: '', expanded: false };
      state.workspace.sessions.push(session); state.workspace.selected = session.id; error = ''; save(); render(); document.getElementById('workspaceInput')?.focus(); return;
    }
    if (['workspace-learn','workspace-progress','workspace-settings'].includes(button.dataset.action)) {
      workspacePage = button.dataset.action.slice('workspace-'.length);
      error = ''; render(); document.body.classList.remove('workspace-sessions-open'); document.getElementById('workspaceSidebarToggle').setAttribute('aria-expanded','false');
      root.querySelector('h1,h2')?.focus(); return;
    }
    const session = current();
    if (button.dataset.action === 'new') { workspacePage = 'learn'; state.workspace.selected = null; error = ''; save(); render(); document.body.classList.remove('workspace-sessions-open'); document.getElementById('workspaceSidebarToggle').setAttribute('aria-expanded','false'); }
    if (!session) return;
    if(button.dataset.action==='open-coding-workspace'){
      if(busy||codeBusy)return;
      workspacePage='learn';lessonPointer=null;
      if(session.activity?.type!=='coding-workspace'){
        if(!archiveActivity(session))return;
        session.activity={type:'coding-workspace',code:'console.log("Hello, FORGE!");',stdin:'',output:'',runError:'',results:[],exercise:null};touch(session);
      }
      render();return;
    }
    if (button.dataset.pathStartMessage !== undefined) {
      const messageIndex=Number(button.dataset.pathStartMessage),stepIndex=Number(button.dataset.pathStartStep),step=session.messages[messageIndex]?.plan?.[stepIndex];
      if(!step||busy)return;quizSelection=[];quizNumber='';lessonPointer={sessionId:session.id,messageIndex,stepIndex};workspacePage='lesson';lessonError='';render();if(!step.lesson)createPathLesson(session,step);return;
    }
    if (button.dataset.action === 'lesson-exit') { stopStudyShow();showOpen=false;showLesson=null;stopLessonPlayback();workspacePage='learn';lessonPointer=null;lessonError='';render();return; }
    if (button.dataset.action === 'lesson-retry') { const item=selectedLesson(session);if(item&&!item.lesson)createPathLesson(session,item.step);return; }
    if (workspacePage==='lesson') {
      const item=selectedLesson(session),lesson=item?.lesson;if(!lesson)return;
      if(button.dataset.action==='lesson-coding'){startCodingExercise(session,item.step.text);return;}
      if(button.dataset.action==='show-open'){stopLessonPlayback();showOpen=true;showLesson=lesson;showPhase='idle';showCaption=0;showFeedback=null;showMessage='';showVisual=null;render();if(!lesson.studyShow)createStudyShow(session,item.step,lesson);return;}
      if(button.dataset.action==='show-exit'){stopStudyShow();showOpen=false;showLesson=null;showVisual=null;showMessage='';render();return;}
      if(button.dataset.action==='show-retry'){if(showOpen&&!lesson.studyShow)createStudyShow(session,item.step,lesson);return;}
      if(showOpen && lesson.studyShow){const show=lesson.studyShow,scene=show.scenes[show.sceneIndex];
        if(button.dataset.action==='show-lab'){stopStudyShow();showOpen=false;showLesson=null;const old=lesson.screen,updated=session.updatedAt;lesson.screen=2;if(!touch(session)){lesson.screen=old;session.updatedAt=updated;lessonError='Could not save lesson progress.';}render();return;}
        if(button.dataset.action==='show-pause'){stopStudyShow();render();return;}
        if(button.dataset.action==='show-replay'){stopStudyShow();const old=show.sceneIndex,updated=session.updatedAt;show.sceneIndex=0;if(!touch(session)){show.sceneIndex=old;session.updatedAt=updated;showMessage='Could not save replay position.';render();return;}showCaption=0;showPhase='idle';showFeedback=null;showVisual=null;showMessage='';render();return;}
        if(button.dataset.action==='show-restart-scene'){stopStudyShow();showCaption=0;showPhase='idle';showFeedback=null;showVisual=null;showMessage='';render();return;}
        if(button.dataset.showScene!==undefined){const target=Number(button.dataset.showScene);if(!Number.isInteger(target)||target<0||target>=show.sceneIndex)return;stopStudyShow();const old=show.sceneIndex,updated=session.updatedAt;show.sceneIndex=target;if(!touch(session)){show.sceneIndex=old;session.updatedAt=updated;showMessage='Could not save the scene position.';render();return;}showCaption=0;showPhase='idle';showFeedback=null;showVisual=null;showMessage='';render();return;}
        if(button.dataset.action==='show-play'||button.dataset.action==='show-captions'){if(showPhase==='checkpoint')return;stopStudyShow();showMode=button.dataset.action==='show-play'?'voice':'captions';showPhase='playing';showMessage=showMode==='captions'?'Captions-only playback.':'';const token=++showToken;playStudyCaption(session,lesson,token);return;}
        if(button.dataset.showChoice!==undefined&&showPhase==='checkpoint'&&scene.checkpoint){const choice=Number(button.dataset.showChoice);if(!Number.isInteger(choice)||choice<0||choice>=scene.checkpoint.choices.length)return;showFeedback=choice;if(choice===scene.checkpoint.correctIndex){const before=show.passed.slice(),updated=session.updatedAt;if(!show.passed.includes(show.sceneIndex))show.passed.push(show.sceneIndex);if(!touch(session)){show.passed=before;session.updatedAt=updated;showMessage='Could not save checkpoint progress.';render();return;}showPhase=show.sceneIndex===show.scenes.length-1?'finished':'paused';if(showPhase!=='finished'){const old=show.sceneIndex;show.sceneIndex++;if(!touch(session)){show.sceneIndex=old;showMessage='Could not save the next scene.';showPhase='checkpoint';}else showCaption=0;}showFeedback=null;}render();return;}
        return;
      }
      if(button.dataset.action==='lesson-create-lab'){createLessonLab(session,item.step,lesson);return;}
      if(button.dataset.action==='lesson-back' || button.dataset.action==='lesson-next') {if(lessonLabBusy)return;stopLessonPlayback();const before=lesson.screen;lesson.screen=Math.max(0,Math.min(3,before+(button.dataset.action==='lesson-next'?1:-1)));if(!touch(session))lesson.screen=before;lessonError='';render();return;}
      if(button.dataset.quizOption!==undefined && lesson.quizV2){const q=lesson.quizV2.questions[lesson.quizV2.index],i=Number(button.dataset.quizOption);if(!Number.isInteger(i)||i<0||i>=q.choices.length||lesson.quizV2.attempts.some(a=>a.questionId===q.id&&a.correct))return;quizSelection=q.type==='single'?[i]:quizSelection.includes(i)?quizSelection.filter(x=>x!==i):[...quizSelection,i];lessonError='';render();root.querySelector(`[data-quiz-option="${i}"]`)?.focus();return;}
      if(button.dataset.action==='quiz-submit' && lesson.quizV2 && !quizFollowupBusy){const quiz=lesson.quizV2,q=quiz.questions[quiz.index];if(quiz.attempts.some(a=>a.questionId===q.id&&a.correct))return;let response=q.type==='number'?quizNumber.trim():[...quizSelection],correct;try{correct=MasteryCore.grade(q,response);}catch(e){lessonError=e.message;render();return;}const previous=JSON.parse(JSON.stringify(quiz)),oldPassed=lesson.passed,oldDone=item.step.done,oldCompleted=item.step.completedBy,oldTime=session.updatedAt;quiz.attempts.push({questionId:q.id,response,correct,at:Date.now(),topic:q.topic,difficulty:q.difficulty});try{MasteryCore.normalizeQuiz(quiz);}catch(e){lesson.quizV2=previous;lessonError=e.message;render();return;}if(quiz.questions.every(x=>quiz.attempts.some(a=>a.questionId===x.id&&a.correct))){lesson.passed=true;item.step.done=true;item.step.completedBy='ai';}if(!touch(session)){lesson.quizV2=previous;lesson.passed=oldPassed;item.step.done=oldDone;session.updatedAt=oldTime;if(oldCompleted===undefined)delete item.step.completedBy;else item.step.completedBy=oldCompleted;lessonError='Could not save your answer. Please try again.';}else lessonError='';render();return;}
      if((button.dataset.action==='quiz-next'||button.dataset.action==='quiz-prev')&&lesson.quizV2&&!quizFollowupBusy){const quiz=lesson.quizV2,old=quiz.index;quiz.index=Math.max(0,Math.min(quiz.questions.length-1,old+(button.dataset.action==='quiz-next'?1:-1)));if(!touch(session))quiz.index=old;quizSelection=[];quizNumber='';lessonError='';render();return;}
      if(button.dataset.action==='quiz-followup' && lesson.quizV2){createQuizFollowup(session,item.step,lesson);return;}
      if(button.dataset.lessonChoice!==undefined){
        const choice=Number(button.dataset.lessonChoice);if(!Number.isInteger(choice)||choice<0||choice>3||lesson.passed||lesson.selected===choice)return;
        const before={selected:lesson.selected,passed:lesson.passed,done:item.step.done,completedBy:item.step.completedBy,attempts:lesson.attempts,historyComplete:lesson.historyComplete,updated:session.updatedAt};
        if((lesson.attempts?.length||0)>=100){lessonError='This check has reached its attempt limit.';render();return;}
        lesson.historyComplete=lesson.historyComplete ?? !(lesson.attempts===undefined && lesson.selected!==null);lesson.attempts=[...(lesson.attempts||[]),choice];lesson.selected=choice;if(choice===lesson.correctIndex){lesson.passed=true;item.step.done=true;item.step.completedBy='ai';}
        if(!touch(session)){lesson.selected=before.selected;lesson.passed=before.passed;lesson.attempts=before.attempts;lesson.historyComplete=before.historyComplete;session.updatedAt=before.updated;item.step.done=before.done;if(before.completedBy===undefined)delete item.step.completedBy;else item.step.completedBy=before.completedBy;lessonError='Could not save your answer. Please try again.';}else lessonError='';render();return;
      }
      return;
    }
    if (button.dataset.action === 'draft-path' || button.dataset.action === 'revise-path') {
      const request = button.dataset.action === 'revise-path' ? 'Please adjust my learning path based on our conversation and my recorded progress. Choose the most useful next lessons and explain why.' : 'Please create a learning path based on what I want to learn and choose the most useful next lessons. Explain your choices.';
      const existing = session.draft || '';
      if (existing.length + request.length + 2 > 4000) { error = 'Your draft is nearly full. Shorten it before adding this request.'; render(); return; }
      session.draft = existing ? `${existing}\n\n${request}` : request;
      error = ''; touch(session); render(); document.getElementById('workspaceInput')?.focus(); return;
    }
    if (button.dataset.action === 'ask-livelab' && session.activity?.type === 'livelab-creative') {
      const request = `Help me understand what is happening in my LiveLab, ${session.activity.snapshot.scene.title}. Explain what I should notice and suggest something to try.`;
      const existing=session.draft || '';
      if(existing.length+request.length+2>4000){error='Your draft is nearly full. Shorten it before adding this question.';render();return;}
      session.draft=existing ? `${existing}\n\n${request}` : request;
      session.expanded=false; error=''; touch(session);render();document.getElementById('workspaceInput')?.focus();return;
    }
    if (button.dataset.action === 'reset-livelab' && session.activity?.type === 'livelab-creative' && session.activity.initialSnapshot && !liveLabStepBusy) {
      const activity=session.activity, previous=activity.snapshot, last=activity.lastInteraction, updated=session.updatedAt;
      stopLiveLabAnimation(); activity.snapshot=JSON.parse(JSON.stringify(activity.initialSnapshot)); delete activity.lastInteraction;
      if(!touch(session)){activity.snapshot=previous;session.updatedAt=updated;if(last!==undefined)activity.lastInteraction=last;error='The reset could not be saved; the previous lab state was kept.';} else {liveLabDrafts.delete(activity);error='';}
      render();root.querySelector('[data-action="reset-livelab"]')?.focus();return;
    }
    if (button.dataset.action === 'livelab') {
      const rawIndex=button.dataset.livelabMessage;
      const sourceIndex=rawIndex === undefined ? session.messages.length-1 : Number(rawIndex);
      startLiveLab(session,sourceIndex);
      return;
    }
    if (button.dataset.action === 'stop-livelab' && liveLabBusy) { window.forgeDesktop.coachCancel(); return; }
    if (button.dataset.action === 'prepare-learning-path') {
      const goal = (session.learningGoal || '').trim();
      if (!goal) { error = 'Enter a learning goal first.'; render(); document.getElementById('workspaceLearningGoal')?.focus(); return; }
      const request = `Please create a clear learning path with a first step, practice, and a small project.\n\nMy learning goal:\n${goal}`;
      const draft = session.draft || '', separator = draft ? '\n\n' : '';
      if (draft.length + separator.length + request.length > 4000) { error = 'Your draft is nearly full. Shorten it before adding the goal.'; render(); return; }
      session.draft = draft + separator + request;
      error = ''; touch(session); render(); document.getElementById('workspaceInput')?.focus(); return;
    }
    if (button.dataset.action === 'projectile') {
      if (!archiveActivity(session)) return;
      session.activity = { type: 'projectile', angle: 35, stage: 'explore', answer: null, speed: 18, result: null, explored: false };
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
    }
    if (session.activity?.type === 'projectile') {
      const activity = session.activity;
      if (button.dataset.action === 'projectile-test-python' && activity.stage === 'build') {
        if (codeBusy) return;
        projectilePythonOpen = true;
        if (!document.getElementById('projectileConsent')?.checked) { codeError = {activity,message:'Agree to the Judge0 notice before running Python.'}; render(); return; }
        if (!(activity.python ?? WorkspaceCore.projectileStarter).trim()) { codeError = {activity,message:'Write a Python program before running it.'}; render(); return; }
        runProjectilePython(session, activity); return;
      }
      if (button.dataset.action === 'projectile-resume') { document.getElementById('workspaceActivityHeading')?.focus(); document.getElementById('workspaceActivityHeading')?.scrollIntoView({ block: 'nearest' }); return; }
      if (button.dataset.projectileAnswer !== undefined && activity.stage === 'practice') {
        const answer = Number(button.dataset.projectileAnswer);
        if (!Number.isInteger(answer) || answer < 0 || answer > 2) return;
        activity.answer = answer;
        touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
      }
      const stages = { 'projectile-practice': 'practice', 'projectile-build': 'build', 'projectile-explore': 'explore' };
      if (Object.hasOwn(stages, button.dataset.action) && (button.dataset.action !== 'projectile-build' || activity.answer === 1)) {
        activity.stage = stages[button.dataset.action];
        touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
      }
      if (button.dataset.action === 'projectile-run' && activity.stage === 'build') {
        activity.result = activity.speed;
        touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
      }
    }
    if (button.dataset.action === 'stop-tutor' && pendingStream?.session === session) { window.forgeDesktop.coachCancel().catch(() => {}); return; }
    if (button.dataset.action === 'equation-balance') {
      const previous = session.activity?.type === 'equation-balance' ? session.activity.problem : -1;
      if (!archiveActivity(session)) return;
      session.activity = { type: 'equation-balance', problem: (previous + 1) % WorkspaceCore.balanceProblems.length, moves: [], hint: false };
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
    }
    if (button.dataset.action === 'balance-hint' && session.activity?.type === 'equation-balance') { session.activity.hint = true; touch(session); render(); return; }
    if (button.dataset.action === 'balance-apply' && session.activity?.type === 'equation-balance') {
      const activity = session.activity;
      const move = Number(document.getElementById('balanceDelta')?.value);
      if (WorkspaceCore.balanceState(activity).finished || activity.moves.length >= 30 || !Number.isInteger(move) || move < -10 || move > 10 || move === 0) return;
      activity.moves.push(move);
      if (WorkspaceCore.balanceState(activity).finished) addActivity('math');
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
    }
    if (button.dataset.action === 'expand-activity' && session.activity) { session.expanded = !session.expanded; touch(session); render(); document.querySelector('[data-action="expand-activity"]')?.focus(); return; }
    if (button.dataset.action === 'suggest' && !busy && session.messages.length === 0) {
      session.messages.push({ role: 'user', text: 'Suggest a learning objective and a first step based on my goals and practice.' });
      touch(session); respond(session); return;
    }
    if (button.dataset.action === 'coding-challenge') {
      const topic=[...session.messages].reverse().find(m=>m.role==='user')?.text || 'JavaScript basics';
      startCodingExercise(session,topic);return;
    }
    if(button.dataset.action==='coding-assign'){
      const activity=session.activity;if(activity?.type!=='coding-workspace')return;
      const consent=document.getElementById('codingRemoteConsent')?.checked===true;
      if(['Python','C++','Java'].includes(activity.language)&&!consent){activity.runError='Agree to the Judge0 notice before generating this exercise.';render();return;}
      startCodingExercise(session,activity.assignmentTopic,activity.language,consent);return;
    }
    if (button.dataset.action === 'coding-run' || button.dataset.action === 'coding-test') {
      const activity=session.activity;if(activity?.type!=='coding-workspace'||codeBusy)return;
      const remote=['Python','C++','Java'].includes(activity.language),consent=document.getElementById('codingRemoteConsent')?.checked===true;
      if(remote&&!consent){activity.runError='Agree to the Judge0 notice before running code.';render();return;}
      runLocalCoding(session,activity,button.dataset.action==='coding-test',consent);return;
    }
    if (button.dataset.action === 'stop-code' && codeBusy === session.activity) {
      codeCancelRequested = true;
      window.forgeDesktop.runnerCancel().catch(() => {});
      return;
    }
    if (button.dataset.action === 'run-code' && session.activity?.type === 'coding') {
      const activity = session.activity;
      if (codeBusy) return;
      if (!document.getElementById('workspaceRunConsent')?.checked) { codeError = { activity, message: 'Agree to the Judge0 notice before running the public tests.' }; render(); return; }
      if (!activity.code.trim()) { codeError = { activity, message: 'Write a solution before running it.' }; render(); return; }
      runCode(session, activity);
      return;
    }
    if (button.dataset.action === 'sorting') {
      const previous = session.activity?.type === 'sorting' ? session.activity.set : -1;
      if (!archiveActivity(session)) return;
      session.activity = { type: 'sorting', set: (previous + 1) % WorkspaceCore.sortingSets.length, moves: [] };
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
    }
    if (button.dataset.sortMove && session.activity?.type === 'sorting') {
      const activity = session.activity;
      if (WorkspaceCore.sortingState(activity).finished || activity.moves.length >= 50 || !['swap', 'keep'].includes(button.dataset.sortMove)) return;
      activity.moves.push(button.dataset.sortMove);
      if (WorkspaceCore.sortingState(activity).finished) addActivity('practice');
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
    }
    if (button.dataset.action === 'number-line') {
      const previous = session.activity?.type === 'number-line' ? session.activity.target : null;
      const target = WorkspaceCore.lineTargets[(WorkspaceCore.lineTargets.indexOf(previous) + 1) % WorkspaceCore.lineTargets.length];
      if (!archiveActivity(session)) return;
      session.activity = { type: 'number-line', target, position: 0, attempts: [] };
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
    }
    if (button.dataset.action === 'check-line' && session.activity?.type === 'number-line') {
      const activity = session.activity;
      if (WorkspaceCore.lineState(activity).finished || activity.attempts.length >= 50) return;
      activity.attempts.push(activity.position);
      if (WorkspaceCore.lineState(activity).finished) addActivity('practice');
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
    }
    if (button.dataset.activityIndex !== undefined) {
      const index = Number(button.dataset.activityIndex);
      if (!Number.isInteger(index) || !session.activities?.[index]) return;
      const previousActivity=session.activity,previousActivities=session.activities.slice(),previousUpdatedAt=session.updatedAt;
      const selected = session.activities[index];
      session.activities.splice(index, 1);
      if (session.activity) session.activities.push(session.activity);
      session.activity = selected;
      if(!touch(session)){session.activity=previousActivity;session.activities=previousActivities;session.updatedAt=previousUpdatedAt;error='The activity could not be reopened because the change could not be saved.';}
      render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
    }
    if (button.dataset.action === 'binary') {
      const previous = session.activity?.type === 'binary-search' ? session.activity.target : null;
      const targets = WorkspaceCore.searchTargets;
      const target = targets[(targets.indexOf(previous) + 1) % targets.length];
      if (!archiveActivity(session)) return;
      session.activity = { type: 'binary-search', target, moves: [] };
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
    }
    if (button.dataset.searchMove && session.activity?.type === 'binary-search') {
      const activity = session.activity;
      const before = WorkspaceCore.searchState(activity);
      if (before.finished || activity.moves.length >= 50 || !['left', 'right', 'found'].includes(button.dataset.searchMove)) return;
      activity.moves.push(button.dataset.searchMove);
      const after = WorkspaceCore.searchState(activity);
      if (after.finished) addActivity('practice');
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
    }
    if (button.dataset.action === 'practice') {
      if (!archiveActivity(session)) return;
      const practiced = new Set(state.school.attempts.slice(0, 10).flatMap(attempt => attempt.results.map(result => result.questionId)));
      const weak = SchoolCore.weakTopics(state.school).filter(item => item.answered > 0);
      const preferred = weak[0];
      const pool = SchoolCore.QUESTIONS.filter(question => !preferred || question.subject === preferred.subject && question.topic === preferred.topic);
      const question = pool.find(item => !practiced.has(item.id)) || pool[0];
      session.activity = { type: 'school-question', questionId: question.id, answer: null, hint: false };
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
    }
    if (button.dataset.action === 'close-activity') { if (!archiveActivity(session)) return; session.expanded = false; touch(session); render(); return; }
    if (button.dataset.action === 'hint' && session.activity && session.activity.answer === null) { session.activity.hint = true; touch(session); render(); return; }
    if (button.dataset.answer !== undefined && session.activity?.answer === null) {
      const answer = Number(button.dataset.answer);
      const question = SchoolCore.byId.get(session.activity.questionId);
      if (!Number.isInteger(answer) || answer < 0 || answer > 3 || !question) return;
      const active = state.school.active;
      const school = { ...state.school, active: { id: `workspace-${crypto.randomUUID()}`, kind: 'quiz', subject: question.subject, topic: question.topic, questionIds: [question.id], answers: [answer], startedAt: Date.now(), durationSeconds: 0 } };
      const result = SchoolCore.finish(school);
      result.school.active = active;
      state.school = result.school;
      session.activity.answer = answer;
      addActivity('practice');
      touch(session); render(); return;
    }
    if (button.dataset.action === 'pin') { session.pinned = !session.pinned; touch(session); render(); }
    if (button.dataset.action === 'rename') { renameSessionId=session.id;renameDraft=session.title;render();const input=document.getElementById('workspaceRenameInput');input?.focus();input?.select();return; }
    if (button.dataset.action === 'rename-cancel') { renameSessionId=null;renameDraft='';render();return; }
    if (button.dataset.action === 'delete' && confirm('Delete this learning session?')) { state.workspace.sessions = state.workspace.sessions.filter(item => item !== session); state.workspace.selected = null; save(); render(); }
    if (button.dataset.action === 'retry' && !busy) respond(session);
  }
  root.addEventListener('keydown', event => {
    if(event.target.id==='workspaceRenameInput' && event.key==='Escape'){event.preventDefault();renameSessionId=null;renameDraft='';render();return;}
    if(event.target.id!=='workspaceInput'||event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.keyCode===229)return;
    event.preventDefault();
    if(!busy)document.getElementById('workspaceForm')?.requestSubmit();
  });
  root.addEventListener('click', handleWorkspaceClick);
  sidebar.addEventListener('click', handleWorkspaceClick);
  window.forgeDesktop.onCoachStream(message => {
    if (!pendingStream || message?.requestId !== pendingStream.requestId || typeof message.text !== 'string' || message.text.length > 8000) return;
    pendingStream.text = message.text;
    const target = document.getElementById('workspaceStream');
    const messages = document.getElementById('workspaceMessages');
    if (!target || current() !== pendingStream.session || !messages) return;
    const following = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 32;
    target.textContent = message.text;
    if (following) messages.scrollTop = messages.scrollHeight;
  });
  document.getElementById('workspaceToolsToggle').addEventListener('click', event => {
    const expanded = document.body.classList.toggle('workspace-nav-open');
    event.currentTarget.setAttribute('aria-expanded', String(expanded));
  });
  document.getElementById('workspaceSidebarToggle').addEventListener('click', event => {
    const expanded = document.body.classList.toggle('workspace-sessions-open');
    event.currentTarget.setAttribute('aria-expanded', String(expanded));
  });
  const progress = document.createElement('section');
  progress.id = 'workspaceProgress';
  progress.className = 'workspace-progress card card-pad section';
  const settings = document.createElement('section');
  settings.className = 'workspace-settings card card-pad section';
  function renderPlans(){
    return `<section class="forge-plans" aria-labelledby="forgePlansHeading"><div class="forge-plans-header"><div><span class="workspace-kicker">FORGE PLANS</span><h3 id="forgePlansHeading">Learning that grows with you</h3><p>These subscription plans and allowances are proposed. Payments and paid subscriptions are not yet available.</p></div><span class="forge-plans-status">Coming later</span></div><div class="forge-plans-grid">${ForgePlans.plans.map(plan=>`<article class="forge-plan"><span>${esc(plan.name.toUpperCase())}</span><h4>${ForgePlans.price(plan)}<small>${plan.monthlyCents?'/ month':' forever'}</small></h4><p>${esc(plan.position)}</p><ul>${plan.features.map(feature=>`<li>${esc(feature)}</li>`).join('')}</ul>${plan.id==='max'||plan.id==='ultra'?'<small>Planned for a later phase</small>':''}</article>`).join('')}</div><p>Features and generation allowances depend on development and cost testing. Prices are in USD.</p></section>`;
  }
  function renderSettings() {
    settings.innerHTML = `<h2 tabindex="-1">Settings and backups</h2><p>Manage your tutor connection and the data saved on this device.</p>${renderPlans()}<section><h3>AI tutor</h3><p id="workspaceConnection" role="status">Checking connection…</p><button data-settings="connect">Choose key file</button><button data-settings="disconnect">Disconnect</button><p class="tiny muted">Your key stays on this device and is not included in backups. Tutor requests use your API account.</p></section><section><h3>Memory across chats</h3><p>When enabled, FORGE sends your memory notes and the latest message from up to three other recent chats to the tutor when you send a message. These stay on this device and in backups. Delete a chat to remove its excerpt; switch memory off to stop sending all memory.</p><label><input id="workspaceMemoryEnabled" type="checkbox" ${memorySettings().enabled ? 'checked' : ''}> Use memory across chats</label><label for="workspaceMemoryNotes">What should FORGE remember about you?</label><textarea id="workspaceMemoryNotes" maxlength="2000" rows="4" placeholder="For example: I prefer visual explanations and I am learning algebra.">${esc(memorySettings().notes)}</textarea><button data-settings="save-memory">Save memory</button><button data-settings="clear-memory">Clear memory notes</button><details><summary>Preview recent chat context</summary><ul>${recentMemory(current()).map(item=>`<li><strong>${esc(item.title)}</strong>: ${esc(item.excerpt)}</li>`).join('') || '<li>No other chats yet.</li>'}</ul></details></section><section><h3>Personalization</h3><p>Review your learning preferences and goals.</p><button data-settings="personalize">Review preferences</button></section><section><h3>Appearance</h3><label for="workspaceTheme">Color theme</label><select id="workspaceTheme"><option value="system">System default</option><option value="light">Light</option><option value="dark">Dark</option></select></section><section><h3>Backups</h3><p>Export your local progress or restore a backup.</p><button data-settings="export">Export backup</button><button data-settings="import">Import backup</button></section>`;
    settings.querySelector('#workspaceTheme').value = state.settings?.theme || 'system';
    window.forgeDesktop.coachStatus().then(status => { const target = settings.querySelector('#workspaceConnection'); if (target && settings.isConnected) target.textContent = status.configured ? `Connected · ${status.model}` : 'No tutor key connected.'; }).catch(() => { const target=settings.querySelector('#workspaceConnection'); if(target && settings.isConnected) target.textContent='Could not check tutor connection.'; });
  }
  settings.addEventListener('change', event => {
    if (event.target.id === 'workspaceMemoryEnabled') { const previous=state.workspace.memory; state.workspace.memory={...memorySettings(),enabled:event.target.checked}; if(!save()){state.workspace.memory=previous;event.target.checked=memorySettings().enabled;} }
    if (event.target.id === 'workspaceTheme' && ['system','light','dark'].includes(event.target.value)) { state.settings.theme=event.target.value; save(); applyTheme(); }
  });
  settings.addEventListener('click', async event => {
    const action=event.target.closest('[data-settings]')?.dataset.settings;
    if (action === 'save-memory' || action === 'clear-memory') { const previous=state.workspace.memory; const notes=action === 'clear-memory' ? '' : settings.querySelector('#workspaceMemoryNotes').value.slice(0,2000); state.workspace.memory={...memorySettings(),notes}; if(save()){renderSettings();toast(action === 'clear-memory' ? 'Memory notes cleared.' : 'Memory saved.');} else state.workspace.memory=previous; return; }
    if (action === 'personalize') { window.OnboardingUI?.open(); return; }
    if (action === 'export') { document.getElementById('exportData').click(); return; }
    if (action === 'import') { document.getElementById('importFile').click(); return; }
    if (action !== 'connect' && action !== 'disconnect') return;
    const status=settings.querySelector('#workspaceConnection');
    try { const result=await (action === 'connect' ? window.forgeDesktop.coachConnect() : window.forgeDesktop.coachDisconnect()); if(status && settings.isConnected) status.textContent=result.configured ? `Connected · ${result.model}` : 'No tutor key connected.'; }
    catch (failure) { if(status && settings.isConnected) status.textContent=String(failure.message || 'Could not update the connection.'); }
  });
  function renderProgress() {
    const summary = WorkspaceCore.learningProgress(state.workspace);
    const quiz = WorkspaceCore.quizStats(state.workspace);
    const mastery=MasteryCore.summarize(state.workspace);
    const rows = summary.pathsByRecency.slice(0, 6).map(({ sessionId, title, activity, index }) => {
      const steps = Number(Boolean(activity.explored)) + Number(activity.answer === 1) + Number(Number.isInteger(activity.result));
      const next = !activity.explored ? 'Adjust the launch angle' : activity.answer !== 1 ? 'Try the understanding check' : !Number.isInteger(activity.result) ? 'Run your simulation' : 'Review your simulation';
      return `<li><div><strong>${esc(title)}</strong><small>Projectile playground · ${steps}/3 steps · ${next}</small></div><button class="btn sm" data-progress-session="${esc(sessionId)}" ${index === null ? '' : `data-progress-index="${index}"`}>${steps === 3 ? 'Review' : 'Continue'}</button></li>`;
    }).join('');
    const labs = [...state.workspace.sessions].sort((a,b)=>b.updatedAt-a.updatedAt).flatMap(session => [...(session.activity ? [{activity:session.activity,index:null}] : []), ...(session.activities||[]).map((activity,index)=>({activity,index})).reverse()].filter(item=>['livelab','livelab-creative'].includes(item.activity.type)).map(item=>({...item,session})));
    const labRows = labs.map(({session,activity,index}) => `<li><div><strong>${esc(activity.type === 'livelab-creative' ? activity.snapshot.scene.title : activity.lab.title)}</strong><small>LiveLab · ${esc(session.title)}</small></div><button class="btn sm" data-progress-session="${esc(session.id)}" ${index === null ? '' : `data-progress-index="${index}"`}>Open</button></li>`).join('');
    const planRows = summary.tutorPlans.slice(0,6).map(({sessionId,title,messageIndex,steps}) => { const done=steps.filter(step=>step.done).length; return `<li><div><strong>${esc(title)}</strong><small>Suggested path · ${done}/${steps.length} steps completed</small></div><button class="btn sm" data-progress-session="${esc(sessionId)}" data-progress-message="${messageIndex}">${done===steps.length?'Review':'Continue'}</button></li>`; }).join('');
    const chart=mastery.days.length?mastery.days.map(day=>{const percent=Math.round(day.correct/day.total*100);return `<div class="mastery-bar-item"><span>${percent}%</span><div class="mastery-bar-track"><i style="height:${percent}%"></i></div><small>${esc(day.day.slice(5))}</small></div>`;}).join(''):'<p>No question attempts recorded yet.</p>';
    const topicRows=mastery.topics.map(topic=>`<li><div><strong>${esc(topic.topic)}</strong><small>${topic.correct}/${topic.total} first attempts correct · ${topic.accuracy}% · ${esc(topic.status)}</small></div><div class="mastery-topic-meter" aria-label="${topic.accuracy} percent first-try accuracy"><span style="width:${topic.accuracy}%"></span></div></li>`).join('');
    const reviewRows=mastery.topics.filter(topic=>topic.due).map(topic=>`<li><div><strong>${esc(topic.topic)}</strong><small>${esc(topic.status)} · review suggested ${new Date(topic.dueAt).toLocaleDateString()}</small></div><button class="btn sm" data-review-session="${esc(topic.sessionId)}" data-review-message="${topic.messageIndex}" data-review-step="${topic.stepIndex}">Review lesson</button></li>`).join('');
    progress.innerHTML = `<div class="section-head"><div><span class="workspace-kicker">YOUR LEARNING</span><h2 tabindex="-1">Progress you can return to</h2></div><span class="small-badge">Saved on this device</span></div><p class="tiny muted">Counts reflect saved sessions, AI assessments, earlier self-marked steps, and activity results; they are not a measurement of mastery.</p><div class="workspace-progress-metrics"><div><strong>${summary.sessions}</strong><span>learning sessions</span></div><div><strong>${summary.tutorPlans.length}</strong><span>suggested paths</span></div><div><strong>${summary.aiCompletedSteps}</strong><span>AI-assessed steps</span></div><div><strong>${summary.simulations}</strong><span>simulations run</span></div></div><section class="quiz-overview" aria-label="Knowledge check statistics"><div><span class="quiz-overline">KNOWLEDGE CHECKS</span><h3>Your quiz insights</h3><p>From your saved lesson checks and their retries. Not a mastery score.</p></div><div class="quiz-overview-grid"><div><strong>${quiz.quizzes}</strong><span>questions attempted</span></div><div><strong>${quiz.firstTryPercent===null?'—':quiz.firstTryPercent+'%'}</strong><span>first-try accuracy</span><small>${quiz.firstTry} of ${quiz.firstTryEligible} questions</small></div><div><strong>${quiz.attemptPercent===null?'—':quiz.attemptPercent+'%'}</strong><span>answer accuracy</span><small>${quiz.correct} of ${quiz.attempts} attempts</small></div></div>${quiz.legacy?`<p>${quiz.legacy} older ${quiz.legacy===1?'check has':'checks have'} incomplete attempt history and ${quiz.legacy===1?'is':'are'} excluded from first-try accuracy.</p>`:''}</section><section class="mastery-overview"><div class="mastery-head"><div><span class="quiz-overline">LEARNING EVIDENCE</span><h3>Mastery &amp; review</h3><p>Topic signals use first answers to distinct questions. Demonstrated requires at least 3 questions and 80% first-try accuracy; it is not a grade.</p></div></div><div class="mastery-panels"><div><h4>Recent answer accuracy</h4><div class="mastery-chart" aria-label="Daily answer accuracy, including retries">${chart}</div><small>Daily attempts, including retries · latest 7 active days</small><p class="mastery-trend">${mastery.trend ? `First-try accuracy ${mastery.trend.change>0?'↑':mastery.trend.change<0?'↓':'→'} ${Math.abs(mastery.trend.change)} points vs. the previous ${mastery.trend.size} questions.` : 'Answer at least 4 distinct questions to see a first-try trend.'}</p></div><div><h4>Topic-level first attempts</h4>${topicRows?`<ul>${topicRows}</ul>`:'<p>Answer a new quiz to start tracking topics.</p>'}</div></div><h4>Spaced review</h4>${reviewRows?`<ul>${reviewRows}</ul>`:'<p>No reviews due yet. Weak topics are suggested after 1 day; developing topics after 3, demonstrated topics after 7.</p>'}</section>${labRows ? `<h3>Saved LiveLabs</h3><ul>${labRows}</ul>` : ''}${planRows ? `<h3>Your suggested paths</h3><ul>${planRows}</ul>` : ''}${rows ? `<h3>Interactive labs</h3><ul>${rows}</ul>` : ''}${!rows&&!planRows&&!labRows ? '<p class="muted">Start a session and create a learning path or open a lab to see your progress here.</p>' : ''}`;
  }
  progress.addEventListener('click', event => {
    const review=event.target.closest('[data-review-session]');
    if(review){const session=state.workspace.sessions.find(x=>x.id===review.dataset.reviewSession),messageIndex=Number(review.dataset.reviewMessage),stepIndex=Number(review.dataset.reviewStep),step=session?.messages[messageIndex]?.plan?.[stepIndex];if(!step?.lesson)return;state.workspace.selected=session.id;lessonPointer={sessionId:session.id,messageIndex,stepIndex};workspacePage='lesson';quizSelection=[];quizNumber='';lessonError='';save();render();return;}
    const button = event.target.closest('[data-progress-session]');
    if (!button) return;
    const session = state.workspace.sessions.find(item => item.id === button.dataset.progressSession);
    if (!session) { renderProgress(); return; }
    let planIndex = null;
    if (button.hasAttribute('data-progress-message')) {
      planIndex = Number(button.dataset.progressMessage);
      if (!Number.isInteger(planIndex) || !session.messages[planIndex]?.plan) { renderProgress(); return; }
      session.expanded = false;
    }
    if (button.hasAttribute('data-progress-index')) {
      const index = Number(button.dataset.progressIndex), selected = session.activities?.[index];
      if (!Number.isInteger(index) || !['projectile','livelab','livelab-creative'].includes(selected?.type)) { renderProgress(); return; }
      session.activities.splice(index, 1);
      if (session.activity) session.activities.push(session.activity);
      session.activity = selected;
    }
    state.workspace.selected = session.id;
    workspacePage = 'learn'; save(); render();
    if (planIndex !== null) document.getElementById(`workspace-plan-${planIndex}`)?.focus();
    else document.getElementById('workspaceActivityHeading')?.focus();
  });
  window.WorkspaceUI = { refresh: render, refreshProgress: renderProgress };
  render();
  go('workspace');
})();
