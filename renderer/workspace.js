(function () {
  'use strict';
  const root = document.getElementById('workspaceRoot');
  const sidebar = document.getElementById('workspaceSidebar');
  let busy = false;
  let codeBusy = null;
  let codeError = null;
  let codeCancelRequested = false;
  let error = '';
  let filter = '';
  let renderedSession = null;
  const current = () => state.workspace.sessions.find(item => item.id === state.workspace.selected);
  const touch = session => { session.updatedAt = Date.now(); save(); };
  const activityNames = { 'binary-search': 'Binary search lab', 'school-question': 'Practice question', sorting: 'Sorting lab', 'number-line': 'Number line', coding: 'Coding challenge' };
  const activityActions = { 'binary-search': 'binary', 'school-question': 'practice', sorting: 'sorting', 'number-line': 'number-line', coding: 'coding-challenge' };
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
    const focused = sameSession && ['workspaceInput', 'workspaceCode', 'workspaceSearch'].includes(document.activeElement?.id) ? document.activeElement.id : null;
    const selectionStart = focused ? document.activeElement.selectionStart : null;
    const selectionEnd = focused ? document.activeElement.selectionEnd : null;
    const sessions = [...state.workspace.sessions].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
      .filter(item => item.title.toLowerCase().includes(filter.toLowerCase()));
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString();
    const sessionGroups = [
      ['Pinned', sessions.filter(item => item.pinned)],
      ['Today', sessions.filter(item => !item.pinned && new Date(item.updatedAt).toDateString() === today)],
      ['Yesterday', sessions.filter(item => !item.pinned && new Date(item.updatedAt).toDateString() === yesterday)],
      ['Earlier', sessions.filter(item => !item.pinned && ![today, yesterday].includes(new Date(item.updatedAt).toDateString()))]
    ];
    root.innerHTML = `<div class="workspace-layout${session?.expanded && session.activity ? ' workspace-expanded' : ''}"><aside class="workspace-sessions" aria-label="Learning sessions">
      <h2>Sessions</h2><button class="workspace-new" data-action="new">+ New learning session</button><label for="workspaceSearch">Search conversations</label><input id="workspaceSearch" value="${esc(filter)}" placeholder="Search">
      <div class="workspace-list">${sessionGroups.filter(([, items]) => items.length).map(([label, items]) => `<section aria-label="${label}"><h3>${label}</h3>${items.map(item => `<button data-session="${esc(item.id)}" ${item.id === session?.id ? 'aria-current="true"' : ''}>${esc(item.title)}<small>${new Date(item.updatedAt).toLocaleDateString()}</small></button>`).join('')}</section>`).join('')}</div>
      <div class="workspace-links"><button data-go="projects">Projects</button><button data-go="math">Practice exams</button><button data-go="coach">Coach settings</button><button data-go="insights">Profile and backups</button></div></aside>
      <div class="workspace-chat"><header><div><span class="workspace-kicker">FORGE LEARNING</span><h1>${esc(session?.title || 'What would you like to learn?')}</h1>${session ? `<span>${session.minutes} minute plan</span>` : ''}</div>${session ? '<div class="workspace-actions"><button data-action="pin">'+(session.pinned?'Unpin':'Pin')+'</button><button data-action="rename">Rename</button><button data-action="delete">Delete</button></div>' : ''}</header>
      <div class="workspace-messages" id="workspaceMessages" aria-live="polite">${session ? session.messages.map(message => `<article class="workspace-message ${message.role}"><strong>${message.role === 'user' ? 'You' : 'FORGE'}</strong><p>${esc(message.text)}</p>${message.activity ? `<button data-action="${activityActions[message.activity]}">Open ${activityNames[message.activity]}</button>` : ''}</article>`).join('') : '<p>Choose a session length to get started.</p>'}${busy ? '<p role="status">FORGE is thinking…</p>' : ''}${error ? `<p class="workspace-error" role="alert">${esc(error)}</p>` : ''}</div>
      ${!session ? '<div class="workspace-durations"><button data-minutes="15">15 minutes</button><button data-minutes="25">25 minutes</button><button data-minutes="40">40 minutes</button></div>' : `<form id="workspaceForm"><label for="workspaceInput">Your message</label><textarea id="workspaceInput" maxlength="4000" required placeholder="Ask a question or describe what you want to learn…">${esc(session.draft || '')}</textarea><div><button type="submit" ${busy ? 'disabled' : ''}>Send</button>${session.messages.at(-1)?.role === 'user' && !busy ? '<button type="button" data-action="retry">Retry last message</button>' : ''}${session.messages.length === 0 ? `<button type="button" data-action="suggest" ${busy ? 'disabled' : ''}>Suggest a starting point</button>` : ''}</div><p class="workspace-privacy">Sending shares recent messages, your learning goal, and short School and activity summaries with OpenAI. API usage is billed to your key. Drafts stay on this device until sent.</p></form>`}
      ${session ? `<div class="workspace-tools"><button data-action="practice">Practice a question</button><button data-action="binary">Binary search lab</button><button data-action="sorting">Sorting lab</button><button data-action="number-line">Number line</button><button data-action="coding-challenge">Coding challenge</button><button data-go="coding">Open coding</button><button data-go="lessons">Explore lessons</button><button data-go="school">School Edition</button></div>${session.activities?.length ? `<details class="workspace-history"><summary>Saved activities (${session.activities.length})</summary><div>${session.activities.map((item, index) => `<button data-activity-index="${index}">${esc(activityNames[item.type])}${item.type === 'school-question' ? ' · ' + esc(SchoolCore.byId.get(item.questionId).topic) : item.target !== undefined ? ' · target ' + item.target : ''}</button>`).join('')}</div></details>` : ''}` : ''}
      </div>${activityMarkup(session)}</div>`;
    sidebar.replaceChildren(root.querySelector('.workspace-sessions'));
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
    document.getElementById('workspaceForm')?.addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('workspaceInput');
      const text = input.value.trim();
      if (!text || busy) return;
      if (session.messages.length >= 299) { error = 'This session is full. Start a new session to continue.'; render(); return; }
      session.messages.push({ role: 'user', text });
      session.draft = '';
      if (session.messages.length === 1) session.title = text.slice(0, 70);
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
    busy = true; error = ''; render();
    try {
      const messages = session.messages.slice(-12).map(message => ({ role: message.role, text: message.text.slice(0, 3000) }));
      const activity = session.activity;
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
      if (activity?.type === 'coding' && activity.attempts.length && messages.at(-1)?.role === 'user') {
        const tests = activity.attempts.at(-1).tests;
        const passed = tests.filter((test, index) => test.status === 'Accepted' && test.output.trim() === WorkspaceCore.codingChallenge.tests[index].expected).length;
        const draftChanged = activity.attempts.at(-1).code !== activity.code;
        messages.at(-1).text = (messages.at(-1).text + `\n\nCoding practice: ${passed} of ${WorkspaceCore.codingChallenge.tests.length} public tests passed; ${tests.length} tests completed${draftChanged ? ' on an earlier draft' : ''}.`).slice(0, 4000);
      }
      const schoolTopics = SchoolCore.weakTopics(state.school).filter(item => item.answered > 0).slice(0, 6).map(({ subject, topic, answered, correct }) => ({ subject, topic, answered, correct }));
      const response = await window.forgeDesktop.coachConversation({ minutes: session.minutes, goal: state.coach.profile?.goal || '', schoolTopics, messages });
      if (!response || typeof response.reply !== 'string' || !response.reply.trim() || response.reply.length > 8000 || response.activity !== 'none' && !Object.hasOwn(activityActions, response.activity)) throw Error('The tutor returned an invalid response. Please retry.');
      if (state.workspace.sessions.includes(session)) { session.messages.push({ role: 'assistant', text: response.reply, ...(response.activity !== 'none' ? { activity: response.activity } : {}) }); touch(session); }
    } catch (failure) { if (current() === session) error = String(failure.message || failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''); }
    finally { busy = false; render(); }
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

  root.addEventListener('input', event => {
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
  document.getElementById('workspaceToolsToggle').addEventListener('click', event => {
    const expanded = document.body.classList.toggle('workspace-nav-open');
    event.currentTarget.setAttribute('aria-expanded', String(expanded));
  });
  document.getElementById('workspaceSidebarToggle').addEventListener('click', event => {
    const expanded = document.body.classList.toggle('workspace-sessions-open');
    event.currentTarget.setAttribute('aria-expanded', String(expanded));
  });
  window.WorkspaceUI = { refresh: render };
  render();
  go('workspace');
})();
