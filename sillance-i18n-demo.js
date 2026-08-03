/* Sillance — dictionnaire i18n de la page démo technique (front + back-end) */
(function(){
  var fr = {
    "demo.title": `Sillance — Démo (front + back-end)`,
    "demo.tag": `Coaching triathlon · Hyrox`,
    "demo.lead": `Plateforme de coaching pour les 3 rôles — <b>coach</b>, <b>athlète</b> et
  <b>club</b> — avec synchronisation des montres connectées. Ci-dessous : l'application
  (front) et l'architecture back-end, prêtes à présenter.`,
    "demo.stat.tables": `tables Postgres (RLS)`,
    "demo.stat.functions": `edge functions`,
    "demo.stat.devices": `intégrations montres`,
    "demo.stat.stripe": `abonnements + à la carte`,
    "demo.frontTitle": `Le produit (front)`,
    "demo.appCard.title": `App coach &amp; athlète`,
    "demo.appCard.text": `Calendrier d'entraînement, builder de séances, check-in de fraîcheur,
      bibliothèque vidéo, espace club &amp; créneaux.`,
    "demo.appCard.cta": `Ouvrir l'app →`,
    "demo.demoCard.title": `Démo testeurs`,
    "demo.demoCard.text": `Même application, variante utilisée pour les retours testeurs.`,
    "demo.demoCard.cta": `Ouvrir la démo →`,
    "demo.tip": `Astuce démo : badge <b>☁︎</b> en haut à droite → crée un compte (coach /
  athlète / club). Sans connexion, l'app tourne en <b>mode démo</b> avec des données d'exemple.`,
    "demo.backendTitle": `L'infrastructure (back-end Supabase)`,
    "demo.backendText": `Postgres + Auth + Storage + Edge Functions (Deno). Sécurité par Row-Level
  Security ; les abonnements ont pour source de vérité le webhook Stripe.`,
    "demo.data.title": `📦 Données`,
    "demo.data.roles": `rôles`,
    "demo.data.physio": `refs physio`,
    "demo.functions.title": `⚙️ Edge Functions`,
    "demo.functions.email": `email`,
    "demo.devices.title": `⌚ Montres connectées`,
    "demo.devices.ready": `prêt`,
    "demo.devices.keys": `clés`,
    "demo.devices.normalized": `Activités normalisées`,
    "demo.devices.autoImport": `Import auto (webhooks)`,
    "demo.devices.readOnly": `Lecture seule`,
    "demo.flowTitle": `Flux de synchronisation Strava (live)`,
    "demo.flowText": `<b>Athlète</b> <span class="arrow">→</span> « Se connecter avec Strava »
    <span class="arrow">→</span> autorisation OAuth Strava
    <span class="arrow">→</span> <b>strava-oauth-callback</b> (échange du code, stockage chiffré des jetons)
    <span class="arrow">→</span> import des activités <span class="arrow">→</span>
    <b>external_activities</b> <span class="arrow">→</span> affichage « Activités synchronisées ».<br>
    Puis chaque nouvelle sortie est poussée en temps réel par <b>strava-webhook</b>.`,
    "demo.footer": `Sillance — démo locale. Détails de mise en ligne : <code>~/pairform-backend/DEPLOY.md</code>.`,
  };
  var en = {
    "demo.title": `Sillance — Demo (front + back-end)`,
    "demo.tag": `Triathlon · Hyrox coaching`,
    "demo.lead": `Coaching platform for all 3 roles — <b>coach</b>, <b>athlete</b> and
  <b>club</b> — with connected watch sync. Below: the application
  (front-end) and the back-end architecture, ready to present.`,
    "demo.stat.tables": `Postgres tables (RLS)`,
    "demo.stat.functions": `edge functions`,
    "demo.stat.devices": `watch integrations`,
    "demo.stat.stripe": `subscriptions + à la carte`,
    "demo.frontTitle": `The product (front-end)`,
    "demo.appCard.title": `Coach &amp; athlete app`,
    "demo.appCard.text": `Training calendar, session builder, freshness check-in,
      video library, club space &amp; time slots.`,
    "demo.appCard.cta": `Open the app →`,
    "demo.demoCard.title": `Tester demo`,
    "demo.demoCard.text": `Same application, the variant used for tester feedback.`,
    "demo.demoCard.cta": `Open the demo →`,
    "demo.tip": `Demo tip: the <b>☁︎</b> badge top right → create an account (coach /
  athlete / club). Without logging in, the app runs in <b>demo mode</b> with sample data.`,
    "demo.backendTitle": `The infrastructure (Supabase back-end)`,
    "demo.backendText": `Postgres + Auth + Storage + Edge Functions (Deno). Row-Level
  Security throughout; subscriptions are sourced from the Stripe webhook.`,
    "demo.data.title": `📦 Data`,
    "demo.data.roles": `roles`,
    "demo.data.physio": `physio refs`,
    "demo.functions.title": `⚙️ Edge Functions`,
    "demo.functions.email": `email`,
    "demo.devices.title": `⌚ Connected watches`,
    "demo.devices.ready": `ready`,
    "demo.devices.keys": `keys`,
    "demo.devices.normalized": `Normalized activities`,
    "demo.devices.autoImport": `Auto import (webhooks)`,
    "demo.devices.readOnly": `Read-only`,
    "demo.flowTitle": `Strava sync flow (live)`,
    "demo.flowText": `<b>Athlete</b> <span class="arrow">→</span> "Connect with Strava"
    <span class="arrow">→</span> Strava OAuth authorization
    <span class="arrow">→</span> <b>strava-oauth-callback</b> (code exchange, encrypted token storage)
    <span class="arrow">→</span> activity import <span class="arrow">→</span>
    <b>external_activities</b> <span class="arrow">→</span> "Synced activities" display.<br>
    Every new outing is then pushed in real time by <b>strava-webhook</b>.`,
    "demo.footer": `Sillance — local demo. Deployment details: <code>~/pairform-backend/DEPLOY.md</code>.`,
  };
  var es = {
    "demo.title": `Sillance — Demo (front + back-end)`,
    "demo.tag": `Coaching de triatlón · Hyrox`,
    "demo.lead": `Plataforma de coaching para los 3 roles — <b>entrenador</b>, <b>atleta</b> y
  <b>club</b> — con sincronización de relojes conectados. Abajo: la aplicación
  (front) y la arquitectura back-end, listas para presentar.`,
    "demo.stat.tables": `tablas Postgres (RLS)`,
    "demo.stat.functions": `edge functions`,
    "demo.stat.devices": `integraciones de relojes`,
    "demo.stat.stripe": `suscripciones + a la carta`,
    "demo.frontTitle": `El producto (front)`,
    "demo.appCard.title": `App entrenador &amp; atleta`,
    "demo.appCard.text": `Calendario de entrenamiento, creador de sesiones, check-in de frescura,
      biblioteca de vídeos, espacio club &amp; horarios.`,
    "demo.appCard.cta": `Abrir la app →`,
    "demo.demoCard.title": `Demo testers`,
    "demo.demoCard.text": `Misma aplicación, la variante usada para el feedback de testers.`,
    "demo.demoCard.cta": `Abrir la demo →`,
    "demo.tip": `Truco de demo: el badge <b>☁︎</b> arriba a la derecha → crea una cuenta (entrenador /
  atleta / club). Sin conexión, la app funciona en <b>modo demo</b> con datos de ejemplo.`,
    "demo.backendTitle": `La infraestructura (back-end Supabase)`,
    "demo.backendText": `Postgres + Auth + Storage + Edge Functions (Deno). Seguridad por Row-Level
  Security; las suscripciones tienen como fuente de verdad el webhook de Stripe.`,
    "demo.data.title": `📦 Datos`,
    "demo.data.roles": `roles`,
    "demo.data.physio": `refs fisio`,
    "demo.functions.title": `⚙️ Edge Functions`,
    "demo.functions.email": `email`,
    "demo.devices.title": `⌚ Relojes conectados`,
    "demo.devices.ready": `listo`,
    "demo.devices.keys": `claves`,
    "demo.devices.normalized": `Actividades normalizadas`,
    "demo.devices.autoImport": `Importación automática (webhooks)`,
    "demo.devices.readOnly": `Solo lectura`,
    "demo.flowTitle": `Flujo de sincronización con Strava (en vivo)`,
    "demo.flowText": `<b>Atleta</b> <span class="arrow">→</span> «Conectar con Strava»
    <span class="arrow">→</span> autorización OAuth de Strava
    <span class="arrow">→</span> <b>strava-oauth-callback</b> (intercambio del código, almacenamiento cifrado de tokens)
    <span class="arrow">→</span> importación de actividades <span class="arrow">→</span>
    <b>external_activities</b> <span class="arrow">→</span> muestra «Actividades sincronizadas».<br>
    Luego cada nueva salida se envía en tiempo real por <b>strava-webhook</b>.`,
    "demo.footer": `Sillance — demo local. Detalles de despliegue: <code>~/pairform-backend/DEPLOY.md</code>.`,
  };
  window.SIL_I18N = window.SIL_I18N || { fr: {}, en: {}, es: {} };
  Object.assign(window.SIL_I18N.fr, fr);
  Object.assign(window.SIL_I18N.en, en);
  Object.assign(window.SIL_I18N.es, es);
})();
