'use strict';

// Run with Playwright available (locally or through NODE_PATH). No personal
// FORGE profile or API key is read. The baseline and all artifacts are temporary.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { _electron: electron } = require('playwright');

const root = path.resolve(__dirname, '..');
const baselineRef = process.env.FORGE_BASELINE_REF || '40fbbaf8cc52a4be78f5a5fe5118adc70c9111bb';
const executablePath = require(path.join(root, 'node_modules', 'electron'));
const errors = [];
let application;
let page;
let scratch;
let output;
let profile;

async function launch(directory) {
  const env = { ...process.env, FORGE_QA_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.FORGE_AI_KEY_FILE;
  delete env.FORGE_QA_ONBOARDING;
  application = await electron.launch({ executablePath, args: [directory], env, timeout: 45000 });
  page = await application.firstWindow();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.waitForFunction(() => typeof state !== 'undefined' && Boolean(window.SchoolUI));
}

async function close() {
  if (!application) return;
  await application.evaluate(({ session }) => session.defaultSession.flushStorageData());
  await application.close();
  application = null;
}

async function readState() { return page.evaluate(() => JSON.parse(JSON.stringify(state))); }
async function savedSpark() { return page.evaluate(() => JSON.parse(localStorage.getItem('forge_mvp_v1')).sparkLab); }
function withoutSpark(value) { const { sparkLab, ...existing } = value; return existing; }

async function learn() {
  await page.locator('[data-view="lessons"]').click();
  await page.locator('#sparkLab').waitFor({ state: 'visible' });
}

async function layout(name, width, theme) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(value => { state.settings.theme = value; applyTheme(); }, theme);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const findings = await page.locator('#sparkLab').evaluate(host => {
    const unnamed = [...host.querySelectorAll('button,input,select')].filter(element =>
      !element.disabled && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby') &&
      !element.textContent.trim() && !element.labels?.length).map(element => element.id || element.outerHTML);
    const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
    const overflow = [...host.querySelectorAll('*')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
    }).map(element => element.id || element.tagName + '.' + element.className).slice(0,8);
    return { unnamed, duplicateIds: ids.filter((id,index) => ids.indexOf(id) !== index), overflow,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  assert.deepEqual(findings.unnamed, [], `${name}: unnamed controls`);
  assert.deepEqual(findings.duplicateIds, [], `${name}: duplicate IDs`);
  assert.deepEqual(findings.overflow, [], `${name}: Spark content overflows at ${width}px`);
  assert.equal(findings.pageOverflow, false, `${name}: page overflows at ${width}px`);
  await page.locator('#sparkLab').screenshot({ path: path.join(output, `${name}-${width}-${theme}.png`) });
}

async function setNumber(lessonId, target) {
  let value = (await readState()).sparkLab.lessons[lessonId].answer;
  assert.equal(typeof value, 'number');
  while (value !== target) {
    await page.locator(value < target ? '#sparkPlus' : '#sparkMinus').click();
    value = (await readState()).sparkLab.lessons[lessonId].answer;
  }
}

async function checkAndNext(lessonId, step) {
  await page.locator('#sparkCheck').click();
  assert.equal((await savedSpark()).lessons[lessonId].solved, true, `${lessonId} ${step} was checked and saved`);
  assert.equal(await page.locator('#sparkNext').evaluate(element => document.activeElement === element), true,
    'Keyboard focus moves to Continue');
  await page.locator('#sparkNext').click();
}

async function seedBaseline() {
  return page.evaluate(async () => {
    state = seed();
    state.onboarding = OnboardingCore.legacy();
    state.onboarding.displayName = 'Upgrade fixture';
    state.onboarding.goals = ['math','programming'];
    state.settings = { theme: 'dark', progressionTarget: 120, lessonTarget: 3 };
    state.tasks[0].done = true;
    state.codeNotes = { two: { Python: '# Existing learner draft\nprint(2 + 3)' }, binary: { Python: '# Saved binary draft' } };
    state.codeDone.two = true;
    state.mathAttempts.push({ id:'legacy-math',topic:'Algebra',date:todayKey(),correct:true });
    state.coach.profile.grade = '7';
    state.coach.profile.goal = 'Understand patterns through Python';
    state.aoc = AocCore.setStars(state.aoc, 2025, 3, 2);
    state.training = TrainingCore.setDone(state.training, TrainingCore.CATALOG[0].id, true);
    const project = ProjectCore.makePlan(ProjectCore.catalog[0].id,
      { id:'plan-upgrade', startDate:todayKey(), workdays:'daily' }, Date.now());
    state.projects.plans = [project.plan];
    state.tasks.push(...project.tasks);
    state.school = SchoolCore.start(state.school, { kind:'quiz',subject:'Mathematics',count:5 });
    state.school.active.questionIds.forEach((id,index) => {
      const correct = SchoolCore.byId.get(id).answer;
      state.school = SchoolCore.answer(state.school,index,index === 0 ? (correct + 1) % 4 : correct);
    });
    state.school = SchoolCore.finish(state.school).school;
    state.school = SchoolCore.start(state.school, { kind:'quiz',subject:'English',count:5 });
    state.school = SchoolCore.answer(state.school,0,1);
    const exam = (await window.forgeDesktop.getAmcCatalog())[0];
    state.amc.active = { id:'legacy-amc',examId:exam.id,mode:'practice',startedAt:Date.now(),deadline:null,
      answers:Array(25).fill(''),notes:Array(25).fill(''),flags:Array(25).fill(false),checked:Array(25).fill(false) };
    state.amc.active.answers[0] = 'B';
    state.amc.active.notes[0] = 'Preserve my working notes';
    state.amc.active.flags[0] = true;
    const start = Date.now() - 120000;
    state.focus = FocusCore.start(state.focus, { durationMinutes:25,taskId:state.tasks[0].id,taskTitle:state.tasks[0].name },start);
    state.focus = FocusCore.pause(state.focus,start + 60000);
    const lesson = {
      subject:'Math',topic:'Counting garden tiles',level:'Beginner',objectives:['Count rows.','Add consecutive row sizes.'],
      prerequisites:[],modules:[1,2,3].map(n => ({ heading:`Row ${n}`,explanation:`This row has ${n} tiles.`,
        keyIdea:'Count each tile once.',examplePrompt:`How many tiles are in row ${n}?`,exampleSteps:['Locate the row.','Count its tiles.'],
        exampleAnswer:String(n),exercisePrompt:`Count row ${n}.`,exerciseAnswer:String(n),exerciseExplanation:'Count one tile at a time.' })),
      quiz:[1,2,3].map(n => ({ prompt:`Count ${n} tiles.`,choices:['1','2','3','4'],correctIndex:n-1,explanation:`There are ${n} tiles.` })),
      codingChallenge:null,followUps:[{ subject:'Math',topic:'Count a fourth row',level:'Beginner',reason:'Extend the same pattern.' }]
    };
    const lessonProgress = CoachCore.blankProgress(lesson);
    lessonProgress.exerciseAnswers[0] = 'My saved exercise notes';
    lessonProgress.quizAnswers = [0,1,2];
    lessonProgress.quizChecked = true;
    lessonProgress.completedAt = Date.now();
    lessonProgress.attempts = [{ at:lessonProgress.completedAt,correct:3 }];
    lessonProgress.nextReview = dateAdd(todayKey(),1);
    state.coach.history.push({ id:'legacy-lesson',kind:'lesson',createdAt:Date.now(),
      lessonInput:{ subject:lesson.subject,topic:lesson.topic,level:lesson.level,minutes:15,goal:'',language:'Python' },lessonProgress,
      result:{ title:'Saved tile lesson',summary:'A pre-upgrade lesson.',sections:[],recommendations:[],competitions:[],sources:[],lesson } });
    state = normalizeBackup(state);
    renderAll();
    saveCode(false);
    return JSON.parse(JSON.stringify(state));
  });
}

async function importBackup(file, accept = true) {
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  page.once('dialog', dialog => accept ? dialog.accept() : dialog.dismiss());
  await page.locator('#importFile').setInputFiles(file);
  if (accept) await page.waitForFunction(() => document.getElementById('importFile').value === '' &&
    document.getElementById('toast').textContent === 'Backup imported successfully.');
  else await page.waitForFunction(() => document.getElementById('importFile').value === '');
}

(async () => {
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-spark-qa-'));
  output = process.env.FORGE_QA_OUTPUT ? path.resolve(process.env.FORGE_QA_OUTPUT) : path.join(scratch,'artifacts');
  profile = path.join(scratch,'profile');
  await fs.mkdir(output,{ recursive:true });
  const baseline = process.env.FORGE_BASELINE_DIR || path.join(scratch,'baseline');
  if (!process.env.FORGE_BASELINE_DIR) {
    await fs.mkdir(baseline);
    const archive = path.join(scratch,'baseline.tar');
    execFileSync('git',['archive','--format=tar','-o',archive,baselineRef],{ cwd:root });
    execFileSync('tar',['-xf',archive,'-C',baseline]);
    await fs.symlink(path.join(root,'node_modules'),path.join(baseline,'node_modules'),process.platform === 'win32' ? 'junction' : 'dir');
  }
  assert.equal(JSON.parse(await fs.readFile(path.join(baseline,'package.json'),'utf8')).version,'1.11.0');
  await launch(baseline);
  const oldState = await seedBaseline();
  assert.equal(Object.hasOwn(oldState,'sparkLab'),false,'Baseline has no Spark Lab field');
  await fs.writeFile(path.join(scratch,'legacy-backup.json'),JSON.stringify(oldState));
  await close();

  await launch(root);
  assert.deepEqual(withoutSpark(await readState()),oldState,'Existing profile survives upgrade');
  await learn();
  await layout('spark-library',1440,'dark');
  await layout('spark-library',390,'light');
  await page.locator('[data-spark-open="balance"]').first().click();
  await layout('spark-balance',390,'dark');
  await layout('spark-balance',1440,'light');
  assert.doesNotMatch(await page.locator('#sparkLab .spark-code').textContent(),/x = 4/,
    'Unsolved challenge shows a general rule without revealing its exact solution');
  await page.locator('#sparkMinus').press('Enter');
  assert.equal((await savedSpark()).lessons.balance.answer,0);
  assert.equal(await page.locator('#sparkSlider').evaluate(element => document.activeElement === element),true,
    'Decrement boundary moves focus from disabled button to range control');
  await page.locator('#sparkSlider').press('End');
  assert.equal((await savedSpark()).lessons.balance.answer,12);
  assert.equal(await page.locator('#sparkPlus').isDisabled(),true);
  await page.locator('#sparkSlider').press('Home');
  await page.locator('#sparkSlider').press('ArrowRight');
  await page.locator('#sparkCheck').click();
  assert.equal((await readState()).sparkLab.lessons.balance.solved,false,'Wrong answer does not advance');
  assert.ok((await page.locator('#sparkFeedback').textContent()).trim(),'Wrong answer receives feedback');
  await page.locator('#sparkHint').click();
  assert.equal(await page.locator('#sparkHintDetails').getAttribute('open'),'','Hint can be opened');
  await page.locator('#sparkSlider').focus();
  await page.locator('#sparkSlider').press('ArrowRight');
  assert.equal((await savedSpark()).lessons.balance.answer,2,'Range control works from the keyboard');
  assert.equal(await page.locator('#sparkHintDetails').getAttribute('open'),'','Changing a control preserves the opened hint');
  assert.equal(await page.locator('#sparkSlider').evaluate(element => document.activeElement === element),true,
    'Range control retains keyboard focus after rendering');
  await page.evaluate(() => { state.settings.theme = 'dark'; save(); });
  const partialCheckpoint = await savedSpark();
  await close();
  await launch(root);
  assert.deepEqual(withoutSpark(await readState()),oldState,'Old fields survive partial-answer restart');
  assert.deepEqual((await readState()).sparkLab,partialCheckpoint,'Unsolved answer survives restart');
  await learn();
  await setNumber('balance',4);
  await page.locator('#sparkCheck').click();
  assert.equal((await savedSpark()).lessons.balance.solved,true);
  assert.match(await page.locator('#sparkLab .spark-code').textContent(),/x = 4/,'Checked answer reveals the worked Python example');
  await page.evaluate(() => { state.settings.theme = 'dark'; save(); });
  const checkpoint = await savedSpark();
  await close();

  await launch(root);
  assert.deepEqual(withoutSpark(await readState()),oldState,'Old fields survive a second restart');
  assert.deepEqual((await readState()).sparkLab,checkpoint,'Checked answer survives restart before Continue');
  await learn();
  await page.locator('#sparkNext').click();
  for (const [step,value] of [[1,5],[2,7]]) { await setNumber('balance',value); await checkAndNext('balance',step); }
  assert.equal((await savedSpark()).lessons.balance.completed,true);
  await page.locator('#sparkCompleteHeading').waitFor({ state:'visible' });
  await layout('spark-complete',390,'light');
  await page.locator('#sparkHome').click();

  await page.locator('[data-spark-open="patterns"]').first().click();
  await layout('spark-patterns',1440,'dark');
  await layout('spark-patterns',390,'light');
  for (const [step,value] of [6,10,15].entries()) { await setNumber('patterns',value); await checkAndNext('patterns',step); }
  assert.equal((await savedSpark()).lessons.patterns.completed,true);
  await page.locator('#sparkHome').click();

  await page.locator('[data-spark-open="logic"]').first().click();
  await layout('spark-logic',1440,'light');
  await layout('spark-logic',390,'dark');
  for (const [step,target] of [[true,true],[false,false],[true,false]].entries()) {
    for (const [index,selector] of ['#sparkA','#sparkB'].entries()) {
      if ((await page.locator(selector).getAttribute('aria-pressed') === 'true') !== target[index]) await page.locator(selector).click();
    }
    await checkAndNext('logic',step);
  }
  assert.equal((await savedSpark()).lessons.logic.completed,true);
  await layout('spark-final-completion',1440,'dark');
  await page.locator('#sparkHome').click();
  await layout('spark-all-complete',1440,'dark');

  await page.locator('[data-spark-open="balance"]').first().click();
  const beforeReplay = await savedSpark();
  await page.locator('#sparkReplay').click();
  await page.locator('#sparkCancelReplay').press('Enter');
  assert.deepEqual(await savedSpark(),beforeReplay,'Canceling replay preserves completion');
  await page.locator('#sparkReplay').click();
  await page.locator('#sparkConfirmReplay').click();
  const replay = await savedSpark();
  assert.equal(replay.lessons.balance.step,0);
  assert.equal(replay.lessons.balance.completed,false,'Confirmed replay restarts the selected trail');
  assert.deepEqual(replay.lessons.patterns,beforeReplay.lessons.patterns,'Replay preserves another completed trail');
  assert.deepEqual(replay.lessons.logic,beforeReplay.lessons.logic,'Replay preserves all unrelated trails');
  for (const [step,value] of [4,5,7].entries()) { await setNumber('balance',value); await checkAndNext('balance',step); }
  await page.locator('#sparkHome').click();

  // Existing binary-search lab remains reachable and functional.
  await page.locator('#lxOpen').click();
  await page.locator('#lxStart').click();
  for (const direction of ['Right','Left','Right','Found']) {
    await page.locator(`#lx${direction}`).click();
    await page.locator('#lxNext').click();
  }
  await page.locator('[data-lx-quiz="sorted"]').click();
  assert.match(await page.locator('#lxQuizFeedback').textContent(),/Correct/);

  await page.evaluate(() => { state.settings.theme = 'dark'; save(); });
  const beforeExport = await readState();
  const backup = path.join(scratch,'spark-backup.json');
  await application.evaluate(({ dialog },file) => { dialog.showSaveDialog = async () => ({ canceled:false,filePath:file }); },backup);
  await page.evaluate(() => document.getElementById('exportData').click());
  await page.waitForFunction(() => document.getElementById('toast').textContent === 'Backup saved.');
  const exported = JSON.parse(await fs.readFile(backup,'utf8'));
  assert.deepEqual(exported,beforeExport,'Native backup exports old and new progress');
  await importBackup(path.join(scratch,'legacy-backup.json'),false);
  assert.deepEqual(await readState(),beforeExport,'Canceling import preserves all progress');
  const partialBackup = structuredClone(exported);
  partialBackup.sparkLab.activeLesson = 'balance';
  partialBackup.sparkLab.lessons.balance = { step:0,answer:1,solved:false,completed:false };
  const partialFile = path.join(scratch,'partial-backup.json');
  await fs.writeFile(partialFile,JSON.stringify(partialBackup));
  await importBackup(partialFile);
  await learn();
  await page.locator('#sparkCheck').click();
  assert.match(await page.locator('#sparkFeedback').textContent(),/Keep exploring/);
  await importBackup(partialFile);
  assert.doesNotMatch(await page.locator('#sparkFeedback').textContent(),/Keep exploring/,
    'Import clears transient feedback from the previous workspace');
  await importBackup(path.join(scratch,'legacy-backup.json'));
  assert.deepEqual(withoutSpark(await readState()),oldState,'Legacy JSON backup imports unchanged');
  assert.ok(Object.values((await readState()).sparkLab.lessons).every(item => !item.completed),'Legacy backup safely defaults Spark Lab');
  await importBackup(backup);
  assert.deepEqual(await readState(),exported,'JSON import restores completed trails and old fields');
  await close();
  await launch(root);
  assert.deepEqual(await readState(),exported,'Imported profile survives restart');
  await close();
  assert.deepEqual(errors,[],'No renderer errors during baseline, upgrade, activities, backup, or restart');
  const report = { baseline:baselineRef,passed:true,checks:[
    'Actual v1.11.0 profile upgraded and restarted without loss',
    'Missions, project links, coding drafts, saved lessons, School history/review/active quiz, AMC notes, focus checkpoint, preferences preserved',
    'All nine Spark challenges completed via controls; wrong answer, hint, partial/checked checkpoints, keyboard range/focus, replay cancel/reset verified',
    'Learn library, each activity, and completion inspected for overflow at desktop and 390px in both themes',
    'Existing binary search lab completed',
    'Native JSON export, canceled import, legacy import, new backup import and restart verified',
    'Zero renderer errors'
  ],artifacts:output };
  await fs.writeFile(path.join(output,'spark-electron-report.json'),JSON.stringify(report,null,2));
  await fs.rm(path.join(output,'spark-failure.png'),{ force:true });
  // Retain screenshots/report while removing the synthetic profile and checkout.
  for (const name of ['baseline','profile','baseline.tar','legacy-backup.json','spark-backup.json','partial-backup.json']) {
    await fs.rm(path.join(scratch,name),{ recursive:true,force:true });
  }
  if (!output.startsWith(scratch + path.sep)) await fs.rmdir(scratch);
  console.log(JSON.stringify(report,null,2));
})().catch(async error => {
  if (page && output) await page.screenshot({ path:path.join(output,'spark-failure.png'),fullPage:true }).catch(() => {});
  await close().catch(() => {});
  console.error(error);
  console.error('QA artifacts:',output);
  process.exitCode = 1;
});
