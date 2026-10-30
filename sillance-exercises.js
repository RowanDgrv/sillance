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
  window.SilExercises = { ensure: ensure, count: EX.length, groupOf: groupOf, groupLabel: groupLabel };
})();
