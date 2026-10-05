const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }
const root = path.join(__dirname, '..');
const demo = JSON.parse(fs.readFileSync(path.join(root, 'data/demo-bank.json'), 'utf8'));
const skip = !JSDOM && 'jsdom yoxdur';
const U = { uid: 'U9', email: 'u9@gmail.com', displayName: 'Google Adı', isAnonymous: false };

function boot(license) {
  const dom = new JSDOM('<!doctype html><body><div id="licenseBar"></div></body>', { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window;
  w.fetch = () => Promise.resolve({ json: () => Promise.resolve(demo) });
  const writes = [];
  const db = { ref: (p) => ({
    once: () => Promise.resolve({ val: () => (p === 'plan_licenses/' + U.uid ? license : null) }),
    set: (v) => { writes.push({ path: p, value: v }); return Promise.resolve(); }
  }) };
  const auth = Object.assign(() => ({
    onAuthStateChanged: (cb) => cb(null),
    signInWithPopup: () => Promise.resolve({ user: U }),
    signOut: () => Promise.resolve()
  }), { GoogleAuthProvider: function () { this.setCustomParameters = () => {}; } });
  w.firebase = { apps: [{}], initializeApp() {}, database: () => db, auth };
  w.eval(fs.readFileSync(path.join(root, 'js/license.js'), 'utf8'));
  return { w, writes };
}

test('daxil ol və sorğu göndər: lisenziyası olmayan hesab üçün sorğu bazaya yazılır', { skip }, async () => {
  const t = boot(null);
  const r = await t.w.PlanBank.signInAndRequest({ name: 'Test İstifadəçi', work: 'Mərkəz', phone: '+994500000000' });
  assert.strictEqual(r.requested, true);
  assert.strictEqual(t.writes.length, 1);
  assert.strictEqual(t.writes[0].path, 'plan_requests/U9');
  assert.strictEqual(t.writes[0].value.email, U.email);
  assert.strictEqual(t.writes[0].value.name, 'Test İstifadəçi');
  assert.strictEqual(t.writes[0].value.phone, '+994500000000');
  assert.strictEqual(typeof t.writes[0].value.ts, 'number');
});

test('daxil ol və sorğu göndər: aktiv lisenziyası olan hesab üçün sorğu yazılmır', { skip }, async () => {
  const t = boot({ expiresAt: Date.now() + 86400000, email: U.email });
  const r = await t.w.PlanBank.signInAndRequest({ name: 'Test', phone: '1' });
  assert.strictEqual(r.requested, false);
  assert.strictEqual(t.writes.length, 0);
});

test('daxil ol və sorğu göndər: bitmiş lisenziyada yenilənmə sorğusu yazılır', { skip }, async () => {
  const t = boot({ expiresAt: Date.now() - 1000, email: U.email });
  const r = await t.w.PlanBank.signInAndRequest({ name: 'Test', phone: '1' });
  assert.strictEqual(r.requested, true);
  assert.strictEqual(t.writes.length, 1);
});

test('banner: giriş yoxdursa vahid forma və tək düymə görünür', { skip }, async () => {
  const dom = new JSDOM('<!doctype html><body><div id="licenseBar"></div><div id="userChip"></div></body>', { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window;
  w.fetch = () => Promise.resolve({ json: () => Promise.resolve(demo) });
  const calls = [];
  w.firebase = { apps: [{}], initializeApp() {}, database: () => ({ ref: () => ({ once: () => Promise.resolve({ val: () => null }) }) }),
    auth: Object.assign(() => ({ onAuthStateChanged: (cb) => cb(null), signOut: () => Promise.resolve() }), { GoogleAuthProvider: function () { this.setCustomParameters = () => {}; } }) };
  w.eval(fs.readFileSync(path.join(root, 'js/license.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'js/license-ui.js'), 'utf8'));
  w.PlanBank.signInAndRequest = (info) => { calls.push(info); return Promise.resolve({ requested: true }); };
  await w.PlanBank.get();
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const bar = w.document.getElementById('licenseBar');
  const inputs = bar.querySelectorAll('input.mini');
  assert.strictEqual(inputs.length, 3);
  const b = [].find.call(bar.querySelectorAll('button'), (x) => /daxil ol və sorğu göndər/.test(x.textContent));
  assert.ok(b, 'vahid düymə var');
  b.click();
  assert.strictEqual(calls.length, 0, 'ad və telefon boşdursa göndərilmir');
  assert.ok(/mütləqdir/.test(bar.textContent));
  const again = bar.querySelectorAll('input.mini');
  again[0].value = 'Test'; again[0].dispatchEvent(new w.Event('input'));
  again[2].value = '055'; again[2].dispatchEvent(new w.Event('input'));
  [].find.call(bar.querySelectorAll('button'), (x) => /daxil ol və sorğu göndər/.test(x.textContent)).click();
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].name, 'Test');
  assert.strictEqual(calls[0].phone, '055');
});
