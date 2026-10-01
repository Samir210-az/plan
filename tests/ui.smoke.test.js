const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }
const root = path.join(__dirname, '..');

function boot(mode) {
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html.replace(/<script[^>]*src="license-check\.js"[^>]*><\/script>/, '').replace(/<script>\s*\(function\(\)\{[\s\S]*?<\/script>/, '').replace(/<script src="js\/[^"]+"><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = (u) => Promise.resolve({ json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, u), 'utf8'))) });
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.confirm = () => true;
  w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
  const demoBank = JSON.parse(fs.readFileSync(path.join(root, 'data/demo-bank.json'), 'utf8'));
  w.PlanBank = { get: () => Promise.resolve({ bank: demoBank, mode: mode || 'full' }) };
  ['engine', 'storage', 'exports', 'app'].forEach(n => w.eval(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8')));
  return w;
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

test('UI: forma doldurulur, plan yaranır, qeyd və test nəticəsi saxlanılır', { skip: !JSDOM && 'jsdom yoxdur' }, async () => {
  const w = boot();
  const d = w.document;
  await wait(50);
  assert.ok(d.getElementById('f_seans'), 'seans seçimi var');
  assert.strictEqual(d.getElementById('f_muddet'), null, '90 günlük seçim silinib');
  d.getElementById('f_ad').value = 'Əli'; d.getElementById('f_soyad').value = 'Məmmədov';
  d.getElementById('f_dogum').value = '2021-03-01'; d.getElementById('f_diaqnoz').value = 'Autizm spektr pozuntusu';
  d.getElementById('f_baslama').value = '2026-10-05';
  d.getElementById('f_seans').value = '3';
  d.getElementById('f_seans').dispatchEvent(new w.Event('change'));
  assert.match(d.getElementById('seansInfo').textContent, /Həftədə 3 seans.*təxminən 1[2-4] seans/);
  d.querySelector('#behaviorChips .chip').click();
  d.getElementById('intakeForm').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(200);
  assert.strictEqual(d.getElementById('planSection').hidden, false);
  assert.match(d.getElementById('planTitleName').textContent, /Əli Məmmədov/);
  assert.ok(d.querySelectorAll('#weekNav .wk').length === 4);
  assert.ok(d.querySelectorAll('#daysContainer details.day').length >= 7);
  assert.ok(d.querySelectorAll('#daysContainer .act').length > 20);
  assert.ok(d.querySelectorAll('#testsBody tbody tr').length > 0, 'test cədvəli var');
  assert.ok(d.getElementById('goalsGrid').textContent.includes('Əli'));

  const radio = d.querySelector('#daysContainer .logrow input[data-f="att"][value="bəli"]');
  radio.checked = true; radio.dispatchEvent(new w.Event('change', { bubbles: true }));
  const sel = d.querySelector('#daysContainer .logrow select[data-f="r"]');
  sel.value = '4'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  await wait(50);
  const store = JSON.parse(w.localStorage.getItem('an_rehab_v2'));
  const cy = Object.values(store.children)[0].cycles[0];
  const ents = Object.values(cy.log);
  assert.strictEqual(ents.length, 1);
  assert.strictEqual(ents[0].r, '4'); assert.strictEqual(ents[0].att, 'bəli');

  const ti = d.querySelector('#testsBody input[data-f="score"]');
  ti.value = '12'; ti.dispatchEvent(new w.Event('change', { bubbles: true }));
  const cy2 = Object.values(JSON.parse(w.localStorage.getItem('an_rehab_v2')).children)[0].cycles[0];
  assert.ok(Object.values(cy2.results)[0] && Object.values(Object.values(cy2.results)[0])[0].score === '12');

  w.document.querySelector('[data-action="week"][data-w="3"]').click();
  await wait(50);
  assert.ok(d.querySelector('#weekNav .wk.on').textContent.includes('Həftə 3'));
  assert.ok(!/<script/i.test(d.getElementById('daysContainer').innerHTML), 'skript yoxdur');
});

test('UI: XSS - ad sahəsindəki HTML plan başlığında mətn kimi qalır', { skip: !JSDOM && 'jsdom yoxdur' }, async () => {
  const w = boot();
  const d = w.document;
  await wait(50);
  d.getElementById('f_ad').value = '<img src=x onerror=window.__x=1>'; d.getElementById('f_soyad').value = 'T';
  d.getElementById('f_dogum').value = '2021-03-01'; d.getElementById('f_diaqnoz').value = 'Autizm';
  d.getElementById('intakeForm').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(200);
  assert.strictEqual(w.__x, undefined);
  assert.strictEqual(d.querySelector('#childrenList img'), null);
  assert.strictEqual(d.querySelector('#daysContainer img'), null);
});

test('UI: yeni dövr formu əvvəlki məlumatla doldurur və 2-ci dövr yaradır', { skip: !JSDOM && 'jsdom yoxdur' }, async () => {
  const w = boot();
  const d = w.document;
  await wait(50);
  d.getElementById('f_ad').value = 'Leyla'; d.getElementById('f_soyad').value = 'Q';
  d.getElementById('f_dogum').value = '2020-01-10'; d.getElementById('f_diaqnoz').value = 'Nitq gecikməsi';
  d.getElementById('f_baslama').value = '2026-10-05';
  d.getElementById('intakeForm').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(200);
  d.querySelector('#cycleBox [data-action="new-cycle"]').click();
  await wait(100);
  assert.strictEqual(d.getElementById('cycleBanner').hidden, false);
  assert.strictEqual(d.getElementById('f_ad').value, 'Leyla');
  assert.strictEqual(d.getElementById('f_baslama').value, '2026-11-04');
  d.getElementById('intakeForm').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(200);
  const st = JSON.parse(w.localStorage.getItem('an_rehab_v2'));
  assert.strictEqual(Object.values(st.children)[0].cycles.length, 2);
  assert.match(d.getElementById('planTitleSub').textContent, /dövr 2/);
});

test('UI: lisenziyasız rejimdə plan yaranmır', { skip: !JSDOM && 'jsdom yoxdur' }, async () => {
  const w = boot('demo');
  const d = w.document;
  await wait(50);
  d.getElementById('f_ad').value = 'Əli'; d.getElementById('f_dogum').value = '2021-03-01';
  d.getElementById('f_diaqnoz').value = 'Autizm spektr pozuntusu';
  d.getElementById('intakeForm').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(200);
  assert.strictEqual(d.getElementById('planSection').hidden, true);
  assert.strictEqual(JSON.parse(w.localStorage.getItem('an_rehab_v2') || '{"children":{}}').children && Object.keys(JSON.parse(w.localStorage.getItem('an_rehab_v2') || '{"children":{}}').children).length, 0);
  assert.match(d.getElementById('modeBanner').textContent, /lisenziya/i);
});

test('UI: təsdiq gözlənilir, müdir təsdiqləyir, ixrac sənədində əks olunur', { skip: !JSDOM && 'jsdom yoxdur' }, async () => {
  const w = boot();
  const d = w.document;
  await wait(50);
  d.getElementById('f_ad').value = 'Əli'; d.getElementById('f_dogum').value = '2021-03-01';
  d.getElementById('f_diaqnoz').value = 'Autizm spektr pozuntusu'; d.getElementById('f_baslama').value = '2026-10-05';
  d.getElementById('intakeForm').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(200);
  assert.match(d.getElementById('approvalBlock').textContent, /Təsdiq gözlənilir/);
  const st = JSON.parse(w.localStorage.getItem('an_rehab_v2'));
  const cy0 = Object.values(st.children)[0].cycles[0];
  d.getElementById('apprName').value = 'Nahidə Axundova';
  d.querySelector('[data-action="approve"]').click();
  await wait(100);
  assert.match(d.getElementById('approvalBlock').textContent, /Təsdiq edilib.*Nahidə Axundova/);
  const cy1 = Object.values(JSON.parse(w.localStorage.getItem('an_rehab_v2')).children)[0].cycles[0];
  assert.strictEqual(cy1.approval.by, 'Nahidə Axundova');
  assert.ok(!cy0.approval);
  d.querySelector('[data-action="unapprove"]').click();
  await wait(100);
  assert.match(d.getElementById('approvalBlock').textContent, /Təsdiq gözlənilir/);
});
