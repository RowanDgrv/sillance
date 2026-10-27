/* ============================================================
   Sillance — rappel du matin : état réel + guide d'installation
   ------------------------------------------------------------
   Partagé par sillance-app / sillance-calendrier / sillance-review
   (la carte « Rappel du matin » y est rendue par chaque *.core.js).
   Ce fichier ne touche à la carte que par délégation d'événements et
   lookups d'id, donc indifférent à l'endroit où elle est rendue.

   1. État réel : depuis la migration 0070 (27/10/2026) tout nouvel
      athlète a le rappel par EMAIL activé par défaut. La carte relit
      donc notification_prefs (PF.getNotifPrefs) et affiche l'heure,
      le canal et un statut, au lieu de toujours montrer 07:00 + «
      Activer ». Option « Désactivé » (channel 'none') ajoutée : un
      rappel actif par défaut doit pouvoir se couper.
   2. Guide : remplace notification-tuto.pdf (ancienne URL github.io,
      FR seul, illisible sur téléphone). S'ouvre depuis le lien
      « Comment recevoir ma notification ? », et automatiquement quand
      l'athlète choisit la notification sur un iPhone où Sillance n'est
      pas installé sur l'écran d'accueil (seul cas où Apple autorise le
      push web, iOS 16.4+) : avant, il recevait juste une erreur.
   ============================================================ */
(function(){
  'use strict';

  var I18N = {
    fr: {
      'rem.none': 'Désactivé',
      'rem.update': 'Mettre à jour le rappel',
      'rem.statusOn': 'Actif : {ch} à {h}',
      'rem.statusOff': 'Rappel désactivé',
      'rem.chEmail': 'email', 'rem.chPush': 'notification', 'rem.chBoth': 'email + notification',
      'rem.disabledToast': 'Rappel du matin désactivé',
      'rem.saveErr': 'Impossible d\'enregistrer, réessaie',
      'guide.title': 'Recevoir ta notification du matin',
      'guide.lead': 'Chaque matin où une séance est prévue : tes séances du jour, le matériel à préparer et un conseil nutrition.',
      'guide.iosWarn': 'Sur iPhone, Apple n\'autorise les notifications que si Sillance est ajouté à l\'écran d\'accueil. Ça prend 20 secondes.',
      'guide.ios1': 'Dans Safari, touche le bouton <b>Partager</b> {share} en bas de l\'écran (en haut sur iPad).',
      'guide.ios2': 'Fais défiler et touche <b>Sur l\'écran d\'accueil</b> {add}',
      'guide.ios3': 'Touche <b>Ajouter</b> en haut à droite.',
      'guide.ios4': 'Ferme Safari et ouvre <b>Sillance depuis la nouvelle icône</b> de ton écran d\'accueil.',
      'guide.ios5': 'Reviens sur « Rappel du matin », choisis <b>Notification</b>, touche <b>Activer le rappel</b> puis <b>Autoriser</b>.',
      'guide.iosOther': 'Tu n\'es pas dans Safari : ouvre <b>sillance.app</b> dans Safari pour faire ces étapes (Chrome sur iPhone le permet aussi avec son bouton Partager, en haut à droite).',
      'guide.iosInstalled': 'Sillance est bien installé sur ton écran d\'accueil. Choisis <b>Notification</b>, touche <b>Activer le rappel</b>, puis <b>Autoriser</b> quand l\'iPhone le demande.',
      'guide.and1': 'Choisis <b>Notification</b> dans « Rappel du matin » et touche <b>Activer le rappel</b>.',
      'guide.and2': 'Touche <b>Autoriser</b> quand Chrome le demande. Une notification de test arrive aussitôt.',
      'guide.and3': 'Bonus : menu <b>⋮</b> puis <b>Installer l\'application</b> pour avoir Sillance comme une app.',
      'guide.desk1': 'Choisis <b>Notification</b> dans « Rappel du matin » et clique <b>Activer le rappel</b>.',
      'guide.desk2': 'Clique <b>Autoriser</b> dans la bulle du navigateur. Une notification de test arrive aussitôt.',
      'guide.emailTitle': 'Plus simple : l\'email',
      'guide.email': 'Le rappel par email est déjà actif par défaut, sans rien installer. Tu peux changer l\'heure ou le couper à tout moment dans « Rappel du matin ».',
      'guide.noSession': 'Pas de séance prévue ce jour-là ? Pas de rappel, pour ne pas te déranger les jours de repos.',
      'guide.ok': 'J\'ai compris',
      'guide.close': 'Fermer'
    },
    en: {
      'rem.none': 'Off',
      'rem.update': 'Update reminder',
      'rem.statusOn': 'On: {ch} at {h}',
      'rem.statusOff': 'Reminder off',
      'rem.chEmail': 'email', 'rem.chPush': 'notification', 'rem.chBoth': 'email + notification',
      'rem.disabledToast': 'Morning reminder turned off',
      'rem.saveErr': 'Couldn\'t save, please try again',
      'guide.title': 'Get your morning notification',
      'guide.lead': 'Every morning with a planned session: today\'s sessions, the gear to pack and a nutrition tip.',
      'guide.iosWarn': 'On iPhone, Apple only allows notifications once Sillance is added to your Home Screen. It takes 20 seconds.',
      'guide.ios1': 'In Safari, tap the <b>Share</b> button {share} at the bottom of the screen (top on iPad).',
      'guide.ios2': 'Scroll down and tap <b>Add to Home Screen</b> {add}',
      'guide.ios3': 'Tap <b>Add</b> in the top right corner.',
      'guide.ios4': 'Close Safari and open <b>Sillance from the new icon</b> on your Home Screen.',
      'guide.ios5': 'Go back to "Morning reminder", pick <b>Notification</b>, tap <b>Enable reminder</b> then <b>Allow</b>.',
      'guide.iosOther': 'You\'re not in Safari: open <b>sillance.app</b> in Safari to follow these steps (Chrome on iPhone also works with its Share button, top right).',
      'guide.iosInstalled': 'Sillance is installed on your Home Screen. Pick <b>Notification</b>, tap <b>Enable reminder</b>, then <b>Allow</b> when your iPhone asks.',
      'guide.and1': 'Pick <b>Notification</b> in "Morning reminder" and tap <b>Enable reminder</b>.',
      'guide.and2': 'Tap <b>Allow</b> when Chrome asks. A test notification arrives right away.',
      'guide.and3': 'Bonus: menu <b>⋮</b> then <b>Install app</b> to use Sillance like an app.',
      'guide.desk1': 'Pick <b>Notification</b> in "Morning reminder" and click <b>Enable reminder</b>.',
      'guide.desk2': 'Click <b>Allow</b> in the browser prompt. A test notification arrives right away.',
      'guide.emailTitle': 'Simpler: email',
      'guide.email': 'The email reminder is already on by default, nothing to install. Change the time or turn it off anytime in "Morning reminder".',
      'guide.noSession': 'No session planned that day? No reminder, so rest days stay quiet.',
      'guide.ok': 'Got it',
      'guide.close': 'Close'
    },
    es: {
      'rem.none': 'Desactivado',
      'rem.update': 'Actualizar recordatorio',
      'rem.statusOn': 'Activo: {ch} a las {h}',
      'rem.statusOff': 'Recordatorio desactivado',
      'rem.chEmail': 'email', 'rem.chPush': 'notificación', 'rem.chBoth': 'email + notificación',
      'rem.disabledToast': 'Recordatorio matutino desactivado',
      'rem.saveErr': 'No se pudo guardar, inténtalo de nuevo',
      'guide.title': 'Recibe tu notificación matutina',
      'guide.lead': 'Cada mañana con una sesión prevista: tus sesiones del día, el material que preparar y un consejo de nutrición.',
      'guide.iosWarn': 'En iPhone, Apple solo permite notificaciones si Sillance está en la pantalla de inicio. Son 20 segundos.',
      'guide.ios1': 'En Safari, toca el botón <b>Compartir</b> {share} abajo en la pantalla (arriba en iPad).',
      'guide.ios2': 'Desliza y toca <b>Añadir a pantalla de inicio</b> {add}',
      'guide.ios3': 'Toca <b>Añadir</b> arriba a la derecha.',
      'guide.ios4': 'Cierra Safari y abre <b>Sillance desde el nuevo icono</b> de tu pantalla de inicio.',
      'guide.ios5': 'Vuelve a «Recordatorio matutino», elige <b>Notificación</b>, toca <b>Activar recordatorio</b> y luego <b>Permitir</b>.',
      'guide.iosOther': 'No estás en Safari: abre <b>sillance.app</b> en Safari para seguir estos pasos (Chrome en iPhone también sirve con su botón Compartir, arriba a la derecha).',
      'guide.iosInstalled': 'Sillance está instalado en tu pantalla de inicio. Elige <b>Notificación</b>, toca <b>Activar recordatorio</b> y luego <b>Permitir</b> cuando el iPhone lo pida.',
      'guide.and1': 'Elige <b>Notificación</b> en «Recordatorio matutino» y toca <b>Activar recordatorio</b>.',
      'guide.and2': 'Toca <b>Permitir</b> cuando Chrome lo pida. Llega al instante una notificación de prueba.',
      'guide.and3': 'Extra: menú <b>⋮</b> y luego <b>Instalar aplicación</b> para usar Sillance como una app.',
      'guide.desk1': 'Elige <b>Notificación</b> en «Recordatorio matutino» y haz clic en <b>Activar recordatorio</b>.',
      'guide.desk2': 'Haz clic en <b>Permitir</b> en el aviso del navegador. Llega al instante una notificación de prueba.',
      'guide.emailTitle': 'Más sencillo: el email',
      'guide.email': 'El recordatorio por email ya está activo por defecto, sin instalar nada. Cambia la hora o desactívalo cuando quieras en «Recordatorio matutino».',
      'guide.noSession': '¿Sin sesión prevista ese día? Sin recordatorio, para no molestarte los días de descanso.',
      'guide.ok': 'Entendido',
      'guide.close': 'Cerrar'
    }
  };
  window.SIL_I18N = window.SIL_I18N || { fr: {}, en: {}, es: {} };
  ['fr', 'en', 'es'].forEach(function(l){
    window.SIL_I18N[l] = window.SIL_I18N[l] || {};
    for(var k in I18N[l]) if(!(k in window.SIL_I18N[l])) window.SIL_I18N[l][k] = I18N[l][k];
  });
  function t(k, vars){
    var s = window.SilI18n ? window.SilI18n.t(k, vars) : (I18N.fr[k] || k);
    if(s === k){ // moteur pas encore prêt : repli local
      var lang = (window.SilI18n && window.SilI18n.getLang()) || 'fr';
      s = (I18N[lang] && I18N[lang][k]) || I18N.fr[k] || k;
      if(vars) for(var v in vars) s = s.split('{' + v + '}').join(vars[v]);
    }
    return s;
  }

  /* ---------- détection appareil ---------- */
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isIOSSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  function isStandalone(){
    try{ if(window.matchMedia('(display-mode: standalone)').matches) return true; }catch(e){}
    return navigator.standalone === true;
  }
  function needsInstall(){ return isIOS && !isStandalone(); }

  /* ---------- icônes iOS (dessinées, pas d'emoji) ---------- */
  var ICON_SHARE = '<svg class="sg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var ICON_ADD = '<svg class="sg-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.5v7M8.5 12h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  /* ---------- guide ---------- */
  var CSS = ''
    + '#silGuideOverlay{z-index:10000}'
    + '.sg-modal{max-width:440px}'
    + '.sg-modal h3{padding-right:40px}'
    + '.sg-lead{color:var(--soft,var(--muted));font-size:var(--fs-base,14px);margin:-4px 0 14px;line-height:1.5}'
    + '.sg-warn{border:1px solid var(--line-strong,var(--line));border-left:3px solid var(--accent);border-radius:10px;padding:10px 12px;font-size:var(--fs-sm,13px);line-height:1.5;margin-bottom:14px}'
    + '.sg-steps{list-style:none;padding:0;margin:0 0 14px;counter-reset:sg}'
    + '.sg-steps li{counter-increment:sg;position:relative;padding:0 0 12px 38px;line-height:1.5;font-size:var(--fs-base,14px)}'
    + '.sg-steps li::before{content:counter(sg);position:absolute;left:0;top:-1px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;background:var(--accent);color:var(--ink,#0b1120)}'
    + '.sg-ic{width:20px;height:20px;vertical-align:-4px;color:var(--accent);margin:0 2px}'
    + '.sg-note{font-size:var(--fs-sm,13px);color:var(--muted);line-height:1.5;margin-bottom:10px}'
    + '.sg-mail{border-top:1px solid var(--line);padding-top:12px;margin-top:4px}'
    + '.sg-mail b{display:block;margin-bottom:2px;color:var(--text)}'
    + '.rem-status{display:block;text-align:center;font-size:var(--fs-sm,13px);color:var(--muted);margin:-2px 0 8px}'
    + '.rem-status.on{color:var(--accent)}';

  // Styles posés dès le chargement : le statut de la carte en dépend aussi,
  // pas seulement le guide.
  (function(){ var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); })();

  var lastFocus = null;
  function stepsHtml(){
    if(isIOS && isStandalone()) return '<ol class="sg-steps"><li>' + t('guide.iosInstalled') + '</li></ol>';
    if(isIOS){
      var vars = { share: ICON_SHARE, add: ICON_ADD };
      return '<div class="sg-warn">' + t('guide.iosWarn') + '</div>'
        + (isIOSSafari ? '' : '<p class="sg-note">' + t('guide.iosOther') + '</p>')
        + '<ol class="sg-steps">'
        + ['guide.ios1', 'guide.ios2', 'guide.ios3', 'guide.ios4', 'guide.ios5']
            .map(function(k){ return '<li>' + t(k, vars) + '</li>'; }).join('')
        + '</ol>';
    }
    var keys = isAndroid ? ['guide.and1', 'guide.and2', 'guide.and3'] : ['guide.desk1', 'guide.desk2'];
    return '<ol class="sg-steps">' + keys.map(function(k){ return '<li>' + t(k) + '</li>'; }).join('') + '</ol>';
  }
  function ensureGuide(){
    var ov = document.getElementById('silGuideOverlay');
    if(ov) return ov;
    ov = document.createElement('div');
    ov.className = 'overlay'; ov.id = 'silGuideOverlay';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'silGuideTitle');
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){
      if(e.target === ov || e.target.closest('[data-sg-close]')) closeGuide();
    });
    ov.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ e.stopPropagation(); closeGuide(); return; }
      if(e.key !== 'Tab') return;
      var f = ov.querySelectorAll('button,a[href]'); if(!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
    return ov;
  }
  function openGuide(){
    var ov = ensureGuide();
    ov.innerHTML = '<div class="modal sg-modal">'
      + '<button class="close" data-sg-close aria-label="' + t('guide.close') + '"><i class="ic ic-x"></i></button>'
      + '<h3 id="silGuideTitle">' + t('guide.title') + '</h3>'
      + '<p class="sg-lead">' + t('guide.lead') + '</p>'
      + stepsHtml()
      + '<p class="sg-note sg-mail"><b>' + t('guide.emailTitle') + '</b>' + t('guide.email') + '</p>'
      + '<p class="sg-note">' + t('guide.noSession') + '</p>'
      + '<button class="btn" data-sg-close style="width:100%">' + t('guide.ok') + '</button>'
      + '</div>';
    lastFocus = document.activeElement;
    ov.classList.add('open');
    var b = ov.querySelector('button.btn'); if(b) b.focus();
  }
  function closeGuide(){
    var ov = document.getElementById('silGuideOverlay'); if(!ov) return;
    ov.classList.remove('open');
    if(lastFocus && lastFocus.focus) try{ lastFocus.focus(); }catch(e){}
  }

  /* ---------- état réel de la carte ---------- */
  // prefsLoaded : requête partie ; prefsReady : réponse reçue (on ne peint
  // l'état qu'à ce moment-là, sinon la carte serait marquée « peinte » vide).
  var prefs = null, prefsLoaded = false, prefsReady = false;
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function chLabel(ch){ return t(ch === 'email' ? 'rem.chEmail' : ch === 'both' ? 'rem.chBoth' : 'rem.chPush'); }
  function paintCard(){
    var sel = document.getElementById('morningChannel');
    var hour = document.getElementById('morningHour');
    var btn = document.getElementById('morningBtn');
    if(!sel || !btn) return;
    if(!sel.querySelector('option[value="none"]')){
      var o = document.createElement('option'); o.value = 'none'; o.textContent = t('rem.none'); sel.appendChild(o);
    }
    var link = btn.parentNode.querySelector('.morning-help');
    if(link && link.getAttribute('href') !== '#'){ link.setAttribute('href', '#'); link.removeAttribute('target'); }
    if(!prefsReady || sel.dataset.remPainted === '1') return;
    sel.dataset.remPainted = '1';
    var status = btn.parentNode.querySelector('.rem-status');
    if(!status){ status = document.createElement('span'); status.className = 'rem-status'; btn.parentNode.insertBefore(status, btn); }
    if(!prefs){ status.textContent = ''; return; }
    var h = pad(prefs.send_hour) + ':' + pad(prefs.send_minute || 0);
    if(hour) hour.value = h;
    sel.value = prefs.channel;
    if(prefs.channel === 'none'){
      status.textContent = t('rem.statusOff'); status.classList.remove('on');
      btn.innerHTML = '<i class="ic ic-bell"></i> ' + t('morning.activate');
    } else {
      status.textContent = t('rem.statusOn', { ch: chLabel(prefs.channel), h: h }); status.classList.add('on');
      btn.innerHTML = '<i class="ic ic-bell"></i> ' + t('rem.update');
    }
  }
  var loadedFor = null;
  function loadPrefs(){
    if(prefsLoaded || !window.PF || !window.PF.user || !window.PF.getNotifPrefs) return;
    prefsLoaded = true; loadedFor = window.PF.user.id;
    window.PF.getNotifPrefs().then(function(p){ prefs = p || null; prefsReady = true; paintCard(); })
      .catch(function(){ prefs = null; prefsReady = true; paintCard(); });
  }
  // PF est posé par sillance-integration.js (module, après la session) et
  // aucun événement n'annonce la connexion : l'athlète peut se connecter
  // longtemps après l'ouverture de la page, ou changer de compte. Vérif
  // légère chaque seconde (une simple comparaison d'id, aucune requête tant
  // que l'utilisateur ne change pas).
  setInterval(function(){
    var uid = window.PF && window.PF.user ? window.PF.user.id : null;
    if(uid !== loadedFor){
      prefsLoaded = false; prefsReady = false; prefs = null; loadedFor = null;
      var sel = document.getElementById('morningChannel'); if(sel) sel.dataset.remPainted = '';
    }
    loadPrefs(); paintCard();
  }, 1000);
  new MutationObserver(function(){
    var sel = document.getElementById('morningChannel');
    if(sel && !sel.dataset.remSeen){ sel.dataset.remSeen = '1'; paintCard(); }
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- interceptions (phase de capture : avant le handler du *.core.js) ---------- */
  document.addEventListener('click', function(e){
    if(e.target.closest('.morning-help')){ e.preventDefault(); openGuide(); return; }
    var btn = e.target.closest('#morningBtn'); if(!btn) return;
    var ch = (document.getElementById('morningChannel') || {}).value;
    if((ch === 'push' || ch === 'both') && needsInstall()){
      e.preventDefault(); e.stopImmediatePropagation(); openGuide(); return;
    }
    if(ch === 'none'){
      e.preventDefault(); e.stopImmediatePropagation();
      var tz = 'Europe/Paris'; try{ tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; }catch(_){}
      var hv = ((document.getElementById('morningHour') || {}).value || '07:00').split(':').map(Number);
      var done = function(){
        prefs = { send_hour: hv[0], send_minute: hv[1] - (hv[1] % 15), channel: 'none' }; prefsReady = true;
        var sel = document.getElementById('morningChannel'); if(sel) sel.dataset.remPainted = '';
        paintCard();
        if(typeof window.toast === 'function') window.toast(t('rem.disabledToast'));
      };
      if(window.PF && window.PF.user && window.PF.saveNotifPrefs){
        window.PF.saveNotifPrefs({ hour: hv[0], minute: hv[1] - (hv[1] % 15), tz: tz, channel: 'none' })
          .then(done).catch(function(){ if(typeof window.toast === 'function') window.toast(t('rem.saveErr'), 'error'); });
      } else done();
      return;
    }
    // Enregistrement normal (email / push / les deux) fait par le *.core.js :
    // on relit l'état une fois la sauvegarde partie pour mettre le statut à jour.
    setTimeout(function(){
      prefsLoaded = false; prefsReady = false;
      var sel = document.getElementById('morningChannel'); if(sel) sel.dataset.remPainted = '';
      loadPrefs();
    }, 2500);
  }, true);
  document.addEventListener('change', function(e){
    if(e.target.id !== 'morningChannel') return;
    if((e.target.value === 'push' || e.target.value === 'both') && needsInstall()) openGuide();
  }, true);

  window.SilReminder = { openGuide: openGuide, needsInstall: needsInstall };
})();
