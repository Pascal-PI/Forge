'use strict';
const assert = require('node:assert/strict');
require('../renderer/school-core.js');
const { normalize, searchState, searchValues, sortingState, sortingSets, lineState, codingChallenge } = require('../renderer/workspace-core.js');

assert.deepEqual(normalize(undefined), { sessions: [], selected: null });
const saved = { sessions: [{ id: 'session-1', title: 'Binary search', minutes: 25, createdAt: 1, updatedAt: 2, pinned: true, messages: [{ role: 'user', text: 'How does it work?' }, { role: 'assistant', text: 'Start in the middle.' }], activity: {type:'school-question',questionId:globalThis.SchoolCore.QUESTIONS[0].id,answer:1,hint:true}, activities: [], draft:'unfinished thought', expanded:false }], selected: 'session-1' };
assert.deepEqual(normalize(JSON.parse(JSON.stringify(saved))), saved);
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], minutes: 99 }] }));
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], messages: [{ role: 'system', text: 'invalid' }] }] }));
assert.throws(() => normalize({ ...saved, sessions: [saved.sessions[0], saved.sessions[0]] }));
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], activity: {type:'school-question',questionId:'unknown',answer:null,hint:false} }] }));
assert.equal(normalize({ ...saved, sessions: [{ ...saved.sessions[0], activity: undefined }] }).sessions[0].activity, null);
assert.equal(normalize({ ...saved, sessions: [{ ...saved.sessions[0], draft: undefined }] }).sessions[0].draft, '');
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], draft: 'x'.repeat(4001) }] }));
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
for (let set = 0; set < sortingSets.length; set++) {
  const activity = {type:'sorting',set,moves:[]};
  while (!sortingState(activity).finished) {
    const result = sortingState(activity);
    activity.moves.push(result.values[result.index] > result.values[result.index + 1] ? 'swap' : 'keep');
  }
  assert.deepEqual(sortingState(activity).values, [...sortingSets[set]].sort((a,b) => a-b));
  assert.throws(() => sortingState({ ...activity, moves: [...activity.moves, 'keep'] }));
  assert.equal(normalize({ ...saved, sessions:[{...saved.sessions[0],activity}] }).sessions[0].activity.set, set);
}
assert.equal(sortingState({type:'sorting',set:0,moves:['keep']}).mistakes, 1);
assert.equal(lineState({type:'number-line',target:-7,position:-7,attempts:[0,-7]}).finished, true);
assert.throws(() => lineState({type:'number-line',target:-7,position:0,attempts:[-7,0]}));
assert.throws(() => lineState({type:'number-line',target:100,position:0,attempts:[]}));
const coding = {type:'coding',challengeId:codingChallenge.id,code:'print(7)',attempts:[{code:'print(7)',createdAt:3,tests:[{status:'Accepted',output:'7\n'}]}]};
assert.deepEqual(normalize({...saved,sessions:[{...saved.sessions[0],activity:coding}]}).sessions[0].activity,coding);
assert.throws(() => normalize({...saved,sessions:[{...saved.sessions[0],activity:{...coding,challengeId:'unknown'}}]}));
assert.throws(() => normalize({...saved,sessions:[{...saved.sessions[0],activity:{...coding,attempts:[{code:'x',createdAt:3,tests:Array(3).fill({status:'Accepted',output:'7'})}]}}]}));
console.log('Workspace backup validation passed');
