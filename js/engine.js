(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SPECS = ['psixoloq', 'loqoped', 'ergoterapevt', 'pedaqoq'];
  var CYCLE_DAYS = 30;
  var ENGINE_VERSION = 2;
  var PATTERNS = { 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] };
  var DEFAULT_SPW = 3;
  var NEED_IDS = ['joint', 'play', 'emotion', 'behavior', 'anxiety', 'attention', 'expressive', 'receptive',
    'artic', 'aac', 'oral', 'gross', 'fine', 'sensory', 'selfcare', 'toilet', 'prewrite', 'academic'];

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
      .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/\s+/g, ' ').trim();
  }
  function has(text, re) { return re.test(text); }

  function hashSeed(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16;
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function parseISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  function toISO(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function weekday(d) { var w = d.getUTCDay(); return w === 0 ? 7 : w; }
  function todayISO() { var n = new Date(); return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate()); }

  function ageMonths(birthISO, onISO) {
    var b = parseISO(birthISO), d = parseISO(onISO);
    if (!b || !d) return null;
    var m = (d.getUTCFullYear() - b.getUTCFullYear()) * 12 + (d.getUTCMonth() - b.getUTCMonth());
    if (d.getUTCDate() < b.getUTCDate()) m--;
    return m < 0 ? null : m;
  }
  function ageLabel(m) {
    if (m == null) return '';
    var y = Math.floor(m / 12), r = m % 12;
    return (y ? y + ' yaş ' : '') + (r || !y ? r + ' ay' : '');
  }

  // ---- diaqnoz ----
  var DX = [
    ['asd', /\b(autizm|autism|asp|aspi|asperger|f84|aspd|ass)\b|autizm|spektr/],
    ['adhd', /\b(dehb|deh|adhd|f90)\b|hiperaktiv|diqqet catismazligi|diqqet pozuntusu/],
    ['cp', /serebral|iflic|\bcp\b|g80|spastik/],
    ['down', /daun|down|q90|trisomiya/],
    ['gdd', /umumi inkisaf gecikme|inkisaf gecikme|\bf88\b|\bf89\b|psixomotor/],
    ['speech', /nitq gecikme|nitq pozuntu|dil pozuntu|alaliya|disartriya|\bf80\b|apraksiya|nitqsizlik/],
    ['id', /zehni gerilik|eqli gerilik|\bf7\d\b|intellektual/],
    ['anxiety', /narahatliq|\bf41\b|fobiya|panik|\bsad\b|sosial narahat/],
    ['ocd', /obsessiv|\bocd\b|\bf42\b|kompulsiv/],
    ['learning', /disleksiya|disqrafiya|diskalkuliya|\bf81\b|oyrenme cetinlik/],
    ['epilepsy', /epilep|\bg40\b|qic|konvuls/]
  ];
  function detectDx(f) {
    var text = norm([f.diaqnoz, f.diaqnoz2, f.icd].join(' | '));
    var tags = [];
    DX.forEach(function (p) { if (p[1].test(text)) tags.push(p[0]); });
    return tags;
  }

  // ---- sahə analizi ----
  function sel(v, map) {
    var key = norm(v);
    if (!key) return null;
    for (var k in map) if (key.indexOf(norm(k)) === 0) return map[k];
    return null;
  }
  function avgKnown(vals) {
    var k = vals.filter(function (v) { return v != null; });
    return k.length ? k.reduce(function (a, b) { return a + b; }, 0) / k.length : null;
  }
  function textLevel(txt) {
    var t = norm(txt);
    if (!t) return null;
    if (has(t, /yoxdur|yox\b|cox zeif|zeif|pis|cetin|problem|catismir|gecikir|ola bilmir|bacarmir|bilmir/)) return 3;
    if (has(t, /orta|qismen|tez-tez|bezen|yarimcaq/)) return 2;
    if (has(t, /yaxsi|uygun|normal|bacarir|sabit|var\b/)) return 0;
    return 1;
  }
  var KW = {
    expressive: /danis|nitq|soz|cumle|deyir|ses cixar/,
    receptive: /basa dus|anla|gosteris|dinle|cavab ver/,
    behavior: /davranis|esebi|qezeb|vurur|dismeli|ağla|agla|tantrum|inad|dinlemir/,
    emotion: /emosiya|hissler|esebi|ağla|agla|qezeb/,
    attention: /diqqet|konsentr|yayin|hiperaktiv|oturmur|dayanmir/,
    toilet: /tualet|bez|kecmir|alt islat/,
    prewrite: /yazi|yazmaq|qelem|resm/,
    academic: /mekteb|oxu|say|hesab|derslik|oyren|akademik|hazirliq/,
    selfcare: /ozune xidmet|geyin|yemek|qasiq|dis|yuyun|musta/,
    oral: /yemek|cenee|udma|tupurcek|iceme/,
    play: /oyun|dost|yoldas|uşaqlarla|usaqlarla|paylas/,
    joint: /gozun|goz kont|ad cagir|sosial|ünsiyyet|unsiyyet/,
    sensory: /sensor|ses|toxunus|hessas/,
    anxiety: /qorx|narahat|panik|stres/,
    gross: /yerime|qacmaq|tarazliq|yixil|kobud|idman/,
    fine: /barmaq|tutmaq|qayci|duyme/,
    artic: /aydin|tələffüz|telleffuz|artikul|r\b ses/,
    aac: /pecs|kart|jest|aac/
  };

  function deriveProfile(f, onISO) {
    f = f || {};
    var start = parseISO(f.baslama) ? f.baslama : (onISO || todayISO());
    var ageM = f.dogum ? ageMonths(f.dogum, start) : (f.yas ? parseInt(f.yas, 10) * 12 : null);
    if (ageM != null && isNaN(ageM)) ageM = null;
    var dx = detectDx(f);
    var beh = (f.davranislar || []).map(norm);
    var sen = (f.sensor || []).map(norm);
    var concern = norm([f.narahatliq, f.meqsed, f.davranisdiger].join(' '));
    var tibb = norm([f.tibbiqeyd, f.diaqnoz, f.diaqnoz2, f.derman].join(' '));
    var unknown = [];
    var needs = {};
    var reasons = {};
    function set(id, score, why) {
      var s = score == null ? null : Math.max(0, Math.min(3, Math.round(score)));
      needs[id] = s;
      reasons[id] = why || [];
    }
    function chip(list, re) { return list.some(function (x) { return re.test(x); }); }
    function note(id, text) { if (!reasons[id]) reasons[id] = []; reasons[id].push(text); }
    function mark(field, label) { if (!norm(f[field])) unknown.push(label); }

    var eye = sel(f.gozkontakt, { 'yox': 3, 'qisa': 2, 'sabit': 0 });
    var nm = sel(f.adreaksiya, { 'yox': 3, 'qismen': 2, 'beli': 0 });
    var ja = sel(f.birgediqqet, { 'formalasmayib': 3, 'qismen': 2, 'formalasib': 0 });
    var sj = avgKnown([eye, nm, ja]);
    set('joint', sj == null ? null : Math.ceil(sj - 0.01), []);
    if (eye === 3) note('joint', 'göz kontaktı yoxdur'); if (nm >= 2) note('joint', 'ada reaksiya zəifdir'); if (ja >= 2) note('joint', 'birgə diqqət formalaşmayıb');
    mark('gozkontakt', 'Göz kontaktı'); mark('birgediqqet', 'Birgə diqqət');

    var oy = sel(f.oyun, { 'tek': 3, 'paralel': 2, 'qarsiliqli': 0 });
    var nv = textLevel(f.novbe), mn = textLevel(f.munasibet);
    set('play', avgKnown([oy, nv, mn]) == null ? null : Math.ceil(avgKnown([oy, nv, mn]) - 0.01), []);
    if (oy >= 2) note('play', oy === 3 ? 'yalnız tək oyun' : 'paralel oyun mərhələsi');
    if (nv >= 2) note('play', 'növbə gözləmə çətindir');
    mark('oyun', 'Oyun bacarıqları');

    var emo = 0;
    if (chip(beh, /agla|qisqir|aqressiya|ozune zerer|esya at|qorxu/)) emo += 1;
    if (chip(beh, /aqressiya|ozune zerer/)) emo += 1;
    if (has(concern, KW.emotion)) emo += 1;
    if (dx.indexOf('asd') >= 0 && ageM != null && ageM >= 36) emo = Math.max(emo, 1);
    set('emotion', emo, emo ? ['emosional partlayış və ya tənzimləmə qeydləri'] : []);

    var ext = 0, tags = [];
    beh.forEach(function (b) {
      if (/aqressiya/.test(b)) { ext += 2; tags.push('aggression'); }
      if (/ozune zerer/.test(b)) { ext += 2; tags.push('selfinjury'); }
      if (/qacma/.test(b)) { ext += 1; tags.push('elopement'); }
      if (/esya at|dismek|qisqir/.test(b)) ext += 1;
      if (/rutin|kecid/.test(b)) { ext += 1; tags.push('transition'); }
      if (/el cirp|firlan|tik|obsessiv/.test(b)) { ext += 1; tags.push('stereotypy'); }
      if (/yuxu/.test(b)) tags.push('sleep');
    });
    if (has(concern, KW.behavior)) ext += 1;
    set('behavior', ext >= 4 ? 3 : ext >= 2 ? 2 : ext >= 1 ? 1 : 0, []);
    if (needs.behavior) note('behavior', 'qeyd olunan davranışlar: ' + (f.davranislar || []).join(', '));

    var anx = 0;
    if (chip(beh, /qorxu|obsessiv/)) anx += 2;
    if (has(concern, KW.anxiety)) anx += 1;
    if (dx.indexOf('anxiety') >= 0 || dx.indexOf('ocd') >= 0) anx = 3;
    set('anxiety', Math.min(3, anx), anx ? ['qorxu, narahatlıq və ya obsessiv əlamətlər'] : []);

    var dq = sel(f.diqqet, { 'cox qisa': 3, 'qisa': 2, 'orta': 1, 'yaxsi': 0 });
    var ym = sel(f.yaddas, { 'zeif': 3, 'orta': 1, 'yaxsi': 0 });
    var at = avgKnown([dq, ym]);
    var atn = at == null ? null : Math.round(at);
    if (chip(beh, /hiperaktiv|diqqet catismaz/) || dx.indexOf('adhd') >= 0) atn = Math.max(atn == null ? 0 : atn, 2);
    set('attention', atn, []);
    if (dq >= 2) note('attention', 'diqqət müddəti qısadır');
    if (ym >= 2) note('attention', 'yaddaş zəifdir');
    mark('diqqet', 'Diqqət müddəti');

    var ns = sel(f.nitqsev, { 'nitq yoxdur': 3, 'tek soz': 2, 'qisa cumle': 1, 'serbest': 0, 'yasa uygun': 0 });
    if (ns != null && ageM != null && ageM < 18 && ns === 3) ns = 2;
    var kwE = has(concern, KW.expressive) ? 1 : 0;
    set('expressive', ns == null ? null : Math.min(3, ns + (ns > 0 ? 0 : 0) + (ns === 0 ? 0 : kwE)), []);
    if (ns >= 2) note('expressive', f.nitqsev);
    mark('nitqsev', 'Nitq səviyyəsi');

    var gs = sel(f.gosterish, { 'yox': 3, '1 addim': 2, '2-3': 1, 'murekkeb': 0 });
    var rs = textLevel(f.reseptiv);
    var rc = avgKnown([gs, rs && rs === 3 ? 3 : null]);
    set('receptive', gs == null && rs == null ? null : Math.round(avgKnown([gs, rs]) == null ? 0 : (rc == null ? avgKnown([gs, rs]) : Math.max(gs == null ? 0 : gs, rc))), []);
    if (gs >= 2) note('receptive', 'göstərişi icra səviyyəsi: ' + f.gosterish);
    mark('gosterish', 'Göstərişi icra');

    var ar = 0;
    if (/artikulyasiya/.test(norm(f.nitqsev))) ar = 3;
    else if ((dx.indexOf('speech') >= 0 || dx.indexOf('cp') >= 0 || dx.indexOf('down') >= 0) && ns != null && ns <= 2) ar = 2;
    if (has(concern, KW.artic)) ar = Math.max(ar, 2);
    set('artic', ar, ar ? ['səslərin düzgün tələffüzü'] : []);

    var ac = sel(f.aac, { 'yoxdur': null, 'pecs': 2, 'aac': 2, 'jest': 1 });
    var needAac = ns != null && ns >= 2;
    var aacS = needAac ? (norm(f.aac).indexOf('yoxdur') === 0 || !norm(f.aac) ? 3 : (ac == null ? 2 : ac)) : 0;
    set('aac', aacS, needAac ? ['nitq məhduddur, alternativ ünsiyyət vasitəsi lazımdır'] : []);

    var oral = 0;
    if (dx.indexOf('cp') >= 0 || dx.indexOf('down') >= 0) oral = 2;
    if (chip(beh, /yemek secici/) || chip(sen, /dad secici/)) oral = Math.max(oral, 1);
    if (has(concern, KW.oral)) oral = Math.max(oral, 1);
    set('oral', oral, []);

    var im = sel(f.irimotor, { 'zeif': 3, 'orta': 1, 'yaxsi': 0 });
    var tr = sel(f.tarazliq, { 'zeif': 3, 'orta': 1, 'yaxsi': 0 });
    var gm = avgKnown([im, tr]) == null ? null : Math.ceil(Math.max(im == null ? 0 : im, tr == null ? 0 : tr) - 0.01);
    if (dx.indexOf('cp') >= 0) gm = Math.max(gm == null ? 0 : gm, 2);
    set('gross', gm, []);
    mark('irimotor', 'İri motorika');

    var xm = sel(f.xirdamotor, { 'zeif': 3, 'orta': 1, 'yaxsi': 0 });
    set('fine', xm, []);
    mark('xirdamotor', 'Xırda motorika');

    var sc = sen.length;
    if (chip(beh, /sensor hessas/)) sc += 1;
    set('sensory', sc >= 4 ? 3 : sc >= 2 ? 2 : sc >= 1 ? 1 : 0, sc ? ['sensor xüsusiyyətlər: ' + (f.sensor || []).join(', ')] : []);

    var sf = textLevel(f.ozunexidmet);
    var scs = sf;
    if (ageM != null && ageM < 24) scs = 0;
    if (has(concern, KW.selfcare) && scs != null) scs = Math.max(scs, 2);
    set('selfcare', ageM != null && ageM < 24 ? 0 : scs, []);
    mark('ozunexidmet', 'Özünəxidmət');

    var tl = sel(f.tualet, { 'formalasmayib': 3, 'qismen': 2, 'formalasib': 0 });
    if (tl === 3 && ageM != null && ageM < 30) tl = 1;
    if (tl === 2 && ageM != null && ageM < 30) tl = 1;
    set('toilet', tl, tl >= 2 ? ['tualet vərdişi: ' + f.tualet] : []);
    mark('tualet', 'Tualet vərdişi');

    var ql = sel(f.qelem, { 'formalasmayib': 3, 'qismen': 2, 'formalasib': 0 });
    if (ageM != null && ageM < 30) ql = 0;
    else if (ageM != null && ageM < 42 && ql === 3) ql = 2;
    set('prewrite', ql, ql >= 2 ? ['qələm tutma və xətt çəkmə hazırlığı'] : []);
    mark('qelem', 'Qələm tutma');

    var ak = sel(f.akademik, { 'formalasmayib': 3, 'qismen': 2, 'formalasib': 0 });
    var oyz = sel(f.oxuyazi, { 'uygun deyil': null, 'baslangic': 2, 'inkisaf': 1, 'hazirdir': 0 });
    var acad = avgKnown([ak, oyz]) == null ? null : Math.round(avgKnown([ak, oyz]));
    if (ageM != null && ageM < 30) acad = 0;
    else if ((dx.indexOf('id') >= 0 || dx.indexOf('gdd') >= 0 || dx.indexOf('learning') >= 0) && acad != null) acad = Math.max(acad, 2);
    if (has(concern, KW.academic) && acad != null) acad = Math.max(acad, 2);
    set('academic', acad, []);
    mark('akademik', 'Akademik hazırlıq');

    NEED_IDS.forEach(function (id) {
      if (needs[id] == null) {
        needs[id] = 1;
        if (!reasons[id]) reasons[id] = [];
      }
    });
    NEED_IDS.forEach(function (id) {
      if (KW[id] && has(concern, KW[id]) && needs[id] < 3 && id !== 'sensory') { needs[id] += 1; reasons[id].push('valideynin narahatlığında qeyd olunub'); }
    });
    Object.keys(needs).forEach(function (k) { needs[k] = Math.min(3, needs[k]); });

    var flags = [];
    var warnings = [];
    if (/epilep|qic|konvuls|nobet|\bg40\b/.test(tibb) || dx.indexOf('epilepsy') >= 0) { flags.push('epilepsy'); warnings.push('Epilepsiya və ya qıcolma qeydi var: parlayan işıq, sürətli fırlanma və intensiv vestibulyar məşqlər plandan çıxarılıb. Hər cür sensor-vestibulyar yükləmə həkimlə razılaşdırılmalıdır.'); }
    if (/aspirasiya|udma|yutma|disfaj|dysphag|bogul/.test(tibb)) { flags.push('aspiration'); warnings.push('Udma/aspirasiya riski qeydi var: ağız-motor, yemək və içmə ilə bağlı məşqlər plandan çıxarılıb. Bu istiqamət yalnız udma üzrə mütəxəssis və həkimin icazəsi ilə əlavə edilməlidir.'); }
    if (norm(f.allergiya)) { flags.push('allergy'); warnings.push('Allergiya qeydə alınıb (' + String(f.allergiya).trim() + '): yeməklə mükafatlandırma, dad və materiallar seçilərkən bu mütləq yoxlanılmalıdır.'); }
    if (norm(f.derman)) { flags.push('medication'); warnings.push('Dərman qəbulu qeyd olunub: seanslarda yuxululuq, yorğunluq və ya həyəcan dəyişikliyi müşahidə olunarsa kuratora və həkimə bildirilməlidir.'); }
    if (tags.indexOf('selfinjury') >= 0) { flags.push('selfinjury'); warnings.push('Özünə zərər davranışı qeydə alınıb: məşğələ otağında sərt və təhlükəli əşyalar olmamalıdır, hər seansın davranış qeydi aparılmalı, kurator və ailə dərhal məlumatlandırılmalıdır.'); }
    if (tags.indexOf('elopement') >= 0) { flags.push('elopement'); warnings.push('Qaçma davranışı qeydə alınıb: qapılar və pəncərələr nəzarətdə olmalı, uşaq heç vaxt otaqda tək buraxılmamalıdır.'); }
    if (ageM != null && ageM < 36) { flags.push('smallparts'); }
    if (tags.indexOf('aggression') >= 0) tags.push('safety');

    var asdConfirmed = !!(norm(f.diaqtarix) || norm(f.diaqtesdiq) === 'beli');
    return {
      ageM: ageM, ageLabel: ageLabel(ageM), dx: dx, needs: needs, reasons: reasons, tags: tags, flags: flags,
      warnings: warnings, unknown: unknown, dxConfirmed: asdConfirmed, concern: concern,
      sessionsPerWeek: PATTERNS[+f.seans] ? +f.seans : DEFAULT_SPW,
      homeMin: Math.max(10, Math.min(120, parseInt(f.evdevaxt, 10) || 45))
    };
  }

  // ---- aktivlik seçimi ----
  function eligible(act, p) {
    if (!act) return false;
    if (act.age && p.ageM != null && (p.ageM < act.age[0] || p.ageM > act.age[1])) return false;
    var risks = act.risks || [];
    if (risks.indexOf('oral') >= 0 && p.flags.indexOf('aspiration') >= 0) return false;
    if (risks.indexOf('smallparts') >= 0 && p.flags.indexOf('smallparts') >= 0) return false;
    if (risks.indexOf('photic') >= 0 && p.flags.indexOf('epilepsy') >= 0) return false;
    if (risks.indexOf('vestibular') >= 0 && p.flags.indexOf('epilepsy') >= 0) return false;
    if (act.onlyDx && !act.onlyDx.some(function (d) { return p.dx.indexOf(d) >= 0; })) return false;
    if (act.notDx && act.notDx.some(function (d) { return p.dx.indexOf(d) >= 0; })) return false;
    return true;
  }
  function activityScore(act, p) {
    var best = 0, sum = 0;
    (act.needs || []).forEach(function (n) {
      var s = p.needs[n] == null ? 0 : p.needs[n];
      if (s > best) best = s;
      sum += s;
    });
    var boost = 0;
    (act.boost || []).forEach(function (t) { if (p.tags.indexOf(t) >= 0) boost += 2; });
    if (act.dx) act.dx.forEach(function (d) { if (p.dx.indexOf(d) >= 0) boost += 1.5; });
    return best * 10 + sum + boost;
  }
  function primaryNeed(act, p) {
    var best = null, bs = -1;
    (act.needs || []).forEach(function (n) { var s = p.needs[n] == null ? 0 : p.needs[n]; if (s > bs) { bs = s; best = n; } });
    return best;
  }
  function startLevel(score) { return score >= 2 ? 1 : score === 1 ? 2 : 3; }
  function levelFor(week, start) {
    var l = week >= 3 ? start + 1 : start;
    return Math.max(1, Math.min(3, l));
  }

  function rankPool(bank, group, p, prior) {
    var ids = Object.keys(bank.act).filter(function (id) { return bank.act[id].group === group; });
    var rows = ids.map(function (id) {
      var a = bank.act[id];
      if (!eligible(a, p)) return null;
      var sc = activityScore(a, p);
      if (prior && prior.used && prior.used[id]) sc -= Math.min(4, prior.used[id] * 0.5);
      return { id: id, score: sc, need: primaryNeed(a, p) };
    }).filter(Boolean);
    rows.sort(function (x, y) { return y.score - x.score || (x.id < y.id ? -1 : 1); });
    return rows;
  }

  function sessionMinutes(p) {
    var a = p.needs.attention;
    var m = a >= 3 ? 20 : a === 2 ? 30 : a === 1 ? 40 : 45;
    if (p.ageM != null && p.ageM < 36) m = Math.min(m, 25);
    return m;
  }

  function buildSessionDates(startISO, spw) {
    var start = parseISO(startISO), out = [], pat = PATTERNS[spw] || PATTERNS[5];
    for (var i = 0; i < CYCLE_DAYS; i++) {
      var d = addDays(start, i);
      if (pat.indexOf(weekday(d)) >= 0) out.push({ day: i + 1, date: toISO(d), weekday: weekday(d), week: Math.min(4, Math.floor(i / 7) + 1) });
    }
    return out;
  }

  function monthSessions(startISO, spw) {
    return buildSessionDates(parseISO(startISO) ? startISO : todayISO(), spw).length;
  }

  function weekSlots(coreA, coreB, support, nSessions, week, rand) {
    var slots = [], n = nSessions * 2;
    var c1 = Math.max(1, Math.floor(n * 0.25)), c2 = Math.max(coreB ? 1 : 0, Math.floor(n * 0.2));
    var i;
    for (i = 0; i < c1; i++) slots.push(coreA);
    for (i = 0; i < c2; i++) slots.push(coreB || coreA);
    var sup = support.length ? support : [coreA];
    var offset = ((week - 1) * 3) % sup.length;
    var k = 0;
    while (slots.length < n) { slots.push(sup[(offset + k) % sup.length]); k++; }
    return shuffle(slots, rand).slice(0, n);
  }

  function arrange(slots, nSessions, rand, prevMain) {
    var best = null, bestPen = 1e9, tries = 60;
    for (var t = 0; t < tries; t++) {
      var s = t === 0 ? slots.slice() : shuffle(slots, rand);
      var sessions = [], pen = 0;
      for (var i = 0; i < nSessions; i++) {
        var a = s[i * 2], b = s[i * 2 + 1];
        if (a === b) pen += 5;
        var pm = i === 0 ? prevMain : sessions[i - 1][0];
        if (a === pm) pen += 3;
        if (i > 0 && (b === sessions[i - 1][1])) pen += 1;
        sessions.push([a, b]);
      }
      if (pen < bestPen) { bestPen = pen; best = sessions; }
      if (pen === 0) break;
    }
    return best;
  }

  function planSpecialist(bank, group, p, prior, sdates, rand) {
    var pool = rankPool(bank, group, p, prior);
    var out = {};
    if (!pool.length) return { pool: [], bySession: {} };
    var core = pool.slice(0, 2).map(function (r) { return r.id; });
    var support = pool.slice(2).map(function (r) { return r.id; });
    var byWeek = {};
    sdates.forEach(function (s) { (byWeek[s.week] = byWeek[s.week] || []).push(s); });
    var prevMain = null;
    Object.keys(byWeek).sort().forEach(function (w) {
      var list = byWeek[w];
      var slots = weekSlots(core[0], core[1], support, list.length, +w, rand);
      var arr = arrange(slots, list.length, rand, prevMain);
      list.forEach(function (s, i) { out[s.day] = arr[i]; });
      prevMain = arr[arr.length - 1][0];
    });
    return { pool: pool, bySession: out, core: core };
  }

  function levelForAct(bank, id, p, week, prior) {
    var a = bank.act[id];
    var pn = primaryNeed(a, p);
    var score = pn == null ? 1 : p.needs[pn];
    var start = startLevel(score);
    if (prior && prior.levels && pn && prior.levels[pn]) start = prior.levels[pn];
    return levelFor(week, start);
  }

  // ---- testlər ----
  var TEST_RULES = [
    { id: 'm-chat-r', pri: 1, who: 'psixoloq', min: 15, when: function (p) { return p.ageM != null && p.ageM >= 16 && p.ageM <= 30 && !p.dxConfirmed; }, first: true, why: 'Yaş 16–30 ay aralığındadır və autizm diaqnozu təsdiqlənməyib: erkən risk skrininqi.' },
    { id: 'ados-2', pri: 1, who: 'psixoloq', min: 60, when: function (p) { return !p.dxConfirmed && p.ageM != null && p.ageM >= 12 && p.needs.joint >= 2 && (p.dx.indexOf('asd') >= 0 || p.needs.play >= 2); }, first: true, why: 'Sosial-ünsiyyət əlamətləri qeyd olunub, diaqnoz təsdiqlənməyib: standart müşahidə ilə dəqiqləşdirmə.' },
    { id: 'adi-r', pri: 1, who: 'psixoloq', min: 120, when: function (p) { return !p.dxConfirmed && p.ageM != null && p.ageM >= 24 && p.dx.indexOf('asd') >= 0; }, first: true, why: 'Diaqnozu tarixçə ilə təsdiqləmək üçün valideyn müsahibəsi.' },
    { id: 'gobdo-2', pri: 2, who: 'psixoloq', min: 15, when: function (p) { return p.dx.indexOf('asd') >= 0 && p.ageM != null && p.ageM >= 36 && p.ageM <= 276; }, phases: ['baseline', 'mid', 'retest'], why: 'Autizm əlamətlərinin tezliyini aylıq müqayisə etmək üçün qısa şkala.' },
    { id: 'denver-ii', pri: 4, who: 'psixoloq', min: 20, when: function (p) { return p.ageM != null && p.ageM <= 72; }, phases: ['baseline', 'mid', 'retest'], why: 'Yaş 6-dan aşağıdır: inkişaf sahələri üzrə skrininq və aylıq irəliləyişə nəzarət.' },
    { id: 'erken-inkishaf', pri: 4, who: 'psixoloq', min: 30, when: function (p) { return p.ageM != null && p.ageM <= 72; }, phases: ['baseline', 'mid', 'retest'], why: 'Erkən inkişaf yaşında sahələr üzrə vəziyyətin ölçülməsi.' },
    { id: 'erken-mudaxile', pri: 4, who: 'psixoloq', min: 20, when: function (p) { return p.ageM != null && p.ageM <= 72; }, phases: ['mid'], why: 'Ay ortasında izləmə: plan işləyirsə davam, işləmirsə düzəliş.' },
    { id: 'wisc-v', pri: 2, who: 'psixoloq', min: 80, when: function (p) { return p.ageM != null && p.ageM >= 72 && p.ageM <= 203 && (p.dx.some(function (d) { return ['id', 'gdd', 'adhd', 'learning'].indexOf(d) >= 0; }) || p.needs.academic >= 2); }, first: true, everyN: 6, why: 'Koqnitiv profilin dəqiqləşdirilməsi; tez-tez təkrarlanmır (məşq effekti).' },
    { id: 'leiter-3', pri: 3, who: 'psixoloq', min: 45, when: function (p) { return p.ageM != null && p.ageM >= 36 && (p.needs.expressive >= 2 || p.dx.indexOf('asd') >= 0) && !(p.ageM >= 72 && p.ageM <= 203 && p.dx.indexOf('id') >= 0); }, first: true, everyN: 6, why: 'Nitq məhdud olduqda qeyri-verbal koqnitiv qiymətləndirmə.' },
    { id: 'vineland-3', pri: 3, who: 'psixoloq', min: 40, when: function () { return true; }, first: true, everyN: 3, why: 'Gündəlik həyat bacarıqlarının ümumi profili; hər 3 ayda bir yenilənir.' },
    { id: 'sensory-profile-2', pri: 3, who: 'ergoterapevt', min: 20, when: function (p) { return p.needs.sensory >= 1; }, first: true, everyN: 3, why: 'Sensor xüsusiyyətlər qeyd olunub: ergoterapiya planının əsası.' },
    { id: 'ttap', pri: 3, who: 'psixoloq', min: 60, when: function (p) { return p.ageM != null && p.ageM >= 144 && p.dx.indexOf('asd') >= 0; }, first: true, everyN: 3, why: 'Yeniyetmə yaşında funksional keçid bacarıqları.' },
    { id: 'vb-mapp', pri: 2, who: 'psixoloq', min: 60, when: function (p) { return p.ageM != null && p.ageM <= 120 && (p.dx.indexOf('asd') >= 0 || p.dx.indexOf('speech') >= 0 || p.dx.indexOf('gdd') >= 0 || p.needs.expressive >= 2); }, phases: ['baseline', 'mid', 'retest'], retestFocus: true, why: 'Nitq və öyrənmə bacarıqlarının mərhələ üzrə izlənməsi. Təkrar yoxlamada yalnız fokus sahələr götürülür.' },
    { id: 'afls', pri: 3, who: 'ergoterapevt', min: 40, when: function (p) { return p.needs.selfcare >= 2 || p.needs.toilet >= 2; }, first: true, everyN: 3, why: 'Özünəxidmət çatışmazlığı var: funksional həyat bacarıqlarının ölçülməsi.' },
    { id: 'fba', pri: 2, who: 'psixoloq', min: 30, when: function (p) { return p.needs.behavior >= 2; }, phases: ['baseline', 'mid', 'retest'], why: 'Problem davranış var: funksiyanın təyini və tezliyin aylıq müqayisəsi.' },
    { id: 'scared', pri: 3, who: 'psixoloq', min: 15, when: function (p) { return p.ageM != null && p.ageM >= 96 && p.ageM <= 216 && p.needs.anxiety >= 2; }, phases: ['baseline', 'mid', 'retest'], why: 'Narahatlıq əlamətləri: şkala ilə aylıq dəyişikliyin izlənməsi.' },
    { id: 'cbt-klinik', pri: 3, who: 'psixoloq', min: 20, when: function (p) { return p.ageM != null && p.ageM >= 72 && (p.needs.emotion >= 2 || p.needs.anxiety >= 1); }, phases: ['baseline', 'mid', 'retest'], why: 'Emosional-davranış sahəsinin valideyn, uşaq və müəllim formaları ilə yoxlanması.' },
    { id: 'y-bocs', pri: 2, who: 'psixoloq', min: 40, when: function (p) { return p.dx.indexOf('ocd') >= 0; }, phases: ['baseline', 'mid', 'retest'], why: 'Obsessiv-kompulsiv əlamətlər: şiddətin aylıq ölçülməsi (uşaqlar üçün CY-BOCS versiyası).' }
  ];

  var TEST_CAP = { baseline: 4, mid: 2, retest: 2 };

  function retestDays(sdates) {
    var late = sdates.filter(function (s) { return s.day >= 26; });
    return late.length ? late.slice(-3) : sdates.slice(-1);
  }

  function selectTests(p, catalog, cycle, sdates, prior, notes) {
    var out = [];
    if (!sdates.length) return out;
    var first3 = sdates.slice(0, 5);
    var last3 = retestDays(sdates);
    var midDays = sdates.filter(function (s) { return s.day >= 12 && s.day <= 17; });
    if (!midDays.length) midDays = [sdates.reduce(function (b, s) { return Math.abs(s.day - 15) < Math.abs(b.day - 15) ? s : b; }, sdates[0])];
    var load = {};
    function place(days, rule, phase, extra) {
      var best = null, bl = 1e9;
      days.forEach(function (d) { var l = load[d.date] || 0; if (l < bl) { bl = l; best = d; } });
      load[best.date] = (load[best.date] || 0) + rule.min;
      var c = catalog[rule.id] || {};
      out.push({
        id: rule.id, name: c.ad || rule.id, phase: phase, day: best.day, date: best.date, who: rule.who,
        min: rule.min, link: c.link || '', licensed: !!c.lisenziyali, reason: rule.why + (extra ? ' ' + extra : '')
      });
    }
    var cand = [];
    TEST_RULES.forEach(function (r) {
      if (!catalog[r.id] || !r.when(p)) return;
      var phases = r.phases;
      if (!phases) {
        var due = r.everyN ? ((cycle - 1) % r.everyN === 0) : (r.first && cycle === 1);
        if (due) cand.push({ r: r, phase: 'baseline', days: first3, extra: cycle > 1 ? 'Planlı yenidən qiymətləndirmə.' : '' });
        return;
      }
      if (phases.indexOf('baseline') >= 0 && cycle === 1) cand.push({ r: r, phase: 'baseline', days: first3, extra: '' });
      if (phases.indexOf('mid') >= 0) cand.push({ r: r, phase: 'mid', days: midDays, extra: phases.indexOf('retest') >= 0 ? 'Ara yoxlama: eyni test qısa formada, yalnız dəyişikliyi görmək üçün.' : '' });
      if (phases.indexOf('retest') >= 0) cand.push({ r: r, phase: 'retest', days: last3, extra: r.retestFocus ? 'Yalnız bu dövrdə işlənmiş sahələr üzrə.' : '' });
    });
    var kept = [], skipped = {};
    ['baseline', 'mid', 'retest'].forEach(function (ph) {
      var list = cand.filter(function (c) { return c.phase === ph; })
        .sort(function (a, b) { return a.r.pri - b.r.pri || a.r.min - b.r.min; });
      list.forEach(function (c, i) {
        if (i < TEST_CAP[ph]) { kept.push(c); skipped[c.r.id] = false; }
        else skipped[c.r.id] = (skipped[c.r.id] !== false);
      });
    });
    kept.sort(function (a, b) { return b.r.min - a.r.min; }).forEach(function (c) { place(c.days, c.r, c.phase, c.extra); });
    if (notes) Object.keys(skipped).filter(function (id) { return skipped[id]; }).forEach(function (id) { notes.push((catalog[id] && catalog[id].ad) || id); });
    out.sort(function (a, b) { return a.day - b.day || (a.id < b.id ? -1 : 1); });
    return out;
  }

  // ---- hədəflər ----
  function buildGoals(bank, p, name) {
    var goals = { short: [], mid: [], long: [] };
    var rank = Object.keys(p.needs).filter(function (n) { return bank.needs && bank.needs[n] && p.needs[n] >= 1; })
      .sort(function (a, b) { return p.needs[b] - p.needs[a] || (a < b ? -1 : 1); }).slice(0, 5);
    function fill(t) { return String(t || '').replace(/\{ad\}/g, name || 'Uşaq'); }
    rank.forEach(function (n, i) {
      var meta = bank.needs[n];
      var item = { need: n, label: meta.label, spec: meta.spec };
      goals.short.push(Object.assign({ text: fill(meta.short) }, item));
      if (i < 4) goals.mid.push(Object.assign({ text: fill(meta.mid) }, item));
      if (i < 3) goals.long.push(Object.assign({ text: fill(meta.long) }, item));
    });
    return goals;
  }

  // ---- ana generator ----
  function generate(form, bank, opts) {
    opts = opts || {};
    if (!bank || !bank.act) throw new Error('Məşğələ bazası yoxdur');
    var catalog = opts.catalog || {};
    var prior = opts.prior || null;
    var cycle = opts.cycle || 1;
    var p = deriveProfile(form, opts.today);
    var start = parseISO(form.baslama) ? form.baslama : (opts.today || todayISO());
    var name = [form.ad, form.soyad].filter(Boolean).join(' ').trim();
    var childKey = opts.childKey || (norm(name) + '|' + (form.dogum || ''));
    var seed = hashSeed(childKey + '|' + start + '|' + cycle + '|' + (opts.salt || ''));
    var rand = rng(seed);
    var sdates = buildSessionDates(start, p.sessionsPerWeek);
    var sessions = sdates.map(function (s) { return { day: s.day, date: s.date, weekday: s.weekday, week: s.week, items: {} }; });
    var sm = sessionMinutes(p);
    var retestSet = {};
    retestDays(sdates).forEach(function (r) { retestSet[r.day] = true; });
    var pools = {};
    SPECS.forEach(function (sp) {
      var r = planSpecialist(bank, sp, p, prior, sdates, rng(seed + hashSeed(sp)));
      pools[sp] = r.pool.map(function (x) { return x.id; });
      sessions.forEach(function (s, idx) {
        var pair = r.bySession[s.day];
        if (!pair) return;
        var retest = retestSet[s.day] === true;
        var main = pair[0], second = pair[1];
        var items = [{ a: main, lv: levelForAct(bank, main, p, s.week, prior), min: Math.round(sm * 0.6) }];
        if (second && second !== main) items.push({ a: second, lv: levelForAct(bank, second, p, s.week, prior), min: sm - Math.round(sm * 0.6) });
        else items[0].min = sm;
        s.items[sp] = { list: items, kind: idx === 0 ? 'baseline' : retest ? 'retest' : 'regular' };
      });
    });

    var homeIds = rankPool(bank, 'valideyn', p, prior).map(function (r) { return r.id; });
    var perDay = Math.max(1, Math.min(3, Math.round(p.homeMin / 20)));
    var home = [];
    for (var d = 1; d <= CYCLE_DAYS; d++) {
      var week = Math.min(4, Math.floor((d - 1) / 7) + 1);
      var items = [];
      for (var k = 0; k < perDay && homeIds.length; k++) {
        var core = ((d - 1) * perDay + k + (week - 1) * 2) % Math.min(homeIds.length, 8);
        var id = homeIds[core];
        if (items.some(function (x) { return x.a === id; })) id = homeIds[(core + 1) % homeIds.length];
        items.push({ a: id, lv: levelForAct(bank, id, p, week, prior), min: Math.round(p.homeMin / perDay) });
      }
      home.push({ day: d, date: toISO(addDays(parseISO(start), d - 1)), items: items });
    }

    var weeks = [1, 2, 3, 4].map(function (w) {
      var themes = ['Tanışlıq, ilkin qiymətləndirmə və təməl bacarıqlar', 'Bacarıqların möhkəmləndirilməsi', 'Çətinləşmə və ümumiləşdirmə', 'Möhkəmlətmə, yekun qiymətləndirmə və növbəti dövrün hazırlığı'];
      var from = (w - 1) * 7 + 1, to = w === 4 ? CYCLE_DAYS : w * 7;
      return { n: w, theme: themes[w - 1], from: from, to: to, fromDate: toISO(addDays(parseISO(start), from - 1)), toDate: toISO(addDays(parseISO(start), to - 1)) };
    });

    var skippedTests = [];
    var tests = selectTests(p, catalog, cycle, sdates, prior, skippedTests);
    var planWarnings = p.warnings.slice();
    if (skippedTests.length) planWarnings.push('Plan həddindən artıq yüklənməsin deyə bu dövrdə növbəti testlər planlaşdırılmayıb: ' + skippedTests.join(', ') + '. Mütəxəssis lazım bilərsə, əlavə edə bilər.');
    var plan = {
      v: ENGINE_VERSION, bankVersion: bank.version || 0, cycle: cycle, childKey: childKey, seed: seed,
      createdAt: opts.now || new Date().toISOString(), start: start, end: toISO(addDays(parseISO(start), CYCLE_DAYS - 1)),
      nextStart: toISO(addDays(parseISO(start), CYCLE_DAYS)),
      profile: p, sessionMin: sm, weeks: weeks, sessions: sessions, home: home,
      tests: tests,
      goals: buildGoals(bank, p, form.ad), warnings: planWarnings,
      coverage: pools
    };
    return plan;
  }

  // ---- genişləndirmə / izləmə ----
  function usedCounts(plan) {
    var u = {};
    plan.sessions.forEach(function (s) {
      SPECS.forEach(function (sp) { if (s.items[sp]) s.items[sp].list.forEach(function (i) { u[i.a] = (u[i.a] || 0) + 1; }); });
    });
    return u;
  }

  // log açarı: day + '|' + spec + '|' + activityId ; dəyər {att: 'bəli'|'xeyr', r:1..4}
  function recommendLevel(plan, bank, log, spec, activityId, currentLv) {
    var rs = [];
    plan.sessions.forEach(function (s) {
      var it = s.items[spec];
      if (!it) return;
      it.list.forEach(function (x) {
        if (x.a !== activityId) return;
        var e = log[s.day + '|' + spec + '|' + activityId];
        if (e && e.att !== 'xeyr' && e.r) rs.push(+e.r);
      });
    });
    if (rs.length < 2) return { lv: currentLv, change: 0, why: 'Qərar üçün ən azı 2 qiymətləndirmə lazımdır.' };
    var last = rs.slice(-2);
    if (last[0] >= 4 && last[1] >= 4) return { lv: Math.min(3, currentLv + 1), change: currentLv < 3 ? 1 : 0, why: 'Son iki seansda müstəqil icra: səviyyəni artırın.' };
    if (last[0] <= 1 && last[1] <= 1) return { lv: Math.max(1, currentLv - 1), change: currentLv > 1 ? -1 : 0, why: 'Son iki seansda ciddi çətinlik: dəstəyi artırın və ya səviyyəni endirin.' };
    return { lv: currentLv, change: 0, why: 'Cari səviyyəni saxlayın.' };
  }

  function progress(plan, bank, log) {
    log = log || {};
    var total = 0, att = 0, done = 0, rated = 0, ratingSum = 0;
    var byNeed = {}, bySpec = {};
    plan.sessions.forEach(function (s) {
      SPECS.forEach(function (sp) {
        var it = s.items[sp];
        if (!it) return;
        it.list.forEach(function (x) {
          total++;
          var e = log[s.day + '|' + sp + '|' + x.a];
          if (!e) return;
          done++;
          if (e.att === 'xeyr') return;
          att++;
          if (e.r) {
            rated++; ratingSum += +e.r;
            var a = bank.act[x.a];
            var n = a && primaryNeed(a, plan.profile);
            if (n) { byNeed[n] = byNeed[n] || { sum: 0, n: 0 }; byNeed[n].sum += +e.r; byNeed[n].n++; }
            bySpec[sp] = bySpec[sp] || { sum: 0, n: 0 }; bySpec[sp].sum += +e.r; bySpec[sp].n++;
          }
        });
      });
    });
    var needAvg = {};
    Object.keys(byNeed).forEach(function (n) { needAvg[n] = +(byNeed[n].sum / byNeed[n].n).toFixed(2); });
    var specAvg = {};
    Object.keys(bySpec).forEach(function (n) { specAvg[n] = +(bySpec[n].sum / bySpec[n].n).toFixed(2); });
    return {
      planned: total, recorded: done, attended: att, attendancePct: done ? Math.round(att / done * 100) : 0,
      completionPct: total ? Math.round(done / total * 100) : 0, avg: rated ? +(ratingSum / rated).toFixed(2) : null,
      byNeed: needAvg, bySpec: specAvg
    };
  }

  function nextCycleSeed(plan, bank, log) {
    var pr = progress(plan, bank, log);
    var levels = {};
    Object.keys(pr.byNeed).forEach(function (n) {
      var sc = plan.profile.needs[n] == null ? 1 : plan.profile.needs[n];
      var start = startLevel(sc);
      var end = levelFor(4, start);
      var avg = pr.byNeed[n];
      var next = avg >= 3.5 ? Math.min(3, end) : avg <= 2 ? Math.max(1, start) : Math.max(1, Math.min(3, end - (avg < 2.75 ? 1 : 0)));
      levels[n] = next;
    });
    return { levels: levels, used: usedCounts(plan) };
  }

  function compareResults(prev, curr) {
    var out = [];
    Object.keys(curr || {}).forEach(function (id) {
      var c = curr[id], p = prev && prev[id];
      var row = { id: id, curr: c, prev: p || null, delta: null, direction: null };
      if (p && isFinite(parseFloat(p.score)) && isFinite(parseFloat(c.score))) {
        row.delta = +(parseFloat(c.score) - parseFloat(p.score)).toFixed(2);
        row.direction = row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : 'same';
      }
      out.push(row);
    });
    return out;
  }

  function validatePlan(plan) {
    var errs = [];
    if (!plan || typeof plan !== 'object') return ['plan obyekt deyil'];
    if (plan.v !== ENGINE_VERSION) errs.push('plan versiyası uyğun deyil');
    if (!parseISO(plan.start)) errs.push('başlanğıc tarixi səhvdir');
    if (!Array.isArray(plan.sessions)) errs.push('seanslar yoxdur');
    if (!Array.isArray(plan.home)) errs.push('ev proqramı yoxdur');
    if (!Array.isArray(plan.tests)) errs.push('testlər yoxdur');
    return errs;
  }

  return {
    monthSessions: monthSessions, SPECS: SPECS, NEED_IDS: NEED_IDS, CYCLE_DAYS: CYCLE_DAYS, VERSION: ENGINE_VERSION, PATTERNS: PATTERNS,
    norm: norm, ageMonths: ageMonths, ageLabel: ageLabel, parseISO: parseISO, toISO: toISO, addDays: addDays, todayISO: todayISO,
    detectDx: detectDx, deriveProfile: deriveProfile, eligible: eligible, generate: generate, selectTests: selectTests,
    progress: progress, recommendLevel: recommendLevel, nextCycleSeed: nextCycleSeed, compareResults: compareResults,
    validatePlan: validatePlan, usedCounts: usedCounts, levelFor: levelFor, startLevel: startLevel, hashSeed: hashSeed
  };
});
