/* ============================================================
   Sillance — calculateurs gratuits (pages /outils/…), 04/11/2026
   ------------------------------------------------------------
   Zones IDENTIQUES à celles de l'application (INTENSITY_MODELS de
   sillance-app.core.js) : un athlète qui calcule ses allures ici
   retrouve les mêmes dans Sillance.
   Chaque page déclare <form data-tool="css|vma|ftp|riegel|karvonen|allure">.
   ============================================================ */
(function(){
  'use strict';
  var ZONES = {
    css: [['Récupération',115,108],['Aérobie',108,103],['Seuil (CSS)',103,98],['VO2max',98,92],['Vitesse',92,85]],
    vma: [['Z1 Récupération',0,65],['Z2 Endurance',65,75],['Z3 Tempo',75,85],['Z4 Seuil',85,92],['Z5 VO2max',92,100],['Z6 Vitesse',100,115]],
    ftp: [['Z1 Récupération',0,55],['Z2 Endurance',56,75],['Z3 Tempo',76,90],['Z4 Seuil',91,105],['Z5 VO2max',106,120],['Z6 Anaérobie',121,150]]
  };
  var COLORS = ['#2FD9FF','#39E6A3','#FFD43D','#FFB13D','#FF5470','#E0457A'];

  function parseTime(v){                 // "5:42", "5'42", "342" (secondes) → secondes
    v = String(v || '').trim().replace(/[''′]/g, ':').replace(/"|″/g, '').replace(/\s+/g, '');
    if(!v) return NaN;
    if(/^\d+(\.\d+)?$/.test(v)) return parseFloat(v);
    var p = v.split(':').map(Number);
    if(p.some(isNaN)) return NaN;
    return p.length === 3 ? p[0]*3600 + p[1]*60 + p[2] : p[0]*60 + (p[1] || 0);
  }
  function fmt(sec){                     // secondes → m'ss"
    if(!isFinite(sec) || sec <= 0) return '–';
    var m = Math.floor(sec / 60), s = Math.round(sec - m*60);
    if(s === 60){ m++; s = 0; }
    return m ? m + "'" + String(s).padStart(2, '0') + '"' : s + '"';   // sous la minute : 42" plutôt que 0'42"
  }
  function num(v){ return parseFloat(String(v || '').replace(',', '.')); }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function dot(i){ return '<i class="zdot" style="background:' + COLORS[i % COLORS.length] + '"></i>'; }
  function track(name){ try { window.SilTrack && window.SilTrack.event && window.SilTrack.event('outil_' + name); } catch(_){} }

  /* ---------- CSS natation ---------- */
  function css(form, out){
    var t400 = parseTime(form.t400.value), t200 = parseTime(form.t200.value);
    if(!(t400 > 0 && t200 > 0)) return out.innerHTML = '<p class="tool-err">Renseigne tes deux temps, par exemple 6:20 et 2:58.</p>';
    if(t400 <= t200 * 1.6 || t400 >= t200 * 2.6) return out.innerHTML = '<p class="tool-err">Ces deux temps ne sont pas cohérents : ton 400 m doit durer un peu plus du double de ton 200 m.</p>';
    var cssSec = (t400 - t200) / 2;      // temps au 100 m à la vitesse critique
    var rows = ZONES.css.map(function(z, i){
      return '<tr><td>' + dot(i) + esc(z[0]) + '</td><td>' + z[2] + ' – ' + z[1] + ' %</td><td><b>' + fmt(cssSec*z[2]/100) + ' – ' + fmt(cssSec*z[1]/100) + '</b> / 100 m</td></tr>';
    }).join('');
    out.innerHTML = '<div class="tool-res"><div class="big">' + fmt(cssSec) + ' <small>/ 100 m</small></div>'
      + '<p>Ta CSS (vitesse critique de nage) : <b>' + (100/cssSec).toFixed(2).replace('.', ',') + ' m/s</b>. C\'est l\'allure que tu peux tenir environ 30 minutes : ton allure seuil.</p>'
      + '<table class="ztab"><thead><tr><th>Zone</th><th>% CSS</th><th>Temps au 100 m</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<p class="tool-ex">Exemple : 6 × 200 m au seuil = entre <b>' + fmt(cssSec*2*0.98) + '</b> et <b>' + fmt(cssSec*2*1.03) + '</b> par 200 m.</p></div>';
    track('css');
  }

  /* ---------- Allures VMA ---------- */
  function vma(form, out){
    var v = num(form.vma.value), d6 = num(form.d6 && form.d6.value);
    if(!(v > 0) && d6 > 0) v = d6 / 100;  // test de 6 minutes : distance (m) / 100 = VMA (km/h)
    if(!(v >= 8 && v <= 28)) return out.innerHTML = '<p class="tool-err">Indique une VMA entre 8 et 28 km/h, ou la distance courue en 6 minutes.</p>';
    var pace = function(kmh){ return kmh > 0 ? fmt(3600 / kmh) : '–'; };
    var rows = ZONES.vma.map(function(z, i){
      var lo = Math.max(z[1], 50), hi = z[2];
      return '<tr><td>' + dot(i) + esc(z[0]) + '</td><td>' + lo + ' – ' + hi + ' %</td><td>' + (v*lo/100).toFixed(1).replace('.', ',') + ' – ' + (v*hi/100).toFixed(1).replace('.', ',') + ' km/h</td><td><b>' + pace(v*hi/100) + ' – ' + pace(v*lo/100) + '</b> /km</td></tr>';
    }).join('');
    var t = function(dist, pct){ return fmt(dist / (v*pct/100/3.6)); };
    out.innerHTML = '<div class="tool-res"><div class="big">' + v.toFixed(1).replace('.', ',') + ' <small>km/h de VMA</small></div>'
      + '<p>Allure à 100 % de VMA : <b>' + pace(v) + ' /km</b>.</p>'
      + '<table class="ztab"><thead><tr><th>Zone</th><th>% VMA</th><th>Vitesse</th><th>Allure</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<p class="tool-ex">Fractionné : 400 m à 100 % VMA en <b>' + t(400, 100) + '</b> · 1 000 m à 92 % (seuil haut) en <b>' + t(1000, 92) + '</b> · 200 m à 105 % en <b>' + t(200, 105) + '</b>.</p></div>';
    track('vma');
  }

  /* ---------- Zones de puissance FTP ---------- */
  function ftp(form, out){
    var f = num(form.ftp.value), p20 = num(form.p20 && form.p20.value), kg = num(form.kg && form.kg.value);
    if(!(f > 0) && p20 > 0) f = Math.round(p20 * 0.95);   // test de 20 minutes : 95 % de la puissance moyenne
    if(!(f >= 80 && f <= 600)) return out.innerHTML = '<p class="tool-err">Indique une FTP entre 80 et 600 W, ou ta puissance moyenne sur un test de 20 minutes.</p>';
    var rows = ZONES.ftp.map(function(z, i){
      return '<tr><td>' + dot(i) + esc(z[0]) + '</td><td>' + z[1] + ' – ' + z[2] + ' %</td><td><b>' + Math.round(f*z[1]/100) + ' – ' + Math.round(f*z[2]/100) + ' W</b></td></tr>';
    }).join('');
    out.innerHTML = '<div class="tool-res"><div class="big">' + f + ' <small>W de FTP</small></div>'
      + (kg >= 30 && kg <= 150 ? '<p>Soit <b>' + (f/kg).toFixed(2).replace('.', ',') + ' W/kg</b>.</p>' : '')
      + '<table class="ztab"><thead><tr><th>Zone</th><th>% FTP</th><th>Puissance</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<p class="tool-ex">Exemple : 3 × 10 min au seuil = entre <b>' + Math.round(f*0.91) + '</b> et <b>' + Math.round(f*1.05) + ' W</b>.</p></div>';
    track('ftp');
  }

  function hms(sec){                     // secondes → h:mm:ss ou m'ss"
    if(!isFinite(sec) || sec <= 0) return '–';
    sec = Math.round(sec); var h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = sec%60;
    return h ? h + 'h' + String(m).padStart(2,'0') + "'" + String(s).padStart(2,'0') + '"' : fmt(sec);
  }
  var RACES = [['5 km',5],['10 km',10],['Semi-marathon',21.0975],['Marathon',42.195]];

  /* ---------- Prédiction de temps (Riegel 1981 : T2 = T1 × (D2/D1)^1,06) ---------- */
  function riegel(form, out){
    var d1 = form.dist.value === 'autre' ? num(form.distAutre.value) : num(form.dist.value);
    var t1 = parseTime(form.temps.value);
    if(!(d1 > 0.4 && d1 <= 100) || !(t1 > 0)) return out.innerHTML = '<p class="tool-err">Indique une distance et un temps de course récent, par exemple 10 km en 48:30.</p>';
    var mins = t1/60, warn = (mins < 3.5 || mins > 230) ? '<p class="tool-err">Ton temps de référence sort de la plage où la formule a été établie (3,5 à 230 minutes) : prends les résultats avec encore plus de prudence.</p>' : '';
    var rows = RACES.map(function(r, i){
      var t = t1 * Math.pow(r[1]/d1, 1.06);
      return '<tr><td>' + dot(i) + r[0] + '</td><td><b>' + hms(t) + '</b></td><td>' + fmt(t/r[1]) + ' /km</td></tr>';
    }).join('');
    out.innerHTML = '<div class="tool-res">' + warn + '<p>À partir de <b>' + String(d1).replace('.', ',') + ' km en ' + hms(t1) + '</b> :</p>'
      + '<table class="ztab"><thead><tr><th>Course</th><th>Temps estimé</th><th>Allure</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<p class="tool-ex">C\'est une <b>estimation</b> : elle suppose un entraînement adapté à la distance visée. Sur semi et marathon, elle est souvent trop optimiste si le volume d\'endurance manque.</p></div>';
    track('riegel');
  }

  /* ---------- Zones de fréquence cardiaque (Karvonen 1957 + % FC max) ---------- */
  var FC_ZONES = [['Z1 Récupération',50,60],['Z2 Endurance',60,70],['Z3 Tempo',70,80],['Z4 Seuil',80,90],['Z5 VO2max',90,100]];
  function karvonen(form, out){
    var max = num(form.fcmax.value), rest = num(form.fcrepos.value), age = num(form.age && form.age.value), est = '';
    if(!(max > 0) && age >= 12 && age <= 90){ max = Math.round(208 - 0.7*age); est = '<p class="tool-err">FC max <b>estimée</b> à ' + max + ' bpm d\'après ton âge (208 − 0,7 × âge). Une vraie mesure, sur un test d\'effort, est plus fiable : l\'écart avec ta FC max réelle peut être important.</p>'; }
    if(!(max >= 120 && max <= 230)) return out.innerHTML = '<p class="tool-err">Indique ta FC max (entre 120 et 230 bpm), ou ton âge pour l\'estimer.</p>';
    if(!(rest >= 30 && rest < max - 40)) return out.innerHTML = '<p class="tool-err">Indique ta FC de repos, mesurée le matin au réveil (souvent entre 40 et 70 bpm).</p>';
    var res = max - rest;
    var rows = FC_ZONES.map(function(z, i){
      var lo = Math.round(rest + res*z[1]/100), hi = Math.round(rest + res*z[2]/100);
      return '<tr><td>' + dot(i) + z[0] + '</td><td><b>' + lo + ' – ' + hi + '</b> bpm</td><td>' + Math.round(max*z[1]/100) + ' – ' + Math.round(max*z[2]/100) + ' bpm</td></tr>';
    }).join('');
    out.innerHTML = '<div class="tool-res">' + est + '<div class="big">' + res + ' <small>bpm de réserve</small></div>'
      + '<p>FC de réserve = FC max (' + max + ') − FC de repos (' + rest + ').</p>'
      + '<table class="ztab"><thead><tr><th>Zone</th><th>Karvonen (réserve)</th><th>% FC max</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<p class="tool-ex">La méthode de Karvonen tient compte de ta FC de repos : ses zones sont plus hautes que celles calculées en % de FC max, surtout en endurance.</p></div>';
    track('karvonen');
  }

  /* ---------- Convertisseur allure ↔ vitesse ---------- */
  function allure(form, out){
    var pace = parseTime(form.allure.value), v = num(form.vitesse.value);
    if(pace > 0) v = 3600/pace; else if(v > 0) pace = 3600/v;
    if(!(v >= 3 && v <= 30)) return out.innerHTML = '<p class="tool-err">Indique une allure (ex. 5:15 au km) ou une vitesse (ex. 11,4 km/h).</p>';
    var splits = [['400 m',0.4],['1 km',1]].concat(RACES).map(function(r, i){
      return '<tr><td>' + dot(i) + r[0] + '</td><td><b>' + hms(pace*r[1]) + '</b></td></tr>';
    }).join('');
    out.innerHTML = '<div class="tool-res"><div class="big">' + fmt(pace) + ' <small>/km</small> = ' + v.toFixed(1).replace('.', ',') + ' <small>km/h</small></div>'
      + '<table class="ztab"><thead><tr><th>Distance</th><th>Temps à cette allure</th></tr></thead><tbody>' + splits + '</tbody></table></div>';
    track('allure');
  }

  var TOOLS = { css: css, vma: vma, ftp: ftp, riegel: riegel, karvonen: karvonen, allure: allure };
  document.querySelectorAll('form[data-tool]').forEach(function(form){
    var out = document.getElementById(form.getAttribute('data-out'));
    var run = TOOLS[form.getAttribute('data-tool')];
    if(!out || !run) return;
    form.addEventListener('submit', function(e){ e.preventDefault(); run(form, out); out.scrollIntoView({behavior:'smooth', block:'nearest'}); });
  });
})();
