(function () {
  'use strict';
  const root = document.getElementById('workspaceRoot');
  let busy = false;
  let error = '';
  let filter = '';
  const current = () => state.workspace.sessions.find(item => item.id === state.workspace.selected);
  const touch = session => { session.updatedAt = Date.now(); save(); };
  const activityNames = { 'binary-search': 'Binary search lab', 'school-question': 'Practice question', sorting: 'Sorting lab', 'number-line': 'Number line' };
  const activityActions = { 'binary-search': 'binary', 'school-question': 'practice', sorting: 'sorting', 'number-line': 'number-line' };
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
    const sessions = [...state.workspace.sessions].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
      .filter(item => item.title.toLowerCase().includes(filter.toLowerCase()));
    root.innerHTML = `<div class="workspace-layout"><aside class="workspace-sessions" aria-label="Learning sessions">
      <h2>Sessions</h2><label for="workspaceSearch">Search conversations</label><input id="workspaceSearch" value="${esc(filter)}" placeholder="Search">
      <div class="workspace-list">${sessions.map(item => `<button data-session="${esc(item.id)}" ${item.id === session?.id ? 'aria-current="true"' : ''}>${item.pinned ? '★ ' : ''}${esc(item.title)}<small>${new Date(item.updatedAt).toLocaleDateString()}</small></button>`).join('')}</div>
      <div class="workspace-links"><button data-go="projects">Projects</button><button data-go="math">Practice exams</button><button data-go="coach">Coach settings</button></div></aside>
      <div class="workspace-chat"><header><div><span class="workspace-kicker">FORGE LEARNING</span><h1>${esc(session?.title || 'What would you like to learn?')}</h1>${session ? `<span>${session.minutes} minute plan</span>` : ''}</div>${session ? '<div class="workspace-actions"><button data-action="pin">'+(session.pinned?'Unpin':'Pin')+'</button><button data-action="rename">Rename</button><button data-action="delete">Delete</button></div>' : ''}</header>
      <div class="workspace-messages" id="workspaceMessages" aria-live="polite">${session ? session.messages.map(message => `<article class="workspace-message ${message.role}"><strong>${message.role === 'user' ? 'You' : 'FORGE'}</strong><p>${esc(message.text)}</p>${message.activity ? `<button data-action="${activityActions[message.activity]}">Open ${activityNames[message.activity]}</button>` : ''}</article>`).join('') : '<p>Choose a session length to get started.</p>'}${busy ? '<p role="status">FORGE is thinking…</p>' : ''}${error ? `<p class="workspace-error" role="alert">${esc(error)}</p>` : ''}</div>
      ${!session ? '<div class="workspace-durations"><button data-minutes="15">15 minutes</button><button data-minutes="25">25 minutes</button><button data-minutes="40">40 minutes</button></div>' : `<form id="workspaceForm"><label for="workspaceInput">Your message</label><textarea id="workspaceInput" maxlength="4000" required placeholder="Ask a question or describe what you want to learn…"></textarea><div><button type="submit" ${busy ? 'disabled' : ''}>Send</button>${error && session.messages.at(-1)?.role === 'user' ? `<button type="button" data-action="retry" ${busy ? 'disabled' : ''}>Retry</button>` : ''}</div></form>`}
      ${session ? `<div class="workspace-tools"><button data-action="practice">Practice a question</button><button data-action="binary">Binary search lab</button><button data-action="sorting">Sorting lab</button><button data-action="number-line">Number line</button><button data-go="coding">Open coding</button><button data-go="lessons">Explore lessons</button><button data-go="school">School Edition</button></div>${session.activities?.length ? `<details class="workspace-history"><summary>Saved activities (${session.activities.length})</summary><div>${session.activities.map((item, index) => `<button data-activity-index="${index}">${esc(activityNames[item.type])}${item.type === 'school-question' ? ' · ' + esc(SchoolCore.byId.get(item.questionId).topic) : item.target !== undefined ? ' · target ' + item.target : ''}</button>`).join('')}</div></details>` : ''}` : ''}
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
      if (activity?.type === 'sorting' && messages.at(-1)?.role === 'user') {
        const result = WorkspaceCore.sortingState(activity);
        messages.at(-1).text = (messages.at(-1).text + `\n\nSorting practice: ${result.comparisons} correct comparisons, ${result.mistakes} incorrect choices, ${result.finished ? 'completed' : 'in progress'}.`).slice(0, 4000);
      }
      if (activity?.type === 'number-line' && messages.at(-1)?.role === 'user') {
        const result = WorkspaceCore.lineState(activity);
        messages.at(-1).text = (messages.at(-1).text + `\n\nNumber line practice: target ${activity.target}, ${result.attempts} attempts, ${result.finished ? 'completed' : 'in progress'}.`).slice(0, 4000);
      }
      const response = await window.forgeDesktop.coachConversation({ minutes: session.minutes, goal: state.coach.profile?.goal || '', messages });
      if (!response || typeof response.reply !== 'string' || !response.reply.trim() || response.reply.length > 8000 || response.activity !== 'none' && !Object.hasOwn(activityActions, response.activity)) throw Error('The tutor returned an invalid response. Please retry.');
      if (state.workspace.sessions.includes(session)) { session.messages.push({ role: 'assistant', text: response.reply, ...(response.activity !== 'none' ? { activity: response.activity } : {}) }); touch(session); }
    } catch (failure) { error = String(failure.message || failure).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''); }
    finally { busy = false; render(); }
  }

  root.addEventListener('input', event => {
    if (event.target.id !== 'workspaceLine' || current()?.activity?.type !== 'number-line') return;
    const session = current();
    const position = Number(event.target.value);
    if (!Number.isInteger(position) || position < -10 || position > 10) return;
    session.activity.position = position;
    document.getElementById('workspaceLineValue').textContent = String(position);
    touch(session);
  });

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
