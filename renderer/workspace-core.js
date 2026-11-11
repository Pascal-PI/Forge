(function (root) {
  'use strict';

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
        return { role: message.role, text: message.text };
      });
      return { id: session.id, title: session.title, minutes: session.minutes, createdAt: session.createdAt, updatedAt: session.updatedAt, pinned: session.pinned, messages };
    });
    if (new Set(sessions.map(session => session.id)).size !== sessions.length) throw Error('Duplicate learning session');
    return { sessions, selected: sessions.some(session => session.id === value.selected) ? value.selected : null };
  }

  root.WorkspaceCore = { normalize };
  if (typeof module !== 'undefined') module.exports = root.WorkspaceCore;
})(typeof window !== 'undefined' ? window : globalThis);
