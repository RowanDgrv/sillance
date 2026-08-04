/* Polyfill Array.prototype.at (audit 03/08/2026) : indisponible sur Safari
   < 15.4 (mars 2022), utilisé 16 fois dans ce fichier (courbes MMP, CTL/ATL,
   FTP…). Ne remplace rien s'il existe déjà nativement. */
if(!Array.prototype.at){
  Array.prototype.at=function(n){
    n=Math.trunc(n)||0; if(n<0) n+=this.length;
    return (n<0||n>=this.length)?undefined:this[n];
  };
}

/* ============================================================
   TÉLÉMÉTRIE D'ERREUR — capture window.onerror / unhandledrejection
   et logue via PF.logClientError (table client_errors, cf. migration
   0034). Best-effort, plafonné, jamais bloquant. window.PF n'est pas
   encore prêt à ce stade (sillance-integration.js est un module chargé
   en fin de page) → mise en file d'attente + vidage dès que possible.
   ============================================================ */
(function(){
  const MAX_REPORTS = 20;
  let sent = 0;
  const seen = new Set();
  const queue = [];
  function report(message, stack, context){
    if(sent >= MAX_REPORTS) return;
    const key = String(message).slice(0,200);
    if(seen.has(key)) return;   // évite le flood si une erreur boucle
    seen.add(key);
    const payload = { message, stack, url: location.href, context };
    if(window.PF?.logClientError){ sent++; window.PF.logClientError(payload).catch(()=>{}); }
    else queue.push(payload);
  }
  let tries = 0;
  const flush = setInterval(()=>{
    tries++;
    if(window.PF?.logClientError){
      while(queue.length && sent < MAX_REPORTS){ sent++; window.PF.logClientError(queue.shift()).catch(()=>{}); }
      clearInterval(flush);
    } else if(tries > 20) clearInterval(flush);   // ~10s, abandonne (mode démo sans cloud probable)
  }, 500);
  window.addEventListener('error', e=>{
    report(e.message || 'Erreur inconnue', e.error?.stack || null, { line:e.lineno, col:e.colno, file:e.filename });
  });
  window.addEventListener('unhandledrejection', e=>{
    const reason = e.reason;
    report(reason?.message || String(reason), reason?.stack || null, { kind:'unhandledrejection' });
  });
})();

/* ============================================================
   Sillance — logique
   ------------------------------------------------------------
   Enveloppé dans une IIFE (03/08/2026, constat architecture/perf de
   l'audit pré-prod : script applicatif entier en portée globale). Toute
   communication vers l'extérieur passe déjà par des assignations
   explicites à window (window.__pf_app, window.PF, window.loadStravaData,
   window.exportBilan…) — inchangées, elles continuent de fonctionner
   depuis l'intérieur d'une closure. Découpage modulaire (03/08/2026) :
   plus aucun onclick= en dur dans le HTML, tout est attaché en JS.
   ============================================================ */
(function(){
/* i18n (03/08/2026) : raccourci vers SilI18n.t — nommé "tr" (pas "t") car
   "t" est déjà utilisé partout dans ce fichier comme paramètre local pour
   "template" (tplCard(t,z), t.disc, t.title…). Ne traduit que le texte pur
   affiché à l'écran — jamais les valeurs qui servent aussi de clé de
   données (ex. noms de zones dans INTENSITY_MODELS, laissés en français
   volontairement : les toucher demanderait de séparer affichage/logique). */
function tr(key, vars){ return window.SilI18n ? SilI18n.t(key, vars) : key; }
const DATE_LOCALE = {fr:'fr-FR', en:'en-US', es:'es-ES'};
function localeStr(){ return DATE_LOCALE[window.SilI18n ? SilI18n.getLang() : 'fr'] || 'fr-FR'; }
const DISC = {
  swim:     {get label(){return tr('disc.swim')}, ico:'ic-waves',    color:'var(--swim)', get gear(){return [tr('gear.swim1'),tr('gear.swim2'),tr('gear.swim3')]}},
  bike:     {get label(){return tr('disc.bike')}, ico:'ic-bike',     color:'var(--bike)', get gear(){return [tr('gear.bike1'),tr('gear.bike2'),tr('gear.bike3'),tr('gear.bike4')]}},
  run:      {get label(){return tr('disc.run')},  ico:'ic-run',      color:'var(--run)', get gear(){return [tr('gear.run1'),tr('gear.run2')]}},
  strength: {get label(){return tr('disc.strength')}, ico:'ic-dumbbell', color:'var(--strength)', get gear(){return [tr('gear.strength1'),tr('gear.strength2')]}},
  hyrox:    {get label(){return tr('disc.hyrox')}, ico:'ic-zap',      color:'#FF8A3D', get gear(){return [tr('gear.hyrox1'),tr('gear.hyrox2'),tr('gear.hyrox3'),tr('gear.hyrox4')]}}
};
/* Icône HTML d'une discipline (usage innerHTML uniquement — pas dans <option>/textContent/SVG). */
function discIcon(d){ return d && d.ico ? `<i class="ic ${d.ico}"></i>` : ''; }
/* ============================================================
   HYROX — 8 stations officielles (avec 8 × 1 km course entre elles)
   Chaque station a une unité de mesure propre :
     - distance (m) : SkiErg, Sled Push, Sled Pull, Burpee Broad Jump,
                      Rowing, Farmers Carry, Sandbag Lunges
     - répétitions : Wall Balls
   Certaines stations ont un poids (réglable à la création).
   ============================================================ */
const HYROX_STATIONS = [
  {key:'ski',     name:'SkiErg',              unit:'m',   def:1000, weighted:false, short:'Ski'},
  {key:'sledpush',name:'Sled Push',           unit:'m',   def:50,   weighted:true,  wDef:152, short:'Push'},
  {key:'sledpull',name:'Sled Pull',           unit:'m',   def:50,   weighted:true,  wDef:103, short:'Pull'},
  {key:'burpee',  name:'Burpee Broad Jump',   unit:'m',   def:80,   weighted:false, short:'Burpee'},
  {key:'row',     name:'Rowing',              unit:'m',   def:1000, weighted:false, short:'Row'},
  {key:'farmer',  name:'Farmers Carry',       unit:'m',   def:200,  weighted:true,  wDef:24,  short:'Farmer'},
  {key:'lunges',  name:'Sandbag Lunges',      unit:'m',   def:100,  weighted:true,  wDef:20,  short:'Lunges'},
  {key:'wallball',name:'Wall Balls',          unit:'reps',def:100,  weighted:true,  wDef:9,   short:'W.Ball'}
];
function hyroxStation(key){ return HYROX_STATIONS.find(s=>s.key===key); }
/* matériel optionnel déclenché par mots-clés dans le titre de la séance.
   Ajoute ici tes propres tags (plaquettes, pull-buoy, etc.). */
const GEAR_TAGS = {
  'plaquette':'plaquettes', 'pull':'pull-buoy', 'pullbuoy':'pull-buoy', 'pull-buoy':'pull-buoy',
  'élastique':'élastique', 'frein':'palmes', 'palme':'palmes', 'tuba':'tuba',
  'ht':'home-trainer', 'home trainer':'home-trainer', 'hometrainer':'home-trainer',
  'piste':'pointes (piste)', 'vma':'montre GPS', 'vo2max':'montre GPS',
  'capteur':'capteur de puissance', 'ftp':'capteur de puissance',
  'longue':'ravitaillement (gels/barres)', 'ld':'ravitaillement (gels/barres)'
};
/* montre connectée recommandée dès qu'il y a une séance à intensité */
function gearForSession(s){
  const base = (DISC[s.disc].gear||[]).slice();
  const title = (s.title||'').toLowerCase();
  for(const k in GEAR_TAGS){ if(title.includes(k)) base.push(GEAR_TAGS[k]); }
  if(['Z4','Z5'].includes(s.zone) || /vma|vo2|seuil|intervalle|fractionn|lt2/i.test(title)) base.push('montre connectée');
  return base;
}

/* ============================================================
   NUTRITION — consignes automatiques avant / pendant / après
   ------------------------------------------------------------
   Génère des conseils selon le type, l'intensité et la durée.
   Le coach peut surcharger via s.nutrition = {pre, during, post}.
   Repère le macronutriment clé (protéines / glucides) pour la
   notification post-synchro.
   ============================================================ */
function nutritionForSession(s){
  if(s.nutrition && (s.nutrition.pre||s.nutrition.post)) return s.nutrition; // surcharge coach
  const t=(s.title||'').toLowerCase();
  const dur=s.dur||0;
  const hard = ['Z4','Z5'].includes(s.zone) || /vma|vo2|seuil|intervalle|fractionn|lt2|sv2/i.test(t);
  const long = dur>=120;
  let pre, during='', post, key;
  if(long){
    pre='Repas riche en glucides 3 h avant. Petite collation glucidique 30 min avant (banane, barre).';
    during='Sortie longue : 30–60 g de glucides par heure (gels, boisson énergétique, fruits secs).';
    post='Recharge glucidique + protéines dans les 30 min (boisson de récup, repas complet).';
    key='glucides';
  } else if(hard){
    pre='Collation légère 1–2 h avant, plutôt glucidique, peu de fibres et de gras.';
    during='Hydratation régulière. Sur séance courte, pas de ravitaillement nécessaire.';
    post='Apport en protéines dans les 30 min pour la reconstruction musculaire (~20–25 g) + glucides.';
    key='protéines';
  } else {
    pre='Pas besoin de manger juste avant si séance le matin à jeun léger possible. Sinon collation légère.';
    during='Hydratation à la sensation.';
    post='Repas équilibré habituel. Hydrate-toi bien.';
    key='hydratation';
  }
  if(s.disc==='swim'){ during='Hydrate-toi entre les séries (gourde au bord du bassin).'; }
  return {pre, during, post, key, auto:true};
}
/* phrase courte pour la notification "pense à prendre : X" */
function nutritionReminder(s){
  const n=nutritionForSession(s);
  if(n.key==='glucides') return tr('nutriReminder.carbs');
  if(n.key==='protéines') return tr('nutriReminder.protein');
  return tr('nutriReminder.hydrate');
}

/* ============================================================
   BIBLIOTHÈQUE VIDÉO — éducatifs & gammes
   ------------------------------------------------------------
   Pour ajouter une vidéo : remplis un objet ci-dessous.
      - id     : identifiant unique
      - disc   : swim | bike | run | strength
      - title  : nom affiché
      - dur    : durée (texte libre, ex "1:24")
      - level  : Débutant | Inter | Avancé
      - desc   : courte description / focus technique
      - tags   : mots-clés qui déclenchent le lien dans les séances
      - src    : URL de la vidéo (mp4 direct OU embed). Démo = vide.
      - poster : image d'aperçu (optionnel)
   Le champ src est laissé vide ici : branche tes vraies vidéos
   (hébergées chez toi, ou embed YouTube/Vimeo) côté production.
   ============================================================ */
const VIDEOS = [
  // --- Natation ---
  {id:'v1', disc:'swim', get title(){return tr('video.v1.title')}, dur:'1:24', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.v1.desc')}, tags:['rattrapé','rattrape'], src:''},
  {id:'v2', disc:'swim', get title(){return tr('video.v2.title')}, dur:'0:58', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.v2.desc')}, tags:['poings fermés','poings'], src:''},
  {id:'v3', disc:'swim', get title(){return tr('video.v3.title')}, dur:'1:10', get level(){return tr('videoLevel.beginner')},
   get desc(){return tr('video.v3.desc')}, tags:['battement','planche'], src:''},
  {id:'v4', disc:'swim', get title(){return tr('video.v4.title')}, dur:'1:05', get level(){return tr('videoLevel.beginner')},
   get desc(){return tr('video.v4.desc')}, tags:['respiration','3 temps'], src:''},
  {id:'v5', disc:'swim', get title(){return tr('video.v5.title')}, dur:'1:32', get level(){return tr('videoLevel.advanced')},
   get desc(){return tr('video.v5.desc')}, tags:['virage','culbute'], src:''},
  {id:'v6', disc:'swim', get title(){return tr('video.v6.title')}, dur:'1:18', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.v6.desc')}, tags:['plaquette','pull-buoy','pull'], src:''},
  // --- Course ---
  {id:'v7', disc:'run', get title(){return tr('video.v7.title')}, dur:'0:48', get level(){return tr('videoLevel.beginner')},
   get desc(){return tr('video.v7.desc')}, tags:['gammes','montées de genoux','genoux'], src:''},
  {id:'v8', disc:'run', get title(){return tr('video.v8.title')}, dur:'0:44', get level(){return tr('videoLevel.beginner')},
   get desc(){return tr('video.v8.desc')}, tags:['talons-fesses','gammes'], src:''},
  {id:'v9', disc:'run', get title(){return tr('video.v9.title')}, dur:'1:02', get level(){return tr('videoLevel.advanced')},
   get desc(){return tr('video.v9.desc')}, tags:['bondissantes','foulées','foulee'], src:''},
  {id:'v10', disc:'run', get title(){return tr('video.v10.title')}, dur:'0:55', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.v10.desc')}, tags:['lignes droites','strides','ligne'], src:''},
  // --- Vélo ---
  {id:'v11', disc:'bike', get title(){return tr('video.v11.title')}, dur:'1:15', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.v11.desc')}, tags:['vélocité','cadence'], src:''},
  {id:'v12', disc:'bike', get title(){return tr('video.v12.title')}, dur:'1:40', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.v12.desc')}, tags:['aéro','position','posture'], src:''},
  {id:'v13', disc:'bike', get title(){return tr('video.v13.title')}, dur:'1:08', get level(){return tr('videoLevel.advanced')},
   get desc(){return tr('video.v13.desc')}, tags:['danseuse','montée','grimpe'], src:''},
  // --- Renfo ---
  {id:'v14', disc:'strength', get title(){return tr('video.v14.title')}, dur:'1:00', get level(){return tr('videoLevel.beginner')},
   get desc(){return tr('video.v14.desc')}, tags:['gainage','planche'], src:''},
  {id:'v15', disc:'strength', get title(){return tr('video.v15.title')}, dur:'1:22', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.v15.desc')}, tags:['squat'], src:''},
  {id:'v16', disc:'strength', get title(){return tr('video.v16.title')}, dur:'0:52', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.v16.desc')}, tags:['fente','fentes'], src:''},
  // --- Hyrox (les 8 stations) ---
  {id:'h1', disc:'hyrox', get title(){return tr('video.h1.title')}, dur:'1:20', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.h1.desc')}, tags:['ski','skierg'], src:''},
  {id:'h2', disc:'hyrox', get title(){return tr('video.h2.title')}, dur:'1:05', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.h2.desc')}, tags:['sled push','sledpush','traîneau'], src:''},
  {id:'h3', disc:'hyrox', get title(){return tr('video.h3.title')}, dur:'1:12', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.h3.desc')}, tags:['sled pull','sledpull','tirage'], src:''},
  {id:'h4', disc:'hyrox', get title(){return tr('video.h4.title')}, dur:'0:58', get level(){return tr('videoLevel.advanced')},
   get desc(){return tr('video.h4.desc')}, tags:['burpee','broad jump'], src:''},
  {id:'h5', disc:'hyrox', get title(){return tr('video.h5.title')}, dur:'1:15', get level(){return tr('videoLevel.beginner')},
   get desc(){return tr('video.h5.desc')}, tags:['row','rowing','rameur'], src:''},
  {id:'h6', disc:'hyrox', get title(){return tr('video.h6.title')}, dur:'0:50', get level(){return tr('videoLevel.beginner')},
   get desc(){return tr('video.h6.desc')}, tags:['farmer','farmers carry','port'], src:''},
  {id:'h7', disc:'hyrox', get title(){return tr('video.h7.title')}, dur:'1:08', get level(){return tr('videoLevel.advanced')},
   get desc(){return tr('video.h7.desc')}, tags:['lunges','sandbag','fentes lestées'], src:''},
  {id:'h8', disc:'hyrox', get title(){return tr('video.h8.title')}, dur:'1:00', get level(){return tr('videoLevel.inter')},
   get desc(){return tr('video.h8.desc')}, tags:['wallball','wall balls','wall ball'], src:''}
];
/* trouve la vidéo liée à une séance d'après son titre/description */
function videoForSession(s){
  const txt = ((s.title||'')+' '+(s.desc||'')).toLowerCase();
  // 1. correspondance directe par tag
  let hit = VIDEOS.find(v => v.disc===s.disc && v.tags.some(t=>txt.includes(t)))
         || VIDEOS.find(v => v.tags.some(t=>txt.includes(t)));
  if(hit) return hit;
  // 2. fallback intelligent pour les séances techniques/qualité courantes
  if(s.disc==='swim' && /natation|technique|éducatif|educatif/.test(txt))
    return VIDEOS.find(v=>v.id==='v1'); // crawl rattrapé par défaut
  if(s.disc==='run' && /vma|vo2|piste|intervalle|fractionn|seuil|lt/.test(txt))
    return VIDEOS.find(v=>v.id==='v7'); // gammes montées de genoux
  if(s.disc==='bike' && /vo2|ht|home|intervalle|ftp|seuil/.test(txt))
    return VIDEOS.find(v=>v.id==='v11'); // vélocité
  if(s.disc==='strength' || /renfo|gainage/.test(txt))
    return VIDEOS.find(v=>v.id==='v14'); // gainage
  return null;
}

/* ============================================================
   RÉFÉRENCES D'INTENSITÉ DE L'ATHLÈTE
   ------------------------------------------------------------
   Le coach planifie selon CE QUE L'ATHLÈTE A COMME RÉFÉRENCE :
   certains ont des zones lactate, d'autres juste une VMA, etc.
   On stocke toutes les références disponibles ; l'éditeur de
   séance laisse choisir laquelle utiliser pour chaque bloc.
   Backend : ces valeurs viennent du profil de chaque athlète.
   ============================================================ */
const ATHLETE_REF = {
  // — Vélo —
  ftp: 310,        // W
  pma: 415,        // W
  cpBike: 300,     // puissance critique W (optionnel)
  // — Course —
  vma: 20.3,       // km/h
  cv: 18.4,        // vitesse critique km/h
  seuilRun: 210,   // allure seuil en s/km (3'30")
  // — Natation —
  css: 98,         // critical swim speed : s/100m (1'38")
  // — FC —
  fcMax: 190, fcRepos: 47,
  // — HRV (variabilité de fréquence cardiaque, rMSSD ms) — base de repos
  //   sur 7 jours, sert de référence pour détecter une chute. null = l'athlète
  //   ne suit pas le HRV. Renseignée par la montre/bracelet ou à la main.
  hrvBase: 62,
  // Dernière modification des références physio (demo : ancienne, pour
  // illustrer le rappel de retest). En prod, vient de athlete_profiles.updated_at.
  updatedAt: new Date(Date.now()-1000*60*60*24*132).toISOString()
};
/* Statut HRV du matin par rapport à la base 7 j : une baisse marquée
   (< 92 % de la base) = stress/fatigue/début d'infection → à surveiller. */
function hrvStatus(hrv, base){
  base = base || (typeof ATHLETE_REF!=='undefined' ? ATHLETE_REF.hrvBase : null);
  if(!hrv || !base) return null;
  const r = hrv/base;
  if(r < 0.85) return {level:'low',  c:'var(--run)',  txt:tr('hrv.low'), pct:Math.round((r-1)*100)};
  if(r < 0.92) return {level:'warn', c:'var(--bike)', txt:tr('hrv.warn'), pct:Math.round((r-1)*100)};
  if(r > 1.08) return {level:'high', c:'var(--good)', txt:tr('hrv.high'), pct:Math.round((r-1)*100)};
  return {level:'ok', c:'var(--good)', txt:tr('hrv.ok'), pct:Math.round((r-1)*100)};
}

/* Définition des "modèles de zones" sélectionnables par bloc.
   Chaque référence sait calculer une cible à partir d'un % ou d'une zone. */
const INTENSITY_MODELS = {
  // VÉLO — puissance
  ftp:  {disc:'bike', label:'% FTP', unit:'W', ref:()=>ATHLETE_REF.ftp,
         zones:[['Z1 Récup',0,55],['Z2 Endurance',56,75],['Z3 Tempo',76,90],['Z4 Seuil',91,105],['Z5 VO2max',106,120],['Z6 Anaérobie',121,150]]},
  pma:  {disc:'bike', label:'% PMA', unit:'W', ref:()=>ATHLETE_REF.pma,
         zones:[['Endurance',0,60],['Tempo',60,75],['Seuil',75,85],['VO2max',85,100],['Sur-PMA',100,120]]},
  cpBike:{disc:'bike', label:'% Puissance critique', unit:'W', ref:()=>ATHLETE_REF.cpBike,
         zones:[['Sous-CP',0,95],['Autour CP',95,105],['Sur-CP',105,130]]},
  // COURSE — vitesse / allure
  vma:  {disc:'run', label:'% VMA', unit:'kmh', ref:()=>ATHLETE_REF.vma,
         zones:[['Z1 Récup',0,65],['Z2 Endurance',65,75],['Z3 Tempo',75,85],['Z4 Seuil',85,92],['Z5 VO2max',92,100],['Z6 Vitesse',100,115]]},
  cv:   {disc:'run', label:'% Vitesse critique', unit:'kmh', ref:()=>ATHLETE_REF.cv,
         zones:[['Sous-CV',0,95],['Autour CV',95,103],['Sur-CV',103,115]]},
  seuilRun:{disc:'run', label:'% allure seuil', unit:'pace', ref:()=>ATHLETE_REF.seuilRun, invert:true,
         zones:[['Endurance',115,108],['Marathon',108,103],['Seuil',103,98],['10K',98,94],['VMA',94,88]]},
  // NATATION — temps/100m
  css:  {disc:'swim', label:'% CSS (vitesse critique nat)', unit:'pace100', ref:()=>ATHLETE_REF.css, invert:true,
         zones:[['Récup',115,108],['Aérobie',108,103],['Seuil (CSS)',103,98],['VO2max',98,92],['Vitesse',92,85]]},
  // UNIVERSEL — FC
  fc:   {disc:'all', label:'% FC max', unit:'bpm', ref:()=>ATHLETE_REF.fcMax,
         zones:[['Z1',0,60],['Z2',60,70],['Z3',70,80],['Z4',80,90],['Z5',90,100]]}
};

/* ============================================================
   ZONES DE TRAVAIL PERSONNALISÉES PAR ATHLÈTE (#5 retour coach)
   ------------------------------------------------------------
   Par défaut : les zones de INTENSITY_MODELS (partagées). Le coach
   peut redéfinir, par athlète et par modèle (FTP, VMA, FC…), ses
   propres zones (nom + borne haute %). Stockées par athlète
   (localStorage + hook backend PF.saveAthleteZones). Utilisées partout
   où une zone est nommée (builder, analyse). La borne basse d'une zone
   = la borne haute de la précédente. Les modèles en allure (inversés :
   seuilRun, css) gardent les zones standard pour l'instant.
   ============================================================ */
const CUSTOM_ZONES = {};   // { athleteId: { modelKey: [[nom, lo, hi], ...] } }
function zoneAthleteId(){
  if(typeof mode!=='undefined' && mode==='coach' && typeof currentAthleteId!=='undefined' && currentAthleteId) return currentAthleteId;
  return (window.PF && PF.user && PF.user.id) || '_self';
}
function zonesFor(modelKey, aid){
  aid = aid || zoneAthleteId();
  const c = CUSTOM_ZONES[aid] && CUSTOM_ZONES[aid][modelKey];
  if(c && c.length) return c;
  return (INTENSITY_MODELS[modelKey] && INTENSITY_MODELS[modelKey].zones) || [];
}
function hasCustomZones(modelKey, aid){
  aid = aid || zoneAthleteId();
  return !!(CUSTOM_ZONES[aid] && CUSTOM_ZONES[aid][modelKey] && CUSTOM_ZONES[aid][modelKey].length);
}
const ZONE_RAMP = ['#2FD9FF','#39E6A3','#FFD43D','#FFB13D','#FF7A3D','#FF5470','#E0457A'];
function zoneColorAt(i, total){
  if(total<=1) return ZONE_RAMP[1];
  const idx = Math.round((i/(total-1))*(ZONE_RAMP.length-1));
  return ZONE_RAMP[Math.max(0,Math.min(ZONE_RAMP.length-1, idx))];
}
function loadCustomZones(){
  try{ const raw=localStorage.getItem('sil_custom_zones'); if(raw) Object.assign(CUSTOM_ZONES, JSON.parse(raw)); }catch(e){}
}
function persistCustomZones(aid){
  try{ localStorage.setItem('sil_custom_zones', JSON.stringify(CUSTOM_ZONES)); }catch(e){}
  if(window.PF && PF.user && PF.saveAthleteZones){
    try{ PF.saveAthleteZones(aid||zoneAthleteId(), CUSTOM_ZONES[aid||zoneAthleteId()]||{})
      .catch(e=>console.warn('[PF] saveAthleteZones',e)); }catch(e){}
  }
}
loadCustomZones();

/* Convertit un % de référence en cible affichable selon l'unité */
function computeTarget(modelKey, pct){
  const m = INTENSITY_MODELS[modelKey];
  if(!m) return '';
  const base = m.ref();
  if(m.unit==='W')   return Math.round(base*pct/100)+' W';
  if(m.unit==='bpm') return Math.round(base*pct/100)+' bpm';
  if(m.unit==='kmh'){ const v=base*pct/100; return v.toFixed(1)+' km/h · '+paceFromKmh(v); }
  if(m.unit==='pace'){ // base en s/km ; pct>100 = plus lent
    const s=Math.round(base*pct/100); return paceStr(s)+'/km'; }
  if(m.unit==='pace100'){ const s=Math.round(base*pct/100); return paceStr(s)+'/100m'; }
  return '';
}
function paceStr(s){ return Math.floor(s/60)+"'"+String(Math.round(s%60)).padStart(2,'0')+'"'; }
function paceFromKmh(kmh){ return paceStr(3600/kmh)+'/km'; }
const TEMPLATES = [
  {id:'t1', disc:'swim', title:'Technique + éducatifs', dur:60, tss:45, zone:'Z2',
   desc:'400m échauffement · 8×50m éducatifs (rattrapé, poings fermés) · 6×100m allure régulière départ 2\'00 · 200m souple.'},
  {id:'t2', disc:'swim', title:'Seuil 10×100m', dur:75, tss:70, zone:'Z4',
   desc:'600m échauffement progressif · 10×100m allure seuil départ 1\'45 · 4×50m vite/souple · 200m récup.'},
  {id:'t3', disc:'bike', title:'Endurance fondamentale', dur:150, tss:95, zone:'Z2',
   desc:'2h30 vallonné en Z2 stricte. Cadence 90+. Nutrition course : 60g glucides/h. Rester assis dans les bosses.'},
  {id:'t4', disc:'bike', title:'Intervalles 4×8\' FTP', dur:90, tss:88, zone:'Z4',
   desc:'20\' échauffement · 4×8\' à 95–100% FTP, récup 4\' · retour au calme 15\'. Home trainer ou route plate.'},
  {id:'t5', disc:'run', title:'Footing aérobie', dur:50, tss:42, zone:'Z2',
   desc:'50\' en aisance respiratoire totale. FC < 75% FCmax. Terminer par 4 lignes droites en accélération progressive.'},
  {id:'t6', disc:'run', title:'Fractionné 6×800m', dur:65, tss:75, zone:'Z5',
   desc:'20\' échauffement + gammes · 6×800m allure 5km, récup 2\' trot · 10\' retour au calme.'},
  {id:'t7', disc:'run', title:'Brick vélo→course', dur:80, tss:85, zone:'Z3',
   desc:'45\' vélo Z3 puis enchaînement immédiat 30\' course allure triathlon. Travailler la transition T2.'},
  {id:'t8', disc:'strength', title:'Renfo & gainage', dur:40, tss:25, zone:'—',
   desc:'3 tours : squats ×15, fentes ×12/jambe, pompes ×12, planche 60s, gainage latéral 45s/côté, hip thrust ×15.'},
  {id:'t9', disc:'swim', title:'Seuil 20×200 départ 3\'00', dur:95, tss:85, zone:'Z4',
   desc:'1000m échauffement · 20×200m départ 3\'00 par blocs de 5 : nage complète, pull, nage complète, pull-plaquettes · 200m souple.'},
  {id:'t10', disc:'swim', title:'Seuil 10×400 départ 6\'00', dur:90, tss:82, zone:'Z4',
   desc:'1000m échauffement · 10×400m départ 6\'00, allure régulière au seuil · 400m récup.'},
  {id:'t11', disc:'swim', title:'5×800 negative split', dur:85, tss:78, zone:'Z3',
   desc:'1000m échauffement · 5×800m en negative split : chaque 800 plus rapide que le précédent · 200m souple.'},
  {id:'t12', disc:'swim', title:'Progressif 5×800 de 1 à 5', dur:90, tss:80, zone:'Z3',
   desc:'800m échauffement · 5×800m départ 11\'20, progressif du 1er (aisance) au 5e (fort) · récup libre.'},
  {id:'t13', disc:'swim', title:'Pyramide aéro / appuyé', dur:80, tss:68, zone:'Z3',
   desc:'1000m échauffement · 2× (800/400/200/100 en alternance aéro / appuyé) · 200m souple.'},
  {id:'t14', disc:'swim', title:'Pull & plaquettes dégressif', dur:85, tss:75, zone:'Z3',
   desc:'900m échauffement · nage complète : 1000/800/600/400 récup 50 · pull-plaquettes : 400 puis 2×200 puis 4×100, départs dégressifs · 200m souple.'},
  {id:'t15', disc:'swim', title:'Allure course + transition', dur:80, tss:72, zone:'Z3',
   desc:'2500m combiné : alternance Z2 / allure course, sortie d\'eau et remise à l\'effort · 16×50m pull-plaquettes départ 40\" · récup.'},
  {id:'t16', disc:'swim', title:'Technique 4 nages + progressif', dur:95, tss:75, zone:'Z3',
   desc:'1200m échauffement · 12×100m départ 1\'30 en alternance 4 nages / crawl · 15×200m progressif par 5, départs 2\'40 → 2\'35 → 2\'30 · 400m souple.'},
  {id:'t17', disc:'swim', title:'Aérobie 8×500', dur:85, tss:60, zone:'Z2',
   desc:'8×500m aérobie en continu, nage relâchée, respiration 3 temps · hydratation entre les blocs.'},
  {id:'t18', disc:'swim', title:'Eau libre néoprène', dur:70, tss:50, zone:'Z2',
   desc:'2400m et + en eau libre avec combinaison : aéro continu + blocs bras seuls, repérage et orientation.'}
];

/* ---- état (en mémoire — branchez votre backend ici) ---- */
let weekOffset = 0;
let mode = 'coach';
let uid = 100;
const planning = {}; // clé "YYYY-MM-DD" -> [sessions]
function fmtDur(min){ const h=Math.floor(min/60), m=min%60; return h?`${h}h${String(m).padStart(2,'0')}`:`${m}min`; }

/* ============================================================
   COACH — roster d'athlètes suivis (sélecteur riche, style Nolio/iDO)
   ------------------------------------------------------------
   Le coach choisit QUEL athlète il regarde : le calendrier, la charge
   et la fraîcheur affichés sont ceux de l'athlète sélectionné.
   Chaque entrée montre la forme du check-in DU MATIN + la prochaine
   course : le coach repère d'un coup d'œil qui a besoin d'un
   allègement avant même d'ouvrir son plan.
   En démo : 6 athlètes fictifs, plans dérivés du plan de base avec
   une assiduité propre à chacun. Connecté : le roster réel (Supabase)
   remplace la démo via setCoachAthletes().
   ============================================================ */
const COACH_ROSTER = [
 {id:'a1', name:'Léa Fontan',     ini:'LF', color:'#46C2D8', checkin:{sommeil:8,fatigue:3,motivation:8,cyclePhase:'follicular',cycleDay:9}, race:{name:'Gorillaman · Sprint',   days:22}, group:'g3', drop:0,    comp:1.0,  refsUpdatedAt:new Date(Date.now()-1000*60*60*24*10).toISOString(),
  gear:[
    {id:'g1', type:'shoe', name:'Nike Pegasus 40', km:612, max:900, price:130, cat:'daily', comm:870, notified:[540]},
    {id:'g2', type:'shoe', name:'Saucony Endorphin Speed 4', km:284, max:650, price:180, cat:'tempo', comm:630, notified:[]},
    {id:'g3', type:'shoe', name:'Asics Metaspeed Sky Paris', km:118, max:350, price:250, cat:'race', comm:320, notified:[]},
    {id:'g4', type:'bike', name:'Canyon Ultimate CF', km:4380, max:20000, price:3200, cat:null, comm:null, notified:[]},
  ]},
 {id:'a2', name:'Marc Delieux',   ini:'MD', color:'#D9962F', checkin:{sommeil:5,fatigue:7,motivation:5,dispo:'fatigue',dispoNote:'Grosse semaine de boulot, jambes lourdes',hrv:56}, race:{name:'Marathon de Toulouse',  days:60}, drop:0.18, comp:0.55, refsUpdatedAt:new Date(Date.now()-1000*60*60*24*210).toISOString(),
  gear:[
    {id:'g5', type:'shoe', name:'Adidas Boston 12', km:723, max:700, price:150, cat:'tempo', comm:660, notified:[420,595,700]},
    {id:'g6', type:'shoe', name:'Adidas Ultraboost Light', km:214, max:850, price:180, cat:'daily', comm:800, notified:[]},
  ]},
 {id:'a3', name:'Chloé Vasseur',  ini:'CV', color:'#8E7FD0', checkin:{sommeil:7,fatigue:4,motivation:8,cyclePhase:'luteal',cycleDay:24}, race:{name:'HYROX Bordeaux',        days:35}, group:'g6', drop:0.10, comp:0.95, refsUpdatedAt:new Date(Date.now()-1000*60*60*24*25).toISOString(),
  gear:[
    {id:'g7', type:'shoe', name:'Puma Deviate Nitro 3', km:405, max:700, price:160, cat:'tempo', comm:650, notified:[420]},
  ]},
 {id:'a4', name:'Théo Rambert',   ini:'TR', color:'#DD5C72', checkin:{sommeil:6,fatigue:5,motivation:6,dispo:'blesse',dispoNote:'Douleur tibia droit depuis lundi, 4/10 en courant',hrv:60}, race:{name:'Semi de Blagnac',       days:14}, group:'g3', drop:0.25, comp:0.70, refsUpdatedAt:new Date(Date.now()-1000*60*60*24*104).toISOString(),
  gear:[
    {id:'g8', type:'shoe', name:'Asics Novablast 5', km:648, max:750, price:150, cat:'tempo', comm:710, notified:[450,638]},
    {id:'g9', type:'bike', name:'BMC Roadmachine', km:2150, max:20000, price:2400, cat:null, comm:null, notified:[]},
  ]},
 {id:'a5', name:'Emma Laurens',   ini:'EL', color:'#35C58C', checkin:{sommeil:9,fatigue:2,motivation:9,cyclePhase:'menstrual',cycleDay:2}, race:{name:'70.3 Aix-en-Provence',  days:98}, group:'g4', drop:0.30, comp:1.0,  refsUpdatedAt:new Date(Date.now()-1000*60*60*24*45).toISOString(),
  gear:[]},
 {id:'a6', name:'Sofiane Kerbal', ini:'SK', color:'#FF8A3D', checkin:{sommeil:4,fatigue:8,motivation:4,dispo:'malade',dispoNote:'Rhume, gorge prise — nuit hachée',hrv:48}, race:{name:'10 km de Toulouse',     days:9},  drop:0.15, comp:0.35,
  gear:[]},
];
let ROSTER = COACH_ROSTER;     // remplacé par le roster réel une fois connecté
let rosterIsReal = false;
let selectedAthleteIdx = 0;
let currentAthleteId = null;   // id Supabase (mode réel uniquement)

function athForme(a){ return a.checkin ? Math.round((a.checkin.sommeil + (10-a.checkin.fatigue) + a.checkin.motivation)/30*100) : null; }
function athFormeColor(s){ return s==null ? 'var(--muted)' : s>=75 ? 'var(--good)' : s>=55 ? 'var(--bike)' : 'var(--run)'; }
/* Journal dispo/blessure : l'athlète signale sa disponibilité au check-in,
   le coach la voit (bandeau, sélecteur, table de suivi). */
const DISPO_META = {
  ok:     {get l(){return tr('dispo.ok')},      c:'var(--good)', ic:'ic-check'},
  fatigue:{get l(){return tr('dispo.fatigue')}, c:'var(--bike)', ic:'ic-battery'},
  malade: {get l(){return tr('dispo.malade')},  c:'#FF8A4D',     ic:'ic-thermometer'},
  blesse: {get l(){return tr('dispo.blesse')},  c:'var(--run)',  ic:'ic-alert-triangle'}
};
function athDispo(a){ const d=a&&a.checkin&&a.checkin.dispo; return (d&&DISPO_META[d])?d:null; }
function dispoSafe(t){ return String(t||'').replace(/[<>&"]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

/* ============================================================
   PHYSIO FÉMININE — suivi du cycle menstruel (opt-in, sensible)
   ------------------------------------------------------------
   Donnée de santé (art.9 RGPD) : facultative, activée par l'athlète,
   visible du coach pour adapter l'entraînement au jour du cycle.
   Repères d'adaptation issus de la littérature (indicatifs, à croiser
   avec le ressenti — la réponse est très individuelle).
   ============================================================ */
const CYCLE_META = {
  menstrual: {get l(){return tr('cycle.menstrual.l')},  short:'J1–5',   c:'#DD5C72', ic:'ic-waves',
    get tip(){return tr('cycle.menstrual.tip')}},
  follicular:{get l(){return tr('cycle.follicular.l')}, short:'J6–13',  c:'#35C58C', ic:'ic-zap',
    get tip(){return tr('cycle.follicular.tip')}},
  ovulation: {get l(){return tr('cycle.ovulation.l')},  short:'~J14',   c:'#46C2D8', ic:'ic-target',
    get tip(){return tr('cycle.ovulation.tip')}},
  luteal:    {get l(){return tr('cycle.luteal.l')},     short:'J15–28', c:'#D9962F', ic:'ic-thermometer',
    get tip(){return tr('cycle.luteal.tip')}}
};
/* phase auto-déduite du jour de cycle (repère 28 j, ajusté au ressenti) */
function cyclePhaseFromDay(d){
  if(!d||d<1) return null;
  if(d<=5) return 'menstrual';
  if(d<=13) return 'follicular';
  if(d<=15) return 'ovulation';
  return 'luteal';
}
function athCycle(a){ const p=a&&a.checkin&&a.checkin.cyclePhase; return (p&&CYCLE_META[p])?p:null; }
function athNote(s){ return s==null ? '' : s>=75 ? tr('athNote.ready') : s>=55 ? tr('athNote.watch') : tr('athNote.lighten'); }

function setCoachAthletes(list, defaultId){
  // Appelé uniquement au login réel : on remplace TOUJOURS le roster de démo,
  // même par une liste vide — un vrai coach sans athlète ne doit pas voir les
  // athlètes de démonstration (Léa, Marc…) comme si c'étaient les siens.
  ROSTER = (list||[]).map(a=>({ id:a.id, name:a.name,
    ini:(a.name||'?').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase(),
    color:'#46C2D8', checkin:a.checkin||null, race:null, refsUpdatedAt:a.refsUpdatedAt||null }));
  rosterIsReal = true;
  selectedAthleteIdx = ROSTER.length ? Math.max(0, ROSTER.findIndex(a=>a.id===defaultId)) : 0;
  currentAthleteId = defaultId || (ROSTER[0] && ROSTER[0].id) || null;
  renderAthPicker();
  updatePlanAthleteVisibility();
}
function updatePlanAthleteVisibility(){
  const el = document.getElementById('athPicker'); if(el) el.hidden = mode!=='coach';
  const band = document.getElementById('coachBand'); if(band) band.hidden = mode!=='coach';
}
// Compte confirmé sans la moindre activité réelle : masque l'analyse et les
// records de démo plutôt que de les présenter comme si c'était les siens.
function setActivityState(hasActivity){
  const an=document.getElementById('analytics'), anEmpty=document.getElementById('analyticsEmpty');
  if(!an || !anEmpty) return;
  an.hidden = !hasActivity;
  anEmpty.hidden = hasActivity;
}

/* ============================================================
   DONNÉES RÉELLES — importées du calendrier iDO de l'athlète
   3 semaines : S22 (offset -2), S23 (-1), S24 (0, en cours)
   Objectif : Triathlon de Montauban — Gorillaman (début juillet)
   Chaque séance : disc, title, dur(min), dist(km), tss, zone, done, rpe
   ============================================================ */
(function seed(){
  // pose une séance sur (semaine offset, jour 0=lundi)
  const add = (wOff, day, s) => {
    const date = iso(addDays(mondayOf(wOff), day));
    (planning[date] ||= []).push({...s, id:'s'+(uid++)});
  };
  const D=(disc,title,dur,dist,tss,zone,done,rpe)=>({disc,title,dur,dist:dist||0,tss,zone,done:!!done,rpe});

  /* ---------- S22 (offset -2) — TSS ≈ 388 ---------- */
  // Lun-Mar : repos
  add(-2,2, D('run','Footing',45,8.5,42,'Z2',1,4));
  add(-2,2, D('swim','Natation club',75,0,55,'Z2',1,5));
  add(-2,3, D('bike','Endurance fondamentale',90,33,70,'Z2',1,6));
  add(-2,4, D('bike','Endurance fondamentale',150,88,110,'Z2',1,6));
  add(-2,4, D('swim','Natation club',75,0,55,'Z2',1,5));
  add(-2,5, D('run','Footing + LD',58,12.3,56,'Z2',1,6));

  /* ---------- S23 (offset -1) — TSS ≈ 879 ---------- */
  add(-1,0, D('swim','Natation club',75,0,55,'Z2',1,5));
  add(-1,0, D('run','VMA court',55,12.1,80,'Z5',1,8)); // 30/45
  add(-1,1, D('swim','Natation club',75,0,55,'Z2',1,5));
  add(-1,1, D('run','LT2 intervalles courts',84,10.7,92,'Z4',1,8));
  add(-1,2, D('bike','Endurance fondamentale',150,55,108,'Z2',1,6));
  add(-1,2, D('run','Footing facile',70,15.6,62,'Z2',1,5));
  add(-1,3, D('swim','Natation club',75,0,55,'Z2',1,5));
  add(-1,3, D('run','SV2 intervalles courts',68,11,85,'Z4',1,8,'Sensations correctes, bonne séance.'));
  add(-1,4, D('bike','Endurance fondamentale',90,33,70,'Z2',1,6));
  add(-1,4, D('swim','Natation club',75,0,55,'Z2',1,5));
  add(-1,4, D('run','Footing facile',45,9.3,42,'Z2',1,4));
  add(-1,5, D('bike','Sortie longue D3',120,39.4,95,'Z2',1,6)); // weekend D3
  add(-1,6, D('bike','Endurance D3',75,21.8,68,'Z2',1,7));
  add(-1,6, D('run','Footing D3',60,13.7,55,'Z2',1,6));

  /* ---------- S24 (offset 0, EN COURS) — TSS ≈ 1867 ---------- */
  add(0,0, D('bike','Endurance fondamentale',90,33,75,'Z2',1,6));
  add(0,0, D('swim','Natation club',75,0,55,'Z2',1,5));
  add(0,0, D('run','Footing facile',50,9.7,46,'Z2',1,5));
  add(0,1, D('bike','VO2max HT',78,39.5,105,'Z5',1,9,'Très dur sur les dernières répétitions.')); // 30/30
  add(0,1, D('swim','Natation club',75,0,55,'Z2',1,5));
  add(0,1, D('run','VO2max piste',65,11.9,95,'Z5',1,9)); // 10×300m r1
  add(0,2, D('bike','Endurance fondamentale',180,53.1,135,'Z2',1,7));
  add(0,2, D('run','Footing facile',45,8.5,42,'Z2',1,5));
  add(0,3, D('swim','Natation club',75,0,55,'Z2',1,5));
  add(0,3, D('run','Actif',76,18.8,72,'Z3',1,6));
  add(0,4, D('bike','Endurance fondamentale',120,86.3,130,'Z2',0)); // aujourd'hui, à faire
  add(0,4, D('swim','Natation club',75,0,55,'Z2',0));
  add(0,5, D('bike','Endurance + LT1',220,0,175,'Z3',0)); // samedi à venir
  add(0,5, D('run','Footing facile',60,0,55,'Z2',0));
  add(0,6, D('bike','Endurance fondamentale',90,0,75,'Z2',0)); // dimanche à venir
  add(0,6, D('run','SV2',72,0,90,'Z4',0));
})();


/* ---- utilitaires dates ---- */
function mondayOf(offset){
  const d = new Date(); d.setHours(0,0,0,0);
  const day = (d.getDay()+6)%7;
  d.setDate(d.getDate()-day+offset*7);
  return d;
}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function iso(d){return d.toISOString().slice(0,10)}
const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const fmt = new Intl.DateTimeFormat(localeStr(),{day:'numeric',month:'short'});

/* ---- état check-in & records (démo — à brancher au backend) ---- */
const checkin = { sommeil:7, fatigue:4, motivation:8, poids:70, dispo:'ok', dispoNote:'', hrv:null, cyclePhase:null, cycleDay:null };
const RECORDS = [
  {d:'10 km', v:'31:45', isNew:true},
  {d:'Semi', v:'1:08:52', isNew:true},
  {d:'FTP', v:'310 W', isNew:false},
  {d:'PMA', v:'415 W', isNew:false}
];
/* ---- Fiche athlète (coach) : VO2max, parcours, records, blessures, habitudes.
   Indexée par athlète (contrairement à ATHLETE_REF/RECORDS ci-dessus qui sont
   des singletons "athlète actuellement affiché", pensés pour l'auto-édition
   côté athlète). 100% front pour l'instant, pas de colonne backend dédiée. */
let ATHLETE_PROFILES = {};
function athleteProfile(aid){
  if(!ATHLETE_PROFILES[aid]) ATHLETE_PROFILES[aid] = {vo2max:null, background:'', records:[], injuries:[], diet:'', work:''};
  return ATHLETE_PROFILES[aid];
}

/* ============================================================
   DÉBRIEF POST-COURSE — journal de course de l'athlète
   ------------------------------------------------------------
   Indexé par id athlète (comme ATHLETE_PROFILES) : sert à la fois la vue
   Athlète (ses propres débriefs) et la Fiche athlète du coach (lecture
   seule). Persisté côté réel (table race_debriefs) ; en démo, un seul
   débrief d'exemple sur Léa (a1) pour montrer la fonctionnalité.
   ============================================================ */
let RACE_DEBRIEFS = { a1: [
  { race:"Gorillaman · Sprint 2025", date:'2025-06-14', result:"1h12'30",
    felt:"Très bon négatif split sur la course à pied, jambes fraîches jusqu'au bout.",
    nutrition:'oui', weather:'Chaud, 27°C, peu de vent',
    good:'Transition vélo → course fluide, pas de point de côté.',
    bad:'Crampe au mollet gauche dans les 2 derniers km.' }
]};
function debriefsFor(aid){ return RACE_DEBRIEFS[aid] || (RACE_DEBRIEFS[aid]=[]); }
/* clé de "mes" débriefs en vue Athlète : mon id réel une fois connecté,
   sinon Léa (a1) en démo (c'est elle qu'incarne la vue Athlète démo). */
function myDebriefKey(){ return (window.PF?.user) ? PF.user.id : 'a1'; }
function debriefItemHTML(d){
  const bits=[]; if(d.result) bits.push(dispoSafe(d.result)); if(d.felt) bits.push(dispoSafe(d.felt));
  return `<div class="sn-item"><div class="sn-when">${dispoSafe(d.race)} — ${d.date?fmtDateFr(new Date(d.date+'T12:00:00')):''}</div><div class="sn-txt">${bits.join(' · ')||'—'}</div></div>`;
}
function debriefsBlockHTML(list, emptyTxt){
  if(!list || !list.length) return `<p class="club-hint">${emptyTxt}</p>`;
  const sorted = list.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  return `<div class="sn-block" style="margin-top:0"><div class="sn-head"><i class="ic ic-flag"></i> Débriefs de course</div>${sorted.map(debriefItemHTML).join('')}</div>`;
}

/* ============================================================
   ÉQUIPE DE COACHS (co-coaching)
   ------------------------------------------------------------
   Un athlète peut avoir plusieurs coachs (coach vélo + coach course,
   ou nutritionniste/data analyst + entraîneur principal) — DÉCISION :
   accès complet pour tous les coachs liés, le rôle n'est qu'une
   étiquette d'affichage (pas de moteur de permissions par domaine).
   Ajout à double consentement : celui qui n'initie PAS la demande
   valide (coach existant ↔ athlète) ; le coach visé doit déjà avoir
   un compte Sillance (pas d'onboarding coach par email en v1).
   ============================================================ */
let CO_TEAM = { a1: [
  {id:'ct1', coachId:'demo-principal', roleLabel:'Principal', coach:{full_name:'Toi (coach démo)'}},
  {id:'ct2', coachId:'demo-nutri', roleLabel:'Nutrition', coach:{full_name:'Camille Aubert'}},
]};
let CO_PENDING = { a1: [
  {id:'ccr1', coachEmail:'julien.velo@example.com', roleLabel:'Vélo', requestedByRole:'coach'},
]};
function coTeamFor(aid){ return CO_TEAM[aid] || (CO_TEAM[aid]=[]); }
function coPendingFor(aid){ return CO_PENDING[aid] || (CO_PENDING[aid]=[]); }
function coTeamItemHTML(t){
  return `<div class="sn-item"><div class="sn-when">${dispoSafe(t.roleLabel||'Coach')}</div><div class="sn-txt">${dispoSafe((t.coach&&(t.coach.full_name||t.coach.email))||'Coach')}</div></div>`;
}
/* canDecide = le viewer courant n'est pas à l'origine de la demande donc
   c'est à lui de valider/refuser ; sinon lecture seule "en attente". */
function coPendingItemHTML(r, viewerRole, aid){
  const canDecide = r.requestedByRole !== viewerRole;
  const who = r.requestedByRole==='coach' ? 'un coach' : "l'athlète";
  return `<div class="sn-item">
    <div class="sn-when">${dispoSafe(r.roleLabel||'Coach')}</div>
    <div class="sn-txt">${dispoSafe(r.coachEmail)} — proposé par ${who}
      ${canDecide ? `<div style="margin-top:6px;display:flex;gap:8px">
        <button class="btn" style="padding:5px 12px;font-size:11.5px" data-cc-approve="${r.id}" data-cc-aid="${aid}">Valider</button>
        <button class="group-edit" style="padding:5px 12px;font-size:11.5px" data-cc-decline="${r.id}" data-cc-aid="${aid}">Refuser</button>
      </div>` : `<div style="margin-top:4px;color:var(--muted);font-size:11.5px">En attente de validation…</div>`}
    </div>
  </div>`;
}
function coTeamBlockHTML(aid, viewerRole){
  const team = coTeamFor(aid), pending = coPendingFor(aid);
  const teamHtml = team.length ? team.map(coTeamItemHTML).join('') : `<p class="club-hint">Aucun coach supplémentaire pour l'instant.</p>`;
  const pendingHtml = pending.length ? pending.map(r=>coPendingItemHTML(r,viewerRole,aid)).join('') : '';
  return `<div class="sn-block" style="margin-top:0">
    <div class="sn-head"><i class="ic ic-users"></i> Équipe de coachs</div>
    ${teamHtml}
    ${pendingHtml}
    <button class="group-edit" style="margin-top:8px" data-cc-invite="${aid}" data-cc-role="${viewerRole}">+ Proposer un coach</button>
  </div>`;
}
function wireCoTeamActions(container){
  if(!container) return;
  container.querySelectorAll('[data-cc-approve]').forEach(b=> b.onclick=()=> decideCoCoach(b.dataset.ccApprove, b.dataset.ccAid, 'approve'));
  container.querySelectorAll('[data-cc-decline]').forEach(b=> b.onclick=()=> decideCoCoach(b.dataset.ccDecline, b.dataset.ccAid, 'decline'));
  container.querySelectorAll('[data-cc-invite]').forEach(b=> b.onclick=()=> openCoCoachInvite(b.dataset.ccInvite, b.dataset.ccRole));
}
let coCoachTargetAthleteId = null, coCoachViewerRole = null;
function openCoCoachInvite(athleteId, viewerRole){
  coCoachTargetAthleteId = athleteId; coCoachViewerRole = viewerRole;
  document.getElementById('ccEmail').value = '';
  document.getElementById('ccRole').value = '';
  const hint = document.getElementById('ccHint');
  if(hint) hint.textContent = viewerRole==='athlete'
    ? "Le coach doit déjà avoir un compte Sillance. Un de tes coachs actuels devra valider avant que l'accès soit actif."
    : "Le coach doit déjà avoir un compte Sillance. L'athlète devra valider avant que l'accès soit actif.";
  document.getElementById('coCoachOverlay').classList.add('open');
}
function saveCoCoachInvite(){
  const email = document.getElementById('ccEmail').value.trim();
  const role = document.getElementById('ccRole').value.trim();
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast(tr('toast.renseigneEmailValide')); return; }
  const aid = coCoachTargetAthleteId;
  coPendingFor(aid).unshift({id:'ccr'+Date.now(), coachEmail:email, roleLabel:role||null, requestedByRole:coCoachViewerRole});
  if(window.PF?.user){
    PF.requestCoCoach(aid, email, role||null).catch(e=>{ console.warn('[PF] requestCoCoach', e); toast("Demande indisponible pour l'instant", 'error'); });
  }
  document.getElementById('coCoachOverlay').classList.remove('open');
  toast(tr('toast.demandeEnvoyeeEnAttenteValidation'));
  if(document.getElementById('profileOverlay')?.classList.contains('open')) renderProfCoTeam(aid);
  if(mode==='athlete') renderSidebar();
}
function decideCoCoach(id, aid, decision){
  const list = coPendingFor(aid);
  const idx = list.findIndex(r=>r.id===id);
  if(idx>-1){
    if(decision==='approve'){
      const r = list[idx];
      coTeamFor(aid).push({id:'ct'+Date.now(), coachId:null, roleLabel:r.roleLabel, coach:{full_name:r.coachEmail}});
    }
    list.splice(idx,1);
  }
  if(window.PF?.user){
    PF.approveCoCoach(id, decision).catch(e=> console.warn('[PF] approveCoCoach', e));
  }
  toast(decision==='approve' ? 'Coach ajouté à l\'équipe' : 'Demande refusée');
  if(document.getElementById('profileOverlay')?.classList.contains('open')) renderProfCoTeam(aid);
  if(mode==='athlete') renderSidebar();
}
(function initCoCoach(){
  const ov=document.getElementById('coCoachOverlay'); if(!ov) return;
  document.getElementById('coCoachSave').addEventListener('click', saveCoCoachInvite);
  document.getElementById('coCoachClose').addEventListener('click', ()=> ov.classList.remove('open'));
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); });
})();
function readinessScore(){
  return Math.round((checkin.sommeil + (10-checkin.fatigue) + checkin.motivation)/30*100);
}
function readinessAdvice(s){
  if(s>=75) return {c:'var(--good)', t:'Feu vert — la qualité passera bien aujourd\'hui'};
  if(s>=55) return {c:'var(--bike)', t:'Correct — séance OK, garde une marge sur l\'intensité'};
  return {c:'var(--run)', t:'Fatigue marquée — privilégie du Z1/Z2 ou du repos, préviens ton coach'};
}

/* ---- sidebar dynamique selon le mode ---- */
const AI_ADDON_PRICE = 12; // €/mois — add-on Assistant IA (voir plan financier)
const sidebarContent = document.getElementById('sidebarContent');
function coachGuideHTML(){
  if(localStorage.getItem('sil_coach_guide')==='off') return '';
  return `
      <div class="startguide" id="startGuide">
        <div class="sg-head"><b><i class="ic ic-lightbulb"></i> Par où commencer</b><button class="sg-x" id="sgClose" title="Masquer"><i class="ic ic-x"></i></button></div>
        <p class="sg-sub">4 étapes pour lancer ton coaching.</p>
        <ol class="sg-steps">
          <li><b>Crée tes séances</b> : ta bibliothèque, ou un cycle complet d'un coup.</li>
          <li><b>Ajoute un athlète</b> : invite-le par e-mail, il voit son plan.</li>
          <li><b>Connecte sa montre</b> : Garmin, Coros ou .FIT, ses séances remontent analysées.</li>
          <li><b>Planifie sa semaine</b> : glisse tes séances sur le calendrier.</li>
        </ol>
        <button class="sg-cta" id="sgCta">Créer ma première séance</button>
      </div>`;
}
/* ============================================================
   RADAR "QUI A BESOIN DE MOI CETTE SEMAINE"
   ------------------------------------------------------------
   Trie le roster par urgence au lieu de forcer le coach à cliquer
   athlète par athlète. Volontairement basé UNIQUEMENT sur des signaux
   fiables en démo ET en réel (checkin du jour, refs physio) — pas sur
   l'adhérence (a.comp), qui n'existe que côté démo et donnerait une
   fausse impression de fiabilité pour un vrai coach.
   ============================================================ */
function athNeedScore(a){
  let score=0; const reasons=[];
  const dk = athDispo(a);
  if(dk==='blesse'){ score+=100; reasons.push('Blessé'); }
  else if(dk==='malade'){ score+=70; reasons.push('Malade'); }
  else if(dk==='fatigue'){ score+=40; reasons.push('Fatigué'); }
  const forme = athForme(a);
  if(forme!=null && forme<55){ score+=30; reasons.push(`Forme basse (${forme}%)`); }
  const hs = a.checkin && hrvStatus(a.checkin.hrv, ATHLETE_REF.hrvBase);
  if(hs && hs.level==='low'){ score+=35; reasons.push('HRV basse'); }
  if(a.refsUpdatedAt){
    const days = Math.floor((Date.now()-new Date(a.refsUpdatedAt).getTime())/86400000);
    if(days>=90){ score+=15; reasons.push(`Zones à retester (${days} j)`); }
  }
  if(!a.checkin){ score+=8; reasons.push("Pas de check-in aujourd'hui"); }
  return {score, reasons};
}
function needRadarHTML(){
  if(!ROSTER.length) return '';
  const scored = ROSTER.map(a=>({a, ...athNeedScore(a)})).filter(x=>x.score>0).sort((x,y)=>y.score-x.score).slice(0,5);
  if(!scored.length) return `<div class="sn-block" style="margin-bottom:14px"><div class="sn-head"><i class="ic ic-check"></i> Qui a besoin de toi</div><p class="club-hint">Rien d'urgent — le roster est propre aujourd'hui.</p></div>`;
  return `<div class="sn-block" style="margin-bottom:14px"><div class="sn-head"><i class="ic ic-alert-triangle"></i> Qui a besoin de toi cette semaine</div>
    ${scored.map(({a,reasons})=>`<div class="sn-item" style="cursor:pointer" data-need-aid="${a.id}"><div class="sn-when">${dispoSafe(a.name)}</div><div class="sn-txt">${reasons.map(dispoSafe).join(' · ')}</div></div>`).join('')}
  </div>`;
}
function renderSidebar(){
  if(mode==='coach'){
    sidebarContent.innerHTML = coachGuideHTML() + needRadarHTML() + `
      <button class="btn adh-open-btn" id="adhOpen"><i class="ic ic-users"></i> ${tr('sidebar.myAthletesTracking')}</button>
      <button class="btn adh-open-btn" id="inviteAthOpen" style="margin-top:8px"><i class="ic ic-user-plus"></i> ${tr('sidebar.inviteAthlete')}</button>
      <h2>${tr('sidebar.library')}</h2>
      <p class="hint">${tr('sidebar.libraryHint')}</p>
      <button class="create-btn" id="createSessionBtn">+ ${tr('sidebar.createSession')}</button>
      <div id="tplList" style="margin-top:12px"></div>
      <h2 style="margin-top:20px">${tr('sidebar.cycles')}</h2>
      <p class="hint">${tr('sidebar.cyclesHint')}</p>
      <button class="create-btn" id="createCycleBtn">+ ${tr('sidebar.createCycle')}</button>
      <div id="cycleList" style="margin-top:12px"></div>
      <div class="lib-note"><i class="ic ic-lightbulb"></i> <b>${tr('sidebar.coachTip')}</b> ${tr('sidebar.coachTipText')}</div>
      <div class="readiness" style="margin-top:14px">
        <div class="lbl">${tr('sidebar.athleteFreshness')}</div>
        <div class="score" style="color:${readinessAdvice(readinessScore()).c}">${readinessScore()}%</div>
      </div>
      <div class="coach-connect" style="margin-top:14px">
        <div class="cc-t"><b>⭐ ${tr('sidebar.sillanceSub')}</b></div>
        ${window.__pf_subscribed
          ? `<div class="cc-s" style="color:#39e6a3"><i class="ic ic-check"></i> ${tr('sidebar.subActive')}</div>
             <button class="cc-btn" id="coachManageBtn">${tr('sidebar.manageSub')}</button>`
          : `<div class="cc-s">${tr('sidebar.unlockCoach')}</div>
             ${coachTiersHTML()}
             <button class="cc-btn" id="coachSubscribeBtn" style="margin-top:10px">${tr('sidebar.subscribe')} — ${COACH_TIERS.find(t=>t.id===selectedCoachTier).price} €/${tr('sidebar.perMonth')}</button>`}
      </div>
      <div class="coach-connect" style="margin-top:14px;opacity:.7">
        <div class="cc-t"><b><i class="ic ic-brain"></i> ${tr('sidebar.aiAssistant')}</b> <span class="cc-soon">${tr('sidebar.comingSoon')}</span></div>
        <div class="cc-s">${tr('sidebar.aiAssistantText')}</div>
      </div>
      <div class="coach-connect" style="margin-top:14px">
        <div class="cc-t"><b><i class="ic ic-credit-card"></i> ${tr('sidebar.getPaid')}</b></div>
        <div class="cc-s">${tr('sidebar.getPaidText')}</div>
        <div class="cc-price">${tr('sidebar.trackingRate')} <b id="coachPriceVal">${COACH_OFFER.price} €</b><small>/${tr('sidebar.perMonth')}</small> · <a href="#" id="coachPriceEdit">${tr('sidebar.edit')}</a></div>
        <button class="cc-btn" id="coachConnectBtn">${tr('sidebar.connectStripe')}</button>
        <button class="cc-btn" id="coachInvoicesBtn" style="margin-top:8px">${tr('sidebar.seeInvoices')}</button>
      </div>`;
    buildTemplates(document.getElementById('tplList'));
    document.getElementById('createSessionBtn').addEventListener('click', ()=> openBuilder(null, null));
    var _sgClose=document.getElementById('sgClose'); if(_sgClose) _sgClose.onclick=function(){ localStorage.setItem('sil_coach_guide','off'); renderSidebar(); };
    var _sgCta=document.getElementById('sgCta'); if(_sgCta) _sgCta.onclick=function(){ openBuilder(null,null); };
    var _adhOpen=document.getElementById('adhOpen'); if(_adhOpen) _adhOpen.onclick=openAdherence;
    sidebarContent.querySelectorAll('[data-need-aid]').forEach(el=> el.onclick=()=>{
      const idx = ROSTER.findIndex(x=>x.id===el.dataset.needAid);
      if(idx>-1){ selectAthlete(idx); render(); }
    });
    var _invAthOpen=document.getElementById('inviteAthOpen'); if(_invAthOpen) _invAthOpen.onclick=openInviteAthlete;
    buildCycles(document.getElementById('cycleList'));
    document.getElementById('createCycleBtn').addEventListener('click', ()=> openCycleBuilder(null));
    /* Assistant IA — essai 14 jours (checkout Stripe connecté, déverrouillage en démo) */
    const aiT=document.getElementById('aiTrialBtn');
    if(aiT) aiT.onclick=()=>{
      if(window.PF?.user && PF.subscribeAiAddon){ PF.subscribeAiAddon().catch(e=>{console.warn('[PF] ai-addon:',e); toast(tr('toast.stripeIndisponible'), 'error');}); return; }
      window.__pf_aiDemo=true; window.__pf_aiDemoStart=Date.now(); renderSidebar(); toast(tr('toast.assistantIaActiveEssai14'));
    };
    const aiM=document.getElementById('aiManageBtn');
    if(aiM) aiM.onclick=()=> openSettings('coach');
    const ccb=document.getElementById('coachConnectBtn');
    if(ccb) ccb.onclick=()=>{
      if(window.PF?.user) PF.connectCoachStripe().catch(e=>{console.warn(e);toast(tr('toast.stripeIndisponible'), 'error');});
      else toast(tr('toast.connecteEspaceCoachPourRelier'));
    };
    const cib=document.getElementById('coachInvoicesBtn');
    if(cib) cib.onclick=()=> openCoachInvoices();
    wireCoachTiers(sidebarContent);
    const csb=document.getElementById('coachSubscribeBtn');
    if(csb) csb.onclick=()=>{
      if(window.PF?.user){ toast(tr('toast.redirectionVersPaiement')); PF.startCheckout('coach', selectedCoachTier).catch(e=>{console.warn(e);toast(tr('toast.paiementIndisponible'), 'error');}); }
      else toast(tr('toast.connecteEspaceCoachPourT'));
    };
    const cmb=document.getElementById('coachManageBtn');
    if(cmb) cmb.onclick=()=> openSettings('structure');
    const cpe=document.getElementById('coachPriceEdit');
    if(cpe) cpe.onclick=(ev)=>{
      ev.preventDefault();
      const v=prompt(tr('sidebar.pricePrompt'), COACH_OFFER.price);
      if(v!==null && !isNaN(+v) && v!==''){
        COACH_OFFER.price=+v;
        const pv=document.getElementById('coachPriceVal'); if(pv) pv.textContent=COACH_OFFER.price+' €';
        toast(tr('toast.tarifCoachingMisAJour'));
        if(window.PF?.user) PF.saveCoachOffer({name:COACH_OFFER.name, price:COACH_OFFER.price}).catch(er=>console.warn('saveCoachOffer',er));
      }
    };
  } else {
    const s = readinessScore(), adv = readinessAdvice(s);
    sidebarContent.innerHTML = `
      <h2>${tr('checkin.title')}</h2>
      <p class="hint">${tr('checkin.hint')}</p>
      <div class="checkin">
        ${[['sommeil',tr('checkin.sleep'),'ic-moon'],['fatigue',tr('checkin.legFatigue'),'ic-battery'],['motivation',tr('checkin.motivation'),'ic-zap']].map(([k,l,ic])=>`
        <div class="row">
          <label><i class="ic ${ic}"></i> ${l}<span class="val" id="val-${k}">${checkin[k]}/10</span></label>
          <input type="range" min="1" max="10" value="${checkin[k]}" data-k="${k}" aria-label="${l}">
        </div>`).join('')}
        <div class="row ck-weight">
          <label>${tr('checkin.weight')}<span class="val" id="val-poids">${checkin.poids} kg</span></label>
          <div class="ck-wrow">
            <input type="number" min="30" max="150" step="0.1" value="${checkin.poids}" id="ckPoids" aria-label="${tr('checkin.weightAria')}">
            <span class="ck-wkg" id="ckWkg">${ATHLETE_REF.ftp?(ATHLETE_REF.ftp/checkin.poids).toFixed(2)+' W/kg':''}</span>
          </div>
        </div>
        <div class="row ck-hrv">
          <label><i class="ic ic-refresh"></i> ${tr('checkin.hrvMorning')} <span class="ck-hrv-opt">${tr('checkin.hrvOptional')}</span></label>
          <div class="ck-wrow">
            <input type="number" min="10" max="200" step="1" value="${checkin.hrv||''}" id="ckHrv" placeholder="rMSSD (ms)" aria-label="${tr('checkin.hrvAria')}">
            <span class="ck-hrv-stat" id="ckHrvStat"></span>
          </div>
        </div>
        <div class="row ck-dispo">
          <label><i class="ic ic-clipboard"></i> ${tr('checkin.availability')}</label>
          <div class="ck-dispo-seg" id="ckDispoSeg" role="group" aria-label="${tr('checkin.availabilityAria')}">
            ${Object.entries(DISPO_META).map(([k,d])=>`<button type="button" data-dispo="${k}" class="${(checkin.dispo||'ok')===k?'sel':''}" style="--dc:${d.c}"><i class="ic ${d.ic}"></i>${d.l}</button>`).join('')}
          </div>
          <textarea id="ckDispoNote" rows="2" placeholder="${tr('checkin.notePlaceholder')}" ${(checkin.dispo||'ok')==='ok'?'hidden':''}>${dispoSafe(checkin.dispoNote)}</textarea>
        </div>
        ${(()=>{ const on = localStorage.getItem('sil_track_cycle')==='1' || checkin.cyclePhase; return `
        <div class="row ck-cycle">
          ${on ? `
          <label><i class="ic ic-waves"></i> ${tr('checkin.cycleTitle')} <button type="button" class="ck-cycle-off" id="ckCycleOff" title="${tr('checkin.cycleStopTracking')}">${tr('checkin.hide')}</button></label>
          <div class="ck-cycle-day">
            <span>${tr('checkin.cycleDay')}</span>
            <input type="number" min="1" max="40" value="${checkin.cycleDay||''}" id="ckCycleDay" placeholder="J—" aria-label="${tr('checkin.cycleDayAria')}">
            <span class="ck-cycle-hint">${tr('checkin.cycleOrChoose')}</span>
          </div>
          <div class="ck-cycle-seg" id="ckCycleSeg" role="group" aria-label="${tr('checkin.cyclePhaseAria')}">
            ${Object.entries(CYCLE_META).map(([k,d])=>`<button type="button" data-cyc="${k}" class="${checkin.cyclePhase===k?'sel':''}" style="--cc:${d.c}"><i class="ic ${d.ic}"></i>${d.l}<small>${d.short}</small></button>`).join('')}
          </div>
          <div class="ck-cycle-tip" id="ckCycleTip">${checkin.cyclePhase?CYCLE_META[checkin.cyclePhase].tip:''}</div>
          ` : `<button type="button" class="ck-cycle-optin" id="ckCycleOptin"><i class="ic ic-waves"></i> ${tr('checkin.cycleOptin')}</button>
               <div class="ck-cycle-note">${tr('checkin.cycleNote')}</div>`}
        </div>`; })()}
        <div class="readiness">
          <div class="lbl">${tr('checkin.freshness')}</div>
          <div class="score" id="readyScore" style="color:${adv.c}">${s}%</div>
          <div class="advice" id="readyAdvice" style="color:${adv.c}">${adv.t}</div>
        </div>
        <button class="btn checkin-validate" id="checkinValidate" style="width:100%;margin-top:10px">${tr('checkin.validate')}</button>
      </div>
      <div class="records">
        <h2>${tr('records.title')}</h2>
        ${RECORDS.length ? RECORDS.map(r=>`<div class="pb"><span class="d">${r.d}</span>${r.isNew?'<span class="new">NEW</span>':''}<span class="v">${r.v}</span></div>`).join('') : `<p class="club-hint">${tr('records.empty')}</p>`}
      </div>
      <div class="records" id="refsBlock">
        <h2>${tr('refs.title')}</h2>
        <p class="club-hint" style="margin:2px 0 8px">${(()=>{ if(!ATHLETE_REF.updatedAt) return tr('refs.never'); const days=Math.floor((Date.now()-new Date(ATHLETE_REF.updatedAt).getTime())/86400000); return tr('refs.lastUpdate', {days}) + (days>=90?' — '+tr('refs.retest'):''); })()}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          ${[['ftp','FTP','W'],['pma',tr('refs.map'),'W'],['cpBike',tr('refs.bikeCp'),'W'],['vma',tr('refs.vVo2max'),'km/h'],['cv','CV','km/h'],['seuilRun',tr('refs.threshold'),'s/km'],['css','CSS','s/100m'],['fcMax',tr('refs.maxHr'),'bpm'],['fcRepos',tr('refs.restHr'),'bpm']].map(([k,l,u])=>`
          <label style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--muted)"><span>${l} <em style="font-style:normal;opacity:.65">${u}</em></span>
            <input type="number" step="any" data-ref="${k}" value="${ATHLETE_REF[k]??''}" style="width:100%;box-sizing:border-box"></label>`).join('')}
        </div>
        <button class="btn" id="refsSave" style="width:100%;margin-top:10px">${tr('refs.save')}</button>
      </div>
      <div class="records" id="debriefCard">
        ${debriefsBlockHTML(debriefsFor(myDebriefKey()), tr('debrief.empty'))}
        <button class="btn" id="debriefAddBtn" style="width:100%;margin-top:10px"><i class="ic ic-flag"></i> ${tr('debrief.add')}</button>
      </div>
      <div class="records" id="coTeamCard">${coTeamBlockHTML(myDebriefKey(), 'athlete')}</div>
      ${currentRace() ? `<button class="btn adh-open-btn" id="athShareSpecBtn"><i class="ic ic-link"></i> ${tr('race.shareWithLoved')}</button>` : ''}
      <div class="strava-card" id="stravaCard"></div>
      <div class="coach-sub" id="coachSubCard">
        <h2>${tr('coachSub.title')}</h2>
        <p class="hint" style="margin-bottom:10px">${tr('coachSub.text')}</p>
        <div class="cs-offer"><span class="cs-name">${COACH_OFFER.name}</span><span class="cs-price">${COACH_OFFER.price} €<small>/${tr('sidebar.perMonth')}</small></span></div>
        <button class="btn coach-sub-btn" id="coachSubBtn">${tr('coachSub.subscribe')}</button>
      </div>
      <div class="morning-card">
        <h2>${tr('morning.title')}</h2>
        <p class="hint" style="margin-bottom:10px">${tr('morning.text')}</p>
        <div class="morning-pre" id="morningPre"></div>
        <div class="morning-time">
          <label for="morningHour">${tr('morning.sendTime')}</label>
          <input type="time" id="morningHour" value="07:00" step="900">
        </div>
        <div class="morning-time">
          <label for="morningChannel">${tr('morning.wantToReceive')}</label>
          <select id="morningChannel">
            <option value="push">${tr('morning.push')}</option>
            <option value="email">${tr('morning.email')}</option>
            <option value="both">${tr('morning.both')}</option>
          </select>
        </div>
        <button class="btn morning-btn" id="morningBtn"><i class="ic ic-bell"></i> ${tr('morning.activate')}</button>
        <a class="morning-help" href="./notification-tuto.pdf" target="_blank" rel="noopener">${tr('morning.howTo')}</a>
      </div>`;
    sidebarContent.querySelectorAll('input[type=range]').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        checkin[inp.dataset.k] = +inp.value;
        document.getElementById('val-'+inp.dataset.k).textContent = inp.value+'/10';
        const sc = readinessScore(), a = readinessAdvice(sc);
        const el1 = document.getElementById('readyScore'), el2 = document.getElementById('readyAdvice');
        el1.textContent = sc+'%'; el1.style.color = a.c;
        el2.textContent = a.t; el2.style.color = a.c;
        if(typeof renderReadiness==='function') renderReadiness();
      });
    });
    (function(){ var wp=document.getElementById('ckPoids'); if(wp) wp.addEventListener('input',function(){ var v=parseFloat(wp.value); if(!v||v<30||v>150) return; checkin.poids=v; var vl=document.getElementById('val-poids'); if(vl) vl.textContent=v+' kg'; var w=document.getElementById('ckWkg'); if(w&&ATHLETE_REF.ftp) w.textContent=(ATHLETE_REF.ftp/v).toFixed(2)+' W/kg'; }); })();
    (function(){
      var hp=document.getElementById('ckHrv'), st=document.getElementById('ckHrvStat');
      function upd(){
        var v=parseFloat(hp.value); checkin.hrv = (v&&v>=10&&v<=200)?Math.round(v):null;
        var s=hrvStatus(checkin.hrv, ATHLETE_REF.hrvBase);
        if(st){ if(s){ st.textContent=(s.pct>0?'+':'')+s.pct+'% · '+s.txt; st.style.color=s.c; } else { st.textContent = ATHLETE_REF.hrvBase?('base '+ATHLETE_REF.hrvBase+' ms'):''; st.style.color='var(--muted)'; } }
      }
      if(hp){ hp.addEventListener('input', upd); upd(); }
    })();
    (function(){
      var optin=document.getElementById('ckCycleOptin');
      if(optin) optin.onclick=function(){ localStorage.setItem('sil_track_cycle','1'); renderSidebar(); };
      var off=document.getElementById('ckCycleOff');
      if(off) off.onclick=function(){ localStorage.removeItem('sil_track_cycle'); checkin.cyclePhase=null; checkin.cycleDay=null; renderSidebar(); };
      var seg=document.getElementById('ckCycleSeg'), tip=document.getElementById('ckCycleTip'), dayIn=document.getElementById('ckCycleDay');
      function paint(){
        if(seg) seg.querySelectorAll('button').forEach(function(b){ b.classList.toggle('sel', b.dataset.cyc===checkin.cyclePhase); });
        if(tip) tip.textContent = checkin.cyclePhase?CYCLE_META[checkin.cyclePhase].tip:'';
      }
      if(seg) seg.querySelectorAll('button').forEach(function(b){ b.onclick=function(){ checkin.cyclePhase=b.dataset.cyc; paint(); }; });
      if(dayIn) dayIn.addEventListener('input', function(){ var v=parseInt(dayIn.value,10); checkin.cycleDay=(v>=1&&v<=40)?v:null; var ph=cyclePhaseFromDay(checkin.cycleDay); if(ph){ checkin.cyclePhase=ph; paint(); } });
    })();
    (function(){
      const seg=document.getElementById('ckDispoSeg'), note=document.getElementById('ckDispoNote');
      if(!seg) return;
      seg.querySelectorAll('button').forEach(b=> b.onclick=()=>{
        checkin.dispo=b.dataset.dispo;
        seg.querySelectorAll('button').forEach(x=>x.classList.toggle('sel',x===b));
        if(note){ note.hidden = checkin.dispo==='ok'; if(!note.hidden) note.focus(); }
      });
      if(note) note.addEventListener('input', ()=>{ checkin.dispoNote=note.value.trim(); });
    })();
    buildMorningPreview();
    renderStravaCard();
    const csb=document.getElementById('coachSubBtn');
    if(csb) csb.onclick=()=>{
      if(window.PF?.user) PF.subscribeToCoach().catch(e=>{console.warn('subscribeToCoach',e);toast(tr('toast.suiviIndisponibleDemo'), 'error');});
      else toast(tr('toast.suiviCoachingDisponibleFoisConnecte'));
    };
    const cv = document.getElementById('checkinValidate');
    if(cv) cv.addEventListener('click', ()=> submitCheckin());
    const rs = document.getElementById('refsSave');
    if(rs) rs.addEventListener('click', ()=> saveMyRefs());
    const dab = document.getElementById('debriefAddBtn');
    if(dab) dab.addEventListener('click', ()=> openDebrief());
    wireCoTeamActions(document.getElementById('coTeamCard'));
    const assb = document.getElementById('athShareSpecBtn');
    if(assb) assb.addEventListener('click', ()=> openSpectatorShare(myDebriefKey()));
  }
}

/* Édition des références physiologiques de l'athlète.
   Met à jour ATHLETE_REF en place (les calculs de zones du builder s'en
   servent), persiste via Sillance cloud si connecté, puis re-render. */
function saveMyRefs(){
  document.querySelectorAll('#refsBlock input[data-ref]').forEach(inp=>{
    const v = inp.value.trim();
    ATHLETE_REF[inp.dataset.ref] = v==='' ? null : +v;
  });
  ATHLETE_REF.updatedAt = new Date().toISOString();
  if(window.PF?.user){
    const m = ATHLETE_REF;
    PF.saveAthleteRefs({ ftp:m.ftp, pma:m.pma, cp_bike:m.cpBike, vma:m.vma,
      cv:m.cv, seuil_run:m.seuilRun, css:m.css, fc_max:m.fcMax, fc_repos:m.fcRepos })
      .catch(e=> console.warn('[PF] saveAthleteRefs échoué :', e));
  }
  render();
  toast(tr('toast.referencesMisesAJour'));
}

/* ============================================================
   ALERTE COACH — check-in faible (< 50% de fraîcheur)
   ------------------------------------------------------------
   À la validation du check-in athlète, on notifie le coach.
   Backend : remplacer l'ajout local + Notification par un
   POST vers l'API (push/email au coach concerné).
   ============================================================ */
const COACH_ALERTS = [];          // file d'alertes côté coach
const CHECKIN_THRESHOLD = 50;     // seuil orange (vigilance)
const CHECKIN_URGENT = 30;        // seuil rouge (urgent)
const ATHLETE_NAME = 'Romain D.'; // démo — vient du profil athlète

async function submitCheckin(){
  const score = readinessScore();
  const dispo = checkin.dispo || 'ok';
  const hrvS = hrvStatus(checkin.hrv, ATHLETE_REF.hrvBase);
  const hrvLow = hrvS && (hrvS.level==='low' || hrvS.level==='warn');
  // blessé/HRV effondrée = alerte prioritaire ; malade/fatigué/HRV sous base = alerte simple
  const low = score < CHECKIN_THRESHOLD || dispo !== 'ok' || hrvLow;
  const urgent = score < CHECKIN_URGENT || dispo === 'blesse' || (hrvS && hrvS.level==='low');
  // Persistance backend (Sillance cloud) — BLOQUANT : un signal comme « je suis
  // blessé » ne doit jamais afficher un succès si la sauvegarde a échoué.
  const btn = document.getElementById('checkinValidate');
  if(window.PF?.user){
    if(btn) btn.disabled=true;
    try{
      await PF.saveCheckin({ sommeil:checkin.sommeil, fatigue:checkin.fatigue,
        motivation:checkin.motivation, readiness:score,
        poids:checkin.poids||null, dispo, dispoNote:checkin.dispoNote||null, hrv:checkin.hrv||null,
        cyclePhase:checkin.cyclePhase||null, cycleDay:checkin.cycleDay||null });
    } catch(e){
      console.warn('[PF] saveCheckin échoué :', e);
      if(btn) btn.disabled=false;
      toast("Échec de l'envoi — vérifie ta connexion et réessaie", 'error');
      return;
    }
    if(btn) btn.disabled=false;
  }
  // confirmation visuelle athlète (affichée seulement après sauvegarde confirmée, ou en démo)
  toast(dispo==='blesse' ? 'Check-in envoyé — ton coach est alerté de ta blessure'
       : urgent ? 'Check-in envoyé — alerte prioritaire à ton coach'
       : low ? 'Check-in envoyé — ton coach est prévenu'
             : 'Check-in envoyé');
  if(low){
    const alert = {
      id:'al'+Date.now(),
      athlete: ATHLETE_NAME,
      score,
      level: urgent ? 'urgent' : 'warn',
      checkin: {...checkin},
      time: new Date(),
      seen:false
    };
    COACH_ALERTS.unshift(alert);
    notifyCoach(alert);
    refreshAlertBadge();
  }
}

function notifyCoach(a){
  // démo : notification navigateur (le vrai envoi se fait côté serveur)
  const pre = a.level==='urgent' ? 'URGENT' : 'Alerte';
  if('Notification' in window){
    if(Notification.permission==='granted'){
      new Notification(`${pre} ${a.athlete} — fraîcheur ${a.score}%`,
        {body:`Sommeil ${a.checkin.sommeil}/10 · Fatigue ${a.checkin.fatigue}/10 · Motiv. ${a.checkin.motivation}/10`});
    } else if(Notification.permission!=='denied'){
      Notification.requestPermission();
    }
  }
}

/* — Cloche coach : badge + menu — */
function refreshAlertBadge(){
  const badge=document.getElementById('bellBadge');
  const bell=document.getElementById('bellBtn');
  const unseen=COACH_ALERTS.filter(a=>!a.seen).length;
  const hasUrgent=COACH_ALERTS.some(a=>!a.seen && a.level==='urgent');
  if(unseen>0){ badge.hidden=false; badge.textContent=unseen; bell.classList.add('has-alert');
    badge.style.background = hasUrgent ? '#FF5470' : '#FF8A4D'; }
  else { badge.hidden=true; bell.classList.remove('has-alert'); }
}
function timeAgo(d){
  const m=Math.round((Date.now()-d.getTime())/60000);
  if(m<1) return "à l'instant"; if(m<60) return `il y a ${m} min`;
  const h=Math.round(m/60); return `il y a ${h} h`;
}
function renderAlerts(){
  const list=document.getElementById('bellList');
  // tri : urgent d'abord, puis par score croissant
  COACH_ALERTS.sort((a,b)=> (a.level==='urgent'?0:1)-(b.level==='urgent'?0:1) || a.score-b.score);
  if(!COACH_ALERTS.length){ list.innerHTML=`<div class="bell-empty">${tr('alerts.empty')}</div>`; return; }
  list.innerHTML=COACH_ALERTS.map(a=>{
    const urgent = a.level==='urgent';
    const col = urgent?'#FF5470':'#FF8A4D';
    const dk = a.checkin && a.checkin.dispo && a.checkin.dispo!=='ok' ? a.checkin.dispo : null;
    const dm = dk ? DISPO_META[dk] : null;
    const flag = dm ? `● ${dm.l.toLowerCase()}` : urgent?`● ${tr('alerts.freshnessCritical')}`:`● ${tr('alerts.freshnessLow')}`;
    return `<div class="alert-item ${a.seen?'':'unseen'}">
      <div class="alert-ring" style="--ac:${col};--p:${a.score}"><span>${a.score}</span></div>
      <div class="alert-body">
        <div class="an">${a.athlete} <span class="flag" style="color:${col}">${flag}</span></div>
        <div class="ad"><i class="ic ic-moon"></i> ${a.checkin.sommeil}/10 · <i class="ic ic-battery"></i> ${tr('alerts.fatigue')} ${a.checkin.fatigue}/10 · <i class="ic ic-zap"></i> ${a.checkin.motivation}/10</div>
        ${dm&&a.checkin.dispoNote?`<div class="ad" style="color:${dm.c}"><i class="ic ${dm.ic}"></i> ${dispoSafe(a.checkin.dispoNote)}</div>`:''}
        <div class="at">${timeAgo(a.time)}</div>
        <div class="alert-cta">
          <button data-act="adapt">${tr('alerts.adaptSession')}</button>
          <button data-act="message"><i class="ic ic-message-circle"></i> ${tr('alerts.message')}</button>
          <button data-act="dismiss">${tr('alerts.seen')}</button>
        </div>
      </div>
    </div>`;
  }).join('');
  // actions
  list.querySelectorAll('[data-act="dismiss"]').forEach((b,i)=>{
    b.addEventListener('click', ()=>{ COACH_ALERTS.splice(i,1); renderAlerts(); refreshAlertBadge(); });
  });
  list.querySelectorAll('[data-act="adapt"]').forEach(b=>{
    b.addEventListener('click', ()=>{
      document.getElementById('bellMenu').classList.remove('open');
      if(mode!=='coach'){ document.getElementById('modeCoach').click(); }
      document.getElementById('readyhub')?.scrollIntoView({behavior:'smooth'});
      toast(tr('toast.vueCoachPenseAAlleger'));
    });
  });
  list.querySelectorAll('[data-act="message"]').forEach((b,i)=>{
    b.addEventListener('click', ()=>{
      const a=COACH_ALERTS[i];
      document.getElementById('bellMenu').classList.remove('open');
      openChat(tr('alerts.chatPrefill', {score:a?a.score:''}));
    });
  });
}
const bellBtn=document.getElementById('bellBtn');
const bellMenu=document.getElementById('bellMenu');
bellBtn.addEventListener('click', e=>{
  e.stopPropagation();
  const open=bellMenu.classList.toggle('open');
  if(open){ renderAlerts(); COACH_ALERTS.forEach(a=>a.seen=true); refreshAlertBadge(); }
});
document.addEventListener('click', e=>{ if(!bellMenu.contains(e.target)&&e.target!==bellBtn) bellMenu.classList.remove('open'); });

/* démo : une alerte déjà présente pour montrer le système au coach */
(function seedDemoAlert(){
  COACH_ALERTS.push({id:'al0', athlete:'Léa M.', score:41, level:'warn',
    checkin:{sommeil:5,fatigue:7,motivation:4}, time:new Date(Date.now()-42*60000), seen:false});
  refreshAlertBadge();
})();

/* ---- Message matinal : récap séances + matériel agrégé ---- */
function buildMorningMessage(dateKey){
  const sessions = (planning[dateKey]||[]);
  if(!sessions.length) return {empty:true, title:tr('morning.restToday'), body:tr('morning.restBody')};
  const discs = [...new Set(sessions.map(s=>DISC[s.disc].label))];
  const gear = [...new Set(sessions.flatMap(gearForSession))];
  const lines = sessions.map(s=>`${discIcon(DISC[s.disc])} ${s.title} · ${fmtDur(s.dur)}`);
  return {
    empty:false,
    title:tr('morning.todayTraining', {discs:discs.join(' + ')}),
    sessions:lines,
    gear
  };
}
/* ============================================================
   NOTIFICATION DU MATIN — inscription Web Push du navigateur
   ------------------------------------------------------------
   Permission → service worker → abonnement push (clé VAPID) →
   enregistré en base (un par appareil). L'envoi quotidien est
   fait côté serveur (edge function morning-digest via cron).
   iPhone : nécessite d'ajouter le site à l'écran d'accueil
   (voir notification-tuto.pdf).
   ============================================================ */
const VAPID_PUBLIC_KEY = 'BDzIjqD-XIv4SqdtjPUm8hoiyPStpNT6sJI3w_URQNvvylfsIBj7aByCsUGSFEv7cfTbuBGEdDIn1T_s4kx-ynk';
function urlB64ToUint8(s){
  const pad = '='.repeat((4 - s.length % 4) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
async function enableMorningPush(){
  if(!('serviceWorker' in navigator) || !('Notification' in window))
    throw new Error(tr('morning.errNoNotif'));
  if(Notification.permission === 'denied')
    throw new Error(tr('morning.errBlocked'));
  if(Notification.permission !== 'granted')
    toast(tr('toast.chromeDemandePermissionCliqueAutoriser'));
  // certains navigateurs n'affichent qu'une icône discrète et la promesse reste
  // en attente : on borne à 25 s pour ne jamais laisser le bouton muet
  const perm = await Promise.race([
    Notification.requestPermission(),
    new Promise(res=> setTimeout(()=>res('timeout'), 25000)),
  ]);
  if(perm === 'timeout') throw new Error(tr('morning.errTimeout'));
  if(perm !== 'granted') throw new Error(tr('morning.errDenied'));
  const reg = await navigator.serviceWorker.register('./sillance-sw.js');
  await navigator.serviceWorker.ready;
  if(!reg.pushManager) throw new Error(tr('morning.errNoPush'));
  const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC_KEY) });
  if(window.PF?.user && PF.savePushSubscription) await PF.savePushSubscription(sub.toJSON());
  return reg;
}

function buildMorningPreview(){
  const box = document.getElementById('morningPre');
  if(!box) return;
  const todayIso = iso(new Date());
  // si aujourd'hui n'a rien (on est peut-être hors semaine affichée), prendre le 1er jour rempli de la semaine courante
  let key = todayIso;
  if(!(planning[key]||[]).length){
    const mon = mondayOf(weekOffset);
    for(let i=0;i<7;i++){ const k=iso(addDays(mon,i)); if((planning[k]||[]).length){ key=k; break; } }
  }
  const m = buildMorningMessage(key);
  if(m.empty){ box.innerHTML = `<div class="mp-title">${m.title}</div><div class="mp-body">${m.body}</div>`; return; }
  box.innerHTML = `
    <div class="mp-title">${m.title}</div>
    <ul class="mp-sessions">${m.sessions.map(l=>`<li>${l}</li>`).join('')}</ul>
    <div class="mp-gear-lbl"><i class="ic ic-backpack"></i> ${tr('morning.toBring')}</div>
    <div class="mp-gear">${m.gear.map(g=>`<span>${g}</span>`).join('')}</div>
    <button class="mp-sync" id="syncActivityBtn"><i class="ic ic-refresh"></i> ${tr('morning.syncActivity')}</button>`;

  const btn = document.getElementById('morningBtn');
  if(btn && !btn._wired){
    btn._wired = true;
    btn.addEventListener('click', async ()=>{
      const h = document.getElementById('morningHour').value || '07:00';
      const channel = document.getElementById('morningChannel').value || 'push';
      const [hh, mm] = h.split(':').map(Number);
      btn.disabled = true;
      try{
        if(channel !== 'email'){
          const reg = await enableMorningPush();
          // notification de test immédiate pour valider le canal
          reg.showNotification('Sillance — '+m.title, {body:tr('morning.toBring')+' : '+m.gear.join(', '), icon:'./icon-192.png', tag:'sillance-test'});
        }
        if(window.PF?.user && PF.saveNotifPrefs){
          await PF.saveNotifPrefs({ hour:hh, minute:mm - (mm % 15),
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone, channel });
        }
        btn.innerHTML = `<i class="ic ic-check"></i> ${tr('morning.activatedAt', {h})}`;
        btn.classList.add('on');
        if(!window.PF?.user){
          toast(tr('toast.testEnvoyeDemoConnecteToi'));
        } else {
          toast(channel==='email' ? tr('morning.emailActivatedAt', {h})
               : channel==='both' ? tr('morning.bothActivatedAt', {h})
               : tr('morning.pushActivatedAt', {h}));
        }
      }catch(e){
        console.warn('[notif]', e);
        toast(e && e.message ? e.message : tr('morning.errNoActivate'), 'error');
      }finally{ btn.disabled = false; }
    });
  }
  // synchro activité → notification nutrition post-effort
  const sync = document.getElementById('syncActivityBtn');
  if(sync){
    sync.addEventListener('click', ()=>{
      const todaySessions = (planning[key]||[]);
      // on prend la séance la plus "marquante" du jour (longue ou intense)
      const s = todaySessions.slice().sort((a,b)=> (b.dur||0)-(a.dur||0))[0];
      if(!s) return;
      sync.textContent=tr('morning.activitySynced');
      sync.classList.add('done');
      const reminder = nutritionReminder(s);
      const n = nutritionForSession(s);
      toast(tr('morning.activityReceived', {reminder}));
      if('Notification' in window){
        if(Notification.permission==='granted'){
          new Notification(tr('morning.notifRecoveryTitle'), {body:tr('morning.notifRecoveryBody', {reminder})+' '+n.post});
        } else if(Notification.permission!=='denied'){
          Notification.requestPermission().then(p=>{ if(p==='granted') new Notification(tr('morning.notifRecoveryTitle'), {body:tr('morning.notifRecoveryBody', {reminder})}); });
        }
      }
    });
  }
}

/* ============================================================
   CONNEXION STRAVA (interface)
   ------------------------------------------------------------
   La vraie connexion OAuth nécessite un SERVEUR (le client
   secret ne doit jamais être dans cette page). Voir le guide
   d'intégration livré séparément.
   Ici : l'interface complète + une synchro simulée pour la démo.
   Backend : remplacer connectStrava()/syncStrava() par les appels
   réels (redirection OAuth puis fetch des activités via ton API).
   ============================================================ */
let stravaConnected = false;
let stravaActivities = [];     // activités importées (démo)
/* Profils de démo d'activités synchronisées (multi-plateforme : src = source).
   Utilisés uniquement en mode démo ; le sélecteur dans la carte permet d'en
   changer pour choisir le rendu préféré. */
const STRAVA_DEMO_SETS = {
  triathlete: [
    {disc:'bike', name:'Sortie longue vallonnée',     dur:210, dist:72.4, date:'auj.',      src:'strava'},
    {disc:'swim', name:'Nat. seuil 8×100m',           dur:60,  dist:3.2,  date:'auj.',      src:'garmin'},
    {disc:'run',  name:'Brick run post-vélo',         dur:25,  dist:5.3,  date:'hier',      src:'strava'},
    {disc:'run',  name:'Footing récup',               dur:42,  dist:8.1,  date:'hier',      src:'coros'},
    {disc:'bike', name:'Home-trainer Z2',             dur:75,  dist:34.0, date:'il y a 2 j',src:'garmin'},
    {disc:'swim', name:'Technique + pull-buoy',       dur:50,  dist:2.4,  date:'il y a 3 j',src:'coros'}
  ],
  course: [
    {disc:'run',      name:'VO2max 10×400m piste',    dur:58,  dist:11.2, date:'auj.',      src:'garmin'},
    {disc:'run',      name:'Sortie longue 1h45',      dur:105, dist:21.6, date:'hier',      src:'garmin'},
    {disc:'run',      name:'Footing matinal',         dur:45,  dist:9.0,  date:'hier',      src:'strava'},
    {disc:'strength', name:'PPG + gainage',           dur:35,  dist:0,    date:'il y a 2 j',src:'coros'},
    {disc:'run',      name:'Seuil 3×3000m',           dur:52,  dist:12.4, date:'il y a 3 j',src:'garmin'}
  ],
  hyrox: [
    {disc:'hyrox',    name:'Simu Hyrox 4 stations',   dur:48,  dist:6.0,  date:'auj.',      src:'coros'},
    {disc:'strength', name:'Force max bas du corps',  dur:55,  dist:0,    date:'auj.',      src:'strava'},
    {disc:'run',      name:'Compromised running',     dur:32,  dist:6.5,  date:'hier',      src:'coros'},
    {disc:'strength', name:'Sled push/pull + wall balls', dur:40, dist:0, date:'il y a 2 j',src:'strava'},
    {disc:'run',      name:'Intervalles 8×1min',      dur:38,  dist:7.8,  date:'il y a 3 j',src:'garmin'}
  ],
  velo: [
    {disc:'bike', name:'Cols — 1800m D+',             dur:240, dist:88.0, date:'auj.',      src:'strava'},
    {disc:'bike', name:'Seuil 3×12min',               dur:90,  dist:42.5, date:'hier',      src:'garmin'},
    {disc:'bike', name:'Récup café-ride',             dur:60,  dist:24.0, date:'hier',      src:'strava'},
    {disc:'run',  name:'Footing croisé',              dur:35,  dist:6.8,  date:'il y a 2 j',src:'coros'},
    {disc:'bike', name:'Home-trainer sweet spot',     dur:75,  dist:36.0, date:'il y a 3 j',src:'garmin'}
  ]
};
const DEMO_SET_LABELS = { get triathlete(){return tr('demoSet.triathlete')}, get course(){return tr('demoSet.course')}, get hyrox(){return tr('demoSet.hyrox')}, get velo(){return tr('demoSet.velo')} };
let stravaDemoSet = 'triathlete';   // profil démo actif (changeable via le sélecteur)

function renderStravaCard(){
  const box=document.getElementById('stravaCard');
  if(!box) return;
  const stravaLogo=`<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>`;
  const SRC={strava:'Strava',garmin:'Garmin',coros:'Coros'};
  const providers = window.__pf_providers || [];
  if(!stravaConnected){
    box.innerHTML=`
      <h2>${tr('sync.title')}</h2>
      <p class="hint" style="margin-bottom:10px">${tr('sync.connectWatch')}</p>
      <button class="strava-connect" id="stravaConnectBtn">${stravaLogo} ${tr('sync.connectStrava')}</button>
      <div class="dev-more">
        <button class="dev-mini" data-p="garmin">⌚ Garmin</button>
        <button class="dev-mini" data-p="coros">⌚ Coros</button>
        <button class="dev-mini" id="importFitBtn" title="${tr('sync.importFileTitle')}"><i class="ic ic-upload"></i> ${tr('sync.importFile')}</button>
      </div>
      <p class="hint" style="margin-top:9px;font-size:11px;line-height:1.4">ℹ️ ${tr('sync.stravaPrivacy')}</p>
      <div class="strava-powered">${tr('sync.readOnly')}</div>`;
    document.getElementById('stravaConnectBtn').onclick=connectStrava;
    box.querySelectorAll('.dev-mini').forEach(b=> b.onclick=()=> connectProvider(b.dataset.p));
  } else {
    const escAct=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const actsHtml = stravaActivities.length? `<div class="strava-acts">${stravaActivities.slice(0,6).map((a,i)=>{
      const D=DISC[a.disc]||DISC.run;
      const src = a.src? ` · ${escAct(SRC[a.src]||a.src)}` : '';
      const clickable = a.id && a.src==='strava';
      return `<div class="strava-act${clickable?' clickable':''}"${clickable?` data-idx="${i}" title="${tr('sync.seeDetailedAnalysis')}"`:''}><span class="ico">${discIcon(D)}</span><div class="ai"><div class="at">${escAct(a.name)}</div><div class="am">${fmtDur(a.dur)} · ${a.dist} km · ${escAct(a.date)}${src}</div></div></div>`;
    }).join('')}</div>` : `<p class="hint" style="margin-top:9px">${tr('sync.noActivity')}</p>`;
    const linked = providers.length? providers.map(p=>SRC[p]||p).join(' · ') : 'Strava';
    box.innerHTML=`
      <h2>${tr('sync.syncedActivities')}</h2>
      <div class="strava-state">
        <div class="sline"><span class="sdot"></span>${tr('sync.linkedAccounts')} : ${linked}</div>
        <div class="smeta">${tr('sync.lastSync')} : ${stravaActivities.length?tr('sync.justNow'):tr('sync.never')}</div>
        <button class="strava-sync" id="stravaSyncBtn">${stravaLogo} ${tr('sync.syncLatest')}</button>
        <button class="strava-disconnect" id="stravaDisconnectBtn">${tr('sync.disconnect')}</button>
        <button class="dev-mini" id="importFitBtn" title="${tr('sync.importFileTitle2')}"><i class="ic ic-upload"></i> ${tr('sync.importFile2')}</button>
      </div>
      ${(!window.PF?.user)?`<div class="demo-pick"><span class="dp-lbl">${tr('sync.demoProfile')}</span>${Object.keys(STRAVA_DEMO_SETS).map(k=>`<button class="dp-chip${k===stravaDemoSet?' on':''}" data-set="${k}">${DEMO_SET_LABELS[k]}</button>`).join('')}</div>`:''}
      ${actsHtml}
      <p class="hint" style="margin-top:9px;font-size:11px;line-height:1.4">ℹ️ ${tr('sync.stravaPrivacy2')}</p>
      <div class="strava-powered">${tr('sync.poweredBy')}</div>`;
    document.getElementById('stravaSyncBtn').onclick=syncStrava;
    box.querySelectorAll('.strava-act.clickable').forEach(el=> el.onclick=()=>openStravaAnalysis(stravaActivities[+el.dataset.idx]));
    box.querySelectorAll('.dp-chip').forEach(b=> b.onclick=()=>{ stravaDemoSet=b.dataset.set; stravaActivities=STRAVA_DEMO_SETS[stravaDemoSet].slice(); renderStravaCard(); });
    document.getElementById('stravaDisconnectBtn').onclick=()=>{
      if(window.PF?.user){ const p=providers[0]||'strava'; PF.disconnectDevice(p).then(()=>refreshDeviceState()).catch(e=>console.warn('[PF] disconnect:',e)); toast(tr('toast.compteDelie')); }
      else { stravaConnected=false; stravaActivities=[]; renderStravaCard(); toast(tr('toast.stravaDeconnecte')); }
    };
  }
  const ib=document.getElementById('importFitBtn'); if(ib) ib.onclick=()=>ensureFitInput().click();
}

// Import manuel d'un fichier d'activité (.TCX/.GPX) — voie SANS homologation
// (la sync API coach Garmin/Coros nécessite une homologation longue). Le fichier
// est parsé côté navigateur (window.PFFit) en la même structure que genSessionData,
// puis ouvert dans le modal d'analyse → découplage + IA tournent sur du RÉEL.
function ensureFitInput(){
  let inp=document.getElementById('fitFileInput');
  if(!inp){ inp=document.createElement('input'); inp.type='file'; inp.id='fitFileInput'; inp.accept='.fit,.tcx,.gpx';
    inp.style.display='none'; document.body.appendChild(inp);
    inp.addEventListener('change', e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(f) importActivityFile(f); }); }
  return inp;
}
function importActivityFile(file){
  if(typeof PFFit==='undefined'){ toast(tr('toast.moduleDImportIndisponible'), 'error'); return; }
  const ftp=(typeof ATHLETE_REF!=='undefined'&&ATHLETE_REF&&ATHLETE_REF.ftp)||270;
  toast(tr('toast.lectureFichier'));
  PFFit.parseFile(file, {ftp}).then(res=>{
    if(!res.ok){ toast(tr('sync.importPrefix')+res.error); return; }
    const s=res.summary;
    stravaConnected=true;
    stravaActivities.unshift({disc:s.disc, name:s.title, dur:s.durMin, dist:+(+s.dist).toFixed(1), date:tr('sync.imported'), src:'upload'});
    renderStravaCard();
    openAnalysis({id:'imp'+Date.now(), disc:s.disc, title:s.title, dur:s.durMin, zone:'Z2', _realData:res.data});
    toast(tr('toast.activiteImportee'));
    if(window.PF?.user){
      PF.saveActivity(res.summary, res.data).catch(e=>console.warn('[PF] saveActivity échoué :', e));
    }
  });
}

// Détail seconde-par-seconde d'une activité Strava synchronisée : récupère les
// séries (GPS/FC/allure/puissance) via l'edge function (cache serveur), les
// rejoue avec PFFit.buildFromRaw (même pipeline que l'import .FIT) puis ouvre
// le modal d'analyse habituel (découplage, comparateur, IA…).
function openStravaAnalysis(act){
  if(!act || !act.id){ return; }
  toast(tr('toast.chargementDetail'));
  PF.getActivityStreams(act.id).then(points=>{
    if(!points || !points.length){ toast(tr('toast.pasDetailSecondeParSeconde')); return; }
    const ftp=(typeof ATHLETE_REF!=='undefined'&&ATHLETE_REF&&ATHLETE_REF.ftp)||270;
    const res = PFFit.buildFromRaw(points, act.disc, [], {ftp});
    if(!res.ok){ toast(res.error||tr('sync.analysisImpossible'), 'error'); return; }
    openAnalysis({id:act.id, disc:act.disc, title:act.name, dur:act.dur, zone:'Z2', _realData:res.data});
  }).catch(e=>{ console.warn('[PF] getActivityStreams:',e); toast(tr('toast.recuperationDetailStravaImpossible'), 'error'); });
}

function connectStrava(){
  // RÉEL (connecté à Sillance cloud) → OAuth Strava ; sinon démo.
  if(window.PF?.user){
    const btn=document.getElementById('stravaConnectBtn');
    if(btn){ btn.textContent=tr('sync.redirectingStrava'); btn.disabled=true; }
    PF.connectDevice('strava').then(r=>{
      if(r&&r.pending){ if(btn) btn.disabled=false; renderStravaCard(); toast(r.message||tr('sync.integrationSoon')); }
      // sinon : redirection en cours vers Strava.
    }).catch(e=>{ console.warn('[PF] connectDevice:',e); if(btn) btn.disabled=false; renderStravaCard(); toast(tr('toast.connexionStravaImpossible'), 'error'); });
    return;
  }
  // DÉMO : simule le retour de l'autorisation OAuth.
  const btn=document.getElementById('stravaConnectBtn');
  if(btn){ btn.textContent=tr('sync.connectingStrava'); btn.disabled=true; }
  setTimeout(()=>{ stravaConnected=true; stravaActivities=STRAVA_DEMO_SETS[stravaDemoSet].slice(); renderStravaCard(); toast(tr('toast.stravaConnecte')); }, 800);
}

function syncStrava(){
  const btn=document.getElementById('stravaSyncBtn');
  if(btn){ btn.classList.add('syncing'); btn.textContent=tr('sync.syncing'); }
  // RÉEL : l'edge function appelle l'API Strava avec le token stocké.
  if(window.PF?.user){
    PF.syncDevice('strava')
      .then(()=> refreshDeviceState())
      .then(()=> toast(tr('sync.nActivitiesSynced', {n:stravaActivities.length})))
      .catch(e=>{ console.warn('[PF] syncDevice:',e); renderStravaCard(); toast(tr('toast.synchroStravaImpossible'), 'error'); });
    return;
  }
  // DÉMO : charge le profil d'activités sélectionné.
  setTimeout(()=>{
    stravaActivities = STRAVA_DEMO_SETS[stravaDemoSet].slice();
    renderStravaCard();
    toast(tr('sync.nActivitiesImported', {n:stravaActivities.length}));
  }, 1000);
}

// Charge l'état réel (comptes liés + activités, toutes plateformes) depuis le cloud.
async function refreshDeviceState(){
  if(!window.PF?.user) return;
  try{
    const devices = await PF.myDevices().catch(()=>[]);
    const providers = devices.filter(d=>d.connected).map(d=>d.provider);
    window.__pf_providers = providers;
    stravaConnected = providers.length>0;
    if(stravaConnected){
      const acts = await PF.getActivities(8);
      stravaActivities = acts.map(a=>({
        id: a.id,
        disc: a.disc || 'run',
        name: a.name || tr('sync.activity'),
        dur: a.duration_s ? Math.round(a.duration_s/60) : 0,
        dist: a.distance_m ? +(a.distance_m/1000).toFixed(1) : 0,
        date: fmtActDate(a.start_time),
        src: a.provider
      }));
    } else { stravaActivities = []; }
    renderStravaCard();
  }catch(e){ console.warn('[PF] refreshDeviceState:',e); }
}

// Connexion d'une plateforme autre que Strava (Garmin/Coros).
function connectProvider(p){
  if(!window.PF?.user){ toast(tr('toast.connecteToiCloudPuisReessaie')); return; }
  PF.connectDevice(p).then(r=>{ if(r&&r.pending) toast(r.message||tr('sync.integrationSoon')); })
    .catch(e=>{ console.warn('[PF] connectDevice:',e); toast(tr('toast.connexionImpossible'), 'error'); });
}

function fmtActDate(iso){
  if(!iso) return '';
  const d=new Date(iso);
  const days=Math.floor((new Date().setHours(0,0,0,0)-new Date(iso).setHours(0,0,0,0))/86400000);
  if(days<=0) return tr('date.today');
  if(days===1) return tr('date.yesterday');
  if(days<7) return tr('date.daysAgo', {days});
  return d.toLocaleDateString(localeStr(),{day:'2-digit',month:'2-digit'});
}

/* ============================================================
   BIBLIOTHÈQUE — filtres sport / type + groupes par zone
   ------------------------------------------------------------
   La catégorie d'une séance = la zone LA PLUS HAUTE atteinte par
   un de ses intervalles (une séance avec des intervalles Z5 est
   une séance Z5, même si le reste est en Z2). À défaut de
   structure détaillée, on lit la zone déclarée du modèle.
   ============================================================ */
function zoneFromPct(p){ if(p<62) return 1; if(p<78) return 2; if(p<88) return 3; if(p<103) return 4; return 5; }
function tplZoneCat(t){
  let best=0;
  if(t.blocksV2 && t.blocksV2.blocks){
    t.blocksV2.blocks.forEach(blk=>blk.lines.forEach(ln=>{
      if(ln.type==='exo') best=Math.max(best, zoneFromPct(profLinePct(ln)));
      else if(ln.type==='station') best=Math.max(best, 4);
    }));
  }
  if(!best){ const m=String(t.zone||'').match(/Z\s*(\d)/i); if(m) best=Math.min(5,+m[1]); }
  return best? 'Z'+best : '—';
}
const ZONE_CATS=[
  ['Z5','Z5 · '+tr('zoneCat.vo2max')], ['Z4','Z4 · '+tr('zoneCat.threshold')], ['Z3','Z3 · '+tr('zoneCat.tempo')],
  ['Z2','Z2 · '+tr('zoneCat.endurance')], ['Z1','Z1 · '+tr('zoneCat.recovery')], ['—',tr('zoneCat.strengthOther')]
];
const ZONE_COLORS={Z1:'#2FD9FF',Z2:'#39E6A3',Z3:'#FFD43D',Z4:'#FFB13D',Z5:'#FF5470','—':'#8B93A7'};
let libSport='all', libZone='all';

function buildTemplates(container){
  container.innerHTML='';
  const filt=document.createElement('div'); filt.className='lib-filters';
  filt.innerHTML=`
    <select id="libSport" aria-label="${tr('lib.filterBySport')}">
      <option value="all">${tr('lib.allSports')}</option>
      ${Object.entries(DISC).map(([k,d])=>`<option value="${k}"${libSport===k?' selected':''}>${d.label}</option>`).join('')}
    </select>
    <select id="libZone" aria-label="${tr('lib.filterByType')}">
      <option value="all">${tr('lib.allTypes')}</option>
      ${ZONE_CATS.map(([v,l])=>`<option value="${v}"${libZone===v?' selected':''}>${l}</option>`).join('')}
    </select>`;
  container.appendChild(filt);
  filt.querySelector('#libSport').addEventListener('change', e=>{ libSport=e.target.value; buildTemplates(container); });
  filt.querySelector('#libZone').addEventListener('change', e=>{ libZone=e.target.value; buildTemplates(container); });

  const list = TEMPLATES
    .map(t=>({t, z:tplZoneCat(t)}))
    .filter(x=> (libSport==='all'||x.t.disc===libSport) && (libZone==='all'||x.z===libZone));
  if(!list.length){
    container.insertAdjacentHTML('beforeend',`<div class="lib-empty">${tr('lib.empty')}</div>`);
    return;
  }
  // filtres actifs → groupes ouverts ; sinon tout replié pour rester compact
  const filtered = libSport!=='all' || libZone!=='all';
  ZONE_CATS.forEach(([v,label])=>{
    const items=list.filter(x=>x.z===v);
    if(!items.length) return;
    const grp=document.createElement('details'); grp.className='tpl-group'; grp.open=filtered;
    const sum=document.createElement('summary');
    sum.innerHTML=`${label} <em>${items.length}</em>`;
    grp.appendChild(sum);
    items.forEach(x=> grp.appendChild(tplCard(x.t, x.z)));
    container.appendChild(grp);
  });
}
function tplCard(t, z){
  const D = DISC[t.disc];
  const el = document.createElement('div');
  el.className='tpl'; el.draggable=true;
  el.dataset.disc=t.disc;
  el.style.setProperty('--c', D.color);
  el.innerHTML = `<div class="t">${t.title}<span class="zb" style="color:${ZONE_COLORS[z]}">${z}</span></div>
                  <div class="m">${t.dur}min · ${t.tss} TSS</div>
                  <button class="tpl-assign" title="${tr('lib.assignToMultiple')}" aria-label="${tr('lib.assignToMultipleAria')}"><i class="ic ic-users"></i></button>`;
  el.addEventListener('dragstart', e=>{
    e.dataTransfer.setData('text/plain', JSON.stringify({type:'tpl', id:t.id}));
  });
  el.addEventListener('click', ()=> openModal({...t, id:null}, null));
  el.querySelector('.tpl-assign').addEventListener('click', e=>{ e.stopPropagation(); openAssign('tpl', t); });
  return el;
}

/* ============================================================
   CYCLES — programmes complets multi-semaines
   ------------------------------------------------------------
   Le coach compose un cycle (3 à 6 semaines de séances de la
   bibliothèque) et le pose en un clic sur le calendrier de
   l'athlète suivi. Les cibles restant exprimées en % des
   références, les allures s'adaptent au niveau de chaque athlète.
   Backend : persister CYCLES par coach (table cycles) ; la pose
   passe déjà par PF.scheduleSession séance par séance.
   ============================================================ */
const CYCLES = [
  {id:'c1', name:'Endurance — 4 semaines', weeks:4,
   plan:(()=>{ const p={}; for(let w=0;w<4;w++){ p[w+'-0']=['t1']; p[w+'-1']=['t5']; p[w+'-3']=['t8']; p[w+'-5']=['t3']; p[w+'-6']=['t17']; } delete p['3-5']; return p; })()}
];
let cycleState=null, cycleUid=10;

function cycleCount(c){ return Object.values(c.plan).reduce((a,x)=>a+x.length,0); }
function nextMonday(){ return addDays(mondayOf(0),7); }

function buildCycles(container){
  container.innerHTML='';
  if(!CYCLES.length){ container.innerHTML=`<div class="lib-empty">${tr('cycles.empty')}</div>`; return; }
  CYCLES.forEach(c=>{
    const el=document.createElement('div');
    el.className='tpl cycle-card';
    el.style.setProperty('--c','var(--accent)');
    el.innerHTML=`<div class="t">${c.name}</div>
      <div class="m">${c.weeks} ${tr('cycles.weeks')} · ${cycleCount(c)} ${tr('cycles.sessions')}</div>
      <button class="cy-apply"><i class="ic ic-calendar"></i> ${tr('cycles.addToAthlete')}</button>
      <button class="cy-multi"><i class="ic ic-users"></i> ${tr('cycles.assignMultiple')}</button>
      <button class="cy-del" aria-label="${tr('cycles.deleteAria')}"><i class="ic ic-x"></i></button>`;
    el.querySelector('.cy-apply').addEventListener('click', e=>{ e.stopPropagation(); applyCycle(c, null); });
    el.querySelector('.cy-multi').addEventListener('click', e=>{ e.stopPropagation(); openAssign('cycle', c); });
    el.querySelector('.cy-del').addEventListener('click', e=>{
      e.stopPropagation();
      const i=CYCLES.findIndex(x=>x.id===c.id); if(i>-1) CYCLES.splice(i,1);
      buildCycles(container); toast(tr('toast.cycleSupprime'));
    });
    el.addEventListener('click', ()=> openCycleBuilder(c));
    container.appendChild(el);
  });
}

/* développe un cycle en liste {key, t} à partir du lundi de la semaine choisie */
function cycleEntries(c, startIso){
  const start = startIso ? new Date(startIso+'T00:00:00') : nextMonday();
  const mon = addDays(start, -((start.getDay()+6)%7));
  const out = [];
  for(let w=0; w<c.weeks; w++) for(let d=0; d<7; d++){
    (c.plan[w+'-'+d]||[]).forEach(tid=>{
      const t = TEMPLATES.find(x=>x.id===tid); if(!t) return;
      out.push({ key: iso(addDays(mon, w*7+d)), t });
    });
  }
  return { mon, out };
}

/* pose le cycle sur le calendrier de l'athlète, à partir du lundi
   de la semaine choisie (défaut : lundi prochain) */
function applyCycle(c, startIso){
  const { mon, out } = cycleEntries(c, startIso);
  out.forEach(({key, t})=>{
    const s = {...t, id:'s'+(uid++), done:false};
    (planning[key] ||= []).push(s);
    if(window.PF?.user){
      PF.scheduleSession(currentAthleteId || PF.user.id, key, { disc:s.disc, title:s.title, dur:s.dur,
        dist:s.dist||0, tss:s.tss, zone:s.zone, blocks:(s.blocksV2&&s.blocksV2.blocks)||[] })
        .then(saved=>{ if(saved) s.id=saved.id; })
        .catch(e=> console.warn('[PF] scheduleSession échoué :', e));
    }
  });
  weekOffset = Math.round((mon - mondayOf(0))/(7*864e5));
  render();
  toast(tr('cycles.appliedToast', {name:c.name, n:out.length, weeks:c.weeks}));
}

/* ============================================================
   ATTRIBUTION MULTI-ATHLÈTES (coach)
   ------------------------------------------------------------
   Pose une séance ou un cycle sur le calendrier de plusieurs
   athlètes d'un coup : cases à cocher sur le roster + raccourcis
   « groupe du club » (sélectionne les athlètes du groupe).
   Démo : les poses sont mémorisées par athlète (ASSIGN_EXTRA) et
   réappliquées à chaque bascule. Réel : PF.scheduleSession par
   athlète, le planning affiché est rechargé du cloud à la bascule.
   ============================================================ */
const ASSIGN_EXTRA = {};   // {athleteId: {dateKey: [sessions]}}

function doAssign(kind, obj, dateIso, targets){
  const entries = kind==='cycle' ? cycleEntries(obj, dateIso).out : [{ key: dateIso, t: obj }];
  const curId = rosterIsReal ? currentAthleteId : (ROSTER[selectedAthleteIdx] && ROSTER[selectedAthleteIdx].id);
  // démo : figer le plan de référence AVANT la pose, sinon une attribution faite
  // avant la première bascule entrerait dans BASE_PLANNING (dupliquée pour
  // l'athlète courant, héritée par tous les autres)
  if(!rosterIsReal && !BASE_PLANNING) BASE_PLANNING = JSON.parse(JSON.stringify(planning));
  targets.forEach(a=>{
    entries.forEach(({key, t})=>{
      const s = {...t, id:'s'+(uid++), done:false};
      if(rosterIsReal && window.PF?.user){
        PF.scheduleSession(a.id, key, { disc:s.disc, title:s.title, dur:s.dur,
          dist:s.dist||0, tss:s.tss, zone:s.zone, blocks:(s.blocksV2&&s.blocksV2.blocks)||[] })
          .then(saved=>{ if(saved) s.id=saved.id; })
          .catch(e=> console.warn('[PF] scheduleSession échoué :', e));
      } else {
        ((ASSIGN_EXTRA[a.id] ||= {})[key] ||= []).push(s);
      }
      if(a.id===curId) (planning[key] ||= []).push(s);
    });
  });
  if(kind==='cycle' && targets.some(a=>a.id===curId)){
    weekOffset = Math.round((cycleEntries(obj, dateIso).mon - mondayOf(0))/(7*864e5));
  }
  render();
  const nA = targets.length;
  toast(kind==='cycle'
    ? tr(nA>1?'assign.cyclePosedPlural':'assign.cyclePosedSingular', {name:obj.name, n:nA, entries:entries.length})
    : tr(nA>1?'assign.sessionAssignedPlural':'assign.sessionAssignedSingular', {title:obj.title, n:nA}));
}

function openAssign(kind, obj){
  const isCycle = kind==='cycle';
  const defDate = isCycle ? iso(nextMonday()) : iso(addDays(new Date(), 1));
  const groups = (typeof CLUB_GROUPS!=='undefined' ? CLUB_GROUPS : []).filter(g=> ROSTER.some(a=>a.group===g.id));
  const rows = ROSTER.map((a,i)=>{
    const g = a.group && typeof clubGroup==='function' ? clubGroup(a.group) : null;
    return `<label class="asg-row"><input type="checkbox" data-idx="${i}" ${a.group?`data-grp="${a.group}"`:''}>
      <span class="ap-av" style="--ac:${a.color}">${a.ini}</span><span>${a.name}</span>
      ${g?`<span class="asg-grp" style="color:${g.color}">${g.name}</span>`:''}</label>`;
  }).join('');
  const el=document.createElement('div'); el.className='adh-overlay';
  el.innerHTML=`<div class="adh-modal asg-modal" role="dialog" aria-label="${tr('assign.dialogAria')}">
    <button class="adh-close" aria-label="${tr('common.close')}"><i class="ic ic-x"></i></button>
    <h3>${tr('assign.title', {name:isCycle?obj.name:obj.title})}</h3>
    <p class="adh-sub">${isCycle
      ? tr('assign.subCycle', {weeks:obj.weeks, n:cycleCount(obj)})
      : tr('assign.subSession')}</p>
    <div class="asg-date"><span>${isCycle?tr('assign.weekOf'):tr('assign.onDate')}</span><input type="date" id="asgDate" value="${defDate}"></div>
    ${groups.length?`<div class="asg-groups">${groups.map(g=>{
      const n=ROSTER.filter(a=>a.group===g.id).length;
      return `<button class="asg-chip" data-g="${g.id}" style="--gc:${g.color}"><span class="dotc"></span>${g.name} · ${n}</button>`;
    }).join('')}</div>`:''}
    <div class="asg-list">${rows || `<div style="padding:18px;text-align:center;color:var(--muted);font-size:12.5px">${tr('assign.noAthlete')}</div>`}</div>
    ${rows?`<label class="asg-all"><input type="checkbox" id="asgAll"> ${tr('assign.selectAll')}</label>
    <button class="btn asg-go" id="asgGo" disabled>${tr('assign.assign')}</button>`:''}
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('open'));
  const close=()=>{ el.classList.remove('open'); setTimeout(()=>el.remove(),180); };
  el.querySelector('.adh-close').onclick=close;
  el.addEventListener('click', e=>{ if(e.target===el) close(); });
  document.addEventListener('keydown', function esc(ev){ if(ev.key==='Escape'){ close(); document.removeEventListener('keydown',esc); } });
  if(!rows) return;
  const boxes=[...el.querySelectorAll('.asg-row input')];
  const go=el.querySelector('#asgGo'), all=el.querySelector('#asgAll');
  const sync=()=>{
    const n=boxes.filter(b=>b.checked).length;
    go.disabled=!n;
    go.textContent = n ? tr(n>1?'assign.assignToNPlural':'assign.assignToNSingular', {n}) : tr('assign.assign');
    all.checked = n===boxes.length;
    el.querySelectorAll('.asg-chip').forEach(ch=>{
      const m=boxes.filter(b=>b.dataset.grp===ch.dataset.g);
      ch.classList.toggle('on', m.length>0 && m.every(b=>b.checked));
    });
  };
  boxes.forEach(b=> b.addEventListener('change', sync));
  all.addEventListener('change', ()=>{ boxes.forEach(b=> b.checked=all.checked); sync(); });
  el.querySelectorAll('.asg-chip').forEach(ch=> ch.onclick=()=>{
    const m=boxes.filter(b=>b.dataset.grp===ch.dataset.g);
    const allOn=m.length && m.every(b=>b.checked);
    m.forEach(b=> b.checked=!allOn);
    sync();
  });
  go.onclick=()=>{
    const targets=boxes.filter(b=>b.checked).map(b=>ROSTER[+b.dataset.idx]);
    if(!targets.length) return;
    doAssign(kind, obj, el.querySelector('#asgDate').value || defDate, targets);
    close();
  };
}

function openCycleBuilder(existing){
  cycleState = existing ? JSON.parse(JSON.stringify(existing))
                        : {id:'c'+(cycleUid++), name:'', weeks:4, plan:{}};
  document.getElementById('cyName').value = cycleState.name||'';
  document.getElementById('cyWeeks').value = String(cycleState.weeks);
  document.getElementById('cycleBadge').textContent = existing ? 'Modifier le cycle' : 'Nouveau cycle';
  document.getElementById('cyStart').value = iso(nextMonday());
  renderCycleGrid();
  document.getElementById('cycleOverlay').classList.add('open');
}
function renderCycleGrid(){
  const wrap=document.getElementById('cyGrid');
  let html='';
  for(let w=0; w<cycleState.weeks; w++){
    const wk = Array.from({length:7},(_,d)=> (cycleState.plan[w+'-'+d]||[]));
    const wkTss = wk.flat().reduce((a,tid)=>{ const t=TEMPLATES.find(x=>x.id===tid); return a+(t?t.tss:0); },0);
    html += `<div class="cy-week">
      <div class="cy-week-t">Semaine ${w+1} <em>${wkTss} TSS</em></div>
      <div class="cy-days">${wk.map((cell,d)=>`
        <div class="cy-day" data-w="${w}" data-d="${d}">
          <span class="d">${DAYS[d]}</span>
          ${cell.map((tid,i)=>{ const t=TEMPLATES.find(x=>x.id===tid); if(!t) return '';
            return `<span class="cy-chip" style="--c:${DISC[t.disc].color}" data-i="${i}" title="Cliquer pour retirer">${t.title}</span>`; }).join('')}
          <button class="cy-add-btn" aria-label="Ajouter une séance ce jour">+</button>
        </div>`).join('')}
      </div>
    </div>`;
  }
  wrap.innerHTML=html;
  wrap.querySelectorAll('.cy-add-btn').forEach(b=> b.addEventListener('click', e=>{
    const cell=e.target.closest('.cy-day');
    openCyPicker(e, +cell.dataset.w, +cell.dataset.d);
  }));
  wrap.querySelectorAll('.cy-chip').forEach(ch=> ch.addEventListener('click', ()=>{
    const cell=ch.closest('.cy-day');
    const k=cell.dataset.w+'-'+cell.dataset.d;
    cycleState.plan[k].splice(+ch.dataset.i,1);
    if(!cycleState.plan[k].length) delete cycleState.plan[k];
    renderCycleGrid();
  }));
}
/* petit menu flottant : bibliothèque groupée par sport */
function openCyPicker(e, w, d){
  const pk=document.getElementById('cyPicker');
  pk.innerHTML = Object.entries(DISC).map(([k,D])=>{
    const its=TEMPLATES.filter(t=>t.disc===k);
    if(!its.length) return '';
    return `<div class="g">${D.label}</div>` + its.map(t=>
      `<div class="it" style="--c:${D.color}" data-id="${t.id}">${t.title}<small>${t.dur}min</small></div>`).join('');
  }).join('');
  pk.hidden=false;
  pk.style.left=Math.min(e.clientX, innerWidth-270)+'px';
  pk.style.top=Math.min(e.clientY, innerHeight-300)+'px';
  pk.querySelectorAll('.it').forEach(it=> it.addEventListener('click', ()=>{
    (cycleState.plan[w+'-'+d] ||= []).push(it.dataset.id);
    pk.hidden=true; renderCycleGrid();
  }));
  setTimeout(()=> document.addEventListener('click', function close(ev){
    if(!pk.contains(ev.target)){ pk.hidden=true; document.removeEventListener('click', close); }
  }), 0);
}
function saveCycleFromModal(){
  cycleState.name = document.getElementById('cyName').value.trim() || 'Cycle sans nom';
  cycleState.weeks = +document.getElementById('cyWeeks').value;
  const clean = {id:cycleState.id, name:cycleState.name, weeks:cycleState.weeks, plan:cycleState.plan};
  const i=CYCLES.findIndex(x=>x.id===clean.id);
  if(i>-1) CYCLES[i]=clean; else CYCLES.push(clean);
  if(mode==='coach') renderSidebar();
  return clean;
}
document.getElementById('cycleClose').addEventListener('click', ()=> document.getElementById('cycleOverlay').classList.remove('open'));
document.getElementById('cycleOverlay').addEventListener('click', e=>{ if(e.target.id==='cycleOverlay') document.getElementById('cycleOverlay').classList.remove('open'); });
document.getElementById('cyName').addEventListener('input', e=>{ cycleState.name=e.target.value; });
document.getElementById('cyWeeks').addEventListener('change', e=>{
  cycleState.weeks=+e.target.value;
  Object.keys(cycleState.plan).forEach(k=>{ if(+k.split('-')[0]>=cycleState.weeks) delete cycleState.plan[k]; });
  renderCycleGrid();
});
document.getElementById('cySave').addEventListener('click', ()=>{
  saveCycleFromModal();
  document.getElementById('cycleOverlay').classList.remove('open');
  toast(tr('toast.cycleEnregistre'));
});
document.getElementById('cyApply').addEventListener('click', ()=>{
  const c=saveCycleFromModal();
  document.getElementById('cycleOverlay').classList.remove('open');
  applyCycle(c, document.getElementById('cyStart').value);
});

/* ============================================================
   PARAMÈTRES — page abonnements (Structure + coach/IA)
   ------------------------------------------------------------
   Accessible par la roue crantée du header. C'est ICI (et plus
   dans la sidebar) que le coach révoque l'assistant IA.
   Démo : valeurs d'exemple ; connecté : les boutons pointent vers
   le vrai checkout / portail Stripe.
   ============================================================ */
function fmtDateFr(d){ return d.toLocaleDateString(localeStr()); }
function aiTrialDaysLeft(){
  if(window.__pf_aiDemo && window.__pf_aiDemoStart)
    return Math.max(0, 14 - Math.floor((Date.now()-window.__pf_aiDemoStart)/86400000));
  return null;
}
function settingsStructureHtml(){
  const sub = window.__pf_subscribed===true || !window.PF?.user; // démo : montré actif
  return `
    <div class="set-h">Abonnement Structure</div>
    <div class="set-sub">La formule Sillance de ta structure — échéances, facturation et gestion.</div>
    <div class="set-plan">
      <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1">
          <div class="p-name">Sillance Coach — Mensuel</div>
          <div class="p-price">29€<small> /mois</small></div>
        </div>
        <span class="set-status ${sub?'on':'off'}">${sub?'Actif':'Inactif'}</span>
      </div>
      <div class="set-rows">
        <div><div class="k">Créé le</div><div class="v">14/04/2026</div></div>
        <div><div class="k">Valide jusqu'au</div><div class="v">09/08/2026</div></div>
        <div><div class="k">Prochain paiement</div><div class="v">Renouvellement le 09/08/2026</div></div>
        <div><div class="k">Statut du dernier paiement</div><div class="v" style="color:var(--good)">Payé</div></div>
        <div><div class="k">Date d'émission</div><div class="v">09/07/2026</div></div>
        <div><div class="k">Moyen de paiement</div><div class="v">Visa •••• 4242 — expire 11/2029</div></div>
      </div>
      <div class="set-actions">
        <button class="btn cy-ghost" id="setPortalBtn"><i class="ic ic-credit-card"></i> Détails et gestion</button>
        ${sub?'':`<button class="btn" id="setSubscribeBtn">S'abonner — 29 €/mois</button>`}
      </div>
    </div>
    <div class="set-upsell">
      <b>⭐ Passe ta structure en COACH PRO</b>
      <p>Active les fonctionnalités PRO pour tous les coachs de ta structure et l'Assistant IA pour tes athlètes.</p>
      <button class="btn btn-secondary" id="setProBtn">Découvrir</button>
    </div>`;
}
function settingsCoachHtml(){
  const on = aiUnlocked();
  const days = aiTrialDaysLeft();
  const chip = on ? (days!=null?`<span class="set-status trial">Essai — ${days} j restants</span>`:'<span class="set-status on">Actif</span>')
                  : '<span class="set-status off">Inactif</span>';
  return `
    <div class="set-h">Abonnement coach — Assistant IA</div>
    <div class="set-sub">L'add-on d'analyse automatique des séances réalisées : respect du plan, dérive cardiaque, découplage FC, temps en zone.</div>
    <div class="set-plan">
      <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1">
          <div class="p-name">Assistant IA (add-on coach)</div>
          <div class="p-price">${AI_ADDON_PRICE}€<small> /mois · essai 14 j</small></div>
        </div>
        ${chip}
      </div>
      ${on ? `
      <div class="set-rows">
        <div><div class="k">Statut</div><div class="v">${days!=null?`Essai en cours — ${days} jour${days>1?'s':''} restant${days>1?'s':''}`:'Abonnement actif'}</div></div>
        <div><div class="k">Prochain débit</div><div class="v">${days!=null?`${AI_ADDON_PRICE} € le ${fmtDateFr(addDays(new Date(window.__pf_aiDemoStart||Date.now()),14))} — sauf révocation`:`${AI_ADDON_PRICE} € à la prochaine échéance`}</div></div>
      </div>
      <div class="set-actions">
        <button class="btn cy-ghost set-danger" id="setAiRevoke"><i class="ic ic-x"></i> Révoquer l'accès à l'assistant IA</button>
      </div>
      <div class="set-note">Aucun débit n'a lieu si tu révoques avant la fin de l'essai. Connecté, la révocation passe par le portail Stripe (accès conservé jusqu'à l'échéance).</div>`
      : `
      <div class="set-actions" style="margin-top:12px">
        <button class="btn" id="setAiStart">Commencer l'essai 14 jours</button>
      </div>
      <div class="set-note">Carte enregistrée à l'activation. Débit automatique de ${AI_ADDON_PRICE} €/mois à la fin de l'essai, sauf révocation depuis cette page.</div>`}
    </div>`;
}
let settingsTab='structure';
function renderSettings(){
  document.querySelectorAll('#setNav .set-tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===settingsTab));
  const body=document.getElementById('setBody');
  body.innerHTML = settingsTab==='structure' ? settingsStructureHtml() : settingsCoachHtml();
  const portal=document.getElementById('setPortalBtn');
  if(portal) portal.onclick=()=>{ if(window.PF?.user && PF.openBillingPortal){ PF.openBillingPortal().catch(()=>toast(tr('toast.portailIndisponible'), 'error')); } else toast(tr('toast.portailStripeDemo')); };
  const subB=document.getElementById('setSubscribeBtn');
  if(subB) subB.onclick=()=>{ if(window.PF?.user && PF.startCheckout){ PF.startCheckout('coach').catch(()=>toast(tr('toast.stripeIndisponible'), 'error')); } else toast(tr('toast.checkoutStripeDemo')); };
  const pro=document.getElementById('setProBtn');
  if(pro) pro.onclick=()=>toast(tr('toast.coachProBientotDisponible'));
  const st=document.getElementById('setAiStart');
  if(st) st.onclick=()=>{
    if(window.PF?.user && PF.subscribeAiAddon){ PF.subscribeAiAddon().catch(()=>toast(tr('toast.stripeIndisponible'), 'error')); return; }
    window.__pf_aiDemo=true; window.__pf_aiDemoStart=Date.now();
    renderSettings(); if(mode==='coach') renderSidebar();
    toast(tr('toast.assistantIaActiveEssai14'));
  };
  const rv=document.getElementById('setAiRevoke');
  if(rv) rv.onclick=()=>{
    if(window.PF?.user && window.__pf_aiAddon===true && PF.openBillingPortal){ PF.openBillingPortal().catch(()=>toast(tr('toast.portailIndisponible'), 'error')); return; }
    window.__pf_aiDemo=false; window.__pf_aiDemoStart=null;
    renderSettings(); if(mode==='coach') renderSidebar();
    toast(tr('toast.accesALAssistantIa'));
  };
}
function openSettings(tab){
  if(tab) settingsTab=tab;
  renderSettings();
  document.getElementById('settingsOverlay').classList.add('open');
}
document.getElementById('settingsBtn').addEventListener('click', ()=> openSettings());
document.getElementById('settingsClose').addEventListener('click', ()=> document.getElementById('settingsOverlay').classList.remove('open'));
document.getElementById('settingsOverlay').addEventListener('click', e=>{ if(e.target.id==='settingsOverlay') document.getElementById('settingsOverlay').classList.remove('open'); });
document.querySelectorAll('#setNav .set-tab').forEach(b=> b.addEventListener('click', ()=>{ settingsTab=b.dataset.tab; renderSettings(); }));

/* ---- rendu calendrier ---- */
const calGrid = document.getElementById('calGrid');
const weekLabel = document.getElementById('weekLabel');

/* ============================================================
   AFFÛTAGE / TAPERING — sur les courses de l'agenda (#audit 6)
   ------------------------------------------------------------
   Durée d'affûtage recommandée selon la distance : plus la course
   est longue, plus l'affûtage est long (littérature : 8-21 j, on
   réduit le VOLUME 40-60 % en gardant des rappels d'intensité courts).
   ============================================================ */
function taperDaysFor(name){
  const t = (name||'').toLowerCase();
  if(/ironman|140\.?6|full/.test(t)) return 21;
  if(/marathon|42 ?km|42\.2/.test(t)) return 14;
  if(/70\.?3|half|semi|21 ?km|ironman 70/.test(t)) return 11;
  if(/hyrox/.test(t)) return 10;
  if(/sprint|olympic|olympique|10 ?km|10k|5 ?km|5k/.test(t)) return 6;
  return 10;
}
function taperVolCut(days){ return days>=18?55 : days>=13?50 : days>=9?45 : 35; }
/* course cible de l'athlète affiché, avec date absolue + fenêtre d'affûtage */
function currentRace(){
  let r=null;
  if(typeof mode!=='undefined' && mode==='coach' && typeof ROSTER!=='undefined' && ROSTER[selectedAthleteIdx] && ROSTER[selectedAthleteIdx].race){
    r = ROSTER[selectedAthleteIdx].race;
  } else { try{ if(UPCOMING_RACES && UPCOMING_RACES[0]) r={name:UPCOMING_RACES[0].name, days:UPCOMING_RACES[0].inDays}; }catch(e){} }
  if(!r) return null;
  const days = r.days!=null?r.days:r.inDays;
  if(days==null || days<0) return null;
  const date = iso(addDays(new Date(), days));
  const taper = taperDaysFor(r.name);
  return { name:r.name, days, date, taperDays:taper, taperStart: iso(addDays(new Date(), days-taper)), volCut: taperVolCut(taper) };
}

function render(){
  const mon = mondayOf(weekOffset);
  const sun = addDays(mon,6);
  weekLabel.textContent = `${fmt.format(mon)} → ${fmt.format(sun)} ${sun.getFullYear()}`;
  calGrid.innerHTML='';
  const todayIso = iso(new Date());
  const race = currentRace();
  let totalTss=0, totalMin=0, count=0, doneCount=0;
  const maxDayTss = Math.max(60, ...Array.from({length:7},(_,i)=>{
    const s = planning[iso(addDays(mon,i))]||[];
    return s.reduce((a,x)=>a+x.tss,0);
  }));

  for(let i=0;i<7;i++){
    const date = addDays(mon,i);
    const key = iso(date);
    const sessions = planning[key]||[];
    const dayTss = sessions.reduce((a,s)=>a+s.tss,0);
    totalTss += dayTss;
    totalMin += sessions.reduce((a,s)=>a+s.dur,0);
    count += sessions.length;
    doneCount += sessions.filter(s=>s.done).length;

    // affûtage : ce jour est-il la course, ou dans la fenêtre d'affûtage ?
    const isRace = race && key===race.date;
    const inTaper = race && key>=race.taperStart && key<race.date;
    const isTaperStart = race && key===race.taperStart;

    const day = document.createElement('div');
    day.className = 'day'+(key===todayIso?' today':'')+(isRace?' day-race':'')+(inTaper?' day-taper':'');
    day.dataset.date = key;
    day.innerHTML = `
      <div class="day-head">
        <span class="dname">${DAYS[i]}</span>
        <span class="dnum">${date.getDate()}</span>
      </div>
      ${isRace?`<div class="day-race-pill"><i class="ic ic-flag"></i>${race.name}</div>`:''}
      ${isTaperStart?`<div class="day-taper-tag"><i class="ic ic-gradient"></i>Début affûtage</div>`:''}
      ${mode==='coach'?`<button class="day-add" data-key="${key}" aria-label="Créer une séance ce jour">+</button>`:''}
      <div class="day-body"></div>
      <div class="day-load">
        ${sessions.map(s=>`<div class="bar" style="background:${DISC[s.disc].color};height:${Math.max(8, s.tss/maxDayTss*30)}px"></div>`).join('')||'<div class="bar" style="background:var(--line);height:3px"></div>'}
        <span class="tss">${dayTss||'—'}</span>
      </div>`;

    const addBtn = day.querySelector('.day-add');
    if(addBtn) addBtn.addEventListener('click', ()=> openBuilder(key, null));
    const body = day.querySelector('.day-body');
    sessions.forEach(s=> body.appendChild(sessionCard(s, key)));

    /* drop */
    day.addEventListener('dragover', e=>{e.preventDefault(); day.classList.add('dragover')});
    day.addEventListener('dragleave', ()=> day.classList.remove('dragover'));
    day.addEventListener('drop', e=>{
      e.preventDefault(); day.classList.remove('dragover');
      if(mode!=='coach') return;
      let data; try{ data = JSON.parse(e.dataTransfer.getData('text/plain')) }catch{ return }
      if(data.type==='tpl'){
        const t = TEMPLATES.find(x=>x.id===data.id);
        (planning[key] ||= []).push({...t, id:'s'+(uid++), done:false});
      } else if(data.type==='move'){
        const from = planning[data.from]||[];
        const idx = from.findIndex(s=>s.id===data.id);
        if(idx>-1){
          const [s] = from.splice(idx,1);
          (planning[key] ||= []).push(s);
        }
      }
      render();
    });
    calGrid.appendChild(day);
  }

  /* stats */
  document.getElementById('weekTss').innerHTML = `${totalTss}<em>TSS</em>`;
  document.getElementById('weekHours').innerHTML = `${(totalMin/60).toFixed(1).replace('.',',')}<em>h</em>`;
  document.getElementById('weekCount').textContent = `${count} séances`;
  document.getElementById('compliance').innerHTML = `${count?Math.round(doneCount/count*100):0}<em>%</em>`;
  renderWeekIntensity(mon);
  renderTaperHint(race, mon);
  renderWeekRiskHint(mon);
  renderWeekPulse(mon);
  if(typeof wireSessionVideos==='function') wireSessionVideos();
}

/* Bandeau de suggestion d'affûtage quand la semaine affichée chevauche la
   fenêtre d'affûtage de la course cible. Suggestion, pas automatisme. */
function renderTaperHint(race, mon){
  const el = document.getElementById('taperHint'); if(!el) return;
  if(!race){ el.hidden=true; return; }
  const weekDays = Array.from({length:7},(_,i)=>iso(addDays(mon,i)));
  const overlaps = weekDays.some(k=> k>=race.taperStart && k<=race.date);
  if(!overlaps){ el.hidden=true; return; }
  const isCoach = (typeof mode!=='undefined' && mode==='coach');
  const who = isCoach ? 'ton athlète' : 'toi';
  el.hidden=false;
  el.innerHTML = `<i class="ic ic-gradient"></i><div class="th-txt">
    <b>Affûtage — ${dispoSafe(race.name)}, J–${race.days}.</b>
    Fenêtre recommandée : <span class="k">${race.taperDays} j</span>. Réduis le volume d'environ
    <span class="k">${race.volCut}%</span> ${isCoach?'pour '+who:''} en gardant des <b>rappels d'intensité courts</b>
    (VMA/seuil brefs) et la fréquence des séances — c'est le volume qu'on coupe, pas la vivacité.</div>`;
}
/* Optimiseur de répartition hebdo : signale au coach les combinaisons à
   risque dans la semaine affichée (charge forte cumulée le même jour, ou
   deux jours forte intensité qui s'enchaînent sans récup entre les deux).
   Zone Z4/Z5 = seuil haut / VO2max, lue directement sur la séance (pas de
   déduction par titre : plus fiable, pas de faux positifs). */
function weekRiskFindings(mon){
  const isHigh = s => s.zone==='Z4' || s.zone==='Z5';
  const days = Array.from({length:7},(_,i)=> ({ i, high:(planning[iso(addDays(mon,i))]||[]).filter(isHigh) }));
  const findings = [];
  days.forEach(d=>{
    if(d.high.length>=2){
      const discs=[...new Set(d.high.map(s=>DISC[s.disc].label))];
      findings.push(`<b>${DAYS[d.i]}</b> cumule ${d.high.length} séances à forte intensité (${discs.join(' + ')}).`);
    }
  });
  for(let i=0;i<6;i++){
    if(days[i].high.length && days[i+1].high.length){
      findings.push(`<b>${DAYS[i]} → ${DAYS[i+1]}</b> deux jours d'affilée à forte intensité, peu de récup entre les deux.`);
    }
  }
  return findings;
}
function renderWeekRiskHint(mon){
  const el = document.getElementById('weekRiskHint'); if(!el) return;
  if(mode!=='coach'){ el.hidden=true; return; }
  const findings = weekRiskFindings(mon);
  if(!findings.length){ el.hidden=true; return; }
  el.hidden=false;
  el.innerHTML = `<i class="ic ic-alert-triangle"></i><div class="th-txt"><b>Répartition à vérifier cette semaine.</b> ${findings.slice(0,3).join(' ')}</div>`;
}

/* ============================================================
   FEEDBACK HEBDO BIDIRECTIONNEL
   ------------------------------------------------------------
   Bilan croisé de la semaine affichée dans le calendrier : ressenti +
   note de l'athlète (charge perçue), note du coach — chacun écrit dans
   sa vue, lit l'autre en lecture seule. Indexé par id athlète + lundi
   de semaine ISO, comme les débriefs de course.
   ============================================================ */
let WEEK_PULSES = {}; // clé "athleteId|weekMondayIso" -> {athleteFeel, athleteNote, coachNote}
const WEEK_FEELS = { hard:{get l(){return tr('weekFeel.hard')}, c:'var(--run)'}, ok:{get l(){return tr('weekFeel.ok')}, c:'var(--good)'}, easy:{get l(){return tr('weekFeel.easy')}, c:'var(--bike)'} };
/* id de l'athlète concerné par la vue courante : soi-même en vue Athlète,
   l'athlète suivi en vue Coach (démo ou réel). null en vue Club. */
function activeAthleteKey(){
  if(mode==='coach'){
    if(rosterIsReal) return currentAthleteId;
    return (ROSTER[selectedAthleteIdx] && ROSTER[selectedAthleteIdx].id) || null;
  }
  if(mode==='athlete') return myDebriefKey();
  return null;
}
function renderWeekPulse(mon){
  const el = document.getElementById('weekPulse'); if(!el) return;
  const key = activeAthleteKey();
  if(!key){ el.hidden=true; return; }
  const wk = iso(mon);
  const ck = key+'|'+wk;
  const p = WEEK_PULSES[ck] || {};
  el.hidden = false;
  el.innerHTML = `
    <div class="sn-head"><i class="ic ic-message-circle"></i> Bilan de la semaine</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <div class="sn-when" style="margin-bottom:6px">Ressenti de l'athlète</div>
        ${mode==='athlete' ? `
          <div class="wp-feel-seg ck-dispo-seg" id="wpFeelSeg">${Object.entries(WEEK_FEELS).map(([k,f])=>`<button type="button" data-feel="${k}" class="${p.athleteFeel===k?'sel':''}" style="--dc:${f.c}">${f.l}</button>`).join('')}</div>
          <textarea id="wpAthNote" rows="2" placeholder="Comment s'est passée ta semaine…" style="width:100%;box-sizing:border-box;margin-top:6px">${p.athleteNote?dispoSafe(p.athleteNote):''}</textarea>
          <button class="btn" id="wpAthSave" style="margin-top:6px">Enregistrer mon bilan</button>
        ` : (p.athleteFeel||p.athleteNote) ? `
          <div class="sn-txt">${p.athleteFeel&&WEEK_FEELS[p.athleteFeel]?`<b style="color:${WEEK_FEELS[p.athleteFeel].c}">${WEEK_FEELS[p.athleteFeel].l}</b>${p.athleteNote?' — ':''}`:''}${p.athleteNote?dispoSafe(p.athleteNote):''}</div>
        ` : `<p class="club-hint">Pas encore de bilan de l'athlète pour cette semaine.</p>`}
      </div>
      <div>
        <div class="sn-when" style="margin-bottom:6px">Note du coach</div>
        ${mode==='coach' ? `
          <textarea id="wpCoachNote" rows="2" placeholder="Ta lecture de la semaine pour cet athlète…" style="width:100%;box-sizing:border-box">${p.coachNote?dispoSafe(p.coachNote):''}</textarea>
          <button class="btn" id="wpCoachSave" style="margin-top:6px">Enregistrer ma note</button>
        ` : p.coachNote ? `<div class="sn-txt">${dispoSafe(p.coachNote)}</div>` : `<p class="club-hint">Ton coach n'a pas encore laissé de note pour cette semaine.</p>`}
      </div>
    </div>`;
  const fs = document.getElementById('wpFeelSeg');
  if(fs) fs.querySelectorAll('button').forEach(b=> b.onclick=()=> fs.querySelectorAll('button').forEach(x=>x.classList.toggle('sel',x===b)));
  const as = document.getElementById('wpAthSave');
  if(as) as.onclick=()=> saveWeekPulseAthlete(key, wk);
  const cs = document.getElementById('wpCoachSave');
  if(cs) cs.onclick=()=> saveWeekPulseCoach(key, wk);
  // chargement réel à la demande (une fois par semaine consultée, pas à chaque re-render)
  if(window.PF?.user && !WEEK_PULSES['_f_'+ck]){
    WEEK_PULSES['_f_'+ck] = true;
    PF.getWeekPulse(key, wk).then(row=>{
      if(row){ WEEK_PULSES[ck] = { athleteFeel: row.athlete_feel, athleteNote: row.athlete_note, coachNote: row.coach_note };
        renderWeekPulse(mondayOf(weekOffset)); }
    }).catch(e=> console.warn('[PF] getWeekPulse :', e));
  }
}
function saveWeekPulseAthlete(key, wk){
  const seg = document.getElementById('wpFeelSeg');
  const sel = seg && seg.querySelector('button.sel');
  const feel = sel ? sel.dataset.feel : null;
  const note = document.getElementById('wpAthNote').value.trim();
  const ck = key+'|'+wk;
  const p = WEEK_PULSES[ck] || (WEEK_PULSES[ck]={});
  p.athleteFeel = feel; p.athleteNote = note;
  if(window.PF?.user){ PF.saveMyWeekFeel(wk, feel, note).catch(e=> console.warn('[PF] saveMyWeekFeel :', e)); }
  renderWeekPulse(mondayOf(weekOffset));
  toast(tr('toast.bilanSemaineEnregistre'));
}
function saveWeekPulseCoach(key, wk){
  const note = document.getElementById('wpCoachNote').value.trim();
  const ck = key+'|'+wk;
  const p = WEEK_PULSES[ck] || (WEEK_PULSES[ck]={});
  p.coachNote = note;
  if(window.PF?.user && rosterIsReal){ PF.saveCoachWeekNote(key, wk, note).catch(e=> console.warn('[PF] saveCoachWeekNote :', e)); }
  renderWeekPulse(mondayOf(weekOffset));
  toast(tr('toast.noteEnregistree'));
}

/* ============================================================
   PROFIL VISUEL DE SÉANCE — mini graphique de barres sous la carte
   ------------------------------------------------------------
   Hauteur = intensité (% de référence), couleur = zone, la ligne
   pointillée = seuil (100%). Séances construites avec l'éditeur :
   profil exact depuis blocksV2. Séances de la bibliothèque : profil
   estimé depuis la zone + le nombre de répétitions dans la description.
   ============================================================ */
function intensityColor(p){
  if(p<62)  return '#2FD9FF'; // récupération (Z1)
  if(p<70)  return '#39E6A3'; // endurance
  if(p<85)  return '#FFD43D'; // tempo
  if(p<100) return '#FFB13D'; // seuil
  if(p<112) return '#FF5470'; // VO2max
  return '#E36BFF';           // anaérobie / sprint
}
function profLineMin(ln, disc){
  if(ln.type==='station') return 4; // ~4 min par station Hyrox
  if(ln.metric==='dist'){
    const kmh = disc==='swim'?3.5:(disc==='run'?12:30);
    return (ln.dist||0)/1000/kmh*60;
  }
  return (ln.dur?.h||0)*60 + (ln.dur?.m||0) + (ln.dur?.s||0)/60;
}
function profLinePct(ln){
  if(ln.type==='station') return 96;
  if(ln.mode==='exact' && ln.exact){
    const ex=ln.exact;
    if(ex.kind==='power')   return ATHLETE_REF.ftp ? ex.w/ATHLETE_REF.ftp*100 : 90;
    if(ex.kind==='speed')   return ATHLETE_REF.vma ? ex.kmh/ATHLETE_REF.vma*100 : 85;
    if(ex.kind==='pace'){ const sec=(ex.m||0)*60+(ex.s||0); const v=sec?3600/sec:0; return ATHLETE_REF.vma&&v ? v/ATHLETE_REF.vma*100 : 85; }
    if(ex.kind==='time100'){ const sec=(ex.m||0)*60+(ex.s||0); return ATHLETE_REF.css&&sec ? ATHLETE_REF.css/sec*100 : 85; }
    if(ex.kind==='rpe')     return (ex.rpe||6)*12;
    return 85;
  }
  return ln.pct||70;
}
const ZONE_PCT = {Z1:55, Z2:65, Z3:80, Z4:95, Z5:108, Z6:118};
/* profil estimé pour les séances sans structure (templates) */
function profileFromDesc(s){
  const dur = s.dur||60;
  const zPct = ZONE_PCT[s.zone] || 60;
  const segs = [];
  const warm = Math.min(20, Math.max(6, dur*0.2));
  const cool = Math.min(15, Math.max(4, dur*0.12));
  const main = Math.max(5, dur - warm - cool);
  // échauffement progressif
  [46,52,58,63].forEach(p=> segs.push({min:warm/4, pct:p}));
  const txt = (s.desc||'')+' '+(s.title||'');
  const hard = zPct>=90 || /vma|vo2|seuil|intervalle|fractionn|sprint/i.test(txt);
  if(s.disc==='hyrox' ){
    // alternance course / station × 8
    for(let i=0;i<8;i++){ segs.push({min:main/16, pct:72}); segs.push({min:main/16, pct:96}); }
  } else if(hard){
    // répétitions : on lit le premier "N×" de la description
    const m = txt.match(/(\d+)\s*[×x]/);
    const reps = Math.min(12, Math.max(3, m?+m[1]:5));
    const work = main*0.6/reps, rest = main*0.4/reps;
    for(let i=0;i<reps;i++){ segs.push({min:work, pct:zPct}); segs.push({min:rest, pct:46}); }
  } else if(s.disc==='strength' || s.zone==='—'){
    for(let i=0;i<3;i++){ segs.push({min:main/4.5, pct:76}); segs.push({min:main/9, pct:48}); }
  } else {
    segs.push({min:main, pct:zPct});
  }
  // retour au calme
  [56,48,42].forEach(p=> segs.push({min:cool/3, pct:p}));
  return segs;
}
function profileSegments(s){
  if(s.blocksV2 && s.blocksV2.blocks){
    const segs=[];
    s.blocksV2.blocks.forEach(blk=>{
      for(let r=0;r<(blk.series||1);r++)
        blk.lines.forEach(ln=> segs.push({min:profLineMin(ln, s.disc), pct:profLinePct(ln)}));
    });
    if(segs.some(x=>x.min>0)) return segs;
  }
  return profileFromDesc(s);
}
function sessionProfileHTML(s){
  const segs = profileSegments(s).filter(x=>x.min>0);
  const total = segs.reduce((a,x)=>a+x.min,0);
  if(!total) return '';
  const n = Math.max(18, Math.min(56, Math.round((s.dur||total)/3)));
  const rnd = seededRand((s.title||'x').split('').reduce((a,c)=>a+c.charCodeAt(0),3)+Math.round(total));
  let bars='', used=0, si=0;
  for(let i=0;i<n;i++){
    const t=(i+0.5)/n*total;
    while(si<segs.length-1 && used+segs[si].min < t){ used+=segs[si].min; si++; }
    const p=Math.max(30, Math.min(125, segs[si].pct + (rnd()*6-3)));
    bars+=`<i style="height:${Math.round(p/125*100)}%;background:${intensityColor(p)}"></i>`;
  }
  return `<div class="sess-profile" aria-hidden="true"><span class="thr"></span>${bars}</div>`;
}

/* ============================================================
   RÉPARTITION DES INTENSITÉS DE LA SEMAINE — prévu vs réalisé
   ------------------------------------------------------------
   Deux barres empilées par zone (mêmes couleurs que les profils) :
   ce qui était planifié vs ce que l'athlète a réellement fait.
   Si les RPE des séances faites dépassent nettement ce qu'on
   attend des zones prévues, une alerte suggère d'adapter la
   charge. Vue coach uniquement.
   ============================================================ */
function sessionZoneMinutes(s){
  const out={Z1:0,Z2:0,Z3:0,Z4:0,Z5:0};
  profileSegments(s).forEach(seg=>{ out['Z'+zoneFromPct(seg.pct)]+=seg.min; });
  return out;
}
function renderWeekIntensity(mon){
  const el=document.getElementById('weekIntensity'); if(!el) return;
  if(mode!=='coach'){ el.hidden=true; return; }
  const Z=['Z1','Z2','Z3','Z4','Z5'];
  const plan={Z1:0,Z2:0,Z3:0,Z4:0,Z5:0}, real={Z1:0,Z2:0,Z3:0,Z4:0,Z5:0};
  let planMin=0, realMin=0, planTss=0, realTss=0;
  let rpeSum=0, rpeExpSum=0, rpeN=0;
  const EXP_RPE={1:2,2:3.5,3:5.5,4:7.5,5:9}; // RPE « normal » attendu par zone dominante
  for(let i=0;i<7;i++){
    (planning[iso(addDays(mon,i))]||[]).forEach(s=>{
      const zm=sessionZoneMinutes(s);
      Z.forEach(z=>{ plan[z]+=zm[z]; if(s.done) real[z]+=zm[z]; });
      planMin+=s.dur||0; planTss+=s.tss||0;
      if(s.done){
        realMin+=s.dur||0; realTss+=s.tss||0;
        if(s.rpe){
          const m=String(s.zone||'').match(/Z(\d)/);
          rpeSum+=s.rpe; rpeExpSum+=EXP_RPE[m?+m[1]:3]||5.5; rpeN++;
        }
      }
    });
  }
  if(!planMin){ el.hidden=true; return; }
  el.hidden=false;
  const maxMin=Math.max(planMin, realMin, 1);
  const bar=dist=> Z.map(z=> dist[z]>0.5?`<i style="width:${(dist[z]/maxMin*100).toFixed(2)}%;background:${ZONE_COLORS[z]}" title="${z} · ${fmtDur(Math.round(dist[z]))}"></i>`:'').join('');
  let alert='';
  if(rpeN>=2){
    const d=(rpeSum-rpeExpSum)/rpeN, avg=(rpeSum/rpeN).toFixed(1);
    if(d>=1.5) alert=`<div class="wk-alert hard"><i class="ic ic-alert-triangle"></i> RPE moyen ${avg} — la semaine est plus éprouvante que prévu : pense à alléger les prochaines séances.</div>`;
    else if(d<=-1.5) alert=`<div class="wk-alert easy"><i class="ic ic-check"></i> RPE moyen ${avg} — la semaine passe mieux que prévu : la charge peut être maintenue, voire montée.</div>`;
  }
  el.innerHTML=`
    <div class="wk-int-head">Intensités de la semaine <span>prévu vs réalisé — pour adapter la charge</span></div>
    <div class="wk-row"><span class="wk-lbl">Prévu</span><div class="wk-bar">${bar(plan)}</div><span class="wk-tot">${fmtDur(Math.round(planMin))} · ${planTss} TSS</span></div>
    <div class="wk-row"><span class="wk-lbl">Réalisé</span><div class="wk-bar">${realMin?bar(real):''}</div><span class="wk-tot">${realMin?`${fmtDur(Math.round(realMin))} · ${realTss} TSS (${planTss?Math.round(realTss/planTss*100):0}%)`:'—'}</span></div>
    <div class="wk-legend">${Z.map(z=>`<span><i style="background:${ZONE_COLORS[z]}"></i>${z}</span>`).join('')}</div>
    ${alert}`;
}

function sessionCard(s, dateKey){
  const D = DISC[s.disc];
  const vid = (mode==='athlete') ? videoForSession(s) : null;
  const el = document.createElement('div');
  el.className = 'session'+(s.done?' done':'')+(vid?' has-video':'');
  el.dataset.disc = s.disc;
  if(vid) el.dataset.video = vid.id;
  el.style.setProperty('--c', D.color);
  el.draggable = (mode==='coach');
  el.innerHTML = `
    <div class="t">${s.title}</div>
    <div class="m"><span>${fmtDur(s.dur)}</span>${s.dist?`<span>${s.dist} km</span>`:''}<span>${s.tss} TSS</span><span>${s.zone}</span>${s.done&&s.rpe?`<span class="rpe-chip" style="color:${rpeColor(s.rpe)}">RPE ${s.rpe}</span>`:''}${s.done&&s.rpeMuscle?`<span class="mus-chip" style="color:${rpeColor(s.rpeMuscle)}" title="Effort musculaire"><i class="ic ic-dumbbell" style="width:10px;height:10px;vertical-align:-1px"></i>${s.rpeMuscle}</span>`:''}</div>
    ${sessionProfileHTML(s)}
    ${vid?`<span class="video-chip">${vid.title}</span>`:''}
    ${s.done?'<span class="done-chip"><i class="ic ic-check"></i></span>':''}
    ${mode==='coach'?`<button class="note-btn ${s.coachNote?'has-note':''}" aria-label="Note pour l'athlète" title="${s.coachNote?dispoSafe(s.coachNote):`Ajouter une note pour l'athlète (pourquoi ce changement)`}"><i class="ic ic-message-circle"></i></button>`:''}
    ${mode==='coach'?'<button class="del" aria-label="Supprimer"><i class="ic ic-x"></i></button>':''}
    ${mode==='athlete'?`<button class="check-btn">${s.done?'<i class="ic ic-check"></i> Séance faite':'Marquer comme faite'}</button>`:''}
  `;
  el.addEventListener('dragstart', e=>{
    if(mode!=='coach') return;
    el.classList.add('dragging');
    e.dataTransfer.setData('text/plain', JSON.stringify({type:'move', id:s.id, from:dateKey}));
  });
  el.addEventListener('dragend', ()=> el.classList.remove('dragging'));
  el.addEventListener('click', e=>{
    if(e.target.closest('.note-btn')){
      const next = prompt("Note pour l'athlète sur cette séance (pourquoi ce changement, ce qu'il faut savoir) :", s.coachNote||'');
      if(next!=null){
        s.coachNote = next.trim() || null;
        if(window.PF?.user && s.id){ PF.setCoachNote(s.id, s.coachNote).catch(err=>console.warn('[PF] setCoachNote', err)); }
        render();
      }
      return;
    }
    if(e.target.closest('.del')){
      if(window.PF?.user && s.id){ PF.deleteScheduled(s.id).catch(err=>console.warn('[PF] deleteScheduled', err)); }
      planning[dateKey] = planning[dateKey].filter(x=>x.id!==s.id); render(); return;
    }
    if(e.target.closest('.check-btn')){
      if(s.done){
        s.done=false; delete s.rpe; delete s.note;
        if(window.PF?.user && s.id){ PF.markSessionDone(s.id, { done:false, rpe:null }).catch(e=>console.warn('[PF] markSessionDone', e)); }
        render();
      }
      else openRpeModal(s);
      return;
    }
    if(e.target.closest('.video-chip') && vid){ openVideo(vid); return; }
    // COACH : cliquer une séance ouvre l'analyse SOUS le calendrier (pas de pop-up).
    // ATHLÈTE : garde la fiche séance (détails, nutrition, mark-done).
    if(mode==='coach') revealAnalysis(s);
    else openModal(s, dateKey);
  });
  return el;
}
/* Ouvre la partie analyse (repliée par défaut, sous le calendrier) et l'amène
   à l'écran. Déclenchée au clic sur une séance à analyser. */
function revealAnalysis(){
  document.body.setAttribute('data-analysis','open');
  const ap=document.getElementById('athPanelStats');
  if(ap) setTimeout(()=>{ try{ ap.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){} }, 80);
}
(function wireAnalysisClose(){
  const b=document.getElementById('analysisClose'); if(!b) return;
  b.onclick=()=>{ document.body.removeAttribute('data-analysis');
    const cal=document.querySelector('.calendar'); if(cal){ try{ cal.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){} } };
})();

/* ---- RPE ---- */
function rpeColor(n){
  if(n<=3) return '#39E6A3';
  if(n<=6) return '#2FD9FF';
  if(n<=8) return '#FFB13D';
  return '#FF5470';
}
function openRpeModal(s){
  const D = DISC[s.disc];
  let rpe = null, rpeMuscle = null;
  modal.style.setProperty('--c', D.color);
  modal.innerHTML = `
    <button class="close" aria-label="Fermer"><i class="ic ic-x"></i></button>
    <span class="badge">${discIcon(D)} ${D.label}</span>
    <h3>Bien joué ! C'était comment ?</h3>
    <p class="desc">Ton ressenti aide ton coach à doser les prochaines séances — sois honnête, pas héroïque.</p>
    <div class="rpe-lbl"><i class="ic ic-zap"></i> Effort cardio / respiratoire</div>
    <div class="rpe-grid" id="rpeCardio">${Array.from({length:10},(_,i)=>`<button data-r="${i+1}" style="--rc:${rpeColor(i+1)}">${i+1}</button>`).join('')}</div>
    <div class="rpe-scale"><span>Très facile</span><span>À fond</span></div>
    <div class="rpe-lbl" style="margin-top:14px"><i class="ic ic-dumbbell"></i> Effort musculaire (jambes) <span class="rpe-opt">facultatif</span></div>
    <div class="rpe-grid" id="rpeMuscle">${Array.from({length:10},(_,i)=>`<button data-m="${i+1}" style="--rc:${rpeColor(i+1)}">${i+1}</button>`).join('')}</div>
    <div class="rpe-scale"><span>Jambes fraîches</span><span>Jambes détruites</span></div>
    <textarea class="rpe-note" placeholder="Un mot pour ton coach ? (sensations, douleurs, conditions…)"></textarea>
    <button class="btn" id="rpeSave" disabled style="opacity:.5">Valider la séance <i class="ic ic-check"></i></button>`;
  overlay.classList.add('open');
  const save = modal.querySelector('#rpeSave');
  modal.querySelectorAll('#rpeCardio button').forEach(b=>{
    b.onclick = ()=>{
      modal.querySelectorAll('#rpeCardio button').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel'); rpe = +b.dataset.r;
      save.disabled=false; save.style.opacity=1;
    };
  });
  modal.querySelectorAll('#rpeMuscle button').forEach(b=>{
    b.onclick = ()=>{
      modal.querySelectorAll('#rpeMuscle button').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel'); rpeMuscle = +b.dataset.m;
    };
  });
  save.onclick = ()=>{
    if(!rpe) return;
    s.done = true; s.rpe = rpe;
    if(rpeMuscle) s.rpeMuscle = rpeMuscle;
    const note = modal.querySelector('.rpe-note').value.trim();
    if(note) s.note = note;
    // Persistance backend (si connecté) — non bloquant.
    if(window.PF?.user && s.id){
      PF.markSessionDone(s.id, { done:true, rpe, rpeMuscle })
        .catch(e=> console.warn('[PF] markSessionDone échoué :', e));
    }
    closeModal(); render();
    // — attribution intelligente du matériel (course à pied) —
    if(s.disc==='run' && typeof recommendShoe==='function'){
      const rec = recommendShoe(s);
      if(rec && rec.shoe){
        const dist = Math.round((s.km || (s.dur||60)/60*11) * 10)/10;
        addGearKm(rec.shoe, dist);
        setTimeout(()=> toast(`+${dist} km attribués à tes ${rec.shoe.name} (${rec.shoe.km}/${rec.shoe.max} km) — modifiable dans Matériel`), 900);
      }
    }
  };
  modal.querySelector('.close').onclick = closeModal;
}

/* ---- modal ---- */
const overlay = document.getElementById('overlay');
const modal = document.getElementById('modal');
/* ============================================================
   ÉDITEUR DE ZONES DE TRAVAIL — coach (#5 retour coach)
   Le coach ouvre l'éditeur pour l'athlète suivi, redéfinit ses zones
   par modèle (nom + borne haute %). Enregistre par athlète.
   ============================================================ */
let ZED = null;   // brouillon d'édition { aid, name, models:{key:[[nom,lo,hi],...]} }

function editableZoneModels(){
  const out=[];
  for(const [k,m] of Object.entries(INTENSITY_MODELS)){
    if(m.invert) continue;                    // allure (seuilRun/css) : zones standard pour l'instant
    let hasRef=false; try{ hasRef=!!m.ref(); }catch(e){}
    if(hasRef || k==='ftp' || k==='vma' || k==='fc') out.push(k);
  }
  return out.length ? out : ['ftp','vma','fc'];
}
/* renormalise les bornes : lo = hi précédent, hi croissant, borné 0..150 */
function zedNormalize(zones){
  let prev=0;
  zones.forEach((z,i)=>{
    z[1]=prev;
    z[2]=Math.max(prev+1, Math.min(150, +z[2]||prev+1));
    if(i===zones.length-1) z[2]=Math.max(z[2],120);
    prev=z[2];
  });
  return zones;
}
function zedModelHTML(key){
  const m=INTENSITY_MODELS[key];
  const zones=ZED.models[key];
  const isCustom = hasCustomZones(key, ZED.aid);
  const total=zones.length, span=zones[total-1][2]||120;
  const bar = zones.map((z,i)=>`<i style="width:${((z[2]-z[1])/span*100).toFixed(1)}%;background:${zoneColorAt(i,total)}"></i>`).join('');
  const rows = zones.map((z,i)=>`
    <div class="zed-row" data-i="${i}">
      <span class="zed-dot" style="background:${zoneColorAt(i,total)}"></span>
      <input class="zed-name" value="${dispoSafe(z[0])}" data-zf="name" aria-label="Nom de la zone">
      <span class="zed-lo">de ${z[1]}%</span>
      <span class="zed-hiwrap">→ <input class="zed-hi" type="number" min="1" max="150" value="${z[2]}" data-zf="hi" aria-label="Borne haute"><span>%</span></span>
      <button class="zed-drow" data-zdel="${i}" aria-label="Supprimer la zone" ${total<=1?'disabled style=opacity:.3':''}><i class="ic ic-x"></i></button>
    </div>`).join('');
  return `<div class="zed-model" data-model="${key}">
    <div class="zed-mhead">
      <span class="zed-mname">${m.label}</span>
      <span class="zed-mtag ${isCustom?'custom':''}">${isCustom?'personnalisé':'standard'}</span>
      <button class="zed-reset" data-zreset="${key}">Réinitialiser</button>
    </div>
    <div class="zed-bar">${bar}</div>
    ${rows}
    <button class="zed-add" data-zadd="${key}">+ Ajouter une zone</button>
  </div>`;
}
function zedRenderModel(key, root){
  const sec=root.querySelector(`.zed-model[data-model="${key}"]`);
  if(sec) sec.outerHTML = zedModelHTML(key);
  zedWireModel(key, root);
}
function zedWireModel(key, root){
  const sec=root.querySelector(`.zed-model[data-model="${key}"]`);
  if(!sec) return;
  const zones=ZED.models[key];
  sec.querySelectorAll('.zed-name').forEach((inp,i)=> inp.addEventListener('input', ()=>{ zones[i][0]=inp.value; }));
  sec.querySelectorAll('.zed-hi').forEach((inp,i)=> inp.addEventListener('change', ()=>{
    zones[i][2]=+inp.value; zedNormalize(zones); zedRenderModel(key, root);
  }));
  sec.querySelectorAll('[data-zdel]').forEach(b=> b.onclick=()=>{
    if(zones.length<=1) return; zones.splice(+b.dataset.zdel,1); zedNormalize(zones); zedRenderModel(key, root);
  });
  sec.querySelector('[data-zadd]').onclick=()=>{
    const last=zones[zones.length-1];
    zones.push(['Nouvelle zone', last[2], Math.min(150,last[2]+10)]); zedNormalize(zones); zedRenderModel(key, root);
  };
  sec.querySelector('[data-zreset]').onclick=()=>{
    ZED.models[key]=JSON.parse(JSON.stringify(INTENSITY_MODELS[key].zones));
    delete (CUSTOM_ZONES[ZED.aid]||{})[key];
    zedRenderModel(key, root);
  };
}
/* toutes les références utilisables pour une zone perso (« tout ce qui existe ») */
const ZONE_REFS = [
  ['ftp','% FTP · vélo'], ['pma','% PMA · vélo'], ['cpBike','% Puissance critique · vélo'],
  ['vma','% VMA · course'], ['cv','% Vitesse critique · course'], ['seuilRun','% allure seuil · course'],
  ['css','% CSS · natation'], ['fc','% FC max']
];
function customZones(aid){ aid=aid||zoneAthleteId(); return (CUSTOM_ZONES[aid] && CUSTOM_ZONES[aid]._custom) || []; }
/* aperçu de cible pour une zone perso (ex. "230 → 260 W") */
function zcTargetHint(ref, lo, hi){
  try{ const a=computeTarget(ref,lo), b=computeTarget(ref,hi); if(!a||!b) return '';
    const unit=(b.match(/[^0-9.,\s]+.*$/)||[''])[0]; const bn=b.replace(/\s*[^0-9.,].*$/,'');
    return `${a.replace(/\s*[^0-9.,].*$/,'')} → ${b}`; }catch(e){ return ''; }
}
function zcRowHTML(z,i){
  return `<div class="zc-row" data-i="${i}">
    <span class="zc-dot" style="background:${zoneColorAt(i, Math.max(1,ZED.custom.length))}"></span>
    <input class="zc-name" value="${dispoSafe(z.name)}" data-zc="name" placeholder="Nom de la zone">
    <select data-zc="ref">${ZONE_REFS.map(([k,l])=>`<option value="${k}" ${k===z.ref?'selected':''}>${l}</option>`).join('')}</select>
    <span class="zc-range">de <input type="number" min="0" max="200" value="${z.lo}" data-zc="lo"> à <input type="number" min="0" max="200" value="${z.hi}" data-zc="hi"> %</span>
    <button class="zed-drow" data-zcdel="${i}" aria-label="Supprimer"><i class="ic ic-x"></i></button>
    <div class="zc-tgt">${zcTargetHint(z.ref,z.lo,z.hi)}</div>
  </div>`;
}
function zedRenderCustom(root){
  root.innerHTML = `<p class="zed-note">Crée tes propres zones de travail : nomme-les, choisis la référence (FTP, puissance critique, %VMA, CV, CSS, FC…) et l'intensité. Elles apparaissent dans le sélecteur de zone à la création de séance.</p>`
    + (ZED.custom.length ? ZED.custom.map(zcRowHTML).join('') : `<div class="zc-empty">Aucune zone perso — ajoute ta première ci-dessous.</div>`)
    + `<button class="zed-add" id="zcAdd">+ Ajouter une zone perso</button>`;
  zedWireCustom(root);
}
function zedWireCustom(root){
  root.querySelectorAll('.zc-row').forEach(rowEl=>{
    const i=+rowEl.dataset.i; const z=ZED.custom[i];
    rowEl.querySelectorAll('[data-zc]').forEach(inp=>{
      const f=inp.dataset.zc;
      inp.addEventListener(f==='ref'?'change':'input', ()=>{
        if(f==='name') z.name=inp.value;
        else if(f==='ref'){ z.ref=inp.value; const tgt=rowEl.querySelector('.zc-tgt'); if(tgt) tgt.textContent=zcTargetHint(z.ref,z.lo,z.hi); }
        else { z[f]=Math.max(0,Math.min(200,+inp.value||0)); const tgt=rowEl.querySelector('.zc-tgt'); if(tgt) tgt.textContent=zcTargetHint(z.ref,z.lo,z.hi); }
      });
    });
    rowEl.querySelector('[data-zcdel]').onclick=()=>{ ZED.custom.splice(i,1); zedRenderCustom(root); };
  });
  const add=root.querySelector('#zcAdd');
  if(add) add.onclick=()=>{ ZED.custom.push({name:'Nouvelle zone', ref:'ftp', lo:88, hi:95}); zedRenderCustom(root); };
}

function openZoneEditor(){
  const aid=zoneAthleteId();
  const name=(typeof ROSTER!=='undefined' && ROSTER[selectedAthleteIdx] && ROSTER[selectedAthleteIdx].name)
    || (typeof ATHLETE_NAME!=='undefined'?ATHLETE_NAME:'cet athlète');
  const models=editableZoneModels();
  ZED={ aid, name, models:{}, custom: JSON.parse(JSON.stringify(customZones(aid))) };
  models.forEach(k=> ZED.models[k]=JSON.parse(JSON.stringify(zonesFor(k, aid))));
  const el=document.createElement('div'); el.className='adh-overlay';
  el.innerHTML=`<div class="adh-modal zed-modal" role="dialog" aria-label="Zones de travail">
    <button class="adh-close" aria-label="Fermer"><i class="ic ic-x"></i></button>
    <h3>Zones de travail — ${dispoSafe(name)}</h3>
    <p class="adh-sub">Adapte les zones de l'athlète (test lactate, ressenti terrain…). Elles servent à la création de séance et à l'analyse.</p>
    <div class="zed-tabs">
      <button class="zed-tab on" data-ztab="ref">Par référence</button>
      <button class="zed-tab" data-ztab="custom">Zones perso</button>
    </div>
    <div class="zed-panel" id="zedPanelRef">
      <div id="zedModels">${models.map(zedModelHTML).join('')}</div>
      <p class="zed-note">La borne basse d'une zone suit la borne haute de la précédente. Les zones en allure (natation CSS, allure seuil course) gardent le modèle standard.</p>
    </div>
    <div class="zed-panel" id="zedPanelCustom" hidden></div>
    <button class="btn asg-go" id="zedSave" style="margin-top:16px">Enregistrer les zones</button>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('open'));
  const root=el.querySelector('#zedModels');
  models.forEach(k=> zedWireModel(k, root));
  const customRoot=el.querySelector('#zedPanelCustom');
  zedRenderCustom(customRoot);
  el.querySelectorAll('.zed-tab').forEach(tab=> tab.onclick=()=>{
    el.querySelectorAll('.zed-tab').forEach(t=>t.classList.toggle('on', t===tab));
    el.querySelector('#zedPanelRef').hidden = tab.dataset.ztab!=='ref';
    el.querySelector('#zedPanelCustom').hidden = tab.dataset.ztab!=='custom';
  });
  const close=()=>{ el.classList.remove('open'); setTimeout(()=>el.remove(),180); };
  el.querySelector('.adh-close').onclick=close;
  el.addEventListener('click', e=>{ if(e.target===el) close(); });
  document.addEventListener('keydown', function esc(ev){ if(ev.key==='Escape'){ close(); document.removeEventListener('keydown',esc); } });
  el.querySelector('#zedSave').onclick=()=>{
    CUSTOM_ZONES[aid] = CUSTOM_ZONES[aid] || {};
    models.forEach(k=>{
      const z=zedNormalize(ZED.models[k]);
      // identique au défaut → on ne stocke rien (reste "standard")
      const def=JSON.stringify(INTENSITY_MODELS[k].zones);
      if(JSON.stringify(z)===def) delete CUSTOM_ZONES[aid][k];
      else CUSTOM_ZONES[aid][k]=z;
    });
    // zones perso libres : nettoyées (nom + bornes cohérentes) puis stockées
    const clean = ZED.custom.map(z=>({ name:(z.name||'Zone').trim()||'Zone', ref:z.ref||'ftp',
      lo:Math.max(0,Math.min(200,+z.lo||0)), hi:Math.max(0,Math.min(200,+z.hi||0)) }))
      .map(z=> (z.hi<z.lo?{...z,lo:z.hi,hi:z.lo}:z));
    if(clean.length) CUSTOM_ZONES[aid]._custom = clean; else delete CUSTOM_ZONES[aid]._custom;
    if(!Object.keys(CUSTOM_ZONES[aid]).length) delete CUSTOM_ZONES[aid];
    persistCustomZones(aid);
    // rafraîchir le builder seulement s'il est réellement ouvert (builderState posé)
    if(typeof renderBlocks==='function' && typeof builderState!=='undefined' && builderState && document.getElementById('bBlocks') && document.getElementById('bBlocks').children.length) renderBlocks();
    toast(tr('toast.zonesTravailEnregistrees'));
    close();
  };
}

/* libellé court d'un intervalle pour situer un commentaire (vue athlète) */
function lineLabel(ln){
  if(ln.type==='station'){ const st=hyroxStation(ln.station)||HYROX_STATIONS[0]; return st.name; }
  const T=LINE_TYPES[ln.type];
  const amt = (ln.metric==='dist') ? `${ln.dist||0} m` : `${(ln.dur&&ln.dur.m)||0}'`;
  return `${T?T.l:tr('lineType.interval')} · ${amt}`;
}
/* section "Consignes du coach par intervalle" : liste les intervalles porteurs
   d'une note. Additif — n'apparaît que si au moins un commentaire existe. */
const OBJECTIF_META = {
  endurance:{get l(){return tr('objectif.endurance.l')}, ic:'ic-mountain',
    get why(){return tr('objectif.endurance.why')}},
  seuil:{get l(){return tr('objectif.seuil.l')}, ic:'ic-zap',
    get why(){return tr('objectif.seuil.why')}},
  vo2:{get l(){return tr('objectif.vo2.l')}, ic:'ic-chart',
    get why(){return tr('objectif.vo2.why')}},
  recup:{get l(){return tr('objectif.recup.l')}, ic:'ic-moon',
    get why(){return tr('objectif.recup.why')}},
  hyrox:{get l(){return tr('objectif.hyrox.l')}, ic:'ic-dumbbell',
    get why(){return tr('objectif.hyrox.why')}}
};
/* Note du coach sur CETTE séance (traçabilité d'un ajustement : décalage,
   allègement, changement de contenu…) — posée via le bouton 💬 de la carte,
   distincte des consignes par intervalle (sessionNotesHTML) et du texte
   pédagogique générique (sessionWhyHTML). */
function sessionCoachNoteHTML(s){
  if(!s.coachNote) return '';
  return `<div class="sn-block"><div class="sn-head"><i class="ic ic-message-circle"></i> Note de ton coach sur cette séance</div><div class="sn-item"><div class="sn-txt">${dispoSafe(s.coachNote)}</div></div></div>`;
}
function sessionWhyHTML(s){
  const type = (s.objectif&&s.objectif.type) || sessionType(s);
  const m = OBJECTIF_META[type]; if(!m) return '';
  return `<div class="sn-block"><div class="sn-head"><i class="ic ${m.ic}"></i> Pourquoi cette séance</div><div class="sn-item"><div class="sn-txt">${m.why}</div></div></div>`;
}
function sessionNotesHTML(s){
  if(!s.blocksV2 || !s.blocksV2.blocks) return '';
  const items=[];
  s.blocksV2.blocks.forEach((blk,bi)=>{
    blk.lines.forEach(ln=>{
      if(ln.note && ln.note.trim()){
        const lbl = lineLabel(ln);
        const pre = (blk.series>1?`${blk.series}× `:'') + (blk.title && !lbl.startsWith(blk.title) ? blk.title+' — ' : '');
        items.push(`<div class="sn-item"><div class="sn-when">${dispoSafe(pre+lbl)}</div><div class="sn-txt">${dispoSafe(ln.note.trim())}</div></div>`);
      }
    });
  });
  if(!items.length) return '';
  return `<div class="sn-block"><div class="sn-head"><i class="ic ic-message-circle"></i> Consignes du coach par intervalle</div>${items.join('')}</div>`;
}

function openModal(s){
  const D = DISC[s.disc];
  modal.style.setProperty('--c', D.color);
  modal.innerHTML = `
    <button class="close" aria-label="Fermer"><i class="ic ic-x"></i></button>
    <span class="badge">${discIcon(D)} ${D.label}</span>
    <h3>${s.title}</h3>
    <div class="grid">
      <div class="cell"><div class="k">Durée</div><div class="v">${s.dur}'</div></div>
      <div class="cell"><div class="k">Charge</div><div class="v">${s.tss} TSS</div></div>
      <div class="cell"><div class="k">Intensité</div><div class="v">${s.zone}</div></div>
    </div>
    <p class="desc">${s.desc||'Séance planifiée.'}</p>
    ${sessionCoachNoteHTML(s)}
    ${sessionWhyHTML(s)}
    ${sessionNotesHTML(s)}
    ${(()=>{ const n=nutritionForSession(s); return `
      <div class="nutri-block nutri-pre">
        <div class="nutri-head"><i class="ic ic-utensils"></i> Avant la séance</div>
        <div class="nutri-txt">${n.pre}</div>
        ${n.during?`<div class="nutri-during">⏱ Pendant : ${n.during}</div>`:''}
      </div>`; })()}
    ${s.done&&s.rpe?`<div class="fb-block"><div class="k">Feedback athlète</div>Cardio <b style="color:${rpeColor(s.rpe)}">RPE ${s.rpe}/10</b>${s.rpeMuscle?` · Musculaire <b style="color:${rpeColor(s.rpeMuscle)}">${s.rpeMuscle}/10</b>`:''}${s.note?` — «&nbsp;${s.note}&nbsp;»`:''}</div>`:''}
    ${(()=>{ const n=nutritionForSession(s); return `
      <div class="nutri-block nutri-post">
        <div class="nutri-head"><i class="ic ic-utensils"></i> Après la séance · récupération</div>
        <div class="nutri-txt">${n.post}</div>
      </div>`; })()}
    ${s.done?`<button class="btn" id="openAnalysis" style="width:100%;margin-bottom:9px;background:var(--swim)"><i class="ic ic-chart"></i> Analyse détaillée de la séance</button>`:''}
    <button class="btn" style="${s.done?'width:100%;background:transparent;border:1px solid var(--line-strong);color:var(--text)':''}">${s.done?'Fermer':"C'est noté, coach"}</button>`;
  overlay.classList.add('open');
  modal.querySelector('.close').onclick = closeModal;
  modal.querySelectorAll('.btn').forEach(btn=>{ if(btn.id!=='openAnalysis') btn.onclick = closeModal; });
  const an = modal.querySelector('#openAnalysis');
  if(an) an.onclick = ()=>{ closeModal(); openAnalysis(s); };
}
function closeModal(){ overlay.classList.remove('open') }
overlay.addEventListener('click', e=>{ if(e.target===overlay) closeModal() });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal() });

/* ---- verrouillage des vues selon le rôle réel du compte connecté ----
   En démo (pas connecté) : les 3 portes restent librement explorables, c'est
   voulu (aperçu marketing). Une fois VRAIMENT connecté, le compte a un seul
   rôle réel (coach/athlete/club_admin) : les deux autres vues sont grisées
   et bloquées — cliquer dessus n'y donne pas accès, juste un message vers
   le support si un changement de rôle est vraiment nécessaire. */
function realRoleMode(){
  const r = window.PF?.profile?.role;
  if(!r) return null;
  return r==='club_admin' ? 'club' : r;
}
function guardModeSwitch(target){
  const real = realRoleMode();
  if(real && real!==target){
    toast("Cette vue n'est pas disponible pour ton compte — contacte le support pour changer de rôle.");
    return false;
  }
  return true;
}
window.__pf_lockModes = function(realMode){
  const map = {coach:mc, athlete:ma, club:mcl};
  Object.entries(map).forEach(([k,btn])=>{
    const locked = k!==realMode;
    btn.classList.toggle('mode-locked', locked);
    btn.title = locked ? "Réservé à un autre type de compte — contacte le support pour changer de rôle" : '';
  });
  const target = map[realMode];
  if(target && !target.classList.contains('active')) target.click();
};

/* ---- navigation & modes ---- */
document.getElementById('prevWeek').onclick = ()=>{ weekOffset--; render() };
document.getElementById('nextWeek').onclick = ()=>{ weekOffset++; render() };
const mc = document.getElementById('modeCoach'), ma = document.getElementById('modeAthlete'), mcl = document.getElementById('modeClub');
function setActiveMode(btn){
  [mc,ma,mcl].forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  // mobile (colonnes empilées) : le panneau latéral est AU-DESSUS du calendrier
  // → on y amène l'utilisateur au changement de mode, sinon il ne le voit jamais
  if(window.innerWidth<=980) setTimeout(()=>{
    // athlète/club : on amène au panneau (sous le calendrier) — coach : en haut du calendrier
    const cible = (mode==='coach') ? document.querySelector('.planner') : document.getElementById('library');
    if(cible) cible.scrollIntoView({behavior:'smooth', block:'start'});
  }, 120);
}
mc.onclick = ()=>{ if(!guardModeSwitch('coach')) return; mode='coach'; setActiveMode(mc); renderSidebar(); render(); updateVideolibVisibility(); updatePlanAthleteVisibility(); if(typeof renderCoachBand==='function') renderCoachBand(); if(typeof renderGear==='function') renderGear(); };
ma.onclick = ()=>{
  if(!guardModeSwitch('athlete')) return;
  mode='athlete'; setActiveMode(ma);
  // la vue Athlète = SON espace : on restaure les données de l'athlète démo (roster[0])
  if(!rosterIsReal && selectedAthleteIdx!==0){ selectedAthleteIdx=0; applyDemoAthlete(0); renderAthPicker(); }
  else if(typeof renderGear==='function') renderGear();
  renderSidebar(); render(); updateVideolibVisibility(); updatePlanAthleteVisibility();
};
mcl.onclick = ()=>{ if(!guardModeSwitch('club')) return; mode='club'; setActiveMode(mcl); updateVideolibVisibility(); renderClub(); updatePlanAthleteVisibility(); };
/* ---- Sélecteur d'athlète : rendu + bascule ---- */
let BASE_PLANNING = null;   // plan de référence (celui de l'athlète 1), figé au 1er changement
function mulberry(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function apRowHtml(a, i){
  const forme = athForme(a), fc = athFormeColor(forme);
  const sub = a.race ? `${a.race.name} · J–${a.race.days}` : 'Athlète suivi';
  const dk = athDispo(a);
  const dchip = dk && dk!=='ok' ? `<span class="ap-dispo" style="--fc:${DISPO_META[dk].c}"><i class="ic ${DISPO_META[dk].ic}"></i>${DISPO_META[dk].l}</span>` : '';
  return `<button class="ap-row ${i===selectedAthleteIdx?'sel':''}" data-idx="${i}" role="option" aria-selected="${i===selectedAthleteIdx}">
    <span class="ap-av" style="--ac:${a.color}">${a.ini}</span>
    <span><span class="ap-n">${a.name}</span><span class="ap-sub" style="display:block">${sub}</span></span>
    <span class="ap-right">
      <span class="ap-forme" style="--fc:${fc}">${forme==null?'—':forme+'%'}</span>
      ${dchip || (forme!=null?`<span class="ap-note" style="--fc:${fc}">${athNote(forme)}</span>`:'')}
    </span>
  </button>`;
}
function openAdherence(){
  const rows = ROSTER.length ? ROSTER.map(a=>{
    const forme=athForme(a);
    const comp = (a.comp!=null ? Math.round(a.comp*100) : null);
    const cc = comp==null?'var(--muted)': comp>=85?'var(--good)': comp>=60?'var(--bike)':'var(--run)';
    const status = comp==null?'—': comp>=85?'À jour': comp>=60?'À surveiller':'Décroche';
    const race = a.race ? `${a.race.name} · J–${a.race.days}` : '—';
    const dk = athDispo(a); const dm = dk ? DISPO_META[dk] : null;
    const dcell = dm ? `<span class="adh-pill" style="color:${dm.c};border-color:${dm.c}" ${a.checkin.dispoNote?`title="${dispoSafe(a.checkin.dispoNote)}"`:''}>${dm.l}</span>${dk!=='ok'&&a.checkin.dispoNote?`<div style="font-size:10px;color:var(--muted);margin-top:3px;max-width:150px">${dispoSafe(a.checkin.dispoNote)}</div>`:''}` : '—';
    return `<tr>
      <td><span class="adh-av" style="--ac:${a.color||'var(--accent)'}">${a.ini||initials(a.name)}</span>${a.name}</td>
      <td style="color:${athFormeColor(forme)}">${forme==null?'—':forme+'%'}</td>
      <td>${dcell}</td>
      <td><span class="adh-bar"><i style="width:${comp==null?0:comp}%;background:${cc}"></i></span><span style="color:${cc}">${comp==null?'—':comp+'%'}</span></td>
      <td>${race}</td>
      <td><span class="adh-pill" style="color:${cc};border-color:${cc}">${status}</span></td>
    </tr>`;
  }).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:22px">Aucun athlète pour l'instant. Invite un athlète pour suivre son adhérence au plan ici.</td></tr>`;
  const el=document.createElement('div'); el.className='adh-overlay';
  el.innerHTML=`<div class="adh-modal" role="dialog" aria-label="Suivi de mes athlètes">
    <button class="adh-close" aria-label="Fermer"><i class="ic ic-x"></i></button>
    <h3>Suivi de mes athlètes</h3>
    <p class="adh-sub">Adhérence au plan (séances réalisées vs prévues), forme et disponibilité du jour, pour repérer d'un coup d'œil qui décroche ou qui est blessé.</p>
    <div class="adh-scroll"><table class="adh-tbl">
      <thead><tr><th>Athlète</th><th>Forme</th><th>Dispo</th><th>Adhérence</th><th>Prochaine course</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('open'));
  const close=()=>{ el.classList.remove('open'); setTimeout(()=>el.remove(),180); };
  el.querySelector('.adh-close').onclick=close;
  el.addEventListener('click', e=>{ if(e.target===el) close(); });
  document.addEventListener('keydown', function esc(ev){ if(ev.key==='Escape'){ close(); document.removeEventListener('keydown',esc); } });
}
/* Factures Stripe des athlètes qui paient ce coach (montant, part Sillance, PDF).
   Réel = relit l'API Stripe via l'edge function coach-invoices (rien stocké côté
   app) ; démo = 3 lignes fictives pour montrer le rendu. */
function openCoachInvoices(){
  const renderRows=(invoices)=> invoices.length ? invoices.map(inv=>`<tr>
      <td>${new Date(inv.created).toLocaleDateString(localeStr(),{day:'2-digit',month:'short',year:'numeric'})}</td>
      <td>${inv.athlete_name}</td>
      <td>${inv.offer_name}</td>
      <td>${inv.amount_paid.toFixed(2)} €</td>
      <td style="color:var(--muted)">${inv.fee_amount!=null ? inv.fee_amount.toFixed(2)+' €' : '~'+(inv.amount_paid*inv.fee_percent/100).toFixed(2)+' €'} <small>(${inv.fee_percent}%)</small></td>
      <td>${inv.invoice_pdf ? `<a href="${inv.invoice_pdf}" target="_blank" rel="noopener">PDF</a>` : '—'}</td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:22px">Aucune facture pour l'instant. Dès qu'un athlète paie son suivi, la facture Stripe apparaît ici automatiquement.</td></tr>`;
  const shell=(rowsHtml)=>`<div class="adh-modal" role="dialog" aria-label="Mes factures">
    <button class="adh-close" aria-label="Fermer"><i class="ic ic-x"></i></button>
    <h3>Mes factures</h3>
    <p class="adh-sub">Factures générées automatiquement par Stripe à chaque paiement de tes athlètes — montant encaissé, part Sillance (frais de service et facturation), lien PDF.</p>
    <div class="adh-scroll"><table class="adh-tbl">
      <thead><tr><th>Date</th><th>Athlète</th><th>Offre</th><th>Montant</th><th>Part Sillance</th><th>Facture</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>
  </div>`;
  const el=document.createElement('div'); el.className='adh-overlay';
  el.innerHTML=shell(`<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:22px">Chargement…</td></tr>`);
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('open'));
  const close=()=>{ el.classList.remove('open'); setTimeout(()=>el.remove(),180); };
  const wire=()=>{
    el.querySelector('.adh-close').onclick=close;
    el.addEventListener('click', e=>{ if(e.target===el) close(); });
    document.addEventListener('keydown', function esc(ev){ if(ev.key==='Escape'){ close(); document.removeEventListener('keydown',esc); } });
  };
  wire();
  if(window.PF?.user){
    PF.getCoachInvoices().then(({invoices})=>{
      el.querySelector('.adh-modal').outerHTML=shell(renderRows(invoices||[]));
      wire();
    }).catch(e=>{ console.warn('[PF] coach-invoices:',e); el.querySelector('.adh-modal').outerHTML=shell(`<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:22px">Factures indisponibles pour l'instant.</td></tr>`); wire(); });
  } else {
    const demo=[0,1,2].map(i=>({
      created:new Date(Date.now()-i*30*86400000).toISOString(),
      athlete_name:COACH_ROSTER[i%COACH_ROSTER.length].name,
      offer_name:COACH_OFFER.name,
      amount_paid:COACH_OFFER.price,
      fee_amount:null,
      fee_percent:2,
      invoice_pdf:null,
    }));
    el.querySelector('.adh-modal').outerHTML=shell(renderRows(demo));
    wire();
  }
}
/* Invite un athlète par lien (copie / WhatsApp / email si Resend configuré).
   Backend déjà en place (invite-athlete + accept-invite, token dans l'URL
   ?invite=...) — ceci est l'UI qui le déclenche, elle manquait totalement. */
function openInviteAthlete(){
  const formHTML=()=>`<div class="adh-modal" role="dialog" aria-label="Inviter un athlète">
    <button class="adh-close" aria-label="Fermer"><i class="ic ic-x"></i></button>
    <h3>Inviter un athlète</h3>
    <p class="adh-sub">Entre son e-mail : Sillance lui envoie un lien (par e-mail si possible, sinon tu le partages toi-même par WhatsApp, SMS…). Il crée son compte ou se connecte, et vous êtes reliés automatiquement.</p>
    <div class="invite-linkrow">
      <input type="email" id="invAthEmail" placeholder="email@athlete.fr" autocomplete="email">
      <button class="cc-btn" id="invAthSend">Envoyer l'invitation</button>
    </div>
    <div id="invAthResult"></div>
  </div>`;
  const el=document.createElement('div'); el.className='adh-overlay';
  el.innerHTML=formHTML();
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('open'));
  const close=()=>{ el.classList.remove('open'); setTimeout(()=>el.remove(),180); };
  const wireClose=()=>{
    el.querySelector('.adh-close').onclick=close;
    el.addEventListener('click', e=>{ if(e.target===el) close(); });
    document.addEventListener('keydown', function esc(ev){ if(ev.key==='Escape'){ close(); document.removeEventListener('keydown',esc); } });
  };
  wireClose();
  const showResult=(inviteUrl, emailed, email)=>{
    const msg = emailed
      ? `<div class="cc-s" style="color:#39e6a3;margin-bottom:8px"><i class="ic ic-check"></i> Email envoyé à ${email}. Garde ce lien de secours au cas où :</div>`
      : `<div class="cc-s" style="margin-bottom:8px">Copie ce lien et envoie-le toi-même (WhatsApp, SMS…) :</div>`;
    document.getElementById('invAthResult').innerHTML = `${msg}
      <div class="invite-linkrow"><input type="text" id="invAthLink" readonly value="${inviteUrl}"></div>
      <div class="invite-share">
        <button class="invite-copy cc-btn" id="invAthCopy">Copier le lien</button>
        <button class="invite-wa" id="invAthWa">WhatsApp</button>
      </div>
      <p class="cr-note" style="margin-top:10px">Une fois qu'il aura rejoint, retrouve « Fiche athlète » dans son bandeau pour renseigner VO2max, records, blessures et habitudes.</p>`;
    document.getElementById('invAthCopy').onclick=()=>{
      const inp=document.getElementById('invAthLink'); inp.select();
      try{ navigator.clipboard.writeText(inp.value); }catch(e){ document.execCommand && document.execCommand('copy'); }
      toast(tr('toast.lienCopie'));
    };
    document.getElementById('invAthWa').onclick=()=>{
      const msgWa=`Rejoins-moi sur Sillance pour ton suivi d'entraînement : ${inviteUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msgWa)}`, '_blank');
    };
  };
  document.getElementById('invAthSend').onclick=async ()=>{
    const email=document.getElementById('invAthEmail').value.trim();
    if(!email || !email.includes('@')){ toast(tr('toast.entreEMailValide')); return; }
    if(window.PF?.user){
      try{
        const {inviteUrl, emailed} = await PF.inviteAthlete(email);
        showResult(inviteUrl, emailed, email);
      }catch(e){ console.warn('[PF] inviteAthlete:',e); toast(tr('toast.invitationImpossiblePourMoment'), 'error'); }
    } else {
      const demoUrl = `${location.origin}${location.pathname}?invite=demo-${Date.now()}`;
      showResult(demoUrl, false, email);
      toast(tr('toast.demoConnecteToiPourEnvoyer'));
    }
  };
}
function renderAthPicker(){
  const btn=document.getElementById('apBtn'), menu=document.getElementById('apMenu');
  if(!btn || !menu) return;
  if(!ROSTER.length){
    btn.innerHTML = `<span>Aucun athlète</span><span class="ap-chev"></span>`;
    menu.innerHTML = `<div class="ap-head">Aucun athlète lié — invite ton premier athlète pour le suivre ici.</div>`;
    return;
  }
  const a = ROSTER[selectedAthleteIdx];
  const forme = athForme(a);
  btn.innerHTML = `<span class="ap-av" style="--ac:${a.color}">${a.ini}</span>
    <span>${a.name}</span>
    <span class="ap-forme" style="--fc:${athFormeColor(forme)}">${forme==null?'—':forme+'%'}</span>
    <span class="ap-chev"></span>`;
  menu.innerHTML = `<div class="ap-head">Mes athlètes · forme du check-in de ce matin</div>` +
    ROSTER.map((x,i)=>apRowHtml(x,i)).join('');
  menu.querySelectorAll('.ap-row').forEach(r=> r.onclick=()=>selectAthlete(+r.dataset.idx));
}
function selectAthlete(i){
  selectedAthleteIdx = i;
  const a = ROSTER[i];
  document.getElementById('apMenu').hidden = true;
  document.getElementById('apBtn').setAttribute('aria-expanded','false');
  if(rosterIsReal){
    currentAthleteId = a.id;
    if(typeof window.__pf_loadPlanningFor==='function') window.__pf_loadPlanningFor(currentAthleteId);
  } else {
    applyDemoAthlete(i);
  }
  renderAthPicker();
  renderCoachBand();
}
/* Reconstruit le planning affiché pour l'athlète démo i : même trame que le
   plan de base, mais assiduité (done/rpe) et volume propres à chacun. */
function applyDemoAthlete(i){
  const a = COACH_ROSTER[i];
  if(!BASE_PLANNING) BASE_PLANNING = JSON.parse(JSON.stringify(planning));
  for(const k of Object.keys(planning)) delete planning[k];
  const rnd = mulberry(1000 + i*77);
  const todayK = iso(new Date());
  for(const k of Object.keys(BASE_PLANNING)){
    for(const s of BASE_PLANNING[k]){
      if(i>0 && rnd() < a.drop) continue;
      const c = {...s};
      if(i>0 && k < todayK && c.done){
        c.done = rnd() < a.comp;
        if(c.done){
          c.rpe = Math.max(2, Math.min(10, (s.rpe||5) + Math.round((rnd()-0.5)*2)));
          // effort musculaire : plus marqué en course/renfo/Hyrox qu'à vélo/nat
          const musBias = (c.disc==='run'||c.disc==='strength'||c.disc==='hyrox') ? 1 : -1;
          c.rpeMuscle = Math.max(2, Math.min(10, c.rpe + musBias + Math.round((rnd()-0.5)*2)));
        } else { c.rpe = null; c.rpeMuscle = null; }
      }
      (planning[k] ||= []).push(c);
    }
  }
  // séances/cycles attribués en masse à CET athlète (openAssign) : réappliqués
  // après la reconstruction, sinon ils disparaîtraient à chaque bascule
  const extra = ASSIGN_EXTRA[a.id];
  if(extra) for(const k of Object.keys(extra)) (planning[k] ||= []).push(...extra[k]);
  Object.assign(checkin, a.checkin);
  // dispo : ne pas laisser traîner celle de l'athlète précédent si absente
  checkin.dispo = a.checkin.dispo || 'ok';
  checkin.dispoNote = a.checkin.dispoNote || '';
  const rc = document.getElementById('raceCountdown'); if(rc) rc.textContent = 'J–'+a.race.days;
  const rn = document.getElementById('raceName'); if(rn) rn.textContent = a.race.name;
  // matériel : celui que CET athlète a renseigné (vide = vide, on n'invente rien)
  if(typeof GEAR!=='undefined'){ GEAR = JSON.parse(JSON.stringify(a.gear||[])); renderGear(); }
  renderSidebar(); render();
  if(typeof renderCoachBand==='function') renderCoachBand();
}
/* Bandeau coach : identité de l'athlète suivi, forme du matin en anneau,
   détail du check-in et alertes actionnables (usure matériel, course proche,
   assiduité faible). C'est le cockpit "quel athlète je regarde, où il en est". */
/* Bilan d'entraînement d'un athlète, exportable en PDF (impression navigateur).
   Rassemble charge (CTL/ATL/TSB), semaine, records, références, séances
   récentes et matériel dans un document A4 clair et brandé. */
function exportBilan(name){
  try{
    name = name || (typeof ATHLETE_NAME!=='undefined'?ATHLETE_NAME:'Athlète');
    const ref = (typeof ATHLETE_REF!=='undefined')?ATHLETE_REF:{};
    const recs = (typeof RECORDS!=='undefined')?RECORDS:[];
    let gear=[]; try{ gear=(GEAR||[]).filter(g=>g.type==='shoe'); }catch(e){}
    let ctl=null,atl=null,tsb=null;
    try{ ctl=Math.round(STRAVA_DEMO.ctl.at(-1)); atl=Math.round(STRAVA_DEMO.atl.at(-1)); tsb=ctl-atl; }catch(e){}
    let done=0,tot=0,wtss=0,recent=[];
    try{ const mon=mondayOf(0);
      for(let i=0;i<7;i++){ (planning[iso(addDays(mon,i))]||[]).forEach(s=>{ tot++; wtss+=(s.tss||0); if(s.done)done++; }); }
      for(let i=-7;i<7;i++){ const d=iso(addDays(mon,i)); (planning[d]||[]).forEach(s=>recent.push({date:d,s})); }
    }catch(e){}
    const comp = tot?Math.round(done/tot*100):null;
    recent = recent.slice(-10);
    let race=null; try{ race=UPCOMING_RACES&&UPCOMING_RACES[0]; }catch(e){}
    const REFL={ftp:['FTP','W'],pma:['PMA','W'],cpBike:['CP vélo','W'],vma:['VMA','km/h'],cv:['VC','km/h'],seuilRun:['Seuil','s/km'],css:['CSS','s/100m'],fcMax:['FC max','bpm'],fcRepos:['FC repos','bpm']};
    const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const dfmt=d=>{ try{ return new Date(d).toLocaleDateString(localeStr(),{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return d; } };
    const today=new Date().toLocaleDateString(localeStr(),{day:'numeric',month:'long',year:'numeric'});
    const tsbCls = tsb==null?'':tsb>=5?'good':tsb>-15?'warn':'bad';
    const compCls = comp==null?'':comp>=85?'good':comp>=60?'warn':'bad';
    const refRows = Object.keys(REFL).filter(k=>ref[k]!=null&&ref[k]!=='').map(k=>`<div class="row"><span class="l">${REFL[k][0]}</span><span class="v">${esc(ref[k])} <em>${REFL[k][1]}</em></span></div>`).join('');
    const recRows = recs.length?recs.map(r=>`<div class="row"><span class="l">${esc(r.d)}</span><span class="v">${esc(r.v)}${r.isNew?' <span class="tag" style="background:#e6f7ef;color:#0a9b6a">RECORD</span>':''}</span></div>`).join(''):'<div class="row"><span class="l">Aucun record enregistré</span></div>';
    const sessRows = recent.length?recent.map(({date,s})=>`<tr><td>${dfmt(date)}</td><td>${esc(s.title||s.disc||'Séance')}</td><td>${s.tss?esc(s.tss)+' TSS':'—'}</td><td>${s.done?(s.rpe?'RPE '+esc(s.rpe):'<i class="ic ic-check"></i> fait'):'à venir'}</td></tr>`).join(''):'<tr><td colspan="4">Aucune séance sur la période.</td></tr>';
    const gearRows = gear.length?gear.map(g=>{const p=g.max?Math.round(g.km/g.max*100):0;const c=p>=100?'bad':p>=85?'warn':'good';return `<div class="row"><span class="l">${esc(g.name)}</span><span class="v ${c}">${esc(g.km)} / ${esc(g.max||'?')} km · ${p}%</span></div>`;}).join(''):'';
    const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bilan — ${esc(name)}</title><style>
@page{size:A4;margin:13mm}*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:13px/1.5 -apple-system,system-ui,'Segoe UI',Roboto,sans-serif;color:#12203a}
.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0B1120;padding-bottom:12px}
.wm{font:800 20px/1 system-ui;letter-spacing:.05em;color:#0B1120}.wm b{color:#0F9FBF}
.hd .r{text-align:right;font-size:11px;color:#5a6a86}
h1{font-size:23px;font-weight:800;margin:16px 0 1px;color:#0B1120}.sub{color:#5a6a86;font-size:12px;margin-bottom:14px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 4px}
.kpi{border:1px solid #d8dfec;border-radius:9px;padding:11px 13px}.kpi .v{font:800 21px/1 system-ui;font-variant-numeric:tabular-nums}.kpi .k{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#5a6a86;margin-top:6px}
.good{color:#0a9b6a}.warn{color:#c67b1b}.bad{color:#c2453f}.acc{color:#0F9FBF}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#0B1120;border-bottom:1px solid #d8dfec;padding-bottom:5px;margin:18px 0 8px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:0 30px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}
.row{display:flex;justify-content:space-between;border-bottom:1px dotted #e6ebf3;padding:3px 0;font-size:12px}.row .l{color:#5a6a86}.row .v{font-weight:700}.row em{font-style:normal;color:#8593ad;font-weight:400;font-size:10px}
table{width:100%;border-collapse:collapse;font-size:11.5px}td,th{text-align:left;padding:5px 6px;border-bottom:1px solid #eef1f7}th{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#5a6a86}
.tag{font-size:9px;font-weight:800;padding:1px 6px;border-radius:99px}
.foot{margin-top:20px;border-top:1px solid #d8dfec;padding-top:9px;font-size:10px;color:#8593ad;display:flex;justify-content:space-between}
.note{font-size:10px;color:#8593ad;margin-top:3px}
</style></head><body>
<div class="hd"><span class="wm">SILL<b>ANCE</b></span><div class="r">Bilan d'entraînement<br>${today}</div></div>
<h1>${esc(name)}</h1>
<div class="sub">${race?('Objectif : '+esc(race.name)+' · J–'+esc(race.inDays!=null?race.inDays:race.days)):'Suivi d\'entraînement'}</div>
<div class="kpis">
  <div class="kpi"><div class="v ${tsbCls}">${tsb==null?'—':(tsb>0?'+':'')+tsb}</div><div class="k">Forme (TSB)</div></div>
  <div class="kpi"><div class="v">${ctl==null?'—':ctl}</div><div class="k">Fitness (CTL)</div></div>
  <div class="kpi"><div class="v">${atl==null?'—':atl}</div><div class="k">Fatigue (ATL)</div></div>
  <div class="kpi"><div class="v ${compCls}">${comp==null?'—':comp+'%'}</div><div class="k">Réalisé (semaine)</div></div>
</div>
<div class="note">Semaine en cours : ${done}/${tot} séance${tot>1?'s':''} réalisée${done>1?'s':''} · ${wtss} TSS planifiés.</div>
<div class="cols">
  <div><h2>Records personnels</h2>${recRows}</div>
  <div><h2>Références physio</h2><div>${refRows||'<div class="row"><span class="l">Non renseignées</span></div>'}</div></div>
</div>
<h2>Séances récentes</h2>
<table><thead><tr><th>Date</th><th>Séance</th><th>Charge</th><th>Statut</th></tr></thead><tbody>${sessRows}</tbody></table>
${gearRows?('<h2>Matériel — usure</h2>'+gearRows):''}
<div class="foot"><span>Généré par Sillance — ${today}</span><span>sillance.app</span></div>
</body></html>`;
    const w=window.open('','_blank');
    if(!w){ if(typeof toast==='function') toast(tr('toast.autorisePopUpsPourExporter')); return; }
    w.document.write(html); w.document.close();
    const go=()=>{ try{ w.focus(); w.print(); }catch(e){} };
    if(w.document.readyState==='complete') setTimeout(go,300); else w.onload=()=>setTimeout(go,300);
  }catch(e){ console.error('exportBilan',e); if(typeof toast==='function') toast(tr('toast.exportBilanIndisponible'), 'error'); }
}

/* Fiche de progression partageable ("case study") : ce que le coach peut
   montrer à un prospect. Contrairement au Bilan (état des lieux du jour),
   celle-ci raconte un AVANT/APRÈS sur la période — records améliorés
   (déjà détectés via isNew), delta de charge (CTL réel via buildLoadWeeks,
   calculé sur l'historique du planning donc valable en démo ET en réel),
   adhérence, + une citation courte que le coach écrit lui-même. */
function exportCaseStudy(name){
  try{
    name = name || (typeof ATHLETE_NAME!=='undefined'?ATHLETE_NAME:'Cet athlète');
    const coachName = (window.PF?.profile?.full_name) || 'Ton coach Sillance';
    const recs = (typeof RECORDS!=='undefined')?RECORDS:[];
    const newRecs = recs.filter(r=>r.isNew);
    const weeks = (typeof buildLoadWeeks==='function') ? buildLoadWeeks() : [];
    const now = weeks.length ? weeks[weeks.length-1] : null;
    const before = weeks.length>12 ? weeks[weeks.length-13] : null;
    const ctlDeltaPct = (now && before && before.ctl) ? Math.round((now.ctl-before.ctl)/before.ctl*100) : null;
    let done=0, tot=0;
    for(let i=0;i<84;i++){ const d=iso(addDays(new Date(),-i)); (planning[d]||[]).forEach(s=>{ tot++; if(s.done) done++; }); }
    const adherence = tot ? Math.round(done/tot*100) : null;
    const quote = (prompt("Un mot sur ce cycle avec "+name+" (optionnel, apparaît sur la fiche) :", "") || '').trim();
    const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const today=new Date().toLocaleDateString(localeStr(),{day:'numeric',month:'long',year:'numeric'});
    const recRows = newRecs.length ? newRecs.map(r=>`<div class="row"><span class="l">${esc(r.d)}</span><span class="v acc">${esc(r.v)}</span></div>`).join('') : '';
    const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Progression — ${esc(name)}</title><style>
@page{size:A4;margin:13mm}*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:13px/1.5 -apple-system,system-ui,'Segoe UI',Roboto,sans-serif;color:#12203a}
.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0B1120;padding-bottom:12px}
.wm{font:800 20px/1 system-ui;letter-spacing:.05em;color:#0B1120}.wm b{color:#0F9FBF}
.hd .r{text-align:right;font-size:11px;color:#5a6a86}
.kicker{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:#0F9FBF;font-weight:800;margin-top:18px}
h1{font-size:26px;font-weight:800;margin:4px 0 14px;color:#0B1120}
.hero{border:1px solid #d8dfec;border-radius:var(--radius);padding:22px;background:#f3fbfd;text-align:center;margin-bottom:16px}
.hero .v{font:800 40px/1 system-ui;color:#0F9FBF}.hero .k{font-size:12px;color:#5a6a86;margin-top:8px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}
.kpi{border:1px solid #d8dfec;border-radius:9px;padding:12px 13px;text-align:center}.kpi .v{font:800 22px/1 system-ui}.kpi .k{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#5a6a86;margin-top:6px}
.acc{color:#0F9FBF}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#0B1120;border-bottom:1px solid #d8dfec;padding-bottom:5px;margin:18px 0 8px}
.row{display:flex;justify-content:space-between;border-bottom:1px dotted #e6ebf3;padding:4px 0;font-size:12.5px}.row .l{color:#5a6a86}.row .v{font-weight:700}
.quote{font-size:14px;font-style:italic;color:#0B1120;border-left:3px solid #0F9FBF;padding:4px 0 4px 14px;margin-top:16px}
.foot{margin-top:22px;border-top:1px solid #d8dfec;padding-top:9px;font-size:10px;color:#8593ad;display:flex;justify-content:space-between}
</style></head><body>
<div class="hd"><span class="wm">SILL<b>ANCE</b></span><div class="r">Fiche de progression<br>${today}</div></div>
<div class="kicker">Coaching par ${esc(coachName)}</div>
<h1>${esc(name)}</h1>
${ctlDeltaPct!=null ? `<div class="hero"><div class="v">${ctlDeltaPct>0?'+':''}${ctlDeltaPct}%</div><div class="k">de charge d'entraînement absorbée en 12 semaines</div></div>` : ''}
<div class="kpis">
  <div class="kpi"><div class="v acc">${newRecs.length}</div><div class="k">Record${newRecs.length>1?'s':''} amélioré${newRecs.length>1?'s':''}</div></div>
  <div class="kpi"><div class="v">${adherence==null?'—':adherence+'%'}</div><div class="k">Adhérence au plan</div></div>
  <div class="kpi"><div class="v">${now?now.ctl:'—'}</div><div class="k">Fitness (CTL) actuelle</div></div>
</div>
${recRows?(`<h2>Records battus sur la période</h2>${recRows}`):''}
${quote?(`<div class="quote">« ${esc(quote)} »<br><span style="font-style:normal;font-size:11px;color:#5a6a86">— ${esc(coachName)}</span></div>`):''}
<div class="foot"><span>Généré par Sillance — ${today}</span><span>sillance.app</span></div>
</body></html>`;
    const w=window.open('','_blank');
    if(!w){ if(typeof toast==='function') toast(tr('toast.autorisePopUpsPourExporter2')); return; }
    w.document.write(html); w.document.close();
    const go=()=>{ try{ w.focus(); w.print(); }catch(e){} };
    if(w.document.readyState==='complete') setTimeout(go,300); else w.onload=()=>setTimeout(go,300);
  }catch(e){ console.error('exportCaseStudy',e); if(typeof toast==='function') toast(tr('toast.exportIndisponible'), 'error'); }
}

function renderCoachBand(){
  const band = document.getElementById('coachBand'); if(!band) return;
  const a = ROSTER[selectedAthleteIdx]; if(!a){ band.innerHTML=''; return; }
  const forme = athForme(a), fc = athFormeColor(forme);
  const C = 2*Math.PI*30;
  const dash = forme==null ? 0 : C*forme/100;
  // GEAR est déclaré (let) plus bas dans le script : au premier rendu il est
  // encore en zone morte temporelle -> on lit via try/catch plutôt que typeof.
  let gearList = []; try{ gearList = GEAR || []; }catch(e){}
  const worn = gearList.filter(g=>g.type==='shoe' && g.max>0 && g.km/g.max>=0.85);
  let done=0, tot=0;
  const mon = mondayOf(0);
  for(let i=0;i<7;i++){ (planning[iso(addDays(mon,i))]||[]).forEach(s=>{ tot++; if(s.done) done++; }); }
  const compPct = tot ? Math.round(done/tot*100) : null;
  const flags = [];
  worn.slice(0,2).forEach(g=>{ const p=Math.round(g.km/g.max*100);
    flags.push(`<span class="cb-flag ${p>=100?'danger':'warn'}"><i class="ic ic-shoe"></i>${g.name} · ${p}% d'usure</span>`); });
  if(a.race && a.race.days<=14) flags.push(`<span class="cb-flag warn"><i class="ic ic-flag"></i>Course dans ${a.race.days} j — pense à l'affûtage</span>`);
  if(compPct!=null && compPct<60) flags.push(`<span class="cb-flag danger"><i class="ic ic-alert-triangle"></i>Réalisé faible : ${compPct}% cette semaine</span>`);
  const dk = athDispo(a);
  if(dk && dk!=='ok'){
    const d = DISPO_META[dk];
    flags.unshift(`<span class="cb-flag ${dk==='fatigue'?'warn':'danger'}"><i class="ic ${d.ic}"></i>${d.l}${a.checkin.dispoNote?' — '+dispoSafe(a.checkin.dispoNote):''}</span>`);
  }
  const hs = a.checkin && hrvStatus(a.checkin.hrv, ATHLETE_REF.hrvBase);
  if(hs && (hs.level==='low'||hs.level==='warn')){
    flags.unshift(`<span class="cb-flag ${hs.level==='low'?'danger':'warn'}"><i class="ic ic-refresh"></i>${hs.txt} : ${a.checkin.hrv} ms (${hs.pct}% vs base)</span>`);
  }
  const cp = athCycle(a);
  if(cp && (cp==='menstrual' || cp==='luteal' || cp==='ovulation')){
    const cm = CYCLE_META[cp];
    flags.push(`<span class="cb-flag" style="border-color:color-mix(in srgb,${cm.c} 45%,var(--line));color:${cm.c}"><i class="ic ${cm.ic}"></i>Cycle · ${cm.l} — ${cm.tip}</span>`);
  }
  if(a.refsUpdatedAt){
    const refsAge = Math.floor((Date.now()-new Date(a.refsUpdatedAt).getTime())/86400000);
    if(refsAge>=90) flags.push(`<span class="cb-flag warn"><i class="ic ic-target"></i>Références physio non retestées depuis ${refsAge} j</span>`);
  }
  if(!flags.length) flags.push(`<span class="cb-flag ok"><i class="ic ic-check"></i>Rien à signaler</span>`);
  const ck = a.checkin;
  band.style.setProperty('--cbc', a.color);
  band.innerHTML = `
    <div class="cb-id">
      <span class="cb-av">${a.ini}</span>
      <div>
        <div class="cb-kicker">Athlète suivi</div>
        <div class="cb-name">${a.name}</div>
        ${a.race?`<div class="cb-race"><i class="ic ic-flag"></i>${a.race.name} <b>J–${a.race.days}</b></div>`:''}
        <button class="cb-bilan" id="bilanBtn" title="Exporter le bilan de l'athlète en PDF"><i class="ic ic-download"></i> Bilan PDF</button>
        <button class="cb-bilan" id="caseStudyBtn" title="Fiche de progression partageable (records, charge, adhérence)"><i class="ic ic-sparkles"></i> Étude de cas</button>
        ${a.race?`<button class="cb-bilan" id="shareSpecBtn" title="Lien à partager avec les proches pour cette course"><i class="ic ic-link"></i> Partager la course</button>`:''}
        <button class="cb-bilan" id="zonesBtn" title="Personnaliser les zones de travail de l'athlète"><i class="ic ic-target"></i> Zones</button>
        <button class="cb-bilan" id="profileBtn" title="VO2max, parcours, records, blessures, habitudes"><i class="ic ic-user"></i> Fiche athlète</button>
      </div>
    </div>
    <div class="cb-forme">
      <div class="cb-ring">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="30" fill="none" stroke="var(--line-strong)" stroke-width="5"/>
          <circle cx="36" cy="36" r="30" fill="none" stroke="${fc}" stroke-width="5" stroke-linecap="round"
            stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}"/>
        </svg>
        <span class="pct" style="color:${fc}">${forme==null?'—':forme+'%'}</span>
      </div>
      <div class="cb-fdetail">
        <div class="cb-kicker">Check-in de ce matin</div>
        <div class="cb-note" style="color:${fc}">${forme==null?'Pas encore de check-in':athNote(forme)}</div>
        ${ck?`<div class="cb-checkin">
          <span><i class="ic ic-moon"></i>${ck.sommeil}/10</span>
          <span><i class="ic ic-battery"></i>${ck.fatigue}/10</span>
          <span><i class="ic ic-zap"></i>${ck.motivation}/10</span>
          ${(()=>{ const hs=hrvStatus(ck.hrv, ATHLETE_REF.hrvBase); return hs?`<span class="cb-hrv" style="color:${hs.c}" title="${hs.txt} (${ck.hrv} ms)"><i class="ic ic-refresh"></i>HRV ${ck.hrv}</span>`:''; })()}
          ${(()=>{ const cp=athCycle(a); return cp?`<span class="cb-cycle" style="color:${CYCLE_META[cp].c}" title="${CYCLE_META[cp].tip}"><i class="ic ${CYCLE_META[cp].ic}"></i>${CYCLE_META[cp].l}</span>`:''; })()}
        </div>`:''}
      </div>
    </div>
    <div class="cb-flags">${flags.join('')}</div>`;
  const _bb=document.getElementById('bilanBtn'); if(_bb) _bb.onclick=()=>exportBilan(a.name);
  const _csb=document.getElementById('caseStudyBtn'); if(_csb) _csb.onclick=()=>exportCaseStudy(a.name);
  const _ssb=document.getElementById('shareSpecBtn'); if(_ssb) _ssb.onclick=()=>openSpectatorShare(a.id);
  const _zb=document.getElementById('zonesBtn'); if(_zb) _zb.onclick=()=>openZoneEditor();
  const _pb=document.getElementById('profileBtn'); if(_pb) _pb.onclick=()=>openAthleteProfile(a.id);
}

/* ---- Fiche athlète (coach) : VO2max, parcours, records, blessures, habitudes ---- */
let profileAthId = null;
function profRowHTML(kind, i, a, b){
  if(kind==='record'){
    return `<div class="prof-row" data-i="${i}">
      <input type="text" placeholder="Ex. 10 km" data-f="d" value="${dispoSafe(a||'')}">
      <input type="text" placeholder="Ex. 38:20" data-f="v" value="${dispoSafe(b||'')}">
      <button class="prof-row-del" type="button" data-act="delrow" title="Supprimer"><i class="ic ic-x"></i></button>
    </div>`;
  }
  return `<div class="prof-row" data-i="${i}">
    <input type="date" data-f="date" value="${a||''}" style="flex:0 0 150px">
    <input type="text" placeholder="Ex. Tendinite rotulienne genou droit" data-f="desc" value="${dispoSafe(b||'')}">
    <button class="prof-row-del" type="button" data-act="delrow" title="Supprimer"><i class="ic ic-x"></i></button>
  </div>`;
}
function wireProfRows(boxId, list, rerender){
  document.getElementById(boxId).querySelectorAll('[data-act="delrow"]').forEach(btn=>{
    btn.onclick=()=>{ const i=+btn.closest('.prof-row').dataset.i; list.splice(i,1); rerender(list); };
  });
}
function renderProfRecords(list){
  document.getElementById('profRecords').innerHTML = list.map((r,i)=>profRowHTML('record',i,r.d,r.v)).join('') || '<p class="club-hint">Aucun record renseigné.</p>';
  wireProfRows('profRecords', list, renderProfRecords);
}
function renderProfInjuries(list){
  document.getElementById('profInjuries').innerHTML = list.map((r,i)=>profRowHTML('injury',i,r.date,r.desc)).join('') || '<p class="club-hint">Aucune blessure renseignée.</p>';
  wireProfRows('profInjuries', list, renderProfInjuries);
}
function renderProfDebriefs(aid){
  const el = document.getElementById('profDebriefs'); if(!el) return;
  el.innerHTML = debriefsBlockHTML(debriefsFor(aid), "Aucun débrief renseigné par l'athlète pour l'instant.");
}
function renderProfCoTeam(aid){
  const el = document.getElementById('profCoTeam'); if(!el) return;
  el.innerHTML = coTeamBlockHTML(aid, 'coach');
  wireCoTeamActions(el);
}
function openAthleteProfile(aid){
  const a = ROSTER.find(x=>x.id===aid); if(!a) return;
  profileAthId = aid;
  const p = athleteProfile(aid);
  document.getElementById('profileAthName').textContent = a.name;
  document.getElementById('profVo2max').value = p.vo2max ?? '';
  document.getElementById('profBackground').value = p.background || '';
  document.getElementById('profDiet').value = p.diet || '';
  document.getElementById('profWork').value = p.work || '';
  renderProfRecords(p.records);
  renderProfInjuries(p.injuries);
  renderProfDebriefs(aid);
  renderProfCoTeam(aid);
  if(window.PF?.user && rosterIsReal){
    PF.getRaceDebriefs(aid).then(list=>{ RACE_DEBRIEFS[aid]=list; renderProfDebriefs(aid); })
      .catch(e=> console.warn('[PF] getRaceDebriefs :', e));
    Promise.all([PF.getCoTeam(aid), PF.getPendingCoCoachRequests(aid)]).then(([team, pending])=>{
      CO_TEAM[aid] = team.map(t=>({ id:t.id, coachId:t.coach_id, roleLabel:t.role_label, coach:t.coach }));
      CO_PENDING[aid] = pending.map(p=>({ id:p.id, coachEmail:p.coach_email, roleLabel:p.role_label, requestedByRole:p.requested_by_role }));
      renderProfCoTeam(aid);
    }).catch(e=> console.warn('[PF] getCoTeam/getPendingCoCoachRequests :', e));
  }
  document.getElementById('profileOverlay').classList.add('open');
}
/* ---- débrief de course (athlète) ---- */
function openDebrief(){
  ['dbRace','dbResult','dbFelt','dbWeather','dbGood','dbBad'].forEach(id=> document.getElementById(id).value='');
  document.getElementById('dbDate').value = iso(new Date());
  document.getElementById('dbNutrition').value = 'oui';
  document.getElementById('debriefOverlay').classList.add('open');
}
function saveDebrief(){
  const race = document.getElementById('dbRace').value.trim();
  const date = document.getElementById('dbDate').value;
  if(!race || !date){ toast(tr('toast.renseigneMoinsNomCourseEt')); return; }
  const d = { race, date,
    result: document.getElementById('dbResult').value.trim(),
    felt: document.getElementById('dbFelt').value.trim(),
    nutrition: document.getElementById('dbNutrition').value,
    weather: document.getElementById('dbWeather').value.trim(),
    good: document.getElementById('dbGood').value.trim(),
    bad: document.getElementById('dbBad').value.trim() };
  const key = myDebriefKey();
  const list = debriefsFor(key);
  const dup = list.findIndex(x=>x.race===d.race && x.date===d.date);
  if(dup>-1) list[dup]=d; else list.push(d);
  if(window.PF?.user){
    PF.saveRaceDebrief({ raceName:d.race, raceDate:d.date, result:d.result, felt:d.felt,
      nutrition:d.nutrition, weather:d.weather, good:d.good, bad:d.bad })
      .catch(e=> console.warn('[PF] saveRaceDebrief échoué :', e));
  }
  document.getElementById('debriefOverlay').classList.remove('open');
  renderSidebar();
  toast(tr('toast.debriefEnregistre'));
}
(function initDebrief(){
  const ov=document.getElementById('debriefOverlay'); if(!ov) return;
  document.getElementById('debriefSave').addEventListener('click', saveDebrief);
  document.getElementById('debriefClose').addEventListener('click', ()=> ov.classList.remove('open'));
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); });
})();

/* ---- mode spectateur : lien public (sans compte) pour une course ---- */
let spectatorTargetAthleteId = null;
function openSpectatorShare(athleteId){
  const race = currentRace();
  if(!race){ toast("Aucune course à venir enregistrée pour l'instant"); return; }
  spectatorTargetAthleteId = athleteId;
  document.getElementById('specRaceName').textContent = race.name;
  document.getElementById('specNotes').value = '';
  document.getElementById('specLinkResult').innerHTML = '';
  document.getElementById('spectatorOverlay').classList.add('open');
}
async function generateSpectatorLink(){
  const race = currentRace(); if(!race) return;
  const notes = document.getElementById('specNotes').value.trim();
  const resEl = document.getElementById('specLinkResult');
  if(!window.PF?.user){
    resEl.innerHTML = `<p class="club-hint">Disponible une fois connecté (démo non persistée).</p>`;
    return;
  }
  try{
    const row = await PF.getOrCreateSpectatorLink(spectatorTargetAthleteId, race.name, race.date, notes);
    const base = location.href.replace(/[^/]*$/, '');
    const url = `${base}spectateur.html?token=${row.token}`;
    resEl.innerHTML = `<input type="text" readonly value="${url}" id="specUrl" style="width:100%;box-sizing:border-box;margin-bottom:6px">
      <button class="btn btn-secondary" id="specCopy" type="button" style="width:100%">Copier le lien</button>`;
    document.getElementById('specUrl').onclick = function(){ this.select(); };
    document.getElementById('specCopy').onclick = ()=>{ navigator.clipboard.writeText(url).then(()=> toast(tr('toast.lienCopie'))); };
  }catch(e){ console.warn('[PF] getOrCreateSpectatorLink :', e); resEl.innerHTML = `<p class="club-hint">Lien indisponible pour le moment.</p>`; }
}
(function initSpectator(){
  const ov=document.getElementById('spectatorOverlay'); if(!ov) return;
  document.getElementById('specGenerate').addEventListener('click', generateSpectatorLink);
  document.getElementById('spectatorClose').addEventListener('click', ()=> ov.classList.remove('open'));
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); });
})();
function saveAthleteProfile(){
  if(!profileAthId) return;
  const a = ROSTER.find(x=>x.id===profileAthId);
  const p = athleteProfile(profileAthId);
  const vo2 = document.getElementById('profVo2max').value;
  p.vo2max = vo2==='' ? null : +vo2;
  p.background = document.getElementById('profBackground').value.trim();
  p.diet = document.getElementById('profDiet').value.trim();
  p.work = document.getElementById('profWork').value.trim();
  p.records = [...document.querySelectorAll('#profRecords .prof-row')].map(row=>({
    d: row.querySelector('[data-f="d"]').value.trim(),
    v: row.querySelector('[data-f="v"]').value.trim()
  })).filter(r=>r.d || r.v);
  p.injuries = [...document.querySelectorAll('#profInjuries .prof-row')].map(row=>({
    date: row.querySelector('[data-f="date"]').value,
    desc: row.querySelector('[data-f="desc"]').value.trim()
  })).filter(r=>r.date || r.desc);
  document.getElementById('profileOverlay').classList.remove('open');
  toast(`Fiche mise à jour pour ${a?a.name:'l\'athlète'}`);
}
(function initAthleteProfile(){
  const ov=document.getElementById('profileOverlay'); if(!ov) return;
  document.getElementById('profileSave').addEventListener('click', saveAthleteProfile);
  document.getElementById('profileClose').addEventListener('click', ()=> ov.classList.remove('open'));
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); });
  document.getElementById('profAddRecord').addEventListener('click', ()=>{
    const p = athleteProfile(profileAthId);
    p.records.push({d:'', v:''});
    renderProfRecords(p.records);
  });
  document.getElementById('profAddInjury').addEventListener('click', ()=>{
    const p = athleteProfile(profileAthId);
    p.injuries.push({date:'', desc:''});
    renderProfInjuries(p.injuries);
  });
})();

(function initAthPicker(){
  const btn=document.getElementById('apBtn'), menu=document.getElementById('apMenu');
  if(!btn) return;
  btn.addEventListener('click', e=>{
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e=>{
    if(!menu.hidden && !menu.contains(e.target)){ menu.hidden = true; btn.setAttribute('aria-expanded','false'); }
  });
  renderAthPicker();
  updatePlanAthleteVisibility();
  renderCoachBand();
})();
let athView = 'home';   // 'home' | 'stats'
function updateVideolibVisibility(){
  // mode club : panneau club via attribut body ; sinon onglets athlète
  document.body.removeAttribute('data-clubview');
  document.body.removeAttribute('data-athview');
  if(mode==='club'){
    document.body.setAttribute('data-clubview', '1');
  } else if(mode==='athlete'){
    document.body.setAttribute('data-athview', athView);
  }
  document.querySelectorAll('.ath-tab').forEach(b=> b.classList.toggle('active', b.dataset.tab===athView));
  // Matériel : côté coach, c'est celui que l'athlète a renseigné (lecture seule)
  const gt=document.getElementById('gearTitle'), gs=document.getElementById('gearSub');
  if(gt) gt.innerHTML = mode==='coach' ? 'Matériel <span>de l\'athlète</span>' : 'Mon <span>matériel</span>';
  if(gs) gs.textContent = mode==='coach'
    ? 'Le matériel que l\'athlète a renseigné dans son espace — surveille l\'usure avant de planifier de l\'intensité.'
    : 'Suis le kilométrage de tes chaussures et de tes vélos. Chaque modèle du catalogue a sa propre durée de vie estimée : tu es alerté avant que l\'amorti ne se dégrade.';
}
// branchement des onglets
document.querySelectorAll('.ath-tab').forEach(b=>{
  b.addEventListener('click', ()=>{
    athView = b.dataset.tab;
    updateVideolibVisibility();
    window.scrollTo({top:0, behavior:'smooth'});
  });
});

/* ---------- Thème clair / sombre ---------- */
(function themeInit(){
  const btn=document.getElementById('themeBtn');
  const icon=document.getElementById('themeIcon');
  function apply(light){
    document.body.classList.toggle('light', light);
    if(icon) icon.innerHTML = light ? '<i class="ic ic-sun"></i>' : '<i class="ic ic-moon"></i>';
    if(btn) btn.title = light ? 'Passer en mode sombre' : 'Passer en mode clair';
    if(typeof rebuildCharts==='function') setTimeout(rebuildCharts, 0);
  }
  // Thème auto selon l'heure : mode jour (clair) de 7h00 à 18h59, mode nuit (sombre) de 19h00 à 6h59.
  const h = new Date().getHours();
  apply(h>=7 && h<19);
  if(btn) btn.addEventListener('click', ()=> apply(!document.body.classList.contains('light')));
})();

/* ============================================================
   INTERFACE CLUB — créneaux collectifs, athlètes, présences
   ------------------------------------------------------------
   Le gestionnaire crée des créneaux ; les athlètes du club s'y
   inscrivent (démo : on simule l'inscription de "moi"). Sert aux
   clubs de sport d'endurance : triathlon, course à pied, natation, cyclisme.
   Backend : persister clubs, athlètes, créneaux et inscriptions ;
   brancher un paiement pour les créneaux tarifés.
   ============================================================ */
const CLUB_ATHLETES = [
  {id:'a1', name:'Romain Dubois', disc:'tri', since:'2023', group:'g3', offer:'coach', coach:'Éric', licence:{fed:'FFTri', num:'4501234', medCertUntil:'2027-02-10'}},
  {id:'a2', name:'Léa Martin', disc:'tri', since:'2024', group:'g4', offer:'sub', minor:true, licence:{fed:'FFTri', num:'4509876', medCertUntil:'2026-09-10'}},
  {id:'a3', name:'Karim Benali', disc:'bike', since:'2025', group:'g6', offer:'coach', coach:'Karim', licence:{fed:'FFC', num:'1122334', medCertUntil:'2027-01-20'}},
  {id:'a4', name:'Sophie Laurent', disc:'tri', since:'2022', group:'g5', offer:'sub', licence:{fed:'FFTri', num:'4498765', medCertUntil:'2026-05-30'}},
  {id:'a5', name:'Tom Variable', disc:'bike', since:'2025', group:'g6', offer:'sub'},
  {id:'a6', name:'Inès Rousseau', disc:'tri', since:'2024', group:'g1', offer:'sub', minor:true, guardian:{name:'Claire Rousseau', email:'claire.rousseau@example.com'}, consentAt:'2026-01-12', licence:{fed:'FFTri', num:'4587654', medCertUntil:'2027-04-01'}},
  {id:'a7', name:'Lucas Petit', disc:'tri', since:'2023', group:'g2', offer:'coach', coach:'Julie', licence:{fed:'FFTri', num:'4523456', medCertUntil:'2026-12-15'}},
  {id:'a8', name:'Marie Girard', disc:'bike', since:'2025', group:'g6', offer:'sub'}
];
/* groupes du club : le gestionnaire les crée et y affecte des athlètes.
   Sert à cibler les créneaux (ex. un créneau réservé au groupe Compétition). */
let CLUB_GROUPS = [
  {id:'g1', name:'Jeunes Loisir', color:'#2FD9FF', desc:'Découverte et plaisir, sans objectif de compétition'},
  {id:'g2', name:'Jeunes Compétition', color:'#FF5470', desc:'Jeunes orientés performance et courses'},
  {id:'g3', name:'Adultes Triathlon M', color:'#FFB13D', desc:'Format découverte / distance M (olympique)'},
  {id:'g4', name:'Adultes Triathlon Half', color:'#9D7BFF', desc:'Préparation 70.3 / half-distance'},
  {id:'g5', name:'Adultes Triathlon Ironman', color:'#39E6A3', desc:'Longue distance, format Ironman'},
  {id:'g6', name:'Cyclisme Compétition', color:'#FF8A3D', desc:'Cyclisme sur route, groupe compétition'}
];
function clubGroup(id){ return CLUB_GROUPS.find(g=>g.id===id); }
const CLUB_DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
let CRENEAUX = [
  {id:'c1', disc:'run', title:'Séance piste collective', day:1, time:'18:30', dur:90, place:'Stade Nelson Paillou, Muret', cap:24, coach:'Éric', price:0, attendees:['a1','a2','a4','a7']},
  {id:'c2', disc:'swim', title:'Technique natation', day:2, time:'12:15', dur:60, place:'Piscine Nakache, Muret', cap:16, coach:'Julie', price:0, attendees:['a2','a6']},
  {id:'c3', disc:'bike', title:'Sortie vélo — groupe compétition', day:5, time:'19:00', dur:150, place:'Départ Vélodrome, Muret', cap:12, coach:'Karim', price:0, attendees:['a3','a5','a8']},
  {id:'c4', disc:'bike', title:'Sortie longue groupe', day:6, time:'08:00', dur:180, place:'Départ Base de loisirs, Muret', cap:30, coach:'Éric', price:0, attendees:['a1','a4','a7']}
];
const ME_CLUB_ID = 'a1'; // l'athlète "moi" (pour la démo d'inscription)
let clubView = 'dash';

/* demandes d'adhésion en attente (arrivées via le lien d'invitation) */
let JOIN_REQUESTS = [
  {id:'r1', name:'Hugo Mercier', disc:'tri', msg:'Triathlète, j\'aimerais préparer un half cette année'},
  {id:'r2', name:'Camille Faure', disc:'bike', msg:'Débutante cyclisme sur route, motivée !'}
];
/* noms fictifs pour simuler de nouvelles demandes (démo) */
const DEMO_NAMES = ['Antoine Roche','Julie Vasseur','Nadia Lefort','Paul Chevalier','Emma Bonnet','Yanis Khelifi'];
let demoNameIdx = 0;

function initials(name){ return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
const CLUB_DISC_LABEL = {get tri(){return tr('clubDisc.tri')}, get run(){return tr('clubDisc.run')}, get swim(){return tr('clubDisc.swim')}, get bike(){return tr('clubDisc.bike')}};

function renderClubStats(){
  const el = document.getElementById('clubStats'); if(!el) return; // bandeau retiré : no-op
  const totalSpots = CRENEAUX.reduce((a,c)=>a+c.attendees.length,0);
  const paid = CRENEAUX.filter(c=>c.price>0).length;
  el.innerHTML = [
    {v:CLUB_ATHLETES.length, k:'athlètes'},
    {v:CRENEAUX.length, k:'créneaux'},
    {v:totalSpots, k:'inscriptions'},
    {v:paid, k:'à la carte'}
  ].map(s=>`<div class="club-stat"><div class="v">${s.v}</div><div class="k">${s.k}</div></div>`).join('');
}

/* ===========================================================
   REFONTE CLUB — Tableau de bord / Facturation / Offres
   (ops + argent, zéro analyse : la data reste côté coach)
   =========================================================== */
const CLUB_OFFERS = [
  {id:'sub', name:'Abonnement club', price:59, unit:'/ mois', feature:false,
   pitch:'Toutes les séances collectives incluses.',
   inc:['Créneaux collectifs illimités','Réservation prioritaire','Suivi des présences'],
   who:'Le cœur du club — le volume.'},
  {id:'coach', name:'Coaching +', price:119, unit:'/ mois', feature:true,
   pitch:'Abonnement + un coach qui lit tes données et adapte tes séances.',
   inc:["Tout l'abonnement club",'Coach dédié + plan perso','Check-in du matin → séance ajustée','Analyse montre (Garmin / Coros / .FIT)'],
   who:'Athlètes engagés, prépa course ou triathlon compétition.'}
];
const clubOffer = id => CLUB_OFFERS.find(o=>o.id===id) || CLUB_OFFERS[0];
const COACH_OFFER = { name:'Suivi coaching', price:99 };

/* Abonnement Sillance du COACH (SaaS pour utiliser l'app) : 3 paliers selon
   le nombre d'athlètes coachés, auto-déclarés (pas de compteur bloquant). */
const COACH_TIERS = [
  {id:1, name:'1 à 10 athlètes',  price:19},
  {id:2, name:'11 à 30 athlètes', price:29},
  {id:3, name:'31+ athlètes',     price:49},
];
let selectedCoachTier = (ROSTER && ROSTER.length > 30) ? 3 : (ROSTER && ROSTER.length > 10) ? 2 : 1;
function coachTiersHTML(){
  return `<div class="csub-tiers">
    ${COACH_TIERS.map(t=>`<div class="csub-tier ${t.id===selectedCoachTier?'cur':''}" data-tier="${t.id}" role="button" tabindex="0">
      ${t.id===selectedCoachTier?'<span class="csub-badge">Sélectionné</span>':''}
      <div class="csub-name">${t.name}</div>
      <div class="csub-price">${t.price} €<small>/mois</small></div>
    </div>`).join('')}
  </div>`;
}
function wireCoachTiers(root){
  root.querySelectorAll('.csub-tier').forEach(el=>{
    el.onclick=()=>{ selectedCoachTier=+el.dataset.tier; renderSidebar(); };
    el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); el.click(); } };
  });
}

/* Abonnement Sillance du CLUB (ce que le club paie à la plateforme).
   Assiette = « athlètes activés » = adhérents placés dans un groupe.
   Facturation à la saison, par virement (pas de carte) → cette carte est
   informative + retient la formule ; l'encaissement réel se fait hors app. */
const CLUB_TIERS = [
  {id:'club',  name:'Club',          cap:"jusqu'à 50 athlètes",  max:50,       price:600,  perM:'0,99 €'},
  {id:'grand', name:'Grand club',    cap:"jusqu'à 150 athlètes", max:150,      price:1350, perM:'0,75 €'},
  {id:'illim', name:'Club illimité', cap:'athlètes illimités',   max:Infinity, price:1800, perM:'0,50 €'}
];
let clubFounder = true; // démo : on présente le tarif « club fondateur » (−50 %)
function clubActivated(){ return CLUB_ATHLETES.filter(a=>a.group).length; }
function clubTierFor(n){ return CLUB_TIERS.find(t=>n<=t.max) || CLUB_TIERS[CLUB_TIERS.length-1]; }
function clubTierPrice(t){ return clubFounder ? Math.round(t.price/2) : t.price; }

function clubSillanceCardHTML(){
  const n=clubActivated(), tier=clubTierFor(n);
  return `
  <div class="csub">
    <div class="csub-head">
      <div>
        <div class="csub-t"><i class="ic ic-star"></i> Abonnement Sillance</div>
        <div class="csub-s">Ce que le club paie pour la plateforme — distinct de ce que tu factures à tes adhérents ci-dessous.</div>
      </div>
      <label class="csub-toggle"><input type="checkbox" id="clubFounderTgl" ${clubFounder?'checked':''}> Tarif club fondateur <b>−50 %</b></label>
    </div>
    <div class="csub-body">
      <div class="csub-count">
        <div class="csub-n">${n}</div>
        <div class="csub-nl">athlètes activés<span>placés dans un groupe</span></div>
      </div>
      <div class="csub-tiers">
        ${CLUB_TIERS.map(t=>{
          const cur=t.id===tier.id, fnd=Math.round(t.price/2);
          return `<div class="csub-tier ${cur?'cur':''}">
            ${cur?'<span class="csub-badge">Ta formule</span>':''}
            <div class="csub-name">${t.name}</div>
            <div class="csub-cap">${t.cap}</div>
            <div class="csub-price">${clubFounder?`<s>${t.price} €</s> ${fnd} €`:`${t.price} €`}<small>/saison</small></div>
            <div class="csub-per">${t.perM} /mois/athlète</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="csub-foot">
      <div class="csub-terms"><i class="ic ic-calendar"></i><span>Facturé à la saison (sept. → août), une facture en septembre, par virement. Tu démarres aujourd'hui — la facture ne part qu'à la rentrée.</span></div>
      <button class="cc-btn" id="clubChooseBtn">Choisir la formule ${tier.name}</button>
    </div>
  </div>`;
}
function wireClubSillance(){
  const tgl=document.getElementById('clubFounderTgl');
  if(tgl) tgl.onchange=()=>{ clubFounder=tgl.checked; renderClubBill(); };
  const btn=document.getElementById('clubChooseBtn');
  if(btn) btn.onclick=()=>{
    const t=clubTierFor(clubActivated()), p=clubTierPrice(t);
    toast(`Formule ${t.name} retenue — ${p} €/saison${clubFounder?' (fondateur)':''}. Facture envoyée en septembre.`);
    if(window.PF?.user && window.__pf_clubId && PF.saveClubPlan) PF.saveClubPlan(window.__pf_clubId, t.id, clubFounder).catch(e=>console.warn('saveClubPlan',e));
  };
}

/* facturation dérivée de l'état réel (formules + à la carte) — reste cohérente
   quand on change la formule d'un adhérent ou un tarif de créneau. */
function clubBills(){
  const bills=[];
  CLUB_ATHLETES.forEach(a=>{
    if(a.offer==='coach') bills.push({m:a.id, why:'Coaching + — juin', type:'sub', amt:clubOffer('coach').price, ok:true});
    else if(a.offer==='sub') bills.push({m:a.id, why:'Abonnement club — juin', type:'sub', amt:clubOffer('sub').price, ok:true});
  });
  CRENEAUX.filter(c=>c.price>0).forEach(c=>{
    c.attendees.forEach(id=>{
      if(!CLUB_ATHLETES.find(x=>x.id===id)) return;
      bills.push({m:id, why:`${c.title} — à la carte`, type:'card', amt:c.price, ok:true});
    });
  });
  if(bills[2]) bills[2].ok=false;   // démo : 2 paiements en attente
  if(bills[5]) bills[5].ok=false;
  return bills;
}

function renderClubDash(){
  const box=document.getElementById('clubViewDash'); if(!box) return;
  const fills=CRENEAUX.map(c=>Math.round(100*c.attendees.length/c.cap));
  const avgFill=fills.length?Math.round(fills.reduce((a,b)=>a+b,0)/fills.length):0;
  const totalIns=CRENEAUX.reduce((a,c)=>a+c.attendees.length,0);
  const bills=clubBills();
  const rev=bills.filter(b=>b.ok).reduce((a,b)=>a+b.amt,0);
  const coachN=CLUB_ATHLETES.filter(a=>a.offer==='coach').length;
  const kpis=[
    {v:avgFill+'%', k:'Remplissage moyen', c:'acc'},
    {v:totalIns, k:'Inscriptions actives', c:''},
    {v:rev+' €', k:'CA du mois', c:'good'},
    {v:CLUB_ATHLETES.length, k:'Adhérents', c:'str', d:coachN+' en Coaching +'}
  ];
  const top=CRENEAUX.slice().sort((a,b)=>(b.attendees.length/b.cap)-(a.attendees.length/a.cap)).slice(0,4);
  const mix=CLUB_OFFERS.map(o=>({o, n:CLUB_ATHLETES.filter(a=>a.offer===o.id).length}));
  const tot=CLUB_ATHLETES.length||1;
  box.innerHTML=`
    <div class="cdash-kpis">${kpis.map(k=>`<div class="cdash-kpi"><div class="v ${k.c}">${k.v}</div><div class="k">${k.k}</div>${k.d?`<div class="d">${k.d}</div>`:''}</div>`).join('')}</div>
    <div class="cdash-cols">
      <div class="cdash-card">
        <h4>Créneaux les plus remplis</h4>
        ${top.map(c=>{const D=DISC[c.disc];const pct=Math.round(100*c.attendees.length/c.cap);return `<div class="cdash-slot"><span class="ci" style="color:${D.color}">${discIcon(D)}</span><div class="cs-b"><div class="cs-t">${c.title}</div><div class="cs-m">${CLUB_DAYS[c.day]} ${c.time} · ${c.attendees.length}/${c.cap} inscrits</div><div class="cs-fill ${pct>=85?'hot':''}"><i style="width:${pct}%"></i></div></div><span class="cprice ${c.price>0?'paid':'free'}">${c.price>0?c.price+' €':'inclus'}</span></div>`;}).join('')}
      </div>
      <div class="cdash-card">
        <h4>Répartition par formule</h4>
        ${mix.map(({o,n})=>{const pct=Math.round(100*n/tot);const col=o.id==='coach'?'var(--accent)':o.id==='sub'?'var(--good)':'var(--bike)';return `<div class="cmix"><div class="cmix-h"><span><b>${o.name}</b> · ${o.price}€</span><span style="color:var(--muted)">${n} · ${pct}%</span></div><div class="cs-fill"><i style="width:${pct}%;background:${col}"></i></div></div>`;}).join('')}
        <p class="cdash-note">Le mix « Coaching + » est ta marge : suivi premium facturé plus cher.</p>
      </div>
    </div>`;
}

function renderClubBill(){
  const box=document.getElementById('clubViewBill'); if(!box) return;
  const bills=clubBills();
  const tot=bills.filter(b=>b.ok).reduce((a,b)=>a+b.amt,0);
  const wait=bills.filter(b=>!b.ok).reduce((a,b)=>a+b.amt,0);
  const rec=bills.filter(b=>b.type==='sub'&&b.ok).length;
  box.innerHTML=clubSillanceCardHTML()+`
    <p class="club-hint" style="margin:0 0 12px"><b>Revenus des adhérents</b> — ce que le club encaisse (distinct de l'abonnement Sillance ci-dessus).</p>
    <div class="cdash-kpis cols3">
      <div class="cdash-kpi"><div class="v good">${tot} €</div><div class="k">Encaissé ce mois</div></div>
      <div class="cdash-kpi"><div class="v" style="color:var(--bike)">${wait} €</div><div class="k">En attente</div></div>
      <div class="cdash-kpi"><div class="v acc">${rec}</div><div class="k">Abonnements actifs</div></div>
    </div>
    <p class="club-hint" style="margin:4px 0 12px">Abonnements mensuels + réservations à la carte. Encaissé par Stripe, directement sur le compte du club.</p>
    <table class="cbill"><thead><tr><th>Adhérent</th><th>Motif</th><th>Type</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
    ${bills.map(b=>{const a=CLUB_ATHLETES.find(x=>x.id===b.m);return `<tr><td><span class="cbav">${a?initials(a.name):'?'}</span>${a?a.name:'—'}</td><td>${b.why}</td><td>${b.type==='sub'?'Abonnement':'À la carte'}</td><td><b>${b.amt} €</b></td><td>${b.ok?'<span class="cpay ok">payé</span>':'<span class="cpay wait">en attente</span>'}</td></tr>`;}).join('')}
    </tbody></table>`;
  wireClubSillance();
}

function renderClubOffres(){
  const box=document.getElementById('clubViewOffres'); if(!box) return;
  box.innerHTML=`
  <div class="cconnect">
    <div><b><i class="ic ic-credit-card"></i> Encaisse tes adhérents</b><div class="cconnect-s">Relie le compte Stripe du club → tu perçois abonnements &amp; séances à la carte directement (commission plateforme configurable).</div></div>
    <button class="co-edit" id="clubConnectBtn" style="border-color:var(--accent);color:var(--accent)">Relier Stripe</button>
  </div>
  <p class="club-hint" style="margin-bottom:14px">Une échelle de valeur : on monte → on paie plus → plus de suivi et de data. Clique un tarif pour l'ajuster.</p>
  <div class="coffers">${CLUB_OFFERS.map(o=>`
    <div class="coffer ${o.feature?'feat':''}">
      ${o.feature?'<span class="cribbon"><i class="ic ic-star"></i> Marge premium</span>':''}
      <div class="co-name">${o.name}</div>
      <div class="co-pitch">${o.pitch}</div>
      <div class="co-price">${o.price} €<small> ${o.unit}</small></div>
      <button class="co-edit" data-o="${o.id}"><i class="ic ic-edit"></i> Modifier le tarif</button>
      <ul>${o.inc.map(i=>`<li>${i}</li>`).join('')}</ul>
      <div class="co-who">${o.who}</div>
    </div>`).join('')}</div>`;
  box.querySelectorAll('.co-edit[data-o]').forEach(btn=>btn.onclick=()=>{
    const o=clubOffer(btn.dataset.o); const v=prompt(`Tarif de « ${o.name} » (€) :`, o.price);
    if(v!==null && !isNaN(+v) && v!==''){
      o.price=+v; renderClubOffres(); toast(tr('toast.tarifMisAJour'));
      if(window.PF?.user && window.__pf_clubId) PF.saveClubOffer(window.__pf_clubId, o.id, o.price).catch(e=>console.warn('saveClubOffer',e));
    }
  });
  const cc=document.getElementById('clubConnectBtn');
  if(cc) cc.onclick=()=>{
    if(window.PF?.user && window.__pf_clubId) PF.connectClubStripe(window.__pf_clubId).catch(e=>{console.warn(e);toast(tr('toast.stripeIndisponible'), 'error');});
    else toast(tr('toast.connecteEspaceClubPourRelier'));
  };
}

/* ---- Rappel de séance à venir (le licencié confirme ou annule sa présence) ---- */
let reminderStatus = null; // null | 'confirmed' | 'cancelled'
function nextCreneauForMe(){
  // le prochain créneau où "moi" est inscrit (démo : on prend le 1er trouvé)
  return CRENEAUX.find(c=>c.attendees.includes(ME_CLUB_ID));
}
function renderSessionReminder(){
  const box=document.getElementById('sessionReminder'); if(!box) return;
  const c=nextCreneauForMe();
  if(!c){ box.innerHTML=''; return; }
  const D=DISC[c.disc];
  box.innerHTML=`<div class="sess-reminder">
    <span class="sr-icon">⏰</span>
    <div class="sr-body">
      <div class="sr-title">Rappel — ${CLUB_DAYS[c.day]} ${c.time} : ${c.title}</div>
      <div class="sr-meta">${discIcon(D)} ${D.label} · <i class="ic ic-pin"></i> ${c.place} · ${fmtDur(c.dur)}${c.price>0?` · ${c.price}€`:''}</div>
    </div>
    <div class="sr-actions">
      <button class="sr-confirm ${reminderStatus==='confirmed'?'done':''}" data-act="confirm">${reminderStatus==='confirmed'?'<i class="ic ic-check"></i> Confirmé':'Je confirme'}</button>
      <button class="sr-cancel ${reminderStatus==='cancelled'?'done':''}" data-act="cancel">${reminderStatus==='cancelled'?'Absent noté':'J\'annule'}</button>
    </div>
  </div>`;
  box.querySelector('[data-act="confirm"]').onclick=()=>{
    reminderStatus='confirmed';
    if(!c.attendees.includes(ME_CLUB_ID)) c.attendees.push(ME_CLUB_ID);
    renderCreneaux(); renderClubStats();
    toast(tr('toast.presenceConfirmeeCoachEstPrevenu'));
  };
  box.querySelector('[data-act="cancel"]').onclick=()=>{
    reminderStatus='cancelled';
    const i=c.attendees.indexOf(ME_CLUB_ID); if(i>-1) c.attendees.splice(i,1);
    renderCreneaux(); renderClubStats();
    toast(tr('toast.absenceNoteeTuPeuxFaire'));
  };
}

/* ---- Historique perso du licencié (récap motivant + séances payantes) ---- */
const CLUB_HISTORY = {
  trimestre: 23,            // séances club ce trimestre (démo)
  heures: 31,               // heures cumulées
  presence: 88,             // % de présence
  paid: []                  // séances payantes consommées (démo : aucune — clubs d'endurance = adhésion, pas de drop-in)
};
function renderClubHistory(){
  const box=document.getElementById('clubHistory'); if(!box) return;
  const h=CLUB_HISTORY;
  const totalPaid=h.paid.reduce((a,p)=>a+p.amount,0);
  const paidHtml = h.paid.length? `
    <div class="ch-paid-title">Séances à la carte consommées</div>
    <div class="ch-paid-list">${h.paid.map(p=>`<div class="ch-paid"><span>${p.label} · <span style="color:var(--muted)">${p.date}</span></span><span class="amt">${p.amount} €</span></div>`).join('')}</div>
    <div class="ch-total"><span>Total réglé ce trimestre</span><span>${totalPaid} €</span></div>` : '';
  box.innerHTML=`<div class="club-hist">
    <div class="ch-top">
      <span class="ch-badge"><i class="ic ic-trophy"></i></span>
      <div>
        <div class="ch-headline">Tu as fait <b>${h.trimestre} séances club</b> ce trimestre !</div>
        <div class="ch-sub">Continue comme ça</div>
      </div>
    </div>
    <div class="ch-stats">
      <div class="ch-stat"><div class="v">${h.trimestre}</div><div class="k">séances</div></div>
      <div class="ch-stat"><div class="v">${h.heures}<span style="font-size:13px">h</span></div><div class="k">cumulées</div></div>
      <div class="ch-stat"><div class="v">${h.presence}<span style="font-size:13px">%</span></div><div class="k">présence</div></div>
    </div>
    ${paidHtml}
  </div>`;
}

let crMemberView=false;
function renderCreneaux(){
  renderSessionReminder();
  renderClubHistory();
  const box=document.getElementById('creneauList');
  // bandeau de bascule : ce que voit le coach (tout) vs un adhérent (uniquement
  // les créneaux ouverts à tous ou à SON groupe — les autres n'existent pas pour lui)
  const me=CLUB_ATHLETES.find(a=>a.id===ME_CLUB_ID);
  const seen = crMemberView
    ? CRENEAUX.filter(c=>!c.group || (me && me.group===c.group))
    : CRENEAUX;
  const hidden = CRENEAUX.length - seen.length;
  box.innerHTML = `<div class="cr-viewbar">
      <span>Affichage :</span>
      <button class="cr-viewbtn ${!crMemberView?'on':''}" data-v="coach">Vue coach — tout</button>
      <button class="cr-viewbtn ${crMemberView?'on':''}" data-v="member">Vue adhérent${me?` (${me.name.split(' ')[0]} · ${me.group?clubGroup(me.group).name:'sans groupe'})`:''}</button>
      ${crMemberView&&hidden?`<em>${hidden} créneau${hidden>1?'x':''} d'autres groupes masqué${hidden>1?'s':''}</em>`:''}
    </div>` + seen.slice().sort((a,b)=>a.day-b.day||a.time.localeCompare(b.time)).map(c=>{
    const D=DISC[c.disc];
    const inIt = c.attendees.includes(ME_CLUB_ID);
    const fillPct = Math.min(100, c.attendees.length/c.cap*100);
    const avatars = c.attendees.slice(0,6).map(id=>{ const a=CLUB_ATHLETES.find(x=>x.id===id); return `<div class="cr-att" title="${a?a.name:''}">${a?initials(a.name):'?'}</div>`; }).join('')
      + (c.attendees.length>6?`<div class="cr-att more">+${c.attendees.length-6}</div>`:'');
    return `<div class="creneau-card" data-id="${c.id}" style="--cc:${D.color}">
      <div class="cr-top">
        <span class="cr-disc"><span class="ci">${discIcon(D)}</span>${c.title}</span>
        <span class="cr-price ${c.price>0?'paid':'free'}">${c.price>0?c.price+' €':'inclus'}</span>
      </div>
      <div class="cr-meta">
        <span><b>${c.recur==='once'&&c.date?new Date(c.date+'T00:00:00').toLocaleDateString(localeStr(),{day:'numeric',month:'short'}):CLUB_DAYS[c.day]}</b> ${c.time}</span>
        ${c.recur==='once'?'<span title="Séance ponctuelle">ponctuel</span>':'<span title="Se répète chaque semaine"><i class="ic ic-refresh"></i> hebdo</span>'}
        <span>${fmtDur(c.dur)}</span>
        <span><i class="ic ic-pin"></i> ${c.place}</span>
        <span><i class="ic ic-user"></i> ${c.coach}</span>
      </div>
      ${(()=>{ const g=c.group?clubGroup(c.group):null;
        const me=CLUB_ATHLETES.find(a=>a.id===ME_CLUB_ID);
        const canSee=!g || (me && me.group===c.group);
        const chip=g?`<span class="cr-grp" style="--gc:${g.color}">${g.name}</span>`:'';
        const body=c.desc ? (canSee?`<div class="cr-desc">${c.desc}</div>`
          :`<div class="cr-desc locked"><i class="ic ic-lock"></i> Contenu réservé au groupe ${g.name}</div>`) : '';
        const pend=(c.invited&&c.invited.length)?`<div class="cr-pending">${c.invited.length} invité${c.invited.length>1?'s':''} du groupe — en attente de confirmation</div>`:'';
        return chip+body+pend; })()}
      <div class="cr-fill"><i style="width:${fillPct}%"></i></div>
      <div class="cr-fillrow"><span>${c.attendees.length}/${c.cap} inscrits</span><span>${c.cap-c.attendees.length} places restantes</span></div>
      <div class="cr-attendees">${avatars||'<span class="cr-roster">Aucun inscrit pour l\'instant</span>'}</div>
      <div class="cr-cta">
        ${(c.invited||[]).includes(ME_CLUB_ID)
          ? `<button class="cr-join" data-act="confirm"><i class="ic ic-check"></i> Confirmer ma présence</button>`
          : `<button class="cr-join ${inIt?'in':''}" data-act="join">${inIt?'<i class="ic ic-check"></i> Inscrit':(c.price>0?`S'inscrire · ${c.price}€`:'S\'inscrire')}</button>`}
        <button data-act="roster">Liste</button>
      </div>
    </div>`;
  }).join('') + (seen.length?'':'<p class="club-hint">Aucun créneau visible pour ce profil.</p>');
  // wiring
  box.querySelectorAll('.cr-viewbtn').forEach(b=>b.onclick=()=>{ crMemberView=b.dataset.v==='member'; renderCreneaux(); });
  box.querySelectorAll('.creneau-card').forEach(card=>{
    const c=CRENEAUX.find(x=>x.id===card.dataset.id);
    const cf=card.querySelector('[data-act="confirm"]');
    if(cf) cf.onclick=()=>{
      const i=(c.invited||[]).indexOf(ME_CLUB_ID);
      if(i>-1){ c.invited.splice(i,1); if(!c.attendees.includes(ME_CLUB_ID)) c.attendees.push(ME_CLUB_ID); }
      toast(tr('toast.presenceConfirmee'));
      renderCreneaux(); renderClubStats(); if(typeof renderPresence==='function') renderPresence();
    };
    const jb=card.querySelector('[data-act="join"]');
    if(jb) jb.onclick=()=>{
      const i=c.attendees.indexOf(ME_CLUB_ID);
      if(i>-1){ c.attendees.splice(i,1); toast(tr('toast.inscriptionAnnulee')); }
      else {
        if(c.attendees.length>=c.cap){ toast(tr('toast.creneauComplet')); return; }
        c.attendees.push(ME_CLUB_ID);
        toast(c.price>0?`Inscrit (${c.price}€ — paiement à la séance)`:'Inscrit au créneau');
      }
      renderCreneaux(); renderClubStats(); renderPresence();
    };
    card.querySelector('[data-act="roster"]').onclick=(e)=>{ e.stopPropagation(); openCreneauDetail(c,'participants'); };
    card.addEventListener('click', e=>{ if(!e.target.closest('button')) openCreneauDetail(c,'desc'); });
    card.style.cursor='pointer';
  });
}


/* Ouvre le calendrier d'entraînement d'un adhérent du club (vue coach).
   Démo : plan dérivé stable propre à ce membre ; connecté : nécessitera le
   lien coach_athlete réel (les ids du roster réel remplaceront la dérivation). */
function openClubAthleteCalendar(a){
  mode='coach'; setActiveMode(mc);
  if(!rosterIsReal){
    const idx = Math.abs(String(a.id).split('').reduce((x,c)=>x+c.charCodeAt(0),0)) % COACH_ROSTER.length;
    selectedAthleteIdx = idx; applyDemoAthlete(idx); renderAthPicker();
  }
  renderSidebar(); render(); updateVideolibVisibility(); updatePlanAthleteVisibility();
  if(typeof renderCoachBand==='function') renderCoachBand();
  if(typeof renderGear==='function') renderGear();
  window.scrollTo({top:0, behavior:'smooth'});
  toast(`Calendrier de ${a.name}` + (rosterIsReal?'':' — démo : plan type du club'));
}
let clubOnlyUnassigned = false;
function renderClubAthletes(filter){
  renderJoinRequests();
  renderLicenceAlert();
  const box=document.getElementById('clubAthletesList');
  const q=(filter||'').toLowerCase();
  let list=CLUB_ATHLETES.filter(a=>!q||a.name.toLowerCase().includes(q));
  if(clubOnlyUnassigned) list=list.filter(a=>!a.group);
  if(clubLicenceOnly) list=list.filter(a=>licenceStatus(a)!=='ok');
  const banner = clubOnlyUnassigned
    ? `<div class="grp-unassigned-banner" id="clubUnassignedClear"><span>Filtré sur les athlètes <b>sans groupe</b></span><span><i class="ic ic-x"></i> Tout afficher</span></div>` : '';
  const rows = list.map(a=>{
    const nbInscr = CRENEAUX.filter(c=>c.attendees.includes(a.id)).length;
    const g = a.group ? clubGroup(a.group) : null;
    const grpOptions = '<option value="">Sans groupe</option>' + CLUB_GROUPS.map(gr=>`<option value="${gr.id}" ${a.group===gr.id?'selected':''}>${gr.name}</option>`).join('');
    return `<div class="club-ath">
      <div class="club-ath-av">${initials(a.name)}</div>
      <div class="club-ath-i">
        <div class="club-ath-n">${a.name}</div>
        <div class="club-ath-m">membre depuis ${a.since} · ${nbInscr} créneau${nbInscr>1?'x':''}</div>
        <select class="club-ath-grp-sel ${g?'':'none'}" data-aid="${a.id}" style="${g?`--gc:${g.color}`:''}" title="Changer de groupe">${grpOptions}</select>
        <span class="club-ath-offer co-${a.offer}" data-aid="${a.id}" title="Cliquer pour changer de formule">${clubOffer(a.offer).name}${a.offer==='coach'&&a.coach?` · ${a.coach}`:''}</span>
        <span class="club-ath-vid ${a.videos?'on':''}" data-vaid="${a.id}" title="Bientôt disponible — contenu vidéo en cours d'ajout"><i class="ic ic-film"></i> Vidéos <span class="cc-soon" style="margin-left:4px">Bientôt</span></span>
        <span class="club-ath-cal" data-caid="${a.id}" title="Ouvrir le calendrier d'entraînement de cet athlète"><i class="ic ic-calendar"></i> Calendrier</span>
        ${minorChip(a)}
        ${licenceChip(a)}
      </div>
      <span class="club-ath-tag">${CLUB_DISC_LABEL[a.disc]||tr('clubDisc.tri')}</span>
    </div>`;
  }).join('') || '<p class="club-hint">Aucun athlète trouvé.</p>';
  box.innerHTML = banner + rows;
  const clearBtn = document.getElementById('clubUnassignedClear');
  if(clearBtn) clearBtn.onclick=()=>{ clubOnlyUnassigned=false; renderClubAthletes(document.getElementById('clubAthleteSearch').value); };
  box.querySelectorAll('.club-ath-grp-sel').forEach(sel=>sel.onchange=()=>{
    const a=CLUB_ATHLETES.find(x=>x.id===sel.dataset.aid); if(!a) return;
    a.group = sel.value || null;
    renderClubAthletes(filter);
    renderClubStats();
    toast(`${a.name} → ${a.group?clubGroup(a.group).name:'Sans groupe'}`);
    if(window.PF?.user && window.__pf_clubId){
      PF.assignMemberGroup(a.id, a.group).catch(e=>console.warn('[PF] assignMemberGroup échoué :',e));
    }
  });
  box.querySelectorAll('.club-ath-offer').forEach(el=>el.onclick=()=>{
    const a=CLUB_ATHLETES.find(x=>x.id===el.dataset.aid); if(!a) return;
    const order=['sub','coach']; a.offer=order[(order.indexOf(a.offer)+1)%order.length];
    if(a.offer==='coach' && !a.coach) a.coach='Karim';
    renderClubAthletes(filter); renderClubStats();
    toast(`${a.name} → ${clubOffer(a.offer).name}`);
    if(window.PF?.user && window.__pf_clubId && (a.offer==='sub'||a.offer==='coach')){
      PF.subscribeToClubOffer(window.__pf_clubId, a.id, a.offer).catch(e=>{console.warn('subscribe',e);toast(tr('toast.paiementIndisponibleDemo'), 'error');});
    }
  });
  box.querySelectorAll('.club-ath-vid').forEach(el=>el.onclick=()=>{
    toast(tr('toast.bibliothequeVideoBientotDisponibleContenu'));
  });
  box.querySelectorAll('.club-ath-minor').forEach(el=>el.onclick=()=> openConsent(el.dataset.maid, filter));
  box.querySelectorAll('.club-ath-licence').forEach(el=>el.onclick=()=> openLicence(el.dataset.lid, filter));
  box.querySelectorAll('.club-ath-cal').forEach(el=>el.onclick=()=>{
    const a=CLUB_ATHLETES.find(x=>x.id===el.dataset.caid); if(a) openClubAthleteCalendar(a);
  });
}
let clubLicenceOnly = false;
function licenceStatus(a){
  if(!a.licence || !a.licence.medCertUntil) return 'missing';
  const days = Math.round((new Date(a.licence.medCertUntil) - new Date())/86400000);
  if(days<0) return 'expired';
  if(days<=60) return 'soon';
  return 'ok';
}
function renderLicenceAlert(){
  const box=document.getElementById('licenceAlert'); if(!box) return;
  const n = CLUB_ATHLETES.filter(a=>licenceStatus(a)!=='ok').length;
  if(!n){ box.innerHTML=''; return; }
  box.innerHTML = `<div class="grp-unassigned-banner" id="licenceAlertBanner"><span><b>${n}</b> licence${n>1?'s':''} à traiter (certificat manquant, à renouveler ou expiré)</span><span>${clubLicenceOnly?'<i class="ic ic-x"></i> Tout afficher':'Voir →'}</span></div>`;
  const bn=document.getElementById('licenceAlertBanner');
  if(bn) bn.onclick=()=>{ clubLicenceOnly=!clubLicenceOnly; renderClubAthletes(document.getElementById('clubAthleteSearch').value); };
}

/* Chip « licence fédérale / certificat médical » sur chaque fiche athlète club. */
function licenceChip(a){
  const st = licenceStatus(a);
  const fed = a.licence?.fed || '';
  if(st==='ok') return `<span class="club-ath-licence ok" data-lid="${a.id}" title="Licence ${fed} à jour — cliquer pour voir/modifier"><i class="ic ic-check"></i> ${fed} · à jour</span>`;
  if(st==='soon') return `<span class="club-ath-licence soon" data-lid="${a.id}" title="Certificat médical ${fed} à renouveler bientôt — cliquer pour modifier"><i class="ic ic-alert-triangle"></i> ${fed} · à renouveler</span>`;
  if(st==='expired') return `<span class="club-ath-licence warn" data-lid="${a.id}" title="Certificat médical ${fed} expiré — cliquer pour modifier"><i class="ic ic-alert-triangle"></i> ${fed} · expiré</span>`;
  return `<span class="club-ath-licence" data-lid="${a.id}" title="Aucune licence enregistrée — cliquer pour renseigner">Licence ?</span>`;
}

/* ---- Modal licence & certificat médical ---- */
let licenceAthId = null, licenceFilter = null;
function openLicence(aid, filter){
  const a = CLUB_ATHLETES.find(x=>x.id===aid); if(!a) return;
  licenceAthId = aid; licenceFilter = filter;
  document.getElementById('licenceAthName').textContent = a.name;
  document.getElementById('licFed').value = a.licence?.fed || (a.disc==='bike'?'FFC':'FFTri');
  document.getElementById('licNum').value = a.licence?.num || '';
  document.getElementById('licCert').value = a.licence?.medCertUntil || '';
  document.getElementById('licenceOverlay').classList.add('open');
}
function saveLicence(){
  const a = CLUB_ATHLETES.find(x=>x.id===licenceAthId); if(!a) return;
  const fed = document.getElementById('licFed').value;
  const num = document.getElementById('licNum').value.trim();
  const cert = document.getElementById('licCert').value;
  if(!num && !cert){ delete a.licence; }
  else { a.licence = {fed, num, medCertUntil: cert||null}; }
  document.getElementById('licenceOverlay').classList.remove('open');
  renderClubAthletes(licenceFilter);
  toast(`Licence mise à jour pour ${a.name}`);
}
(function initLicence(){
  const ov=document.getElementById('licenceOverlay'); if(!ov) return;
  document.getElementById('licSave').addEventListener('click', saveLicence);
  document.getElementById('licenceClose').addEventListener('click', ()=> ov.classList.remove('open'));
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); });
})();

/* Chip « mineur / consentement parental » sur chaque fiche athlète club. */
function minorConsentOk(a){ return !!(a.consentAt || a.guardian_consent_at); }
function minorChip(a){
  if(a.minor){
    return minorConsentOk(a)
      ? `<span class="club-ath-minor ok" data-maid="${a.id}" title="Autorisation parentale recueillie — cliquer pour voir/modifier"><i class="ic ic-check"></i> Mineur · consentement OK</span>`
      : `<span class="club-ath-minor warn" data-maid="${a.id}" title="Athlète mineur : autorisation parentale à recueillir"><i class="ic ic-alert-triangle"></i> Mineur · consentement requis</span>`;
  }
  return `<span class="club-ath-minor" data-maid="${a.id}" title="Marquer comme mineur (déclenche le consentement parental)">Mineur ?</span>`;
}

/* ---- Modal de consentement parental ---- */
let consentAthId = null, consentFilter = null;
function openConsent(aid, filter){
  const a = CLUB_ATHLETES.find(x=>x.id===aid); if(!a) return;
  consentAthId = aid; consentFilter = filter;
  const ov=document.getElementById('consentOverlay');
  document.getElementById('consentAthName').textContent = a.name;
  const isMinor=document.getElementById('consentIsMinor');
  const gName=document.getElementById('consentGuardianName');
  const gMail=document.getElementById('consentGuardianEmail');
  const attest=document.getElementById('consentAttest');
  isMinor.checked = !!a.minor;
  gName.value = a.guardian?.name || '';
  gMail.value = a.guardian?.email || '';
  attest.checked = minorConsentOk(a);
  updateConsentUI();
  ov.classList.add('open');
}
function updateConsentUI(){
  const on=document.getElementById('consentIsMinor').checked;
  document.getElementById('consentFields').hidden = !on;
  const attest=document.getElementById('consentAttest').checked;
  const gName=document.getElementById('consentGuardianName').value.trim();
  const gMail=document.getElementById('consentGuardianEmail').value.trim();
  // enregistrable si : pas mineur, OU mineur + tuteur renseigné + attestation cochée
  document.getElementById('consentSave').disabled = on && !(gName && gMail && attest);
}
function saveConsent(){
  const a = CLUB_ATHLETES.find(x=>x.id===consentAthId); if(!a) return;
  const on=document.getElementById('consentIsMinor').checked;
  const gName=document.getElementById('consentGuardianName').value.trim();
  const gMail=document.getElementById('consentGuardianEmail').value.trim();
  const attest=document.getElementById('consentAttest').checked;
  a.minor = on;
  if(on){ a.guardian={name:gName,email:gMail}; a.consentAt = attest ? new Date().toISOString().slice(0,10) : null; }
  else { delete a.guardian; delete a.consentAt; }
  document.getElementById('consentOverlay').classList.remove('open');
  renderClubAthletes(consentFilter);
  toast(on ? (attest?`Consentement parental enregistré pour ${a.name}`:`${a.name} marqué mineur`) : `${a.name} : statut mineur retiré`);
  if(window.PF?.user){
    PF.setParentalConsent(a.id, {is_minor:on, guardian_name:gName, guardian_email:gMail, consent:attest})
      .catch(e=>{console.warn('consent',e); toast(tr('toast.enregistrementIndisponibleDemo'), 'error');});
  }
}
(function initConsent(){
  const ov=document.getElementById('consentOverlay'); if(!ov) return;
  document.getElementById('consentIsMinor').addEventListener('change', updateConsentUI);
  document.getElementById('consentAttest').addEventListener('change', updateConsentUI);
  document.getElementById('consentGuardianName').addEventListener('input', updateConsentUI);
  document.getElementById('consentGuardianEmail').addEventListener('input', updateConsentUI);
  document.getElementById('consentSave').addEventListener('click', saveConsent);
  document.getElementById('consentClose').addEventListener('click', ()=> ov.classList.remove('open'));
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); });
})();

/* ---- Demandes d'adhésion (via le lien d'invitation) ---- */
function renderJoinRequests(){
  const box=document.getElementById('joinRequests'); if(!box) return;
  if(!JOIN_REQUESTS.length){ box.innerHTML=''; return; }
  box.innerHTML=`<div class="join-block">
    <div class="join-head">⏳ ${JOIN_REQUESTS.length} demande${JOIN_REQUESTS.length>1?'s':''} d'adhésion en attente</div>
    <div class="join-list">${JOIN_REQUESTS.map(r=>`
      <div class="join-req" data-id="${r.id}">
        <div class="join-av">${initials(r.name)}</div>
        <div class="join-i">
          <div class="join-n">${r.name} <span class="club-ath-tag" style="margin-left:5px">${CLUB_DISC_LABEL[r.disc]||tr('clubDisc.tri')}</span></div>
          <div class="join-m">${r.msg||'Souhaite rejoindre le club'}</div>
        </div>
        <div class="join-acts">
          <button class="join-accept" data-act="accept">Accepter</button>
          <button class="join-reject" data-act="reject">Refuser</button>
        </div>
      </div>`).join('')}</div>
  </div>`;
  box.querySelectorAll('.join-req').forEach(row=>{
    const r=JOIN_REQUESTS.find(x=>x.id===row.dataset.id);
    row.querySelector('[data-act="accept"]').onclick=()=> openAcceptModal(r);
    row.querySelector('[data-act="reject"]').onclick=()=>{
      JOIN_REQUESTS=JOIN_REQUESTS.filter(x=>x.id!==r.id);
      renderClubAthletes(); toast(tr('toast.demandeRefusee'));
    };
  });
}

/* modal : affecter le nouvel athlète à un groupe */
let acceptingReq=null, acceptGroupId=null;
const acceptOverlay=document.getElementById('acceptOverlay');
function openAcceptModal(r){
  acceptingReq=r; acceptGroupId=null;
  document.getElementById('acceptName').textContent=`Accepter ${r.name}`;
  document.getElementById('acceptGroups').innerHTML=CLUB_GROUPS.map(g=>`
    <div class="accept-grp" data-g="${g.id}">
      <span class="agdot" style="background:${g.color}"></span>
      <div><div class="agn">${g.name}</div>${g.desc?`<div class="agd">${g.desc}</div>`:''}</div>
    </div>`).join('');
  document.querySelectorAll('.accept-grp').forEach(el=> el.onclick=()=>{
    document.querySelectorAll('.accept-grp').forEach(x=>x.classList.remove('sel'));
    el.classList.add('sel'); acceptGroupId=el.dataset.g;
  });
  acceptOverlay.classList.add('open');
}
document.getElementById('acceptClose').onclick=()=> acceptOverlay.classList.remove('open');
acceptOverlay.addEventListener('click', e=>{ if(e.target===acceptOverlay) acceptOverlay.classList.remove('open'); });
document.getElementById('acceptSave').onclick=()=>{
  if(!acceptingReq) return;
  if(!acceptGroupId){ toast(tr('toast.choisisGroupePourCetAthlete')); return; }
  const newA={ id:'a'+Date.now(), name:acceptingReq.name, disc:acceptingReq.disc, since:String(new Date().getFullYear()), group:acceptGroupId };
  CLUB_ATHLETES.push(newA);
  JOIN_REQUESTS=JOIN_REQUESTS.filter(x=>x.id!==acceptingReq.id);
  acceptOverlay.classList.remove('open');
  renderClubAthletes(); renderClubStats();
  const g=clubGroup(acceptGroupId);
  toast(`${newA.name} ajouté au club dans « ${g.name} »`);
};

/* lien d'invitation : copier, partager, simuler une demande */
document.getElementById('inviteCopy').onclick=()=>{
  const inp=document.getElementById('inviteLink');
  inp.select();
  try{ navigator.clipboard.writeText(inp.value); }catch(e){ document.execCommand && document.execCommand('copy'); }
  const btn=document.getElementById('inviteCopy'); btn.textContent='Copié'; btn.classList.add('done');
  setTimeout(()=>{ btn.textContent='Copier'; btn.classList.remove('done'); }, 1600);
  toast(tr('toast.lienCopiePartageAAthletes'));
};
document.getElementById('inviteWhatsapp').onclick=()=>{
  const link=document.getElementById('inviteLink').value;
  const msg=`Rejoins le club Muret Goat Squad sur Sillance : ${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
};
document.getElementById('inviteSimulate').onclick=()=>{
  const name=DEMO_NAMES[demoNameIdx % DEMO_NAMES.length]; demoNameIdx++;
  JOIN_REQUESTS.push({id:'r'+Date.now(), name, disc: Math.random()>0.5?'tri':'bike', msg:'Souhaite rejoindre le club via le lien'});
  renderClubAthletes();
  toast(`Nouvelle demande reçue : ${name}`);
};

function renderPresence(){
  const box=document.getElementById('presenceSummary');
  box.innerHTML = CRENEAUX.slice().sort((a,b)=>a.day-b.day).map(c=>{
    const D=DISC[c.disc];
    const chips = c.attendees.map(id=>{ const a=CLUB_ATHLETES.find(x=>x.id===id); return a?`<span class="pres-chip"><span class="pcdot"></span>${a.name}</span>`:''; }).join('');
    return `<div class="pres-card">
      <div class="pres-head">
        <span class="pres-title">${discIcon(D)} ${c.title} <span style="color:var(--muted);font-weight:400">· ${CLUB_DAYS[c.day]} ${c.time}</span></span>
        <span class="pres-count">${c.attendees.length}/${c.cap} présents</span>
      </div>
      <div class="pres-list">${chips||'<span class="pres-empty">Personne inscrit pour l\'instant</span>'}</div>
    </div>`;
  }).join('');
}

function switchClubView(){
  document.querySelectorAll('.club-tab').forEach(b=> b.classList.toggle('active', b.dataset.ct===clubView));
  document.getElementById('clubViewDash').hidden = clubView!=='dash';
  document.getElementById('clubViewCreneaux').hidden = clubView!=='creneaux';
  document.getElementById('clubViewGroupes').hidden = clubView!=='groupes';
  document.getElementById('clubViewAthletes').hidden = clubView!=='athletes';
  document.getElementById('clubViewPresence').hidden = clubView!=='presence';
  document.getElementById('clubViewBill').hidden = clubView!=='bill';
  document.getElementById('clubViewOffres').hidden = clubView!=='offres';
  if(clubView==='dash') renderClubDash();
  if(clubView==='creneaux') renderCreneaux();
  if(clubView==='groupes') renderGroups();
  if(clubView==='athletes') renderClubAthletes();
  if(clubView==='presence') renderPresence();
  if(clubView==='bill') renderClubBill();
  if(clubView==='offres') renderClubOffres();
}
document.querySelectorAll('.club-tab').forEach(b=> b.addEventListener('click', ()=>{ clubView=b.dataset.ct; switchClubView(); }));
document.getElementById('clubAthleteSearch').addEventListener('input', e=> renderClubAthletes(e.target.value));

/* ---- Groupes ---- */
function renderGroups(){
  const box=document.getElementById('groupList');
  const unassigned = CLUB_ATHLETES.filter(a=>!a.group);
  const banner = unassigned.length
    ? `<div class="grp-unassigned-banner" id="grpUnassignedBanner"><span><b>${unassigned.length}</b> athlète${unassigned.length>1?'s':''} sans groupe</span><span>Voir →</span></div>` : '';
  const cards = CLUB_GROUPS.map(g=>{
    const members=CLUB_ATHLETES.filter(a=>a.group===g.id);
    const avs = members.slice(0,8).map(a=>`<div class="group-av" title="${a.name}">${initials(a.name)}</div>`).join('')
      + (members.length>8?`<div class="group-av more">+${members.length-8}</div>`:'');
    return `<div class="group-card" data-id="${g.id}" style="--gc:${g.color}">
      <div class="group-card-head">
        <span class="group-name"><span class="gdot"></span>${g.name}</span>
        <button class="group-edit" data-act="editgroup">Modifier</button>
      </div>
      ${g.desc?`<div class="group-desc">${g.desc}</div>`:''}
      <div class="group-count">${members.length} athlète${members.length>1?'s':''}</div>
      <div class="group-avs">${avs||'<span class="group-desc">Aucun athlète affecté</span>'}</div>
    </div>`;
  }).join('') || '<p class="club-hint">Aucun groupe. Crée le premier !</p>';
  box.innerHTML = banner + cards;
  const bn = document.getElementById('grpUnassignedBanner');
  if(bn) bn.onclick=()=>{ clubOnlyUnassigned=true; clubView='athletes'; switchClubView(); };
  box.querySelectorAll('.group-card').forEach(card=>{
    card.querySelector('[data-act="editgroup"]').onclick=()=> openGroupModal(card.dataset.id);
  });
}

const GROUP_COLORS = ['#2FD9FF','#FFB13D','#FF5470','#9D7BFF','#39E6A3','#FF8A3D','#5B8DEF','#E84393'];
let editingGroupId = null;
const groupOverlay=document.getElementById('groupOverlay');

function openGroupModal(id){
  editingGroupId = id || null;
  const g = id ? clubGroup(id) : null;
  document.getElementById('groupModalTitle').textContent = g ? 'Modifier le groupe' : 'Nouveau groupe';
  document.getElementById('grpName').value = g?.name || '';
  document.getElementById('grpDesc').value = g?.desc || '';
  const selColor = g?.color || GROUP_COLORS[0];
  // palette de couleurs
  document.getElementById('grpColors').innerHTML = GROUP_COLORS.map(c=>
    `<div class="grp-color ${c===selColor?'sel':''}" data-c="${c}" style="background:${c}"></div>`).join('');
  document.querySelectorAll('.grp-color').forEach(el=> el.onclick=()=>{
    document.querySelectorAll('.grp-color').forEach(x=>x.classList.remove('sel')); el.classList.add('sel');
  });
  // membres (cases à cocher) — triés : ce groupe d'abord, puis sans groupe, puis autre groupe
  const bucket = a => (g && a.group===g.id) ? 0 : (!a.group ? 1 : 2);
  const sorted = [...CLUB_ATHLETES].sort((a,b)=> bucket(a)-bucket(b) || a.name.localeCompare(b.name));
  document.getElementById('grpMembers').innerHTML = sorted.map(a=>{
    const checked = g && a.group===g.id;
    const other = (a.group && (!g || a.group!==g.id)) ? clubGroup(a.group) : null;
    return `<label class="grp-mem" data-name="${a.name.toLowerCase()}"><input type="checkbox" data-aid="${a.id}" ${checked?'checked':''}>
      <span class="gm-av">${initials(a.name)}</span><span class="gm-n">${a.name}</span>
      ${other?`<span class="grp-mem-other" style="border-color:${other.color}">déjà dans ${other.name}</span>`:''}</label>`;
  }).join('');
  const search = document.getElementById('grpMemberSearch');
  search.value = '';
  search.oninput = ()=>{
    const q = search.value.trim().toLowerCase();
    document.querySelectorAll('#grpMembers .grp-mem').forEach(el=>{
      el.style.display = (!q || el.dataset.name.includes(q)) ? '' : 'none';
    });
  };
  groupOverlay.classList.add('open');
}
document.getElementById('clubAddGroup').onclick=()=> openGroupModal(null);
document.getElementById('groupClose').onclick=()=> groupOverlay.classList.remove('open');
groupOverlay.addEventListener('click', e=>{ if(e.target===groupOverlay) groupOverlay.classList.remove('open'); });
document.getElementById('grpSave').onclick=()=>{
  // Échappés à la saisie (écriture optimiste locale, avant tout aller-retour
  // DB) : CLUB_GROUPS est ensuite affiché à de nombreux endroits via
  // innerHTML sans ré-échapper — sans ça, un nom de groupe contenant du
  // HTML/JS s'exécuterait immédiatement dans la session de celui qui l'a tapé.
  const name=dispoSafe(document.getElementById('grpName').value.trim()||'Nouveau groupe');
  const desc=dispoSafe(document.getElementById('grpDesc').value.trim());
  const color=(document.querySelector('.grp-color.sel')?.dataset.c)||GROUP_COLORS[0];
  const isEdit=!!editingGroupId;
  let gid=editingGroupId;
  if(gid){ const g=clubGroup(gid); g.name=name; g.desc=desc; g.color=color; }
  else { gid='g'+Date.now(); CLUB_GROUPS.push({id:gid, name, desc, color}); }
  // affecte les athlètes cochés à ce groupe ; décoche = retire du groupe (s'il y était)
  const added=[], removed=[];
  document.querySelectorAll('#grpMembers input[data-aid]').forEach(chk=>{
    const a=CLUB_ATHLETES.find(x=>x.id===chk.dataset.aid);
    if(!a) return;
    if(chk.checked){ if(a.group!==gid) added.push(a.id); a.group=gid; }
    else if(a.group===gid){ removed.push(a.id); a.group=null; }
  });
  // Persistance backend (si connecté à un club) — récupère l'id DB du groupe
  // puis affecte/retire les membres. Non bloquant, ignoré en mode démo.
  if(window.PF?.user && window.__pf_clubId){
    PF.saveGroup({ id:isEdit?gid:undefined, club_id:window.__pf_clubId,
      name, color, description:desc })
      .then(saved=>{
        if(!saved) return;
        if(!isEdit){
          const g=CLUB_GROUPS.find(x=>x.id===gid);
          if(g) g.id=saved.id;
          CLUB_ATHLETES.forEach(a=>{ if(a.group===gid) a.group=saved.id; });
        }
        added.forEach(aid=> PF.assignMemberGroup(aid, saved.id).catch(e=>console.warn('[PF] assignMemberGroup échoué :',e)));
        removed.forEach(aid=> PF.assignMemberGroup(aid, null).catch(e=>console.warn('[PF] assignMemberGroup échoué :',e)));
      })
      .catch(e=> console.warn('[PF] saveGroup échoué :', e));
  }
  groupOverlay.classList.remove('open');
  clubView='groupes'; switchClubView();
  toast(isEdit?'Groupe mis à jour':'Groupe créé');
};


/* ============================================================
   FICHE CRÉNEAU — clic sur la carte → description (les absents
   retrouvent le contenu), participants, paramètres (dont la
   récurrence : hebdomadaire ou séance ponctuelle datée).
   ============================================================ */
let crdCurrent=null, crdTab='desc';
function openCreneauDetail(c, tab){
  crdCurrent=c; crdTab=tab||'desc';
  const D=DISC[c.disc];
  const ov=document.getElementById('crDetailOverlay');
  ov.querySelector('.modal').style.setProperty('--c', D.color);
  document.getElementById('crdBadge').innerHTML=`${discIcon(D)} ${D.label}`;
  document.getElementById('crdTitle').textContent=c.title;
  renderCreneauDetail();
  ov.classList.add('open');
}
function crdWhen(c){
  return c.recur==='once' && c.date
    ? `${new Date(c.date+'T00:00:00').toLocaleDateString(localeStr(),{weekday:'long',day:'numeric',month:'long'})} ${c.time}`
    : `${CLUB_DAYS[c.day]} ${c.time} · chaque semaine`;
}
function renderCreneauDetail(){
  const c=crdCurrent; if(!c) return;
  document.getElementById('crdMeta').innerHTML=
    `<span>${crdWhen(c)}</span><span>${fmtDur(c.dur)}</span><span>${c.place}</span><span>${c.coach}</span>`;
  document.querySelectorAll('#crdTabs .crd-tab').forEach(b=>b.classList.toggle('active', b.dataset.t===crdTab));
  const body=document.getElementById('crdBody');
  const g=c.group?clubGroup(c.group):null;
  if(crdTab==='desc'){
    const me=CLUB_ATHLETES.find(a=>a.id===ME_CLUB_ID);
    const canSee=!g || (me && me.group===c.group);
    body.innerHTML = canSee
      ? `<div class="crd-desc">${c.desc||'Aucune description pour ce créneau — ajoute le contenu dans l\'onglet Paramètres.'}</div>
         <div class="crd-hint">Visible par ${g?`le groupe ${g.name}`:'tout le club'} — les absents retrouvent ici le contenu de la séance pour la faire de leur côté.</div>`
      : `<div class="crd-desc locked"><i class="ic ic-lock"></i> Contenu réservé au groupe ${g.name}.</div>`;
  }
  else if(crdTab==='participants'){
    const rows=[
      ...c.attendees.map(id=>({id, st:'ok'})),
      ...((c.invited||[]).map(id=>({id, st:'wait'})))
    ].map(r=>{
      const a=CLUB_ATHLETES.find(x=>x.id===r.id);
      return `<div class="crd-p"><div class="cr-att">${a?initials(a.name):'?'}</div>${a?a.name:'—'}
        <span class="st ${r.st}">${r.st==='ok'?'présent':'invité — à confirmer'}</span></div>`;
    }).join('');
    body.innerHTML = rows ? `<div class="crd-list">${rows}</div>` : '<p class="club-hint">Personne pour l\'instant.</p>';
  }
  else {
    body.innerHTML = `
      <div class="crd-form">
        <div class="b-fld"><label>Récurrence</label>
          <select id="crdRecur">
            <option value="weekly" ${c.recur!=='once'?'selected':''}>Chaque semaine</option>
            <option value="once" ${c.recur==='once'?'selected':''}>Séance ponctuelle (date)</option>
          </select></div>
        <div class="b-fld" id="crdWhenFld">${c.recur==='once'
          ? `<label for="crdDate">Date</label><input type="date" id="crdDate" value="${c.date||''}">`
          : `<label for="crdDay">Jour</label><select id="crdDay">${CLUB_DAYS.map((d,i)=>`<option value="${i}" ${i===c.day?'selected':''}>${d}</option>`).join('')}</select>`}</div>
        <div class="b-fld"><label for="crdTime">Heure</label><input type="time" id="crdTime" value="${c.time}"></div>
        <div class="b-fld"><label for="crdDur">Durée (min)</label><input type="number" id="crdDur" min="15" max="240" value="${c.dur}"></div>
        <div class="b-fld"><label for="crdPlace">Lieu</label><input type="text" id="crdPlace" value="${c.place}"></div>
        <div class="b-fld"><label for="crdCap">Places max</label><input type="number" id="crdCap" min="1" max="200" value="${c.cap}"></div>
        <div class="b-fld"><label>Groupe (contenu réservé)</label>
          <select id="crdGroup"><option value="">Tout le club</option>${CLUB_GROUPS.map(gr=>`<option value="${gr.id}" ${gr.id===c.group?'selected':''}>${gr.name}</option>`).join('')}</select></div>
        <div class="b-fld"><label for="crdPrice">Tarif (€)</label><input type="number" id="crdPrice" min="0" step="0.5" value="${c.price}"></div>
        <div class="b-fld full"><label for="crdDesc">Contenu de la séance</label><textarea id="crdDesc" rows="3" style="width:100%;background:var(--panel-2);border:1px solid var(--line-strong);color:var(--text);border-radius:9px;padding:8px 10px;font-family:inherit;font-size:12.5px;resize:vertical">${c.desc||''}</textarea></div>
      </div>
      <button class="btn crd-save" id="crdSave"><i class="ic ic-check"></i> Enregistrer les paramètres</button>`;
    document.getElementById('crdRecur').onchange=e=>{
      c.recur = e.target.value==='once' ? 'once' : 'weekly';
      if(c.recur==='once' && !c.date) c.date = iso(addDays(new Date(),7));
      renderCreneauDetail();
    };
    document.getElementById('crdSave').onclick=()=>{
      c.time=document.getElementById('crdTime').value||c.time;
      c.dur=+document.getElementById('crdDur').value||c.dur;
      c.place=document.getElementById('crdPlace').value||c.place;
      c.cap=+document.getElementById('crdCap').value||c.cap;
      c.group=document.getElementById('crdGroup').value||null;
      c.price=+document.getElementById('crdPrice').value||0;
      c.desc=document.getElementById('crdDesc').value.trim();
      if(c.recur==='once'){ const d=document.getElementById('crdDate'); if(d&&d.value){ c.date=d.value; c.day=(new Date(d.value+'T00:00:00').getDay()+6)%7; } }
      else { const dd=document.getElementById('crdDay'); if(dd) c.day=+dd.value; c.date=null; }
      if(window.PF?.user && window.__pf_clubId && PF.saveCreneau && typeof c.id==='string' && c.id.length>20){
        PF.saveCreneau({ id:c.id, club_id:window.__pf_clubId, disc:c.disc, title:c.title, day:c.day, time:c.time,
          dur:c.dur, place:c.place, cap:c.cap, coach:c.coach, price:c.price,
          description:c.desc||'', group_id:c.group||null, recur:c.recur||'weekly', date:c.date||null })
          .catch(e=>console.warn('[PF] saveCreneau', e));
      }
      document.getElementById('crDetailOverlay').classList.remove('open');
      renderCreneaux(); renderClubStats();
      toast(tr('toast.creneauMisAJour'));
    };
  }
}
document.getElementById('crdClose').onclick=()=>document.getElementById('crDetailOverlay').classList.remove('open');
document.getElementById('crDetailOverlay').addEventListener('click',e=>{ if(e.target.id==='crDetailOverlay') e.target.classList.remove('open'); });
document.querySelectorAll('#crdTabs .crd-tab').forEach(b=>b.onclick=()=>{ crdTab=b.dataset.t; renderCreneauDetail(); });

// création de créneau
const creneauOverlay=document.getElementById('creneauOverlay');
document.getElementById('clubAddCreneau').onclick=()=>{
  const sel=document.getElementById('crDay'); sel.innerHTML=CLUB_DAYS.map((d,i)=>`<option value="${i}">${d}</option>`).join('');
  document.getElementById('crGroup').innerHTML='<option value="">Tout le club</option>'+CLUB_GROUPS.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
  creneauOverlay.classList.add('open');
};
document.getElementById('creneauClose').onclick=()=> creneauOverlay.classList.remove('open');
creneauOverlay.addEventListener('click', e=>{ if(e.target===creneauOverlay) creneauOverlay.classList.remove('open'); });
document.getElementById('crSave').onclick=()=>{
  // title/place/coach/desc échappés à la saisie : renderCreneaux() les
  // interpole ensuite tels quels dans du innerHTML (écriture optimiste
  // locale, avant tout aller-retour DB).
  const c={
    id:'c'+Date.now(),
    disc:document.getElementById('crDisc').value,
    title:dispoSafe(document.getElementById('crTitle').value||'Créneau collectif'),
    day:+document.getElementById('crDay').value,
    time:document.getElementById('crTime').value,
    dur:+document.getElementById('crDur').value,
    place:dispoSafe(document.getElementById('crPlace').value||'À définir'),
    cap:+document.getElementById('crCap').value,
    coach:dispoSafe(document.getElementById('crCoach').value||'Coach'),
    price:+document.getElementById('crPrice').value,
    desc:dispoSafe(document.getElementById('crDesc').value.trim()),
    group:document.getElementById('crGroup').value||null,
    invited:[],
    attendees:[]
  };
  // « Inviter tout le groupe » : les membres du groupe sont pré-invités,
  // ils n'ont plus qu'à confirmer leur présence sur la carte du créneau
  if(c.group && document.getElementById('crInviteGroup').checked){
    c.invited = CLUB_ATHLETES.filter(a=>a.group===c.group).map(a=>a.id);
  }
  CRENEAUX.push(c);
  // Persistance backend (si connecté à un club) — récupère l'id DB.
  if(window.PF?.user && window.__pf_clubId){
    PF.saveCreneau({ club_id:window.__pf_clubId, disc:c.disc, title:c.title, day:c.day,
      time:c.time, dur:c.dur, place:c.place, cap:c.cap, coach:c.coach, price:c.price,
      description:c.desc||'', group_id:c.group||null })
      .then(saved=>{ if(saved) c.id = saved.id; })
      .catch(e=> console.warn('[PF] saveCreneau échoué :', e));
  }
  creneauOverlay.classList.remove('open');
  clubView='creneaux'; switchClubView(); renderClubStats();
  toast(tr('toast.creneauPublieAthletesPeuventS'));
};
function renderClub(){
  renderClubStats();
  switchClubView();
}

renderSidebar();
render();
updateVideolibVisibility();
if(typeof SillanceTour!=='undefined') SillanceTour.init();

/* ---- Hook d'intégration backend (Sillance cloud) — non destructif ----
   Expose les globales et les fonctions de rendu pour que la couche
   d'intégration (sillance-integration.js) puisse hydrater l'app depuis
   Supabase. Si rien ne se connecte, ce hook ne fait rien et l'app reste
   en mode démo avec ses données en dur. ------------------------------- */
window.__pf_app = {
  data: { RECORDS, checkin, planning, ATHLETE_REF, CLUB_ATHLETES, CLUB_GROUPS, CRENEAUX, VIDEOS },
  render, renderSidebar, renderClub, updateVideolibVisibility,
  refreshDevices: refreshDeviceState,
  getMode(){ return mode; },
  setMode(m){ mode = m; },
  replaceArray(arr, items){ arr.length = 0; for(const x of items) arr.push(x); },
  assignObj(obj, src){ for(const k in src){ if(src[k]!==undefined && src[k]!==null) obj[k]=src[k]; } },
  clearObj(obj){ for(const k of Object.keys(obj)) delete obj[k]; },
  // Remplace le matériel (démo → réel Supabase) et redessine la section.
  setGear(items){ if(typeof GEAR!=='undefined'){ GEAR = items.slice(); renderGear(); } },
  // Roster d'athlètes du coach (sélecteur "planifier pour") + athlète courant.
  setCoachAthletes,
  getCurrentAthleteId(){ return currentAthleteId; },
  // Masque l'analyse/records de démo pour un compte confirmé sans activité réelle.
  setActivityState,
  // Injecte les débriefs de course d'un athlète (chargés du cloud) — sert la
  // vue Athlète (soi-même, à l'hydratation) et redessine la sidebar.
  setRaceDebriefs(athleteId, list){
    if(!athleteId) return;
    RACE_DEBRIEFS[athleteId] = list||[];
    if(typeof renderSidebar==='function') renderSidebar();
  },
  // Injecte l'équipe de coachs + les demandes en attente d'un athlète.
  setCoTeam(athleteId, team, pending){
    if(!athleteId) return;
    CO_TEAM[athleteId] = (team||[]).map(t=>({ id:t.id, coachId:t.coach_id, roleLabel:t.role_label, coach:t.coach }));
    CO_PENDING[athleteId] = (pending||[]).map(p=>({ id:p.id, coachEmail:p.coach_email, roleLabel:p.role_label, requestedByRole:p.requested_by_role }));
    if(typeof renderSidebar==='function') renderSidebar();
  },
  // Injecte les zones de travail perso d'un athlète (chargées du cloud).
  setAthleteZones(athleteId, zones){
    if(!athleteId) return;
    if(zones && Object.keys(zones).length) CUSTOM_ZONES[athleteId] = zones;
    else delete CUSTOM_ZONES[athleteId];
    if(typeof renderBlocks==='function' && typeof builderState!=='undefined' && builderState && document.getElementById('bBlocks') && document.getElementById('bBlocks').children.length) renderBlocks();
  },
};

/* ============================================================
   MESSAGERIE coach ↔ athlète + lien WhatsApp
   ------------------------------------------------------------
   Chat interne (démo, en mémoire) + bouton "Ouvrir dans WhatsApp"
   qui pré-remplit un message via le lien officiel wa.me (gratuit,
   sans API ni serveur). Backend : remplacer CHAT_MSGS par de vrais
   messages persistés ; brancher l'API WhatsApp Business pour des
   envois automatiques.
   ============================================================ */
const ATHLETE_PHONE = '33600000000'; // numéro athlète, format international SANS +, à renseigner
let CHAT_MSGS = [
  {from:'them', text:'Salut coach ! Prêt pour la semaine', t:'08:12'},
  {from:'me',   text:'Yes ! Belle séance de seuil prévue demain.', t:'08:15'}
];
const QUICK_COACH_DEFAULT = ['Repose-toi aujourd\'hui','Allège la séance du jour','Bravo pour la séance !','On décale à demain ?','Hydrate-toi bien'];
const QUICK_ATHLETE = ['Bien récupéré','Jambes fatiguées aujourd\'hui','Séance validée','Une question sur la séance ?'];
/* Réponses rapides du coach — personnalisables, persistées en local.
   Le chip "Gérer" ouvre un éditeur texte simple (une réponse par ligne)
   plutôt qu'une UI dédiée : rapide à livrer, suffisant pour un coach qui
   gère 20-30 athlètes au clavier. */
let CHAT_MACROS = (()=>{ try{ const s=JSON.parse(localStorage.getItem('sil_chat_macros')||'null'); return (Array.isArray(s)&&s.length) ? s : QUICK_COACH_DEFAULT.slice(); }catch(e){ return QUICK_COACH_DEFAULT.slice(); } })();
function manageChatMacros(){
  const next = prompt('Tes réponses rapides (une par ligne) :', CHAT_MACROS.join('\n'));
  if(next==null) return;
  // Échappé à la saisie : rendu ensuite en boutons via innerHTML sans
  // ré-échapper (`<button>${x}</button>`).
  CHAT_MACROS = next.split('\n').map(s=>dispoSafe(s.trim())).filter(Boolean).slice(0,8);
  localStorage.setItem('sil_chat_macros', JSON.stringify(CHAT_MACROS));
  renderChat();
}

const chatPanel=document.getElementById('chatPanel');
const chatBody=document.getElementById('chatBody');
function nowHM(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function renderChat(){
  chatBody.innerHTML = `<div class="chat-day">Aujourd'hui</div>` + CHAT_MSGS.map(m=>
    `<div class="chat-msg ${m.from}">${m.text}<span class="time">${m.t}</span></div>`).join('');
  chatBody.scrollTop = chatBody.scrollHeight;
  const quick = (mode==='coach') ? CHAT_MACROS : QUICK_ATHLETE;
  const q=document.getElementById('chatQuick');
  q.innerHTML = quick.map(x=>`<button>${x}</button>`).join('') + (mode==='coach' ? `<button id="chatMacroManage" title="Personnaliser tes réponses rapides"><i class="ic ic-edit"></i> Gérer</button>` : '');
  q.querySelectorAll('button').forEach((b,i)=>{ if(b.id==='chatMacroManage') b.onclick=manageChatMacros; else b.onclick=()=> sendChat(quick[i]); });
  document.getElementById('chatPeerName').textContent = (mode==='coach')?'Romain D.':'Coach';
  document.getElementById('chatAvatar').textContent = (mode==='coach')?'RD':'CO';
}
function sendChat(text){
  text=(text||'').trim(); if(!text) return;
  // Échappé à la saisie : renderChat() interpole m.text tel quel dans du
  // innerHTML, sans ré-échapper (écriture optimiste locale, chat 100% front).
  CHAT_MSGS.push({from:'me', text:dispoSafe(text), t:nowHM()});
  document.getElementById('chatText').value=''; renderChat();
  setTimeout(()=>{ CHAT_MSGS.push({from:'them', text:'Bien reçu, merci coach !', t:nowHM()}); renderChat(); }, 1400);
}
function openChat(prefill){
  chatPanel.classList.add('open'); renderChat();
  document.getElementById('chatFabBadge').hidden=true;
  if(prefill){ document.getElementById('chatText').value=prefill; document.getElementById('chatText').focus(); }
}
document.getElementById('chatFab').onclick=()=>{ chatPanel.classList.contains('open')?chatPanel.classList.remove('open'):openChat(); };
document.getElementById('chatClose').onclick=()=> chatPanel.classList.remove('open');
document.getElementById('chatSend').onclick=()=> sendChat(document.getElementById('chatText').value);
document.getElementById('chatText').addEventListener('keydown', e=>{ if(e.key==='Enter') sendChat(e.target.value); });
document.getElementById('chatWhatsapp').onclick=()=>{
  const draft = document.getElementById('chatText').value.trim()
    || 'Salut ! Vu ton check-in de ce matin : je te conseille du repos aujourd\'hui. On en parle ?';
  window.open(`https://wa.me/${ATHLETE_PHONE}?text=${encodeURIComponent(draft)}`, '_blank');
};

/* ============================================================
   ACCESSIBILITÉ — daltonisme, motifs, contraste (en 1 clic)
   ============================================================ */
const a11yBtn = document.getElementById('a11yBtn');
const a11yMenu = document.getElementById('a11yMenu');
a11yBtn.addEventListener('click', e=>{ e.stopPropagation(); a11yMenu.classList.toggle('open'); });
document.addEventListener('click', e=>{ if(!a11yMenu.contains(e.target) && e.target!==a11yBtn) a11yMenu.classList.remove('open'); });

// choix de palette daltonienne
a11yMenu.querySelectorAll('.a11y-opt').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    a11yMenu.querySelectorAll('.a11y-opt').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-checked','false');});
    btn.classList.add('active'); btn.setAttribute('aria-checked','true');
    const v = btn.dataset.cvd;
    if(v==='none') document.body.removeAttribute('data-cvd');
    else document.body.setAttribute('data-cvd', v);
    redrawAllCharts();   // les graphiques à couleurs figées sont redessinés
  });
});
// motifs
const patBtn = document.getElementById('a11yPatterns');
patBtn.addEventListener('click', ()=>{
  const on = patBtn.getAttribute('aria-checked')==='true';
  patBtn.setAttribute('aria-checked', String(!on));
  if(on) document.body.removeAttribute('data-patterns');
  else document.body.setAttribute('data-patterns','1');
});
// contraste
const conBtn = document.getElementById('a11yContrast');
conBtn.addEventListener('click', ()=>{
  const on = conBtn.getAttribute('aria-checked')==='true';
  conBtn.setAttribute('aria-checked', String(!on));
  if(on) document.body.removeAttribute('data-contrast');
  else document.body.setAttribute('data-contrast','1');
});

/* Redessine les graphiques dont les couleurs sont figées en hex,
   en lisant les couleurs courantes depuis les variables CSS. */
function cssVar(name){ return getComputedStyle(document.body).getPropertyValue(name).trim(); }
function redrawAllCharts(){
  // les fonctions de tracé lisent STRAVA_DEMO ; on met à jour les hex des zones FC et lactate
  const map = {'#39E6A3':'--good','#2FD9FF':'--swim','#9D7BFF':'--strength','#FFB13D':'--bike','#FF5470':'--run'};
  // hrZones
  STRAVA_DEMO.hrZones.forEach((z,i)=>{
    const base=['--good','--swim','--strength','--bike','--run'][i];
    z.c = cssVar(base) || z.c;
  });
  try{ rebuildCharts(); }catch(e){}
}

/* ---- zones personnelles ---- */
const ZONES = [
  {z:'Z1 Endurance', c:'#39E6A3', fc:'< 145 bpm',   run:"5'00\"–4'10\"/km", bike:'< 240 W'},
  {z:'Z2 LT1',       c:'#2FD9FF', fc:'145–160 bpm', run:"4'10\"–3'50\"/km", bike:'240–255 W'},
  {z:'Z3 Tempo',     c:'#9D7BFF', fc:'160–170 bpm', run:"3'50\"–3'35\"/km", bike:'255–265 W'},
  {z:'Z4 LT2 Seuil', c:'#FFB13D', fc:'170–178 bpm', run:"3'35\"–3'25\"/km", bike:'265–275 W'},
  {z:'Z5 VO2max',    c:'#FF5470', fc:'> 178 bpm',   run:"3'20\"–3'00\"/km", bike:'> 275 W'}
];
(function zonesTable(){
  const g = document.getElementById('zonesGrid');
  if(!g) return;
  g.innerHTML = `<div class="zh">Zone</div><div class="zh">FC</div><div class="zh">Allure course</div><div class="zh">Puissance vélo</div>` +
    ZONES.map(z=>`
      <div class="zn"><i style="background:${z.c}"></i>${z.z}</div>
      <div class="zv">${z.fc}</div><div class="zv">${z.run}</div><div class="zv">${z.bike}</div>`).join('');
})();

/* ============================================================
   BIBLIOTHÈQUE VIDÉO — rendu, filtres, lecteur, popover
   ============================================================ */
let vlFilter='swim', vlQuery='';
function renderVideoGrid(){
  const grid=document.getElementById('vlGrid');
  if(!grid) return;
  const q=vlQuery.trim().toLowerCase();
  const list=VIDEOS.filter(v=>{
    const okF = vlFilter==='all' || v.disc===vlFilter;
    const okQ = !q || (v.title+' '+v.desc+' '+v.tags.join(' ')).toLowerCase().includes(q);
    return okF && okQ;
  });
  // numéral (data set large) : nombre de vidéos du sport filtré
  const cEl=document.getElementById('vlCount'), dEl=document.getElementById('vlCountDisc');
  if(cEl) cEl.textContent=String(list.length).padStart(2,'0');
  if(dEl) dEl.textContent=(DISC[vlFilter]&&DISC[vlFilter].label)||'Toutes';
  if(window.__pf_vlOptical) window.__pf_vlOptical();
  if(!list.length){ grid.innerHTML=`<div class="vl-empty">Aucune vidéo ne correspond. Essaie un autre mot-clé.</div>`; return; }
  grid.innerHTML=list.map(v=>{
    const D=DISC[v.disc];
    const locked = v.premium && !window.__pf_subscribed;
    return `<div class="vcard${locked?' vlocked':''}" data-id="${v.id}" style="--c:${D.color}">
      <div class="thumb"><span class="disc">${discIcon(D)}</span><span class="play"></span><span class="dur">${v.dur}</span>${locked?'<span class="vlock"><i class="ic ic-lock"></i> Premium</span>':''}</div>
      <div class="vbody">
        <div class="vt">${v.title}</div>
        <div class="vmeta"><span class="lvl">${v.level}</span><span>${D.label}</span></div>
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.vcard').forEach(c=>{
    c.addEventListener('click', ()=> openVideo(VIDEOS.find(v=>v.id===c.dataset.id)));
  });
}
// filtres
document.querySelectorAll('.vl-filter').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.vl-filter').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-selected','false');});
    b.classList.add('active'); b.setAttribute('aria-selected','true');
    vlFilter=b.dataset.f; renderVideoGrid();
  });
});
document.getElementById('vlSearch').addEventListener('input', e=>{ vlQuery=e.target.value; renderVideoGrid(); });
/* ---- Müller-Brockmann : overlay de grille (même boîte que le contenu) + alignement optique ----
   Colonnes numérotées qui PROUVENT que les cartes tombent sur les lignes ;
   le numéral (display) est nudgé pour que son ENCRE soit sur la ligne, pas sa boîte. */
(function(){
  const cols=document.getElementById('vlCols');
  if(cols && !cols.children.length){
    const n=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--v-cols'))||12;
    for(let i=1;i<=n;i++){ const c=document.createElement('div'); c.className='vg-col';
      const s=document.createElement('span'); s.textContent=i; c.appendChild(s); cols.appendChild(c); }
  }
  // toggle GLOBAL de la grille : un seul état body.grid-on pilote tous les overlays
  // (bibliothèque + calendrier + sections à venir). Bouton « Grille » + touche G.
  const tg=document.getElementById('vlGridToggle');
  function setGrid(on){ document.body.classList.toggle('grid-on',on); if(tg) tg.setAttribute('aria-pressed',on?'true':'false'); }
  if(tg) tg.addEventListener('click',function(){ setGrid(!document.body.classList.contains('grid-on')); });
  document.addEventListener('keydown',function(e){
    if((e.key==='g'||e.key==='G')&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
      const t=e.target; if(t&&/^(input|textarea|select)$/i.test(t.tagName||'')) return;
      setGrid(!document.body.classList.contains('grid-on'));
    }
  });
  // colonnes de l'overlay calendrier (7 jours)
  const ccols=document.getElementById('calCols');
  if(ccols && !ccols.children.length){ for(let i=1;i<=7;i++){ const c=document.createElement('div'); c.className='cg-col';
    const s=document.createElement('span'); s.textContent=i; c.appendChild(s); ccols.appendChild(c); } }
  // alignement optique du numéral (Oswald, grande taille → side-bearing visible)
  const cvs=document.createElement('canvas'), ctx=cvs.getContext('2d');
  window.__pf_vlOptical=function(){
    document.querySelectorAll('.vl-count b').forEach(function(el){
      el.style.marginLeft='0px';
      const cs=getComputedStyle(el), ch=(el.textContent||'').trim().charAt(0); if(!ch) return;
      ctx.font=cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily; ctx.textAlign='left';
      const abl=ctx.measureText(ch).actualBoundingBoxLeft;
      if(isFinite(abl)&&Math.abs(abl)<24) el.style.marginLeft=abl.toFixed(2)+'px';
    });
  };
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(window.__pf_vlOptical);
  let t; window.addEventListener('resize',function(){clearTimeout(t);t=setTimeout(window.__pf_vlOptical,120);});
})();
renderVideoGrid();

// lecteur modal
const videoOverlay=document.getElementById('videoOverlay');
function openVideo(v){
  if(!v) return;
  // Gate premium : contenu payant verrouillé tant que l'utilisateur n'est pas abonné.
  if(v.premium && !window.__pf_subscribed){
    if(window.PF?.user){ toast(tr('toast.contenuPremiumRedirectionVersL')); PF.startCheckout('athlete').catch(e=>{ console.warn(e); toast(tr('toast.abonnementIndisponible'), 'error'); }); }
    else { toast(tr('toast.contenuPremiumReserveAbonnes')); }
    return;
  }
  const D=DISC[v.disc];
  document.getElementById('videoBadge').textContent=D.label;
  document.getElementById('videoBadge').style.background=D.color;
  document.getElementById('videoTitle').textContent=v.title;
  document.getElementById('videoDesc').textContent=v.desc;
  const frame=document.getElementById('videoFrame');
  if(v.src){
    // vidéo réelle (mp4 direct). Pour un embed YouTube/Vimeo, remplacer par une <iframe>.
    frame.innerHTML=`<video src="${v.src}" controls autoplay playsinline></video>`;
  } else {
    frame.innerHTML=`<div class="ph"><div class="pico"><i class="ic ic-film"></i></div>Emplacement vidéo — branche l'URL dans <b>VIDEOS</b><br><small>(mp4 hébergé, ou embed YouTube/Vimeo)</small></div>`;
  }
  videoOverlay.classList.add('open');
}
function closeVideo(){ videoOverlay.classList.remove('open'); document.getElementById('videoFrame').innerHTML=''; }
document.getElementById('videoClose').addEventListener('click', closeVideo);
videoOverlay.addEventListener('click', e=>{ if(e.target===videoOverlay) closeVideo(); });
document.getElementById('videoToLib').addEventListener('click', ()=>{
  closeVideo();
  document.getElementById('videolib').scrollIntoView({behavior:'smooth'});
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeVideo(); });

// popover de survol (preview)
const vpop=document.getElementById('vidPopover');
let vpopTimer=null;
function showVidPopover(e, v){
  const D=DISC[v.disc];
  vpop.style.setProperty('--vpc', D.color);
  document.getElementById('vpThumb').style.setProperty('--vpc', D.color);
  document.getElementById('vpTitle').textContent=v.title;
  document.getElementById('vpHint').textContent=`${v.dur} · clic pour ouvrir en grand`;
  vpop.classList.add('show'); vpop.setAttribute('aria-hidden','false');
  positionVidPopover(e);
}
function positionVidPopover(e){
  const pad=14, w=240, h=190;
  let x=e.clientX+pad, y=e.clientY+pad;
  if(x+w>window.innerWidth) x=e.clientX-w-pad;
  if(y+h>window.innerHeight) y=e.clientY-h-pad;
  vpop.style.left=x+'px'; vpop.style.top=y+'px';
}
function hideVidPopover(){ vpop.classList.remove('show'); vpop.setAttribute('aria-hidden','true'); }

/* relie le survol/clic des séances ayant une vidéo (appelé après chaque render) */
function wireSessionVideos(){
  document.querySelectorAll('.session.has-video').forEach(card=>{
    const v=VIDEOS.find(x=>x.id===card.dataset.video);
    if(!v) return;
    card.addEventListener('mouseenter', e=>{ vpopTimer=setTimeout(()=>showVidPopover(e,v),180); });
    card.addEventListener('mousemove', positionVidPopover);
    card.addEventListener('mouseleave', ()=>{ clearTimeout(vpopTimer); hideVidPopover(); });
  });
}

/* ============================================================
   ÉDITEUR DE SÉANCE — version riche (esprit iDO)
   ------------------------------------------------------------
   Structure : séance = liste de BLOCS.
   Un bloc a un nombre de SÉRIES (×N) et contient une ou plusieurs
   LIGNES (Échauffement / Exercice / Contre-effort / Récup / Retour).
   Chaque ligne : type, durée, et une intensité exprimée sur
   PLUSIEURS références simultanées (FC, puissance/VMA, RPE…).
   Blocs réordonnables (monter/descendre).
   ============================================================ */
let builderState = null;
let builderUid = 1;

const LINE_TYPES = {
  warmup:   {get l(){return tr('lineType.warmup')}, c:'#39E6A3'},
  exo:      {get l(){return tr('lineType.exo')},     c:'#FF5470'},
  contre:   {get l(){return tr('lineType.contre')},c:'#FFB13D'},
  recov:    {get l(){return tr('lineType.recov')},  c:'#2FD9FF'},
  cooldown: {get l(){return tr('lineType.cooldown')}, c:'#9D7BFF'}
};

/* références activables par sport (le coach coche celles qu'il veut voir) */
function refsForDisc(disc){
  const keys = Object.entries(INTENSITY_MODELS)
    .filter(([k,m])=> m.disc===disc || m.disc==='all').map(([k])=>k);
  // ajoute RPE comme référence universelle
  return [...keys, 'rpe'];
}
const REF_LABEL = {ftp:'% FTP', pma:'% PMA', cpBike:'% PCrit', vma:'% VMA', cv:'% VCrit',
  seuilRun:'% seuil', css:'% CSS', fc:'% FC max', rpe:'RPE'};

function defaultLine(type, disc){
  if(disc==='hyrox'){
    // ligne Hyrox : une station, sa cible (m ou reps) et un poids éventuel
    const st = HYROX_STATIONS[0];
    return {lid:'l'+(builderUid++), type:'station', dur:{h:0,m:0,s:0},
            station:st.key, target:st.def, weight:st.weighted?st.wDef:0};
  }
  const def = {bike:'ftp', run:'vma', swim:'css', strength:'fc'}[disc] || 'fc';
  const pct = {warmup:60, exo:95, contre:50, recov:50, cooldown:55}[type] ?? 70;
  // métrique par défaut : la natation se planifie en distance, les autres en temps
  const metric = (disc==='swim') ? 'dist' : 'time';
  const dist = (disc==='swim') ? (type==='warmup'?400:(type==='cooldown'?200:100)) : 1000;
  return {lid:'l'+(builderUid++), type, dur:{h:0,m:type==='warmup'?15:(type==='cooldown'?10:5),s:0},
          metric, dist,
          model:def, pct, rpe:rpeFromPct(pct),
          mode:'zone',          // 'zone' (% de référence) ou 'exact' (valeur absolue)
          exact:exactDefault(disc)};
}
/* ligne Hyrox d'une station précise */
function hyroxLine(stationKey){
  const st=hyroxStation(stationKey)||HYROX_STATIONS[0];
  return {lid:'l'+(builderUid++), type:'station', dur:{h:0,m:0,s:0},
          station:st.key, target:st.def, weight:st.weighted?st.wDef:0};
}
/* valeur exacte par défaut selon le sport */
function exactDefault(disc){
  if(disc==='bike') return {kind:'power', w:250, tol:10};            // watts ± tol
  if(disc==='run')  return {kind:'pace', m:4, s:30, tol:5};          // allure ± tol (s)
  if(disc==='swim') return {kind:'time100', m:1, s:30, tol:3};       // /100m ± tol (s)
  return {kind:'rpe', rpe:6, tol:0};
}
/* options de type de cible exacte par sport */
function exactKinds(disc){
  if(disc==='bike') return [['power','Watts'],['pace','Allure /km'],['speed','km/h'],['rpe','RPE (sans capteur)']];
  if(disc==='run')  return [['pace','Allure /km'],['speed','km/h'],['time','Temps total'],['rpe','RPE (sans capteur)']];
  if(disc==='swim') return [['time100','Temps /100m'],['pace','Allure /100m'],['time','Temps total'],['rpe','RPE (sans capteur)']];
  return [['rpe','RPE']];
}
function defaultBlockNew(disc){
  return {bid:'b'+(builderUid++), series:1, title:'', lines:[defaultLine('exo',disc)]};
}
function rpeFromPct(p){ return Math.max(1,Math.min(10, Math.round(p/12))); }

/* unité de la tolérance selon le type de cible */
function tolUnit(kind){
  if(kind==='power') return 'W';
  if(kind==='speed') return 'km/h';
  if(kind==='rpe') return 'pt';
  return 's'; // pace, time100, time : tolérance en secondes
}
/* formate une valeur "centrale ± tol" en plage lisible */
function exactToText(ex){
  if(!ex) return '';
  const tol = ex.tol||0;
  const fmtPace=(tot)=>{ tot=Math.max(0,Math.round(tot)); return Math.floor(tot/60)+"'"+String(tot%60).padStart(2,'0')+'"'; };
  switch(ex.kind){
    case 'power':{ const c=ex.w||0; return tol? `${c-tol}–${c+tol} W` : c+' W'; }
    case 'speed':{ const c=ex.kmh||0; const t=(tol||0); return t? `${(c-t).toFixed(1)}–${(c+t).toFixed(1)} km/h` : c+' km/h'; }
    case 'pace':{ const c=(ex.m||0)*60+(ex.s||0); const suf=(ex.per100?'/100m':'/km'); return tol? `${fmtPace(c-tol)}–${fmtPace(c+tol)}${suf}` : fmtPace(c)+suf; }
    case 'time100':{ const c=(ex.m||0)*60+(ex.s||0); return tol? `${fmtPace(c-tol)}–${fmtPace(c+tol)}/100m` : fmtPace(c)+'/100m'; }
    case 'time':{ const c=(ex.h||0)*3600+(ex.m||0)*60+(ex.s||0); const f=(s)=>{ s=Math.max(0,Math.round(s)); const h=Math.floor(s/3600); const r=s%3600; return (h?h+'h':'')+Math.floor(r/60)+"'"+String(r%60).padStart(2,'0')+'"'; }; return tol? `${f(c-tol)}–${f(c+tol)}` : f(c); }
    case 'rpe':   return 'RPE '+(ex.rpe||6);
  }
  return '';
}

function openBuilder(dateKey, existing){
  const disc = existing?.disc || 'bike';
  if(existing && existing.blocksV2){
    builderState = JSON.parse(JSON.stringify(existing.blocksV2));
    builderState.targetDate = dateKey || null;
  } else {
    builderState = {
      title: existing?.title||'', disc,
      activeRefs: defaultActiveRefs(disc),
      blocks: [
        {bid:'b'+(builderUid++), series:1, title:'Échauffement', lines:[defaultLine('warmup',disc)]},
        {bid:'b'+(builderUid++), series:5, title:'', lines:[defaultLine('exo',disc), defaultLine('contre',disc)]},
        {bid:'b'+(builderUid++), series:1, title:'Retour au calme', lines:[defaultLine('cooldown',disc)]}
      ],
      targetDate: dateKey||null
    };
  }
  // objectif de séance (pour l'analyse IA) — normalisé en chaîne "type|zone"
  if(builderState.objectif && typeof builderState.objectif==='object'){ builderState.objectif = builderState.objectif.type ? builderState.objectif.type+'|'+builderState.objectif.zone : ''; }
  if(builderState.objectif==null) builderState.objectif = (existing&&existing.objectif&&existing.objectif.type) ? existing.objectif.type+'|'+existing.objectif.zone : '';
  document.getElementById('bTitle').value = builderState.title||'';
  document.getElementById('bObjectif').value = builderState.objectif||'';
  document.getElementById('builderBadge').textContent = existing ? 'Modifier la séance' : 'Nouvelle séance';
  document.getElementById('bDiscPick').value = builderState.disc;
  renderRefs();
  renderBlocks();
  initBuilderNutrition(existing);
  document.getElementById('builderOverlay').classList.add('open');
}
function defaultActiveRefs(disc){
  const m = {bike:['ftp','fc','rpe'], run:['vma','fc','rpe'], swim:['css','rpe'], strength:['fc','rpe']}[disc];
  return m || ['fc','rpe'];
}
function closeBuilder(){ document.getElementById('builderOverlay').classList.remove('open'); }

/* — sélecteur de références multiples — */
function renderRefs(){
  const wrap=document.getElementById('bRefs');
  const row=wrap.closest('.b-refs-row');
  if(builderState.disc==='hyrox'){ if(row) row.style.display='none'; wrap.innerHTML=''; return; }
  if(row) row.style.display='';
  const rpeOnly = builderState.activeRefs.length===1 && builderState.activeRefs[0]==='rpe';
  wrap.innerHTML = refsForDisc(builderState.disc).map(k=>
    `<span class="b-ref-chip ${builderState.activeRefs.includes(k)?'on':''}" data-ref="${k}">${REF_LABEL[k]}</span>`
  ).join('') + `<span class="b-ref-chip nosensor ${rpeOnly?'on':''}" id="bNoSensor" title="Athlète sans montre GPS ni capteur : toutes les cibles passent en ressenti RPE 1-10">⌚ Sans capteur — tout en RPE</span>`;
  wrap.querySelectorAll('.b-ref-chip').forEach(ch=>{
    ch.onclick=()=>{
      const k=ch.dataset.ref;
      const i=builderState.activeRefs.indexOf(k);
      if(i>-1){ if(builderState.activeRefs.length>1) builderState.activeRefs.splice(i,1); }
      else builderState.activeRefs.push(k);
      renderRefs(); renderBlocks();
    };
  });
  const ns=document.getElementById('bNoSensor');
  if(ns) ns.onclick=()=>{
    const on = !(builderState.activeRefs.length===1 && builderState.activeRefs[0]==='rpe');
    if(on){
      // toute la séance en RPE : références réduites à RPE et chaque ligne en cible exacte RPE
      builderState.activeRefs=['rpe'];
      builderState.blocks.forEach(blk=>blk.lines.forEach(ln=>{
        if(ln.type==='station') return;
        ln.mode='exact';
        ln.exact={kind:'rpe', rpe: ln.exact&&ln.exact.kind==='rpe'?(ln.exact.rpe||ln.rpe||6):(ln.rpe||rpeFromPct(ln.pct||70)), tol:0};
      }));
      toast(tr('toast.seanceEnRpeUniquementParfaite'));
    } else {
      builderState.activeRefs=defaultActiveRefs(builderState.disc);
      builderState.blocks.forEach(blk=>blk.lines.forEach(ln=>{ if(ln.type!=='station') ln.mode='zone'; }));
      toast(tr('toast.retourReferencesFtpVmaCss'));
    }
    renderRefs(); renderBlocks();
  };
}

/* — rendu des blocs — */
function renderBlocks(){
  const wrap=document.getElementById('bBlocks');
  wrap.innerHTML = builderState.blocks.map((blk,bi)=>{
    const lines = blk.lines.map(ln=> lineHTML(blk,ln)).join('');
    return `<div class="bk" data-bid="${blk.bid}">
      <div class="bk-head">
        <div class="bk-move">
          <button data-mv="up" ${bi===0?'disabled style=opacity:.3':''} aria-label="Monter">▲</button>
          <button data-mv="down" ${bi===builderState.blocks.length-1?'disabled style=opacity:.3':''} aria-label="Descendre">▼</button>
        </div>
        <div class="bk-series"><span class="x">×</span><input type="number" min="1" max="40" value="${blk.series}" data-f="series"><small>série${blk.series>1?'s':''}</small></div>
        <input class="bk-title-in" placeholder="Titre du bloc (optionnel)" value="${blk.title||''}" data-f="btitle">
        <div class="bk-tools">
          <button data-act="dup" title="Dupliquer">⧉</button>
          <button class="del" data-act="delblock" title="Supprimer"><i class="ic ic-x"></i></button>
        </div>
      </div>
      <div class="bk-lines">${lines}</div>
      <div class="bk-addline">
        ${builderState.disc==='hyrox'
          ? `<button data-addstation="">+ Ajouter une station</button>` + HYROX_STATIONS.map(s=>`<button data-addstation="${s.key}">${s.name}</button>`).join('')
          : `<button data-add="warmup">+ Échauffement</button>
             <button data-add="exo">+ Exercice</button>
             <button data-add="contre">+ Contre-effort</button>
             <button data-add="recov">+ Récup</button>
             <button data-add="cooldown">+ Retour</button>`}
      </div>
    </div>`;
  }).join('');
  wireBlocks();
  updateBuilderSummary();
}

/* bouton commentaire + suppression, et la rangée de note repliable (coach).
   La note vit sur ln.note ; ln._noteOpen contrôle l'affichage pendant l'édition. */
function lnActionsHTML(ln, delLabel){
  // Le champ commentaire est TOUJOURS visible sous chaque intervalle (récup,
  // travail, repos…) — le coach peut y laisser une consigne pour l'athlète.
  return `<div class="ln-actions">
      <button class="ln-del" data-act="delline" aria-label="${delLabel}"><i class="ic ic-x"></i></button>
    </div>
    <div class="ln-note">
      <i class="ic ic-message-circle"></i>
      <input type="text" class="ln-note-in" data-f="note" placeholder="Commentaire pour l'athlète (facultatif)…" value="${dispoSafe(ln.note||'')}">
    </div>`;
}

function lineHTML(blk, ln){
  // ----- ligne HYROX (station) -----
  if(builderState.disc==='hyrox' || ln.type==='station'){
    const st = hyroxStation(ln.station) || HYROX_STATIONS[0];
    const unitLbl = st.unit==='m' ? 'm' : 'reps';
    const stationSel = HYROX_STATIONS.map(s=>`<option value="${s.key}" ${s.key===ln.station?'selected':''}>${s.name}</option>`).join('');
    const weightField = st.weighted
      ? `<div class="hx-weight"><input type="number" min="0" max="300" step="0.5" value="${ln.weight||0}" data-hx="weight"><span>kg</span></div>`
      : `<div class="hx-weight hx-noweight">— poids libre —</div>`;
    return `<div class="ln ln-hyrox" data-lid="${ln.lid}" style="--lc:${DISC.hyrox.color}">
      <span class="ln-grip">⠿</span>
      <select class="ln-type hx-station" data-hx="station">${stationSel}</select>
      <div class="hx-target">
        <input type="number" min="0" max="5000" value="${ln.target||0}" data-hx="target"><span>${unitLbl}</span>
      </div>
      ${weightField}
      ${lnActionsHTML(ln, 'Supprimer la station')}
    </div>`;
  }

  const T=LINE_TYPES[ln.type];
  const models = refsForDisc(builderState.disc).filter(k=>k!=='rpe');
  if(!ln.mode) ln.mode='zone';
  if(!ln.exact) ln.exact=exactDefault(builderState.disc);

  // bloc intensité : soit zone (%), soit exact
  let intHTML;
  if(ln.mode==='zone'){
    const targets = builderState.activeRefs.map(r=>{
      if(r==='rpe') return `<span class="rpe">RPE ${ln.rpe}</span>`;
      const tgt = computeTarget(r, ln.pct);
      return tgt? `<span>${tgt}</span>`:'';
    }).join('');
    const zn = zoneForPct(ln.model, ln.pct);
    // sélecteur de zone de travail (utilise les zones perso de l'athlète) :
    // choisir une zone place le % au milieu de sa plage
    const zList = zonesFor(ln.model);
    const zIdx = zList.findIndex(z=>z[0]===zn);
    const zCol = zIdx>=0 ? zoneColorAt(zIdx, zList.length) : 'var(--muted)';
    // zones perso compatibles avec la discipline de la séance (index d'origine gardé)
    const custZ = customZones().map((z,ci)=>({z,ci}))
      .filter(({z})=>{ const m=INTENSITY_MODELS[z.ref]; return m && (m.disc===builderState.disc || m.disc==='all'); });
    const zoneSel = `<select class="ln-zonesel" data-f="zonesel" style="--lz:${zCol}" title="Choisir la zone de travail">
        ${zList.map((z,i)=>`<option value="${i}" ${i===zIdx?'selected':''}>${dispoSafe(z[0])}</option>`).join('')}
        ${zIdx<0?`<option value="-1" selected>${zn||'—'}</option>`:''}
        ${custZ.length?`<optgroup label="Zones perso">${custZ.map(({z,ci})=>`<option value="c${ci}">${dispoSafe(z.name)} · ${REF_LABEL[z.ref]||z.ref}</option>`).join('')}</optgroup>`:''}
      </select>`;
    intHTML = `
      <div class="ln-zone-row">
        <select class="ln-zone" data-f="model" title="Référence de calcul">${models.map(k=>`<option value="${k}" ${k===ln.model?'selected':''}>${REF_LABEL[k]}</option>`).join('')}</select>
        <div class="ln-pct"><input type="range" min="40" max="130" value="${ln.pct}" data-f="pct"><input type="number" class="pvn" min="40" max="130" value="${ln.pct}" data-f="pctn" aria-label="Intensité en %"><span class="pv-unit">%</span></div>
      </div>
      <div class="ln-targets">${targets}${zoneSel}</div>`;
  } else {
    intHTML = `<div class="ln-exact">${exactInputsHTML(ln.exact)}</div>`;
  }

  // champ durée OU distance selon la métrique de la ligne
  const metric = ln.metric || 'time';
  const durField = metric==='dist'
    ? `<div class="ln-dur ln-metric"><button class="ln-mswitch" data-act="metricswitch" title="Basculer temps / distance">⇄</button><input type="number" min="0" max="10000" step="25" value="${ln.dist||0}" data-f="dist"><span>m</span></div>`
    : `<div class="ln-dur ln-metric"><button class="ln-mswitch" data-act="metricswitch" title="Basculer temps / distance">⇄</button><input type="number" min="0" max="59" value="${ln.dur.m}" data-f="durm"><span>min</span></div>`;

  return `<div class="ln" data-lid="${ln.lid}" style="--lc:${T.c}">
    <span class="ln-grip">⠿</span>
    <select class="ln-type" data-f="type">${Object.entries(LINE_TYPES).map(([k,v])=>`<option value="${k}" ${k===ln.type?'selected':''}>${v.l}</option>`).join('')}</select>
    ${durField}
    <div class="ln-int">
      <div class="ln-mode">
        <button class="${ln.mode==='zone'?'on':''}" data-mode="zone">Zone %</button>
        <button class="${ln.mode==='exact'?'on':''}" data-mode="exact">Exact</button>
      </div>
      ${intHTML}
    </div>
    ${lnActionsHTML(ln, 'Supprimer la ligne')}
  </div>`;
}

/* champs de saisie d'une cible exacte selon son kind */
function exactInputsHTML(ex){
  const kinds = exactKinds(builderState.disc);
  const sel = `<select class="ex-kind" data-x="kind">${kinds.map(([k,l])=>`<option value="${k}" ${k===ex.kind?'selected':''}>${l}</option>`).join('')}</select>`;
  let fields='';
  if(ex.kind==='power')   fields=`<input class="ex-n" type="number" min="0" max="600" value="${ex.w||0}" data-x="w"><span>W</span>`;
  else if(ex.kind==='speed') fields=`<input class="ex-n" type="number" min="0" max="60" step="0.1" value="${ex.kmh||0}" data-x="kmh"><span>km/h</span>`;
  else if(ex.kind==='pace')  fields=`<input class="ex-n2" type="number" min="0" max="20" value="${ex.m||0}" data-x="m"><span>'</span><input class="ex-n2" type="number" min="0" max="59" value="${ex.s||0}" data-x="s"><span>"${builderState.disc==='swim'?'/100m':'/km'}</span>`;
  else if(ex.kind==='time100') fields=`<input class="ex-n2" type="number" min="0" max="20" value="${ex.m||0}" data-x="m"><span>'</span><input class="ex-n2" type="number" min="0" max="59" value="${ex.s||0}" data-x="s"><span>"/100m</span>`;
  else if(ex.kind==='time')  fields=`<input class="ex-n2" type="number" min="0" max="9" value="${ex.h||0}" data-x="h"><span>h</span><input class="ex-n2" type="number" min="0" max="59" value="${ex.m||0}" data-x="m"><span>'</span><input class="ex-n2" type="number" min="0" max="59" value="${ex.s||0}" data-x="s"><span>"</span>`;
  else if(ex.kind==='rpe')   fields=`<input class="ex-n" type="number" min="1" max="10" value="${ex.rpe||6}" data-x="rpe"><span>RPE</span>`;
  const tolField = (ex.kind!=='rpe')
    ? `<span class="ex-tol">±<input class="ex-n2" type="number" min="0" max="120" value="${ex.tol||0}" data-x="tol"><small>${tolUnit(ex.kind)}</small></span>`
    : '';
  return `<div class="ex-row">${sel}<div class="ex-fields">${fields}</div>${tolField}<span class="ex-chip"><i class="ic ic-target"></i> ${exactToText(ex)}</span></div>`;
}

function wireBlocks(){
  const wrap=document.getElementById('bBlocks');
  wrap.querySelectorAll('.bk').forEach((bkEl,bi)=>{
    const blk=builderState.blocks[bi];
    // déplacement
    bkEl.querySelector('[data-mv="up"]').onclick=()=>{ if(bi>0){ [builderState.blocks[bi-1],builderState.blocks[bi]]=[builderState.blocks[bi],builderState.blocks[bi-1]]; renderBlocks(); } };
    bkEl.querySelector('[data-mv="down"]').onclick=()=>{ if(bi<builderState.blocks.length-1){ [builderState.blocks[bi+1],builderState.blocks[bi]]=[builderState.blocks[bi],builderState.blocks[bi+1]]; renderBlocks(); } };
    // séries + titre
    bkEl.querySelector('[data-f="series"]').oninput=e=>{ blk.series=Math.max(1,+e.target.value||1); updateBuilderSummary(); };
    bkEl.querySelector('[data-f="btitle"]').oninput=e=>{ blk.title=e.target.value; };
    // outils bloc
    bkEl.querySelector('[data-act="delblock"]').onclick=()=>{ if(builderState.blocks.length>1){ builderState.blocks=builderState.blocks.filter(x=>x.bid!==blk.bid); renderBlocks(); } };
    bkEl.querySelector('[data-act="dup"]').onclick=()=>{ const copy=JSON.parse(JSON.stringify(blk)); copy.bid='b'+(builderUid++); copy.lines.forEach(l=>l.lid='l'+(builderUid++)); builderState.blocks.splice(bi+1,0,copy); renderBlocks(); };
    // ajout de lignes (normal)
    bkEl.querySelectorAll('[data-add]').forEach(btn=> btn.onclick=()=>{ blk.lines.push(defaultLine(btn.dataset.add, builderState.disc)); renderBlocks(); });
    // ajout de stations Hyrox
    bkEl.querySelectorAll('[data-addstation]').forEach(btn=> btn.onclick=()=>{ blk.lines.push(hyroxLine(btn.dataset.addstation||undefined)); renderBlocks(); });
    // lignes
    bkEl.querySelectorAll('.ln').forEach(lnEl=>{
      const ln=blk.lines.find(x=>x.lid===lnEl.dataset.lid);
      lnEl.querySelector('[data-act="delline"]').onclick=()=>{ if(blk.lines.length>1){ blk.lines=blk.lines.filter(x=>x.lid!==ln.lid); renderBlocks(); } };
      // commentaire du coach : ouvre/ferme la note ; la saisie se lie à ln.note
      const cmt=lnEl.querySelector('[data-act="togglenote"]');
      if(cmt) cmt.onclick=()=>{
        const has=!!(ln.note && ln.note.trim());
        const open=(ln._noteOpen===undefined)?has:ln._noteOpen;
        ln._noteOpen=!open;   // montre/masque l'éditeur sans jamais effacer la note
        renderBlocks();
        if(ln._noteOpen){ const ta=document.querySelector(`.ln[data-lid="${ln.lid}"] [data-f="note"]`); if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); } }
      };
      const nta=lnEl.querySelector('[data-f="note"]');
      if(nta) nta.addEventListener('input', ()=>{ ln.note=nta.value; });
      // bascule temps ⇄ distance
      const msw=lnEl.querySelector('[data-act="metricswitch"]');
      if(msw) msw.onclick=()=>{ ln.metric = (ln.metric==='dist')?'time':'dist'; ln._metricTouched=true; renderBlocks(); };
      // champs Hyrox (station / cible / poids)
      lnEl.querySelectorAll('[data-hx]').forEach(inp=>{
        const f=inp.dataset.hx;
        const ev=(inp.tagName==='SELECT')?'change':'input';
        inp.addEventListener(ev,()=>{
          if(f==='station'){ ln.station=inp.value; const st=hyroxStation(inp.value); ln.target=st.def; ln.weight=st.weighted?st.wDef:0; renderBlocks(); }
          else if(f==='target'){ ln.target=+inp.value||0; updateBuilderSummary(); }
          else if(f==='weight'){ ln.weight=parseFloat(inp.value)||0; }
        });
      });
      // bascule Zone% / Exact
      lnEl.querySelectorAll('[data-mode]').forEach(btn=>{
        btn.onclick=()=>{
          ln.mode=btn.dataset.mode;
          if(ln.mode==='exact'){
            // (ré)initialise si la cible n'est pas valide pour ce sport
            const validKinds = exactKinds(builderState.disc).map(k=>k[0]);
            if(!ln.exact || !validKinds.includes(ln.exact.kind)) ln.exact=exactDefault(builderState.disc);
          }
          renderBlocks();
        };
      });
      // champs zone (select/range)
      lnEl.querySelectorAll('[data-f]').forEach(inp=>{
        const f=inp.dataset.f;
        const ev = (inp.tagName==='SELECT')?'change':'input';
        inp.addEventListener(ev,()=>{
          if(f==='type'){ ln.type=inp.value; renderBlocks(); }
          else if(f==='model'){ ln.model=inp.value; renderBlocks(); }
          else if(f==='pct'){
            // maj EN PLACE pendant le drag — re-render seulement au relâchement,
            // sinon le slider est détruit sous le doigt et le réglage fin est impossible
            ln.pct=+inp.value; ln.rpe=rpeFromPct(ln.pct);
            const nn=lnEl.querySelector('[data-f="pctn"]'); if(nn && document.activeElement!==nn) nn.value=ln.pct;
            updateBuilderSummary();
          }
          else if(f==='pctn'){
            ln.pct=Math.max(40,Math.min(130,+inp.value||40)); ln.rpe=rpeFromPct(ln.pct);
            const rg=lnEl.querySelector('[data-f="pct"]'); if(rg) rg.value=ln.pct;
            updateBuilderSummary();
          }
          else if(f==='durm'){ ln.dur.m=+inp.value; updateBuilderSummary(); }
          else if(f==='dist'){ ln.dist=+inp.value||0; updateBuilderSummary(); }
          else if(f==='zonesel'){
            const v=inp.value;
            if(v && v[0]==='c'){   // zone perso : change la référence + place le %
              const cz=customZones()[+v.slice(1)];
              if(cz){ ln.model=cz.ref; const mid=Math.round((cz.lo+cz.hi)/2); ln.pct=Math.max(40,Math.min(130,mid)); ln.rpe=rpeFromPct(ln.pct); renderBlocks(); }
            } else {
              const zList=zonesFor(ln.model); const z=zList[+v];
              if(z){ const mid=Math.round((z[1]+z[2])/2); ln.pct=Math.max(40,Math.min(130,mid)); ln.rpe=rpeFromPct(ln.pct); renderBlocks(); }
            }
          }
        });
        if(f==='pct'||f==='pctn') inp.addEventListener('change', ()=> renderBlocks());
      });
      // champs valeur exacte
      lnEl.querySelectorAll('[data-x]').forEach(inp=>{
        const x=inp.dataset.x;
        const ev=(inp.tagName==='SELECT')?'change':'input';
        inp.addEventListener(ev,()=>{
          if(x==='kind'){ // changer de type de cible exacte → réinitialise proprement
            const k=inp.value;
            ln.exact = resetExact(k);
            renderBlocks();
          } else {
            ln.exact[x] = (x==='kmh' || (x==='tol' && ln.exact.kind==='speed'))? (parseFloat(inp.value)||0) : (+inp.value||0);
            // met à jour juste le chip sans tout re-render (garde le focus)
            const chip=lnEl.querySelector('.ex-chip');
            if(chip) chip.textContent=exactToText(ln.exact);
            updateBuilderSummary();
          }
        });
      });
    });
  });
}
function resetExact(kind){
  switch(kind){
    case 'power': return {kind, w:250, tol:10};
    case 'speed': return {kind, kmh:18, tol:0.5};
    case 'pace': return {kind, m:4, s:30, tol:5};
    case 'time100': return {kind, m:1, s:30, tol:3};
    case 'time': return {kind, h:0, m:30, s:0, tol:0};
    case 'rpe': return {kind, rpe:6, tol:0};
    default: return {kind, w:250, tol:10};
  }
}

function zoneForPct(modelKey, pct){
  const m = INTENSITY_MODELS[modelKey]; if(!m) return '';
  const zones = zonesFor(modelKey);   // perso athlète si défini, sinon défaut
  for(const z of zones){ const [name,a,bnd]=z; const lo=Math.min(a,bnd),hi=Math.max(a,bnd); if(pct>=lo&&pct<=hi) return name; }
  return pct>110?'au-dessus':'';
}
function lineMinutes(ln){
  // ligne en distance : on estime la durée à partir de l'allure/vitesse cible
  if(ln.metric==='dist'){
    const m = ln.dist||0;
    let kmh = estimateLineSpeed(ln);      // km/h estimée
    if(!kmh || kmh<=0) kmh = 10;
    return (m/1000) / kmh * 60;            // minutes
  }
  return (ln.dur.h||0)*60 + (ln.dur.m||0) + (ln.dur.s||0)/60;
}
/* vitesse estimée (km/h) d'une ligne, pour convertir distance → durée */
function estimateLineSpeed(ln){
  const disc=builderState.disc;
  if(ln.mode==='exact' && ln.exact){
    const ex=ln.exact;
    if(ex.kind==='speed') return ex.kmh||0;
    if(ex.kind==='pace'){ const sPerKm=(ex.m||0)*60+(ex.s||0); return sPerKm? 3600/sPerKm : 0; }
    if(ex.kind==='time100'){ const s=(ex.m||0)*60+(ex.s||0); return s? (0.1/(s/3600)) : 0; } // /100m → km/h
    if(ex.kind==='power') return disc==='bike' && ATHLETE_REF.vma ? 30 : 28; // approx vélo
  }
  // mode zone : on déduit de la référence VMA/CV et du %
  if(disc==='swim'){ const cvKmh = ATHLETE_REF.cv? (0.1/(ATHLETE_REF.cv/3600)) : 4.5; return cvKmh*(ln.pct/100); }
  if(disc==='run'){ return (ATHLETE_REF.vma||16)*(ln.pct/100); }
  if(disc==='bike'){ return 32*(ln.pct/100); }
  return 12*(ln.pct/100);
}
function estimateLineTss(ln, disc){
  let pct = ln.pct;
  if(ln.mode==='exact' && ln.exact){
    // déduit une intensité relative approchée depuis la valeur absolue
    const ex=ln.exact;
    if(ex.kind==='power') pct = ATHLETE_REF.ftp? (ex.w/ATHLETE_REF.ftp*100):95;
    else if(ex.kind==='speed') pct = ATHLETE_REF.vma? (ex.kmh/ATHLETE_REF.vma*100):85;
    else if(ex.kind==='pace'){ const v=3600/((ex.m||0)*60+(ex.s||0)); pct = ATHLETE_REF.vma? (v/ATHLETE_REF.vma*100):85; }
    else if(ex.kind==='rpe') pct = (ex.rpe||6)*12;
    else pct = 85;
  }
  const ir=Math.min(1.4, pct/100*(disc==='swim'?0.95:1));
  return lineMinutes(ln)/60*ir*ir*100;
}
function builderTotals(){
  let min=0, tss=0;
  builderState.blocks.forEach(blk=>{
    const blkMin=blk.lines.reduce((a,l)=>a+lineMinutes(l),0);
    const blkTss=blk.lines.reduce((a,l)=>a+estimateLineTss(l,builderState.disc),0);
    min+=blkMin*blk.series; tss+=blkTss*blk.series;
  });
  return {min:Math.round(min), tss:Math.round(tss)};
}
function updateBuilderSummary(){
  const {min,tss}=builderTotals();
  const nbBlocks=builderState.blocks.length;
  const nbLines=builderState.blocks.reduce((a,b)=>a+b.lines.length*b.series,0);
  document.getElementById('bSummary').innerHTML=`<b>${fmtDur(min)}</b> total · <b>${tss}</b> TSS estimé · ${nbBlocks} bloc${nbBlocks>1?'s':''} · ${nbLines} intervalles`;
}

function builderToText(){
  return builderState.blocks.map(blk=>{
    const head = (blk.series>1?`${blk.series}× `:'') + (blk.title?blk.title+' : ':'');
    const lines = blk.lines.map(ln=>{
      if(ln.type==='station'){
        const st=hyroxStation(ln.station)||HYROX_STATIONS[0];
        const tgt = st.unit==='m' ? `${ln.target} m` : `${ln.target} reps`;
        const w = (st.weighted && ln.weight) ? ` @ ${ln.weight} kg` : '';
        return `${st.name} — ${tgt}${w}`;
      }
      const T=LINE_TYPES[ln.type];
      const tgts = (ln.mode==='exact')
        ? exactToText(ln.exact)
        : builderState.activeRefs.map(r=> r==='rpe'?`RPE ${ln.rpe}`:computeTarget(r,ln.pct)).filter(Boolean).join(' · ');
      const amount = (ln.metric==='dist') ? `${ln.dist} m` : `${ln.dur.m}'`;
      return `${T.l} ${amount} → ${tgts}`;
    }).join(builderState.disc==='hyrox' ? ' + ' : ' + ');
    return head + lines;
  }).join('\n');
}
function builderToSession(){
  const {min,tss}=builderTotals();
  // zone de la séance = la plus haute atteinte par un intervalle "exo"
  // (des intervalles Z5 dans la séance → séance classée Z5)
  let zMax=0;
  builderState.blocks.forEach(blk=>blk.lines.forEach(ln=>{
    if(ln.type==='exo') zMax=Math.max(zMax, zoneFromPct(profLinePct(ln)));
    else if(ln.type==='station') zMax=Math.max(zMax, 4);
  }));
  const domZone = zMax ? 'Z'+zMax : 'Z2';
  // nutrition : valeurs saisies par le coach (ou auto si laissé vide)
  const pre=document.getElementById('bNutriPre').value.trim();
  const post=document.getElementById('bNutriPost').value.trim();
  const s={
    disc: builderState.disc,
    title: builderState.title || document.getElementById('bTitle').value || 'Séance personnalisée',
    dur: min, tss, zone: domZone,
    desc: builderToText(),
    objectif: builderState.objectif ? {type:builderState.objectif.split('|')[0], zone:builderState.objectif.split('|')[1]} : null,
    blocksV2: JSON.parse(JSON.stringify(builderState)),
    done:false, id:'s'+(uid++)
  };
  if(pre||post){ s.nutrition = {pre, post, during:'', key: detectNutriKey(s)}; }
  return s;
}
/* détecte le macro-clé pour la notif, à partir du contenu nutrition saisi */
function detectNutriKey(s){
  const txt=((s.nutrition?.post||'')+' '+(s.title||'')).toLowerCase();
  if(/glucide|sucre|gel|barre/.test(txt)) return 'glucides';
  if(/prot[eé]ine/.test(txt)) return 'protéines';
  // sinon, on retombe sur l'auto
  return nutritionForSession({...s, nutrition:null}).key;
}

/* remplit les champs nutrition de l'éditeur (auto-suggestion) */
function initBuilderNutrition(existing){
  const pre=document.getElementById('bNutriPre'), post=document.getElementById('bNutriPost');
  const auto=document.getElementById('bNutriAuto');
  const fillAuto=()=>{
    // construit une séance provisoire pour calculer la suggestion
    const tmp={disc:builderState.disc, title:builderState.title, dur:builderTotals().min, zone:'Z3'};
    const n=nutritionForSession(tmp);
    pre.placeholder=n.pre; post.placeholder=n.post;
    auto.textContent=`· suggestion auto : ${n.key}`;
  };
  if(existing && existing.nutrition){ pre.value=existing.nutrition.pre||''; post.value=existing.nutrition.post||''; }
  else { pre.value=''; post.value=''; }
  fillAuto();
  document.getElementById('bNutriReset').onclick=()=>{ pre.value=''; post.value=''; fillAuto(); };
  // recalcul de la suggestion quand le sport change
  builderState._refreshNutri = fillAuto;
}

// — branchements UI —
document.getElementById('builderClose').addEventListener('click', closeBuilder);
document.getElementById('builderOverlay').addEventListener('click', e=>{ if(e.target.id==='builderOverlay') closeBuilder(); });
document.getElementById('bTitle').addEventListener('input', e=>{ builderState.title=e.target.value; });
document.getElementById('bObjectif').addEventListener('change', e=>{ builderState.objectif=e.target.value; });
document.getElementById('bDiscPick').addEventListener('change', e=>{
    builderState.disc=e.target.value;
    builderState.activeRefs=defaultActiveRefs(builderState.disc);
    if(builderState.disc==='hyrox'){
      // convertit chaque bloc en stations Hyrox (une station par défaut si vide)
      builderState.blocks.forEach(blk=>{
        blk.lines = blk.lines.map((ln,i)=> ln.type==='station' ? ln : hyroxLine(HYROX_STATIONS[i%HYROX_STATIONS.length].key));
      });
    } else {
      // sport classique : reconvertit les stations en exercices + ajuste références et métrique
      const def={bike:'ftp',run:'vma',swim:'css',strength:'fc'}[builderState.disc]||'fc';
      builderState.blocks.forEach(blk=>{
        blk.lines = blk.lines.map(ln=> ln.type==='station' ? defaultLine('exo', builderState.disc) : ln);
        blk.lines.forEach(ln=>{
          if(!refsForDisc(builderState.disc).includes(ln.model)) ln.model=def;
          const validKinds = exactKinds(builderState.disc).map(k=>k[0]);
          if(ln.exact && !validKinds.includes(ln.exact.kind)) ln.exact=exactDefault(builderState.disc);
          // métrique par défaut selon le sport (sauf si modifiée manuellement)
          if(!ln._metricTouched){ ln.metric = (builderState.disc==='swim') ? 'dist' : 'time'; }
          if(ln.dist===undefined) ln.dist = (builderState.disc==='swim') ? 100 : 1000;
        });
      });
    }
    renderRefs(); renderBlocks();
    if(builderState._refreshNutri) builderState._refreshNutri();
});
document.getElementById('bAddBlock').addEventListener('click', ()=>{ builderState.blocks.push(defaultBlockNew(builderState.disc)); renderBlocks(); });
document.getElementById('bSaveLib').addEventListener('click', ()=>{
  const s=builderToSession();
  TEMPLATES.push({id:'tpl'+(builderUid++), disc:s.disc, title:s.title, dur:s.dur, tss:s.tss, zone:s.zone, desc:s.desc, blocksV2:s.blocksV2});
  // Persistance backend (si connecté) — non bloquant.
  if(window.PF?.user){
    PF.saveTemplate({ disc:s.disc, title:s.title, dur:s.dur, dist:s.dist||0, tss:s.tss,
      zone:s.zone, activeRefs:builderState.activeRefs, blocks:(s.blocksV2&&s.blocksV2.blocks)||builderState.blocks })
      .catch(e=> console.warn('[PF] saveTemplate échoué :', e));
  }
  closeBuilder(); if(mode==='coach') renderSidebar();
  toast(tr('toast.seanceRangeeEnBibliotheque'));
});
document.getElementById('bSaveCal').addEventListener('click', ()=>{
  const s=builderToSession();
  const key=builderState.targetDate || iso(mondayOf(weekOffset));
  (planning[key] ||= []).push(s);
  // Persistance backend (si connecté) — récupère l'id DB pour les futurs done/rpe.
  if(window.PF?.user){
    PF.scheduleSession(currentAthleteId || PF.user.id, key, { disc:s.disc, title:s.title, dur:s.dur,
      dist:s.dist||0, tss:s.tss, zone:s.zone, blocks:(s.blocksV2&&s.blocksV2.blocks)||[] })
      .then(saved=>{ if(saved) s.id = saved.id; })
      .catch(e=> console.warn('[PF] scheduleSession échoué :', e));
  }
  closeBuilder(); render();
  toast(tr('toast.seanceAjouteeCalendrier'));
});

/* ============================================================
   ANALYSE DÉTAILLÉE DE SÉANCE (compte-rendu)
   ------------------------------------------------------------
   Génère un jeu de données réaliste (vitesse, FC, altitude par
   point) à partir de la séance, puis calcule :
     - D+ (dénivelé positif cumulé)
     - VAP (vitesse ajustée à la pente / grade-adjusted pace)
     - splits par lap
   Backend : remplacer genSessionData() par les vraies données
   GPS/capteurs de l'activité (Strava/Coros/Garmin .fit).
   ============================================================ */
const analysisOverlay = document.getElementById('analysisOverlay');

/* PRNG déterministe pour que la même séance donne toujours le même tracé */
function seededRand(seed){ let s=seed%2147483647; if(s<=0)s+=2147483646; return ()=>{ s=s*16807%2147483647; return (s-1)/2147483646; }; }

function genSessionData(s){
  const rnd = seededRand(s.id.split('').reduce((a,c)=>a+c.charCodeAt(0),7)+(s.dur||60));
  const isRun = s.disc==='run', isBike = s.disc==='bike', isSwim = s.disc==='swim';
  const FTP=(typeof ATHLETE_REF!=='undefined'&&ATHLETE_REF&&ATHLETE_REF.ftp)?ATHLETE_REF.ftp:(STRAVA_DEMO.ftp?STRAVA_DEMO.ftp.at(-1):270);
  const nLaps = isSwim ? Math.max(4,Math.round((s.dur||40)/8)) : Math.max(4, Math.min(12, Math.round((s.dur||60)/10)));
  const ptsPerLap = 14;
  const baseSpeed = isBike?30: isRun?12: 3.2;            // km/h moyen plausible
  const baseHr = 130 + (s.zone==='Z4'||s.zone==='Z5'?28: s.zone==='Z3'?16:6);
  let alt = 120 + rnd()*60;
  const pts=[], laps=[];
  let tElapsed=0; const totalMin=s.dur||60;
  for(let l=0; l<nLaps; l++){
    const hard = (l%2===1) && (s.zone==='Z4'||s.zone==='Z5'||/interval|seuil|vma|vo2|fractionn/i.test(s.title||''));
    const lapSpeedBase = baseSpeed * (hard?1.18: (l===0?0.82:1)) * (isSwim?1:1);
    const lapPts=[];
    let lapDplus=0, lapDist=0, hrSum=0, spSum=0, gradeAdjSum=0, pwSum=0, cadSum=0, maxHrLap=0; const pwArr=[];
    for(let i=0;i<ptsPerLap;i++){
      const grade = isSwim?0 : (Math.sin((l*ptsPerLap+i)/7)*4 + (rnd()-0.5)*3); // % de pente
      alt += grade*0.9;
      if(grade>0) lapDplus += grade*0.9;
      const sp = Math.max(2, lapSpeedBase*(1 + (rnd()-0.5)*0.08) - grade*0.18); // la montée ralentit
      const hr = Math.round(baseHr*(hard?1.08:1) + (rnd()-0.5)*8 + grade*1.1 + l*0.6);
      // VAP : vitesse corrigée de la pente (modèle simplifié type Strava GAP)
      const gap = sp * (1 + 0.025*grade + 0.0018*grade*grade);
      const dt = totalMin/(nLaps*ptsPerLap); // min par point
      const dist = sp/60*dt; // km
      lapDist += dist; lapDplus; hrSum+=hr; spSum+=sp; gradeAdjSum+=gap;
      tElapsed+=dt;
      const pw = isBike ? Math.max(40, Math.round((hard?FTP*1.05:FTP*0.70)*(1+(rnd()-0.5)*0.16)+grade*4)) : 0;
      const cad = isBike ? Math.round((hard?92:86)+(rnd()-0.5)*8) : 0;
      if(isBike){ pwSum+=pw; pwArr.push(pw); cadSum+=cad; }
      if(hr>maxHrLap) maxHrLap=hr;
      const pt={t:tElapsed, sp, hr, alt, grade, gap, pw, cad};
      pts.push(pt); lapPts.push(pt);
    }
    const npLap = isBike ? Math.round(Math.pow(pwArr.reduce((a,p)=>a+Math.pow(p,4),0)/pwArr.length, 0.25)) : 0;
    laps.push({
      n:l+1,
      dist:lapDist,
      durMin: totalMin/nLaps,
      avgSpeed: spSum/ptsPerLap,
      avgGap: gradeAdjSum/ptsPerLap,
      avgHr: Math.round(hrSum/ptsPerLap),
      maxHr: maxHrLap,
      avgPower: isBike?Math.round(pwSum/ptsPerLap):0,
      np: npLap,
      cad: isBike?Math.round(cadSum/ptsPerLap):0,
      if: isBike && FTP ? +(npLap/FTP).toFixed(2) : 0,
      kj: isBike ? Math.round((pwSum/ptsPerLap)*(totalMin/nLaps*60)/1000) : 0,
      dplus: Math.round(lapDplus),
      hard
    });
  }
  const dplus = Math.round(laps.reduce((a,l)=>a+l.dplus,0));
  const dist = laps.reduce((a,l)=>a+l.dist,0);
  const avgHr = Math.round(pts.reduce((a,p)=>a+p.hr,0)/pts.length);
  const maxHr = Math.max(...pts.map(p=>p.hr));
  const avgSpeed = pts.reduce((a,p)=>a+p.sp,0)/pts.length;
  const avgGap = pts.reduce((a,p)=>a+p.gap,0)/pts.length;
  // conditions environnementales du jour (démo — en prod : API météo géolocalisée à l'heure de la séance)
  const cond = {
    temp: Math.round(8 + rnd()*22),         // °C : 8 à 30
    humidity: Math.round(45 + rnd()*45),    // %
    wind: Math.round(5 + rnd()*30),         // km/h
    windHead: rnd()>0.5,                    // vent de face dominant ?
  };
  return {pts, laps, dplus, dist, avgHr, maxHr, avgSpeed, avgGap, disc:s.disc, cond};
}

/* ============================================================
   IMPACT DES CONDITIONS — inspiré d'Enduraw
   ------------------------------------------------------------
   Estime le "coût" en allure de la chaleur, du vent et du D+.
   Modèles simplifiés mais fondés sur la littérature :
   - Chaleur : au-delà de ~15°C, l'allure se dégrade (~1-2%/°C
     selon l'humidité) en endurance.
   - Vent : un vent de face coûte de l'énergie (~quadratique avec
     la vitesse relative) ; un vent arrière en rend un peu.
   - D+ : chaque mètre de dénivelé positif coûte du temps.
   Tout est exprimé en secondes/km perdues + temps total estimé.
   Estimations indicatives, pas des mesures exactes.
   ============================================================ */
function computeImpact(s, data){
  const isRun = s.disc==='run', isBike = s.disc==='bike';
  if(!isRun && !isBike) return null;          // pertinent surtout course & vélo
  const c = data.cond;
  const distKm = Math.max(data.dist, 0.1);
  const basePaceSec = 3600/Math.max(data.avgSpeed,1); // s/km de référence
  const items=[];

  // — Chaleur —
  let heatPctPerKm = 0;
  if(c.temp > 15){
    const over = c.temp - 15;
    const humFactor = 1 + (c.humidity-50)/100*0.6;     // humidité aggrave
    heatPctPerKm = over * 0.009 * humFactor;            // ~0.9%/°C ajusté
  }
  const heatSecPerKm = basePaceSec * heatPctPerKm;
  const heatTotal = heatSecPerKm * distKm;
  items.push({key:'Chaleur', ico:'ic-thermometer', color:'var(--run)',
    cost: heatSecPerKm, total: heatTotal,
    cond:`${c.temp}°C · ${c.humidity}% humidité`,
    detail: c.temp>15
      ? `La chaleur t'a coûté ~${heatSecPerKm.toFixed(0)} s/km. Sans elle, tu aurais pu aller plus vite.`
      : `Température idéale (${c.temp}°C) : aucun surcoût thermique.`});

  // — Vent —
  let windSecPerKm = 0;
  if(isRun || isBike){
    const vKmh = data.avgSpeed;
    const rel = c.windHead ? (vKmh + c.wind) : Math.max(1, vKmh - c.wind);
    const refDrag = vKmh*vKmh;
    const drag = rel*rel;
    const windPct = (drag - refDrag)/refDrag * (isBike?0.12:0.045); // vélo plus sensible
    windSecPerKm = basePaceSec * windPct;
  }
  const windTotal = windSecPerKm * distKm;
  items.push({key:'Vent', ico:'ic-wind', color:'var(--swim)',
    cost: windSecPerKm, total: windTotal,
    cond:`${c.wind} km/h · ${c.windHead?'de face':'favorable'}`,
    detail: c.windHead
      ? `Vent de face : ~${Math.abs(windSecPerKm).toFixed(0)} s/km perdues sur les sections exposées.`
      : `Vent plutôt favorable : il t'a fait gagner ~${Math.abs(windSecPerKm).toFixed(0)} s/km.`});

  // — Dénivelé (D+) —
  // coût ~ 6 s par mètre de D+ en course (réparti sur la distance)
  const dplusSecTotal = isRun ? data.dplus*5.5 : data.dplus*3.2;
  const dplusSecPerKm = dplusSecTotal/distKm;
  items.push({key:'Dénivelé', ico:'ic-mountain', color:'var(--bike)',
    cost: dplusSecPerKm, total: dplusSecTotal,
    cond:`${data.dplus} m D+`,
    detail: data.dplus>20
      ? `Le relief t'a coûté ~${fmtMMSS(dplusSecTotal)} sur l'ensemble (≈${dplusSecPerKm.toFixed(0)} s/km).`
      : `Parcours quasi plat : impact du dénivelé négligeable.`});

  const totalLost = items.reduce((a,i)=>a+Math.max(0,i.total),0);
  const totalGain = items.reduce((a,i)=>a+Math.min(0,i.total),0);
  return {items, totalLost, totalGain, basePaceSec, distKm};
}
function fmtMMSS(sec){ sec=Math.round(Math.abs(sec)); const m=Math.floor(sec/60),s=sec%60; return m>0?`${m}'${String(s).padStart(2,'0')}"`:`${s}s`; }

function renderImpact(s, data){
  const wrap=document.getElementById('anImpactWrap');
  const box=document.getElementById('anImpact');
  const imp=computeImpact(s, data);
  if(!imp){ wrap.style.display='none'; return; }
  wrap.style.display='';
  const cards = imp.items.map(i=>{
    const gain = i.total<0;
    const sign = gain?'+':'−';
    return `<div class="imp-card" style="--ic:${i.color}">
      <div class="imp-top"><span class="imp-ico"><i class="ic ${i.ico}"></i></span><span class="imp-name">${i.key}</span></div>
      <div class="imp-cost">${gain?'+':'−'}${fmtMMSS(i.total)}</div>
      <div class="imp-cond">${i.cond}</div>
      <div class="imp-detail">${i.detail}</div>
    </div>`;
  }).join('');
  // synthèse : allure "corrigée" si conditions neutres
  const correctedPace = imp.basePaceSec - (imp.totalLost+imp.totalGain)/imp.distKm;
  const summary = `<div class="imp-summary">
    <div class="is-h"><i class="ic ic-chart"></i> Allure corrigée des conditions</div>
    <div class="is-txt">Dans des conditions neutres (15°C, sans vent, à plat), ton allure moyenne aurait été d'environ
      <b>${paceFromSpeed(3600/correctedPace)}/km</b> au lieu de <b>${paceFromSpeed(data.avgSpeed)}/km</b>.
      Au total, l'environnement t'a ${imp.totalLost+imp.totalGain>=0?'coûté':'fait gagner'}
      <b>~${fmtMMSS(imp.totalLost+imp.totalGain)}</b> sur cette séance.</div>
  </div>`;
  box.innerHTML = cards + summary;
}

function paceFromSpeed(kmh){ if(kmh<=0) return '—'; const s=3600/kmh; return Math.floor(s/60)+"'"+String(Math.round(s%60)).padStart(2,'0')+'"'; }

function openAnalysis(s){
  const D=DISC[s.disc];
  document.getElementById('anBadge').textContent=D.label;
  document.getElementById('anBadge').style.background=D.color;
  document.getElementById('anTitle').textContent=s.title;

  // ---- cas HYROX : stations + saisie manuelle ----
  if(s.disc==='hyrox'){ openHyroxAnalysis(s); analysisOverlay.classList.add('open'); return; }

  const data=s._realData||genSessionData(s);
  const isSwim=s.disc==='swim';
  // restaure les sections (au cas où une analyse Hyrox les a masquées)
  document.getElementById('anSpeedTitle').parentElement.parentElement.style.display='';
  document.getElementById('anHr').parentElement.querySelector('h4').textContent='Fréquence cardiaque';
  document.querySelector('#anLaps').closest('.an-section').querySelector('h4').textContent='Détail par lap';



  // titre vitesse selon le sport
  const spTitle = s.disc==='bike'?'Vitesse (km/h)' : s.disc==='run'?'Allure (min/km)' : 'Allure (/100m)';
  document.getElementById('anSpeedTitle').textContent = spTitle;
  // réinitialise le registre des graphes (curseur)
  AN_CHARTS.speed=AN_CHARTS.hr=AN_CHARTS.elev=AN_CHARTS.power=AN_CHARTS.decouple=null;
  // graphiques séparés
  drawSpeed(data);
  document.getElementById('anPowerWrap').style.display = s.disc==='bike'?'':'none';
  if(s.disc==='bike') drawPower(data);
  drawHr(data);
  // profil d'altitude (masqué en natation)
  document.getElementById('anElevWrap').style.display = isSwim?'none':'';
  if(!isSwim) drawElevation(data);
  // biomécanique (cadence/foulée) — n'affiche que si le fichier réel fournit ces champs
  drawCadence(data);
  drawStepLen(data);
  // laps
  renderLapChart(data);
  renderLaps(data, isSwim);
  // impact des conditions (chaleur, vent, D+) — course & vélo
  renderImpact(s, data);
  // séances similaires (comparateur — vélo & course)
  renderSimilar(s.disc, sessionType(s), currentSimMetrics(s, data));
  // découplage (Pw:Hr vélo · Pa:Hr course) — coach only, endurance/seuil
  renderDecouple(s, data);
  // assistant IA (résumé + recos) — coach only, gaté par l'add-on
  renderAi(s, data);

  analysisOverlay.classList.add('open');
}

/* ============================================================
   ANALYSE HYROX — par station, avec saisie manuelle
   ------------------------------------------------------------
   L'athlète (ou le coach) saisit pour chaque station la distance
   ou les reps réalisés, le temps, et la FC moyenne. Le Ski et le
   Rameur se saisissent à la main (pas toujours de capteur fiable).
   Une mémoire locale (s._hyroxLog) garde les valeurs entre ouvertures.
   ============================================================ */
function defaultHyroxLog(s){
  // construit la liste des stations à partir des blocs de la séance, sinon les 8 standard
  let stations=[];
  if(s.blocksV2 && s.blocksV2.blocks){
    s.blocksV2.blocks.forEach(blk=>{
      const reps = blk.series||1;
      blk.lines.forEach(ln=>{
        if(ln.type==='station'){
          const st=hyroxStation(ln.station)||HYROX_STATIONS[0];
          stations.push({key:st.key, name:st.name, short:st.short, unit:st.unit,
            target:ln.target, weight:ln.weight||0,
            done:ln.target, hr:0, min:0, sec:0});
        }
      });
    });
  }
  if(!stations.length){ // séance sans détail → 8 stations standard
    stations = HYROX_STATIONS.map(st=>({key:st.key, name:st.name, short:st.short, unit:st.unit,
      target:st.def, weight:st.weighted?st.wDef:0, done:st.def, hr:0, min:0, sec:0}));
  }
  return stations;
}

function openHyroxAnalysis(s){
  if(!s._hyroxLog) s._hyroxLog = defaultHyroxLog(s);
  const log=s._hyroxLog;

  // KPIs
  const totalSec = log.reduce((a,st)=>a+(st.min*60+st.sec),0);
  const hrs=log.filter(st=>st.hr>0).map(st=>st.hr);
  const avgHr = hrs.length?Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length):0;
  const maxHr = hrs.length?Math.max(...hrs):0;
  const totalDist = log.filter(st=>st.unit==='m').reduce((a,st)=>a+(+st.done||0),0);
  document.getElementById('anKpis').innerHTML=[
    {k:'Temps total', v:totalSec?fmtClock(totalSec/60):'—', u:''},
    {k:'Distance cumulée', v:totalDist, u:'m'},
    {k:'FC moy', v:avgHr||'—', u:'bpm'},
    {k:'FC max', v:maxHr||'—', u:'bpm'},
    {k:'Stations', v:log.length, u:''}
  ].map(x=>`<div class="an-kpi"><div class="k">${x.k}</div><div class="v">${x.v}</div><div class="u">${x.u}</div></div>`).join('');

  // on masque les graphes vitesse/altitude, on garde la FC en barres par station
  document.getElementById('anSpeedTitle').parentElement.parentElement.style.display='none';
  document.getElementById('anElevWrap').style.display='none';
  document.getElementById('anPowerWrap').style.display='none';
  document.getElementById('anHr').parentElement.querySelector('h4').textContent='Fréquence cardiaque par station';
  drawHyroxHr(log);

  // tableau éditable des stations
  document.querySelector('#anLaps').closest('.an-section').querySelector('h4').textContent='Détail par station';
  document.getElementById('anLapHint').textContent='saisis tes valeurs réalisées';
  renderHyroxStations(s);
  // comparateur Hyrox (vs simulations passées)
  const wb=log.find(st=>/wall/i.test(st.name));
  renderSimilar('hyrox','hyrox',{total:totalSec, wbtime: wb?(wb.min*60+wb.sec):0, avgHr});
}

function drawHyroxHr(log){
  const svg=document.getElementById('anHr'); svg.innerHTML='';
  const wrap=svg.parentElement; wrap.style.display='';
  const W=720,H=180,P={l:40,r:16,t:14,b:40};
  const hrs=log.map(st=>st.hr||0);
  const hrMax=Math.max(140,...hrs)+8;
  const bw=(W-P.l-P.r)/log.length*0.6, gap=(W-P.l-P.r)/log.length;
  const y=v=>H-P.b-(v/hrMax)*(H-P.t-P.b);
  for(let g=0;g<=3;g++){ const yv=P.t+g/3*(H-P.t-P.b); svg.insertAdjacentHTML('beforeend',`<line x1="${P.l}" x2="${W-P.r}" y1="${yv}" y2="${yv}" stroke="rgba(148,163,196,.1)"/>`); }
  log.forEach((st,i)=>{
    const x=P.l+i*gap+gap*0.2;
    const h=(st.hr||0)?(H-P.b)-y(st.hr):0;
    if(st.hr){ svg.insertAdjacentHTML('beforeend',`<rect x="${x}" y="${y(st.hr)}" width="${bw}" height="${h}" rx="3" fill="var(--run)" opacity="0.85"/>`);
      svg.insertAdjacentHTML('beforeend',`<text x="${x+bw/2}" y="${y(st.hr)-4}" fill="var(--run)" font-size="9" font-family="var(--font-data)" text-anchor="middle">${st.hr}</text>`); }
    svg.insertAdjacentHTML('beforeend',`<text x="${x+bw/2}" y="${H-P.b+14}" fill="var(--muted)" font-size="10" text-anchor="middle">${st.short||st.name}</text>`);
  });
  svg.insertAdjacentHTML('beforeend',`<text x="${W-P.r}" y="11" fill="var(--muted)" font-size="9" font-family="var(--font-data)" text-anchor="end">bpm</text>`);
}

function renderHyroxStations(s){
  const log=s._hyroxLog;
  const box=document.getElementById('anLaps');
  box.innerHTML = `<div class="hx-an-head">
      <span>Station</span><span>Réalisé</span><span>Poids</span><span>Temps</span><span>FC moy</span>
    </div>` + log.map((st,i)=>`
    <div class="hx-an-row" data-i="${i}">
      <div class="hx-an-name">${st.name}</div>
      <div class="hx-an-f"><input type="number" min="0" value="${st.done}" data-hl="done"><span>${st.unit==='m'?'m':'reps'}</span></div>
      <div class="hx-an-f">${st.weight?`<input type="number" min="0" step="0.5" value="${st.weight}" data-hl="weight"><span>kg</span>`:'<span class="hx-an-na">—</span>'}</div>
      <div class="hx-an-f hx-an-time"><input type="number" min="0" max="59" value="${st.min}" data-hl="min"><span>'</span><input type="number" min="0" max="59" value="${st.sec}" data-hl="sec"><span>"</span></div>
      <div class="hx-an-f"><input type="number" min="0" max="220" value="${st.hr||''}" placeholder="—" data-hl="hr"><span>bpm</span></div>
    </div>`).join('');
  // wiring saisie
  box.querySelectorAll('.hx-an-row').forEach(row=>{
    const st=log[+row.dataset.i];
    row.querySelectorAll('[data-hl]').forEach(inp=>{
      inp.addEventListener('input',()=>{
        const f=inp.dataset.hl;
        st[f] = f==='weight' ? (parseFloat(inp.value)||0) : (+inp.value||0);
        // rafraîchit KPIs + graphe FC sans tout reconstruire
        openHyroxAnalysis(s);
      });
    });
  });
}

/* — courbe de vitesse/allure, unité selon le sport — */
/* registre des graphes pour le curseur interactif partagé */
const AN_CHARTS = {};

function drawSpeed(data){
  const svg=document.getElementById('anSpeed'); svg.innerHTML='';
  const W=720,H=180,P={l:54,r:16,t:14,b:24};
  const pts=data.pts;
  const disc=data.disc;
  const xs=i=>P.l+i/(pts.length-1)*(W-P.l-P.r);
  const spMax=Math.max(...pts.map(p=>p.sp))*1.08, spMin=Math.min(...pts.map(p=>p.sp))*0.92;
  const y=v=>H-P.b-(v-spMin)/(spMax-spMin)*(H-P.t-P.b);
  for(let g=0;g<=3;g++){ const yv=P.t+g/3*(H-P.t-P.b); svg.insertAdjacentHTML('beforeend',`<line x1="${P.l}" x2="${W-P.r}" y1="${yv}" y2="${yv}" stroke="rgba(148,163,196,.1)"/>`); }
  let path='',area='';
  pts.forEach((p,i)=>{ const x=xs(i),yy=y(p.sp); path+=(i?'L':'M')+x+' '+yy; });
  area=path+`L${xs(pts.length-1)} ${H-P.b}L${P.l} ${H-P.b}Z`;
  svg.insertAdjacentHTML('beforeend',`<path d="${area}" fill="var(--swim)" opacity="0.1"/>`);
  svg.insertAdjacentHTML('beforeend',`<path d="${path}" fill="none" stroke="var(--swim)" stroke-width="2"/>`);
  const fmt=(v)=>{ if(disc==='bike') return v.toFixed(0); if(disc==='run') return paceFromSpeed(v); return paceFromSpeed2(v); };
  [spMin,(spMin+spMax)/2,spMax].forEach(v=>{ svg.insertAdjacentHTML('beforeend',`<text x="${P.l-7}" y="${y(v)+3}" fill="var(--swim)" font-size="9.5" font-family="var(--font-data)" text-anchor="end">${fmt(v)}</text>`); });
  const unit = disc==='bike'?'km/h':disc==='run'?'min/km':'/100m';
  svg.insertAdjacentHTML('beforeend',`<text x="${W-P.r}" y="11" fill="var(--muted)" font-size="9" font-family="var(--font-data)" text-anchor="end">${unit}</text>`);
  AN_CHARTS.speed = {svg, pts, W, H, P, xs, y:(p)=>y(p.sp), color:'var(--swim)',
    label:(p)=> disc==='bike'?`${p.sp.toFixed(1)} km/h`: disc==='run'?`${paceFromSpeed(p.sp)}/km`:`${paceFromSpeed2(p.sp)}/100m`};
  attachCursor('speed');
}

function drawHr(data){
  const svg=document.getElementById('anHr'); svg.innerHTML='';
  const W=720,H=180,P={l:54,r:16,t:14,b:24};
  const pts=data.pts;
  const xs=i=>P.l+i/(pts.length-1)*(W-P.l-P.r);
  const hrMax=Math.max(...pts.map(p=>p.hr))+6, hrMin=Math.min(...pts.map(p=>p.hr))-6;
  const y=v=>H-P.b-(v-hrMin)/(hrMax-hrMin)*(H-P.t-P.b);
  for(let g=0;g<=3;g++){ const yv=P.t+g/3*(H-P.t-P.b); svg.insertAdjacentHTML('beforeend',`<line x1="${P.l}" x2="${W-P.r}" y1="${yv}" y2="${yv}" stroke="rgba(148,163,196,.1)"/>`); }
  let path='',area='';
  pts.forEach((p,i)=>{ const x=xs(i),yy=y(p.hr); path+=(i?'L':'M')+x+' '+yy; });
  area=path+`L${xs(pts.length-1)} ${H-P.b}L${P.l} ${H-P.b}Z`;
  svg.insertAdjacentHTML('beforeend',`<path d="${area}" fill="var(--run)" opacity="0.1"/>`);
  svg.insertAdjacentHTML('beforeend',`<path d="${path}" fill="none" stroke="var(--run)" stroke-width="2"/>`);
  [hrMin,(hrMin+hrMax)/2,hrMax].forEach(v=>{ svg.insertAdjacentHTML('beforeend',`<text x="${P.l-7}" y="${y(v)+3}" fill="var(--run)" font-size="9.5" font-family="var(--font-data)" text-anchor="end">${Math.round(v)}</text>`); });
  svg.insertAdjacentHTML('beforeend',`<text x="${W-P.r}" y="11" fill="var(--muted)" font-size="9" font-family="var(--font-data)" text-anchor="end">bpm</text>`);
  AN_CHARTS.hr = {svg, pts, W, H, P, xs, y:(p)=>y(p.hr), color:'var(--run)', label:(p)=>`${Math.round(p.hr)} bpm`};
  attachCursor('hr');
}

/* — courbe de puissance (vélo) avec ligne FTP de référence — */
function drawPower(data){
  const svg=document.getElementById('anPower'); svg.innerHTML='';
  const W=720,H=180,P={l:54,r:16,t:14,b:24};
  const pts=data.pts;
  const xs=i=>P.l+i/(pts.length-1)*(W-P.l-P.r);
  const pMax=Math.max(...pts.map(p=>p.pw))+15, pMin=Math.max(0,Math.min(...pts.map(p=>p.pw))-15);
  const y=v=>H-P.b-(v-pMin)/(pMax-pMin)*(H-P.t-P.b);
  for(let g=0;g<=3;g++){ const yv=P.t+g/3*(H-P.t-P.b); svg.insertAdjacentHTML('beforeend',`<line x1="${P.l}" x2="${W-P.r}" y1="${yv}" y2="${yv}" stroke="rgba(148,163,196,.1)"/>`); }
  let path='';
  pts.forEach((p,i)=>{ const x=xs(i),yy=y(p.pw); path+=(i?'L':'M')+x+' '+yy; });
  const area=path+`L${xs(pts.length-1)} ${H-P.b}L${P.l} ${H-P.b}Z`;
  svg.insertAdjacentHTML('beforeend',`<path d="${area}" fill="var(--bike)" opacity="0.12"/>`);
  svg.insertAdjacentHTML('beforeend',`<path d="${path}" fill="none" stroke="var(--bike)" stroke-width="2"/>`);
  const ftp=lapFTPval(); if(ftp>pMin&&ftp<pMax){ const yf=y(ftp); svg.insertAdjacentHTML('beforeend',`<line x1="${P.l}" x2="${W-P.r}" y1="${yf}" y2="${yf}" stroke="var(--strength)" stroke-width="1" stroke-dasharray="4 3" opacity="0.75"/><text x="${W-P.r}" y="${yf-4}" fill="var(--strength)" font-size="9" font-family="var(--font-data)" text-anchor="end">FTP ${ftp}</text>`); }
  [pMin,(pMin+pMax)/2,pMax].forEach(v=>{ svg.insertAdjacentHTML('beforeend',`<text x="${P.l-7}" y="${y(v)+3}" fill="var(--bike)" font-size="9.5" font-family="var(--font-data)" text-anchor="end">${Math.round(v)}</text>`); });
  svg.insertAdjacentHTML('beforeend',`<text x="${W-P.r}" y="11" fill="var(--muted)" font-size="9" font-family="var(--font-data)" text-anchor="end">W</text>`);
  AN_CHARTS.power = {svg, pts, W, H, P, xs, y:(p)=>y(p.pw), color:'var(--bike)', label:(p)=>`${Math.round(p.pw)} W`};
  attachCursor('power');
}

/* ===== Comparateur de séances similaires (vélo · course · Hyrox) ===== */
const SESSION_HISTORY = [
  {disc:'bike', type:'seuil', date:'12 mai', np:262, ifv:0.95, avgHr:166, dist:38.5, dec:6.4},
  {disc:'bike', type:'seuil', date:'28 avr', np:255, ifv:0.92, avgHr:163, dist:41.2, dec:7.3},
  {disc:'bike', type:'vo2',   date:'5 mai',  np:288, ifv:1.06, avgHr:174, dist:33.0},
  {disc:'bike', type:'endurance', date:'9 mai', np:198, ifv:0.72, avgHr:142, dist:92.0, dec:3.1},
  {disc:'run',  type:'seuil', date:'10 mai', pace:228, avgHr:168, dist:12.4, dec:5.6},
  {disc:'run',  type:'seuil', date:'26 avr', pace:233, avgHr:166, dist:11.0, dec:6.8},
  {disc:'run',  type:'vo2',   date:'3 mai',  pace:198, avgHr:176, dist:9.5},
  {disc:'run',  type:'endurance', date:'7 mai', pace:300, avgHr:148, dist:21.0, dec:2.7},
  {disc:'hyrox',type:'hyrox', date:'15 mai', total:4020, wbtime:218, avgHr:165},
  {disc:'hyrox',type:'hyrox', date:'1 mai',  total:4185, wbtime:245, avgHr:162},
];
function sessionType(s){
  if(s.disc==='hyrox') return 'hyrox';
  const t=(s.title||'').toLowerCase();
  if(/vma|vo2|fractionn|interval|30\/30|400|800/.test(t)) return 'vo2';
  if(/seuil|tempo|ftp|threshold/.test(t)) return 'seuil';
  if(/endurance|longue|sortie|footing|récup/.test(t)) return 'endurance';
  return 'seuil';
}
const SIM_METRICS = {
  bike:[ {k:'np',label:'NP',fmt:v=>Math.round(v)+' W',better:'high'},
         {k:'ifv',label:'IF',fmt:v=>(+v).toFixed(2),better:'high'},
         {k:'avgHr',get label(){return tr('simMetric.avgHr')},fmt:v=>Math.round(v)+' bpm',better:'low'},
         {k:'dist',get label(){return tr('simMetric.dist')},fmt:v=>(+v).toFixed(0)+' km',better:'high'} ],
  run:[  {k:'pace',get label(){return tr('simMetric.pace')},fmt:v=>fmtPace(v)+'/km',better:'low'},
         {k:'avgHr',get label(){return tr('simMetric.avgHr')},fmt:v=>Math.round(v)+' bpm',better:'low'},
         {k:'dist',get label(){return tr('simMetric.dist2')},fmt:v=>(+v).toFixed(1)+' km',better:'high'} ],
  hyrox:[{k:'total',get label(){return tr('simMetric.total')},fmt:v=>fmtClock(v/60),better:'low'},
         {k:'wbtime',label:'Wall balls',fmt:v=>fmtClock(v/60),better:'low'},
         {k:'avgHr',get label(){return tr('simMetric.avgHr')},fmt:v=>Math.round(v)+' bpm',better:'low'} ],
};
function currentSimMetrics(s, data){
  if(s.disc==='bike'){ const ftp=lapFTPval();
    const np=Math.round(Math.pow(data.pts.reduce((a,p)=>a+Math.pow(p.pw,4),0)/data.pts.length,0.25));
    return {np, ifv:+(np/ftp).toFixed(2), avgHr:data.avgHr, dist:data.dist}; }
  if(s.disc==='run') return {pace:Math.round(3600/data.avgSpeed), avgHr:data.avgHr, dist:data.dist};
  return null;
}
function injectSimCss(){
  if(document.getElementById('pf-sim-css')) return;
  const st=document.createElement('style'); st.id='pf-sim-css';
  st.textContent=`
  .sim-table{display:flex;flex-direction:column}
  .sim-row{display:grid;grid-template-columns:1.2fr 1fr repeat(var(--ncols,1),1fr);gap:8px;align-items:center;padding:8px 6px;border-bottom:1px solid var(--line);font-size:12.5px}
  .sim-row span{text-align:right;font-family:var(--font-data);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sim-row span:first-child{text-align:left}
  .sim-row.sim-head{border-bottom:1px solid var(--line-strong)}
  .sim-row.sim-head span{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;font-family:var(--font-ui,inherit)}
  .sim-row .sim-met{color:var(--soft);font-family:var(--font-ui,inherit)}
  .sim-cur{color:var(--accent)}
  .an-sim-empty{color:var(--muted);font-size:12.5px;padding:6px 0}`;
  document.head.appendChild(st);
}
function renderSimilar(disc, type, cur){
  const wrap=document.getElementById('anSimilarWrap'); if(!wrap) return;
  if(disc==='swim'||!cur){ wrap.style.display='none'; return; }
  wrap.style.display=''; injectSimCss();
  const box=document.getElementById('anSimilar');
  const TYPELBL={seuil:'Seuil',vo2:'VO2max / intervalles',endurance:'Endurance',hyrox:'Hyrox'};
  const matches=SESSION_HISTORY.filter(h=>h.disc===disc&&h.type===type).slice(0,2);
  if(!matches.length){ box.innerHTML=`<p class="an-sim-empty">Aucune séance « ${TYPELBL[type]||type} » comparable dans l'historique récent.</p>`; return; }
  const M=SIM_METRICS[disc]||[];
  const head=`<div class="sim-row sim-head"><span>${TYPELBL[type]||type}</span><span class="sim-cur">Cette séance</span>${matches.map(m=>`<span>${m.date}</span>`).join('')}</div>`;
  const rows=M.map(met=>{
    const cv=cur[met.k], hasCur=cv!=null&&cv!==0;
    const cells=matches.map(m=>{ const pv=m[met.k]; if(pv==null) return '<span>—</span>';
      if(!hasCur) return `<span>${met.fmt(pv)}</span>`;
      const d=cv-pv, improved=met.better==='high'?d>0:d<0, arrow=Math.abs(d)<1e-6?'':(improved?'▲':'▼');
      const col=!arrow?'var(--muted)':(improved?'var(--good)':'var(--bike)');
      return `<span>${met.fmt(pv)} <em style="font-style:normal;font-size:11px;color:${col}">${arrow}</em></span>`; }).join('');
    return `<div class="sim-row"><span class="sim-met">${met.label}</span><span class="sim-cur"><b>${hasCur?met.fmt(cv):'—'}</b></span>${cells}</div>`;
  }).join('');
  box.innerHTML=`<div class="sim-table" style="--ncols:${matches.length}">${head}${rows}</div>`;
}

/* ============================================================
   DÉCOUPLAGE (aerobic decoupling — Pw:Hr vélo · Pa:Hr course)
   ------------------------------------------------------------
   Mesure la dérive du couple "effort produit / coût cardiaque"
   au fil de l'effort. On exclut l'échauffement, on coupe le
   corps de séance en 2 moitiés égales, et on compare le ratio
   d'efficacité de chaque moitié :
     vélo  : ratio = Puissance / FC          (Pw:Hr)
     course: ratio = allure corrigée pente / FC  (Pa:Hr, via gap)
   Découplage % = (ratio 1ʳᵉ moitié − ratio 2ᵉ moitié) / ratio 1ʳᵉ × 100
   < 5 % = aérobie solide ; 5-10 % = dérive modérée ; > 10 % = forte dérive.
   Affiché côté COACH uniquement, sur séances endurance/seuil.
   ============================================================ */
function decoupleRelevant(disc, type){ return (disc==='bike'||disc==='run') && (type==='endurance'||type==='seuil'); }
function effRatio(p, disc){ if(!p.hr) return 0; return disc==='bike' ? p.pw/p.hr : p.gap/p.hr; }
function computeDecouple(data, disc){
  const pts=data.pts; if(!pts||pts.length<8) return null;
  const totalT=pts[pts.length-1].t;
  const warm=Math.min(10, totalT*0.15);                 // échauffement exclu (~10 min ou 15%)
  const body=pts.filter(p=>p.t>=warm && p.hr>0 && (disc!=='bike'||p.pw>0));
  if(body.length<6) return null;
  const tStart=body[0].t, tEnd=body[body.length-1].t, mid=(tStart+tEnd)/2;
  const h1=body.filter(p=>p.t<mid), h2=body.filter(p=>p.t>=mid);
  if(h1.length<2||h2.length<2) return null;
  const avg=(arr,f)=>arr.reduce((a,p)=>a+f(p),0)/arr.length;
  const r1=avg(h1,p=>effRatio(p,disc)), r2=avg(h2,p=>effRatio(p,disc));
  if(!r1) return null;
  return {pct:(r1-r2)/r1*100, r1, r2, warm, mid};
}
function decoupleVerdict(pct){
  if(pct<5)  return {c:'var(--good)', lbl:'Aérobie solide'};
  if(pct<=10) return {c:'var(--bike)', lbl:'Dérive modérée'};
  return {c:'var(--run)', lbl:'Forte dérive'};
}
function decoupleInterp(type, pct, disc){
  if(type==='endurance'){
    if(pct<5)  return "Allure bien tenue en zone aérobie : le cœur ne dérive pas, l'endurance fondamentale est au rendez-vous.";
    if(pct<=10) return "Légère dérive cardiaque : l'allure était un peu haute pour du Z2 (ou fatigue/chaleur). À surveiller.";
    return "Forte dérive : ce footing n'est pas resté aérobie. Ralentir l'allure pour rester en Z2.";
  }
  // seuil / LT1
  if(pct<5)  return "Effort soutenable : tu es resté sous le seuil, c'est la bonne zone de travail.";
  if(pct<=10) return "Dérive modérée : tu étais à la limite haute du seuil.";
  return "Dérive trop forte : l'intensité dépassait le seuil aérobie. Recaler la zone un cran plus bas.";
}
function injectDecoupleCss(){
  if(document.getElementById('pf-dc-css')) return;
  const st=document.createElement('style'); st.id='pf-dc-css';
  st.textContent=`
  #anDecoupleKpi{display:flex;align-items:center;gap:16px;margin:2px 0 12px;flex-wrap:wrap}
  .an-dc-big{font-family:var(--font-data);font-size:32px;font-weight:700;line-height:1;color:var(--dcv,var(--good))}
  .an-dc-pill{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;padding:5px 12px;border-radius:99px;background:color-mix(in srgb,var(--dcv,var(--good)) 14%,transparent);color:var(--dcv,var(--good));border:1px solid color-mix(in srgb,var(--dcv,var(--good)) 42%,transparent)}
  .an-dc-pill .dot{width:8px;height:8px;border-radius:50%;background:var(--dcv,var(--good));box-shadow:0 0 8px var(--dcv,var(--good))}
  .an-dc-txt{font-size:12.5px;color:var(--soft);max-width:430px;line-height:1.45}
  .an-dc-trend{display:flex;align-items:flex-end;gap:12px;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}
  .an-dc-tlabel{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700;align-self:center}
  .an-dc-bar{display:flex;flex-direction:column;align-items:center;gap:5px;font-family:var(--font-data);font-size:9.5px;color:var(--muted)}
  .an-dc-bar i{display:block;width:28px;border-radius:5px 5px 0 0;background:var(--bc,var(--muted));opacity:.85}
  .an-dc-bar.cur i{opacity:1;outline:1px solid var(--accent);outline-offset:1px}`;
  document.head.appendChild(st);
}
function drawDecouple(data, disc, dc){
  const svg=document.getElementById('anDecouple'); if(!svg) return; svg.innerHTML='';
  const W=720,H=170,P={l:54,r:16,t:14,b:24};
  const pts=data.pts;
  const xs=i=>P.l+i/(pts.length-1)*(W-P.l-P.r);
  // ratio d'efficacité lissé (fenêtre glissante) stocké sur chaque point
  const raw=pts.map(p=>effRatio(p,disc));
  const win=Math.max(2,Math.round(pts.length/14));
  pts.forEach((p,i)=>{ let s=0,n=0; for(let j=Math.max(0,i-win);j<=Math.min(pts.length-1,i+win);j++){ if(raw[j]>0){s+=raw[j];n++;} } p._dr=n?s/n:0; });
  const vals=pts.map(p=>p._dr).filter(v=>v>0);
  const vMax=Math.max(...vals)*1.06, vMin=Math.min(...vals)*0.94;
  const y=v=>H-P.b-(v-vMin)/(vMax-vMin)*(H-P.t-P.b);
  for(let g=0;g<=3;g++){ const yv=P.t+g/3*(H-P.t-P.b); svg.insertAdjacentHTML('beforeend',`<line x1="${P.l}" x2="${W-P.r}" y1="${yv}" y2="${yv}" stroke="rgba(148,163,196,.1)"/>`); }
  // bande d'échauffement grisée
  const warmI=pts.findIndex(p=>p.t>=dc.warm);
  const warmX=xs(warmI<1?0:warmI);
  if(warmI>0){ svg.insertAdjacentHTML('beforeend',`<rect x="${P.l}" y="${P.t}" width="${warmX-P.l}" height="${H-P.t-P.b}" fill="rgba(148,163,196,.06)"/><text x="${(P.l+warmX)/2}" y="${P.t+11}" fill="var(--muted)" font-size="8" text-anchor="middle" font-family="var(--font-data)">échauf.</text>`); }
  // ligne de séparation des 2 moitiés
  let midI=pts.findIndex(p=>p.t>=dc.mid); if(midI<0) midI=Math.floor(pts.length/2);
  const mx=xs(midI), endX=xs(pts.length-1);
  svg.insertAdjacentHTML('beforeend',`<line x1="${mx}" x2="${mx}" y1="${P.t}" y2="${H-P.b}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 3" opacity=".6"/>`);
  // segments moyens de chaque moitié
  if(dc.r1>=vMin&&dc.r1<=vMax) svg.insertAdjacentHTML('beforeend',`<line x1="${warmX}" x2="${mx}" y1="${y(dc.r1)}" y2="${y(dc.r1)}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="2 2" opacity=".85"/><text x="${warmX+4}" y="${y(dc.r1)-4}" fill="var(--accent)" font-size="8.5" font-family="var(--font-data)">1ʳᵉ ½</text>`);
  if(dc.r2>=vMin&&dc.r2<=vMax) svg.insertAdjacentHTML('beforeend',`<line x1="${mx}" x2="${endX}" y1="${y(dc.r2)}" y2="${y(dc.r2)}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="2 2" opacity=".85"/><text x="${endX-4}" y="${y(dc.r2)-4}" fill="var(--accent)" font-size="8.5" font-family="var(--font-data)" text-anchor="end">2ᵉ ½</text>`);
  // courbe lissée
  let path='';
  pts.forEach((p,i)=>{ const x=xs(i),yy=y(p._dr); path+=(i?'L':'M')+x+' '+yy; });
  svg.insertAdjacentHTML('beforeend',`<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"/>`);
  const fmtR=v=>disc==='bike'?v.toFixed(2):v.toFixed(3);
  [vMin,(vMin+vMax)/2,vMax].forEach(v=>{ svg.insertAdjacentHTML('beforeend',`<text x="${P.l-7}" y="${y(v)+3}" fill="var(--accent)" font-size="9.5" font-family="var(--font-data)" text-anchor="end">${fmtR(v)}</text>`); });
  svg.insertAdjacentHTML('beforeend',`<text x="${W-P.r}" y="11" fill="var(--muted)" font-size="9" font-family="var(--font-data)" text-anchor="end">${disc==='bike'?'W/bpm':'km·h⁻¹/bpm'}</text>`);
  AN_CHARTS.decouple={svg,pts,W,H,P,xs,y:(p)=>y(p._dr),color:'var(--accent)',label:(p)=>fmtR(p._dr)};
  attachCursor('decouple');
}
function renderDecoupleTrend(disc, type, curPct){
  const box=document.getElementById('anDecoupleTrend'); if(!box) return;
  const hist=SESSION_HISTORY.filter(h=>h.disc===disc&&h.type===type&&h.dec!=null).slice(0,3).reverse();
  const all=[...hist.map(h=>({date:h.date,dec:h.dec,cur:false})),{date:'Cette séance',dec:curPct,cur:true}];
  if(all.length<2){ box.style.display='none'; return; }
  box.style.display='';
  const maxV=Math.max(...all.map(a=>Math.abs(a.dec)),6);
  box.innerHTML=`<span class="an-dc-tlabel">Tendance</span>`+all.map(a=>{
    const v=decoupleVerdict(a.dec), h=Math.max(6,Math.abs(a.dec)/maxV*52);
    return `<div class="an-dc-bar ${a.cur?'cur':''}"><b style="color:${v.c}">${a.dec.toFixed(1)}%</b><i style="height:${h}px;--bc:${v.c}"></i><span>${a.date}</span></div>`;
  }).join('');
}
function renderDecouple(s, data){
  const wrap=document.getElementById('anDecoupleWrap'); if(!wrap) return;
  const type=(s.objectif&&s.objectif.type)||sessionType(s);
  if(mode!=='coach' || !decoupleRelevant(s.disc,type)){ wrap.style.display='none'; AN_CHARTS.decouple=null; return; }
  const dc=computeDecouple(data, s.disc);
  if(!dc){ wrap.style.display='none'; AN_CHARTS.decouple=null; return; }
  wrap.style.display=''; injectDecoupleCss();
  const v=decoupleVerdict(dc.pct);
  const kpi=document.getElementById('anDecoupleKpi');
  kpi.style.setProperty('--dcv', v.c);
  kpi.innerHTML=`<span class="an-dc-big">${dc.pct>=0?'':'−'}${Math.abs(dc.pct).toFixed(1)}%</span>`+
    `<span class="an-dc-pill"><span class="dot"></span>${v.lbl}</span>`+
    `<span class="an-dc-txt">${decoupleInterp(type, dc.pct, s.disc)}</span>`;
  document.getElementById('anDecoupleHint').textContent = s.disc==='bike'?'Puissance / FC (Pw:Hr)':'Allure corrigée / FC (Pa:Hr)';
  drawDecouple(data, s.disc, dc);
  renderDecoupleTrend(s.disc, type, dc.pct);
}

/* ============================================================
   ASSISTANT IA — Résumé & recommandations par séance (add-on)
   ------------------------------------------------------------
   1. computeSessionBilan : couche DÉTERMINISTE qui lit les vraies
      données (zones FC, %FCmax, temps en zone cible, découplage,
      pics par intervalle). Aucun "deviné".
   2. aiSummary : moteur de RUBRIQUES qui juge la séance PAR RAPPORT
      À SON OBJECTIF et rend verdict + recommandations actionnables.
   En prod : l’edge function `session-summary` envoie ce bilan chiffré
   à Claude (prompt caching) qui rédige le texte. En démo, le moteur
   local ci-dessous produit le même type de sortie, marqué « démo ».
   Réservé COACH + add-on payant (gate aiUnlocked()).
   ============================================================ */
// (AI_ADDON_PRICE déclaré plus haut, avant le premier renderSidebar)
function aiUnlocked(){ return window.__pf_aiAddon===true || window.__pf_aiDemo===true; }
function aiFcMax(){ return (typeof ATHLETE_REF!=='undefined'&&ATHLETE_REF&&ATHLETE_REF.fcMax)?ATHLETE_REF.fcMax:190; }
function aiHrZone(hr, fcMax){ const p=hr/fcMax*100; if(p<60)return'Z1'; if(p<70)return'Z2'; if(p<80)return'Z3'; if(p<90)return'Z4'; return'Z5'; }
function aiTargetZone(type, objectif){ if(objectif&&objectif.zone) return objectif.zone; return {endurance:'Z2', seuil:'Z4', vo2:'Z5'}[type]||'Z3'; }
function computeSessionBilan(s, data){
  const objectif=s.objectif||null, type=(objectif&&objectif.type)||sessionType(s), fcMax=aiFcMax(), target=aiTargetZone(type, objectif);
  const pts=data.pts, n=pts.length||1;
  const zc={Z1:0,Z2:0,Z3:0,Z4:0,Z5:0};
  pts.forEach(p=>{ zc[aiHrZone(p.hr,fcMax)]++; });
  const zonePct={}; Object.keys(zc).forEach(z=>zonePct[z]=Math.round(zc[z]/n*100));
  const dc=computeDecouple(data, s.disc);
  const hardReps=(data.laps||[]).filter(l=>l.hard).map(l=>({
    n:l.n, peakPct:Math.round(l.maxHr/fcMax*100), avgPct:Math.round(l.avgHr/fcMax*100),
    avgSpeed:l.avgSpeed, avgPower:l.avgPower, paceSec:Math.round(3600/Math.max(l.avgSpeed,1)) }));
  // dérive cardiaque : FC moyenne de la 2ᵉ moitié vs la 1ʳᵉ (en bpm)
  const half=Math.floor(n/2);
  const hr1=pts.slice(0,half).reduce((a,p)=>a+p.hr,0)/Math.max(half,1);
  const hr2=pts.slice(half).reduce((a,p)=>a+p.hr,0)/Math.max(n-half,1);
  return { type, disc:s.disc, objectif, target,
    plannedDur:s.dur||null, plannedTss:s.tss||null, hrDrift:+(hr2-hr1).toFixed(1),
    dur:Math.round(pts[pts.length-1].t), dist:+(data.dist||0).toFixed(1),
    avgHr:data.avgHr, maxHr:data.maxHr, fcMax,
    pctFcMax:Math.round(data.maxHr/fcMax*100), avgPctFcMax:Math.round(data.avgHr/fcMax*100),
    zonePct, timeInTarget:zonePct[target]||0, decouple:dc?+dc.pct.toFixed(1):null,
    hardReps, np:(s.disc==='bike'?((currentSimMetrics(s,data)||{}).np||0):0) };
}
function aiSummary(s, b){
  const recos=[], bullets=[]; let tenu='partiel', headline='';
  // conformité au plan : la séance réalisée correspond-elle à la séance prévue ?
  if(b.plannedDur){
    const ecart=Math.round((b.dur-b.plannedDur)/b.plannedDur*100);
    bullets.push({s:Math.abs(ecart)<=15?'ok':'warn', t:`Prévu ${fmtDur(b.plannedDur)} — réalisé ${fmtDur(b.dur)} (${ecart>=0?'+':''}${ecart}%)`});
    if(ecart<-15) recos.push('Séance écourtée par rapport au plan : vérifier fatigue ou contrainte horaire, replanifier le volume manquant si besoin.');
    if(ecart>15) recos.push('Séance nettement rallongée : attention au volume non prévu qui alourdit la charge de la semaine.');
  }
  if(b.hrDrift!=null) bullets.push({s:b.hrDrift<5?'ok':(b.hrDrift<8?'warn':'bad'),
    t:`Dérive cardiaque : ${b.hrDrift>=0?'+':''}${b.hrDrift} bpm entre la 1ʳᵉ et la 2ᵉ moitié`});
  if(b.type==='endurance'){
    const okDec=b.decouple!=null && b.decouple<5, okZone=b.timeInTarget>=60;
    bullets.push({s:okZone?'ok':'warn', t:`${b.timeInTarget}% du temps en ${b.target} (objectif : rester en zone aérobie)`});
    if(b.decouple!=null) bullets.push({s:okDec?'ok':'bad', t:`Découplage ${b.decouple}% ${okDec?'— le cœur ne dérive pas, séance bien aérobie':'— dérive cardiaque, allure trop haute'}`});
    bullets.push({s:b.pctFcMax<88?'ok':'warn', t:`Pic FC à ${b.pctFcMax}% FCmax`});
    if(okZone&&okDec){ tenu='oui'; headline='Objectif tenu : la séance est bien restée en zone aérobie.'; }
    else { tenu=(okZone||okDec)?'partiel':'non'; headline='Zone aérobie partiellement tenue.';
      if(!okDec) recos.push('Ralentir d’environ 10–15 s/km (ou ~5 bpm) pour contenir la dérive et rester franchement en Z2.');
      if(!okZone) recos.push(`Trop de temps hors Z2 (${100-b.timeInTarget}%). Brider l’intensité, surtout dans les bosses.`); }
  }
  else if(b.type==='vo2'){
    const peaks=b.hardReps.map(r=>r.peakPct), maxPeak=peaks.length?Math.max(...peaks):b.pctFcMax, reach=maxPeak>=90;
    bullets.push({s:reach?'ok':'bad', t:`Pic FC sur les séries : ${maxPeak}% FCmax (cible ≥ 90–95%)`});
    if(b.hardReps.length){ const f=b.hardReps[0], l=b.hardReps[b.hardReps.length-1], drift=l.paceSec-f.paceSec;
      bullets.push({s:Math.abs(drift)<8?'ok':'warn', t:`Allure des séries : ${fmtPace(f.paceSec)} → ${fmtPace(l.paceSec)}/km ${drift>8?'(dégradation)':drift<-8?'(négatif split)':'(stable)'}`}); }
    if(reach){ tenu='oui'; headline='Objectif atteint : les zones hautes sont bien touchées.'; }
    else { tenu='non'; headline='Zone cible VO2max pas atteinte sur cette séance.';
      recos.push(`Pics à ${maxPeak}% FCmax seulement : rallonger les intervalles (+30 à 60 s) ou raccourcir la récup pour faire monter le cœur dans la zone VO2max.`); }
    if(b.hardReps.length){ const f=b.hardReps[0], l=b.hardReps[b.hardReps.length-1];
      if(l.paceSec-f.paceSec>10) recos.push('Forte dégradation d’allure sur les dernières séries : retirer 1–2 répétitions pour tenir la cible sur l’ensemble.'); }
  }
  else if(b.type==='seuil'){
    const okDec=b.decouple==null||b.decouple<8;
    bullets.push({s:b.timeInTarget>=40?'ok':'warn', t:`${b.timeInTarget}% du temps en ${b.target}`});
    if(b.decouple!=null) bullets.push({s:okDec?'ok':'bad', t:`Découplage ${b.decouple}% ${okDec?'— effort soutenable, bonne zone de seuil':'— dérive trop forte, au-dessus du seuil'}`});
    bullets.push({s:'ok', t:`FC moyenne à ${b.avgPctFcMax}% FCmax`});
    if(okDec){ tenu='oui'; headline='Séance de seuil bien calibrée.'; }
    else { tenu='non'; headline='Intensité au-dessus du seuil aérobie.';
      recos.push('Découplage élevé : l’allure dépassait le seuil. Recaler la zone cible un cran plus bas (≈ −10 s/km ou −10 W).'); }
  }
  else {
    bullets.push({s:'ok', t:`${b.dur} min · FC moyenne ${b.avgHr} bpm (${b.avgPctFcMax}% FCmax)`});
    bullets.push({s:'ok', t:`Répartition FC : Z2 ${b.zonePct.Z2}% · Z3 ${b.zonePct.Z3}% · Z4 ${b.zonePct.Z4}% · Z5 ${b.zonePct.Z5}%`});
    tenu='oui'; headline='Séance enregistrée — synthèse des zones ci-dessous.';
  }
  return {headline, tenu, bullets, recos};
}
function aiVerdictMeta(tenu){ return tenu==='oui'?{c:'var(--good)',l:tr('aiVerdict.met')}:tenu==='partiel'?{c:'var(--bike)',l:tr('aiVerdict.partial')}:{c:'var(--run)',l:tr('aiVerdict.missed')}; }
function injectAiCss(){
  if(document.getElementById('pf-ai-css')) return;
  const st=document.createElement('style'); st.id='pf-ai-css';
  st.textContent=`
  .ai-pay{border:1px solid var(--line-strong);border-radius:var(--radius);padding:18px;background:linear-gradient(180deg,rgba(70,194,216,.07),transparent)}
  .ai-pay h5{font-family:var(--font-display);font-size:16px;margin:0 0 3px}
  .ai-pay .ai-sub{color:var(--muted);font-size:12px;margin-bottom:12px}
  .ai-feat{display:flex;flex-direction:column;gap:8px;margin:12px 0;font-size:13px}
  .ai-feat div{display:flex;gap:9px;align-items:flex-start;color:var(--soft);line-height:1.4}
  .ai-feat .ck{color:var(--accent);flex:none}
  .ai-price{font-family:var(--font-data);font-size:26px;font-weight:700;color:var(--ink)}
  .ai-price small{font-size:13px;color:var(--muted);font-weight:400}
  .ai-cta{margin-top:12px;background:var(--accent);color:#04222a;border:none;border-radius:var(--radius-sm);padding:11px 18px;font-weight:700;font-size:13.5px;cursor:pointer;width:100%}
  .ai-cta:hover{filter:brightness(1.08)}
  .ai-loading{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:13px;padding:14px 0}
  .ai-result{border-left:3px solid var(--av,var(--good));padding-left:14px}
  .ai-verdict{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:12px;color:var(--av);background:color-mix(in srgb,var(--av) 14%,transparent);border:1px solid color-mix(in srgb,var(--av) 40%,transparent);padding:4px 11px;border-radius:99px;margin-bottom:9px}
  .ai-headline{font-size:14.5px;font-weight:600;color:var(--soft);margin-bottom:12px;line-height:1.4}
  .ai-bul{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}
  .ai-bul>div{display:flex;gap:9px;align-items:flex-start;font-size:13px;color:var(--soft);line-height:1.4}
  .ai-ico{flex:none;width:14px;font-weight:700}
  .ai-recobox{background:var(--panel-2);border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px;margin-top:4px}
  .ai-recobox h6{margin:0 0 7px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);font-weight:700}
  .ai-recobox ul{margin:0;padding-left:18px}
  .ai-recobox li{font-size:13px;color:var(--soft);margin-bottom:5px;line-height:1.45}
  .ai-foot{margin-top:10px;font-size:10.5px;color:var(--muted);font-style:italic}
  .ai-badge-demo{display:inline-block;font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);border-radius:99px;padding:2px 7px}
  .ai-trial{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--good);background:color-mix(in srgb,var(--good) 12%,transparent);border:1px solid color-mix(in srgb,var(--good) 40%,transparent);border-radius:99px;padding:3px 10px;margin-bottom:8px}
  .ai-legal{margin-top:9px;font-size:10.5px;color:var(--muted);line-height:1.45}`;
  document.head.appendChild(st);
}
function aiPaywallHtml(){
  return `<div class="ai-pay">
    <h5><i class="ic ic-brain"></i> Assistant IA — résumé & recommandations par séance</h5>
    <div class="ai-sub">Add-on coach · analyse automatique de chaque activité</div>
    <div class="ai-feat">
      <div><span class="ck"><i class="ic ic-check"></i></span><span>Résumé clair de chaque séance : zones FC, allure/puissance, découplage.</span></div>
      <div><span class="ck"><i class="ic ic-check"></i></span><span>Verdict par rapport à l’objectif (Z2 tenu ? zone VO2max atteinte ?).</span></div>
      <div><span class="ck"><i class="ic ic-check"></i></span><span>Recommandations actionnables (rallonger les intervalles, recaler la zone…).</span></div>
    </div>
    <div class="ai-trial">Essai gratuit 14 jours</div>
    <div class="ai-price">0€<small> pendant 14 jours, puis ${AI_ADDON_PRICE} €/mois</small></div>
    <button class="ai-cta" id="aiActivate">Commencer l’essai 14 jours</button>
    <div class="ai-legal">Carte enregistrée à l’activation. Débit automatique de ${AI_ADDON_PRICE} €/mois à la fin de l’essai, sauf révocation de l’accès avant — résiliable à tout moment depuis « Gérer / révoquer l’accès ».</div>
  </div>`;
}
function aiResultHtml(s, b, r, isDemo){
  const v=aiVerdictMeta(r.tenu);
  const ico=st=>st==='ok'?'<span style="color:var(--good)"><i class="ic ic-check"></i></span>':st==='warn'?'<span style="color:var(--bike)"><i class="ic ic-alert-triangle"></i></span>':'<span style="color:var(--run)"><i class="ic ic-x"></i></span>';
  const bul=r.bullets.map(x=>`<div><span class="ai-ico">${ico(x.s)}</span><span>${x.t}</span></div>`).join('');
  const recos=r.recos.length?`<div class="ai-recobox"><h6>Recommandations</h6><ul>${r.recos.map(x=>`<li>${x}</li>`).join('')}</ul></div>`:'';
  const foot=isDemo
    ? 'Généré à partir des données réelles de la séance (zones FC, découplage, pics). En production : rédigé par Claude via l’add-on IA.'
    : 'Rédigé par Claude à partir du bilan chiffré de la séance (zones FC, découplage, pics) — aucune donnée inventée.';
  return `<div class="ai-result" style="--av:${v.c}">
    <div class="ai-verdict">${v.l} ${isDemo?'<span class="ai-badge-demo">démo</span>':''}</div>
    <div class="ai-headline">${r.headline}</div>
    <div class="ai-bul">${bul}</div>
    ${recos}
    <div class="ai-foot">${foot}</div>
  </div>`;
}
function renderAi(s, data){
  const wrap=document.getElementById('anAiWrap'); if(!wrap) return;
  if(mode!=='coach'){ wrap.style.display='none'; return; }
  wrap.style.display=''; injectAiCss();
  const body=document.getElementById('anAiBody'); if(!body) return;
  if(!aiUnlocked()){
    body.innerHTML=aiPaywallHtml();
    const btn=document.getElementById('aiActivate');
    if(btn) btn.onclick=()=>{
      // En prod (connecté) : vrai checkout Stripe de l'add-on. En démo : déverrouillage immédiat.
      if(window.PF?.user && PF.subscribeAiAddon){ PF.subscribeAiAddon().catch(e=>console.warn('[PF] ai-addon:',e)); return; }
      window.__pf_aiDemo=true; renderAi(s, data); toast(tr('toast.assistantIaActiveDemo'));
    };
    return;
  }
  body.innerHTML=`<div class="ai-loading"><span class="ai-dot"></span> Analyse de la séance en cours…</div>`;
  const b=computeSessionBilan(s, data);
  // Connecté + add-on réel (pas juste le déverrouillage démo) → vrai résumé Claude.
  if(window.PF?.user && window.__pf_aiAddon===true && typeof PF.summarizeSession==='function'){
    const sessionKey=String(s.id || (s.title+'|'+(s.dur||'')+'|'+(s._realData?.provider_activity_id||'')));
    PF.summarizeSession({
      session_key: sessionKey,
      bilan: b,
      athlete_id: s.athleteId || null,
      discipline: s.disc,
      objective: (s.objectif&&s.objectif.type) || b.type,
    }).then(r=>{
      if(r && r.error){
        if(r.error==='add_on_required') window.__pf_aiAddon=false;
        else toast(tr('toast.analyseIaIndisponibleResumeLocal'), 'error');
        const rl=aiSummary(s, b); body.innerHTML=aiResultHtml(s, b, rl, true);
        return;
      }
      const mapped={headline:r.headline, tenu:r.verdict, bullets:(r.bullets||[]).map(x=>({s:x.status,t:x.text})), recos:r.recos||[]};
      body.innerHTML=aiResultHtml(s, b, mapped, false);
    }).catch(e=>{
      console.warn('[PF] summarizeSession échoué :', e);
      const rl=aiSummary(s, b); body.innerHTML=aiResultHtml(s, b, rl, true);
    });
  } else {
    setTimeout(()=>{
      const r=aiSummary(s, b);
      body.innerHTML=aiResultHtml(s, b, r, true);
    }, 450);
  }
}

/* ---- curseur interactif : valeur exacte au survol ---- */
function fmtClock(min){ const s=Math.round(min*60); const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;
  return (h?h+':':'')+String(m).padStart(h?2:1,'0')+':'+String(ss).padStart(2,'0'); }

function attachCursor(key){
  const C=AN_CHARTS[key]; if(!C) return;
  const {svg,pts,W,H,P,xs}=C;
  // éléments du curseur (ligne + point + halo)
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('stroke','var(--muted)'); line.setAttribute('stroke-width','1'); line.setAttribute('stroke-dasharray','3 3');
  line.setAttribute('y1',P.t); line.setAttribute('y2',H-P.b); line.style.opacity='0'; line.style.pointerEvents='none';
  const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
  dot.setAttribute('r','4'); dot.setAttribute('fill','var(--ink)'); dot.setAttribute('stroke',C.color); dot.setAttribute('stroke-width','2');
  dot.style.opacity='0'; dot.style.pointerEvents='none';
  // zone de capture transparente
  const hit=document.createElementNS('http://www.w3.org/2000/svg','rect');
  hit.setAttribute('x',P.l); hit.setAttribute('y',P.t); hit.setAttribute('width',W-P.l-P.r); hit.setAttribute('height',H-P.t-P.b);
  hit.setAttribute('fill','transparent'); hit.style.cursor='crosshair';
  svg.appendChild(line); svg.appendChild(dot); svg.appendChild(hit);

  const move=(evt)=>{
    const r=svg.getBoundingClientRect();
    const cx=evt.clientX!==undefined?evt.clientX:(evt.touches&&evt.touches[0].clientX);
    // position en coordonnées viewBox
    const vbX=(cx-r.left)/r.width*W;
    // index le plus proche
    let i=Math.round((vbX-P.l)/(W-P.l-P.r)*(pts.length-1));
    i=Math.max(0,Math.min(pts.length-1,i));
    const x=xs(i), p=pts[i];
    // déplace le curseur sur TOUS les graphes synchronisés
    syncCursor(i);
    showAnTip(evt, i);
  };
  hit.addEventListener('mousemove',move);
  hit.addEventListener('touchmove',e=>{ move(e); });
  hit.addEventListener('mouseleave',hideAnCursor);
  hit.addEventListener('touchend',hideAnCursor);
  C.line=line; C.dot=dot;
}

/* synchronise le curseur vertical sur les 3 graphes à l'index i */
function syncCursor(i){
  ['speed','hr','elev','power','decouple','cadence','steplen'].forEach(k=>{
    const C=AN_CHARTS[k]; if(!C||!C.line) return;
    const x=C.xs(i), p=C.pts[i];
    C.line.setAttribute('x1',x); C.line.setAttribute('x2',x); C.line.style.opacity='1';
    C.dot.setAttribute('cx',x); C.dot.setAttribute('cy',C.y(p)); C.dot.style.opacity='1';
  });
}
function hideAnCursor(){
  ['speed','hr','elev','power','decouple','cadence','steplen'].forEach(k=>{ const C=AN_CHARTS[k]; if(C&&C.line){ C.line.style.opacity='0'; C.dot.style.opacity='0'; } });
  const tip=document.getElementById('anTip'); if(tip) tip.style.opacity='0';
}
/* tooltip avec toutes les valeurs au point i (temps exact + vitesse + FC + alt) */
function showAnTip(evt, i){
  let tip=document.getElementById('anTip');
  if(!tip){ tip=document.createElement('div'); tip.id='anTip'; document.body.appendChild(tip);
    tip.style.cssText='position:fixed;z-index:90;pointer-events:none;background:var(--panel-2);border:1px solid var(--line-strong);'+
      'border-radius:var(--radius-sm);padding:9px 12px;font-family:var(--font-data);font-size:12px;box-shadow:0 10px 30px rgba(0,0,0,.5);'+
      'opacity:0;transition:opacity .1s;white-space:nowrap'; }
  const sp=AN_CHARTS.speed, hr=AN_CHARTS.hr, el=AN_CHARTS.elev, pw=AN_CHARTS.power;
  const p=(sp||hr).pts[i];
  let html=`<div style="color:var(--muted);margin-bottom:4px">⏱ ${fmtClock(p.t)}</div>`;
  if(sp) html+=`<div style="color:var(--swim);font-weight:700">${sp.label(p)}</div>`;
  if(pw) html+=`<div style="color:var(--bike);font-weight:700">${pw.label(p)}</div>`;
  if(hr) html+=`<div style="color:var(--run);font-weight:700">${hr.label(p)}</div>`;
  if(el) html+=`<div style="color:var(--bike)">${Math.round(p.alt)} m · pente ${p.grade>0?'+':''}${p.grade.toFixed(1)}%</div>`;
  const dcc=AN_CHARTS.decouple; if(dcc&&p._dr) html+=`<div style="color:var(--accent)">éff. ${dcc.label(p)}</div>`;
  const cad=AN_CHARTS.cadence; if(cad&&p._cadReal) html+=`<div style="color:var(--accent)">${cad.label(p)}</div>`;
  const stl=AN_CHARTS.steplen; if(stl&&p.stepLen) html+=`<div style="color:var(--strength)">${stl.label(p)}</div>`;
  tip.innerHTML=html;
  const x=(evt.clientX!==undefined?evt.clientX:evt.touches[0].clientX)+14;
  const y=(evt.clientY!==undefined?evt.clientY:evt.touches[0].clientY)+14;
  tip.style.left=Math.min(x, window.innerWidth-160)+'px';
  tip.style.top=y+'px'; tip.style.opacity='1';
}

/* allure /100m (natation) : vitesse km/h → temps pour 100m */
function paceFromSpeed2(kmh){ if(kmh<=0) return '—'; const s=360/kmh; return Math.floor(s/60)+"'"+String(Math.round(s%60)).padStart(2,'0')+'"'; }


function drawElevation(data){
  const svg=document.getElementById('anElev'); svg.innerHTML='';
  const W=720,H=150,P={l:44,r:14,t:10,b:20};
  const pts=data.pts;
  const xs=i=>P.l+i/(pts.length-1)*(W-P.l-P.r);
  const aMax=Math.max(...pts.map(p=>p.alt))+5, aMin=Math.min(...pts.map(p=>p.alt))-5;
  const y=v=>H-P.b-(v-aMin)/(aMax-aMin)*(H-P.t-P.b);
  let path='',area='';
  pts.forEach((p,i)=>{ const x=xs(i),yy=y(p.alt); path+=(i?'L':'M')+x+' '+yy; });
  area=path+`L${xs(pts.length-1)} ${H-P.b}L${P.l} ${H-P.b}Z`;
  // dégradé selon pente : on colore l'aire en bike/run
  svg.insertAdjacentHTML('beforeend',`<path d="${area}" fill="var(--bike)" opacity="0.14"/>`);
  svg.insertAdjacentHTML('beforeend',`<path d="${path}" fill="none" stroke="var(--bike)" stroke-width="1.8"/>`);
  [aMin,aMax].forEach(v=>{ svg.insertAdjacentHTML('beforeend',`<text x="${P.l-6}" y="${y(v)+3}" fill="var(--muted)" font-size="9" font-family="var(--font-data)" text-anchor="end">${Math.round(v)}m</text>`); });
  svg.insertAdjacentHTML('beforeend',`<text x="${W-P.r}" y="${H-6}" fill="var(--muted)" font-size="9" font-family="var(--font-data)" text-anchor="end">D+ total ${data.dplus} m</text>`);
  AN_CHARTS.elev = {svg, pts, W, H, P, xs, y:(p)=>y(p.alt), color:'var(--bike)', label:(p)=>`${Math.round(p.alt)} m`};
  attachCursor('elev');
}

/* — Biomécanique (fréquence de foulée, longueur de foulée) —
   N'invente rien : si le fichier importé/synchronisé ne contient pas ces
   champs (pas de capteur de dynamiques de course sur la montre), on affiche
   un message clair au lieu d'un graphe vide ou de données estimées. */
function drawCadence(data){
  const svg=document.getElementById('anCadence'), na=document.getElementById('anCadenceNA');
  const pts=data.pts;
  if(!pts.some(p=>p.cad>0)){ svg.style.display='none'; na.style.display=''; delete AN_CHARTS.cadence; return; }
  na.style.display='none'; svg.style.display=''; svg.innerHTML='';
  const unit = data.disc==='run' ? 'pas/min' : 'rpm';
  pts.forEach(p=>{ p._cadReal = data.disc==='run' ? (p.cad||0)*2 : (p.cad||0); });
  const W=720,H=150,P={l:44,r:14,t:10,b:20};
  const xs=i=>P.l+i/(pts.length-1)*(W-P.l-P.r);
  const vals=pts.map(p=>p._cadReal).filter(v=>v>0);
  const vMax=Math.max(...vals)+8, vMin=Math.max(0,Math.min(...vals)-8);
  const y=v=>H-P.b-(v-vMin)/(vMax-vMin)*(H-P.t-P.b);
  let path='';
  pts.forEach((p,i)=>{ const x=xs(i),yy=y(p._cadReal||vMin); path+=(i?'L':'M')+x+' '+yy; });
  const area=path+`L${xs(pts.length-1)} ${H-P.b}L${P.l} ${H-P.b}Z`;
  svg.insertAdjacentHTML('beforeend',`<path d="${area}" fill="var(--accent)" opacity="0.12"/>`);
  svg.insertAdjacentHTML('beforeend',`<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="1.8"/>`);
  [vMin,vMax].forEach(v=>{ svg.insertAdjacentHTML('beforeend',`<text x="${P.l-6}" y="${y(v)+3}" fill="var(--muted)" font-size="9" font-family="var(--font-data)" text-anchor="end">${Math.round(v)}</text>`); });
  svg.insertAdjacentHTML('beforeend',`<text x="${W-P.r}" y="11" fill="var(--muted)" font-size="9" font-family="var(--font-data)" text-anchor="end">${unit}</text>`);
  AN_CHARTS.cadence = {svg, pts, W, H, P, xs, y:(p)=>y(p._cadReal||vMin), color:'var(--accent)', label:(p)=>`${Math.round(p._cadReal)} ${unit}`};
  attachCursor('cadence');
}
function drawStepLen(data){
  const svg=document.getElementById('anStepLen'), na=document.getElementById('anStepLenNA');
  const pts=data.pts;
  if(!pts.some(p=>p.stepLen>0)){ svg.style.display='none'; na.style.display=''; delete AN_CHARTS.steplen; return; }
  na.style.display='none'; svg.style.display=''; svg.innerHTML='';
  const W=720,H=150,P={l:44,r:14,t:10,b:20};
  const xs=i=>P.l+i/(pts.length-1)*(W-P.l-P.r);
  const vals=pts.map(p=>p.stepLen).filter(v=>v>0);
  const vMax=Math.max(...vals)+0.15, vMin=Math.max(0,Math.min(...vals)-0.15);
  const y=v=>H-P.b-(v-vMin)/(vMax-vMin)*(H-P.t-P.b);
  let path='';
  pts.forEach((p,i)=>{ const x=xs(i),yy=y(p.stepLen||vMin); path+=(i?'L':'M')+x+' '+yy; });
  const area=path+`L${xs(pts.length-1)} ${H-P.b}L${P.l} ${H-P.b}Z`;
  svg.insertAdjacentHTML('beforeend',`<path d="${area}" fill="var(--strength)" opacity="0.14"/>`);
  svg.insertAdjacentHTML('beforeend',`<path d="${path}" fill="none" stroke="var(--strength)" stroke-width="1.8"/>`);
  [vMin,vMax].forEach(v=>{ svg.insertAdjacentHTML('beforeend',`<text x="${P.l-6}" y="${y(v)+3}" fill="var(--muted)" font-size="9" font-family="var(--font-data)" text-anchor="end">${v.toFixed(2)}m</text>`); });
  svg.insertAdjacentHTML('beforeend',`<text x="${W-P.r}" y="11" fill="var(--muted)" font-size="9" font-family="var(--font-data)" text-anchor="end">m</text>`);
  AN_CHARTS.steplen = {svg, pts, W, H, P, xs, y:(p)=>y(p.stepLen||vMin), color:'var(--strength)', label:(p)=>`${p.stepLen?.toFixed(2)} m foulée`};
  attachCursor('steplen');
}

/* ---- Détail par lap façon Nolio : colonnes cochables. Vélo = temps, distance,
   vitesse, FC, watts, watts normalisés (NP), zone colorée, IF, W/kg, cadence,
   kJ, FC max, D+, température. Choix mémorisé (localStorage) par discipline. ---- */
function fmtLapTime(min){ const s=Math.round(min*60), m=Math.floor(s/60), x=s%60; return `${m}'${String(x).padStart(2,'0')}"`; }
function lapFTPval(){ return (typeof ATHLETE_REF!=='undefined'&&ATHLETE_REF&&ATHLETE_REF.ftp)?ATHLETE_REF.ftp:(STRAVA_DEMO.ftp?STRAVA_DEMO.ftp.at(-1):270); }
function lapWeightVal(){ return STRAVA_DEMO.weightKg||70; }
function lapZone(power){
  const p=power/lapFTPval()*100;
  const Z=[[55,'#39E6A3','Z1'],[75,'#2FD9FF','Z2'],[90,'#9D7BFF','Z3'],[105,'#FFB13D','Z4'],[150,'#FF5470','Z5']];
  for(const [lim,c,z] of Z) if(p<=lim) return {z,c};
  return {z:'Z6',c:'#FF5470'};
}
function colApplies(app,disc){ if(app==='all')return true; if(app[0]==='!')return disc!==app.slice(1); return app===disc; }
const LAP_COLS = [
  {key:'time', label:'Temps', def:1, app:'all', v:l=>fmtLapTime(l.durMin)},
  {key:'dist', label:'Distance', def:1, app:'all', v:l=>l.dist.toFixed(2)+'<small> km</small>'},
  {key:'speed',label:d=>d==='bike'?'Vitesse':'Allure', def:1, app:'all', v:(l,_,d)=>d==='bike'?l.avgSpeed.toFixed(1)+'<small> km/h</small>':(d==='run'?paceFromSpeed(l.avgSpeed)+'<small>/km</small>':paceFromSpeed2(l.avgSpeed)+'<small>/100m</small>')},
  {key:'hr',   label:'FC', def:1, app:'all', v:l=>`<b style="color:var(--run)">${l.avgHr}</b><small> bpm</small>`},
  {key:'pw',   label:'Watts', def:1, app:'bike', v:l=>`<b style="color:var(--bike)">${l.avgPower}</b><small> W</small>`},
  {key:'np',   label:'NP', def:1, app:'bike', v:l=>`<b>${l.np}</b><small> W</small>`},
  {key:'zone', label:'Zone', def:1, app:'bike', v:l=>{const z=lapZone(l.np);return `<span class="zbadge" style="background:${z.c}22;color:${z.c};border-color:${z.c}66">${z.z}</span>`;}},
  {key:'if',   label:'IF', def:0, app:'bike', v:l=>l.if.toFixed(2)},
  {key:'wkg',  label:'W/kg', def:0, app:'bike', v:l=>(l.avgPower/lapWeightVal()).toFixed(1)},
  {key:'cad',  label:'Cadence', def:0, app:'bike', v:l=>`${l.cad}<small> rpm</small>`},
  {key:'kj',   label:'kJ', def:0, app:'bike', v:l=>l.kj},
  {key:'hrmax',label:'FC max', def:0, app:'all', v:l=>`${l.maxHr}<small> bpm</small>`},
  {key:'vap',  label:'VAP', def:0, app:'!bike', v:(l,_,d)=>d==='swim'?paceFromSpeed2(l.avgGap)+'<small>/100m</small>':paceFromSpeed(l.avgGap)+'<small>/km</small>'},
  {key:'dplus',label:'D+', def:0, app:'!swim', v:l=>`${l.dplus}<small> m</small>`},
  {key:'temp', label:'Temp.', def:0, app:'all', v:(l,data)=>`${data.cond.temp}<small>°C</small>`},
];
function injectLapCss(){
  if(document.getElementById('pf-lap-css')) return;
  const st=document.createElement('style'); st.id='pf-lap-css';
  st.textContent=`
  .an-laps .lapcols{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
  .lapcol{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--muted);border:1px solid var(--line-strong);background:var(--panel-2);border-radius:99px;padding:5px 10px;cursor:pointer;user-select:none}
  .lapcol:hover{color:var(--text)} .lapcol.on{color:var(--text);border-color:var(--accent);background:rgba(70,194,216,.10)}
  .lapcol .box{width:13px;height:13px;border-radius:4px;border:1.5px solid currentColor;display:grid;place-items:center;font-size:9px;line-height:1}
  .lapcol.on .box{background:var(--accent);border-color:var(--accent);color:#06222a}
  .an-laps .an-lap-row{display:grid;align-items:center;gap:8px;padding:8px 6px;border-bottom:1px solid var(--line)}
  .an-laps .an-lap-row.head{border-bottom:1px solid var(--line-strong)}
  .an-laps .an-lap-row.head span{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);text-align:right;font-weight:700}
  .an-laps .an-lap-row.head span:first-child{text-align:center}
  .an-laps .lapn{justify-self:center;width:22px;height:22px;display:grid;place-items:center;border-radius:6px;background:rgba(150,165,200,.12);font-family:var(--font-data);font-weight:700;font-size:12px}
  .an-laps .lapcell{text-align:right;font-size:12.5px;font-family:var(--font-data);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .an-laps .lapcell small{color:var(--muted);font-size:10px;font-family:var(--font-ui,inherit)}
  .zbadge{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;border:1px solid}`;
  document.head.appendChild(st);
}
function lapColSet(disc){
  try{ const s=JSON.parse(localStorage.getItem('pf_lapcols_'+disc)||'null'); if(s) return new Set(s); }catch(e){}
  return new Set(LAP_COLS.filter(c=>colApplies(c.app,disc)&&c.def).map(c=>c.key));
}
/* Vue graphique du détail par lap (barres allure/vitesse + FC, un groupe par
   lap) — complète le tableau "Détail par lap" par un visuel en un coup d'œil.
   Réutilise les mêmes laps déjà calculés (buildLaps / genSessionData), aucun
   nouveau découpage. */
function injectLapChartCss(){
  if(document.getElementById('pf-lapchart-css')) return;
  const st=document.createElement('style'); st.id='pf-lapchart-css';
  st.textContent=`
  .lap-chart{display:flex;gap:10px;align-items:flex-end;padding:14px 2px 0;overflow-x:auto}
  .lch-col{flex:1;min-width:60px;display:flex;flex-direction:column;align-items:center;gap:8px}
  .lch-bars{display:flex;gap:4px;align-items:flex-end;height:140px;width:100%;justify-content:center}
  .lch-bar{width:16px;border-radius:5px 5px 2px 2px;transition:height .2s;min-height:4px}
  .lch-bar.sp{background:var(--accent)}
  .lch-bar.sp.hard{background:var(--run)}
  .lch-bar.hr{background:rgba(255,84,112,.55)}
  .lch-vals{display:flex;flex-direction:column;align-items:center;font-family:var(--font-data);font-size:11px;gap:2px;text-align:center}
  .lch-sp{color:var(--accent);font-weight:700;white-space:nowrap}
  .lch-hr{color:var(--run)}
  .lch-hr small{color:var(--muted);font-family:var(--font-ui,inherit)}
  .lch-n{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}`;
  document.head.appendChild(st);
}
function renderLapChart(data){
  const box=document.getElementById('anLapChart'); if(!box) return;
  injectLapChartCss();
  const laps=data.laps, disc=data.disc;
  if(!laps || !laps.length){ box.innerHTML='<p class="hint">Pas assez de laps pour un visuel.</p>'; return; }
  const speedLbl=l=> disc==='bike' ? l.avgSpeed.toFixed(1)+' km/h' : (disc==='swim' ? paceFromSpeed2(l.avgSpeed)+'/100m' : paceFromSpeed(l.avgSpeed)+'/km');
  const maxSpeed=Math.max(...laps.map(l=>l.avgSpeed), 0.001);
  const maxHr=Math.max(...laps.map(l=>l.avgHr||0), 1);
  box.innerHTML=laps.map(l=>{
    const spH=Math.max(6, Math.round((l.avgSpeed/maxSpeed)*100));
    const hrH=l.avgHr ? Math.max(6, Math.round((l.avgHr/maxHr)*100)) : 4;
    return `<div class="lch-col">
      <div class="lch-bars">
        <div class="lch-bar sp ${l.hard?'hard':''}" style="height:${spH}%" title="Allure/vitesse — lap ${l.n}"></div>
        <div class="lch-bar hr" style="height:${hrH}%" title="FC moyenne — lap ${l.n}"></div>
      </div>
      <div class="lch-vals">
        <span class="lch-sp">${speedLbl(l)}</span>
        <span class="lch-hr">${l.avgHr || '—'}<small> bpm</small></span>
      </div>
      <div class="lch-n">Lap ${l.n} · ${l.dist.toFixed(2)} km</div>
    </div>`;
  }).join('');
}
function renderLaps(data, isSwim){
  const box=document.getElementById('anLaps'); const disc=data.disc; injectLapCss();
  document.getElementById('anLapHint').textContent = (isSwim?'par série':'splits automatiques')+' · colonnes au choix';
  const cols=LAP_COLS.filter(c=>colApplies(c.app,disc));
  const sel=lapColSet(disc);
  const lbl=c=>typeof c.label==='function'?c.label(disc):c.label;
  const tools=cols.map(c=>`<button class="lapcol ${sel.has(c.key)?'on':''}" data-k="${c.key}"><span class="box">${sel.has(c.key)?'<i class="ic ic-check"></i>':''}</span>${lbl(c)}</button>`).join('');
  const vis=cols.filter(c=>sel.has(c.key));
  const grid=`grid-template-columns:30px repeat(${vis.length||1}, minmax(0,1fr))`;
  const head=`<div class="an-lap-row head" style="${grid}"><span>#</span>${vis.map(c=>`<span>${lbl(c)}</span>`).join('')}</div>`;
  const rows=data.laps.map(l=>`<div class="an-lap-row" style="${grid}"><span class="lapn" style="${l.hard?'background:rgba(255,84,112,.22);color:var(--run)':''}">${l.n}</span>${vis.map(c=>`<span class="lapcell">${c.v(l,data,disc)}</span>`).join('')}</div>`).join('');
  box.innerHTML=`<div class="lapcols">${tools}</div>`+head+rows;
  box.querySelectorAll('.lapcol').forEach(b=>b.onclick=()=>{
    const k=b.dataset.k; sel.has(k)?sel.delete(k):sel.add(k);
    try{ localStorage.setItem('pf_lapcols_'+disc, JSON.stringify([...sel])); }catch(e){}
    renderLaps(data, isSwim);
  });
}

document.getElementById('analysisClose').addEventListener('click', ()=> analysisOverlay.classList.remove('open'));
analysisOverlay.addEventListener('click', e=>{ if(e.target===analysisOverlay) analysisOverlay.classList.remove('open'); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') analysisOverlay.classList.remove('open'); });

/* petit toast de confirmation — différencié par sévérité (audit 03/08/2026:
   succès/erreur avaient exactement le même style visuel). type = 'ok' (déf.)
   | 'error' | 'warn'. Rétrocompatible : tout appel toast(msg) existant sans
   2e argument garde l'apparence par défaut (liseré vert, comme avant mais
   désormais explicite plutôt qu'absent). */
function toast(msg, type='ok'){
  let t=document.getElementById('apexToast');
  if(!t){ t=document.createElement('div'); t.id='apexToast'; document.body.appendChild(t);
    t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);z-index:80;'+
      'background:var(--panel-2);border:1px solid var(--line-strong);border-left:4px solid var(--good);border-radius:12px;padding:13px 20px;'+
      'font-size:14px;font-weight:600;color:var(--text);box-shadow:0 12px 34px rgba(0,0,0,.5);opacity:0;transition:.25s';
  }
  const TOAST_COLORS={ok:'var(--good)', error:'var(--run)', warn:'var(--bike)'};
  t.style.borderLeftColor=TOAST_COLORS[type]||TOAST_COLORS.ok;
  t.textContent=msg; requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; });
  clearTimeout(t._h); t._h=setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(20px)'; }, 2200);
}


/* ============================================================
   ANALYTICS — graphiques SVG sur mesure
   Branchez l'API Strava : remplacez STRAVA_DEMO par vos données
   via loadStravaData(activities) ci-dessous.
   ============================================================ */
const STRAVA_DEMO = {
  // 8 dernières semaines ; les 3 dernières (S22/23/24) = données iDO réelles
  weeks: ['S17','S18','S19','S20','S21','S22','S23','S24'],
  hrAvg:     [142, 144, 146, 145, 148, 149, 151, 153],
  /* Distances réelles par discipline (km). Natation iDO en durée → estimée ~3km/h. */
  distSwim:  [6,   7,   6,   8,   7,   5,   9,   11],            // km nage
  distBike:  [70,  90,  85, 120, 100, 121, 116, 251],           // km vélo (S24 énorme : prépa)
  distRun:   [28,  32,  30,  38,  34,  21,  62,  58],           // km course
  /* CTL/ATL reconstitués à partir des TSS hebdo réels : 388 / 879 / 1867 sur S22-23-24 */
  ctl:       [48,  50,  52,  55,  56,  57,  64,  78],
  atl:       [50,  53,  49,  62,  55,  52,  79,  118],          // ATL S24 très haut = grosse charge récente
  /* Puissance vélo réelle : FTP 310 W, PMA 415 W (valeurs athlète) */
  ftp:       [292, 296, 300, 302, 305, 306, 308, 310],          // watts → 310 réel
  pma:       [395, 399, 403, 406, 409, 411, 413, 415],          // watts → 415 réel
  weightKg:  70,
  physio: [
    {k:'VO2max estimé', v:'71.0', u:'ml/kg/min', t:'▲ +1.6 / 8 sem.', up:true, c:'var(--run)'},
    {k:'FTP / poids',   v:'4.43', u:'W/kg',      t:'▲ +0.26',         up:true, c:'var(--bike)'},
    {k:'PMA / poids',   v:'5.93', u:'W/kg',      t:'▲ +0.29',         up:true, c:'var(--strength)'},
    {k:'Seuil course',  v:"3'30\"", u:'/km LT2',  t:'▲ -8"/km',        up:true, c:'var(--run)'},
    {k:'VMA estimée',   v:'20.3', u:'km/h',      t:'▲ +0.4',          up:true, c:'var(--run)'},
    {k:'Efficacité (EF)', v:'2.18', u:'W/bpm',   t:'▲ +0.09',         up:true, c:'var(--good)'}
  ],
  hrZones:   [{z:'Z1 Récup', pct:16, c:'#39E6A3'},
              {z:'Z2 Endurance', pct:52, c:'#2FD9FF'},
              {z:'Z3 Tempo', pct:14, c:'#9D7BFF'},
              {z:'Z4 Seuil', pct:11, c:'#FFB13D'},
              {z:'Z5 VO2max', pct:7, c:'#FF5470'}],

  /* ============================================================
     TESTS LACTATE — REMPLACE PAR TES VRAIS RÉSULTATS DE TEST
     Chaque palier : {x: intensité, lac: lactate mmol/L, fc: bpm}
     - course : x = vitesse en km/h
     - vélo   : x = puissance en watts
     sv1 / sv2 = seuils identifiés (valeur sur l'axe x)
     Valeurs ci-dessous = démo calée sur ton niveau (à écraser).
     ============================================================ */
  lactateRun: {
    unit:'km/h', xlabel:'Vitesse (km/h)',
    paliers:[
      {x:12.0, lac:0.9, fc:135}, {x:13.0, lac:1.1, fc:142}, {x:14.0, lac:1.3, fc:149},
      {x:15.0, lac:1.6, fc:156}, {x:16.0, lac:2.0, fc:162}, {x:16.7, lac:2.8, fc:168},
      {x:17.1, lac:4.0, fc:172}, {x:18.0, lac:6.0, fc:178}, {x:18.9, lac:8.4, fc:184}
    ],
    sv1:16.0, sv2:17.1,
    sv1lbl:"16,0 km/h · 3'45\"/km", sv2lbl:"17,1 km/h · 3'30\"/km"
  },
  lactateBike: {
    unit:'W', xlabel:'Puissance (W)',
    paliers:[
      {x:180, lac:0.8, fc:122}, {x:210, lac:1.0, fc:132}, {x:240, lac:1.5, fc:143},
      {x:247, lac:2.0, fc:148}, {x:255, lac:2.5, fc:153}, {x:265, lac:3.2, fc:160},
      {x:270, lac:4.0, fc:164}, {x:285, lac:5.8, fc:171}, {x:300, lac:8.0, fc:178}
    ],
    sv1:247, sv2:270,
    sv1lbl:"247 W · LT1", sv2lbl:"270 W · LT2"
  }
};

const tooltip = document.getElementById('tooltip');
function tipShow(e, html){ tooltip.innerHTML=html; tooltip.classList.add('show');
  tooltip.style.left=(e.clientX+14)+'px'; tooltip.style.top=(e.clientY-10)+'px'; }
function tipHide(){ tooltip.classList.remove('show') }

const NS='http://www.w3.org/2000/svg';
function el(tag, attrs, parent){
  const n=document.createElementNS(NS,tag);
  for(const k in attrs) n.setAttribute(k,attrs[k]);
  if(parent) parent.appendChild(n);
  return n;
}
/* courbe lissée (Catmull-Rom -> Bézier) */
function smoothPath(pts){
  if(pts.length<2) return '';
  let d=`M${pts[0][0]},${pts[0][1]}`;
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[Math.max(0,i-1)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(pts.length-1,i+2)];
    const c1=[p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6];
    const c2=[p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6];
    d+=` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}
/* ---- 1b. FTP & PMA — double courbe watts ---- */
/* ============================================================
   CURSEUR SYNCHRONISÉ entre les graphes temporels (#4 finition)
   ------------------------------------------------------------
   FTP&PMA, Distance hebdo et Charge&forme partagent les mêmes 8
   semaines. Survoler une semaine sur l'un place un curseur à la même
   semaine sur TOUS — on lit les 3 graphes d'un coup pour un instant T.
   ============================================================ */
const TSYNC = {
  charts: [],
  register(centerFn, cursor){ this.charts.push({centerFn, cursor}); },
  hover(i){ this.charts.forEach(c=>{ const x=c.centerFn(i); if(x==null||isNaN(x)) return; c.cursor.setAttribute('x1',x); c.cursor.setAttribute('x2',x); c.cursor.style.opacity=1; }); },
  clear(){ this.charts.forEach(c=> c.cursor.style.opacity=0); }
};
function tsyncCursor(svg, P, H){
  const cur=el('line',{x1:0,x2:0,y1:P.t,y2:H-P.b,stroke:'rgba(255,255,255,.4)','stroke-dasharray':'3 3','pointer-events':'none'},svg);
  cur.style.opacity=0; svg.addEventListener('mouseleave', ()=>TSYNC.clear()); return cur;
}

(function ftpChart(){
  const svg = document.getElementById('ftpChart');
  const W=460,H=220,P={l:44,r:14,t:16,b:28};
  const {weeks,ftp,pma,weightKg}=STRAVA_DEMO;
  const all=[...ftp,...pma];
  const min=Math.min(...all)-12, max=Math.max(...all)+12;
  const x=i=>P.l+i*(W-P.l-P.r)/(weeks.length-1);
  const y=v=>H-P.b-(v-min)/(max-min)*(H-P.t-P.b);
  const defs=el('defs',{},svg);
  const f=el('filter',{id:'glowF',x:'-40%',y:'-40%',width:'180%',height:'180%'},defs);
  el('feGaussianBlur',{stdDeviation:3.5,result:'b'},f);
  const m=el('feMerge',{},f); el('feMergeNode',{in:'b'},m); el('feMergeNode',{in:'SourceGraphic'},m);
  for(let g=0;g<4;g++){
    const v=min+(max-min)*g/3, yv=y(v);
    el('line',{x1:P.l,x2:W-P.r,y1:yv,y2:yv,class:'gridline'},svg);
    const t=el('text',{x:P.l-8,y:yv+3,class:'axis','text-anchor':'end'},svg);
    t.textContent=Math.round(v)+'W';
  }
  weeks.forEach((w,i)=>{const t=el('text',{x:x(i),y:H-9,class:'axis','text-anchor':'middle'},svg);t.textContent=w});
  const draw=(data,color,name)=>{
    const pts=data.map((v,i)=>[x(i),y(v)]);
    el('path',{d:smoothPath(pts),class:'glow-line draw',stroke:color,filter:'url(#glowF)'},svg);
    pts.forEach((p,i)=>{
      const c=el('circle',{cx:p[0],cy:p[1],r:3.5,fill:'#0D121E',stroke:color,'stroke-width':2,class:'dot'},svg);
      c.addEventListener('mousemove',e=>{ tipShow(e,`<b style="color:${color}">${name} ${data[i]}W</b> · ${weeks[i]} · ${(data[i]/weightKg).toFixed(2)} W/kg`); TSYNC.hover(i); });
      c.addEventListener('mouseleave',tipHide);
    });
  };
  const cur=tsyncCursor(svg,P,H); TSYNC.register(x,cur);
  draw(pma,'#9D7BFF','PMA');
  draw(ftp,'#FFB13D','FTP');
  document.getElementById('ftpNow').textContent = ftp.at(-1)+'W';
})();

/* ---- 1c. Profil physiologique ---- */
(function physio(){
  const grid = document.getElementById('physioGrid');
  if(!grid) return;
  STRAVA_DEMO.physio.forEach(p=>{
    const c = document.createElement('div');
    c.className='physio';
    c.style.setProperty('--c', p.c);
    c.innerHTML = `<div class="k">${p.k}</div>
                   <div class="v">${p.v}<em> ${p.u}</em></div>
                   <div class="t ${p.up?'up':''}">${p.t}</div>`;
    grid.appendChild(c);
  });
})();

/* ---- 2. Zones FC — barres horizontales lumineuses ---- */
function hrChart(){
  const svg=document.getElementById('hrChart');
  svg.innerHTML='';
  const W=460, rowH=38, P={l:96,r:54,t:14};
  STRAVA_DEMO.hrZones.forEach((z,i)=>{
    const yv=P.t+i*rowH+rowH/2;
    const t=el('text',{x:P.l-10,y:yv+4,class:'axis','text-anchor':'end','font-size':11},svg);
    t.textContent=z.z;
    el('rect',{x:P.l,y:yv-8,width:W-P.l-P.r,height:16,rx:8,fill:'rgba(148,163,196,.08)'},svg);
    const bar=el('rect',{x:P.l,y:yv-8,width:0,height:16,rx:8,fill:z.c,class:'zone-bar',opacity:.92},svg);
    bar.style.filter=`drop-shadow(0 0 8px ${z.c}66)`;
    requestAnimationFrame(()=> setTimeout(()=> bar.setAttribute('width',(W-P.l-P.r)*z.pct/100), 80+i*100));
    const pv=el('text',{x:W-P.r+8,y:yv+4,class:'axis','font-size':12,'font-weight':700,fill:z.c},svg);
    pv.textContent=z.pct+'%';
    bar.addEventListener('mousemove',e=>tipShow(e,`<b style="color:${z.c}">${z.z}</b> · ${z.pct}% du temps`));
    bar.addEventListener('mouseleave',tipHide);
  });
}
hrChart();

/* ---- 3. Distance hebdo — barres empilées arrondies ---- */
(function distChart(){
  const svg=document.getElementById('distChart');
  const W=460,H=240,P={l:38,r:10,t:16,b:28};
  const {weeks,distSwim,distBike,distRun}=STRAVA_DEMO;
  const totals=weeks.map((_,i)=>distSwim[i]*10+distBike[i]+distRun[i]);
  const max=Math.max(...totals)*1.08;
  const bw=(W-P.l-P.r)/weeks.length*0.52;
  const x=i=>P.l+(i+0.5)*(W-P.l-P.r)/weeks.length-bw/2;
  const h=v=>v/max*(H-P.t-P.b);
  for(let g=0;g<=3;g++){
    const yv=H-P.b-(H-P.t-P.b)*g/3;
    el('line',{x1:P.l,x2:W-P.r,y1:yv,y2:yv,class:'gridline'},svg);
    const t=el('text',{x:P.l-6,y:yv+3,class:'axis','text-anchor':'end'},svg);
    t.textContent=Math.round(max*g/3);
  }
  const cur=tsyncCursor(svg,P,H); TSYNC.register(i=>x(i)+bw/2, cur);
  weeks.forEach((w,i)=>{
    let yCur=H-P.b;
    const stack=[['Course',distRun[i],'#FF5470'],['Vélo',distBike[i],'#FFB13D'],['Natation ×10',distSwim[i]*10,'#2FD9FF']];
    stack.forEach(([name,v,c],k)=>{
      const hh=h(v);
      const r=el('rect',{x:x(i),y:yCur-hh,width:bw,height:Math.max(2,hh-2),rx:4,fill:c,opacity:.9},svg);
      r.style.filter=`drop-shadow(0 0 6px ${c}44)`;
      r.addEventListener('mousemove',e=>{ tipShow(e,`<b style="color:${c}">${name}</b> · ${name.includes('Natation')?(v/10).toFixed(1):v} km · ${w}`); TSYNC.hover(i); });
      r.addEventListener('mouseleave',tipHide);
      yCur-=hh;
    });
    const t=el('text',{x:x(i)+bw/2,y:H-9,class:'axis','text-anchor':'middle'},svg);
    t.textContent=w;
  });
})();

/* ============================================================
   BIOMÉCANIQUE DE COURSE — dynamiques de foulée (#élite)
   ------------------------------------------------------------
   Métriques issues d'un capteur de dynamique de course (Garmin
   Running Dynamics, Stryd, RunScribe…). En prod : lues du .FIT /
   de l'API. Ici valeurs de démonstration cohérentes (coureur
   entraîné). Zones de référence à la Garmin (repère, pas verdict).
   ============================================================ */
const RUN_DYN = {
  cadence:182, strideLen:1.34, gct:214, vertOsc:7.4, vertRatio:6.9,
  runPower:292, legStiff:10.4, dutyFactor:29.5,
  gctBalanceL:49.4, strideBalanceL:50.3, powerBalanceL:48.9,
  cadenceHist:[176,177,178,179,180,181,181,182],
  gctHist:[232,230,228,226,224,221,217,214]
};
const RUN_ZONES = {
  cadence:  {min:150, better:'high', zones:[['<163',163,'#FF5470'],['163-173',173,'#FFB13D'],['174-183',183,'#39E6A3'],['184-194',194,'#2FD9FF'],['≥195',210,'#9D7BFF']]},
  vertOsc:  {min:5,   better:'low',  zones:[['<6.4',6.4,'#9D7BFF'],['6.5-8.1',8.1,'#2FD9FF'],['8.2-10.1',10.1,'#39E6A3'],['10.2-11.8',11.8,'#FFB13D'],['>11.8',14,'#FF5470']]},
  vertRatio:{min:5,   better:'low',  zones:[['<6.1',6.1,'#9D7BFF'],['6.1-7.4',7.4,'#2FD9FF'],['7.5-8.6',8.6,'#39E6A3'],['8.7-10.1',10.1,'#FFB13D'],['>10.1',13,'#FF5470']]},
  gct:      {min:180, better:'low',  zones:[['<208',208,'#9D7BFF'],['208-240',240,'#2FD9FF'],['241-273',273,'#39E6A3'],['274-305',305,'#FFB13D'],['>305',330,'#FF5470']]}
};
function renderRunDynamics(){
  const box=document.getElementById('runDynBody'); if(!box) return;
  const metrics=[[tr('runDyn.cadence'),'cadence','pas/min'],[tr('runDyn.vertOsc'),'vertOsc','cm'],
    [tr('runDyn.vertRatio'),'vertRatio','%'],[tr('runDyn.gct'),'gct','ms']];
  box.innerHTML=metrics.map(([name,key,unit])=>{
    const z=RUN_ZONES[key], val=RUN_DYN[key];
    const sMin=z.min, sMax=z.zones[z.zones.length-1][1];
    let prev=sMin;
    const segs=z.zones.map(([,max,col])=>{ const w=(max-prev)/(sMax-sMin)*100; prev=max; return `<i style="width:${w}%;background:${col}"></i>`; }).join('');
    const markPct=Math.max(1,Math.min(99,(val-sMin)/(sMax-sMin)*100));
    const curZone=z.zones.find(zz=>val<=zz[1])||z.zones[z.zones.length-1];
    return `<div class="rd-metric">
      <div class="rd-top"><span class="rd-name">${name}<em>${z.better==='low'?tr('runDyn.lowerBetter'):tr('runDyn.higherBetter')}</em></span>
        <span class="rd-val" style="color:${curZone[2]}">${val}<small>${unit}</small></span></div>
      <div class="rd-bar">${segs}<span class="rd-mark" style="left:${markPct}%"></span></div>
    </div>`;
  }).join('');
}
function renderRunTiles(){
  const box=document.getElementById('runTilesBody'); if(!box) return;
  const tiles=[['Longueur de foulée','strideLen','m','à '+RUN_DYN.cadence+' pas/min'],
    ['Puissance de course','runPower','W','si capteur type Stryd']];
  box.innerHTML=tiles.map(([k,key,u,d])=>`<div class="rd-tile"><div class="k">${k}</div><div class="v">${RUN_DYN[key]}<small> ${u}</small></div><div class="d">${d}</div></div>`).join('');
}
function renderRunSymmetry(){
  const box=document.getElementById('runSymBody'); if(!box) return;
  const rows=[['Temps de contact au sol',RUN_DYN.gctBalanceL],['Longueur de foulée',RUN_DYN.strideBalanceL],['Puissance',RUN_DYN.powerBalanceL]];
  box.innerHTML=rows.map(([name,l])=>{ const r=100-l, dev=Math.abs(50-l);
    const st=dev<0.8?['équilibré','var(--good)']:dev<1.8?['léger déséquilibre','var(--bike)']:['à surveiller','var(--run)'];
    return `<div class="rd-sym"><div class="lbl"><span>${name}</span><span style="color:${st[1]}">${st[0]}</span></div>
      <div class="rd-symbar"><span class="l" style="width:${l}%"></span><span class="r" style="width:${r}%"></span><span class="mid"></span></div>
      <div class="rd-symlbl"><span>G ${l.toFixed(1)}%</span><span>${r.toFixed(1)}% D</span></div></div>`;
  }).join('');
}
renderRunDynamics(); renderRunTiles(); renderRunSymmetry();
/* Bascule "Afficher mes statistiques détaillées" (athlète seul, pas le coach) :
   pour les athlètes qui trouvent la section Analyse trop chargée, un seul
   interrupteur masque tout (graphiques + filtres), persisté localStorage. */
(function initAthStatsToggle(){
  const cb=document.getElementById('athStatsToggle'); if(!cb) return;
  const KEY='sil_ath_stats_show';
  const show = localStorage.getItem(KEY) !== 'off';
  cb.checked = show;
  document.body.classList.toggle('ath-stats-off', !show);
  cb.onchange=()=>{
    localStorage.setItem(KEY, cb.checked ? 'on' : 'off');
    document.body.classList.toggle('ath-stats-off', !cb.checked);
  };
})();
/* Filtres d'analyse GROUPÉS par catégorie (Charge & puissance / Physio /
   Biomécanique / Hyrox) → l'utilisateur coche ce qu'il affiche. Persisté. */
(function initChartFilter(){
  const box=document.getElementById('chartFilter'); if(!box) return;
  const CATS=[['charge',tr('chartCat.charge')],['physio',tr('chartCat.physio')],['biomeca',tr('chartCat.biomeca')],['hyrox',tr('chartCat.hyrox')]];
  const REG=[
    {key:'loadstack', get label(){return tr('chart.loadstack')},   a:'loadStackChart', cat:'charge'},
    {key:'load',      get label(){return tr('chart.load')},   a:'loadChart',      cat:'charge'},
    {key:'ftp',       get label(){return tr('chart.ftp')},        a:'ftpChart',       cat:'charge'},
    {key:'dist',      get label(){return tr('chart.dist')},   a:'distChart',      cat:'charge'},
    {key:'mmp',       get label(){return tr('chart.mmp')},  a:'mmpChart',       cat:'charge'},
    {key:'durab',     get label(){return tr('chart.durab')},       a:'durabChart',     cat:'charge'},
    {key:'loadmix',   get label(){return tr('chart.loadmix')},a:'loadMixBody',    cat:'charge'},
    {key:'hr',        get label(){return tr('chart.hr')},         a:'hrChart',        cat:'physio'},
    {key:'lactate',   get label(){return tr('chart.lactate')}, a:'lactateBike',    cat:'physio'},
    {key:'runDyn',    get label(){return tr('chart.runDyn')}, a:'runDynBody', cat:'biomeca'},
    {key:'runTiles',  get label(){return tr('chart.runTiles')},   a:'runTilesBody', cat:'biomeca'},
    {key:'runSym',    get label(){return tr('chart.runSym')},     a:'runSymBody',     cat:'biomeca'},
    {key:'runTrend',  get label(){return tr('chart.runTrend')}, a:'runTrendChart',  cat:'biomeca'},
    {key:'hyrox',     get label(){return tr('chart.hyrox')},     a:'hyroxBody',      cat:'hyrox'},
  ];
  const DEFAULT=['loadstack','load','hr'];   // sélection de départ resserrée
  let sel; try{ sel=new Set(JSON.parse(localStorage.getItem('sil_chart_filter'))); if(!sel.size) sel=new Set(DEFAULT); }
  catch(e){ sel=new Set(DEFAULT); }
  const cards={};
  REG.forEach(r=>{ const n=document.getElementById(r.a); const c=n&&n.closest('.chart-card'); if(c){ c.dataset.chart=r.key; cards[r.key]=c; } });
  const save=()=>{ try{ localStorage.setItem('sil_chart_filter', JSON.stringify([...sel])); }catch(e){} };
  const apply=()=>{
    REG.forEach(r=>{ if(cards[r.key]) cards[r.key].classList.toggle('c-hidden', !sel.has(r.key)); });
    box.querySelectorAll('.cf-chip').forEach(ch=>{ const on=sel.has(ch.dataset.key); ch.classList.toggle('on',on); ch.setAttribute('aria-pressed',on); });
    if(sel.has('loadstack')){ const sc=document.getElementById('loadStackScroll'); if(sc) requestAnimationFrame(()=>{ sc.scrollLeft=sc.scrollWidth; }); }
  };
  box.innerHTML = CATS.map(([ck,cl])=>{
    const items=REG.filter(r=>r.cat===ck && cards[r.key]); if(!items.length) return '';
    return `<div class="cf-cat"><span class="cf-cat-lbl">${cl}</span>`+
      items.map(r=>`<button type="button" class="cf-chip" data-key="${r.key}" aria-pressed="false"><span class="cf-box"><i class="ic ic-check"></i></span>${r.label}</button>`).join('')+
      `</div>`;
  }).join('') + `<div class="cf-actions"><button type="button" class="cf-all" id="cfAll">Tout</button><button type="button" class="cf-all" id="cfNone">Aucun</button></div>`;
  box.querySelectorAll('.cf-chip').forEach(ch=> ch.onclick=()=>{ const k=ch.dataset.key; sel.has(k)?sel.delete(k):sel.add(k); apply(); save(); });
  box.querySelector('#cfAll').onclick=()=>{ REG.forEach(r=>{ if(cards[r.key]) sel.add(r.key); }); apply(); save(); };
  box.querySelector('#cfNone').onclick=()=>{ sel.clear(); apply(); save(); };
  apply();
})();
(function drawRunTrend(){
  const svg=document.getElementById('runTrendChart'); if(!svg) return;
  const {weeks}=STRAVA_DEMO, cad=RUN_DYN.cadenceHist, gct=RUN_DYN.gctHist;
  const W=460,H=220,P={l:38,r:40,t:16,b:28};
  const x=i=>P.l+i*(W-P.l-P.r)/(weeks.length-1);
  const cMin=Math.min(...cad)-3,cMax=Math.max(...cad)+3, gMin=Math.min(...gct)-6,gMax=Math.max(...gct)+6;
  const yC=v=>H-P.b-(v-cMin)/(cMax-cMin)*(H-P.t-P.b);
  const yG=v=>H-P.b-(v-gMin)/(gMax-gMin)*(H-P.t-P.b);
  for(let g=0;g<=3;g++){ const yv=P.t+(H-P.t-P.b)*g/3; el('line',{x1:P.l,x2:W-P.r,y1:yv,y2:yv,class:'gridline'},svg); }
  weeks.forEach((w,i)=> el('text',{x:x(i),y:H-9,class:'axis','text-anchor':'middle'},svg).textContent=w);
  const draw=(data,yfn,color,name,unit)=>{ const pts=data.map((v,i)=>[x(i),yfn(v)]);
    el('path',{d:smoothPath(pts),fill:'none',stroke:color,'stroke-width':2.2},svg);
    pts.forEach((p,i)=>{ const c=el('circle',{cx:p[0],cy:p[1],r:3,fill:'#0D121E',stroke:color,'stroke-width':2},svg);
      c.addEventListener('mousemove',e=>tipShow(e,`<b style="color:${color}">${name} ${data[i]} ${unit}</b> · ${weeks[i]}`)); c.addEventListener('mouseleave',tipHide); }); };
  draw(cad,yC,'#2FD9FF','Cadence','pas/min');
  draw(gct,yG,'#DD5C72','Contact au sol','ms');
})();

/* ---- 4. Charge & forme — double courbe + bande optimale ---- */
(function loadChart(){
  const svg=document.getElementById('loadChart');
  const W=640,H=240,P={l:40,r:16,t:16,b:30};
  const {weeks,ctl,atl}=STRAVA_DEMO;
  const all=[...ctl,...atl];
  const min=Math.min(...all)-6, max=Math.max(...all)+6;
  const x=i=>P.l+i*(W-P.l-P.r)/(weeks.length-1);
  const y=v=>H-P.b-(v-min)/(max-min)*(H-P.t-P.b);
  const defs=el('defs',{},svg);
  const f=el('filter',{id:'glowL',x:'-40%',y:'-40%',width:'180%',height:'180%'},defs);
  el('feGaussianBlur',{stdDeviation:3.5,result:'b'},f);
  const mm=el('feMerge',{},f); el('feMergeNode',{in:'b'},mm); el('feMergeNode',{in:'SourceGraphic'},mm);

  // bande "forme optimale" (TSB entre -10 et +5 ≈ zone autour de CTL)
  el('rect',{x:P.l,y:y(72),width:W-P.l-P.r,height:y(58)-y(72),fill:'rgba(57,230,163,.07)',stroke:'rgba(57,230,163,.25)','stroke-dasharray':'4 4',rx:6},svg);

  for(let g=0;g<4;g++){
    const v=min+(max-min)*g/3, yv=y(v);
    el('line',{x1:P.l,x2:W-P.r,y1:yv,y2:yv,class:'gridline'},svg);
    const t=el('text',{x:P.l-8,y:yv+3,class:'axis','text-anchor':'end'},svg);
    t.textContent=Math.round(v);
  }
  weeks.forEach((w,i)=>{const t=el('text',{x:x(i),y:H-10,class:'axis','text-anchor':'middle'},svg);t.textContent=w});

  const draw=(data,color)=>{
    const pts=data.map((v,i)=>[x(i),y(v)]);
    el('path',{d:smoothPath(pts),class:'glow-line draw',stroke:color,filter:'url(#glowL)'},svg);
    pts.forEach((p,i)=>{
      const c=el('circle',{cx:p[0],cy:p[1],r:3.5,fill:'#0D121E',stroke:color,'stroke-width':2,class:'dot'},svg);
      c.addEventListener('mousemove',e=>{ tipShow(e,`<b style="color:${color}">${data===ctl?'Fitness':'Fatigue'} ${data[i]}</b> · ${weeks[i]} · TSB ${ctl[i]-atl[i]>=0?'+':''}${ctl[i]-atl[i]}`); TSYNC.hover(i); });
      c.addEventListener('mouseleave',tipHide);
    });
  };
  const cur=tsyncCursor(svg,P,H); TSYNC.register(x,cur);
  draw(atl,'#FF5470');
  draw(ctl,'#2FD9FF');
})();

/* ============================================================
   CHARGE CUMULÉE & SIGNAUX (#4 retour coach)
   ------------------------------------------------------------
   Barres empilées = charge hebdo par discipline, construite depuis
   LE CALENDRIER (planning) sur toute l'année → défilement horizontal.
   Séries cochables : Charge (barres), Fatigue (ATL), Risque (ACWR),
   Forme (TSB). Les lignes ATL/TSB montrent la tendance (valeurs au
   survol) ; l'ACWR garde une échelle fixe avec seuil 1.5. Curseur
   commun qui lit tous les signaux d'un coup.
   ============================================================ */
const LOAD_COLS={swim:'#46C2D8',bike:'#D9962F',run:'#DD5C72',strength:'#8E7FD0'};
const loadStackShow={ charge:true, fatigue:false, risque:true, forme:true };
let loadStackPeriod='week'; // 'week' | 'month' | 'year' — regroupement choisi par le coach
function weekMonday(d){ return addDays(d, -((d.getDay()+6)%7)); }

/* Regroupe les 52 semaines de buildLoadWeeks() par mois ou année si demandé.
   Charge/heures = somme (additive) ; fatigue/forme/risque = moyenne sur la
   période (ce sont des indices d'état, pas des quantités qui s'additionnent). */
function buildLoadPeriods(period){
  const weeks=buildLoadWeeks();
  if(period==='week') return weeks;
  const groups={}, order=[];
  weeks.forEach(w=>{
    const d=w.mon;
    const key = period==='month' ? (d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')) : String(d.getFullYear());
    if(!groups[key]){
      groups[key]={ wk:key, mon:d,
        label: period==='month' ? d.toLocaleDateString(localeStr(),{month:'short',year:'2-digit'}) : String(d.getFullYear()),
        load:{swim:0,bike:0,run:0,strength:0}, hours:0, total:0, _atl:0,_tsb:0,_acwr:0,_n:0 };
      order.push(key);
    }
    const g=groups[key];
    ['swim','bike','run','strength'].forEach(k=> g.load[k]+=w.load[k]);
    g.hours+=w.hours; g.total+=w.total; g.mon=d;
    g._atl+=w.atl; g._tsb+=w.tsb; g._acwr+=w.acwr; g._n++;
  });
  return order.map(k=>{ const g=groups[k];
    return { wk:g.wk, mon:g.mon, label:g.label, load:g.load, hours:g.hours, total:g.total,
      atl:Math.round(g._atl/g._n), tsb:Math.round(g._tsb/g._n), acwr:g._acwr/g._n }; });
}

/* Agrège la charge par semaine depuis le calendrier (planning). Complète les
   semaines sans données par un historique démo déterministe pour donner une
   année à défiler ; en usage réel, tout vient du planning. */
function buildLoadWeeks(){
  const DISCS=['swim','bike','run','strength'];
  const real={}, hoursReal={};
  for(const k in planning){
    const d=new Date(k+'T00:00:00'); if(isNaN(d)) continue;
    const wk=iso(weekMonday(d));
    (real[wk] || (real[wk]={swim:0,bike:0,run:0,strength:0}));
    (planning[k]||[]).forEach(s=>{ const disc=DISCS.includes(s.disc)?s.disc:'bike';
      real[wk][disc]+=(s.tss||0); hoursReal[wk]=(hoursReal[wk]||0)+(s.dur||0)/60; });
  }
  const realKeys=Object.keys(real).sort();
  const lastMon = realKeys.length ? new Date(realKeys[realKeys.length-1]+'T00:00:00') : weekMonday(new Date());
  const weeks=[];
  for(let i=51;i>=0;i--){
    const mon=addDays(lastMon,-i*7), wk=iso(mon);
    let load,hours;
    if(real[wk]){ load={...real[wk]}; hours=hoursReal[wk]||0; }
    else { const t=51-i, base=270+95*Math.sin(t/8)+((t*37)%55);
      load={swim:Math.round(base*0.12),bike:Math.round(base*0.5),run:Math.round(base*0.3),strength:Math.round(base*0.08)}; hours=base/45; }
    weeks.push({wk,mon,label:(mon.getDate()+'/'+(mon.getMonth()+1)),load,hours,
      total:load.swim+load.bike+load.run+load.strength});
  }
  let ctl=0,atl=0;
  weeks.forEach(w=>{ const daily=w.total/7; ctl+=(daily-ctl)*(1-Math.exp(-7/42)); atl+=(daily-atl)*(1-Math.exp(-7/7));
    w.ctl=Math.round(ctl); w.atl=Math.round(atl); w.tsb=Math.round(ctl-atl); });
  weeks.forEach((w,i)=>{ const from=Math.max(0,i-3); const ch=weeks.slice(from,i+1).reduce((a,b)=>a+b.total,0)/(i-from+1); w.acwr=ch?w.total/ch:1; });
  return weeks;
}

function drawLoadStack(){
  const svg=document.getElementById('loadStackChart'); if(!svg) return;
  svg.innerHTML='';
  const weeks=buildLoadPeriods(loadStackPeriod); const n=weeks.length;
  const colW=Math.max(26,Math.min(46,Math.round(900/n)));
  const W=Math.max(900, n*colW+90), H=320, P={l:46,r:52,t:18,b:40};
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`); svg.setAttribute('width',W); svg.setAttribute('height',H);
  const x=i=>P.l+(i+0.5)*(W-P.l-P.r)/n;
  const maxL=Math.max(...weeks.map(w=>w.total),100)*1.14;
  const yL=v=>H-P.b-(v/maxL)*(H-P.t-P.b);
  const aMin=0.5,aMax=2.0, yR=v=>H-P.b-((v-aMin)/(aMax-aMin))*(H-P.t-P.b);
  // échelle auto pour une série "tendance" (ATL / TSB)
  const trendScale=(vals)=>{ const mn=Math.min(...vals),mx=Math.max(...vals),pad=(mx-mn)*0.15||1;
    return v=> H-P.b-((v-(mn-pad))/((mx+pad)-(mn-pad)))*(H-P.t-P.b); };
  const bw=Math.min(colW*0.6,(W-P.l-P.r)/n*0.6);

  if(loadStackShow.risque){
    el('rect',{x:P.l,y:P.t,width:W-P.l-P.r,height:Math.max(0,yR(1.5)-P.t),fill:'rgba(255,84,112,.06)'},svg);
    el('rect',{x:P.l,y:yR(1.3),width:W-P.l-P.r,height:Math.max(0,yR(0.8)-yR(1.3)),fill:'rgba(57,230,163,.06)'},svg);
    el('line',{x1:P.l,x2:W-P.r,y1:yR(1.5),y2:yR(1.5),stroke:'rgba(255,84,112,.4)','stroke-dasharray':'5 4'},svg);
  }
  for(let g=0;g<=4;g++){ const v=maxL*g/4,yv=yL(v); el('line',{x1:P.l,x2:W-P.r,y1:yv,y2:yv,class:'gridline'},svg);
    el('text',{x:P.l-8,y:yv+3,class:'axis','text-anchor':'end'},svg).textContent=Math.round(v); }
  if(loadStackShow.risque) [0.8,1.0,1.5,2.0].forEach(v=> el('text',{x:W-P.r+8,y:yR(v)+3,class:'axis','text-anchor':'start',fill:LOAD_COLS.bike},svg).textContent=v.toFixed(1));

  // barres de charge empilées (une étiquette de semaine sur ~5 pour rester lisible)
  const step=Math.ceil(n/16);
  weeks.forEach((w,i)=>{
    if(loadStackShow.charge){ let acc=0;
      ['swim','bike','run','strength'].forEach(key=>{ const v=w.load[key];
        el('rect',{x:x(i)-bw/2,y:yL(acc+v),width:bw,height:(v/maxL)*(H-P.t-P.b),fill:LOAD_COLS[key],rx:1.5,opacity:.92},svg); acc+=v; }); }
    if(i%step===0) el('text',{x:x(i),y:H-12,class:'axis','text-anchor':'middle'},svg).textContent=w.label;
  });
  const line=(vals,yfn,color)=>{ const pts=vals.map((v,i)=>[x(i),yfn(v)]);
    el('path',{d:smoothPath(pts),fill:'none',stroke:color,'stroke-width':2.1,opacity:.95},svg); };
  if(loadStackShow.fatigue) line(weeks.map(w=>w.atl), trendScale(weeks.map(w=>w.atl)), '#FF5470');
  if(loadStackShow.forme)   line(weeks.map(w=>w.tsb), trendScale(weeks.map(w=>w.tsb)), '#39E6A3');
  if(loadStackShow.risque){ const pts=weeks.map((w,i)=>[x(i),yR(w.acwr)]);
    el('path',{d:smoothPath(pts),fill:'none',stroke:LOAD_COLS.bike,'stroke-width':2.2},svg); }

  // curseur commun + survol
  const cursor=el('line',{x1:0,x2:0,y1:P.t,y2:H-P.b,stroke:'rgba(255,255,255,.45)','stroke-dasharray':'3 3'},svg); cursor.style.opacity=0;
  weeks.forEach((w,i)=>{
    const cx=x(i);
    const hit=el('rect',{x:cx-(W-P.l-P.r)/n/2,y:P.t,width:(W-P.l-P.r)/n,height:H-P.t-P.b,fill:'transparent'},svg);
    hit.style.cursor='crosshair';
    hit.addEventListener('mousemove',e=>{
      cursor.setAttribute('x1',cx); cursor.setAttribute('x2',cx); cursor.style.opacity=1;
      const risk=w.acwr>1.5?'<span style="color:#FF5470">élevé</span>':w.acwr<0.8?'<span style="color:#FFB13D">sous-charge</span>':'<span style="color:#39E6A3">maîtrisé</span>';
      const dd=w.mon;
      const periodLbl = loadStackPeriod==='week' ? `Sem. ${dd.getDate()}/${dd.getMonth()+1}`
        : loadStackPeriod==='month' ? `Mois de ${dd.toLocaleDateString(localeStr(),{month:'long',year:'numeric'})}`
        : `Année ${dd.getFullYear()}`;
      tipShow(e,`<b>${periodLbl}</b> · charge <b>${w.total}</b> · <b>${w.hours.toFixed(1)} h</b><br>Nat ${w.load.swim} · Vélo ${w.load.bike} · Course ${w.load.run} · Renfo ${w.load.strength}<br>Fatigue ${w.atl} · Risque ACWR <b>${w.acwr.toFixed(2)}</b> (${risk}) · Forme ${w.tsb>=0?'+':''}${w.tsb}`);
    });
    hit.addEventListener('mouseleave',()=>{ cursor.style.opacity=0; tipHide(); });
  });
}

/* barre de séries cochables + rendu initial (défile en fin d'année) */
(function initLoadStack(){
  const box=document.getElementById('loadStackToggles'); if(!box) return;
  const items=[['charge','Charge',LOAD_COLS.bike],['fatigue','Fatigue (ATL)','#FF5470'],['risque','Risque (ACWR)',LOAD_COLS.bike],['forme','Forme (TSB)','#39E6A3']];
  box.innerHTML=items.map(([k,l,c])=>`<button class="ls-tog ${loadStackShow[k]?'on':''}" data-ls="${k}" style="--ls-c:${c}"><span class="sw"></span>${l}</button>`).join('');
  box.querySelectorAll('[data-ls]').forEach(b=> b.onclick=()=>{ const k=b.dataset.ls; loadStackShow[k]=!loadStackShow[k]; b.classList.toggle('on',loadStackShow[k]); drawLoadStack(); });

  // Regroupement Semaine / Mois / Année, choisi par le coach — persisté.
  const pbox=document.getElementById('loadStackPeriodTog');
  if(pbox){
    try{ const saved=localStorage.getItem('sil_loadstack_period'); if(saved) loadStackPeriod=saved; }catch(e){}
    const periods=[['week','Semaine'],['month','Mois'],['year','Année']];
    const renderPeriodTog=()=>{ pbox.innerHTML=periods.map(([k,l])=>`<button class="${loadStackPeriod===k?'on':''}" data-lsp="${k}">${l}</button>`).join('');
      pbox.querySelectorAll('[data-lsp]').forEach(b=> b.onclick=()=>{
        loadStackPeriod=b.dataset.lsp;
        try{ localStorage.setItem('sil_loadstack_period', loadStackPeriod); }catch(e){}
        renderPeriodTog(); drawLoadStack();
        const sc=document.getElementById('loadStackScroll'); if(sc) sc.scrollLeft=sc.scrollWidth;
      }); };
    renderPeriodTog();
  }

  drawLoadStack();
  const sc=document.getElementById('loadStackScroll'); if(sc) sc.scrollLeft=sc.scrollWidth;   // démarre sur la période récente
})();

/* ---- Courbes lactate (course + vélo) ---- */
function drawLactate(svgId, thId, data, lineColor){
  const svg = document.getElementById(svgId);
  if(!svg || !data) return;
  svg.innerHTML='';
  const W=460,H=250,P={l:42,r:14,t:16,b:40};
  const xs = data.paliers.map(p=>p.x), ys = data.paliers.map(p=>p.lac);
  const xmin=Math.min(...xs), xmax=Math.max(...xs);
  const ymax=Math.max(4, Math.ceil(Math.max(...ys)));
  const X=v=>P.l+(v-xmin)/(xmax-xmin)*(W-P.l-P.r);
  const Y=v=>H-P.b-(v/ymax)*(H-P.t-P.b);
  const defs=el('defs',{},svg);
  const f=el('filter',{id:svgId+'-glow',x:'-40%',y:'-40%',width:'180%',height:'180%'},defs);
  el('feGaussianBlur',{stdDeviation:3,result:'b'},f);
  const m=el('feMerge',{},f);el('feMergeNode',{in:'b'},m);el('feMergeNode',{in:'SourceGraphic'},m);

  // grille horizontale (lactate)
  for(let g=0;g<=ymax;g+=ymax<=4?1:2){
    const yv=Y(g);
    el('line',{x1:P.l,x2:W-P.r,y1:yv,y2:yv,class:'gridline'},svg);
    const t=el('text',{x:P.l-7,y:yv+3,class:'axis','text-anchor':'end'},svg);t.textContent=g;
  }
  // repères 2 mmol et 4 mmol (références classiques)
  [2,4].forEach(ref=>{
    if(ref<=ymax){const yv=Y(ref);
      el('line',{x1:P.l,x2:W-P.r,y1:yv,y2:yv,stroke:'rgba(255,177,61,.25)','stroke-width':1,'stroke-dasharray':'3 3'},svg);}
  });
  // axe x
  xs.forEach(v=>{const t=el('text',{x:X(v),y:H-22,class:'axis','text-anchor':'middle'},svg);t.textContent=v;});
  const xl=el('text',{x:(P.l+W-P.r)/2,y:H-6,class:'axis','text-anchor':'middle'},svg);
  xl.textContent=data.xlabel; xl.setAttribute('font-size','10');

  // bandes de zones via seuils
  const bands=[['rgba(57,230,163,.07)',xmin,data.sv1],['rgba(47,217,255,.05)',data.sv1,data.sv2],['rgba(255,84,112,.06)',data.sv2,xmax]];
  bands.forEach(([c,a,b])=>el('rect',{x:X(a),y:P.t,width:X(b)-X(a),height:H-P.t-P.b,fill:c},svg));

  // seuils verticaux SV1 / SV2
  [['sv1','#39E6A3',data.sv1],['sv2','#FFB13D',data.sv2]].forEach(([lbl,col,xv])=>{
    el('line',{x1:X(xv),x2:X(xv),y1:P.t,y2:H-P.b,stroke:col,'stroke-width':1.5,'stroke-dasharray':'4 3'},svg);
    const t=el('text',{x:X(xv),y:P.t+11,class:'axis','text-anchor':'middle',fill:col,'font-weight':700},svg);
    t.textContent=lbl.toUpperCase();
  });

  // courbe lissée
  const pts=data.paliers.map(p=>[X(p.x),Y(p.lac)]);
  el('path',{d:smoothPath(pts),class:'glow-line',stroke:lineColor,'stroke-width':2.5,filter:`url(#${svgId}-glow)`},svg);
  // points
  data.paliers.forEach((p,i)=>{
    const c=el('circle',{cx:pts[i][0],cy:pts[i][1],r:4,fill:'#0D121E',stroke:lineColor,'stroke-width':2,class:'dot'},svg);
    c.addEventListener('mousemove',e=>tipShow(e,`<b style="color:${lineColor}">${p.lac} mmol/L</b> · ${p.x} ${data.unit} · FC ${p.fc}`));
    c.addEventListener('mouseleave',tipHide);
  });

  // cartouches seuils
  const th=document.getElementById(thId);
  if(th) th.innerHTML=`
    <div class="lt-th" style="--tc:#39E6A3"><div class="k">Seuil aérobie · LT1 (SV1)</div><div class="v">${data.sv1lbl}</div><div class="s">≈ 2 mmol/L</div></div>
    <div class="lt-th" style="--tc:#FFB13D"><div class="k">Seuil anaérobie · LT2 (SV2)</div><div class="v">${data.sv2lbl}</div><div class="s">≈ 4 mmol/L</div></div>`;
}
function lactateCharts(){
  const runC = getComputedStyle(document.body).getPropertyValue('--run').trim() || '#FF5470';
  const bikeC = getComputedStyle(document.body).getPropertyValue('--bike').trim() || '#FFB13D';
  drawLactate('lactateBike','ltBikeTh', STRAVA_DEMO.lactateBike, bikeC);
}
lactateCharts();

/* ============================================================
   PUISSANCE–DURÉE (records MMP) + DURABILITÉ (puissance sous fatigue)
   Données démo réalistes ; remplacées par les vrais records dès
   qu'on agrège les activités synchronisées (Garmin/Coros/.FIT).
   ============================================================ */
// [secondes, watts] — record de puissance à chaque durée, de 1 s à 8 h
const MMP_DEMO = [
  [1,1120],[5,945],[10,815],[15,720],[30,585],[60,478],[120,402],[300,344],
  [600,312],[1200,298],[1800,288],[3600,270],[7200,250],[14400,232],[28800,205]
];
// Durabilité multi-paliers : MMP reproduite après X kJ d'effort (perte ∝ kJ).
const DURAB_LEVELS = [
  {kj:1000, color:'#39E6A3'},
  {kj:1500, color:'#2FD9FF'},
  {kj:2000, color:'#FF5470'},
  {kj:2500, color:'#9D7BFF'},
];
const DURAB_FRESH = '#FFB13D';
function mmpAfter(kj){
  return MMP_DEMO.map(([t,w])=>{
    const base = t<60 ? .045 : t<300 ? .06 : t<1200 ? .075 : .09;
    return [t, Math.round(w*(1-base*(kj/2000)))];
  });
}
let durabSel = new Set([2000]); // paliers kJ affichés (l'utilisateur choisit)

function fmtSecs(s){
  if(s<60) return s+' s';
  if(s<3600){ const m=s/60; return (m%1?m.toFixed(0):m)+' min'; }
  const h=s/3600; return (h%1?h.toFixed(1):h)+' h';
}
function powAxes(svg,W,H,P,data,minW,maxW,lx,hx,x,y){
  for(let g=0;g<=4;g++){ const v=minW+(maxW-minW)*g/4, yv=y(v);
    el('line',{x1:P.l,x2:W-P.r,y1:yv,y2:yv,class:'gridline'},svg);
    const t=el('text',{x:P.l-8,y:yv+3,class:'axis','text-anchor':'end'},svg); t.textContent=Math.round(v)+'W'; }
  [1,5,30,60,300,1200,3600,14400,28800].forEach(tk=>{ if(tk<data[0][0]||tk>data.at(-1)[0])return;
    const xv=x(tk); el('line',{x1:xv,x2:xv,y1:P.t,y2:H-P.b,class:'gridline',opacity:.35},svg);
    const t=el('text',{x:xv,y:H-12,class:'axis','text-anchor':'middle'},svg); t.textContent=fmtSecs(tk); });
}
function mmpChart(){
  const svg=document.getElementById('mmpChart'); if(!svg) return; svg.innerHTML='';
  const W=940,H=300,P={l:54,r:18,t:18,b:34}, data=MMP_DEMO;
  const ws=data.map(d=>d[1]), minW=Math.min(...ws)-25, maxW=Math.max(...ws)+35;
  const lx=Math.log10(data[0][0]), hx=Math.log10(data.at(-1)[0]);
  const x=t=>P.l+(Math.log10(t)-lx)/(hx-lx)*(W-P.l-P.r);
  const y=w=>H-P.b-(w-minW)/(maxW-minW)*(H-P.t-P.b);
  powAxes(svg,W,H,P,data,minW,maxW,lx,hx,x,y);
  const pts=data.map(d=>[x(d[0]),y(d[1])]), path=smoothPath(pts);
  const defs=el('defs',{},svg), lg=el('linearGradient',{id:'mmpFill',x1:0,y1:0,x2:0,y2:1},defs);
  el('stop',{offset:0,'stop-color':'#FFB13D','stop-opacity':.28},lg); el('stop',{offset:1,'stop-color':'#FFB13D','stop-opacity':0},lg);
  el('path',{d:path+` L${pts.at(-1)[0]},${H-P.b} L${pts[0][0]},${H-P.b} Z`,fill:'url(#mmpFill)'},svg);
  el('path',{d:path,class:'glow-line draw',stroke:'#FFB13D','stroke-width':2.5},svg);
  pts.forEach((p,i)=>{ const c=el('circle',{cx:p[0],cy:p[1],r:4,fill:'#0D121E',stroke:'#FFB13D','stroke-width':2,class:'dot'},svg);
    c.addEventListener('mousemove',e=>tipShow(e,`<b style="color:#FFB13D">${data[i][1]} W</b> · ${fmtSecs(data[i][0])}`));
    c.addEventListener('mouseleave',tipHide); });
}
function buildDurabLevels(){
  const box=document.getElementById('durabLevels'); if(!box) return;
  if(!document.getElementById('pf-durab-css')){
    const st=document.createElement('style'); st.id='pf-durab-css';
    st.textContent=`.durab-levels{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 10px;align-items:center}
    .durab-levels .dl-lbl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-right:2px}
    .durab-levels .ctog.on{border-color:var(--lc);background:transparent}
    .durab-levels .ctog.on .box{background:var(--lc);border-color:var(--lc);color:#06222a}`;
    document.head.appendChild(st);
  }
  if(box.dataset.built) return; box.dataset.built='1';
  const lab=document.createElement('span'); lab.className='dl-lbl'; lab.textContent='Paliers kJ'; box.appendChild(lab);
  DURAB_LEVELS.forEach(l=>{
    const chip=document.createElement('button'); chip.type='button'; chip.className='ctog'; chip.dataset.kj=l.kj;
    chip.style.setProperty('--lc', l.color);
    chip.innerHTML=`<span class="box"></span>${l.kj} kJ`;
    const sync=()=>{ const on=durabSel.has(l.kj); chip.classList.toggle('on',on); chip.querySelector('.box').innerHTML=on?'<i class="ic ic-check"></i>':''; };
    chip.onclick=()=>{ durabSel.has(l.kj)?durabSel.delete(l.kj):durabSel.add(l.kj); sync(); durabChart(); };
    sync(); box.appendChild(chip);
  });
}
function durabChart(){
  const svg=document.getElementById('durabChart'); if(!svg) return; svg.innerHTML='';
  buildDurabLevels();
  const W=940,H=300,P={l:54,r:18,t:18,b:34}, fresh=MMP_DEMO;
  const deepest=mmpAfter(2500);
  const ws=[...fresh,...deepest].map(d=>d[1]), minW=Math.min(...ws)-25, maxW=Math.max(...ws)+35;
  const lx=Math.log10(fresh[0][0]), hx=Math.log10(fresh.at(-1)[0]);
  const x=t=>P.l+(Math.log10(t)-lx)/(hx-lx)*(W-P.l-P.r);
  const y=w=>H-P.b-(w-minW)/(maxW-minW)*(H-P.t-P.b);
  powAxes(svg,W,H,P,fresh,minW,maxW,lx,hx,x,y);
  const fp=fresh.map(d=>[x(d[0]),y(d[1])]);
  const sel=DURAB_LEVELS.filter(l=>durabSel.has(l.kj)).sort((a,b)=>a.kj-b.kj);
  if(sel.length){
    const deep=mmpAfter(sel.at(-1).kj).map(d=>[x(d[0]),y(d[1])]);
    el('path',{d:smoothPath(fp)+' L'+deep.slice().reverse().map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L')+' Z',fill:'rgba(255,84,112,.08)'},svg);
  }
  el('path',{d:smoothPath(fp),class:'glow-line',stroke:DURAB_FRESH,'stroke-width':2.5},svg);
  fresh.forEach((d,i)=>{ const c=el('circle',{cx:fp[i][0],cy:fp[i][1],r:3.2,fill:'#0D121E',stroke:DURAB_FRESH,'stroke-width':2,class:'dot'},svg);
    c.addEventListener('mousemove',e=>tipShow(e,`<b style="color:${DURAB_FRESH}">${d[1]} W</b> · ${fmtSecs(d[0])} · à froid`)); c.addEventListener('mouseleave',tipHide); });
  sel.forEach(l=>{ const data=mmpAfter(l.kj), pts=data.map(d=>[x(d[0]),y(d[1])]);
    el('path',{d:smoothPath(pts),class:'glow-line draw',stroke:l.color,'stroke-width':2.5},svg);
    pts.forEach((p,i)=>{ const ret=Math.round(100*data[i][1]/fresh[i][1]);
      const c=el('circle',{cx:p[0],cy:p[1],r:3.2,fill:'#0D121E',stroke:l.color,'stroke-width':2,class:'dot'},svg);
      c.addEventListener('mousemove',e=>tipShow(e,`<b style="color:${l.color}">${data[i][1]} W</b> · ${fmtSecs(data[i][0])} · après ${l.kj} kJ<br><span style="color:var(--good)">${ret}% conservé</span>`));
      c.addEventListener('mouseleave',tipHide); });
  });
  const elNow=document.getElementById('durabNow');
  if(elNow){ if(sel.length){ const deep=sel.at(-1), da=mmpAfter(deep.kj), i5=fresh.findIndex(d=>d[0]===300);
      const ret=i5>=0?Math.round(100*da[i5][1]/fresh[i5][1]):0; elNow.innerHTML=`${ret}% à 5 min <span style="font-size:12px;color:var(--muted)">@ ${deep.kj} kJ</span>`;
    } else elNow.textContent='—'; }
  const leg=document.getElementById('durabLegend');
  if(leg) leg.innerHTML=`<span><i style="background:${DURAB_FRESH}"></i>À froid</span>`+sel.map(l=>`<span><i style="background:${l.color}"></i>${l.kj} kJ</span>`).join('');
}
/* ============================================================
   CHARGE MIXTE (méthode transparente) + PROFIL HYROX
   Mix : TSS vélo · rTSS course · sTSS nat · hrTSS FC · sRPE
   renfo/Hyrox, calibré 1 h au seuil = 100. Démo → réel au sync.
   Hyrox : 2 axes (aérobie/musculaire) + dégradation d'allure +
   "compromised running" (cf. Frontiers in Physiology 2025).
   ============================================================ */
const LOAD_LOG = [
  {disc:'bike', name:'Sortie seuil 2×20', dur:75, if:0.88, metric:'TSS'},
  {disc:'run',  name:'Tempo 8 km', dur:42, if:0.92, metric:'rTSS'},
  {disc:'strength', name:'Renfo bas du corps', dur:55, rpe:7, metric:'sRPE'},
  {disc:'swim', name:'Technique + seuil', dur:60, if:0.80, metric:'sTSS'},
  {disc:'hyrox', name:'Hyrox — simulation', dur:64, rpe:9, metric:'sRPE'},
  {disc:'run',  name:'Footing récup', dur:40, if:0.66, metric:'hrTSS'},
];
function sessionLoad(s){
  if(s.if!=null) return Math.round(s.dur*60*s.if*s.if/36); // famille TSS
  return Math.round(s.rpe*s.dur*0.24);                     // sRPE → TSS-équivalent
}
const HYROX_DEMO = { aero:78, musc:64, runs:[245,248,251,254,258,262,268,276], freshPace:241, fatiguePace:262 };
function injectLoadHxCss(){
  if(document.getElementById('pf-loadhx-css')) return;
  const st=document.createElement('style'); st.id='pf-loadhx-css';
  st.textContent=`
  .lm-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}
  .lm-kpis .v{font-family:var(--font-data);font-size:22px;font-weight:700;line-height:1}
  .lm-kpis .k{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-top:4px}
  .lm-row{display:flex;align-items:center;gap:9px;padding:6px 0;border-bottom:1px dashed var(--line);font-size:12.5px}
  .lm-row:last-child{border-bottom:0}
  .lm-ic{font-size:14px;width:18px;text-align:center}
  .lm-ic .ic{width:14px;height:14px}
  .lm-n{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lm-m{font-size:10px;color:var(--muted);border:1px solid var(--line-strong);border-radius:99px;padding:1px 7px}
  .lm-v{font-family:var(--font-data);font-weight:700;min-width:32px;text-align:right}
  .lm-note{font-size:10.5px;color:var(--muted);margin:11px 0 0;line-height:1.5}
  .hx-loads{display:flex;flex-direction:column;gap:9px;margin-bottom:14px}
  .hx-lh{display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px}
  .hx-lh b{font-family:var(--font-data)}
  .hx-track{height:8px;border-radius:99px;background:rgba(150,165,200,.12);overflow:hidden}
  .hx-track>i{display:block;height:100%;border-radius:99px}
  .hx-sub{font-size:11.5px;color:var(--muted);margin-bottom:8px}
  .hx-bars{display:flex;align-items:flex-end;gap:6px;height:84px;margin-bottom:12px}
  .hx-bar{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;gap:4px}
  .hx-bar>i{width:100%;border-radius:5px 5px 0 0;background:linear-gradient(180deg,var(--run),var(--bike))}
  .hx-bar>span{font-size:10px;color:var(--muted)}
  .hx-comp{font-size:11.5px;color:var(--soft);border-top:1px dashed var(--line);padding-top:10px}`;
  document.head.appendChild(st);
}
function renderLoadMix(){
  const box=document.getElementById('loadMixBody'); if(!box) return; injectLoadHxCss();
  const ctl=STRAVA_DEMO.ctl.at(-1), atl=STRAVA_DEMO.atl.at(-1), tsb=Math.round(ctl-atl);
  const rows=LOAD_LOG.map(s=>{ const D=DISC[s.disc]||{ico:null,color:'var(--muted)'};
    return `<div class="lm-row"><span class="lm-ic" style="color:${D.color}">${discIcon(D)}</span><span class="lm-n">${s.name}</span><span class="lm-m">${s.metric}</span><span class="lm-v">${sessionLoad(s)}</span></div>`; }).join('');
  box.innerHTML=`
    <div class="lm-kpis">
      <div><div class="v" style="color:var(--swim)">${Math.round(ctl)}</div><div class="k">Fitness · CTL</div></div>
      <div><div class="v" style="color:var(--run)">${Math.round(atl)}</div><div class="k">Fatigue · ATL</div></div>
      <div><div class="v" style="color:${tsb>=0?'var(--good)':'var(--bike)'}">${tsb>=0?'+':''}${tsb}</div><div class="k">Forme · TSB</div></div>
    </div>
    <div class="lm-list">${rows}</div>
    <p class="lm-note">Charge = mix <b>TSS</b> vélo · <b>rTSS</b> course · <b>sTSS</b> nat · <b>hrTSS</b> FC · <b>sRPE</b> renfo/Hyrox, calibré <b>1 h seuil = 100</b>. Estimé — le coach tranche.</p>`;
}
function renderHyrox(){
  const box=document.getElementById('hyroxBody'); if(!box) return; injectLoadHxCss();
  const h=HYROX_DEMO, r0=h.runs[0], rN=h.runs.at(-1), deg=Math.round((rN/r0-1)*100);
  const comp=Math.round((h.fatiguePace/h.freshPace-1)*100), maxR=Math.max(...h.runs), minR=Math.min(...h.runs);
  const bars=h.runs.map((s,i)=>{ const pct=Math.round((s-minR)/(maxR-minR||1)*68)+32;
    return `<div class="hx-bar" title="Run ${i+1} : ${fmtPace(s)}/km"><i style="height:${pct}%"></i><span>${i+1}</span></div>`; }).join('');
  box.innerHTML=`
    <div class="hx-loads">
      <div class="hx-load"><div class="hx-lh"><span>Charge aérobie</span><b>${h.aero}</b></div><div class="hx-track"><i style="width:${h.aero}%;background:var(--run)"></i></div></div>
      <div class="hx-load"><div class="hx-lh"><span>Charge musculaire</span><b>${h.musc}</b></div><div class="hx-track"><i style="width:${h.musc}%;background:var(--strength)"></i></div></div>
    </div>
    <div class="hx-sub">Dégradation d'allure sur les 8 runs · <b style="color:var(--bike)">+${deg}%</b> · survole une barre</div>
    <div class="hx-bars">${bars}</div>
    <div class="hx-comp"><i class="ic ic-run"></i> Course sous fatigue (« compromised running ») : à froid <b>${fmtPace(h.freshPace)}/km</b> → après station <b style="color:var(--bike)">${fmtPace(h.fatiguePace)}/km</b> <span style="color:var(--bike)">(+${comp}%)</span></div>`;
}
mmpChart(); durabChart(); renderLoadMix(); renderHyrox();

/* ============================================================
   AFFICHAGE À LA CARTE — chaque graphique peut être masqué.
   Barre de cases au-dessus des graphes + croix sur chaque carte.
   Choix mémorisé (localStorage) → évite la surcharge pour ceux
   qui ne veulent pas de toute la data.
   ============================================================ */
(function chartToggles(){
  // Les sous-onglets par thème (stats-tabs) remplacent l'ancien affichage
  // « à la carte » (cases à cocher + croix par graphe). On ne garde que le
  // packing dense des grilles pour un rendu propre par onglet.
  if(!document.getElementById('pf-ctog-css')){
    const st=document.createElement('style'); st.id='pf-ctog-css';
    st.textContent='.analytics .charts{grid-auto-flow:row dense}';
    document.head.appendChild(st);
  }
})();

/* Redessine les graphiques à couleurs figées après changement de palette */
function rebuildCharts(){
  hrChart();
  lactateCharts();
}

/* ============================================================
   RECORDS PERSONNELS
   ------------------------------------------------------------
   - Vélo  : courbe de puissance (W) par durée, de 1 s à 8 h.
   - Natation : vitesse (allure /100m) par durée, mêmes intervalles.
   - Course : allure (min/km) par distance, de 100 m à 100 km.
   Valeurs dérivées des références de l'athlète (FTP/PMA, CSS, VMA/CV)
   via des modèles de décroissance réalistes. En production : ces
   records seraient extraits des vraies activités (Strava streams).
   ============================================================ */
const REC_BIKE_DIST = [
  {k:'20 km',km:20},{k:'30 km',km:30},{k:'40 km',km:40},
  {k:'80 km',km:80},{k:'90 km',km:90},{k:'100 km',km:100},
  {k:'180 km',km:180},{k:'200 km',km:200},{k:'300 km',km:300}
];
const REC_RUN_DIST = [
  {k:'1 km',m:1000},{k:'3 km',m:3000},{k:'5 km',m:5000},
  {k:'10 km',m:10000},{k:'21 km',m:21097},{k:'42 km',m:42195}
];
// dates fictives pour donner vie aux records (démo)
const REC_DATES = ['12 juin','3 mai','21 avr.','8 mars','17 fév.','29 janv.','5 janv.','14 déc.'];
function recDate(i){ return REC_DATES[i % REC_DATES.length]; }

/* — Vélo : vitesse moyenne (km/h) soutenable selon la distance — décroît avec la distance — */
function bikeSpeedForDistance(km){
  if(km<=20) return 42;
  if(km<=40) return 42 - (km-20)/(40-20)*(42-40);      // 42→40
  if(km<=100) return 40 - (km-40)/(100-40)*(40-36);    // 40→36
  if(km<=200) return 36 - (km-100)/(200-100)*(36-32);  // 36→32
  return 32 - Math.min(3,(km-200)/100*3);              // →29 @300km
}

function runPaceForDistance(m){
  const vmaKmh=ATHLETE_REF.vma, cvKmh=ATHLETE_REF.cv;
  // vitesse soutenable décroissante avec la distance
  let kmh;
  if(m<=400) kmh = vmaKmh*1.06;             // sprint long, > VMA
  else if(m<=1000) kmh = vmaKmh*(1.06 - (m-400)/(1000-400)*0.11); // →~0.95 VMA
  else if(m<=5000) kmh = cvKmh*(1.06 - (m-1000)/(5000-1000)*0.06);
  else if(m<=21097) kmh = cvKmh*(1.00 - (m-5000)/(21097-5000)*0.07);
  else if(m<=42195) kmh = cvKmh*(0.93 - (m-21097)/(42195-21097)*0.06);
  else kmh = cvKmh*(0.87 - Math.min(0.12,(m-42195)/57805*0.12));
  return 3600/kmh; // s/km
}
function fmtPace(sPerKm){ const s=Math.round(sPerKm); return Math.floor(s/60)+"'"+String(s%60).padStart(2,'0')+'"'; }

let recTab='bike';
function renderRecords(){
  const grid=document.getElementById('recGrid'); if(!grid) return;
  let html='';
  if(recTab==='bike'){
    grid.style.setProperty('--rc','var(--bike)');
    html = REC_BIKE_DIST.map((d,i)=>{
      const kmh=bikeSpeedForDistance(d.km);
      const totalMin=d.km/kmh*60;
      return recCard(d.k, kmh.toFixed(1), 'km/h', recDate(i), 'var(--bike)', fmtClock(totalMin)+' au total');
    }).join('');
  } else {
    grid.style.setProperty('--rc','var(--run)');
    html = REC_RUN_DIST.map((d,i)=>{
      const sPerKm=runPaceForDistance(d.m);
      const totalSec=sPerKm*d.m/1000;
      return recCard(d.k, fmtPace(sPerKm), '/km', recDate(i), 'var(--run)', fmtClock(totalSec/60)+' au total');
    }).join('');
  }
  grid.innerHTML=html;
}
function recCard(label, value, unit, date, color, secondary){
  return `<div class="rec-card" style="--rc:${color}">
    <div class="rec-label">${label}</div>
    <div class="rec-value">${value}<small>${unit}</small></div>
    <div class="rec-sub-secondary">${secondary||''}</div>
    <div class="rec-date"><i class="ic ic-calendar"></i> ${date}</div>
  </div>`;
}
document.querySelectorAll('.rec-tab').forEach(b=> b.addEventListener('click', ()=>{
  recTab=b.dataset.rt;
  document.querySelectorAll('.rec-tab').forEach(x=>x.classList.toggle('active', x===b));
  renderRecords();
}));
renderRecords();

/* ============================================================
   MOTEUR D'ANALYSE · ÉTAT DE FORME (aide à la décision)
   ------------------------------------------------------------
   Approche transparente, à base de règles explicables — pas de
   boîte noire. Croise 4 signaux reconnus dans la littérature :
     1. ACWR (charge aiguë 7j / chronique 28j) — risque de blessure
     2. TSB (forme = CTL - ATL) — fraîcheur
     3. Check-in subjectif (sommeil / fatigue / motivation)
     4. RPE des séances récentes vs intensité prévue
   Chaque signal est noté 0–100, puis pondéré en indice global.
   Sortie = RECOMMANDATION indicative. Jamais un diagnostic.
   Le coach valide ; rien n'est imposé automatiquement à l'athlète.

   Backend : remplacez les valeurs de démo (acwr, rpeRecent…)
   par les vraies, calculées sur les activités Strava/Coros/Polar.
   ============================================================ */
const READINESS = {
  // valeurs dérivées des données iDO réelles (S24 = très grosse charge)
  acwr: 1.62,          // charge aiguë très supérieure au chronique → zone de risque
  // TSB dérivé de STRAVA_DEMO (CTL - ATL de la dernière semaine) → fortement négatif
  get tsb(){ return STRAVA_DEMO.ctl.at(-1) - STRAVA_DEMO.atl.at(-1); },
  // check-in subjectif : on réutilise l'objet `checkin` déjà présent
  get subjective(){ return checkin; },
  rpeRecent: [9, 7, 9] // RPE des 3 dernières séances qualité (VO2max HT, Actif, VO2max piste)
};

function scoreReadiness(){
  // 1. ACWR → score (1.0 idéal ; >1.5 ou <0.8 risqué)
  const a = READINESS.acwr;
  let sAcwr;
  if(a>=0.8 && a<=1.3) sAcwr = 100 - Math.abs(a-1.0)*60;        // zone optimale
  else if(a>1.3)       sAcwr = Math.max(0, 100 - (a-1.3)*140);  // surcharge
  else                 sAcwr = Math.max(0, 100 - (0.8-a)*120);  // sous-charge
  sAcwr = Math.round(Math.max(0,Math.min(100,sAcwr)));

  // 2. TSB → score (très négatif = fatigue ; légèrement positif = frais)
  const t = READINESS.tsb;
  let sTsb = Math.round(Math.max(0, Math.min(100, 50 + t*3.2))); // -15→~2, 0→50, +10→82

  // 3. Subjectif → score (sommeil + (10-fatigue) + motivation)/30
  const c = READINESS.subjective;
  const sSubj = Math.round((c.sommeil + (10-c.fatigue) + c.motivation)/30*100);

  // 4. RPE récent → score (RPE bas = frais ; RPE élevé répété = alerte)
  const meanRpe = READINESS.rpeRecent.reduce((x,y)=>x+y,0)/READINESS.rpeRecent.length;
  const sRpe = Math.round(Math.max(0, Math.min(100, 100 - (meanRpe-3)*14)));

  // pondération : risque blessure (ACWR) et ressenti pèsent le plus
  const global = Math.round(sAcwr*0.32 + sTsb*0.20 + sSubj*0.26 + sRpe*0.22);

  return {global, factors:[
    {key:tr('ready.acwr'),  sub:`ratio ${a.toFixed(2)}`,                 score:sAcwr},
    {key:tr('ready.tsb'),    sub:`${t>=0?'+':''}${t}`,                    score:sTsb},
    {key:tr('ready.subjective'),       sub:`check-in ${sSubj}%`,                    score:sSubj},
    {key:tr('ready.rpe'),     sub:`moy. ${meanRpe.toFixed(1)}/10`,         score:sRpe}
  ]};
}

function readinessVerdict(g){
  if(g>=70) return {flag:tr('ready.flag.continue'), color:'#39E6A3',
    advice:tr('ready.advice.continue')};
  if(g>=50) return {flag:tr('ready.flag.watch'), color:'#FFB13D',
    advice:tr('ready.advice.watch')};
  if(g>=32) return {flag:tr('ready.flag.lighten'), color:'#FF8A4D',
    advice:tr('ready.advice.lighten')};
  return {flag:tr('ready.flag.rest'), color:'#FF5470',
    advice:tr('ready.advice.rest')};
}

function scoreColor(s){
  if(s>=70) return '#39E6A3'; if(s>=50) return '#FFB13D';
  if(s>=32) return '#FF8A4D'; return '#FF5470';
}

function renderReadiness(){
  const {global, factors} = scoreReadiness();
  const v = readinessVerdict(global);
  const hub = document.getElementById('readyhub');
  if(!hub) return;
  hub.style.setProperty('--vc', v.color);

  // jauge circulaire (rayon 76 → circonférence ≈ 477)
  const C = 2*Math.PI*76;
  const fill = document.getElementById('gFill');
  fill.style.strokeDashoffset = C*(1-global/100);
  fill.style.stroke = v.color;
  const gs = document.getElementById('gScore');
  gs.textContent = global; gs.style.color = v.color;

  const flag = document.getElementById('rhFlag');
  flag.textContent = v.flag; flag.style.color = v.color;
  document.getElementById('rhAdvice').textContent = v.advice;
  document.querySelector('.rh-verdict').style.borderLeftColor = v.color;

  document.getElementById('rhFactors').innerHTML = factors.map(f=>{
    const col = scoreColor(f.score);
    return `<div class="rh-factor">
      <div class="fl">${f.key}<small>${f.sub}</small></div>
      <div class="rh-bar"><i style="width:${f.score}%;background:${col}"></i></div>
      <div class="fv" style="color:${col}">${f.score}</div>
    </div>`;
  }).join('');
}
renderReadiness();

/* ============================================================
   PANNEAU "AUJOURD'HUI" — guide quotidien de l'athlète
   ------------------------------------------------------------
   Synthétise en une vue les infos actionnables du jour, dérivées
   du check-in, de la charge (ACWR/TSB) et de la séance prévue.
   ============================================================ */
function todaySession(){
  // séance du jour dans le planning (clé du jour courant)
  const k = (typeof iso==='function') ? iso(new Date()) : null;
  const list = (typeof planning!=='undefined' && k) ? (planning[k]||[]) : [];
  return list[0] || null;
}
function renderToday(){
  const box=document.getElementById('todayPanel'); if(!box) return;
  const {global, factors} = scoreReadiness();
  const acwr = READINESS.acwr;

  // 1. Fraîcheur = indice de forme global
  const fraicheur = global;
  const frClass = fraicheur>=70?'ti-good':fraicheur>=50?'ti-warn':'ti-bad';

  // 2. Risque de blessure depuis l'ACWR (sweet spot 0.8–1.3)
  let risque, rqClass, rqHint;
  if(acwr>1.5){ risque='Élevé'; rqClass='ti-bad'; rqHint='Charge récente bien au-dessus de ton habitude'; }
  else if(acwr>1.3){ risque='Modéré'; rqClass='ti-warn'; rqHint='Surveille les sensations, évite d\'en rajouter'; }
  else if(acwr<0.8){ risque='Sous-charge'; rqClass='ti-info'; rqHint='Tu peux te permettre un peu plus de volume'; }
  else { risque='Faible'; rqClass='ti-good'; rqHint='Charge bien équilibrée, continue'; }

  // 3. Séance du jour
  const s = todaySession();
  let seance, scClass, scHint;
  if(!s){ seance='Repos'; scClass='ti-info'; scHint='Journée sans séance prévue'; }
  else if(s.done){ seance='Validée <i class="ic ic-check"></i>'; scClass='ti-good'; scHint=s.title; }
  else { seance='À faire'; scClass='ti-warn'; scHint=s.title; }

  // 4. Nutrition recommandée (g glucides/h) selon durée & intensité de la séance
  let carbs, nutHint;
  if(s){
    const long = (s.dur||0)>=120, hard=['Z4','Z5'].includes(s.zone)||/vma|seuil|vo2/i.test(s.title||'');
    if(long){ carbs='80–90 g/h'; nutHint='Sortie longue : ravitaille-toi régulièrement'; }
    else if(hard){ carbs='60 g/h'; nutHint='Séance intense : glucides + protéines en récup'; }
    else { carbs='30 g/h'; nutHint='Séance courte : hydratation suffit souvent'; }
  } else { carbs='—'; nutHint='Repos : alimentation équilibrée habituelle'; }

  // 5. Heure idéale de coucher : réveil habituel - besoin de sommeil (ajusté si grosse séance demain)
  const wake = 6.5;                       // réveil ~6h30 (démo)
  let need = 8;                            // besoin de base
  if(fraicheur<55) need += 0.5;           // fatigue → +30 min
  // grosse séance demain ?
  const tomorrowHard = true;              // démo
  if(tomorrowHard) need += 0.25;
  let bed = wake - need; if(bed<0) bed+=24;
  const bh = Math.floor(bed), bm = Math.round((bed-bh)*60);
  const bedStr = `${String(bh).padStart(2,'0')} h ${String(bm).padStart(2,'0')}`;

  const today = new Date();
  const dateStr = today.toLocaleDateString(localeStr(), {weekday:'long', day:'numeric', month:'long'});

  box.innerHTML = `<div class="today-card">
    <div class="today-head">
      <div class="today-title"><i class="ic ic-sun"></i> Ton point du jour</div>
      <div class="today-head-r">
        <button class="cb-bilan" id="cbBilanBtn" title="Exporter ton bilan en PDF"><i class="ic ic-download"></i> Mon bilan PDF</button>
        <div class="today-date">${dateStr}</div>
      </div>
    </div>
    <div class="today-grid">
      <div class="today-item">
        <div class="ti-icon"><i class="ic ic-battery"></i></div>
        <div class="ti-label">État de fraîcheur</div>
        <div class="ti-value ${frClass}">${fraicheur} %</div>
        <div class="ti-hint">${fraicheur>=70?'En forme, prêt à performer':fraicheur>=50?'Correct, gère l\'intensité':'Fatigue marquée, allège'}</div>
      </div>
      <div class="today-item">
        <div class="ti-icon"><i class="ic ic-shield"></i></div>
        <div class="ti-label">Risque de blessure</div>
        <div class="ti-value ${rqClass}">${risque}</div>
        <div class="ti-hint">${rqHint}</div>
      </div>
      <div class="today-item">
        <div class="ti-icon"><i class="ic ic-target"></i></div>
        <div class="ti-label">Séance du jour</div>
        <div class="ti-value ${scClass}">${seance}</div>
        <div class="ti-hint">${scHint}</div>
      </div>
      <div class="today-item">
        <div class="ti-icon"><i class="ic ic-cup"></i></div>
        <div class="ti-label">Nutrition recommandée</div>
        <div class="ti-value ti-info">${carbs}</div>
        <div class="ti-hint">${nutHint}</div>
      </div>
      <div class="today-item">
        <div class="ti-icon"><i class="ic ic-moon"></i></div>
        <div class="ti-label">Heure idéale de coucher</div>
        <div class="ti-value ti-info">${bedStr}</div>
        <div class="ti-hint">~${need.toFixed(1).replace('.0','')} h de sommeil visées</div>
      </div>
    </div>
    <div class="today-foot"><i class="ic ic-lightbulb"></i> ${todayAdvice(fraicheur, risque, s)}</div>
  </div>`;
  const _cbBilanBtn = document.getElementById('cbBilanBtn');
  if(_cbBilanBtn) _cbBilanBtn.onclick = function(){ exportBilan(typeof ATHLETE_NAME!=='undefined'?ATHLETE_NAME:''); };
}
function todayAdvice(fr, risque, s){
  if(risque==='Élevé') return tr('advice.highLoad');
  if(fr<50) return tr('advice.lowRecovery');
  if(s && !s.done) return tr('advice.greenLight');
  if(s && s.done) return tr('advice.sessionDone');
  return tr('advice.restDay');
}
renderToday();

/* ============================================================
   MATÉRIEL — suivi d'usure des chaussures et vélos, catalogue par marque
   ------------------------------------------------------------
   Chaque équipement cumule des km. Les chaussures de course choisies
   dans le catalogue héritent de la durée de vie propre à leur modèle
   (une carbone de compétition s'use vers 350 km, une paire d'entraînement
   tient 900 km et plus) : les paliers d'alerte (60/85/100% de cette durée
   de vie) sont donc calculés par modèle, pas sur un seuil générique.
   Le km s'incrémente automatiquement après chaque séance course validée
   (RPE), en attribuant la distance à la paire la plus adaptée.
   ============================================================ */
/* ============================================================
   CATALOGUE CHAUSSURES — modèles marquants ~2018-2025
   ------------------------------------------------------------
   cat : daily (entraînement) · tempo (dynamique) · race (compétition
   carbone) · trail. life : durée de vie estimée du modèle en km —
   c'est LA clé : une carbone s'use vers 350 km, une daily tient 900+.
   comm : km de retrait moyen observé "communauté" (démo — en prod,
   agrégé sur les vrais retraits des athlètes Sillance).
   Catalogue de démarrage à compléter (modèles récents possiblement
   manquants) ; champ libre disponible pour tout modèle absent.
   ============================================================ */
const SHOE_CATALOG = [
 // — Nike —
 {b:'Nike',m:'Pegasus 39',cat:'daily',life:900,comm:860},
 {b:'Nike',m:'Pegasus 40',cat:'daily',life:900,comm:870},
 {b:'Nike',m:'Pegasus 41',cat:'daily',life:900,comm:880},
 {b:'Nike',m:'Vomero 17',cat:'daily',life:950,comm:900},
 {b:'Nike',m:'Invincible 3',cat:'daily',life:800,comm:760},
 {b:'Nike',m:'Structure 25',cat:'daily',life:900,comm:850},
 {b:'Nike',m:'Zoom Fly 5',cat:'tempo',life:650,comm:610},
 {b:'Nike',m:'Zoom Fly 6',cat:'tempo',life:650,comm:620},
 {b:'Nike',m:'Vaporfly 2',cat:'race',life:350,comm:320},
 {b:'Nike',m:'Vaporfly 3',cat:'race',life:350,comm:330},
 {b:'Nike',m:'Alphafly 2',cat:'race',life:350,comm:310},
 {b:'Nike',m:'Alphafly 3',cat:'race',life:400,comm:360},
 // — Adidas —
 {b:'Adidas',m:'Ultraboost Light',cat:'daily',life:850,comm:800},
 {b:'Adidas',m:'Supernova Rise',cat:'daily',life:900,comm:850},
 {b:'Adidas',m:'Boston 11',cat:'tempo',life:700,comm:650},
 {b:'Adidas',m:'Boston 12',cat:'tempo',life:700,comm:660},
 {b:'Adidas',m:'Adios 8',cat:'tempo',life:600,comm:560},
 {b:'Adidas',m:'Takumi Sen 10',cat:'race',life:400,comm:370},
 {b:'Adidas',m:'Adios Pro 3',cat:'race',life:400,comm:360},
 {b:'Adidas',m:'Adios Pro 4',cat:'race',life:400,comm:370},
 // — Asics —
 {b:'Asics',m:'Nimbus 25',cat:'daily',life:950,comm:900},
 {b:'Asics',m:'Nimbus 26',cat:'daily',life:950,comm:910},
 {b:'Asics',m:'Cumulus 26',cat:'daily',life:900,comm:860},
 {b:'Asics',m:'Kayano 31',cat:'daily',life:950,comm:900},
 {b:'Asics',m:'Novablast 4',cat:'tempo',life:750,comm:700},
 {b:'Asics',m:'Novablast 5',cat:'tempo',life:750,comm:710},
 {b:'Asics',m:'Superblast 2',cat:'tempo',life:800,comm:750},
 {b:'Asics',m:'Magic Speed 4',cat:'tempo',life:600,comm:560},
 {b:'Asics',m:'Metaspeed Sky Paris',cat:'race',life:350,comm:320},
 {b:'Asics',m:'Metaspeed Edge Paris',cat:'race',life:350,comm:330},
 // — Hoka —
 {b:'Hoka',m:'Clifton 9',cat:'daily',life:850,comm:800},
 {b:'Hoka',m:'Bondi 8',cat:'daily',life:900,comm:850},
 {b:'Hoka',m:'Mach 5',cat:'tempo',life:650,comm:600},
 {b:'Hoka',m:'Mach 6',cat:'tempo',life:700,comm:650},
 {b:'Hoka',m:'Rocket X2',cat:'race',life:400,comm:360},
 {b:'Hoka',m:'Cielo X1',cat:'race',life:400,comm:370},
 {b:'Hoka',m:'Speedgoat 6',cat:'trail',life:750,comm:700},
 // — Saucony —
 {b:'Saucony',m:'Ride 17',cat:'daily',life:900,comm:850},
 {b:'Saucony',m:'Triumph 22',cat:'daily',life:950,comm:900},
 {b:'Saucony',m:'Kinvara 15',cat:'tempo',life:600,comm:550},
 {b:'Saucony',m:'Endorphin Speed 3',cat:'tempo',life:650,comm:620},
 {b:'Saucony',m:'Endorphin Speed 4',cat:'tempo',life:650,comm:630},
 {b:'Saucony',m:'Endorphin Pro 3',cat:'race',life:400,comm:360},
 {b:'Saucony',m:'Endorphin Pro 4',cat:'race',life:400,comm:370},
 {b:'Saucony',m:'Peregrine 14',cat:'trail',life:700,comm:650},
 // — Brooks —
 {b:'Brooks',m:'Ghost 16',cat:'daily',life:950,comm:900},
 {b:'Brooks',m:'Glycerin 21',cat:'daily',life:950,comm:900},
 {b:'Brooks',m:'Adrenaline GTS 23',cat:'daily',life:950,comm:900},
 {b:'Brooks',m:'Hyperion Max',cat:'tempo',life:650,comm:600},
 {b:'Brooks',m:'Hyperion Elite 4',cat:'race',life:350,comm:320},
 {b:'Brooks',m:'Cascadia 17',cat:'trail',life:800,comm:750},
 // — New Balance —
 {b:'New Balance',m:'1080 v13',cat:'daily',life:900,comm:850},
 {b:'New Balance',m:'1080 v14',cat:'daily',life:900,comm:860},
 {b:'New Balance',m:'880 v14',cat:'daily',life:900,comm:850},
 {b:'New Balance',m:'Rebel v4',cat:'tempo',life:600,comm:560},
 {b:'New Balance',m:'SC Trainer v2',cat:'tempo',life:700,comm:650},
 {b:'New Balance',m:'SC Elite v4',cat:'race',life:400,comm:360},
 // — On —
 {b:'On',m:'Cloudmonster',cat:'daily',life:850,comm:800},
 {b:'On',m:'Cloudsurfer',cat:'daily',life:800,comm:750},
 {b:'On',m:'Cloudboom Echo 3',cat:'race',life:400,comm:360},
 // — Mizuno —
 {b:'Mizuno',m:'Wave Rider 28',cat:'daily',life:900,comm:860},
 {b:'Mizuno',m:'Neo Vista',cat:'tempo',life:750,comm:700},
 {b:'Mizuno',m:'Wave Rebellion Pro 2',cat:'race',life:400,comm:360},
 // — Puma —
 {b:'Puma',m:'Velocity Nitro 3',cat:'daily',life:850,comm:800},
 {b:'Puma',m:'Deviate Nitro 3',cat:'tempo',life:700,comm:650},
 {b:'Puma',m:'Fast-R 3',cat:'race',life:400,comm:360},
 // — Salomon —
 {b:'Salomon',m:'Speedcross 6',cat:'trail',life:750,comm:700},
 {b:'Salomon',m:'S/Lab Genesis',cat:'trail',life:700,comm:650},
 // — Kiprun (Decathlon) —
 {b:'Kiprun',m:'KS900',cat:'daily',life:850,comm:800},
 {b:'Kiprun',m:'KD900X LD',cat:'race',life:450,comm:410}
];
const SHOE_CAT_LABEL = {get daily(){return tr('shoeCat.daily')}, get tempo(){return tr('shoeCat.tempo')}, get race(){return tr('shoeCat.race')}, get trail(){return tr('shoeCat.trail')}};
const SHOE_CAT_ICON  = {daily:'ic-run', tempo:'ic-zap', race:'ic-flag', trail:'ic-mountain'};
const SHOE_CAT_COLOR = {daily:'var(--good)', tempo:'var(--bike)', race:'var(--run)', trail:'var(--strength)'};

/* Retrouve la fiche catalogue d'un équipement persisté (par nom "Marque Modèle"). */
function catalogFor(g){ return SHOE_CATALOG.find(e=>`${e.b} ${e.m}`===g.name); }

/* Données de démo — remplacées par les vraies données persistées (Supabase) au login */
let GEAR = [
  {id:'g1', type:'shoe', name:'Nike Pegasus 40', km:612, max:900, price:130, cat:'daily', comm:870, notified:[500]},
  {id:'g2', type:'shoe', name:'Saucony Endorphin Speed 4', km:284, max:650, price:180, cat:'tempo', comm:630, notified:[]},
  {id:'g3', type:'shoe', name:'Asics Metaspeed Sky Paris', km:118, max:350, price:250, cat:'race', comm:320, notified:[]},
  {id:'g4', type:'bike', name:'Canyon Ultimate CF', km:4380, max:20000, price:3200, cat:null, comm:null, notified:[]}
];

/* — Conseiller de paire : quelle chaussure pour la séance ? — */
function recommendShoe(s){
  const shoes = GEAR.filter(g=>g.type==='shoe' && g.km < g.max);   // paires encore vivantes
  if(!shoes.length || !s || s.disc!=='run') return null;
  const title=(s.title||'').toLowerCase();
  let want;
  if(/comp[ée]t|course|marathon|semi|10k|5k|race/.test(title)) want='race';
  else if(/vma|seuil|vo2|fractionn|interval|tempo|dynamique|allure/.test(title) || s.zone==='Z4' || s.zone==='Z5') want='tempo';
  else want='daily';
  // meilleure paire de la catégorie voulue (la moins usée), sinon repli daily→tempo
  const order = want==='race' ? ['race','tempo','daily'] : want==='tempo' ? ['tempo','daily','race'] : ['daily','tempo'];
  for(const c of order){
    const cand = shoes.filter(g=>(g.cat||catalogFor(g)?.cat)===c).sort((a,b)=>(a.km/a.max)-(b.km/b.max))[0];
    if(cand) return {shoe:cand, want};
  }
  return {shoe:shoes[0], want};
}

/* — Garde-fou pré-course : projette l'usure jusqu'aux courses à venir — */
const UPCOMING_RACES = [
  {name:'Gorillaman (sprint)', inDays:22, needCat:'race'},
  {name:'Marathon de Toulouse', inDays:60, needCat:'race'}
];
const RUN_KM_PER_WEEK = 42;   // volume course hebdo moyen de l'athlète (démo) — à remplacer par la vraie donnée
function raceGearForecast(){
  const out=[];
  UPCOMING_RACES.forEach(r=>{
    const kmUntil = RUN_KM_PER_WEEK * (r.inDays/7);
    GEAR.filter(g=>g.type==='shoe').forEach(g=>{
      const cat = g.cat || catalogFor(g)?.cat;
      const projected = g.km + (cat==='daily'? kmUntil*0.65 : cat==='tempo'? kmUntil*0.25 : kmUntil*0.10);
      if(cat===r.needCat && projected >= g.max*0.95){
        out.push({race:r, gear:g, projected:Math.round(projected),
          msg:`<b>${r.name}</b> dans ${r.inDays} j : tes <b>${g.name}</b> seront à environ ${Math.round(projected)} km (durée de vie ${g.max} km). Prévois une nouvelle paire de compétition et rode-la avant la course.`});
      } else if(cat!==r.needCat && projected >= g.max*0.90){
        out.push({race:r, gear:g, projected:Math.round(projected),
          msg:`D'ici <b>${r.name}</b> (${r.inDays} j), tes <b>${g.name}</b> dépasseront leur durée de vie (environ ${Math.round(projected)}/${g.max} km). Anticipe le remplacement pour t'entraîner sur un amorti sain.`});
      }
    });
  });
  return out;
}

/* — Paliers d'usure calculés en % de la durée de vie du modèle (pas de seuils génériques) — */
function shoeMilestones(g){
  return [
    {km:Math.round(g.max*0.60), lvl:'watch'},
    {km:Math.round(g.max*0.85), lvl:'soon'},
    {km:g.max, lvl:'replace'}
  ];
}

function gearAlert(g){
  if(g.type!=='shoe') return {cls:'ok', ic:'ic-check', txt:`${g.km} km au compteur. Entretien régulier recommandé.`};
  const p = g.km/g.max*100;
  if(p>=100) return {cls:'danger', ic:'ic-alert-triangle', txt:`Durée de vie dépassée (${g.max} km pour ce modèle) : remplacement fortement conseillé, l'amorti est dégradé.`};
  if(p>=85) return {cls:'danger', ic:'ic-alert-triangle', txt:`${Math.round(p)}% de la durée de vie : pense à les remplacer bientôt, le risque de blessure augmente.`};
  if(p>=60) return {cls:'warn', ic:'ic-bell', txt:`${Math.round(p)}% de la durée de vie de ce modèle : surveille l'usure de la semelle et les sensations.`};
  return {cls:'ok', ic:'ic-check', txt:`Encore environ ${Math.round(g.max*0.6-g.km)} km avant le premier palier de surveillance de ce modèle.`};
}

function renderGear(){
  const box=document.getElementById('gearList'); if(!box) return;
  box.innerHTML = GEAR.map(g=>{
    const pct=Math.min(100, g.km/g.max*100);
    const ms = shoeMilestones(g);
    const cat = g.cat || catalogFor(g)?.cat;
    const comm = g.comm ?? catalogFor(g)?.comm;
    const barColor = g.type==='shoe'
      ? (pct>=85?'var(--run)': pct>=60?'var(--bike)':'var(--good)')
      : 'var(--swim)';
    const milestones = g.type==='shoe' ? `<div class="gear-milestones">${ms.map(m=>{
      const cls = g.km>=m.km ? 'reached' : (g.km>=m.km-100?'next':'todo');
      return `<span class="gear-ms ${cls}">${g.km>=m.km?'<i class="ic ic-check"></i> ':''}${m.km} km</span>`;
    }).join('')}</div>` : '';
    // marqueurs sur la barre (paliers propres au modèle)
    const marks = g.type==='shoe' ? ms.map(m=>{
      const left=Math.min(100,m.km/g.max*100); return `<span class="gb-mark" style="left:${left}%"></span>`;
    }).join('') : '';
    const al=gearAlert(g);
    const catBadge = cat ? `<span class="gear-cat" style="--gc:${SHOE_CAT_COLOR[cat]}"><i class="ic ${SHOE_CAT_ICON[cat]}"></i>${SHOE_CAT_LABEL[cat]}</span>` : '';
    const costKm = (g.price && g.km>0) ? `<span class="gear-cost">${(g.price/g.km).toFixed(2)} €/km</span>` : (g.price?`<span class="gear-cost">${g.price} € neuve</span>`:'');
    const commHtml = (g.type==='shoe' && comm) ? `<div class="gear-comm"><i class="ic ic-users"></i> Les athlètes Sillance retirent ce modèle à <b>${comm} km</b> en moyenne</div>` : '';
    return `<div class="gear-card" data-id="${g.id}">
      <div class="gear-card-h">
        <span class="gear-ico"><i class="ic ${g.type==='shoe'?'ic-shoe':'ic-bike'}"></i></span>
        <div class="gear-i">
          <div class="gear-name">${g.name}</div>
          <div class="gear-type">${g.type==='shoe'?'Chaussures de course':'Vélo'} ${catBadge}</div>
        </div>
        <button class="gear-del" data-act="del">Retirer</button>
      </div>
      <div class="gear-km">${g.km.toLocaleString(localeStr())}<small> / ${g.max.toLocaleString(localeStr())} km</small> ${costKm}</div>
      <div class="gear-sub">${Math.round(pct)}% de la durée de vie du modèle</div>
      <div class="gear-bar">${marks}<i style="width:${pct}%;background:${barColor}"></i></div>
      ${milestones}
      ${commHtml}
      <div class="gear-alert ${al.cls}"><i class="ic ${al.ic}"></i><span>${al.txt}</span></div>
      <div style="margin-top:10px;display:flex;gap:7px">
        <button class="gear-del" data-act="add10" style="border-color:var(--line-strong)">+ Simuler 50 km</button>
      </div>
    </div>`;
  }).join('') || `<p class="club-hint">${mode==='coach'
    ? 'Cet athlète n\'a renseigné aucun équipement dans son espace.'
    : 'Aucun équipement. Ajoute tes chaussures pour suivre leur usure.'}</p>`;

  // — bandeau conseil du jour + garde-fou courses à venir —
  const advisor=document.getElementById('gearAdvisor');
  if(advisor){
    // séance course du jour, sinon la prochaine course planifiée
    let target = todaySession(); let when='ta séance du jour';
    if(!target || target.disc!=='run'){
      const todayK = iso(new Date());
      const keys = Object.keys(planning).filter(k=>k>=todayK).sort();
      for(const k of keys){ const f=(planning[k]||[]).find(x=>x.disc==='run' && !x.done); if(f){ target=f; when=`ta prochaine séance course (« ${f.title} »)`; break; } }
    }
    const rec = recommendShoe(target);
    const recHtml = rec ? `<div class="gear-advice">
      <i class="ic ic-sparkles ga-ico"></i>
      <div><b>Paire conseillée pour ${when}</b> — profil ${SHOE_CAT_LABEL[rec.want]} recommandé :
      porte tes <b>${rec.shoe.name}</b> (${rec.shoe.km}/${rec.shoe.max} km).</div></div>` : '';
    const forecasts = raceGearForecast();
    const fcHtml = forecasts.map(f=>`<div class="gear-advice warn"><i class="ic ic-flag ga-ico"></i><div>${f.msg}</div></div>`).join('');
    advisor.innerHTML = recHtml + fcHtml;
  }
  box.querySelectorAll('.gear-card').forEach(card=>{
    const g=GEAR.find(x=>x.id===card.dataset.id);
    card.querySelector('[data-act="del"]').onclick=()=>{ GEAR=GEAR.filter(x=>x.id!==g.id); renderGear(); if(window.PF?.user) window.PF.retireGear(g.id).catch(e=>console.warn('retireGear',e)); };
    const addBtn=card.querySelector('[data-act="add10"]');
    if(addBtn) addBtn.onclick=()=>{ addGearKm(g, 50); };
  });
}

/* incrémente le km et déclenche une notification au passage d'un palier */
function addGearKm(g, km){
  const before=g.km; g.km+=km;
  if(g.type==='shoe'){
    shoeMilestones(g).forEach(m=>{
      if(before<m.km && g.km>=m.km && !g.notified.includes(m.km)){
        g.notified.push(m.km);
        notifyShoe(g, m);
      }
    });
  }
  if(window.PF?.user && g.id) window.PF.updateGear(g.id, {km:g.km, notified:g.notified}).catch(e=>console.warn('updateGear',e));
  renderGear();
}

function notifyShoe(g, m){
  const msgs={
    watch:`Tes ${g.name} passent ${m.km} km (60% de leur durée de vie). Surveille l'usure de la semelle et les sensations.`,
    soon:`Tes ${g.name} atteignent ${m.km} km (85% de leur durée de vie). Pense à prévoir une nouvelle paire.`,
    replace:`Tes ${g.name} ont dépassé leur durée de vie (${g.max} km). Remplace-les pour éviter les blessures.`
  };
  toast(msgs[m.lvl]||`${g.name} : ${m.km} km atteints`);
}

/* modal d'ajout */
const gearOverlay=document.getElementById('gearOverlay');
document.getElementById('gearAdd').onclick=()=> gearOverlay.classList.add('open');
document.getElementById('gearClose').onclick=()=> gearOverlay.classList.remove('open');
gearOverlay.addEventListener('click', e=>{ if(e.target===gearOverlay) gearOverlay.classList.remove('open'); });

/* — Recherche + catalogue par marque — */
let pickedShoe = null;
const shoeResultsEl = document.getElementById('shoeResults');
const shoeBrandsEl  = document.getElementById('shoeBrands');
const shoePickedEl  = document.getElementById('shoePicked');

function shoeResultRow(e){
  return `<button class="shoe-item" data-b="${e.b}" data-m="${e.m}">
    <span class="si-name"><b>${e.b}</b> ${e.m}</span>
    <span class="si-meta"><span class="gear-cat" style="--gc:${SHOE_CAT_COLOR[e.cat]}"><i class="ic ${SHOE_CAT_ICON[e.cat]}"></i>${SHOE_CAT_LABEL[e.cat]}</span> · ${e.life} km</span>
  </button>`;
}
function wireShoeRows(){
  shoeResultsEl.querySelectorAll('.shoe-item').forEach(btn=>{
    btn.onclick=()=> pickShoe(SHOE_CATALOG.find(x=>x.b===btn.dataset.b && x.m===btn.dataset.m));
  });
}
function pickShoe(e){
  if(!e) return;
  pickedShoe = e;
  document.getElementById('gearName').value = `${e.b} ${e.m}`;
  document.getElementById('gearMax').value = e.life;
  shoeResultsEl.innerHTML=''; document.getElementById('gearSearch').value='';
  shoePickedEl.hidden=false;
  shoePickedEl.innerHTML = `<span class="gear-cat" style="--gc:${SHOE_CAT_COLOR[e.cat]}"><i class="ic ${SHOE_CAT_ICON[e.cat]}"></i>${SHOE_CAT_LABEL[e.cat]}</span>
    Durée de vie du modèle : <b>${e.life} km</b> · <i class="ic ic-users"></i> retrait moyen communauté : <b>${e.comm} km</b>`;
}
function renderShoeBrands(){
  const brands=[...new Set(SHOE_CATALOG.map(e=>e.b))];
  shoeBrandsEl.innerHTML = `<span class="sb-hint">…ou parcours par marque :</span>` +
    brands.map(b=>`<button class="brand-chip" data-b="${b}">${b}</button>`).join('');
  shoeBrandsEl.querySelectorAll('.brand-chip').forEach(ch=> ch.onclick=()=>{
    shoeBrandsEl.querySelectorAll('.brand-chip').forEach(x=>x.classList.toggle('sel', x===ch));
    const models=SHOE_CATALOG.filter(e=>e.b===ch.dataset.b);
    const order=['daily','tempo','race','trail'];
    shoeResultsEl.innerHTML = order.filter(c=>models.some(m=>m.cat===c)).map(c=>
      `<div class="sr-cat">${SHOE_CAT_LABEL[c]}</div>` + models.filter(m=>m.cat===c).map(shoeResultRow).join('')
    ).join('');
    wireShoeRows();
  });
}
document.getElementById('gearSearch').addEventListener('input', e=>{
  const q=e.target.value.trim().toLowerCase();
  pickedShoe=null; shoePickedEl.hidden=true;
  if(q.length<2){ shoeResultsEl.innerHTML=''; return; }
  const hits=SHOE_CATALOG.filter(x=>(x.b+' '+x.m).toLowerCase().includes(q)).slice(0,8);
  shoeResultsEl.innerHTML = hits.map(shoeResultRow).join('') || '<div class="sr-cat">Aucun modèle — saisis-le librement ci-dessous</div>';
  wireShoeRows();
});
document.getElementById('gearType').addEventListener('change', e=>{
  document.getElementById('shoeSearchFld').style.display = e.target.value==='shoe' ? '' : 'none';
  document.getElementById('gearMax').value = e.target.value==='shoe' ? 900 : 20000;
  if(e.target.value!=='shoe'){ pickedShoe=null; shoePickedEl.hidden=true; }
});

document.getElementById('gearSave').onclick=()=>{
  const type=document.getElementById('gearType').value;
  // name échappé à la saisie : renderGear() l'interpole ensuite tel quel
  // dans du innerHTML (écriture optimiste locale, avant tout aller-retour DB).
  const g={
    id:'g'+Date.now(),
    type,
    name:dispoSafe(document.getElementById('gearName').value||'Équipement'),
    km:+document.getElementById('gearKm').value||0,
    max:+document.getElementById('gearMax').value||1000,
    price:+document.getElementById('gearPrice').value||null,
    cat: type==='shoe' ? (pickedShoe?.cat || 'daily') : null,
    comm: type==='shoe' ? (pickedShoe?.comm || null) : null,
    notified:[]
  };
  // marque comme déjà notifiés les paliers déjà dépassés à l'ajout
  if(g.type==='shoe') shoeMilestones(g).forEach(m=>{ if(g.km>=m.km) g.notified.push(m.km); });
  GEAR.push(g);
  // persiste côté backend si connecté (sinon reste en démo local)
  if(window.PF?.user){
    window.PF.addGear({type:g.type,name:g.name,km:g.km,max_km:g.max,notified:g.notified,cat:g.cat,price:g.price})
      .then(row=>{ if(row&&row.id) g.id=row.id; }).catch(e=>console.warn('addGear',e));
  }
  pickedShoe=null; shoePickedEl.hidden=true;
  document.getElementById('gearName').value=''; document.getElementById('gearSearch').value=''; shoeResultsEl.innerHTML='';
  gearOverlay.classList.remove('open');
  renderGear();
  toast(tr('toast.equipementAjouteSuiviDUsure'));
};

/* initialisation au chargement de la page */
renderShoeBrands();
renderGear();


/* ============================================================
   PRÉPARATEURS MENTAUX — annuaire extensible.
   Pour ajouter un préparateur : copie une ligne dans le tableau
   ci-dessous (nom, spécialité, lien Calendly). Un seul → l'agenda
   s'ouvre directement ; plusieurs → un sélecteur s'affiche d'abord.
   Accessible à tous les athlètes (coachés comme autonomes).
   ============================================================ */
const PREPA_MENTALE = [
  { id:'eric', name:'Éric', role:'Préparateur mental',
    calendly:'https://calendly.com/VOTRE-LIEN-ERIC/prepa-mentale',
    blurb:'Gestion du stress de course, visualisation, routines pré-compétition.' },
  // { id:'…', name:'…', role:'Préparateur mental', calendly:'https://calendly.com/…', blurb:'…' },
];

const mentalOverlay = document.getElementById('mentalOverlay');
const calendlyFrame = document.getElementById('calendlyFrame');
const calendlyWrap  = document.getElementById('calendlyWrap');
const mentalPicker  = document.getElementById('mentalPicker');
const mentalBack    = document.getElementById('mentalBack');
const mentalFallback= document.getElementById('mentalFallback');
const mentalDesc    = document.getElementById('mentalDesc');

function pmCalendarSrc(url){ return url + (url.includes('?')?'&':'?') + 'hide_gdpr_banner=1&background_color=ffffff&primary_color=9d7bff'; }

function showPmCalendar(pm){
  document.getElementById('calendlyLink').href = pm.calendly;
  calendlyFrame.src = pmCalendarSrc(pm.calendly);   // (re)charge à la sélection
  mentalPicker.hidden = true;
  calendlyWrap.hidden = false;
  mentalFallback.hidden = false;
  mentalBack.hidden = PREPA_MENTALE.length < 2;     // pas de « changer » si un seul PM
  mentalDesc.textContent = `Choisis ton créneau avec ${pm.name} (visio, 45 min).`;
}
function showPmPicker(){
  calendlyWrap.hidden = true; mentalFallback.hidden = true; mentalBack.hidden = true;
  mentalDesc.textContent = 'Choisis ton préparateur mental, puis ton créneau.';
  mentalPicker.innerHTML = PREPA_MENTALE.map((pm,i)=>`
    <button class="pm-card" data-i="${i}" type="button">
      <span class="pm-av">${(pm.name||'?').slice(0,1)}</span>
      <span class="pm-info"><span class="pm-name">${pm.name}</span><span class="pm-role">${pm.role||'Préparateur mental'}</span>${pm.blurb?`<span class="pm-blurb">${pm.blurb}</span>`:''}</span>
      <span class="pm-go">Réserver →</span>
    </button>`).join('');
  mentalPicker.querySelectorAll('.pm-card').forEach(c=> c.addEventListener('click', ()=> showPmCalendar(PREPA_MENTALE[+c.dataset.i])));
  mentalPicker.hidden = false;
}
function openMental(){
  if(PREPA_MENTALE.length <= 1){ showPmCalendar(PREPA_MENTALE[0]); }
  else { showPmPicker(); }
  mentalOverlay.classList.add('open');
}
document.getElementById('mentalBtn')?.addEventListener('click', openMental);
mentalBack.addEventListener('click', e=>{ e.preventDefault(); showPmPicker(); });
document.getElementById('mentalClose').addEventListener('click', ()=> mentalOverlay.classList.remove('open'));
mentalOverlay.addEventListener('click', e=>{ if(e.target===mentalOverlay) mentalOverlay.classList.remove('open') });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') mentalOverlay.classList.remove('open') });

/* ============================================================
   RÉSERVATION TEST LACTATE — formulaire par email
   CONFIG : remplacez l'adresse par votre email de réception
   ============================================================ */
const LACTEST_EMAIL = 'contact@VOTRE-DOMAINE.fr';
const lactestOverlay = document.getElementById('lactestOverlay');
document.getElementById('lactestBtn').addEventListener('click', ()=> lactestOverlay.classList.add('open'));
document.getElementById('lactestClose').addEventListener('click', ()=> lactestOverlay.classList.remove('open'));
lactestOverlay.addEventListener('click', e=>{ if(e.target===lactestOverlay) lactestOverlay.classList.remove('open') });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') lactestOverlay.classList.remove('open') });

document.getElementById('lactestSend').addEventListener('click', ()=>{
  const v = id => document.getElementById(id).value.trim();
  const name=v('lf-name'), email=v('lf-email'), type=v('lf-type'), period=v('lf-period'), msg=v('lf-msg');
  const fb = document.getElementById('lactestFallback');
  if(!name || !email){
    fb.style.display='block'; fb.style.color='var(--run)';
    fb.textContent='Merci de renseigner au moins ton nom et ton email.';
    return;
  }
  const subject = encodeURIComponent(`Demande de test lactate — ${name}`);
  const body = encodeURIComponent(
    `Nom : ${name}\nEmail : ${email}\nType de test : ${type}\nPériode souhaitée : ${period||'—'}\n\nMessage :\n${msg||'—'}`
  );
  // ouvre le client mail pré-rempli. Backend : remplacer par un POST vers votre API.
  window.location.href = `mailto:${LACTEST_EMAIL}?subject=${subject}&body=${body}`;
  fb.style.display='block'; fb.style.color='var(--good)';
  fb.innerHTML = `Ton client mail s'ouvre… s'il ne s'ouvre pas, écris-nous à <a href="mailto:${LACTEST_EMAIL}">${LACTEST_EMAIL}</a>.`;
});

/* ============================================================
   POINT DE BRANCHEMENT STRAVA
   Quand votre backend reçoit les activités via l'API Strava
   (OAuth + GET /athlete/activities), agrégez-les par semaine
   puis appelez :
     loadStravaData({ weeks, hrAvg, distSwim, distBike, distRun,
                      ctl, atl, ftp, pma, weightKg,
                      physio, hrZones })
   avec la même forme que STRAVA_DEMO — les graphiques se
   redessineront avec les vraies données.
   ============================================================ */
window.loadStravaData = function(data){
  Object.assign(STRAVA_DEMO, data);
  ['ftpChart','hrChart','distChart','loadChart'].forEach(id=>{
    document.getElementById(id).innerHTML='';
  });
  // NB : pour une intégration propre, factorisez les IIFE ci-dessus
  // en fonctions nommées et rappelez-les ici.
  if(typeof renderReadiness==='function') renderReadiness();
  location.hash = '#analytics';
};

// Conservé pour compat (débogage console notamment).
window.exportBilan = exportBilan;
})(); // fin IIFE Sillance — logique

/* ============================================================
   FOCUS TRAP GÉNÉRIQUE — toutes les .overlay (19 dialogs).
   Piège le focus clavier tant qu'une overlay a la classe .open,
   le restitue à la fermeture, ferme sur Escape. Générique et
   automatique : pas besoin de câbler chaque point d'ouverture
   individuellement (audit sécurité/accessibilité 03/08/2026).
   ============================================================ */
(function(){
  const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  let active = null, lastFocused = null;

  function focusables(ov){ return [...ov.querySelectorAll(FOCUSABLE)].filter(n=> n.offsetParent !== null); }

  function onOpen(ov){
    active = ov;
    lastFocused = document.activeElement;
    if(!ov.hasAttribute('tabindex')) ov.setAttribute('tabindex','-1');
    const nodes = focusables(ov);
    (nodes[0] || ov).focus({preventScroll:true});
  }
  function onClose(ov){
    if(active===ov) active=null;
    if(lastFocused && document.body.contains(lastFocused) && typeof lastFocused.focus==='function') lastFocused.focus({preventScroll:true});
    lastFocused=null;
  }

  document.addEventListener('keydown', function(e){
    if(!active) return;
    if(e.key==='Escape'){ e.preventDefault(); active.classList.remove('open'); return; }
    if(e.key!=='Tab') return;
    const nodes = focusables(active);
    if(!nodes.length) return;
    const first=nodes[0], last=nodes[nodes.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  }, true);

  const mo = new MutationObserver(muts=>{
    for(const m of muts){
      const el = m.target;
      if(!(el instanceof Element) || !el.classList.contains('overlay')) continue;
      const isOpen = el.classList.contains('open');
      const was = m.oldValue ? m.oldValue.split(/\s+/).includes('open') : false;
      if(isOpen && !was) onOpen(el);
      else if(!isOpen && was) onClose(el);
    }
  });
  document.querySelectorAll('.overlay').forEach(ov=> mo.observe(ov, {attributes:true, attributeFilter:['class'], attributeOldValue:true}));
})();