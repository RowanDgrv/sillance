/* Hero : fond flux partage (soufflerie / torpille) — voir sillance-flow.js */
(function(){
  var canvas = document.getElementById('heroGl');
  var fallback = document.getElementById('heroFallback');
  if(!canvas || !window.SillanceFlow) return;
  var flow = SillanceFlow.attach(canvas, {
    src:[0.60, 0.02],
    dim:[-0.42, 0.02],
    onLost:function(){ canvas.style.display='none'; fallback.style.display='block'; }
  });
  if(!flow){ return; }
  fallback.style.display = 'none';
  // debug : figer a un instant precis (capture d'ecran)
  window._freeze = function(t){ flow.freeze(t); };
  // Perf (audit 03/08/2026) : la boucle WebGL tournait en continu même hors
  // viewport (scroll passé le hero, onglet en arrière-plan). freeze()/resume()
  // existaient déjà côté sillance-flow.js mais n'étaient jamais appelés.
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      var visible = entries[0].isIntersecting;
      if(visible) flow.resume(); else flow.freeze(18.0);
    }, {threshold:0});
    io.observe(canvas);
  }
})();

/* CTA fixe mobile : le nav du haut a déjà un bouton sticky, mais un coin
   supérieur reste peu accessible au pouce en usage une main sur mobile — une
   barre pleine largeur en bas du viewport est la position réellement
   atteignable. Repoussée après le hero pour ne pas s'afficher dès le
   chargement (le hero a déjà ses 2 CTA visibles). */
(function(){
  var bar = document.getElementById('mobileCta');
  var hero = document.querySelector('.hero');
  if(!bar || !hero || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function(entries){
    bar.classList.toggle('show', !entries[0].isIntersecting);
  }, {threshold:0});
  io.observe(hero);
})();

/* Cartes data : tilt 3D + halo qui suit le curseur */
(function(){
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.feat').forEach(function(c){
    c.addEventListener('pointermove', function(e){
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left)/r.width, y = (e.clientY - r.top)/r.height;
      c.style.transform = 'perspective(900px) rotateY('+((x-.5)*6).toFixed(2)+'deg) rotateX('+((.5-y)*6).toFixed(2)+'deg) translateY(-2px)';
      c.style.setProperty('--gx',(x*100).toFixed(1)+'%');
      c.style.setProperty('--gy',(y*100).toFixed(1)+'%');
    });
    c.addEventListener('pointerleave', function(){ c.style.transform=''; });
  });
})();