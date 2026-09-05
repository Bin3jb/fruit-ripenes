/**
 * Backend unit tests that need neither MySQL nor an OpenAI key.
 *   npm test
 */
const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_secret';
delete process.env.OPENAI_API_KEY;

const { sign, requireAuth, requireAdmin } = require('../src/middleware/auth');
const llm = require('../src/services/llm');
const ml = require('../src/services/mlClient');

function res() {
  return {
    code: null, body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test('sign() embeds id, email and role', () => {
  const token = sign({ id: 7, email: 'a@b.c', role: 'admin' });
  const claims = jwt.verify(token, 'test_secret');
  assert.strictEqual(claims.id, 7);
  assert.strictEqual(claims.role, 'admin');
});

test('requireAuth rejects a missing token', () => {
  const r = res();
  requireAuth({ headers: {} }, r, () => assert.fail('should not continue'));
  assert.strictEqual(r.code, 401);
});

test('requireAuth rejects a forged token', () => {
  const bad = jwt.sign({ id: 1 }, 'not_the_secret');
  const r = res();
  requireAuth({ headers: { authorization: `Bearer ${bad}` } }, r, () => assert.fail());
  assert.strictEqual(r.code, 401);
});

test('requireAuth accepts a valid token and attaches the user', () => {
  const req = { headers: { authorization: `Bearer ${sign({ id: 3, email: 'x@y.z', role: 'user' })}` } };
  let called = false;
  requireAuth(req, res(), () => { called = true; });
  assert.ok(called);
  assert.strictEqual(req.user.id, 3);
});

test('requireAdmin blocks ordinary users', () => {
  const r = res();
  requireAdmin({ user: { role: 'user' } }, r, () => assert.fail());
  assert.strictEqual(r.code, 403);
});

test('the assistant degrades to the knowledge base with no API key', async () => {
  const { answer, source } = await llm.ask({
    question: 'how long?',
    lang: 'en',
    detections: [{
      fruit: 'banana', stage: 'overripe',
      fruit_label: 'Banana', stage_label: 'Overripe',
      advice: 'Best for banana bread.',
      days_room_temperature: 1, days_refrigerated: 2,
    }],
  });
  assert.strictEqual(source, 'knowledge-base');
  assert.match(answer, /Banana — Overripe/);
  assert.match(answer, /1 day\(s\) at room temperature/);
});

test('the fallback answer never prints "undefined"', () => {
  const answer = llm.fallbackAnswer([{ fruit: 'pear', stage: 'ripe' }], 'en');
  assert.ok(!answer.includes('undefined'), answer);
  assert.match(answer, /pear/);
});

test('an empty detection list asks for a better photo', () => {
  assert.match(llm.fallbackAnswer([], 'en'), /No fruit was detected/);
  assert.match(llm.fallbackAnswer([], 'ar'), /لم يتم اكتشاف/);
});

test('label() falls back to a readable key when the ML service is down', () => {
  assert.strictEqual(ml.label({}, 'green_apple', 'en'), 'green apple');
  assert.strictEqual(ml.label({ green_apple: { en: 'Green Apple' } }, 'green_apple', 'en'), 'Green Apple');
});
