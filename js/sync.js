(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlanSync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_JSON = 3000000;

  function rkey(key) {
    var h = 5381, i;
    for (i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
    var h2 = 7;
    for (i = key.length - 1; i >= 0; i--) h2 = ((h2 * 31) + key.charCodeAt(i)) >>> 0;
    return 'c' + h.toString(36) + h2.toString(36);
  }

  function childMt(c) { return c && c.mt || 0; }

  function mergeChild(local, remote) {
    var out = JSON.parse(JSON.stringify(local));
    remote.cycles.forEach(function (rc) {
      var i = -1;
      out.cycles.forEach(function (lc, idx) { if (lc.n === rc.n) i = idx; });
      if (i < 0) out.cycles.push(rc);
      else if ((rc.mt || 0) > (out.cycles[i].mt || 0)) out.cycles[i] = rc;
    });
    out.cycles.sort(function (a, b) { return a.n - b.n; });
    if (childMt(remote) > childMt(local)) out.form = remote.form;
    out.mt = Math.max(childMt(local), childMt(remote));
    return out;
  }

  function create(store, remote, validate) {
    function nodeFor(c) {
      var json = JSON.stringify(c);
      if (json.length > MAX_JSON) return null;
      return { key: c.key, mt: childMt(c), name: [c.form.ad, c.form.soyad].filter(Boolean).join(' '), json: json, del: false };
    }

    function push(uid, key) {
      var d = store.load();
      var c = d.children[key];
      var tomb = d.deleted && d.deleted[key];
      var node = null;
      if (c && c.owner === uid) node = nodeFor(c);
      else if (!c && tomb) node = { key: key, mt: tomb, name: '', json: '', del: true };
      if (!node) return Promise.resolve({ ok: false, error: 'skip' });
      return remote.put(uid, rkey(key), node).then(function () { return { ok: true }; });
    }

    function fullSync(uid) {
      return remote.fetchAll(uid).then(function (all) {
        var d = store.load();
        d.deleted = d.deleted || {};
        var pulled = 0, removed = 0, puts = [], seen = {};
        Object.keys(all || {}).forEach(function (rk) {
          var n = all[rk];
          if (!n || typeof n.key !== 'string' || n.key.indexOf(uid + '::') !== 0) return;
          seen[n.key] = true;
          var local = d.children[n.key];
          if (n.del) {
            if (local && childMt(local) <= n.mt) { delete d.children[n.key]; d.deleted[n.key] = n.mt; removed++; }
            else if (!local) d.deleted[n.key] = Math.max(d.deleted[n.key] || 0, n.mt);
            else puts.push(n.key);
            return;
          }
          if (d.deleted[n.key] && d.deleted[n.key] >= n.mt) { puts.push(n.key); return; }
          var rc;
          try { rc = JSON.parse(n.json); } catch (e) { return; }
          if (!rc || typeof rc !== 'object') return;
          rc.owner = uid; rc.key = n.key;
          if (validate) { var probe = { v: 2, children: {} }; probe.children[n.key] = rc; if (!validate(probe).ok) return; }
          if (!local) { d.children[n.key] = rc; delete d.deleted[n.key]; pulled++; return; }
          var m = mergeChild(local, rc);
          if (JSON.stringify(m) !== JSON.stringify(local)) { d.children[n.key] = m; pulled++; }
          if (childMt(m) > (n.mt || 0)) puts.push(n.key);
        });
        Object.keys(d.children).forEach(function (k) {
          if (d.children[k].owner === uid && !seen[k]) puts.push(k);
        });
        var r = store.save(d);
        if (r && r.ok === false) return { ok: false, error: 'local' };
        return Promise.all(puts.map(function (k) { return push(uid, k); })).then(function () {
          return { ok: true, pulled: pulled, removed: removed, pushed: puts.length };
        });
      });
    }

    return { fullSync: fullSync, push: push };
  }

  return { create: create, rkey: rkey, mergeChild: mergeChild, MAX_JSON: MAX_JSON };
});
