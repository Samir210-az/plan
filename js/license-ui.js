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

  function render() {
    var host = document.getElementById('licenseBar');
    if (!host) return;
    var st = L.state;
    host.textContent = '';
    host.className = 'banner' + (st.mode === 'full' ? '' : ' demo');
    var row = el('div', { 'class': 'lic-row' });
    var text = el('div', { 'class': 'lic-text' });
    var actions = el('div', { 'class': 'lic-actions no-print' });

    if (st.mode === 'full') {
      var d = L.daysLeft();
      text.appendChild(el('b', {}, 'Lisenziya aktivdir. '));
      text.appendChild(document.createTextNode((st.user ? st.user.email + ' · ' : '') + 'bitmə tarixi ' + fmt(st.license.expiresAt) + ' (' + d + ' gün qalıb).'));
      if (d <= 7) { host.className = 'banner demo'; text.appendChild(document.createTextNode(' Fasiləsiz işləmək üçün müddəti uzadın.')); actions.appendChild(el('a', { 'class': 'btn btn-outline btn-sm', href: L.waLink(), target: '_blank', rel: 'noopener' }, 'Uzat (WhatsApp)')); }
      if (st.error === 'offline') text.appendChild(document.createTextNode(' Offline rejim: yadda saxlanmış baza istifadə olunur.'));
      actions.appendChild(btn('Çıxış', 'btn-outline', function () { L.signOut(); }));
    } else if (!st.user) {
      text.appendChild(el('b', {}, 'Nümunə rejimi. '));
      text.appendChild(document.createTextNode('Tam məşğələ bazası, 3 səviyyə və ev proqramı lisenziya ilə açılır. Lisenziyanız varsa Google hesabınızla daxil olun.'));
      actions.appendChild(btn('Google ilə daxil ol', 'btn-primary', function () { L.signIn().catch(function (e) { msg = 'Daxil olmaq mümkün olmadı: ' + (e.code || e.message); render(); }); }));
    } else {
      text.appendChild(el('b', {}, st.mode === 'expired' ? 'Lisenziyanın müddəti bitib. ' : 'Bu hesab üçün aktiv lisenziya yoxdur. '));
      text.appendChild(document.createTextNode(st.user.email + ' hesabı ilə daxil olmusunuz. ' + (sent ? 'Sorğunuz göndərildi, WhatsApp ilə də yazın ki, tez aktivləşdirək.' : 'Aşağıdakı sorğunu göndərin və ya birbaşa WhatsApp-da yazın.')));
      if (!sent) {
        var f = el('div', { 'class': 'lic-form no-print' });
        var n = el('input', { 'class': 'mini', placeholder: 'Ad Soyad', 'aria-label': 'Ad Soyad', value: st.user.name || '' });
        var w = el('input', { 'class': 'mini', placeholder: 'İş yeri', 'aria-label': 'İş yeri' });
        var p = el('input', { 'class': 'mini', placeholder: 'Telefon', 'aria-label': 'Telefon', inputmode: 'tel' });
        f.appendChild(n); f.appendChild(w); f.appendChild(p);
        f.appendChild(btn('Sorğu göndər', 'btn-primary', function () {
          if (busy) return;
          if (!n.value.trim() || !p.value.trim()) { msg = 'Ad və telefon mütləqdir.'; render(); return; }
          busy = true;
          L.sendRequest({ name: n.value.trim(), work: w.value.trim(), phone: p.value.trim() }).then(function () { sent = true; msg = ''; }).catch(function () { msg = 'Sorğu göndərilmədi. WhatsApp ilə yazın.'; }).then(function () { busy = false; render(); });
        }));
        text.appendChild(f);
      }
      actions.appendChild(el('a', { 'class': 'btn btn-outline btn-sm', href: L.waLink(), target: '_blank', rel: 'noopener' }, 'WhatsApp'));
      actions.appendChild(btn('Çıxış', 'btn-outline', function () { sent = false; L.signOut(); }));
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
