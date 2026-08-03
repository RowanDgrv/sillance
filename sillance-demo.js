(function(){
  var c=document.getElementById('demoFlow');
  if(!c || !window.SillanceFlow) return;
  var flow=SillanceFlow.attach(c,{src:[0.55,0.22],dim:null});
  if(!flow) return;
  // Perf (audit 03/08/2026) : fond plein écran (position:fixed) donc jamais
  // "hors viewport" au sens scroll — la boucle GPU tournait en continu même
  // onglet en arrière-plan. On la coupe sur visibilitychange à la place.
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) flow.freeze(18.0); else flow.resume();
  });
})();