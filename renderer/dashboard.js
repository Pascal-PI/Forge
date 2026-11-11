'use strict';
(function () {
  const node = id => document.getElementById(id);
  const put = (id, value) => { const target = node(id); if (target) target.textContent = value; };
  const html = (id, value) => { const target = node(id); if (target) target.innerHTML = value; };
  const icons = {
    code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>',
    math: '<path d="M18 4H6l7 8-7 8h12"/>',
    trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-4 2h8"/>',
    robot: '<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4m-5 7h.01M17 14h.01M9 17h6M1 12v4m22-4v4"/>',
    book: '<path d="M12 5C8 2 4 3 3 4v15c3-2 6-1 9 1m0-15c4-3 8-2 9-1v15c-3-2-6-1-9 1V5Z"/>',
    flame: '<path d="M13 2c1 6-4 6-3 10 2-1 3-2 4-4 5 4 6 7 4 10a7 7 0 0 1-12-1C4 12 10 8 13 2Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 8-8m-5 0h5v5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.star}</svg>`;
  const lessons = () => (state.coach?.history || []).filter(entry => entry.kind === 'lesson' && entry.result?.lesson);
  const sortedLessons = () => [...lessons()].sort((a, b) => b.createdAt - a.createdAt);
  const lessonTitle = entry => entry.result?.title || entry.result?.lesson?.topic || 'Saved lesson';
  const count = value => Number(value || 0).toLocaleString();
  let mission = null;
  let searchEntries = [];

  function focusIn(view, selector) {
    go(view);
    const target = document.querySelector(selector);
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
    if (!target.matches('button,input,select,textarea,a,[tabindex]')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  function openTask(id) {
    go('plan');
    node('taskFilter').value = 'all';
    renderPlan();
    const target = Array.from(node('planTasks')?.querySelectorAll('[data-task-edit]') || []).find(item => item.dataset.taskEdit === id);
    if (target) { target.scrollIntoView({ block: 'center', behavior: 'instant' }); target.focus({ preventScroll: true }); }
  }

  function openPastPapers() {
    go('math');
    node('showPastPapers')?.click();
    const heading = node('amcLibrary')?.querySelector('h2') || document.querySelector('#view-math h1');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }

  function openProject(id) {
    go('projects');
    const item = ProjectCore.catalog.find(project => project.id === id);
    if (!item) return;
    // Search never changes preferences or creates missions. Show the local outline in a preview.
    openModal(item.title, `<div class="dashboard-project-preview"><p>${esc(item.summary || '')}</p><p class="small-badge">${esc(item.track)} · ${esc(item.level)} · about ${item.minutes} min</p><h3>First step</h3><p>${esc(item.starter)}</p><h3>Check your work</h3><p>${esc(item.check)}</p><button class="btn primary" id="dashboardProjectClose">Explore project recommendations</button></div>`);
    node('dashboardProjectClose').onclick = () => closeModal(() => focusIn('projects', '#projectPreferenceForm'));
  }

  function renderMission() {
    const todayTasks = state.tasks.filter(task => task.date === todayKey());
    mission = todayTasks.find(task => !task.done) || null;
    const allDone = todayTasks.length > 0 && todayTasks.every(task => task.done);
    put('dashboardMissionTitle', mission?.name || (allDone ? 'A good day of progress.' : 'Your next step starts here.'));
    put('dashboardMissionDescription', mission ? 'One mission. Your full attention. Open your plan, then make a little more progress.' : allDone ? 'Your planned missions are complete. Review what you learned or make a plan for tomorrow.' : 'Choose a lesson, try a past paper, or add a mission that moves you toward your goals.');
    put('dashboardMissionMeta', mission ? `${mission.category} · ${mission.minutes} min planned` : allDone ? `${todayTasks.length} of ${todayTasks.length} missions complete` : 'A little progress, every day');
    put('dashboardMissionAction', mission ? 'Continue mission →' : allDone ? 'Plan what’s next →' : 'Create your plan →');
    html('dashboardChecklist', todayTasks.length ? todayTasks.slice(0, 3).map(task => `<button class="dashboard-check-item ${task.done ? 'complete' : task === mission ? 'current' : 'pending'}" data-dashboard-task="${esc(task.id)}"><span class="check-status" aria-hidden="true">${task.done ? icon('check') : ''}</span><span>${esc(task.name)}<small>${task.done ? 'Completed' : task === mission ? 'Up next' : 'Planned'}</small></span></button>`).join('') : '<div class="dashboard-check-empty"><strong>Make room for a small win.</strong><p>Add your first mission to see your daily progress here.</p><button class="linkish" data-go="plan">Open your plan →</button></div>');
  }

  function renderTracks() {
    const coding = Object.values(state.codeDone || {}).filter(Boolean).length + Object.values(state.training?.completed || {}).filter(Boolean).length;
    const entries = [
      ['coding', 'coding', 'code', 'Coding', 'Algorithms, logic & systems', coding, 'marked practiced'],
      ['math', 'math', 'math', 'Math', 'Algebra, geometry & more', state.mathAttempts.length, 'drill answers'],
      ['competition', 'math', 'trophy', 'Competition prep', 'Real AMC 10 past papers', state.amc.attempts.length, 'papers finished'],
      ['coach', 'coach', 'robot', 'AI Tutor', 'Feedback & your next step', lessons().length, 'saved lessons']
    ];
    html('dashboardTracks', entries.map(([style, view, art, title, subtitle, value, label]) => `<button class="track-card track-${style}" ${style === 'competition' ? 'data-dashboard-papers' : `data-go="${view}"`}><span class="track-icon">${icon(art)}</span><span class="track-copy"><strong>${title}</strong><small>${subtitle}</small></span><span class="track-value"><b>${count(value)}</b><small>${label}</small></span></button>`).join(''));
  }

  function renderPath() {
    const next = state.tasks.filter(task => !task.done).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    if (next.length) {
      html('dashboardPath', next.map((task, index) => `<button class="dashboard-path-step ${index === 0 ? 'current' : ''}" data-dashboard-task="${esc(task.id)}"><span class="path-node" aria-hidden="true">${index + 1}</span><span class="path-copy"><strong>${esc(task.name)}</strong><small>${task.date === todayKey() ? 'Today' : esc(fmtDate(task.date))} · ${task.minutes} min · ${esc(task.category)}</small></span><span class="path-arrow" aria-hidden="true">›</span></button>`).join(''));
    } else {
      const preferences = state.projects.preferences || { track: 'Coding', level: 'Beginner' };
      html('dashboardPath', `<p class="tiny muted">Suggested ${esc(preferences.level.toLowerCase())} ${esc(preferences.track.toLowerCase())} path</p>` + ProjectCore.ladder(preferences.track, preferences.level).slice(0, 3).map((title, index) => `<button class="dashboard-path-step" data-go="projects"><span class="path-node" aria-hidden="true">${index + 1}</span><span class="path-copy"><strong>${esc(title)}</strong><small>Suggested step · choose a project to practice</small></span><span class="path-arrow" aria-hidden="true">›</span></button>`).join(''));
    }
  }

  function renderStats() {
    const completedLessons = lessons().filter(entry => entry.lessonProgress?.completedAt).length;
    const answers = state.mathAttempts.length + state.amc.attempts.reduce((sum, attempt) => sum + (attempt.answers || []).filter(Boolean).length, 0);
    const focusMinutes = Math.floor((state.focus?.history || []).reduce((sum, session) => sum + session.actualSeconds, 0) / 60);
    html('dashboardStats', [[completedLessons, 'Lessons checked', 'Completed saved lesson quizzes'], [answers, 'Practice answers', 'Original drills and submitted past-paper answers, including repeats'], [focusMinutes, 'Focus minutes', 'Active time from saved focus sessions']].map(([value, label, detail], index) => `<div class="dashboard-stat stat-${index}" title="${detail}"><b>${count(value)}</b><span>${label}</span></div>`).join(''));
    const days = Array.from({ length: 14 }, (_, index) => dateAdd(todayKey(), index - 13));
    const values = days.map(day => {
      const row = state.activity[day] || {};
      // Correct math answers also have a practice entry; count the action once.
      return ['task', 'code', 'practice', 'review', 'lesson', 'focus'].reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
    });
    const maximum = Math.max(1, ...values), total = values.reduce((sum, value) => sum + value, 0), active = values.filter(Boolean).length;
    const summary = `${count(total)} recorded actions across ${active} active day${active === 1 ? '' : 's'} in the last 14 days.`;
    html('dashboardActivity', `<div class="dashboard-bars" role="img" aria-label="${summary} ${days.map((day, index) => `${fmtDate(day)}: ${values[index]}`).join('; ')}">${days.map((day, index) => `<div class="dashboard-bar-column" title="${esc(fmtDate(day))}: ${count(values[index])} recorded actions"><div class="dashboard-bar ${values[index] ? '' : 'empty'}" style="--bar-height:${values[index] ? Math.max(6, Math.round(values[index] / maximum * 100)) : 0}%;height:${values[index] ? Math.max(6, Math.round(values[index] / maximum * 100)) : 2}%"></div></div>`).join('')}</div><div class="dashboard-chart-labels" aria-hidden="true"><span>${fmtDate(days[0])}</span><span>${fmtDate(days[6])}</span><span>Today</span></div><p class="dashboard-chart-summary">${summary}</p>`);
  }

  function renderBadges() {
    const streak = streakStats(), timed = state.amc.attempts.filter(attempt => attempt.mode === 'timed');
    const completedLessons = lessons().filter(entry => entry.lessonProgress?.completedAt).length;
    const mastered = state.mistakes.filter(item => item.stage === 3).length + state.amc.reviews.filter(item => item.stage === 3).length + lessons().filter(entry => entry.lessonProgress?.reviewStage >= 3).length;
    const completedMissions = state.tasks.filter(task => task.done).length;
    const badges = [
      ['flame', 'Seven active days', streak.longest >= 7, `${Math.min(7, streak.longest)}/7 consecutive days`],
      ['trophy', 'First real paper', state.amc.attempts.length > 0, `${state.amc.attempts.length} past-paper attempts`],
      ['math', '100-point paper', timed.some(attempt => attempt.score >= 100), 'Score 100+ on a timed AMC paper'],
      ['book', 'First lesson check', completedLessons > 0, `${completedLessons} lesson checks completed`],
      ['target', 'Review mastery', mastered > 0, `${mastered} review paths mastered`],
      ['star', '10 missions', completedMissions >= 10, `${Math.min(10, completedMissions)}/10 missions complete`]
    ];
    html('dashboardAchievements', badges.map(([art, title, earned, detail]) => `<button class="dashboard-badge ${earned ? 'earned' : ''}" data-dashboard-achievements title="${esc(detail)}"><span class="badge-emblem">${icon(art)}</span><strong>${title}</strong><small>${earned ? 'Earned' : 'In progress'}</small></button>`).join(''));
    put('headerStreak', streak.current);
    put('headerStreakLabel', 'day streak');
    const review = node('headerReviewOpen');
    if (review) review.setAttribute('aria-label', `Review mistakes${dueMistakes().length ? `, ${dueMistakes().length} due` : ''}`);
  }

  function renderRecommendations() {
    const lesson = sortedLessons()[0], project = ProjectCore.recommendations(state.projects)[0];
    const card = (action, tone, art, badge, title, detail) => `<button class="dashboard-recommendation recommendation-${tone}" ${action}><span class="recommendation-art">${icon(art)}</span><span class="recommendation-copy"><small>${badge}</small><strong>${esc(title)}</strong><span>${esc(detail)}</span></span><span class="recommendation-arrow" aria-hidden="true">›</span></button>`;
    html('dashboardRecommendations', card(lesson ? `data-dashboard-lesson="${esc(lesson.id)}"` : 'data-go="lessons"', 'teal', 'book', lesson ? 'Continue learning' : 'Make it yours', lesson ? lessonTitle(lesson) : 'Learn one idea deeply', lesson ? `${lesson.result.lesson.subject} · saved lesson` : 'Create a lesson for your next goal') + card('data-dashboard-papers', 'violet', 'math', 'Past papers', 'Your next AMC 10 practice', '22 real exams · timed or untimed') + card(project ? `data-dashboard-project="${esc(project.id)}"` : 'data-go="projects"', 'gold', 'trophy', 'Build something', project?.title || 'Explore a project', project ? `${project.track} · ${project.level} · ${project.minutes} min` : 'Turn a new idea into a practical plan'));
  }

  function refresh() {
    if (!node('dashboardGreeting')) return;
    const hour = new Date().getHours();
    const name=state.onboarding?.displayName?.trim();
    const greeting=hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    put('dashboardGreeting', name ? `${greeting}, ${name}. Let’s make progress.` : `${greeting}. Let’s make progress.`);
    const profile=node('headerSettingsOpen')?.querySelector('span:nth-child(2)');if(profile)profile.childNodes[0].nodeValue=name||'My workspace';
    renderMission(); renderTracks(); renderPath(); renderStats(); renderBadges(); renderRecommendations();
  }

  function searchCatalog() {
    const navigation = [
      ['Home', 'Your daily mission and progress', 'today'], ['Learn', 'Create and continue saved lessons', 'lessons'],
      ['Coding practice', 'Challenges, language guide, LeetCode and Codeforces', 'coding'], ['AMC 10 past papers', 'Math practice and original drills', 'math'],
      ['Competitions', 'Upcoming events and preparation', 'contests'], ['AI Tutor', 'AI feedback, practice plans and recommendations', 'coach'],
      ['Analytics', 'Insights, activity, goals and backups', 'insights'], ['Mission plan', 'Your scheduled learning tasks', 'plan'],
      ['Projects', 'Project recommendations and your skill ladder', 'projects'], ['Mistakes', 'Your spaced review queue', 'mistakes']
    ].map(([title, detail, view]) => ({ title, detail, kind: view === 'math' ? 'papers' : 'navigation', view }));
    return [...navigation,
      { title: 'Achievements', detail: 'Your private learning milestones', kind: 'achievements' },
      { title: 'Appearance and backups', detail: 'Theme settings and your saved progress', kind: 'settings' },
      ...sortedLessons().map(entry => ({ title: lessonTitle(entry), detail: `Saved lesson · ${entry.result.lesson.subject}`, kind: 'lesson', id: entry.id })),
      ...state.tasks.map(task => ({ title: task.name, detail: `Mission · ${fmtDate(task.date)} · ${task.done ? 'Completed' : 'Planned'}`, kind: 'task', id: task.id })),
      ...ProjectCore.catalog.map(project => ({ title: project.title, detail: `Project outline · ${project.track} · ${project.level}`, kind: 'project', id: project.id }))
    ];
  }

  function renderSearch() {
    const query = node('globalSearchInput').value.trim().toLocaleLowerCase();
    const matches = searchCatalog().filter(item => !query || `${item.title} ${item.detail}`.toLocaleLowerCase().includes(query));
    searchEntries = matches.slice(0, 12);
    html('globalSearchResults', searchEntries.length ? searchEntries.map((item, index) => `<button type="button" class="search-result" data-dashboard-search="${index}"><span class="search-result-copy"><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span><span aria-hidden="true">↗</span></button>`).join('') : '<p class="search-empty">No matches yet. Try a subject, lesson title, or mission.</p>');
    put('globalSearchCount', matches.length ? `${Math.min(12, matches.length)}${matches.length > 12 ? ' of ' + matches.length : ''} local result${matches.length === 1 ? '' : 's'}` : 'No local results');
  }

  function openSearch() {
    if (document.querySelector('dialog[open]')) return;
    openModal('Find your next step', '<div class="search-dialog"><label class="sr-only" for="globalSearchInput">Search FORGE on this device</label><input id="globalSearchInput" class="search-input" type="search" maxlength="120" placeholder="Search lessons, missions, projects…" autocomplete="off" aria-controls="globalSearchResults" aria-describedby="globalSearchHelp"><p id="globalSearchHelp" class="tiny muted">Search your saved content and app pages. Use ↑ ↓ to browse, Enter to open, Esc to close.</p><p id="globalSearchCount" class="sr-only" role="status" aria-live="polite"></p><div id="globalSearchResults" class="search-results"></div></div>');
    node('globalSearchInput').addEventListener('input', renderSearch);
    renderSearch();
  }

  function openSearchResult(index) {
    const result = searchEntries[index];
    if (!result) return;
    closeModal(() => {
      if (result.kind === 'task') openTask(result.id);
      else if (result.kind === 'papers') openPastPapers();
      else if (result.kind === 'project') openProject(result.id);
      else if (result.kind === 'lesson') { window.LessonsUI?.open(result.id); focusIn('lessons', '#lessonContent h2, #lessonContent h1'); }
      else if (result.kind === 'settings') focusIn('insights', '#themeSelect');
      else if (result.kind === 'achievements') focusIn('insights', '#achievementGrid');
      else focusIn(result.view, `#view-${result.view} h1`);
    });
  }

  document.addEventListener('click', event => {
    const element = event.target.closest('button');
    if (!element) return;
    if (element.id === 'globalSearchOpen') openSearch();
    else if (element.id === 'dashboardMissionAction') mission ? openTask(mission.id) : focusIn('plan', '#addTaskPlan');
    else if (element.id === 'headerReviewOpen') focusIn('mistakes', '#view-mistakes h1');
    else if (element.id === 'headerSettingsOpen') focusIn('insights', '#themeSelect');
    else if (element.hasAttribute('data-dashboard-papers')) openPastPapers();
    else if (element.id === 'navAchievements' || element.dataset.destination === 'achievements' || element.hasAttribute('data-dashboard-achievements')) focusIn('insights', '#achievementGrid');
    else if (element.dataset.dashboardTask !== undefined) openTask(element.dataset.dashboardTask);
    else if (element.dataset.dashboardLesson !== undefined) { window.LessonsUI?.open(element.dataset.dashboardLesson); focusIn('lessons', '#lessonContent h2, #lessonContent h1'); }
    else if (element.dataset.dashboardProject !== undefined) openProject(element.dataset.dashboardProject);
    else if (element.dataset.dashboardSearch !== undefined) openSearchResult(Number(element.dataset.dashboardSearch));
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      if (document.body.classList.contains('workspace-mode')) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault(); openSearch(); return;
    }
    if (!node('modalCover')?.open || !node('globalSearchInput')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
    const input = node('globalSearchInput'), results = Array.from(node('globalSearchResults').querySelectorAll('button'));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (document.activeElement !== input && !results.includes(document.activeElement)) return;
      event.preventDefault();
      const current = results.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? current + 1 : current === -1 ? results.length - 1 : current - 1;
      if (next < 0 || next >= results.length) input.focus(); else results[next].focus();
    } else if (event.key === 'Enter' && document.activeElement === input && results.length) {
      event.preventDefault(); openSearchResult(0);
    }
  });

  window.DashboardUI = { refresh, openSearch };
  refresh();
})();
