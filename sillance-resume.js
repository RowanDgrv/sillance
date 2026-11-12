/* Sillance — reprise directe dans l'app (13/11/2026)
   Un utilisateur déjà connecté qui ouvre sillance.app (favori, lien en bio,
   onglet rouvert, raccourci) retombait sur la page d'accueil et devait
   recliquer jusqu'à l'app à chaque fois. S'il a une session en cours, on
   l'envoie directement dans l'app. On ne redirige PAS quand il vient d'une
   autre page du site (clic sur le logo depuis l'app, lien interne) ni avec
   ?accueil dans l'adresse : la page d'accueil reste consultable.
   Chargé en tête de page, avant tout affichage, sans dépendance. */
(function(){
  try{
    if(/[?&]accueil\b/.test(location.search)) return;
    if(document.referrer && new URL(document.referrer).origin === location.origin) return;
    var raw = localStorage.getItem('sb-onbsgohvqejccowfnrbs-auth-token');
    if(!raw) return;
    var s = JSON.parse(raw);
    // session utilisable : un jeton de rafraîchissement (le jeton d'accès expire vite, il est renouvelé dans l'app)
    if(!s || !s.refresh_token) return;
    location.replace('./sillance-app.html');
  }catch(e){}
})();
