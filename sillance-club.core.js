/* ============================================================
   ESPACE SALLE — données démo crédibles (box Hyrox)
   Aucune analyse ici : ops + présences + facturation + offres.
   ============================================================ */
function tr(key, vars){ return window.SilI18n ? SilI18n.t(key, vars) : key; }
let DAYS = [tr('day.sunShort'),tr('day.monShort'),tr('day.tueShort'),tr('day.wedShort'),tr('day.thuShort'),tr('day.friShort'),tr('day.satShort')];
const DCOL = {hyrox:'var(--hyrox)', run:'var(--run)', strength:'var(--strength)', swim:'var(--swim)'};
const DLAB = {hyrox:'Hyrox', get run(){return tr('disc.run')}, get strength(){return tr('club.strengthForce')}, get swim(){return tr('disc.swim')}};
const today = 4; // Jeudi

const OFFERS = [
  {id:'dropin', get name(){return tr('club.offer.dropin.name')}, price:15, unit:'/ séance', feature:false,
   get pitch(){return tr('club.offer.dropin.pitch')},
   get inc(){return [tr('club.offer.dropin.inc1'),tr('club.offer.dropin.inc2'),tr('club.offer.dropin.inc3')]},
   get who(){return tr('club.offer.dropin.who')}},
  {id:'sub', get name(){return tr('clubOffer.sub.name')}, price:59, unit:'/ mois', feature:false,
   get pitch(){return tr('clubOffer.sub.pitch')},
   get inc(){return [tr('clubOffer.sub.inc1'),tr('clubOffer.sub.inc2'),tr('clubOffer.sub.inc3')]},
   get who(){return tr('club.offer.sub.who')}},
  {id:'coach', get name(){return tr('clubOffer.coach.name')}, price:119, unit:'/ mois', feature:true,
   get pitch(){return tr('clubOffer.coach.pitch')},
   get inc(){return [tr('clubOffer.coach.inc1'),tr('club.offer.coach.inc2'),tr('club.offer.coach.inc3'),tr('clubOffer.coach.inc4')]},
   get who(){return tr('club.offer.coach.who')}}
];
const OFFER = id => OFFERS.find(o=>o.id===id);

let SLOTS = [
  {id:'c1', disc:'hyrox', get title(){return tr('slot.c1')}, day:4, time:'19:00', dur:75, coach:'Karim', cap:14, price:0, att:9, inscrits:['m3','m5','m8','m1','m11','m6','m9','m2','m12']},
  {id:'c2', disc:'hyrox', get title(){return tr('slot.c2')}, day:4, time:'12:15', dur:60, coach:'Karim', cap:12, price:0, att:7, inscrits:['m2','m4','m7','m10','m6','m1','m12']},
  {id:'c3', disc:'strength', get title(){return tr('slot.c3')}, day:4, time:'18:00', dur:60, coach:'Julie', cap:16, price:0, att:5, inscrits:['m3','m9','m11','m5','m8']},
  {id:'c4', disc:'hyrox', get title(){return tr('slot.c4')}, day:4, time:'07:00', dur:60, coach:'—', cap:20, price:12, att:4, inscrits:['m4','m7','m10','m2']},
  {id:'c5', disc:'run', get title(){return tr('slot.c5')}, day:2, time:'18:30', dur:75, coach:'Éric', cap:24, price:0, att:13, inscrits:[]},
  {id:'c6', disc:'hyrox', get title(){return tr('slot.c6')}, day:6, time:'10:00', dur:90, coach:'Karim', cap:16, price:18, att:11, inscrits:[]},
];

let MEMBERS = [
  {id:'m1', name:'Thomas R.', offer:'coach', coach:'Karim', att30:11},
  {id:'m2', name:'Léa M.', offer:'sub', coach:'—', att30:8},
  {id:'m3', name:'Sofiane B.', offer:'coach', coach:'Julie', att30:14},
  {id:'m4', name:'Camille D.', offer:'dropin', coach:'—', att30:3},
  {id:'m5', name:'Hugo P.', offer:'sub', coach:'—', att30:9},
  {id:'m6', name:'Inès K.', offer:'coach', coach:'Karim', att30:12},
  {id:'m7', name:'Maxime L.', offer:'dropin', coach:'—', att30:2},
  {id:'m8', name:'Anaïs V.', offer:'sub', coach:'—', att30:7},
  {id:'m9', name:'Yanis T.', offer:'coach', coach:'Julie', att30:13},
  {id:'m10', name:'Claire F.', offer:'sub', coach:'—', att30:6},
  {id:'m11', name:'Romain G.', offer:'sub', coach:'—', att30:10},
  {id:'m12', name:'Sarah N.', offer:'dropin', coach:'—', att30:4},
];
const MEM = id => MEMBERS.find(m=>m.id===id);

let BILLS = [
  {m:'m1', get why(){return tr('billing.coachPlusJune')}, type:'sub', amt:119, ok:true},
  {m:'m3', get why(){return tr('billing.coachPlusJune')}, type:'sub', amt:119, ok:true},
  {m:'m6', get why(){return tr('billing.coachPlusJune')}, type:'sub', amt:119, ok:false},
  {m:'m9', get why(){return tr('billing.coachPlusJune')}, type:'sub', amt:119, ok:true},
  {m:'m2', get why(){return tr('billing.clubSubJune')}, type:'sub', amt:59, ok:true},
  {m:'m5', get why(){return tr('billing.clubSubJune')}, type:'sub', amt:59, ok:true},
  {m:'m8', get why(){return tr('billing.clubSubJune')}, type:'sub', amt:59, ok:true},
  {m:'m10', get why(){return tr('billing.clubSubJune')}, type:'sub', amt:59, ok:false},
  {m:'m11', get why(){return tr('billing.clubSubJune')}, type:'sub', amt:59, ok:true},
  {m:'m4', get why(){return tr('club.openBoxDropin')}, type:'card', amt:12, ok:true},
  {m:'m7', get why(){return tr('club.hyroxDoublesCarte')}, type:'card', amt:18, ok:true},
  {m:'m12', get why(){return tr('club.openBoxDropin')}, type:'card', amt:12, ok:true},
];

const presState = {}; // key slot:member -> 'ok'|'no'

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(t){ const el=$('#toast'); el.textContent=t; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),1900); }
function fillPct(s){ return Math.round(100*s.att/s.cap); }
function discDot(d){ return `<span class="disc" style="background:${DCOL[d]}"></span>`; }
function priceTag(s){ return s.price>0 ? `<span class="tag paid">${s.price} € · ${tr('club.aLaCarte')}</span>` : `<span class="tag free">${tr('clubDash.included')}</span>`; }

/* ---------- TODAY slots (dash) ---------- */
function slotRow(s, withBtn){
  const pct = fillPct(s);
  return `<div class="slot">
    <div class="when"><div class="d os">${s.time.split(':')[0]}<small style="font-size:11px">h${s.time.split(':')[1]}</small></div><div class="t">${DAYS[s.day]}</div></div>
    <div>
      <div class="ti">${discDot(s.disc)}${s.title}</div>
      <div class="me">${DLAB[s.disc]} · coach ${s.coach} · ${s.dur} min · ${tr('clubDash.nRegistered', {n:s.att, cap:s.cap})}</div>
      <div class="fillbar ${pct>=85?'hot':''}"><i style="width:${pct}%"></i></div>
    </div>
    <div style="text-align:right">${priceTag(s)}${withBtn?`<div style="margin-top:9px"><button class="btn sm" data-action="goPres" data-id="${s.id}">${tr('club.nav.pres')} →</button></div>`:''}</div>
  </div>`;
}
function renderToday(){
  const list = SLOTS.filter(s=>s.day===today).sort((a,b)=>a.time.localeCompare(b.time));
  $('#todaySlots').innerHTML = list.length ? list.map(s=>slotRow(s,true)).join('') : `<div class="empty">${tr('club.noSlotToday')}</div>`;
}
function renderAllSlots(){
  const list = [...SLOTS].sort((a,b)=> a.day-b.day || a.time.localeCompare(b.time));
  $('#allSlots').innerHTML = list.map(s=>slotRow(s,true)).join('');
}

/* ---------- mix ---------- */
function renderMix(){
  const counts = OFFERS.map(o=>({o, n:MEMBERS.filter(m=>m.offer===o.id).length}));
  const tot = MEMBERS.length;
  $('#mixWrap').innerHTML = counts.map(({o,n})=>{
    const pct = Math.round(100*n/tot);
    const col = o.id==='coach'?'var(--hyrox)':o.id==='sub'?'var(--accent)':'var(--good)';
    return `<div style="margin-bottom:13px">
      <div class="row" style="justify-content:space-between;font-size:13px"><span><b>${o.name}</b> · ${o.price}€${o.unit.includes('mois')?'/mois':''}</span><span class="muted">${tr(n>1?'club.nMembersPlural':'club.nMembersSingular', {n})} · ${pct}%</span></div>
      <div class="fillbar" style="width:100%;margin-top:6px"><i style="width:${pct}%;background:${col}"></i></div>
    </div>`;
  }).join('') + `<div class="muted" style="font-size:11.5px;margin-top:4px">${tr('clubDash.coachPlusMarginNote')}</div>`;
}

/* ---------- presence ---------- */
let curPres = null;
function renderPresPicker(){
  const list = SLOTS.filter(s=>s.day===today);
  if(!curPres && list[0]) curPres = list[0].id;
  $('#presPicker').innerHTML = list.map(s=>`<button class="${s.id===curPres?'on':''}" data-action="setPres" data-id="${s.id}">${s.time} · ${DLAB[s.disc]}</button>`).join('');
}
function renderPres(){
  renderPresPicker();
  const s = SLOTS.find(x=>x.id===curPres);
  if(!s){ $('#presList').innerHTML = `<div class="empty">${tr('club.noSlotToday')}</div>`; return; }
  const present = s.inscrits.filter(id=>presState[s.id+':'+id]==='ok').length;
  const rows = s.inscrits.map(id=>{
    const m = MEM(id); if(!m) return '';
    const st = presState[s.id+':'+id];
    return `<tr>
      <td><span class="avatar">${m.name[0]}</span> &nbsp;${m.name} <span class="tag ${m.offer==='coach'?'sub':m.offer==='sub'?'free':'paid'}" style="margin-left:6px">${OFFER(m.offer).name}</span></td>
      <td style="text-align:right">
        <button class="pres-btn ${st==='ok'?'ok':''}" data-action="mark" data-sid="${s.id}" data-mid="${id}" data-val="ok">${tr('crd.present')}</button>
        <button class="pres-btn ${st==='no'?'no':''}" data-action="mark" data-sid="${s.id}" data-mid="${id}" data-val="no" style="margin-left:6px">${tr('club.absent')}</button>
      </td></tr>`;
  }).join('');
  $('#presList').innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div><b>${s.title}</b> · ${s.time}</div>
      <div class="muted">${tr('club.nPresent', {n:present, tot:s.inscrits.length})} · ${tr('club.spotsFree', {n:s.cap-s.att})}</div>
    </div>
    <table><tbody>${rows||`<tr><td class="empty">${tr('club.noOneRegisteredYet')}</td></tr>`}</tbody></table>`;
}
function mark(sid,mid,v){ presState[sid+':'+mid]=v; renderPres(); }
function goPres(id){ curPres=id; switchView('pres'); }

/* ---------- billing ---------- */
function renderBill(){
  const tot = BILLS.filter(b=>b.ok).reduce((a,b)=>a+b.amt,0);
  const wait = BILLS.filter(b=>!b.ok).reduce((a,b)=>a+b.amt,0);
  const rec = BILLS.filter(b=>b.type==='sub'&&b.ok).length;
  $('#bTot').textContent = tot+' €'; $('#bWait').textContent = wait+' €'; $('#bRec').textContent = rec;
  $('#billBody').innerHTML = BILLS.map(b=>{
    const m = MEM(b.m);
    return `<tr>
      <td><span class="avatar">${m?m.name[0]:'?'}</span> &nbsp;${m?m.name:'—'}</td>
      <td>${b.why}</td>
      <td>${b.type==='sub'?tr('sidebar.subscribe'):tr('club.aLaCarte')}</td>
      <td><b>${b.amt} €</b></td>
      <td>${b.ok?`<span class="pay ok">${tr('clubBill.paid')}</span>`:`<span class="pay wait">${tr('clubBill.waiting')}</span>`}</td>
    </tr>`;
  }).join('');
}

/* ---------- members ---------- */
function renderMembers(){
  $('#memBody').innerHTML = MEMBERS.map(m=>{
    const o = OFFER(m.offer);
    return `<tr>
      <td><span class="avatar">${m.name[0]}</span> &nbsp;${m.name}</td>
      <td><div class="selpill">${OFFERS.map(of=>`<button class="${of.id===m.offer?'on':''}" data-action="setOffer" data-mid="${m.id}" data-oid="${of.id}">${of.name}</button>`).join('')}</div></td>
      <td>${m.offer==='coach'?(m.coach==='—'?`<span class="muted">${tr('club.toAssign')}</span>`:m.coach):'<span class="muted">—</span>'}</td>
      <td>${tr(m.att30>1?'club.nSessionsPlural':'club.nSessionsSingular', {n:m.att30})}</td>
      <td style="text-align:right"><button class="btn sm ghost" data-action="toastMsg" data-name="${esc(m.name)}">✉︎</button></td>
    </tr>`;
  }).join('');
}
function setOffer(mid,oid){ const m=MEM(mid); m.offer=oid; if(oid!=='coach') m.coach='—'; else if(m.coach==='—') m.coach='Karim';
  renderMembers(); renderMix(); refreshKpis(); toast(`${m.name} → ${OFFER(oid).name}`); }

/* ---------- offers ---------- */
function renderOffers(){
  $('#offersWrap').innerHTML = OFFERS.map(o=>`
    <div class="offer ${o.feature?'feature':''}">
      ${o.feature?`<span class="ribbon">★ ${tr('clubOffres.premiumMargin')}</span>`:''}
      <h3>${o.name}</h3>
      <div class="muted" style="font-size:12.5px">${o.pitch}</div>
      <div class="price">${o.price} €<small> ${o.unit}</small></div>
      <button class="btn sm ghost" data-action="editPrice" data-id="${o.id}">✎ ${tr('clubOffres.editPrice')}</button>
      <ul>${o.inc.map(i=>`<li>${i}</li>`).join('')}</ul>
      <div class="who">${o.who}</div>
    </div>`).join('');
}
function editPrice(id){ const o=OFFER(id); const v=prompt(tr('clubOffres.pricePrompt', {name:o.name}), o.price); if(v!==null && !isNaN(+v)){ o.price=+v; renderOffers(); renderMix(); toast(tr('club.priceUpdated')); } }

/* ---------- KPIs ---------- */
function refreshKpis(){
  const week = SLOTS;
  const avgFill = Math.round(week.reduce((a,s)=>a+fillPct(s),0)/week.length);
  const todayList = SLOTS.filter(s=>s.day===today);
  const todayIns = todayList.reduce((a,s)=>a+s.att,0);
  const rev = BILLS.filter(b=>b.ok).reduce((a,b)=>a+b.amt,0);
  const coachN = MEMBERS.filter(m=>m.offer==='coach').length;
  $('#kFill').textContent = avgFill+'%';
  $('#kPres').textContent = todayIns; $('#kPresD').textContent = tr(todayList.length>1?'club.nSlotsTodayPlural':'club.nSlotsTodaySingular', {n:todayList.length});
  $('#kRev').textContent = rev+' €';
  $('#kMem').textContent = MEMBERS.length; $('#kMemD').textContent = tr('clubDash.nInCoachPlus', {n:coachN});
}

/* ---------- navigation ---------- */
const TITLES = {
  get dash(){return [tr('club.title.dash'),tr('club.sub.dash'),tr('club.action.dash')]},
  get slots(){return [tr('club.nav.slots'),tr('club.sub.slots'),tr('club.action.dash')]},
  get pres(){return [tr('club.nav.pres'),tr('club.pres.hint'),tr('club.action.dash')]},
  get bill(){return [tr('club.nav.bill'),tr('club.sub.bill'),tr('club.action.bill')]},
  get members(){return [tr('club.nav.members'),tr('club.sub.members'),tr('club.action.members')]},
  get offers(){return [tr('club.nav.offers'),tr('club.sub.offers'),tr('club.action.offers')]},
};
let curView = 'dash';
function renderCurrentView(){
  const [t,sub,act] = TITLES[curView];
  $('#viewTitle').innerHTML = t + ` <span class="demoflag">${tr('club.demoFlag')}</span>`;
  $('#viewSub').textContent = sub;
  $('#primaryAction').textContent = act;
  if(curView==='dash'){ renderToday(); renderMix(); }
  if(curView==='pres') renderPres();
  if(curView==='bill') renderBill();
  if(curView==='members') renderMembers();
  if(curView==='offers') renderOffers();
  if(curView==='slots') renderAllSlots();
}
function switchView(v){
  curView = v;
  $$('#nav .nav').forEach(n=>n.classList.toggle('active', n.dataset.v===v));
  $$('section[data-view]').forEach(s=>s.classList.toggle('hide', s.dataset.view!==v));
  renderCurrentView();
  window.scrollTo({top:0,behavior:'smooth'});
}
$$('#nav .nav').forEach(n=> n.onclick = ()=>switchView(n.dataset.v));
document.addEventListener('sil:langchange', ()=>{
  DAYS = [tr('day.sunShort'),tr('day.monShort'),tr('day.tueShort'),tr('day.wedShort'),tr('day.thuShort'),tr('day.friShort'),tr('day.satShort')];
  refreshKpis();
  renderCurrentView();
});
$('#primaryAction').onclick = ()=> toast(tr('club.primaryActionToast'));
$('#renameBtn').onclick = ()=>{ $('#bname').focus(); document.execCommand && document.getSelection().selectAllChildren($('#bname')); };

/* branding live : nom de salle -> initiale du logo (utile pour la prospection) */
$('#bname').addEventListener('input', ()=>{
  const n = $('#bname').textContent.trim();
  $('#blogo').textContent = (n[0]||'B').toUpperCase();
});

/* ---------- gabarit de prospection : ?box=Nom&ville=Ville pré-remplit l'espace ---------- */
(function(){
  const q=new URLSearchParams(location.search);
  const box=q.get('box'), ville=q.get('ville');
  if(box){
    $('#bname').textContent=box;
    $('#blogo').textContent=(box.trim()[0]||'B').toUpperCase();
    document.title=box+tr('club.titleSuffixBookingSpace');
    const r=document.getElementById('prospectRibbon'); if(r){ r.hidden=false; const rb=document.getElementById('ribBox'); if(rb) rb.textContent=box; }
  }
  if(ville) $('#bcity').textContent=ville;
})();

/* ---------- délégation des clics (CSP : plus de onclick= en dur) ---------- */
document.addEventListener('click', function(e){
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const a = el.dataset.action;
  if(a==='closeRibbon') el.parentNode.hidden = true;
  else if(a==='goPres') goPres(el.dataset.id);
  else if(a==='setPres'){ curPres = el.dataset.id; renderPres(); }
  else if(a==='mark') mark(el.dataset.sid, el.dataset.mid, el.dataset.val);
  else if(a==='setOffer') setOffer(el.dataset.mid, el.dataset.oid);
  else if(a==='toastMsg') toast(tr('club.messageSentTo', {name:el.dataset.name}));
  else if(a==='editPrice') editPrice(el.dataset.id);
});

/* ---------- boot ---------- */
refreshKpis(); renderToday(); renderMix();