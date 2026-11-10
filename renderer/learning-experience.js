/* A local, deterministic lesson: no model request or progress claim. */
(() => {
  'use strict';
  const host = document.getElementById('learningExperience');
  if (!host) return;
  const values = Object.freeze([5, 12, 23, 34, 50, 67, 73, 88, 91, 99]);
  const targets = Object.freeze([73, 23, 5, 99, 72]);
  const live = document.createElement('p');
  live.id = 'lxAnnouncement';
  live.className = 'sr-only';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  host.after(live);
  let announcement = 0;
  function announce(message) {
    const current = ++announcement;
    live.textContent = '';
    requestAnimationFrame(() => { if (current === announcement) live.textContent = message; });
  }
  let lesson = fresh(73);

  function fresh(target) {
    return { open: false, target, low: 0, high: values.length - 1, phase: 'explore', comparisons: 0, pending: null, hint: false, feedback: '', incorrect: false, found: false, quiz: null };
  }
  function midpoint() { return Math.floor((lesson.low + lesson.high) / 2); }
  function focus(id) { document.getElementById(id)?.focus({ preventScroll: true }); }
  function reset(target = lesson.target) { lesson = { ...fresh(target), open: true }; render(); focus('lxStart'); }
  function open() { lesson.open = true; render(); focus('lxHeading'); }
  function close() { lesson.open = false; render(); focus('lxOpen'); }
  function stageMarkup() {
    const current = ['explore', 'try', 'reflect'].indexOf(lesson.phase);
    return `<ol class="lx-stages" aria-label="Lesson stages">${['Explore', 'Try it', 'Reflect'].map((name, index) => `<li class="${index === current ? 'current' : index < current ? 'complete' : ''}" ${index === current ? 'aria-current="step"' : ''}><span aria-hidden="true">${index < current ? '✓' : index + 1}</span>${name}</li>`).join('')}</ol>`;
  }
  function render() {
    if (!lesson.open) {
      host.innerHTML = `<article class="lx-intro"><div class="lx-intro-icon" aria-hidden="true">⌕</div><div><div class="eyebrow">INTERACTIVE LAB · NO SETUP NEEDED</div><h2>See binary search in action.</h2><p>Choose a half. Watch the search space shrink. Build the intuition one step at a time.</p></div><button class="btn primary" id="lxOpen">Try the lesson <span aria-hidden="true">→</span></button></article>`;
      return;
    }
    const mid = midpoint(), value = values[mid], finished = lesson.phase === 'reflect';
    const title = lesson.phase === 'explore' ? 'One comparison. Half the possibilities.' : finished ? (lesson.found ? 'You found the target.' : 'The target is not in this list.') : `Compare ${lesson.target} with the middle value.`;
    const description = lesson.phase === 'explore' ? 'Binary search works on sorted values. Compare the target with the middle value, then keep only the half that could contain it.' : finished ? (lesson.found ? `${lesson.target} is at index ${mid}. The search took ${lesson.comparisons} comparisons.` : `The remaining range is empty after ${lesson.comparisons} comparisons. That proves ${lesson.target} is absent from this sorted list.`) : `The current range runs from index ${lesson.low} to ${lesson.high}. The middle is index ${mid}, with value ${value}.`;
    const cells = values.map((number, index) => {
      const discarded = index < lesson.low || index > lesson.high;
      const isMid = !discarded && index === mid;
      const side = discarded ? 'discarded' : isMid ? 'middle' : index < mid ? 'left' : 'right';
      return `<li class="lx-cell ${side}${finished && lesson.found && isMid ? ' found' : ''}" aria-label="Index ${index}, value ${number}${discarded ? ', ruled out' : isMid ? ', middle' : index < mid ? ', left half' : ', right half'}"><span class="lx-index">${index}</span><strong>${number}</strong><span class="lx-cell-state">${discarded ? 'Out' : isMid ? (finished && lesson.found ? 'Found' : 'Middle') : index < mid ? 'Left' : 'Right'}</span></li>`;
    }).join('');
    let actionArea;
    if (lesson.phase === 'explore') {
      actionArea = `<div class="lx-prompt"><div><strong>Start with a target</strong><p>We will use the lower middle index when the range has an even number of values.</p></div><button class="btn primary" id="lxStart">Start exploring <span aria-hidden="true">→</span></button></div>`;
    } else if (finished) {
      actionArea = `<div class="lx-reflection"><h3>Check your understanding</h3><p>Why must the values be sorted before using binary search?</p><div class="lx-quiz-options">${[['sorted', 'A comparison tells us which half can be ruled out.'], ['middle', 'The target always starts in the middle.'], ['unique', 'It makes every value unique.']].map(([id, label]) => `<button class="btn${lesson.quiz === id ? ' selected' : ''}" data-lx-quiz="${id}" aria-pressed="${lesson.quiz === id}">${label}</button>`).join('')}</div><p id="lxQuizFeedback">${lesson.quiz ? lesson.quiz === 'sorted' ? 'Correct. The order is what lets us safely discard a whole half.' : 'Try again. Sorting preserves the order; it does not move the target to the middle or remove duplicates.' : ''}</p><button class="btn primary" id="lxAgain">Try another target <span aria-hidden="true">↻</span></button></div>`;
    } else {
      actionArea = `<div class="lx-choice-prompt"><strong>Where should the search go?</strong><span>Compare the values, then choose.</span></div><div class="lx-choices"><button class="btn lx-left" id="lxLeft" data-lx-choice="left" ${lesson.pending ? 'disabled' : ''}><span aria-hidden="true">←</span> Search left half</button><button class="btn lx-found" id="lxFound" data-lx-choice="found" ${lesson.pending ? 'disabled' : ''}>Found the target</button><button class="btn lx-right" id="lxRight" data-lx-choice="right" ${lesson.pending ? 'disabled' : ''}>Search right half <span aria-hidden="true">→</span></button></div><div class="lx-feedback ${lesson.incorrect ? 'incorrect' : lesson.pending ? 'correct' : ''}"><p id="lxFeedback">${lesson.feedback || 'Your choice will be checked before the search range changes.'}</p>${lesson.pending ? '<button class="btn primary" id="lxNext">Continue <span aria-hidden="true">→</span></button>' : ''}</div>`;
    }
    host.innerHTML = `<section class="lx-workspace" aria-labelledby="lxHeading"><div class="lx-heading"><div><div class="eyebrow">GUIDED INTERACTIVE LESSON</div><h2 id="lxHeading" tabindex="-1">Binary Search</h2><p>Find a value by ruling out half of a sorted range.</p></div><button class="btn sm" id="lxClose">Exit lesson</button></div>${stageMarkup()}<div class="lx-layout"><div class="lx-main"><div class="lx-explanation"><span class="lx-step-label">${finished ? 'SEARCH COMPLETE' : lesson.phase === 'explore' ? 'THE BIG IDEA' : `COMPARISON ${lesson.comparisons + 1}`}</span><h3 id="lxStepHeading" tabindex="-1">${title}</h3><p>${description}</p></div><ol class="lx-array" aria-label="Sorted list, with zero-based indices">${cells}</ol><div class="lx-range-key" aria-hidden="true"><span class="left">● Left half</span><span class="middle">● Middle</span><span class="right">● Right half</span></div><div class="lx-target-row"><label for="lxTarget">Target value<select id="lxTarget" class="filter">${targets.map(target => `<option value="${target}" ${target === lesson.target ? 'selected' : ''}>${target}${target === 72 ? ' (not in the list)' : ''}</option>`).join('')}</select></label><span class="lx-comparisons"><b>${lesson.comparisons}</b> comparisons so far</span><button class="btn sm" id="lxReset">Reset</button></div>${actionArea}</div><aside class="lx-guide" aria-label="Lesson guidance"><div class="lx-guide-header"><span class="lx-guide-icon" aria-hidden="true">✦</span><div><h3>Guided hints</h3><span>Built into this lesson</span></div></div><p>Take a moment to compare the target with the highlighted middle value.</p><button class="btn" id="lxHint" aria-expanded="${lesson.hint}" aria-controls="lxHintText">${lesson.hint ? 'Hide the hint' : 'Give me a small hint'}</button><p class="lx-hint" id="lxHintText" ${lesson.hint ? '' : 'hidden'}>${finished ? 'A search ends when a value matches the target or the remaining range becomes empty.' : `${lesson.target} ${lesson.target === value ? 'equals' : lesson.target < value ? 'is less than' : 'is greater than'} ${value}. ${lesson.target === value ? 'The middle value is the target.' : `In sorted order, any match must be to the ${lesson.target < value ? 'left' : 'right'} of the middle.`}`}</p><div class="lx-concept"><h3>The search rule</h3><ol><li><span>1</span>Compare the target with the middle value.</li><li><span>2</span>If smaller, keep the left half.</li><li><span>3</span>If larger, keep the right half.</li><li><span>4</span>If equal, stop. If the range is empty, there is no match.</li></ol></div><p class="lx-local-note">A local practice lab. This exercise does not change your saved scores.</p></aside></div></section>`;
  }
  function choose(direction) {
    if (lesson.phase !== 'try' || lesson.pending) return;
    const value = values[midpoint()], correct = lesson.target === value ? 'found' : lesson.target < value ? 'left' : 'right';
    if (direction !== correct) {
      lesson.incorrect = true;
      lesson.feedback = `Not quite. Compare the target ${lesson.target} with the middle value ${value}, then choose again.`;
      render(); focus(direction === 'left' ? 'lxLeft' : direction === 'right' ? 'lxRight' : 'lxFound'); announce(lesson.feedback); return;
    }
    lesson.pending = direction;
    lesson.incorrect = false;
    lesson.feedback = direction === 'found' ? `Correct. ${lesson.target} equals the middle value. The target is found.` : `Correct. ${lesson.target} is ${direction === 'left' ? 'less' : 'greater'} than ${value}. Keep the ${direction} half and rule out the middle too.`;
    render(); focus('lxNext'); announce(lesson.feedback);
  }
  function advance() {
    if (!lesson.pending) return;
    const mid = midpoint(), action = lesson.pending;
    lesson.comparisons++;
    if (action === 'found') { lesson.found = true; lesson.phase = 'reflect'; }
    else if (action === 'left') lesson.high = mid - 1;
    else lesson.low = mid + 1;
    if (lesson.low > lesson.high) lesson.phase = 'reflect';
    lesson.pending = null; lesson.hint = false; lesson.feedback = ''; lesson.incorrect = false;
    render(); focus('lxStepHeading');
  }
  host.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'lxOpen') open();
    else if (button.id === 'lxClose') close();
    else if (button.id === 'lxStart') { lesson.phase = 'try'; render(); focus('lxLeft'); }
    else if (button.id === 'lxReset') reset();
    else if (button.id === 'lxAgain') { reset(); focus('lxTarget'); }
    else if (button.id === 'lxNext') advance();
    else if (button.id === 'lxHint') { lesson.hint = !lesson.hint; render(); focus('lxHint'); }
    else if (button.dataset.lxChoice) choose(button.dataset.lxChoice);
    else if (button.dataset.lxQuiz) { lesson.quiz = button.dataset.lxQuiz; render(); host.querySelector(`[data-lx-quiz="${lesson.quiz}"]`)?.focus({ preventScroll: true }); announce(document.getElementById('lxQuizFeedback').textContent); }
  });
  host.addEventListener('change', event => {
    if (event.target.id !== 'lxTarget') return;
    const target = Number(event.target.value);
    if (!targets.includes(target)) return;
    reset(target); focus('lxTarget');
  });
  window.LearningExperienceUI = { open, reset };
  render();
})();
