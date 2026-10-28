/* ============================================================
   Sillance — fenêtre de résultat de l'assistant IA
   ------------------------------------------------------------
   Partagée par sillance-app / sillance-calendrier / sillance-review.
   Demande de Rowan (28/10/2026) : après le chargement de l'analyse IA
   (une séance, ou toute la semaine), le résultat doit apparaître dans
   une fenêtre bien visible, pas seulement en ligne sous le calendrier.
   En cas d'échec, la fenêtre dit POURQUOI (clé, crédit, modèle…) au lieu
   de revenir silencieusement au bouton : avant, un échec ne laissait
   aucune trace à l'écran et aucun résumé n'avait jamais été enregistré.

   API : SilAiPopup.show({ kind:'session'|'week', title, result, isDemo })
         SilAiPopup.showError({ kind, detail })
   result = { tenu|verdict, headline, bullets:[{s|status, t|text}], recos:[] }
   ============================================================ */
(function(){
  'use strict';

  var I18N = {
    fr: {
      'aip.titleSession': 'Analyse de la séance',
      'aip.titleWeek': 'Analyse de la semaine',
      'aip.points': 'Points clés',
      'aip.recos': 'Pour la suite',
      'aip.demo': 'Exemple (démo)',
      'aip.close': 'Fermer',
      'aip.errTitle': 'Analyse IA indisponible',
      'aip.errIntro': 'L\'analyse n\'a pas pu être générée. Rien n\'a été facturé.',
      'aip.err.anthropic_credit': 'Le crédit du service d\'IA est épuisé. C\'est un réglage côté Sillance, pas de ton côté.',
      'aip.err.missing_key': 'Le service d\'IA n\'est pas configuré côté Sillance.',
      'aip.err.auth': 'La clé du service d\'IA est refusée. C\'est un réglage côté Sillance, pas de ton côté.',
      'aip.err.model': 'Le modèle d\'IA demandé n\'est pas disponible.',
      'aip.err.overloaded': 'Le service d\'IA est surchargé. Réessaie dans une minute.',
      'aip.err.rate': 'Trop de demandes d\'un coup. Réessaie dans une minute.',
      'aip.err.bad_output': 'La réponse de l\'IA était illisible. Réessaie.',
      'aip.err.add_on_required': 'L\'assistant IA n\'est pas actif sur ton compte.',
      'aip.err.network': 'Connexion impossible. Vérifie ton réseau et réessaie.',
      'aip.err.unknown': 'Erreur inattendue. Réessaie, et préviens-nous si ça continue.',
      'aip.code': 'Code',
      'aip.open': 'Voir l\'analyse en grand',
      'aip.weekOf': 'Semaine du {d}'
    },
    en: {
      'aip.titleSession': 'Session analysis',
      'aip.titleWeek': 'Week analysis',
      'aip.points': 'Key points',
      'aip.recos': 'Next steps',
      'aip.demo': 'Example (demo)',
      'aip.close': 'Close',
      'aip.errTitle': 'AI analysis unavailable',
      'aip.errIntro': 'The analysis couldn\'t be generated. Nothing was charged.',
      'aip.err.anthropic_credit': 'The AI service has run out of credit. This is on Sillance\'s side, not yours.',
      'aip.err.missing_key': 'The AI service isn\'t configured on Sillance\'s side.',
      'aip.err.auth': 'The AI service key was rejected. This is on Sillance\'s side, not yours.',
      'aip.err.model': 'The requested AI model isn\'t available.',
      'aip.err.overloaded': 'The AI service is overloaded. Try again in a minute.',
      'aip.err.rate': 'Too many requests at once. Try again in a minute.',
      'aip.err.bad_output': 'The AI response was unreadable. Try again.',
      'aip.err.add_on_required': 'The AI assistant isn\'t active on your account.',
      'aip.err.network': 'Can\'t connect. Check your network and try again.',
      'aip.err.unknown': 'Unexpected error. Try again, and let us know if it keeps happening.',
      'aip.code': 'Code',
      'aip.open': 'Open full analysis',
      'aip.weekOf': 'Week of {d}'
    },
    es: {
      'aip.titleSession': 'Análisis de la sesión',
      'aip.titleWeek': 'Análisis de la semana',
      'aip.points': 'Puntos clave',
      'aip.recos': 'Para seguir',
      'aip.demo': 'Ejemplo (demo)',
      'aip.close': 'Cerrar',
      'aip.errTitle': 'Análisis IA no disponible',
      'aip.errIntro': 'No se pudo generar el análisis. No se ha cobrado nada.',
      'aip.err.anthropic_credit': 'El servicio de IA se ha quedado sin crédito. Es un ajuste de Sillance, no tuyo.',
      'aip.err.missing_key': 'El servicio de IA no está configurado en Sillance.',
      'aip.err.auth': 'La clave del servicio de IA ha sido rechazada. Es un ajuste de Sillance, no tuyo.',
      'aip.err.model': 'El modelo de IA solicitado no está disponible.',
      'aip.err.overloaded': 'El servicio de IA está saturado. Inténtalo en un minuto.',
      'aip.err.rate': 'Demasiadas solicitudes a la vez. Inténtalo en un minuto.',
      'aip.err.bad_output': 'La respuesta de la IA era ilegible. Inténtalo de nuevo.',
      'aip.err.add_on_required': 'El asistente IA no está activo en tu cuenta.',
      'aip.err.network': 'No se puede conectar. Revisa tu red e inténtalo de nuevo.',
      'aip.err.unknown': 'Error inesperado. Inténtalo de nuevo y avísanos si continúa.',
      'aip.code': 'Código',
      'aip.open': 'Ver el análisis completo',
      'aip.weekOf': 'Semana del {d}'
    }
  };
  window.SIL_I18N = window.SIL_I18N || { fr: {}, en: {}, es: {} };
  ['fr', 'en', 'es'].forEach(function(l){
    window.SIL_I18N[l] = window.SIL_I18N[l] || {};
    for(var k in I18N[l]) if(!(k in window.SIL_I18N[l])) window.SIL_I18N[l][k] = I18N[l][k];
  });
  function t(k, vars){
    var s = window.SilI18n ? window.SilI18n.t(k, vars) : k;
    if(s === k){
      var lang = (window.SilI18n && window.SilI18n.getLang()) || 'fr';
      s = (I18N[lang] && I18N[lang][k]) || I18N.fr[k] || k;
      if(vars) for(var v in vars) s = s.split('{' + v + '}').join(vars[v]);
    }
    return s;
  }
  function esc(x){
    return String(x == null ? '' : x).replace(/[&<>"']/g, function(c){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var CSS = ''
    + '#silAiPopup{z-index:10000}'
    + '#silAiPopup .modal{max-width:520px}'
    + '#silAiPopup h3{padding-right:40px}'
    + '.aip-sub{color:var(--muted);font-size:var(--fs-sm,13px);margin:-8px 0 14px}'
    + '.aip-verdict{display:inline-flex;align-items:center;gap:8px;font-weight:800;font-size:var(--fs-sm,13px);letter-spacing:.06em;text-transform:uppercase;color:var(--av);border:1px solid var(--av);border-radius:99px;padding:5px 12px;margin-bottom:12px}'
    + '.aip-headline{font-size:var(--fs-lg,17px);line-height:1.45;font-weight:600;margin-bottom:16px}'
    + '.aip-h{font-size:var(--fs-xs,11px);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:14px 0 8px}'
    + '.aip-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}'
    + '.aip-list li{display:flex;gap:10px;line-height:1.45;font-size:var(--fs-base,14px)}'
    + '.aip-dot{flex:none;width:9px;height:9px;border-radius:50%;margin-top:6px;background:var(--muted)}'
    + '.aip-dot.ok{background:var(--good)}.aip-dot.warn{background:var(--bike)}.aip-dot.bad{background:var(--run)}'
    + '.aip-recos{list-style:disc;padding-left:20px;margin:0;line-height:1.5;font-size:var(--fs-base,14px)}'
    + '.aip-demo{display:inline-block;margin-left:8px;font-size:11px;color:var(--muted);border:1px dashed var(--line-strong);border-radius:99px;padding:2px 8px;vertical-align:middle}'
    + '.aip-err{border-left:3px solid var(--run);padding:10px 12px;border-radius:8px;background:color-mix(in srgb,var(--run) 8%,transparent);line-height:1.5}'
    + '.aip-code{margin-top:10px;font-size:11px;color:var(--muted);font-family:var(--font-data,monospace)}';

  var lastFocus = null;
  function ensure(){
    var ov = document.getElementById('silAiPopup');
    if(ov) return ov;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    ov = document.createElement('div');
    ov.className = 'overlay'; ov.id = 'silAiPopup';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'silAiPopupT');
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){
      if(e.target === ov || e.target.closest('[data-aip-close]')) close();
    });
    ov.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ e.stopPropagation(); close(); return; }
      if(e.key !== 'Tab') return;
      var f = ov.querySelectorAll('button,a[href]'); if(!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });
    return ov;
  }
  function open(inner){
    var ov = ensure();
    ov.innerHTML = '<div class="modal">'
      + '<button class="close" data-aip-close aria-label="' + esc(t('aip.close')) + '"><i class="ic ic-x"></i></button>'
      + inner
      + '<button class="btn" data-aip-close style="width:100%;margin-top:18px">' + esc(t('aip.close')) + '</button>'
      + '</div>';
    lastFocus = document.activeElement;
    ov.classList.add('open');
    var b = ov.querySelector('.btn'); if(b) b.focus();
  }
  function close(){
    var ov = document.getElementById('silAiPopup'); if(!ov) return;
    ov.classList.remove('open');
    if(lastFocus && lastFocus.focus) try{ lastFocus.focus(); }catch(e){}
  }

  function verdictMeta(v){
    if(v === 'libre') return { c: 'var(--muted)', l: t('aiVerdict.free') };
    if(v === 'oui') return { c: 'var(--good)', l: t('aiVerdict.met') };
    if(v === 'partiel') return { c: 'var(--bike)', l: t('aiVerdict.partial') };
    return { c: 'var(--run)', l: t('aiVerdict.missed') };
  }

  function show(o){
    var r = o.result || {};
    var v = verdictMeta(r.tenu || r.verdict);
    var bullets = (r.bullets || []).map(function(b){
      var st = b.s || b.status || '';
      return '<li><span class="aip-dot ' + esc(st) + '"></span><span>' + esc(b.t || b.text) + '</span></li>';
    }).join('');
    var recos = (r.recos || []).filter(Boolean).map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('');
    open(
      '<h3 id="silAiPopupT">' + esc(t(o.kind === 'week' ? 'aip.titleWeek' : 'aip.titleSession'))
        + (o.isDemo ? '<span class="aip-demo">' + esc(t('aip.demo')) + '</span>' : '') + '</h3>'
      + (o.title ? '<p class="aip-sub">' + esc(o.title) + '</p>' : '')
      + '<div class="aip-verdict" style="--av:' + v.c + '">' + esc(v.l) + '</div>'
      + '<div class="aip-headline">' + esc(r.headline) + '</div>'
      + (bullets ? '<div class="aip-h">' + esc(t('aip.points')) + '</div><ul class="aip-list">' + bullets + '</ul>' : '')
      + (recos ? '<div class="aip-h">' + esc(t('aip.recos')) + '</div><ul class="aip-recos">' + recos + '</ul>' : '')
    );
  }

  function errKey(detail){
    var d = String(detail || 'unknown');
    if(d === 'anthropic_credit' || d === 'missing_key' || d === 'bad_output' || d === 'add_on_required' || d === 'network') return 'aip.err.' + d;
    if(/^anthropic_401|authentication|permission/.test(d)) return 'aip.err.auth';
    if(/^anthropic_404|not_found/.test(d)) return 'aip.err.model';
    if(/^anthropic_529|overloaded/.test(d)) return 'aip.err.overloaded';
    if(/^anthropic_429|rate_limit/.test(d)) return 'aip.err.rate';
    return 'aip.err.unknown';
  }
  function showError(o){
    var detail = (o && o.detail) || 'unknown';
    open(
      '<h3 id="silAiPopupT">' + esc(t('aip.errTitle')) + '</h3>'
      + '<p class="aip-sub">' + esc(t('aip.errIntro')) + '</p>'
      + '<div class="aip-err">' + esc(t(errKey(detail))) + '</div>'
      + '<div class="aip-code">' + esc(t('aip.code')) + ' : ' + esc(detail) + '</div>'
    );
  }

  window.SilAiPopup = { show: show, showError: showError, close: close };
})();
