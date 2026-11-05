//#region src/auth-textures.js
var e = {
	paper: "#0B1120",
	panel: "#121A2B",
	line: "#22304A",
	text: "#F3F6FC",
	muted: "#8A93A8",
	swim: "#46C2D8",
	bike: "#FFC400",
	run: "#FF9A3D",
	strength: "#9B8CFF"
}, t = null;
function n(e) {
	t = e;
}
function r(e, t, n, r, i, a) {
	e.beginPath(), e.roundRect(t, n, r, i, a);
}
function i(e, t, n) {
	let r = document.createElement("canvas");
	return r.width = e, r.height = t, n(r.getContext("2d"), e, t), r;
}
function a(t, n, r, i, a = 1) {
	let o = i * .5;
	t.save(), t.globalAlpha = a, t.lineWidth = i * .08, t.strokeStyle = e.swim, t.globalAlpha = .6 * a, t.beginPath(), t.arc(n - o, r, i, 0, 7), t.stroke(), t.strokeStyle = e.run, t.beginPath(), t.arc(n + o, r, i, 0, 7), t.stroke(), t.globalAlpha = a;
	let s = t.createLinearGradient(n - o, 0, n + o, 0);
	s.addColorStop(0, e.swim), s.addColorStop(1, e.run), t.fillStyle = s, t.beginPath(), t.arc(n - o, r, i, -Math.acos(o / i), Math.acos(o / i)), t.arc(n + o, r, i, Math.PI - Math.acos(o / i), Math.PI + Math.acos(o / i)), t.fill(), t.restore();
}
var o = () => i(1600, 1e3, (t, n, i) => {
	t.fillStyle = e.paper, t.fillRect(0, 0, n, i), t.fillStyle = e.panel, t.fillRect(0, 0, 230, i), a(t, 62, 62, 26), t.fillStyle = e.text, t.font = "700 34px Oswald", t.fillText("SILLANCE", 100, 74), [
		"Planning",
		"Athlètes",
		"Bibliothèque",
		"Analyses",
		"Club"
	].forEach((n, i) => {
		i === 0 && (t.fillStyle = "rgba(70,194,216,.14)", r(t, 18, 128 + i * 62, 194, 46, 10), t.fill()), t.fillStyle = i === 0 ? e.swim : e.muted, t.font = "500 22px Archivo", t.fillText(n, 40, 159 + i * 62);
	}), t.fillStyle = e.text, t.font = "600 44px Oswald", t.fillText("PLANNING · SEMAINE 46", 270, 78), t.fillStyle = e.muted, t.font = "500 20px \"JetBrains Mono\"", t.fillText("9 → 15 NOV · 4 ATHLÈTES", 272, 112), t.fillStyle = e.swim, r(t, n - 250, 44, 200, 50, 10), t.fill(), t.fillStyle = "#06222a", t.font = "600 21px Archivo", t.fillText("+ Nouvelle séance", n - 232, 77);
	let o = [
		"LUN",
		"MAR",
		"MER",
		"JEU",
		"VEN",
		"SAM",
		"DIM"
	], s = (n - 420 - 40) / 7, c = [
		"Léa M.",
		"Hugo R.",
		"Inès T.",
		"Malo B."
	];
	o.forEach((n, r) => {
		t.fillStyle = r === 2 ? e.swim : e.muted, t.font = "600 20px \"JetBrains Mono\"", t.fillText(n, 420 + r * s + 14, 156);
	});
	let l = [
		[
			[
				"swim",
				"Seuil 10×200",
				62
			],
			[
				"run",
				"Footing Z2",
				40
			],
			0,
			[
				"bike",
				"Sweet spot",
				88
			],
			[
				"swim",
				"Technique",
				35
			],
			[
				"bike",
				"Sortie longue",
				140
			],
			[
				"run",
				"Sortie longue",
				95
			]
		],
		[
			[
				"run",
				"VMA 10×400",
				70
			],
			0,
			[
				"bike",
				"Home trainer",
				55
			],
			[
				"run",
				"Tempo 3×10",
				75
			],
			0,
			[
				"run",
				"Trail",
				120
			],
			[
				"swim",
				"Récup",
				30
			]
		],
		[
			[
				"bike",
				"PMA 5×4",
				80
			],
			[
				"swim",
				"Endurance",
				45
			],
			[
				"run",
				"Côtes",
				60
			],
			0,
			[
				"bike",
				"Z2",
				65
			],
			[
				"swim",
				"Eau libre",
				50
			],
			0
		],
		[
			[
				"strength",
				"Renfo",
				35
			],
			[
				"run",
				"Footing",
				45
			],
			[
				"bike",
				"Seuil 2×20",
				90
			],
			[
				"swim",
				"Vitesse",
				40
			],
			[
				"run",
				"Fractionné",
				65
			],
			0,
			[
				"bike",
				"Longue Z2",
				160
			]
		]
	];
	c.forEach((i, a) => {
		let o = 180 + a * 200;
		t.strokeStyle = e.line, t.lineWidth = 2, t.beginPath(), t.moveTo(250, o - 8), t.lineTo(n - 40, o - 8), t.stroke(), t.fillStyle = "#22304A", t.beginPath(), t.arc(290, o + 60, 26, 0, 7), t.fill(), t.fillStyle = e.text, t.font = "600 20px Archivo", t.textAlign = "center", t.fillText(i.split(" ").map((e) => e[0]).join(""), 290, o + 67), t.textAlign = "left", t.fillStyle = e.text, t.font = "500 22px Archivo", t.fillText(i, 328, o + 56), t.fillStyle = e.muted, t.font = "500 16px \"JetBrains Mono\"", t.fillText("CTL " + (48 + a * 9), 328, o + 82), l[a].forEach((n, i) => {
			if (!n) return;
			let [c, l, u] = n, d = 420 + i * s + 8, f = s - 16;
			t.fillStyle = e.panel, r(t, d, o, f, 170, 12), t.fill(), t.fillStyle = e[c], r(t, d, o, 7, 170, [
				12,
				0,
				0,
				12
			]), t.fill(), t.fillStyle = e.text, t.font = "600 19px Archivo", t.fillText(l.length > 13 ? l.slice(0, 12) + "…" : l, d + 18, o + 34), t.fillStyle = e.muted, t.font = "500 15px \"JetBrains Mono\"", t.fillText(u + " TSS", d + 18, o + 60);
			for (let n = 0; n < 9; n++) {
				let s = .25 + .75 * Math.abs(Math.sin((n + 1) * (i + 2) * (a + 1) * .7));
				t.fillStyle = e[c], t.globalAlpha = .35 + .5 * s;
				let l = s * 60;
				r(t, d + 18 + n * ((f - 36) / 9), o + 200 - 48 - l, (f - 36) / 9 - 4, l, 3), t.fill(), t.globalAlpha = 1;
			}
		});
	});
}), s = () => i(600, 1260, (t, n, i) => {
	t.save(), r(t, 0, 0, n, i, 78), t.clip(), t.fillStyle = e.paper, t.fillRect(0, 0, n, i), t.fillStyle = e.text, t.font = "600 26px Archivo", t.fillText("7:42", 58, 62), t.fillStyle = "#000", r(t, n / 2 - 90, 24, 180, 52, 26), t.fill(), t.fillStyle = e.text, r(t, n - 112, 42, 46, 22, 6), t.fill(), a(t, 72, 148, 22), t.fillStyle = e.muted, t.font = "500 20px \"JetBrains Mono\"", t.fillText("NOVEMBRE 2026", 110, 155), t.fillStyle = e.text, t.font = "600 54px Oswald", t.fillText("MA SEMAINE", 44, 232);
	let o = [
		"L",
		"M",
		"M",
		"J",
		"V",
		"S",
		"D"
	], s = (n - 60) / 7;
	o.forEach((n, i) => {
		let a = 30 + s * i + s / 2, o = i === 2;
		o && (t.fillStyle = e.swim, r(t, a - 30, 262, 60, 92, 18), t.fill()), t.fillStyle = o ? "#06222a" : e.muted, t.font = "600 20px Archivo", t.textAlign = "center", t.fillText(n, a, 296), t.fillStyle = o ? "#06222a" : e.text, t.font = "600 28px Oswald", t.fillText(String(9 + i), a, 336);
		let c = [
			["swim", "run"],
			["run"],
			["bike", "swim"],
			["run"],
			["swim"],
			["bike"],
			["run"]
		][i];
		o || c.forEach((n, r) => {
			t.fillStyle = e[n], t.beginPath(), t.arc(a - 6 * (c.length - 1) + r * 12, 350, 4, 0, 7), t.fill();
		});
	}), t.textAlign = "left", t.fillStyle = e.muted, t.font = "500 19px \"JetBrains Mono\"", t.fillText("AUJOURD'HUI · MER 11", 44, 410);
	let c = (i, a, o, s, c, l = 210) => {
		t.fillStyle = e.panel, r(t, 36, i, n - 72, l, 26), t.fill(), t.fillStyle = e[a], r(t, 36, i, 10, l, [
			26,
			0,
			0,
			26
		]), t.fill(), t.fillStyle = e.text, t.font = "600 32px Archivo", t.fillText(o, 72, i + 56), t.fillStyle = e.muted, t.font = "500 20px \"JetBrains Mono\"", t.fillText(s, 72, i + 92), c && (t.fillStyle = "rgba(53,197,140,.16)", r(t, n - 200, i + 28, 128, 40, 20), t.fill(), t.fillStyle = "#35C58C", t.font = "600 18px Archivo", t.fillText("✓ Réalisé", n - 180, i + 55));
		for (let o = 0; o < 14; o++) {
			let s = a === "bike" ? o > 3 && o < 11 && o % 2 ? .95 : .4 : .3 + .6 * Math.abs(Math.sin(o * .9));
			t.fillStyle = e[a], t.globalAlpha = .35 + .55 * s;
			let c = s * 72;
			r(t, 72 + o * ((n - 180) / 14), i + l - 24 - c, (n - 180) / 14 - 6, c, 4), t.fill(), t.globalAlpha = 1;
		}
	};
	c(432, "bike", "Sweet spot 3×12", "1H20 · 88 TSS", !0), c(664, "swim", "Technique + 8×100", "45 MIN · 2,4 KM", !1), t.fillStyle = e.muted, t.font = "500 19px \"JetBrains Mono\"", t.fillText("DEMAIN · JEU 12", 44, 920), c(942, "run", "Tempo 3×10 min", "1H05 · 12 KM", !1, 190), t.fillStyle = "rgba(18,26,43,.96)", t.fillRect(0, i - 120, n, 120), [
		"Semaine",
		"Analyses",
		"Coach",
		"Profil"
	].forEach((r, a) => {
		t.fillStyle = a === 0 ? e.swim : e.muted, t.font = "600 19px Archivo", t.textAlign = "center", t.fillText(r, n / 8 + a * n / 4, i - 58);
	}), t.textAlign = "left", t.fillStyle = e.text, t.globalAlpha = .5, r(t, n / 2 - 80, i - 24, 160, 8, 4), t.fill(), t.globalAlpha = 1, t.restore();
}), c = {
	swim: "Natation",
	bike: "Vélo",
	run: "Course"
}, l = () => i(1300, 820, (n, i, o) => {
	let s = t.font === "Anton" ? "400 {s}px Anton" : "700 {s}px Oswald", l = (e) => s.replace("{s}", e);
	n.save(), r(n, 0, 0, i, o, 48), n.clip(), n.fillStyle = "#F3F6FC", n.fillRect(0, 0, i, o), n.fillStyle = t.head || t.bg, n.fillRect(0, 0, i, 150);
	let u = n.createLinearGradient(0, 0, i, 0);
	u.addColorStop(0, t.accent), u.addColorStop(1, t.accent2), n.fillStyle = u, n.fillRect(0, 150, i, 10), n.fillStyle = "#F3F6FC", n.font = l(50), n.fillText((t.header || "Licence").toUpperCase(), 70, 96), n.textAlign = "right", n.font = l(40), n.fillText("2026 – 2027", i - 70, 96), n.textAlign = "left", t.initials ? (n.fillStyle = t.badgeBg || "#000", n.beginPath(), n.arc(200, 380, 130, 0, 7), n.fill(), n.fillStyle = t.badgeInk || "#fff", n.font = `400 ${t.initials.length > 2 ? 88 : 112}px Anton`, n.textAlign = "center", n.fillText(t.initials, 200, 420), n.textAlign = "left") : a(n, 200, 380, 92), n.fillStyle = "#0B1120", n.font = l(78);
	let d = t.name.toUpperCase().split(" "), f = "", p = [];
	d.forEach((e) => {
		let t = f ? f + " " + e : e;
		n.measureText(t).width > 560 && f ? (p.push(f), f = e) : f = t;
	}), p.push(f), p.forEach((e, t) => n.fillText(e, 390, 300 + t * 84)), t.short && (n.fillStyle = "#6B7585", n.font = "500 24px \"JetBrains Mono\"", n.fillText(t.short.toUpperCase(), 392, 300 + p.length * 84 - 18)), t.discs.forEach((t, i) => {
		let a = 392 + i * 190;
		n.fillStyle = e[t], r(n, a, 560, 172, 50, 25), n.fill(), n.fillStyle = "#0B1120", n.font = "600 23px Archivo", n.textAlign = "center", n.fillText(c[t], a + 86, 593), n.textAlign = "left";
	});
	let m = i - 250, h = 180 / 21;
	n.fillStyle = "#fff", r(n, m - 14, 506, 208, 208, 14), n.fill(), n.fillStyle = "#0B1120";
	let g = 42, _ = () => (g = g * 16807 % 2147483647) / 2147483647, v = (e, t) => {
		let n = e >= 14 ? e - 14 : e, r = t >= 14 ? t - 14 : t;
		return n === 0 || n === 6 || r === 0 || r === 6 || n >= 2 && n <= 4 && r >= 2 && r <= 4;
	};
	for (let e = 0; e < 21; e++) for (let t = 0; t < 21; t++) (e < 7 && t < 7 || e < 7 && t >= 14 || e >= 14 && t < 7 ? v(e, t) : _() > .52) && n.fillRect(m + t * h, 520 + e * h, h, h);
	n.fillStyle = t.head || t.bg, n.fillRect(0, o - 64, i, 64), n.fillStyle = t.accent, n.font = "600 22px \"JetBrains Mono\"", n.fillText("LICENCE CLUB · VALIDE JUSQU'AU 31/08/2027", 70, o - 24), n.restore();
});
//#endregion
export { e as C, l as cardCanvas, i as makeCanvas, s as phoneCanvas, o as planningCanvas, r as rr, n as setClub };
