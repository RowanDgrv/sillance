/* Sillance — nav "tabs continus" (surbrillance glissante), menu burger
   mobile et interrupteur jour/nuit. CSP script-src 'self' sans
   'unsafe-inline' sur cette page : fichier externe, pas de script inline. */
(function () {
  'use strict';

  function wireSlidingHighlight(container) {
    var hl = container.querySelector('.nav-hl');
    if (!hl) return;
    var items = [].slice.call(container.querySelectorAll('a,button[data-lang-btn]'));
    function moveTo(el) {
      hl.style.left = el.offsetLeft + 'px';
      hl.style.width = el.offsetWidth + 'px';
    }
    // sillance-i18n.js pose .active sur sa propre écoute DOMContentLoaded
    // (enregistrée avant ce script, donc exécutée avant) — mais rien ne
    // garantit que le DOM est déjà "ready" au moment où CE script tourne
    // (chargé en synchrone juste après) : on réaligne une fois de plus au
    // readyState voulu, pour ne jamais rater le .active déjà posé.
    function alignActive() {
      var cur = container.querySelector('.active');
      if (cur) moveTo(cur);
    }
    alignActive();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', alignActive);
    } else {
      setTimeout(alignActive, 0);
    }
    items.forEach(function (el) {
      el.addEventListener('mouseenter', function () { moveTo(el); });
      el.addEventListener('focus', function () { moveTo(el); });
    });
    container.addEventListener('mouseleave', function () {
      var cur = container.querySelector('.active');
      if (cur) moveTo(cur);
    });
    // Le lang-switch change sa classe .active dynamiquement (sillance-i18n.js) —
    // on réaligne la pastille après chaque changement de langue.
    document.addEventListener('sil:langchange', function () {
      setTimeout(function () {
        var cur = container.querySelector('.active');
        if (cur) moveTo(cur);
      }, 0);
    });
  }

  var navLinks = document.getElementById('navLinks');
  if (navLinks) wireSlidingHighlight(navLinks);
  var langSwitch = document.querySelector('.lang-switch');
  if (langSwitch) wireSlidingHighlight(langSwitch);

  var burger = document.getElementById('navBurger');
  if (burger && navLinks) {
    burger.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navLinks.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Thème jour/nuit : préférence mémorisée > prefers-color-scheme > sombre
  // par défaut (identité visuelle actuelle du site).
  var THEME_KEY = 'sil_theme';
  function applyTheme(t) {
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    var btn = document.getElementById('themeToggle');
    if (btn) btn.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
  }
  var saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  if (saved === 'light' || saved === 'dark') {
    applyTheme(saved);
  } else if (global_matchMedia('(prefers-color-scheme: light)')) {
    applyTheme('light');
  }
  function global_matchMedia(q) {
    try { return window.matchMedia && window.matchMedia(q).matches; } catch (e) { return false; }
  }

  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var isLight = document.documentElement.getAttribute('data-theme') === 'light';
      var next = isLight ? 'dark' : 'light';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  }

  // Toggle mensuel/annuel de la section Tarifs (07/10/2026) : annuel = 11
  // mois facturés (1 mois offert), même règle que stripe-checkout côté
  // backend — ne jamais afficher un prix différent de celui réellement
  // facturé une fois l'abonnement réellement souscrit dans l'app.
  var ANNUAL_MONTHS_BILLED = 11;
  var pricingToggle = document.getElementById('pricingBillToggle');
  if (pricingToggle) {
    var billInterval = 'month';
    function t(key) {
      return (window.SilI18n && window.SilI18n.t(key)) || key;
    }
    function fmt(n) {
      var rounded = Math.round(n * 100) / 100;
      var lang = (window.SilI18n && window.SilI18n.getLang()) || 'fr';
      return lang === 'en' ? rounded.toString() : rounded.toString().replace('.', ',');
    }
    function renderPrices() {
      document.querySelectorAll('.amt[data-m]').forEach(function (amt) {
        var monthly = Number(amt.dataset.m);
        var num = amt.querySelector('.amt-num');
        var per = amt.querySelector('.per');
        var eq = amt.querySelector('.amt-eq');
        if (billInterval === 'year') {
          var annual = monthly * ANNUAL_MONTHS_BILLED;
          num.innerHTML = fmt(annual) + '&nbsp;€';
          if (per) per.textContent = t('pricing.perYear');
          if (!eq) { eq = document.createElement('span'); eq.className = 'amt-eq'; amt.appendChild(eq); }
          eq.textContent = fmt(annual / 12) + ' €' + t('pricing.perMonth');
        } else {
          num.innerHTML = fmt(monthly) + '&nbsp;€';
          if (per) per.textContent = t('pricing.perMonth');
          if (eq) eq.remove();
        }
      });
    }
    pricingToggle.querySelectorAll('.bt-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        billInterval = btn.dataset.bt === 'year' ? 'year' : 'month';
        pricingToggle.querySelectorAll('.bt-opt').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        renderPrices();
      });
    });
    document.addEventListener('sil:langchange', function () { setTimeout(renderPrices, 0); });
    renderPrices();
  }
})();
