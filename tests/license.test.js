const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }
const root = path.join(__dirname, '..');
const demo = JSON.parse(fs.readFileSync(path.join(root, 'data/demo-bank.json'), 'utf8'));
const full = { version: 2, needs: demo.needs, act: Object.assign({}, demo.act, { extra: demo.act['ps-goz-ad'] }) };

function boot(opts) {
  const dom = new JSDOM('<!doctype html><body><div id="licenseBar"></div></body>', { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window;
  w.fetch = () => Promise.resolve({ json: () => Promise.resolve(demo) });
  const calls = { bankReads: 0 };
  let authCb = null;
  const db = {
    ref: (p) => ({
      once: () => {
        if (opts.offline) return Promise.reject(new Error('network'));
        if (p.startsWith('plan_licenses/')) return Promise.resolve({ val: () => opts.license || null });
        if (p === 'plan_bank/data') { calls.bankReads++; return Promise.resolve({ val: () => JSON.stringify(full) }); }
        return Promise.resolve({ val: () => null });
      }
    })
  };
  w.firebase = { apps: [{}], initializeApp() {}, database: () => db,
    auth: Object.assign(() => ({ onAuthStateChanged: (cb) => { authCb = cb; cb(opts.user || null); }, signOut: () => Promise.resolve() }), { GoogleAuthProvider: function () { this.setCustomParameters = () => {}; } }) };
  w.eval(fs.readFileSync(path.join(root, 'js/license.js'), 'utf8'));
  return { w, calls, signIn: (u) => authCb(u) };
}
const U = { uid: 'U1', email: 'u1@gmail.com', displayName: 'U', isAnonymous: false };
const skip = !JSDOM && 'jsdom yoxdur';

test('giriş yoxdur: nümunə baza, tam baza oxunmur', { skip }, async () => {
  const t = boot({});
  const r = await t.w.PlanBank.get();
  assert.strictEqual(r.mode, 'demo');
  assert.strictEqual(Object.keys(r.bank.act).length, 10);
  assert.strictEqual(t.calls.bankReads, 0);
});

test('anonim istifadəçi (digər alətlərdən) lisenziya sayılmır', { skip }, async () => {
  const t = boot({ user: Object.assign({}, U, { isAnonymous: true }), license: { expiresAt: Date.now() + 1e9 } });
  const r = await t.w.PlanBank.get();
  assert.strictEqual(r.mode, 'demo'); assert.strictEqual(t.calls.bankReads, 0);
});

test('aktiv lisenziya: tam baza gəlir və kəsh yazılır', { skip }, async () => {
  const t = boot({ user: U, license: { expiresAt: Date.now() + 5 * 86400000, email: U.email } });
  const r = await t.w.PlanBank.get();
  assert.strictEqual(r.mode, 'full'); assert.ok(r.bank.act.extra);
  assert.ok(t.w.localStorage.getItem('plan_bank_cache_v2'));
  assert.ok(t.w.PlanBank.daysLeft() >= 4);
});

test('bitmiş lisenziya: nümunə rejimi, tam baza oxunmur, kəsh silinir', { skip }, async () => {
  const t = boot({ user: U, license: { expiresAt: Date.now() - 1000 } });
  t.w.localStorage.setItem('plan_bank_cache_v2', JSON.stringify({ uid: 'U1', expiresAt: Date.now() + 1e6, bank: full }));
  const r = await t.w.PlanBank.get();
  assert.strictEqual(r.mode, 'expired'); assert.strictEqual(t.calls.bankReads, 0);
  assert.strictEqual(t.w.localStorage.getItem('plan_bank_cache_v2'), null);
});

test('offline: müddəti bitməmiş kəsh istifadə olunur, bitmiş kəsh yox', { skip }, async () => {
  const ok = boot({ user: U, offline: true });
  ok.w.localStorage.setItem('plan_bank_cache_v2', JSON.stringify({ uid: 'U1', expiresAt: Date.now() + 1e6, bank: full }));
  const r1 = await ok.w.PlanBank.get();
  assert.strictEqual(r1.mode, 'full');
  const old = boot({ user: U, offline: true });
  old.w.localStorage.setItem('plan_bank_cache_v2', JSON.stringify({ uid: 'U1', expiresAt: Date.now() - 10, bank: full }));
  assert.strictEqual((await old.w.PlanBank.get()).mode, 'demo');
  const other = boot({ user: U, offline: true });
  other.w.localStorage.setItem('plan_bank_cache_v2', JSON.stringify({ uid: 'OTHER', expiresAt: Date.now() + 1e6, bank: full }));
  assert.strictEqual((await other.w.PlanBank.get()).mode, 'demo');
});
