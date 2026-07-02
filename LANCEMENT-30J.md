# Sillance — Constat de lancement & plan 30 jours

> Objectif : site en ligne, **sans bug**, base de données utilisateurs + clubs
> réellement créée et alimentée. (Nom de domaine exclu, traité à part.)
> État au 29/06/2026.

---

## 0. Le constat brutal en une phrase

**Tout le produit est codé (front démo complet + ~22 edge functions + 9 migrations),
mais rien n'est provisionné ni déployé : 0 base en ligne, 0 fonction déployée,
0 paiement réel, 0 donnée testée de bout en bout.** Le travail restant n'est pas
du « développement de features », c'est de la **mise en production + durcissement + conformité**.

### Ce qui marche déjà
- Front démo des 3 rôles (coach / athlète / club), builder, analyse (découplage + IA), facturation simulée.
- Schéma DB conçu (16+ tables, RLS, helpers), Stripe/Connect/IA codés, Strava codé.

### Ce qui n'existe PAS encore
- Aucun projet Supabase créé · CLIs absents (supabase, stripe, deno, gh).
- Front non hébergé (HTTPS obligatoire pour Supabase/Stripe/OAuth).
- Aucun produit Stripe créé, aucun webhook branché, mode live non activé.
- Rien testé contre une vraie base · add-on IA (sessions 10-11) non commité.

---

## 1. ⚠️ LE RISQUE N°1 — synchronisation des données sportives

C'est le **chemin critique** et il peut faire capoter le lancement si on l'ignore.

- **Strava interdit (depuis nov. 2024) d'afficher les données d'un athlète à son
  coach via l'API.** Or « le coach voit les séances de l'athlète » est LE cœur de
  Sillance. → Strava ne peut PAS servir le cas d'usage coach.
- **Garmin & Coros** lèvent l'interdiction MAIS exigent une **homologation
  partenaire** (Garmin Connect Developer Program, COROS Open API) qui prend
  **plusieurs semaines à plusieurs mois** → **ne sera pas prête à J+30.**

### Décision MVP imposée par le calendrier
Lancer la sync sur un canal **sans homologation** :
1. **Upload de fichiers `.FIT` / `.TCX` / `.GPX`** (export Garmin/Coros/montre) — à CODER (parser non fait, seules les API Strava/Garmin/Coros sont codées).
2. **Saisie manuelle** (déjà partiellement là pour Hyrox).
3. Garmin/Coros API : **déposer les demandes d'homologation MAINTENANT**, elles arriveront après le lancement comme amélioration.

> **Nouveau dev à prévoir** : parser `.FIT` (format binaire → lib `fit-file-parser`),
> mapping vers `external_activities`, UI d'upload. ~3-4 jours. **À ne pas sous-estimer.**

---

## 2. Tout ce qui reste, par chantier

Légende effort : 🟢 court (≤1j) · 🟡 moyen (2-3j) · 🔴 lourd (4j+) · ⏳ délai externe (hors de ton contrôle).

### A. Infrastructure & base de données 🔴
- [x] **Projet Supabase créé** (ref `onbsgohvqejccowfnrbs`, région UE).
- [x] **Les 25 tables créées + RLS active** (via SQL Editor, `sillance-setup.sql` = 10 migrations combinées, rendu idempotent). Vérifié par API : toutes les tables répondent.
- [x] **`SUPABASE_URL` + clé publique renseignés** dans `sillance-client.js` (connexion testée OK).
- [x] **Storage** : bucket privé `videos` créé (migration 0003).
- [ ] **Connecter le site EN LIGNE** : pousser le `sillance-client.js` configuré (sinon seul le local est branché).
- [ ] Auth : **Site URL + Redirect URLs** = l'adresse du site en ligne (sinon login/inscription cassés) ; confirmation email ; SMTP custom (l'email Supabase par défaut est bridé).
- [ ] **Vérifier la RLS pour de vrai** : un coach ne doit JAMAIS voir les données d'un autre coach/club (test d'intrusion par rôle). 🔴 critique « sans bug ».
- [ ] (Optionnel) `select seed_demo(auth.uid());` une fois connecté, pour des données de test.

### B. Hébergement du front 🟡
- [ ] Choisir un hébergeur statique (Netlify / Vercel / Cloudflare Pages) — HTTPS auto.
- [ ] Structurer le site : **landing → inscription → app** (aujourd'hui = fichiers épars : `index.html`, `sillance-calendrier.html`, `sillance-club.html`…).
- [ ] Déployer + vérifier que les modules ES (`sillance-client.js`, `sillance-integration.js`) chargent en prod.
- [ ] Renommer les fichiers `apex-tri-*` (legacy) en URLs propres.

### C. Paiements Stripe 🔴 ⏳
- [ ] Créer le **compte Stripe** + **vérification d'identité/entreprise** (⏳ quelques jours, bloque le mode live).
- [ ] Créer les produits/prix : SaaS coach/athlète/club, offres club (15/59/119), offre coach (99), **add-on IA (12)**.
- [ ] **Stripe Connect Express** (clubs & coachs encaissent) : activer la plateforme, profil, onboarding ⏳ revue Stripe.
- [ ] Webhook : endpoint en prod, `STRIPE_WEBHOOK_SECRET`, souscrire les events (`customer.subscription.*`, `account.updated`, `checkout.session.completed`).
- [ ] **Passe complète mode TEST** (chaque flux : sub SaaS, abo club, abo coach, add-on IA, créneau one-shot) → puis bascule **LIVE**.
- [ ] **TVA / facturation** : France 20 %, Stripe Tax + factures conformes (obligation légale).

### D. Sync données sportives 🔴 (voir §1)
- [x] **Upload `.TCX` / `.GPX` codé et testé** (`sillance-fit.js`, parse navigateur → même structure que l'app → découplage + IA sur données réelles ; bouton « Importer un fichier » dans la carte Activités des 2 HTML). Validé headless (TCX run + GPX vélo + découplage +5,16 % sur cas propre).
- [ ] `.FIT` binaire (lib `fit-file-parser`) — complément, après le lancement.
- [ ] **Persistance** : câbler `PF.saveActivity()` → table `external_activities` (aujourd'hui l'import ouvre l'analyse mais ne stocke pas encore en base — à faire quand Supabase sera provisionné).
- [ ] Déposer demandes homologation **Garmin Connect Dev** + **COROS Open API** ⏳.
- [x] **Conformité ToS Strava faite** : migration `0010` → le coach ne peut PLUS lire les activités d'origine `strava` d'un athlète (policy RLS `"extact: coach read"` restreinte à `provider <> 'strava'`) ; nouveau provider `upload` pour les fichiers partageables ; note explicative côté athlète dans les 2 HTML. Garmin/Coros/upload restent partageables au coach.

### E. Déploiement des edge functions 🟡
- [ ] `supabase secrets set --env-file .env` (toutes les clés : Stripe, Anthropic, Resend, Strava…).
- [ ] Déployer les ~22 functions (dont `session-summary` + `ai-addon-subscribe`, JWT ; webhooks/callbacks en `--no-verify-jwt`).
- [ ] Tester chaque fonction réellement (jamais compilées : deno absent → erreurs TS possibles à corriger).

### F. Finition front ↔ back 🟡
- [ ] **Câbler l'IA réelle** : remplacer le générateur démo par `PF.summarizeSession()` quand coach connecté + add-on actif (sinon paywall).
- [ ] **Sélection d'athlète côté coach** pour planifier (aujourd'hui le coach planifie pour lui-même — manque pour le cas réel).
- [ ] Gates premium vidéos réels, hydratation testée section par section, **empty states** (nouvel utilisateur sans données).
- [ ] Commiter + pousser l'add-on IA (sessions 10-11).

### G. Légal & conformité 🔴 ⏳ (obligatoire pour encaisser)
- [ ] **Statut juridique** pour facturer/recevoir les paiements (auto-entrepreneur ou société) ⏳ — bloque Stripe live & factures.
- [ ] Mentions légales · **CGV** (vente, obligatoire) · CGU · **Politique de confidentialité RGPD**.
- [ ] Bannière **cookies/consentement** · registre des traitements · DPA Supabase/Stripe.
- [ ] **Suppression de compte** + export des données (droits RGPD).
- [ ] Données de FC/perf : cadrer le consentement (donnée potentiellement sensible).

### H. Emails transactionnels 🟢
- [ ] Resend : vérifier le domaine (DNS), `RESEND_FROM`, templates (bienvenue, invitation, reçu paiement).

### I. QA / « sans bug » 🔴 (le plus sous-estimé)
- [ ] **Scénarios end-to-end par rôle** sur la vraie base (inscription → paiement → usage → annulation).
- [ ] **Sécurité RLS** : tentatives d'accès croisé entre coachs/clubs.
- [ ] **Cross-navigateur** (Safari/Chrome/Firefox) + **responsive mobile** (l'app est pensée desktop « cockpit » — les athlètes consultent au téléphone : à vérifier/adapter).
- [ ] Cas limites paiement (carte refusée, abo annulé, double paiement, webhook en retard).
- [ ] **Monitoring d'erreurs** (Sentry) en place AVANT le lancement pour attraper les bugs réels.

### J. Observabilité & support 🟢
- [ ] Analytics respectueux (Plausible/Matomo) · canal support (email/chat) · page statut.

### K. Bêta & lancement 🟡
- [ ] **Bêta fermée** avec 3-5 vrais coachs (cible Phase 1) → boucle de feedback/correctifs.
- [ ] Tunnel d'inscription finalisé, onboarding, 1ère séance guidée.

---

## 3. Décisions que TOI SEUL peux prendre (déblocages)

1. **Périmètre du lancement** : les 3 rôles d'un coup, ou **Phase 1 coach solo d'abord** (recommandé pour tenir 30j et la stratégie déjà arrêtée) ?
2. **Sync MVP** : on part sur **upload .FIT + manuel** au lancement (Garmin/Coros en homologation parallèle) ? (quasi obligatoire vu les délais)
3. **Statut juridique** : déjà en place (auto-entrepreneur/société) ou à créer ? ⏳ détermine la date de bascule Stripe live.
4. **Hébergeur** du front (Netlify / Vercel / Cloudflare Pages).

---

## 4. Calendrier 30 jours (solo, scope Phase 1 recommandé)

### Semaine 1 — Fondations (rien ne marche → ça tourne)
Installer CLIs · créer Supabase UE · push 9 migrations · auth + SMTP · héberger le
front en HTTPS · renseigner URL/clé · créer compte Stripe (vérif lancée) · **déposer
homologations Garmin/Coros** · lancer le **statut juridique** si besoin.
→ *Jalon : on peut s'inscrire et se connecter sur le site en ligne.*

### Semaine 2 — Bout-en-bout en mode TEST
Déployer les 22 functions + secrets · corriger les erreurs TS · produits/prix Stripe
test · webhook · **tester chaque flux par rôle** · câbler l'IA réelle · upload .FIT +
parser · sélection d'athlète côté coach · empty states.
→ *Jalon : un coach s'inscrit, paie (test), invite un athlète, voit ses séances (FIT), génère un résumé IA.*

### Semaine 3 — Conformité, durcissement, live
Légal (CGV/CGU/RGPD/cookies/suppression compte) · TVA/factures · **bascule Stripe
live** · sécurité RLS (tests d'intrusion) · cross-navigateur + mobile · Sentry +
analytics · emails Resend.
→ *Jalon : paiements réels possibles, conforme, instrumenté.*

### Semaine 4 — Bêta & polish
Bêta fermée 3-5 coachs · correction des bugs réels · onboarding/tunnel · derniers
polish · **go / no-go lancement**.
→ *Jalon : lancement Phase 1.*

---

## 5. Définition de « lancé sans bug »

Le lancement est OK quand, **sur le site en ligne et avec de vraies données** :
1. Un coach s'inscrit, confirme son email, se connecte.
2. Il s'abonne (paiement réel) et, s'il veut, active l'add-on IA.
3. Il invite un athlète, qui crée son compte et relie ses données (upload .FIT).
4. Le coach planifie des séances POUR cet athlète, voit ses données réelles,
   ouvre l'analyse (découplage + résumé IA généré par Claude).
5. Aucun athlète/coach ne peut accéder aux données d'un autre (RLS prouvée).
6. Annulation/relance d'abonnement gérées · factures émises · erreurs remontées (Sentry).
7. Fonctionne sur Chrome/Safari/Firefox + mobile.

---

## 6. Verdict honnête sur les 30 jours

- **Tenable** si : périmètre **Phase 1 coach solo**, sync = **.FIT + manuel**, statut
  juridique déjà prêt (ou micro-entreprise rapide), et focus mise-en-prod (pas de
  nouvelle feature).
- **Intenable en 30 j** si : les 3 rôles complets + device sync API Garmin/Coros
  homologuée + zéro dette. Les dépendances externes (Stripe, homologations, légal)
  sont les vrais goulots, pas le code.
- **Goulots externes à lancer en JOUR 1** : vérification Stripe, homologations
  Garmin/Coros, statut juridique. Tout le reste dépend de toi.
