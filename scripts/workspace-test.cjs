'use strict';
const assert = require('node:assert/strict');
const { normalize } = require('../renderer/workspace-core.js');

assert.deepEqual(normalize(undefined), { sessions: [], selected: null });
const saved = { sessions: [{ id: 'session-1', title: 'Binary search', minutes: 25, createdAt: 1, updatedAt: 2, pinned: true, messages: [{ role: 'user', text: 'How does it work?' }, { role: 'assistant', text: 'Start in the middle.' }] }], selected: 'session-1' };
assert.deepEqual(normalize(JSON.parse(JSON.stringify(saved))), saved);
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], minutes: 99 }] }));
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], messages: [{ role: 'system', text: 'invalid' }] }] }));
assert.throws(() => normalize({ ...saved, sessions: [saved.sessions[0], saved.sessions[0]] }));
console.log('Workspace backup validation passed');
