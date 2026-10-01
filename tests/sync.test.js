const test = require('node:test');
const assert = require('node:assert');
const Storage = require('../js/storage.js');
const Sync = require('../js/sync.js');
const rules = require('../database.rules.plan.json').rules;

function cloud() {
  const data = {};
  return {
    data,
    fetchAll: (uid) => Promise.resolve(JSON.parse(JSON.stringify(data[uid] || {}))),
    put: (uid, rk, node) => { (data[uid] = data[uid] || {})[rk] = JSON.parse(JSON.stringify(node)); return Promise.resolve(); }
  };
}
const device = (remote) => { const st = Storage.create(Storage.memoryStore()); return { st, sync: Sync.create(st, remote, Storage.validate) }; };
const form = (ad) => ({ ad, soyad: 'S', dogum: '2019-01-01', diaqnoz: 'DEHB' });
const cyc = (n) => ({ n, plan: { start: '2026-10-01', end: '2026-10-30', sessions: [], home: [], tests: [] }, log: {}, results: {}, notes: [] });
const tick = () => new Promise(r => setTimeout(r, 3));

test('sync: bir cihazda yaradılan uşaq ikinci cihazda görünür, başqa hesab görmür', async () => {
  const c = cloud(), A = device(c), B = device(c), X = device(c);
  const r = A.st.putCycle(form('Ali'), cyc(1), 'u1');
  await A.sync.push('u1', r.key);
  const res = await B.sync.fullSync('u1');
  assert.strictEqual(res.pulled, 1);
  assert.deepStrictEqual(B.st.listChildren('u1').map(x => x.name), ['Ali S']);
  await X.sync.fullSync('u2');
  assert.strictEqual(X.st.listChildren('u2').length, 0);
  assert.strictEqual(X.st.listChildren('u1').length, 0);
});

test('sync: boş massiv və obyektlər itmir (JSON mətni kimi saxlanılır)', async () => {
  const c = cloud(), A = device(c), B = device(c);
  const r = A.st.putCycle(form('Ali'), cyc(1), 'u1');
  await A.sync.push('u1', r.key);
  await B.sync.fullSync('u1');
  const cy = B.st.getChild(r.key, 'u1').cycles[0];
  assert.deepStrictEqual(cy.plan.sessions, []);
  assert.deepStrictEqual(cy.log, {});
});

test('sync: eyni dövrdə yeni dəyişiklik qalib gəlir, fərqli dövrlər birləşir', async () => {
  const c = cloud(), A = device(c), B = device(c);
  const r = A.st.putCycle(form('Ali'), cyc(1), 'u1');
  await A.sync.push('u1', r.key);
  await B.sync.fullSync('u1');
  await tick();
  B.st.updateCycle(r.key, 1, (cy) => { cy.notes = ['B qeydi']; });
  B.st.putCycle(form('Ali'), cyc(2), 'u1');
  await B.sync.push('u1', r.key);
  await A.sync.fullSync('u1');
  const ch = A.st.getChild(r.key, 'u1');
  assert.strictEqual(ch.cycles.length, 2);
  assert.deepStrictEqual(ch.cycles[0].notes, ['B qeydi']);
});

test('sync: silinmə digər cihaza keçir və geri dirilmir', async () => {
  const c = cloud(), A = device(c), B = device(c);
  const r = A.st.putCycle(form('Ali'), cyc(1), 'u1');
  await A.sync.push('u1', r.key);
  await B.sync.fullSync('u1');
  await tick();
  A.st.removeChild(r.key, 'u1');
  await A.sync.push('u1', r.key);
  const res = await B.sync.fullSync('u1');
  assert.strictEqual(res.removed, 1);
  assert.strictEqual(B.st.listChildren('u1').length, 0);
  await A.sync.fullSync('u1');
  assert.strictEqual(A.st.listChildren('u1').length, 0);
});

test('sync: oflayn yaradılan qeyd ilk tam sinxronda buluda göndərilir', async () => {
  const c = cloud(), A = device(c);
  A.st.putCycle(form('Leyla'), cyc(1), 'u1');
  const res = await A.sync.fullSync('u1');
  assert.strictEqual(res.pushed, 1);
  assert.strictEqual(Object.keys(c.data.u1).length, 1);
});

test('sync: başqasının açarı və zədəli qeyd qəbul edilmir', async () => {
  const c = cloud(), A = device(c);
  c.data.u1 = {
    x1: { key: 'u2::a|s|2019-01-01', mt: 5, json: '{}', del: false },
    x2: { key: 'u1::b|s|2019-01-01', mt: 5, json: '{"form":{},"cycles":"yox"}', del: false },
    x3: { key: 'u1::c|s|2019-01-01', mt: 5, json: 'bu json deyil', del: false }
  };
  const res = await A.sync.fullSync('u1');
  assert.strictEqual(res.pulled, 0);
  assert.strictEqual(A.st.listChildren('u1').length, 0);
});

function rnode(v) { return { child: (k) => rnode(v && v[k] !== undefined ? v[k] : null), val: () => v === undefined ? null : v,
  hasChildren: (ks) => !!v && ks.every(k => v[k] !== undefined), isString: () => typeof v === 'string', isNumber: () => typeof v === 'number' }; }
function rev(expr, auth, uid, db, nd) { return !!new Function('auth', 'now', 'root', '$uid', 'newData', 'return (' + expr + ');')(auth, 1000, rnode(db), uid, rnode(nd)); }

test('qaydalar: plan_children yalnız sahibi oxuyur, yalnız aktiv lisenziya ilə yazır', () => {
  const rc = rules.plan_children.$uid;
  const db = { plan_licenses: { U1: { expiresAt: 5000 }, EXP: { expiresAt: 500 } } };
  const u = (id) => ({ uid: id, token: {} });
  assert.ok(rev(rc['.read'], u('U1'), 'U1', db));
  assert.ok(!rev(rc['.read'], u('U2'), 'U1', db));
  assert.ok(!rev(rc['.read'], null, 'U1', db));
  const w = rc.$ck['.write'];
  assert.ok(rev(w, u('U1'), 'U1', db));
  assert.ok(!rev(w, u('U2'), 'U1', db));
  assert.ok(!rev(w, u('EXP'), 'EXP', db));
  assert.ok(!rev(w, null, 'U1', db));
  const v = rc.$ck['.validate'];
  assert.ok(rev(v, u('U1'), 'U1', db, { json: '{}', mt: 5 }));
  assert.ok(!rev(v, u('U1'), 'U1', db, { json: 5, mt: 5 }));
  assert.ok(!rev(v, u('U1'), 'U1', db, { json: 'x'.repeat(3000001), mt: 5 }));
  assert.ok(!rev(v, u('U1'), 'U1', db, { json: '{}' }));
  assert.ok(!rules.plan_children['.read'] && !rules.plan_children['.write'], 'kök səviyyədə açıq giriş yoxdur');
});
