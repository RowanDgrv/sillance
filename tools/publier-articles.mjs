// =============================================================================
//  tools/publier-articles.mjs — publication programmée des guides (05/11/2026)
//  ---------------------------------------------------------------------------
//  Lancé chaque matin par .github/workflows/publier-articles.yml (et à la main :
//  `node tools/publier-articles.mjs [--date AAAA-MM-JJ] [--dry]`).
//
//  guides/calendrier.json liste les articles et leur date. Les articles en
//  attente sont déjà dans le dépôt mais en noindex et reliés nulle part. Pour
//  le PREMIER article dont la date est arrivée (un seul par jour, pour qu'un
//  retard ne publie pas tout d'un coup) :
//    · retire le noindex, met la date affichée et le JSON-LD au jour J ;
//    · ajoute sa carte en tête de guides/index.html ;
//    · l'ajoute à sitemap.xml ;
//  puis, à chaque passage : liens « À lire aussi » entre articles publiés et
//  flux RSS guides/feed.xml. Écrit les URL publiées dans .publies.txt (lu par
//  l'étape IndexNow du workflow).
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = 'https://sillance.app';
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const dateArg = args.includes('--date') ? args[args.indexOf('--date') + 1] : null;
const today = dateArg || new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateFr = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MOIS[m - 1]} ${y}`; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => { if (!DRY) fs.writeFileSync(path.join(ROOT, p), s); };

const calPath = 'guides/calendrier.json';
const cal = JSON.parse(read(calPath));
const published = [];

// 1) publication du premier article arrivé à échéance
const due = cal.filter((a) => !a.publie && a.date <= today).sort((a, b) => a.date.localeCompare(b.date))[0];
if (due) {
  const p = `guides/${due.slug}/index.html`;
  let s = read(p);
  s = s.replace(/\n?<meta name="robots" content="noindex, follow" data-auto="file-attente">/, '');
  s = s.replace(/("datePublished": ")[0-9-]+(")/, `$1${today}$2`).replace(/("dateModified": ")[0-9-]+(")/, `$1${today}$2`);
  s = s.replace(/(<div class="meta">Par Rowan Degraeve · )[^·<]+( ·)/, `$1${dateFr(today)}$2`);
  write(p, s);

  let hub = read('guides/index.html');
  const card = `      <a class="card" href="${due.slug}/"><span class="kicker">${esc(due.theme)}</span><h3 style="margin-top:8px">${esc(due.titre)}</h3><p>${esc(due.resume)}</p></a>\n`;
  if (!hub.includes(`href="${due.slug}/"`)) hub = hub.replace('<!-- articles:auto -->\n', `<!-- articles:auto -->\n${card}`);
  write('guides/index.html', hub);

  let sm = read('sitemap.xml');
  const loc = `${SITE}/guides/${due.slug}/`;
  if (!sm.includes(loc)) sm = sm.replace('</urlset>', `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n</urlset>`);
  sm = sm.replace(/(<loc>https:\/\/sillance\.app\/guides\/<\/loc><lastmod>)[0-9-]+/, `$1${today}`);
  write('sitemap.xml', sm);

  due.publie = today;
  published.push(loc);
  write(calPath, JSON.stringify(cal, null, 1) + '\n');
  console.log(`Publié : ${due.slug} (${today})`);
} else {
  console.log(`Rien à publier le ${today}.`);
}

// 2) « À lire aussi » : 3 articles publiés, même thème d'abord, puis les plus récents
const live = cal.filter((a) => a.publie);
for (const a of live) {
  const others = live.filter((b) => b.slug !== a.slug)
    .sort((x, y) => (y.theme === a.theme) - (x.theme === a.theme) || y.publie.localeCompare(x.publie))
    .slice(0, 3);
  const block = others.length
    ? `<!-- lies:start --><h2>À lire aussi</h2>\n<ul>${others.map((b) => `<li><a href="../${b.slug}/">${esc(b.titre)}</a></li>`).join('')}</ul>\n<!-- lies:end -->`
    : '<!-- lies:start --><!-- lies:end -->';
  const p = `guides/${a.slug}/index.html`;
  const s = read(p);
  const n = s.replace(/<!-- lies:start -->[\s\S]*?<!-- lies:end -->/, block);
  if (n !== s) write(p, n);
}

// 2 bis) accueil : les 3 derniers guides publiés (maillage interne depuis la page la plus forte)
{
  const last = [...live].sort((x, y) => y.publie.localeCompare(x.publie)).slice(0, 3);
  const html = last.length
    ? `<!-- derniers-guides:start --><p class="seo-links">Derniers guides : ${last.map((x) => `<a href="./guides/${x.slug}/">${esc(x.titre)}</a>`).join(' · ')}.</p><!-- derniers-guides:end -->`
    : '<!-- derniers-guides:start --><!-- derniers-guides:end -->';
  const s = read('index.html');
  const n = s.replace(/<!-- derniers-guides:start -->[\s\S]*?<!-- derniers-guides:end -->/, html);
  if (n !== s) write('index.html', n);
}

// 2 ter) calculateurs : « Pour aller plus loin » vers les articles publiés du même sujet
for (const t of ['calcul-css-natation', 'allures-vma', 'zones-puissance-ftp', 'prediction-temps-course', 'zones-frequence-cardiaque', 'convertisseur-allure-vitesse'].map((x) => `outils/${x}/index.html`)) {
  const s = read(t);
  const n = s.replace(/<!-- outil-lies:([a-z0-9,-]+) -->[\s\S]*?<!-- \/outil-lies -->/, (all, list) => {
    const pub = list.split(',').map((sl) => live.find((x) => x.slug === sl)).filter(Boolean);
    const inner = pub.length
      ? `<section class="block"><div class="wrap"><span class="kicker">Pour aller plus loin</span><h2>Ce que disent <em>les études</em></h2><ul>${pub.map((x) => `<li><a href="../../guides/${x.slug}/">${esc(x.titre)}</a></li>`).join('')}</ul></div></section>`
      : '';
    return `<!-- outil-lies:${list} -->${inner}<!-- /outil-lies -->`;
  });
  if (n !== s) write(t, n);
}

// 3) flux RSS des articles publiés
const items = [...live].sort((a, b) => b.publie.localeCompare(a.publie)).map((a) => `  <item>
    <title>${esc(a.titre)}</title>
    <link>${SITE}/guides/${a.slug}/</link>
    <guid isPermaLink="true">${SITE}/guides/${a.slug}/</guid>
    <pubDate>${new Date(a.publie + 'T07:00:00+01:00').toUTCString()}</pubDate>
    <description>${esc(a.resume)}</description>
  </item>`).join('\n');
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Sillance · Guides d'entraînement</title>
  <link>${SITE}/guides/</link>
  <atom:link href="${SITE}/guides/feed.xml" rel="self" type="application/rss+xml"/>
  <description>La science de l'entraînement en endurance, expliquée simplement, par Rowan Degraeve.</description>
  <language>fr-FR</language>
${items}
</channel>
</rss>
`;
write('guides/feed.xml', rss);

if (!DRY) fs.writeFileSync(path.join(ROOT, '.publies.txt'), published.join('\n'));
