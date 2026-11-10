/* Original, on-device experiments. Figures are drawn from the current answer. */
(() => {
  'use strict';
  const host = document.getElementById('sparkLab');
  if (!host) return;
  const core = window.ForgeSpark;
  const names = { balance: 'Ember', patterns: 'Sprig', logic: 'Bit' };
  let feedback = null;
  let resetPending = false;
  const live = document.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-atomic', 'true');
  host.after(live);
  let announcement = 0;
  function announce(text) {
    const token = ++announcement;
    live.textContent = '';
    requestAnimationFrame(() => { if (token === announcement) live.textContent = text; });
  }
  function focus(id) {
    const element = document.getElementById(id);
    (element?.disabled ? document.getElementById('sparkSlider') : element)?.focus({ preventScroll: true });
  }
  function moveFocus(id) { focus(id); host.scrollIntoView({ block: 'start' }); }
  function persist(next) { state.sparkLab = core.normalizeState(next); save(); }
  function current() {
    const lab = core.normalizeState(state.sparkLab);
    const lesson = core.lessons.find(item => item.id === lab.activeLesson);
    return { lab, lesson, progress: lesson && lab.lessons[lesson.id] };
  }

  // Ember, Sprig and Bit are original SVG emoji characters, not font glyphs.
  function character(id, happy = false) {
    const body = id === 'balance'
      ? '<path d="M48 8C49 27 70 26 72 43C86 36 89 64 78 80C61 103 22 92 19 68C16 48 34 43 33 27C39 31 44 22 48 8Z" fill="#ffc954"/><path d="M34 75Q31 62 44 53Q44 67 58 61Q75 79 54 87Q40 88 34 75" fill="#ff9d45"/>'
      : id === 'patterns'
        ? '<path d="M50 31C20 22 13 53 24 75C32 93 69 93 79 74C91 51 79 23 50 31Z" fill="#5bdab5"/><path d="M50 31Q30 11 20 20Q23 37 50 31M50 31Q52 8 75 12Q74 31 50 31" fill="#a2eb79"/><path d="M50 32V22" stroke="#226653" stroke-width="4" stroke-linecap="round"/>'
        : '<path d="M24 30Q15 30 15 42V76Q15 88 27 88H74Q86 88 86 76V42Q86 30 74 30Z" fill="#bda7ff"/><path d="M50 30V18" stroke="#bda7ff" stroke-width="5"/><circle cx="50" cy="13" r="7" fill="#ffc954"/><rect x="24" y="42" width="53" height="33" rx="11" fill="#514178"/><path d="M15 53H8V69H15M86 53H93V69H86" fill="#8d7ac4"/>';
    const ink = id === 'logic' ? '#fff4cc' : '#21314a';
    return `<svg class="spark-character" viewBox="0 0 100 105" aria-hidden="true"><ellipse cx="50" cy="98" rx="28" ry="4" fill="currentColor" opacity=".12"/>${body}<g stroke="${ink}" stroke-width="4" stroke-linecap="round" fill="none">${happy ? '<path d="M33 54Q37 48 41 54M59 54Q63 48 67 54"/>' : '<path d="M37 51V55M63 51V55"/>'}<path d="M43 66Q50 72 57 66"/></g></svg>`;
  }
  function homeMarkup(lab) {
    const completed = core.lessons.filter(lesson => lab.lessons[lesson.id].completed).length;
    const next = core.lessons.find(lesson => !lab.lessons[lesson.id].completed) || core.lessons[0];
    return `<section class="spark-home" aria-labelledby="sparkHeading">
      <div class="spark-hero"><div class="spark-hero-copy"><div class="eyebrow">SPARK LAB · LEARN BY DOING</div><h2 id="sparkHeading" tabindex="-1">Small experiments.<br><span>Big ideas.</span></h2><p>Move a piece. Test a hunch. See why it works.<br>Three playful trails from mathematics to code.</p><button class="btn primary" data-spark-resume="${next.id}">${completed === 3 ? 'Explore again' : 'Find your next spark'} <span aria-hidden="true">→</span></button><div class="spark-meta">No setup · Works offline · Your pace</div></div><div class="spark-friends" aria-hidden="true"><span class="spark-orbit"></span><div class="spark-friend sprig">${character('patterns')}<span>Sprig</span></div><div class="spark-friend ember">${character('balance')}<span>Ember</span></div><div class="spark-friend bit">${character('logic')}<span>Bit</span></div></div></div>
      <div class="spark-trail-heading"><div><h3>Choose a curiosity</h3><p>Start anywhere. Each trail has three small challenges.</p></div><span class="spark-count">${completed} / 3 trails complete</span></div>
      <div class="spark-trails">${core.lessons.map((lesson, i) => {
        const p = lab.lessons[lesson.id], done = p.completed ? 3 : p.step + Number(p.solved);
        return `<article class="spark-card spark-${lesson.id}"><div class="spark-card-top">${character(lesson.id, p.completed)}<span class="spark-number">0${i + 1}</span></div><div class="eyebrow">${['ALGEBRA', 'PATTERNS + LOOPS', 'COMPUTER LOGIC'][i]}</div><h3>${esc(lesson.title)}</h3><p>${esc(lesson.subtitle)}</p><div class="spark-card-meta"><span>About ${lesson.minutes} min</span><span>${done} / 3 solved</span></div><div class="spark-dots" aria-hidden="true">${[0,1,2].map(n => `<i class="${n < done ? 'filled' : ''}"></i>`).join('')}</div><button class="btn" data-spark-open="${lesson.id}">${p.completed ? 'View completed trail' : done || p.answer !== core.defaultAnswer(lesson.id, 0) && typeof p.answer === 'number' ? 'Continue trail' : 'Explore trail'} <span aria-hidden="true">→</span></button></article>`;
      }).join('')}</div><details class="spark-secret"><summary>✦ A little secret</summary><p><span aria-hidden="true">🍫</span> Chocolate break! Curiosity is even sweeter with a little chocolate.</p></details><p class="spark-footnote">Your place is saved on this device and included in JSON backups. Trail completion records practice, not a skill rating.</p>
    </section>`;
  }
  function balanceFigure(step, answer) {
    const total = step.coefficient * answer + step.constant;
    const tilt = Math.max(-12, Math.min(12, (total - step.target) * -2));
    return `<svg class="spark-diagram" viewBox="0 0 480 235" role="img" aria-label="Balance: ${step.coefficient} crates of ${answer}, plus ${step.constant}, weighs ${total}. The other side weighs ${step.target}."><path d="M215 210L240 111L265 210Z" fill="#8b80c9"/><rect x="192" y="208" width="96" height="10" rx="5" fill="#8b80c9"/><g transform="rotate(${tilt} 240 111)"><path d="M91 111H389" stroke="#9bafe0" stroke-width="7" stroke-linecap="round"/><path d="M101 111L73 170H162L135 111M345 111L318 170H407L380 111" fill="none" stroke="#9bafe0" stroke-width="3"/><path d="M65 170Q116 199 170 170M310 170Q362 199 415 170" fill="#3a567b"/>${Array.from({length:step.coefficient},(_,i)=>`<rect x="${78+i*27}" y="140" width="24" height="27" rx="5" fill="#ffc954"/><text x="${90+i*27}" y="159" text-anchor="middle" font-size="14" font-weight="800" fill="#21314a">x</text>`).join('')}${Array.from({length:step.constant},(_,i)=>`<circle cx="${90+i*12}" cy="131" r="4" fill="#ffc954"/>`).join('')}<rect x="327" y="132" width="68" height="36" rx="10" fill="#72dcca"/><text x="361" y="157" fill="#163c3b" text-anchor="middle" font-size="22" font-weight="800">${step.target}</text></g><text x="120" y="50" class="spark-svg-label">${step.coefficient} × ${answer} + ${step.constant}</text><circle cx="240" cy="111" r="10" fill="#ffc954"/><text x="120" y="230" class="spark-svg-label">${total} units</text><text x="361" y="230" class="spark-svg-label">${step.target} units</text></svg>`;
  }
  function patternFigure(step, answer) {
    const total = step.rows * (step.rows + 1) / 2;
    let n = 0;
    const tiles = Array.from({length:step.rows},(_,row) => Array.from({length:row+1},(_,col) => {
      n++;
      return `<rect x="${240 - (row + 1) * 19 + col * 38}" y="${17 + row * 35}" width="30" height="27" rx="7" fill="${n <= answer ? '#5bdab5' : 'none'}" stroke="${n <= answer ? '#5bdab5' : '#8c9fbe'}" stroke-width="2"/>`;
    }).join('')).join('');
    return `<svg class="spark-diagram" viewBox="0 0 480 235" role="img" aria-label="A staircase garden with ${step.rows} rows. Row one has one tile; each new row has one more. ${Math.min(total,answer)} tiles filled, ${Math.max(0,answer-total)} extra tiles.">${tiles}<text x="240" y="219" class="spark-svg-label">${answer > total ? `${answer-total} extra tiles beside the garden` : `${answer} tiles placed · ${step.rows} rows`}</text></svg>`;
  }
  function logicFigure(step, answer) {
    const on = step.gate === 'AND' ? answer.a && answer.b : step.gate === 'OR' ? answer.a || answer.b : answer.a !== answer.b;
    return `<svg class="spark-diagram" viewBox="0 0 480 235" role="img" aria-label="${step.gate} gate. Input A ${answer.a ? 'on' : 'off'}, input B ${answer.b ? 'on' : 'off'}. Lamp ${on ? 'on' : 'off'}."><path d="M96 75H175V98H205" fill="none" stroke="${answer.a ? '#ffc954' : '#8c9fbe'}" stroke-width="5"/><path d="M96 157H175V134H205" fill="none" stroke="${answer.b ? '#ffc954' : '#8c9fbe'}" stroke-width="5"/><path d="M275 116H369" stroke="${on ? '#ffc954' : '#8c9fbe'}" stroke-width="5"/><rect x="194" y="74" width="96" height="84" rx="22" fill="#625097"/><text x="242" y="124" fill="#fff" text-anchor="middle" font-weight="800" font-size="22">${step.gate}</text><circle cx="83" cy="75" r="24" fill="${answer.a ? '#ffc954' : '#354966'}"/><circle cx="83" cy="157" r="24" fill="${answer.b ? '#ffc954' : '#354966'}"/><text x="83" y="81" text-anchor="middle" fill="${answer.a ? '#21314a' : '#fff'}" font-size="18" font-weight="800">A</text><text x="83" y="163" text-anchor="middle" fill="${answer.b ? '#21314a' : '#fff'}" font-size="18" font-weight="800">B</text><circle cx="384" cy="106" r="32" fill="${on ? '#ffc954' : '#354966'}" stroke="#9bafe0" stroke-width="2"/><path d="M372 141H396M375 149H393" stroke="#9bafe0" stroke-width="5" stroke-linecap="round"/><text x="384" y="191" class="spark-svg-label">Lamp ${on ? 'on' : 'off'}</text></svg>`;
  }
  function controls(step, p) {
    if (step.kind === 'logic') return `<div class="spark-switches">${['a','b'].map(key => `<button class="btn spark-switch" id="spark${key.toUpperCase()}" aria-pressed="${p.answer[key]}" ${p.solved ? 'disabled' : ''}><span class="spark-switch-track" aria-hidden="true"><i></i></span>Input ${key.toUpperCase()}: ${p.answer[key] ? 'On' : 'Off'}</button>`).join('')}</div>`;
    return `<div class="spark-number-control"><label id="sparkValueLabel" for="sparkSlider">${step.kind === 'balance' ? 'Units in each crate' : 'Tiles in the whole garden'}</label><div class="spark-stepper"><button class="btn" id="sparkMinus" aria-label="Decrease by one" ${p.solved || p.answer <= step.min ? 'disabled' : ''}>−</button><output id="sparkValue" for="sparkSlider" aria-live="polite">${p.answer}</output><button class="btn" id="sparkPlus" aria-label="Increase by one" ${p.solved || p.answer >= step.max ? 'disabled' : ''}>+</button></div><input id="sparkSlider" type="range" min="${step.min}" max="${step.max}" value="${p.answer}" step="1" ${p.solved ? 'disabled' : ''}><span class="spark-range-labels" aria-hidden="true"><span>${step.min}</span><span>${step.max}</span></span></div>`;
  }
  function completedMarkup(lesson, lab) {
    const next = core.lessons.find(item => !lab.lessons[item.id].completed);
    return `<section class="spark-complete spark-${lesson.id}">${character(lesson.id, true)}<div class="eyebrow">THREE IDEAS, TRIED BY YOU</div><h2 id="sparkCompleteHeading" tabindex="-1">${esc(lesson.title)} complete.</h2><p>You explored, tested, and connected the idea to code.<br>Your trail is saved. Come back whenever you want a refresher.</p><ul>${lesson.steps.map(step => `<li><span aria-hidden="true">✓</span> ${esc(step.title)}</li>`).join('')}</ul><div class="spark-complete-actions">${next ? `<button class="btn primary" data-spark-open="${next.id}">Try ${esc(next.title)} →</button>` : '<button class="btn primary" data-spark-home>See all three trails →</button>'}<button class="btn" id="sparkReplay">Replay trail</button></div>${resetPending ? '<div class="spark-replay-confirm"><p>Replay clears this trail’s completion and starts at challenge one. Your other trails stay saved.</p><button class="btn" id="sparkCancelReplay">Keep completion</button> <button class="btn primary" id="sparkConfirmReplay">Restart this trail</button></div>' : ''}</section>`;
  }
  function render() {
    const { lab, lesson, progress: p } = current();
    if (!lesson) { host.innerHTML = homeMarkup(lab); return; }
    const step = lesson.steps[p.step];
    const checked = p.solved ? core.evaluate(lesson.id,p.step,p.answer) : feedback;
    const hint = host.querySelector('#sparkHintDetails');
    const hintKey = `${lesson.id}/${p.step}`;
    const hintOpen = hint?.dataset.step === hintKey && hint.open;
    host.innerHTML = `<div class="spark-workspace spark-${lesson.id}"><div class="spark-toolbar"><button class="btn sm" id="sparkHome">← All trails</button><span>SPARK LAB <span aria-hidden="true">/</span> ${esc(lesson.title)}</span><span class="spark-saved">On-device practice</span></div>${p.completed ? completedMarkup(lesson,lab) : `
      <ol class="spark-steps" aria-label="Trail progress">${lesson.steps.map((s,i) => `<li class="${i === p.step ? 'current' : i < p.step ? 'done' : ''}" ${i === p.step ? 'aria-current="step"' : ''}><span aria-hidden="true">${i < p.step ? '✓' : i+1}</span>${esc(s.title)}</li>`).join('')}</ol>
      <div class="spark-stage"><div class="spark-experiment"><div class="eyebrow">CHALLENGE ${p.step+1} OF 3</div><h2 id="sparkHeading" tabindex="-1">${esc(step.title)}</h2><p class="spark-prompt">${esc(step.prompt)}</p><div class="spark-figure">${step.kind === 'balance' ? balanceFigure(step,p.answer) : step.kind === 'patterns' ? patternFigure(step,p.answer) : logicFigure(step,p.answer)}</div>${controls(step,p)}<div id="sparkFeedback" class="spark-feedback ${checked ? checked.correct ? 'correct' : 'retry' : ''}">${checked ? `<strong>${checked.correct ? 'That clicks!' : 'Keep exploring.'}</strong><p>${esc(checked.feedback)}</p>` : '<p>Try the controls, then check your idea. You can try as many times as you like.</p>'}</div><div class="spark-actions">${p.solved ? `<button class="btn primary" id="sparkNext">${p.step === lesson.steps.length-1 ? 'Complete trail' : 'Next challenge'} →</button>` : '<button class="btn primary" id="sparkCheck">Check my idea →</button>'}</div></div>
      <aside class="spark-guide" aria-label="Trail guide"><div class="spark-guide-intro">${character(lesson.id,p.solved)}<div><h3>Meet ${names[lesson.id]}</h3><span>Your trail companion</span></div></div><p>${{balance:'An equation is a balance. Give every crate the same value, then watch both sides.',patterns:'A big pattern is made of small steps. Count a row, then see what the next one adds.',logic:'A computer follows a rule. Flip the inputs and watch how the output changes.'}[lesson.id]}</p><details id="sparkHintDetails" data-step="${hintKey}" ${hintOpen ? 'open' : ''}><summary id="sparkHint">A little nudge</summary><p>${esc(step.hint)}</p></details><div class="spark-code"><div class="eyebrow">THE CONNECTION TO CODE</div><pre><code>${esc((p.solved && step.code) || (step.kind === 'balance' ? `weight = ${step.coefficient} * crate + ${step.constant}\nbalanced = weight == ${step.target}` : step.kind === 'patterns' ? `tiles = 0\nfor row in range(1, ${step.rows+1}):\n    tiles += row` : `lamp = a ${step.gate === 'AND' ? 'and' : step.gate === 'OR' ? 'or' : '!='} b`))}</code></pre><p>A Python sketch of the same idea.</p></div><p class="spark-guide-note">No timer. No lost lives.<br>Understanding is the reward.</p></aside></div>`}</div>`;
  }
  function open(id) {
    if (!core.lessons.some(lesson => lesson.id === id)) return;
    feedback = null; resetPending = false;
    persist({ ...state.sparkLab, activeLesson: id }); render();
    moveFocus(current().progress.completed ? 'sparkCompleteHeading' : 'sparkHeading');
  }
  function changeAnswer(answer, focusId) {
    const {lab,lesson,progress:p} = current();
    if (!lesson || p.solved || p.completed) return;
    feedback = null;
    lab.lessons[lesson.id] = { ...p, answer, solved: false };
    persist(lab); render(); focus(focusId);
  }
  host.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const id = button.dataset.sparkOpen || button.dataset.sparkResume;
    if (id) { open(id); return; }
    const {lab,lesson,progress:p} = current();
    if (button.id === 'sparkHome' || button.hasAttribute('data-spark-home')) {
      feedback = null; resetPending = false;
      persist({...lab,activeLesson:null}); render(); moveFocus('sparkHeading');
    } else if (lesson && button.id === 'sparkCheck') {
      feedback = core.evaluate(lesson.id,p.step,p.answer);
      persist(core.commitAnswer(lab,lesson.id,p.step,p.answer)); render();
      focus(feedback.correct ? 'sparkNext' : 'sparkCheck'); announce(feedback.feedback);
    } else if (lesson && button.id === 'sparkNext') {
      feedback = null; persist(core.advance(lab,lesson.id)); render();
      moveFocus(current().progress.completed ? 'sparkCompleteHeading' : 'sparkHeading');
    } else if (lesson && ['sparkMinus','sparkPlus'].includes(button.id)) {
      changeAnswer(p.answer + (button.id === 'sparkPlus' ? 1 : -1),button.id);
    } else if (lesson && ['sparkA','sparkB'].includes(button.id)) {
      const key = button.id === 'sparkA' ? 'a' : 'b';
      changeAnswer({...p.answer,[key]:!p.answer[key]},button.id);
    } else if (lesson && button.id === 'sparkReplay') {
      resetPending = true; render(); focus('sparkCancelReplay');
    } else if (lesson && button.id === 'sparkCancelReplay') {
      resetPending = false; render(); focus('sparkReplay');
    } else if (lesson && button.id === 'sparkConfirmReplay') {
      resetPending = false; feedback = null;
      persist(core.restartLesson(lab,lesson.id)); render(); moveFocus('sparkHeading');
    }
  });
  host.addEventListener('change', event => {
    if (event.target.id === 'sparkSlider') changeAnswer(Number(event.target.value),'sparkSlider');
  });
  // External refreshes include backup import and workspace reset. Discard transient UI.
  window.SparkLabUI = { render() { feedback = null; resetPending = false; render(); }, open };
  render();
})();
