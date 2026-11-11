(function () {
  'use strict';
  const root = document.getElementById('workspaceRoot');
  const sidebar = document.getElementById('workspaceSidebar');
  let busy = false;
  let pendingStream = null;
  let codeBusy = null;
  let codeError = null;
  let codeCancelRequested = false;
  let error = '';
  let filter = '';
  let renderedSession = null;
  const current = () => state.workspace.sessions.find(item => item.id === state.workspace.selected);
  const touch = session => { session.updatedAt = Date.now(); save(); };
  const activityNames = { 'binary-search': 'Binary search lab', 'school-question': 'Practice question', sorting: 'Sorting lab', 'number-line': 'Number line', coding: 'Coding challenge', 'equation-balance': 'Equation balance', projectile: 'Projectile playground' };
  const activityActions = { 'binary-search': 'binary', 'school-question': 'practice', sorting: 'sorting', 'number-line': 'number-line', coding: 'coding-challenge', 'equation-balance': 'equation-balance', projectile: 'projectile' };
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
        return `<aside class="workspace-activity workspace-projectile" aria-labelledby="workspaceActivityHeading"><div class="workspace-activity-header"><h2 id="workspaceActivityHeading" tabindex="-1">Build a launch simulation</h2><button data-action="close-activity" aria-label="Close activity">×</button></div><p>Choose a launch speed and run the model. This simulation uses a 45° angle, Earth gravity and level ground.</p><label for="projectileSpeed">Launch speed: <strong>${activity.speed} m/s</strong></label><input id="projectileSpeed" type="range" min="5" max="30" value="${activity.speed}"><pre class="projectile-code"><code>speed = ${activity.speed}\ngravity = 9.81\nrange_m = speed ** 2 / gravity\nprint(range_m)</code></pre><button data-action="projectile-run">Run simulation</button>${graph}${result === null ? '' : `<p role="status"><strong>${result.toFixed(1)} m</strong> predicted range at ${activity.result} m/s.${activity.result !== activity.speed ? ' Change the speed and run again to update the result.' : ''}</p>`}<p>The result is calculated locally in FORGE. The Python shown expresses the same calculation.</p><button data-action="projectile-explore">Return to the lab</button></aside>`;
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

  function render() {
    const session = current();
    const oldMessages = document.getElementById('workspaceMessages');
    const sameSession = renderedSession === (session?.id || null);
    const scrollTop = oldMessages?.scrollTop || 0;
    const followLatest = !sameSession || !oldMessages || oldMessages.scrollHeight - oldMessages.scrollTop - oldMessages.clientHeight < 32;
    const focused = sameSession && ['workspaceInput', 'workspaceCode', 'workspaceSearch', 'workspaceLearningGoal'].includes(document.activeElement?.id) ? document.activeElement.id : null;
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
      <div class="workspace-links"><button data-go="projects">Projects</button><button data-go="math">Practice exams</button><button data-go="coach">Coach settings</button><button data-go="insights">Progress and backups</button></div></aside>
      <div class="workspace-chat"><header><div><span class="workspace-kicker">FORGE LEARNING</span><h1>${esc(session?.title || 'What would you like to learn?')}</h1>${session ? `<span>${session.minutes} minute plan</span>` : ''}</div>${session ? '<div class="workspace-actions"><button data-action="pin">'+(session.pinned?'Unpin':'Pin')+'</button><button data-action="rename">Rename</button><button data-action="delete">Delete</button></div>' : ''}</header>
      <div class="workspace-messages" id="workspaceMessages" aria-live="polite">${session ? session.messages.map(message => `<article class="workspace-message ${message.role}"><strong>${message.role === 'user' ? 'You' : 'FORGE'}</strong>${message.role === 'assistant' ? `<div class="workspace-rich-text">${WorkspaceMarkup.render(message.text)}</div>` : `<p>${esc(message.text)}</p>`}${message.activity ? `<button data-action="${activityActions[message.activity]}">Open ${activityNames[message.activity]}</button>` : ''}</article>`).join('') : welcome}${pendingStream && pendingStream.session === session ? `<article class="workspace-message streaming"><strong>FORGE</strong><p id="workspaceStream" aria-live="off">${esc(pendingStream.text)}</p></article><p role="status">FORGE is responding…</p>` : ''}${error ? `<p class="workspace-error" role="alert">${esc(error)}</p>` : ''}</div>
      ${!session ? '<div class="workspace-durations"><button data-minutes="15">15 minutes</button><button data-minutes="25">25 minutes</button><button data-minutes="40">40 minutes</button></div>' : `<form id="workspaceForm"><label for="workspaceInput">Your message</label><textarea id="workspaceInput" maxlength="4000" required placeholder="Ask a question or describe what you want to learn…">${esc(session.draft || '')}</textarea><div><button type="submit" ${busy ? 'disabled' : ''}>Send</button>${pendingStream?.session === session ? '<button type="button" data-action="stop-tutor">Stop response</button>' : ''}${session.messages.at(-1)?.role === 'user' && !busy ? '<button type="button" data-action="retry">Retry last message</button>' : ''}${session.messages.length === 0 ? `<button type="button" data-action="suggest" ${busy ? 'disabled' : ''}>Suggest a starting point</button>` : ''}</div><p class="workspace-privacy">Sending shares recent messages, your learning goal, and short School and activity summaries with OpenAI. API usage is billed to your key. Drafts stay on this device until sent.</p></form>`}
      ${session ? `<div class="workspace-tools"><button data-action="practice">Practice a question</button><button data-action="projectile">Projectile playground</button><button data-action="binary">Binary search lab</button><button data-action="sorting">Sorting lab</button><button data-action="number-line">Number line</button><button data-action="equation-balance">Equation balance</button><button data-action="coding-challenge">Coding challenge</button><button data-go="coding">Open coding</button><button data-go="lessons">Explore lessons</button><button data-go="school">School Edition</button></div>${session.activities?.length ? `<details class="workspace-history"><summary>Saved activities (${session.activities.length})</summary><div>${session.activities.map((item, index) => `<button data-activity-index="${index}">${esc(activityNames[item.type])}${item.type === 'school-question' ? ' · ' + esc(SchoolCore.byId.get(item.questionId).topic) : item.target !== undefined ? ' · target ' + item.target : ''}</button>`).join('')}</div></details>` : ''}` : ''}
      </div>${activityMarkup(session)}</div>`;
    sidebar.replaceChildren(root.querySelector('.workspace-sessions'));
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
        root.querySelector('.workspace-tools')?.before(panel);
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
    const composer = document.getElementById('workspaceForm');
    if (composer) {
      const importer = document.createElement('div');
      importer.className = 'workspace-import';
      importer.innerHTML = `<label for="workspaceLearningGoal">What do you want to learn or build? <span>(optional)</span></label><input id="workspaceLearningGoal" type="text" maxlength="300" value="${esc(session.learningGoal || '')}" placeholder="e.g. Build a launch simulator"><button type="button" data-action="prepare-learning-path">Use goal in draft</button><label for="workspaceNotes">Drop notes here or choose a file (.txt or .pdf)</label><input id="workspaceNotes" type="file" accept=".txt,text/plain,.pdf,application/pdf"><p>Your goal and notes stay on this device until you send the draft to the tutor.</p>`;
      composer.querySelector('textarea').after(importer);
    }
    document.getElementById('workspaceForm')?.addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('workspaceInput');
      const text = input.value.trim();
      if (!text || busy) return;
      if (session.messages.length >= 299) { error = 'This session is full. Start a new session to continue.'; render(); return; }
      session.messages.push({ role: 'user', text });
      session.draft = '';
      if (session.messages.length === 1) session.title = (session.learningGoal?.trim() || text).slice(0, 70);
      touch(session);
      respond(session);
    });
    const newMessages = document.getElementById('workspaceMessages');
    if (newMessages) newMessages.scrollTop = followLatest ? newMessages.scrollHeight : scrollTop;
    renderedSession = session?.id || null;
    const target = focused && document.getElementById(focused);
    if (target && !target.disabled) { target.focus({ preventScroll: true }); if (typeof target.setSelectionRange === 'function') target.setSelectionRange(selectionStart, selectionEnd); }
  }

  async function respond(session) {
    busy = true; error = ''; pendingStream = { requestId: crypto.randomUUID(), session, text: '' }; render();
    try {
      const messages = session.messages.slice(-12).map(message => ({ role: message.role, text: message.text.slice(0, 4000) }));
      const activity = session.activity;
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
      const response = await window.forgeDesktop.coachConversation({ requestId: pendingStream.requestId, minutes: session.minutes, goal: state.coach.profile?.goal || '', schoolTopics, messages });
      if (!response || typeof response.reply !== 'string' || !response.reply.trim() || response.reply.length > 8000 || response.activity !== 'none' && !Object.hasOwn(activityActions, response.activity)) throw Error('The tutor returned an invalid response. Please retry.');
      if (state.workspace.sessions.includes(session)) { session.messages.push({ role: 'assistant', text: response.reply, ...(response.activity !== 'none' ? { activity: response.activity } : {}) }); touch(session); }
    } catch (failure) { if (current() === session) error = String(failure.message || failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''); }
    finally { busy = false; pendingStream = null; render(); }
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
    if (event.target.id === 'workspaceCode' && current()?.activity?.type === 'coding') {
      const session = current();
      session.activity.code = event.target.value.slice(0, 8000);
      touch(session);
      return;
    }
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
    if (button.dataset.session) { state.workspace.selected = button.dataset.session; error = ''; save(); render(); document.body.classList.remove('workspace-sessions-open'); document.getElementById('workspaceSidebarToggle').setAttribute('aria-expanded','false'); return; }
    if (button.dataset.minutes) {
      if (state.workspace.sessions.length >= 100) { error = 'Delete a session before creating another.'; render(); return; }
      const now = Date.now();
      const session = { id: crypto.randomUUID(), title: 'New learning session', minutes: Number(button.dataset.minutes), createdAt: now, updatedAt: now, pinned: false, messages: [], activity: null, activities: [], draft: '', expanded: false };
      state.workspace.sessions.push(session); state.workspace.selected = session.id; error = ''; save(); render(); document.getElementById('workspaceInput')?.focus(); return;
    }
    const session = current();
    if (button.dataset.action === 'new') { state.workspace.selected = null; error = ''; save(); render(); document.body.classList.remove('workspace-sessions-open'); document.getElementById('workspaceSidebarToggle').setAttribute('aria-expanded','false'); }
    if (!session) return;
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
      if (!archiveActivity(session)) return;
      session.activity = { type: 'coding', challengeId: WorkspaceCore.codingChallenge.id, code: WorkspaceCore.codingChallenge.starter, attempts: [] };
      codeError = null;
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
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
      const selected = session.activities[index];
      session.activities.splice(index, 1);
      if (session.activity) session.activities.push(session.activity);
      session.activity = selected;
      touch(session); render(); document.getElementById('workspaceActivityHeading')?.focus(); return;
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
    if (button.dataset.action === 'rename') { const title = prompt('Session name', session.title)?.trim(); if (title) { session.title = title.slice(0, 100); touch(session); render(); } }
    if (button.dataset.action === 'delete' && confirm('Delete this learning session?')) { state.workspace.sessions = state.workspace.sessions.filter(item => item !== session); state.workspace.selected = null; save(); render(); }
    if (button.dataset.action === 'retry' && !busy) respond(session);
  }
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
  document.getElementById('insightsMetrics').after(progress);
  function renderProgress() {
    const summary = WorkspaceCore.learningProgress(state.workspace);
    const rows = summary.pathsByRecency.slice(0, 6).map(({ sessionId, title, activity, index }) => {
      const steps = Number(Boolean(activity.explored)) + Number(activity.answer === 1) + Number(Number.isInteger(activity.result));
      const next = !activity.explored ? 'Adjust the launch angle' : activity.answer !== 1 ? 'Try the understanding check' : !Number.isInteger(activity.result) ? 'Run your simulation' : 'Review your simulation';
      return `<li><div><strong>${esc(title)}</strong><small>Projectile playground · ${steps}/3 steps · ${next}</small></div><button class="btn sm" data-progress-session="${esc(sessionId)}" ${index === null ? '' : `data-progress-index="${index}"`}>${steps === 3 ? 'Review' : 'Continue'}</button></li>`;
    }).join('');
    progress.innerHTML = `<div class="section-head"><div><span class="workspace-kicker">YOUR LEARNING</span><h2>Progress you can return to</h2></div><span class="small-badge">Saved on this device</span></div><p class="tiny muted">Counts reflect saved sessions and current activity results, not a measurement of mastery.</p><div class="workspace-progress-metrics"><div><strong>${summary.sessions}</strong><span>learning sessions</span></div><div><strong>${summary.paths}</strong><span>projectile paths</span></div><div><strong>${summary.checks}</strong><span>correct checks</span></div><div><strong>${summary.simulations}</strong><span>simulations run</span></div></div>${rows ? `<h3>Pick up where you left off</h3><ul>${rows}</ul>` : '<p class="muted">Start a learning session and open Projectile playground to see your path here.</p>'}`;
  }
  progress.addEventListener('click', event => {
    const button = event.target.closest('[data-progress-session]');
    if (!button) return;
    const session = state.workspace.sessions.find(item => item.id === button.dataset.progressSession);
    if (!session) { renderProgress(); return; }
    if (button.hasAttribute('data-progress-index')) {
      const index = Number(button.dataset.progressIndex), selected = session.activities?.[index];
      if (!Number.isInteger(index) || selected?.type !== 'projectile') { renderProgress(); return; }
      session.activities.splice(index, 1);
      if (session.activity) session.activities.push(session.activity);
      session.activity = selected;
    }
    state.workspace.selected = session.id;
    save(); go('workspace');
    document.getElementById('workspaceActivityHeading')?.focus();
  });
  window.WorkspaceUI = { refresh: render, refreshProgress: renderProgress };
  render();
  go('workspace');
})();
