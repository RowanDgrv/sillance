/* ============================================================
   Sillance — mesure d'audience anonyme (catégorie "analytics"
   du bandeau cookies, sillance-cookies.js).
   ------------------------------------------------------------
   N'envoie STRICTEMENT rien tant que le visiteur n'a pas accepté
   cette catégorie (window.SilCookies.has('analytics')). Aucune
   donnée personnelle transmise : pathname seul (jamais la query
   string), host du référent seul (jamais l'URL complète), langue
   d'affichage. Pas de cookie, pas d'identifiant visiteur, pas de
   session — un simple comptage de pages vues, comme demandé dans
   la politique de confidentialité (legal.html §3.7).
   ============================================================ */
(function(){
  var ENDPOINT = 'https://onbsgohvqejccowfnrbs.supabase.co/functions/v1/track-pageview';
  var ANON_KEY = 'sb_publishable_Tiz8pcjnik-Xj85Jvahivw_dfNqf_TT';
  var sent = false;

  function referrerHost(){
    try{
      if(!document.referrer) return null;
      var host = new URL(document.referrer).hostname;
      return host === location.hostname ? null : host; // pas d'intérêt à tracer son propre domaine
    }catch(e){ return null; }
  }

  function currentLang(){
    if(window.SilI18n && typeof window.SilI18n.getLang === 'function') return window.SilI18n.getLang();
    return (document.documentElement.lang || '').slice(0,2) || null;
  }

  function send(){
    if(sent) return;
    if(!window.SilCookies || !window.SilCookies.has('analytics')) return;
    sent = true;
    var payload = {
      path: location.pathname,
      referrer_host: referrerHost(),
      lang: currentLang()
    };
    fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY
      },
      body: JSON.stringify(payload)
    }).catch(function(){ /* silencieux : la mesure ne doit jamais gêner la navigation */ });
  }

  function init(){
    send(); // déjà consentant (ré-visite) → envoie tout de suite
    document.addEventListener('sil:consentchange', function(e){
      if(e.detail && e.detail.analytics) send(); // vient d'accepter → envoie la vue en cours
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
