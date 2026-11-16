/* Sillance — analyse détaillée d'un graphique de séance (17/11/2026)
   Un clic sur un graphique de l'analyse (allure, FC, puissance, altitude, cadence,
   foulée) l'ouvre en grand. Dans cette vue :
   - survol : réticule + toutes les valeurs à cet instant ;
   - molette (ou boutons − / +) : zoom autour du curseur ; Maj + molette : déplacement ;
   - clic : pose le point A, puis le point B ; glisser : sélectionne directement A→B ;
   - le segment A–B affiche ses propres chiffres (durée, distance, allure moyenne,
     FC moyenne / max, puissance, cadence, D+ / D−, pente) ;
   - « Zoomer sur A–B » recadre sur le segment ; la bande du bas situe la fenêtre
     dans la séance entière et se fait glisser.
   Les données viennent du registre AN_CHARTS de l'app (mêmes points que les
   graphiques) : rien n'est recalculé ailleurs, rien n'est inventé. */
(function () {
  'use strict';
  var W = 960, H = 380, P = { l: 66, r: 18, t: 18, b: 34 }, OW = 960, OH = 44;
  var MAP = { anSpeed: 'speed', anHr: 'hr', anPower: 'power', anElev: 'elev', anCadence: 'cadence', anStepLen: 'steplen' };
  var GET = {
    speed: function (p) { return p.sp; }, hr: function (p) { return p.hr; }, power: function (p) { return p.pw; },
    elev: function (p) { return p.alt; }, cadence: function (p) { return p._cadReal || p.cad || 0; }, steplen: function (p) { return p.stepLen || 0; }
  };
  var TITLE = { speed: 'Allure / vitesse', hr: 'Fréquence cardiaque', power: 'Puissance', elev: 'Altitude', cadence: 'Cadence', steplen: 'Longueur de foulée' };
  var ORDER = ['speed', 'hr', 'power', 'elev', 'cadence', 'steplen'];
  var S = { key: null, pts: null, cum: null, i0: 0, i1: 0, a: null, b: null, hover: null, drag: null, down: null, x: null, y: null, wired: false };

  function charts() { return window.__silCharts || {}; }   // registre des graphiques, exposé par l'app
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fr(v, d) { return Number(v).toFixed(d).replace('.', ','); }
  function clock(min) { var s = Math.round(min * 60), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(x).padStart(2, '0'); }
  function fmtDist(km) { return km < 1 ? Math.round(km * 1000) + ' m' : fr(km, 2) + ' km'; }
  function alive(C) { return !!(C && C.pts && C.pts.length > 1 && C.svg && C.svg.isConnected && C.svg.getClientRects().length); }
  // Valeur mise en forme par l'app elle-même (allure selon le sport, unités de cadence…)
  function fmtVal(key, v) {
    if (key === 'elev') return Math.round(v) + ' m';
    var C = charts()[key];
    try { return C.label({ sp: v, hr: v, pw: v, alt: v, _cadReal: v, cad: v, stepLen: v, grade: 0 }); } catch (e) { return String(Math.round(v)); }
  }
  function valid(key, v) { return key === 'elev' ? v != null && isFinite(v) : v > 0; }

  /* ---------- structure (créée une fois) ---------- */
  function build() {
    if ($('szOverlay')) return;
    var st = document.createElement('style');
    st.textContent = '#szOverlay{position:fixed;inset:0;z-index:1200;background:rgba(5,8,15,.72);display:none;align-items:center;justify-content:center;padding:14px}'
      + '#szOverlay.open{display:flex}'
      + '.sz-box{width:min(1080px,100%);max-height:96vh;overflow:auto;background:var(--panel,#111827);color:var(--text,#eaeef7);border:1px solid var(--line-strong,rgba(148,163,196,.3));border-radius:16px;padding:16px 18px 14px}'
      + '.sz-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}'
      + '.sz-head h3{margin:0;font-size:18px;font-weight:700}'
      + '.sz-tabs{display:flex;gap:6px;flex-wrap:wrap}.sz-sp{flex:1}'
      + '.sz-btn{font:inherit;font-size:13px;font-weight:600;border:1px solid var(--line-strong,rgba(148,163,196,.3));background:transparent;color:var(--text,#eaeef7);border-radius:99px;padding:6px 12px;cursor:pointer;white-space:nowrap}'
      + '.sz-btn:hover{border-color:var(--accent,#46c2d8)}.sz-btn.on{background:var(--accent,#46c2d8);border-color:var(--accent,#46c2d8);color:#0b1120}'
      + '.sz-btn:disabled{opacity:.4;cursor:default}.sz-btn.ico{padding:6px 11px;font-size:15px;line-height:1}'
      + '#szSvg{width:100%;height:auto;display:block;touch-action:none;cursor:crosshair;user-select:none;-webkit-user-select:none}'
      + '#szOv{width:100%;height:auto;display:block;margin-top:6px;touch-action:none;cursor:grab;border-radius:8px;background:rgba(148,163,196,.07)}'
      + '#szStats{margin-top:12px}.sz-msg{font-size:14px;color:var(--muted,#94a3c4);margin:0}'
      + '.sz-ab{font-size:13px;color:var(--muted,#94a3c4);margin:0 0 8px}.sz-ab b{color:var(--text,#eaeef7)}'
      + '.sz-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px}'
      + '.sz-card{border:1px solid var(--line,rgba(148,163,196,.18));border-radius:12px;padding:9px 11px}'
      + '.sz-card span{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--muted,#94a3c4)}'
      + '.sz-card b{display:block;font-size:18px;font-weight:700;margin-top:2px;font-family:var(--font-data,inherit)}'
      + '.sz-hint{font-size:12px;color:var(--muted,#94a3c4);margin:10px 0 0}'
      + '#szTip{position:fixed;z-index:1210;pointer-events:none;opacity:0;background:var(--panel-2,#1a2234);color:var(--text,#eaeef7);border:1px solid var(--line-strong,rgba(148,163,196,.3));border-radius:10px;padding:8px 11px;font-size:12.5px;line-height:1.5;font-family:var(--font-data,inherit);white-space:nowrap}'
      + '#szTip i{font-style:normal;color:var(--muted,#94a3c4)}'
      + '#anSpeed,#anHr,#anPower,#anElev,#anCadence,#anStepLen,#anSpeed rect,#anHr rect,#anPower rect,#anElev rect,#anCadence rect,#anStepLen rect{cursor:zoom-in !important}'
      + '@media (max-width:640px){.sz-box{padding:12px 10px}.sz-head h3{width:100%}.sz-card b{font-size:16px}}';
    document.head.appendChild(st);
    var o = document.createElement('div'); o.id = 'szOverlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Analyse détaillée du graphique');
    o.innerHTML = '<div class="sz-box"><div class="sz-head"><h3 id="szTitle"></h3><div class="sz-tabs" id="szTabs"></div><span class="sz-sp"></span>'
      + '<button type="button" class="sz-btn ico" id="szOut" title="Dézoomer" aria-label="Dézoomer">−</button>'
      + '<button type="button" class="sz-btn ico" id="szIn" title="Zoomer" aria-label="Zoomer">+</button>'
      + '<button type="button" class="sz-btn" id="szFit" disabled>Zoomer sur A–B</button>'
      + '<button type="button" class="sz-btn" id="szAll">Vue entière</button>'
      + '<button type="button" class="sz-btn" id="szClear" disabled>Effacer A–B</button>'
      + '<button type="button" class="sz-btn ico" id="szClose" title="Fermer" aria-label="Fermer">✕</button></div>'
      + '<svg id="szSvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Graphique détaillé"></svg>'
      + '<svg id="szOv" viewBox="0 0 ' + OW + ' ' + OH + '" aria-hidden="true"></svg>'
      + '<div id="szStats"></div>'
      + '<p class="sz-hint">Clic : pose A puis B · glisser : sélectionner une zone · molette : zoomer · Maj + molette ou bande du bas : se déplacer · Échap : fermer</p></div>';
    document.body.appendChild(o);
    var tip = document.createElement('div'); tip.id = 'szTip'; document.body.appendChild(tip);
    wire();
  }

  /* ---------- ouverture ---------- */
  function open(key) {
    var C = charts()[key]; if (!C || !C.pts || C.pts.length < 2 || !GET[key]) return;
    build();
    var same = S.pts === C.pts;
    S.key = key; S.pts = C.pts;
    if (!same) {
      S.i0 = 0; S.i1 = C.pts.length - 1; S.a = S.b = null;
      // distance cumulée : celle du fichier si elle existe, sinon vitesse × temps
      var cum = [0], pts = C.pts;
      for (var i = 1; i < pts.length; i++) {
        if (pts[i]._cum != null && pts[i - 1]._cum != null) cum.push(pts[i]._cum - pts[0]._cum);
        else cum.push(cum[i - 1] + Math.max(0, (pts[i].sp || 0)) * Math.max(0, pts[i].t - pts[i - 1].t) / 60);
      }
      S.cum = cum;
    }
    $('szOverlay').classList.add('open');
    tabs(); draw();
  }
  function close() { var o = $('szOverlay'); if (o) o.classList.remove('open'); hideTip(); }
  function tabs() {
    var ch = charts(), h = '';
    ORDER.forEach(function (k) {
      var C = ch[k]; if (!C || C.pts !== S.pts) return; if (k !== S.key && !alive(C)) return;
      h += '<button type="button" class="sz-btn' + (k === S.key ? ' on' : '') + '" data-k="' + k + '">' + TITLE[k] + '</button>';
    });
    $('szTabs').innerHTML = h; $('szTitle').textContent = 'Analyse détaillée';
  }

  /* ---------- dessin ---------- */
  function el(tag, attrs, parent) { var n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function draw() {
    var svg = $('szSvg'); svg.innerHTML = '';
    var C = charts()[S.key], g = GET[S.key], pts = S.pts, i0 = S.i0, i1 = S.i1, span = Math.max(1, i1 - i0), i, v;
    var lo = Infinity, hi = -Infinity;
    for (i = i0; i <= i1; i++) { v = g(pts[i]); if (valid(S.key, v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    var pad = Math.max((hi - lo) * 0.08, Math.abs(hi) * 0.01, 0.2), vMin = lo - pad, vMax = hi + pad;
    if (S.key !== 'elev') vMin = Math.max(0, vMin);
    var color = (C && C.color) || 'var(--accent)';
    S.x = function (k) { return P.l + (k - i0) / span * (W - P.l - P.r); };
    S.y = function (val) { return H - P.b - (val - vMin) / ((vMax - vMin) || 1) * (H - P.t - P.b); };
    for (var q = 0; q <= 4; q++) {
      var val = vMin + (vMax - vMin) * q / 4, yy = S.y(val);
      el('line', { x1: P.l, x2: W - P.r, y1: yy, y2: yy, stroke: 'rgba(148,163,196,.14)' }, svg);
      el('text', { x: P.l - 8, y: yy + 4, fill: color, 'font-size': 11, 'text-anchor': 'end', 'font-family': 'var(--font-data)' }, svg).textContent = fmtVal(S.key, val);
    }
    for (q = 0; q <= 5; q++) {
      var k = Math.round(i0 + span * q / 5);
      el('text', { x: S.x(k), y: H - 12, fill: 'var(--muted)', 'font-size': 11, 'text-anchor': q === 0 ? 'start' : q === 5 ? 'end' : 'middle', 'font-family': 'var(--font-data)' }, svg).textContent = clock(pts[k].t);
    }
    // courbe : les valeurs absentes (capteur muet) coupent le trait au lieu de plonger à zéro
    var step = Math.max(1, Math.ceil(span / 1400)), d = '', pen = false, area = '', first = null, last = null;
    for (i = i0; i <= i1; i += step) {
      v = g(pts[i]);
      if (!valid(S.key, v)) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + S.x(i).toFixed(1) + ' ' + S.y(v).toFixed(1); pen = true;
      if (first == null) first = i; last = i;
    }
    if (first != null && d.indexOf('M', 1) < 0) {
      area = d + 'L' + S.x(last).toFixed(1) + ' ' + (H - P.b) + 'L' + S.x(first).toFixed(1) + ' ' + (H - P.b) + 'Z';
      el('path', { d: area, fill: color, opacity: .12 }, svg);
    }
    el('path', { d: d || 'M0 0', fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
    el('g', { id: 'szLayer', 'pointer-events': 'none' }, svg);
    layer(); overview(); stats();
    $('szFit').disabled = !(S.a != null && S.b != null && S.b > S.a);
    $('szClear').disabled = S.a == null;
  }
  function flag(L, i, name) {
    if (i < S.i0 || i > S.i1) return;
    var x = S.x(i);
    el('line', { x1: x, x2: x, y1: P.t, y2: H - P.b, stroke: 'var(--orange,#ff8a4d)', 'stroke-width': 1.6 }, L);
    el('rect', { x: x - 10, y: P.t - 2, width: 20, height: 17, rx: 4, fill: 'var(--orange,#ff8a4d)' }, L);
    el('text', { x: x, y: P.t + 11, fill: '#0b1120', 'font-size': 11.5, 'font-weight': 800, 'text-anchor': 'middle' }, L).textContent = name;
    var v = GET[S.key](S.pts[i]);
    if (valid(S.key, v)) el('circle', { cx: x, cy: S.y(v), r: 4.5, fill: '#0b1120', stroke: 'var(--orange,#ff8a4d)', 'stroke-width': 2 }, L);
  }
  function layer() {
    var L = $('szLayer'); if (!L) return; L.innerHTML = '';
    var a = S.a, b = S.b;
    if (S.drag) { a = Math.min(S.drag.from, S.drag.to); b = Math.max(S.drag.from, S.drag.to); }
    if (a != null && b != null && b > a) {
      var xa = S.x(clamp(a, S.i0, S.i1)), xb = S.x(clamp(b, S.i0, S.i1));
      if (b >= S.i0 && a <= S.i1) el('rect', { x: xa, y: P.t, width: Math.max(0, xb - xa), height: H - P.t - P.b, fill: 'var(--orange,#ff8a4d)', opacity: .13 }, L);
    }
    if (a != null) flag(L, a, 'A');
    if (b != null) flag(L, b, 'B');
    if (S.hover != null && !S.drag) {
      var x = S.x(S.hover), v = GET[S.key](S.pts[S.hover]);
      el('line', { x1: x, x2: x, y1: P.t, y2: H - P.b, stroke: 'var(--muted)', 'stroke-dasharray': '3 3' }, L);
      if (valid(S.key, v)) el('circle', { cx: x, cy: S.y(v), r: 4.5, fill: 'var(--ink)', stroke: (charts()[S.key] || {}).color || 'var(--accent)', 'stroke-width': 2 }, L);
    }
  }
  function overview() {
    var svg = $('szOv'); svg.innerHTML = '';
    var g = GET[S.key], pts = S.pts, n = pts.length - 1, lo = Infinity, hi = -Infinity, i, v, step = Math.max(1, Math.ceil(n / 500));
    for (i = 0; i <= n; i += step) { v = g(pts[i]); if (valid(S.key, v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
    if (!isFinite(lo)) return;
    var X = function (k) { return k / n * OW; }, Y = function (val) { return OH - 4 - (val - lo) / ((hi - lo) || 1) * (OH - 8); };
    var d = '', pen = false;
    for (i = 0; i <= n; i += step) { v = g(pts[i]); if (!valid(S.key, v)) { pen = false; continue; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; }
    el('path', { d: d || 'M0 0', fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.2, opacity: .8 }, svg);
    if (S.a != null && S.b != null) el('rect', { x: X(S.a), y: 0, width: Math.max(1, X(S.b) - X(S.a)), height: OH, fill: 'var(--orange,#ff8a4d)', opacity: .25 }, svg);
    el('rect', { x: X(S.i0), y: 1, width: Math.max(3, X(S.i1) - X(S.i0)), height: OH - 2, rx: 5, fill: 'var(--accent,#46c2d8)', 'fill-opacity': .14, stroke: 'var(--accent,#46c2d8)', 'stroke-width': 1.5 }, svg);
  }

  /* ---------- chiffres du segment A–B ---------- */
  function segment(a, b) {
    var pts = S.pts, ch = charts(), i, p, n = b - a + 1;
    var dur = pts[b].t - pts[a].t, dist = S.cum[b] - S.cum[a];
    var hrN = 0, hrS = 0, hrMax = 0, hrMin = Infinity, pwS = 0, pwMax = 0, pwAny = false, cadN = 0, cadS = 0, up = 0, down = 0, spS = 0;
    for (i = a; i <= b; i++) {
      p = pts[i];
      if (p.hr > 0) { hrN++; hrS += p.hr; if (p.hr > hrMax) hrMax = p.hr; if (p.hr < hrMin) hrMin = p.hr; }
      if (p.pw > 0) { pwAny = true; if (p.pw > pwMax) pwMax = p.pw; }
      pwS += p.pw || 0; spS += p.sp || 0;
      var c = p._cadReal || p.cad || 0; if (c > 0) { cadN++; cadS += c; }
      if (i > a && p.alt != null && pts[i - 1].alt != null) { var dz = p.alt - pts[i - 1].alt; if (dz > 0) up += dz; else down -= dz; }
    }
    var out = [['Durée', clock(dur)]];
    if (dist > 0) out.push(['Distance', fmtDist(dist)]);
    var sp = (dist > 0 && dur > 0) ? dist / (dur / 60) : spS / n;
    if (ch.speed && sp > 0) out.push([/km\/h/.test(fmtVal('speed', sp)) ? 'Vitesse moyenne' : 'Allure moyenne', fmtVal('speed', sp)]);
    if (hrN) { out.push(['FC moyenne', Math.round(hrS / hrN) + ' bpm']); out.push(['FC max', Math.round(hrMax) + ' bpm']); out.push(['FC min', Math.round(hrMin) + ' bpm']); }
    if (pts[a].hr > 0 && pts[b].hr > 0) { var dh = Math.round(pts[b].hr - pts[a].hr); out.push(['FC de A à B', (dh > 0 ? '+' : '') + dh + ' bpm']); }
    if (pwAny) { out.push(['Puissance moyenne', Math.round(pwS / n) + ' W']); out.push(['Puissance max', Math.round(pwMax) + ' W']); }
    if (cadN && ch.cadence) out.push(['Cadence moyenne', fmtVal('cadence', cadS / cadN)]);
    if (ch.elev) {
      out.push(['D+', Math.round(up) + ' m']); out.push(['D−', Math.round(down) + ' m']);
      if (dist > 0.02) { var gr = (pts[b].alt - pts[a].alt) / (dist * 1000) * 100; out.push(['Pente moyenne', (gr > 0 ? '+' : '') + fr(gr, 1) + ' %']); }
    }
    return out;
  }
  function pointLine(name, i) { return '<b>' + name + '</b> ' + clock(S.pts[i].t) + (S.cum[i] > 0 ? ' · ' + fmtDist(S.cum[i]) : '') + ' · ' + (valid(S.key, GET[S.key](S.pts[i])) ? fmtVal(S.key, GET[S.key](S.pts[i])) : '—'); }
  function stats() {
    var box = $('szStats');
    if (S.a == null) { box.innerHTML = '<p class="sz-msg">Clique sur la courbe pour poser le point A, puis le point B. Tu peux aussi glisser pour sélectionner une zone.</p>'; return; }
    if (S.b == null) { box.innerHTML = '<p class="sz-ab">' + pointLine('A', S.a) + '</p><p class="sz-msg">Clique ailleurs pour poser le point B.</p>'; return; }
    box.innerHTML = '<p class="sz-ab">' + pointLine('A', S.a) + ' &nbsp;→&nbsp; ' + pointLine('B', S.b) + '</p><div class="sz-grid">'
      + segment(S.a, S.b).map(function (r) { return '<div class="sz-card"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</div>';
  }

  /* ---------- infobulle ---------- */
  function showTip(e, i) {
    var p = S.pts[i], ch = charts(), h = '<i>' + clock(p.t) + (S.cum[i] > 0 ? ' · ' + fmtDist(S.cum[i]) : '') + '</i>';
    ORDER.forEach(function (k) {
      var C = ch[k]; if (!C || C.pts !== S.pts) return; var v = GET[k](p); if (!valid(k, v)) return;
      h += '<div style="color:' + (C.color || 'inherit') + (k === S.key ? ';font-weight:800' : '') + '">' + fmtVal(k, v) + '</div>';
    });
    var tip = $('szTip'); tip.innerHTML = h; tip.style.opacity = '1';
    var w = tip.offsetWidth, x = e.clientX + 16; if (x + w > window.innerWidth - 8) x = e.clientX - w - 16;
    tip.style.left = Math.max(6, x) + 'px'; tip.style.top = Math.max(6, e.clientY - 20) + 'px';
  }
  function hideTip() { var t = $('szTip'); if (t) t.style.opacity = '0'; }

  /* ---------- déplacement et zoom ---------- */
  function setView(i0, i1) {
    var n = S.pts.length - 1, span = clamp(Math.round(i1 - i0), Math.min(8, n), n);
    i0 = Math.round(i0); if (i0 < 0) i0 = 0; if (i0 + span > n) i0 = n - span;
    S.i0 = i0; S.i1 = i0 + span; draw();
  }
  function zoomAt(frac, factor) { var span = S.i1 - S.i0, ns = span * factor, c = S.i0 + frac * span; setView(c - frac * ns, c - frac * ns + ns); }
  function idx(e) {
    var r = $('szSvg').getBoundingClientRect(), vb = (e.clientX - r.left) / r.width * W;
    return clamp(Math.round(S.i0 + (vb - P.l) / (W - P.l - P.r) * (S.i1 - S.i0)), S.i0, S.i1);
  }
  function frac(e) { var r = $('szSvg').getBoundingClientRect(), vb = (e.clientX - r.left) / r.width * W; return clamp((vb - P.l) / (W - P.l - P.r), 0, 1); }

  function wire() {
    var svg = $('szSvg'), ov = $('szOv');
    svg.addEventListener('pointerdown', function (e) { if (e.button > 0) return; S.down = { x: e.clientX, i: idx(e) }; try { svg.setPointerCapture(e.pointerId); } catch (x) {} });
    svg.addEventListener('pointermove', function (e) {
      var i = idx(e);
      if (S.down && Math.abs(e.clientX - S.down.x) > 5) { S.drag = { from: S.down.i, to: i }; S.hover = null; layer(); showTip(e, i); return; }
      S.hover = i; layer(); showTip(e, i);
    });
    svg.addEventListener('pointerup', function (e) {
      if (!S.down) return; var i = idx(e);
      if (S.drag) { var a = Math.min(S.drag.from, i), b = Math.max(S.drag.from, i); S.drag = null; if (b > a) { S.a = a; S.b = b; } }
      else if (S.a == null || S.b != null) { S.a = i; S.b = null; }
      else if (i !== S.a) { S.b = Math.max(S.a, i); S.a = Math.min(S.a, i); }
      S.down = null; draw();
    });
    svg.addEventListener('pointercancel', function () { S.down = null; S.drag = null; layer(); });
    svg.addEventListener('pointerleave', function () { if (S.down) return; S.hover = null; layer(); hideTip(); });
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { var d = (e.deltaX || e.deltaY) > 0 ? 1 : -1, sh = Math.max(1, Math.round((S.i1 - S.i0) * 0.12)) * d; setView(S.i0 + sh, S.i1 + sh); }
      else zoomAt(frac(e), e.deltaY < 0 ? 0.8 : 1.25);
    }, { passive: false });
    // bande du bas : clic ou glisser = recentrer la fenêtre
    var ovDown = false;
    function ovMove(e) { var r = ov.getBoundingClientRect(), c = clamp((e.clientX - r.left) / r.width, 0, 1) * (S.pts.length - 1), half = (S.i1 - S.i0) / 2; setView(c - half, c + half); }
    ov.addEventListener('pointerdown', function (e) { ovDown = true; try { ov.setPointerCapture(e.pointerId); } catch (x) {} ovMove(e); });
    ov.addEventListener('pointermove', function (e) { if (ovDown) ovMove(e); });
    ov.addEventListener('pointerup', function () { ovDown = false; });
    ov.addEventListener('pointercancel', function () { ovDown = false; });
    $('szIn').onclick = function () { zoomAt(0.5, 0.7); };
    $('szOut').onclick = function () { zoomAt(0.5, 1.43); };
    $('szAll').onclick = function () { setView(0, S.pts.length - 1); };
    $('szFit').onclick = function () { if (S.a == null || S.b == null) return; var m = Math.max(1, Math.round((S.b - S.a) * 0.05)); setView(S.a - m, S.b + m); };
    $('szClear').onclick = function () { S.a = S.b = null; draw(); };
    $('szClose').onclick = close;
    $('szTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b) { S.key = b.dataset.k; tabs(); draw(); } });
    $('szOverlay').addEventListener('pointerdown', function (e) { if (e.target.id === 'szOverlay') close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('szOverlay').classList.contains('open')) { e.stopPropagation(); close(); } }, true);
  }

  // Un clic sur un graphique de l'analyse ouvre cette vue (remplace l'ancien zoom, limité à la puissance).
  document.addEventListener('click', function (e) {
    var svg = e.target && e.target.closest && e.target.closest('svg'); if (!svg || !MAP[svg.id]) return;
    var key = MAP[svg.id], C = charts()[key]; if (!C || C.svg !== svg) return;
    e.stopPropagation(); e.preventDefault(); open(key);
  }, true);
  // feuille de style prête dès le chargement, pour le curseur « loupe » sur les graphiques
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();

  window.SilZoom = { open: open, close: close };
})();
