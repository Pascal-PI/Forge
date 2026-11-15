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
      if(item.initialSnapshot != null) scene.validate(item.initialSnapshot);
      if(item.lastInteraction!=null && (typeof item.lastInteraction!=='string'||item.lastInteraction.length>700))throw Error('Invalid LiveLab interaction');
      if(item.reuse!=null){
        if(!item.reuse || typeof item.reuse!=='object' || typeof item.reuse.fingerprint!=='string' || typeof item.reuse.seal!=='string' || !/^[a-f0-9]{64}$/.test(item.reuse.fingerprint) || !/^[a-f0-9]{64}$/.test(item.reuse.seal))throw Error('Invalid LiveLab reuse record');
        scene.validate(item.reuse.snapshot);
      }
      return {type:item.type,source:item.source,description:item.description,assumptions:item.assumptions,question:item.question,review:item.review,snapshot:JSON.parse(JSON.stringify(item.snapshot)),...(item.initialSnapshot?{initialSnapshot:JSON.parse(JSON.stringify(item.initialSnapshot))}:{}),...(item.lastInteraction!=null?{lastInteraction:item.lastInteraction}:{}),...(item.reuse?{reuse:JSON.parse(JSON.stringify(item.reuse))}:{})};
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
    if (item.type === 'coding-workspace') {
      if(typeof item.code!=='string'||item.code.length>8000||typeof item.stdin!=='string'||item.stdin.length>4000||typeof item.output!=='string'||item.output.length>4000||typeof item.runError!=='string'||item.runError.length>500||!Array.isArray(item.results)||item.results.length>3)throw Error('Invalid coding workspace');
      const language=item.language ?? 'JavaScript',assignmentTopic=item.assignmentTopic ?? '';
      if(!['JavaScript','TypeScript','Python','C++','Java'].includes(language)||typeof assignmentTopic!=='string'||assignmentTopic.length>500)throw Error('Invalid coding language');
      const exercise=item.exercise;
      if(exercise!==null && (!exercise||typeof exercise.title!=='string'||!exercise.title.trim()||exercise.title.length>120||typeof exercise.prompt!=='string'||!exercise.prompt.trim()||exercise.prompt.length>1200||!Array.isArray(exercise.tests)||exercise.tests.length<2||exercise.tests.length>3||!exercise.tests.every(t=>t&&typeof t.input==='string'&&t.input.length<=1000&&typeof t.expected==='string'&&t.expected.length<=1000)))throw Error('Invalid coding exercise');
      if(item.results.length && (!exercise || item.results.length>exercise.tests.length))throw Error('Invalid coding results');
      if(!item.results.every(r=>r&&typeof r.output==='string'&&r.output.length<=1000&&typeof r.error==='string'&&r.error.length<=500&&typeof r.passed==='boolean'))throw Error('Invalid coding results');
      if(exercise?.language!=null&&!['JavaScript','TypeScript','Python','C++','Java'].includes(exercise.language))throw Error('Invalid exercise language');
      return {type:item.type,language,assignmentTopic,code:item.code,stdin:item.stdin,output:item.output,runError:item.runError,results:item.results.map(r=>({...r})),exercise:exercise?{title:exercise.title,prompt:exercise.prompt,language:exercise.language??'JavaScript',tests:exercise.tests.map(t=>({...t}))}:null};
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

  function normalizePathLesson(lesson) {
    const valid=(v,max)=>typeof v==='string' && v.trim().length>0 && v.length<=max;
    if(!lesson||!valid(lesson.title,120)||!Array.isArray(lesson.screens)||lesson.screens.length!==2||!lesson.screens.every(x=>x&&valid(x.heading,120)&&valid(x.body,1600))||!valid(lesson.question,1000)||!Array.isArray(lesson.choices)||lesson.choices.length!==4||!lesson.choices.every(x=>valid(x,350))||new Set(lesson.choices.map(x=>x.trim().toLowerCase())).size!==4||!Number.isInteger(lesson.correctIndex)||lesson.correctIndex<0||lesson.correctIndex>3||!Array.isArray(lesson.explanations)||lesson.explanations.length!==4||!lesson.explanations.every(x=>valid(x,800))||!Number.isInteger(lesson.screen)||lesson.screen<0||lesson.screen>3||!(lesson.selected===null || Number.isInteger(lesson.selected)&&lesson.selected>=0&&lesson.selected<4)||typeof lesson.passed!=='boolean')throw Error('Invalid interactive lesson');
    if(lesson.attempts != null && (!Array.isArray(lesson.attempts) || lesson.attempts.length>100 || !lesson.attempts.every(x=>Number.isInteger(x)&&x>=0&&x<4))) throw Error('Invalid quiz attempts');
    if(lesson.historyComplete != null && typeof lesson.historyComplete !== 'boolean') throw Error('Invalid quiz history');
    const lab=lesson.lab==null ? null : normalizeActivity(lesson.lab);
    if(lab && lab.type!=='livelab-creative')throw Error('Invalid lesson LiveLab');
    const mastery=root.MasteryCore || (typeof require==='function' ? require('./mastery-core.js') : null);
    const quizV2=lesson.quizV2 == null ? null : mastery.normalizeQuiz(lesson.quizV2);
    const showCore=root.StudyShowCore || (typeof require==='function' ? require('./studyshow-core.js') : null);
    const studyShow=lesson.studyShow == null ? null : showCore.normalize(lesson.studyShow);
    return {title:lesson.title,screens:lesson.screens.map(x=>({heading:x.heading,body:x.body})),question:lesson.question,choices:[...lesson.choices],correctIndex:lesson.correctIndex,explanations:[...lesson.explanations],screen:lesson.screen,selected:lesson.selected,passed:lesson.passed,lab,...(lesson.attempts != null ? {attempts:[...lesson.attempts]} : {}),...(lesson.historyComplete != null ? {historyComplete:lesson.historyComplete} : {}),...(quizV2?{quizV2}:{}),...(studyShow?{studyShow}:{})};
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
        if (message.plan != null && (message.role !== 'assistant' || !Array.isArray(message.plan) || message.plan.length < 2 || message.plan.length > 5 || !message.plan.every(step => step && typeof step.text === 'string' && step.text.trim() && step.text.length <= 500 && typeof step.done === 'boolean' && (step.completedBy == null || step.completedBy === 'ai' && step.done)))) throw Error('Invalid saved learning path');
        return { role: message.role, text: message.text, ...(message.activity ? { activity: message.activity } : {}), ...(message.plan ? { plan: message.plan.map(step => ({text:step.text,done:step.done,...(step.completedBy ? {completedBy:step.completedBy} : {}),...(step.lesson ? {lesson:normalizePathLesson(step.lesson)} : {})})) } : {}) };
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
      if (session.titleEdited != null && typeof session.titleEdited !== 'boolean') throw Error('Invalid session title');
      return { id: session.id, title: session.title, minutes: session.minutes, createdAt: session.createdAt, updatedAt: session.updatedAt, pinned: session.pinned, messages, activity, activities, draft: session.draft || '', expanded: Boolean(session.expanded && activity), ...(session.learningGoal != null ? { learningGoal: session.learningGoal } : {}), ...(session.titleEdited != null ? {titleEdited:session.titleEdited} : {}) };
    });
    if (new Set(sessions.map(session => session.id)).size !== sessions.length) throw Error('Duplicate learning session');
    if (value.memory != null && (!value.memory || typeof value.memory.enabled !== 'boolean' || typeof value.memory.notes !== 'string' || value.memory.notes.length > 2000)) throw Error('Invalid chat memory');
    return { sessions, selected: sessions.some(session => session.id === value.selected) ? value.selected : null, ...(value.memory ? {memory:{enabled:value.memory.enabled,notes:value.memory.notes}} : {}) };
  }

  function quizStats(workspace) {
    const quizzes=(workspace?.sessions || []).flatMap(session=>(session.messages || []).flatMap(message=>(message.plan || []).flatMap(step=>step.lesson ? [{title:step.lesson.title,lesson:step.lesson}] : [])));
    const recorded=quizzes.filter(item=>Array.isArray(item.lesson.attempts)&&item.lesson.attempts.length>0);
    const attempts=recorded.reduce((sum,item)=>sum+item.lesson.attempts.length,0);
    const correct=recorded.reduce((sum,item)=>sum+item.lesson.attempts.filter(choice=>choice===item.lesson.correctIndex).length,0);
    const eligible=recorded.filter(item=>item.lesson.historyComplete!==false);
    const firstTry=eligible.filter(item=>item.lesson.attempts[0]===item.lesson.correctIndex).length;
    const modern=quizzes.filter(item=>item.lesson.quizV2).flatMap(item=>item.lesson.quizV2.questions.map(q=>({q,attempts:item.lesson.quizV2.attempts.filter(a=>a.questionId===q.id)}))).filter(item=>item.attempts.length);
    const modernAttempts=modern.reduce((sum,item)=>sum+item.attempts.length,0),modernCorrect=modern.reduce((sum,item)=>sum+item.attempts.filter(a=>a.correct).length,0),modernFirst=modern.filter(item=>item.attempts[0].correct).length;
    const totalAttempts=attempts+modernAttempts,totalCorrect=correct+modernCorrect,totalEligible=eligible.length+modern.length,totalFirst=firstTry+modernFirst;
    return {quizzes:recorded.length+modern.length,attempts:totalAttempts,correct:totalCorrect,firstTry:totalFirst,firstTryEligible:totalEligible,firstTryPercent:totalEligible?Math.round(100*totalFirst/totalEligible):null,attemptPercent:totalAttempts?Math.round(100*totalCorrect/totalAttempts):null,legacy:quizzes.filter(item=>item.lesson.passed && !item.lesson.attempts?.length && !item.lesson.quizV2 || item.lesson.historyComplete===false).length};
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
    return { sessions: sessions.length, paths: paths.length, checks: paths.filter(item => item.activity.answer === 1).length, simulations: paths.filter(item => Number.isInteger(item.activity.result)).length, pathsByRecency: paths, tutorPlans, selfMarkedSteps:tutorPlans.reduce((sum,plan) => sum + plan.steps.filter(step => step.done && !step.completedBy).length,0), aiCompletedSteps:tutorPlans.reduce((sum,plan) => sum + plan.steps.filter(step => step.done && step.completedBy === 'ai').length,0) };
  }
  root.WorkspaceCore = { normalize, normalizePathLesson, quizStats, learningProgress, searchState, searchValues, searchTargets, sortingState, sortingSets, lineState, lineTargets, balanceState, balanceProblems, codingChallenge, projectileStarter };
  if (typeof module !== 'undefined') module.exports = root.WorkspaceCore;
})(typeof window !== 'undefined' ? window : globalThis);
