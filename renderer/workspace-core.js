(function (root) {
  'use strict';

  const searchValues = [3, 8, 12, 19, 27, 35, 42, 56, 68];
  const searchTargets = [3, 19, 35, 56, 68, 72];
  const sortingSets = [[7, 2, 5, 1], [4, 6, 1, 3], [5, 5, 2, 4]];
  const lineTargets = [-7, -3, 4, 8];
  const balanceProblems = [{ constant: 3, right: 10 }, { constant: -4, right: 2 }, { constant: 8, right: 3 }];
  const projectileStarter = 'speed = float(input())\ngravity = 9.81\nrange_m = speed ** 2 / gravity\nprint(f"{range_m:.1f}")\n';
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

  function balanceState(activity) {
    if (!Number.isInteger(activity.problem) || !balanceProblems[activity.problem] || !Array.isArray(activity.moves) || activity.moves.length > 30 || !activity.moves.every(value => Number.isInteger(value) && value >= -10 && value <= 10 && value !== 0) || typeof activity.hint !== 'boolean') throw Error('Invalid equation activity');
    let { constant, right } = balanceProblems[activity.problem];
    for (const move of activity.moves) {
      if (constant === 0) throw Error('Invalid equation activity');
      constant += move;
      right += move;
    }
    return { constant, right, finished: constant === 0 };
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
    if (item.type === 'livelab-creative') {
      const scene=root.LiveLabScene || (typeof require==='function' ? require('./livelab-scene.js') : null);
      if(typeof item.source!=='string' || !item.source.trim() || new TextEncoder().encode(item.source).length>32768 || !['description','assumptions','question','review'].every(k=>typeof item[k]==='string' && item[k].length<=1500)) throw Error('Invalid LiveLab');
      scene.validate(item.snapshot);
      if(item.reuse!=null){
        if(!item.reuse || typeof item.reuse!=='object' || typeof item.reuse.fingerprint!=='string' || typeof item.reuse.seal!=='string' || !/^[a-f0-9]{64}$/.test(item.reuse.fingerprint) || !/^[a-f0-9]{64}$/.test(item.reuse.seal))throw Error('Invalid LiveLab reuse record');
        scene.validate(item.reuse.snapshot);
      }
      return {type:item.type,source:item.source,description:item.description,assumptions:item.assumptions,question:item.question,review:item.review,snapshot:JSON.parse(JSON.stringify(item.snapshot)),...(item.reuse?{reuse:JSON.parse(JSON.stringify(item.reuse))}:{})};
    }
    if (item.type === 'livelab') {
      const core=root.LiveLabCore || (typeof require==='function' ? require('./livelab-core.js') : null);
      core.validate(item.lab);
      if (typeof item.review !== 'string' || item.review.length>1500) throw Error('Invalid LiveLab review');
      return {type:'livelab',lab:JSON.parse(JSON.stringify(item.lab)),review:item.review};
    }
    if (item.type === 'projectile') {
      if (!Number.isInteger(item.angle) || item.angle < 10 || item.angle > 80) throw Error('Invalid projectile activity');
      const stage = item.stage ?? 'explore', answer = item.answer ?? null, speed = item.speed ?? 18, result = item.result ?? null, explored = item.explored ?? false;
      if (!['explore', 'practice', 'build'].includes(stage) || ![null, 0, 1, 2].includes(answer) || !Number.isInteger(speed) || speed < 5 || speed > 30 || !(result === null || Number.isInteger(result) && result >= 5 && result <= 30) || typeof explored !== 'boolean') throw Error('Invalid projectile activity');
      if (item.python != null && (typeof item.python !== 'string' || item.python.length > 8000)) throw Error('Invalid projectile code');
      const run = item.lastPythonRun;
      if (run != null && (typeof run !== 'object' || typeof run.code !== 'string' || run.code.length > 8000 || !Number.isInteger(run.speed) || run.speed < 5 || run.speed > 30 || typeof run.status !== 'string' || run.status.length > 100 || typeof run.output !== 'string' || run.output.length > 1000)) throw Error('Invalid projectile code result');
      return { type: item.type, angle: item.angle, stage, answer, speed, result, explored, ...(item.python != null ? {python:item.python} : {}), ...(run != null ? {lastPythonRun:{code:run.code,speed:run.speed,status:run.status,output:run.output}} : {}) };
    }
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
    if (item.type === 'equation-balance') {
      balanceState(item);
      return { type: item.type, problem: item.problem, moves: [...item.moves], hint: item.hint };
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
        if (message.activity != null && (message.role !== 'assistant' || !['livelab', 'binary-search', 'school-question', 'sorting', 'number-line', 'coding', 'equation-balance', 'projectile'].includes(message.activity))) throw Error('Invalid suggested activity');
        if (message.plan != null && (message.role !== 'assistant' || !Array.isArray(message.plan) || message.plan.length < 2 || message.plan.length > 5 || !message.plan.every(step => step && typeof step.text === 'string' && step.text.trim() && step.text.length <= 500 && typeof step.done === 'boolean'))) throw Error('Invalid saved learning path');
        return { role: message.role, text: message.text, ...(message.activity ? { activity: message.activity } : {}), ...(message.plan ? { plan: message.plan.map(step => ({text:step.text,done:step.done})) } : {}) };
      });
      let activity = null;
      if (session.activity != null) {
        activity = normalizeActivity(session.activity);
      }
      if (session.activities != null && (!Array.isArray(session.activities) || session.activities.length > 100)) throw Error('Invalid activity history');
      const activities = (session.activities || []).map(normalizeActivity);
      if (session.draft != null && (typeof session.draft !== 'string' || session.draft.length > 4000)) throw Error('Invalid message draft');
      if (session.learningGoal != null && (typeof session.learningGoal !== 'string' || session.learningGoal.length > 300)) throw Error('Invalid learning goal');
      if (session.expanded != null && typeof session.expanded !== 'boolean') throw Error('Invalid workspace state');
      return { id: session.id, title: session.title, minutes: session.minutes, createdAt: session.createdAt, updatedAt: session.updatedAt, pinned: session.pinned, messages, activity, activities, draft: session.draft || '', expanded: Boolean(session.expanded && activity), ...(session.learningGoal != null ? { learningGoal: session.learningGoal } : {}) };
    });
    if (new Set(sessions.map(session => session.id)).size !== sessions.length) throw Error('Duplicate learning session');
    return { sessions, selected: sessions.some(session => session.id === value.selected) ? value.selected : null };
  }

  function learningProgress(workspace) {
    const sessions = workspace?.sessions || [];
    const paths = sessions.flatMap(session => [
      ...(session.activities || []).map((activity, index) => ({ activity, index })),
      ...(session.activity ? [{ activity: session.activity, index: null }] : [])
    ].filter(item => item.activity.type === 'projectile').map(item => ({ sessionId: session.id, title: session.title, updatedAt: session.updatedAt, ...item })));
    paths.sort((a, b) => b.updatedAt - a.updatedAt || (b.index ?? Infinity) - (a.index ?? Infinity));
    const tutorPlans = sessions.flatMap(session => (session.messages || []).flatMap((message, messageIndex) => message.role === 'assistant' && message.plan?.length ? [{sessionId:session.id,title:session.title,updatedAt:session.updatedAt,messageIndex,steps:message.plan}] : []));
    tutorPlans.sort((a,b) => b.updatedAt - a.updatedAt || b.messageIndex - a.messageIndex);
    return { sessions: sessions.length, paths: paths.length, checks: paths.filter(item => item.activity.answer === 1).length, simulations: paths.filter(item => Number.isInteger(item.activity.result)).length, pathsByRecency: paths, tutorPlans, selfMarkedSteps:tutorPlans.reduce((sum,plan) => sum + plan.steps.filter(step => step.done).length,0) };
  }
  root.WorkspaceCore = { normalize, learningProgress, searchState, searchValues, searchTargets, sortingState, sortingSets, lineState, lineTargets, balanceState, balanceProblems, codingChallenge, projectileStarter };
  if (typeof module !== 'undefined') module.exports = root.WorkspaceCore;
})(typeof window !== 'undefined' ? window : globalThis);
