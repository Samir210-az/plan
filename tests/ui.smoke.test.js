const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }
const root = path.join(__dirname, '..');

function boot(mode, user) {
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html.replace(/<script[^>]*src="license-check\.js"[^>]*><\/script>/, '').replace(/<script>\s*\(function\(\)\{[\s\S]*?<\/script>/, '').replace(/<script src="js\/[^"]+"><\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = (u) => Promise.resolve({ json: () => Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, u), 'utf8'))) });
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.confirm = () => true;
  w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
  const demoBank = JSON.parse(fs.readFileSync(path.join(root, 'data/demo-bank.json'), 'utf8'));
  w.PlanBank = { state: { user: user === undefined ? { uid: 'u1' } : user }, get: () => Promise.resolve({ bank: demoBank, mode: mode || 'full' }) };
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

  const btn = d.getElementById('savedBtn');
  assert.match(btn.textContent, /\(1\)/, 'düymədə uşaq sayı görünür');
  assert.strictEqual(d.getElementById('childrenCard').hidden, true, 'siyahı səhifədə açıq dayanmır');
  assert.strictEqual(Object.values(store.children)[0].owner, 'u1');
  d.getElementById('planSection').hidden = true;
  btn.click();
  assert.strictEqual(d.getElementById('childrenCard').hidden, false, 'düymə siyahını açır');
  d.querySelector('#childrenList [data-action="open-child"]').click();
  await wait(50);
  assert.strictEqual(d.getElementById('planSection').hidden, false, 'seçilən uşağın planı açılır');
  assert.strictEqual(d.getElementById('childrenCard').hidden, true, 'seçimdən sonra siyahı bağlanır');

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

test('UI: ehtiyat nüsxə yüklənəndə plan avtomatik açılır, qeydlər görünür', { skip: !JSDOM && 'jsdom yoxdur' }, async () => {
  const src = boot();
  let d = src.document;
  await wait(50);
  d.getElementById('f_ad').value = 'Əli'; d.getElementById('f_dogum').value = '2021-03-01';
  d.getElementById('f_diaqnoz').value = 'Autizm spektr pozuntusu'; d.getElementById('f_baslama').value = '2026-10-05';
  d.getElementById('intakeForm').dispatchEvent(new src.Event('submit', { cancelable: true }));
  await wait(200);
  const data = JSON.parse(src.localStorage.getItem('an_rehab_v2'));
  const cy = Object.values(data.children)[0].cycles[0];
  const k = cy.plan.sessions[0].day + '|psixoloq|' + cy.plan.sessions[0].items.psixoloq.list[0].a;
  cy.log = {}; cy.log[k] = { att: 'beli', r: '3', note: 'Yaxşı cavab verdi' };
  const dst = boot();
  await wait(50);
  assert.strictEqual(dst.document.getElementById('planSection').hidden, true);
  const input = dst.document.getElementById('importFile');
  const file = new dst.File([JSON.stringify(data)], 'b.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new dst.Event('change'));
  await wait(300);
  assert.strictEqual(dst.document.getElementById('planSection').hidden, false);
  assert.match(dst.document.getElementById('planTitleName').textContent, /Əli/);
});

test('UI: sənəd səhifə daxilində açılır (yükləmə və pəncərə tələb olunmur)', { skip: !JSDOM && 'jsdom yoxdur' }, async () => {
  const w = boot();
  const d = w.document;
  await wait(50);
  d.getElementById('f_ad').value = 'Əli'; d.getElementById('f_dogum').value = '2021-03-01';
  d.getElementById('f_diaqnoz').value = 'Autizm spektr pozuntusu'; d.getElementById('f_baslama').value = '2026-10-05';
  d.getElementById('intakeForm').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(200);
  let opened = 0; w.open = () => { opened++; return null; };
  const cases = [['spec-print', /Klinik psixoloq planı/], ['print', /Reabilitasiya Planı/], ['html', /Reabilitasiya Planı/], ['parent', /Mərkəzə gəliş cədvəli/]];
  for (const [act, rx] of cases) {
    d.querySelector('#planSection [data-action="' + act + '"]').click();
    await wait(80);
    const fr = d.querySelector('#docViewer iframe');
    assert.ok(fr, act + ': görüntüləyici açılmadı');
    assert.match(fr.getAttribute('srcdoc') || fr.srcdoc, rx);
    assert.ok(d.body.classList.contains('viewing'));
    d.querySelector('[data-action="doc-close"]').click();
    assert.strictEqual(d.getElementById('docViewer'), null);
    assert.ok(!d.body.classList.contains('viewing'));
  }
  assert.strictEqual(opened, 0);
  w.close();
});

test('UI: yaddaşdan uşaq seçimi və mütəxəssis üzrə ayrılma', { skip: !JSDOM && 'jsdom yoxdur' }, async () => {
  const seed = {
    v: 2, children: {
      'eski|s|2018-01-01': { key: 'eski|s|2018-01-01', form: { ad: 'Köhnə', soyad: 'S', dogum: '2018-01-01' }, cycles: [] },
      'u2::b|s|2019-01-01': { key: 'u2::b|s|2019-01-01', owner: 'u2', form: { ad: 'Başqa', soyad: 'S', dogum: '2019-01-01' }, cycles: [] }
    }
  };
  const Storage = require('../js/storage.js');
  const st = Storage.create(Storage.memoryStore());
  const f = (ad) => ({ ad, soyad: 'S', dogum: '2019-01-01' });
  const cyc = { n: 1, plan: { start: '2026-10-01', end: '2026-10-30', sessions: [], home: [], tests: [] }, log: {}, results: {}, notes: [] };
  st.putCycle(f('Ali'), cyc, 'u1');
  st.putCycle(f('Ali'), cyc, 'u2');
  assert.deepStrictEqual(st.listChildren('u1').map(c => c.name), ['Ali S']);
  assert.strictEqual(st.listChildren('u2').length, 1);
  assert.strictEqual(st.listChildren(null).length, 0, 'daxil olmayan heç nə görmür');
  assert.strictEqual(st.getChild(st.childKey(f('Ali'), 'u2'), 'u1'), null, 'başqasının uşağı açılmır');
  assert.strictEqual(st.removeChild(st.childKey(f('Ali'), 'u2'), 'u1').ok, false);
  const lg = Storage.create(Storage.memoryStore());
  lg.save(seed);
  assert.strictEqual(lg.adoptLegacy('u1'), 1);
  assert.deepStrictEqual(lg.listChildren('u1').map(c => c.name), ['Köhnə S']);
  assert.deepStrictEqual(lg.listChildren('u2').map(c => c.name), ['Başqa S']);
  const imp = Storage.create(Storage.memoryStore());
  const exp = st.exportAll();
  assert.strictEqual(imp.importData(exp, 'merge', 'u3').ok, true);
  assert.strictEqual(imp.listChildren('u3').length, 1, 'idxal edilən qeydlər idxal edənə aid olur');

  const w = boot('full', { uid: 'u1' });
  w.localStorage.setItem('an_rehab_v2', JSON.stringify({ v: 2, children: {} }));
  await wait(50);
  w.document.getElementById('savedBtn').click();
  assert.match(w.document.getElementById('childrenList').textContent, /hələ qeydə alınmış uşaq yoxdur/);
  assert.ok(w.document.querySelector('#childrenCard [data-action="import"]'), 'boş olanda da geri yükləmə əlçatandır');
  w.close();
});

test('UI: köhnə (40 dəq) plan üçün 45-ə yenilə düyməsi', { skip: !JSDOM && 'jsdom yoxdur' }, async () => {
  const w = boot();
  const d = w.document;
  await wait(50);
  d.getElementById('f_ad').value = 'Eli'; d.getElementById('f_soyad').value = 'M';
  d.getElementById('f_dogum').value = '2019-03-05'; d.getElementById('f_diaqnoz').value = 'DEHB';
  d.getElementById('intakeForm').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await wait(200);
  const data = JSON.parse(w.localStorage.getItem('an_rehab_v2'));
  const ch = Object.values(data.children)[0];
  ch.cycles[0].plan.sessionMin = 40;
  w.localStorage.setItem('an_rehab_v2', JSON.stringify(data));
  w.PlanApp.onLicenseChange();
  await wait(100);
  assert.match(d.getElementById('lenNote').textContent, /40 dəqiqəlik/);
  d.querySelector('[data-action="retime"]').click();
  await wait(100);
  assert.strictEqual(d.getElementById('lenNote').textContent, '');
  assert.strictEqual(Object.values(JSON.parse(w.localStorage.getItem('an_rehab_v2')).children)[0].cycles[0].plan.sessionMin, 45);
  w.close();
});
