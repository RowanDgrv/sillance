/* Sillance — couleurs des zones d'entraînement au choix (17/11/2026)
   Chacun choisit les couleurs de ses zones Z1 à Z6 : une palette toute faite (Sillance,
   Bordeaux, Classique, Daltonisme, Monochrome) ou ses propres couleurs. Les graphiques
   de l'app (répartition des intensités, profils de séance, zones de l'analyse…) suivent.
   Chargé AVANT les *.core.js, qui lisent SilZoneColors.colors(). Choix gardé sur cet
   appareil (localStorage). Bouton dans les Paramètres + window.SilZoneColors.open(). */
(function () {
  'use strict';
  var KEY = 'sil_zone_colors';
  var ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6'];
  var NAMES = { Z1: 'Récupération', Z2: 'Endurance', Z3: 'Tempo', Z4: 'Seuil', Z5: 'VO2max', Z6: 'Anaérobie' };
  var PRESETS = {
    sillance:   { label: 'Sillance',    c: { Z1: '#2FD9FF', Z2: '#39E6A3', Z3: '#FFD43D', Z4: '#FFB13D', Z5: '#FF5470', Z6: '#E36BFF' } },
    bordeaux:   { label: 'Bordeaux',    c: { Z1: '#F6D5C9', Z2: '#EFA48F', Z3: '#E2725F', Z4: '#C8414A', Z5: '#A3243B', Z6: '#7A1830' } },
    classique:  { label: 'Classique',   c: { Z1: '#A0A7B4', Z2: '#3B82F6', Z3: '#22C55E', Z4: '#F59E0B', Z5: '#EF4444', Z6: '#A855F7' } },
    daltonisme: { label: 'Daltonisme',  c: { Z1: '#56B4E9', Z2: '#009E73', Z3: '#F0E442', Z4: '#E69F00', Z5: '#D55E00', Z6: '#CC79A7' } },
    mono:       { label: 'Monochrome',  c: { Z1: '#3E5A66', Z2: '#4F8597', Z3: '#5FB0C8', Z4: '#7FCFE3', Z5: '#B5E6F2', Z6: '#FFFFFF' } }
  };
  var listeners = [];
  function hexOk(h) { return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h); }
  function load() {
    var st = null; try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!st || typeof st !== 'object') st = { preset: 'sillance', custom: null };
    if (!PRESETS[st.preset] && st.preset !== 'custom') st.preset = 'sillance';
    return st;
  }
  var state = load();
  function colors() {
    var base = PRESETS.sillance.c, src = state.preset === 'custom' && state.custom ? state.custom : (PRESETS[state.preset] || PRESETS.sillance).c, out = {};
    ZONES.forEach(function (z) { out[z] = hexOk(src[z]) ? src[z] : base[z]; });
    return out;
  }
  function notify() { listeners.forEach(function (f) { try { f(colors()); } catch (e) { console.warn('[zones] ', e); } }); }
  // Compte connecté (18/11/2026) : le choix est aussi gardé dans le profil (profiles.zone_colors),
  // pour le retrouver sur tous ses appareils. Envoi groupé (les sélecteurs de couleur bougent vite).
  var syncT = null;
  function syncAccount() {
    clearTimeout(syncT);
    syncT = setTimeout(function () {
      var PF = window.PF; if (!PF || !PF.user || !PF.saveZoneColors) return;
      PF.saveZoneColors({ preset: state.preset, custom: state.custom || null }).catch(function (e) { console.warn('[zones] sauvegarde compte :', e); });
    }, 600);
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} notify(); syncAccount(); }
  // Choix venu du compte (à la connexion) : appliqué ici, sans le renvoyer au compte.
  function fromAccount(st) {
    if (!st || typeof st !== 'object') return false;
    var p = (PRESETS[st.preset] || st.preset === 'custom') ? st.preset : null; if (!p) return false;
    var custom = null;
    if (st.custom && typeof st.custom === 'object') { custom = {}; ZONES.forEach(function (z) { if (hexOk(st.custom[z])) custom[z] = st.custom[z]; }); }
    state = { preset: p, custom: custom };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    notify(); render(); return true;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function css() {
    if (document.getElementById('szcStyle')) return;
    var s = document.createElement('style'); s.id = 'szcStyle';
    s.textContent = '#szcOverlay{position:fixed;inset:0;z-index:100001;background:rgba(5,8,15,.65);display:none;align-items:center;justify-content:center;padding:14px}#szcOverlay.open{display:flex}' +
      '.szc-box{width:min(520px,100%);max-height:94vh;overflow:auto;background:var(--panel,#111827);color:var(--text,#eaeef7);border:1px solid var(--line-strong,rgba(148,163,196,.3));border-radius:16px;padding:18px}' +
      '.szc-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}.szc-head h3{margin:0;font-size:19px;flex:1}.szc-sub{font-size:13px;color:var(--muted,#94a3c4);margin:0 0 14px}' +
      '.szc-x{font:inherit;border:1px solid var(--line-strong,rgba(148,163,196,.3));background:transparent;color:inherit;border-radius:99px;width:34px;height:34px;cursor:pointer}' +
      '.szc-presets{display:flex;flex-direction:column;gap:8px}' +
      '.szc-p{display:flex;align-items:center;gap:12px;width:100%;font:inherit;text-align:left;cursor:pointer;border:1px solid var(--line,rgba(148,163,196,.2));background:transparent;color:inherit;border-radius:12px;padding:10px 12px}' +
      '.szc-p.on{border-color:var(--accent,#46c2d8);box-shadow:0 0 0 1px var(--accent,#46c2d8) inset}.szc-p b{flex:1;font-size:14.5px}' +
      '.szc-sw{display:flex;gap:3px}.szc-sw i{width:22px;height:22px;border-radius:5px;display:block}' +
      '.szc-custom{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}' +
      '.szc-c{display:flex;align-items:center;gap:8px;font-size:13px;border:1px solid var(--line,rgba(148,163,196,.2));border-radius:10px;padding:6px 8px}' +
      '.szc-c input{width:34px;height:28px;border:0;padding:0;background:transparent;cursor:pointer}.szc-c span{line-height:1.2}' +
      '.szc-prev{display:flex;height:16px;border-radius:99px;overflow:hidden;margin:14px 0 4px}.szc-prev i{flex:1}' +
      '.szc-note{font-size:12px;color:var(--muted,#94a3c4);margin:8px 0 0}';
    document.head.appendChild(s);
  }
  function swatches(c) { return ZONES.map(function (z) { return '<i style="background:' + c[z] + '" title="' + z + '"></i>'; }).join(''); }
  function render() {
    var o = document.getElementById('szcOverlay'); if (!o) return;
    var cur = colors();
    var h = '<div class="szc-box" role="dialog" aria-modal="true" aria-label="Couleurs des zones"><div class="szc-head"><h3>Couleurs des zones</h3><button type="button" class="szc-x" data-x aria-label="Fermer">✕</button></div>' +
      '<p class="szc-sub">Les graphiques de tes séances, de ta semaine et de tes analyses prennent ces couleurs.</p><div class="szc-presets">';
    Object.keys(PRESETS).forEach(function (k) { h += '<button type="button" class="szc-p' + (state.preset === k ? ' on' : '') + '" data-p="' + k + '"><b>' + esc(PRESETS[k].label) + '</b><span class="szc-sw">' + swatches(PRESETS[k].c) + '</span></button>'; });
    h += '<button type="button" class="szc-p' + (state.preset === 'custom' ? ' on' : '') + '" data-p="custom"><b>Mes couleurs</b><span class="szc-sw">' + swatches(state.custom ? colors() : cur) + '</span></button></div>';
    if (state.preset === 'custom') {
      h += '<div class="szc-custom">' + ZONES.map(function (z) { return '<label class="szc-c"><input type="color" data-z="' + z + '" value="' + cur[z] + '" aria-label="Couleur ' + z + '"><span><b>' + z + '</b><br>' + NAMES[z] + '</span></label>'; }).join('') + '</div>';
    }
    h += '<div class="szc-prev">' + swatches(cur) + '</div><p class="szc-note">Réglage gardé sur cet appareil. Les couleurs des sports (natation, vélo, course) ne changent pas.</p></div>';
    o.innerHTML = h;
  }
  function open() {
    css();
    var o = document.getElementById('szcOverlay');
    if (!o) {
      o = document.createElement('div'); o.id = 'szcOverlay'; document.body.appendChild(o);
      o.addEventListener('click', function (e) {
        if (e.target === o || e.target.closest('[data-x]')) { o.classList.remove('open'); return; }
        var b = e.target.closest('[data-p]'); if (!b) return;
        var k = b.getAttribute('data-p');
        if (k === 'custom' && !state.custom) state.custom = colors();   // part de la palette affichée
        state.preset = k; save(); render();
      });
      o.addEventListener('input', function (e) {
        var z = e.target && e.target.getAttribute && e.target.getAttribute('data-z'); if (!z) return;
        state.custom = state.custom || colors(); state.custom[z] = e.target.value; state.preset = 'custom';
        save(); var p = o.querySelector('.szc-prev'); if (p) p.innerHTML = swatches(colors());
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') o.classList.remove('open'); });
    }
    render(); o.classList.add('open');
  }
  // Bouton dans les Paramètres (onglets du panneau), sans toucher au rendu des onglets existants.
  function addSettingsButton() {
    var tabs = document.querySelector('#settingsOverlay .set-tabs') || (document.querySelector('#settingsOverlay .set-tab') || {}).parentElement;
    if (!tabs || document.getElementById('setTabZones')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'set-tab'; b.id = 'setTabZones';
    b.innerHTML = '<i class="ic ic-target"></i> Couleurs des zones';
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(); }, true);
    tabs.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addSettingsButton); else addSettingsButton();
  window.SilZoneColors = { colors: colors, presets: PRESETS, onChange: function (f) { listeners.push(f); }, open: open, fromAccount: fromAccount,
    // à la connexion : compte sans choix enregistré mais choix fait sur cet appareil → on l'envoie au compte
    pushLocalIfNeeded: function () { if (state.preset !== 'sillance' || state.custom) syncAccount(); },
    set: function (preset, custom) { state.preset = preset; if (custom) state.custom = custom; save(); } };
})();
