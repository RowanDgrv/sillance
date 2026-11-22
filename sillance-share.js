/* Sillance — « Partager mon activité » (17/11/2026)
   Génère un sticker PNG transparent 1080 × 1920 (format Story) à partir d'une séance
   réalisée (tracé GPS facultatif : tapis, piscine). Ajoute au choix le prévu du coach, son mot et le club. L'athlète le télécharge, puis l'ajoute lui-même sur sa photo
   ou sa vidéo dans Instagram : aucune connexion à Instagram, rien n'est publié par Sillance.

   - Le visuel est DESSINÉ sur un canvas (tracés et textes), ce n'est pas une capture d'écran.
   - Confidentialité : les 300 premiers et derniers mètres du tracé sont retirés ; aucun lieu,
     aucune adresse, aucune coordonnée n'apparaît. Si le tracé restant est trop court, pas d'export.
   - Les chiffres viennent tels quels de l'analyse de la séance et ne sont pas modifiables.
   - Modèles et couleurs sont dans des registres (TEMPLATES, COLORS) : un modèle de plus ou
     les couleurs d'un club s'ajoutent sans toucher au reste.
   La partie « cœur » (masquage, projection, chiffres) est pure et testée : tools/test-share.mjs */
(function (root) {
  'use strict';
  var W = 1080, H = 1920, MASK_M = 300, MIN_LEFT_M = 400, MIN_PTS = 8;
  // a → b : le dégradé de Sillance (bleu → orange). Pour un club : remplacer a et b par ses couleurs.
  var COLORS = { a: '#46C2D8', b: '#FF9A3D', text: '#FFFFFF', outline: 'rgba(8,11,18,.72)' };

  /* ======================= cœur (pur, testé) ======================= */
  function haversineM(a, b) {
    var R = 6371000, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function cleanTrack(track) {
    var out = [];
    (track || []).forEach(function (p) {
      if (!p || p.length < 2) return; var la = +p[0], lo = +p[1];
      if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180 || (la === 0 && lo === 0)) return;
      out.push([la, lo]);
    });
    return out;
  }
  function trackLengthM(track) { var d = 0; for (var i = 1; i < track.length; i++) d += haversineM(track[i - 1], track[i]); return d; }
  // Retire les `meters` premiers et derniers mètres. ok = il reste assez de tracé pour être partagé.
  function maskTrack(track, meters) {
    var t = cleanTrack(track); meters = meters == null ? MASK_M : meters;
    if (t.length < 2) return { ok: false, track: [], lengthM: 0, reason: 'no_gps' };
    var cum = [0], i; for (i = 1; i < t.length; i++) cum.push(cum[i - 1] + haversineM(t[i - 1], t[i]));
    var total = cum[cum.length - 1], kept = [];
    for (i = 0; i < t.length; i++) if (cum[i] >= meters && cum[i] <= total - meters) kept.push(t[i]);
    var left = kept.length > 1 ? trackLengthM(kept) : 0;
    if (kept.length < MIN_PTS || left < MIN_LEFT_M) return { ok: false, track: [], lengthM: left, reason: 'too_short' };
    return { ok: true, track: kept, lengthM: left };
  }
  // Projette le tracé dans un cadre : centré, proportions réelles conservées, jamais déformé.
  function projectTrack(track, box) {
    var t = cleanTrack(track); if (t.length < 2) return [];
    var laMin = Infinity, laMax = -Infinity, loMin = Infinity, loMax = -Infinity, i;
    for (i = 0; i < t.length; i++) { laMin = Math.min(laMin, t[i][0]); laMax = Math.max(laMax, t[i][0]); loMin = Math.min(loMin, t[i][1]); loMax = Math.max(loMax, t[i][1]); }
    var k = Math.cos((laMin + laMax) / 2 * Math.PI / 180);          // un degré de longitude rétrécit avec la latitude
    var w = Math.max((loMax - loMin) * k, 1e-9), h = Math.max(laMax - laMin, 1e-9);
    var s = Math.min(box.w / w, box.h / h), ox = box.x + (box.w - w * s) / 2, oy = box.y + (box.h - h * s) / 2;
    return t.map(function (p) { return [ox + (p[1] - loMin) * k * s, oy + (laMax - p[0]) * s]; });
  }
  // Allège un tracé très dense (un point sur n) en gardant le dernier point.
  function thin(pts, max) { if (pts.length <= max) return pts; var step = Math.ceil(pts.length / max), out = []; for (var i = 0; i < pts.length; i += step) out.push(pts[i]); if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]); return out; }

  function fr(v, d) { return Number(v).toFixed(d).replace('.', ','); }
  function clock(sec) { sec = Math.round(sec); var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0'); }
  // Chiffres affichés : repris de l'analyse (distance, durée, D+), allure = durée / distance.
  function buildStats(data) {
    var pts = (data && data.pts) || [], dist = +(data && data.dist) || 0;
    var durMin = pts.length > 1 ? pts[pts.length - 1].t - pts[0].t : 0, disc = (data && data.disc) || 'run';
    var out = { disc: disc, dist: null, time: null, pace: null, dplus: null, paceLabel: disc === 'bike' ? 'Vitesse' : 'Allure' };
    if (dist > 0) out.dist = disc === 'swim' && dist < 10 ? Math.round(dist * 1000) + ' m' : fr(dist, 2) + ' km';
    if (durMin > 0) out.time = clock(durMin * 60);
    if (dist > 0 && durMin > 0) {
      if (disc === 'bike') out.pace = fr(dist / (durMin / 60), 1) + ' km/h';
      else if (disc === 'swim') out.pace = clock(durMin * 60 / (dist * 10)) + ' /100 m';
      else out.pace = clock(durMin * 60 / dist) + ' /km';
    }
    if (data && data.dplus != null && disc !== 'swim') out.dplus = Math.round(data.dplus) + ' m';
    return out;
  }
  function eligible(data) { return !!(data && data.track && maskTrack(data.track).ok); }
  // Partage possible même sans GPS (tapis, piscine) : il faut au moins une durée réelle.
  function shareable(data) { var p = (data && data.pts) || []; return p.length > 1 && p[p.length - 1].t - p[0].t > 0; }
  function decode(s) { return String(s == null ? '' : s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/<[^>]*>/g, '').trim(); }
  function paceOf(disc, min, km) {
    if (!(min > 0 && km > 0)) return null;
    if (disc === 'bike') return fr(km / (min / 60), 1) + ' km/h';
    if (disc === 'swim') return clock(min * 60 / (km * 10)) + ' /100 m';
    return clock(min * 60 / km) + ' /km';
  }
  // Lignes « prévu / réalisé » : seulement ce que le coach a VRAIMENT prévu (durée, distance,
  // allure déduite des deux). Rien n'est inventé : une ligne sans valeur prévue disparaît. Pur, testé.
  function planRows(plan, data) {
    if (!plan) return [];
    var pts = (data && data.pts) || [], disc = (data && data.disc) || plan.disc || 'run';
    var rMin = pts.length > 1 ? pts[pts.length - 1].t - pts[0].t : 0, rKm = +(data && data.dist) || 0, pMin = +plan.dur || 0, pKm = +plan.dist || 0;
    var km = function (v) { return disc === 'swim' && v < 10 ? Math.round(v * 1000) + ' m' : fr(v, v >= 100 ? 0 : 1) + ' km'; };
    var rows = [];
    if (pMin > 0 && rMin > 0) rows.push({ k: 'time', l: 'Durée', p: clock(pMin * 60), r: clock(rMin * 60) });
    if (pKm > 0 && rKm > 0) rows.push({ k: 'dist', l: 'Distance', p: km(pKm), r: km(rKm) });
    var pp = paceOf(disc, pMin, pKm), rp = paceOf(disc, rMin, rKm);
    if (pp && rp) rows.push({ k: 'pace', l: disc === 'bike' ? 'Vitesse' : 'Allure', p: pp, r: rp });
    return rows;
  }

  // Temps par kilomètre (ou par tranche de 5 / 10 km sur les longues sorties). Pur, testé.
  function splits(data) {
    var pts = (data && data.pts) || [], n = pts.length; if (n < 2 || pts[n - 1]._cum == null) return [];
    var d0 = pts[0]._cum || 0, total = pts[n - 1]._cum - d0; if (!(total >= 2)) return [];
    var seg = total <= 25 ? 1 : total <= 60 ? 5 : 10, out = [], next = seg, tPrev = pts[0].t, dPrev = 0, i;
    for (i = 1; i < n; i++) {
      var d = pts[i]._cum - d0;
      while (d >= next) {                       // instant exact du passage, interpolé entre deux points
        var dA = pts[i - 1]._cum - d0, f = d > dA ? (next - dA) / (d - dA) : 1, tX = pts[i - 1].t + f * (pts[i].t - pts[i - 1].t);
        out.push({ label: String(next), km: seg, sec: (tX - tPrev) * 60 / seg, partial: false }); tPrev = tX; dPrev = next; next += seg;
      }
    }
    var rest = total - dPrev;                   // dernière tranche incomplète : gardée si elle pèse assez
    if (rest >= seg * 0.3 && pts[n - 1].t > tPrev) out.push({ label: fr(total, 1), km: rest, sec: (pts[n - 1].t - tPrev) * 60 / rest, partial: true });
    return out;
  }
  function series(data, key) {                  // valeurs d'un capteur, sans les trous (0)
    var pts = (data && data.pts) || [], out = [];
    for (var i = 0; i < pts.length; i++) { var v = pts[i][key]; if (v != null && isFinite(v) && (key === 'alt' || v > 0)) out.push(v); }
    return out;
  }
  function smooth(arr, max) {                   // réduit à `max` points par moyenne de paquets
    if (arr.length <= max) return arr.slice(); var out = [], step = arr.length / max;
    for (var i = 0; i < max; i++) { var a = Math.floor(i * step), b = Math.max(a + 1, Math.floor((i + 1) * step)), s = 0; for (var k = a; k < b; k++) s += arr[k]; out.push(s / (b - a)); }
    return out;
  }

  /* ---- intervalles : la séance du coach alignée sur les tours de la montre ---- */
  var REST = { warmup: 1, recov: 1, cooldown: 1 };
  function pace(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + "'" + String(sec % 60).padStart(2, '0') + '"'; }
  function lineDurS(ln) { var d = ln.dur || {}; return Math.round((+d.h || 0) * 3600 + (+d.m || 0) * 60 + (+d.s || 0)); }
  function stepLabel(st) {
    if (st.distM) return st.distM >= 1000 && st.distM % 100 === 0 ? fr(st.distM / 1000, st.distM % 1000 ? 1 : 0) + ' km' : Math.round(st.distM) + ' m';
    var m = Math.floor(st.durS / 60), sec = st.durS % 60; return sec ? m + "'" + String(sec).padStart(2, '0') : m + "'";
  }
  // Déplie les blocs du coach (séries × lignes) en étapes, dans l'ordre où la montre les a vécues.
  function planSteps(blocks, targetOf) {
    var out = [];
    (blocks || []).forEach(function (blk) {
      var lines = blk.lines || [], n = Math.max(1, +blk.series || 1);
      for (var r = 0; r < n; r++) lines.forEach(function (ln) {
        var st = { type: ln.type || 'exo', durS: ln.metric === 'dist' ? 0 : lineDurS(ln), distM: ln.metric === 'dist' && ln.dist ? +ln.dist : 0, target: targetOf ? targetOf(ln) : null };
        st.work = !REST[st.type] && st.type !== 'educatif' && st.type !== 'station' && ln.metric !== 'reps';
        out.push(st);
      });
    });
    return out;
  }
  function verdict(v, t) {
    if (!t || !(v > 0)) return null; var e = 0.015;
    return v < t.lo * (1 - e) ? 'low' : v > t.hi * (1 + e) ? 'high' : 'in';
  }
  // Aligne les étapes prévues sur les VRAIS tours de la montre. Refuse (null) dès que ça ne colle
  // pas : mieux vaut pas de sticker qu'un « 3'27 » attribué à la mauvaise répétition. Pur, testé.
  function matchIntervals(steps, data) {
    if (!data || !data.realLaps || !steps || !steps.length) return null;
    var laps = (data.laps || []).slice(), disc = data.disc || 'run';
    // tour fantôme à la fin (montre arrêtée quelques secondes après le dernier bloc)
    if (laps.length === steps.length + 1) { var z = laps[laps.length - 1]; if (z.durMin < 1.5 || z.dist < 0.3) laps.pop(); }
    if (laps.length !== steps.length) return null;
    var reps = [];
    for (var i = 0; i < steps.length; i++) {
      var st = steps[i], lap = laps[i], tol = st.work ? 0.25 : 0.45;
      if (st.distM && Math.abs(lap.dist * 1000 - st.distM) > st.distM * tol) return null;
      if (!st.distM && st.durS && Math.abs(lap.durMin * 60 - st.durS) > st.durS * tol) return null;
      if (!st.work) continue;
      var t = st.target, unit = t ? t.unit : (disc === 'bike' ? 'W' : 'pace'), v = null;
      if (unit === 'pace') v = lap.dist > 0 ? lap.durMin * 60 / lap.dist : null;
      else if (unit === 'kmh') v = lap.avgSpeed || null;
      else if (unit === 'W') v = lap.avgPower || null;
      else if (unit === 'bpm') v = lap.avgHr || null;
      if (!(v > 0)) return null;
      reps.push({ label: stepLabel(st), unit: unit, v: v, target: t, verdict: verdict(v, t), hr: lap.avgHr || 0, t0: lap.t0, t1: lap.t1 });
    }
    if (reps.length < 2) return null;
    var labels = reps.map(function (r) { return r.label; }), same = labels.every(function (l) { return l === labels[0]; });
    var tg = reps[0].target, sameT = reps.every(function (r) { return r.target && tg && r.target.lo === tg.lo && r.target.hi === tg.hi; });
    var n = reps.length, inN = reps.filter(function (r) { return r.verdict === 'in'; }).length;
    return { reps: reps, unit: reps[0].unit, title: same ? n + ' × ' + labels[0] : n + ' intervalles', target: sameT ? tg : null,
      scored: reps.every(function (r) { return r.verdict; }), inCount: inN,
      avg: reps.reduce(function (a, r) { return a + r.v; }, 0) / n };
  }
  function fmtVal(v, unit) { return unit === 'pace' ? pace(v) : unit === 'kmh' ? fr(v, 1) : String(Math.round(v)); }
  function unitTxt(unit) { return unit === 'pace' ? '/km' : unit === 'kmh' ? 'km/h' : unit === 'W' ? 'W' : 'bpm'; }
  function fmtTarget(t) { if (!t) return ''; return (Math.round(t.lo) === Math.round(t.hi) ? fmtVal(t.lo, t.unit) : fmtVal(t.lo, t.unit) + '–' + fmtVal(t.hi, t.unit)) + ' ' + unitTxt(t.unit); }
  // Fréquence cardiaque dans le temps, lissée (moyenne glissante) : la courbe brute est illisible en petit.
  function hrCurve(data, max) {
    var pts = (data && data.pts) || [], raw = [];
    for (var i = 0; i < pts.length; i++) if (pts[i].hr > 0 && isFinite(pts[i].t)) raw.push([pts[i].t, pts[i].hr]);
    if (raw.length < 20) return [];
    var w = Math.max(1, Math.round(raw.length / 90)), out = [], step = Math.max(1, Math.ceil(raw.length / (max || 240)));
    for (var j = 0; j < raw.length; j += step) {
      var a = Math.max(0, j - w), b = Math.min(raw.length - 1, j + w), s = 0;
      for (var k = a; k <= b; k++) s += raw[k][1];
      out.push([raw[j][0], s / (b - a + 1)]);
    }
    return out;
  }

  /* ======================= dessin ======================= */
  // Police d'affiche sportive (condensée, italique, très grasse) : chargée à l'ouverture de la modale.
  // Polices du site (Oswald pour les titres, Archivo pour le texte) ; un club habillé impose SA police de titres.
  var FONT = "'Oswald','Arial Narrow',Arial,sans-serif", DATA = "'Archivo',Arial,sans-serif", LEFT = 90, RIGHT = W - 90, CUR = FONT;
  function setFont(ctx, size, opt) {
    ctx.font = (opt.italic ? 'italic ' : '') + (opt.weight || 700) + ' ' + size + 'px ' + (opt.data ? DATA : CUR);
    if ('letterSpacing' in ctx) ctx.letterSpacing = (opt.spacing || 0) + 'px';
  }
  function text(ctx, str, x, y, size, opt) {
    opt = opt || {}; setFont(ctx, size, opt); ctx.textAlign = opt.align || 'left'; ctx.textBaseline = 'alphabetic';
    // contour + ombre : lisible sur une photo sombre comme claire
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = size * 0.2; ctx.shadowOffsetY = size * 0.03;
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, size * 0.085); ctx.strokeStyle = COLORS.outline; ctx.strokeText(str, x, y); ctx.restore();
    ctx.fillStyle = opt.color || COLORS.text; ctx.fillText(str, x, y);
  }
  function fitText(ctx, str, x, y, size, maxW, opt) {
    opt = opt || {}; setFont(ctx, size, opt);
    var w = ctx.measureText(str).width; if (w > maxW) size = Math.floor(size * maxW / w);
    text(ctx, str, x, y, size, opt); return size;
  }
  function round(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function measure(ctx, str, size, opt) { setFont(ctx, size, opt || {}); return ctx.measureText(str).width; }
  function hexA(hex, a) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 'rgba(255,255,255,' + a + ')'; var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function grad(ctx, x0, y0, x1, y1, c) { var g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, c.a); g.addColorStop(1, c.b); return g; }
  // En-tête commun : barre inclinée aux couleurs de Sillance + nom de la séance
  function header(ctx, S, y) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 12; ctx.fillStyle = grad(ctx, LEFT, 0, LEFT + 150, 0, S.colors);
    ctx.beginPath(); ctx.moveTo(LEFT + 14, y - 96); ctx.lineTo(LEFT + 164, y - 96); ctx.lineTo(LEFT + 150, y - 80); ctx.lineTo(LEFT, y - 80); ctx.closePath(); ctx.fill(); ctx.restore();
    if (S.name) fitText(ctx, S.name.toUpperCase(), LEFT, y, 78, RIGHT - LEFT, { spacing: 1 });
  }
  // Logo en bas, centré (validé par Rowan le 17/11) : les deux cercles de Sillance + le nom, en blanc.
  function drawLogo(ctx, y, colors) {
    var cx = W / 2 - 152, r = 21; ctx.save(); ctx.globalAlpha = .92;
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.lineWidth = 4.5; ctx.strokeStyle = colors.text;
    ctx.beginPath(); ctx.arc(cx - 10, y - 13, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 10, y - 13, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha = .92; text(ctx, 'SILLANCE', W / 2 + 34, y, 42, { spacing: 9, weight: 700, italic: false, align: 'center' }); ctx.restore();
  }
  // Coupe un texte en lignes qui tiennent dans maxW ; « … » si ça dépasse maxLines.
  function wrapLines(ctx, str, size, maxW, opt, maxLines) {
    setFont(ctx, size, opt || {}); var words = String(str).split(/[ \t\n\r]+/).filter(Boolean), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = words[i]; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); var last = lines[maxLines - 1]; while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1); lines[maxLines - 1] = last.replace(/[\s,.;:]+$/, '') + '…'; }
    return lines;
  }
  // Pied commun : nom du club (si l'athlète le veut) puis le logo Sillance centré.
  function footer(ctx, S, y) {
    y = y || 1800;
    if (S.showClub && S.club) fitText(ctx, S.club.toUpperCase(), W / 2, y - 70, 46, RIGHT - LEFT, { weight: 600, spacing: 6, align: 'center' });
    drawLogo(ctx, y, S.colors);
  }
  function quote(ctx, S, x, y, size, maxW, maxLines) {   // le mot du coach, entre guillemets, signé
    var lines = wrapLines(ctx, '«\u00a0' + S.note + '\u00a0»', size, maxW, { weight: 700 }, maxLines), lh = Math.round(size * 1.16);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 12; ctx.fillStyle = grad(ctx, 0, y - size, 0, y + lines.length * lh, S.colors);
    ctx.fillRect(x - 34, y - size * 0.82, 10, (lines.length - 1) * lh + size); ctx.restore();
    lines.forEach(function (ln, i) { text(ctx, ln, x, y + i * lh, size, { weight: 700 }); });
    var yy = y + (lines.length - 1) * lh + Math.round(size * 0.95);
    text(ctx, ('— ' + (S.coach || 'Mon coach')).toUpperCase(), x + 2, yy, Math.round(Math.max(32, size * 0.5)), { weight: 600, italic: false, spacing: 5, color: S.colors.b });
    return yy;
  }
  function drawTrack(ctx, track, box, colors) {
    var p = thin(projectTrack(track, box), 900); if (p.length < 2) return;
    function path() { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (var i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 4;
    path(); ctx.strokeStyle = colors.outline; ctx.lineWidth = 26; ctx.stroke(); ctx.restore();
    path(); ctx.strokeStyle = grad(ctx, box.x, box.y + box.h, box.x + box.w, box.y, colors); ctx.lineWidth = 14; ctx.stroke();
    var e = p[p.length - 1];                    // point d'arrivée (du tracé masqué, pas de l'adresse)
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.fillStyle = colors.text; ctx.beginPath(); ctx.arc(e[0], e[1], 15, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = colors.b; ctx.beginPath(); ctx.arc(e[0], e[1], 8, 0, Math.PI * 2); ctx.fill();
  }
  // Courbe (FC, altitude) : trait en dégradé, surface en transparence, repère de moyenne facultatif
  function drawCurve(ctx, vals, box, colors, opt) {
    opt = opt || {}; var v = smooth(vals, 220); if (v.length < 2) return;
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), pad = Math.max((hi - lo) * 0.12, 1); lo -= pad; hi += pad;
    var X = function (i) { return box.x + i / (v.length - 1) * box.w; }, Y = function (val) { return box.y + box.h - (val - lo) / (hi - lo) * box.h; };
    function path() { ctx.beginPath(); ctx.moveTo(X(0), Y(v[0])); for (var i = 1; i < v.length; i++) ctx.lineTo(X(i), Y(v[i])); }
    path(); ctx.lineTo(box.x + box.w, box.y + box.h); ctx.lineTo(box.x, box.y + box.h); ctx.closePath();
    var g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h); g.addColorStop(0, 'rgba(255,154,61,.42)'); g.addColorStop(1, 'rgba(255,154,61,0)');
    ctx.fillStyle = opt.fill === false ? 'transparent' : g; ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; path(); ctx.strokeStyle = colors.outline; ctx.lineWidth = 20; ctx.stroke(); ctx.restore();
    path(); ctx.strokeStyle = grad(ctx, box.x, 0, box.x + box.w, 0, colors); ctx.lineWidth = 10; ctx.stroke();
    if (opt.mark != null && opt.mark > lo && opt.mark < hi) {
      var y = Y(opt.mark); ctx.save(); ctx.setLineDash([18, 14]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); ctx.restore();
      text(ctx, opt.markLabel, box.x + box.w, y - 16, 40, { align: 'right', weight: 700 });
    }
  }
  function statCell(ctx, x, y, value, label, size, maxW) {
    var s = fitText(ctx, value.toUpperCase(), x, y, size, maxW || 440, {});
    text(ctx, label.toUpperCase(), x + 4, y + Math.round(s * 0.36), Math.round(Math.max(30, size * 0.27)), { weight: 600, italic: false, spacing: 6, color: 'rgba(255,255,255,.92)' });
  }
  function shown(st, show, keys) {
    var L = { dist: 'Distance', time: 'Durée', pace: st.paceLabel, dplus: 'D+', hr: 'FC moyenne', hrMax: 'FC max' };
    return keys.filter(function (k) { return show[k] !== false && st[k]; }).map(function (k) { return { v: st[k], l: L[k] }; });
  }
  function statRow(ctx, items, y, size) {       // jusqu'à 3 chiffres alignés depuis la gauche
    var n = items.length; if (!n) return; var w = (RIGHT - LEFT) / n;
    items.forEach(function (it, i) { statCell(ctx, LEFT + i * w, y, it.v, it.l, size, w - 36); });
  }
  // Un modèle = libellé, chiffres qu'il sait afficher, condition de disponibilité, dessin.
  var TEMPLATES = {
    full: { label: 'Tracé + stats', keys: ['dist', 'time', 'pace', 'dplus'], needs: 'gps', draw: function (ctx, S) {
      header(ctx, S, 270);
      drawTrack(ctx, S.track, { x: 120, y: 350, w: 840, h: 790 }, S.colors);
      var c = shown(S.stats, S.show, this.keys);
      c.forEach(function (it, i) { statCell(ctx, LEFT + (i % 2) * 480, 1330 + Math.floor(i / 2) * 220, it.v, it.l, 132, 440); });
      footer(ctx, S);
    } },
    minimal: { label: 'Tracé minimal', keys: ['dist', 'pace'], needs: 'gps', draw: function (ctx, S) {
      header(ctx, S, 270);
      drawTrack(ctx, S.track, { x: 110, y: 350, w: 860, h: 950 }, S.colors);
      var c = shown(S.stats, S.show, this.keys);
      if (c[0]) fitText(ctx, c[0].v.toUpperCase(), LEFT, 1520, 190, RIGHT - LEFT, {});
      if (c[1]) text(ctx, c[1].v.toUpperCase(), LEFT + 4, 1630, 84, { color: S.colors.b });
      footer(ctx, S);
    } },
    stats: { label: 'Stats', keys: ['dist', 'time', 'pace'], draw: function (ctx, S) {
      var c = shown(S.stats, S.show, this.keys), gap = 340, y0 = 1000 - (c.length - 1) * gap / 2;
      header(ctx, S, y0 - 290);
      c.forEach(function (it, i) { statCell(ctx, LEFT, y0 + i * gap, it.v, it.l, 230, RIGHT - LEFT); });
      footer(ctx, S);
    } },
    splits: { label: 'Temps au km', keys: ['dist', 'time', 'pace'], ok: function (S) { return S.splits.length >= 2 && S.stats.disc !== 'bike'; }, draw: function (ctx, S) {
      header(ctx, S, 270);
      var sp = S.splits.slice(0, 26), n = sp.length, top = 360, rowH = Math.min(86, 1010 / n), barH = Math.max(18, rowH * 0.56), fs = Math.round(Math.min(54, rowH * 0.72));
      var fast = Math.min.apply(null, sp.map(function (s) { return s.sec; })), slow = Math.max.apply(null, sp.map(function (s) { return s.sec; }));
      var x0 = LEFT + 96, maxW = RIGHT - x0 - 210;
      sp.forEach(function (s, i) {
        var y = top + i * rowH, len = maxW * (slow > fast ? 0.5 + 0.5 * (slow - s.sec) / (slow - fast) : 0.8) * (s.partial ? Math.max(0.35, Math.min(1, s.km)) : 1), best = s.sec === fast && !s.partial;
        text(ctx, s.label, LEFT + 76, y + barH * 0.5 + fs * 0.34, fs, { align: 'right', weight: 700 });
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12; ctx.fillStyle = best ? grad(ctx, x0, 0, x0 + len, 0, S.colors) : 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.moveTo(x0 + 10, y); ctx.lineTo(x0 + len + 10, y); ctx.lineTo(x0 + len, y + barH); ctx.lineTo(x0, y + barH); ctx.closePath(); ctx.fill(); ctx.restore();
        text(ctx, clock(s.sec), x0 + len + 28, y + barH * 0.5 + fs * 0.34, fs, { color: best ? S.colors.b : COLORS.text });
      });
      statRow(ctx, shown(S.stats, S.show, this.keys), 1580, 112);
      footer(ctx, S);
    } },
    cardio: { label: 'Cardio', keys: [], h: function () { return 1300; }, ok: function (S) { return S.hrc.length >= 20; }, draw: function (ctx, S, h) {
      introLines(ctx, S, 'Fréquence cardiaque' + (S.stats.time ? '  ·  ' + S.stats.time : ''));
      var c = S.hrc, box = { x: LEFT, y: 330, w: RIGHT - LEFT, h: 470 }, t0 = c[0][0], t1 = c[c.length - 1][0];
      var vs = c.map(function (p) { return p[1]; }), vmin = Math.min.apply(null, vs), vmax = Math.max.apply(null, vs), lo = vmin - (vmax - vmin) * 0.15, hi = vmax + (vmax - vmin) * 0.12;
      var X = function (t) { return box.x + (t - t0) / ((t1 - t0) || 1) * box.w; }, Y = function (v) { return box.y + box.h - (v - lo) / ((hi - lo) || 1) * box.h; };
      // répétitions du coach en bandes discrètes derrière la courbe
      if (S.iv) S.iv.reps.forEach(function (r) { if (r.t0 == null) return; ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fillRect(X(r.t0), box.y - 10, Math.max(3, X(r.t1) - X(r.t0)), box.h + 10); ctx.restore(); });
      function path() { ctx.beginPath(); ctx.moveTo(X(c[0][0]), Y(c[0][1])); for (var i = 1; i < c.length - 1; i++) { var mx = (X(c[i][0]) + X(c[i + 1][0])) / 2, my = (Y(c[i][1]) + Y(c[i + 1][1])) / 2; ctx.quadraticCurveTo(X(c[i][0]), Y(c[i][1]), mx, my); } ctx.lineTo(X(c[c.length - 1][0]), Y(c[c.length - 1][1])); }
      ctx.save(); path(); ctx.lineTo(box.x + box.w, box.y + box.h); ctx.lineTo(box.x, box.y + box.h); ctx.closePath();
      var g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h); g.addColorStop(0, hexA(S.colors.b, 0.55)); g.addColorStop(1, hexA(S.colors.a, 0)); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      ctx.save(); ctx.shadowColor = hexA(S.colors.b, 0.6); ctx.shadowBlur = 22; path(); ctx.strokeStyle = grad(ctx, box.x, 0, box.x + box.w, 0, S.colors); ctx.lineWidth = 9; ctx.lineJoin = ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
      // pic : point + valeur
      var im = vs.indexOf(vmax), px = X(c[im][0]), py = Y(vmax);
      ctx.save(); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      text(ctx, String(Math.round(S.hrMax)), Math.min(RIGHT, Math.max(LEFT + 60, px)), py - 34, 54, { weight: 700, align: 'center' });
      text(ctx, "0'", box.x, box.y + box.h + 50, 32, { data: true, weight: 600, color: 'rgba(255,255,255,.75)' });
      text(ctx, Math.round(t1 - t0) + "'", box.x + box.w, box.y + box.h + 50, 32, { data: true, weight: 600, align: 'right', color: 'rgba(255,255,255,.75)' });
      var cells = [[S.hrAvg, 'FC MOYENNE'], [S.hrMax, 'FC MAX']]; if (S.stats.dist) cells.push([S.stats.dist.replace(' km', ''), 'KM']);
      cells.forEach(function (cl, i) { var x = LEFT + i * 320; text(ctx, String(cl[0]), x, 1000, 104, { weight: 700, color: i === 1 ? S.colors.b : COLORS.text }); text(ctx, cl[1], x + 4, 1050, 32, { data: true, weight: 600, spacing: 5, color: 'rgba(255,255,255,.85)' }); });
      footer(ctx, S, h - 50);
    } },
    profil: { label: 'Profil', keys: ['dist', 'dplus', 'time'], ok: function (S) { return S.alt.length >= 20 && Math.max.apply(null, S.alt) - Math.min.apply(null, S.alt) >= 15; }, draw: function (ctx, S) {
      header(ctx, S, 270);
      text(ctx, 'PROFIL D\'ALTITUDE', LEFT + 4, 370, 38, { weight: 600, italic: false, spacing: 6, color: 'rgba(255,255,255,.92)' });
      drawCurve(ctx, S.alt, { x: LEFT, y: 470, w: RIGHT - LEFT, h: 560 }, S.colors);
      var c = shown(S.stats, S.show, this.keys);
      if (c[0]) statCell(ctx, LEFT, 1300, c[0].v, c[0].l, 190, RIGHT - LEFT);
      statRow(ctx, c.slice(1), 1570, 120);
      footer(ctx, S);
    } }
  };
  // Intervalles : chaque répétition face à la cible du coach (barres : plus longue = plus rapide).
  function introLines(ctx, S, sub) {
    if (S.name) fitText(ctx, S.name.toUpperCase(), LEFT, 150, 92, RIGHT - LEFT, { weight: 700, spacing: 1 });
    if (sub) fitText(ctx, sub, LEFT + 2, 214, 38, RIGHT - LEFT, { data: true, weight: 600, color: 'rgba(255,255,255,.92)' });
  }
  TEMPLATES.intervals = { label: 'Intervalles', keys: [], h: function (S) { return 300 + Math.min(S.iv ? S.iv.reps.length : 0, 12) * 112 + 340; },
    ok: function (S) { return !!S.iv; }, draw: function (ctx, S, h) {
    var iv = S.iv, reps = iv.reps.slice(0, 12), n = reps.length, inv = iv.unit === 'pace';
    // titre = nom de la séance (ou « 5 × 1 km ») ; sous-titre = la cible du coach
    introLines(ctx, S.name ? S : { name: iv.title }, null);
    if (iv.target) fitText(ctx, 'Cible ' + fmtTarget(iv.target), LEFT + 2, 214, 38, RIGHT - LEFT, { data: true, weight: 600, color: 'rgba(255,255,255,.92)' });
    // échelle commune : la cible et toutes les répétitions tiennent dedans
    var vals = reps.map(function (r) { return r.v; }); reps.forEach(function (r) { if (r.target) { vals.push(r.target.lo, r.target.hi); } });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.35 || hi * 0.04; lo -= pad; hi += pad;
    var x0 = LEFT + 70, x1 = RIGHT - 230, pos = function (v) { var f = (v - lo) / (hi - lo); return x0 + (inv ? 1 - f : f) * (x1 - x0); };
    var top = 300, rowH = 112, barH = 50;
    reps.forEach(function (r, i) {
      var y = top + i * rowH, good = r.verdict === 'in';
      text(ctx, String(i + 1), LEFT + 40, y + barH / 2 + 15, 42, { data: true, weight: 700, align: 'right', color: 'rgba(255,255,255,.85)' });
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.16)'; round(ctx, x0, y, x1 - x0, barH, barH / 2); ctx.fill(); ctx.restore();
      if (r.target) { var a = pos(r.target.lo), b = pos(r.target.hi), l = Math.min(a, b), w = Math.max(6, Math.abs(b - a));
        ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.30)'; ctx.fillRect(l, y - 8, w, barH + 16); ctx.restore(); }
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10; ctx.fillStyle = good || !r.verdict ? grad(ctx, x0, 0, x1, 0, S.colors) : 'rgba(255,255,255,.92)';
      round(ctx, x0, y, Math.max(barH, pos(r.v) - x0), barH, barH / 2); ctx.fill(); ctx.restore();
      text(ctx, fmtVal(r.v, r.unit), RIGHT, y + barH / 2 + 24, 70, { weight: 700, align: 'right', color: good ? S.colors.b : COLORS.text });
    });
    var yS = top + n * rowH + 70;
    if (iv.scored && iv.target) {
      text(ctx, iv.inCount + '/' + iv.reps.length, LEFT, yS + 40, 110, { weight: 700, color: S.colors.b });
      text(ctx, 'DANS LA CIBLE', LEFT + 8 + measure(ctx, iv.inCount + '/' + iv.reps.length, 110) + 24, yS + 40, 44, { weight: 600, spacing: 4 });
    } else {
      text(ctx, fmtVal(iv.avg, iv.unit) + ' ' + unitTxt(iv.unit), LEFT, yS + 40, 96, { weight: 700, color: S.colors.b });
      text(ctx, 'MOYENNE', LEFT + 4, yS + 90, 34, { data: true, weight: 600, spacing: 5, color: 'rgba(255,255,255,.85)' });
    }
    footer(ctx, S, h - 50);
  } };
  // Mot du coach : son message en grand, et les chiffres de la séance dessous.
  TEMPLATES.coach = { label: 'Mot du coach', keys: ['dist', 'time', 'pace'], ok: function (S) { return !!(S.showNote && S.note); }, draw: function (ctx, S) {
    header(ctx, S, 270);
    text(ctx, 'LE MOT DU COACH', LEFT + 4, 380, 40, { weight: 600, italic: false, spacing: 7, color: 'rgba(255,255,255,.92)' });
    quote(ctx, S, LEFT + 34, 560, 86, RIGHT - LEFT - 40, 7);
    statRow(ctx, shown(S.stats, S.show, this.keys), 1530, 112);
    footer(ctx, S);
  } };
  function available(key, S) { var T = TEMPLATES[key]; if (!T) return false; if (T.needs === 'gps' && !(S.track && S.track.length > 1)) return false; return T.ok ? !!T.ok(S) : true; }
  // État complet d'un rendu à partir de la séance : tout ce que les modèles peuvent afficher.
  function makeState(data, masked, o) {
    o = o || {}; var hr = series(data, 'hr');
    return { model: o.model || 'full', show: o.show || {}, name: o.name || '', colors: o.colors || COLORS, track: (masked && masked.ok && masked.track) || [], stats: buildStats(data),
      plan: planRows(o.plan, data), iv: o.steps ? matchIntervals(o.steps, data) : null, hrc: hrCurve(data), font: o.font || '', order: o.order === 'real' ? 'real' : 'plan', note: o.note || '', showNote: !!o.showNote, coach: o.coach || '', club: o.club || '', showClub: !!o.showClub,
      splits: splits(data), hr: hr, alt: series(data, 'alt'), hrAvg: hr.length ? Math.round(hr.reduce(function (a, b) { return a + b; }, 0) / hr.length) : 0, hrMax: hr.length ? Math.round(Math.max.apply(null, hr)) : 0 };
  }
  function render(canvas, S) {
    var T = available(S.model, S) ? TEMPLATES[S.model] : TEMPLATES.stats, h = T.h ? T.h(S) : H;
    canvas.width = W; canvas.height = h;
    CUR = S.font ? "'" + S.font + "'," + FONT : FONT;
    var ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, W, h);          // fond 100 % transparent
    T.draw(ctx, S, h);
    return canvas;
  }

  var core = { W: W, H: H, MASK_M: MASK_M, haversineM: haversineM, cleanTrack: cleanTrack, trackLengthM: trackLengthM, maskTrack: maskTrack,
    projectTrack: projectTrack, buildStats: buildStats, splits: splits, eligible: eligible, shareable: shareable, planRows: planRows, decode: decode, planSteps: planSteps, matchIntervals: matchIntervals, hrCurve: hrCurve, fmtTarget: fmtTarget, TEMPLATES: TEMPLATES, COLORS: COLORS, available: available, makeState: makeState, render: render };
  if (typeof document === 'undefined') { root.SilShareCore = core; return; }   // tests Node : cœur seul

  /* ======================= interface ======================= */
  var UI = { data: null, session: null, masked: null, model: 'full', show: { dist: true, time: true, pace: true, dplus: true }, name: '',
    plan: null, order: 'plan', note: '', showNote: false, coach: '', club: '', showClub: false, clubColors: null, useClub: false };
  // ordre des boutons : ce qui est propre à Sillance (le plan du coach) d'abord
  var ORDER = ['intervals', 'cardio', 'coach', 'full', 'minimal', 'stats', 'splits', 'profil'];
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function build() {
    if ($('shOverlay')) return;
    var st = document.createElement('style');
    st.textContent = '#shOverlay{position:fixed;inset:0;z-index:1200;background:rgba(5,8,15,.72);display:none;align-items:center;justify-content:center;padding:14px}#shOverlay.open{display:flex}'
      + '.sh-box{width:min(880px,100%);max-height:96vh;overflow:auto;background:var(--panel,#111827);color:var(--text,#eaeef7);border:1px solid var(--line-strong,rgba(148,163,196,.3));border-radius:16px;padding:18px}'
      + '.sh-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}.sh-head h3{margin:0;font-size:19px;font-weight:700;flex:1}'
      + '.sh-grid{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:22px;align-items:start}'
      + '.sh-prev{border-radius:14px;overflow:hidden;border:1px solid var(--line,rgba(148,163,196,.2));background-color:#5b6272;background-image:linear-gradient(45deg,#737a8a 25%,transparent 25%,transparent 75%,#737a8a 75%),linear-gradient(45deg,#737a8a 25%,transparent 25%,transparent 75%,#737a8a 75%);background-size:22px 22px;background-position:0 0,11px 11px}'
      + '.sh-prev canvas{display:block;width:100%;height:auto}.sh-cap{font-size:12px;color:var(--muted,#94a3c4);margin:6px 0 0;text-align:center}'
      + '.sh-lab{display:block;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#94a3c4);margin:14px 0 7px}.sh-lab:first-child{margin-top:0}'
      + '.sh-row{display:flex;gap:7px;flex-wrap:wrap}'
      + '.sh-btn{font:inherit;font-size:13.5px;font-weight:600;border:1px solid var(--line-strong,rgba(148,163,196,.3));background:transparent;color:var(--text,#eaeef7);border-radius:99px;padding:8px 14px;cursor:pointer}'
      + '.sh-btn.on{background:var(--accent,#46c2d8);border-color:var(--accent,#46c2d8);color:#0b1120}.sh-btn:disabled{opacity:.4;cursor:default}'
      + '.sh-chk{display:inline-flex;align-items:center;gap:7px;font-size:14px;border:1px solid var(--line,rgba(148,163,196,.2));border-radius:99px;padding:7px 13px;cursor:pointer}.sh-chk input{accent-color:var(--accent,#46c2d8)}.sh-chk.off{opacity:.45}'
      + '.sh-in{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:10px 12px;border-radius:10px;border:1px solid var(--line-strong,rgba(148,163,196,.3));background:transparent;color:var(--text,#eaeef7)}'
      + '.sh-go{font:inherit;font-size:15px;font-weight:700;border:0;border-radius:12px;padding:13px 18px;cursor:pointer;background:#FF9A3D;color:#0b1120;width:100%;margin-top:18px}'
      + '.sh-go.alt{background:transparent;color:var(--text,#eaeef7);border:1px solid var(--line-strong,rgba(148,163,196,.3));margin-top:8px}'
      + '.sh-note{font-size:13px;color:var(--muted,#94a3c4);margin:12px 0 0;line-height:1.5}.sh-how{font-size:14px;margin:12px 0 0;padding:10px 12px;border-radius:10px;background:rgba(255,154,61,.14);line-height:1.5}'
      + '#anShareBtn{margin:8px 0 2px}'
      + '@media (max-width:700px){.sh-grid{grid-template-columns:1fr}.sh-prev{max-width:230px;margin:0 auto}.sh-box{padding:14px 12px}}';
    document.head.appendChild(st);
    var o = document.createElement('div'); o.id = 'shOverlay'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Partager mon activité');
    o.innerHTML = '<div class="sh-box"><div class="sh-head"><h3>Partager mon activité</h3><button type="button" class="sh-btn" id="shClose" aria-label="Fermer">✕</button></div>'
      + '<div class="sh-grid"><div><div class="sh-prev"><canvas id="shCanvas" width="' + W + '" height="' + H + '" role="img" aria-label="Aperçu du sticker"></canvas></div><p class="sh-cap">Le damier montre la transparence : il n\'est pas dans l\'image.</p></div>'
      + '<div><span class="sh-lab">Modèle</span><div class="sh-row" id="shModels"></div>'
      + '<div id="shOrderWrap" hidden><span class="sh-lab">Ordre</span><div class="sh-row" id="shOrder"><button type="button" class="sh-btn" data-o="plan">Prévu d\'abord</button><button type="button" class="sh-btn" data-o="real">Réalisé d\'abord</button></div></div>'
      + '<div id="shShowWrap"><span class="sh-lab">Chiffres affichés</span><div class="sh-row" id="shShow"></div></div>'
      + '<div id="shExtraWrap" hidden><span class="sh-lab">Ajouter</span><div class="sh-row" id="shExtra"></div>'
      + '<textarea class="sh-in" id="shNote" rows="3" maxlength="180" hidden style="margin-top:9px;resize:vertical"></textarea>'
      + '<p class="sh-note" id="shNoteWarn" hidden>Le mot de ton coach sera visible par tous ceux qui verront ta Story. Tu peux le raccourcir.</p></div>'
      + '<label class="sh-lab" for="shName">Nom de la séance (facultatif)</label><input class="sh-in" id="shName" maxlength="40" autocomplete="off">'
      + '<button type="button" class="sh-go" id="shNative" hidden>Partager via…</button>'
      + '<button type="button" class="sh-go" id="shDl">Télécharger le sticker PNG</button>'
      + '<p class="sh-how" id="shHow" hidden>Dans Instagram : crée une Story, choisis ta photo ou vidéo, puis ajoute ce PNG depuis le sticker Photo.</p>'
      + '<p class="sh-note" id="shMaskNote">Pour protéger ton adresse, les ' + MASK_M + ' premiers et derniers mètres du tracé sont masqués. Aucun lieu n\'est affiché.</p></div></div></div>';
    document.body.appendChild(o);
    $('shClose').onclick = close;
    o.addEventListener('pointerdown', function (e) { if (e.target === o) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && o.classList.contains('open')) { e.stopPropagation(); close(); } }, true);
    $('shModels').addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (b) { UI.model = b.dataset.m; controls(); paint(); } });
    $('shShow').addEventListener('change', function (e) { var k = e.target && e.target.dataset.k; if (k) { UI.show[k] = e.target.checked; paint(); } });
    $('shName').addEventListener('input', function () { UI.name = this.value.trim(); paint(); });
    $('shOrder').addEventListener('click', function (e) { var b = e.target.closest('[data-o]'); if (b) { UI.order = b.dataset.o; controls(); paint(); } });
    $('shExtra').addEventListener('change', function (e) {
      var k = e.target && e.target.dataset.x; if (!k) return;
      UI[k] = e.target.checked;
      if (k === 'showNote' && !UI.showNote && UI.model === 'coach') UI.model = firstModel();
      controls(); paint();
    });
    $('shNote').addEventListener('input', function () { UI.note = this.value.replace(/\s+/g, ' ').trim(); controls(); paint(); });
    $('shDl').onclick = download; $('shNative').onclick = nativeShare;
  }
  function controls() {
    var S0 = state();
    if (!available(UI.model, S0)) { UI.model = firstModel(); S0 = state(); }
    $('shModels').innerHTML = ORDER.filter(function (k) { return available(k, S0); }).map(function (k) { return '<button type="button" class="sh-btn' + (k === UI.model ? ' on' : '') + '" data-m="' + k + '">' + TEMPLATES[k].label + '</button>'; }).join('');
    var st = buildStats(UI.data), L = { dist: 'Distance', time: 'Temps', pace: st.paceLabel, dplus: 'D+' }, keys = TEMPLATES[UI.model].keys;
    $('shShowWrap').hidden = !keys.length;
    $('shOrderWrap').hidden = UI.model !== 'plan';
    [].forEach.call($('shOrder').children, function (b) { b.classList.toggle('on', b.dataset.o === UI.order); });
    var ex = [];
    if (UI.noteRaw) ex.push(['showNote', 'Mot du coach']);
    if (UI.club) ex.push(['showClub', 'Nom du club']);
    if (UI.clubColors) ex.push(['useClub', UI.clubFont ? 'Couleurs et police du club' : 'Couleurs du club']);
    $('shExtraWrap').hidden = !ex.length;
    $('shExtra').innerHTML = ex.map(function (x) { return '<label class="sh-chk"><input type="checkbox" data-x="' + x[0] + '"' + (UI[x[0]] ? ' checked' : '') + '>' + x[1] + (x[0] === 'showClub' ? ' <b>' + esc(UI.club) + '</b>' : '') + '</label>'; }).join('');
    $('shNote').hidden = $('shNoteWarn').hidden = !UI.showNote;
    $('shMaskNote').hidden = TEMPLATES[UI.model].needs !== 'gps';
    $('shShow').innerHTML = ['dist', 'time', 'pace', 'dplus'].map(function (k) {
      var can = keys.indexOf(k) >= 0 && !!st[k];
      return '<label class="sh-chk' + (can ? '' : ' off') + '"><input type="checkbox" data-k="' + k + '"' + (UI.show[k] && can ? ' checked' : '') + (can ? '' : ' disabled') + '>' + L[k] + (st[k] ? ' <b>' + esc(st[k]) + '</b>' : '') + '</label>';
    }).join('');
  }
  function state() {
    return makeState(UI.data, UI.masked, { model: UI.model, show: UI.show, name: UI.name, plan: UI.plan, order: UI.order, note: UI.note, showNote: UI.showNote,
      coach: UI.coach, club: UI.club, showClub: UI.showClub, colors: UI.useClub && UI.clubColors ? UI.clubColors : COLORS,
      steps: UI.steps, font: UI.useClub ? UI.clubFont : '' });
  }
  // modèle proposé à l'ouverture : le plan du coach s'il existe, sinon le tracé, sinon les chiffres
  function firstModel() { var S = makeState(UI.data, UI.masked, { plan: UI.plan, note: UI.note, showNote: UI.showNote, steps: UI.steps }); return ORDER.filter(function (k) { return k !== 'coach' && available(k, S); })[0] || 'stats'; }
  function paint() { render($('shCanvas'), state()); }
  function fileName() { var s = (UI.name || 'seance').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); return 'sillance-' + (s || 'seance') + '.png'; }
  // Police d'affiche chargée à la demande (Google Fonts, déjà autorisé par le site) ; repli propre si elle n'arrive pas.
  var fontP = null;
  function loadFont() {
    if (fontP) return fontP;
    var href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Archivo:wght@500;600;700' + (UI.clubFontSpec ? '&family=' + UI.clubFontSpec : '') + '&display=swap';
    var old = $('shFont'); if (old && old.getAttribute('href') !== href) { old.remove(); old = null; }
    if (!old) { var l = document.createElement('link'); l.id = 'shFont'; l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }
    var wait = new Promise(function (r) { setTimeout(r, 2500); });
    var ld = (document.fonts && document.fonts.load) ? new Promise(function (r) { var l = $('shFont'); function go() { Promise.all([document.fonts.load("700 100px 'Oswald'"), document.fonts.load("600 40px 'Archivo'"), document.fonts.load("700 40px 'Archivo'")].concat(UI.clubFont ? [document.fonts.load("700 100px '" + UI.clubFont + "'")] : [])).then(r, r); } if (l.sheet) go(); else { l.addEventListener('load', go); l.addEventListener('error', r); } }) : Promise.resolve();
    fontP = Promise.race([ld, wait]); return fontP;
  }
  function toBlob() { return loadFont().then(function () { return new Promise(function (res) { var c = document.createElement('canvas'); render(c, state()); c.toBlob(res, 'image/png'); }); }); }
  function download() {
    toBlob().then(function (blob) {
      if (!blob) return;
      var a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000); $('shHow').hidden = false;
    });
  }
  function nativeShare() {
    toBlob().then(function (blob) {
      if (!blob) return; var file = new File([blob], fileName(), { type: 'image/png' });
      navigator.share({ files: [file] }).then(function () { $('shHow').hidden = false; }).catch(function () {});
    });
  }
  // Cible d'une ligne du coach en valeur comparable (allure s/km, W, km/h, bpm). Lit les références
  // de l'athlète déjà chargées par l'app (INTENSITY_MODELS, fcAt) ; sans elles : pas de cible, pas d'invention.
  function targetOf(ln, disc) {
    try {
      if (ln.mode === 'exact' && ln.exact) {
        var ex = ln.exact, tol = +ex.tol || 0;
        if (ex.kind === 'pace') { var sec = (+ex.m || 0) * 60 + (+ex.s || 0); return sec ? { unit: 'pace', lo: sec - tol, hi: sec + tol } : null; }
        if (ex.kind === 'speed' && ex.kmh) return disc === 'bike' ? { unit: 'kmh', lo: ex.kmh - tol, hi: ex.kmh + tol } : { unit: 'pace', lo: 3600 / (ex.kmh + tol), hi: 3600 / Math.max(1, ex.kmh - tol) };
        if (ex.kind === 'power' && ex.w) return { unit: 'W', lo: ex.w - tol, hi: ex.w + tol };
        if (ex.kind === 'hr' && ex.lo && ex.hi) return { unit: 'bpm', lo: +ex.lo, hi: +ex.hi };
        return null;
      }
      if (!ln.pct || typeof INTENSITY_MODELS === 'undefined') return null;
      var m = INTENSITY_MODELS[ln.model]; if (!m) return null;
      var base = +m.ref(); if (!(base > 0)) return null;
      var t = +ln.pctTol || 0, lo = Math.max(1, ln.pct - t), hi = ln.pct + t;
      if (m.unit === 'kmh') return { unit: 'pace', lo: 3600 / (base * hi / 100), hi: 3600 / (base * lo / 100) };
      if (m.unit === 'pace') return { unit: 'pace', lo: base * lo / 100, hi: base * hi / 100 };
      if (m.unit === 'W') return { unit: 'W', lo: base * lo / 100, hi: base * hi / 100 };
      if (m.unit === 'bpm' && typeof fcAt === 'function') return { unit: 'bpm', lo: fcAt(lo), hi: fcAt(hi) };
    } catch (e) {}
    return null;
  }
  function clubInfo() {
    var c = null; try { c = window.SilClubTheme && SilClubTheme.get && SilClubTheme.get(); } catch (e) {}
    if (!c) return { name: '', colors: null, font: '' };
    var th = c.theme || {}, custom = th.preset !== 'sillance' && th.accent && th.accent2;
    var F = (window.SilClubTheme && SilClubTheme.FONTS) || {};
    return { name: decode(c.name).slice(0, 40), colors: custom ? { a: th.accent, b: th.accent2, text: COLORS.text, outline: COLORS.outline } : null,
      font: custom && th.font && F[th.font] ? th.font : '', fontSpec: custom && th.font && F[th.font] ? F[th.font] : '' };
  }
  // Nom du coach qui a programmé la séance (co-coaching : celui qui l'a créée, sinon le premier).
  function loadCoachName(session) {
    var PF = window.PF; if (!PF || !PF.user || !PF.getCoTeam) return;
    PF.getCoTeam(PF.user.id).then(function (rows) {
      rows = rows || []; var r = rows.filter(function (x) { return session && x.coach_id === session.createdBy; })[0] || rows[0];
      var n = r && r.coach && r.coach.full_name ? decode(r.coach.full_name).slice(0, 40) : '';
      if (n && UI.session === session) { UI.coach = n; if ($('shOverlay').classList.contains('open')) paint(); }
    }).catch(function () {});
  }
  function open(session, data) {
    if (!shareable(data)) return;
    var m = data.track ? maskTrack(data.track) : { ok: false };
    build();
    UI.data = data; UI.session = session; UI.masked = m; UI.show = { dist: true, time: true, pace: true, dplus: true };
    UI.name = decode(session && session.title).slice(0, 40);
    // le plan du coach : seulement une vraie séance prévue (jamais une activité hors plan)
    UI.plan = session && !session._unplanned && (session.dur || session.dist) ? { dur: session.dur, dist: session.dist, disc: session.disc } : null;
    UI.order = 'plan';
    UI.noteRaw = decode(session && session.coachNote).slice(0, 180); UI.note = UI.noteRaw; UI.showNote = false;  // privé par défaut : l'athlète choisit
    UI.coach = ''; loadCoachName(session);
    var ci = clubInfo(); UI.club = ci.name; UI.showClub = !!ci.name; UI.clubColors = ci.colors; UI.useClub = !!ci.colors; UI.clubFont = ci.font; UI.clubFontSpec = ci.fontSpec;
    // structure du coach (blocs) → étapes avec leur cible chiffrée, pour le sticker « Intervalles »
    var blocks = session && !session._unplanned && session.blocksV2 && session.blocksV2.blocks;
    UI.steps = blocks && blocks.length ? planSteps(blocks, function (ln) { return targetOf(ln, session.disc); }) : null;
    fontP = null;
    UI.model = firstModel();
    $('shName').value = UI.name; $('shNote').value = UI.note; $('shHow').hidden = true;
    var can = false; try { can = !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'a.png', { type: 'image/png' })] })); } catch (e) {}
    $('shNative').hidden = !can; $('shDl').classList.toggle('alt', can);   // sur téléphone : « Partager via… » d'abord
    controls(); $('shOverlay').classList.add('open'); paint();
    // la police de titrage peut arriver après le premier dessin : on redessine dès qu'elle est là
    loadFont().then(function () { if ($('shOverlay').classList.contains('open')) paint(); });
  }
  function close() { var o = $('shOverlay'); if (o) o.classList.remove('open'); }
  // Appelé par l'app à l'ouverture d'une analyse : pose (ou retire) le bouton.
  function attach(session, data, mode) {
    var old = $('anShareBtn'); if (old) old.remove();
    var title = $('anTitle'); if (!title || mode !== 'athlete' || !shareable(data)) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'anShareBtn'; b.className = 'cb-bilan'; b.textContent = 'Partager mon activité';
    b.onclick = function () { open(session, data); };
    title.insertAdjacentElement('afterend', b);
  }
  root.SilShare = { attach: attach, open: open, close: close, core: core };
})(typeof window !== 'undefined' ? window : globalThis);
