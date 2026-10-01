(function () {
  'use strict';

  var FB_CONFIG = {
    apiKey: 'AIzaSyCBhyGNzZRGgQShP_C9kwAzTm_g_0zJlzg',
    authDomain: 'an-psixoloji-33442.firebaseapp.com',
    databaseURL: 'https://an-psixoloji-33442-default-rtdb.firebaseio.com',
    projectId: 'an-psixoloji-33442',
    storageBucket: 'an-psixoloji-33442.firebasestorage.app',
    messagingSenderId: '528809299356',
    appId: '1:528809299356:web:59cae89a64e446dc520c59'
  };
  var SDK = '10.13.1';
  var WA = '994552107111';
  var CACHE_KEY = 'plan_bank_cache_v2';
  var DAY = 86400000;

  var fbP = null;
  var current = { user: null, license: null, mode: 'demo', bank: null, error: null };
  var listeners = [];

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Firebase yüklənmədi')); };
      document.head.appendChild(s);
    });
  }
  function firebaseReady() {
    if (fbP) return fbP;
    if (window.firebase && window.firebase.auth && window.firebase.database) {
      if (!window.firebase.apps.length) window.firebase.initializeApp(FB_CONFIG);
      fbP = Promise.resolve(window.firebase);
      return fbP;
    }
    var base = 'https://www.gstatic.com/firebasejs/' + SDK + '/';
    fbP = loadScript(base + 'firebase-app-compat.js').then(function () {
      return Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-database-compat.js')]);
    }).then(function () {
      if (!window.firebase.apps.length) window.firebase.initializeApp(FB_CONFIG);
      return window.firebase;
    });
    fbP.catch(function () { fbP = null; });
    return fbP;
  }

  function demoBank() {
    return fetch('data/demo-bank.json').then(function (r) { return r.json(); });
  }
  function readCache(uid) {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (c && c.uid === uid && c.expiresAt > Date.now() && c.bank && c.bank.act) return c;
    } catch (e) { /* kənar */ }
    return null;
  }
  function writeCache(uid, expiresAt, bank) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ uid: uid, expiresAt: expiresAt, bank: bank })); } catch (e) { /* yer yoxdur */ }
  }
  function clearCache() { try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* kənar */ } }

  function emit() { listeners.forEach(function (f) { try { f(current); } catch (e) { /* kənar */ } }); }

  function resolve(user) {
    current.user = user; current.license = null; current.error = null;
    if (!user) {
      clearCache();
      return demoBank().then(function (b) { current.mode = 'demo'; current.bank = b; emit(); return current; });
    }
    return firebaseReady().then(function (fb) {
      return fb.database().ref('plan_licenses/' + user.uid).once('value');
    }).then(function (snap) {
      var lic = snap.val();
      if (!lic || !(lic.expiresAt > Date.now())) {
        current.license = lic || null;
        clearCache();
        return demoBank().then(function (b) { current.mode = lic ? 'expired' : 'demo'; current.bank = b; emit(); return current; });
      }
      current.license = lic;
      return window.firebase.database().ref('plan_bank/data').once('value').then(function (bs) {
        var raw = bs.val();
        var bank = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!bank || !bank.act) throw new Error('Baza tapılmadı');
        writeCache(user.uid, lic.expiresAt, bank);
        current.mode = 'full'; current.bank = bank; emit();
        return current;
      });
    }).catch(function (e) {
      var c = user && readCache(user.uid);
      if (c) { current.mode = 'full'; current.bank = c.bank; current.license = { expiresAt: c.expiresAt }; current.error = 'offline'; emit(); return current; }
      current.error = e && e.message || 'xəta';
      return demoBank().then(function (b) { current.mode = 'demo'; current.bank = b; emit(); return current; });
    });
  }

  function init() {
    return firebaseReady().then(function (fb) {
      return new Promise(function (ok) {
        var first = true;
        fb.auth().onAuthStateChanged(function (u) {
          var user = u && !u.isAnonymous ? { uid: u.uid, email: u.email, name: u.displayName || '' } : null;
          var p = resolve(user);
          if (first) { first = false; p.then(ok); }
        });
      });
    }).catch(function () {
      return demoBank().then(function (b) { current.mode = 'demo'; current.bank = b; current.error = 'offline'; emit(); return current; });
    });
  }

  var started = null;
  function get() {
    if (!started) started = init();
    return started.then(function () { return { bank: current.bank, mode: current.mode, license: current.license }; });
  }

  function signIn() {
    return firebaseReady().then(function (fb) {
      var prov = new fb.auth.GoogleAuthProvider();
      prov.setCustomParameters({ prompt: 'select_account' });
      return fb.auth().signInWithPopup(prov);
    });
  }
  function signOut() {
    return firebaseReady().then(function (fb) { clearCache(); return fb.auth().signOut(); });
  }
  function sendRequest(info) {
    if (!current.user) return Promise.reject(new Error('Əvvəlcə daxil olun'));
    var u = current.user;
    var rec = { email: u.email, name: String(info.name || u.name || '').slice(0, 120), work: String(info.work || '').slice(0, 160), phone: String(info.phone || '').slice(0, 30), ts: Date.now() };
    return firebaseReady().then(function (fb) { return fb.database().ref('plan_requests/' + u.uid).set(rec); });
  }
  function waLink() {
    var u = current.user;
    var msg = 'Salam. Fərdi Reabilitasiya Planı Generatoru üçün lisenziya almaq istəyirəm.' + (u ? '\nGoogle hesabı: ' + u.email : '');
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg);
  }
  function onChange(fn) { listeners.push(fn); }
  function daysLeft() { return current.license && current.license.expiresAt ? Math.ceil((current.license.expiresAt - Date.now()) / DAY) : 0; }

  window.PlanBank = { get: get, signIn: signIn, signOut: signOut, sendRequest: sendRequest, waLink: waLink, onChange: onChange, state: current, daysLeft: daysLeft, firebaseReady: firebaseReady };
})();
