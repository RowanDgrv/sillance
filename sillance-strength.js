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
    fr: {
      logTitle: 'Mes séries', logSub: 'Pré-rempli avec ce que ton coach a prévu : corrige ce que tu as vraiment fait.', planned: 'Prévu : {txt}',
      set: 'Série {n}', reps: 'rép.', kg: 'kg', addSet: '+ série', delSet: '− série', save: 'Enregistrer mes séries', saved: 'Séries enregistrées', saveErr: 'Séries non enregistrées : vérifie ta connexion.',
      cmpTitle: 'Prévu / réalisé', verdict_validee: 'Conforme', verdict_partielle: 'En partie conforme', verdict_non_conforme: 'Non conforme',
      loadLow: 'charge en dessous ({pct} %)', loadHigh: 'charge au-dessus (+{pct} %)', setsMissing: '{done}/{planned} séries', repsLow: 'répétitions en dessous ({done}/{planned})',
      goalShift: 'objectif décalé : {from} → {to}', ok: 'conforme', notDone: 'non fait', openLog: 'Saisir mes séries', editLog: 'Modifier mes séries',
      close: 'Fermer', noPlan: 'Cette séance n\'a pas d\'exercice en répétitions à saisir.',
      force: 'Force', hyper: 'Hypertrophie', endu: 'Endurance musculaire', power: 'Puissance', iso: 'Gainage / isométrie', light: 'Léger / technique',
      title: 'Répartition muscu', sets: '{n} séries', tonnage: 'Tonnage {kg} kg', other: 'Autre',
      unknown: '{n} exercice(s) hors catalogue : groupe musculaire non reconnu.',
      lightWarn: '{n} série(s) à RPE 5 ou moins : trop loin de l\'échec pour un vrai stimulus.',
      dominant: 'Dominante : {goal}', empty: 'Ajoute des exercices en répétitions pour voir le profil.',
      rule: 'Classement : 1-5 répétitions = force, 6-12 = hypertrophie, 13 et plus = endurance ; RPE 5 ou moins = léger.' },
    en: {
      logTitle: 'My sets', logSub: 'Pre-filled with your coach\'s plan: correct what you actually did.', planned: 'Planned: {txt}',
      set: 'Set {n}', reps: 'reps', kg: 'kg', addSet: '+ set', delSet: '− set', save: 'Save my sets', saved: 'Sets saved', saveErr: 'Sets not saved: check your connection.',
      cmpTitle: 'Planned / done', verdict_validee: 'As planned', verdict_partielle: 'Partly as planned', verdict_non_conforme: 'Not as planned',
      loadLow: 'load below ({pct} %)', loadHigh: 'load above (+{pct} %)', setsMissing: '{done}/{planned} sets', repsLow: 'reps below ({done}/{planned})',
      goalShift: 'goal shifted: {from} → {to}', ok: 'as planned', notDone: 'not done', openLog: 'Log my sets', editLog: 'Edit my sets',
      close: 'Close', noPlan: 'This session has no rep-based exercise to log.',
      force: 'Strength', hyper: 'Hypertrophy', endu: 'Muscular endurance', power: 'Power', iso: 'Core / isometric', light: 'Light / technique',
      title: 'Strength breakdown', sets: '{n} sets', tonnage: 'Tonnage {kg} kg', other: 'Other',
      unknown: '{n} exercise(s) not in the catalogue: muscle group not recognised.',
      lightWarn: '{n} set(s) at RPE 5 or below: too far from failure for a real stimulus.',
      dominant: 'Main focus: {goal}', empty: 'Add rep-based exercises to see the profile.',
      rule: 'Rule: 1-5 reps = strength, 6-12 = hypertrophy, 13+ = endurance; RPE 5 or below = light.' },
    es: {
      logTitle: 'Mis series', logSub: 'Pre-rellenado con lo que tu entrenador previó: corrige lo que hiciste realmente.', planned: 'Previsto: {txt}',
      set: 'Serie {n}', reps: 'rep.', kg: 'kg', addSet: '+ serie', delSet: '− serie', save: 'Guardar mis series', saved: 'Series guardadas', saveErr: 'Series no guardadas: revisa tu conexión.',
      cmpTitle: 'Previsto / realizado', verdict_validee: 'Conforme', verdict_partielle: 'En parte conforme', verdict_non_conforme: 'No conforme',
      loadLow: 'carga por debajo ({pct} %)', loadHigh: 'carga por encima (+{pct} %)', setsMissing: '{done}/{planned} series', repsLow: 'repeticiones por debajo ({done}/{planned})',
      goalShift: 'objetivo desplazado: {from} → {to}', ok: 'conforme', notDone: 'no hecho', openLog: 'Registrar mis series', editLog: 'Editar mis series',
      close: 'Cerrar', noPlan: 'Esta sesión no tiene ejercicios por repeticiones que registrar.',
      force: 'Fuerza', hyper: 'Hipertrofia', endu: 'Resistencia muscular', power: 'Potencia', iso: 'Core / isometría', light: 'Ligero / técnica',
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

  /* ---------- 2. Carnet : séries réellement faites ---------- */
  // Exercices en répétitions du plan, dans l'ordre, avec une clé stable
  // (bloc/ligne) pour retrouver la saisie même si le titre change.
  function plannedExercises(blocks){
    var out = [];
    (blocks || []).forEach(function(b, bi){
      var series = Math.max(1, Number(b.series) || 1);
      (b.lines || []).forEach(function(l, li){
        if(l.metric !== 'reps') return;
        out.push({ key: 'b' + bi + 'l' + li, exercise: String(l.exercise || '').trim() || '—',
          planned: { sets: series, reps: Number(l.reps) || 0, weight: Number(l.weight) || 0, rpe: l.rpe != null ? Number(l.rpe) : null } });
      });
    });
    return out;
  }
  function plannedTxt(p){ return p.sets + ' × ' + p.reps + (p.weight ? ' @ ' + p.weight + ' kg' : ''); }

  /* Comparaison prévu / réalisé, exercice par exercice.
     ok : toutes les séries, ≥ 90 % des répétitions, charge ≥ 95 % du prévu.
     mauvais : < 50 % des séries ou < 60 % des répétitions.
     Verdict séance pondéré par les séries prévues : ≥ 80 % conforme,
     ≥ 60 % en partie, sinon non conforme (mêmes seuils que la course). */
  function compare(blocks, log){
    var plan = plannedExercises(blocks), byKey = {};
    ((log && log.exercises) || []).forEach(function(e){ byKey[e.key] = e; });
    var lines = [], issues = [], wTot = 0, wOk = 0;
    plan.forEach(function(p){
      var e = byKey[p.key], sets = ((e && e.sets) || []).filter(function(x){ return (Number(x.reps) || 0) > 0; });
      var P = p.planned, label = p.exercise + ' (' + plannedTxt(P) + ')';
      wTot += P.sets;
      if(!sets.length){ lines.push({ status: 'bad', text: label + ' : ' + t('notDone') }); issues.push({ texte: p.exercise + ' : ' + t('notDone'), majeur: true }); return; }
      var repsDone = sets.reduce(function(a, x){ return a + (Number(x.reps) || 0); }, 0), repsPlan = P.sets * P.reps;
      var kgs = sets.map(function(x){ return Number(x.kg) || 0; }).filter(function(v){ return v > 0; });
      var kgAvg = kgs.length ? kgs.reduce(function(a, v){ return a + v; }, 0) / kgs.length : 0;
      var notes = [], score = 1;
      if(sets.length < P.sets){ notes.push(t('setsMissing', { done: sets.length, planned: P.sets })); score = Math.min(score, sets.length / P.sets); }
      if(repsPlan && repsDone < repsPlan * 0.9){ notes.push(t('repsLow', { done: repsDone, planned: repsPlan })); score = Math.min(score, repsDone / repsPlan); }
      if(P.weight > 0 && kgAvg > 0){
        var d = (kgAvg - P.weight) / P.weight;
        if(d < -0.05){ notes.push(t('loadLow', { pct: Math.round(d * 100) })); score = Math.min(score, d < -0.2 ? 0.5 : 0.7); }
        else if(d > 0.1) notes.push(t('loadHigh', { pct: Math.round(d * 100) }));
      }
      var avgReps = repsDone / sets.length;
      var g0 = goalOf(P.reps, P.rpe, null, 'reps'), g1 = goalOf(Math.round(avgReps), P.rpe, null, 'reps');
      if(g0 !== g1 && g0 !== 'light') notes.push(t('goalShift', { from: t(g0), to: t(g1) }));
      var st = score >= 0.9 ? 'ok' : score >= 0.6 ? 'partial' : 'bad';
      if(st === 'ok') wOk += P.sets; else if(st === 'partial') wOk += P.sets * 0.6;
      lines.push({ status: st, text: label + ' : ' + (notes.length ? notes.join(' · ') : t('ok')) + ' — ' + sets.map(function(x){ return x.reps + (x.kg ? '×' + x.kg : ''); }).join(', ') });
      if(st !== 'ok') issues.push({ texte: p.exercise + ' : ' + notes.join(', '), majeur: st === 'bad' });
    });
    var r = wTot ? wOk / wTot : null;
    return { verdict: r == null ? null : r >= 0.8 ? 'validee' : r >= 0.6 ? 'partielle' : 'non_conforme', lignes: lines, constats: issues };
  }
  function renderCompare(blocks, log){
    var c = compare(blocks, log); if(!c.lignes.length) return '';
    var V = { validee: 'var(--good)', partielle: 'var(--bike)', non_conforme: 'var(--run)' }[c.verdict] || 'var(--muted)';
    var dot = { ok: 'var(--good)', partial: 'var(--bike)', bad: 'var(--run)' };
    return '<div class="stp"><div class="stp-head"><b>' + esc(t('cmpTitle')) + '</b>'
      + (c.verdict ? '<span style="color:' + V + ';font-weight:800">' + esc(t('verdict_' + c.verdict)) + '</span>' : '') + '</div>'
      + '<ul class="stc">' + c.lignes.map(function(l){ return '<li><i style="background:' + (dot[l.status] || 'var(--muted)') + '"></i><span>' + esc(l.text) + '</span></li>'; }).join('') + '</ul></div>';
  }

  /* Fenêtre de saisie. opts : { session, onSave(log) → Promise } */
  function openLogger(opts){
    var s = opts.session, blocks = (s.blocksV2 && s.blocksV2.blocks) || [];
    var plan = plannedExercises(blocks);
    var prev = {}; ((s.strengthLog && s.strengthLog.exercises) || []).forEach(function(e){ prev[e.key] = e; });
    var state = plan.map(function(p){
      var old = prev[p.key];
      var sets = old && old.sets && old.sets.length ? old.sets.map(function(x){ return { reps: x.reps, kg: x.kg }; })
        : Array.apply(null, Array(p.planned.sets)).map(function(){ return { reps: p.planned.reps, kg: p.planned.weight || 0 }; });
      return { key: p.key, exercise: p.exercise, planned: p.planned, sets: sets };
    });
    var el = document.createElement('div'); el.className = 'adh-overlay';
    function render(){
      el.innerHTML = '<div class="adh-modal stl-modal" role="dialog" aria-label="' + esc(t('logTitle')) + '">'
        + '<button class="adh-close" aria-label="' + esc(t('close')) + '">✕</button>'
        + '<h3>' + esc(t('logTitle')) + ' · ' + esc(s.title || '') + '</h3><p class="adh-sub">' + esc(t('logSub')) + '</p>'
        + (state.length ? state.map(function(e, ei){
            return '<div class="stl-ex"><div class="stl-name"><b>' + esc(e.exercise) + '</b><span>' + esc(t('planned', { txt: plannedTxt(e.planned) })) + '</span></div>'
              + e.sets.map(function(x, si){
                return '<div class="stl-set"><span>' + esc(t('set', { n: si + 1 })) + '</span>'
                  + '<label><input type="number" inputmode="numeric" min="0" max="200" value="' + (x.reps || 0) + '" data-e="' + ei + '" data-s="' + si + '" data-f="reps"> ' + esc(t('reps')) + '</label>'
                  + '<label><input type="number" inputmode="decimal" min="0" max="500" step="0.5" value="' + (x.kg || 0) + '" data-e="' + ei + '" data-s="' + si + '" data-f="kg"> ' + esc(t('kg')) + '</label></div>';
              }).join('')
              + '<div class="stl-tools"><button type="button" data-add="' + ei + '">' + esc(t('addSet')) + '</button>'
              + (e.sets.length ? '<button type="button" data-del="' + ei + '">' + esc(t('delSet')) + '</button>' : '') + '</div></div>';
          }).join('') : '<p class="adh-sub">' + esc(t('noPlan')) + '</p>')
        + (state.length ? '<button class="btn asg-go" id="stlSave">' + esc(t('save')) + '</button>' : '')
        + '</div>';
      el.querySelector('.adh-close').onclick = close;
      el.querySelectorAll('input[data-e]').forEach(function(inp){ inp.onchange = inp.oninput = function(){ state[+inp.dataset.e].sets[+inp.dataset.s][inp.dataset.f] = Number(inp.value) || 0; }; });
      el.querySelectorAll('[data-add]').forEach(function(b){ b.onclick = function(){ var e = state[+b.dataset.add], last = e.sets[e.sets.length - 1] || { reps: e.planned.reps, kg: e.planned.weight }; e.sets.push({ reps: last.reps, kg: last.kg }); render(); }; });
      el.querySelectorAll('[data-del]').forEach(function(b){ b.onclick = function(){ state[+b.dataset.del].sets.pop(); render(); }; });
      var sv = el.querySelector('#stlSave');
      if(sv) sv.onclick = function(){
        sv.disabled = true;
        var log = { saved_at: new Date().toISOString(), exercises: state.map(function(e){ return { key: e.key, exercise: e.exercise, planned: e.planned, sets: e.sets }; }) };
        Promise.resolve(opts.onSave(log)).then(function(){ if(window.toast) window.toast(t('saved')); close(); })
          .catch(function(err){ console.warn('[muscu] saveStrengthLog', err); sv.disabled = false; if(window.toast) window.toast(t('saveErr'), 'error'); });
      };
    }
    function close(){ el.classList.remove('open'); setTimeout(function(){ el.remove(); }, 180); }
    el.addEventListener('click', function(e){ if(e.target === el) close(); });
    render(); document.body.appendChild(el);
    requestAnimationFrame(function(){ el.classList.add('open'); });
  }

  window.SilStrength = { analyze: analyze, renderPlan: renderPlan, goalOf: goalOf, t: t, COLORS: COLORS,
    plannedExercises: plannedExercises, compare: compare, renderCompare: renderCompare, openLogger: openLogger };
})();
