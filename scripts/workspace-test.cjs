'use strict';
const assert = require('node:assert/strict');
require('../renderer/school-core.js');
const { normalize, learningProgress, searchState, searchValues, sortingState, sortingSets, lineState, balanceState, balanceProblems, codingChallenge } = require('../renderer/workspace-core.js');

assert.deepEqual(normalize(undefined), { sessions: [], selected: null });
const saved = { sessions: [{ id: 'session-1', title: 'Binary search', minutes: 25, createdAt: 1, updatedAt: 2, pinned: true, messages: [{ role: 'user', text: 'How does it work?' }, { role: 'assistant', text: 'Start in the middle.' }], activity: {type:'school-question',questionId:globalThis.SchoolCore.QUESTIONS[0].id,answer:1,hint:true}, activities: [], draft:'unfinished thought', expanded:false }], selected: 'session-1' };
assert.deepEqual(normalize(JSON.parse(JSON.stringify(saved))), saved);
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], minutes: 99 }] }));
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], messages: [{ role: 'system', text: 'invalid' }] }] }));
assert.equal(normalize({...saved,sessions:[{...saved.sessions[0],messages:[{role:'assistant',text:'Try this lab.',activity:'projectile'}]}]}).sessions[0].messages[0].activity,'projectile');
const planMessage={role:'assistant',text:'A path',plan:[{text:'Explore',done:true},{text:'Practice',done:false}]};
assert.deepEqual(normalize({...saved,sessions:[{...saved.sessions[0],messages:[planMessage]}]}).sessions[0].messages[0],planMessage);
const planProgress=learningProgress({...saved,sessions:[{...saved.sessions[0],messages:[planMessage]}]});
assert.equal(planProgress.tutorPlans.length,1);
assert.equal(planProgress.tutorPlans[0].messageIndex,0);
assert.equal(planProgress.selfMarkedSteps,1);
assert.throws(()=>normalize({...saved,sessions:[{...saved.sessions[0],messages:[{...planMessage,plan:[{text:'Only one',done:false}]}]}]}));
assert.throws(()=>normalize({...saved,sessions:[{...saved.sessions[0],messages:[{...planMessage,role:'user'}]}]}));
assert.throws(() => normalize({ ...saved, sessions: [saved.sessions[0], saved.sessions[0]] }));
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], activity: {type:'school-question',questionId:'unknown',answer:null,hint:false} }] }));
assert.equal(normalize({ ...saved, sessions: [{ ...saved.sessions[0], activity: undefined }] }).sessions[0].activity, null);
assert.equal(normalize({ ...saved, sessions: [{ ...saved.sessions[0], draft: undefined }] }).sessions[0].draft, '');
assert.throws(() => normalize({ ...saved, sessions: [{ ...saved.sessions[0], draft: 'x'.repeat(4001) }] }));
assert.equal(normalize({...saved,sessions:[{...saved.sessions[0],learningGoal:'Build a simulator'}]}).sessions[0].learningGoal,'Build a simulator');
assert.throws(() => normalize({...saved,sessions:[{...saved.sessions[0],learningGoal:'x'.repeat(301)}]}));
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
for (let problem = 0; problem < balanceProblems.length; problem++) {
  const initial = balanceProblems[problem];
  const activity = {type:'equation-balance',problem,moves:[-initial.constant],hint:true};
  assert.deepEqual(balanceState(activity), {constant:0,right:initial.right-initial.constant,finished:true});
  assert.equal(normalize({...saved,sessions:[{...saved.sessions[0],activity}]}).sessions[0].activity.problem, problem);
  assert.throws(() => balanceState({...activity,moves:[...activity.moves,1]}));
}
assert.deepEqual(balanceState({type:'equation-balance',problem:0,moves:[1,-4],hint:false}),{constant:0,right:7,finished:true});
assert.throws(() => balanceState({type:'equation-balance',problem:0,moves:[11],hint:false}));
const coding = {type:'coding',challengeId:codingChallenge.id,code:'print(7)',attempts:[{code:'print(7)',createdAt:3,tests:[{status:'Accepted',output:'7\n'}]}]};
assert.deepEqual(normalize({...saved,sessions:[{...saved.sessions[0],activity:coding}]}).sessions[0].activity,coding);
assert.throws(() => normalize({...saved,sessions:[{...saved.sessions[0],activity:{...coding,challengeId:'unknown'}}]}));
assert.throws(() => normalize({...saved,sessions:[{...saved.sessions[0],activity:{...coding,attempts:[{code:'x',createdAt:3,tests:Array(3).fill({status:'Accepted',output:'7'})}]}}]}));
const projectile = {type:'projectile',angle:60,stage:'build',answer:1,speed:25,result:20,explored:true};
const summary = learningProgress({...saved,sessions:[{...saved.sessions[0],activity:projectile,activities:[{...projectile,answer:null,result:null}]}]});
assert.deepEqual([summary.sessions,summary.paths,summary.checks,summary.simulations],[1,2,1,1]);
assert.equal(summary.pathsByRecency[0].index,null);
assert.equal(summary.pathsByRecency[1].index,0);
assert.deepEqual([learningProgress({sessions:[]}).sessions,learningProgress({sessions:[]}).paths],[0,0]);
assert.deepEqual(normalize({...saved,sessions:[{...saved.sessions[0],activity:projectile}]}).sessions[0].activity,projectile);
assert.deepEqual(normalize({...saved,sessions:[{...saved.sessions[0],activity:{type:'projectile',angle:35}}]}).sessions[0].activity,{type:'projectile',angle:35,stage:'explore',answer:null,speed:18,result:null,explored:false});
for (const change of [{angle:81},{stage:'other'},{answer:3},{speed:31},{result:-1},{explored:'yes'}]) assert.throws(() => normalize({...saved,sessions:[{...saved.sessions[0],activity:{...projectile,...change}}]}));
console.log('Workspace backup validation passed');
