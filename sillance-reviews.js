/* Sillance — avis clients (coachs/clubs/athlètes).
   Données + rendu partagés entre la landing page (#avis, extrait) et la
   page dédiée avis.html (liste complète). Un seul tableau à remplir : pas
   d'avis fictif tant qu'il est vide (cf. décision du 06/10/2026 — produit
   en bêta, aucun paiement réel encaissé à ce jour, donc aucun témoignage
   inventé publié comme authentique). */
(function (global) {
  'use strict';

  // Chaque entrée : { name, role, quote, rating (1-5, optionnel) }.
  var REVIEWS = [
  ];

  function initials(name) {
    return (name || '').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] || ''; }).join('').toUpperCase();
  }

  function stars(rating) {
    if (!rating) return '';
    var n = Math.max(0, Math.min(5, Math.round(rating)));
    return '<div class="review-stars" aria-label="' + n + '/5">' + '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n) + '</div>';
  }

  // limit = nombre max de cartes (extrait landing page) ; null = tout (avis.html).
  function render(elId, limit, emptyText) {
    var el = document.getElementById(elId);
    if (!el) return;
    var list = limit ? REVIEWS.slice(0, limit) : REVIEWS;
    if (!list.length) {
      el.innerHTML = '<p class="reviews-empty">' + (emptyText || '') + '</p>';
      return;
    }
    el.innerHTML = list.map(function (r) {
      return '<div class="review-card">' +
        stars(r.rating) +
        '<p class="review-quote">“' + r.quote + '”</p>' +
        '<div class="review-who">' +
          '<div class="review-avatar">' + initials(r.name) + '</div>' +
          '<div><div class="review-name">' + r.name + '</div><div class="review-role">' + r.role + '</div></div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function emptyText() {
    return global.SilI18n ? global.SilI18n.t('reviews.empty') : "Les premiers avis arrivent bientôt.";
  }

  // Auto-rendu : la landing page a #reviewsGridHome (extrait, 3 avis), la
  // page dédiée avis.html a #reviewsGridFull (tout) — aucun script inline
  // nécessaire (CSP script-src 'self' sans 'unsafe-inline' sur ces 2 pages).
  function autoRender() {
    render('reviewsGridHome', 3, emptyText());
    render('reviewsGridFull', null, emptyText());
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoRender);
  } else {
    autoRender();
  }
  document.addEventListener('sil:langchange', autoRender);

  global.SilReviews = { list: REVIEWS, render: render };
})(window);
