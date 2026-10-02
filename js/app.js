(function () {
  'use strict';

  var E = window.Engine, X = window.PlanExports, esc = X.esc;
  var store = window.PlanStorage.create(safeLocal());
  var state = { childKey: null, cycleN: null, pending: null, week: 1, bank: null, mode: 'demo', catalog: {}, catalogP: null };

  var FIELDS = ['ad', 'soyad', 'ataadi', 'dogum', 'yas', 'cins', 'boy', 'cheki', 'qtarix', 'baslama', 'kurator', 'diaqnoz', 'diaqnoz2', 'icd', 'diaqtarix',
    'evvelki', 'derman', 'allergiya', 'tibbiqeyd', 'hamile', 'yerime', 'ilksoz', 'ilkcumle', 'tualet', 'ozunexidmet', 'nitqsev', 'reseptiv', 'aac', 'ekolaliya',
    'adreaksiya', 'gosterish', 'gozkontakt', 'birgediqqet', 'munasibet', 'oyun', 'novbe', 'davranisdiger', 'irimotor', 'xirdamotor', 'tarazliq', 'qelem', 'diqqet',
    'yaddas', 'akademik', 'oxuyazi', 'narahatliq', 'meqsed', 'evdevaxt', 'bacigardas', 'mekteb', 'seans', 'seansdeq', 'diaqtesdiq'];
  var BLANK_SELECTS = ['tualet', 'nitqsev', 'aac', 'adreaksiya', 'gosterish', 'gozkontakt', 'birgediqqet', 'oyun', 'irimotor', 'xirdamotor', 'tarazliq', 'qelem', 'diqqet', 'yaddas', 'akademik', 'oxuyazi'];
  var BEHAVIOR_LIST = ['Aqressiya', 'Özünə zərər', 'Əl çırpma', 'Fırlanma', 'Qaçma', 'Əşya atma', 'Dişləmə', 'Qışqırma', 'Ağlama', 'Hiperaktivlik', 'Diqqət çatışmazlığı', 'Rutinə bağlılıq', 'Keçid çətinliyi', 'Sensor həssaslıq', 'Yemək seçiciliyi', 'Yuxu problemi', 'Obsessiv davranışlar', 'Qorxular', 'Tiklər'];
  var SENSORY_LIST = ['Taktil həssaslıq', 'Vestibulyar həssaslıq', 'Proprioseptiv axtarış', 'Vizual həssaslıq', 'Auditor həssaslıq', 'Dad seçiciliyi', 'Qoxu həssaslığı', 'Sensor axtarışı', 'Sensor qaçınması'];
  var RATING = { 1: '1 · tam dəstəklə', 2: '2 · qismən dəstəklə', 3: '3 · az dəstəklə', 4: '4 · müstəqil' };

  function safeLocal() { try { var t = window.localStorage; t.getItem('x'); return t; } catch (e) { return null; } }
  function $(id) { return document.getElementById(id); }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 3200); }

  var cloud = { sync: null, at: 0, touched: {}, timer: null };
  function setSyncState(text, bad) {
    var el = $('syncState');
    if (!el) return;
    el.textContent = text;
    el.className = 'hint no-print' + (bad ? ' sync-bad' : '');
  }
  function cloudApi() {
    var B = window.PlanBank;
    if (!cloud.sync && window.PlanSync && B && B.firebaseReady) {
      var db = function () { return B.firebaseReady().then(function (fb) { return fb.database(); }); };
      cloud.sync = window.PlanSync.create(store, {
        fetchAll: function (uid) { return db().then(function (d) { return d.ref('plan_children/' + uid).once('value'); }).then(function (s) { return s.val() || {}; }); },
        put: function (uid, rk, node) { return db().then(function (d) { return d.ref('plan_children/' + uid + '/' + rk).set(node); }); }
      }, window.PlanStorage.validate);
    }
    return cloud.sync;
  }
  function cloudFail(e) {
    var denied = e && /permission|PERMISSION/.test(String(e.code || e.message || ''));
    setSyncState(denied ? 'Bulud sinxronu işləmir: lisenziya aktiv deyil və ya Firebase qaydaları yayımlanmayıb. Qeydlər yalnız bu cihazdadır.' : 'Bulud əlçatmazdır, qeydlər bu cihazda saxlanılır və internet gələndə göndəriləcək.', true);
  }
  function cloudSync() {
    var me = owner(), api = cloudApi();
    if (!me || !api) return Promise.resolve();
    setSyncState('Bulud ilə sinxronlaşdırılır…');
    return api.fullSync(me).then(function (r) {
      cloud.at = Date.now();
      if (r.ok === false) { setSyncState('Bu cihazın yaddaşı sinxron üçün oxuna bilmədi.', true); return; }
      var t = new Date(); setSyncState('Bulud ilə sinxronlaşdırıldı: ' + ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) + '. Qeydlər hesabınızla bağlıdır və başqa cihazdan da görünür.');
      if (r.pulled || r.removed) syncOwner();
    }).catch(cloudFail);
  }
  function touch(key) {
    if (!key || !owner() || !cloudApi()) return;
    cloud.touched[key] = 1;
    clearTimeout(cloud.timer);
    cloud.timer = setTimeout(function () {
      var keys = Object.keys(cloud.touched), me = owner(), api = cloudApi();
      cloud.touched = {};
      if (!me || !api) return;
      Promise.all(keys.map(function (k) { return api.push(me, k); })).then(function () { cloud.at = Date.now(); }).catch(cloudFail);
    }, 1200);
  }

  function saveCheck(r) {
    if (r && r.ok !== false) touch(r.key || state.childKey);
    if (r && r.ok === false) toast(r.error === 'quota' ? 'Brauzer yaddaşı doludur. Ehtiyat nüsxəni yükləyib köhnə qeydləri silin.' : 'Yaddaşa yazmaq mümkün olmadı. Ehtiyat nüsxə yükləyin.');
    return r;
  }

  /* ---------- forma ---------- */
  function buildChips(id, list) {
    var c = $(id);
    c.innerHTML = '';
    list.forEach(function (x) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = x; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { var on = b.classList.toggle('on'); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      c.appendChild(b);
    });
  }
  function chipValues(id) { return [].slice.call(document.querySelectorAll('#' + id + ' .chip.on')).map(function (c) { return c.textContent; }); }
  function setChips(id, vals) {
    [].forEach.call(document.querySelectorAll('#' + id + ' .chip'), function (c) {
      var on = (vals || []).indexOf(c.textContent) >= 0;
      c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function ensureBlankOptions() {
    BLANK_SELECTS.forEach(function (k) {
      var s = $('f_' + k);
      if (s && s.options.length && s.options[0].value !== '') {
        var o = document.createElement('option'); o.value = ''; o.textContent = 'Seçilməyib';
        s.insertBefore(o, s.firstChild); s.selectedIndex = 0;
      }
    });
  }
  function collectForm() {
    var f = {};
    FIELDS.forEach(function (k) { var el = $('f_' + k); f[k] = el ? String(el.value || '').trim() : ''; });
    f.davranislar = chipValues('behaviorChips');
    f.sensor = chipValues('sensoryChips');
    return f;
  }
  function fillForm(f) {
    FIELDS.forEach(function (k) { var el = $('f_' + k); if (el && f[k] != null) el.value = f[k]; });
    setChips('behaviorChips', f.davranislar); setChips('sensoryChips', f.sensor);
    calcAge(); updateSeansInfo();
  }
  function calcAge() {
    var v = $('f_dogum').value;
    if (!v) return;
    var m = E.ageMonths(v, E.todayISO());
    if (m != null) $('f_yas').value = E.ageLabel(m);
  }
  function updateSeansInfo() {
    var spw = parseInt($('f_seans').value, 10) || 3;
    var start = $('f_baslama').value || E.todayISO();
    var n = E.monthSessions(start, spw);
    $('seansInfo').textContent = 'Həftədə ' + spw + ' seans seçilib: bu 30 günlük dövrdə təxminən ' + n + ' seans, hər seansda 4 mütəxəssis və gündəlik ev proqramı olacaq.';
  }

  /* ---------- uşaq siyahısı ---------- */
  function owner() {
    var u = window.PlanBank && window.PlanBank.state && window.PlanBank.state.user;
    return u && u.uid || null;
  }
  function renderChildren() {
    var list = store.listChildren(owner());
    $('savedBtn').textContent = '📁 Yaddaşdan uşaq seç' + (list.length ? ' (' + list.length + ')' : '');
    $('childrenCard').hidden = !state.listOpen;
    $('childrenList').innerHTML = !list.length ? '<p class="muted">Bu hesabda hələ qeydə alınmış uşaq yoxdur.</p>' : list.map(function (c) {
      return '<div class="child-row"><div><b>' + esc(c.name) + '</b><span class="muted"> · ' + c.cycles + ' dövr · ' + esc(X.fmtDate(c.start)) + ' – ' + esc(X.fmtDate(c.end)) + '</span></div>' +
        '<div class="no-print"><button class="btn btn-outline btn-sm" data-action="open-child" data-key="' + esc(c.key) + '">Planı aç</button> ' +
        '<button class="btn btn-primary btn-sm" data-action="new-cycle" data-key="' + esc(c.key) + '">Yeni dövr</button> ' +
        '<button class="btn btn-ghost btn-sm" data-action="del-child" data-key="' + esc(c.key) + '">Sil</button></div></div>';
    }).join('');
  }

  /* ---------- plan yaratma ---------- */
  function onSubmit(ev) {
    ev.preventDefault();
    var f = collectForm();
    if (!f.ad || !f.diaqnoz || (!f.dogum && !f.yas)) { toast('Ad, doğum tarixi və əsas diaqnoz mütləq doldurulmalıdır.'); return; }
    if (!f.baslama) { f.baslama = E.todayISO(); $('f_baslama').value = f.baslama; }
    var me = owner();
    if (!me) { askLicense(); return; }
    var key = store.childKey(f, me);
    var child = store.getChild(key, me);
    var n = 1, prior = null;
    if (state.pending && state.pending.key === key) { n = state.pending.cycle; prior = state.pending.prior; }
    else if (child && child.cycles.length) {
      if (!window.confirm('Bu uşaq üçün plan artıq var. Son dövrün planı yenisi ilə əvəz olunsun? (Seans qeydləri silinəcək. Yeni ay üçün "Yeni dövr" düyməsindən istifadə edin.)')) return;
      n = child.cycles[child.cycles.length - 1].n;
    }
    Promise.all([loadBank(), state.catalogP]).then(function (all) {
      var b = all[0];
      if (b.mode !== 'full') { askLicense(); return; }
      var plan;
      try { plan = E.generate(f, b.bank, { catalog: state.catalog, cycle: n, prior: prior, childKey: key }); }
      catch (e) { toast('Plan yaradıla bilmədi: ' + e.message); return; }
      var prev = child && child.cycles.filter(function (c) { return c.n === n - 1; })[0];
      var cycle = { n: n, plan: plan, log: {}, results: {}, notes: [], form: f, mode: b.mode, prevResults: prev ? prev.results : null };
      saveCheck(store.putCycle(f, cycle, me));
      state.pending = null; state.childKey = key; state.cycleN = n; state.week = 1;
      $('cycleBanner').hidden = true;
      renderChildren(); renderPlan();
      $('planSection').hidden = false;
      $('planSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function loadBank() {
    if (state.bank) return Promise.resolve({ bank: state.bank, mode: state.mode });
    var p = window.PlanBank && window.PlanBank.get ? window.PlanBank.get() : fetch('data/demo-bank.json').then(function (r) { return r.json(); }).then(function (b) { return { bank: b, mode: 'demo' }; });
    return p.then(function (r) { state.bank = r.bank; state.mode = r.mode; renderModeBanner(); return r; });
  }
  function renderModeBanner() {
    var el = $('modeBanner');
    if (state.mode === 'full' || !state.bank) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = 'Lisenziya yoxdur: plan yaratmaq və yaradılmış planları açmaq üçün aktiv lisenziya lazımdır.';
  }

  /* ---------- plan göstərişi ---------- */
  function current() {
    var c = store.getChild(state.childKey, owner());
    if (!c) return null;
    var cy = c.cycles.filter(function (x) { return x.n === state.cycleN; })[0];
    return cy ? { child: c, cycle: cy } : null;
  }

  function renderPlan() {
    var cur = current();
    if (!cur) { $('planSection').hidden = true; return; }
    loadBank().then(function (b) {
      if (b.mode !== 'full') { $('planSection').hidden = true; return; }
      paint(cur, b.bank);
    });
  }
  function askLicense() {
    toast('Plan yaratmaq və açmaq üçün aktiv lisenziya lazımdır. Yuxarıdan Google ilə daxil olub sorğu göndərin.');
    var bar = $('licenseBar');
    if (bar && bar.scrollIntoView) bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function paint(cur, bank) {
    var f = cur.cycle.form || cur.child.form, p = cur.cycle.plan, log = cur.cycle.log || {};
    var name = [f.ad, f.soyad].filter(Boolean).join(' ');
    $('planTitleName').textContent = 'Fərdi Reabilitasiya Planı: ' + name;
    $('planTitleSub').textContent = p.profile.ageLabel + ' · dövr ' + cur.cycle.n + ' · ' + X.fmtDate(p.start) + ' – ' + X.fmtDate(p.end);
    var pr = E.progress(p, bank, log);
    $('planBadges').innerHTML = '<span class="badge">Həftədə ' + p.profile.sessionsPerWeek + ' seans</span><span class="badge">Ayda ' + p.sessions.length + ' seans</span>' +
      '<span class="badge">' + p.tests.length + ' test planlanıb</span><span class="badge">Sonrakı dövr: ' + esc(X.fmtDate(p.nextStart)) + '</span>';
    $('warningsBlock').innerHTML = X.warningsHtml(p).replace(/class="warn"/g, 'class="alert"');
    $('needsBody').innerHTML = X.needsHtml(p).replace(/<h2>.*?<\/h2>/, '');
    $('goalsGrid').innerHTML = X.goalsHtml(p).replace(/<h2>.*?<\/h2>/, '');
    paintTests(cur, p);
    paintWeeks(p);
    paintDays(cur, bank);
    paintReport(cur, bank, pr);
    paintCycleBox(cur, pr);
    paintApproval(cur.cycle); paintLenNote(cur);
  }

  function paintTests(cur, p) {
    var res = cur.cycle.results || {};
    var today = E.todayISO();
    if (!p.tests.length) { $('testsBody').innerHTML = '<p class="muted">Bu dövr üçün test planlaşdırılmayıb.</p>'; return; }
    var rows = p.tests.map(function (t, i) {
      var r = (res[t.id] && res[t.id][t.phase]) || {};
      var late = !r.score && t.date < today;
      return '<tr class="' + (late ? 'late' : '') + '"><td data-l="Tarix">' + esc(X.fmtDate(t.date)) + '<br><span class="muted">' + esc(X.wdName(t.date)) + ', gün ' + t.day + '</span></td>' +
        '<td data-l="Test"><b>' + esc(t.name) + '</b>' + (t.link ? '<br><a href="' + esc(t.link) + '" target="_blank" rel="noopener">Aləti aç</a>' : '') + '</td>' +
        '<td data-l="Mərhələ">' + esc(X.PHASE[t.phase]) + '</td><td data-l="Kim aparır">' + esc(X.SPEC_LABEL[t.who] || t.who) + (t.licensed ? '<br><span class="muted">lisenziyalı mütəxəssis</span>' : '') + '<br><span class="muted">~' + t.min + ' dəq</span></td>' +
        '<td data-l="Niyə" class="why">' + esc(t.reason) + '</td>' +
        '<td data-l="Nəticə"><input class="mini" aria-label="' + esc(t.name) + ' nəticə" data-test="' + esc(t.id) + '" data-phase="' + esc(t.phase) + '" data-f="score" value="' + esc(r.score || '') + '" placeholder="bal / nəticə">' +
        '<input class="mini" aria-label="' + esc(t.name) + ' qeyd" data-test="' + esc(t.id) + '" data-phase="' + esc(t.phase) + '" data-f="note" value="' + esc(r.note || '') + '" placeholder="qeyd">' +
        (r.score || r.note ? '<button type="button" class="btn btn-ghost btn-sm" data-action="del-test" data-test="' + esc(t.id) + '" data-phase="' + esc(t.phase) + '" aria-label="' + esc(t.name) + ' nəticəsini sil">Nəticəni sil</button>' : '') + '</td></tr>';
    }).join('');
    var any = p.tests.some(function (t) { var r = res[t.id] && res[t.id][t.phase]; return r && (r.score || r.note); });
    $('testsBody').innerHTML = '<p class="hint">Testlər 1-ci həftədə (başlanğıc), təxminən 15-ci gündə (ara) və ayın sonunda (yekun) planlaşdırılır, yəni hər 10-15 gündən bir. Nəticəni daxil edin: növbəti dövr planı və müqayisə bunlara əsaslanır.' + (cur.cycle.n > 1 ? ' IQ və Vineland kimi testlər hər ay təkrarlanmır.' : '') + '</p>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>Tarix</th><th>Test</th><th>Mərhələ</th><th>Kim aparır</th><th>Niyə</th><th>Nəticə</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + (X.deferredNote(p) ? '<p class="muted small">' + esc(X.deferredNote(p)) + '</p>' : '') +
      (any ? '<p class="no-print"><button type="button" class="btn btn-ghost btn-sm" data-action="del-all-tests">Bütün test nəticələrini sil</button></p>' : '');
  }
  function delTest(id, ph) {
    if (!window.confirm('Bu testin daxil edilmiş nəticəsi silinsin?')) return;
    saveCheck(store.updateCycle(state.childKey, state.cycleN, function (cy) {
      if (!cy.results || !cy.results[id]) return;
      delete cy.results[id][ph];
      if (!Object.keys(cy.results[id]).length) delete cy.results[id];
    }));
    renderPlan();
  }
  function delAllTests() {
    if (!window.confirm('Bu dövrdə daxil edilmiş BÜTÜN test nəticələri silinsin? Bu əməliyyat geri qaytarılmır.')) return;
    saveCheck(store.updateCycle(state.childKey, state.cycleN, function (cy) { cy.results = {}; }));
    renderPlan();
  }

  function paintWeeks(p) {
    $('weekNav').innerHTML = p.weeks.map(function (w) {
      return '<button type="button" class="wk' + (w.n === state.week ? ' on' : '') + '" data-action="week" data-w="' + w.n + '" aria-pressed="' + (w.n === state.week) + '">Həftə ' + w.n + '<small>' + esc(X.fmtDate(w.fromDate).slice(0, 5)) + ' – ' + esc(X.fmtDate(w.toDate).slice(0, 5)) + '</small></button>';
    }).join('');
  }

  function paintDays(cur, bank) {
    var p = cur.plan || cur.cycle.plan, log = cur.cycle.log || {};
    var w = p.weeks[state.week - 1];
    var today = E.todayISO();
    var html = '<p class="hint"><b>' + esc(w.theme) + '</b></p>';
    var sess = p.sessions.filter(function (s) { return s.week === state.week; });
    var homeDays = p.home.filter(function (d) { return d.day >= w.from && d.day <= w.to; });
    var byDay = {};
    sess.forEach(function (s) { byDay[s.day] = s; });
    homeDays.forEach(function (h) {
      var s = byDay[h.day];
      var tests = p.tests.filter(function (t) { return t.day === h.day; });
      html += '<details class="day' + (h.date === today ? ' today' : '') + '"' + (h.date === today ? ' open' : '') + '><summary><b>' + esc(X.fmtDate(h.date)) + '</b> · ' + esc(X.wdName(h.date)) + ' · gün ' + h.day +
        (s ? '' : ' <span class="muted">(mərkəzdə seans yoxdur)</span>') + (tests.length ? ' <span class="badge test">test: ' + esc(tests.map(function (t) { return t.name; }).join(', ')) + '</span>' : '') + '</summary>';
      if (s) E.SPECS.forEach(function (sp) { html += specHtml(s, sp, bank, log, p); });
      html += '<div class="spec spec-valideyn"><h3>' + esc(X.SPEC_LABEL.valideyn) + '</h3>' + h.items.map(function (it) { return X.activityBlock(bank, it, p.profile); }).join('') + '</div></details>';
    });
    $('daysContainer').innerHTML = html;
  }

  function specHtml(s, sp, bank, log, p) {
    var it = s.items[sp];
    if (!it) return '';
    var out = '<div class="spec spec-' + sp + '"><h3>' + esc(X.SPEC_LABEL[sp]) + (it.kind === 'baseline' && p.cycle === 1 ? ' · tanışlıq seansı' : it.kind === 'retest' ? ' · yekun mərhələ' : '') + ' <span class="muted">' + p.sessionMin + ' dəq</span></h3>';
    var rt = X.ritual(bank, sp, p, s); if (rt) out += '<p class="muted small"><b>Başlanğıc:</b> ' + esc(rt.open) + '<br><b>Son:</b> ' + esc(rt.close) + '</p>';
    it.list.forEach(function (item) {
      var k = s.day + '|' + sp + '|' + item.a;
      var e = log[k] || {};
      var rec = e.r ? E.recommendLevel(p, bank, log, sp, item.a, item.lv) : null;
      out += '<div class="actwrap">' + X.activityBlock(bank, item, p.profile) +
        '<div class="logrow no-print" data-key="' + esc(k) + '">' +
        '<label><input type="radio" name="att_' + esc(k) + '" data-f="att" value="bəli"' + (e.att === 'bəli' ? ' checked' : '') + '> iştirak etdi</label> ' +
        '<label><input type="radio" name="att_' + esc(k) + '" data-f="att" value="xeyr"' + (e.att === 'xeyr' ? ' checked' : '') + '> gəlmədi</label> ' +
        '<select data-f="r" aria-label="Müstəqillik qiyməti"><option value="">qiymət</option>' + [1, 2, 3, 4].map(function (n) { return '<option value="' + n + '"' + (String(e.r) === String(n) ? ' selected' : '') + '>' + esc(RATING[n]) + '</option>'; }).join('') + '</select> ' +
        '<input data-f="note" class="mini" placeholder="qeyd" aria-label="Seans qeydi" value="' + esc(e.note || '') + '">' +
        (rec && rec.change ? '<div class="rec">Tövsiyə: ' + esc(rec.why) + '</div>' : '') + '</div></div>';
    });
    return out + '</div>';
  }

  function paintReport(cur, bank, pr) {
    var p = cur.cycle.plan, names = {};
    Object.keys(bank.needs || {}).forEach(function (n) { names[n] = bank.needs[n].label; });
    var needRows = Object.keys(pr.byNeed).sort(function (a, b) { return pr.byNeed[b] - pr.byNeed[a]; }).map(function (n) {
      return '<div class="bar"><span>' + esc(names[n] || n) + '</span><div class="track"><i style="width:' + Math.round(pr.byNeed[n] / 4 * 100) + '%"></i></div><b>' + pr.byNeed[n] + '/4</b></div>';
    }).join('');
    var specRows = Object.keys(pr.bySpec).map(function (sp) { return '<span class="badge">' + esc(X.SPEC_LABEL[sp]) + ': ' + pr.bySpec[sp] + '/4</span>'; }).join('');
    var tn = p.tests.length, td = 0, res = cur.cycle.results || {};
    p.tests.forEach(function (t) { if (res[t.id] && res[t.id][t.phase] && res[t.id][t.phase].score) td++; });
    var prev = store.getChild(state.childKey, owner()).cycles.filter(function (c) { return c.n === cur.cycle.n - 1; })[0];
    $('reportBody').innerHTML = '<div class="stats"><div><b>' + pr.planned + '</b><span>planlaşdırılan məşğələ</span></div><div><b>' + pr.completionPct + '%</b><span>qeyd olunub</span></div>' +
      '<div><b>' + pr.attendancePct + '%</b><span>iştirak</span></div><div><b>' + (pr.avg == null ? '-' : pr.avg + '/4') + '</b><span>orta müstəqillik</span></div><div><b>' + td + '/' + tn + '</b><span>test nəticəsi daxil edilib</span></div></div>' +
      (specRows ? '<p>' + specRows + '</p>' : '') + (needRows ? '<h3>Sahələr üzrə orta müstəqillik</h3>' + needRows : '<p class="muted">Seans qeydləri daxil edildikcə sahələr üzrə irəliləyiş burada görünəcək.</p>') +
      (prev ? X.comparisonHtml(prev, cur.cycle) : '');
  }

  function paintCycleBox(cur, pr) {
    var p = cur.cycle.plan, today = E.todayISO();
    var endNear = today >= E.toISO(E.addDays(E.parseISO(p.start), 25));
    var hasNext = store.getChild(state.childKey, owner()).cycles.some(function (c) { return c.n === cur.cycle.n + 1; });
    $('cycleBox').innerHTML = '<p>' + (endNear ? '<b>Dövr başa çatır.</b> ' : '') + 'Yekun testlər aparıldıqdan və nəticələr daxil edildikdən sonra yeni dövrə keçin: forma əvvəlki məlumatlarla dolur, yenilənmiş qiymətləndirməyə görə yeni 30 günlük plan hazırlanır. Seans qeydlərindəki müstəqillik qiymətləri yeni planın başlanğıc səviyyəsini təyin edir.</p>' +
      '<button class="btn btn-primary" data-action="new-cycle" data-key="' + esc(state.childKey) + '">' + (hasNext ? 'Növbəti dövrü yenidən hazırla' : 'Yeni dövr hazırla') + '</button>';
  }

  /* ---------- yeni dövr ---------- */
  function startNextCycle(key) {
    var c = store.getChild(key, owner());
    if (!c) return;
    var last = c.cycles[c.cycles.length - 1];
    loadBank().then(function (b) {
      var seed = E.nextCycleSeed(last.plan, b.bank, last.log || {});
      state.pending = { key: key, cycle: last.n + 1, prior: seed };
      var f = Object.assign({}, last.form || c.form, { baslama: last.plan.nextStart });
      fillForm(f);
      var res = X.flatResults(last.results);
      var ids = Object.keys(res);
      $('cycleBanner').hidden = false;
      $('cycleBanner').innerHTML = '<b>Dövr ' + (last.n + 1) + ' üçün hazırlıq.</b> Yekun testlərin nəticələrinə görə formanı yeniləyin (məsələn, nitq səviyyəsi, diqqət müddəti, davranışlar), sonra «Planı hazırla» düyməsini basın.' +
        (ids.length ? '<br>Əvvəlki dövrün test nəticələri: ' + ids.map(function (id) { return esc((state.catalog[id] && state.catalog[id].ad) || id) + ': ' + esc(res[id].score); }).join(' · ') : '<br>Əvvəlki dövr üçün test nəticəsi daxil edilməyib; planı yalnız seans qeydlərinə görə yeniləmək olar.');
      $('intakeForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------- hadisələr ---------- */
  function onClick(ev) {
    var t = ev.target.closest('[data-action]');
    if (!t) return;
    var a = t.getAttribute('data-action'), key = t.getAttribute('data-key');
    if (a === 'week') { state.week = +t.getAttribute('data-w'); renderPlan(); }
    else if (a === 'toggle-children') toggleChildren();
    else if (a === 'open-child') openChild(key);
    else if (a === 'new-cycle') startNextCycle(key);
    else if (a === 'del-child') { if (window.confirm('Bu uşağın bütün planları və qeydləri silinsin?')) { saveCheck(store.removeChild(key, owner())); touch(key); if (state.childKey === key) { state.childKey = null; $('planSection').hidden = true; } renderChildren(); } }
    else if (a === 'new-assessment') newAssessment();
    else if (a === 'print') withCur(function (c, b) { showDoc(X.fullHtml(c.form(), c.cycle, b), fname(c, 'plan', 'html')); });
    else if (a === 'spec-print') withCur(function (c, b) { showDoc(X.specialistHtml(c.form(), c.cycle, b, { spec: $('specSel').value, week: +$('specPeriod').value || 0, perSession: $('specPerSession').checked }), fname(c, 'mutexessis-' + $('specSel').value, 'html')); });
    else if (a === 'del-test') delTest(t.getAttribute('data-test'), t.getAttribute('data-phase'));
    else if (a === 'del-all-tests') delAllTests();
    else if (a === 'retime') retime();
    else if (a === 'sig-clear') clearSig();
    else if (a === 'approve') approve();
    else if (a === 'unapprove') unapprove();
    else if (a === 'html') withCur(function (c, b) { showDoc(X.fullHtml(c.form(), c.cycle, b), fname(c, 'plan', 'html')); });
    else if (a === 'parent') withCur(function (c, b) { showDoc(X.parentHtml(c.form(), c.cycle, b), fname(c, 'valideyn', 'html')); });
    else if (a === 'doc-close') closeDoc();
    else if (a === 'doc-print') printViewed();
    else if (a === 'doc-save') { if (state.doc) download(state.doc.html, state.doc.name, 'text/html'); }
    else if (a === 'backup') download(store.exportAll(), 'plan-ehtiyat-' + E.todayISO() + '.json', 'application/json');
    else if (a === 'import') $('importFile').click();
    else if (a === 'goto') { var el = $(t.getAttribute('data-target')); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
  }
  function showDoc(html, name) {
    closeDoc();
    var box = document.createElement('div');
    box.id = 'docViewer';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Sənəd');
    box.innerHTML = '<div class="dv-bar no-print"><button type="button" class="btn btn-sm btn-outline" data-action="doc-close">← Geri</button>' +
      '<button type="button" class="btn btn-sm btn-primary" data-action="doc-print">Çap / PDF</button>' +
      '<button type="button" class="btn btn-sm btn-outline" data-action="doc-save">Yüklə (.html)</button></div>' +
      '<p class="dv-hint no-print">Telefonda çap və ya PDF üçün brauzer menyusundan (⋮) “Çap et” və ya “Paylaş” seçin.</p>';
    var fr = document.createElement('iframe');
    fr.className = 'dv-frame'; fr.title = 'Sənəd';
    fr.onload = function () { fitDoc(); };
    fr.srcdoc = html;
    box.appendChild(fr);
    document.body.appendChild(box);
    document.body.classList.add('viewing');
    state.doc = { html: html, name: name, frame: fr };
    box.scrollTop = 0;
    var back = box.querySelector('[data-action="doc-close"]');
    if (back) back.focus();
  }
  function fitDoc() {
    var d = state.doc;
    if (!d || !d.frame.contentDocument) return;
    d.frame.style.height = (d.frame.contentDocument.documentElement.scrollHeight + 8) + 'px';
  }
  function closeDoc() {
    var v = document.getElementById('docViewer');
    if (v) v.remove();
    document.body.classList.remove('viewing');
    state.doc = null;
  }
  function printViewed() {
    var d = state.doc;
    if (!d) return;
    try { d.frame.contentWindow.focus(); d.frame.contentWindow.print(); } catch (e) { window.print(); }
  }

  function paintLenNote(cur) {
    var box = $('lenNote');
    if (!box) return;
    var want = E.deriveProfile(cur.cycle.form || cur.child.form).sessionLen;
    var have = cur.cycle.plan.sessionMin;
    box.innerHTML = have === want ? '' : '<div class="banner"><b>Bu plan ' + have + ' dəqiqəlik seans üçün qurulub.</b> Seçilmiş müddət ' + want + ' dəqiqədir. Məşğələlər, seans qeydləri və testlər olduğu kimi qalır, yalnız hər məşğələnin vaxtı yenidən bölünür.<div style="margin-top:8px"><button type="button" class="btn btn-primary btn-sm" data-action="retime">' + want + ' dəqiqəyə yenilə</button></div></div>';
  }
  function retime() {
    var cur = current();
    if (!cur) return;
    var want = E.deriveProfile(cur.cycle.form || cur.child.form).sessionLen;
    saveCheck(store.updateCycle(state.childKey, state.cycleN, function (cy) { cy.plan = E.retimePlan(cy.plan, want); }));
    renderPlan();
    toast('Plan ' + want + ' dəqiqəlik seansa görə yeniləndi.');
  }

  function paintApproval(cy) {
    var box = $('approvalBlock');
    if (!box) return;
    var a = cy.approval;
    if (a && a.by) {
      box.innerHTML = '<div class="appr-box ok"><span><b>Təsdiq edilib.</b> ' + esc(a.by) + (a.role ? ' (' + esc(a.role) + ')' : '') + ' · ' + esc(X.fmtDate(a.at)) + '</span>' +
        (X.safeSig(a.sig) ? '<img class="sig-thumb" alt="İmza" src="' + X.safeSig(a.sig) + '">' : '') +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="unapprove">Təsdiqi ləğv et</button></div>';
      return;
    }
    var last = ''; try { last = localStorage.getItem('plan_approver') || ''; } catch (e) { /* kənar */ }
    box.innerHTML = '<div class="appr-box wait"><span><b>Təsdiq gözlənilir.</b> Mərkəz müdiri planı təsdiqləməlidir.</span>' +
      '<input id="apprName" placeholder="Müdirin adı, soyadı" aria-label="Müdirin adı, soyadı" maxlength="80" value="' + esc(last) + '">' +
      '<input id="apprRole" placeholder="Vəzifə" aria-label="Vəzifə" maxlength="60" value="Mərkəz müdiri">' +
      '<div class="sig-wrap"><label for="sigPad">İmza (barmaqla və ya qələmlə çəkin, istəyə bağlı)</label>' +
      '<canvas id="sigPad" width="480" height="160" aria-label="İmza sahəsi"></canvas>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="sig-clear">Təmizlə</button></div>' +
      '<button type="button" class="btn btn-primary btn-sm" data-action="approve">Təsdiq et</button></div>';
    initSigPad();
  }

  function initSigPad() {
    var c = $('sigPad');
    state.sigDrawn = false;
    var ctx = c && c.getContext && c.getContext('2d');
    if (!ctx) { if (c) c.parentNode.hidden = true; return; }
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0c2f3d';
    var down = false;
    function pt(e) { var r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; }
    c.addEventListener('pointerdown', function (e) {
      down = true; var p = pt(e);
      if (c.setPointerCapture) try { c.setPointerCapture(e.pointerId); } catch (x) { /* kənar */ }
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke(); state.sigDrawn = true;
      e.preventDefault();
    });
    c.addEventListener('pointermove', function (e) { if (!down) return; var p = pt(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { c.addEventListener(n, function () { down = false; }); });
  }
  function clearSig() {
    var c = $('sigPad'), ctx = c && c.getContext && c.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    state.sigDrawn = false;
  }
  function approve() {
    var by = ($('apprName').value || '').trim(), role = ($('apprRole').value || '').trim();
    if (by.length < 3) { toast('Təsdiq edənin adı və soyadı yazılmalıdır.'); return; }
    try { localStorage.setItem('plan_approver', by); } catch (e) { /* kənar */ }
    var sig = '';
    if (state.sigDrawn) { try { sig = X.safeSig($('sigPad').toDataURL('image/png')) || ''; } catch (e) { sig = ''; } }
    saveCheck(store.updateCycle(state.childKey, state.cycleN, function (cy) { cy.approval = { by: by, role: role, at: E.todayISO(), sig: sig }; }));
    renderPlan();
  }
  function unapprove() {
    if (!window.confirm('Təsdiq ləğv edilsin?')) return;
    saveCheck(store.updateCycle(state.childKey, state.cycleN, function (cy) { delete cy.approval; }));
    renderPlan();
  }

  function toggleChildren(force) {
    state.listOpen = typeof force === 'boolean' ? force : !state.listOpen;
    $('childrenCard').hidden = !state.listOpen;
    $('savedBtn').setAttribute('aria-expanded', state.listOpen ? 'true' : 'false');
    if (state.listOpen) $('childrenCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openChild(key) {
    var c = store.getChild(key, owner());
    if (!c) return;
    toggleChildren(false);
    var last = c.cycles[c.cycles.length - 1];
    state.childKey = key; state.cycleN = last.n; state.week = 1;
    fillForm(last.form || c.form);
    renderPlan();
    $('planSection').hidden = false;
    $('planSection').scrollIntoView({ behavior: 'smooth' });
  }

  function newAssessment() {
    $('intakeForm').reset();
    setChips('behaviorChips', []); setChips('sensoryChips', []);
    state.pending = null; $('cycleBanner').hidden = true;
    $('f_baslama').value = E.todayISO();
    prefillKurator();
    updateSeansInfo();
    $('intakeForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function toggleSection(el) {
    var open = el.classList.toggle('open');
    el.nextElementSibling.classList.toggle('open', open);
    el.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function withCur(fn) {
    var cur = current();
    if (!cur) return;
    loadBank().then(function (b) { if (b.mode !== 'full') { askLicense(); return; } fn({ cycle: cur.cycle, child: cur.child, form: function () { return cur.cycle.form || cur.child.form; } }, b.bank); });
  }
  function fname(c, kind, ext) {
    var f = c.form();
    return (kind + '-' + [f.ad, f.soyad].filter(Boolean).join('-') + '-dovr' + c.cycle.n + '.' + ext).replace(/[^\w.\-əöüçşğıƏÖÜÇŞĞİ]+/g, '_');
  }
  function download(text, name, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function onChange(ev) {
    var t = ev.target, row = t.closest('.logrow');
    if (row) {
      var key = row.getAttribute('data-key'), parts = key.split('|');
      var field = t.getAttribute('data-f');
      saveCheck(store.updateCycle(state.childKey, state.cycleN, function (cy) {
        cy.log = cy.log || {};
        var e = cy.log[key] = cy.log[key] || {};
        e[field] = t.value;
        if (field === 'att' && t.value === 'xeyr') delete e.r;
      }));
      if (field !== 'note') { var cur = current(); loadBank().then(function (b) { paintReport(cur, b.bank, E.progress(cur.cycle.plan, b.bank, cur.cycle.log)); if (field === 'r') paintDaysKeepOpen(cur, b.bank); }); }
      return;
    }
    if (t.hasAttribute('data-test')) {
      var id = t.getAttribute('data-test'), ph = t.getAttribute('data-phase'), f = t.getAttribute('data-f');
      saveCheck(store.updateCycle(state.childKey, state.cycleN, function (cy) {
        cy.results = cy.results || {};
        var r = (cy.results[id] = cy.results[id] || {})[ph] = cy.results[id][ph] || { date: E.todayISO() };
        r[f] = t.value.trim();
      }));
      var c2 = current(); loadBank().then(function (b) { paintReport(c2, b.bank, E.progress(c2.cycle.plan, b.bank, c2.cycle.log)); });
    }
  }
  function paintDaysKeepOpen(cur, bank) {
    var open = [].slice.call(document.querySelectorAll('#daysContainer details.day[open]')).map(function (d) { return d.querySelector('summary b').textContent; });
    paintDays(cur, bank);
    [].forEach.call(document.querySelectorAll('#daysContainer details.day'), function (d) { if (open.indexOf(d.querySelector('summary b').textContent) >= 0) d.open = true; });
  }

  function onImport(ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('Fayl çox böyükdür.'); return; }
    var r = new FileReader();
    r.onload = function () {
      var res = store.importData(String(r.result), 'merge', owner());
      if (!res.ok) { toast(res.error || 'Fayl yüklənmədi'); return; }
      toast('Yükləndi: ' + res.added + ' dövr əlavə olundu.');
      renderChildren(); cloudSync();
      var first = store.listChildren(owner())[0];
      if (first) openChild(first.key);
    };
    r.readAsText(file);
    ev.target.value = '';
  }

  function beforePrint() { [].forEach.call(document.querySelectorAll('details'), function (d) { d.setAttribute('data-was', d.open ? '1' : '0'); d.open = true; }); }
  function afterPrint() { [].forEach.call(document.querySelectorAll('details[data-was]'), function (d) { d.open = d.getAttribute('data-was') === '1'; d.removeAttribute('data-was'); }); }

  function init() {
    $('yr').textContent = new Date().getFullYear();
    buildChips('behaviorChips', BEHAVIOR_LIST); buildChips('sensoryChips', SENSORY_LIST);
    ensureBlankOptions();
    [].forEach.call(document.querySelectorAll('.field'), function (f) {
      var l = f.querySelector('label'), c = f.querySelector('input,select,textarea');
      if (l && c && c.id && !l.getAttribute('for')) l.setAttribute('for', c.id);
    });
    if (!$('f_baslama').value) $('f_baslama').value = E.todayISO();
    $('f_dogum').addEventListener('change', calcAge);
    $('f_seans').addEventListener('change', updateSeansInfo);
    $('f_baslama').addEventListener('change', updateSeansInfo);
    $('intakeForm').addEventListener('submit', onSubmit);
    [].forEach.call(document.querySelectorAll('.section-toggle'), function (t) { t.setAttribute('role', 'button'); t.setAttribute('tabindex', '0'); t.setAttribute('aria-expanded', 'false'); });
    document.addEventListener('click', function (ev) { var t = ev.target.closest('.section-toggle'); if (t) toggleSection(t); });
    document.addEventListener('keydown', function (ev) { var t = ev.target.closest && ev.target.closest('.section-toggle'); if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); toggleSection(t); } });
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    $('importFile').addEventListener('change', onImport);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && state.doc) closeDoc(); });
    window.addEventListener('resize', fitDoc);
    window.addEventListener('beforeprint', beforePrint); window.addEventListener('afterprint', afterPrint);
    updateSeansInfo();
    if (!safeLocal()) toast('Brauzer yaddaşı əlçatan deyil: qeydlər bu səhifə bağlananda itəcək. Ehtiyat nüsxə yükləyin.');
    state.catalogP = fetch('data/tests-catalog.json').then(function (r) { return r.json(); }).then(function (c) { state.catalog = c; }).catch(function () { state.catalog = {}; });
    syncOwner();
    if (window.PlanBank && window.PlanBank.get) window.PlanBank.get().then(function () { syncOwner(); cloudSync(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - cloud.at > 60000) cloudSync(); });
  }

  function prefillKurator() {
    var u = window.PlanBank && window.PlanBank.state && window.PlanBank.state.user;
    var f = $('f_kurator');
    if (u && f && !f.value.trim()) f.value = (u.name || '').trim();
  }

  function syncOwner() {
    var me = owner();
    prefillKurator();
    if (me) store.adoptLegacy(me);
    renderChildren();
    var cur = state.childKey && store.getChild(state.childKey, me);
    if (!cur) {
      state.childKey = null;
      var list = store.listChildren(me);
      if (list.length) { var c = store.getChild(list[0].key, me); state.childKey = list[0].key; state.cycleN = c.cycles[c.cycles.length - 1].n; $('planSection').hidden = false; renderPlan(); }
      else $('planSection').hidden = true;
    } else if (!$('planSection').hidden) renderPlan();
  }

  function onLicenseChange() {
    state.bank = null;
    syncOwner();
    cloudSync();
    renderModeBanner();
  }

  window.PlanApp = { init: init, state: state, onLicenseChange: onLicenseChange };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
