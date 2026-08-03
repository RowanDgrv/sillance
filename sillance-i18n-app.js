/* Sillance — dictionnaire i18n de l'app coach/athlète (calendrier/app/review).
   Texte pur d'affichage uniquement — les valeurs qui servent aussi de clé
   de données (ex. noms de zones dans INTENSITY_MODELS) restent en français
   volontairement (cf. commentaire en tête de sillance-calendrier.core.js). */
(function(){
  var fr = {
    "disc.swim": `Natation`, "disc.bike": `Vélo`, "disc.run": `Course`, "disc.strength": `Renfo`, "disc.hyrox": `Hyrox`,
    "gear.swim1": `maillot de bain`, "gear.swim2": `bonnet`, "gear.swim3": `lunettes`,
    "gear.bike1": `vélo`, "gear.bike2": `casque`, "gear.bike3": `tenue vélo`, "gear.bike4": `bidon`,
    "gear.run1": `chaussures de course`, "gear.run2": `tenue running`,
    "gear.strength1": `tapis`, "gear.strength2": `tenue confortable`,
    "gear.hyrox1": `chaussures`, "gear.hyrox2": `gants`, "gear.hyrox3": `tenue`, "gear.hyrox4": `eau`,

    "dispo.ok": `OK`, "dispo.fatigue": `Fatigué`, "dispo.malade": `Malade`, "dispo.blesse": `Blessé`,

    "cycle.menstrual.l": `Règles`,
    "cycle.menstrual.tip": `Symptômes possibles (fatigue, crampes) : intensité selon les sensations, rien d'imposé.`,
    "cycle.follicular.l": `Folliculaire`,
    "cycle.follicular.tip": `Fenêtre souvent favorable : bon moment pour le travail intense (VMA, seuil, force) et les gros volumes.`,
    "cycle.ovulation.l": `Ovulation`,
    "cycle.ovulation.tip": `Force au plus haut, mais laxité ligamentaire accrue → échauffement soigné, vigilance blessure (genou/cheville).`,
    "cycle.luteal.l": `Lutéale`,
    "cycle.luteal.tip": `Effort perçu et température plus élevés en fin de phase : récup allongée, hydratation/chaleur surveillées, plutôt endurance/technique.`,

    "demoSet.triathlete": `Triathlète`, "demoSet.course": `Course`, "demoSet.hyrox": `Hyrox`, "demoSet.velo": `Vélo`,
    "clubDisc.tri": `Tri`, "clubDisc.run": `Course`, "clubDisc.swim": `Natation`, "clubDisc.bike": `Vélo`,
    "shoeCat.daily": `Entraînement`, "shoeCat.tempo": `Dynamique`, "shoeCat.race": `Compétition`, "shoeCat.trail": `Trail`,
    "weekFeel.hard": `Trop dur`, "weekFeel.ok": `Bien calibré`, "weekFeel.easy": `Trop facile`,
  };

  var en = {
    "disc.swim": `Swimming`, "disc.bike": `Cycling`, "disc.run": `Running`, "disc.strength": `Strength`, "disc.hyrox": `Hyrox`,
    "gear.swim1": `swimsuit`, "gear.swim2": `swim cap`, "gear.swim3": `goggles`,
    "gear.bike1": `bike`, "gear.bike2": `helmet`, "gear.bike3": `cycling kit`, "gear.bike4": `bottle`,
    "gear.run1": `running shoes`, "gear.run2": `running gear`,
    "gear.strength1": `mat`, "gear.strength2": `comfortable clothing`,
    "gear.hyrox1": `shoes`, "gear.hyrox2": `gloves`, "gear.hyrox3": `kit`, "gear.hyrox4": `water`,

    "dispo.ok": `OK`, "dispo.fatigue": `Tired`, "dispo.malade": `Sick`, "dispo.blesse": `Injured`,

    "cycle.menstrual.l": `Menstrual`,
    "cycle.menstrual.tip": `Possible symptoms (fatigue, cramps): go by feel, nothing forced.`,
    "cycle.follicular.l": `Follicular`,
    "cycle.follicular.tip": `Often a favorable window: a good time for intense work (VO2max, threshold, strength) and high volume.`,
    "cycle.ovulation.l": `Ovulation`,
    "cycle.ovulation.tip": `Strength at its peak, but increased ligament laxity → warm up carefully, watch for injury (knee/ankle).`,
    "cycle.luteal.l": `Luteal`,
    "cycle.luteal.tip": `Perceived effort and body temperature run higher later in this phase: allow more recovery, watch hydration/heat, favor endurance/technique work.`,

    "demoSet.triathlete": `Triathlete`, "demoSet.course": `Running`, "demoSet.hyrox": `Hyrox`, "demoSet.velo": `Cycling`,
    "clubDisc.tri": `Tri`, "clubDisc.run": `Run`, "clubDisc.swim": `Swim`, "clubDisc.bike": `Bike`,
    "shoeCat.daily": `Training`, "shoeCat.tempo": `Tempo`, "shoeCat.race": `Race`, "shoeCat.trail": `Trail`,
    "weekFeel.hard": `Too hard`, "weekFeel.ok": `Well calibrated`, "weekFeel.easy": `Too easy`,
  };

  var es = {
    "disc.swim": `Natación`, "disc.bike": `Ciclismo`, "disc.run": `Carrera`, "disc.strength": `Fuerza`, "disc.hyrox": `Hyrox`,
    "gear.swim1": `bañador`, "gear.swim2": `gorro`, "gear.swim3": `gafas`,
    "gear.bike1": `bici`, "gear.bike2": `casco`, "gear.bike3": `ropa de ciclismo`, "gear.bike4": `bidón`,
    "gear.run1": `zapatillas de running`, "gear.run2": `ropa de running`,
    "gear.strength1": `esterilla`, "gear.strength2": `ropa cómoda`,
    "gear.hyrox1": `zapatillas`, "gear.hyrox2": `guantes`, "gear.hyrox3": `ropa`, "gear.hyrox4": `agua`,

    "dispo.ok": `OK`, "dispo.fatigue": `Cansado`, "dispo.malade": `Enfermo`, "dispo.blesse": `Lesionado`,

    "cycle.menstrual.l": `Menstrual`,
    "cycle.menstrual.tip": `Síntomas posibles (fatiga, calambres): intensidad según las sensaciones, nada impuesto.`,
    "cycle.follicular.l": `Folicular`,
    "cycle.follicular.tip": `Ventana a menudo favorable: buen momento para el trabajo intenso (VAM, umbral, fuerza) y los grandes volúmenes.`,
    "cycle.ovulation.l": `Ovulación`,
    "cycle.ovulation.tip": `Fuerza en su punto máximo, pero mayor laxitud ligamentosa → calentamiento cuidadoso, vigilancia de lesiones (rodilla/tobillo).`,
    "cycle.luteal.l": `Lútea`,
    "cycle.luteal.tip": `Esfuerzo percibido y temperatura más elevados al final de la fase: recuperación más larga, vigilar hidratación/calor, priorizar resistencia/técnica.`,

    "demoSet.triathlete": `Triatleta`, "demoSet.course": `Carrera`, "demoSet.hyrox": `Hyrox`, "demoSet.velo": `Ciclismo`,
    "clubDisc.tri": `Tri`, "clubDisc.run": `Carrera`, "clubDisc.swim": `Natación`, "clubDisc.bike": `Bici`,
    "shoeCat.daily": `Entrenamiento`, "shoeCat.tempo": `Dinámica`, "shoeCat.race": `Competición`, "shoeCat.trail": `Trail`,
    "weekFeel.hard": `Demasiado duro`, "weekFeel.ok": `Bien calibrado`, "weekFeel.easy": `Demasiado fácil`,
  };

  window.SIL_I18N = window.SIL_I18N || { fr: {}, en: {}, es: {} };
  Object.assign(window.SIL_I18N.fr, fr);
  Object.assign(window.SIL_I18N.en, en);
  Object.assign(window.SIL_I18N.es, es);
})();
