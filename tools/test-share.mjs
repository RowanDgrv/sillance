// Tests de « Partager ma séance » : masquage du tracé, projection, chiffres affichés.
// Lancer : node tools/test-share.mjs
import assert from 'node:assert/strict';
import '../sillance-share.js';
const C = globalThis.SilShareCore;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

// Ligne droite vers le nord : un point tous les ~11,1 m (0,0001° de latitude).
const line = (pts, lat0 = 48.85, lon0 = 2.35) => Array.from({ length: pts }, (_, i) => [lat0 + i * 0.0001, lon0]);
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

t('distance entre deux points', () => { near(C.haversineM([48.85, 2.35], [48.86, 2.35]), 1112, 3); });
t('masquage : 300 m retirés au début et à la fin', () => {
  const tr = line(200);                              // ≈ 2 213 m
  const m = C.maskTrack(tr);
  assert.equal(m.ok, true);
  near(C.haversineM(tr[0], m.track[0]), 300, 12);    // le 1er point gardé est à ≥ 300 m du départ
  assert.ok(C.haversineM(tr[0], m.track[0]) >= 300);
  assert.ok(C.haversineM(tr[tr.length - 1], m.track[m.track.length - 1]) >= 300);
  near(m.lengthM, C.trackLengthM(tr) - 600, 25);
});
t('masquage : le départ et l’arrivée ne sont jamais dans le tracé partagé', () => {
  const tr = line(200), m = C.maskTrack(tr);
  assert.ok(!m.track.some(p => p[0] === tr[0][0]) && !m.track.some(p => p[0] === tr[199][0]));
});
t('tracé trop court après masquage : pas d’export', () => {
  const m = C.maskTrack(line(80));                   // ≈ 880 m → il resterait ≈ 280 m
  assert.equal(m.ok, false); assert.equal(m.reason, 'too_short');
});
t('pas de GPS ou GPS invalide : pas d’export, pas d’erreur', () => {
  assert.equal(C.maskTrack(null).ok, false);
  assert.equal(C.maskTrack([]).reason, 'no_gps');
  assert.equal(C.maskTrack([[0, 0], [0, 0], [NaN, 2], [95, 2], null, [48.85]]).ok, false);
  assert.equal(C.eligible({ pts: [] }), false);
  assert.equal(C.eligible(null), false);
});
t('points invalides ignorés au milieu d’un tracé valide', () => {
  const tr = line(200); tr.splice(50, 0, [0, 0], [NaN, NaN], [200, 2]);
  assert.equal(C.maskTrack(tr).ok, true); assert.equal(C.cleanTrack(tr).length, 200);
});
t('projection : dans le cadre, centrée, proportions conservées', () => {
  const box = { x: 100, y: 200, w: 800, h: 600 };
  // rectangle de 1 km (est-ouest) × 2 km (nord-sud) à Paris
  const dLat = 2000 / 111320, dLon = 1000 / (111320 * Math.cos(48.85 * Math.PI / 180));
  const p = C.projectTrack([[48.85, 2.35], [48.85 + dLat, 2.35], [48.85 + dLat, 2.35 + dLon], [48.85, 2.35 + dLon]], box);
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  assert.ok(Math.min(...xs) >= box.x - 0.01 && Math.max(...xs) <= box.x + box.w + 0.01);
  assert.ok(Math.min(...ys) >= box.y - 0.01 && Math.max(...ys) <= box.y + box.h + 0.01);
  near(h / w, 2, 0.02);                              // 2 km de haut pour 1 km de large : jamais déformé
  near(h, box.h, 0.01);                              // remplit la dimension limitante
  near((Math.min(...xs) + Math.max(...xs)) / 2, box.x + box.w / 2, 0.5);   // centré
  assert.ok(p[1][1] < p[0][1]);                      // le nord est en haut
});
t('projection : tracé vide ou d’un seul point', () => { assert.deepEqual(C.projectTrack([], { x: 0, y: 0, w: 10, h: 10 }), []); assert.deepEqual(C.projectTrack([[1, 1]], { x: 0, y: 0, w: 10, h: 10 }), []); });
t('chiffres course : distance, durée, allure, D+ repris de la séance', () => {
  const s = C.buildStats({ disc: 'run', dist: 10.02, dplus: 86.4, pts: [{ t: 0 }, { t: 25 }, { t: 48.5 }] });
  assert.equal(s.dist, '10,02 km'); assert.equal(s.time, '48:30'); assert.equal(s.pace, '4:50 /km'); assert.equal(s.dplus, '86 m'); assert.equal(s.paceLabel, 'Allure');
});
t('chiffres vélo : vitesse en km/h, durée de plus d’une heure', () => {
  const s = C.buildStats({ disc: 'bike', dist: 62.4, dplus: 540, pts: [{ t: 0 }, { t: 125 }] });
  assert.equal(s.pace, '30,0 km/h'); assert.equal(s.time, '2:05:00'); assert.equal(s.paceLabel, 'Vitesse');
});
t('chiffres absents : rien d’inventé', () => {
  const s = C.buildStats({ disc: 'run', dist: 0, pts: [{ t: 0 }, { t: 30 }] });
  assert.equal(s.dist, null); assert.equal(s.pace, null); assert.equal(s.time, '30:00');
  const e = C.buildStats(null); assert.equal(e.dist, null); assert.equal(e.time, null);
});
t('modèles déclarés, chacun avec ses chiffres', () => {
  assert.deepEqual(Object.keys(C.TEMPLATES), ['full', 'minimal', 'stats', 'splits', 'cardio', 'profil', 'intervals', 'coach']);
  assert.deepEqual(C.TEMPLATES.minimal.keys, ['dist', 'pace']); assert.ok(!C.TEMPLATES.stats.keys.includes('dplus'));
});
// 10,5 km à allure régulière de 5:00/km, un point toutes les 6 s (20 m)
const steady = (km, secPerKm = 300) => { const pts = []; for (let d = 0; d <= km * 1000 + 0.001; d += 20) pts.push({ t: d / 1000 * secPerKm / 60, _cum: d / 1000, hr: 150, alt: 100 }); return { disc: 'run', dist: km, dplus: 0, pts }; };
t('temps au km : un par kilomètre, plus la fin de course', () => {
  const sp = C.splits(steady(10.5));
  assert.equal(sp.length, 11); assert.equal(sp[0].label, '1'); assert.equal(sp[9].label, '10');
  sp.slice(0, 10).forEach(s => { near(s.sec, 300, 0.5); assert.equal(s.partial, false); });
  assert.equal(sp[10].partial, true); near(sp[10].km, 0.5, 0.01); near(sp[10].sec, 300, 0.5);   // allure au km, pas le temps brut du demi-kilomètre
});
t('temps au km : un kilomètre plus lent est bien plus long', () => {
  const d = steady(5); d.pts.forEach(p => { if (p._cum > 2) p.t += (Math.min(p._cum, 3) - 2) * 1; });   // +1 min sur le 3e km
  const sp = C.splits(d); near(sp[1].sec, 300, 0.5); near(sp[2].sec, 360, 0.5); near(sp[3].sec, 300, 0.5);
});
t('temps au km : tranches de 5 km sur une sortie longue, rien sans distance', () => {
  assert.equal(C.splits(steady(42)).length, 9); assert.equal(C.splits(steady(42))[0].label, '5');
  assert.deepEqual(C.splits(steady(1.2)), []); assert.deepEqual(C.splits({ pts: [{ t: 0 }, { t: 30 }] }), []); assert.deepEqual(C.splits(null), []);
});
t('modèles proposés seulement si la donnée existe', () => {
  const withAll = C.makeState(steady(10.5), { ok: true, track: [[1, 1], [1.01, 1.01]] }, {});
  assert.ok(C.available('full', withAll) && C.available('splits', withAll) && C.available('cardio', withAll));
  assert.equal(C.available('profil', withAll), false);               // parcours plat : pas de profil
  const d = steady(10.5); d.pts.forEach(p => { p.hr = 0; });
  const noHrNoGps = C.makeState(d, null, {});
  assert.equal(C.available('cardio', noHrNoGps), false); assert.equal(C.available('full', noHrNoGps), false); assert.ok(C.available('stats', noHrNoGps));
  assert.equal(withAll.hrAvg, 150); assert.equal(withAll.hrMax, 150);
});
t('prévu / réalisé : durée, distance et allure du coach face au réalisé', () => {
  const r = C.planRows({ dur: 50, dist: 10 }, steady(10.5));     // 10,5 km en 52:30
  assert.deepEqual(r.map(x => x.k), ['time', 'dist', 'pace']);
  assert.equal(r[0].p, '50:00'); assert.equal(r[0].r, '52:30');
  assert.equal(r[1].p, '10,0 km'); assert.equal(r[1].r, '10,5 km');
  assert.equal(r[2].p, '5:00 /km'); assert.equal(r[2].r, '5:00 /km');
});
t('prévu / réalisé : rien d’inventé quand le coach n’a pas prévu la distance', () => {
  const r = C.planRows({ dur: 45 }, steady(8));
  assert.deepEqual(r.map(x => x.k), ['time']);                  // pas de distance ni d'allure prévues
  assert.deepEqual(C.planRows(null, steady(8)), []); assert.deepEqual(C.planRows({}, steady(8)), []);
});
t('mot du coach : proposé seulement s’il existe et si l’athlète le montre', () => {
  assert.equal(C.available('coach', C.makeState(steady(5), null, { note: 'Bravo', showNote: false })), false);
  assert.ok(C.available('coach', C.makeState(steady(5), null, { note: 'Bravo', showNote: true })));
  assert.equal(C.available('coach', C.makeState(steady(5), null, { note: '', showNote: true })), false);
  assert.equal(C.decode('Tiens l&#39;allure &amp; &lt;b&gt;relâche&lt;/b&gt;'), "Tiens l'allure & relâche");
});
t('partage sans GPS : possible dès qu’il y a une durée réelle', () => {
  assert.ok(C.shareable(steady(3))); assert.equal(C.shareable({ pts: [{ t: 0 }] }), false); assert.equal(C.shareable(null), false);
  const S = C.makeState(steady(3), { ok: false, track: [[1, 1], [2, 2]] }, {});
  assert.equal(S.track.length, 0); assert.equal(C.available('full', S), false);   // tracé refusé = jamais dessiné
});
// Séance du coach : 10' échauffement, 5 × (1000 m à 3'25"–3'35" / 2' récup), 10' retour au calme
const blocks = [
  { series: 1, lines: [{ type: 'warmup', metric: 'time', dur: { m: 10 } }] },
  { series: 5, lines: [{ type: 'exo', metric: 'dist', dist: 1000, mode: 'exact', exact: { kind: 'pace', m: 3, s: 30, tol: 5 } }, { type: 'recov', metric: 'time', dur: { m: 2 } }] },
  { series: 1, lines: [{ type: 'cooldown', metric: 'time', dur: { m: 10 } }] },
];
const exact = ln => ln.mode === 'exact' && ln.exact.kind === 'pace' ? { unit: 'pace', lo: 205, hi: 215 } : null;
const lap = (km, min, hr = 150) => ({ dist: km, durMin: min, avgHr: hr, avgSpeed: km / (min / 60), t0: 0, t1: min });
const reel = (paces, extra = []) => ({ disc: 'run', realLaps: true, laps: [lap(2.1, 10), ...paces.flatMap(p => [lap(1.0, p / 60, 170), lap(0.35, 2)]), lap(2, 10), ...extra] });
t('intervalles : les étapes du coach dans l’ordre vécu par la montre', () => {
  const st = C.planSteps(blocks, exact);
  assert.equal(st.length, 12); assert.equal(st.filter(x => x.work).length, 5);
  assert.equal(st[1].distM, 1000); assert.deepEqual(st[1].target, { unit: 'pace', lo: 205, hi: 215 }); assert.equal(st[2].work, false);
});
t('intervalles : chaque 1000 m face à sa cible', () => {
  const iv = C.matchIntervals(C.planSteps(blocks, exact), reel([208, 205, 212, 219, 201]));
  assert.equal(iv.title, '5 × 1 km'); assert.equal(iv.reps.length, 5);
  assert.deepEqual(iv.reps.map(r => r.verdict), ['in', 'in', 'in', 'high', 'low']);   // 3'39 trop lent, 3'21 trop vite
  assert.equal(iv.inCount, 3); assert.equal(C.fmtTarget(iv.target), '3\'25"–3\'35" /km');
});
t('intervalles : un tour fantôme à la fin est ignoré', () => {
  assert.ok(C.matchIntervals(C.planSteps(blocks, exact), reel([208, 208, 208, 208, 208], [lap(0.02, 0.2)])));
});
t('intervalles : refus quand la montre ne colle pas au plan (rien d’attribué au hasard)', () => {
  const st = C.planSteps(blocks, exact);
  assert.equal(C.matchIntervals(st, { ...reel([208, 208, 208, 208]), }), null);                 // une répétition manquante
  const d = reel([208, 208, 208, 208, 208]); d.laps[3] = lap(1.6, 5.5);                           // « 1000 m » de 1,6 km
  assert.equal(C.matchIntervals(st, d), null);
  assert.equal(C.matchIntervals(st, { ...reel([208, 208, 208, 208, 208]), realLaps: false }), null);   // découpage auto au km
});
t('intervalles : sans cible chiffrée, pas de verdict inventé', () => {
  const iv = C.matchIntervals(C.planSteps(blocks, () => null), reel([208, 205, 212, 219, 201]));
  assert.equal(iv.scored, false); assert.ok(iv.reps.every(r => r.verdict === null)); near(iv.avg, 209, 0.01);
});
t('courbe cardio : lissée, dans le temps, rien sans capteur', () => {
  const c = C.hrCurve(steady(6)); assert.ok(c.length >= 20 && c.length <= 260); near(c[0][1], 150, 0.01);
  const d = steady(6); d.pts.forEach(p => { p.hr = 0; }); assert.deepEqual(C.hrCurve(d), []);
});
console.log(`\n${n} tests passés`);
