/* ============================================================
   Sillance — Contrôle de la consigne (28/10/2026)
   ------------------------------------------------------------
   Compare une séance RÉALISÉE (points de la montre) à la séance PRÉVUE
   (blocs du constructeur), avec des RÈGLES DE CODE — pas d'IA : même
   résultat à chaque fois, vérifiable, zéro token. L'IA ne fait ensuite
   que rédiger à partir de ce verdict.

   Règles (demandées par Rowan) :
   1. Cible lue dans la séance : plage FC exacte (bpm) > zone en % d'une
      référence DE L'ATHLÈTE (FC max, VMA, FTP…) > allure/vitesse/puissance
      exacte. Sans cible : pas de verdict.
   2. On juge le TEMPS PASSÉ dans la cible, pas la moyenne (un footing à
      90 % en Z2 avec 7 dernières minutes en Z3 reste validé).
   3. Piège des intervalles courts : sur 30 s, la FC n'a pas le temps de
      monter, et sur 30 s de récup elle n'a pas le temps de redescendre.
      Blocs de moins de 3 min et récupérations entre efforts → jugés à
      l'ALLURE / PUISSANCE / VITESSE, jamais à la FC. Une cible exprimée en
      FC y est convertie en zone d'allure équivalente (même numéro de zone
      en % de VMA, ou de FTP en vélo), signalée comme « équivalence ».
   4. Blocs longs à cible FC : on ignore les 90 premières secondes (montée
      du cœur), puis temps dans la plage.
   5. Seuils : ≥ 80 % → validé, 60-80 % → partiel, < 60 % → non conforme.

   API : SilConsigne.evaluate({ blocks, disc, data, refs, zonesOf, lineSec })
     blocks  : s.blocksV2.blocks (séries + lignes du constructeur)
     data    : { pts:[{t(min), sp(km/h), hr, pw}], laps, realLaps }
     refs    : { fcMax, vma, ftp, pma, cpBike, cv, seuilRun, css }
     zonesOf : (modelKey) => [[nom, lo%, hi%], ...] (zones de l'athlète)
     lineSec : (ligne) => durée prévue en secondes
   ============================================================ */
(function(){
  'use strict';

  var SHORT_SEC = 180, HR_LAG_SEC = 90, OK = 0.8, PARTIAL = 0.6;
  // 'recov' = clé réelle des lignes « Récup » du constructeur (LINE_TYPES) :
  // absente jusqu'au 29/10/2026, les récups étaient jugées comme des efforts.
  var REC_TYPES = { contre: 1, rec: 1, recov: 1, recup: 1, recovery: 1, repos: 1 };
  var EDGE_TYPES = { warmup: 1, cooldown: 1 };

  function mean(a){ return a.length ? a.reduce(function(s, x){ return s + x; }, 0) / a.length : null; }
  function paceStr(kmh){ if(!kmh || kmh <= 0) return '—'; var s = Math.round(3600 / kmh), m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0') + '/km'; }
  function fmtDur(sec){ sec = Math.round(sec); if(sec < 120) return sec + ' s'; var m = Math.floor(sec / 60), r = sec % 60; return m + ' min' + (r ? ' ' + String(r).padStart(2, '0') : ''); }

  /* ---------- cible absolue d'une ligne ---------- */
  // Renvoie { metric:'hr'|'speed'|'power', lo, hi, label, src } ou null.
  function targetOf(ln, refs, zonesOf, disc){
    if(!ln) return null;
    if(ln.mode === 'exact' && ln.exact){
      var ex = ln.exact, tol = +ex.tol || 0;
      if(ex.kind === 'hr' && ex.lo && ex.hi) return { metric: 'hr', lo: +ex.lo, hi: +ex.hi, src: 'exact' };
      if(ex.kind === 'power' && ex.w) return { metric: 'power', lo: ex.w - tol, hi: ex.w + tol, src: 'exact' };
      if(ex.kind === 'speed' && ex.kmh) return { metric: 'speed', lo: ex.kmh - tol, hi: ex.kmh + tol, src: 'exact' };
      if(ex.kind === 'pace'){
        var sec = (ex.m || 0) * 60 + (ex.s || 0); if(!sec) return null;
        var per = disc === 'swim' || ex.per100 ? 100 : 1000;
        return { metric: 'speed', lo: per * 3.6 / (sec + tol), hi: per * 3.6 / Math.max(sec - tol, 1), src: 'exact' };
      }
      if(ex.kind === 'time100'){
        var s100 = (ex.m || 0) * 60 + (ex.s || 0); if(!s100) return null;
        return { metric: 'speed', lo: 360 / (s100 + tol), hi: 360 / Math.max(s100 - tol, 1), src: 'exact' };
      }
      return null; // rpe, temps total, cadence : pas de contrôle automatique
    }
    var model = ln.model, pct = +ln.pct;
    if(!model || !pct) return null;
    var lo, hi, tolP = +ln.pctTol || 0;
    if(tolP > 0){ lo = pct - tolP; hi = pct + tolP; }
    else {
      var zs = zonesOf(model) || [];
      for(var i = 0; i < zs.length; i++){
        var a = Math.min(zs[i][1], zs[i][2]), b = Math.max(zs[i][1], zs[i][2]);
        if(pct >= a && pct < b){ lo = a; hi = b; break; }
      }
      if(lo == null){ lo = pct - 5; hi = pct + 5; }
    }
    var zoneName = zoneNameOf(pct, zonesOf(model));
    if(model === 'fc'){ if(!refs.fcMax) return { missing: 'FC max' }; return { metric: 'hr', lo: lo * refs.fcMax / 100, hi: hi * refs.fcMax / 100, src: 'zone', zone: zoneName, model: model }; }
    if(model === 'vma' || model === 'cv'){
      var ref = refs[model]; if(!ref) return { missing: model === 'vma' ? 'VMA' : 'vitesse critique' };
      return { metric: 'speed', lo: lo * ref / 100, hi: hi * ref / 100, src: 'zone', zone: zoneName, model: model };
    }
    if(model === 'ftp' || model === 'pma' || model === 'cpBike'){
      var w = refs[model]; if(!w) return { missing: model === 'pma' ? 'PMA' : model === 'cpBike' ? 'puissance critique' : 'FTP' };
      return { metric: 'power', lo: lo * w / 100, hi: hi * w / 100, src: 'zone', zone: zoneName, model: model };
    }
    if(model === 'seuilRun' || model === 'css'){
      // modèles « inversés » : % d'un TEMPS (s/km, s/100 m) → plus grand = plus lent
      var base = refs[model]; if(!base) return { missing: model === 'css' ? 'CSS' : 'allure seuil' };
      var per2 = model === 'css' ? 100 : 1000;
      return { metric: 'speed', lo: per2 * 3.6 / (base * hi / 100), hi: per2 * 3.6 / (base * lo / 100), src: 'zone', zone: zoneName, model: model };
    }
    return null;
  }
  function zoneNameOf(pct, zs){
    zs = zs || [];
    for(var i = 0; i < zs.length; i++){ var a = Math.min(zs[i][1], zs[i][2]), b = Math.max(zs[i][1], zs[i][2]); if(pct >= a && pct < b) return zs[i][0]; }
    return null;
  }
  function zoneIndex(pct, zs){
    zs = zs || [];
    for(var i = 0; i < zs.length; i++){ var a = Math.min(zs[i][1], zs[i][2]), b = Math.max(zs[i][1], zs[i][2]); if(pct >= a && pct < b) return i; }
    return pct >= 100 ? zs.length - 1 : 0;
  }
  // Bloc court à cible FC → zone d'allure / de puissance de même numéro.
  function hrToEffortTarget(t, ln, refs, zonesOf, disc){
    var pctMid = ln.mode === 'exact' && refs.fcMax ? ((+ln.exact.lo + +ln.exact.hi) / 2) / refs.fcMax * 100 : +ln.pct;
    if(!pctMid) return null;
    var k = zoneIndex(pctMid, zonesOf('fc'));
    if(disc === 'bike' && refs.ftp){ var zf = zonesOf('ftp') || []; if(zf[k]) return { metric: 'power', lo: zf[k][1] * refs.ftp / 100, hi: zf[k][2] * refs.ftp / 100, src: 'equivalence', zone: zf[k][0] }; }
    if(refs.vma){ var zv = zonesOf('vma') || []; if(zv[k]) return { metric: 'speed', lo: zv[k][1] * refs.vma / 100, hi: zv[k][2] * refs.vma / 100, src: 'equivalence', zone: zv[k][0] }; }
    return null;
  }

  /* ---------- déroulé du plan ---------- */
  function expand(blocks, lineSec){
    var segs = [];
    (blocks || []).forEach(function(b, bi){
      var lines = b.lines || [], series = Math.max(1, +b.series || 1);
      var interval = series > 1 && lines.some(function(l){ return lineSec(l) < SHORT_SEC; });
      for(var r = 1; r <= series; r++) lines.forEach(function(ln, li){
        if(ln.type === 'station' || ln.metric === 'reps') return;
        segs.push({ bi: bi, rep: r, series: series, li: li, ln: ln, type: ln.type, dur: lineSec(ln) || 0, interval: interval });
      });
    });
    return segs;
  }

  /* ---------- alignement sur l'activité ---------- */
  function smoothSeries(pts, key){
    var out = [], w = 5 / 60, j = 0, sum = 0;
    for(var i = 0; i < pts.length; i++){
      sum += pts[i][key] || 0;
      while(pts[i].t - pts[j].t > w){ sum -= pts[j][key] || 0; j++; }
      out.push(sum / (i - j + 1));
    }
    return out;
  }
  // Repère les N efforts d'un bloc d'intervalles dans une fenêtre de temps.
  function detectBursts(pts, metricKey, t0, t1, n, workSec){
    var idx = []; for(var i = 0; i < pts.length; i++) if(pts[i].t >= t0 && pts[i].t <= t1) idx.push(i);
    if(idx.length < 20) return null;
    var sm = smoothSeries(pts, metricKey), vals = idx.map(function(i){ return sm[i]; }).sort(function(a, b){ return a - b; });
    var q = Math.max(1, Math.floor(vals.length / 4));
    var lowM = mean(vals.slice(0, q)), highM = mean(vals.slice(-q));
    if(!(highM > lowM * 1.08)) return null; // pas de contraste effort/récup lisible
    var minD = workSec * 0.4 / 60, maxD = workSec * 2.5 / 60;
    function runsAt(thr){
      var runs = [], cur = null;
      idx.forEach(function(i){
        var on = sm[i] > thr;
        if(on && !cur) cur = { a: pts[i].t, b: pts[i].t };
        else if(on && cur) cur.b = pts[i].t;
        else if(!on && cur){ if(pts[i].t - cur.b > 3 / 60){ runs.push(cur); cur = null; } }
      });
      if(cur) runs.push(cur);
      return runs.filter(function(r){ var d = r.b - r.a; return d >= minD && d <= maxD; });
    }
    // Plusieurs seuils essayés : une récup rapide (proche de l'effort) fusionne
    // effort + récup avec un seuil bas. On garde le seuil qui retrouve
    // EXACTEMENT n efforts, sinon celui qui en trouve le plus (≥ n).
    var best = null;
    [0.5, 0.6, 0.7, 0.8, 0.9].forEach(function(f){
      var r = runsAt(lowM + f * (highM - lowM));
      if(r.length === n && (!best || best.length !== n)) best = r;
      else if(!best || (best.length !== n && r.length > best.length)) best = r;
    });
    return best && best.length >= n ? best.slice(0, n) : null;
  }
  function align(segs, data, disc){
    var pts = data.pts || [], T = pts.length ? pts[pts.length - 1].t : 0;
    var laps = data.laps || [];
    // 1) Tours de la montre alignés 1 pour 1 sur le plan.
    if(data.realLaps && laps.length === segs.length){
      var t = 0;
      segs.forEach(function(s, k){ s.t0 = t; t += laps[k].durMin || 0; s.t1 = t; s.how = 'tours montre'; });
      return 'tours de la montre';
    }
    // 2) Alignement temporel, recalé sur les efforts détectés des blocs d'intervalles.
    var metricKey = disc === 'bike' && pts.some(function(p){ return p.pw > 0; }) ? 'pw' : 'sp';
    var cursor = 0, k = 0, how = 'chronologie du plan';
    while(k < segs.length){
      var s = segs[k];
      if(s.interval && s.rep === 1){
        var block = segs.filter(function(x){ return x.bi === s.bi; });
        var works = block.filter(function(x){ return !REC_TYPES[x.type]; });
        var workSec = works.length ? works[0].dur : 30;
        var plannedLen = block.reduce(function(a, x){ return a + x.dur; }, 0) / 60;
        var bursts = detectBursts(pts, metricKey, Math.max(0, cursor - 5), Math.min(T, cursor + plannedLen + 8), s.series, workSec);
        if(bursts){
          how = 'efforts détectés à l\'allure';
          var wi = 0;
          block.forEach(function(x){
            if(!REC_TYPES[x.type]){ var bb = bursts[Math.min(wi, bursts.length - 1)]; x.t0 = bb.a; x.t1 = bb.b; wi++; }
            else { var prev = bursts[Math.min(wi - 1, bursts.length - 1)], nxt = bursts[wi]; x.t0 = prev ? prev.b : cursor; x.t1 = nxt ? nxt.a : x.t0 + x.dur / 60; }
            x.how = 'détection';
          });
          // le bloc qui précède (échauffement) s'étend jusqu'au 1er effort détecté
          if(k > 0 && segs[k - 1].t1 != null) segs[k - 1].t1 = bursts[0].a;
          cursor = block[block.length - 1].t1; k += block.length; continue;
        }
      }
      s.t0 = cursor; s.t1 = Math.min(T, cursor + s.dur / 60); s.how = 'chronologie'; cursor = s.t1; k++;
    }
    // le dernier segment (retour au calme) va jusqu'à la fin de l'activité
    if(segs.length && T > segs[segs.length - 1].t1) segs[segs.length - 1].t1 = T;
    return how;
  }

  /* ---------- jugement d'un segment ---------- */
  function judge(s, data, refs, zonesOf, disc){
    var pts = (data.pts || []).filter(function(p){ return p.t >= s.t0 && p.t < s.t1; });
    var isRec = !!REC_TYPES[s.type];
    var short = s.interval || s.dur < SHORT_SEC;
    var tgt = targetOf(s.ln, refs, zonesOf, disc);
    var res = { seg: s, isRec: isRec, short: short, dur: (s.t1 - s.t0) * 60 };
    if(!tgt){ res.status = 'na'; res.note = 'pas de cible chiffrée'; return res; }
    if(tgt.missing){ res.status = 'na'; res.note = 'référence manquante : ' + tgt.missing; return res; }
    // Piège des intervalles : jamais la FC sur un bloc court ou une récup.
    if(tgt.metric === 'hr' && short){
      var eq = hrToEffortTarget(tgt, s.ln, refs, zonesOf, disc);
      if(eq){ tgt = eq; res.equivalence = true; }
      else { tgt = null; res.relativeOnly = true; }
    }
    var key = tgt ? (tgt.metric === 'hr' ? 'hr' : tgt.metric === 'power' ? 'pw' : 'sp') : (disc === 'bike' && pts.some(function(p){ return p.pw > 0; }) ? 'pw' : 'sp');
    var useP = pts;
    if(key === 'hr') useP = pts.filter(function(p){ return p.t >= s.t0 + HR_LAG_SEC / 60; });
    var vals = useP.map(function(p){ return p[key] || 0; }).filter(function(v){ return v > 0; });
    res.metric = key; res.target = tgt;
    if(!vals.length){ res.status = 'na'; res.note = key === 'hr' ? 'pas de FC' : key === 'pw' ? 'pas de puissance' : 'pas de vitesse'; return res; }
    res.avg = mean(vals);
    if(!tgt){ res.status = 'na'; res.note = 'cible FC sur bloc court, sans VMA/FTP pour la convertir'; return res; }
    var lo = Math.min(tgt.lo, tgt.hi), hi = Math.max(tgt.lo, tgt.hi), m = 0.02;
    if(short){
      // 30 s : la moyenne du bloc fait foi (le temps-dans-la-plage serait du bruit)
      if(isRec){
        // récup : seule une récup TROP RAPIDE est un écart ; plus lente, c'est bien
        res.status = res.avg <= hi * (1 + m) ? 'ok' : 'above';
      } else {
        res.status = res.avg < lo * (1 - m) ? 'below' : res.avg > hi * (1 + m) ? 'above_ok' : 'ok';
      }
    } else {
      var inR = vals.filter(function(v){ return v >= lo * (1 - m) && v <= hi * (1 + m); }).length / vals.length;
      var above = vals.filter(function(v){ return v > hi * (1 + m); }).length / vals.length;
      res.inRange = inR; res.above = above; res.below = 1 - inR - above;
      res.status = inR >= OK ? 'ok' : inR >= PARTIAL ? 'partial' : (above > res.below ? 'above' : 'below');
      if(isRec && res.status === 'below') res.status = 'ok';
    }
    return res;
  }

  function fmtVal(metric, v, disc){
    if(v == null) return '—';
    if(metric === 'hr') return Math.round(v) + ' bpm';
    if(metric === 'pw') return Math.round(v) + ' W';
    return disc === 'run' ? paceStr(v) : (Math.round(v * 10) / 10) + ' km/h';
  }
  function fmtTarget(t, disc){
    if(!t) return '—';
    var lo = Math.min(t.lo, t.hi), hi = Math.max(t.lo, t.hi);
    if(t.metric === 'hr') return Math.round(lo) + '-' + Math.round(hi) + ' bpm';
    if(t.metric === 'power') return Math.round(lo) + '-' + Math.round(hi) + ' W';
    return disc === 'run' ? paceStr(hi) + ' à ' + paceStr(lo) : (Math.round(lo * 10) / 10) + '-' + (Math.round(hi * 10) / 10) + ' km/h';
  }

  /* ---------- évaluation complète ---------- */
  function evaluate(o){
    var disc = o.disc, data = o.data || {}, refs = o.refs || {};
    var segs = expand(o.blocks, o.lineSec);
    if(!segs.length || !(data.pts || []).length) return null;
    var how = align(segs, data, disc);
    var res = segs.filter(function(s){ return s.t1 > s.t0; }).map(function(s){ return judge(s, data, refs, o.zonesOf, disc); });

    // Lignes de synthèse : un bloc d'intervalles = UNE ligne (pas 20).
    var lines = [], issues = [], scoreParts = [];
    var byBlock = {};
    res.forEach(function(r){ (byBlock[r.seg.bi] = byBlock[r.seg.bi] || []).push(r); });
    Object.keys(byBlock).forEach(function(bi){
      var rs = byBlock[bi], s0 = rs[0].seg;
      var works = rs.filter(function(r){ return !r.isRec && !EDGE_TYPES[r.seg.type]; });
      var recs = rs.filter(function(r){ return r.isRec; });
      var edge = rs.every(function(r){ return EDGE_TYPES[r.seg.type]; });
      if(s0.interval){
        var evalW = works.filter(function(r){ return r.status !== 'na'; });
        var okW = evalW.filter(function(r){ return r.status === 'ok' || r.status === 'above_ok'; }).length;
        var label = s0.series + ' × ' + rs.filter(function(r){ return r.seg.rep === 1; }).map(function(r){ return fmtDur(r.seg.dur); }).join(' / ');
        if(evalW.length){
          var w0 = evalW[0];
          var txt = label + ' : ' + okW + '/' + evalW.length + ' efforts dans la cible (' + fmtTarget(w0.target, disc) + (w0.equivalence ? ', équivalence de la zone de FC' : '') + ', jugés à ' + (w0.metric === 'pw' ? 'la puissance' : 'l\'allure') + ')';
          var badRec = recs.filter(function(r){ return r.status === 'above'; }).length;
          txt += recs.length ? (badRec ? ' ; ' + badRec + ' récup(s) trop rapide(s)' : ' ; récupérations conformes (jugées à l\'allure, pas à la FC)') : '';
          // Récups trop rapides = consigne non respectée aussi (pénalité
          // proportionnelle à leur part), pas seulement les efforts manqués.
          var recRatio = recs.length ? badRec / recs.length : 0;
          var bScore = Math.max(0, okW / evalW.length - 0.5 * recRatio);
          lines.push({ status: bScore >= OK ? 'ok' : bScore >= PARTIAL ? 'partial' : 'bad', text: txt });
          scoreParts.push({ w: 1, v: bScore });
          if(okW / evalW.length < OK){
            var below = evalW.filter(function(r){ return r.status === 'below'; }).length;
            issues.push({ texte: label + ' : ' + (evalW.length - okW) + ' effort(s) hors cible' + (below ? ' (trop lents)' : ''), majeur: okW / evalW.length < PARTIAL });
          }
          if(badRec) issues.push({ texte: label + ' : ' + badRec + ' récupération(s) trop rapide(s) à l\'allure', majeur: recRatio >= 0.5 });
        } else {
          lines.push({ status: 'na', text: label + ' : ' + (works[0] ? works[0].note : 'non évaluable') });
        }
        // FC des intervalles : information, jamais verdict
        var peaks = works.map(function(r){
          var p = (data.pts || []).filter(function(x){ return x.t >= r.seg.t0 && x.t <= r.seg.t1 + 20 / 60 && x.hr > 0; });
          return p.length ? Math.max.apply(null, p.map(function(x){ return x.hr; })) : null;
        }).filter(Boolean);
        if(peaks.length >= 2) lines.push({ status: 'info', text: 'FC de pointe : ' + peaks[0] + ' bpm au 1er effort, ' + peaks[peaks.length - 1] + ' bpm au dernier' + (refs.fcMax ? ' (' + Math.round(peaks[peaks.length - 1] / refs.fcMax * 100) + ' % FC max)' : '') + ' — information, pas un critère sur des efforts courts' });
      } else {
        rs.forEach(function(r){
          var name = r.seg.type === 'warmup' ? 'Échauffement' : r.seg.type === 'cooldown' ? 'Retour au calme' : r.isRec ? 'Récupération' : 'Bloc ' + (+bi + 1);
          if(r.status === 'na'){ if(!edge) lines.push({ status: 'na', text: name + ' : ' + r.note }); return; }
          var pctTxt = r.inRange != null ? Math.round(r.inRange * 100) + ' % du temps dans ' + fmtTarget(r.target, disc) : 'moyenne ' + fmtVal(r.metric, r.avg, disc) + ' pour ' + fmtTarget(r.target, disc);
          var dir = r.status === 'above' ? ' (au-dessus)' : r.status === 'below' ? ' (en dessous)' : '';
          lines.push({ status: r.status === 'ok' ? 'ok' : r.status === 'partial' ? 'partial' : 'bad',
            text: name + ' (' + fmtDur(r.dur) + ') : ' + pctTxt + dir + (r.metric === 'hr' ? ', 90 premières s ignorées' : '') });
          if(!EDGE_TYPES[r.seg.type]){
            scoreParts.push({ w: Math.max(1, r.dur / 300), v: r.status === 'ok' ? 1 : r.status === 'partial' ? 0.6 : 0.3 });
            if(r.status !== 'ok') issues.push({ texte: name + ' : ' + pctTxt + dir, majeur: r.status === 'above' || r.status === 'below' });
          }
        });
      }
    });
    var verdict = null;
    if(scoreParts.length){
      var tw = scoreParts.reduce(function(a, p){ return a + p.w; }, 0);
      var sc = scoreParts.reduce(function(a, p){ return a + p.w * p.v; }, 0) / tw;
      verdict = sc >= OK ? 'validee' : sc >= PARTIAL ? 'partielle' : 'non_conforme';
    }
    return { verdict: verdict, methode: how, lignes: lines, constats: issues };
  }

  window.SilConsigne = { evaluate: evaluate, targetOf: targetOf };
})();
