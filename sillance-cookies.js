/* ============================================================
   Sillance — bandeau de consentement cookies (RGPD / CNIL)
   ------------------------------------------------------------
   Fichier autonome (CSP script-src 'self', pas d'inline).
   Stocke le choix dans localStorage 'sil_consent' :
     {v:CONSENT_VERSION, necessary:true, analytics:bool, ts}
   Catégories :
     - necessary  : toujours actif (session, langue, thème, préférences)
     - analytics  : mesure d'audience anonyme — INACTIF tant que rien
                    n'est branché ; le bandeau prépare le terrain pour
                    le jour où un outil (Plausible/PostHog…) est ajouté.
   API publique : window.SilCookies.has('analytics'), .open(), .consent
   Événement : document 'sil:consentchange' {detail:{analytics:bool}}
   ============================================================ */
(function(){
  var STORAGE_KEY = 'sil_consent';
  var CONSENT_VERSION = 1;

  var TXT = {
    fr: {
      text: 'Sillance utilise des cookies et un stockage local strictement nécessaires au fonctionnement du site (connexion, préférences). Avec votre accord, nous pourrions aussi utiliser une mesure d’audience anonyme pour améliorer le service — aucun traceur publicitaire.',
      necessaryTitle: 'Strictement nécessaires',
      necessaryDesc: 'Connexion, sécurité, préférences d’affichage. Toujours actifs, sans dépôt possible d’opposition.',
      analyticsTitle: 'Mesure d’audience',
      analyticsDesc: 'Statistiques de fréquentation anonymisées. Non utilisé actuellement ; votre choix est conservé pour le jour où ce serait le cas.',
      accept: 'Accepter tout',
      reject: 'Refuser',
      customize: 'Personnaliser',
      save: 'Enregistrer mes choix',
      more: 'En savoir plus',
      manageLabel: 'Gérer les cookies',
      close: 'Fermer'
    },
    en: {
      text: 'Sillance uses cookies and local storage strictly necessary for the site to work (login, preferences). With your consent, we could also use anonymous audience measurement to improve the service — no advertising trackers.',
      necessaryTitle: 'Strictly necessary',
      necessaryDesc: 'Login, security, display preferences. Always active, cannot be disabled.',
      analyticsTitle: 'Audience measurement',
      analyticsDesc: 'Anonymised visit statistics. Not in use today; your choice is kept for if that changes.',
      accept: 'Accept all',
      reject: 'Reject',
      customize: 'Customize',
      save: 'Save my choices',
      more: 'Learn more',
      manageLabel: 'Manage cookies',
      close: 'Close'
    },
    es: {
      text: 'Sillance utiliza cookies y almacenamiento local estrictamente necesarios para el funcionamiento del sitio (conexión, preferencias). Con su consentimiento, también podríamos usar una medición de audiencia anónima para mejorar el servicio — ningún rastreador publicitario.',
      necessaryTitle: 'Estrictamente necesarias',
      necessaryDesc: 'Conexión, seguridad, preferencias de visualización. Siempre activas, no se pueden desactivar.',
      analyticsTitle: 'Medición de audiencia',
      analyticsDesc: 'Estadísticas de visitas anonimizadas. No se usa actualmente; su elección se conserva por si eso cambia.',
      accept: 'Aceptar todo',
      reject: 'Rechazar',
      customize: 'Personalizar',
      save: 'Guardar mis opciones',
      more: 'Más información',
      manageLabel: 'Gestionar cookies',
      close: 'Cerrar'
    }
  };

  function lang(){
    if(window.SilI18n && typeof window.SilI18n.getLang === 'function') return window.SilI18n.getLang();
    var l = (document.documentElement.lang || 'fr').slice(0,2);
    return TXT[l] ? l : 'fr';
  }
  function tr(key){ var d = TXT[lang()] || TXT.fr; return d[key] || TXT.fr[key] || key; }

  function readConsent(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      var c = JSON.parse(raw);
      if(!c || c.v !== CONSENT_VERSION) return null;
      return c;
    }catch(e){ return null; }
  }
  function writeConsent(analytics){
    var c = {v:CONSENT_VERSION, necessary:true, analytics:!!analytics, ts:Date.now()};
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); }catch(e){}
    document.dispatchEvent(new CustomEvent('sil:consentchange', {detail:{analytics:c.analytics}}));
    return c;
  }

  var STYLE_ID = 'sil-cookies-style';
  function injectStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var css = ''
    + '.scb{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#0E1526;border-top:1px solid rgba(150,165,200,.28);'
    +   'box-shadow:0 -8px 30px rgba(0,0,0,.35);font-family:Archivo,system-ui,sans-serif;color:#C2CBDD;'
    +   'transform:translateY(0);transition:transform .25s ease}'
    + '.scb[hidden]{display:none}'
    + '.scb-inner{max-width:1040px;margin:0 auto;padding:16px 20px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}'
    + '.scb-text{flex:1 1 380px;font-size:13.5px;line-height:1.55;margin:0;color:#C2CBDD}'
    + '.scb-text a{color:#46C2D8;text-decoration:underline}'
    + '.scb-actions{display:flex;gap:8px;flex-wrap:wrap;flex:0 0 auto}'
    + '.scb-btn{font-family:inherit;font-size:13px;font-weight:600;padding:9px 16px;border-radius:8px;cursor:pointer;border:1px solid rgba(150,165,200,.30);background:transparent;color:#F3F6FC;white-space:nowrap}'
    + '.scb-btn:hover{border-color:#46C2D8}'
    + '.scb-btn.scb-primary{background:#46C2D8;border-color:#46C2D8;color:#062028}'
    + '.scb-btn.scb-primary:hover{filter:brightness(1.08)}'
    + '.scb-panel{max-width:1040px;margin:0 auto;padding:0 20px 18px;display:none}'
    + '.scb-panel.on{display:block}'
    + '.scb-cat{display:flex;align-items:flex-start;gap:14px;padding:12px 0;border-top:1px solid rgba(150,165,200,.16)}'
    + '.scb-cat-body{flex:1}'
    + '.scb-cat-title{font-family:Oswald,sans-serif;font-weight:600;font-size:13px;letter-spacing:.03em;text-transform:uppercase;color:#F3F6FC;margin:0 0 4px}'
    + '.scb-cat-desc{font-size:12.5px;color:#8A93A8;margin:0}'
    + '.scb-switch{position:relative;flex:0 0 auto;width:38px;height:22px;border-radius:999px;background:rgba(150,165,200,.30);border:none;cursor:pointer;padding:0}'
    + '.scb-switch::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#F3F6FC;transition:transform .15s ease}'
    + '.scb-switch.on{background:#46C2D8}'
    + '.scb-switch.on::after{transform:translateX(16px)}'
    + '.scb-switch.locked{opacity:.6;cursor:not-allowed}'
    + '.scb-save-row{padding-top:14px;text-align:right}'
    + '.scb-tab{position:fixed;left:14px;bottom:14px;z-index:9998;width:34px;height:34px;border-radius:50%;'
    +   'background:#121A2B;border:1px solid rgba(150,165,200,.30);color:#C2CBDD;font-size:16px;cursor:pointer;'
    +   'display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.35)}'
    + '.scb-tab:hover{border-color:#46C2D8}'
    + '@media (max-width:640px){.scb-inner{padding:14px}.scb-actions{width:100%}.scb-btn{flex:1 1 auto;text-align:center}}';
    var s = document.createElement('style');
    s.id = STYLE_ID; s.textContent = css;
    document.head.appendChild(s);
  }

  var elBanner, elPanel, elAnalyticsSwitch, elTab;

  function legalHref(){
    // reste sur la même page si on est déjà sur legal.html (ancre confidentialité/cookies)
    return /legal\.html/.test(location.pathname) ? '#confidentialite' : 'legal.html#confidentialite';
  }

  function build(){
    injectStyle();
    elBanner = document.createElement('div');
    elBanner.className = 'scb';
    elBanner.setAttribute('role', 'dialog');
    elBanner.setAttribute('aria-label', 'Cookies');
    elBanner.hidden = true;
    elBanner.innerHTML =
      '<div class="scb-inner">'
        + '<p class="scb-text" data-scb="text"></p>'
        + '<div class="scb-actions">'
          + '<button type="button" class="scb-btn" data-scb-act="customize"></button>'
          + '<button type="button" class="scb-btn" data-scb-act="reject"></button>'
          + '<button type="button" class="scb-btn scb-primary" data-scb-act="accept"></button>'
        + '</div>'
      + '</div>'
      + '<div class="scb-panel">'
        + '<div class="scb-cat">'
          + '<div class="scb-cat-body">'
            + '<p class="scb-cat-title" data-scb="necessaryTitle"></p>'
            + '<p class="scb-cat-desc" data-scb="necessaryDesc"></p>'
          + '</div>'
          + '<button type="button" class="scb-switch on locked" disabled aria-disabled="true"></button>'
        + '</div>'
        + '<div class="scb-cat">'
          + '<div class="scb-cat-body">'
            + '<p class="scb-cat-title" data-scb="analyticsTitle"></p>'
            + '<p class="scb-cat-desc" data-scb="analyticsDesc"></p>'
          + '</div>'
          + '<button type="button" class="scb-switch" data-scb-act="toggle-analytics" aria-pressed="false"></button>'
        + '</div>'
        + '<div class="scb-save-row">'
          + '<a class="scb-more" data-scb="more" href="' + legalHref() + '" style="font-size:12.5px;color:#46C2D8;margin-right:16px;text-decoration:underline"></a>'
          + '<button type="button" class="scb-btn scb-primary" data-scb-act="save"></button>'
        + '</div>'
      + '</div>';
    document.body.appendChild(elBanner);
    elPanel = elBanner.querySelector('.scb-panel');
    elAnalyticsSwitch = elBanner.querySelector('[data-scb-act="toggle-analytics"]');

    elTab = document.createElement('button');
    elTab.type = 'button';
    elTab.className = 'scb-tab';
    elTab.textContent = '🍪';
    elTab.hidden = true;
    document.body.appendChild(elTab);

    applyTexts();
    wire();
  }

  function applyTexts(){
    elBanner.querySelectorAll('[data-scb]').forEach(function(el){
      el.textContent = tr(el.getAttribute('data-scb'));
    });
    elBanner.querySelector('[data-scb-act="customize"]').textContent = tr('customize');
    elBanner.querySelector('[data-scb-act="reject"]').textContent = tr('reject');
    elBanner.querySelector('[data-scb-act="accept"]').textContent = tr('accept');
    elBanner.querySelector('[data-scb-act="save"]').textContent = tr('save');
    elBanner.setAttribute('aria-label', tr('manageLabel'));
    elTab.setAttribute('aria-label', tr('manageLabel'));
    elTab.title = tr('manageLabel');
  }

  function setAnalyticsSwitch(on){
    elAnalyticsSwitch.classList.toggle('on', !!on);
    elAnalyticsSwitch.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function showBanner(prefill){
    elPanel.classList.remove('on');
    setAnalyticsSwitch(prefill && prefill.analytics);
    elBanner.hidden = false;
    elTab.hidden = true;
  }
  function hideBanner(){
    elBanner.hidden = true;
    elTab.hidden = false;
  }

  function wire(){
    elBanner.querySelector('[data-scb-act="accept"]').addEventListener('click', function(){
      writeConsent(true); hideBanner();
    });
    elBanner.querySelector('[data-scb-act="reject"]').addEventListener('click', function(){
      writeConsent(false); hideBanner();
    });
    elBanner.querySelector('[data-scb-act="customize"]').addEventListener('click', function(){
      elPanel.classList.toggle('on');
    });
    elAnalyticsSwitch.addEventListener('click', function(){
      setAnalyticsSwitch(!elAnalyticsSwitch.classList.contains('on'));
    });
    elBanner.querySelector('[data-scb-act="save"]').addEventListener('click', function(){
      writeConsent(elAnalyticsSwitch.classList.contains('on'));
      hideBanner();
    });
    elTab.addEventListener('click', function(){
      showBanner(readConsent());
      elPanel.classList.add('on');
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && !elBanner.hidden && readConsent()) hideBanner();
    });
    document.addEventListener('sil:langchange', applyTexts);
  }

  function init(){
    build();
    var existing = readConsent();
    if(existing){
      elTab.hidden = false;
    } else {
      showBanner(null);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SilCookies = {
    get consent(){ return readConsent(); },
    has: function(cat){
      var c = readConsent();
      if(!c) return false;
      if(cat === 'necessary') return true;
      return !!c[cat];
    },
    open: function(){ if(elBanner){ showBanner(readConsent()); elPanel.classList.add('on'); } }
  };
})();
