'use strict';
const assert = require('node:assert/strict');
require('../renderer/school-core.js');
const { normalize, searchState, searchValues } = require('../renderer/workspace-core.js');

assert.deepEqual(normalize(undefined), { sessions: [], selected: null });
const saved = { sessions: [{ id: 'session-1', title: 'Binary search', minutes: 25, createdAt: 1, updatedAt: 2, pinned: true, messages: [{ role: 'user', text: 'How does it work?' }, { role: 'assistant', text: 'Start in the middle.' }], activity: {type:'school-question',questionId:globalThis.SchoolCore.QUESTIONS[0].id,answer:1,hint:true}, activities: [] }], selected: 'session-1' };
assert.deepEqual(normalize(JSON.parse(JSON.stringify(saved))), saved);
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], minutes: 99 }] }));
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], messages: [{ role: 'system', text: 'invalid' }] }] }));
assert.throws(() => normalize({ ...saved, sessions: [saved.sessions[0], saved.sessions[0]] }));
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], activity: {type:'school-question',questionId:'unknown',answer:null,hint:false} }] }));
assert.equal(normalize({ ...saved, sessions: [{ ...saved.sessions[0], activity: undefined }] }).sessions[0].activity, null);
const search = {type:'binary-search',target:72,moves:[]};
while (!searchState(search).finished) {
  const before = searchState(search);
  const middle = searchValues[Math.floor((before.low + before.high) / 2)];
  search.moves.push(search.target < middle ? 'left' : search.target > middle ? 'right' : 'found');
}
assert.equal(searchState(search).found, false);
assert.equal(normalize({ ...saved, sessions: [{ ...saved.sessions[0], activity: search }] }).sessions[0].activity.target, 72);
assert.throws(() => searchState({ ...search, moves: [...search.moves, 'left'] }));
assert.throws(() => searchState({ type:'binary-search', target:123, moves:[] }));
assert.equal(searchState({ type:'binary-search', target:3, moves:['right'] }).mistakes, 1);
console.log('Workspace backup validation passed');
