/* Écran de connexion « 3 rôles » (06/11/2026).
   Habille le mur de connexion (#pf-auth-overlay, ?login=1 depuis la landing)
   SANS toucher à sa logique : le formulaire reste celui de renderAuth()
   (sillance-integration.js). On ajoute autour :
     - à gauche : logo Sillance, titre, choix Coach / Athlète / Club ;
     - à droite : un objet 3D par rôle (PC + planning / iPhone + calendrier /
       licence du club), chargé APRÈS le formulaire (vendor/sillance-auth-3d.js,
       three inclus, servi par le site → CSP script-src 'self').
   Le nom du club n'apparaît QUE sur la licence (pas en haut de page).
   Habillage du club : ?club=<slug>. Les clubs ci-dessous sont codés pour la
   démo ; en prod ils viendront de clubs.theme (0085) via une lecture publique
   limitée (nom, couleurs, logo). */

import "./sillance-motion.js?v=20261106a";   // réglage « Animations allégées » (window.SilMotion)

const CLUBS = {
  sillance:        { name: "Licence club", header: "Sillance", short: "", initials: null,
                     accent: "#46C2D8", accent2: "#FF9A3D", bg: "#0B1120", font: "Oswald", discs: ["swim", "bike", "run"] },
  "as-muret":      { name: "AS Muret Triathlon", short: "Triathlon · Muret", initials: "ASM",
                     accent: "#FF7A1A", accent2: "#2F5DAE", bg: "#0A1530", head: "#13254B", badgeBg: "#13254B", badgeInk: "#FF7A1A",
                     font: "Oswald", discs: ["swim", "bike", "run"] },
  "burning-miles": { name: "Burning Miles", short: "Run club · Lille", initials: "BM",
                     accent: "#FF5A1F", accent2: "#FFC233", bg: "#160805", font: "Anton", discs: ["run"] },
};

const TEXTS = {
  coach:   { titleUp: ["Crée ton", "espace coach"], title: ["Bon", "retour, coach"], lede: "Planifie la semaine de tes athlètes et suis ce qu'ils ont vraiment fait.", cap: ["Planning coach", "Semaine 46"] },
  athlete: { title: ["Ta semaine", "t'attend"], lede: "Tes séances du jour, ta montre synchronisée, ton coach à côté. Pas encore de compte ? Ton coach t'envoie un lien d'invitation.", cap: ["Calendrier athlète", "Aujourd'hui"] },
  club:    { titleUp: ["Lance ton", "club"], title: ["Ton club", "en main"], lede: "Licences, groupes et présences. Ta licence club toujours sur toi.", cap: ["Licence club", "Saison 2026–27"] },
};
// rôle de l'écran → rôle du formulaire d'inscription (renderAuth)
const FORM_ROLE = { coach: "coach", athlete: "athlete", club: "club_admin" };

const CSS = `
#pf-auth-overlay.pf-3d{--p3-accent:#46C2D8;--p3-ink:#06222a;--p3-bg:#0B1120;--p3-glowA:rgba(70,194,216,.16);--p3-glowB:rgba(255,154,61,.10);--p3-title:'Oswald',sans-serif;
  background:var(--p3-bg);backdrop-filter:none;padding:0;align-items:stretch;justify-content:stretch}
#pf-auth-overlay.pf-3d.open{display:grid;grid-template-columns:minmax(360px,480px) 1fr}
.pf3-side{position:relative;z-index:2;display:flex;flex-direction:column;justify-content:safe center;min-height:100vh;
  padding:32px clamp(24px,4vw,56px);background:linear-gradient(90deg,var(--p3-bg) 72%,transparent)}
.pf3-side > *{flex-shrink:0}
.pf3-brand{display:flex;align-items:center;gap:10px;font:700 22px 'Oswald',sans-serif;color:#F3F6FC;margin-bottom:clamp(20px,5vh,56px)}
.pf3-brand svg{width:30px;height:30px}
.pf3-kicker{font:600 11px 'Archivo',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--p3-accent);margin:0 0 12px}
.pf3-title{font:600 clamp(34px,6vh,54px)/1 var(--p3-title);text-transform:uppercase;color:#F3F6FC;margin:0 0 12px}
.pf3-title,.pf3-title .ln,.pf3-title .ch{background:none;border:0;border-radius:0;box-shadow:none}
.pf3-title .ln{display:block;overflow:hidden;padding:0 0 .06em;margin:0}
.pf3-title .ch{display:inline-block;transform:translateY(105%);transition:transform .7s cubic-bezier(.2,.8,.2,1)}
.pf3-title.in .ch{transform:none}
.pf3-lede{color:#C2CBDD;font:15px/1.5 'Archivo',sans-serif;margin:0 0 22px;min-height:45px;transition:opacity .25s}
.pf3-roles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px}
.pf3-role{appearance:none;border:1px solid rgba(150,165,200,.28);background:transparent;color:#C2CBDD;border-radius:12px;
  padding:13px 6px 11px;font:600 14px 'Archivo',sans-serif;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;
  transition:border-color .2s,color .2s,background .2s,transform .15s}
.pf3-role:hover{color:#F3F6FC;border-color:color-mix(in srgb,var(--p3-accent) 55%,transparent)}
.pf3-role:active{transform:scale(.97)}
.pf3-role svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.pf3-role[aria-checked="true"]{border-color:var(--p3-accent);color:var(--p3-accent);background:color-mix(in srgb,var(--p3-accent) 9%,transparent)}
.pf3-role:focus-visible{outline:2px solid var(--p3-accent);outline-offset:2px}
.pf3-demo{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 20px;padding:12px 14px;border-radius:12px;
  border:1px dashed rgba(150,165,200,.32);color:#C2CBDD;font:14px/1.35 'Archivo',sans-serif;text-decoration:none;transition:border-color .2s,color .2s}
.pf3-demo b{color:#F3F6FC;font-weight:600}
.pf3-demo span:last-child{color:var(--p3-accent);font-weight:600;white-space:nowrap}
.pf3-demo:hover{border-color:var(--p3-accent);color:#F3F6FC}
.pf3-demo:focus-visible{outline:2px solid var(--p3-accent);outline-offset:2px}
/* le formulaire existant, à plat dans la colonne */
#pf-auth-overlay.pf-3d .pf-auth-card{width:100%;max-width:none;background:transparent;border:0;box-shadow:none;padding:0;font-family:'Archivo',sans-serif}
#pf-auth-overlay.pf-3d .pf-auth-card > h2{display:none}
#pf-auth-overlay.pf-3d .pf-auth-card label:has(+ .row-roles),#pf-auth-overlay.pf-3d .pf-auth-card .row-roles{display:none}
#pf-auth-overlay.pf-3d .pf-auth-card input,#pf-auth-overlay.pf-3d .pf-auth-card select{background:rgba(255,255,255,.04);border-color:rgba(150,165,200,.28);border-radius:10px}
#pf-auth-overlay.pf-3d .pf-auth-card input:focus,#pf-auth-overlay.pf-3d .pf-auth-card select:focus{border-color:var(--p3-accent);outline:none}
#pf-auth-overlay.pf-3d .pf-auth-card button.primary{background:var(--p3-accent);color:var(--p3-ink);border-radius:10px;padding:15px;font:600 15px 'Archivo',sans-serif}
#pf-auth-overlay.pf-3d .pf-auth-card .switch a,#pf-auth-overlay.pf-3d .pf-auth-card .pf-consent a,#pf-auth-overlay.pf-3d .pf-auth-card .pf-req{color:var(--p3-accent)}
.pf3-stage{position:sticky;top:0;height:100vh;align-self:start}
.pf3-stage > canvas{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .6s}
.pf3-stage > canvas.on{opacity:1}
.pf3-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(60% 55% at 55% 52%,var(--p3-glowA),transparent 70%),radial-gradient(40% 40% at 70% 70%,var(--p3-glowB),transparent 70%)}
.pf3-motion{position:absolute;top:22px;right:clamp(24px,4vw,56px);z-index:3;display:inline-flex;align-items:center;gap:7px;
  padding:8px 12px;border-radius:99px;border:1px solid rgba(150,165,200,.28);background:rgba(11,17,32,.55);color:#C2CBDD;
  font:600 12px 'Archivo',sans-serif;cursor:pointer;backdrop-filter:blur(6px);transition:border-color .2s,color .2s}
.pf3-motion svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}
.pf3-motion:hover{color:#F3F6FC;border-color:var(--p3-accent)}
.pf3-motion[aria-pressed="true"]{color:var(--p3-accent);border-color:var(--p3-accent)}
.pf3-motion:focus-visible{outline:2px solid var(--p3-accent);outline-offset:2px}
.pf3-flat{position:absolute;inset:0}
.pf3-flat[hidden]{display:none}
.pf3-flat img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none}
.pf3-flat img.on{display:block}
.pf3-cap{position:absolute;right:clamp(24px,4vw,56px);bottom:36px;text-align:right;font:600 11px 'Archivo',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8A93A8}
.pf3-cap b{display:block;font:600 20px 'Oswald',sans-serif;letter-spacing:.04em;color:#F3F6FC;margin-bottom:4px}
@media (max-width:860px){
  #pf-auth-overlay.pf-3d.open{grid-template-columns:1fr;grid-template-rows:auto auto;align-content:start}
  .pf3-stage{grid-row:1;position:relative;height:min(30vh,260px)}
  .pf3-side{grid-row:2;position:static;min-height:0;padding:0 16px 40px;background:var(--p3-bg)}
  .pf3-brand{position:absolute;top:18px;left:16px;z-index:4;margin:0;font-size:19px}
  .pf3-brand svg{width:26px;height:26px}
  .pf3-motion{top:16px;right:16px;padding:7px 10px;font-size:11px}
  .pf3-kicker{margin-bottom:8px}
  .pf3-title{font-size:clamp(28px,8.4vw,36px);margin-bottom:8px}
  .pf3-lede{font-size:14px;min-height:0;margin-bottom:16px}
  .pf3-roles{margin-bottom:12px}
  .pf3-role{padding:10px 4px 9px;font-size:13px}
  .pf3-demo{margin-bottom:14px;font-size:13px;padding:10px 12px}
  .pf3-cap{display:none}
}
@media (max-width:360px){
  .pf3-motion span{display:none}
  .pf3-demo{flex-direction:column;align-items:flex-start;gap:4px}
}
@media (prefers-reduced-motion:reduce){.pf3-title .ch{transition:none}}
`;

const VESICA = `<svg viewBox="0 0 96 96" aria-hidden="true"><defs><linearGradient id="pf3v" x1="0" x2="1"><stop offset="0" stop-color="#46C2D8"/><stop offset="1" stop-color="#FF9A3D"/></linearGradient></defs>
  <circle cx="34.5" cy="48" r="27" fill="none" stroke="#46C2D8" stroke-width="3" opacity=".6"/>
  <circle cx="61.5" cy="48" r="27" fill="none" stroke="#FF9A3D" stroke-width="3" opacity=".6"/>
  <path d="M48 24.6A27 27 0 0 1 48 71.4A27 27 0 0 1 48 24.6Z" fill="url(#pf3v)"/></svg>`;
const ICONS = {
  coach: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20M8 8h3M8 11h6"/></svg>`,
  athlete: `<svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>`,
  club: `<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2.5"/><circle cx="8" cy="11" r="2.2"/><path d="M5 16c.6-1.6 1.7-2.3 3-2.3s2.4.7 3 2.3M14 10h4M14 14h3"/></svg>`,
};
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export function mountAuthScene(overlay, { initialRole = "coach" } = {}) {
  if (!overlay || overlay.classList.contains("pf-3d")) return;
  const card = overlay.querySelector(".pf-auth-card");
  if (!card) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clubKey = CLUBS[new URLSearchParams(location.search).get("club")] ? new URLSearchParams(location.search).get("club") : "sillance";
  const club = CLUBS[clubKey];

  if (!document.getElementById("pf3-style")) {
    const st = document.createElement("style"); st.id = "pf3-style"; st.textContent = CSS; document.head.appendChild(st);
  }
  // Polices dessinées DANS les textures 3D : l'app les charge en différé
  // (display=optional, feuille en media=print) → on les déclare ici pour de bon,
  // sinon le canvas tombe sur une police de secours à empattements.
  const fam = ["Oswald:wght@600;700", "Archivo:wght@500;600"]
    .concat(club.font === "Anton" || club.initials ? ["Anton"] : []);
  const fl = document.createElement("link"); fl.rel = "stylesheet";
  fl.href = `https://fonts.googleapis.com/css2?${fam.map((f) => "family=" + f).join("&")}&display=swap`;
  const fontsCss = new Promise((res) => { fl.onload = fl.onerror = res; setTimeout(res, 2500); });
  document.head.appendChild(fl);
  overlay.classList.add("pf-3d");
  if (club !== CLUBS.sillance) {
    const s = overlay.style;
    s.setProperty("--p3-accent", club.accent); s.setProperty("--p3-bg", club.bg); s.setProperty("--p3-ink", club.head || club.bg);
    s.setProperty("--p3-glowA", hexA(club.accent, .18)); s.setProperty("--p3-glowB", hexA(club.accent2, .12));
    s.setProperty("--p3-title", `'${club.font}',sans-serif`);
    TEXTS.club.lede = `Sorties, groupes et présences de ton club. Ta licence club toujours sur toi.`;
  }

  /* ---- colonne gauche : en-tête + choix du rôle, puis le formulaire existant ---- */
  const side = document.createElement("section");
  side.className = "pf3-side";
  side.innerHTML = `
    <div class="pf3-brand">${VESICA}Sillance</div>
    <p class="pf3-kicker">Connexion</p>
    <h1 class="pf3-title"></h1>
    <p class="pf3-lede"></p>
    <div class="pf3-roles" role="radiogroup" aria-label="Je suis">
      ${["coach", "athlete", "club"].map((r) => `<button type="button" class="pf3-role" role="radio" data-role="${r}" aria-checked="false">${ICONS[r]}${{ coach: "Coach", athlete: "Athlète", club: "Club" }[r]}</button>`).join("")}
    </div>
    <a class="pf3-demo" href="./sillance-app.html"><span><b>Pas encore de compte ?</b> Explore l'app sans t'inscrire ni payer.</span><span class="pf3-demo-go">Voir la démo →</span></a>`;
  side.appendChild(card);

  const stage = document.createElement("section");
  stage.className = "pf3-stage"; stage.setAttribute("aria-hidden", "true");
  stage.innerHTML = `<div class="pf3-glow"></div><canvas></canvas><div class="pf3-flat" hidden></div><div class="pf3-cap"></div><button class="pf3-motion"></button>`;
  stage.removeAttribute("aria-hidden");                  // le bouton doit rester atteignable
  stage.querySelector(".pf3-glow").setAttribute("aria-hidden", "true");
  overlay.append(side, stage);

  const h1 = side.querySelector(".pf3-title"), lede = side.querySelector(".pf3-lede"), cap = stage.querySelector(".pf3-cap");
  let role = null, scene = null;

  const isUp = () => !!overlay.querySelector(".pf-auth-card")?.classList.contains("up");
  let shown = "";
  function setText(r) {
    const t = TEXTS[r], title = (isUp() && t.titleUp) || t.title;
    if (shown === r + title) return; shown = r + title;
    h1.classList.remove("in");
    h1.setAttribute("aria-label", title.join(" "));
    h1.innerHTML = title.map((l) => `<span class="ln">${[...l].map((c, i) =>
      `<span class="ch" style="transition-delay:${i * 22}ms">${c === " " ? "&nbsp;" : c}</span>`).join("")}</span>`).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => h1.classList.add("in")));
    lede.style.opacity = 0;
    setTimeout(() => { lede.textContent = t.lede; lede.style.opacity = 1; }, 160);
    cap.innerHTML = `<b>${t.cap[0]}</b>${t.cap[1]}`;
  }
  // Aligne le formulaire sur le rôle choisi : en inscription, sélectionne le
  // rôle correspondant ; si l'inscription athlète n'est pas proposée (mur de
  // connexion : un athlète rejoint via l'invitation de son coach), on bascule
  // sur « Se connecter » plutôt que de créer un compte du mauvais rôle.
  function syncForm(r) {
    const c = overlay.querySelector(".pf-auth-card");
    if (!c || !c.classList.contains("up")) return;              // connexion : le rôle vient du compte
    const btn = c.querySelector(`.role[data-role="${FORM_ROLE[r]}"]`);
    if (btn) { if (!btn.classList.contains("active")) btn.click(); }
    else c.querySelector("#pf-switch")?.click();
  }
  function pick(r, fromUser) {
    if (r === role) return;
    role = r;
    side.querySelectorAll(".pf3-role").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.role === r)));
    setText(r);
    const demo = side.querySelector(".pf3-demo");
    demo.href = `./sillance-app.html?demo=${r}`;
    demo.querySelector(".pf3-demo-go").textContent = `Démo ${{ coach: "coach", athlete: "athlète", club: "club" }[r]} →`;
    scene?.show(r);
    showFlat(r);
    if (fromUser) syncForm(r);
  }
  side.querySelectorAll(".pf3-role").forEach((b) => b.addEventListener("click", () => pick(b.dataset.role, true)));
  side.querySelector(".pf3-roles").addEventListener("keydown", (e) => {
    const list = [...side.querySelectorAll(".pf3-role")], i = list.findIndex((b) => b.dataset.role === role);
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return; e.preventDefault(); const n = list[(i + d + 3) % 3]; n.focus(); n.click();
  });
  pick(initialRole === "club_admin" ? "club" : (initialRole in TEXTS ? initialRole : "coach"), false);
  // Et dans l'autre sens : en inscription, le rôle réellement retenu par le
  // formulaire fait foi (ex. « Créer un compte » depuis l'onglet Athlète sur
  // le mur → le formulaire ne propose que Coach/Club → l'écran suit).
  const syncFromForm = () => {
    const c = overlay.querySelector(".pf-auth-card");
    side.querySelector(".pf3-kicker").textContent = c?.classList.contains("up") ? "Inscription" : "Connexion";
    const active = c?.classList.contains("up") && c.querySelector(".role.active")?.dataset.role;
    const r = active && Object.keys(FORM_ROLE).find((k) => FORM_ROLE[k] === active);
    if (r) pick(r, false);
    if (role) setText(role);           // connexion ↔ inscription : le titre suit
  };
  new MutationObserver(syncFromForm).observe(card, { childList: true });
  syncFromForm();

  /* ---- 3D (ou version fixe « Animations allégées »), jamais bloquante ---- */
  const canvas = stage.querySelector("canvas"), flat = stage.querySelector(".pf3-flat");
  canvas.setAttribute("aria-hidden", "true"); flat.setAttribute("aria-hidden", "true");
  const fonts = ["700 40px Oswald", "600 20px Archivo"].concat(club.initials || club.font === "Anton" ? ["400 40px Anton"] : []);
  const fontsReady = fontsCss.then(() => Promise.all(fonts.map((f) => document.fonts.load(f)))).catch(() => {});
  let flatBuilt = false, want3d = false;
  // Version figée : la même image que la 3D, rendue une fois (img/auth/*.webp),
  // sans charger three ni animer quoi que ce soit.
  function buildFlat() {
    if (flatBuilt) return; flatBuilt = true;
    const clubImg = clubKey === "sillance" ? "club" : `club-${clubKey}`;
    flat.innerHTML = [["coach", "coach"], ["athlete", "athlete"], ["club", clubImg]]
      .map(([r, f]) => `<img data-r="${r}" src="./img/auth/${f}.webp?v=20261106a" alt="" decoding="async">`).join("");
    showFlat(role);
  }
  function showFlat(r) { stage.querySelector(".pf3-flat").querySelectorAll("[data-r]").forEach((d) => d.classList.toggle("on", d.dataset.r === r)); }
  async function start3d() {
    want3d = true;
    if (scene) return;
    try {
      const [m] = await Promise.all([import("./vendor/sillance-auth-3d.js?v=20261106c"), fontsReady]);
      if (!want3d || scene || !overlay.classList.contains("open")) return;
      scene = m.createScene(canvas, club, { reduced });
      scene.show(role);
      canvas.classList.add("on");
    } catch (e) {                                        // WebGL absent / échec : version fixe
      console.warn("[PF] scène 3D indisponible :", e?.message || e);
      apply(true);
    }
  }
  function stop3d() { want3d = false; scene?.dispose(); scene = null; canvas.classList.remove("on"); }
  function apply(lite) {
    if (lite) { stop3d(); flat.hidden = false; buildFlat(); }
    else { flat.hidden = true; start3d(); }
  }
  const M = window.SilMotion;
  let unsub = null;
  if (M) { M.toggle(stage.querySelector(".pf3-motion")); unsub = M.onChange(apply); apply(M.lite()); }
  else { stage.querySelector(".pf3-motion").remove(); apply(false); }

  // Fermeture du mur (connexion réussie) → on libère le GPU.
  const mo = new MutationObserver(() => {
    if (!overlay.classList.contains("open")) { stop3d(); unsub?.(); mo.disconnect(); }
  });
  mo.observe(overlay, { attributes: true, attributeFilter: ["class"] });
}
