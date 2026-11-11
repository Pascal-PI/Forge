(function (root) {
  'use strict';

  const searchValues = [3, 8, 12, 19, 27, 35, 42, 56, 68];
  const searchTargets = [3, 19, 35, 56, 68, 72];
  const sortingSets = [[7, 2, 5, 1], [4, 6, 1, 3], [5, 5, 2, 4]];
  const lineTargets = [-7, -3, 4, 8];
  const codingChallenge = Object.freeze({
    id: 'sum-two-integers',
    title: 'Add two integers',
    prompt: 'Read two integers separated by a space and print their sum. Your program should work for negative numbers too.',
    starter: 'a, b = map(int, input().split())\n# Print their sum.\n',
    tests: [{ input: '3 4\n', expected: '7' }, { input: '-5 9\n', expected: '4' }]
  });

  function sortingState(activity) {
    if (!Number.isInteger(activity.set) || !sortingSets[activity.set] || !Array.isArray(activity.moves) || activity.moves.length > 50 || !activity.moves.every(move => ['swap', 'keep'].includes(move))) throw Error('Invalid sorting activity');
    const values = [...sortingSets[activity.set]];
    let pass = 0, index = 0, mistakes = 0, comparisons = 0;
    for (const move of activity.moves) {
      if (pass >= values.length - 1) throw Error('Invalid sorting activity');
      const expected = values[index] > values[index + 1] ? 'swap' : 'keep';
      if (move !== expected) { mistakes++; continue; }
      if (move === 'swap') [values[index], values[index + 1]] = [values[index + 1], values[index]];
      comparisons++;
      index++;
      if (index >= values.length - 1 - pass) { pass++; index = 0; }
    }
    return { values, pass, index, mistakes, comparisons, finished: pass >= values.length - 1 };
  }

  function lineState(activity) {
    if (!lineTargets.includes(activity.target) || !Number.isInteger(activity.position) || activity.position < -10 || activity.position > 10 ||
        !Array.isArray(activity.attempts) || activity.attempts.length > 50 || !activity.attempts.every(value => Number.isInteger(value) && value >= -10 && value <= 10) ||
        activity.attempts.slice(0, -1).includes(activity.target)) throw Error('Invalid number line activity');
    return { finished: activity.attempts.at(-1) === activity.target, attempts: activity.attempts.length };
  }

  function searchState(activity) {
    if (!searchTargets.includes(activity.target) || !Array.isArray(activity.moves) || activity.moves.length > 50 ||
        !activity.moves.every(move => ['left', 'right', 'found'].includes(move))) throw Error('Invalid binary search activity');
    let low = 0, high = searchValues.length - 1, mistakes = 0, comparisons = 0, finished = false;
    for (const move of activity.moves) {
      if (finished) throw Error('Invalid binary search activity');
      const mid = Math.floor((low + high) / 2);
      const expected = activity.target === searchValues[mid] ? 'found' : activity.target < searchValues[mid] ? 'left' : 'right';
      if (move !== expected) { mistakes++; continue; }
      comparisons++;
      if (move === 'found') finished = true;
      else if (move === 'left') high = mid - 1;
      else low = mid + 1;
      if (low > high) finished = true;
    }
    return { low, high, mistakes, comparisons, finished, found: finished && low <= high };
  }

  function normalizeActivity(item) {
    if (!item || typeof item !== 'object') throw Error('Invalid learning activity');
    if (item.type === 'binary-search') {
      searchState(item);
      return { type: item.type, target: item.target, moves: [...item.moves] };
    }
    if (item.type === 'sorting') {
      sortingState(item);
      return { type: item.type, set: item.set, moves: [...item.moves] };
    }
    if (item.type === 'number-line') {
      lineState(item);
      return { type: item.type, target: item.target, position: item.position, attempts: [...item.attempts] };
    }
    if (item.type === 'coding') {
      if (item.challengeId !== codingChallenge.id || typeof item.code !== 'string' || item.code.length > 8000 || !Array.isArray(item.attempts) || item.attempts.length > 10) throw Error('Invalid coding activity');
      const attempts = item.attempts.map(attempt => {
        if (!attempt || typeof attempt.code !== 'string' || attempt.code.length > 8000 || !Number.isFinite(attempt.createdAt) || !Array.isArray(attempt.tests) || attempt.tests.length > codingChallenge.tests.length) throw Error('Invalid coding attempt');
        const tests = attempt.tests.map(test => {
          if (!test || typeof test.output !== 'string' || test.output.length > 1000 || typeof test.status !== 'string' || test.status.length > 100) throw Error('Invalid coding test');
          return { output: test.output, status: test.status };
        });
        return { code: attempt.code, createdAt: attempt.createdAt, tests };
      });
      return { type: item.type, challengeId: item.challengeId, code: item.code, attempts };
    }
    if (item.type !== 'school-question' || typeof item.questionId !== 'string' ||
        !root.SchoolCore?.byId.has(item.questionId) ||
        !(item.answer === null || Number.isInteger(item.answer) && item.answer >= 0 && item.answer <= 3) ||
        typeof item.hint !== 'boolean') throw Error('Invalid learning activity');
    return { type: item.type, questionId: item.questionId, answer: item.answer, hint: item.hint };
  }

  function normalize(value) {
    if (value == null) return { sessions: [], selected: null };
    if (!value || !Array.isArray(value.sessions) || value.sessions.length > 100) throw Error('Invalid learning sessions');
    const sessions = value.sessions.map(session => {
      if (!session || typeof session.id !== 'string' || session.id.length > 100 ||
          typeof session.title !== 'string' || session.title.length > 100 ||
          ![15, 25, 40].includes(session.minutes) || !Number.isFinite(session.createdAt) ||
          !Number.isFinite(session.updatedAt) || !Array.isArray(session.messages) || session.messages.length > 300 ||
          typeof session.pinned !== 'boolean') throw Error('Invalid learning session');
      const messages = session.messages.map(message => {
        if (!message || !['user', 'assistant'].includes(message.role) || typeof message.text !== 'string' || message.text.length > 8000) throw Error('Invalid session message');
        if (message.activity != null && (message.role !== 'assistant' || !['binary-search', 'school-question', 'sorting', 'number-line', 'coding'].includes(message.activity))) throw Error('Invalid suggested activity');
        return { role: message.role, text: message.text, ...(message.activity ? { activity: message.activity } : {}) };
      });
      let activity = null;
      if (session.activity != null) {
        activity = normalizeActivity(session.activity);
      }
      if (session.activities != null && (!Array.isArray(session.activities) || session.activities.length > 100)) throw Error('Invalid activity history');
      const activities = (session.activities || []).map(normalizeActivity);
      if (session.draft != null && (typeof session.draft !== 'string' || session.draft.length > 4000)) throw Error('Invalid message draft');
      if (session.expanded != null && typeof session.expanded !== 'boolean') throw Error('Invalid workspace state');
      return { id: session.id, title: session.title, minutes: session.minutes, createdAt: session.createdAt, updatedAt: session.updatedAt, pinned: session.pinned, messages, activity, activities, draft: session.draft || '', expanded: Boolean(session.expanded && activity) };
    });
    if (new Set(sessions.map(session => session.id)).size !== sessions.length) throw Error('Duplicate learning session');
    return { sessions, selected: sessions.some(session => session.id === value.selected) ? value.selected : null };
  }

  root.WorkspaceCore = { normalize, searchState, searchValues, searchTargets, sortingState, sortingSets, lineState, lineTargets, codingChallenge };
  if (typeof module !== 'undefined') module.exports = root.WorkspaceCore;
})(typeof window !== 'undefined' ? window : globalThis);
