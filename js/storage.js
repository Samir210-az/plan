(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlanStorage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'an_rehab_v2';
  var LEGACY_KEY = 'an_rehab_plans_v1';
  var VERSION = 2;

  function memoryStore() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }

  function create(backend) {
    var store = backend || memoryStore();

    function empty() { return { v: VERSION, children: {} }; }

    function load() {
      var raw;
      try { raw = store.getItem(KEY); } catch (e) { return empty(); }
      if (!raw) return empty();
      try {
        var d = JSON.parse(raw);
        return validate(d).ok ? d : empty();
      } catch (e) { return empty(); }
    }

    function save(data) {
      try {
        store.setItem(KEY, JSON.stringify(data));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: /quota/i.test(String(e && (e.name || e.message))) ? 'quota' : 'unavailable' };
      }
    }

    function legacyCount() {
      try { var r = store.getItem(LEGACY_KEY); return r ? Object.keys(JSON.parse(r)).length : 0; } catch (e) { return 0; }
    }

    function childKey(form) {
      return (String(form.ad || '') + '|' + String(form.soyad || '') + '|' + String(form.dogum || '')).toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function listChildren() {
      var d = load();
      return Object.keys(d.children).map(function (k) {
        var c = d.children[k];
        var last = c.cycles[c.cycles.length - 1];
        return { key: k, name: [c.form.ad, c.form.soyad].filter(Boolean).join(' '), cycles: c.cycles.length, start: last && last.plan.start, end: last && last.plan.end };
      }).sort(function (a, b) { return (b.start || '') < (a.start || '') ? -1 : 1; });
    }

    function putCycle(form, cycle) {
      var d = load();
      var key = childKey(form);
      var c = d.children[key] || { key: key, form: form, cycles: [] };
      c.form = form;
      var i = -1;
      c.cycles.forEach(function (x, idx) { if (x.n === cycle.n) i = idx; });
      if (i >= 0) c.cycles[i] = cycle; else c.cycles.push(cycle);
      c.cycles.sort(function (a, b) { return a.n - b.n; });
      d.children[key] = c;
      var r = save(d);
      r.key = key;
      return r;
    }

    function getChild(key) { return load().children[key] || null; }

    function updateCycle(key, n, fn) {
      var d = load();
      var c = d.children[key];
      if (!c) return { ok: false, error: 'missing' };
      var cy = c.cycles.filter(function (x) { return x.n === n; })[0];
      if (!cy) return { ok: false, error: 'missing' };
      fn(cy);
      return save(d);
    }

    function removeChild(key) {
      var d = load();
      delete d.children[key];
      return save(d);
    }

    function exportAll() { return JSON.stringify(load()); }

    function importData(text, mode) {
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: 'JSON oxunmadı' }; }
      var v = validate(parsed);
      if (!v.ok) return { ok: false, error: v.error };
      var cur = mode === 'replace' ? empty() : load();
      var added = 0;
      Object.keys(parsed.children).forEach(function (k) {
        var inc = parsed.children[k];
        if (!cur.children[k]) { cur.children[k] = inc; added += inc.cycles.length; return; }
        inc.cycles.forEach(function (cy) {
          var exists = cur.children[k].cycles.some(function (x) { return x.n === cy.n; });
          if (!exists) { cur.children[k].cycles.push(cy); added++; }
        });
        cur.children[k].cycles.sort(function (a, b) { return a.n - b.n; });
      });
      var r = save(cur);
      r.added = added;
      return r;
    }

    return { load: load, save: save, putCycle: putCycle, getChild: getChild, updateCycle: updateCycle, removeChild: removeChild,
      listChildren: listChildren, exportAll: exportAll, importData: importData, childKey: childKey, legacyCount: legacyCount };
  }

  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }

  function validate(d) {
    if (!isObj(d) || d.v !== VERSION || !isObj(d.children)) return { ok: false, error: 'Fayl formatı uyğun deyil (versiya 2 gözlənilir)' };
    var keys = Object.keys(d.children);
    if (keys.length > 500) return { ok: false, error: 'Çox sayda uşaq qeydi' };
    for (var i = 0; i < keys.length; i++) {
      var c = d.children[keys[i]];
      if (!isObj(c) || !isObj(c.form) || !Array.isArray(c.cycles)) return { ok: false, error: 'Uşaq qeydi zədəlidir' };
      for (var j = 0; j < c.cycles.length; j++) {
        var cy = c.cycles[j];
        if (!isObj(cy) || typeof cy.n !== 'number' || !isObj(cy.plan) || !Array.isArray(cy.plan.sessions) || !Array.isArray(cy.plan.home) || !Array.isArray(cy.plan.tests)) {
          return { ok: false, error: 'Plan qeydi zədəlidir' };
        }
        if (!/^\d{4}-\d{2}-\d{2}/.test(String(cy.plan.start || ''))) return { ok: false, error: 'Plan tarixi səhvdir' };
      }
    }
    return { ok: true };
  }

  return { create: create, validate: validate, memoryStore: memoryStore, KEY: KEY, VERSION: VERSION };
});
