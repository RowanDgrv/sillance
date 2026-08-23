/* Sillance — dictionnaire i18n de la page spectateur (suivi de course) */
(function(){
  var fr = {
    "spec.title": `Suivre une course · Sillance`,
    "spec.loading": `Chargement…`,
    "spec.kicker": `Suivi de course`,
    "spec.notesTitle": `Repères laissés par le coach`,
    "spec.resultTitle": `Résultat`,
    "spec.pendingTitle": `En cours`,
    "spec.pendingText": `Pas encore de résultat. Reviens après la course, il apparaîtra ici dès qu'il sera synchronisé.`,
    "spec.foot": `Pas de suivi GPS en direct, juste les repères et le résultat. <br><a href="./index.html">sillance.app</a>`,
    "spec.errTitle": `Lien introuvable`,
    "spec.errDefault": `Ce lien de suivi n'existe pas ou a expiré.`,
    "spec.errNoToken": `Lien invalide (aucun jeton).`,
    "spec.errNetwork": `Impossible de charger ce suivi pour le moment.`,
    "spec.raceFallback": `Course`,
  };
  var en = {
    "spec.title": `Follow a race · Sillance`,
    "spec.loading": `Loading…`,
    "spec.kicker": `Race tracking`,
    "spec.notesTitle": `Notes left by the coach`,
    "spec.resultTitle": `Result`,
    "spec.pendingTitle": `In progress`,
    "spec.pendingText": `No result yet. Check back after the race, it'll appear here as soon as it syncs.`,
    "spec.foot": `No live GPS tracking, just notes and the final result. <br><a href="./index.html">sillance.app</a>`,
    "spec.errTitle": `Link not found`,
    "spec.errDefault": `This tracking link doesn't exist or has expired.`,
    "spec.errNoToken": `Invalid link (no token).`,
    "spec.errNetwork": `Couldn't load this tracker right now.`,
    "spec.raceFallback": `Race`,
  };
  var es = {
    "spec.title": `Seguir una carrera · Sillance`,
    "spec.loading": `Cargando…`,
    "spec.kicker": `Seguimiento de carrera`,
    "spec.notesTitle": `Notas dejadas por el entrenador`,
    "spec.resultTitle": `Resultado`,
    "spec.pendingTitle": `En curso`,
    "spec.pendingText": `Todavía no hay resultado. Vuelve después de la carrera, aparecerá aquí en cuanto se sincronice.`,
    "spec.foot": `Sin seguimiento GPS en directo, solo notas y el resultado final. <br><a href="./index.html">sillance.app</a>`,
    "spec.errTitle": `Enlace no encontrado`,
    "spec.errDefault": `Este enlace de seguimiento no existe o ha caducado.`,
    "spec.errNoToken": `Enlace no válido (sin token).`,
    "spec.errNetwork": `No se pudo cargar este seguimiento por ahora.`,
    "spec.raceFallback": `Carrera`,
  };
  window.SIL_I18N = window.SIL_I18N || { fr: {}, en: {}, es: {} };
  Object.assign(window.SIL_I18N.fr, fr);
  Object.assign(window.SIL_I18N.en, en);
  Object.assign(window.SIL_I18N.es, es);
})();
