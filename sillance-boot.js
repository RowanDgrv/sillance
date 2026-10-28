/* ============================================================
   Sillance — écran de chargement au démarrage (28/10/2026)
   ------------------------------------------------------------
   Bug signalé par Rowan : connecté, à chaque rechargement le calendrier
   de DÉMO s'affichait ~2 s avant d'être remplacé par ses vraies données
   (l'app dessine la démo pendant que sillance-integration.js vérifie la
   session et charge le compte). Chargé dans le <head> : s'il existe une
   session Supabase enregistrée dans ce navigateur, on masque la page
   derrière « Chargement de ton espace… » jusqu'à ce que l'intégration
   retire la classe pf-booting (fin du boot), au plus 8 s par sécurité.
   Sans session enregistrée : rien ne change, la démo s'affiche directement.
   ============================================================ */
(function(){
  var hasSession = false;
  try{
    for(var i = 0; i < localStorage.length; i++){
      if(/^sb-.+-auth-token$/.test(localStorage.key(i) || '')){ hasSession = true; break; }
    }
  }catch(e){}
  if(!hasSession) return;
  var lang = 'fr';
  try{ lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('sil_lang') || 'fr'; }catch(e){}
  var label = { fr: 'Chargement de ton espace…', en: 'Loading your space…', es: 'Cargando tu espacio…' }[lang] || 'Chargement de ton espace…';
  var root = document.documentElement;
  root.classList.add('pf-booting');
  var st = document.createElement('style');
  st.textContent = 'html.pf-booting body{visibility:hidden}'
    + 'html.pf-booting::after{content:"' + label + '";position:fixed;inset:0;display:grid;place-items:center;'
    + 'background:#0b1120;color:#9fb0bb;font:600 15px/1.4 system-ui,-apple-system,sans-serif;z-index:2147483647}';
  document.head.appendChild(st);
  setTimeout(function(){ root.classList.remove('pf-booting'); }, 8000);
})();
