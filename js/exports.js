(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./brand.js'));
  else root.PlanExports = factory(root.Engine, root.PlanBrand);
})(typeof self !== 'undefined' ? self : this, function (E, B) {
  'use strict';

  var SPEC_LABEL = { psixoloq: 'Klinik psixoloq', loqoped: 'Loqoped', ergoterapevt: 'Erqoterapevt', pedaqoq: 'Psixopedaqoq', valideyn: 'Valideyn (ev proqramı)' };
  var WD = ['', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar'];
  var PHASE = { baseline: 'Başlanğıc yoxlama', mid: 'Ara yoxlama', retest: 'Yekun təkrar test' };
  var LV = { 1: 'Səviyyə 1 (giriş, tam dəstək)', 2: 'Səviyyə 2 (möhkəmlətmə, qismən dəstək)', 3: 'Səviyyə 3 (müstəqillik, ümumiləşdirmə)' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fmtDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function wdName(iso) { var d = E.parseISO(iso); if (!d) return ''; var w = d.getUTCDay(); return WD[w === 0 ? 7 : w]; }
  function list(items, ord) {
    var tag = ord ? 'ol' : 'ul';
    return '<' + tag + '>' + (items || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</' + tag + '>';
  }

  function ritual(bank, sp, plan, s) {
    var r = bank.rituals && bank.rituals[sp];
    if (!r) return null;
    var teen = plan && plan.profile && plan.profile.ageM != null && plan.profile.ageM >= 144;
    var list = (teen ? r.teen : r.kid) || [r];
    return list[(s && s.day ? s.day : 0) % list.length];
  }

  function activityBlock(bank, item) {
    var a = bank.act[item.a];
    if (!a) return '<div class="act"><p class="muted">Bu məşğələ cari baza ilə açılmır. Tam məzmun üçün aktiv lisenziya lazımdır.</p></div>';
    var lv = a.levels[item.lv] || a.levels[1];
    var st = item.st != null && a.steps ? a.steps[item.st] : null;
    return '<div class="act">' +
      '<h4>' + esc(a.t) + (st ? ' — ' + esc(st.t) : '') + ' <span class="lv">' + esc(LV[item.lv]) + ' · ' + item.min + ' dəq</span></h4>' +
      (st ? '<p><b>Bu seansın tapşırığı:</b> ' + esc(st.do) + '</p>' : '<p><b>Bu seansın məqsədi:</b> ' + esc(lv.g) + '</p>') +
      '<p><b>Dəstək səviyyəsi:</b> ' + esc(lv.sup) + '</p>' +
      '<p><b>Uğur meyarı:</b> ' + esc(st ? st.ok : lv.ok) + '</p>' +
      '<p><b>Niyə vacibdir:</b> ' + esc(a.why) + '</p>' +
      '<p><b>Material:</b> ' + esc(a.prep) + '</p>' +
      '<p><b>Necə aparılır:</b></p>' + list(a.how, true) +
      '<p><b>Nə demək olar:</b> ' + (a.say || []).map(function (x) { return '<i>' + esc(x) + '</i>'; }).join(' · ') + '</p>' +
      '<p><b>Nədən çəkinmək lazımdır:</b> ' + esc(a.avoid) + '</p>' +
      '<p><b>Nəyi qeyd etmək lazımdır:</b> ' + esc(a.measure) + '</p>' +
      '<p><b>Çətin olarsa:</b> ' + esc(a.easier) + '</p>' +
      '<p><b>Asan olarsa:</b> ' + esc(a.harder) + '</p>' +
      '<p><b>Evdə davamı:</b> ' + esc(a.home) + '</p>' +
      '</div>';
  }

  var CSS = 'body{font-family:Segoe UI,Arial,sans-serif;color:#1d2a30;line-height:1.5;font-size:13px;margin:24px}' +
    '.center{margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#0e6a82;font-weight:700}h1{font-size:22px;color:#0c2f3d;margin:0 0 4px}h2{font-size:17px;color:#0e6a82;border-bottom:2px solid #e1ddd1;padding-bottom:4px;margin-top:26px}' +
    'h3{font-size:14px;background:#e8f3f5;padding:6px 10px;border-radius:6px;margin:16px 0 6px}h4{font-size:13px;margin:10px 0 4px;color:#0c2f3d}' +
    '.lv{font-weight:400;color:#5d6b72;font-size:11px}.act{border:1px solid #e1ddd1;border-radius:8px;padding:8px 12px;margin:8px 0}' +
    '.act p{margin:3px 0}.act ol,.act ul{margin:3px 0 3px 18px;padding:0}table{border-collapse:collapse;width:100%;margin:8px 0}' +
    'td,th{border:1px solid #d9d4c6;padding:5px 7px;text-align:left;vertical-align:top;font-size:12px}th{background:#e8f3f5}' +
    '.warn{border:2px solid #c0392b;background:#fdecea;padding:8px 12px;border-radius:8px;margin:8px 0}.muted{color:#5d6b72}' +
    '.day{margin-top:14px}.newpage{page-break-before:always}.recbox{border:1px dashed #b3ad9c;border-radius:8px;padding:6px 12px;margin:-2px 0 10px;page-break-inside:avoid}.rec{margin:4px 0}.line{display:inline-block;border-bottom:1px solid #8d8776;width:70%}h2,h3,h4{page-break-after:avoid}.act p,.act li{orphans:3;widows:3}tr{page-break-inside:avoid}' +
    '.appr{border:2px solid;border-radius:8px;padding:8px 12px;margin:10px 0;page-break-inside:avoid}.appr.ok{border-color:#1f7a4d;background:#eaf7f0}.appr.wait{border-color:#c0392b;background:#fdecea}.appr .sig{margin-top:14px}.sigimg{height:56px;vertical-align:middle}' +
    '.brandrow{display:flex;align-items:center;gap:12px;margin:0 0 8px}.brandrow .center{margin:0}.minihead{display:flex;align-items:center;gap:10px;border-bottom:2px solid #e1ddd1;padding-bottom:8px;margin-bottom:10px;font-size:12px;color:#5d6b72}' +
    '@page{margin:14mm}footer{margin-top:30px;font-size:11px;color:#5d6b72;border-top:1px solid #e1ddd1;padding-top:8px}';

  function safeSig(s) {
    return typeof s === 'string' && s.length < 60000 && /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(s) ? s : '';
  }

  function approvalHtml(cycle) {
    var a = cycle && cycle.approval;
    if (a && a.by) {
      var sig = safeSig(a.sig);
      return '<div class="appr ok"><b>Təsdiq edilib.</b> ' + esc(a.by) + (a.role ? ' (' + esc(a.role) + ')' : '') + ' · ' + fmtDate(a.at) +
        '<div class="sig">İmza: ' + (sig ? '<img class="sigimg" alt="İmza" src="' + sig + '">' : '______________________') + '</div></div>';
    }
    return '<div class="appr wait"><b>Təsdiq gözlənilir (qaralama).</b> Plan mərkəz rəhbərliyi tərəfindən təsdiqlənənədək tətbiq edilməməlidir.' +
      '<div class="sig">Mərkəz müdiri: ______________________ &nbsp; İmza: ____________ &nbsp; Tarix: ____________</div></div>';
  }

  var CENTER = 'AN Psixoloji Dəstək və Reabilitasiya Mərkəzi';
  function brandRow() {
    return '<div class="brandrow">' + B.logo(56) + '<p class="center">' + CENTER + '</p></div>';
  }
  function miniHead(name, what) {
    return '<div class="minihead">' + B.logo(26) + '<span><b>' + esc(CENTER) + '</b> · ' + esc(name) + ' · ' + esc(what) + '</span></div>';
  }

  function headerHtml(form, cycle) {
    var p = cycle.plan, name = [form.ad, form.soyad].filter(Boolean).join(' ');
    return brandRow() +
      '<h1>' + esc(name) + ', ' + esc(p.profile.ageLabel) + ' · Reabilitasiya Planı</h1>' +
      '<p class="muted">' + (form.kurator ? 'Kurator mütəxəssis: <b>' + esc(form.kurator) + '</b> · ' : '') +
      'Dövr ' + cycle.n + ' · ' + fmtDate(p.start) + ' – ' + fmtDate(p.end) + ' · həftədə ' + p.profile.sessionsPerWeek + ' seans (ayda ' + p.sessions.length + ')' +
      (form.diaqnoz ? ' · Diaqnoz: ' + esc(form.diaqnoz) : '') + '</p>' +
      '<p class="muted">Növbəti dövr: ' + fmtDate(p.nextStart) + ' tarixindən, yekun testlərdən sonra yeni plan hazırlanır.</p>' + approvalHtml(cycle);
  }

  function deferredNote(p) {
    var d = p.testsDeferred || [];
    return d.length ? 'Yüklənmə çox olmasın deyə bu dövrdə planlaşdırılmayan testlər: ' + d.join(', ') + '. Mütəxəssis lazım bilərsə əlavə edə bilər.' : '';
  }

  var RATING_LINE = '1 tam dəstək · 2 qismən · 3 az dəstək · 4 müstəqil';

  function sessionRecordBox(e) {
    var att = e && e.att;
    var line = '<p class="rec">İştirak: ' + (att === 'bəli' ? '<b>☒ bəli</b> ☐ xeyr' : att === 'xeyr' ? '☐ bəli <b>☒ xeyr</b>' : '☐ bəli &nbsp; ☐ xeyr') +
      ' &nbsp;·&nbsp; Qiymət (' + RATING_LINE + '): ' + (e && e.r ? '<b>' + esc(e.r) + '</b>' : '____') + '</p>' +
      '<p class="rec">Qeyd: ' + (e && e.note ? esc(e.note) : '<span class="line"></span>') + '</p>';
    return '<div class="recbox">' + line + '</div>';
  }

  function specialistHtml(form, cycle, bank, opts) {
    var p = cycle.plan, sp = opts.spec, log = cycle.log || {};
    var wk = opts.week ? p.weeks[opts.week - 1] : null;
    var sess = p.sessions.filter(function (s) { return s.items[sp] && (!wk || s.week === wk.n); });
    var tests = p.tests.filter(function (t) { return t.who === sp && (!wk || (t.day >= wk.from && t.day <= wk.to)); });
    var title = SPEC_LABEL[sp] + ' planı · ' + (wk ? 'həftə ' + wk.n + ' (' + fmtDate(wk.fromDate) + ' – ' + fmtDate(wk.toDate) + ')' : 'bütün ay');
    var name = [form.ad, form.soyad].filter(Boolean).join(' ');
    var out = brandRow() +
      '<h1>' + esc(name) + ', ' + esc(p.profile.ageLabel) + ' · ' + esc(title) + '</h1>' +
      '<p class="muted">' + (form.kurator ? 'Kurator mütəxəssis: <b>' + esc(form.kurator) + '</b> · ' : '') + 'Dövr ' + cycle.n + ' · ' + fmtDate(p.start) + ' – ' + fmtDate(p.end) +
      (form.diaqnoz ? ' · Diaqnoz: ' + esc(form.diaqnoz) : '') + ' · seans ' + p.sessionMin + ' dəq</p>' + approvalHtml(cycle) + warningsHtml(p);
    if (wk) out += '<p class="muted"><b>Həftənin mövzusu:</b> ' + esc(wk.theme) + '</p>';
    if (tests.length) {
      out += '<h2>Bu dövrdə sizin aparacağınız testlər</h2><table><tr><th>Tarix</th><th>Test</th><th>Mərhələ</th><th>Müddət</th><th>Niyə</th></tr>' +
        tests.map(function (t) { return '<tr><td>' + fmtDate(t.date) + '<br><span class="muted">' + esc(wdName(t.date)) + ', gün ' + t.day + '</span></td><td><b>' + esc(t.name) + '</b></td><td>' + esc(PHASE[t.phase]) + '</td><td>~' + t.min + ' dəq</td><td>' + esc(t.reason) + '</td></tr>'; }).join('') + '</table>';
    }
    if (!sess.length) return wrap(title + ' ' + name, out + '<p class="muted">Bu dövrdə seçilmiş müddət üçün bu mütəxəssisə seans planlaşdırılmayıb.</p>');
    out += '<h2>Seanslar</h2>';
    sess.forEach(function (s, i) {
      var it = s.items[sp];
      out += '<div class="day' + (opts.perSession && i > 0 ? ' newpage' : '') + '">' + (opts.perSession && i > 0 ? miniHead(name, SPEC_LABEL[sp]) : '') + '<h3>' + fmtDate(s.date) + ', ' + esc(WD[s.weekday]) + ' (gün ' + s.day + ', həftə ' + s.week + ')' +
        (it.kind === 'baseline' ? ' · tanışlıq seansı' : it.kind === 'retest' ? ' · yekun mərhələ' : '') + '</h3>';
      var dt = p.tests.filter(function (t) { return t.day === s.day && t.who === sp; });
      if (dt.length) out += '<p><b>Bu gün test:</b> ' + dt.map(function (t) { return esc(t.name + ' (' + PHASE[t.phase] + ', ~' + t.min + ' dəq)'); }).join(', ') + '</p>';
      var rt = ritual(bank, sp, p, s); if (rt) out += '<p class="muted"><b>Başlanğıc:</b> ' + esc(rt.open) + ' <b>Son:</b> ' + esc(rt.close) + '</p>';
      it.list.forEach(function (item) {
        out += activityBlock(bank, item) + sessionRecordBox(log[s.day + '|' + sp + '|' + item.a]);
      });
      out += '</div>';
    });
    return wrap(title + ' ' + name, out);
  }

  function warningsHtml(p) {
    return (p.warnings || []).map(function (w) { return '<div class="warn"><b>Təhlükəsizlik qeydi:</b> ' + esc(w) + '</div>'; }).join('');
  }

  function goalsHtml(p) {
    function sec(title, arr) {
      return '<h3>' + esc(title) + '</h3><ul>' + arr.map(function (g) { return '<li><b>' + esc(g.label) + ':</b> ' + esc(g.text) + '</li>'; }).join('') + '</ul>';
    }
    return '<h2>Məqsədlər</h2>' + sec('Bu dövr (1 ay)', p.goals.short) + sec('3 aylıq', p.goals.mid) + sec('6-12 aylıq', p.goals.long);
  }

  function testsHtml(p, results) {
    if (!p.tests.length) return '<h2>Test cədvəli</h2><p class="muted">Bu dövr üçün test planlaşdırılmayıb.</p>';
    var rows = p.tests.map(function (t) {
      var r = results && results[t.id] && results[t.id][t.phase];
      return '<tr><td>' + fmtDate(t.date) + '<br><span class="muted">' + esc(wdName(t.date)) + ', gün ' + t.day + '</span></td><td><b>' + esc(t.name) + '</b></td><td>' + esc(PHASE[t.phase]) + '</td><td>' + esc(SPEC_LABEL[t.who] || t.who) + (t.licensed ? '<br><span class="muted">lisenziyalı mütəxəssis</span>' : '') + '</td><td>~' + t.min + ' dəq</td><td>' + esc(t.reason) + '</td><td>' + (r ? esc(r.score + (r.note ? ' · ' + r.note : '')) : '') + '</td></tr>';
    }).join('');
    return '<h2>Test cədvəli</h2><table><tr><th>Tarix</th><th>Test</th><th>Mərhələ</th><th>Kim aparır</th><th>Müddət</th><th>Niyə</th><th>Nəticə</th></tr>' + rows + '</table>' + (deferredNote(p) ? '<p class="muted">' + esc(deferredNote(p)) + '</p>' : '');
  }

  function needsHtml(p) {
    var names = { joint: 'Göz kontaktı və birgə diqqət', play: 'Oyun və növbə', emotion: 'Emosiyalar', behavior: 'Problem davranış', anxiety: 'Narahatlıq', attention: 'Diqqət və yaddaş', expressive: 'İfadəli nitq', receptive: 'Nitqi anlama', artic: 'Səs tələffüzü', aac: 'Alternativ ünsiyyət', oral: 'Ağız-üz motorikası', gross: 'İri motorika', fine: 'Xırda motorika', sensory: 'Sensor xüsusiyyətlər', selfcare: 'Özünəxidmət', toilet: 'Tualet vərdişi', prewrite: 'Qələm və yazıya hazırlıq', academic: 'Koqnitiv və akademik hazırlıq' };
    var lab = ['Problem yoxdur', 'Yüngül', 'Orta', 'Əhəmiyyətli'];
    var rows = Object.keys(p.profile.needs).sort(function (a, b) { return p.profile.needs[b] - p.profile.needs[a]; }).map(function (n) {
      var r = (p.profile.reasons[n] || []).join('; ');
      return '<tr><td>' + esc(names[n] || n) + '</td><td>' + lab[p.profile.needs[n]] + '</td><td>' + esc(r) + '</td></tr>';
    }).join('');
    var unk = p.profile.unknown.length ? '<p class="muted">Doldurulmamış sahələr (plan bu sahələr üçün orta qiymət götürüb): ' + esc(p.profile.unknown.join(', ')) + '</p>' : '';
    return '<h2>Plan nəyə əsaslanır</h2><table><tr><th>Sahə</th><th>Ehtiyac dərəcəsi</th><th>Səbəb</th></tr>' + rows + '</table>' + unk;
  }

  function sessionsHtml(p, bank, log) {
    var out = '<h2>Seanslar</h2>';
    var byWeek = {};
    p.sessions.forEach(function (s) { (byWeek[s.week] = byWeek[s.week] || []).push(s); });
    Object.keys(byWeek).forEach(function (w) {
      var wk = p.weeks[w - 1];
      out += '<h3>Həftə ' + w + ': ' + esc(wk.theme) + ' (' + fmtDate(wk.fromDate) + ' – ' + fmtDate(wk.toDate) + ')</h3>';
      byWeek[w].forEach(function (s) {
        out += '<div class="day"><h4>' + fmtDate(s.date) + ', ' + esc(WD[s.weekday]) + ' (gün ' + s.day + ')</h4>';
        var dayTests = p.tests.filter(function (t) { return t.day === s.day; });
        if (dayTests.length) out += '<p><b>Bu gün test:</b> ' + dayTests.map(function (t) { return esc(t.name + ' (' + PHASE[t.phase] + ')'); }).join(', ') + '</p>';
        E.SPECS.forEach(function (sp) {
          var it = s.items[sp];
          if (!it) return;
          out += '<h3>' + esc(SPEC_LABEL[sp]) + (it.kind === 'baseline' ? ' · tanışlıq seansı' : it.kind === 'retest' ? ' · yekun mərhələ' : '') + '</h3>';
          var rt = ritual(bank, sp, p, s); if (rt) out += '<p class="muted"><b>Başlanğıc:</b> ' + esc(rt.open) + ' <b>Son:</b> ' + esc(rt.close) + '</p>';
          it.list.forEach(function (item) {
            var e = log && log[s.day + '|' + sp + '|' + item.a];
            out += activityBlock(bank, item);
            if (e) out += '<p class="muted">Qeyd: ' + (e.att === 'xeyr' ? 'iştirak etmədi' : 'iştirak etdi, qiymət ' + esc(e.r || '-')) + (e.note ? ' · ' + esc(e.note) : '') + '</p>';
          });
        });
        out += '</div>';
      });
    });
    return out;
  }

  function homeHtml(p, bank, onlyFirst) {
    var out = '<h2>Ev proqramı (valideyn üçün)</h2><p class="muted">Gündə ayrılan vaxt: ' + p.profile.homeMin + ' dəq. Hər tapşırıq mütəxəssislərin seanslarında işlənən bacarığı davam etdirir.</p>';
    p.home.forEach(function (d) {
      if (onlyFirst && d.day > 7) return;
      out += '<div class="day"><h4>' + fmtDate(d.date) + ', ' + esc(wdName(d.date)) + ' (gün ' + d.day + ')</h4>';
      d.items.forEach(function (item) { out += activityBlock(bank, item); });
      out += '</div>';
    });
    return out;
  }

  function wrap(title, body) {
    return '<!DOCTYPE html><html lang="az"><head><meta charset="UTF-8"><title>' + esc(title) + '</title><style>' + CSS + '</style></head><body>' + body +
      '<footer>AN Psixoloji Dəstək və Reabilitasiya Mərkəzi. Bu plan mütəxəssis nəzarəti altında tətbiq olunmalıdır; uşağın vəziyyəti dəyişdikdə plan yenidən nəzərdən keçirilir.</footer></body></html>';
  }

  function fullHtml(form, cycle, bank) {
    var p = cycle.plan;
    return wrap('Plan ' + form.ad, headerHtml(form, cycle) + warningsHtml(p) + needsHtml(p) + goalsHtml(p) + testsHtml(p, cycle.results) + sessionsHtml(p, bank, cycle.log) + homeHtml(p, bank, false));
  }

  function parentHtml(form, cycle, bank) {
    var p = cycle.plan;
    return wrap('Valideyn vərəqi ' + form.ad, headerHtml(form, cycle) + warningsHtml(p) +
      '<h2>Mərkəzə gəliş cədvəli</h2><table><tr><th>Tarix</th><th>Gün</th><th>Qeyd</th></tr>' + p.sessions.map(function (s) {
        var t = p.tests.filter(function (x) { return x.day === s.day; }).map(function (x) { return x.name + ' (' + PHASE[x.phase] + ')'; }).join(', ');
        return '<tr><td>' + fmtDate(s.date) + '</td><td>' + esc(WD[s.weekday]) + '</td><td>' + esc(t) + '</td></tr>';
      }).join('') + '</table>' + homeHtml(p, bank, false));
  }

  function comparisonHtml(prevCycle, cycle) {
    var rows = E.compareResults(flat(prevCycle && prevCycle.results), flat(cycle && cycle.results));
    if (!rows.length) return '';
    return '<h2>Əvvəlki dövrlə müqayisə</h2><table><tr><th>Test</th><th>Əvvəl</th><th>İndi</th><th>Fərq</th></tr>' + rows.map(function (r) {
      return '<tr><td>' + esc(r.id) + '</td><td>' + esc(r.prev ? r.prev.score : '-') + '</td><td>' + esc(r.curr.score) + '</td><td>' + (r.delta == null ? '-' : (r.delta > 0 ? '+' : '') + r.delta) + '</td></tr>';
    }).join('') + '</table>';
  }
  function flat(results) {
    var out = {};
    Object.keys(results || {}).forEach(function (id) {
      var ph = results[id], last = ph.retest || ph.mid || ph.baseline;
      if (last) out[id] = last;
    });
    return out;
  }

  return { ritual: ritual, safeSig: safeSig, specialistHtml: specialistHtml, deferredNote: deferredNote, approvalHtml: approvalHtml, esc: esc, fmtDate: fmtDate, wdName: wdName, fullHtml: fullHtml, parentHtml: parentHtml, activityBlock: activityBlock,
    comparisonHtml: comparisonHtml, flatResults: flat, SPEC_LABEL: SPEC_LABEL, PHASE: PHASE, LV: LV, WD: WD, testsHtml: testsHtml, needsHtml: needsHtml, goalsHtml: goalsHtml, warningsHtml: warningsHtml };
});
