const test = require('node:test');
const assert = require('node:assert');
const rules = require('../database.rules.plan.json').rules;

const ADMIN = { uid: 'A', token: { email: 'samir.akhundoff@gmail.com', email_verified: true } };
const USER = { uid: 'U1', token: { email: 'u1@gmail.com', email_verified: true } };
const OTHER = { uid: 'U2', token: { email: 'u2@gmail.com', email_verified: true } };
const FAKE_ADMIN = { uid: 'F', token: { email: 'samir.akhundoff@gmail.com', email_verified: false } };

function node(v) { return { child: (k) => node(v && v[k] !== undefined ? v[k] : null), val: () => v === undefined ? null : v }; }
function ev(expr, ctx) {
  const f = new Function('auth', 'now', 'root', '$uid', 'newData', 'return (' + expr.replace(/===/g, '===') + ');');
  return !!f(ctx.auth, ctx.now, node(ctx.db), ctx.uid, ctx.newData);
}
const now = 1000;
const db = { plan_licenses: { U1: { expiresAt: 5000 }, EXP: { expiresAt: 500 } } };
const c = (auth, extra) => Object.assign({ auth, now, db, uid: auth && auth.uid }, extra || {});

test('plan_bank: yalnız aktiv lisenziyalı və ya admin oxuyur', () => {
  const r = rules.plan_bank['.read'];
  assert.ok(ev(r, c(USER)));
  assert.ok(ev(r, c(ADMIN)));
  assert.ok(!ev(r, c(OTHER)));
  assert.ok(!ev(r, c({ uid: 'EXP', token: { email: 'x@x.com', email_verified: true } })));
  assert.ok(!ev(r, c(null)));
  assert.ok(!ev(r, c(FAKE_ADMIN)));
});

test('plan_bank: yalnız admin yazır', () => {
  const w = rules.plan_bank['.write'];
  assert.ok(ev(w, c(ADMIN)));
  assert.ok(!ev(w, c(USER)));
  assert.ok(!ev(w, c(FAKE_ADMIN)));
  assert.ok(!ev(w, c(null)));
});

test('plan_licenses: istifadəçi yalnız öz sənədini oxuyur, yazmaq yalnız admindədir', () => {
  const rd = rules.plan_licenses.$uid['.read'];
  assert.ok(ev(rd, c(USER, { uid: 'U1' })));
  assert.ok(!ev(rd, c(OTHER, { uid: 'U1' })));
  assert.ok(!rules.plan_licenses.$uid['.write']);
  assert.ok(ev(rules.plan_licenses['.write'], c(ADMIN)));
  assert.ok(!ev(rules.plan_licenses['.write'], c(USER)));
});

test('plan_requests: istifadəçi yalnız öz uid-i altında və öz e-poçtu ilə yazır', () => {
  const w = rules.plan_requests.$uid['.write'], v = rules.plan_requests.$uid['.validate'];
  assert.ok(ev(w, c(USER, { uid: 'U1' })));
  assert.ok(!ev(w, c(USER, { uid: 'U2' })));
  assert.ok(ev(w, c(ADMIN, { uid: 'U1' })));
  const good = { hasChildren: () => true, child: (k) => ({ val: () => ({ email: 'u1@gmail.com', name: 'Ad', ts: 1 })[k], isString: () => true, isNumber: () => true }) };
  const bad = { hasChildren: () => true, child: (k) => ({ val: () => ({ email: 'boshqa@gmail.com', name: 'Ad', ts: 1 })[k], isString: () => true, isNumber: () => true }) };
  assert.ok(ev(v, c(USER, { uid: 'U1', newData: good })));
  assert.ok(!ev(v, c(USER, { uid: 'U1', newData: bad })));
});

test('qaydalar fraqmenti mövcud qaydaları ələ keçirmir: yalnız plan_* açarları', () => {
  assert.deepStrictEqual(Object.keys(rules).sort(), ['plan_bank', 'plan_licenses', 'plan_requests']);
});
