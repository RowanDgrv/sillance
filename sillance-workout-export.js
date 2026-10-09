/* ============================================================
   Sillance — Export de séance en .TCX (window.PFExport)
   ------------------------------------------------------------
   Pourquoi : COROS a une écriture self-service (createScheduledWorkout,
   cf. push-session-to-watch), mais Garmin et Polar n'en ont pas — l'athlète
   doit alors importer un fichier à la main. Le format choisi est le TCX
   "Workout" (schéma Garmin Training Center v2, repris tel quel par Garmin
   Connect, TrainingPeaks et la plupart des plateformes tierces) plutôt que
   le .FIT binaire : XML simple, écrit à la main de façon fiable, alors que
   le format "workout" du .FIT (messages FIT différents de ceux qu'on
   DÉCODE pour les activités COROS, cf. _shared/fitParser.ts côté backend)
   est un format binaire qu'on ne voulait pas tenter d'encoder sans un vrai
   outil de validation.

   Portée volontairement limitée (08/10/2026) : structure (nom, durée ou
   distance, répétitions, type d'effort) uniquement — PAS de cible
   FTP/VMA/FC encodée. Deux raisons : (1) TCX n'a tout simplement pas de
   type de cible "puissance" dans son schéma standard (vélo = rien de fiable
   à écrire) ; (2) pour la course, on pourrait calculer une allure cible
   réelle (cf. _shared/corosSessionMap.ts côté backend pour la même
   conversion % VMA → allure), mais risquer une valeur FAUSSE dans un
   fichier que l'athlète suit à l'aveugle sur sa montre est pire que ne rien
   mettre. La structure seule (échauffement 15', 4x(5' effort / 2' récup),
   retour au calme 10') reste une vraie amélioration par rapport à rien.

   API :
     PFExport.toTcx(session) -> string (XML)
     PFExport.download(session) -> déclenche le téléchargement du .tcx
   `session` = objet séance tel que manipulé par l'app (s.title, s.disc,
   s.dur, s.blocksV2.blocks) — même forme que scheduled_sessions.
   ============================================================ */
(function (root) {
  "use strict";

  const TYPE_LABEL = {
    warmup: "Échauffement", exo: "Exercice", contre: "Contre-effort",
    educatif: "Éducatif", recov: "Récupération", cooldown: "Retour au calme",
    station: "Station",
  };
  const TYPE_INTENSITY = {
    warmup: "Warmup", cooldown: "Cooldown", recov: "Rest",
  }; // tout le reste (exo/contre/educatif/station) : "Active"

  const SPORT_MAP = { run: "Running", bike: "Biking" }; // TCX Sport_t n'a que Running/Biking/Other

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Même repli que profLineMin() côté calendrier (reps sans notion temporelle
  // fiable → 1 min par défaut, structure seulement, jamais inventé plus précis).
  function durationSeconds(ln) {
    if (ln.type === "station") return 240; // ~4 min/station Hyrox
    if (ln.metric === "reps") return 60;
    const d = ln.dur || {};
    const s = Math.round((Number(d.h) || 0) * 3600 + (Number(d.m) || 0) * 60 + (Number(d.s) || 0));
    return s > 0 ? s : 60;
  }

  let stepId = 0;
  function stepXml(ln) {
    stepId++;
    const label = TYPE_LABEL[ln.type] || "Bloc";
    const intensity = TYPE_INTENSITY[ln.type] || "Active";
    if (ln.metric === "dist" && ln.dist) {
      return `<Step xsi:type="Step_t"><StepId>${stepId}</StepId><Name>${esc(label)}</Name>`
        + `<Duration xsi:type="Distance_t"><Meters>${Math.round(ln.dist)}</Meters></Duration>`
        + `<Intensity>${intensity}</Intensity><Target xsi:type="None_t"/></Step>`;
    }
    return `<Step xsi:type="Step_t"><StepId>${stepId}</StepId><Name>${esc(label)}</Name>`
      + `<Duration xsi:type="Time_t"><Seconds>${durationSeconds(ln)}</Seconds></Duration>`
      + `<Intensity>${intensity}</Intensity><Target xsi:type="None_t"/></Step>`;
  }

  function blockXml(blk) {
    const lines = blk.lines || [];
    if (!lines.length) return "";
    const inner = lines.map(stepXml).join("");
    const series = Math.max(1, Number(blk.series) || 1);
    if (series > 1) {
      stepId++;
      return `<Step xsi:type="Repeat_t"><StepId>${stepId}</StepId><Repetitions>${series}</Repetitions>${inner}</Step>`;
    }
    return inner;
  }

  function toTcx(s) {
    stepId = 0;
    const sport = SPORT_MAP[s.disc] || "Other";
    const blocks = (s.blocksV2 && s.blocksV2.blocks) || [];
    let stepsXml;
    if (blocks.length) {
      stepsXml = blocks.map(blockXml).join("");
    } else {
      // Pas de structure détaillée disponible (séance posée sans builder) :
      // un seul step avec la durée totale connue, mieux qu'un fichier vide.
      stepId = 1;
      stepsXml = `<Step xsi:type="Step_t"><StepId>1</StepId><Name>${esc(s.title || "Séance")}</Name>`
        + `<Duration xsi:type="Time_t"><Seconds>${Math.round((s.dur || 30) * 60)}</Seconds></Duration>`
        + `<Intensity>Active</Intensity><Target xsi:type="None_t"/></Step>`;
    }
    const name = esc((s.title || "Séance Sillance").slice(0, 80));
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
      + `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" `
      + `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" `
      + `xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">\n`
      + `  <Workouts>\n    <Workout Sport="${sport}">\n      <Name>${name}</Name>\n      ${stepsXml}\n    </Workout>\n  </Workouts>\n`
      + `</TrainingCenterDatabase>`;
  }

  function slug(title) {
    return String(title || "seance")
      .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "seance";
  }

  function download(s) {
    const xml = toTcx(s);
    const blob = new Blob([xml], { type: "application/vnd.garmin.tcx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${slug(s.title)}.tcx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  root.PFExport = { toTcx, download };
})(typeof window !== "undefined" ? window : globalThis);
