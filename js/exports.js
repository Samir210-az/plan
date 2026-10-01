(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.PlanExports = factory(root.Engine);
})(typeof self !== 'undefined' ? self : this, function (E) {
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

  function activityBlock(bank, item) {
    var a = bank.act[item.a];
    if (!a) return '';
    var lv = a.levels[item.lv] || a.levels[1];
    return '<div class="act">' +
      '<h4>' + esc(a.t) + ' <span class="lv">' + esc(LV[item.lv]) + ' · ' + item.min + ' dəq</span></h4>' +
      '<p><b>Bu seansın məqsədi:</b> ' + esc(lv.g) + '</p>' +
      '<p><b>Dəstək səviyyəsi:</b> ' + esc(lv.sup) + '</p>' +
      '<p><b>Uğur meyarı:</b> ' + esc(lv.ok) + '</p>' +
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

  var CSS = 'body{font-family:Segoe UI,Arial,sans-serif;color:#1b2733;line-height:1.5;font-size:13px;margin:24px}' +
    'h1{font-size:22px;color:#0b2545;margin:0 0 4px}h2{font-size:17px;color:#1e5aa8;border-bottom:2px solid #dbe6f3;padding-bottom:4px;margin-top:26px}' +
    'h3{font-size:14px;background:#eaf3ff;padding:6px 10px;border-radius:6px;margin:16px 0 6px}h4{font-size:13px;margin:10px 0 4px;color:#0b2545}' +
    '.lv{font-weight:400;color:#5c7089;font-size:11px}.act{border:1px solid #dbe6f3;border-radius:8px;padding:8px 12px;margin:8px 0;page-break-inside:avoid}' +
    '.act p{margin:3px 0}.act ol,.act ul{margin:3px 0 3px 18px;padding:0}table{border-collapse:collapse;width:100%;margin:8px 0}' +
    'td,th{border:1px solid #c9d8ea;padding:5px 7px;text-align:left;vertical-align:top;font-size:12px}th{background:#eaf3ff}' +
    '.warn{border:2px solid #c0392b;background:#fdecea;padding:8px 12px;border-radius:8px;margin:8px 0}.muted{color:#5c7089}' +
    '.day{page-break-inside:avoid;margin-top:14px}footer{margin-top:30px;font-size:11px;color:#5c7089;border-top:1px solid #dbe6f3;padding-top:8px}';

  function headerHtml(form, cycle) {
    var p = cycle.plan, name = [form.ad, form.soyad].filter(Boolean).join(' ');
    return '<h1>Fərdi Reabilitasiya Planı: ' + esc(name) + '</h1>' +
      '<p class="muted">' + esc(p.profile.ageLabel) + ' · Dövr ' + cycle.n + ' · ' + fmtDate(p.start) + ' – ' + fmtDate(p.end) + ' · həftədə ' + p.profile.sessionsPerWeek + ' seans (ayda ' + p.sessions.length + ')' +
      (form.diaqnoz ? ' · Diaqnoz: ' + esc(form.diaqnoz) : '') + (form.kurator ? ' · Kurator: ' + esc(form.kurator) : '') + '</p>' +
      '<p class="muted">Növbəti dövr: ' + fmtDate(p.nextStart) + ' tarixindən, yekun testlərdən sonra yeni plan hazırlanır.</p>';
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
    return '<h2>Test cədvəli</h2><table><tr><th>Tarix</th><th>Test</th><th>Mərhələ</th><th>Kim aparır</th><th>Müddət</th><th>Niyə</th><th>Nəticə</th></tr>' + rows + '</table>';
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
          if (bank.rituals && bank.rituals[sp]) out += '<p class="muted"><b>Başlanğıc:</b> ' + esc(bank.rituals[sp].open) + ' <b>Son:</b> ' + esc(bank.rituals[sp].close) + '</p>';
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

  function wordHtml(form, cycle, bank) {
    return fullHtml(form, cycle, bank).replace('<html lang="az">', '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="az">');
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csv(form, cycle, bank) {
    var rows = [['Tarix', 'Həftənin günü', 'Gün №', 'Mütəxəssis', 'Məşğələ', 'Səviyyə', 'Dəq', 'Məqsəd', 'İştirak', 'Qiymət (1-4)', 'Qeyd']];
    var p = cycle.plan;
    p.sessions.forEach(function (s) {
      E.SPECS.forEach(function (sp) {
        var it = s.items[sp];
        if (!it) return;
        it.list.forEach(function (x) {
          var a = bank.act[x.a], e = (cycle.log || {})[s.day + '|' + sp + '|' + x.a] || {};
          rows.push([fmtDate(s.date), WD[s.weekday], s.day, SPEC_LABEL[sp], a ? a.t : x.a, x.lv, x.min, a ? a.levels[x.lv].g : '', e.att || '', e.r || '', e.note || '']);
        });
      });
    });
    p.tests.forEach(function (t) {
      var r = (cycle.results && cycle.results[t.id] && cycle.results[t.id][t.phase]) || {};
      rows.push([fmtDate(t.date), WD[(E.parseISO(t.date).getUTCDay() || 7)], t.day, SPEC_LABEL[t.who] || t.who, 'TEST: ' + t.name, '', t.min, PHASE[t.phase], '', r.score || '', r.note || '']);
    });
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
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

  return { esc: esc, fmtDate: fmtDate, wdName: wdName, fullHtml: fullHtml, parentHtml: parentHtml, wordHtml: wordHtml, csv: csv, activityBlock: activityBlock,
    comparisonHtml: comparisonHtml, flatResults: flat, SPEC_LABEL: SPEC_LABEL, PHASE: PHASE, LV: LV, WD: WD, testsHtml: testsHtml, needsHtml: needsHtml, goalsHtml: goalsHtml, warningsHtml: warningsHtml };
});
