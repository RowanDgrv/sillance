/* Sillance — Profil de performance (démo, 15/11/2026)
   Situe l'athlète, sport par sport, entre « plutôt rapide » et « plutôt endurant »,
   et en tire une force, un point à travailler et une consigne pour le coach.
   Calculs simples, sans IA, à partir des références de l'athlète :
   - Course : allure seuil en % de la VMA ; réserve de vitesse = vitesse sur 50 m / VMA
     (Sandford et al., 2019, coureurs de 800-1 500 m).
   - Vélo : FTP en % de la PMA ; puissance sur 5 s / FTP (profil de puissance,
     Pinot et Grappe, 2011).
   - Natation : vitesse sur 50 m / vitesse à la CSS.
   - Durabilité : dérive cardiaque moyenne des séances longues analysées
     (Maunder et al., 2021).
   Récupération des profils rapides : Lievens et al., 2020.
   Les seuils de lecture sont des repères de terrain, pas des normes scientifiques :
   ils sont affichés comme tels. Aucune conclusion sans donnée réelle. */
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var fr = function (x, d) { return Number(x).toFixed(d).replace('.', ','); };
  var pace = function (kmh) { var s = 3600 / kmh; return Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'); };

  // Position 0 (très rapide) → 100 (très endurant) à partir d'une valeur et de deux repères.
  function pos(v, rapide, endurant) { return clamp((v - rapide) / (endurant - rapide) * 100, 0, 100); }
  function label(p) { return p < 35 ? 'Plutôt rapide' : p > 65 ? 'Plutôt endurant' : 'Équilibré'; }

  /* ---------- calculs par sport ---------- */
  function run(r) {
    var out = { sport: 'Course à pied', key: 'run', mesures: [], manque: [] };
    var vma = +r.vma || 0, seuil = +r.seuilRun || 0, s50 = +r.sprint50Run || 0;
    var ps = [];
    if (vma && seuil) {
      var pct = (3600 / seuil) / vma * 100;
      out.mesures.push({ t: 'Seuil à ' + Math.round(pct) + ' % de la VMA', d: 'allure seuil ' + pace(3600 / seuil) + '/km, VMA ' + fr(vma, 1) + ' km/h' });
      ps.push(pos(pct, 78, 90));   // repères : seuil bas ≈ 78 % (profil vitesse), haut ≈ 90 % (profil endurance)
    } else out.manque.push(vma ? 'Ton allure seuil (test de 30 minutes ou course de 10 km)' : 'Ta VMA (test de terrain)');
    if (vma && s50) {
      var vmax = 50 / s50 * 3.6, srr = vmax / vma;
      out.mesures.push({ t: 'Réserve de vitesse × ' + fr(srr, 2), d: '50 m lancé en ' + fr(s50, 1) + ' s, soit ' + fr(vmax, 1) + ' km/h' });
      ps.push(100 - pos(srr, 1.25, 1.6));   // plus la réserve est grande, plus le profil est rapide
    } else if (vma) out.manque.push('Un 50 m lancé, pour mesurer ta réserve de vitesse');
    out.p = ps.length ? ps.reduce(function (a, b) { return a + b; }, 0) / ps.length : null;
    out.conf = ps.length === 2 ? 'Bonne' : ps.length === 1 ? 'Partielle' : null;
    return out;
  }
  function bike(r) {
    var out = { sport: 'Vélo', key: 'bike', mesures: [], manque: [] };
    var ftp = +r.ftp || 0, pma = +r.pma || 0, p5 = +r.p5s || 0, ps = [];
    if (ftp && pma) {
      var pct = ftp / pma * 100;
      out.mesures.push({ t: 'FTP à ' + Math.round(pct) + ' % de la PMA', d: 'FTP ' + ftp + ' W, PMA ' + pma + ' W' });
      ps.push(pos(pct, 70, 82));
    } else out.manque.push(ftp ? 'Ta PMA (test incrémental)' : 'Ta FTP (test de 20 minutes)');
    if (ftp && p5) {
      var x = p5 / ftp;
      out.mesures.push({ t: 'Sprint à ' + fr(x, 1) + ' × la FTP', d: 'meilleure puissance sur 5 s : ' + p5 + ' W' });
      ps.push(100 - pos(x, 2.6, 4.2));
    } else if (ftp) out.manque.push('Ta meilleure puissance sur 5 secondes (un sprint lancé suffit)');
    out.p = ps.length ? ps.reduce(function (a, b) { return a + b; }, 0) / ps.length : null;
    out.conf = ps.length === 2 ? 'Bonne' : ps.length === 1 ? 'Partielle' : null;
    return out;
  }
  function swim(r) {
    var out = { sport: 'Natation', key: 'swim', mesures: [], manque: [] };
    var css = +r.css || 0, s50 = +r.swim50 || 0;
    if (css && s50) {
      var ratio = (50 / s50) / (100 / css);
      out.mesures.push({ t: '50 m à ' + Math.round(ratio * 100) + ' % de ta vitesse CSS', d: '50 m en ' + s50 + ' s, CSS ' + Math.floor(css / 60) + "'" + String(css % 60).padStart(2, '0') + '/100 m' });
      out.p = 100 - pos(ratio, 1.18, 1.45);
      out.conf = 'Partielle';
    } else { out.p = null; out.manque.push(css ? 'Un 50 m à fond, pour comparer à ta CSS' : 'Ta CSS (test 400 m + 200 m)'); }
    return out;
  }
  function durability(list) {
    if (!list || list.length < 3) return { p: null, n: (list || []).length };
    var m = list.reduce(function (a, b) { return a + b; }, 0) / list.length;
    return { p: 100 - pos(m, 3, 9), m: m, n: list.length };   // dérive < 3 % : très résistant ; > 9 % : fragile
  }

  /* ---------- lecture : force, point à travailler, consigne ---------- */
  var READ = {
    run: {
      r: ['Ta vitesse : tu as de la marge au-dessus de ta VMA, un vrai atout pour les relances et les fins de course.', 'Tenir l\'allure longtemps : ton seuil est loin de ta VMA, tu perds vite en allongeant la distance.', 'Plus de travail au seuil (blocs de 8 à 15 minutes) et des sorties longues avec une fin à allure. Après les séances très intenses, prévois au moins 48 h avant la suivante.'],
      e: ['Ton endurance : tu tiens une grosse part de ta VMA longtemps, idéal du 10 km au marathon.', 'La vitesse pure : peu de marge au-dessus de la VMA, les finishs et les relances coûtent cher.', 'Ajoute des lignes droites, des côtes courtes et du fractionné court (30/30, 200 m). Ton volume, tu le supportes bien : garde-le.'],
      m: ['L\'équilibre : ni limité par la vitesse ni par l\'endurance.', 'Pas de déséquilibre net : c\'est l\'objectif de course qui oriente le travail.', 'Garde une répartition classique (beaucoup de facile, un peu de dur) et pousse la qualité qui compte le plus sur la course visée.']
    },
    bike: {
      r: ['Ta puissance courte : sprints, relances et bosses courtes sont ton terrain.', 'Les efforts longs : ta FTP est basse par rapport à ta PMA.', 'Des blocs au seuil longs (2 × 20 minutes) et du sweet spot. Récupération plus longue après les sprints.'],
      e: ['Ta régularité : tu tiens une grosse puissance longtemps, profil de rouleur ou de triathlète longue distance.', 'L\'explosivité : les sprints et changements de rythme te coûtent.', 'Des efforts courts et intenses (30/15, sprints lancés) une fois par semaine, sans toucher au volume.'],
      m: ['Un profil polyvalent, à l\'aise sur la plupart des parcours.', 'Pas de déséquilibre net : c\'est le parcours visé qui oriente le travail.', 'Parcours plat et long : blocs au seuil. Parcours vallonné ou nerveux : efforts courts au-dessus de la PMA.']
    },
    swim: {
      r: ['Ta vitesse de nage : les départs et les sprints sont faciles.', 'Tenir l\'allure : ta CSS est loin de ta vitesse sur 50 m.', 'Des séries longues à allure CSS (10 × 200 m, 5 × 400 m) avec peu de récupération.'],
      e: ['Ton endurance de nage : tu tiens ta vitesse sur la distance, parfait pour le triathlon.', 'La vitesse : les départs rapides et le placement en début de course.', 'Des 25 et 50 m très rapides avec beaucoup de récupération, et des départs simulés en eau libre.'],
      m: ['Un profil équilibré entre vitesse et endurance de nage.', 'Pas de déséquilibre net : la distance de course oriente le travail.', 'Garde un mélange de séries à allure CSS et de vitesse, en dosant selon la distance visée.']
    }
  };
  function read(o) { var k = o.p < 35 ? 'r' : o.p > 65 ? 'e' : 'm'; return READ[o.key][k]; }

  /* ---------- rendu ---------- */
  function bar(p) {
    return '<div class="pf-bar"><span class="pf-l">Rapide</span><div class="pf-track"><i style="left:' + p.toFixed(0) + '%"></i></div><span class="pf-l">Endurant</span></div>';
  }
  function card(o, view) {
    var h = '<section class="pf-card"><div class="pf-head"><b>' + o.sport + '</b>';
    if (o.p == null) {
      return h + '<span class="pf-tag off">Pas assez de données</span></div><p class="pf-miss">Pour situer le profil : ' + o.manque.map(esc).join(' ; ') + '.</p></section>';
    }
    var t = read(o);
    h += '<span class="pf-tag">' + label(o.p) + '</span></div>' + bar(o.p);
    h += '<ul class="pf-mes">' + o.mesures.map(function (m) { return '<li><b>' + esc(m.t) + '</b><span>' + esc(m.d) + '</span></li>'; }).join('') + '</ul>';
    h += '<div class="pf-two"><div><span>' + (view === 'athlete' ? 'Ta force' : 'Force') + '</span>' + esc(t[0]) + '</div><div><span>' + (view === 'athlete' ? 'Ce qu\'on va travailler' : 'Point faible') + '</span>' + esc(t[1]) + '</div></div>';
    if (view !== 'athlete') h += '<p class="pf-coach"><b>Pour l\'entraînement :</b> ' + esc(t[2]) + '</p>';
    h += '<p class="pf-conf">Confiance : ' + o.conf + (o.manque.length ? ' · Pour affiner : ' + o.manque.map(esc).join(' ; ') : '') + '</p>';
    return h + '</section>';
  }
  function durCard(d, view) {
    var h = '<section class="pf-card"><div class="pf-head"><b>Résistance à la fatigue</b>';
    if (d.p == null) return h + '<span class="pf-tag off">Pas assez de données</span></div><p class="pf-miss">Il faut au moins 3 sorties longues analysées (course ou vélo, avec fréquence cardiaque) : ' + d.n + ' pour l\'instant.</p></section>';
    var good = d.m < 5;
    h += '<span class="pf-tag">' + (good ? 'Solide' : d.m < 8 ? 'Correcte' : 'À renforcer') + '</span></div>';
    h += '<p class="pf-txt">Sur tes ' + d.n + ' dernières sorties longues, ta fréquence cardiaque dérive en moyenne de <b>' + d.m.toFixed(1).replace('.', ',') + ' %</b> à allure égale entre la première et la seconde moitié.</p>';
    if (view !== 'athlete') h += '<p class="pf-coach"><b>Pour l\'entraînement :</b> ' + (good ? 'bonne tenue sur la durée, on peut allonger les sorties longues ou y placer de l\'allure course.' : 'allonger progressivement les sorties longues en restant vraiment facile, et soigner l\'alimentation pendant l\'effort.') + '</p>';
    return h + '</section>';
  }
  var CSS = '.pf-wrap{max-width:640px}.pf-sw{display:flex;gap:6px;margin:8px 0 14px}.pf-sw button{border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:99px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer}.pf-sw button.on{background:var(--accent);color:#0b1120;border-color:var(--accent);font-weight:700}'
    + '.pf-card{border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:12px;background:var(--panel-2,rgba(255,255,255,.03))}.pf-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.pf-head b{font-size:16px}'
    + '.pf-tag{font-size:12px;font-weight:700;border-radius:99px;padding:4px 10px;background:rgba(70,194,216,.15);color:var(--accent-ink,var(--accent))}.pf-tag.off{background:rgba(148,163,184,.15);color:var(--muted)}'
    + '.pf-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px}.pf-l{font-size:12px;color:var(--muted);width:62px}.pf-l:last-child{text-align:right}.pf-track{flex:1;height:8px;border-radius:4px;background:linear-gradient(90deg,#FF9A3D,#94a3b8 50%,#46C2D8);position:relative}.pf-track i{position:absolute;top:50%;width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid #0b1120;transform:translate(-50%,-50%);box-shadow:0 1px 4px rgba(0,0,0,.4)}'
    + '.pf-mes{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:6px}.pf-mes li{font-size:13.5px}.pf-mes li span{display:block;color:var(--muted);font-size:12.5px}'
    + '.pf-two{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}.pf-two div{font-size:13.5px;line-height:1.45}.pf-two span{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--accent-ink,var(--accent));margin-bottom:3px}'
    + '.pf-coach{font-size:13.5px;background:rgba(255,154,61,.10);border-radius:10px;padding:9px 11px;margin:0 0 8px}.pf-conf,.pf-src{font-size:12px;color:var(--muted);margin:0}.pf-miss,.pf-txt{font-size:13.5px;margin:0}.pf-src{margin-top:6px}'
    + '@media(max-width:560px){.pf-two{grid-template-columns:1fr}}';

  function open(ref, opts) {
    opts = opts || {};
    if (!document.getElementById('pfCss')) { var st = document.createElement('style'); st.id = 'pfCss'; st.textContent = CSS; document.head.appendChild(st); }
    var view = opts.view || 'coach';
    var R = { run: run(ref), bike: bike(ref), swim: swim(ref) }, D = durability(opts.durability);
    var el = document.createElement('div'); el.className = 'adh-overlay';
    function paint() {
      el.innerHTML = '<div class="adh-modal pf-wrap" role="dialog" aria-label="Profil de performance" style="max-height:90vh;overflow:auto">'
        + '<button class="adh-close" aria-label="Fermer"><i class="ic ic-x"></i></button>'
        + '<h3>Profil de performance' + (opts.name ? ' · ' + esc(opts.name) : '') + '</h3>'
        + '<p class="adh-sub" style="margin-top:4px">Où se situe ' + (view === 'athlete' ? 'ton profil' : 'l\'athlète') + ' entre vitesse et endurance, sport par sport, à partir des tests et des séances.</p>'
        + (opts.both ? '<div class="pf-sw"><button data-v="coach" class="' + (view === 'coach' ? 'on' : '') + '">Vue coach</button><button data-v="athlete" class="' + (view === 'athlete' ? 'on' : '') + '">Vue athlète</button></div>' : '')
        + card(R.run, view) + card(R.bike, view) + card(R.swim, view) + durCard(D, view)
        + '<p class="pf-src">Repères de lecture indicatifs, issus de : Sandford et al. 2019 (réserve de vitesse), Pinot et Grappe 2011 (profil de puissance), Maunder et al. 2021 (durabilité), Lievens et al. 2020 (récupération des profils rapides). Le profil évolue avec l\'entraînement : refais les tests tous les 2 à 3 mois.</p>'
        + '</div>';
      el.querySelector('.adh-close').onclick = close;
      el.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function () { view = b.dataset.v; paint(); }; });
    }
    function close() { el.classList.remove('open'); setTimeout(function () { el.remove(); }, 180); }
    paint();
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('open'); });
  }
  window.SilProfil = { open: open, _calc: { run: run, bike: bike, swim: swim, durability: durability } };
})();
