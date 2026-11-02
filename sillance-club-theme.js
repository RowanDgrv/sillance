/* ============================================================
   Sillance — habillage par club (02/11/2026)
   ------------------------------------------------------------
   Une seule interface, aux couleurs de chaque club (run club, athlé,
   tri) : le propriétaire choisit couleur principale, secondaire, fond,
   police et logo (clubs.theme, 0085) ; les membres du club voient
   l'app à ces couleurs dès qu'ils l'ont rejoint.

   Ce qui change : --accent / --accent2 (marque), --ink / --panel /
   --panel-2 (surfaces), --font-display (titres), le logo et le nom du
   club dans la barre du haut. Ce qui NE change PAS : les couleurs de
   données (sports, zones, bon/mauvais) — c'est un code, pas de la déco.

   Garde-fous lisibilité : le texte des boutons est sombre partout dans
   l'app → la couleur principale est éclaircie automatiquement si elle
   est trop foncée ; l'interface est sombre → le fond est assombri s'il
   est trop clair. Un club ne peut donc pas rendre l'app illisible.

   Modification : ADMIN uniquement (admin-crm setClubTheme, trigger 0085).
   Mise en cache locale (sil_club_theme) : appliqué dès le <head> au
   rechargement, sans flash du thème Sillance.
   ============================================================ */
(function(){
  'use strict';
  var KEY = 'sil_club_theme';
  var BTN_TEXT = '#06222A';          // couleur du texte posé sur --accent (.btn…)
  var UI_TEXT = '#EAEEF7';           // texte courant (interface sombre)

  var PRESETS = {
    sillance: {label:'Sillance',     accent:'#46C2D8', accent2:'#FF9A3D', bg:'#080B12', font:'Oswald'},
    feu:      {label:'Feu',          accent:'#FF5A1F', accent2:'#FFC233', bg:'#160805', font:'Anton'},
    neon:     {label:'Néon',         accent:'#FF3EA5', accent2:'#B98CFF', bg:'#0D0614', font:'Bebas Neue'},
    piste:    {label:'Piste',        accent:'#5B93FF', accent2:'#FF5252', bg:'#070B1A', font:'Barlow Condensed'},
    foret:    {label:'Forêt',        accent:'#7BC86C', accent2:'#E8C547', bg:'#07100A', font:'Archivo Black'},
    craie:    {label:'Craie',        accent:'#E8E4DA', accent2:'#C9A66B', bg:'#0B0B0B', font:'Space Grotesk'}
  };
  // police de titres (Google Fonts, autorisé par la CSP : fonts.googleapis/gstatic)
  var FONTS = {
    'Oswald':'Oswald:wght@500;600;700', 'Anton':'Anton', 'Bebas Neue':'Bebas+Neue',
    'Barlow Condensed':'Barlow+Condensed:wght@600;700;800', 'Archivo Black':'Archivo+Black',
    'Space Grotesk':'Space+Grotesk:wght@500;600;700', 'Playfair Display':'Playfair+Display:wght@600;700;800',
    'Permanent Marker':'Permanent+Marker'
  };

  var I18N = {
    fr:{proposals:'Propositions pour ce club', newProp:'+ Nouvelle proposition', propName:'Nom de la proposition', propNamePh:'Ex. Braise', addProp:'Ajouter aux propositions', updateProp:'Mettre à jour la proposition', edit:'Modifier', del:'Supprimer', close:'Fermer', propSaved:'Propositions enregistrées : le gérant peut les choisir.', noProps:'Aucune proposition pour l’instant : crée la première ci-dessous.', maxProps:'8 propositions maximum par club.', pickSub:'Choisis parmi les habillages préparés pour ton club. Tes membres verront l’app à ces couleurs.', pickNone:'Aucun habillage n’a encore été préparé pour ton club. Écris à contact@sillance.app pour en obtenir un.', applyBtn:'Appliquer', sillanceStyle:'Style Sillance', applied:'Habillage appliqué : tes membres le voient à leur prochaine ouverture.', active:'Actif', studioTitle:'Habillages du club', colors:'Couleurs', title:'Apparence du club', sub:'Les membres de ce club voient Sillance à ces couleurs.', presets:'Styles prêts à l\'emploi',
        accent:'Couleur principale', accent2:'Couleur secondaire', bg:'Fond', font:'Police des titres', logo:'Logo',
        logoAdd:'Ajouter un logo', logoDel:'Retirer', save:'Enregistrer', cancel:'Annuler', reset:'Revenir au style Sillance',
        saved:'Apparence enregistrée : les membres la voient à leur prochaine ouverture.', err:'Enregistrement impossible.',
        outdated:'Apparence non enregistrée : la mise à jour de la base n\'est pas encore faite (0085).',
        adjusted:'Couleur éclaircie automatiquement pour garder les boutons lisibles.', bgAdjusted:'Fond assombri pour garder le texte lisible.',
        logoBig:'Image illisible ou trop lourde.', via:'avec Sillance', open:'Apparence', preview:'Aperçu en direct sur la page.'},
    en:{proposals:'Proposals for this club', newProp:'+ New proposal', propName:'Proposal name', propNamePh:'e.g. Ember', addProp:'Add to proposals', updateProp:'Update proposal', edit:'Edit', del:'Delete', close:'Close', propSaved:'Proposals saved: the club manager can choose them.', noProps:'No proposal yet: create the first one below.', maxProps:'8 proposals maximum per club.', pickSub:'Choose from the looks prepared for your club. Your members will see the app in these colours.', pickNone:'No look has been prepared for your club yet. Write to contact@sillance.app to get one.', applyBtn:'Apply', sillanceStyle:'Sillance style', applied:'Look applied: your members will see it next time they open the app.', active:'Active', studioTitle:'Club looks', colors:'Colours', title:'Club appearance', sub:'Members of this club see Sillance in these colours.', presets:'Ready-made styles',
        accent:'Main colour', accent2:'Secondary colour', bg:'Background', font:'Heading font', logo:'Logo',
        logoAdd:'Add a logo', logoDel:'Remove', save:'Save', cancel:'Cancel', reset:'Back to the Sillance style',
        saved:'Appearance saved: members will see it next time they open the app.', err:'Could not save.',
        outdated:'Appearance not saved: the database update has not been applied yet (0085).',
        adjusted:'Colour lightened automatically to keep buttons readable.', bgAdjusted:'Background darkened to keep text readable.',
        logoBig:'Unreadable or too large image.', via:'with Sillance', open:'Appearance', preview:'Live preview on the page.'},
    es:{proposals:'Propuestas para este club', newProp:'+ Nueva propuesta', propName:'Nombre de la propuesta', propNamePh:'Ej. Brasa', addProp:'Añadir a las propuestas', updateProp:'Actualizar la propuesta', edit:'Editar', del:'Eliminar', close:'Cerrar', propSaved:'Propuestas guardadas: el responsable del club puede elegirlas.', noProps:'Aún no hay propuestas: crea la primera abajo.', maxProps:'8 propuestas como máximo por club.', pickSub:'Elige entre los estilos preparados para tu club. Tus miembros verán la app con estos colores.', pickNone:'Aún no se ha preparado ningún estilo para tu club. Escribe a contact@sillance.app para obtener uno.', applyBtn:'Aplicar', sillanceStyle:'Estilo Sillance', applied:'Estilo aplicado: tus miembros lo verán la próxima vez que abran la app.', active:'Activo', studioTitle:'Estilos del club', colors:'Colores', title:'Apariencia del club', sub:'Los miembros de este club ven Sillance con estos colores.', presets:'Estilos listos',
        accent:'Color principal', accent2:'Color secundario', bg:'Fondo', font:'Fuente de títulos', logo:'Logo',
        logoAdd:'Añadir un logo', logoDel:'Quitar', save:'Guardar', cancel:'Cancelar', reset:'Volver al estilo Sillance',
        saved:'Apariencia guardada: los miembros la verán la próxima vez que abran la app.', err:'No se pudo guardar.',
        outdated:'Apariencia no guardada: la actualización de la base aún no está aplicada (0085).',
        adjusted:'Color aclarado automáticamente para que los botones sigan legibles.', bgAdjusted:'Fondo oscurecido para que el texto siga legible.',
        logoBig:'Imagen ilegible o demasiado pesada.', via:'con Sillance', open:'Apariencia', preview:'Vista previa en directo en la página.'}
  };
  function t(k){
    var lang = (window.SilI18n && window.SilI18n.getLang && window.SilI18n.getLang()) || 'fr';
    return (I18N[lang] || I18N.fr)[k] || I18N.fr[k] || k;
  }

  /* ---------- couleurs ---------- */
  function hexOk(h){ return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h); }
  function rgb(h){ return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
  function hex(c){ return '#' + c.map(function(v){ return Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0'); }).join(''); }
  function mix(a, b, w){ var A=rgb(a), B=rgb(b); return hex([0,1,2].map(function(i){ return A[i]*(1-w) + B[i]*w; })); }
  function lum(h){ return rgb(h).map(function(v){ v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); })
    .reduce(function(s,v,i){ return s + v*[.2126,.7152,.0722][i]; }, 0); }
  function contrast(a, b){ var x=lum(a), y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
  // couleur principale : texte sombre des boutons lisible (≥ 4.5) → éclaircir
  function safeAccent(h){ var c=h, n=0; while(contrast(c, BTN_TEXT) < 4.5 && n++ < 20) c = mix(c, '#ffffff', .1); return c; }
  // fond : texte clair lisible (≥ 12, proche du thème d'origine) → assombrir
  function safeBg(h){ var c=h, n=0; while(contrast(c, UI_TEXT) < 12 && n++ < 30) c = mix(c, '#000000', .12); return c; }
  // couleur secondaire : utilisée en texte sur le fond → éclaircir si besoin
  function safeOnBg(h, bg){ var c=h, n=0; while(contrast(c, bg) < 4.5 && n++ < 20) c = mix(c, '#ffffff', .1); return c; }

  function normalize(theme){
    if(!theme || typeof theme !== 'object') return null;
    var base = PRESETS[theme.preset] || PRESETS.sillance;
    var bg = safeBg(hexOk(theme.bg) ? theme.bg : base.bg);
    return {
      v:1,
      id: typeof theme.id === 'string' ? theme.id.slice(0, 40) : undefined,
      label: typeof theme.label === 'string' ? theme.label.slice(0, 40) : undefined,
      preset: PRESETS[theme.preset] ? theme.preset : 'custom',
      accent: safeAccent(hexOk(theme.accent) ? theme.accent : base.accent),
      accent2: safeOnBg(hexOk(theme.accent2) ? theme.accent2 : base.accent2, bg),
      bg: bg,
      font: FONTS[theme.font] ? theme.font : base.font,
      logo: (typeof theme.logo === 'string' && /^data:image\/(webp|png|jpeg);base64,/.test(theme.logo) && theme.logo.length < 140000) ? theme.logo : null
    };
  }

  /* ---------- application ---------- */
  var fontLoaded = {};
  function loadFont(name){
    if(!FONTS[name] || name === 'Oswald' || fontLoaded[name]) return;
    fontLoaded[name] = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + FONTS[name] + '&display=swap';
    document.head.appendChild(l);
  }
  // Les variables sont posées par une feuille de style générée, pour les
  // DEUX modes : le mode clair (body.light) redéfinit ses couleurs sur <body>,
  // ce qui écraserait des variables posées sur <html>.
  //  - sombre : fond du club, couleur principale éclaircie si besoin ;
  //  - clair  : surfaces claires de Sillance teintées du club, couleurs du
  //    club ASSOMBRIES pour rester lisibles sur blanc (boutons à texte blanc).
  function darkOn(h, bg){ var c=h, n=0; while(contrast(c, bg) < 4.5 && n++ < 20) c = mix(c, '#000000', .1); return c; }
  function setVars(th){
    var a = rgb(mix(th.accent, '#9aa5c8', .6));
    var la = darkOn(th.accent, '#ffffff');
    var css =
      'html.club-th{--font-display:\'' + th.font + '\',sans-serif}' +
      'html.club-th body:not(.light){' +
        '--accent:' + th.accent + ';--accent2:' + th.accent2 + ';--ink:' + th.bg + ';' +
        '--panel:' + mix(mix(th.bg, '#ffffff', .045), th.accent, .03) + ';' +
        '--panel-2:' + mix(mix(th.bg, '#ffffff', .08), th.accent, .05) + ';' +
        '--line:rgba(' + a.join(',') + ',.13);--line-strong:rgba(' + a.join(',') + ',.26)}' +
      'html.club-th body.light{' +
        '--accent:' + la + ';--accent2:' + darkOn(th.accent2, '#ffffff') + ';' +
        '--ink:' + mix('#F4F6FB', th.accent, .035) + ';--panel-2:' + mix('#EDF1F8', th.accent, .05) + '}' +
      'html.club-th body.light ::selection{background:' + la + '30}' +
      // fond animé (halo « aurora ») et dégradé du haut : aux couleurs du club
      'html.club-th body:not(.light){background-image:linear-gradient(180deg,' + mix(th.bg, '#000000', .3) + ' 0%,var(--ink) 38%)}' +
      // bulle de discussion : posée sur --swim (couleur de données) → couleur du club
      'html.club-th .chat-fab{background:var(--accent)}' +
      'html.club-th .aurora{background:' +
        'radial-gradient(40% 46% at 12% 20%,' + th.accent + '6b,transparent 72%),' +
        'radial-gradient(38% 44% at 88% 82%,' + th.accent2 + '57,transparent 72%),' +
        'radial-gradient(46% 54% at 74% 8%,' + mix(th.accent, th.accent2, .5) + '5c,transparent 74%),' +
        'radial-gradient(32% 42% at 28% 94%,' + th.accent + '38,transparent 70%)}';
    var el = document.getElementById('silClubThemeVars');
    if(!el){ el = document.createElement('style'); el.id = 'silClubThemeVars'; document.head.appendChild(el); }
    el.textContent = css;
    document.documentElement.classList.add('club-th');
    loadFont(th.font);
    var meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', th.bg);
  }
  function clearVars(){
    document.documentElement.classList.remove('club-th');
    var el = document.getElementById('silClubThemeVars');
    if(el) el.textContent = '';
  }
  var current = null;   // {theme, name}
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function renderBrand(){
    var brand = document.querySelector('.topbar .brand');
    if(!brand) return;
    var box = brand.querySelector('.club-brand');
    if(!current){
      if(box) box.remove();
      brand.classList.remove('is-club');
      return;
    }
    if(!box){ box = document.createElement('div'); box.className = 'club-brand'; brand.appendChild(box); }
    brand.classList.add('is-club');
    box.innerHTML = (current.theme.logo ? '<img class="club-brand-logo" alt="" src="' + current.theme.logo + '">' : '')
      + '<div class="club-brand-txt"><span class="club-brand-name">' + esc(current.name) + '</span>'
      + '<span class="club-brand-via">' + esc(t('via')) + '</span></div>';
  }
  function injectCss(){
    if(document.getElementById('silClubThemeCss')) return;
    var st = document.createElement('style');
    st.id = 'silClubThemeCss';
    st.textContent =
      '.topbar .brand.is-club>.brand-mark,.topbar .brand.is-club>div:not(.club-brand){display:none}' +
      '.club-brand{display:flex;align-items:center;gap:10px;min-width:0}' +
      '.club-brand-logo{width:34px;height:34px;border-radius:9px;object-fit:contain;background:var(--panel-2);flex:none}' +
      '.club-brand-txt{display:flex;flex-direction:column;min-width:0;line-height:1.05}' +
      '.club-brand-name{font-family:var(--font-display);font-size:19px;font-weight:700;letter-spacing:.02em;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}' +
      '.club-brand-via{font-size:10px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-top:2px}' +
      '@media(max-width:560px){.club-brand-name{font-size:16px;max-width:140px}.club-brand-via{display:none}.club-brand-logo{width:28px;height:28px}}' +
      /* éditeur */
      '.cth-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:flex-end;z-index:9000}' +
      '.cth{width:min(380px,100%);height:100%;overflow:auto;background:var(--panel);border-left:1px solid var(--line-strong);padding:20px 18px 90px;box-shadow:var(--shadow-3);color:var(--text)}' +
      '.cth h3{font-family:var(--font-display);font-size:22px;margin:0 0 4px}' +
      '.cth .cth-sub{color:var(--muted);font-size:12.5px;margin:0 0 16px}' +
      '.cth-lbl{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:16px 0 8px;font-weight:700}' +
      '.cth-presets{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
      '.cth-pre{border:1px solid var(--line-strong);border-radius:10px;padding:8px;background:var(--ink);cursor:pointer;text-align:left;color:var(--text);font:inherit;font-size:12px}' +
      '.cth-pre.on{outline:2px solid var(--accent);outline-offset:1px}' +
      '.cth-pre i{display:inline-block;width:14px;height:14px;border-radius:50%;margin-right:3px;vertical-align:-2px}' +
      '.cth-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}' +
      '.cth-row input[type=color]{width:44px;height:30px;border:1px solid var(--line-strong);border-radius:8px;background:none;padding:2px;cursor:pointer}' +
      '.cth-row select{background:var(--panel-2);color:var(--text);border:1px solid var(--line-strong);border-radius:8px;height:32px;padding:0 8px;font:inherit;font-size:13px}' +
      '.cth-note{font-size:11.5px;color:var(--accent2);min-height:16px;margin-top:6px}' +
      '.cth-logo{display:flex;align-items:center;gap:10px}' +
      '.cth-logo img{width:48px;height:48px;border-radius:10px;object-fit:contain;background:var(--panel-2)}' +
      '.cth-foot{position:fixed;bottom:0;right:0;width:min(380px,100%);display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;background:var(--panel);border-top:1px solid var(--line)}' +
      '.cth-ghost{background:none;border:1px solid var(--line-strong);color:var(--soft);border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;cursor:pointer}' +
      '.cth-props{display:flex;flex-direction:column;gap:8px}' +
      '.cth-prop{display:flex;align-items:center;gap:10px;border:1px solid var(--line-strong);border-radius:10px;padding:8px 10px;background:var(--ink);color:var(--text);cursor:pointer;text-align:left;font:inherit;width:100%}' +
      '.cth-prop.on{outline:2px solid var(--accent);outline-offset:1px}' +
      '.cth-prop img{width:28px;height:28px;border-radius:7px;object-fit:contain}' +
      '.cth-prop .sw{display:flex;gap:3px}.cth-prop .sw i{width:12px;height:12px;border-radius:50%}' +
      '.cth-prop .nm{flex:1;min-width:0;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.cth-prop .act{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}' +
      '.cth-prop .ops{display:flex;gap:4px}.cth-prop .ops button{background:none;border:1px solid var(--line-strong);color:var(--soft);border-radius:7px;padding:3px 7px;font:inherit;font-size:11.5px;cursor:pointer}' +
      '.cth-name{width:100%;box-sizing:border-box;background:var(--panel-2);color:var(--text);border:1px solid var(--line-strong);border-radius:8px;height:36px;padding:0 10px;font:inherit;font-size:14px}' +
      '.cth-empty{color:var(--muted);font-size:12.5px}' +
      '.cth-link{background:none;border:none;color:var(--muted);text-decoration:underline;font:inherit;font-size:12px;cursor:pointer;padding:0;margin-top:14px}';
    document.head.appendChild(st);
  }

  function apply(theme, name, o){
    var th = normalize(theme);
    if(!th){ clearVars(); current = null; }
    else {
      th.preset === 'sillance' ? clearVars() : setVars(th);   // style Sillance : variables d'origine, mais logo + nom du club
      current = {theme: th, name: name};
    }
    if(!o || o.persist !== false){ try { current ? localStorage.setItem(KEY, JSON.stringify(current)) : localStorage.removeItem(KEY); } catch(_){} }
    injectCss();
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderBrand, {once:true});
    else renderBrand();
    return th;
  }
  function clear(){ apply(null); }

  /* ---------- logo : réduit à 160 px côté navigateur ---------- */
  function readLogo(file){
    return new Promise(function(resolve, reject){
      if(!file || !/^image\//.test(file.type) || file.size > 8e6) return reject(new Error('bad'));
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function(){
        var s = 160, r = Math.min(1, s / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * r)); c.height = Math.max(1, Math.round(img.height * r));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var out = c.toDataURL('image/webp', .85);
        if(!/^data:image\/webp/.test(out)) out = c.toDataURL('image/png');
        out.length < 140000 ? resolve(out) : reject(new Error('big'));
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('bad')); };
      img.src = url;
    });
  }

  function swatches(th){
    return '<span class="sw"><i style="background:' + th.accent + '"></i><i style="background:' + th.accent2 + '"></i><i style="background:' + th.bg + ';outline:1px solid var(--line-strong)"></i></span>';
  }
  function errText(err){
    return /theme|column|schema/i.test(String(err && err.message)) ? t('outdated') : t('err') + (err && err.message ? ' (' + err.message + ')' : '');
  }

  /* ---------- atelier ADMIN : créer les propositions d'un club ----------
     opts = { name, proposals:[theme], active:theme|null, persist:false,
              onSaveProposals(list) → Promise, onClose() }                 */
  function openEditor(opts){
    injectCss();
    var before = current ? JSON.parse(JSON.stringify(current)) : null;
    var list = (opts.proposals || []).map(normalize).filter(Boolean);
    var activeId = opts.active && opts.active.id;
    var editingId = null;
    var st = normalize({preset:'feu'});
    var ov = document.createElement('div');
    ov.className = 'cth-ov';
    ov.innerHTML = '<div class="cth" role="dialog" aria-modal="true" aria-label="' + esc(t('studioTitle')) + '">'
      + '<h3>' + esc(t('studioTitle')) + ' · ' + esc(opts.name) + '</h3><p class="cth-sub">' + esc(t('preview')) + '</p>'
      + '<div class="cth-lbl">' + esc(t('proposals')) + '</div><div class="cth-props"></div>'
      + '<button type="button" class="cth-ghost cth-new" style="margin-top:8px">' + esc(t('newProp')) + '</button>'
      + '<div class="cth-lbl">' + esc(t('propName')) + '</div><input class="cth-name" maxlength="40" placeholder="' + esc(t('propNamePh')) + '">'
      + '<div class="cth-lbl">' + esc(t('presets')) + '</div><div class="cth-presets"></div>'
      + '<div class="cth-lbl">' + esc(t('logo')) + '</div><div class="cth-logo"><img alt="" hidden><label class="cth-ghost">' + esc(t('logoAdd'))
      + '<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label><button type="button" class="cth-ghost cth-logo-del" hidden>' + esc(t('logoDel')) + '</button></div>'
      + '<div class="cth-lbl">' + esc(t('colors')) + '</div>'
      + '<div class="cth-row"><span>' + esc(t('accent')) + '</span><input type="color" data-k="accent"></div>'
      + '<div class="cth-row"><span>' + esc(t('accent2')) + '</span><input type="color" data-k="accent2"></div>'
      + '<div class="cth-row"><span>' + esc(t('bg')) + '</span><input type="color" data-k="bg"></div>'
      + '<div class="cth-row"><span>' + esc(t('font')) + '</span><select data-k="font">'
      + Object.keys(FONTS).map(function(f){ return '<option value="' + f + '" style="font-family:\'' + f + '\'">' + f + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="cth-note" aria-live="polite"></div>'
      + '<div class="cth-foot"><button type="button" class="cth-ghost cth-cancel">' + esc(t('close')) + '</button>'
      + '<button type="button" class="btn cth-save"></button></div></div>';
    document.body.appendChild(ov);
    Object.keys(FONTS).forEach(loadFont);

    var q = function(sel){ return ov.querySelector(sel); };
    var note = q('.cth-note');
    function renderList(){
      q('.cth-props').innerHTML = list.length ? list.map(function(th){
        return '<div class="cth-prop' + (th.id === editingId ? ' on' : '') + '" data-id="' + esc(th.id) + '">'
          + (th.logo ? '<img alt="" src="' + th.logo + '">' : '') + swatches(th)
          + '<span class="nm" style="font-family:\'' + th.font + '\'">' + esc(th.label || '—') + '</span>'
          + (th.id === activeId ? '<span class="act">' + esc(t('active')) + '</span>' : '')
          + '<span class="ops"><button type="button" data-op="edit">' + esc(t('edit')) + '</button><button type="button" data-op="del">' + esc(t('del')) + '</button></span></div>';
      }).join('') : '<div class="cth-empty">' + esc(t('noProps')) + '</div>';
      q('.cth-save').textContent = editingId ? t('updateProp') : t('addProp');
    }
    function sync(){
      ov.querySelectorAll('input[type=color]').forEach(function(i){ i.value = st[i.dataset.k]; });
      q('select[data-k=font]').value = st.font;
      var img = q('.cth-logo img');
      img.hidden = !st.logo; if(st.logo) img.src = st.logo;
      q('.cth-logo-del').hidden = !st.logo;
      q('.cth-presets').innerHTML = Object.keys(PRESETS).map(function(k){
        var p = PRESETS[k];
        return '<button type="button" class="cth-pre' + (st.preset === k ? ' on' : '') + '" data-p="' + k + '" style="background:' + p.bg + '">'
          + '<i style="background:' + p.accent + '"></i><i style="background:' + p.accent2 + '"></i><br><span style="font-family:\'' + p.font + '\';font-size:14px">' + esc(p.label) + '</span></button>';
      }).join('');
      renderList();
    }
    function preview(raw){
      var asked = {accent: raw.accent, bg: raw.bg};
      st = normalize(raw);
      var msgs = [];
      if(asked.accent && st.accent.toLowerCase() !== asked.accent.toLowerCase()) msgs.push(t('adjusted'));
      if(asked.bg && st.bg.toLowerCase() !== asked.bg.toLowerCase()) msgs.push(t('bgAdjusted'));
      note.textContent = msgs.join(' ');
      apply(st, opts.name, {persist: opts.persist});
      sync();
    }
    function startNew(){
      editingId = null; q('.cth-name').value = '';
      var p = PRESETS.feu;
      preview({preset:'feu', accent:p.accent, accent2:p.accent2, bg:p.bg, font:p.font, logo: st.logo});
    }
    function persist(newList, okMsg){
      var btn = q('.cth-save'); btn.disabled = true;
      return Promise.resolve(opts.onSaveProposals(newList)).then(function(){
        list = newList;
        if(activeId && !list.some(function(x){ return x.id === activeId; })) activeId = null;
        btn.disabled = false; renderList();
        window.toast && window.toast(okMsg || t('propSaved'));
      }).catch(function(err){ btn.disabled = false; note.textContent = errText(err); });
    }
    preview(st);
    q('.cth-new').addEventListener('click', startNew);
    q('.cth-props').addEventListener('click', function(e){
      var row = e.target.closest('[data-id]'); if(!row) return;
      var th = list.find(function(x){ return x.id === row.dataset.id; }); if(!th) return;
      var op = e.target.closest('[data-op]');
      if(op && op.dataset.op === 'del'){
        if(!confirm(t('del') + ' « ' + (th.label || '') + ' » ?')) return;
        if(editingId === th.id) editingId = null;
        persist(list.filter(function(x){ return x.id !== th.id; }));
        return;
      }
      editingId = th.id; q('.cth-name').value = th.label || '';
      preview(th);
    });
    q('.cth-presets').addEventListener('click', function(e){
      var b = e.target.closest('[data-p]'); if(!b) return;
      var p = PRESETS[b.dataset.p];
      preview({preset: b.dataset.p, accent: p.accent, accent2: p.accent2, bg: p.bg, font: p.font, logo: st.logo});
    });
    ov.querySelectorAll('input[type=color],select[data-k]').forEach(function(i){
      i.addEventListener('input', function(){
        var raw = Object.assign({}, st, {preset: 'custom'}); raw[i.dataset.k] = i.value;
        preview(raw);
      });
    });
    q('.cth-logo input').addEventListener('change', function(e){
      readLogo(e.target.files[0]).then(function(d){ preview(Object.assign({}, st, {logo: d})); })
        .catch(function(){ note.textContent = t('logoBig'); });
    });
    q('.cth-logo-del').addEventListener('click', function(){ preview(Object.assign({}, st, {logo: null})); });
    function close(){
      before ? apply(before.theme, before.name, {persist: opts.persist}) : apply(null, '', {persist: opts.persist});
      ov.remove();
      if(opts.onClose) opts.onClose();
    }
    q('.cth-cancel').addEventListener('click', close);
    ov.addEventListener('click', function(e){ if(e.target === ov) close(); });
    q('.cth-save').addEventListener('click', function(){
      if(!editingId && list.length >= 8){ note.textContent = t('maxProps'); return; }
      var label = q('.cth-name').value.trim() || ('Proposition ' + (list.length + 1));
      var item = Object.assign({}, st, {id: editingId || ('p' + Date.now().toString(36)), label: label});
      var newList = editingId ? list.map(function(x){ return x.id === editingId ? item : x; }) : list.concat([item]);
      editingId = item.id;
      persist(newList);
    });
  }

  /* ---------- sélecteur du GÉRANT : choisir parmi les propositions ----------
     opts = { name, options:[theme], active:theme|null, onPick(theme|null) → Promise } */
  function openPicker(opts){
    injectCss();
    var before = current ? JSON.parse(JSON.stringify(current)) : null;
    var options = (opts.options || []).filter(function(o){ return o && o.id; });
    var chosen = opts.active && opts.active.id ? opts.active.id : '';
    var ov = document.createElement('div');
    ov.className = 'cth-ov';
    ov.innerHTML = '<div class="cth" role="dialog" aria-modal="true" aria-label="' + esc(t('title')) + '">'
      + '<h3>' + esc(t('title')) + '</h3><p class="cth-sub">' + esc(options.length ? t('pickSub') : t('pickNone')) + '</p>'
      + '<div class="cth-props"></div><div class="cth-note" aria-live="polite"></div>'
      + '<div class="cth-foot"><button type="button" class="cth-ghost cth-cancel">' + esc(t('cancel')) + '</button>'
      + (options.length ? '<button type="button" class="btn cth-save">' + esc(t('applyBtn')) + '</button>' : '') + '</div></div>';
    document.body.appendChild(ov);
    var q = function(sel){ return ov.querySelector(sel); };
    options.forEach(function(o){ loadFont(o.font); });
    function render(){
      var sil = PRESETS.sillance;
      q('.cth-props').innerHTML = options.length ? ['<div class="cth-prop' + (chosen === '' ? ' on' : '') + '" data-id="">' + swatches(sil)
        + '<span class="nm">' + esc(t('sillanceStyle')) + '</span></div>'].concat(options.map(function(o){
          var th = normalize(o);
          return '<div class="cth-prop' + (chosen === o.id ? ' on' : '') + '" data-id="' + esc(o.id) + '">'
            + (th.logo ? '<img alt="" src="' + th.logo + '">' : '') + swatches(th)
            + '<span class="nm" style="font-family:\'' + th.font + '\'">' + esc(o.label || '—') + '</span>'
            + (opts.active && opts.active.id === o.id ? '<span class="act">' + esc(t('active')) + '</span>' : '') + '</div>';
        })).join('') : '';
    }
    render();
    q('.cth-props').addEventListener('click', function(e){
      var row = e.target.closest('[data-id]'); if(!row) return;
      chosen = row.dataset.id;
      var o = options.find(function(x){ return x.id === chosen; });
      o ? apply(o, opts.name) : apply({preset:'sillance'}, opts.name);
      render();
    });
    function close(restore){
      if(restore) before ? apply(before.theme, before.name) : apply(null);
      ov.remove();
    }
    q('.cth-cancel').addEventListener('click', function(){ close(true); });
    ov.addEventListener('click', function(e){ if(e.target === ov) close(true); });
    var save = q('.cth-save');
    if(save) save.addEventListener('click', function(){
      save.disabled = true;
      // l'objet EXACT de la proposition (le trigger 0085 compare à theme_options)
      var o = options.find(function(x){ return x.id === chosen; }) || null;
      Promise.resolve(opts.onPick(o)).then(function(){
        o ? apply(o, opts.name) : apply(null);
        close(false);
        window.toast && window.toast(t('applied'));
      }).catch(function(err){ save.disabled = false; q('.cth-note').textContent = errText(err); });
    });
  }

  // au chargement : thème en cache (évite le flash du thème Sillance)
  // (seulement si une session est enregistrée : après déconnexion, l'écran
  // de connexion reste aux couleurs Sillance, même principe que sillance-boot.js)
  try {
    var hasSession = Object.keys(localStorage).some(function(k){ return /^sb-.*-auth-token$/.test(k); });
    var cached = JSON.parse(localStorage.getItem(KEY) || 'null');
    if(!hasSession) localStorage.removeItem(KEY);
    else if(cached && cached.theme) apply(cached.theme, cached.name);
  } catch(_){}

  window.SilClubTheme = { PRESETS: PRESETS, FONTS: FONTS, apply: apply, clear: clear, openEditor: openEditor, openPicker: openPicker, normalize: normalize, label: function(){ return t('open'); } };
})();
