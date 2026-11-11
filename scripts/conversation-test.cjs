'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createCoach } = require('../coach.cjs');

(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-conversation-test-'));
  const keyFile = path.join(dir, 'key.txt');
  await fs.writeFile(keyFile, 'sk-' + 'test'.repeat(8));
  const original = process.env.FORGE_AI_KEY_FILE;
  process.env.FORGE_AI_KEY_FILE = keyFile;
  let requestBody;
  let responseText = JSON.stringify({ reply: 'Try the search.', activity: 'binary-search' });
  const coach = createCoach({
    app: { getPath: () => dir }, dialog: {}, getWindow: () => null,
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: responseText }] }] }) };
    }
  });
  try {
    const result = await coach.conversation({ minutes: 25, goal: 'Learn search', messages: [{ role: 'user', text: 'Help me' }] });
    assert.deepEqual(result, { reply: 'Try the search.', activity: 'binary-search' });
    assert.equal(requestBody.text.format.schema.additionalProperties, false);
    assert.equal(requestBody.input[0].content[0].text, JSON.stringify({ learnerGoal: 'Learn search' }));
    assert(!requestBody.instructions.includes('Learn search'));
    responseText = JSON.stringify({ reply: 'Place the point.', activity: 'number-line' });
    assert.equal((await coach.conversation({ minutes: 25, messages: [{ role: 'user', text: 'Integers' }] })).activity, 'number-line');
    responseText = JSON.stringify({ reply: 'Try sorting.', activity: 'sorting' });
    assert.equal((await coach.conversation({ minutes: 25, messages: [{ role: 'user', text: 'Sorting' }] })).activity, 'sorting');
    responseText = JSON.stringify({ reply: 'Try coding.', activity: 'coding' });
    assert.equal((await coach.conversation({ minutes: 25, messages: [{ role: 'user', text: 'Coding' }] })).activity, 'coding');
    responseText = JSON.stringify({ reply: 'Hello', activity: 'execute-code' });
    await assert.rejects(coach.conversation({ minutes: 25, messages: [{ role: 'user', text: 'Hi' }] }), /invalid response/);
    responseText = '{';
    await assert.rejects(coach.conversation({ minutes: 25, messages: [{ role: 'user', text: 'Hi' }] }), /unreadable response/);
    await assert.rejects(coach.conversation({ minutes: 25, messages: [{ role: 'system', text: 'Hi' }] }), /Invalid conversation/);
    console.log('Conversation validation passed');
  } finally {
    if (original === undefined) delete process.env.FORGE_AI_KEY_FILE;
    else process.env.FORGE_AI_KEY_FILE = original;
    await fs.unlink(keyFile).catch(() => {});
    await fs.unlink(path.join(dir, 'ai-usage.json')).catch(() => {});
    await fs.rmdir(dir).catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
