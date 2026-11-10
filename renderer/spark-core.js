'use strict';
(function(root) {
  // Original, offline activities. Completion records practice, not a skill score.
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  function freeze(value) {
    Object.values(value).forEach(item => { if (item && typeof item === 'object') freeze(item); });
    return Object.freeze(value);
  }
  const lessons = freeze([
    {
      id: 'balance', title: 'Balance Builder', subtitle: 'Make both sides equal. Discover what x can be.',
      minutes: 4, color: 'teal', character: 'bolt',
      steps: [
        {
          id: 'equal-sides', kind: 'balance', title: 'Give every crate the same value',
          prompt: 'Two identical crates and 3 loose units must balance 11 units. Change the value of x inside each crate until both sides match.',
          coefficient: 2, constant: 3, target: 11, min: 0, max: 12, initialAnswer: 1,
          hint: 'Set the 3 loose units aside on both sides. How many of the remaining 8 units belong in each of the 2 crates?',
          explanation: 'Removing 3 from both sides leaves 2x = 8. Splitting 8 equally between the 2 crates gives x = 4. The check is 2 × 4 + 3 = 11.',
          code: 'x = 4\nleft = 2 * x + 3\nprint(left == 11)  # True'
        },
        {
          id: 'three-crates', kind: 'balance', title: 'One more crate, the same rule',
          prompt: 'Three identical crates and 2 loose units balance 17 units. Find the value inside each crate.',
          coefficient: 3, constant: 2, target: 17, min: 0, max: 12, initialAnswer: 1,
          hint: 'Remove 2 from 17, then share what remains equally between 3 crates.',
          explanation: 'Subtracting 2 leaves 3x = 15. Dividing both sides by 3 gives x = 5. Each crate has the same value, so 3 × 5 + 2 = 17.',
          code: 'x = (17 - 2) // 3\nprint(x)  # 5'
        },
        {
          id: 'balance-transfer', kind: 'balance', title: 'Build the rule yourself',
          prompt: 'Two identical crates and 5 loose units balance 19 units. Use the same two moves: remove the loose units, then share equally.',
          coefficient: 2, constant: 5, target: 19, min: 0, max: 12, initialAnswer: 1,
          hint: 'First calculate 19 − 5. Then divide the result by the number of crates.',
          explanation: 'There are 14 units inside the 2 crates, so x = 7. For a × x + b = target with a nonzero, undo the addition first, then divide: x = (target − b) / a.',
          code: 'a, b, target = 2, 5, 19\nx = (target - b) / a\nprint(x)  # 7.0'
        }
      ]
    },
    {
      id: 'patterns', title: 'Pattern Garden', subtitle: 'Grow a staircase, then turn its pattern into a loop.',
      minutes: 4, color: 'gold', character: 'bloom',
      steps: [
        {
          id: 'three-rows', kind: 'patterns', title: 'Count a growing staircase',
          prompt: 'The garden has 3 rows. Row 1 needs 1 tile, row 2 needs 2, and row 3 needs 3. Choose enough tiles to fill every spot.',
          rows: 3, min: 0, max: 21, initialAnswer: 0,
          hint: 'Add the row lengths: 1 + 2 + 3. Each new row is one tile longer.',
          explanation: 'The garden needs 1 + 2 + 3 = 6 tiles. Counting each row once avoids gaps and double-counting.',
          code: 'total = 0\nfor row in range(1, 4):\n    total += row\nprint(total)  # 6'
        },
        {
          id: 'four-rows', kind: 'patterns', title: 'Grow one row further',
          prompt: 'The garden now has 4 rows. Start with the 6 tiles from the first garden and work out how many tiles the new row adds.',
          rows: 4, min: 0, max: 21, initialAnswer: 0,
          hint: 'The first 3 rows used 6 tiles. Row 4 adds 4 more.',
          explanation: 'A fourth row adds 4 tiles: 6 + 4 = 10. The totals do not grow by a fixed amount; the amount added grows by one each time.',
          code: 'total = 6\ntotal += 4\nprint(total)  # 10'
        },
        {
          id: 'five-rows', kind: 'patterns', title: 'Make a prediction',
          prompt: 'Grow the garden to 5 rows. How many tiles fill the whole staircase? Use the previous total or add the row lengths.',
          rows: 5, min: 0, max: 21, initialAnswer: 0,
          hint: 'Four rows need 10 tiles. The fifth row adds 5. A loop can add each row length in order.',
          explanation: 'The total is 10 + 5 = 15. In Python, range(1, rows + 1) includes every row from 1 through rows. Adding those lengths builds the same staircase.',
          code: 'rows = 5\ntotal = 0\nfor row in range(1, rows + 1):\n    total += row\nprint(total)  # 15'
        }
      ]
    },
    {
      id: 'logic', title: 'Logic Lights', subtitle: 'Flip the switches. Think like a program.',
      minutes: 4, color: 'violet', character: 'orbit',
      steps: [
        {
          id: 'both-on', kind: 'logic', title: 'AND needs both',
          prompt: 'Light the lamp. This AND gate passes power only when switch A and switch B are both on.',
          gate: 'AND', target: true, initialAnswer: { a: false, b: false },
          hint: 'Try one switch first. Does the lamp light? AND requires both inputs to be true.',
          explanation: 'With A on and B on, A AND B is true. If either input is off, an AND gate is false. Programs use this when two conditions must both hold.',
          code: 'a, b = True, True\nlamp = a and b\nprint(lamp)  # True'
        },
        {
          id: 'both-off', kind: 'logic', title: 'OR needs at least one',
          prompt: 'Turn the lamp off. This OR gate passes power when at least one switch is on. Find the only setting that turns it off.',
          gate: 'OR', target: false, initialAnswer: { a: true, b: false },
          hint: 'With OR, either switch can keep the lamp on. What must be true of both switches to turn it off?',
          explanation: 'Both switches must be off: false OR false is false. Any other setting has at least one true input and lights the lamp.',
          code: 'a, b = False, False\nlamp = a or b\nprint(lamp)  # False'
        },
        {
          id: 'one-on', kind: 'logic', title: 'XOR needs exactly one',
          prompt: 'Light the lamp with an XOR gate. It passes power when exactly one switch is on. Either switch can be the one you choose.',
          gate: 'XOR', target: true, initialAnswer: { a: false, b: false },
          hint: 'Compare the two inputs. XOR is true when they are different and false when they match.',
          explanation: 'One switch on and one off makes XOR true. Both on is false, unlike OR. For Boolean inputs in Python, a != b checks this difference.',
          code: 'a, b = True, False\nlamp = a != b\nprint(lamp)  # True'
        }
      ]
    }
  ]);
  const findLesson = id => lessons.find(lesson => lesson.id === id);
  function getStep(id, index) {
    const lesson = findLesson(id);
    return lesson && integer(index, 0, lesson.steps.length - 1) ? lesson.steps[index] : null;
  }
  function defaultAnswer(id, index) {
    const answer = getStep(id, index)?.initialAnswer;
    return record(answer) ? { ...answer } : answer ?? null;
  }
  function validAnswer(step, answer) {
    return step.kind === 'logic'
      ? record(answer) && typeof answer.a === 'boolean' && typeof answer.b === 'boolean'
      : integer(answer, step.min, step.max);
  }
  function logicOutput(gate, answer) {
    if (!record(answer) || typeof answer.a !== 'boolean' || typeof answer.b !== 'boolean') return null;
    if (gate === 'AND') return answer.a && answer.b;
    if (gate === 'OR') return answer.a || answer.b;
    if (gate === 'XOR') return answer.a !== answer.b;
    return null;
  }
  function evaluate(id, index, answer) {
    const step = getStep(id, index);
    if (!step || !validAnswer(step, answer)) return { correct: false, feedback: 'Choose a valid setting before checking.' };
    let correct, feedback;
    if (step.kind === 'balance') {
      const total = step.coefficient * answer + step.constant;
      correct = total === step.target;
      feedback = `The crates and loose units total ${total}, which is ${total < step.target ? 'less' : 'more'} than ${step.target}. ${total < step.target ? 'Increase' : 'Decrease'} x and watch both sides.`;
    } else if (step.kind === 'patterns') {
      const total = step.rows * (step.rows + 1) / 2;
      correct = answer === total;
      feedback = answer < total
        ? `${answer} tiles leave some spots empty. Add the lengths of all ${step.rows} rows.`
        : `${answer} tiles leave extras outside the garden. Count each row once.`;
    } else {
      const output = logicOutput(step.gate, answer);
      correct = output === step.target;
      feedback = `The lamp is ${output ? 'on' : 'off'}; the goal is ${step.target ? 'on' : 'off'}. ${step.gate === 'AND' ? 'AND needs both switches on.' : step.gate === 'OR' ? 'OR stays on if either switch is on.' : 'XOR turns on only when the two switches differ.'}`;
    }
    return { correct, feedback: correct ? step.explanation : feedback };
  }
  function freshLesson(id) {
    return { step: 0, answer: defaultAnswer(id, 0), solved: false, completed: false };
  }
  function normalizeState(value) {
    const input = record(value) ? value : {};
    const progress = record(input.lessons) ? input.lessons : {};
    const result = { activeLesson: findLesson(input.activeLesson)?.id || null, lessons: {} };
    for (const lesson of lessons) {
      const raw = Object.prototype.hasOwnProperty.call(progress, lesson.id) ? progress[lesson.id] : null;
      if (!record(raw) || !integer(raw.step, 0, lesson.steps.length - 1)) {
        result.lessons[lesson.id] = freshLesson(lesson.id);
        continue;
      }
      const step = lesson.steps[raw.step];
      const valid = validAnswer(step, raw.answer);
      const answer = valid ? (step.kind === 'logic' ? { a: raw.answer.a, b: raw.answer.b } : raw.answer) : defaultAnswer(lesson.id, raw.step);
      const solved = valid && raw.solved === true && evaluate(lesson.id, raw.step, answer).correct;
      result.lessons[lesson.id] = {
        step: raw.step, answer, solved,
        completed: raw.completed === true && raw.step === lesson.steps.length - 1 && solved
      };
    }
    return result;
  }
  function commitAnswer(value, id, index, answer) {
    const state = normalizeState(value), step = getStep(id, index), current = state.lessons[id];
    if (!step || !current || current.step !== index || current.solved || current.completed || !validAnswer(step, answer)) return state;
    current.answer = step.kind === 'logic' ? { a: answer.a, b: answer.b } : answer;
    current.solved = evaluate(id, index, answer).correct;
    return state;
  }
  function advance(value, id) {
    const state = normalizeState(value), lesson = findLesson(id), current = state.lessons[id];
    if (!lesson || !current || !current.solved || current.completed) return state;
    if (current.step === lesson.steps.length - 1) current.completed = true;
    else state.lessons[id] = { step: current.step + 1, answer: defaultAnswer(id, current.step + 1), solved: false, completed: false };
    return state;
  }
  function restartLesson(value, id) {
    const state = normalizeState(value);
    if (findLesson(id)) state.lessons[id] = freshLesson(id);
    return state;
  }
  const api = { lessons, defaultAnswer, logicOutput, evaluate, normalizeState, commitAnswer, advance, restartLesson };
  root.ForgeSpark = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
