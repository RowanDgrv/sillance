/* ============================================================
   Sillance — Rapport complet de séance (Assistant IA, 28/10/2026)
   ------------------------------------------------------------
   Demande de Rowan : un rapport d'analyste en 7 étapes (vérification des
   données, prévu vs réalisé, FC, allure, cadence, dénivelé, fatigue,
   synthèse). Principe non négociable : TOUS les chiffres sont calculés ici,
   de façon déterministe, à partir des points de la montre. L'IA (Groq, Claude
   en repli, edge function session-report) ne fait qu'interpréter et rédiger ;
   elle reçoit un « dossier » de valeurs déjà calculées et a l'interdiction
   d'en inventer. Une donnée absente est écrite « donnée non disponible ».

   Confidentialité (politique 3.1 / 3.3) : le dossier ne contient ni nom,
   ni e-mail, ni identifiant. Le cycle menstruel n'y figure QUE s'il a été
   renseigné par l'athlète.

   API : SilAiReport.open({ session, data, ref, zones, load, goal, athleteId, isCoach })
   ============================================================ */
(function(){
  'use strict';

  /* ---------------- i18n (FR / EN / ES) ---------------- */
  var I18N = {
    fr: {
      'rep.btn': 'Rapport complet', 'rep.title': 'Rapport de séance', 'rep.loading': 'Calcul des indicateurs puis rédaction du rapport…',
      'rep.s0': 'Vérification des données', 'rep.s1': 'Prévu vs réalisé', 'rep.s2': 'Fréquence cardiaque', 'rep.s3': 'Allure / vitesse',
      'rep.s4': 'Cadence de foulée', 'rep.s5': 'Dénivelé et vitesse ascensionnelle', 'rep.s6': 'Fatigue et état de forme', 'rep.s7': 'Synthèse pour le coach',
      'rep.measured': 'Mesuré', 'rep.interpreted': 'Interprétation', 'rep.confidence': 'Confiance',
      'rep.present': 'Données présentes', 'rep.missing': 'Données manquantes', 'rep.anomalies': 'Anomalies détectées',
      'rep.colBlock': 'Bloc', 'rep.colPlan': 'Prévu', 'rep.colDone': 'Réalisé', 'rep.colGap': 'Écart', 'rep.colVerdict': 'Verdict',
      'rep.respect': 'Respect global', 'rep.summary': 'Résumé', 'rep.positives': 'Points positifs', 'rep.attention': 'Points d\'attention',
      'rep.recos': 'Recommandations', 'rep.alerts': 'Signaux d\'alerte', 'rep.fresh': 'Frais', 'rep.moderate': 'Fatigue modérée', 'rep.high': 'Fatigue élevée',
      'rep.demo': 'Démo : seuls les indicateurs calculés sont affichés. L\'interprétation rédigée nécessite l\'add-on Assistant IA.',
      'rep.noFile': 'Le rapport complet nécessite une activité réelle importée de la montre (fichier ou synchronisation).',
      'rep.close': 'Fermer', 'rep.na': 'donnée non disponible', 'rep.disclaimer': 'Analyse automatique d\'aide à la décision, à valider par le coach. Ce n\'est pas un avis médical.'
    },
    en: {
      'rep.btn': 'Full report', 'rep.title': 'Session report', 'rep.loading': 'Computing metrics, then writing the report…',
      'rep.s0': 'Data check', 'rep.s1': 'Planned vs done', 'rep.s2': 'Heart rate', 'rep.s3': 'Pace / speed',
      'rep.s4': 'Running cadence', 'rep.s5': 'Elevation and climbing speed', 'rep.s6': 'Fatigue and form', 'rep.s7': 'Summary for the coach',
      'rep.measured': 'Measured', 'rep.interpreted': 'Interpretation', 'rep.confidence': 'Confidence',
      'rep.present': 'Data present', 'rep.missing': 'Missing data', 'rep.anomalies': 'Anomalies detected',
      'rep.colBlock': 'Block', 'rep.colPlan': 'Planned', 'rep.colDone': 'Done', 'rep.colGap': 'Gap', 'rep.colVerdict': 'Verdict',
      'rep.respect': 'Overall compliance', 'rep.summary': 'Summary', 'rep.positives': 'Strengths', 'rep.attention': 'Watch points',
      'rep.recos': 'Recommendations', 'rep.alerts': 'Warning signs', 'rep.fresh': 'Fresh', 'rep.moderate': 'Moderate fatigue', 'rep.high': 'High fatigue',
      'rep.demo': 'Demo: only computed metrics are shown. The written interpretation requires the AI Assistant add-on.',
      'rep.noFile': 'The full report needs a real activity imported from the watch (file or sync).',
      'rep.close': 'Close', 'rep.na': 'data not available', 'rep.disclaimer': 'Automatic decision-support analysis, to be validated by the coach. Not medical advice.'
    },
    es: {
      'rep.btn': 'Informe completo', 'rep.title': 'Informe de la sesión', 'rep.loading': 'Calculando indicadores y redactando el informe…',
      'rep.s0': 'Verificación de datos', 'rep.s1': 'Previsto vs realizado', 'rep.s2': 'Frecuencia cardíaca', 'rep.s3': 'Ritmo / velocidad',
      'rep.s4': 'Cadencia de zancada', 'rep.s5': 'Desnivel y velocidad ascensional', 'rep.s6': 'Fatiga y estado de forma', 'rep.s7': 'Síntesis para el entrenador',
      'rep.measured': 'Medido', 'rep.interpreted': 'Interpretación', 'rep.confidence': 'Confianza',
      'rep.present': 'Datos presentes', 'rep.missing': 'Datos ausentes', 'rep.anomalies': 'Anomalías detectadas',
      'rep.colBlock': 'Bloque', 'rep.colPlan': 'Previsto', 'rep.colDone': 'Realizado', 'rep.colGap': 'Diferencia', 'rep.colVerdict': 'Veredicto',
      'rep.respect': 'Cumplimiento global', 'rep.summary': 'Resumen', 'rep.positives': 'Puntos positivos', 'rep.attention': 'Puntos de atención',
      'rep.recos': 'Recomendaciones', 'rep.alerts': 'Señales de alerta', 'rep.fresh': 'Fresco', 'rep.moderate': 'Fatiga moderada', 'rep.high': 'Fatiga elevada',
      'rep.demo': 'Demo: solo se muestran los indicadores calculados. La interpretación redactada requiere el add-on Asistente IA.',
      'rep.noFile': 'El informe completo requiere una actividad real importada del reloj (archivo o sincronización).',
      'rep.close': 'Cerrar', 'rep.na': 'dato no disponible', 'rep.disclaimer': 'Análisis automático de ayuda a la decisión, a validar por el entrenador. No es un consejo médico.'
    }
  };
  window.SIL_I18N = window.SIL_I18N || { fr: {}, en: {}, es: {} };
  ['fr', 'en', 'es'].forEach(function(l){
    window.SIL_I18N[l] = window.SIL_I18N[l] || {};
    for(var k in I18N[l]) if(!(k in window.SIL_I18N[l])) window.SIL_I18N[l][k] = I18N[l][k];
  });
  function t(k){
    var s = window.SilI18n ? window.SilI18n.t(k) : k;
    if(s === k){ var lang = (window.SilI18n && window.SilI18n.getLang()) || 'fr'; s = (I18N[lang] && I18N[lang][k]) || I18N.fr[k] || k; }
    return s;
  }
  function esc(x){
    return String(x == null ? '' : x).replace(/[&<>"']/g, function(c){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- outils numériques ---------------- */
  var NA = 'donnée non disponible';
  function mean(a){ return a.length ? a.reduce(function(s, x){ return s + x; }, 0) / a.length : null; }
  function sd(a){ var m = mean(a); if(m == null || a.length < 2) return null; return Math.sqrt(mean(a.map(function(x){ return (x - m) * (x - m); }))); }
  function r1(x){ return x == null || !isFinite(x) ? null : Math.round(x * 10) / 10; }
  function r0(x){ return x == null || !isFinite(x) ? null : Math.round(x); }
  function paceStr(kmh){ if(!kmh || kmh <= 0) return null; var s = Math.round(3600 / kmh), m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0') + '/km'; }
  function ptsIn(pts, a, b){ return pts.filter(function(p){ return p.t >= a && p.t < b; }); }

  /* ---------------- calculs (étapes 0 à 5) ---------------- */
  function zoneOf(pct, zones){
    if(pct == null || !zones || !zones.length) return null;
    for(var i = 0; i < zones.length; i++) if(pct < zones[i][2]) return zones[i][0];
    return zones[zones.length - 1][0];
  }

  function simplifyPlan(s){
    var keep = ['type', 'label', 'title', 'name', 'dur', 'durMin', 'duration', 'reps', 'rec', 'recDur', 'pct', 'pctLo', 'pctHi',
                'metric', 'zone', 'pace', 'dist', 'distM', 'note', 'target', 'lo', 'hi'];
    function walk(v, depth){
      if(depth > 4 || v == null) return undefined;
      if(Array.isArray(v)) return v.slice(0, 30).map(function(x){ return walk(x, depth + 1); }).filter(function(x){ return x !== undefined; });
      if(typeof v === 'object'){
        var o = {};
        Object.keys(v).forEach(function(k){
          if(keep.indexOf(k) >= 0 && (typeof v[k] !== 'object' || v[k] === null)) o[k] = v[k];
          else if(Array.isArray(v[k]) && /lines|items|blocks|steps|children/.test(k)) o[k] = walk(v[k], depth + 1);
        });
        return Object.keys(o).length ? o : undefined;
      }
      return v;
    }
    var blocks = (s.blocksV2 && s.blocksV2.blocks) || s.blocks || [];
    return {
      titre: s.title || NA, discipline: s.disc || NA, duree_min: s.dur || NA, zone_cible: s.zone || NA,
      objectif: (s.objectif && (s.objectif.type || s.objectif.zone)) ? s.objectif : NA,
      description: s.desc ? String(s.desc).slice(0, 400) : undefined,
      structure: walk(blocks, 0) || NA
    };
  }

  function dataCheck(data, fcMax, disc){
    var pts = data.pts || [], n = pts.length, dur = n ? pts[n - 1].t : 0;
    var hrPts = pts.filter(function(p){ return p.hr > 0; });
    var present = [], missing = [], anomalies = [];
    (hrPts.length ? present : missing).push('fréquence cardiaque');
    (pts.some(function(p){ return p.sp > 0; }) ? present : missing).push('vitesse / allure');
    (pts.some(function(p){ return p.cad > 0; }) ? present : missing).push('cadence');
    (pts.some(function(p){ return p.alt; }) ? present : missing).push('altitude');
    (pts.some(function(p){ return p.pw > 0; }) ? present : missing).push('puissance');
    (data.realLaps ? present : missing).push(data.realLaps ? 'tours réels de la montre' : 'tours réels (découpage automatique au km utilisé)');
    var over = fcMax ? hrPts.filter(function(p){ return p.hr > fcMax; }) : [];
    if(over.length) anomalies.push(over.length + ' point(s) de FC au-dessus de la FC max renseignée (' + fcMax + ' bpm), max mesuré ' + Math.max.apply(null, over.map(function(p){ return p.hr; })) + ' bpm');
    var early = ptsIn(hrPts, 0, 5), later = ptsIn(hrPts, 5, 1e9);
    if(early.length && later.length){
      var eMax = Math.max.apply(null, early.map(function(p){ return p.hr; })), lMean = mean(later.map(function(p){ return p.hr; }));
      if(eMax > lMean + 25) anomalies.push('pic de FC à ' + eMax + ' bpm dans les 5 premières minutes, au-dessus de la moyenne de la suite (' + r0(lMean) + ' bpm) : artefact probable du capteur poignet');
    }
    var jumps = 0;
    for(var i = 1; i < hrPts.length; i++) if(Math.abs(hrPts[i].hr - hrPts[i - 1].hr) > 35 && (hrPts[i].t - hrPts[i - 1].t) < 0.2) jumps++;
    if(jumps) anomalies.push(jumps + ' saut(s) de FC de plus de 35 bpm en moins de 12 s');
    var spMax = disc === 'run' ? 30 : disc === 'bike' ? 90 : 1e9;
    var spBad = pts.filter(function(p){ return p.sp > spMax; }).length;
    if(spBad) anomalies.push(spBad + ' point(s) de vitesse aberrante (> ' + spMax + ' km/h) : GPS perturbé probable');
    var cadPts = pts.filter(function(p){ return p.cad > 0; });
    if(disc === 'run' && cadPts.length){
      var cadZero = pts.filter(function(p){ return p.sp > 5 && !p.cad; }).length;
      if(cadZero > n * 0.05) anomalies.push(cadZero + ' point(s) en course avec une cadence à 0');
      var cm = mean(cadPts.map(function(p){ return p.cad; }));
      if(cm < 110) anomalies.push('cadence moyenne ' + r0(cm) + ' : probablement exprimée par jambe (à doubler)');
    }
    var pauseMin = 0;
    for(var j = 1; j < n; j++){ var dt = pts[j].t - pts[j - 1].t; if(dt > 0.5 && pts[j].sp < 1) pauseMin += dt; }
    if(pauseMin > 1) anomalies.push('environ ' + r0(pauseMin) + ' min de pause non retirée détectées');
    var hrCover = n ? hrPts.length / n : 0;
    var conf = !hrPts.length ? 'faible' : (hrCover < 0.8 || anomalies.length >= 3) ? 'moyen' : 'élevé';
    return { points: n, duree_min: r1(dur), couverture_fc_pct: r0(hrCover * 100), presentes: present, manquantes: missing, anomalies: anomalies, confiance_globale: conf };
  }

  // Découpage automatique au km (pas de vrais tours montre) : sur une longue
  // sortie ça donne 40+ « blocs » sans structure. On les regroupe en 8 au plus
  // (moyennes pondérées par la durée) : lisible, et dossier plus léger pour l'IA.
  function mergeAutoLaps(laps){
    if(laps.length <= 10) return laps;
    var size = Math.ceil(laps.length / 8), out = [];
    for(var i = 0; i < laps.length; i += size){
      var g = laps.slice(i, i + size), dur = g.reduce(function(a, l){ return a + (l.durMin || 0); }, 0) || 1;
      var w = function(k){ var v = g.filter(function(l){ return l[k]; }); var d = v.reduce(function(a, l){ return a + (l.durMin || 0); }, 0); return d ? v.reduce(function(a, l){ return a + l[k] * (l.durMin || 0); }, 0) / d : 0; };
      out.push({ n: (i + 1) + '-' + Math.min(i + size, laps.length), durMin: dur, dist: g.reduce(function(a, l){ return a + (l.dist || 0); }, 0),
        avgHr: Math.round(w('avgHr')), maxHr: Math.max.apply(null, g.map(function(l){ return l.maxHr || 0; })), avgSpeed: w('avgSpeed'), avgGap: w('avgGap'),
        cad: Math.round(w('cad')), dplus: g.reduce(function(a, l){ return a + (l.dplus || 0); }, 0), avgPower: Math.round(w('avgPower')), hard: g.some(function(l){ return l.hard; }) });
    }
    return out;
  }
  function lapsFacts(data, fcMax, fcRest, zones, disc){
    var laps = data.realLaps ? (data.laps || []) : mergeAutoLaps(data.laps || []);
    var t = 0;
    return laps.slice(0, 40).map(function(l){
      var a = t; t += l.durMin || 0;
      var seg = ptsIn(data.pts || [], a, t), sps = seg.map(function(p){ return p.sp; }).filter(function(x){ return x > 0; });
      var pct = (fcMax && l.avgHr) ? l.avgHr / fcMax * 100 : null;
      var o = {
        bloc: l.n, duree_min: r1(l.durMin), distance_km: l.dist ? Math.round(l.dist * 100) / 100 : null,
        fc_moy: l.avgHr || null, fc_max: l.maxHr || null, pct_fc_max: r0(pct),
        pct_fc_reserve: (fcRest && fcMax && l.avgHr) ? r0((l.avgHr - fcRest) / (fcMax - fcRest) * 100) : null,
        zone_fc: zoneOf(pct, zones),
        regularite_vitesse_cv_pct: (sps.length > 5 && mean(sps)) ? r1(sd(sps) / mean(sps) * 100) : null,
        cadence: l.cad || null, denivele_plus_m: l.dplus || null, serie_intense: !!l.hard
      };
      if(disc === 'run'){ o.allure = paceStr(l.avgSpeed); o.allure_ajustee_pente = paceStr(l.avgGap); }
      else { o.vitesse_kmh = r1(l.avgSpeed); }
      if(l.avgPower) o.puissance_w = l.avgPower;
      return o;
    });
  }

  function hrFacts(data, fcMax, zones){
    var pts = data.pts || [], hrPts = pts.filter(function(p){ return p.hr > 0; });
    if(!hrPts.length || !fcMax) return { disponible: false };
    var tz = {};
    for(var i = 1; i < pts.length; i++){
      if(!(pts[i].hr > 0)) continue;
      var z = zoneOf(pts[i].hr / fcMax * 100, zones), dt = Math.min(pts[i].t - pts[i - 1].t, 0.5);
      if(z && dt > 0) tz[z] = (tz[z] || 0) + dt;
    }
    Object.keys(tz).forEach(function(k){ tz[k] = r1(tz[k]); });
    // Dérive cardiaque : partie stable (hors 10 % de début et de fin),
    // ratio vitesse ajustée pente / FC, 1re moitié vs 2de (Pa:Hr).
    var T = pts[pts.length - 1].t, body = pts.filter(function(p){ return p.t > T * 0.1 && p.t < T * 0.9 && p.hr > 0 && p.gap > 0; });
    var drift = null, steady = null;
    if(body.length > 40){
      var sps = body.map(function(p){ return p.gap; }); steady = r1(sd(sps) / mean(sps) * 100);
      var h = Math.floor(body.length / 2), e1 = mean(body.slice(0, h).map(function(p){ return p.gap / p.hr; })), e2 = mean(body.slice(h).map(function(p){ return p.gap / p.hr; }));
      if(e1) drift = r1((e1 - e2) / e1 * 100);
    }
    // Récupération cardiaque après chaque série intense : baisse de FC 60 s après la fin.
    var recov = [], t0 = 0;
    (data.laps || []).forEach(function(l, idx, arr){
      var end = t0 + (l.durMin || 0); t0 = end;
      if(!l.hard || !arr[idx + 1] || arr[idx + 1].hard) return;
      var atEnd = ptsIn(hrPts, end - 0.1, end + 0.05), after = ptsIn(hrPts, end + 0.9, end + 1.1);
      if(atEnd.length && after.length) recov.push({ apres_bloc: l.n, baisse_fc_60s: r0(mean(atEnd.map(function(p){ return p.hr; })) - mean(after.map(function(p){ return p.hr; }))) });
    });
    return {
      disponible: true, fc_moy: data.avgHr || r0(mean(hrPts.map(function(p){ return p.hr; }))), fc_max_mesuree: data.maxHr || null,
      pct_fc_max_moy: r0((data.avgHr || mean(hrPts.map(function(p){ return p.hr; }))) / fcMax * 100),
      temps_par_zone_min: tz, derive_cardiaque_pct: drift, variabilite_allure_partie_stable_cv_pct: steady,
      derive_interpretable: steady != null && steady < 8, recuperation_entre_series: recov
    };
  }

  function paceFacts(data, disc){
    var pts = (data.pts || []).filter(function(p){ return p.sp > 0; });
    if(pts.length < 20) return { disponible: false };
    var T = pts[pts.length - 1].t, h = T / 2;
    var s1 = mean(ptsIn(pts, 0, h).map(function(p){ return p.sp; })), s2 = mean(ptsIn(pts, h, 1e9).map(function(p){ return p.sp; }));
    var st = mean(ptsIn(pts, 0, T * 0.1).map(function(p){ return p.sp; })), body = mean(ptsIn(pts, T * 0.1, T * 0.9).map(function(p){ return p.sp; }));
    var end = mean(ptsIn(pts, T * 0.9, 1e9).map(function(p){ return p.sp; }));
    var f = function(v){ return disc === 'run' ? paceStr(v) : r1(v) + ' km/h'; };
    return {
      disponible: true, moyenne: f(data.avgSpeed), moyenne_ajustee_pente: disc === 'run' ? paceStr(data.avgGap) : undefined,
      premiere_moitie: f(s1), seconde_moitie: f(s2), split_negatif: s2 > s1,
      ecart_moities_pct: s1 ? r1((s2 - s1) / s1 * 100) : null,
      depart_10pct_vs_corps_pct: body ? r1((st - body) / body * 100) : null,
      fin_10pct_vs_corps_pct: body ? r1((end - body) / body * 100) : null
    };
  }

  function cadenceFacts(data, disc){
    if(disc !== 'run') return { disponible: false, raison: 'cadence de foulée : pertinente en course uniquement' };
    var pts = (data.pts || []).filter(function(p){ return p.cad > 0 && p.sp > 5; });
    if(pts.length < 20) return { disponible: false };
    var raw = mean(pts.map(function(p){ return p.cad; })), k = raw < 110 ? 2 : 1;
    var T = pts[pts.length - 1].t, third = function(a, b){ return r0(mean(ptsIn(pts, a, b).map(function(p){ return p.cad * k; }))); };
    var bySpeed = pts.slice().sort(function(a, b){ return a.sp - b.sp; }), q = Math.floor(bySpeed.length / 4);
    return {
      disponible: true, moyenne_pas_min: r0(raw * k), premier_tiers: third(0, T / 3), dernier_tiers: third(2 * T / 3, 1e9),
      au_quart_le_plus_lent: r0(mean(bySpeed.slice(0, q).map(function(p){ return p.cad * k; }))),
      au_quart_le_plus_rapide: r0(mean(bySpeed.slice(-q).map(function(p){ return p.cad * k; }))),
      note: k === 2 ? 'cadence fournie par jambe, doublée' : undefined
    };
  }

  function elevFacts(data, plannedDplus){
    var pts = (data.pts || []).filter(function(p){ return p.alt; });
    if(pts.length < 20) return { disponible: false };
    var dmoins = 0;
    for(var i = 1; i < pts.length; i++) if(pts[i].alt < pts[i - 1].alt) dmoins += pts[i - 1].alt - pts[i].alt;
    // Montées significatives : gain ≥ 30 m d'un seul tenant.
    var climbs = [], start = 0, low = 0;
    for(var j = 1; j <= pts.length; j++){
      var down = j === pts.length || pts[j].alt < pts[j - 1].alt - 3;
      if(down){
        var gain = pts[j - 1].alt - pts[start].alt, dur = pts[j - 1].t - pts[start].t;
        if(gain >= 30 && dur > 1){
          var seg = pts.slice(start, j), hrs = seg.filter(function(p){ return p.hr > 0; });
          climbs.push({ debut_min: r1(pts[start].t), gain_m: r0(gain), duree_min: r1(dur), vam_m_h: r0(gain / (dur / 60)),
            fc_moy: hrs.length ? r0(mean(hrs.map(function(p){ return p.hr; }))) : null,
            cadence_moy: r0(mean(seg.filter(function(p){ return p.cad > 0; }).map(function(p){ return p.cad; }))) || null });
        }
        start = j;
      }
    }
    var flat = (data.pts || []).filter(function(p){ return Math.abs(p.grade) < 2 && p.hr > 0; });
    return {
      disponible: true, denivele_plus_m: data.dplus || null, denivele_moins_m: r0(dmoins),
      denivele_prevu_m: plannedDplus || NA, montees: climbs.slice(0, 8),
      fc_moy_sur_plat: flat.length ? r0(mean(flat.map(function(p){ return p.hr; }))) : null
    };
  }

  /* ---------------- étape 6 : forme / récupération ---------------- */
  function fatigueFacts(ctx, ref, session){
    var out = { disponible: false };
    if(!ctx) return out;
    var ck = (ctx.checkins || []).slice().sort(function(a, b){ return a.date < b.date ? 1 : -1; });
    var dm = (ctx.daily || []).slice().sort(function(a, b){ return a.day < b.day ? 1 : -1; });
    var days = function(arr, key, n){ return arr.slice(0, n).map(function(x){ return x[key]; }).filter(function(v){ return v != null && v !== ''; }).map(Number); };
    var hrvAll = dm.length ? days(dm, 'hrv_avg', 28) : days(ck, 'hrv', 28);
    var rhrAll = days(dm, 'resting_hr', 28);
    out = {
      disponible: !!(ck.length || dm.length),
      hrv_du_jour: hrvAll.length ? hrvAll[0] : NA,
      hrv_moy_7j: hrvAll.length ? r0(mean(hrvAll.slice(0, 7))) : NA,
      hrv_moy_28j: hrvAll.length ? r0(mean(hrvAll)) : NA,
      hrv_reference: ref && ref.hrvBase ? ref.hrvBase : NA,
      fc_repos_du_jour: rhrAll.length ? rhrAll[0] : NA,
      fc_repos_moy_7j: rhrAll.length ? r0(mean(rhrAll.slice(0, 7))) : NA,
      fc_repos_reference: ref && ref.fcRepos ? ref.fcRepos : NA,
      sommeil_7j: ck.slice(0, 7).map(function(c){ return c.sommeil; }).filter(function(v){ return v != null; }),
      fatigue_declaree_7j: ck.slice(0, 7).map(function(c){ return c.fatigue; }).filter(function(v){ return v != null; }),
      echelle_checkin: 'sommeil, fatigue et motivation notés de 1 à 10 par l\'athlète',
      rpe_de_la_seance: session.rpe != null ? session.rpe : NA,
      douleur_ou_dispo: ck[0] && ck[0].dispo && ck[0].dispo !== 'ok' ? (ck[0].dispo + (ck[0].dispo_note ? ' : ' + String(ck[0].dispo_note).slice(0, 160) : '')) : 'rien de déclaré',
      charge: ctx.load || NA
    };
    // Cycle menstruel : UNIQUEMENT s'il a été renseigné par l'athlète.
    var cyc = ck.find(function(c){ return c.cycle_phase || c.cycle_day; });
    if(cyc) out.cycle = { phase: cyc.cycle_phase || NA, jour: cyc.cycle_day || NA, date: cyc.date };
    return out;
  }

  function buildDossier(o){
    var s = o.session, data = o.data, ref = o.ref || {}, zones = o.zones || [];
    var fcMax = ref.fcMax || null, fcRest = ref.fcRepos || null, disc = data.disc || s.disc;
    var prof = o.profile || {};
    var age = prof.birth_year ? (new Date().getFullYear() - prof.birth_year) : null;
    return {
      profil: {
        sexe: prof.sex === 'F' ? 'femme' : prof.sex === 'M' ? 'homme' : prof.sex === 'X' ? 'non précisé' : NA,
        age: age || NA, fc_max: fcMax || NA, fc_repos: fcRest || NA,
        zones_fc_pct_fc_max: zones.map(function(z){ return z[0] + ' : ' + z[1] + '-' + z[2] + ' %'; }),
        seuils: { vma_kmh: ref.vma || NA, allure_seuil_s_km: ref.seuilRun || NA, ftp_w: ref.ftp || NA },
        objectif: o.goal || NA
      },
      seance_prevue: simplifyPlan(s),
      verification: dataCheck(data, fcMax, disc),
      blocs_realises: lapsFacts(data, fcMax, fcRest, zones, disc),
      realise_global: { duree_min: r1((data.pts || []).length ? data.pts[data.pts.length - 1].t : null), distance_km: r1(data.dist), discipline: disc },
      frequence_cardiaque: hrFacts(data, fcMax, zones),
      allure: paceFacts(data, disc),
      cadence: cadenceFacts(data, disc),
      denivele: elevFacts(data, s.dplus || null),
      forme: fatigueFacts(o.context, ref, s)
    };
  }

  /* ---------------- rendu ---------------- */
  var CSS = ''
    + '#silReport{z-index:10000}'
    + '#silReport .modal{max-width:780px}'
    + '#silReport h3{padding-right:40px}'
    + '.rp-sec{border-top:1px solid var(--line);padding-top:14px;margin-top:16px}'
    + '.rp-sec h4{font-size:var(--fs-sm,13px);letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 8px}'
    + '.rp-k{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:10px 0 4px}'
    + '.rp-list{margin:0;padding-left:18px;line-height:1.55;font-size:var(--fs-base,14px)}'
    + '.rp-conf{display:inline-block;font-size:11px;border:1px solid var(--line-strong);border-radius:99px;padding:2px 9px;color:var(--muted);margin-left:8px;vertical-align:middle}'
    + '.rp-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}'
    + '.rp-tbl th,.rp-tbl td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}'
    + '.rp-tbl th{color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em}'
    + '.rp-wrap{overflow-x:auto}'
    + '.rp-fat{display:inline-flex;align-items:center;gap:8px;font-weight:800;border-radius:99px;padding:5px 12px;border:1px solid}'
    + '.rp-note{font-size:12px;color:var(--muted);margin-top:14px;line-height:1.5}'
    + '.rp-load{display:flex;align-items:center;gap:10px;color:var(--muted)}';

  var lastFocus = null;
  function ensure(){
    var ov = document.getElementById('silReport');
    if(ov) return ov;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'silReport';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'silReportT');
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target === ov || e.target.closest('[data-rp-close]')) close(); });
    ov.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ e.stopPropagation(); close(); } });
    return ov;
  }
  function frame(inner, sub){
    var ov = ensure();
    ov.innerHTML = '<div class="modal">'
      + '<button class="close" data-rp-close aria-label="' + esc(t('rep.close')) + '"><i class="ic ic-x"></i></button>'
      + '<h3 id="silReportT">' + esc(t('rep.title')) + '</h3>' + (sub ? '<p class="club-hint" style="margin-top:-6px">' + esc(sub) + '</p>' : '')
      + inner
      + '<p class="rp-note">' + esc(t('rep.disclaimer')) + '</p>'
      + '<button class="btn" data-rp-close style="width:100%;margin-top:14px">' + esc(t('rep.close')) + '</button></div>';
    if(!ov.classList.contains('open')){ lastFocus = document.activeElement; ov.classList.add('open'); }
    var b = ov.querySelector('.btn'); if(b) b.focus();
  }
  function close(){
    var ov = document.getElementById('silReport'); if(!ov) return;
    ov.classList.remove('open');
    if(lastFocus && lastFocus.focus) try{ lastFocus.focus(); }catch(e){}
  }
  function list(arr){ arr = (arr || []).filter(Boolean); return arr.length ? '<ul class="rp-list">' + arr.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
  function mi(sec){
    if(!sec) return '';
    return (sec.mesure && sec.mesure.length ? '<div class="rp-k">' + esc(t('rep.measured')) + '</div>' + list(sec.mesure) : '')
      + (sec.interpretation && sec.interpretation.length ? '<div class="rp-k">' + esc(t('rep.interpreted')) + '</div>' + list(sec.interpretation) : '');
  }
  function conf(c){ return c ? '<span class="rp-conf">' + esc(t('rep.confidence')) + ' : ' + esc(c) + '</span>' : ''; }
  function section(key, body, c){ return body ? '<div class="rp-sec"><h4>' + esc(t(key)) + conf(c) + '</h4>' + body + '</div>' : ''; }

  function renderReport(r){
    var v = r.verification || {}, pv = r.prevu_vs_realise || {}, f = r.fatigue || {}, sy = r.synthese || {};
    var fatMeta = { vert: ['var(--good)', '🟢 ' + t('rep.fresh')], jaune: ['var(--bike)', '🟡 ' + t('rep.moderate')], rouge: ['var(--run)', '🔴 ' + t('rep.high')] }[f.indice] || null;
    var rows = (pv.blocs || []).map(function(b){
      return '<tr><td>' + esc(b.bloc) + '</td><td>' + esc(b.prevu) + '</td><td>' + esc(b.realise) + '</td><td>' + esc(b.ecart) + '</td><td>' + esc(b.verdict) + '</td></tr>';
    }).join('');
    return section('rep.s7',
        (sy.resume ? '<p style="line-height:1.55;font-size:15px">' + esc(sy.resume) + '</p>' : '')
        + (sy.positifs && sy.positifs.length ? '<div class="rp-k">' + esc(t('rep.positives')) + '</div>' + list(sy.positifs) : '')
        + (sy.attention && sy.attention.length ? '<div class="rp-k">' + esc(t('rep.attention')) + '</div>' + list(sy.attention) : '')
        + (sy.recommandations && sy.recommandations.length ? '<div class="rp-k">' + esc(t('rep.recos')) + '</div>' + list(sy.recommandations) : '')
        + (sy.alertes && sy.alertes.length ? '<div class="rp-k" style="color:var(--run)">' + esc(t('rep.alerts')) + '</div>' + list(sy.alertes) : ''))
      + section('rep.s0',
        (v.presentes && v.presentes.length ? '<div class="rp-k">' + esc(t('rep.present')) + '</div>' + list(v.presentes) : '')
        + (v.manquantes && v.manquantes.length ? '<div class="rp-k">' + esc(t('rep.missing')) + '</div>' + list(v.manquantes) : '')
        + (v.anomalies && v.anomalies.length ? '<div class="rp-k">' + esc(t('rep.anomalies')) + '</div>' + list(v.anomalies) : ''), v.confiance)
      + section('rep.s1',
        (rows ? '<div class="rp-wrap"><table class="rp-tbl"><thead><tr><th>' + esc(t('rep.colBlock')) + '</th><th>' + esc(t('rep.colPlan')) + '</th><th>' + esc(t('rep.colDone')) + '</th><th>' + esc(t('rep.colGap')) + '</th><th>' + esc(t('rep.colVerdict')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '')
        + (pv.taux_respect ? '<div class="rp-k">' + esc(t('rep.respect')) + '</div><p>' + esc(pv.taux_respect) + '</p>' : '')
        + (pv.explication ? '<p style="line-height:1.5">' + esc(pv.explication) + '</p>' : ''), pv.confiance)
      + section('rep.s2', mi(r.frequence_cardiaque), (r.frequence_cardiaque || {}).confiance)
      + section('rep.s3', mi(r.allure), (r.allure || {}).confiance)
      + section('rep.s4', mi(r.cadence), (r.cadence || {}).confiance)
      + section('rep.s5', mi(r.denivele), (r.denivele || {}).confiance)
      + section('rep.s6',
        (fatMeta ? '<span class="rp-fat" style="color:' + fatMeta[0] + ';border-color:' + fatMeta[0] + '">' + esc(fatMeta[1]) + '</span>' : '')
        + mi(f), f.confiance);
  }

  // Sans IA (démo, ou pas d'add-on) : les indicateurs calculés, sans interprétation.
  function factsOnly(d){
    var lines = function(obj){
      return Object.keys(obj || {}).filter(function(k){ return k !== 'disponible' && obj[k] != null && obj[k] !== '' && typeof obj[k] !== 'object'; })
        .map(function(k){ var v = obj[k] === true ? 'oui' : obj[k] === false ? 'non' : obj[k]; return k.replace(/_/g, ' ') + ' : ' + v; });
    };
    return {
      verification: { presentes: d.verification.presentes, manquantes: d.verification.manquantes, anomalies: d.verification.anomalies, confiance: d.verification.confiance_globale },
      prevu_vs_realise: { explication: d.blocs_realises.length && !d.verification.presentes.some(function(x){ return /tours réels de la montre/.test(x); }) ? 'Pas de tours réels : découpage automatique regroupé en ' + d.blocs_realises.length + ' blocs.' : '', blocs: d.blocs_realises.map(function(b){ return { bloc: b.bloc, prevu: '-', realise: [b.duree_min && b.duree_min + ' min', b.allure || (b.vitesse_kmh && b.vitesse_kmh + ' km/h'), b.fc_moy && b.fc_moy + ' bpm', b.zone_fc].filter(Boolean).join(' · '), ecart: '-', verdict: '-' }; }) },
      frequence_cardiaque: { mesure: lines(d.frequence_cardiaque) },
      allure: { mesure: lines(d.allure) }, cadence: { mesure: lines(d.cadence) }, denivele: { mesure: lines(d.denivele) },
      fatigue: { mesure: lines(d.forme) }, synthese: { resume: t('rep.demo') }
    };
  }

  async function open(o){
    if(!o || !o.data || !(o.data.pts || []).length){ frame('<p>' + esc(t('rep.noFile')) + '</p>'); return; }
    frame('<p class="rp-load"><span class="ai-dot"></span> ' + esc(t('rep.loading')) + '</p>', o.session.title);
    var PF = window.PF, real = !!(PF && PF.user);
    var context = null, profile = {};
    if(real && PF.getReportContext){
      try{ var c = await PF.getReportContext(o.athleteId || PF.user.id); context = c; profile = (c && c.profile) || {}; }catch(e){ console.warn('[report] contexte :', e); }
    }
    if(context) context.load = o.load || null; else context = { load: o.load || null };
    var dossier = buildDossier({ session: o.session, data: o.data, ref: o.ref, zones: o.zones, goal: o.goal, context: context, profile: profile });
    if(!(real && window.__pf_aiAddon === true && PF.sessionReport)){
      frame(renderReport(factsOnly(dossier)), o.session.title); return;
    }
    var key = 'r1|' + String(o.session.id || (o.session.title + '|' + (o.session.dur || '')));
    var r = await PF.sessionReport({ session_key: key, athlete_id: o.athleteId || null, dossier: dossier });
    if(r && r.error){
      close();
      if(window.SilAiPopup) window.SilAiPopup.showError({ kind: 'report', detail: r.detail || r.error });
      return;
    }
    frame(renderReport(r.report || {}), o.session.title);
  }

  window.SilAiReport = { open: open, buildDossier: buildDossier, close: close };
})();
