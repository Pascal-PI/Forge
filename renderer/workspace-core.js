(function (root) {
  'use strict';

  const searchValues = [3, 8, 12, 19, 27, 35, 42, 56, 68];
  const searchTargets = [3, 19, 35, 56, 68, 72];

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
        if (message.activity != null && (message.role !== 'assistant' || !['binary-search', 'school-question'].includes(message.activity))) throw Error('Invalid suggested activity');
        return { role: message.role, text: message.text, ...(message.activity ? { activity: message.activity } : {}) };
      });
      let activity = null;
      if (session.activity != null) {
        activity = normalizeActivity(session.activity);
      }
      if (session.activities != null && (!Array.isArray(session.activities) || session.activities.length > 100)) throw Error('Invalid activity history');
      const activities = (session.activities || []).map(normalizeActivity);
      return { id: session.id, title: session.title, minutes: session.minutes, createdAt: session.createdAt, updatedAt: session.updatedAt, pinned: session.pinned, messages, activity, activities };
    });
    if (new Set(sessions.map(session => session.id)).size !== sessions.length) throw Error('Duplicate learning session');
    return { sessions, selected: sessions.some(session => session.id === value.selected) ? value.selected : null };
  }

  root.WorkspaceCore = { normalize, searchState, searchValues, searchTargets };
  if (typeof module !== 'undefined') module.exports = root.WorkspaceCore;
})(typeof window !== 'undefined' ? window : globalThis);
