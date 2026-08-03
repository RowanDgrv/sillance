(function(){
  var c=document.getElementById('flow404');
  if(!c || !window.SillanceFlow) return;
  var flow=SillanceFlow.attach(c,{src:[0.55,0.05],dim:[0,0]});
  if(!flow) return;
  // Perf (audit 03/08/2026) : fond plein écran (position:fixed), coupe la
  // boucle GPU quand l'onglet est en arrière-plan (visibilitychange).
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) flow.freeze(18.0); else flow.resume();
  });
})();