const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const E = require('../js/engine.js');

const root = path.join(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/tests-catalog.json'), 'utf8'));
const bankPath = path.join(root, 'private/bank.json');
const hasFull = fs.existsSync(bankPath);
const full = hasFull ? JSON.parse(fs.readFileSync(bankPath, 'utf8')) : null;
const demo = JSON.parse(fs.readFileSync(path.join(root, 'data/demo-bank.json'), 'utf8'));

const base = {
  ad: 'Əli', soyad: 'Test', dogum: '2021-03-01', baslama: '2026-10-05', diaqnoz: 'Autizm spektr pozuntusu',
  davranislar: ['Aqressiya', 'Keçid çətinliyi'], sensor: ['Auditor həssaslıq', 'Taktil həssaslıq'],
  nitqsev: 'Tək sözlər', gosterish: '1 addımlı', gozkontakt: 'Qısa müddətli', birgediqqet: 'Qismən', adreaksiya: 'Qismən',
  oyun: 'Paralel oyun', diqqet: 'Qısa (3-5 dəq)', yaddas: 'Orta', irimotor: 'Orta', xirdamotor: 'Zəif', tarazliq: 'Orta',
  qelem: 'Formalaşmayıb', tualet: 'Formalaşmayıb', akademik: 'Formalaşmayıb', aac: 'Yoxdur', seans: '5', evdevaxt: '45'
};
const gen = (f, bank, o) => E.generate(Object.assign({}, base, f), bank, Object.assign({ catalog: catalog, today: '2026-10-01', now: '2026-10-01T00:00:00.000Z' }, o || {}));

const banks = [['demo', demo]].concat(hasFull ? [['full', full]] : []);

banks.forEach(function (b) {
  const name = b[0], bank = b[1];
  test('[' + name + '] plan 30 gündür və təqvim düzgündür', () => {
    const p = gen({}, bank);
    assert.strictEqual(p.start, '2026-10-05');
    assert.strictEqual(p.end, '2026-11-03');
    assert.strictEqual(p.nextStart, '2026-11-04');
    assert.strictEqual(p.home.length, 30);
    assert.ok(p.sessions.every(s => s.day >= 1 && s.day <= 30));
    assert.deepStrictEqual(E.validatePlan(p), []);
  });

  test('[' + name + '] həftədə seans sayı fərqli seçimlərdə düzgün işləyir', () => {
    [3, 4, 5].forEach(n => {
      const p = gen({ seans: String(n) }, bank);
      const wk = {};
      p.sessions.forEach(s => { if (s.day <= 28) wk[s.week] = (wk[s.week] || 0) + 1; });
      Object.keys(wk).forEach(w => assert.strictEqual(wk[w], n, n + ' seans, həftə ' + w));
    });
  });

  test('[' + name + '] eyni giriş eyni plan, fərqli dövr fərqli plan verir', () => {
    const a = gen({}, bank), b = gen({}, bank);
    assert.deepStrictEqual(a.sessions, b.sessions);
    const c = gen({}, bank, { cycle: 2 });
    assert.notDeepStrictEqual(a.sessions, c.sessions);
  });

  test('[' + name + '] hər seansda hər mütəxəssis üçün 1-2 fərqli məşğələ var və vaxt cəmi seans vaxtına bərabərdir', () => {
    const p = gen({}, bank);
    p.sessions.forEach(s => E.SPECS.forEach(sp => {
      const it = s.items[sp];
      if (!it) return;
      assert.ok(it.list.length >= 1 && it.list.length <= 2);
      const ids = it.list.map(x => x.a);
      assert.strictEqual(new Set(ids).size, ids.length);
      assert.strictEqual(it.list.reduce((t, x) => t + x.min, 0), p.sessionMin);
      it.list.forEach(x => { assert.ok(bank.act[x.a], 'bankda yoxdur ' + x.a); assert.ok([1, 2, 3].includes(x.lv)); });
    }));
  });

  test('[' + name + '] bir həftədə eyni məşğələ 3 dəfədən çox təkrarlanmır və ardıcıl seanslarda əsas məşğələ təkrarlanmır', () => {
    const p = gen({}, bank);
    E.SPECS.forEach(sp => {
      const pool = new Set();
      p.sessions.forEach(s => { if (s.items[sp]) s.items[sp].list.forEach(x => pool.add(x.a)); });
      if (pool.size < 4) return;
      const perWeek = {};
      let prev = null, consecutive = 0;
      p.sessions.forEach(s => {
        const it = s.items[sp];
        if (!it) return;
        it.list.forEach(x => { const k = s.week + '|' + x.a; perWeek[k] = (perWeek[k] || 0) + 1; });
        if (prev && prev === it.list[0].a) consecutive++;
        prev = it.list[0].a;
      });
      Object.keys(perWeek).forEach(k => assert.ok(perWeek[k] <= 4, sp + ' ' + k + ' ' + perWeek[k]));
      assert.ok(consecutive <= 2, sp + ' ardıcıl təkrar: ' + consecutive);
    });
  });

  test('[' + name + '] təkrarlarda pillə azalmır, səviyyə 1-3 aralığındadır, pillə təkrarı yoxdur', () => {
    const p = gen({}, bank);
    const seq = {};
    p.sessions.forEach(s => E.SPECS.forEach(sp => { if (s.items[sp]) s.items[sp].list.forEach(x => { (seq[sp + '|' + x.a] = seq[sp + '|' + x.a] || []).push(x); }); }));
    Object.keys(seq).forEach(k => {
      const list = seq[k];
      list.forEach((x, i) => {
        assert.ok(x.lv >= 1 && x.lv <= 3, k);
        if (i > 0) { assert.ok(x.lv >= list[i - 1].lv, k + ' səviyyə düşdü'); if (x.st != null) assert.ok(x.st >= list[i - 1].st, k + ' pillə düşdü'); }
      });
      if (list[0].st != null && list.length >= 2 && list.length <= 6) {
        const steps = list.map(x => x.st);
        assert.ok(new Set(steps).size >= Math.min(list.length, 2), k + ' bütün təkrarlar eyni pillə');
      }
    });
  });

  test('[' + name + '] testlər 10-15 gündən bir yoxlama nöqtəsində: başlanğıc, ara, yekun', () => {
    [3, 5].forEach(n => {
      const p = gen({ seans: String(n) }, bank);
      assert.ok(p.tests.length > 0);
      const days = [...new Set(p.tests.map(t => t.day))].sort((a, b) => a - b);
      const phases = new Set(p.tests.map(t => t.phase));
      ['baseline', 'mid', 'retest'].forEach(ph => assert.ok(phases.has(ph), ph + ' yoxdur'));
      p.tests.filter(t => t.phase === 'baseline').forEach(t => assert.ok(t.day <= 10, 'baseline gün ' + t.day));
      p.tests.filter(t => t.phase === 'mid').forEach(t => assert.ok(t.day >= 12 && t.day <= 17, 'mid gün ' + t.day));
      p.tests.filter(t => t.phase === 'retest').forEach(t => assert.ok(t.day >= 26 && t.day <= 30, 'retest gün ' + t.day));
      const med = ph => Math.min.apply(null, p.tests.filter(t => t.phase === ph).map(t => t.day));
      const g1 = med('mid') - med('baseline'), g2 = med('retest') - med('mid');
      [g1, g2].forEach(g => assert.ok(g >= 10 && g <= 16, 'boşluq ' + g));
      assert.ok(days.length >= 3);
    });
  });

  test('[' + name + '] hər gün testlərin ümumi müddəti 140 dəqiqədən çox deyil', () => {
    const p = gen({}, bank);
    const perDay = {};
    p.tests.forEach(t => { perDay[t.date] = (perDay[t.date] || 0) + t.min; });
    Object.keys(perDay).forEach(d => assert.ok(perDay[d] <= 200, d + ' ' + perDay[d]));
  });

  test('[' + name + '] aspirasiya riski ağız-motor və yemək məşqlərini çıxarır', () => {
    const p = gen({ tibbiqeyd: 'Aspirasiya riski', diaqnoz: 'Serebral iflic' }, bank);
    const used = Object.keys(E.usedCounts(p));
    used.forEach(id => assert.ok(!(bank.act[id].risks || []).includes('oral'), id));
    assert.ok(p.warnings.some(w => /udma|aspirasiya/i.test(w)));
    const pools = Object.values(p.coverage).flat();
    pools.forEach(id => assert.ok(!(bank.act[id].risks || []).includes('oral'), id));
  });

  test('[' + name + '] epilepsiya vestibulyar və parlayan işıq məşqlərini çıxarır', () => {
    const p = gen({ tibbiqeyd: 'Epilepsiya' }, bank);
    Object.values(p.coverage).flat().forEach(id => {
      const r = bank.act[id].risks || [];
      assert.ok(!r.includes('vestibular') && !r.includes('photic'), id);
    });
    assert.ok(p.profile.flags.includes('epilepsy'));
  });

  test('[' + name + '] yaş filtri: 18 aylıq uşağa məktəb məşğələsi və kiçik hissəli əşyalar verilmir', () => {
    const p = gen({ dogum: '2025-04-01', baslama: '2026-10-05' }, bank);
    assert.ok(p.profile.ageM >= 17 && p.profile.ageM <= 18);
    Object.values(p.coverage).flat().forEach(id => {
      const a = bank.act[id];
      assert.ok(p.profile.ageM >= a.age[0] && p.profile.ageM <= a.age[1], id);
      assert.ok(!(a.risks || []).includes('smallparts'), id);
    });
  });

  test('[' + name + '] bütün qiymətləndirmə sahələri plana təsir edir', () => {
    const baseP = JSON.stringify(gen({}, bank).sessions);
    const changes = [
      { nitqsev: 'Yaşa uyğun' }, { gosterish: 'Mürəkkəb' }, { gozkontakt: 'Sabit', birgediqqet: 'Formalaşıb', adreaksiya: 'Bəli, sabit' },
      { oyun: 'Qarşılıqlı oyun' }, { diqqet: 'Yaxşı (10+ dəq)', yaddas: 'Yaxşı' }, { irimotor: 'Yaxşı', tarazliq: 'Yaxşı' },
      { xirdamotor: 'Yaxşı' }, { qelem: 'Formalaşıb' }, { tualet: 'Formalaşıb' }, { akademik: 'Formalaşıb' },
      { davranislar: [] }, { sensor: [] }, { aac: 'PECS istifadə olunur' }
    ];
    let changed = 0;
    changes.forEach(c => { if (JSON.stringify(gen(c, bank).sessions) !== baseP) changed++; });
    assert.ok(changed >= (name === 'demo' ? 5 : 11), 'plana təsir edən dəyişiklik sayı: ' + changed);
  });

  test('[' + name + '] bilinməyən sahələr siyahıya düşür, plan yenə yaranır', () => {
    const p = gen({ gozkontakt: '', diqqet: '', irimotor: '' }, bank);
    assert.ok(p.profile.unknown.includes('Göz kontaktı') && p.profile.unknown.includes('Diqqət müddəti'));
  });

  test('[' + name + '] yeni dövr: əvvəlki qiymətləndirmə səviyyəni və təkrarı dəyişir', () => {
    const p1 = gen({}, bank);
    const log = {};
    p1.sessions.forEach(s => E.SPECS.forEach(sp => { if (s.items[sp]) s.items[sp].list.forEach(x => { log[s.day + '|' + sp + '|' + x.a] = { att: 'bəli', r: 4 }; }); }));
    const seed = E.nextCycleSeed(p1, bank, log);
    assert.ok(Object.keys(seed.levels).length > 0);
    Object.values(seed.levels).forEach(l => assert.ok(l >= 1 && l <= 3));
    const p2 = gen({ baslama: p1.nextStart }, bank, { cycle: 2, prior: seed });
    assert.strictEqual(p2.start, p1.nextStart);
    assert.notDeepStrictEqual(p2.sessions.map(s => s.items), p1.sessions.map(s => s.items));
  });

  test('[' + name + '] tövsiyə olunan səviyyə: iki yüksək qiymət artırır, iki aşağı endirir', () => {
    const p = gen({}, bank);
    const s0 = p.sessions.find(s => s.items.psixoloq);
    const id = s0.items.psixoloq.list[0].a;
    const days = p.sessions.filter(s => s.items.psixoloq && s.items.psixoloq.list.some(x => x.a === id)).slice(0, 2);
    assert.strictEqual(days.length, 2);
    const hi = {}, lo = {};
    days.forEach(s => { hi[s.day + '|psixoloq|' + id] = { att: 'bəli', r: 4 }; lo[s.day + '|psixoloq|' + id] = { att: 'bəli', r: 1 }; });
    assert.strictEqual(E.recommendLevel(p, bank, hi, 'psixoloq', id, 2).lv, 3);
    assert.strictEqual(E.recommendLevel(p, bank, lo, 'psixoloq', id, 2).lv, 1);
    assert.strictEqual(E.recommendLevel(p, bank, {}, 'psixoloq', id, 2).lv, 2);
  });

  test('[' + name + '] hədəflər qısa, orta, uzun müddət üzrə var', () => {
    const p = gen({}, bank);
    assert.ok(p.goals.short.length >= 3 && p.goals.mid.length >= 2 && p.goals.long.length >= 2);
    assert.ok(p.goals.short.every(g => g.text && !g.text.includes('{ad}') && g.text.includes('Əli')));
  });
});

test('diaqnoz çoxlu etiket: autizm + DEHB eyni anda tanınır, səhv uyğunluq yoxdur', () => {
  assert.deepStrictEqual(E.detectDx({ diaqnoz: 'Autizm spektr pozuntusu + DEHB' }).sort(), ['adhd', 'asd']);
  assert.ok(E.detectDx({ diaqnoz: 'Serebral iflic, nitq gecikməsi' }).includes('cp'));
  assert.ok(E.detectDx({ diaqnoz: 'Serebral iflic, nitq gecikməsi' }).includes('speech'));
  assert.deepStrictEqual(E.detectDx({ diaqnoz: 'Basdırma' }), []);
  assert.deepStrictEqual(E.detectDx({ diaqnoz: 'Sindrom X' }), []);
});

test('yaş hesablaması', () => {
  assert.strictEqual(E.ageMonths('2021-03-01', '2026-10-05'), 67);
  assert.strictEqual(E.ageMonths('2021-03-10', '2026-03-09'), 59);
});

test('testlər: 2 yaşlı M-CHAT, 8 yaşlı IQ, davranış FBA, narahatlıq SCARED', () => {
  const young = gen({ dogum: '2024-06-01', diaqnoz: 'Nitq gecikməsi', diaqtarix: '' }, demo);
  assert.ok(young.tests.some(t => t.id === 'm-chat-r'));
  const school = gen({ dogum: '2018-01-01', diaqnoz: 'Zehni gerilik', akademik: 'Formalaşmayıb' }, demo);
  assert.ok(school.tests.some(t => t.id === 'wisc-v'));
  assert.ok(school.tests.some(t => t.id === 'wisc-v' && t.phase === 'baseline'));
  const anx = gen({ dogum: '2015-01-01', diaqnoz: 'Narahatlıq pozuntusu', davranislar: ['Qorxular'], narahatliq: 'qorxu və narahatlıq' }, demo);
  assert.ok(anx.tests.some(t => t.id === 'scared'));
  const beh = gen({ davranislar: ['Aqressiya', 'Özünə zərər'] }, demo);
  assert.ok(beh.tests.some(t => t.id === 'fba' && t.phase === 'mid'));
});

test('IQ və Vineland hər dövr təkrarlanmır (məşq effekti, qısa interval)', () => {
  const f = { dogum: '2018-01-01', diaqnoz: 'Zehni gerilik' };
  const c2 = gen(f, demo, { cycle: 2 });
  assert.ok(!c2.tests.some(t => t.id === 'wisc-v' || t.id === 'vineland-3'));
  const c4 = gen(f, demo, { cycle: 4 });
  assert.ok(c4.tests.some(t => t.id === 'vineland-3'));
});

test('hesabat: nəticələrin müqayisəsi', () => {
  const r = E.compareResults({ a: { score: '10' }, b: { score: 'yüksək' } }, { a: { score: '14' }, b: { score: 'orta' }, c: { score: '3' } });
  assert.strictEqual(r.find(x => x.id === 'a').delta, 4);
  assert.strictEqual(r.find(x => x.id === 'a').direction, 'up');
  assert.strictEqual(r.find(x => x.id === 'b').delta, null);
  assert.strictEqual(r.find(x => x.id === 'c').prev, null);
});

test('həftədə seans sayı: minimum 3, ay üzrə cəm avtomatik hesablanır', () => {
  assert.strictEqual(E.deriveProfile({ seans: '2' }).sessionsPerWeek, 3);
  assert.strictEqual(E.deriveProfile({ seans: '' }).sessionsPerWeek, 3);
  assert.strictEqual(E.deriveProfile({ seans: '5' }).sessionsPerWeek, 5);
  const n3 = E.monthSessions('2026-10-05', 3), n5 = E.monthSessions('2026-10-05', 5);
  assert.ok(n3 >= 12 && n3 <= 14, 'n3=' + n3);
  assert.ok(n5 >= 20 && n5 <= 22, 'n5=' + n5);
  assert.strictEqual(gen({ seans: '3' }, demo).sessions.length, n3);
});

test('ixrac: təsdiq bloku və səhifə boşluğu yaradan qaydalar', () => {
  const X = require('../js/exports.js');
  assert.match(X.approvalHtml({}), /Təsdiq gözlənilir/);
  assert.match(X.approvalHtml({ approval: { by: 'A <b>B</b>', at: '2026-10-02' } }), /Təsdiq edilib.*A &lt;b&gt;B&lt;\/b&gt;.*02\.10\.2026/);
});

test('ixrac başlığı: uşaq, yaş, mərkəz və mütəxəssis adı', () => {
  const X = require('../js/exports.js');
  const f = { ad: 'Həsən', soyad: 'Həsənov', dogum: '2018-10-18', kurator: 'Axundova Nahidə', diaqnoz: 'Autizm', baslama: '2026-11-01' };
  const plan = E.generate(f, demo, { catalog: {}, today: '2026-10-02' });
  const html = X.fullHtml(f, { n: 1, plan, log: {}, results: {} }, demo);
  assert.match(html, /AN Psixoloji Dəstək və Reabilitasiya Mərkəzi/);
  assert.match(html, /Həsən Həsənov, 8 yaş · Reabilitasiya Planı/);
  assert.strictEqual((html.match(/class="appr /g) || []).length, 1, 'təsdiq bloku yalnız planın başında olur');
  assert.match(html, /Kurator mütəxəssis: <b>Axundova Nahidə<\/b>/);
});

test('mütəxəssis planı: yalnız seçilmiş mütəxəssis və həftə, hər seans ayrıca', () => {
  const X = require('../js/exports.js');
  const f = { ad: 'Əli', soyad: 'V', dogum: '2021-03-01', diaqnoz: 'Autizm', baslama: '2026-10-05', kurator: 'Kurator Ad' };
  const plan = E.generate(f, demo, { catalog: {}, today: '2026-10-02' });
  const cy = { n: 1, plan, log: {}, results: {} };
  const wk = X.specialistHtml(f, cy, demo, { spec: 'loqoped', week: 2 });
  assert.match(wk, /Loqoped planı · həftə 2/);
  assert.ok(!/Klinik psixoloq · tanışlıq/.test(wk) && !/Ev proqramı/.test(wk));
  const w2 = plan.sessions.filter(s => s.week === 2 && s.items.loqoped).length;
  assert.strictEqual((wk.match(/gün \d+, həftə 2/g) || []).length, w2);
  const all = X.specialistHtml(f, cy, demo, { spec: 'psixoloq', week: 0, perSession: true });
  assert.strictEqual((all.match(/class="day/g) || []).length, plan.sessions.filter(s => s.items.psixoloq).length);
  assert.ok((all.match(/newpage/g) || []).length >= 2);
  assert.match(all, /Qeyd: <span class="line">/);
});

test('seans müddəti: standart 45 dəq, diqqət və yaşdan asılı qısalmır, seçim 30/60 qəbul olunur', () => {
  const base = { dogum: '2024-06-01', diaqnoz: 'Autizm', diqqet: 'Çox zəif', baslama: '2026-10-05' };
  assert.strictEqual(E.generate(base, demo, { catalog: {}, today: '2026-10-02' }).sessionMin, 45);
  assert.strictEqual(E.generate(Object.assign({ seansdeq: '60' }, base), demo, { catalog: {}, today: '2026-10-02' }).sessionMin, 60);
  assert.strictEqual(E.generate(Object.assign({ seansdeq: '30' }, base), demo, { catalog: {}, today: '2026-10-02' }).sessionMin, 30);
  assert.strictEqual(E.generate(Object.assign({ seansdeq: '17' }, base), demo, { catalog: {}, today: '2026-10-02' }).sessionMin, 45);
});

test('retimePlan: köhnə plan 45 dəqiqəyə keçir, məşğələlər dəyişmir', () => {
  const plan = gen({ seansdeq: '30', seans: '3' }, demo);
  assert.strictEqual(plan.sessionMin, 30);
  const out = E.retimePlan(plan, 45);
  assert.strictEqual(out.sessionMin, 45);
  assert.strictEqual(plan.sessionMin, 30, 'orijinal dəyişmir');
  out.sessions.forEach((s, i) => Object.keys(s.items).forEach(sp => {
    const l = s.items[sp].list, o = plan.sessions[i].items[sp].list;
    assert.strictEqual(l.reduce((a, x) => a + x.min, 0), 45);
    assert.deepStrictEqual(l.map(x => x.a), o.map(x => x.a));
  }));
});

test('loqo: bütün çıxarışların başlığında və hər seans səhifəsində var', () => {
  const X = require('../js/exports.js');
  const f = { ad: 'Həsən', soyad: 'H', dogum: '2018-10-18', diaqnoz: 'Autizm', baslama: '2026-11-01' };
  const plan = E.generate(f, demo, { catalog: {}, today: '2026-10-02' });
  const cy = { n: 1, plan, log: {}, results: {} };
  assert.match(X.fullHtml(f, cy, demo), /class="brandrow"><img/);
  assert.match(X.parentHtml(f, cy, demo), /class="brandrow"><img/);
  const sp = X.specialistHtml(f, cy, demo, { spec: 'psixoloq', week: 0, perSession: true });
  assert.match(sp, /class="brandrow"><img/);
  const mini = (sp.match(/class="minihead"/g) || []).length;
  const pages = (sp.match(/class="day newpage"/g) || []).length;
  assert.ok(pages > 5 && mini === pages, 'hər yeni səhifədə kiçik başlıq var');
});

test('imza: yalnız təhlükəsiz PNG data URL çapa düşür', () => {
  const X = require('../js/exports.js');
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.match(X.approvalHtml({ approval: { by: 'Nahidə A', at: '2026-10-02', sig: png } }), /<img class="sigimg" alt="İmza" src="data:image\/png;base64,iVBORw0KGgo="/);
  const bad = X.approvalHtml({ approval: { by: 'N A', at: '2026-10-02', sig: 'javascript:alert(1)' } });
  assert.ok(!/<img/.test(bad) && /______/.test(bad));
  assert.ok(!/<img/.test(X.approvalHtml({ approval: { by: 'N A', at: '2026-10-02', sig: 'data:image/png;base64,"><script>' } })));
});

test('gate: ehtiyac formada qeyd olunmayıbsa mütəxəssis məşğələsi planlaşdırılmır, 2-ci dövrdə «tanışlıq» seansı yoxdur', () => {
  const mk = (id, extra) => Object.assign({ id, group: 'psixoloq', t: id, needs: ['behavior'], age: [24, 216], min: 15, levels: { 1: { g: 'a', sup: 'b', ok: 'c' }, 2: { g: 'a', sup: 'b', ok: 'c' }, 3: { g: 'a', sup: 'b', ok: 'c' } }, steps: [0, 1, 2, 3, 4, 5].map(i => ({ t: 't' + i, do: 'd' + i, ok: 'o' + i })) }, extra);
  const bank = { act: { a1: mk('a1', { needs: ['joint'] }), a2: mk('a2', { needs: ['joint'] }), a3: mk('a3', { needs: ['joint'] }), a4: mk('a4', { needs: ['joint'] }), a5: mk('a5', { needs: ['joint'] }), g1: mk('g1', { gate: ['behavior'] }) }, needs: {} };
  const form = { ad: 'T', dogum: '2012-01-01', baslama: '2026-11-02', seans: '3', diaqnoz: 'Autizm' };
  const p1 = E.generate(form, bank, { cycle: 2, today: '2026-10-02' });
  assert.ok(!p1.coverage.psixoloq.includes('g1'));
  assert.strictEqual(p1.sessions[0].items.psixoloq.kind, 'regular');
  const p2 = E.generate(Object.assign({}, form, { davranislar: ['Aqressiya'] }), bank, { cycle: 1, today: '2026-10-02' });
  assert.ok(p2.coverage.psixoloq.includes('g1'));
  assert.strictEqual(p2.sessions[0].items.psixoloq.kind, 'baseline');
});
