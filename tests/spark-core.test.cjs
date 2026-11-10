'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Spark = require('../renderer/spark-core.js');

function complete(value, id, answers) {
  let state = value;
  for (let step = 0; step < answers.length; step++) {
    state = Spark.commitAnswer(state, id, step, answers[step]);
    state = Spark.advance(state, id);
  }
  return state;
}

test('legacy and malformed backups produce bounded empty practice state', () => {
  const empty = Spark.normalizeState(null);
  for (const input of [undefined, null, false, [], 'old backup', { lessons: [] }]) {
    assert.deepEqual(Spark.normalizeState(input), empty);
  }
  assert.equal(Spark.normalizeState({ activeLesson: 'not-a-lesson' }).activeLesson, null);
  for (const step of [-1, 3, 1.5, '2', Infinity, null]) {
    assert.deepEqual(Spark.normalizeState({ lessons: { balance: { step, answer: 7, solved: true, completed: true } } }).lessons.balance, empty.lessons.balance);
  }
  assert.deepEqual(Object.keys(empty.lessons), ['balance', 'patterns', 'logic']);
});

test('all balance and staircase answers agree with their visual mathematics', () => {
  for (const lesson of Spark.lessons.filter(item => item.id !== 'logic')) {
    lesson.steps.forEach((step, index) => {
      const answer = step.kind === 'balance' ? (step.target - step.constant) / step.coefficient : step.rows * (step.rows + 1) / 2;
      assert.equal(Spark.evaluate(lesson.id, index, answer).correct, true);
      assert.equal(Spark.evaluate(lesson.id, index, answer - 1).correct, false);
      assert.equal(Spark.evaluate(lesson.id, index, answer + 1).correct, false);
      assert.equal(Spark.evaluate(lesson.id, index, answer).feedback, step.explanation);
    });
  }
});

test('AND, OR and XOR evaluate the complete truth table including both XOR solutions', () => {
  const cases = [
    [{ a: false, b: false }, [false, false, false]],
    [{ a: false, b: true }, [false, true, true]],
    [{ a: true, b: false }, [false, true, true]],
    [{ a: true, b: true }, [true, true, false]]
  ];
  for (const [answer, outputs] of cases) {
    Spark.lessons.find(lesson => lesson.id === 'logic').steps.forEach((step, index) => {
      assert.equal(Spark.logicOutput(step.gate, answer), outputs[index]);
      assert.equal(Spark.evaluate('logic', index, answer).correct, outputs[index] === step.target);
    });
  }
});

test('invalid answers do not become correct through type coercion or normalization', () => {
  for (const answer of ['4', 4.1, -1, 13, Infinity, NaN, null, [], {}]) {
    assert.equal(Spark.evaluate('balance', 0, answer).correct, false);
  }
  for (const answer of [true, {}, { a: 1, b: 1 }, { a: 'true', b: true }, { a: true }]) {
    assert.equal(Spark.evaluate('logic', 0, answer).correct, false);
    const state = Spark.normalizeState({ lessons: { logic: { step: 0, answer, solved: true, completed: true } } });
    assert.equal(state.lessons.logic.solved, false);
    assert.equal(state.lessons.logic.completed, false);
  }
  assert.equal(Spark.evaluate('missing', 0, 4).correct, false);
  assert.equal(Spark.evaluate('balance', '0', 4).correct, false);
});

test('correct unchecked manipulations stay unchecked after a restart', () => {
  const raw = Spark.normalizeState(null);
  raw.lessons.balance.answer = 4;
  const restarted = Spark.normalizeState(JSON.parse(JSON.stringify(raw)));
  assert.equal(restarted.lessons.balance.solved, false);
  assert.deepEqual(Spark.advance(restarted, 'balance'), restarted);
});

test('checks persist feedback state and require an explicit advance', () => {
  const initial = Spark.normalizeState(null);
  const incorrect = Spark.commitAnswer(initial, 'balance', 0, 3);
  assert.equal(incorrect.lessons.balance.answer, 3);
  assert.equal(incorrect.lessons.balance.solved, false);
  assert.equal(initial.lessons.balance.answer, 1);
  const correct = Spark.commitAnswer(incorrect, 'balance', 0, 4);
  assert.equal(correct.lessons.balance.solved, true);
  assert.equal(correct.lessons.balance.step, 0);
  const restarted = Spark.normalizeState(JSON.parse(JSON.stringify(correct)));
  assert.deepEqual(restarted, correct);
  assert.equal(Spark.advance(restarted, 'balance').lessons.balance.step, 1);
  assert.equal(Spark.advance(restarted, 'balance').lessons.balance.solved, false);
});

test('stale checks, repeated checks and invalid lesson IDs cannot change a checkpoint', () => {
  const checked = Spark.commitAnswer(null, 'balance', 0, 4);
  assert.deepEqual(Spark.commitAnswer(checked, 'balance', 0, 9), checked);
  const next = Spark.advance(checked, 'balance');
  assert.deepEqual(Spark.commitAnswer(next, 'balance', 0, 4), next);
  assert.deepEqual(Spark.commitAnswer(next, '__proto__', 0, 4), next);
  assert.deepEqual(Spark.advance(next, '__proto__'), next);
  assert.deepEqual(Spark.restartLesson(next, '__proto__'), next);
});

test('completion requires a valid final checked answer and a final advance', () => {
  let state = complete(null, 'balance', [4, 5]);
  state = Spark.commitAnswer(state, 'balance', 2, 7);
  assert.equal(state.lessons.balance.solved, true);
  assert.equal(state.lessons.balance.completed, false);
  state = Spark.advance(state, 'balance');
  assert.equal(state.lessons.balance.completed, true);
  assert.deepEqual(Spark.advance(state, 'balance'), state);
  assert.deepEqual(Spark.normalizeState(JSON.parse(JSON.stringify(state))), state);
  for (const raw of [
    { step: 0, answer: 4, solved: true, completed: true },
    { step: 2, answer: 1, solved: true, completed: true },
    { step: 2, answer: 7, solved: false, completed: true }
  ]) assert.equal(Spark.normalizeState({ lessons: { balance: raw } }).lessons.balance.completed, false);
});

test('replaying one trail resets only that trail and leaves others completed', () => {
  let state = complete(null, 'balance', [4, 5, 7]);
  state = complete(state, 'patterns', [6, 10, 15]);
  state.activeLesson = 'patterns';
  const replay = Spark.restartLesson(state, 'patterns');
  assert.deepEqual(replay.lessons.balance, state.lessons.balance);
  assert.deepEqual(replay.lessons.patterns, Spark.normalizeState(null).lessons.patterns);
  assert.equal(replay.activeLesson, 'patterns');
  assert.equal(state.lessons.patterns.completed, true);
});

test('normalization strips unrelated fields and preserves independent answer objects', () => {
  const answer = { a: true, b: false, injected: '<script>' };
  const state = Spark.normalizeState({ activeLesson: 'logic', extra: 'ignored', lessons: { unknown: {}, logic: { step: 2, answer, solved: true } } });
  assert.deepEqual(state.lessons.logic.answer, { a: true, b: false });
  assert.equal(state.extra, undefined);
  answer.a = false;
  assert.equal(state.lessons.logic.answer.a, true);
  const initial = Spark.defaultAnswer('logic', 0);
  initial.a = true;
  assert.deepEqual(Spark.defaultAnswer('logic', 0), { a: false, b: false });
  assert.ok(Object.isFrozen(Spark.lessons[0].steps[0]));
});
