/* ============================================================
   Sillance — analyse des séances de musculation (30/10/2026)
   ------------------------------------------------------------
   Règles de code (pas d'IA), à partir des lignes du constructeur
   (séries du bloc × répétitions × charge × RPE) :
     - 1 à 5 répétitions            → Force
     - 6 à 12 répétitions           → Hypertrophie
     - 13 répétitions et plus       → Endurance musculaire
     - exercice explosif (pliométrie, power clean…) → Puissance
     - ligne en temps (gainage, chaise…) → Gainage / isométrie
     - RPE ≤ 5 (≥ 5 répétitions en réserve) → Léger / technique :
       trop loin de l'échec pour un vrai stimulus, quelle que soit
       la fourchette.
   Repère scientifique : la force maximale progresse surtout avec
   des charges lourdes ; la prise de muscle est similaire de 6 à
   30 répétitions À CONDITION d'aller proche de l'échec
   (Schoenfeld et al. 2017, méta-analyse de 21 études). D'où le
   rôle du RPE dans le classement.

   API :
     SilStrength.analyze(blocks) → { sets, byGoal, byGroup, tonnage,
       unknown, light, lines:[{exercise, sets, reps, weight, rpe, goal, group}] }
     SilStrength.compare(blocks, log) → contrôle prévu / réalisé (2e étape)
     SilStrength.renderPlan(blocks) → HTML du profil de séance
   ============================================================ */
(function(){
  'use strict';
  var I18N = {
    fr: { force: 'Force', hyper: 'Hypertrophie', endu: 'Endurance musculaire', power: 'Puissance', iso: 'Gainage / isométrie', light: 'Léger / technique',
      title: 'Répartition muscu', sets: '{n} séries', tonnage: 'Tonnage {kg} kg', other: 'Autre',
      unknown: '{n} exercice(s) hors catalogue : groupe musculaire non reconnu.',
      lightWarn: '{n} série(s) à RPE 5 ou moins : trop loin de l\'échec pour un vrai stimulus.',
      dominant: 'Dominante : {goal}', empty: 'Ajoute des exercices en répétitions pour voir le profil.',
      rule: 'Classement : 1-5 répétitions = force, 6-12 = hypertrophie, 13 et plus = endurance ; RPE 5 ou moins = léger.' },
    en: { force: 'Strength', hyper: 'Hypertrophy', endu: 'Muscular endurance', power: 'Power', iso: 'Core / isometric', light: 'Light / technique',
      title: 'Strength breakdown', sets: '{n} sets', tonnage: 'Tonnage {kg} kg', other: 'Other',
      unknown: '{n} exercise(s) not in the catalogue: muscle group not recognised.',
      lightWarn: '{n} set(s) at RPE 5 or below: too far from failure for a real stimulus.',
      dominant: 'Main focus: {goal}', empty: 'Add rep-based exercises to see the profile.',
      rule: 'Rule: 1-5 reps = strength, 6-12 = hypertrophy, 13+ = endurance; RPE 5 or below = light.' },
    es: { force: 'Fuerza', hyper: 'Hipertrofia', endu: 'Resistencia muscular', power: 'Potencia', iso: 'Core / isometría', light: 'Ligero / técnica',
      title: 'Reparto de fuerza', sets: '{n} series', tonnage: 'Tonelaje {kg} kg', other: 'Otro',
      unknown: '{n} ejercicio(s) fuera del catálogo: grupo muscular no reconocido.',
      lightWarn: '{n} serie(s) a RPE 5 o menos: demasiado lejos del fallo para un estímulo real.',
      dominant: 'Predominante: {goal}', empty: 'Añade ejercicios por repeticiones para ver el perfil.',
      rule: 'Regla: 1-5 reps = fuerza, 6-12 = hipertrofia, 13 o más = resistencia; RPE 5 o menos = ligero.' }
  };
  function lang(){ var l = window.SilI18n && window.SilI18n.getLang ? window.SilI18n.getLang() : 'fr'; return I18N[l] ? l : 'fr'; }
  function t(k, v){ var s = I18N[lang()][k] || I18N.fr[k] || k; if(v) Object.keys(v).forEach(function(x){ s = s.replace('{' + x + '}', v[x]); }); return s; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var GOALS = ['force', 'hyper', 'endu', 'power', 'iso', 'light'];
  var COLORS = { force: '#FF5470', hyper: '#FFB13D', endu: '#39E6A3', power: '#9D7BFF', iso: '#2FD9FF', light: '#8a949e' };

  function goalOf(reps, rpe, group, metric){
    if(metric === 'time') return 'iso';
    if(group === 'power') return 'power';
    if(rpe != null && rpe > 0 && rpe <= 5) return 'light';
    if(reps <= 5) return 'force';
    if(reps <= 12) return 'hyper';
    return 'endu';
  }

  function analyze(blocks){
    var out = { sets: 0, byGoal: {}, byGroup: {}, tonnage: 0, unknown: 0, light: 0, lines: [] };
    var seenUnknown = {};
    (blocks || []).forEach(function(b){
      var series = Math.max(1, Number(b.series) || 1);
      (b.lines || []).forEach(function(l){
        var isReps = l.metric === 'reps';
        var isTimed = l.metric === 'time' && l.exercise;
        if(!isReps && !isTimed) return;               // repos, échauffement en temps sans exercice
        if(l.type === 'recov' || l.type === 'warmup' || l.type === 'cooldown') { if(!l.exercise) return; }
        var name = String(l.exercise || '').trim();
        var group = window.SilExercises && window.SilExercises.groupOf ? window.SilExercises.groupOf(name) : null;
        if(!group){ if(name && !seenUnknown[name.toLowerCase()]){ seenUnknown[name.toLowerCase()] = 1; out.unknown++; } }
        var reps = Number(l.reps) || 0, weight = Number(l.weight) || 0, rpe = l.rpe != null ? Number(l.rpe) : null;
        var goal = goalOf(reps, rpe, group, isReps ? 'reps' : 'time');
        out.sets += series;
        out.byGoal[goal] = (out.byGoal[goal] || 0) + series;
        var gk = group || 'other';
        out.byGroup[gk] = (out.byGroup[gk] || 0) + series;
        if(isReps) out.tonnage += series * reps * weight;
        if(goal === 'light') out.light += series;
        out.lines.push({ exercise: name, sets: series, reps: reps, weight: weight, rpe: rpe, goal: goal, group: group });
      });
    });
    return out;
  }

  function renderPlan(blocks){
    var a = analyze(blocks);
    if(!a.sets) return '<div class="stp-empty">' + esc(t('empty')) + '</div>';
    var order = GOALS.filter(function(g){ return a.byGoal[g]; });
    var dom = order.slice().sort(function(x, y){ return a.byGoal[y] - a.byGoal[x]; })[0];
    var bar = order.map(function(g){ return '<i style="width:' + (a.byGoal[g] / a.sets * 100).toFixed(1) + '%;background:' + COLORS[g] + '" title="' + esc(t(g)) + '"></i>'; }).join('');
    var legend = order.map(function(g){ return '<span><b style="background:' + COLORS[g] + '"></b>' + esc(t(g)) + ' ' + Math.round(a.byGoal[g] / a.sets * 100) + ' %</span>'; }).join('');
    var groups = Object.keys(a.byGroup).sort(function(x, y){ return a.byGroup[y] - a.byGroup[x]; }).map(function(k){
      var lbl = k === 'other' ? t('other') : (window.SilExercises.groupLabel(k) || k);
      return '<span class="stp-chip">' + esc(lbl) + ' · ' + a.byGroup[k] + '</span>';
    }).join('');
    var warn = [];
    if(a.light) warn.push(t('lightWarn', { n: a.light }));
    if(a.unknown) warn.push(t('unknown', { n: a.unknown }));
    return '<div class="stp">'
      + '<div class="stp-head"><b>' + esc(t('title')) + '</b><span>' + esc(t('sets', { n: a.sets })) + (a.tonnage ? ' · ' + esc(t('tonnage', { kg: Math.round(a.tonnage).toLocaleString('fr-FR') })) : '') + '</span></div>'
      + '<div class="stp-bar">' + bar + '</div>'
      + '<div class="stp-legend">' + legend + '</div>'
      + '<div class="stp-dom">' + esc(t('dominant', { goal: t(dom) })) + '</div>'
      + '<div class="stp-groups">' + groups + '</div>'
      + (warn.length ? '<div class="stp-warn">' + warn.map(esc).join('<br>') + '</div>' : '')
      + '<div class="stp-rule">' + esc(t('rule')) + '</div>'
      + '</div>';
  }

  window.SilStrength = { analyze: analyze, renderPlan: renderPlan, goalOf: goalOf, t: t, COLORS: COLORS };
})();
