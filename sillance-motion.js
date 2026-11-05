/* Réglage « Animations allégées » (06/11/2026), partagé par tout le site.
   Pour les ordinateurs moins puissants : quand il est actif, les scènes 3D
   et animations lourdes ne sont ni chargées ni calculées (version fixe à la
   place). Préférence de CE navigateur (localStorage), sinon détection auto :
   « réduire les animations » demandé par le système, ou appareil très modeste.

   Utilisation (script classique OU import()) :
     SilMotion.lite()            → true si animations allégées
     SilMotion.set(true|false)   → change et prévient les abonnés
     SilMotion.onChange(fn)      → fn(lite) à chaque changement (renvoie le désabonnement)
     SilMotion.toggle(el)        → transforme un <button> en interrupteur prêt à l'emploi */
(function () {
  if (window.SilMotion) return;
  var KEY = "sil_motion";                 // 'lite' | 'full'
  var subs = [];
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function auto() {
    try { if (matchMedia("(prefers-reduced-motion: reduce)").matches) return true; } catch (e) {}
    var cores = navigator.hardwareConcurrency || 8, mem = navigator.deviceMemory || 8;
    return cores <= 2 || mem <= 2;
  }
  function lite() { var v = read(); return v ? v === "lite" : auto(); }
  function emit() { var l = lite(); subs.slice().forEach(function (f) { try { f(l); } catch (e) {} }); }
  function set(l) { try { localStorage.setItem(KEY, l ? "lite" : "full"); } catch (e) {} emit(); }
  function onChange(f) { subs.push(f); return function () { subs = subs.filter(function (x) { return x !== f; }); }; }
  addEventListener("storage", function (e) { if (e.key === KEY) emit(); });   // autre onglet

  var ICON_LITE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>';
  function toggle(btn) {
    function paint(l) {
      btn.setAttribute("aria-pressed", String(l));
      btn.innerHTML = ICON_LITE + "<span>" + (l ? "Animations allégées" : "Alléger les animations") + "</span>";
      btn.title = l ? "Réactiver les animations 3D" : "Pour les ordinateurs moins puissants : masque les animations 3D";
    }
    btn.type = "button";
    btn.addEventListener("click", function () { set(!lite()); });
    onChange(paint); paint(lite());
    return btn;
  }
  window.SilMotion = { lite: lite, set: set, onChange: onChange, toggle: toggle };
})();
