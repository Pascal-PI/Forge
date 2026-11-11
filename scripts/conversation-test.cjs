'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createCoach } = require('../coach.cjs');

(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-conversation-test-'));
  const keyFile = path.join(dir, 'key.txt');
  const fakeKey = 'sk-' + 'test'.repeat(8);
  await fs.writeFile(keyFile, fakeKey);
  const original = process.env.FORGE_AI_KEY_FILE;
  process.env.FORGE_AI_KEY_FILE = keyFile;
  let requestBody;
  let responseText = JSON.stringify({ reply: 'Try the search.', activity: 'binary-search' });
  let interrupted = false;
  const coach = createCoach({
    app: { getPath: () => dir }, dialog: {}, getWindow: () => null,
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      const events = [];
      for (let i = 0; i < responseText.length; i += 7) events.push({type:'response.output_text.delta',delta:responseText.slice(i,i+7)});
      if (!interrupted) events.push({type:'response.completed',response:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:responseText}]}]}});
      const bytes = new TextEncoder().encode(events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join(''));
      return { ok: true, body: new ReadableStream({start(controller) { for(let i=0;i<bytes.length;i+=11)controller.enqueue(bytes.slice(i,i+11));controller.close(); }}) };
    }
  });
  try {
    const result = await coach.conversation({ minutes: 25, goal: 'Learn search', schoolTopics: [{subject:'Mathematics',topic:'Geometry',answered:4,correct:2},{subject:'Math',topic:'Invalid',answered:1,correct:2}], messages: [{ role: 'user', text: 'Help me' }] });
    assert.deepEqual(result, { reply: 'Try the search.', activity: 'binary-search' });
    assert.equal(requestBody.text.format.schema.additionalProperties, false);
    assert.equal(requestBody.stream, true);
    assert.equal(requestBody.input[0].content[0].text, JSON.stringify({ learnerGoal: 'Learn search', schoolTopics:[{subject:'Mathematics',topic:'Geometry',answered:4,correct:2}] }));
    assert(!requestBody.instructions.includes('Learn search'));
    responseText = JSON.stringify({ reply: 'Place the point.', activity: 'number-line' });
    assert.equal((await coach.conversation({ minutes: 25, messages: [{ role: 'user', text: 'Integers' }] })).activity, 'number-line');
    responseText = JSON.stringify({ reply: 'Try sorting.', activity: 'sorting' });
    assert.equal((await coach.conversation({ minutes: 25, messages: [{ role: 'user', text: 'Sorting' }] })).activity, 'sorting');
    responseText = JSON.stringify({ reply: 'Try coding.', activity: 'coding' });
    assert.equal((await coach.conversation({ minutes: 25, messages: [{ role: 'user', text: 'Coding' }] })).activity, 'coding');
    responseText = JSON.stringify({ reply: 'Balance the equation.', activity: 'equation-balance' });
    assert.equal((await coach.conversation({ minutes: 25, messages: [{ role: 'user', text: 'Algebra' }] })).activity, 'equation-balance');
    const progress = [];
    responseText = JSON.stringify({reply:'A'.repeat(50)+fakeKey+' end with a quote " and newline\n'+ 'B'.repeat(50),activity:'none'});
    const redacted = await coach.conversation({minutes:25,messages:[{role:'user',text:'Hi'}]}, text=>progress.push(text));
    assert(progress.length > 1);
    assert(progress.every(text => !text.includes(fakeKey) && !text.includes('sk-test')));
    assert(!redacted.reply.includes(fakeKey));
    assert(redacted.reply.includes('[redacted]'));
    responseText = JSON.stringify({reply:'A'.repeat(50)+fakeKey+'B'.repeat(50),activity:'none'}).replace(fakeKey, 'sk-\\u0074' + 'est' + 'test'.repeat(7));
    const encodedKeyResult = await coach.conversation({minutes:25,messages:[{role:'user',text:'Hi'}]}, text=>progress.push(text));
    assert(!encodedKeyResult.reply.includes(fakeKey));
    assert(encodedKeyResult.reply.includes('[redacted]'));
    assert(progress.every(text => !text.includes(fakeKey) && !text.includes('sk-test')));
    interrupted = true;
    await assert.rejects(coach.conversation({minutes:25,messages:[{role:'user',text:'Hi'}]}), /interrupted/);
    interrupted = false;
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
