/* Sillance — page contact : le formulaire pré-remplit un e-mail vers le support.
   Aucun backend : on construit un lien mailto: et on l'ouvre. Fonctionne
   partout, respecte la CSP (script-src 'self'). */
(function(){
  var SUPPORT = 'contact@sillance.app';

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

      window.location.href = href;

      status.hidden = false;
      status.style.color = 'var(--accent)';
      status.innerHTML = tr('contact.js.opened',
        "Ton logiciel de messagerie devrait s'ouvrir. S'il ne s'ouvre pas, écris à ") +
        '<a href="mailto:' + SUPPORT + '">' + SUPPORT + '</a>.';
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ready);
  }else{
    ready();
  }
})();
