/* ============================================================
   Sillance — mesure d'audience anonyme, EXEMPTÉE de consentement
   (régime CNIL de la mesure d'audience, migration 0078, 28/10/2026).
   ------------------------------------------------------------
   Active par défaut, coupée si le visiteur a REFUSÉ la mesure
   d'audience dans le bandeau cookies (droit d'opposition) ou si
   l'appareil est marqué « ne pas me compter » (?moi=1).
   Rien de personnel : pas d'IP stockée, pas de compte, pas de
   texte saisi. Envoie :
     - page vue (pathname seul, jamais la query string)
     - host du site d'origine, langue d'affichage
     - source déclarée dans le lien (?src=linkedin), format fermé
     - visit_id : nombre aléatoire tiré à l'ouverture de l'onglet
       (sessionStorage) → compte des visites, pas des personnes
     - pages publiques uniquement : paliers de lecture (25/50/75/100 %)
       et clics sur liens/boutons (libellé = clé technique du bouton
       ou chemin du lien, jamais son texte)
     - événement « signup » à l'inscription réussie (SilTrack.event)
   Dans l'app (comptes, données d'athlètes) : page vue seulement,
   aucun clic n'est suivi.
   ============================================================ */
(function(){
  var ENDPOINT = 'https://onbsgohvqejccowfnrbs.supabase.co/functions/v1/track-pageview';
  var ANON_KEY = 'sb_publishable_Tiz8pcjnik-Xj85Jvahivw_dfNqf_TT';
  // Pages où vivent des données de comptes : aucun clic ni lecture suivis.
  var PRIVATE = /\/(sillance-app|sillance-calendrier|sillance-review|spectateur|sillance-admin|sillance-stats)\.html$/;

  function store(kind){ try{ return window[kind]; }catch(e){ return null; } }
  function get(kind, k){ try{ var s=store(kind); return s ? s.getItem(k) : null; }catch(e){ return null; } }
  function set(kind, k, v){ try{ var s=store(kind); if(s){ v==null ? s.removeItem(k) : s.setItem(k, v); } }catch(e){} }

  /* ?moi=1 : cet appareil n'est plus compté (Rowan) ; ?moi=0 : il l'est de nouveau. */
  (function(){
    var m = /[?&]moi=([01])/.exec(location.search);
    if(m) set('localStorage', 'sil_noTrack', m[1] === '1' ? '1' : null);
  })();

  function optedOut(){
    if(get('localStorage', 'sil_noTrack') === '1') return true;
    // Refus explicite dans le bandeau = opposition : rien n'est envoyé.
    var c = window.SilCookies && window.SilCookies.consent;
    return !!(c && c.analytics === false);
  }

  function visitId(){
    var v = get('sessionStorage', 'sil_visit');
    if(!v){
      var a = new Uint8Array(8);
      (window.crypto || window.msCrypto).getRandomValues(a);
      v = Array.prototype.map.call(a, function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
      set('sessionStorage', 'sil_visit', v);
    }
    return v;
  }
  /* Source du lien (?src= ou ?utm_source=), gardée pour toute la visite. */
  function source(){
    var m = /[?&](?:src|utm_source)=([A-Za-z0-9_-]{1,30})/.exec(location.search);
    if(m) set('sessionStorage', 'sil_src', m[1].toLowerCase());
    return get('sessionStorage', 'sil_src');
  }
  function referrerHost(){
    try{
      if(!document.referrer) return null;
      var host = new URL(document.referrer).hostname;
      return host === location.hostname ? null : host;
    }catch(e){ return null; }
  }
  function currentLang(){
    if(window.SilI18n && typeof window.SilI18n.getLang === 'function') return window.SilI18n.getLang();
    return (document.documentElement.lang || '').slice(0,2) || null;
  }

  function send(event, label){
    if(optedOut()) return;
    var payload = {
      path: location.pathname, referrer_host: referrerHost(), lang: currentLang(),
      event: event || 'view', label: label || null, visit_id: visitId(), src: source()
    };
    try{
      fetch(ENDPOINT, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + ANON_KEY },
        body: JSON.stringify(payload)
      }).catch(function(){ /* la mesure ne doit jamais gêner la navigation */ });
    }catch(e){}
  }

  /* Libellé technique d'un lien/bouton : data-track, sinon clé i18n, sinon
     chemin du lien (+ ancre). Jamais le texte affiché. */
  function labelOf(el){
    var l = el.getAttribute('data-track') || el.getAttribute('data-i18n');
    if(!l && el.tagName === 'A' && el.getAttribute('href')){
      try{
        var u = new URL(el.getAttribute('href'), location.href);
        l = u.origin === location.origin ? u.pathname.replace(/^\/$/, '/index') + (u.hash || '') : 'externe:' + u.hostname;
      }catch(e){ l = null; }
    }
    if(!l) l = el.id ? '#' + el.id : null;
    // destination ajoutée pour savoir si le clic mène à l'app
    if(l && el.tagName === 'A' && /sillance-app\.html/.test(el.getAttribute('href') || '') && l.indexOf('sillance-app') < 0) l += '/sillance-app';
    return l ? l.replace(/[^A-Za-z0-9_.\-\/#?=&:]/g, '').slice(0, 80) : null;
  }

  function trackPublic(){
    document.addEventListener('click', function(e){
      var el = e.target.closest && e.target.closest('a,button');
      if(!el) return;
      var l = labelOf(el); if(l) send('click', l.replace(/:/g, '-'));
    }, true);
    var marks = [25, 50, 75, 100], done = {};
    function onScroll(){
      var h = document.documentElement, max = h.scrollHeight - innerHeight;
      var pct = max <= 0 ? 100 : (scrollY / max) * 100;
      marks.forEach(function(m){ if(pct >= m - 2 && !done[m]){ done[m] = true; send('scroll', String(m)); } });
    }
    addEventListener('scroll', function(){ clearTimeout(onScroll._t); onScroll._t = setTimeout(onScroll, 250); }, { passive: true });
  }

  function init(){
    send('view');
    if(!PRIVATE.test(location.pathname)) trackPublic();
  }
  window.SilTrack = { event: function(name, label){ if(/^[a-z0-9_]{1,30}$/.test(name)) send(name, label); } };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
