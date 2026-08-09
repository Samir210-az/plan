/* ============================================================
   AN Psixoloji — Qeydiyyat + Aktivləşdirmə Modulu (v2)
   Telefon + PIN qeydiyyatı → SuperAdmin təsdiqi ilə aktiv olur.
   Repetitor CRM modeli üzrə. Bütün alət səhifələri bunu import edir.
============================================================ */
(function(){
  var TOOL_ID = document.currentScript.getAttribute('data-tool') || 'test';

  var FB_CONFIG = {
    apiKey: "AIzaSyCBhyGNzZRGgQShP_C9kwAzTm_g_0zJlzg",
    authDomain: "an-psixoloji-33442.firebaseapp.com",
    databaseURL: "https://an-psixoloji-33442-default-rtdb.firebaseio.com",
    projectId: "an-psixoloji-33442",
    storageBucket: "an-psixoloji-33442.firebasestorage.app",
    messagingSenderId: "528809299356",
    appId: "1:528809299356:web:59cae89a64e446dc520c59"
  };
  var SDK = '10.13.1';
  var WA_NUMBER = '994552107111';
  var SESSION_KEY = 'anp_session_' + TOOL_ID;
  var BYPASS_PHONES = ['+994502103468', '+994554157215'];

  function loadScript(src){ return new Promise(function(res,rej){ var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
  var fbReady=null;
  function ensureFirebase(){
    if(fbReady) return fbReady;
    fbReady = loadScript('https://www.gstatic.com/firebasejs/'+SDK+'/firebase-app-compat.js')
      .then(function(){ return Promise.all([
        loadScript('https://www.gstatic.com/firebasejs/'+SDK+'/firebase-auth-compat.js'),
        loadScript('https://www.gstatic.com/firebasejs/'+SDK+'/firebase-database-compat.js')
      ]); })
      .then(function(){
        if(!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
        if(!firebase.auth().currentUser){ return firebase.auth().signInAnonymously().catch(function(){}); }
      });
    return fbReady;
  }
  function normalizePhone(v){
    var s=(v||'').replace(/[^\d+]/g,'');
    if(s.indexOf('00')===0) s='+'+s.slice(2);
    if(s.indexOf('0')===0) s='+994'+s.slice(1);
    if(s.indexOf('+')!==0) s='+994'+s;
    return /^\+994\d{9}$/.test(s) ? s : null;
  }
  function phoneKey(p){ return p.replace('+',''); }
  function getSession(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY))||null; }catch(e){ return null; } }
  function setSession(s){ localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  var approved=false;
  function isVerified(){ return approved; }

  var activeWatchKey=null;
  function watchApproval(key, cb){
    activeWatchKey = key;
    ensureFirebase().then(function(){
      firebase.database().ref('registrations/'+TOOL_ID+'/'+key).on('value', function(snap){
        var v=snap.val();
        approved = !!(v && v.approved);
        if(typeof cb==='function') cb(approved, v);
        renderWidget();
      });
    });
  }

  (function initSession(){
    var s=getSession();
    if(!s) return;
    if(BYPASS_PHONES.indexOf(s.phone)>-1){ approved=true; return; }
    watchApproval(phoneKey(s.phone), function(ok){
      if(ok){
        var wait=document.getElementById('anpVerifyWait');
        var overlay=document.getElementById('anpVerifyOverlay');
        if(wait && overlay && overlay.classList.contains('show')){
          closeModal();
          if(typeof pendingCb==='function'){ var cb=pendingCb; pendingCb=null; cb(); }
        }
      }
    });
  })();

  var pendingCb=null, regMode=true;
  var CSS = '.anp-overlay{position:fixed;inset:0;background:rgba(20,20,20,.6);backdrop-filter:blur(3px);display:none;place-items:center;z-index:99999;padding:20px}'
    + '.anp-overlay.show{display:grid}'
    + '.anp-modal{background:#fff;border-radius:18px;padding:30px 26px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);position:relative;font-family:inherit;color:#2a1c1c}'
    + '.anp-modal h3{margin:0 0 8px;font-size:1.25rem;color:#6A0000}'
    + '.anp-modal .anp-muted{font-size:.88rem;color:#666;margin-bottom:14px;line-height:1.5}'
    + '.anp-modal label{display:block;font-size:.78rem;font-weight:700;color:#555;margin:10px 0 4px}'
    + '.anp-modal input{width:100%;font-size:.95rem;padding:11px 13px;border:1px solid #ddd;border-radius:10px;box-sizing:border-box}'
    + '.anp-tabs{display:flex;gap:6px;background:#f3ece0;border-radius:999px;padding:4px;margin-bottom:14px}'
    + '.anp-tab{flex:1;border:none;background:transparent;padding:9px 0;border-radius:999px;font-size:.85rem;font-weight:700;color:#666;cursor:pointer}'
    + '.anp-tab.active{background:#6A0000;color:#fff}'
    + '.anp-btn{width:100%;margin-top:16px;padding:12px;border-radius:10px;font-size:15px;cursor:pointer;border:none;background:#6A0000;color:#fff;font-weight:700;text-decoration:none;display:block;text-align:center;box-sizing:border-box}'
    + '.anp-close{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;border:none;background:#f3ece0;cursor:pointer;font-size:1.1rem}'
    + '.anp-err{color:#b34242;font-size:.82rem;min-height:1.1em;margin-top:6px}'
    + '#anpVerifyWait{text-align:center}';

  var WIDGET_CSS = '#anpAccWidget{position:fixed;bottom:14px;right:14px;z-index:9997;font-family:inherit}'
    + '.anp-acc-btn{background:#6A0000;color:#fff;border:none;border-radius:999px;padding:9px 16px;font-size:.82rem;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.2);display:flex;align-items:center;gap:6px}'
    + '.anp-acc-btn.pending{background:#b34242}'
    + '.anp-acc-chip{background:#fff;border:1px solid #e7ddd0;border-radius:999px;padding:6px 8px 6px 14px;font-size:.82rem;font-weight:700;color:#333;box-shadow:0 6px 18px rgba(0,0,0,.15);display:flex;align-items:center;gap:8px}'
    + '.anp-acc-logout{background:#f3ece0;border:none;border-radius:999px;padding:6px 12px;font-size:.76rem;font-weight:700;color:#6A0000;cursor:pointer}';

  function injectCSS(){ if(document.getElementById('anpStyle')) return; var st=document.createElement('style'); st.id='anpStyle'; st.textContent=CSS+WIDGET_CSS; document.head.appendChild(st); }

  function buildModal(){
    if(document.getElementById('anpVerifyOverlay')) return;
    injectCSS();
    var el=document.createElement('div'); el.id='anpVerifyOverlay'; el.className='anp-overlay';
    el.innerHTML = '<div class="anp-modal">'
      + '<button class="anp-close" type="button">×</button>'
      + '<div class="anp-tabs"><button type="button" class="anp-tab active" id="anpTabReg">Qeydiyyat</button><button type="button" class="anp-tab" id="anpTabLogin">Daxil ol</button></div>'
      + '<div id="anpStep1">'
      + '<p class="anp-muted">Bu aləti istifadə etmək üçün bir dəfə qeydiyyatdan keç.</p>'
      + '<div id="anpFldName"><label>Ad Soyad</label><input id="anpName" type="text" placeholder="Ad Soyad"></div>'
      + '<div id="anpFldWork"><label>İş yeri</label><input id="anpWork" type="text" placeholder="Məs. AN Psixoloji Mərkəzi"></div>'
      + '<label>Telefon nömrəsi</label><input id="anpPhone" type="tel" placeholder="+994 XX XXX XX XX">'
      + '<label id="anpPinLabel">PIN təyin et (min. 4 rəqəm)</label><input id="anpPin" type="password" maxlength="8" placeholder="••••">'
      + '<div class="anp-err" id="anpErr1"></div>'
      + '<button class="anp-btn" id="anpSubmit" type="button">Hesab yarat</button>'
      + '</div>'
      + '<div id="anpVerifyWait" style="display:none">'
      + '<div style="font-size:2.2rem;margin:4px 0 10px">⏳</div>'
      + '<h3>Hesabın yoxlanılır</h3>'
      + '<p class="anp-muted">Qeydiyyatın SECURITY GROUP tərəfindən təsdiqlənməlidir. Aktivləşdirmək üçün WhatsApp ilə yaz — təsdiqləndikdən sonra bu pəncərə avtomatik bağlanacaq.</p>'
      + '<a class="anp-btn" id="anpWaBtn" href="#" target="_blank" rel="noopener noreferrer">WhatsApp ilə əlaqə saxla</a>'
      + '</div>'
      + '</div>';
    document.body.appendChild(el);
    el.querySelector('.anp-close').onclick = closeModal;
    el.addEventListener('click', function(e){ if(e.target===el) closeModal(); });
    el.querySelector('#anpTabReg').onclick = function(){ setMode(true); };
    el.querySelector('#anpTabLogin').onclick = function(){ setMode(false); };
    el.querySelector('#anpSubmit').onclick = submit;
  }
  function setMode(isReg){
    regMode=isReg;
    document.getElementById('anpTabReg').classList.toggle('active', isReg);
    document.getElementById('anpTabLogin').classList.toggle('active', !isReg);
    document.getElementById('anpFldName').style.display = isReg?'block':'none';
    document.getElementById('anpFldWork').style.display = isReg?'block':'none';
    document.getElementById('anpPinLabel').textContent = isReg?'PIN təyin et (min. 4 rəqəm)':'PIN';
    document.getElementById('anpSubmit').textContent = isReg?'Hesab yarat':'Daxil ol';
    document.getElementById('anpErr1').textContent='';
  }
  function closeModal(){ var el=document.getElementById('anpVerifyOverlay'); if(el) el.classList.remove('show'); }

  function openVerifyModal(onSuccess){
    pendingCb = onSuccess;
    buildModal();
    document.getElementById('anpVerifyOverlay').classList.add('show');
    var s=getSession();
    if(s){ showWait(s); }
    else { document.getElementById('anpStep1').style.display='block'; document.getElementById('anpVerifyWait').style.display='none'; setMode(true); }
  }
  function showWait(s){
    document.getElementById('anpStep1').style.display='none';
    document.getElementById('anpVerifyWait').style.display='block';
    var msg = encodeURIComponent('Salam, mən '+(s.name||'')+'. "'+TOOL_ID+'" alətindən istifadə üçün hesabımı aktivləşdirin. Telefon: '+s.phone);
    document.getElementById('anpWaBtn').href = 'https://wa.me/'+WA_NUMBER+'?text='+msg;
  }

  function submit(){
    var err=document.getElementById('anpErr1'); err.textContent='';
    var phone = normalizePhone(document.getElementById('anpPhone').value);
    var pin = document.getElementById('anpPin').value.trim();
    if(!phone){ err.textContent='Telefon nömrəsini düzgün daxil et (+994...).'; return; }
    if(!pin || pin.length<4){ err.textContent='PIN minimum 4 rəqəm olsun.'; return; }
    var btn=document.getElementById('anpSubmit'); btn.disabled=true; btn.textContent='Göndərilir…';
    var key=phoneKey(phone);
    ensureFirebase().then(function(){
      var dbRef=firebase.database().ref('registrations/'+TOOL_ID+'/'+key);
      if(regMode){
        var name=document.getElementById('anpName').value.trim();
        var work=document.getElementById('anpWork').value.trim();
        if(!name||!work){ err.textContent='Ad Soyad və İş yeri mütləqdir.'; btn.disabled=false; btn.textContent='Hesab yarat'; return; }
        dbRef.once('value').then(function(existing){
          if(existing.exists()){ err.textContent='Bu nömrə ilə artıq qeydiyyat var. "Daxil ol" sekmesindən gir.'; btn.disabled=false; btn.textContent='Hesab yarat'; return; }
          var isBypass = BYPASS_PHONES.indexOf(phone)>-1;
          dbRef.set({ adSoyad:name, isYeri:work, phone:phone, pin:pin, ts:Date.now(), approved:isBypass, bypass:isBypass }).then(function(){
            setSession({name:name, work:work, phone:phone});
            if(isBypass){ approved=true; closeModal(); renderWidget(); if(typeof pendingCb==='function'){ var cb=pendingCb; pendingCb=null; cb(); } }
            else { watchApproval(key, function(){}); showWait({name:name, phone:phone}); }
            btn.disabled=false; btn.textContent='Hesab yarat';
          });
        });
      } else {
        dbRef.once('value').then(function(snap){
          if(!snap.exists()){ err.textContent='Bu nömrə ilə qeydiyyat tapılmadı. "Qeydiyyat" sekmesindən qeydiyyatdan keç.'; btn.disabled=false; btn.textContent='Daxil ol'; return; }
          var v=snap.val();
          if(String(v.pin)!==String(pin)){ err.textContent='PIN yanlışdır.'; btn.disabled=false; btn.textContent='Daxil ol'; return; }
          setSession({name:v.adSoyad, work:v.isYeri, phone:phone});
          if(v.approved){ approved=true; closeModal(); renderWidget(); if(typeof pendingCb==='function'){ var cb=pendingCb; pendingCb=null; cb(); } }
          else { watchApproval(key, function(){}); showWait({name:v.adSoyad, phone:phone}); }
          btn.disabled=false; btn.textContent='Daxil ol';
        });
      }
    }).catch(function(e){ err.textContent='Xəta baş verdi: '+(e.message||e.code||'naməlum'); btn.disabled=false; btn.textContent=regMode?'Hesab yarat':'Daxil ol'; });
  }

  function logout(){
    if(activeWatchKey){
      ensureFirebase().then(function(){
        firebase.database().ref('registrations/'+TOOL_ID+'/'+activeWatchKey).off();
      });
      activeWatchKey=null;
    }
    clearSession();
    approved=false;
    renderWidget();
  }

  function buildWidget(){
    if(document.getElementById('anpAccWidget')) return;
    injectCSS();
    var el=document.createElement('div'); el.id='anpAccWidget';
    document.body.appendChild(el);
  }
  function renderWidget(){
    var el=document.getElementById('anpAccWidget');
    if(!el) return;
    var s=getSession();
    if(!s){
      el.innerHTML='<button class="anp-acc-btn" id="anpAccBtn">👤 Hesabım</button>';
      document.getElementById('anpAccBtn').onclick=function(){ openVerifyModal(function(){}); };
    } else if(!approved){
      el.innerHTML='<button class="anp-acc-btn pending" id="anpAccBtn">⏳ Gözləyir</button>';
      document.getElementById('anpAccBtn').onclick=function(){ openVerifyModal(function(){}); };
    } else {
      var nameShort=(s.name||'İstifadəçi').split(' ')[0];
      el.innerHTML='<div class="anp-acc-chip">👤 '+nameShort+' <button class="anp-acc-logout" id="anpLogoutBtn">Çıxış</button></div>';
      document.getElementById('anpLogoutBtn').onclick=function(){
        if(confirm('Hesabdan çıxmaq istəyirsiniz?')) logout();
      };
    }
  }
  document.addEventListener('DOMContentLoaded', function(){
    buildWidget();
    renderWidget();
  });

  /* Konteynerdə ilk klikə qədər gözləyir, sonra qeydiyyat/aktivləşdirmə tələb edir.
     itemSelector verilməsə, konteynerin özü hədəf sayılır (məs. tək düymə). */
  window.LICENSE = {
    init: function(containerSelector, itemSelector, eventType){
      eventType = eventType || 'click';
      var host = document.querySelector(containerSelector);
      if(!host) return;
      host.addEventListener(eventType, function(e){
        var target = itemSelector ? e.target.closest(itemSelector) : (e.target===host ? host : e.target.closest(containerSelector));
        if(!target) return;
        if(isVerified()) return;
        e.preventDefault(); e.stopPropagation();
        openVerifyModal(function(){
          if(eventType==='click'){ target.click(); }
          else { target.dispatchEvent(new Event(eventType, {bubbles:true})); }
        });
      }, true);
    },
    isVerified: isVerified
  };
})();
