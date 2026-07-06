# Sillance — Runbook de mise en ligne

*État au 02/07/2026. Ce doc reflète l'état RÉEL (audité), pas un plan théorique.*

## ✅ Déjà fait
- **Base de données** : 25 tables + RLS active partout (Supabase `onbsgohvqejccowfnrbs`, région UE).
- **Auth** : configurée (site_url + redirect localhost:5500, confirmation email réactivée = prod-safe).
- **Front branché** : login / inscription / lecture-écriture testés OK en local.
- **3 edge functions déployées et fonctionnelles** (aucune clé externe requise) : `accept-invite`, `video-url`, `invite-athlete`.
- **Rebrand Sillance** complet (front sur branche `rebrand-sillance`).

## 🔑 Le déblocage : déploiement SANS CLI
Pas besoin d'installer supabase CLI ni deno. Tout passe par l'**API de gestion** avec un **personal access token** (`sbp_…`, générable sur supabase.com/dashboard/account/tokens) :
- Déployer une fonction : `POST https://api.supabase.com/v1/projects/{ref}/functions/deploy?slug=X` (multipart : `metadata` JSON + `file`).
- Exécuter du SQL : `POST /v1/projects/{ref}/database/query`.
- Poser des secrets : `POST /v1/projects/{ref}/secrets`.
→ **Dès que tu fournis les clés ci-dessous, je déploie le reste en une passe.**

## ⏳ Ce qui reste — groupé par clé à obtenir

| Groupe | Fonctions à déployer | Clés / secrets nécessaires | Où les obtenir |
|---|---|---|---|
| **Stripe** (paiements) | stripe-checkout, stripe-portal, stripe-webhook, club-subscribe, club-connect, coach-subscribe, coach-connect, ai-addon-subscribe, creneau-checkout | `STRIPE_SECRET_KEY`, price IDs, webhook secret, `PLATFORM_FEE_PERCENT` | dashboard.stripe.com (créer 3 produits + activer Connect Express) |
| **Assistant IA** | session-summary | `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`, `AI_ADDON_PRICE_EUR`) | console.anthropic.com |
| **Strava** | strava-oauth-callback, strava-webhook, device-connect, device-sync, device-disconnect | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN` | strava.com/settings/api |
| **Garmin** | garmin-oauth-callback, garmin-webhook | `GARMIN_CONSUMER_KEY/SECRET` | Garmin Connect Dev Program (homologation) |
| **Coros** | coros-oauth-callback, coros-webhook | `COROS_CLIENT_ID/SECRET` | COROS Open API (homologation) |
| **Emails** (optionnel) | améliore invite-athlete (déjà live, marche sans) | `RESEND_API_KEY`, `RESEND_FROM` | resend.com |

**Ordre conseillé** : Stripe d'abord (monétisation) → Strava (la sync qui remplace l'accès coupé) → IA → Garmin/Coros (quand homologués).

## 🌐 Mettre le SITE en ligne (front statique)
Le site est du HTML statique (aucun build). Options, du plus simple au plus « pro » :

1. **Netlify Drop** (le plus rapide, 0 config) : glisser le dossier `~/Downloads/files_extracted` sur app.netlify.com/drop → URL live en 20 s.
2. **Cloudflare Pages / Vercel** (connecté au repo GitHub) : brancher `RowanDgrv/Pairform`, dossier racine, pas de build. ⚠️ nécessite de **merger `rebrand-sillance` → `main`** d'abord (sinon c'est l'ancien site qui sort).
3. **GitHub Pages** : activer Pages sur la branche → `https://rowandgrv.github.io/sillance/` (merger sur main d'abord).

**Après déploiement**, 2 réglages (je peux les faire via le token) :
- Ajouter l'URL de prod dans **Auth → Site URL + Redirect URLs**.
- Remplacer le CORS `*` des edge functions par l'origine de prod (durcissement).

## 🧭 Prochaine action pour toi
Choisis : (a) un **host** pour le site, et (b) commence à créer les **produits Stripe** (le plus gros levier). Donne-moi les clés → je déploie et je branche. Le reste est prêt.
