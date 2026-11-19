/* Sillance — écran « Analyse » (19/11/2026)
   Charge et santé sur le même axe des dates, un curseur commun à tous les graphiques :
   1. Forme, fatigue, fraîcheur (Coggan : CTL 42 j, ATL 7 j, TSB) calculées sur le RÉALISÉ
      (activités de la montre + séances cochées faites) ; les jours à venir = prévu, en pointillé.
   2. Charge mesurée par semaine (TSS / estimation cardio).
   3. Charge ressentie par semaine (Foster 1998 : durée × RPE) + monotonie (moyenne / écart-type
      des 7 jours), affichée seulement si le RPE est noté sur toutes les séances de la semaine.
   4. Sommeil et fatigue du check-in (1 à 10), 5. HRV (+ base), 6. poids.
   Pas de score combiné : on aligne les courbes, le coach lit (pas de poids inventés).
   Données absentes → pas de ligne inventée : points isolés, trous visibles, message vide.
   Démo (non connecté) : check-ins simulés, signalés comme tels.
   Ouverture : window.SilAnalyse.open() — bouton « Analyse complète » dans les statistiques. */
(function () {
  'use strict';
  var EN = /^en/i.test(document.documentElement.lang || '');
  var T = EN ? {
    title: 'Full analysis', sub: 'Training load and health on the same timeline. Hover a day to read every chart.',
    p42: '6 wk', p90: '3 mo', p180: '6 mo', p365: '1 yr', close: 'Close',
    form: 'Fitness, fatigue, form', formSub: 'Coggan model on completed sessions · dashed = planned',
    ctl: 'Fitness (CTL)', atl: 'Fatigue (ATL)', tsb: 'Form (TSB)',
    meas: 'Measured load per week', measSub: 'Power, pace or heart rate from the watch',
    felt: 'Perceived load per week', feltSub: 'Foster: duration × RPE · pale bar = RPE missing on some sessions (underestimated) · monotony shown when every session has an RPE',
    mono: 'monotony', rpeCov: 'RPE logged on {n} of {of} sessions over the period',
    sleep: 'Sleep and fatigue', sleepSub: 'Morning check-in, 1 to 10', sleepL: 'Sleep', fatL: 'Fatigue',
    hrv: 'HRV', hrvSub: 'rMSSD (ms) · dashed = baseline', weight: 'Weight', weightSub: 'kg, from the check-in',
    empty: 'No data yet: the athlete fills it in the morning check-in.', emptyRpe: 'No RPE logged yet on completed sessions.',
    demo: 'Demo data', est: 'estimated from heart rate', loading: 'Loading…',
    noAct: 'No completed session'
  } : {
    title: 'Analyse complète', sub: 'Charge et santé sur le même axe des dates. Survole un jour pour lire tous les graphiques.',
    p42: '6 sem', p90: '3 mois', p180: '6 mois', p365: '1 an', close: 'Fermer',
    form: 'Forme, fatigue, fraîcheur', formSub: 'Modèle de Coggan sur les séances réalisées · pointillés = prévu',
    ctl: 'Forme (CTL)', atl: 'Fatigue (ATL)', tsb: 'Fraîcheur (TSB)',
    meas: 'Charge mesurée par semaine', measSub: 'Puissance, allure ou cardio de la montre',
    felt: 'Charge ressentie par semaine', feltSub: 'Foster : durée × RPE · barre pâle = RPE manquant sur une partie des séances (charge sous-estimée) · monotonie affichée si toutes les séances ont un RPE',
    mono: 'monotonie', rpeCov: 'RPE noté sur {n} séances sur {of} sur la période',
    sleep: 'Sommeil et fatigue', sleepSub: 'Check-in du matin, de 1 à 10', sleepL: 'Sommeil', fatL: 'Fatigue',
    hrv: 'HRV', hrvSub: 'rMSSD (ms) · pointillés = ta base', weight: 'Poids', weightSub: 'kg, saisi au check-in',
    empty: 'Pas encore de données : l\'athlète les renseigne dans son check-in du matin.', emptyRpe: 'Aucun RPE noté sur les séances réalisées pour l\'instant.',
    demo: 'Données de démonstration', est: 'estimée au cardio', loading: 'Chargement…',
    noAct: 'Aucune séance réalisée'
  };
  var C = { cyan: '#46C2D8', orange: '#FF9A3D', green: '#39E6A3', red: '#FF5470', violet: '#8E7FD0', grid: 'rgba(148,163,196,.14)', muted: '#94a3c4' };
  var W = 1000, PL = 44, PR = 14;
  var state = { days: 90, daily: [], ck: {}, demo: false, idx: null };
  var NS = 'http://www.w3.org/2000/svg';
  function app() { return window.__pf_app; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mk(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function isoD(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function fmtDate(key) { var d = new Date(key + 'T00:00:00'); return d.toLocaleDateString(EN ? 'en-GB' : 'fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); }

  function css() {
    if (document.getElementById('silAnStyle')) return;
    var s = document.createElement('style'); s.id = 'silAnStyle';
    s.textContent =
      '#silAn{position:fixed;inset:0;z-index:100000;background:var(--ink,#080B12);color:var(--text,#eaeef7);overflow:auto;display:none}#silAn.open{display:block}' +
      '.san-wrap{max-width:1100px;margin:0 auto;padding:18px 16px 60px}' +
      '.san-top{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}.san-top h2{margin:0;font:600 26px/1.15 Oswald,system-ui;text-transform:uppercase;letter-spacing:.02em;flex:1;min-width:200px}' +
      '.san-sub{margin:6px 0 0;color:var(--muted,#94a3c4);font-size:14px}' +
      '.san-x{font:inherit;border:1px solid var(--line-strong,rgba(148,163,196,.3));background:transparent;color:inherit;border-radius:99px;padding:8px 14px;cursor:pointer}' +
      '.san-per{display:flex;gap:6px;margin:14px 0 10px;flex-wrap:wrap}.san-per button{font:600 13px/1 Archivo,system-ui;border:1px solid var(--line-strong,rgba(148,163,196,.3));background:transparent;color:var(--muted,#94a3c4);border-radius:99px;padding:8px 13px;cursor:pointer}' +
      '.san-per button.on{border-color:#46C2D8;color:#46C2D8}' +
      '.san-demo{display:inline-block;font-size:12px;color:#FF9A3D;border:1px solid rgba(255,154,61,.4);border-radius:99px;padding:3px 9px;margin-left:8px;vertical-align:middle}' +
      '.san-read{position:sticky;top:0;z-index:2;background:var(--ink,#080B12);border-bottom:1px solid var(--line,rgba(148,163,196,.2));padding:10px 0;font-size:13.5px;display:flex;flex-wrap:wrap;gap:6px 16px;min-height:22px}' +
      '.san-read b{font-family:var(--font-data,Archivo);font-weight:700}.san-read .d{font-weight:700;text-transform:capitalize;min-width:120px}' +
      '.san-read i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:0}' +
      '.san-card{border:1px solid var(--line,rgba(148,163,196,.2));background:var(--panel,#111827);border-radius:14px;padding:12px 14px 6px;margin-top:12px}' +
      '.san-card h3{margin:0;font:600 15px/1.2 Oswald,system-ui;text-transform:uppercase;letter-spacing:.03em}.san-card .s{color:var(--muted,#94a3c4);font-size:12.5px;margin:3px 0 4px}' +
      '.san-card svg{display:block;width:100%;height:auto;touch-action:pan-y}.san-card .axis{fill:#94a3c4;font:11px Archivo,system-ui}' +
      '.san-lg{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--muted,#94a3c4);margin:2px 0 6px}.san-lg i{display:inline-block;width:14px;height:3px;border-radius:2px;margin-right:5px;vertical-align:3px}' +
      '.san-empty{color:var(--muted,#94a3c4);font-size:13px;padding:14px 0 12px}' +
      '@media (max-width:600px){.san-top h2{font-size:21px}.san-read{font-size:12.5px}}';
    document.head.appendChild(s);
  }

  // --- données -------------------------------------------------------------
  function demoCheckins(daily) {
    var out = {};
    daily.forEach(function (d, i) {
      if (d.future) return;
      var r = (Math.sin(i * 12.9898) * 43758.5453) % 1; r = r < 0 ? -r : r;
      if (r < 0.18) return;                                // jours sans check-in, comme en vrai
      var tired = Math.max(0, Math.min(3, (d.atl - d.ctl) / Math.max(d.ctl, 20) * 3));   // 0 à 3 points
      out[d.date] = {
        sommeil: Math.max(3, Math.min(9, Math.round(7.4 - tired + (r - 0.5) * 2.4))),
        fatigue: Math.max(2, Math.min(9, Math.round(3.6 + tired * 1.2 + (r - 0.5) * 2.4))),
        hrv: Math.round(63 - tired * 4 + (r - 0.5) * 9),
        poids: +(70.8 - i * 0.004 + (r - 0.5) * 0.6).toFixed(1)
      };
    });
    return out;
  }
  function load() {
    var A = app(); if (!A || !A.loadDaily) return Promise.resolve();
    var all = A.loadDaily(new Date(Date.now() + 14 * 864e5), 380);      // 2 semaines de prévu après aujourd'hui
    state.daily = all.slice(-(state.days + 14));
    state.demo = !(window.PF && window.PF.user);
    if (state.demo) { state.ck = demoCheckins(state.daily); return Promise.resolve(); }
    var from = state.daily[0].date;
    return window.PF.getCheckinsRange(window.__pf_viewTarget || window.PF.user.id, from).then(function (rows) {
      var m = {}; (rows || []).forEach(function (r) { m[r.date] = r; }); state.ck = m;
    }).catch(function () { state.ck = {}; });
  }
  function weeks(daily) {
    var out = [], cur = null;
    daily.forEach(function (d, i) {
      var dow = (new Date(d.date + 'T00:00:00').getDay() + 6) % 7;
      if (!cur || dow === 0) { cur = { i0: i, i1: i, tss: 0, foster: 0, n: 0, of: 0, fd: [], future: d.future }; out.push(cur); }
      cur.i1 = i; if (!d.future) { cur.tss += d.total; cur.future = false; }
      var f = d.foster || { v: 0, n: 0, of: 0 };
      if (!d.future) { cur.foster += f.v; cur.n += f.n; cur.of += f.of; cur.fd.push(f.v); }
    });
    out.forEach(function (w) {
      w.mono = null;
      if (w.fd.length === 7 && w.of > 0 && w.n === w.of) {
        var mean = w.fd.reduce(function (a, b) { return a + b; }, 0) / 7;
        var sd = Math.sqrt(w.fd.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / 7);
        w.mono = sd > 0.01 ? +(mean / sd).toFixed(1) : null;
      }
    });
    return out;
  }

  // --- tracé ----------------------------------------------------------------
  function niceStep(raw) { var p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  function xOf(i) { var n = state.daily.length; return PL + (i + 0.5) * (W - PL - PR) / n; }
  function frame(svg, H, min, max, ticks, fmt) {
    var P = { t: 10, b: 22 };
    var y = function (v) { return H - P.b - (v - min) / (max - min || 1) * (H - P.t - P.b); };
    for (var g = 0; g <= ticks; g++) {
      var v = min + (max - min) * g / ticks, yy = y(v);
      mk('line', { x1: PL, x2: W - PR, y1: yy, y2: yy, stroke: C.grid }, svg);
      mk('text', { x: PL - 7, y: yy + 4, 'text-anchor': 'end', class: 'axis' }, svg).textContent = fmt ? fmt(v) : (Math.abs(v) >= 10000 ? Math.round(v / 1000) + 'k' : Math.round(v));
    }
    // dates : ~6 repères
    var n = state.daily.length, step = Math.max(1, Math.round(n / Math.max(3, Math.floor(W / 140))));
    for (var i = 0; i < n; i += step) mk('text', { x: xOf(i), y: H - 6, 'text-anchor': 'middle', class: 'axis' }, svg).textContent =
      new Date(state.daily[i].date + 'T00:00:00').toLocaleDateString(EN ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' });
    var ti = state.daily.findIndex(function (d) { return d.future; });
    if (ti > 0) mk('line', { x1: xOf(ti) - (W - PL - PR) / n / 2, x2: xOf(ti) - (W - PL - PR) / n / 2, y1: P.t, y2: H - P.b, stroke: 'rgba(148,163,196,.35)' }, svg);
    return y;
  }
  // ligne qui ne relie que des jours consécutifs (pas de ligne inventée sur les trous)
  function series(svg, pts, color, dashed) {
    var d = '', prev = null;
    pts.forEach(function (p) { if (p.v == null) { prev = null; return; } d += (prev != null && p.i === prev + 1 ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); prev = p.i; });
    if (d) mk('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-dasharray': dashed ? '5 4' : 'none' }, svg);
    pts.forEach(function (p) { if (p.v != null && p.dot) mk('circle', { cx: p.x, cy: p.y, r: 2.6, fill: color }, svg); });
  }
  function cursorLayer(svg, H) {
    var l = mk('line', { x1: 0, x2: 0, y1: 8, y2: H - 22, stroke: 'rgba(234,238,247,.55)', 'stroke-dasharray': '3 3', 'class': 'san-cur' }, svg);
    l.style.display = 'none';
  }
  function card(root, title, sub, legend) {
    var c = document.createElement('div'); c.className = 'san-card';
    c.innerHTML = '<h3>' + esc(title) + '</h3><p class="s">' + esc(sub) + '</p>' +
      (legend ? '<div class="san-lg">' + legend.map(function (l) { return '<span><i style="background:' + l[1] + '"></i>' + esc(l[0]) + '</span>'; }).join('') + '</div>' : '');
    root.appendChild(c); return c;
  }
  function svgIn(c, H) { var s = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' }); c.appendChild(s); return s; }
  function empty(c, txt) { var p = document.createElement('p'); p.className = 'san-empty'; p.textContent = txt; c.appendChild(p); }

  function drawAll() {
    var root = document.getElementById('sanCharts'); root.innerHTML = '';
    W = Math.max(320, Math.min(1000, Math.round(root.clientWidth - 30))); PL = W < 600 ? 36 : 44;   // largeur réelle : textes lisibles sur téléphone
    var D = state.daily, n = D.length;
    // 1. forme / fatigue / fraîcheur
    var c1 = card(root, T.form, T.formSub, [[T.ctl, C.cyan], [T.atl, C.orange], [T.tsb, C.green]]);
    var s1 = svgIn(c1, 240);
    var vals = []; D.forEach(function (d) { vals.push(d.ctl, d.atl, d.tsb); });
    var st = niceStep((Math.max.apply(null, vals) - Math.min(0, Math.min.apply(null, vals))) / 4);
    var mn = Math.min(0, Math.floor(Math.min.apply(null, vals) / st) * st), mx = Math.max(st, Math.ceil(Math.max.apply(null, vals) / st) * st);
    var y1 = frame(s1, 240, mn, mx, Math.round((mx - mn) / st));
    if (mn < 0) mk('line', { x1: PL, x2: W - PR, y1: y1(0), y2: y1(0), stroke: 'rgba(148,163,196,.4)' }, s1);
    [['ctl', C.cyan], ['atl', C.orange], ['tsb', C.green]].forEach(function (k) {
      series(s1, D.map(function (d, i) { return { i: i, x: xOf(i), y: y1(d[k[0]]), v: d.future ? null : d[k[0]] }; }), k[1], false);
      series(s1, D.map(function (d, i) { return { i: i, x: xOf(i), y: y1(d[k[0]]), v: (d.future || (D[i + 1] && D[i + 1].future)) ? d[k[0]] : null }; }), k[1], true);
    });
    cursorLayer(s1, 240);

    // 2. charge mesurée / 3. ressentie, par semaine
    var wk = weeks(D), slot = (W - PL - PR) / n;
    var c2 = card(root, T.meas, T.measSub); var s2 = svgIn(c2, 170);
    var stT = niceStep(Math.max(100, Math.max.apply(null, wk.map(function (w) { return w.tss; }))) / 3), mxT = Math.ceil(Math.max(100, Math.max.apply(null, wk.map(function (w) { return w.tss; })) * 1.1) / stT) * stT;
    var y2 = frame(s2, 170, 0, mxT, Math.round(mxT / stT));
    wk.forEach(function (w) { if (w.future) return; var x0 = xOf(w.i0) - slot / 2 + 3, x1 = xOf(w.i1) + slot / 2 - 3;
      mk('rect', { x: x0, y: y2(w.tss), width: Math.max(2, x1 - x0), height: Math.max(0, y2(0) - y2(w.tss)), rx: 3, fill: C.cyan, opacity: .85 }, s2); });
    cursorLayer(s2, 170);

    var cov = wk.reduce(function (a, w) { a.n += w.n; a.of += w.of; return a; }, { n: 0, of: 0 });
    var c3 = card(root, T.felt, T.feltSub + (cov.of ? ' · ' + T.rpeCov.replace('{n}', cov.n).replace('{of}', cov.of) : ''));
    if (!cov.n) empty(c3, T.emptyRpe);
    else {
      var s3 = svgIn(c3, 170);
      var stF = niceStep(Math.max(300, Math.max.apply(null, wk.map(function (w) { return w.foster; }))) / 3), mxF = Math.ceil(Math.max(300, Math.max.apply(null, wk.map(function (w) { return w.foster; })) * 1.15) / stF) * stF;
      var y3 = frame(s3, 170, 0, mxF, Math.round(mxF / stF));
      wk.forEach(function (w) { if (w.future) return; var x0 = xOf(w.i0) - slot / 2 + 3, x1 = xOf(w.i1) + slot / 2 - 3;
        mk('rect', { x: x0, y: y3(w.foster), width: Math.max(2, x1 - x0), height: Math.max(0, y3(0) - y3(w.foster)), rx: 3, fill: C.violet, opacity: w.n < w.of ? .35 : .9 }, s3);
        if (w.mono != null && x1 - x0 > 34) mk('text', { x: (x0 + x1) / 2, y: y3(w.foster) - 5, 'text-anchor': 'middle', class: 'axis', fill: w.mono >= 2 ? C.orange : C.muted }, s3).textContent = w.mono; });
      cursorLayer(s3, 170);
    }

    // 4. sommeil & fatigue
    var ck = state.ck, has = function (k) { return D.some(function (d) { return ck[d.date] && ck[d.date][k] != null; }); };
    var c4 = card(root, T.sleep, T.sleepSub, [[T.sleepL, C.cyan], [T.fatL, C.orange]]);
    if (!has('sommeil') && !has('fatigue')) empty(c4, T.empty);
    else { var s4 = svgIn(c4, 160), y4 = frame(s4, 160, 0, 10, 2);
      [['sommeil', C.cyan], ['fatigue', C.orange]].forEach(function (k) {
        series(s4, D.map(function (d, i) { var v = ck[d.date] ? ck[d.date][k[0]] : null; return { i: i, x: xOf(i), y: y4(v || 0), v: v, dot: true }; }), k[1]); });
      cursorLayer(s4, 160); }

    // 5. HRV
    var c5 = card(root, T.hrv, T.hrvSub);
    if (!has('hrv')) empty(c5, T.empty);
    else { var hv = D.map(function (d) { return ck[d.date] && ck[d.date].hrv; }).filter(Boolean);
      var base = app().data.ATHLETE_REF && app().data.ATHLETE_REF.hrvBase; if (state.demo) base = 62;
      var lo = Math.floor((Math.min.apply(null, hv.concat(base ? [base] : [])) - 5) / 5) * 5, hi = Math.ceil((Math.max.apply(null, hv.concat(base ? [base] : [])) + 5) / 5) * 5;
      var s5 = svgIn(c5, 150), y5 = frame(s5, 150, lo, hi, 2);
      if (base) mk('line', { x1: PL, x2: W - PR, y1: y5(base), y2: y5(base), stroke: C.green, 'stroke-dasharray': '6 5', opacity: .7 }, s5);
      series(s5, D.map(function (d, i) { var v = ck[d.date] ? ck[d.date].hrv : null; return { i: i, x: xOf(i), y: y5(v || lo), v: v, dot: true }; }), C.cyan);
      cursorLayer(s5, 150); }

    // 6. poids
    var c6 = card(root, T.weight, T.weightSub);
    if (!has('poids')) empty(c6, T.empty);
    else { var pv = D.map(function (d) { return ck[d.date] && ck[d.date].poids != null ? Number(ck[d.date].poids) : null; }).filter(function (v) { return v != null; });
      var plo = Math.floor(Math.min.apply(null, pv) - 1), phi = Math.ceil(Math.max.apply(null, pv) + 1);
      var s6 = svgIn(c6, 150), y6 = frame(s6, 150, plo, phi, 2, function (v) { return v.toFixed(0); });
      series(s6, D.map(function (d, i) { var v = ck[d.date] && ck[d.date].poids != null ? Number(ck[d.date].poids) : null; return { i: i, x: xOf(i), y: y6(v || plo), v: v, dot: true }; }), C.violet);
      cursorLayer(s6, 150); }

    // curseur commun
    root.querySelectorAll('svg').forEach(function (svg) {
      var move = function (ev) {
        var pt = ev.touches ? ev.touches[0] : ev, r = svg.getBoundingClientRect();
        var vx = (pt.clientX - r.left) / r.width * W, i = Math.round((vx - PL) / ((W - PL - PR) / n) - 0.5);
        setIdx(Math.max(0, Math.min(n - 1, i)));
      };
      svg.addEventListener('mousemove', move); svg.addEventListener('touchstart', move, { passive: true }); svg.addEventListener('touchmove', move, { passive: true });
    });
    setIdx(state.idx != null && state.idx < n ? state.idx : D.findIndex(function (d) { return d.future; }) - 1);
  }
  function setIdx(i) {
    if (i < 0) i = state.daily.length - 1;
    state.idx = i; var d = state.daily[i]; if (!d) return;
    document.querySelectorAll('#sanCharts .san-cur').forEach(function (l) { var x = xOf(i); l.setAttribute('x1', x); l.setAttribute('x2', x); l.style.display = ''; });
    var c = state.ck[d.date] || {}, f = d.foster;
    var item = function (col, lbl, v) { return '<span><i style="background:' + col + '"></i>' + esc(lbl) + ' <b>' + v + '</b></span>'; };
    var h = '<span class="d">' + esc(fmtDate(d.date)) + '</span>';
    h += item(C.cyan, 'CTL', Math.round(d.ctl)) + item(C.orange, 'ATL', Math.round(d.atl)) + item(C.green, 'TSB', (d.tsb >= 0 ? '+' : '') + Math.round(d.tsb));
    h += d.total ? item(C.cyan, EN ? 'Load' : 'Charge', Math.round(d.total)) : '<span>' + esc(d.future ? '' : T.noAct) + '</span>';
    if (f && f.n) h += item(C.violet, 'Foster', f.v);
    if (c.sommeil != null) h += item(C.cyan, T.sleepL, c.sommeil + '/10');
    if (c.fatigue != null) h += item(C.orange, T.fatL, c.fatigue + '/10');
    if (c.hrv != null) h += item(C.cyan, 'HRV', c.hrv + ' ms');
    if (c.poids != null) h += item(C.violet, T.weight, Number(c.poids).toFixed(1) + ' kg');
    document.getElementById('sanRead').innerHTML = h;
  }

  function render() {
    var o = document.getElementById('silAn');
    o.innerHTML = '<div class="san-wrap"><div class="san-top"><div style="flex:1;min-width:200px"><h2>' + esc(T.title) + (state.demo ? '<span class="san-demo">' + esc(T.demo) + '</span>' : '') + '</h2><p class="san-sub">' + esc(T.sub) + '</p></div>' +
      '<button type="button" class="san-x" data-x>' + esc(T.close) + '</button></div>' +
      '<div class="san-per">' + [42, 90, 180, 365].map(function (p) { return '<button type="button" data-p="' + p + '" class="' + (state.days === p ? 'on' : '') + '">' + esc(T['p' + p]) + '</button>'; }).join('') + '</div>' +
      '<div class="san-read" id="sanRead">' + esc(T.loading) + '</div><div id="sanCharts"></div></div>';
  }
  function refresh() { render(); return load().then(function () { render(); drawAll(); }); }
  function open(opts) {
    css(); if (opts && opts.days) state.days = opts.days;
    var o = document.getElementById('silAn');
    if (!o) {
      o = document.createElement('div'); o.id = 'silAn'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', T.title);
      document.body.appendChild(o);
      o.addEventListener('click', function (e) {
        if (e.target.closest('[data-x]')) { close(); return; }
        var b = e.target.closest('[data-p]'); if (b) { state.days = +b.getAttribute('data-p'); state.idx = null; refresh(); }
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && o.classList.contains('open')) close(); });
    }
    state.demo = !(window.PF && window.PF.user); state.idx = null;
    o.classList.add('open'); document.documentElement.style.overflow = 'hidden';
    return refresh();
  }
  function close() { var o = document.getElementById('silAn'); if (o) o.classList.remove('open'); document.documentElement.style.overflow = ''; }
  var rT; window.addEventListener('resize', function () { var o = document.getElementById('silAn'); if (!o || !o.classList.contains('open') || !state.daily.length) return; clearTimeout(rT); rT = setTimeout(drawAll, 150); });
  window.SilAnalyse = { open: open, close: close };
})();
