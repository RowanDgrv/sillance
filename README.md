# PairForm — site (front)

Plateforme de coaching **triathlon / Hyrox / clubs**. Ce dépôt contient le **front**
(HTML + JS autonomes). Le back-end (Supabase + Stripe) vit dans un dépôt séparé.

## Pages

| Fichier | Rôle |
|---|---|
| `apex-tri-calendrier.html` | L'app complète — coach / athlète / club (calendrier, builder de séances, analyse, club & créneaux) |
| `apex-tri-demo-testeurs.html` | Même app, variante « testeurs » |
| `pairform-review.html` | Version **autonome** (sans couche cloud), ouvrable au double-clic |
| `pairform-club.html` | Interface **box Hyrox** (réservations). Gabarit de prospection : `?box=Nom&ville=Ville` |
| `pairform-demo.html` | Page de présentation |
| `pairform-client.js` · `pairform-integration.js` | Couche d'intégration Supabase (optionnelle ; sans clés → **mode démo**) |

## Lancer en local

```bash
python3 -m http.server 5500
# puis http://localhost:5500/pairform-review.html
```

## Déployer

- **Netlify** : glisser le dossier sur https://app.netlify.com/drop
- ou **GitHub Pages** : Settings → Pages → branche `main`

## Statut

Le site tourne sur des **données de démonstration**. Le branchement au back-end
(Supabase / Stripe) se fait en renseignant `SUPABASE_URL` + `ANON_KEY` dans
`pairform-client.js`.
