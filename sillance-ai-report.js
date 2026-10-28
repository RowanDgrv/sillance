/* ============================================================
   Sillance — Rapport de séance (Assistant IA, 28/10/2026)
   ------------------------------------------------------------
   Version ALLÉGÉE (demande de Rowan, même jour) : pour limiter les tokens
   consommés chez Groq, le rapport se limite à 3 axes :
     1. l'allure / vitesse par rapport aux ZONES DE VITESSE de l'athlète
        (course : % de VMA, modèle « vma » des zones, éventuellement
        personnalisées par le coach) ;
     2. la FC par rapport à la FC MAX et aux zones de FC ;
     3. le RPE déclaré, comparé à l'effort attendu pour la zone atteinte.
   Principe inchangé : TOUS les chiffres sont calculés ici ; l'IA
   (edge function session-report) ne fait que rédiger. Le dossier ne
   contient ni nom, ni e-mail, ni identifiant.

   API : SilAiReport.open({ session, data, ref, zones, speedZones, athleteId })
   ============================================================ */
(function(){
  'use strict';

  var I18N = {
    fr: {
      'rep.btn': 'Rapport de séance', 'rep.title': 'Rapport de séance', 'rep.loading': 'Calcul des indicateurs puis rédaction du rapport…',
      'rep.sPace': 'Allure et zones de vitesse', 'rep.sHr': 'Fréquence cardiaque et FC max', 'rep.sRpe': 'Ressenti (RPE)',
      'rep.sBlocks': 'Bloc par bloc', 'rep.recos': 'Recommandations', 'rep.confidence': 'Confiance',
      'rep.colBlock': 'Bloc', 'rep.colDur': 'Durée', 'rep.colPace': 'Allure / vitesse', 'rep.colSpeedZone': 'Zone vitesse', 'rep.colHr': 'FC', 'rep.colHrZone': 'Zone FC',
      'rep.demo': 'Démo : seuls les indicateurs calculés sont affichés. Le commentaire rédigé nécessite l\'add-on Assistant IA.',
      'rep.noFile': 'Le rapport nécessite une activité réelle importée de la montre (fichier ou synchronisation).',
      'rep.close': 'Fermer', 'rep.disclaimer': 'Analyse automatique d\'aide à la décision, à valider par le coach. Ce n\'est pas un avis médical.'
    },
    en: {
      'rep.btn': 'Session report', 'rep.title': 'Session report', 'rep.loading': 'Computing metrics, then writing the report…',
      'rep.sPace': 'Pace and speed zones', 'rep.sHr': 'Heart rate and max HR', 'rep.sRpe': 'Perceived effort (RPE)',
      'rep.sBlocks': 'Block by block', 'rep.recos': 'Recommendations', 'rep.confidence': 'Confidence',
      'rep.colBlock': 'Block', 'rep.colDur': 'Duration', 'rep.colPace': 'Pace / speed', 'rep.colSpeedZone': 'Speed zone', 'rep.colHr': 'HR', 'rep.colHrZone': 'HR zone',
      'rep.demo': 'Demo: only computed metrics are shown. The written comment requires the AI Assistant add-on.',
      'rep.noFile': 'The report needs a real activity imported from the watch (file or sync).',
      'rep.close': 'Close', 'rep.disclaimer': 'Automatic decision-support analysis, to be validated by the coach. Not medical advice.'
    },
    es: {
      'rep.btn': 'Informe de la sesión', 'rep.title': 'Informe de la sesión', 'rep.loading': 'Calculando indicadores y redactando el informe…',
      'rep.sPace': 'Ritmo y zonas de velocidad', 'rep.sHr': 'Frecuencia cardíaca y FC máx', 'rep.sRpe': 'Esfuerzo percibido (RPE)',
      'rep.sBlocks': 'Bloque por bloque', 'rep.recos': 'Recomendaciones', 'rep.confidence': 'Confianza',
      'rep.colBlock': 'Bloque', 'rep.colDur': 'Duración', 'rep.colPace': 'Ritmo / velocidad', 'rep.colSpeedZone': 'Zona velocidad', 'rep.colHr': 'FC', 'rep.colHrZone': 'Zona FC',
      'rep.demo': 'Demo: solo se muestran los indicadores calculados. El comentario redactado requiere el add-on Asistente IA.',
      'rep.noFile': 'El informe requiere una actividad real importada del reloj (archivo o sincronización).',
      'rep.close': 'Cerrar', 'rep.disclaimer': 'Análisis automático de ayuda a la decisión, a validar por el entrenador. No es un consejo médico.'
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

  /* ---------------- calculs ---------------- */
  var NA = 'donnée non disponible';
  function r0(x){ return x == null || !isFinite(x) ? null : Math.round(x); }
  function r1(x){ return x == null || !isFinite(x) ? null : Math.round(x * 10) / 10; }
  function paceStr(kmh){ if(!kmh || kmh <= 0) return null; var s = Math.round(3600 / kmh), m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0') + '/km'; }
  function zoneOf(pct, zones){
    if(pct == null || !zones || !zones.length) return null;
    for(var i = 0; i < zones.length; i++) if(pct < zones[i][2]) return zones[i][0];
    return zones[zones.length - 1][0];
  }
  function zNum(z){ var m = String(z || '').match(/Z(\d)/); return m ? +m[1] : null; }

  // Tours automatiques au km : regroupés en 8 blocs au plus.
  function mergeAutoLaps(laps){
    if(laps.length <= 8) return laps;
    var size = Math.ceil(laps.length / 8), out = [];
    for(var i = 0; i < laps.length; i += size){
      var g = laps.slice(i, i + size), dur = g.reduce(function(a, l){ return a + (l.durMin || 0); }, 0) || 1;
      var w = function(k){ var v = g.filter(function(l){ return l[k]; }); var d = v.reduce(function(a, l){ return a + (l.durMin || 0); }, 0); return d ? v.reduce(function(a, l){ return a + l[k] * (l.durMin || 0); }, 0) / d : 0; };
      out.push({ n: (i + 1) + '-' + Math.min(i + size, laps.length), durMin: dur, avgHr: Math.round(w('avgHr')), avgSpeed: w('avgSpeed') });
    }
    return out;
  }

  // RPE attendu (échelle 1-10) selon la zone de FC moyenne — repère simple,
  // présenté comme tel : Z1 1-2, Z2 3-4, Z3 5-6, Z4 7-8, Z5 9-10.
  var RPE_BY_ZONE = { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8], 5: [9, 10], 6: [9, 10] };

  function buildDossier(o){
    var s = o.session, data = o.data, ref = o.ref || {}, disc = data.disc || s.disc;
    var fcMax = ref.fcMax || null, vma = ref.vma || null, zones = o.zones || [], sz = o.speedZones || [];
    var useSpeed = disc === 'run' && vma && sz.length;
    var laps = data.realLaps ? (data.laps || []).slice(0, 12) : mergeAutoLaps(data.laps || []);
    var blocs = laps.map(function(l){
      var pv = useSpeed && l.avgSpeed ? l.avgSpeed / vma * 100 : null, pf = fcMax && l.avgHr ? l.avgHr / fcMax * 100 : null;
      return { bloc: l.n, duree_min: r1(l.durMin),
        allure: disc === 'run' ? paceStr(l.avgSpeed) : (l.avgSpeed ? r1(l.avgSpeed) + ' km/h' : null),
        pct_vma: r0(pv), zone_vitesse: zoneOf(pv, sz), fc_moy: l.avgHr || null, pct_fc_max: r0(pf), zone_fc: zoneOf(pf, zones) };
    });
    var pv = useSpeed && data.avgSpeed ? data.avgSpeed / vma * 100 : null;
    var pf = fcMax && data.avgHr ? data.avgHr / fcMax * 100 : null;
    var pts = data.pts || [];
    var over = fcMax ? pts.filter(function(p){ return p.hr > fcMax; }).length : 0;
    var tz = {};
    for(var i = 1; i < pts.length; i++){
      if(!(pts[i].hr > 0) || !fcMax) continue;
      var z = zoneOf(pts[i].hr / fcMax * 100, zones), dt = Math.min(pts[i].t - pts[i - 1].t, 0.5);
      if(z && dt > 0) tz[z] = (tz[z] || 0) + dt;
    }
    Object.keys(tz).forEach(function(k){ tz[k] = r1(tz[k]); });
    var zfc = zoneOf(pf, zones), exp = RPE_BY_ZONE[zNum(zfc)] || null;
    var rpe = s.rpe != null ? +s.rpe : null;
    return {
      profil: { fc_max: fcMax || NA, vma_kmh: vma || NA,
        zones_vitesse_pct_vma: disc === 'run' ? sz.map(function(z){ return z[0] + ' ' + z[1] + '-' + z[2] + ' %'; }) : NA,
        zones_fc_pct_fc_max: zones.map(function(z){ return z[0] + ' ' + z[1] + '-' + z[2] + ' %'; }) },
      seance_prevue: { titre: s.title || NA, discipline: s.disc || NA, duree_min: s.dur || NA, zone_cible: s.zone || NA },
      global: {
        duree_min: r1(pts.length ? pts[pts.length - 1].t : null),
        allure_moy: disc === 'run' ? paceStr(data.avgSpeed) || NA : (data.avgSpeed ? r1(data.avgSpeed) + ' km/h' : NA),
        pct_vma_moy: r0(pv) || NA, zone_vitesse_moy: zoneOf(pv, sz) || (disc === 'run' ? NA : 'non applicable hors course'),
        fc_moy: data.avgHr || NA, fc_max_mesuree: data.maxHr || NA, pct_fc_max_moy: r0(pf) || NA, zone_fc_moy: zfc || NA,
        temps_par_zone_fc_min: Object.keys(tz).length ? tz : NA,
        points_fc_au_dessus_fc_max: over
      },
      blocs: blocs,
      rpe: { declare: rpe != null ? rpe : NA, attendu_pour_zone_fc_moy: exp ? exp[0] + '-' + exp[1] : NA,
        ecart: (rpe != null && exp) ? (rpe > exp[1] ? 'plus dur que la zone' : rpe < exp[0] ? 'plus facile que la zone' : 'cohérent') : NA,
        echelle: 'RPE de 1 à 10' }
    };
  }

  /* ---------------- rendu ---------------- */
  var CSS = ''
    + '#silReport{z-index:10000}#silReport .modal{max-width:700px}#silReport h3{padding-right:40px}'
    + '.rp-sec{border-top:1px solid var(--line);padding-top:14px;margin-top:16px}'
    + '.rp-sec h4{font-size:var(--fs-sm,13px);letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 8px}'
    + '.rp-list{margin:0;padding-left:18px;line-height:1.55;font-size:var(--fs-base,14px)}'
    + '.rp-conf{display:inline-block;font-size:11px;border:1px solid var(--line-strong);border-radius:99px;padding:2px 9px;color:var(--muted);margin-left:8px;vertical-align:middle}'
    + '.rp-tbl{width:100%;border-collapse:collapse;font-size:13px}.rp-wrap{overflow-x:auto}'
    + '.rp-tbl th,.rp-tbl td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left}'
    + '.rp-tbl th{color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em}'
    + '.rp-head{font-size:16px;line-height:1.5;font-weight:600;margin:4px 0 0}'
    + '.rp-note{font-size:12px;color:var(--muted);margin-top:14px;line-height:1.5}.rp-load{display:flex;align-items:center;gap:10px;color:var(--muted)}';

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
      + inner + '<p class="rp-note">' + esc(t('rep.disclaimer')) + '</p>'
      + '<button class="btn" data-rp-close style="width:100%;margin-top:14px">' + esc(t('rep.close')) + '</button></div>';
    if(!ov.classList.contains('open')){ lastFocus = document.activeElement; ov.classList.add('open'); }
    var b = ov.querySelector('.btn'); if(b) b.focus();
  }
  function close(){
    var ov = document.getElementById('silReport'); if(!ov) return;
    ov.classList.remove('open');
    if(lastFocus && lastFocus.focus) try{ lastFocus.focus(); }catch(e){}
  }
  function list(a){ a = (a || []).filter(Boolean); return a.length ? '<ul class="rp-list">' + a.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
  function sec(key, body){ return body ? '<div class="rp-sec"><h4>' + esc(t(key)) + '</h4>' + body + '</div>' : ''; }
  function blocksTable(d){
    if(!d.blocs.length) return '';
    return '<div class="rp-wrap"><table class="rp-tbl"><thead><tr><th>' + esc(t('rep.colBlock')) + '</th><th>' + esc(t('rep.colDur')) + '</th><th>' + esc(t('rep.colPace')) + '</th><th>' + esc(t('rep.colSpeedZone')) + '</th><th>' + esc(t('rep.colHr')) + '</th><th>' + esc(t('rep.colHrZone')) + '</th></tr></thead><tbody>'
      + d.blocs.map(function(b){
        return '<tr><td>' + esc(b.bloc) + '</td><td>' + esc(b.duree_min != null ? b.duree_min + ' min' : '') + '</td><td>' + esc(b.allure || '') + '</td><td>'
          + esc(b.zone_vitesse ? b.zone_vitesse + ' (' + b.pct_vma + ' % VMA)' : '—') + '</td><td>' + esc(b.fc_moy ? b.fc_moy + ' bpm (' + b.pct_fc_max + ' %)' : '—') + '</td><td>' + esc(b.zone_fc || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function factLines(o){
    return Object.keys(o).filter(function(k){ return typeof o[k] !== 'object'; }).map(function(k){ return k.replace(/_/g, ' ') + ' : ' + o[k]; });
  }
  function render(d, r){
    if(!r){ // sans IA : les chiffres seulement
      return '<p class="rp-head">' + esc(t('rep.demo')) + '</p>'
        + sec('rep.sPace', list(factLines({ allure_moy: d.global.allure_moy, pct_vma_moy: d.global.pct_vma_moy, zone_vitesse_moy: d.global.zone_vitesse_moy })))
        + sec('rep.sHr', list(factLines({ fc_moy: d.global.fc_moy, pct_fc_max_moy: d.global.pct_fc_max_moy, zone_fc_moy: d.global.zone_fc_moy, fc_max_mesuree: d.global.fc_max_mesuree })))
        + sec('rep.sRpe', list(factLines(d.rpe)))
        + sec('rep.sBlocks', blocksTable(d));
    }
    var conf = r.confiance ? '<span class="rp-conf">' + esc(t('rep.confidence')) + ' : ' + esc(r.confiance) + '</span>' : '';
    return '<p class="rp-head">' + esc(r.headline || '') + conf + '</p>'
      + sec('rep.sPace', list(r.allure)) + sec('rep.sHr', list(r.fc)) + sec('rep.sRpe', list(r.rpe))
      + sec('rep.recos', list(r.recos)) + sec('rep.sBlocks', blocksTable(d));
  }

  async function open(o){
    if(!o || !o.data || !(o.data.pts || []).length){ frame('<p>' + esc(t('rep.noFile')) + '</p>'); return; }
    var d = buildDossier(o), PF = window.PF;
    if(!(PF && PF.user && window.__pf_aiAddon === true && PF.sessionReport)){ frame(render(d, null), o.session.title); return; }
    frame('<p class="rp-load"><span class="ai-dot"></span> ' + esc(t('rep.loading')) + '</p>', o.session.title);
    // 'r2|' : format allégé ; ignore d'éventuels rapports v1 en cache.
    var key = 'r2|' + String(o.session.id || (o.session.title + '|' + (o.session.dur || '')));
    var r = await PF.sessionReport({ session_key: key, athlete_id: o.athleteId || null, dossier: d });
    if(r && r.error){
      close();
      if(window.SilAiPopup) window.SilAiPopup.showError({ kind: 'report', detail: r.detail || r.error });
      return;
    }
    frame(render(d, r.report || {}), o.session.title);
  }

  window.SilAiReport = { open: open, buildDossier: buildDossier, close: close };
})();
