/* Sillance — espace « Blog » dans l'application (17/11/2026)
   Bouton dans la barre d'outils (à côté de l'aide) qui ouvre un panneau avec les articles
   publiés. La liste est lue sur la page publique du blog (./guides/) : elle suit donc
   toute seule les publications programmées, sans rien maintenir ici. Chaque article
   s'ouvre dans un nouvel onglet, pour ne pas quitter l'application. */
(function () {
  'use strict';
  var T = {
    fr: { btn: 'Blog', title: 'Le blog Sillance', sub: "L'entraînement expliqué simplement, d'après les études.", all: 'Voir tout le blog', empty: 'Aucun article pour le moment.', err: 'Impossible de charger les articles. Réessaie plus tard.', close: 'Fermer' },
    en: { btn: 'Blog', title: 'The Sillance blog', sub: 'Training explained simply, based on the research.', all: 'See the whole blog', empty: 'No articles yet.', err: 'Could not load the articles. Please try again later.', close: 'Close' },
    es: { btn: 'Blog', title: 'El blog de Sillance', sub: 'El entrenamiento explicado de forma sencilla, según los estudios.', all: 'Ver todo el blog', empty: 'Todavía no hay artículos.', err: 'No se pudieron cargar los artículos. Inténtalo más tarde.', close: 'Cerrar' }
  };
  function lang() { try { return (window.SilI18n && SilI18n.getLang && SilI18n.getLang()) || document.documentElement.lang || 'fr'; } catch (e) { return 'fr'; } }
  function t(k) { var l = lang().slice(0, 2); return (T[l] || T.fr)[k]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var BASE = './guides/';

  function css() {
    if (document.getElementById('sbStyle')) return;
    var st = document.createElement('style'); st.id = 'sbStyle';
    st.textContent =
      '#sbOverlay{position:fixed;inset:0;z-index:100000;background:rgba(5,8,15,.6);display:none;justify-content:flex-end}#sbOverlay.open{display:flex}' +
      '.sb-panel{width:min(460px,100%);height:100%;overflow:auto;background:var(--panel,#111827);color:var(--text,#eaeef7);border-left:1px solid var(--line,rgba(148,163,196,.2));padding:20px 18px}' +
      '.sb-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px}.sb-head h2{margin:0;font-size:20px;font-weight:700;flex:1}' +
      '.sb-sub{margin:4px 0 0;font-size:13px;color:var(--muted,#94a3c4)}' +
      '.sb-close{font:inherit;border:1px solid var(--line-strong,rgba(148,163,196,.3));background:transparent;color:var(--text,#eaeef7);border-radius:99px;width:34px;height:34px;cursor:pointer}' +
      '.sb-list{display:flex;flex-direction:column;gap:10px}' +
      '.sb-card{display:block;text-decoration:none;color:inherit;border:1px solid var(--line,rgba(148,163,196,.2));border-radius:12px;padding:12px 14px;background:var(--panel-2,rgba(255,255,255,.03))}' +
      '.sb-card:hover{border-color:var(--accent,#46c2d8)}' +
      '.sb-k{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent2,#FF9A3D)}' +
      '.sb-t{font-size:15.5px;font-weight:700;margin:4px 0 4px;line-height:1.3}.sb-p{font-size:13px;color:var(--muted,#94a3c4);line-height:1.5;margin:0}' +
      '.sb-all{display:inline-block;margin-top:14px;font-size:13.5px;font-weight:600;color:var(--accent,#46c2d8)}.sb-msg{font-size:14px;color:var(--muted,#94a3c4)}';
    document.head.appendChild(st);
  }
  function build() {
    if (document.getElementById('sbOverlay')) return;
    css();
    var o = document.createElement('div'); o.id = 'sbOverlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', t('title'));
    o.innerHTML = '<div class="sb-panel"><div class="sb-head"><div><h2>' + esc(t('title')) + '</h2><p class="sb-sub">' + esc(t('sub')) + '</p></div>' +
      '<button type="button" class="sb-close" id="sbClose" aria-label="' + esc(t('close')) + '">✕</button></div>' +
      '<div class="sb-list" id="sbList"><p class="sb-msg">…</p></div>' +
      '<a class="sb-all" href="' + BASE + '" target="_blank" rel="noopener">' + esc(t('all')) + ' →</a></div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (e) { if (e.target === o) close(); });
    document.getElementById('sbClose').onclick = close;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && o.classList.contains('open')) close(); });
  }
  var loaded = false;
  function load() {
    if (loaded) return; var list = document.getElementById('sbList');
    fetch(BASE + '?app=' + Date.now(), { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var cards = [].slice.call(doc.querySelectorAll('a.card')).map(function (a) {
        var href = a.getAttribute('href') || '';
        if (!/^[a-z0-9-]+\/$/.test(href)) return null;          // seulement les articles du blog
        return { href: BASE + href, k: (a.querySelector('.kicker') || {}).textContent || '', t: (a.querySelector('h3') || {}).textContent || '', p: (a.querySelector('p') || {}).textContent || '' };
      }).filter(Boolean);
      list.innerHTML = cards.length ? cards.map(function (c) {
        return '<a class="sb-card" href="' + esc(c.href) + '" target="_blank" rel="noopener"><span class="sb-k">' + esc(c.k) + '</span><div class="sb-t">' + esc(c.t) + '</div><p class="sb-p">' + esc(c.p) + '</p></a>';
      }).join('') : '<p class="sb-msg">' + esc(t('empty')) + '</p>';
      loaded = true;
    }).catch(function () { list.innerHTML = '<p class="sb-msg">' + esc(t('err')) + '</p>'; });
  }
  function open() { build(); document.getElementById('sbOverlay').classList.add('open'); load(); }
  function close() { var o = document.getElementById('sbOverlay'); if (o) o.classList.remove('open'); }
  function addButton() {
    var tools = document.querySelector('.top-tools'); if (!tools || document.getElementById('blogBtn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'icon-btn'; b.id = 'blogBtn';
    b.setAttribute('aria-label', t('btn')); b.title = t('btn');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg>';
    b.onclick = open;
    tools.insertBefore(b, tools.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton); else addButton();
  window.SilBlog = { open: open, close: close };
})();
