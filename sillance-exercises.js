/* ============================================================
   Sillance : catalogue d'exercices de musculation (28/10/2026)
   ------------------------------------------------------------
   Suggestions du champ « exercice » des lignes de renfo du
   constructeur (datalist #silExoList). Le champ reste libre :
   un exercice absent de la liste se tape tel quel.
   Format : [groupe, nom FR, nom EN, nom ES].
   ============================================================ */
(function(){
  var G = {
    legs: ['Jambes', 'Legs', 'Piernas'],
    glutes: ['Fessiers / ischios', 'Glutes / hamstrings', 'Glúteos / isquios'],
    push: ['Poussée haut du corps', 'Upper body push', 'Empuje tren superior'],
    pull: ['Tirage haut du corps', 'Upper body pull', 'Tracción tren superior'],
    arms: ['Bras / épaules', 'Arms / shoulders', 'Brazos / hombros'],
    core: ['Gainage / abdos', 'Core / abs', 'Core / abdominales'],
    power: ['Pliométrie / explosivité', 'Plyometrics / power', 'Pliometría / potencia'],
    full: ['Corps entier / Hyrox', 'Full body / Hyrox', 'Cuerpo completo / Hyrox'],
    run: ['Spécifique course', 'Running-specific', 'Específico carrera']
  };
  var EX = [
    // Jambes
    ['legs', 'Squat', 'Back squat', 'Sentadilla'],
    ['legs', 'Front squat', 'Front squat', 'Sentadilla frontal'],
    ['legs', 'Goblet squat', 'Goblet squat', 'Sentadilla goblet'],
    ['legs', 'Squat bulgare', 'Bulgarian split squat', 'Sentadilla búlgara'],
    ['legs', 'Fente bulgare', 'Rear-foot elevated split squat', 'Zancada búlgara'],
    ['legs', 'Fentes marchées', 'Walking lunges', 'Zancadas caminando'],
    ['legs', 'Fentes avant', 'Forward lunges', 'Zancadas al frente'],
    ['legs', 'Fentes arrière', 'Reverse lunges', 'Zancadas hacia atrás'],
    ['legs', 'Fentes latérales', 'Lateral lunges', 'Zancadas laterales'],
    ['legs', 'Split squat', 'Split squat', 'Sentadilla dividida'],
    ['legs', 'Step-up sur box', 'Box step-up', 'Subida al cajón'],
    ['legs', 'Pistol squat', 'Pistol squat', 'Sentadilla a una pierna'],
    ['legs', 'Squat sauté', 'Jump squat', 'Sentadilla con salto'],
    ['legs', 'Presse à cuisses', 'Leg press', 'Prensa de piernas'],
    ['legs', 'Leg extension', 'Leg extension', 'Extensión de cuádriceps'],
    ['legs', 'Chaise (isométrie)', 'Wall sit', 'Sentadilla isométrica en pared'],
    ['legs', 'Mollets debout', 'Standing calf raise', 'Elevación de talones de pie'],
    ['legs', 'Mollets unipodal', 'Single-leg calf raise', 'Elevación de talón a una pierna'],
    ['legs', 'Tibial raise', 'Tibialis raise', 'Elevación de tibial'],
    // Fessiers / ischios
    ['glutes', 'Soulevé de terre', 'Deadlift', 'Peso muerto'],
    ['glutes', 'Soulevé de terre roumain', 'Romanian deadlift', 'Peso muerto rumano'],
    ['glutes', 'Soulevé de terre jambes tendues', 'Stiff-leg deadlift', 'Peso muerto piernas rígidas'],
    ['glutes', 'Soulevé de terre unilatéral', 'Single-leg RDL', 'Peso muerto a una pierna'],
    ['glutes', 'Hip thrust', 'Hip thrust', 'Hip thrust'],
    ['glutes', 'Pont fessier', 'Glute bridge', 'Puente de glúteos'],
    ['glutes', 'Pont fessier unilatéral', 'Single-leg glute bridge', 'Puente de glúteos a una pierna'],
    ['glutes', 'Good morning', 'Good morning', 'Good morning'],
    ['glutes', 'Leg curl', 'Leg curl', 'Curl femoral'],
    ['glutes', 'Nordic hamstring curl', 'Nordic hamstring curl', 'Curl nórdico'],
    ['glutes', 'Kettlebell swing', 'Kettlebell swing', 'Swing con kettlebell'],
    ['glutes', 'Abduction élastique', 'Banded hip abduction', 'Abducción con banda'],
    ['glutes', 'Monster walk', 'Monster walk', 'Monster walk'],
    ['glutes', 'Clamshell', 'Clamshell', 'Almeja (clamshell)'],
    // Poussée
    ['push', 'Pompes', 'Push-ups', 'Flexiones'],
    ['push', 'Pompes inclinées', 'Incline push-ups', 'Flexiones inclinadas'],
    ['push', 'Pompes déclinées', 'Decline push-ups', 'Flexiones declinadas'],
    ['push', 'Pompes diamant', 'Diamond push-ups', 'Flexiones diamante'],
    ['push', 'Développé couché', 'Bench press', 'Press de banca'],
    ['push', 'Développé couché haltères', 'Dumbbell bench press', 'Press de banca con mancuernas'],
    ['push', 'Développé incliné', 'Incline press', 'Press inclinado'],
    ['push', 'Développé militaire', 'Overhead press', 'Press militar'],
    ['push', 'Développé haltères assis', 'Seated dumbbell press', 'Press de hombros sentado'],
    ['push', 'Push press', 'Push press', 'Push press'],
    ['push', 'Dips', 'Dips', 'Fondos'],
    // Tirage
    ['pull', 'Tractions', 'Pull-ups', 'Dominadas'],
    ['pull', 'Tractions supination', 'Chin-ups', 'Dominadas supinas'],
    ['pull', 'Tractions assistées (élastique)', 'Band-assisted pull-ups', 'Dominadas asistidas con banda'],
    ['pull', 'Tirage vertical', 'Lat pulldown', 'Jalón al pecho'],
    ['pull', 'Rowing barre', 'Barbell row', 'Remo con barra'],
    ['pull', 'Rowing haltère', 'Dumbbell row', 'Remo con mancuerna'],
    ['pull', 'Rowing inversé', 'Inverted row', 'Remo invertido'],
    ['pull', 'Tirage horizontal', 'Seated cable row', 'Remo sentado en polea'],
    ['pull', 'Face pull', 'Face pull', 'Face pull'],
    ['pull', 'Pull-over', 'Pullover', 'Pullover'],
    // Bras / épaules
    ['arms', 'Curl biceps', 'Biceps curl', 'Curl de bíceps'],
    ['arms', 'Curl marteau', 'Hammer curl', 'Curl martillo'],
    ['arms', 'Extension triceps', 'Triceps extension', 'Extensión de tríceps'],
    ['arms', 'Élévations latérales', 'Lateral raises', 'Elevaciones laterales'],
    ['arms', 'Oiseau (deltoïde arrière)', 'Rear delt fly', 'Pájaro (deltoides posterior)'],
    ['arms', 'Rotation externe épaule (élastique)', 'Banded external rotation', 'Rotación externa con banda'],
    ['arms', 'Y-T-W', 'Y-T-W raises', 'Y-T-W'],
    // Gainage / abdos
    ['core', 'Gainage planche', 'Plank', 'Plancha'],
    ['core', 'Gainage latéral', 'Side plank', 'Plancha lateral'],
    ['core', 'Crunch', 'Crunch', 'Crunch'],
    ['core', 'Crunch inversé', 'Reverse crunch', 'Crunch inverso'],
    ['core', 'Crunch vélo', 'Bicycle crunch', 'Crunch bicicleta'],
    ['core', 'Relevés de jambes', 'Leg raises', 'Elevaciones de piernas'],
    ['core', 'Relevés de jambes suspendu', 'Hanging leg raises', 'Elevaciones de piernas colgado'],
    ['core', 'Sit-up', 'Sit-up', 'Abdominales completos'],
    ['core', 'Russian twist', 'Russian twist', 'Giro ruso'],
    ['core', 'Mountain climbers', 'Mountain climbers', 'Escaladores'],
    ['core', 'Dead bug', 'Dead bug', 'Dead bug'],
    ['core', 'Bird dog', 'Bird dog', 'Bird dog'],
    ['core', 'Hollow hold', 'Hollow hold', 'Hollow hold'],
    ['core', 'Pallof press', 'Pallof press', 'Press Pallof'],
    ['core', 'Roue abdominale', 'Ab wheel rollout', 'Rueda abdominal'],
    ['core', 'Superman', 'Superman', 'Superman'],
    ['core', 'Farmer walk', 'Farmer carry', 'Paseo del granjero'],
    ['core', 'Suitcase carry', 'Suitcase carry', 'Paseo con maleta'],
    // Pliométrie
    ['power', 'Box jump', 'Box jump', 'Salto al cajón'],
    ['power', 'Sauts de fente', 'Jumping lunges', 'Zancadas con salto'],
    ['power', 'Bonds (foulées bondissantes)', 'Bounds', 'Saltos alternos'],
    ['power', 'Sauts à la corde', 'Jump rope', 'Saltar a la comba'],
    ['power', 'Pogo jumps', 'Pogo jumps', 'Pogo jumps'],
    ['power', 'Drop jump', 'Drop jump', 'Salto en caída'],
    ['power', 'Skater jumps', 'Skater jumps', 'Saltos de patinador'],
    ['power', 'Medecine ball slam', 'Medicine ball slam', 'Lanzamiento de balón medicinal al suelo'],
    ['power', 'Power clean', 'Power clean', 'Cargada de potencia'],
    // Corps entier / Hyrox
    ['full', 'Burpees', 'Burpees', 'Burpees'],
    ['full', 'Burpee broad jump', 'Burpee broad jump', 'Burpee con salto largo'],
    ['full', 'Thruster', 'Thruster', 'Thruster'],
    ['full', 'Wall balls', 'Wall balls', 'Wall balls'],
    ['full', 'Sled push', 'Sled push', 'Empuje de trineo'],
    ['full', 'Sled pull', 'Sled pull', 'Arrastre de trineo'],
    ['full', 'Sandbag lunges', 'Sandbag lunges', 'Zancadas con saco'],
    ['full', 'Rameur', 'Row erg', 'Remo ergómetro'],
    ['full', 'SkiErg', 'SkiErg', 'SkiErg'],
    ['full', 'Turkish get-up', 'Turkish get-up', 'Levantamiento turco'],
    ['full', 'Kettlebell clean & press', 'Kettlebell clean and press', 'Cargada y press con kettlebell'],
    // Spécifique course
    ['run', 'Montées de genoux', 'High knees', 'Rodillas arriba'],
    ['run', 'Talons-fesses', 'Butt kicks', 'Talones al glúteo'],
    ['run', 'Gammes (A-skip)', 'A-skips', 'Skipping A'],
    ['run', 'Copenhague (adducteurs)', 'Copenhagen plank', 'Plancha Copenhague'],
    ['run', 'Mollets excentriques', 'Eccentric calf raises', 'Elevaciones de talón excéntricas']
  ];

  function lang(){
    var l = window.SilI18n && typeof window.SilI18n.getLang === 'function' ? window.SilI18n.getLang() : 'fr';
    return l === 'en' ? 2 : l === 'es' ? 3 : 1;
  }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* Crée (ou met à jour selon la langue) le datalist partagé par toutes les
     lignes de renfo. La catégorie s'affiche en sous-titre de la suggestion. */
  var built = null;
  function ensure(){
    var i = lang();
    if(built === i && document.getElementById('silExoList')) return;
    var dl = document.getElementById('silExoList');
    if(!dl){ dl = document.createElement('datalist'); dl.id = 'silExoList'; document.body.appendChild(dl); }
    var gi = i - 1;
    dl.innerHTML = EX.map(function(e){ return '<option value="' + esc(e[i]) + '" label="' + esc(G[e[0]][gi]) + '"></option>'; }).join('');
    built = i;
  }
  /* Groupe musculaire d'un nom saisi librement (toutes langues) : nom exact,
     sinon le nom de catalogue le plus long contenu dans la saisie
     (« Squat bulgare haltères » → Squat bulgare → jambes). null si inconnu. */
  function norm(x){ return String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
  var INDEX = null;
  function groupOf(name){
    var n = norm(name); if(!n) return null;
    if(!INDEX){ INDEX = []; EX.forEach(function(e){ [e[1], e[2], e[3]].forEach(function(v){ INDEX.push([norm(v), e[0]]); }); }); INDEX.sort(function(a, b){ return b[0].length - a[0].length; }); }
    for(var i = 0; i < INDEX.length; i++){ if(INDEX[i][0] === n) return INDEX[i][1]; }
    for(var j = 0; j < INDEX.length; j++){ var k = INDEX[j][0]; if(k.length >= 4 && (' ' + n + ' ').indexOf(' ' + k + ' ') >= 0) return INDEX[j][1]; }
    return null;
  }
  function groupLabel(key){ var g = G[key]; return g ? g[lang() - 1] : null; }
  /* ---------- Sélecteur avec filtres par zone (30/10/2026) ----------
     Remplace la liste native (datalist), trop longue à faire défiler :
     au focus du champ exercice, un panneau propose des filtres (bas du
     corps, haut du corps, abdos…) et la liste filtrée ; la saisie filtre
     aussi. Le champ reste libre. */
  var FILTERS = [
    { id: 'all',   groups: null,                    l: ['Tout', 'All', 'Todo'] },
    { id: 'lower', groups: ['legs', 'glutes'],      l: ['Bas du corps', 'Lower body', 'Tren inferior'] },
    { id: 'upper', groups: ['push', 'pull', 'arms'], l: ['Haut du corps', 'Upper body', 'Tren superior'] },
    { id: 'core',  groups: ['core'],                l: ['Abdos / gainage', 'Core / abs', 'Core / abdominales'] },
    { id: 'full',  groups: ['full'],                l: ['Corps entier / Hyrox', 'Full body / Hyrox', 'Cuerpo completo / Hyrox'] },
    { id: 'power', groups: ['power'],               l: ['Explosivité', 'Power', 'Potencia'] },
    { id: 'run',   groups: ['run'],                 l: ['Course', 'Running', 'Carrera'] }
  ];
  var EMPTY = ['Aucun exercice : garde ton texte tel quel.', 'No exercise: keep your own text.', 'Ningún ejercicio: conserva tu texto.'];
  var curFilter = 'all', panel = null, curInput = null;
  function css(){
    if(document.getElementById('silExoCss')) return;
    var st = document.createElement('style'); st.id = 'silExoCss';
    st.textContent = '.sxp{position:fixed;z-index:9000;background:var(--panel,#fff);color:var(--text,#111);border:1px solid var(--line-strong,#ccd);border-radius:12px;box-shadow:0 12px 30px -12px rgba(0,0,0,.35);overflow:hidden;display:flex;flex-direction:column}'
      + '.sxp-chips{display:flex;gap:6px;padding:8px;overflow-x:auto;border-bottom:1px solid var(--line,#e3e6ee);flex:none;-webkit-overflow-scrolling:touch}'
      + '.sxp-chips button{flex:none;border:1px solid var(--line-strong,#ccd);background:transparent;color:inherit;border-radius:99px;padding:5px 10px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap}'
      + '.sxp-chips button.on{background:var(--swim,#2FD9FF);border-color:var(--swim,#2FD9FF);color:#06222a}'
      + '.sxp-list{overflow-y:auto;max-height:240px;padding:4px 0}'
      + '.sxp-item{display:flex;justify-content:space-between;gap:10px;padding:8px 12px;cursor:pointer;font-size:14px}'
      + '.sxp-item:hover,.sxp-item.act{background:var(--panel-2,#eef2f8)}'
      + '.sxp-item small{color:var(--muted,#8a949e);font-size:11.5px;white-space:nowrap}'
      + '.sxp-empty{padding:10px 12px;font-size:12.5px;color:var(--muted,#8a949e)}';
    document.head.appendChild(st);
  }
  function place(){
    if(!panel || !curInput) return;
    var r = curInput.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    var w = Math.min(Math.max(r.width, 300), vw - 16), left = Math.min(Math.max(8, r.left), vw - w - 8);
    var below = vh - r.bottom, h = Math.min(320, Math.max(below, r.top) - 12);
    panel.style.width = w + 'px'; panel.style.left = left + 'px'; panel.style.maxHeight = h + 'px';
    if(below >= 200 || below >= r.top){ panel.style.top = (r.bottom + 4) + 'px'; panel.style.bottom = ''; }
    else { panel.style.top = ''; panel.style.bottom = (vh - r.top + 4) + 'px'; }
    var list = panel.querySelector('.sxp-list'); if(list) list.style.maxHeight = Math.max(120, h - 52) + 'px';
  }
  function render(){
    if(!panel || !curInput) return;
    var i = lang(), q = norm(curInput.value), f = FILTERS.filter(function(x){ return x.id === curFilter; })[0] || FILTERS[0];
    var items = EX.filter(function(e){ return (!f.groups || f.groups.indexOf(e[0]) >= 0) && (!q || norm(e[i]).indexOf(q) >= 0 || norm(e[1]).indexOf(q) >= 0); });
    panel.innerHTML = '<div class="sxp-chips">' + FILTERS.map(function(x){ return '<button type="button" data-sxf="' + x.id + '" class="' + (x.id === curFilter ? 'on' : '') + '">' + esc(x.l[i - 1]) + '</button>'; }).join('') + '</div>'
      + '<div class="sxp-list">' + (items.length ? items.map(function(e){ return '<div class="sxp-item" data-sxv="' + esc(e[i]) + '"><span>' + esc(e[i]) + '</span><small>' + esc(G[e[0]][i - 1]) + '</small></div>'; }).join('')
        : '<div class="sxp-empty">' + esc(EMPTY[i - 1]) + '</div>') + '</div>';
    place();
  }
  function open(inp){
    css(); curInput = inp; inp.removeAttribute('list');
    if(!panel){
      panel = document.createElement('div'); panel.className = 'sxp';
      // mousedown : choisir avant que le champ perde le focus
      panel.addEventListener('mousedown', function(e){
        e.preventDefault();
        var c = e.target.closest('[data-sxf]'); if(c){ curFilter = c.dataset.sxf; render(); return; }
        var it = e.target.closest('[data-sxv]'); if(it && curInput){ pick(it.dataset.sxv); }
      });
      panel.addEventListener('touchend', function(e){
        var c = e.target.closest('[data-sxf]'); if(c){ e.preventDefault(); curFilter = c.dataset.sxf; render(); return; }
        var it = e.target.closest('[data-sxv]'); if(it && curInput && !panel._moved){ e.preventDefault(); pick(it.dataset.sxv); }
      });
      panel.addEventListener('touchstart', function(){ panel._moved = false; }, { passive: true });
      panel.addEventListener('touchmove', function(){ panel._moved = true; }, { passive: true });
    }
    document.body.appendChild(panel); render();
  }
  function pick(v){
    var inp = curInput; close();
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function close(){ if(panel && panel.parentNode) panel.parentNode.removeChild(panel); curInput = null; }
  document.addEventListener('focusin', function(e){ if(e.target.classList && e.target.classList.contains('ln-exercise')) open(e.target); });
  document.addEventListener('input', function(e){ if(e.target === curInput) render(); });
  document.addEventListener('focusout', function(e){ if(e.target === curInput) setTimeout(function(){ if(document.activeElement !== curInput) close(); }, 150); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && curInput) close(); });
  window.addEventListener('resize', place);
  document.addEventListener('scroll', function(e){ if(curInput && !(panel && panel.contains(e.target))) place(); }, true);

  window.SilExercises = { ensure: ensure, count: EX.length, groupOf: groupOf, groupLabel: groupLabel };
})();
