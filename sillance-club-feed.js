/* ============================================================
   Sillance — Fil du club (window.PFFeed)
   ------------------------------------------------------------
   Le coach / l'admin du club publie pour tout le club ou un groupe
   ("programme de la semaine en ligne"). Les membres lisent ; sur une
   publication, "Discuter de ça avec le coach" ouvre un fil PRIVÉ
   athlète <-> auteur (RPC start_post_discussion, migration 0069),
   affiché dans le panneau de messagerie existant, publication
   épinglée en tête.
   Fichier partagé (chargé par app / calendrier / review) : injecte
   lui-même son bouton dans le topbar, son overlay et son CSS, plutôt
   que de tripler encore le code dans les 3 *.core.js.
   Le bouton n'apparaît que pour un compte rattaché à au moins un club
   (gérant, staff ou membre) — cohérent avec la porte Club masquée.
   ============================================================ */
(function () {
  "use strict";
  var FR = {
    "feed.title": "Fil du club", "feed.openAria": "Ouvrir le fil du club",
    "feed.placeholder": "Ex. Programme de la semaine en ligne — dites-moi si vous avez des questions.",
    "feed.publish": "Publier", "feed.wholeClub": "Tout le club",
    "feed.empty": "Aucune publication pour l'instant.",
    "feed.emptyStaff": "Aucune publication. Écris le premier message à ton club ci-dessus.",
    "feed.discuss": "Discuter de ça avec le coach", "feed.delete": "Supprimer",
    "feed.confirmDelete": "Supprimer cette publication ?", "feed.published": "Publié",
    "feed.failed": "Action impossible, réessaie.", "feed.forGroup": "Groupe",
    "feed.aboutPost": "À propos d'une publication", "feed.pinnedFrom": "Publication de {name}",
    "feed.askHint": "Pose ta question au coach ci-dessous.", "feed.closeAria": "Fermer",
  };
  function t(key, vars) {
    var s = window.SilI18n ? window.SilI18n.t(key, vars) : key;
    if (!s || s === key) { s = FR[key] || key; if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", vars[k]); }); }
    return s;
  }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString(document.documentElement.lang || "fr", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return ""; }
  }

  var CSS = '' +
    '.ic-megaphone{--i:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m3%2011%2018-5v12L3%2014v-3z%22%2F%3E%3Cpath%20d%3D%22M11.6%2016.8a3%203%200%201%201-5.8-1.6%22%2F%3E%3C%2Fsvg%3E")}' +
    '.clf-btn{position:relative}' +
    // .icon-btn pose display:inline-flex, qui l'emporte sur [hidden] (cf. chat-panel)
    '.clf-btn[hidden],.clf-dot[hidden],.clf-compose[hidden],.clf-row select[hidden]{display:none!important}' +
    '.clf-dot{position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:var(--swim);border:2px solid var(--ink,var(--bg))}' +
    '.clf-overlay{position:fixed;inset:0;z-index:90;background:rgba(5,8,14,.62);display:flex;justify-content:center;align-items:flex-start;padding:6vh 16px 16px;overflow-y:auto}' +
    '.clf-overlay[hidden]{display:none!important}' +
    '.clf-panel{width:min(680px,100%);background:var(--panel);border:1px solid var(--line-strong);border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.55);overflow:hidden;animation:cfIn .22s cubic-bezier(0.23,1,0.32,1)}' +
    '@keyframes cfIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){.clf-panel{animation:none}}' +
    '.clf-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line);background:var(--panel-2)}' +
    '.clf-head h3{margin:0;font-size:var(--fs-lg,17px);display:flex;align-items:center;gap:8px}' +
    '.clf-sub{margin:3px 0 0;font-size:12px;color:var(--muted)}' +
    '.clf-x{width:34px;height:34px;border-radius:9px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer}' +
    '.clf-compose{padding:14px 18px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:10px}' +
    '.clf-compose textarea{width:100%;min-height:76px;resize:vertical;border:1px solid var(--line-strong);border-radius:12px;background:var(--panel-2);color:var(--text);font:inherit;font-size:14px;padding:10px 12px;box-sizing:border-box}' +
    '.clf-compose textarea:focus{outline:2px solid var(--swim);outline-offset:1px}' +
    '.clf-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
    '.clf-row select{border:1px solid var(--line-strong);border-radius:9px;background:var(--panel-2);color:var(--text);font:inherit;font-size:13px;padding:8px 10px}' +
    '.clf-pub{margin-left:auto;border:none;border-radius:99px;background:var(--swim);color:#fff;font-weight:700;font-size:13px;padding:9px 18px;cursor:pointer}' +
    '.clf-pub:disabled{opacity:.5;cursor:default}' +
    '.clf-list{padding:8px 18px 18px;display:flex;flex-direction:column;gap:10px;max-height:62vh;overflow-y:auto}' +
    '.clf-empty{padding:28px 8px;text-align:center;color:var(--muted);font-size:13px;line-height:1.6}' +
    '.clf-post{border:1px solid var(--line);border-radius:14px;padding:13px 15px;background:var(--panel-2)}' +
    '.clf-post-top{display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap}' +
    '.clf-author{font-weight:700;font-size:13.5px}' +
    '.clf-meta{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}' +
    '.clf-tag{display:inline-block;font-size:11px;font-weight:700;color:var(--swim);border:1px solid var(--line-strong);border-radius:99px;padding:2px 8px;margin-left:6px}' +
    '.clf-body{margin:8px 0 0;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}' +
    '.clf-actions{display:flex;gap:8px;margin-top:11px;flex-wrap:wrap}' +
    '.clf-discuss{border:1px solid var(--swim);background:transparent;color:var(--swim);font-weight:700;font-size:12.5px;border-radius:99px;padding:7px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}' +
    '.clf-del{border:none;background:transparent;color:var(--muted);font-size:12px;cursor:pointer;padding:7px 4px}' +
    '@media (hover:hover) and (pointer:fine){.clf-discuss:hover{background:var(--swim);color:#fff}.clf-del:hover{color:var(--run)}.clf-x:hover{color:var(--text)}}' +
    '.chat-pinned{border:1px solid var(--line-strong);border-left:3px solid var(--swim);border-radius:10px;background:var(--panel-2);padding:9px 12px;font-size:13px;line-height:1.45;margin-bottom:6px;word-wrap:break-word}' +
    '.chat-pinned-k{display:block;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--swim);margin-bottom:4px}';

  var state = { clubs: [], staffClubIds: [], memberships: [], posts: [], names: {}, groupsByClub: {} };
  var ov, btn, dot;

  function injectUI() {
    if (document.getElementById("cfBtn")) return true;
    var bell = document.getElementById("bellWrap");
    if (!bell) return false;
    var st = document.createElement("style"); st.id = "clf-style"; st.textContent = CSS; document.head.appendChild(st);
    btn = document.createElement("button");
    btn.className = "icon-btn clf-btn"; btn.id = "cfBtn"; btn.type = "button"; btn.hidden = true;
    btn.setAttribute("aria-label", t("feed.openAria")); btn.title = t("feed.title");
    btn.innerHTML = '<i class="ic ic-megaphone"></i><span class="clf-dot" id="cfDot" hidden></span>';
    bell.parentNode.insertBefore(btn, bell);
    dot = btn.querySelector("#cfDot");
    ov = document.createElement("div");
    ov.className = "clf-overlay"; ov.id = "cfOverlay"; ov.hidden = true;
    ov.innerHTML = '<div class="clf-panel" role="dialog" aria-modal="true" aria-labelledby="cfTitle">' +
      '<div class="clf-head"><div><h3 id="cfTitle"><i class="ic ic-megaphone"></i> ' + esc(t("feed.title")) + '</h3><p class="clf-sub" id="cfSub"></p></div>' +
      '<button class="clf-x" id="cfClose" type="button" aria-label="' + esc(t("feed.closeAria")) + '"><i class="ic ic-x"></i></button></div>' +
      '<div class="clf-compose" id="cfCompose" hidden>' +
        '<textarea id="cfText" maxlength="4000" placeholder="' + esc(t("feed.placeholder")) + '"></textarea>' +
        '<div class="clf-row"><select id="cfClub" aria-label="Club"></select><select id="cfGroup" aria-label="' + esc(t("feed.forGroup")) + '"></select>' +
        '<button class="clf-pub" id="cfPublish" type="button">' + esc(t("feed.publish")) + '</button></div>' +
      '</div>' +
      '<div class="clf-list" id="cfList"></div></div>';
    document.body.appendChild(ov);
    btn.addEventListener("click", open);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelector("#cfClose").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !ov.hidden) close(); });
    ov.querySelector("#cfPublish").addEventListener("click", publish);
    ov.querySelector("#cfClub").addEventListener("change", fillGroups);
    return true;
  }

  function clubName(id) { var c = state.clubs.find(function (x) { return x.id === id; }); return c ? c.name : ""; }
  function isStaffOf(clubId) { return state.staffClubIds.indexOf(clubId) !== -1; }

  async function loadClubs() {
    var PF = window.PF;
    var staff = await PF.myClubs().catch(function () { return []; });
    var mem = await PF.myClubMemberships().catch(function () { return []; });
    state.staffClubIds = staff.map(function (c) { return c.id; });
    var byId = {};
    staff.forEach(function (c) { byId[c.id] = { id: c.id, name: c.name }; });
    mem.forEach(function (m) { if (m.clubs && !byId[m.club_id]) byId[m.club_id] = { id: m.club_id, name: m.clubs.name }; });
    state.clubs = Object.keys(byId).map(function (k) { return byId[k]; });
    state.memberships = mem;
  }

  async function loadPosts() {
    var PF = window.PF;
    state.posts = await PF.listClubPosts(state.clubs.map(function (c) { return c.id; })).catch(function () { return []; });
    var missing = state.posts.map(function (p) { return p.author_id; }).filter(function (id) { return !state.names[id]; });
    if (missing.length) Object.assign(state.names, await PF.getProfilesByIds(missing));
    var groupIds = state.posts.map(function (p) { return p.club_group_id; }).filter(Boolean);
    if (groupIds.length) {
      for (var i = 0; i < state.clubs.length; i++) await ensureGroups(state.clubs[i].id);
    }
  }

  async function ensureGroups(clubId) {
    if (state.groupsByClub[clubId]) return state.groupsByClub[clubId];
    var g = await window.PF.getGroups(clubId).catch(function () { return []; });
    state.groupsByClub[clubId] = g || [];
    return state.groupsByClub[clubId];
  }
  function groupName(clubId, gid) {
    var g = (state.groupsByClub[clubId] || []).find(function (x) { return x.id === gid; });
    return g ? g.name : t("feed.forGroup");
  }

  function lastSeen() { try { return localStorage.getItem("sil_feed_seen") || ""; } catch (e) { return ""; } }
  function markSeen() { try { localStorage.setItem("sil_feed_seen", new Date().toISOString()); } catch (e) {} }
  function refreshDot() {
    var uid = window.PF && window.PF.user && window.PF.user.id;
    var seen = lastSeen();
    dot.hidden = !state.posts.some(function (p) { return p.author_id !== uid && (!seen || p.created_at > seen); });
  }

  function render() {
    var uid = window.PF.user.id;
    var staffAny = state.staffClubIds.length > 0;
    ov.querySelector("#cfSub").textContent = state.clubs.map(function (c) { return c.name; }).join(" · ");
    var compose = ov.querySelector("#cfCompose");
    compose.hidden = !staffAny;
    if (staffAny) {
      var sel = ov.querySelector("#cfClub");
      var current = sel.value;
      sel.innerHTML = state.staffClubIds.map(function (id) { return '<option value="' + esc(id) + '">' + esc(clubName(id)) + "</option>"; }).join("");
      if (current) sel.value = current;
      sel.hidden = state.staffClubIds.length < 2;
      fillGroups();
    }
    var list = ov.querySelector("#cfList");
    if (!state.posts.length) {
      list.innerHTML = '<div class="clf-empty">' + esc(staffAny ? t("feed.emptyStaff") : t("feed.empty")) + "</div>";
      return;
    }
    list.innerHTML = state.posts.map(function (p) {
      var mine = p.author_id === uid;
      var tag = p.club_group_id ? '<span class="clf-tag">' + esc(groupName(p.club_id, p.club_group_id)) + "</span>" : (state.clubs.length > 1 ? '<span class="clf-tag">' + esc(clubName(p.club_id)) + "</span>" : "");
      var actions = "";
      if (!mine) actions += '<button class="clf-discuss" type="button" data-discuss="' + esc(p.id) + '"><i class="ic ic-message-circle"></i> ' + esc(t("feed.discuss")) + "</button>";
      if (mine || isStaffOf(p.club_id)) actions += '<button class="clf-del" type="button" data-del="' + esc(p.id) + '">' + esc(t("feed.delete")) + "</button>";
      return '<article class="clf-post"><div class="clf-post-top"><span><span class="clf-author">' + esc(state.names[p.author_id] || "Coach") + "</span>" + tag + "</span>" +
        '<span class="clf-meta">' + esc(fmtDate(p.created_at)) + "</span></div>" +
        '<p class="clf-body">' + esc(p.body) + "</p>" + (actions ? '<div class="clf-actions">' + actions + "</div>" : "") + "</article>";
    }).join("");
    list.querySelectorAll("[data-discuss]").forEach(function (b) { b.addEventListener("click", function () { discuss(b.dataset.discuss, b); }); });
    list.querySelectorAll("[data-del]").forEach(function (b) { b.addEventListener("click", function () { remove(b.dataset.del); }); });
  }

  async function fillGroups() {
    var clubId = ov.querySelector("#cfClub").value;
    var gsel = ov.querySelector("#cfGroup");
    if (!clubId) { gsel.innerHTML = ""; return; }
    var groups = await ensureGroups(clubId);
    gsel.innerHTML = '<option value="">' + esc(t("feed.wholeClub")) + "</option>" +
      groups.map(function (g) { return '<option value="' + esc(g.id) + '">' + esc(g.name) + "</option>"; }).join("");
  }

  async function publish() {
    var ta = ov.querySelector("#cfText"), pub = ov.querySelector("#cfPublish");
    var text = ta.value.trim(); if (!text) { ta.focus(); return; }
    pub.disabled = true;
    try {
      await window.PF.createClubPost(ov.querySelector("#cfClub").value, text, ov.querySelector("#cfGroup").value || null);
      ta.value = "";
      await loadPosts(); render();
      if (typeof window.toast === "function") window.toast(t("feed.published"));
    } catch (e) {
      console.warn("[PF] createClubPost:", e);
      if (typeof window.toast === "function") window.toast(t("feed.failed"));
    } finally { pub.disabled = false; }
  }

  async function remove(id) {
    if (!window.confirm(t("feed.confirmDelete"))) return;
    try { await window.PF.deleteClubPost(id); await loadPosts(); render(); }
    catch (e) { console.warn("[PF] deleteClubPost:", e); if (typeof window.toast === "function") window.toast(t("feed.failed")); }
  }

  // Ouvre le fil privé dans le panneau de messagerie existant (fonctions
  // globales des *.core.js : loadConversationsList / openConversation).
  async function discuss(postId, b) {
    if (b) b.disabled = true;
    try {
      var convId = await window.PF.startPostDiscussion(postId);
      close();
      var panel = document.getElementById("chatPanel");
      if (panel) panel.classList.add("open");
      /* global loadConversationsList, openConversation, CONVERSATIONS */
      if (typeof loadConversationsList === "function" && typeof openConversation === "function") {
        await loadConversationsList();
        var conv = (typeof CONVERSATIONS !== "undefined" ? CONVERSATIONS : []).find(function (c) { return c.id === convId; });
        if (conv) openConversation(conv);
      }
    } catch (e) {
      console.warn("[PF] startPostDiscussion:", e);
      if (typeof window.toast === "function") window.toast(t("feed.failed"));
    } finally { if (b) b.disabled = false; }
  }

  async function open() {
    ov.hidden = false;
    ov.querySelector("#cfList").innerHTML = '<div class="clf-empty">…</div>';
    await loadPosts(); render();
    markSeen(); refreshDot();
    var focusEl = ov.querySelector("#cfCompose").hidden ? ov.querySelector("#cfClose") : ov.querySelector("#cfText");
    focusEl.focus();
  }
  function close() { ov.hidden = true; btn.focus(); }

  // Le compte réel n'est connu qu'après l'hydratation de sillance-integration.js.
  async function boot() {
    if (!injectUI()) return;
    var tries = 0;
    while (!(window.PF && window.PF.user) && tries++ < 60) await new Promise(function (r) { setTimeout(r, 500); });
    if (!(window.PF && window.PF.user)) return; // démo / déconnecté : pas de fil
    await loadClubs();
    if (!state.clubs.length) return; // aucun club rattaché : bouton jamais affiché
    btn.hidden = false;
    await loadPosts(); refreshDot();
  }

  window.PFFeed = { open: open };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
