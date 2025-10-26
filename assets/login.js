(function(){
  if(window.__LOGIN_PAGE_INIT__){ console.warn('[login] already initialized'); return; }
  window.__LOGIN_PAGE_INIT__ = true;
  
  function el(id){ return document.getElementById(id); }
  function setStatus(msg,type){ 
    var box=el('statusMessage'); 
    if(!box) return; 
    box.textContent=msg; 
    box.className='status-message status-'+(type||'error'); 
    box.style.display='block'; 
  }
  function clearStatus(){ 
    var box=el('statusMessage'); 
    if(box) box.style.display='none'; 
  }
  
  async function ensureAuth(){ 
    if(window.authSystem) return; 
    if(typeof AuthenticationSystem==='undefined') throw new Error('auth.js yüklenmedi'); 
    window.authSystem=new AuthenticationSystem(); 
    await window.authSystem.init(); 
  }
  
  async function onSubmit(e){ 
    e.preventDefault(); 
    var u=el('username').value.trim(); 
    var p=el('password').value.trim(); 
    var btn=el('loginButton'); 
    
    if(!u||!p){ 
      setStatus('❌ Lütfen kullanıcı adı ve şifre girin','error'); 
      return; 
    } 
    
    btn.disabled=true; 
    var old=btn.innerHTML; 
    btn.innerHTML='🔄 Giriş yapılıyor...'; 
    clearStatus(); 
    
    try { 
      await ensureAuth(); 
      var response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: u, password: p })
      });

      if (!response.ok) {
        var errorPayload = await response.json().catch(function(){ return null; });
        var errorMessage = (errorPayload && errorPayload.message) ? errorPayload.message : ('HTTP ' + response.status);
        throw new Error(errorMessage);
      }

      var payload = await response.json();
      if (!payload || !payload.success) {
        throw new Error((payload && payload.message) ? payload.message : 'Giriş başarısız');
      }

      try {
        var jwtToken = payload.token;
        if (jwtToken) {
          localStorage.setItem('serverJwt', jwtToken);
        }
      } catch (storageErr) {
        console.warn('JWT storage error:', storageErr);
      }

      var safeUser = payload.user || null;
      if (safeUser && window.authSystem && typeof window.authSystem.loadSessionFromBackend === 'function') {
        window.authSystem.loadSessionFromBackend(safeUser);
      } else if (safeUser) {
        try { localStorage.setItem('currentUser', JSON.stringify(safeUser)); } catch(e){}
      }

      setStatus('✅ Başarılı giriş! '+(safeUser && safeUser.role ? safeUser.role : '')+' yönlendiriliyor...','success');
      setTimeout(function(){ location.href='index.html'; }, 1200);
    } catch(err){ 
      console.error(err); 
      setStatus('❌ Giriş hatası: '+err.message,'error'); 
    } finally { 
      btn.disabled=false; 
      btn.innerHTML=old; 
    } 
  }
  
  function attachDemo(){ 
    document.querySelectorAll('.demo-cred').forEach(function(card){ 
      card.addEventListener('click',function(){ 
        el('username').value=this.dataset.username; 
        el('password').value=this.dataset.password; 
        clearStatus(); 
        el('password').focus(); 
      }); 
    }); 
  }
  
  function checkSession(){ 
    try { 
      var storedToken = localStorage.getItem('serverJwt');
      var storedUser = localStorage.getItem('currentUser');
      if (storedToken && storedUser) {
        setStatus('✅ Aktif oturum var, yönlendiriliyor...','success');
        setTimeout(function(){ location.href='index.html'; },900);
        return;
      }

      if(!window.authSystem) return; 
      var u=window.authSystem.getCurrentUser && window.authSystem.getCurrentUser(); 
      if(u){ 
        setStatus('✅ Aktif oturum var, yönlendiriliyor...','success'); 
        setTimeout(function(){ 
          location.href='index.html'; 
        },900); 
      } 
    } catch(e){ 
      console.warn('session check error',e); 
    } 
  }
  
  document.addEventListener('DOMContentLoaded',function(){ 
    var f=el('loginForm'); 
    if(f) f.addEventListener('submit',onSubmit); 
    attachDemo(); 
    ensureAuth().then(checkSession).catch(function(e){ 
      console.error('Auth init failed',e); 
      setStatus('❌ Auth yükleme hatası','error'); 
    }); 
  });
})();