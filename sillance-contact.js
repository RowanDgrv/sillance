/* Sillance — page contact (12/11/2026) : le message est enregistré directement
   (table support_requests, écriture seule pour le public) et le support est
   prévenu par e-mail. Avant, le formulaire ne faisait qu'ouvrir le logiciel de
   messagerie du visiteur : rien n'arrivait si celui-ci n'en avait pas, et aucune
   trace n'était gardée. Si l'enregistrement échoue, on retombe sur cet ancien
   comportement (lien mailto:) pour ne jamais perdre un message. */
(function(){
  var SUPPORT = 'contact@sillance.app';
  // Adresse et clé PUBLIQUES du projet (les mêmes que dans sillance-client.js).
  var API = 'https://onbsgohvqejccowfnrbs.supabase.co/rest/v1/support_requests';
  var KEY = 'sb_publishable_Tiz8pcjnik-Xj85Jvahivw_dfNqf_TT';

  function tr(key, fallback){
    try{
      if(window.SilI18n && typeof window.SilI18n.t === 'function'){
        var v = window.SilI18n.t(key);
        if(v && v !== key) return v;
      }
    }catch(e){}
    return fallback;
  }

  function selectedText(sel){
    if(!sel || sel.selectedIndex < 0) return '';
    return (sel.options[sel.selectedIndex].textContent || '').trim();
  }

  function ready(){
    var form = document.getElementById('contactForm');
    if(!form) return;

    // Lien venu de la page coach : ?sujet=coaching présélectionne le sujet.
    try{
      var wanted = (/[?&]sujet=([a-z]{1,20})/.exec(location.search) || [])[1];
      var sel0 = form.querySelector('#cf-subject');
      if(wanted && sel0 && sel0.querySelector('option[value="' + wanted + '"]')) sel0.value = wanted;
    }catch(e){}

    var status = document.createElement('p');
    status.className = 'form-note';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.style.color = 'var(--accent)';
    status.hidden = true;
    form.appendChild(status);

    form.addEventListener('submit', function(ev){
      ev.preventDefault();

      var name    = (form.querySelector('#cf-name')    || {}).value || '';
      var email   = (form.querySelector('#cf-email')   || {}).value || '';
      var message = (form.querySelector('#cf-message') || {}).value || '';
      var roleSel = form.querySelector('#cf-role');
      var subjSel = form.querySelector('#cf-subject');

      name = name.trim(); email = email.trim(); message = message.trim();

      if(!email || email.indexOf('@') < 1 || email.indexOf('.') < 0){
        status.hidden = false;
        status.style.color = 'var(--orange)';
        status.textContent = tr('contact.js.needEmail', "Merci d'indiquer une adresse e-mail valide.");
        (form.querySelector('#cf-email') || form).focus();
        return;
      }
      if(!message){
        status.hidden = false;
        status.style.color = 'var(--orange)';
        status.textContent = tr('contact.js.needMessage', "Merci d'écrire ton message.");
        (form.querySelector('#cf-message') || form).focus();
        return;
      }

      var subjectText = selectedText(subjSel) || tr('contact.form.subjOther', 'Contact');
      var roleText = roleSel && roleSel.value ? selectedText(roleSel) : '';

      var lblName = tr('contact.js.bodyName', 'Nom');
      var lblRole = tr('contact.js.bodyRole', 'Rôle');
      var lblFrom = tr('contact.js.bodyFrom', 'E-mail');

      var lines = [];
      if(name)     lines.push(lblName + ' : ' + name);
      if(roleText) lines.push(lblRole + ' : ' + roleText);
      lines.push(lblFrom + ' : ' + email);
      lines.push('');
      lines.push(message);

      var subject = subjectText + ' — Sillance';
      var href = 'mailto:' + SUPPORT +
                 '?subject=' + encodeURIComponent(subject) +
                 '&body='    + encodeURIComponent(lines.join('\n'));

      var fallback = function(){
        window.location.href = href;
        status.hidden = false;
        status.style.color = 'var(--accent)';
        status.innerHTML = tr('contact.js.opened',
          "Ton logiciel de messagerie devrait s'ouvrir. S'il ne s'ouvre pas, écris à ") +
          '<a href="mailto:' + SUPPORT + '">' + SUPPORT + '</a>.';
      };
      // champ piège rempli = robot : on fait comme si c'était parti, sans rien enregistrer
      var trap = (form.querySelector('#cf-site') || {}).value;
      var btn = form.querySelector('button[type="submit"]');
      var done = function(){
        form.reset();
        status.hidden = false;
        status.style.color = 'var(--accent)';
        status.textContent = tr('contact.js.sent', "Message bien reçu. On te répond sous 2 à 3 jours ouvrés, à l'adresse indiquée.");
      };
      if(trap){ done(); return; }
      if(!window.fetch){ fallback(); return; }
      if(btn) btn.disabled = true;
      status.hidden = false; status.style.color = 'var(--accent)';
      status.textContent = tr('contact.js.sending', 'Envoi en cours...');
      var lang = (document.documentElement.getAttribute('lang') || '').slice(0, 8);
      fetch(API, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ name: name.slice(0, 120), email: email.slice(0, 200), role: roleText.slice(0, 80),
                               subject: subjectText.slice(0, 160), message: message.slice(0, 4000), lang: lang })
      }).then(function(r){ if(btn) btn.disabled = false; if(r.ok) done(); else fallback(); })
        .catch(function(){ if(btn) btn.disabled = false; fallback(); });
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ready);
  }else{
    ready();
  }
})();
