(function () {
  'use strict';
  const root = document.getElementById('workspaceRoot');
  let busy = false;
  let error = '';
  let filter = '';
  const current = () => state.workspace.sessions.find(item => item.id === state.workspace.selected);
  const touch = session => { session.updatedAt = Date.now(); save(); };
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
    const sessions = [...state.workspace.sessions].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
      .filter(item => item.title.toLowerCase().includes(filter.toLowerCase()));
    root.innerHTML = `<div class="workspace-layout"><aside class="workspace-sessions" aria-label="Learning sessions">
      <h2>Sessions</h2><label for="workspaceSearch">Search conversations</label><input id="workspaceSearch" value="${esc(filter)}" placeholder="Search">
      <div class="workspace-list">${sessions.map(item => `<button data-session="${esc(item.id)}" ${item.id === session?.id ? 'aria-current="true"' : ''}>${item.pinned ? '★ ' : ''}${esc(item.title)}<small>${new Date(item.updatedAt).toLocaleDateString()}</small></button>`).join('')}</div>
      <div class="workspace-links"><button data-go="projects">Projects</button><button data-go="math">Practice exams</button><button data-go="coach">Coach settings</button></div></aside>
      <div class="workspace-chat"><header><div><span class="workspace-kicker">FORGE LEARNING</span><h1>${esc(session?.title || 'What would you like to learn?')}</h1>${session ? `<span>${session.minutes} minute plan</span>` : ''}</div>${session ? '<div class="workspace-actions"><button data-action="pin">'+(session.pinned?'Unpin':'Pin')+'</button><button data-action="rename">Rename</button><button data-action="delete">Delete</button></div>' : ''}</header>
      <div class="workspace-messages" id="workspaceMessages" aria-live="polite">${session ? session.messages.map(message => `<article class="workspace-message ${message.role}"><strong>${message.role === 'user' ? 'You' : 'FORGE'}</strong><p>${esc(message.text)}</p>${message.activity ? `<button data-action="${message.activity === 'binary-search' ? 'binary' : 'practice'}">${message.activity === 'binary-search' ? 'Open binary search lab' : 'Practice a reviewed question'}</button>` : ''}</article>`).join('') : '<p>Choose a session length to get started.</p>'}${busy ? '<p role="status">FORGE is thinking…</p>' : ''}${error ? `<p class="workspace-error" role="alert">${esc(error)}</p>` : ''}</div>
      ${!session ? '<div class="workspace-durations"><button data-minutes="15">15 minutes</button><button data-minutes="25">25 minutes</button><button data-minutes="40">40 minutes</button></div>' : `<form id="workspaceForm"><label for="workspaceInput">Your message</label><textarea id="workspaceInput" maxlength="4000" required placeholder="Ask a question or describe what you want to learn…"></textarea><div><button type="submit" ${busy ? 'disabled' : ''}>Send</button>${error && session.messages.at(-1)?.role === 'user' ? `<button type="button" data-action="retry" ${busy ? 'disabled' : ''}>Retry</button>` : ''}</div></form>`}
      ${session ? `<div class="workspace-tools"><button data-action="practice">Practice a question</button><button data-action="binary">Binary search lab</button><button data-go="coding">Open coding</button><button data-go="lessons">Explore lessons</button><button data-go="school">School Edition</button></div>${session.activities?.length ? `<details class="workspace-history"><summary>Saved activities (${session.activities.length})</summary><div>${session.activities.map((item, index) => `<button data-activity-index="${index}">${item.type === 'binary-search' ? 'Binary search · target ' + item.target : esc(SchoolCore.byId.get(item.questionId).topic) + ' · question'}</button>`).join('')}</div></details>` : ''}` : ''}
      <button class="workspace-new" data-action="new">+ New learning session</button></div>${activityMarkup(session)}</div>`;
    const search = document.getElementById('workspaceSearch');
    search.addEventListener('change', () => { filter = search.value; render(); });
    document.getElementById('workspaceForm')?.addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('workspaceInput');
      const text = input.value.trim();
      if (!text || busy) return;
      if (session.messages.length >= 299) { error = 'This session is full. Start a new session to continue.'; render(); return; }
      session.messages.push({ role: 'user', text });
      if (session.messages.length === 1) session.title = text.slice(0, 70);
      touch(session);
      respond(session);
    });
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
      const response = await window.forgeDesktop.coachConversation({ minutes: session.minutes, goal: state.coach.profile?.goal || '', messages });
      if (!response || typeof response.reply !== 'string' || !response.reply.trim() || response.reply.length > 8000 || !['none', 'binary-search', 'school-question'].includes(response.activity)) throw Error('The tutor returned an invalid response. Please retry.');
      if (state.workspace.sessions.includes(session)) { session.messages.push({ role: 'assistant', text: response.reply, ...(response.activity !== 'none' ? { activity: response.activity } : {}) }); touch(session); }
    } catch (failure) { error = String(failure.message || failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''); }
    finally { busy = false; render(); }
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.session) { state.workspace.selected = button.dataset.session; error = ''; save(); render(); return; }
    if (button.dataset.minutes) {
      if (state.workspace.sessions.length >= 100) { error = 'Delete a session before creating another.'; render(); return; }
      const now = Date.now();
      const session = { id: crypto.randomUUID(), title: 'New learning session', minutes: Number(button.dataset.minutes), createdAt: now, updatedAt: now, pinned: false, messages: [], activity: null, activities: [] };
      state.workspace.sessions.push(session); state.workspace.selected = session.id; error = ''; save(); render(); document.getElementById('workspaceInput')?.focus(); return;
    }
    const session = current();
    if (button.dataset.action === 'new') { state.workspace.selected = null; error = ''; save(); render(); }
    if (!session) return;
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
    if (button.dataset.action === 'close-activity') { if (!archiveActivity(session)) return; touch(session); render(); return; }
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
  });
  window.WorkspaceUI = { refresh: render };
  render();
  go('workspace');
})();
