(function () {
  'use strict';
  var L = window.PlanBank;
  if (!L) return;

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function fmt(ts) {
    var d = new Date(ts);
    return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear();
  }
  function btn(text, cls, fn) {
    var b = el('button', { type: 'button', 'class': 'btn btn-sm ' + cls }, text);
    b.addEventListener('click', fn);
    return b;
  }

  var sent = false, busy = false, msg = '';

  var draft = { name: '', work: '', phone: '' };

  function requestForm(defaultName, label, submit) {
    if (!draft.name && defaultName) draft.name = defaultName;
    var f = el('div', { 'class': 'lic-form no-print' });
    function field(key, placeholder, extra) {
      var attrs = { 'class': 'mini', placeholder: placeholder, 'aria-label': placeholder, value: draft[key] };
      Object.keys(extra || {}).forEach(function (k) { attrs[k] = extra[k]; });
      var i = el('input', attrs);
      i.addEventListener('input', function () { draft[key] = i.value; });
      f.appendChild(i);
    }
    field('name', 'Ad Soyad');
    field('work', 'İş yeri');
    field('phone', 'Telefon', { inputmode: 'tel' });
    f.appendChild(btn(label, 'btn-primary', function () {
      if (busy) return;
      if (!draft.name.trim() || !draft.phone.trim()) { msg = 'Ad və telefon mütləqdir.'; render(); return; }
      busy = true;
      submit({ name: draft.name.trim(), work: draft.work.trim(), phone: draft.phone.trim() }).catch(function (e) {
        var code = e && e.code || '';
        msg = code.indexOf('auth/') === 0 ? 'Daxil olmaq mümkün olmadı: ' + code : 'Sorğu göndərilmədi. WhatsApp ilə yazın.';
      }).then(function () { busy = false; render(); });
    }));
    return f;
  }

  function displayName(u) {
    return (u.name || '').trim() || String(u.email || '').split('@')[0];
  }

  function closeAccount() {
    var o = document.getElementById('accOverlay');
    if (o) o.remove();
    document.removeEventListener('keydown', onAccKey);
    var c = document.querySelector('#userChip .user-name');
    if (c) c.focus();
  }
  function onAccKey(ev) { if (ev.key === 'Escape') closeAccount(); }

  function openAccount() {
    var st = L.state;
    if (!st.user || document.getElementById('accOverlay')) return;
    var full = st.mode === 'full' && st.license;
    var o = el('div', { 'class': 'acc-overlay', id: 'accOverlay' });
    var card = el('div', { 'class': 'acc-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'accTitle' });
    card.appendChild(el('h2', { id: 'accTitle' }, 'Hesab və lisenziya'));
    var dl = el('dl');
    function row(k, v) { dl.appendChild(el('dt', {}, k)); dl.appendChild(el('dd', {}, v)); }
    row('Ad', displayName(st.user));
    row('E-poçt', st.user.email || '');
    if (full) {
      row('Lisenziya', 'Aktivdir');
      row('Bitmə tarixi', fmt(st.license.expiresAt));
      row('Qalan müddət', L.daysLeft() + ' gün');
    } else {
      row('Lisenziya', st.mode === 'expired' ? 'Müddəti bitib' : 'Aktiv lisenziya yoxdur');
    }
    card.appendChild(dl);
    var actions = el('div', { 'class': 'acc-actions' });
    actions.appendChild(btn('Bağla', 'btn-ghost', closeAccount));
    actions.appendChild(btn('Çıxış', 'btn-outline', function () { closeAccount(); sent = false; L.signOut(); }));
    card.appendChild(actions);
    o.appendChild(card);
    o.addEventListener('click', function (ev) { if (ev.target === o) closeAccount(); });
    document.body.appendChild(o);
    document.addEventListener('keydown', onAccKey);
    var first = card.querySelector('button');
    if (first) first.focus();
  }

  function renderChip() {
    var chip = document.getElementById('userChip');
    if (!chip) return;
    var st = L.state;
    chip.textContent = '';
    chip.hidden = false;
    if (!st.user) {
      var inBtn = el('button', { type: 'button', 'class': 'user-name signin-chip' }, 'Google ilə daxil ol');
      inBtn.addEventListener('click', function () { L.signIn().catch(function (e) { msg = 'Daxil olmaq mümkün olmadı: ' + (e.code || e.message); render(); }); });
      chip.appendChild(inBtn);
      return;
    }
    var name = el('button', { type: 'button', 'class': 'user-name', 'aria-haspopup': 'dialog', title: 'Hesab və lisenziya məlumatı' }, displayName(st.user));
    name.addEventListener('click', openAccount);
    chip.appendChild(name);
    chip.appendChild(btn('Çıxış', 'btn-ghost', function () { sent = false; L.signOut(); }));
  }

  function render() {
    var host = document.getElementById('licenseBar');
    if (!host) return;
    var st = L.state;
    renderChip();
    host.textContent = '';
    var quiet = st.mode === 'full' && L.daysLeft() > 7 && st.error !== 'offline';
    host.hidden = quiet;
    host.className = 'banner' + (st.mode === 'full' ? '' : ' demo');
    var row = el('div', { 'class': 'lic-row' });
    var text = el('div', { 'class': 'lic-text' });
    var actions = el('div', { 'class': 'lic-actions no-print' });

    if (st.mode === 'full') {
      var d = L.daysLeft();
      text.appendChild(el('b', {}, 'Lisenziya aktivdir. '));
      text.appendChild(document.createTextNode('Bitmə tarixi ' + fmt(st.license.expiresAt) + ' (' + d + ' gün qalıb).'));
      if (d <= 7) { host.className = 'banner demo'; text.appendChild(document.createTextNode(' Fasiləsiz işləmək üçün müddəti uzadın.')); actions.appendChild(el('a', { 'class': 'btn btn-outline btn-sm', href: L.waLink(), target: '_blank', rel: 'noopener' }, 'Uzat (WhatsApp)')); }
      if (st.error === 'offline') text.appendChild(document.createTextNode(' Offline rejim: yadda saxlanmış baza istifadə olunur.'));
    } else if (!st.user) {
      text.appendChild(el('b', {}, 'Nümunə rejimi. '));
      text.appendChild(document.createTextNode('Tam məşğələ bazası, 3 səviyyə və ev proqramı lisenziya ilə açılır. Lisenziyanız varsa yuxarıdakı düymə ilə Google hesabınızla daxil olun. Yoxdursa, məlumatlarınızı yazıb aşağıdakı düyməni basın: Google hesabı seçiləcək və sorğu eyni anda göndəriləcək.'));
      text.appendChild(requestForm('', 'Google ilə daxil ol və sorğu göndər', function (info) {
        return L.signInAndRequest(info).then(function (r) { if (r.requested) sent = true; msg = ''; });
      }));
    } else {
      text.appendChild(el('b', {}, st.mode === 'expired' ? 'Lisenziyanın müddəti bitib. ' : 'Bu hesab üçün aktiv lisenziya yoxdur. '));
      text.appendChild(document.createTextNode(st.user.email + ' hesabı ilə daxil olmusunuz. ' + (sent ? 'Sorğunuz göndərildi, WhatsApp ilə də yazın ki, tez aktivləşdirək.' : 'Aşağıdakı sorğunu göndərin və ya birbaşa WhatsApp-da yazın.')));
      if (!sent) {
        text.appendChild(requestForm(st.user.name, 'Sorğu göndər', function (info) {
          return L.sendRequest(info).then(function () { sent = true; msg = ''; });
        }));
      }
      actions.appendChild(el('a', { 'class': 'btn btn-outline btn-sm', href: L.waLink(), target: '_blank', rel: 'noopener' }, 'WhatsApp'));
    }
    if (msg) text.appendChild(el('div', { 'class': 'lic-msg', role: 'alert' }, msg));
    row.appendChild(text); row.appendChild(actions); host.appendChild(row);
  }

  L.onChange(function () {
    render();
    if (window.PlanApp && window.PlanApp.onLicenseChange) window.PlanApp.onLicenseChange();
  });
  document.addEventListener('DOMContentLoaded', function () { render(); L.get(); });
  if (document.readyState !== 'loading') { render(); L.get(); }
})();
