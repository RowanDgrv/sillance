/* ============================================================
   Sillance — Inventaire du matériel de l'athlète (03/11/2026)
   ------------------------------------------------------------
   Ce que l'athlète POSSÈDE (table athlete_equipment, 0087), hors suivi
   d'usure (baskets / vélos restent dans « Mon matériel » au km).
   - Athlète : coche son matériel par sport (+ objets libres).
   - Coach : « Matériel de l'athlète » en lecture seule, pour programmer
     selon ce que l'athlète a vraiment.
   - detect(session) : matériel CITÉ dans une séance (« 400 pull
     plaquettes » → pull-buoy + plaquettes) pour la liste « À prévoir ».
   Panneau injecté sous la liste baskets/vélos (#gearList).
   ============================================================ */
(function(){
  'use strict';

  // groupe → objets. kw = mots qui, dans une séance, demandent cet objet.
  var CATALOG = [
    {g:'run', items:[
      {k:'rain_jacket',  fr:'Veste de pluie',            en:'Rain jacket',           es:'Chaqueta de lluvia'},
      {k:'headlamp',     fr:'Lampe frontale',            en:'Head torch',            es:'Linterna frontal', kw:/frontale|nuit|head ?torch/i},
      {k:'run_belt',     fr:'Ceinture porte-flasques',   en:'Running belt / flasks', es:'Cinturón porta-bidones'},
      {k:'trail_poles',  fr:'Bâtons de trail',           en:'Trail poles',           es:'Bastones de trail', kw:/b[âa]tons?/i}
    ]},
    {g:'bike', items:[
      {k:'power_meter',  fr:'Capteur de puissance',      en:'Power meter',           es:'Potenciómetro', kw:/capteur de puissance|power ?meter/i},
      {k:'home_trainer', fr:'Home-trainer',              en:'Indoor trainer',        es:'Rodillo', kw:/home[- ]?trainer|\bht\b|rodillo/i},
      {k:'bike_computer',fr:'Compteur GPS vélo',         en:'Bike computer',         es:'Ciclocomputador'},
      {k:'bike_lights',  fr:'Éclairage vélo',            en:'Bike lights',           es:'Luces de bici'}
    ]},
    {g:'swim', items:[
      {k:'paddles',      fr:'Plaquettes',                en:'Paddles',               es:'Palas', kw:/plaquettes?|paddles?|palas/i},
      {k:'pullbuoy',     fr:'Pull-buoy',                 en:'Pull buoy',             es:'Pull-buoy', kw:/\bpull\b|pull[- ]?buoy|pullboy/i},
      {k:'fins',         fr:'Palmes',                    en:'Fins',                  es:'Aletas', kw:/palmes?|\bfins?\b|aletas/i},
      {k:'snorkel',      fr:'Tuba frontal',              en:'Snorkel',               es:'Tubo frontal', kw:/tuba|snorkel/i},
      {k:'kickboard',    fr:'Planche',                   en:'Kickboard',             es:'Tabla', kw:/planche|kick ?board|tabla/i},
      {k:'ankle_band',   fr:'Élastique de chevilles',    en:'Ankle band',            es:'Goma de tobillos', kw:/[ée]lastique.{0,15}(cheville|jambe)|ankle ?band|goma/i},
      {k:'drag_chute',   fr:'Parachute',                 en:'Drag chute',            es:'Paracaídas', kw:/parachute|paraca[íi]das|drag ?chute/i},
      {k:'wetsuit',      fr:'Combinaison néoprène',      en:'Wetsuit',               es:'Neopreno', kw:/n[ée]opr[èe]ne|combinaison|wetsuit|eau libre/i}
    ]},
    {g:'sensor', items:[
      {k:'gps_watch',    fr:'Montre GPS',                en:'GPS watch',             es:'Reloj GPS'},
      {k:'hr_strap',     fr:'Ceinture cardio',           en:'Heart-rate strap',      es:'Banda de pulso', kw:/ceinture cardio|cardio ?fr[ée]quence|hr ?strap/i}
    ]},
    {g:'mob', items:[
      {k:'mobility_band',fr:'Élastique de mobilité',     en:'Mobility band',         es:'Banda de movilidad', kw:/[ée]lastique de mobilit|bande? de mobilit|resistance band/i},
      {k:'foam_roller',  fr:'Rouleau de massage',        en:'Foam roller',           es:'Rodillo de masaje', kw:/rouleau|foam ?roll/i},
      {k:'dumbbells',    fr:'Haltères',                  en:'Dumbbells',             es:'Mancuernas', kw:/halt[èe]res?|dumbbells?|mancuernas/i},
      {k:'kettlebell',   fr:'Kettlebell',                en:'Kettlebell',            es:'Kettlebell', kw:/kettlebell|\bkb\b/i}
    ]}
  ];
  var GROUP = {
    run:   {fr:'Course à pied', en:'Running', es:'Carrera'},
    bike:  {fr:'Vélo', en:'Cycling', es:'Ciclismo'},
    swim:  {fr:'Natation', en:'Swimming', es:'Natación'},
    sensor:{fr:'Montre & capteurs', en:'Watch & sensors', es:'Reloj y sensores'},
    mob:   {fr:'Muscu & mobilité', en:'Strength & mobility', es:'Fuerza y movilidad'}
  };
  var T = {
    fr:{title:'Mon matériel d\'entraînement', titleCoach:'Matériel de l\'athlète',
        sub:'Coche ce que tu possèdes : ton coach programme selon ton matériel, et il est ajouté à ta liste « À prévoir » quand une séance le demande.',
        subCoach:'Ce que ton athlète a renseigné. Programme selon son matériel : une séance qui cite « pull », « plaquettes »… l\'ajoute à sa liste « À prévoir ».',
        none:'Aucun matériel renseigné par l\'athlète pour l\'instant.', other:'Autre', addPh:'Autre objet (ex. gourde souple)', add:'Ajouter',
        saveErr:'Non enregistré : vérifie ta connexion.', outdated:'Non enregistré : la mise à jour de la base n\'est pas encore faite (0087).', demo:'Démo : tes choix ne sont pas enregistrés.'},
    en:{title:'My training equipment', titleCoach:'Athlete\'s equipment',
        sub:'Tick what you own: your coach plans around your equipment, and it is added to your “To bring” list when a session needs it.',
        subCoach:'What your athlete has entered. Plan around it: a session mentioning “pull”, “paddles”… adds it to their “To bring” list.',
        none:'No equipment entered by the athlete yet.', other:'Other', addPh:'Other item (e.g. soft flask)', add:'Add',
        saveErr:'Not saved: check your connection.', outdated:'Not saved: the database update has not been applied yet (0087).', demo:'Demo: your choices are not saved.'},
    es:{title:'Mi material de entrenamiento', titleCoach:'Material del atleta',
        sub:'Marca lo que tienes: tu entrenador planifica según tu material, y se añade a tu lista «A preparar» cuando una sesión lo pide.',
        subCoach:'Lo que tu atleta ha indicado. Planifica según su material: una sesión que menciona «pull», «palas»… lo añade a su lista «A preparar».',
        none:'El atleta aún no ha indicado material.', other:'Otro', addPh:'Otro objeto (ej. bidón blando)', add:'Añadir',
        saveErr:'No guardado: revisa tu conexión.', outdated:'No guardado: la actualización de la base aún no está aplicada (0087).', demo:'Demo: tus elecciones no se guardan.'}
  };
  function lang(){ return (window.SilI18n && window.SilI18n.getLang && window.SilI18n.getLang()) || 'fr'; }
  function t(k){ var L = T[lang()] || T.fr; return L[k] || T.fr[k] || k; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  var BY_KEY = {};
  CATALOG.forEach(function(gr){ gr.items.forEach(function(it){ it.g = gr.g; BY_KEY[it.k] = it; }); });
  function label(key, custom){
    var it = BY_KEY[key];
    if(it) return it[lang()] || it.fr;
    return custom || String(key).replace(/^custom:/, '');
  }

  /* ---------- état ---------- */
  // owned : Map item_key → label (objets libres) ; null = pas encore chargé
  var DEMO = ['hr_strap','gps_watch','paddles','pullbuoy','fins','power_meter','home_trainer','mobility_band'];
  var state = { owned: new Map(DEMO.map(function(k){ return [k, null]; })), readOnly:false, demo:true, onToggle:null };

  /* ---------- rendu ---------- */
  function css(){
    if(document.getElementById('silEquipCss')) return;
    var st = document.createElement('style'); st.id = 'silEquipCss';
    st.textContent =
      '.eq-panel{margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}' +
      '.eq-panel h3{font-family:var(--font-display);font-size:20px;margin:0 0 4px}' +
      '.eq-panel .eq-sub{color:var(--muted);font-size:13px;margin:0 0 14px;max-width:720px}' +
      '.eq-grp{margin-bottom:12px}' +
      '.eq-grp-lbl{font-family:var(--font-data);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:6px}' +
      '.eq-chips{display:flex;flex-wrap:wrap;gap:6px}' +
      '.eq-chip{font:inherit;font-size:12.5px;font-weight:600;padding:6px 11px;border-radius:99px;cursor:pointer;border:1px solid var(--line-strong);background:var(--panel-2);color:var(--soft);display:inline-flex;align-items:center;gap:6px}' +
      '.eq-chip.on{background:color-mix(in srgb,var(--accent) 16%,transparent);border-color:color-mix(in srgb,var(--accent) 55%,transparent);color:var(--text)}' +
      '.eq-chip.on::before{content:"✓";color:var(--accent);font-weight:800}' +
      '.eq-chip[disabled]{cursor:default}' +
      '.eq-add{display:flex;gap:6px;margin-top:6px;max-width:420px}' +
      '.eq-add input{flex:1;min-width:0;background:var(--panel-2);color:var(--text);border:1px solid var(--line-strong);border-radius:8px;height:34px;padding:0 10px;font:inherit;font-size:13px}' +
      '.eq-add button{background:none;border:1px solid var(--line-strong);color:var(--soft);border-radius:8px;padding:0 12px;font:inherit;font-size:13px;cursor:pointer}' +
      '.eq-note{font-size:12px;color:var(--accent2);min-height:16px;margin-top:6px}' +
      '.eq-empty{color:var(--muted);font-size:13px}';
    document.head.appendChild(st);
  }
  function panel(){
    var list = document.getElementById('gearList');
    if(!list) return null;
    var p = document.getElementById('eqPanel');
    if(!p){ p = document.createElement('div'); p.id = 'eqPanel'; p.className = 'eq-panel'; list.parentNode.insertBefore(p, list.nextSibling); }
    return p;
  }
  function render(){
    css();
    var p = panel(); if(!p) return;
    var ro = state.readOnly, owned = state.owned;
    var html = '<h3>' + esc(ro ? t('titleCoach') : t('title')) + '</h3><p class="eq-sub">' + esc(ro ? t('subCoach') : t('sub')) + '</p>';
    var shown = 0;
    CATALOG.forEach(function(gr){
      var items = gr.items.filter(function(it){ return !ro || owned.has(it.k); });
      if(!items.length) return;
      shown += items.length;
      html += '<div class="eq-grp"><div class="eq-grp-lbl">' + esc(GROUP[gr.g][lang()] || GROUP[gr.g].fr) + '</div><div class="eq-chips">'
        + items.map(function(it){
            return '<button type="button" class="eq-chip' + (owned.has(it.k) ? ' on' : '') + '" data-k="' + it.k + '"' + (ro ? ' disabled' : '') + '>' + esc(label(it.k)) + '</button>';
          }).join('') + '</div></div>';
    });
    var customs = []; owned.forEach(function(lbl, k){ if(/^custom:/.test(k)) customs.push([k, lbl]); });
    if(customs.length || !ro){
      html += '<div class="eq-grp"><div class="eq-grp-lbl">' + esc(t('other')) + '</div><div class="eq-chips">'
        + customs.map(function(c){ return '<button type="button" class="eq-chip on" data-k="' + esc(c[0]) + '"' + (ro ? ' disabled' : '') + '>' + esc(label(c[0], c[1])) + '</button>'; }).join('') + '</div>'
        + (ro ? '' : '<div class="eq-add"><input maxlength="60" placeholder="' + esc(t('addPh')) + '"><button type="button">' + esc(t('add')) + '</button></div>')
        + '</div>';
      shown += customs.length;
    }
    if(ro && !shown) html += '<div class="eq-empty">' + esc(t('none')) + '</div>';
    html += '<div class="eq-note" aria-live="polite"></div>';
    p.innerHTML = html;
    if(ro) return;
    var note = p.querySelector('.eq-note');
    function toggle(k, lbl){
      var on = !owned.has(k);
      on ? owned.set(k, lbl || null) : owned.delete(k);
      render();
      if(state.demo){ panel().querySelector('.eq-note').textContent = t('demo'); return; }
      Promise.resolve(state.onToggle && state.onToggle(k, on, lbl || null)).catch(function(err){
        on ? owned.delete(k) : owned.set(k, lbl || null);
        render();
        panel().querySelector('.eq-note').textContent = /athlete_equipment|relation|schema/i.test(String(err && err.message)) ? t('outdated') : t('saveErr');
      });
      if(window.__pf_app && window.__pf_app.render) try { window.__pf_app.render(); } catch(_){}
    }
    p.querySelectorAll('.eq-chip').forEach(function(b){ b.addEventListener('click', function(){ toggle(b.dataset.k, owned.get(b.dataset.k)); }); });
    var inp = p.querySelector('.eq-add input'), btn = p.querySelector('.eq-add button');
    function addCustom(){
      var v = (inp.value || '').trim().slice(0, 60); if(!v) return;
      var k = 'custom:' + v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
      if(owned.has(k)) { inp.value = ''; return; }
      toggle(k, v);
    }
    btn.addEventListener('click', addCustom);
    inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); addCustom(); } });
    void note;
  }

  /* ---------- matériel cité dans une séance ---------- */
  // texte de la séance : titre, description, et chaque ligne des blocs
  // (exercice, note) — c'est là que le coach écrit « 400 pull plaquettes ».
  function sessionText(s){
    var parts = [s.title, s.desc, s.coachNote, s.note];
    var blocks = (s.blocksV2 && s.blocksV2.blocks) || s.blocks || [];
    blocks.forEach(function(b){ parts.push(b.title); (b.lines || []).forEach(function(l){ parts.push(l.exercise, l.note, l.station); }); });
    return parts.filter(Boolean).join(' \n ');
  }
  function detect(s){
    var txt = sessionText(s || {}); if(!txt) return [];
    var out = [];
    CATALOG.forEach(function(gr){ gr.items.forEach(function(it){ if(it.kw && it.kw.test(txt)) out.push(it.k); }); });
    return out;
  }

  window.SilEquip = {
    CATALOG: CATALOG, label: label, detect: detect, render: render,
    owns: function(k){ return state.owned.has(k); },
    ownedKeys: function(){ return Array.from(state.owned.keys()); },
    groupOf: function(k){ return BY_KEY[k] ? BY_KEY[k].g : 'other'; },
    // libellé en minuscule initiale pour la liste « À prévoir » (« pull-buoy »)
    gearLabel: function(k){ var l = label(k, state.owned.get(k)); return l.charAt(0).toLowerCase() + l.slice(1); },
    // owned : [{item_key, label}] ; opts : {readOnly, demo, onToggle(k, on, label)}
    set: function(rows, opts){
      opts = opts || {};
      state.owned = new Map((rows || []).map(function(r){ return [r.item_key, r.label || null]; }));
      state.readOnly = !!opts.readOnly; state.demo = !!opts.demo; state.onToggle = opts.onToggle || null;
      render();
    },
    setReadOnly: function(ro){ state.readOnly = !!ro; render(); }
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, {once:true}); else render();
})();
