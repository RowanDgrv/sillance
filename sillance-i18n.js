/* ============================================================
   Sillance — moteur i18n (FR/EN/ES)
   ------------------------------------------------------------
   Un seul fichier HTML par page (maintenance simple pour un
   développeur solo) ; les traductions vivent dans des dictionnaires
   séparés (sillance-i18n-*.js), fusionnés dans window.SIL_I18N.

   Choix de la langue, par ordre de priorité :
     1. paramètre d'URL ?lang=en|es|fr (lien partageable, indexable)
     2. préférence mémorisée (localStorage, suit l'utilisateur)
     3. français par défaut

   Usage dans le HTML :
     <h1 data-i18n="hero.title">Texte français par défaut</h1>
     <img data-i18n-attr="alt:hero.imgAlt">
     <div data-i18n-html="card.richText"></div>   (contenu avec balises)

   Usage en JS (app/calendrier/review/club) :
     SilI18n.t('toast.saved')
     SilI18n.t('toast.itemsCount', {n: 3})   -> interpolation {n}
   ============================================================ */
(function(){
  var SUPPORTED = ['fr', 'en', 'es'];
  var DEFAULT_LANG = 'fr';
  var STORAGE_KEY = 'sil_lang';

  window.SIL_I18N = window.SIL_I18N || { fr: {}, en: {}, es: {} };

  function urlLang(){
    try{
      var v = new URLSearchParams(location.search).get('lang');
      return SUPPORTED.indexOf(v) !== -1 ? v : null;
    }catch(e){ return null; }
  }

  function getLang(){
    var fromUrl = urlLang();
    if(fromUrl) return fromUrl;
    try{
      var stored = localStorage.getItem(STORAGE_KEY);
      if(stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    }catch(e){}
    return DEFAULT_LANG;
  }

  function setLang(lang, opts){
    if(SUPPORTED.indexOf(lang) === -1) return;
    try{ localStorage.setItem(STORAGE_KEY, lang); }catch(e){}
    document.documentElement.lang = lang;
    // reflète le choix dans l'URL sans recharger (lien partageable à jour)
    try{
      var url = new URL(location.href);
      url.searchParams.set('lang', lang);
      history.replaceState(null, '', url);
    }catch(e){}
    applyTranslations();
    document.dispatchEvent(new CustomEvent('sil:langchange', {detail:{lang:lang}}));
    if(!opts || !opts.silent) updateSwitcherUI(lang);
  }

  function t(key, vars){
    var lang = getLang();
    var dict = window.SIL_I18N[lang] || {};
    var fallback = window.SIL_I18N.fr || {};
    var str = (key in dict) ? dict[key] : (key in fallback ? fallback[key] : key);
    if(vars){
      Object.keys(vars).forEach(function(k){
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return str;
  }

  function applyTranslations(root){
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function(el){
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(function(el){
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    scope.querySelectorAll('[data-i18n-attr]').forEach(function(el){
      el.getAttribute('data-i18n-attr').split(',').forEach(function(pair){
        var parts = pair.split(':');
        var attr = parts[0].trim(), key = parts[1] && parts[1].trim();
        if(attr && key) el.setAttribute(attr, t(key));
      });
    });
  }

  function updateSwitcherUI(lang){
    document.querySelectorAll('[data-lang-btn]').forEach(function(b){
      var active = b.getAttribute('data-lang-btn') === lang;
      b.classList.toggle('active', active);
      b.setAttribute('aria-current', active ? 'true' : 'false');
    });
  }

  function initLangSwitcher(){
    document.querySelectorAll('[data-lang-btn]').forEach(function(b){
      b.addEventListener('click', function(){ setLang(b.getAttribute('data-lang-btn')); });
    });
    updateSwitcherUI(getLang());
  }

  document.documentElement.lang = getLang();
  document.addEventListener('DOMContentLoaded', function(){
    applyTranslations();
    initLangSwitcher();
  });

  window.SilI18n = { t: t, getLang: getLang, setLang: setLang, applyTranslations: applyTranslations, SUPPORTED: SUPPORTED };
})();
