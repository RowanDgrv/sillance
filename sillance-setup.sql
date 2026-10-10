-- ==============================================================================
-- Sillance — création complète de la base (à coller dans Supabase → SQL Editor)
-- Combine les 10 migrations dans l'ordre. À exécuter UNE fois.
-- ==============================================================================


-- ========================= 0001_init.sql =========================
-- =============================================================================
--  Sillance — Schéma initial (Supabase / Postgres)
--  Couvre les 3 rôles : coach (phase 1), athlète B2C (phase 3), club (phase 2).
--  Calé sur le modèle de données des fichiers HTML existants :
--    disciplines (swim/bike/run/strength/hyrox), séances + blocs JSON,
--    records, check-in (sommeil/fatigue/motivation), refs physio (FTP/PMA/VMA/CSS…),
--    vidéos, clubs / groupes / créneaux tarifés.
--  v1 : on privilégie "ça marche pour les 3 rôles", on raffinera après.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
--  ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('coach','athlete','club_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type discipline as enum ('swim','bike','run','strength','hyrox','tri');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sub_status as enum ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_kind as enum ('coach','athlete','club');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
--  PROFILES  (1 ligne par utilisateur authentifié)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role not null default 'athlete',
  full_name     text,
  email         text,
  avatar_url    text,
  stripe_customer_id text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Crée automatiquement un profil à l'inscription (trigger sur auth.users).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'athlete')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
--  ATHLETE_PROFILES  (refs physiologiques — ATHLETE_REF dans l'app)
-- ---------------------------------------------------------------------------
create table if not exists athlete_profiles (
  user_id   uuid primary key references profiles(id) on delete cascade,
  -- vélo
  ftp       numeric,           -- W
  pma       numeric,           -- W
  cp_bike   numeric,           -- puissance critique W
  -- course
  vma       numeric,           -- km/h
  cv        numeric,           -- vitesse critique km/h
  seuil_run numeric,           -- allure seuil s/km
  -- natation
  css       numeric,           -- critical swim speed s/100m
  -- FC
  fc_max    numeric,
  fc_repos  numeric,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  COACH_ATHLETE  (la "paire" coach ↔ athlète)
-- ---------------------------------------------------------------------------
create table if not exists coach_athlete (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references profiles(id) on delete cascade,
  athlete_id  uuid not null references profiles(id) on delete cascade,
  status      text not null default 'active',   -- active | invited | archived
  created_at  timestamptz not null default now(),
  unique (coach_id, athlete_id)
);
create index if not exists idx_ca_coach   on coach_athlete(coach_id);
create index if not exists idx_ca_athlete on coach_athlete(athlete_id);

-- ---------------------------------------------------------------------------
--  SESSIONS  (modèles de séances réutilisables — bibliothèque coach)
--  blocks = structure builderState.blocks (échauffement / séries / récup) en JSON.
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  disc        discipline not null,
  title       text not null,
  dur         integer default 0,        -- minutes
  dist        numeric default 0,        -- km (0 si non pertinent)
  tss         integer default 0,
  zone        text,                     -- 'Z2', 'Z4'…
  active_refs text[] default '{}',      -- ['ftp','fc','rpe']
  blocks      jsonb default '[]'::jsonb,
  is_template boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_sessions_owner on sessions(owner_id);

-- ---------------------------------------------------------------------------
--  SCHEDULED_SESSIONS  (planning[date] = [séances] assignées à un athlète)
-- ---------------------------------------------------------------------------
create table if not exists scheduled_sessions (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references profiles(id) on delete cascade,
  created_by  uuid references profiles(id) on delete set null, -- coach ou athlète
  source_session_id uuid references sessions(id) on delete set null,
  date        date not null,
  disc        discipline not null,
  title       text not null,
  dur         integer default 0,
  dist        numeric default 0,
  tss         integer default 0,
  zone        text,
  blocks      jsonb default '[]'::jsonb,
  done        boolean not null default false,
  rpe         integer,                  -- ressenti 1-10
  created_at  timestamptz not null default now()
);
create index if not exists idx_sched_athlete_date on scheduled_sessions(athlete_id, date);

-- ---------------------------------------------------------------------------
--  RECORDS  (records personnels — RECORDS dans l'app)
-- ---------------------------------------------------------------------------
create table if not exists records (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references profiles(id) on delete cascade,
  label       text not null,            -- '10 km', 'Semi', 'FTP', 'PMA'…
  value       text not null,            -- '31:45', '310 W'
  is_new      boolean not null default false,
  recorded_at date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists idx_records_athlete on records(athlete_id);

-- ---------------------------------------------------------------------------
--  CHECKINS  (check-in matinal — sommeil / fatigue / motivation)
-- ---------------------------------------------------------------------------
create table if not exists checkins (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references profiles(id) on delete cascade,
  date        date not null default current_date,
  sommeil     integer check (sommeil between 1 and 10),
  fatigue     integer check (fatigue between 1 and 10),
  motivation  integer check (motivation between 1 and 10),
  readiness   integer,                  -- score % calculé côté app
  created_at  timestamptz not null default now(),
  unique (athlete_id, date)
);
create index if not exists idx_checkins_athlete_date on checkins(athlete_id, date);

-- ---------------------------------------------------------------------------
--  VIDEOS  (bibliothèque technique — VIDEOS dans l'app, brique B2C phase 3)
--  is_premium = réservé aux abonnés payants.
-- ---------------------------------------------------------------------------
create table if not exists videos (
  id          uuid primary key default gen_random_uuid(),
  disc        discipline not null,
  title       text not null,
  duration    text,                     -- '1:24'
  level       text,                     -- 'Débutant' | 'Inter' | 'Avancé'
  description text,
  tags        text[] default '{}',
  src         text,                     -- URL Storage / externe
  is_premium  boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  CLUBS / GROUPES / CRÉNEAUX  (phase 2)
-- ---------------------------------------------------------------------------
create table if not exists clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,            -- 'Muret Goat Squad'
  owner_id    uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists idx_clubs_owner on clubs(owner_id);

create table if not exists club_groups (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,            -- 'Hyrox', 'Adultes Triathlon Half'…
  color       text,
  description  text
);
create index if not exists idx_groups_club on club_groups(club_id);

create table if not exists club_members (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  athlete_id  uuid references profiles(id) on delete set null, -- null = membre non-inscrit
  display_name text,                    -- pour les membres sans compte
  disc        discipline,
  since        text,
  group_id    uuid references club_groups(id) on delete set null,
  role        text not null default 'member',  -- member | coach | admin
  created_at  timestamptz not null default now()
);
create index if not exists idx_members_club on club_members(club_id);

create table if not exists creneaux (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  disc        discipline not null,
  title       text not null,
  day         integer,                  -- 1=Lundi … 7=Dimanche
  time        text,                     -- '18:30'
  dur         integer,
  place       text,
  cap         integer,                  -- capacité
  coach       text,
  price       numeric not null default 0,  -- 0 = inclus dans l'adhésion ; >0 = à la carte
  group_id    uuid references club_groups(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_creneaux_club on creneaux(club_id);

create table if not exists creneau_attendees (
  creneau_id  uuid not null references creneaux(id) on delete cascade,
  athlete_id  uuid not null references club_members(id) on delete cascade,
  paid        boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (creneau_id, athlete_id)
);

-- ---------------------------------------------------------------------------
--  SUBSCRIPTIONS  (état Stripe — la source de vérité, alimentée par le webhook)
-- ---------------------------------------------------------------------------
create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references profiles(id) on delete cascade,
  plan                   plan_kind not null,        -- coach | athlete | club
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  price_id               text,
  status                 sub_status not null default 'incomplete',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now(),
  created_at             timestamptz not null default now()
);
create index if not exists idx_subs_user on subscriptions(user_id);

-- Vue pratique : un utilisateur a-t-il un abonnement actif ?
create or replace view active_subscriptions as
  select * from subscriptions
  where status in ('trialing','active');

-- =============================================================================
--  HELPERS RLS  (security definer — contournent la RLS pour faire les jointures)
-- =============================================================================
create or replace function is_coach_of(target_athlete uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from coach_athlete
    where coach_id = auth.uid() and athlete_id = target_athlete and status = 'active'
  );
$$;

create or replace function owns_club(target_club uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from clubs where id = target_club and owner_id = auth.uid());
$$;

create or replace function is_club_member(target_club uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from club_members where club_id = target_club and athlete_id = auth.uid()
  );
$$;

-- =============================================================================
--  ROW LEVEL SECURITY
-- =============================================================================
alter table profiles            enable row level security;
alter table athlete_profiles    enable row level security;
alter table coach_athlete       enable row level security;
alter table sessions            enable row level security;
alter table scheduled_sessions  enable row level security;
alter table records             enable row level security;
alter table checkins            enable row level security;
alter table videos              enable row level security;
alter table clubs               enable row level security;
alter table club_groups         enable row level security;
alter table club_members        enable row level security;
alter table creneaux            enable row level security;
alter table creneau_attendees   enable row level security;
alter table subscriptions       enable row level security;

-- ---- PROFILES ----
create policy "profiles: self read"   on profiles for select using (id = auth.uid());
drop policy if exists "profiles: coach reads athletes" on profiles;
create policy "profiles: coach reads athletes" on profiles for select using (is_coach_of(id));
drop policy if exists "profiles: self update" on profiles;
create policy "profiles: self update" on profiles for update using (id = auth.uid());

-- ---- ATHLETE_PROFILES ----
drop policy if exists "athlete_profiles: self all" on athlete_profiles;
create policy "athlete_profiles: self all" on athlete_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "athlete_profiles: coach reads" on athlete_profiles;
create policy "athlete_profiles: coach reads" on athlete_profiles
  for select using (is_coach_of(user_id));

-- ---- COACH_ATHLETE ----
drop policy if exists "coach_athlete: coach manages" on coach_athlete;
create policy "coach_athlete: coach manages" on coach_athlete
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());
drop policy if exists "coach_athlete: athlete reads" on coach_athlete;
create policy "coach_athlete: athlete reads" on coach_athlete
  for select using (athlete_id = auth.uid());

-- ---- SESSIONS (templates) ----
drop policy if exists "sessions: owner all" on sessions;
create policy "sessions: owner all" on sessions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---- SCHEDULED_SESSIONS ----
drop policy if exists "sched: athlete reads own" on scheduled_sessions;
create policy "sched: athlete reads own" on scheduled_sessions
  for select using (athlete_id = auth.uid());
drop policy if exists "sched: athlete updates own (done/rpe)" on scheduled_sessions;
create policy "sched: athlete updates own (done/rpe)" on scheduled_sessions
  for update using (athlete_id = auth.uid());
drop policy if exists "sched: coach manages athlete plan" on scheduled_sessions;
create policy "sched: coach manages athlete plan" on scheduled_sessions
  for all using (is_coach_of(athlete_id)) with check (is_coach_of(athlete_id));

-- ---- RECORDS ----
drop policy if exists "records: athlete all" on records;
create policy "records: athlete all" on records
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
drop policy if exists "records: coach reads" on records;
create policy "records: coach reads" on records
  for select using (is_coach_of(athlete_id));

-- ---- CHECKINS ----
drop policy if exists "checkins: athlete all" on checkins;
create policy "checkins: athlete all" on checkins
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
drop policy if exists "checkins: coach reads" on checkins;
create policy "checkins: coach reads" on checkins
  for select using (is_coach_of(athlete_id));

-- ---- VIDEOS (catalogue) ----
-- Tout le monde voit les vidéos gratuites ; le premium est filtré côté app/edge
-- selon l'abonnement (lecture du catalogue OK, l'URL src reste protégée par Storage).
drop policy if exists "videos: read for authenticated" on videos;
create policy "videos: read for authenticated" on videos
  for select to authenticated using (true);

-- ---- CLUBS ----
drop policy if exists "clubs: owner all" on clubs;
create policy "clubs: owner all" on clubs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "clubs: member reads" on clubs;
create policy "clubs: member reads" on clubs
  for select using (is_club_member(id));

-- ---- CLUB_GROUPS ----
drop policy if exists "club_groups: owner all" on club_groups;
create policy "club_groups: owner all" on club_groups
  for all using (owns_club(club_id)) with check (owns_club(club_id));
drop policy if exists "club_groups: member reads" on club_groups;
create policy "club_groups: member reads" on club_groups
  for select using (is_club_member(club_id));

-- ---- CLUB_MEMBERS ----
drop policy if exists "club_members: owner all" on club_members;
create policy "club_members: owner all" on club_members
  for all using (owns_club(club_id)) with check (owns_club(club_id));
drop policy if exists "club_members: self reads" on club_members;
create policy "club_members: self reads" on club_members
  for select using (athlete_id = auth.uid());

-- ---- CRENEAUX ----
drop policy if exists "creneaux: owner all" on creneaux;
create policy "creneaux: owner all" on creneaux
  for all using (owns_club(club_id)) with check (owns_club(club_id));
drop policy if exists "creneaux: member reads" on creneaux;
create policy "creneaux: member reads" on creneaux
  for select using (is_club_member(club_id));

-- ---- CRENEAU_ATTENDEES ----
drop policy if exists "attendees: club owner all" on creneau_attendees;
create policy "attendees: club owner all" on creneau_attendees
  for all using (exists (
    select 1 from creneaux c where c.id = creneau_id and owns_club(c.club_id)
  ));

-- ---- SUBSCRIPTIONS (lecture seule côté client ; écriture = service_role/webhook) ----
drop policy if exists "subscriptions: self read" on subscriptions;
create policy "subscriptions: self read" on subscriptions
  for select using (user_id = auth.uid());


-- ========================= 0002_seed_videos.sql =========================
-- =============================================================================
--  Seed du catalogue vidéo (repris du tableau VIDEOS de l'app).
--  src vide pour l'instant : à uploader dans Storage puis renseigner l'URL.
--  is_premium = true par défaut (réservé abonnés) ; passe à false pour la démo.
-- =============================================================================
insert into videos (disc, title, duration, level, description, tags, is_premium) values
  -- Natation
  ('swim','Crawl — rattrapé','1:24','Inter','Une main attend l''autre devant : améliore le timing et l''allonge.', array['rattrapé','rattrape'], true),
  ('swim','Crawl — poings fermés','0:58','Inter','Nager poings fermés pour sentir l''appui de l''avant-bras.', array['poings fermés','poings'], true),
  ('swim','Crawl — battements planche','1:10','Débutant','Renforce le battement et le gainage, planche devant.', array['battement','planche'], false),
  ('swim','Respiration 3 temps','1:05','Débutant','Alterner le côté de respiration pour équilibrer le crawl.', array['respiration','3 temps'], false),
  ('swim','Virage culbute','1:32','Avancé','Technique de virage rapide en bassin.', array['virage','culbute'], true),
  ('swim','Pull-buoy & plaquettes','1:18','Inter','Travail de force et de trajet moteur avec matériel.', array['plaquette','pull-buoy','pull'], true),
  -- Course
  ('run','Gammes — montées de genoux','0:48','Débutant','Éducatif de foulée, fréquence et posture.', array['gammes','montées de genoux','genoux'], false),
  ('run','Gammes — talons-fesses','0:44','Débutant','Active les ischios et le cycle arrière.', array['talons-fesses','gammes'], false),
  ('run','Foulées bondissantes','1:02','Avancé','Travail de puissance et d''élasticité.', array['bondissantes','foulées','foulee'], true),
  ('run','Lignes droites (strides)','0:55','Inter','Accélérations progressives pour la vitesse et la relâche.', array['lignes droites','strides','ligne'], true),
  -- Vélo
  ('bike','Pédalage — vélocité','1:15','Inter','Travail de cadence élevée et de fluidité du coup de pédale.', array['vélocité','cadence'], true),
  ('bike','Position aéro & posture','1:40','Inter','Optimiser sa position pour l''aérodynamisme et le confort.', array['aéro','position','posture'], true),
  ('bike','Montée en danseuse','1:08','Avancé','Technique de relance et de grimpe debout.', array['danseuse','montée','grimpe'], true)
on conflict do nothing;


-- ========================= 0003_invites_payments_storage.sql =========================
-- =============================================================================
--  Sillance — Migration 0003
--  Ajoute : invitations coach→athlète, paiement des créneaux à la carte,
--  bucket Storage privé pour les vidéos, et triggers updated_at génériques.
-- =============================================================================

-- ---------------------------------------------------------------------------
--  updated_at automatique (générique)
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','athlete_profiles','subscriptions'] loop
    execute format('drop trigger if exists trg_touch_%1$s on %1$s;', t);
    execute format(
      'create trigger trg_touch_%1$s before update on %1$s
       for each row execute function touch_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
--  INVITATIONS  (coach invite un athlète par email)
--  Parcours : coach crée une invite → l'athlète reçoit un lien avec le token →
--  il s'inscrit/se connecte → l'edge function `accept-invite` crée le lien
--  coach_athlete et passe l'invite à 'accepted'.
-- ---------------------------------------------------------------------------
create table if not exists invitations (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references profiles(id) on delete cascade,
  email       text not null,
  token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  status      text not null default 'pending',   -- pending | accepted | revoked | expired
  athlete_id  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  unique (coach_id, email)
);
create index if not exists idx_invites_coach on invitations(coach_id);
create index if not exists idx_invites_email on invitations(lower(email));

alter table invitations enable row level security;

-- Le coach gère ses propres invitations.
drop policy if exists "invites: coach manages" on invitations;
create policy "invites: coach manages" on invitations
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());
-- L'invité (une fois connecté avec le bon email) peut voir l'invitation qui le concerne.
drop policy if exists "invites: invitee reads" on invitations;
create policy "invites: invitee reads" on invitations
  for select using (lower(email) = lower(coalesce(auth.jwt()->>'email','')));

-- ---------------------------------------------------------------------------
--  PAIEMENT DES CRÉNEAUX À LA CARTE
--  creneau_attendees.paid existe déjà ; on ajoute le suivi Stripe + une table
--  d'historique de paiements one-shot (mode 'payment', pas abonnement).
-- ---------------------------------------------------------------------------
alter table creneau_attendees
  add column if not exists stripe_session_id text,
  add column if not exists amount numeric;

create table if not exists creneau_payments (
  id                 uuid primary key default gen_random_uuid(),
  creneau_id         uuid not null references creneaux(id) on delete cascade,
  member_id          uuid not null references club_members(id) on delete cascade,
  stripe_session_id  text unique,
  amount             numeric,
  status             text not null default 'pending',  -- pending | paid | failed | refunded
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);
create index if not exists idx_crpay_creneau on creneau_payments(creneau_id);

alter table creneau_payments enable row level security;
-- Le propriétaire du club voit les paiements de ses créneaux (lecture).
drop policy if exists "creneau_payments: club owner reads" on creneau_payments;
create policy "creneau_payments: club owner reads" on creneau_payments
  for select using (exists (
    select 1 from creneaux c where c.id = creneau_id and owns_club(c.club_id)
  ));
-- L'écriture passe par le webhook (service_role) — aucune policy d'insert côté client.

-- ---------------------------------------------------------------------------
--  STORAGE — bucket privé pour les vidéos premium
--  Les fichiers ne sont jamais publics : l'app demande une URL signée à
--  l'edge function `video-url`, qui vérifie l'abonnement avant de la délivrer.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

-- Aucune policy de lecture publique : seul le service_role (edge function)
-- génère des URLs signées. Les utilisateurs n'accèdent pas au bucket en direct.

-- ---------------------------------------------------------------------------
--  Helper : l'utilisateur courant a-t-il un abonnement actif ? (pour gating)
-- ---------------------------------------------------------------------------
create or replace function has_active_subscription(target uuid default auth.uid())
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from subscriptions
    where user_id = target and status in ('active','trialing')
  );
$$;


-- ========================= 0004_seed_demo.sql =========================
-- =============================================================================
--  Sillance — Migration 0004 : fonction de données démo à la demande.
--  Usage : une fois inscrit/connecté, lance dans le SQL Editor :
--      select seed_demo(auth.uid());
--  Remplit, pour CET utilisateur, des données de test couvrant les 3 rôles
--  (athlète : refs/records/check-in/séances ; coach : 1 template ; club : club
--  "Muret Goat Squad" + groupes + créneaux). Idempotent-ish (nettoie d'abord).
-- =============================================================================
create or replace function seed_demo(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_club  uuid;
  v_g_tri uuid;
  v_g_hyrox uuid;
  v_member uuid;
  d date := current_date;
begin
  -- --- ATHLÈTE : refs physiologiques (ATHLETE_REF) ---
  insert into athlete_profiles (user_id, ftp, pma, cp_bike, vma, cv, seuil_run, css, fc_max, fc_repos)
  values (p_user, 310, 415, 300, 20.3, 18.4, 210, 98, 190, 47)
  on conflict (user_id) do update set
    ftp=excluded.ftp, pma=excluded.pma, vma=excluded.vma, css=excluded.css;

  -- --- ATHLÈTE : records (RECORDS) ---
  delete from records where athlete_id = p_user;
  insert into records (athlete_id, label, value, is_new) values
    (p_user, '10 km', '31:45', true),
    (p_user, 'Semi',  '1:08:52', true),
    (p_user, 'FTP',   '310 W', false),
    (p_user, 'PMA',   '415 W', false);

  -- --- ATHLÈTE : check-in du jour ---
  insert into checkins (athlete_id, date, sommeil, fatigue, motivation, readiness)
  values (p_user, d, 7, 4, 8, 73)
  on conflict (athlete_id, date) do update set
    sommeil=excluded.sommeil, fatigue=excluded.fatigue,
    motivation=excluded.motivation, readiness=excluded.readiness;

  -- --- ATHLÈTE : quelques séances planifiées cette semaine ---
  delete from scheduled_sessions where athlete_id = p_user and date between d and d+6;
  insert into scheduled_sessions (athlete_id, created_by, date, disc, title, dur, dist, tss, zone, done, rpe) values
    (p_user, p_user, d,     'run',  'Footing',                 45, 8.5, 42, 'Z2', false, null),
    (p_user, p_user, d+1,   'bike', 'Endurance fondamentale',  90, 33,  70, 'Z2', false, null),
    (p_user, p_user, d+2,   'swim', 'Technique natation',      60, 0,   45, 'Z2', false, null),
    (p_user, p_user, d+3,   'bike', 'Seuil 3x12''',            75, 28,  85, 'Z4', false, null),
    (p_user, p_user, d+5,   'hyrox','Hyrox — simulation',      75, 8,   90, 'Z4', false, null);

  -- --- COACH : 1 modèle de séance dans la bibliothèque ---
  delete from sessions where owner_id = p_user and title = 'Seuil vélo 3x12''';
  insert into sessions (owner_id, disc, title, dur, dist, tss, zone, active_refs, blocks, is_template)
  values (p_user, 'bike', 'Seuil vélo 3x12''', 75, 28, 85, 'Z4',
          array['ftp','fc','rpe'],
          '[{"title":"Échauffement","series":1},{"title":"3x12 min @ FTP","series":3},{"title":"Retour au calme","series":1}]'::jsonb,
          true);

  -- --- CLUB : "Muret Goat Squad" + groupes + membres + créneaux ---
  delete from clubs where owner_id = p_user and name = 'Muret Goat Squad';
  insert into clubs (name, owner_id) values ('Muret Goat Squad', p_user) returning id into v_club;

  insert into club_groups (club_id, name, color, description)
  values (v_club, 'Adultes Triathlon Half', '#9D7BFF', 'Préparation 70.3') returning id into v_g_tri;
  insert into club_groups (club_id, name, color, description)
  values (v_club, 'Hyrox', '#FF8A3D', 'Préparation et compétition Hyrox') returning id into v_g_hyrox;

  insert into club_members (club_id, athlete_id, display_name, disc, since, group_id, role) values
    (v_club, null, 'Romain Dubois', 'tri',   '2023', v_g_tri,   'member'),
    (v_club, null, 'Léa Martin',    'tri',   '2024', v_g_tri,   'member'),
    (v_club, null, 'Karim Benali',  'hyrox', '2025', v_g_hyrox, 'member')
  returning id into v_member; -- garde le dernier id (Karim) pour un créneau démo

  insert into creneaux (club_id, disc, title, day, time, dur, place, cap, coach, price, group_id) values
    (v_club, 'run',   'Séance piste collective', 1, '18:30', 90, 'Stade Nelson Paillou, Muret', 24, 'Éric',  0,  v_g_tri),
    (v_club, 'swim',  'Technique natation',      2, '12:15', 60, 'Piscine Nakache, Muret',      16, 'Julie', 0,  v_g_tri),
    (v_club, 'hyrox', 'Hyrox — simulation',      5, '19:00', 75, 'Box Hyrox Muret',             12, 'Karim', 15, v_g_hyrox);

  -- Les 3 formules du club démo (15 / 59 / 119 €) — cf. 0006_club_billing.
  insert into club_offers (club_id, tier, price, bill_interval) values
    (v_club, 'dropin', 15,  'one_time'),
    (v_club, 'sub',    59,  'month'),
    (v_club, 'coach',  119, 'month')
  on conflict (club_id, tier) do nothing;

  -- Offre de coaching du compte démo (99 €/mois) — cf. 0008_coach_offers.
  insert into coach_offers (coach_id, name, price)
  select p_user, 'Suivi coaching', 99
  where not exists (select 1 from coach_offers where coach_id = p_user);

  return 'Données démo créées pour ' || p_user || ' (club: ' || v_club || ').';
end $$;

-- Permet à un utilisateur connecté d'appeler la fonction.
grant execute on function seed_demo(uuid) to authenticated;


-- ========================= 0005_device_sync.sql =========================
-- =============================================================================
--  0005 — Synchronisation des objets connectés (Strava / Garmin / Coros …)
--  ---------------------------------------------------------------------------
--  Deux tables :
--    • device_connections  : 1 ligne par (athlète, plateforme) — stocke les
--      jetons OAuth. Écrite UNIQUEMENT par les edge functions (service_role) ;
--      le front ne lit jamais les tokens (policy select limitée aux colonnes
--      non sensibles via la vue `my_devices`).
--    • external_activities : les activités importées, normalisées vers les
--      disciplines de l'app (`discipline`). Dédoublonnage par
--      (provider, provider_activity_id).
--  RLS : l'athlète voit ses propres connexions/activités ; le coach lié voit
--  les activités de ses athlètes (lecture seule).
-- =============================================================================

-- Plateformes supportées (extensible).
do $$ begin
  create type device_provider as enum ('strava','garmin','coros','polar','suunto','wahoo');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
--  CONNEXIONS (jetons OAuth) — sensibles, jamais exposées au front en clair
-- ---------------------------------------------------------------------------
create table if not exists device_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  provider         device_provider not null,
  provider_user_id text,                       -- id de l'athlète chez la plateforme
  access_token     text,
  refresh_token    text,
  token_secret     text,                        -- OAuth1.0a (Garmin) : secret du jeton d'accès
  expires_at       timestamptz,                -- expiration de l'access_token
  scope            text,
  last_sync_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, provider)
);
create index if not exists idx_devconn_user on device_connections(user_id);

-- ---------------------------------------------------------------------------
--  ACTIVITÉS IMPORTÉES — normalisées vers `discipline`
-- ---------------------------------------------------------------------------
create table if not exists external_activities (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references profiles(id) on delete cascade,
  provider             device_provider not null,
  provider_activity_id text not null,
  disc                 discipline,
  name                 text,
  start_time           timestamptz,
  duration_s           integer,                -- durée mouvement (s)
  distance_m           numeric,
  elevation_m          numeric,
  avg_hr               numeric,
  max_hr               numeric,
  avg_power            numeric,                -- W (vélo)
  avg_speed            numeric,                -- m/s
  calories             numeric,
  raw                  jsonb,                  -- payload brut de la plateforme
  imported_at          timestamptz not null default now(),
  unique (provider, provider_activity_id)
);
create index if not exists idx_extact_user_time on external_activities(user_id, start_time desc);

-- ---------------------------------------------------------------------------
--  ÉTATS OAuth — relie le callback (redirection navigateur, sans JWT) à l'user
--  qui a lancé la connexion. Écrit/lu uniquement par les edge functions.
-- ---------------------------------------------------------------------------
create table if not exists oauth_states (
  state      text primary key,                 -- aléatoire (OAuth2) ou request token (Garmin OAuth1)
  user_id    uuid not null references profiles(id) on delete cascade,
  provider   device_provider not null,
  meta       jsonb,                             -- ex: { req_secret } pour OAuth1.0a
  created_at timestamptz not null default now()
);
alter table oauth_states enable row level security;  -- aucune policy → service_role only

-- updated_at auto sur device_connections
drop trigger if exists trg_touch_device_connections on device_connections;
create trigger trg_touch_device_connections before update on device_connections
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
--  RLS
-- ---------------------------------------------------------------------------
alter table device_connections  enable row level security;
alter table external_activities enable row level security;

-- L'athlète peut voir/supprimer SA connexion (les tokens restent en base mais
-- ne sont pas renvoyés au front : voir la vue `my_devices` ci-dessous, et
-- n'utilise jamais select('*') côté client sur cette table).
create policy "devconn: self read"   on device_connections for select using (user_id = auth.uid());
drop policy if exists "devconn: self delete" on device_connections;
create policy "devconn: self delete" on device_connections for delete using (user_id = auth.uid());
-- (insert/update : réservés au service_role des edge functions, qui ignore la RLS)

-- Activités : l'athlète voit les siennes ; le coach lié les voit aussi.
create policy "extact: self read"  on external_activities for select using (user_id = auth.uid());
drop policy if exists "extact: coach read" on external_activities;
create policy "extact: coach read" on external_activities for select using (is_coach_of(user_id));
drop policy if exists "extact: self delete" on external_activities;
create policy "extact: self delete" on external_activities for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
--  Vue sûre : état des connexions SANS les jetons (pour l'UI "comptes liés")
-- ---------------------------------------------------------------------------
create or replace view my_devices
with (security_invoker = true) as
  select id, user_id, provider, provider_user_id, scope,
         (access_token is not null) as connected,
         last_sync_at, created_at, updated_at
  from device_connections;

comment on view my_devices is
  'État des connexions d''objets connectés sans exposer les jetons OAuth.';


-- ========================= 0006_club_billing.sql =========================
-- =============================================================================
--  0006_club_billing.sql
--  Facturation des 3 FORMULES CLUB (vendues par un club à ses adhérents) :
--    • dropin = « À la séance »      → one-shot (géré par creneau-checkout)
--    • sub    = « Abonnement club »  → abonnement mensuel récurrent
--    • coach  = « Coaching + »       → abonnement mensuel récurrent (premium)
--
--  Modèle CONNECT-READY :
--    - Si le club a relié son compte Stripe (stripe_account_id + charges_enabled),
--      l'argent va AU CLUB (destination charges) avec commission plateforme.
--    - Sinon, fallback : Sillance encaisse → la démo fonctionne immédiatement,
--      et la bascule en Connect est automatique dès que le club s'onboarde.
--
--  Écriture des adhésions = SERVICE_ROLE uniquement (le webhook Stripe fait foi).
-- =============================================================================

-- ---- enum des paliers d'offre -------------------------------------------------
do $$ begin
  create type club_offer_tier as enum ('dropin','sub','coach');
exception when duplicate_object then null; end $$;

-- ---- Connect : compte Stripe du club + statut d'encaissement ------------------
alter table clubs
  add column if not exists stripe_account_id text,
  add column if not exists charges_enabled   boolean not null default false;

-- ---- Les 3 formules d'un club (tarifs ÉDITABLES par le club) ------------------
create table if not exists club_offers (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references clubs(id) on delete cascade,
  tier          club_offer_tier not null,
  price         numeric(8,2) not null,            -- en euros
  bill_interval text not null default 'month',    -- 'month' (sub/coach) | 'one_time' (dropin)
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (club_id, tier)
);
create index if not exists idx_club_offers_club on club_offers(club_id);

-- ---- Adhésions récurrentes d'un membre à une formule (sub | coach) ------------
create table if not exists club_memberships (
  id                      uuid primary key default gen_random_uuid(),
  club_id                 uuid not null references clubs(id) on delete cascade,
  member_id               uuid not null references club_members(id) on delete cascade,
  tier                    club_offer_tier not null,
  status                  sub_status not null default 'incomplete',
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  price_id                text,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  updated_at              timestamptz not null default now(),
  created_at              timestamptz not null default now()
);
create index if not exists idx_club_memberships_club   on club_memberships(club_id);
create index if not exists idx_club_memberships_member on club_memberships(member_id);

-- ---- updated_at automatique (réutilise touch_updated_at de 0003) --------------
do $$
declare t text;
begin
  foreach t in array array['club_offers','club_memberships'] loop
    execute format('drop trigger if exists trg_touch_%1$s on %1$s;', t);
    execute format(
      'create trigger trg_touch_%1$s before update on %1$s
       for each row execute function touch_updated_at();', t);
  end loop;
end $$;

-- ---- Vue pratique : adhésions actives ----------------------------------------
create or replace view active_club_memberships as
  select * from club_memberships where status in ('trialing','active');

-- =============================================================================
--  ROW LEVEL SECURITY
-- =============================================================================
alter table club_offers      enable row level security;
alter table club_memberships enable row level security;

-- Offres : lisibles par tous (page de réservation / lien d'invitation),
-- modifiables uniquement par le gérant du club.
drop policy if exists "club_offers: readable"     on club_offers;
drop policy if exists "club_offers: owner writes" on club_offers;
drop policy if exists "club_offers: readable" on club_offers;
create policy "club_offers: readable" on club_offers
  for select using (true);
drop policy if exists "club_offers: owner writes" on club_offers;
create policy "club_offers: owner writes" on club_offers
  for all using (owns_club(club_id)) with check (owns_club(club_id));

-- Adhésions : le gérant voit toutes celles de son club ; le membre voit la sienne.
-- (Aucune policy d'écriture pour les users → seul le service_role/webhook écrit.)
drop policy if exists "club_memberships: owner reads"      on club_memberships;
drop policy if exists "club_memberships: member reads own" on club_memberships;
drop policy if exists "club_memberships: owner reads" on club_memberships;
create policy "club_memberships: owner reads" on club_memberships
  for select using (owns_club(club_id));
drop policy if exists "club_memberships: member reads own" on club_memberships;
create policy "club_memberships: member reads own" on club_memberships
  for select using (
    exists (select 1 from club_members m
            where m.id = club_memberships.member_id and m.athlete_id = auth.uid())
  );

-- =============================================================================
--  SEED : dote chaque club existant des 3 formules par défaut (15 / 59 / 119 €)
-- =============================================================================
insert into club_offers (club_id, tier, price, bill_interval)
select c.id, v.tier, v.price, v.bill_interval
from clubs c
cross join (values
  ('dropin'::club_offer_tier, 15,  'one_time'),
  ('sub'::club_offer_tier,    59,  'month'),
  ('coach'::club_offer_tier,  119, 'month')
) as v(tier, price, bill_interval)
on conflict (club_id, tier) do nothing;


-- ========================= 0007_coach_billing.sql =========================
-- =============================================================================
--  0007_coach_billing.sql
--  Connect au niveau du COACH (profil) : un coach solo encaisse ses athlètes
--  via son propre compte Stripe connecté (en miroir du club, cf. 0006).
--
--  Le statut `charges_enabled` est mis à jour par le webhook (account.updated),
--  qui couvre désormais à la fois les clubs et les coachs (match par account_id).
-- =============================================================================

alter table profiles
  add column if not exists stripe_account_id text,
  add column if not exists charges_enabled   boolean not null default false;


-- ========================= 0008_coach_offers.sql =========================
-- =============================================================================
--  0008_coach_offers.sql
--  Le COACH vend son suivi à ses athlètes (abonnement mensuel récurrent).
--  Boucle la boucle avec 0007 (le coach relie son compte Stripe) :
--    0007 = le coach encaisse (Connect) · 0008 = l'athlète s'abonne au coach.
--
--  Connect-ready : l'argent va au coach si son compte est relié (charges_enabled),
--  sinon fallback Sillance. Écriture des abos = service_role (webhook) only.
-- =============================================================================

-- ---- Offre(s) de coaching d'un coach (tarif éditable) ------------------------
create table if not exists coach_offers (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references profiles(id) on delete cascade,
  name          text not null default 'Suivi coaching',
  price         numeric(8,2) not null,
  bill_interval text not null default 'month',
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists idx_coach_offers_coach on coach_offers(coach_id);

-- ---- Abonnement d'un athlète au suivi d'un coach ----------------------------
create table if not exists coaching_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  coach_id                uuid not null references profiles(id) on delete cascade,
  athlete_id              uuid not null references profiles(id) on delete cascade,
  offer_id                uuid references coach_offers(id) on delete set null,
  status                  sub_status not null default 'incomplete',
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  price_id                text,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  updated_at              timestamptz not null default now(),
  created_at              timestamptz not null default now()
);
create index if not exists idx_coachsub_coach   on coaching_subscriptions(coach_id);
create index if not exists idx_coachsub_athlete on coaching_subscriptions(athlete_id);

-- ---- updated_at (réutilise touch_updated_at de 0003) ------------------------
do $$
declare t text;
begin
  foreach t in array array['coach_offers','coaching_subscriptions'] loop
    execute format('drop trigger if exists trg_touch_%1$s on %1$s;', t);
    execute format(
      'create trigger trg_touch_%1$s before update on %1$s
       for each row execute function touch_updated_at();', t);
  end loop;
end $$;

create or replace view active_coaching_subscriptions as
  select * from coaching_subscriptions where status in ('trialing','active');

-- =============================================================================
--  ROW LEVEL SECURITY
-- =============================================================================
alter table coach_offers           enable row level security;
alter table coaching_subscriptions enable row level security;

-- Offres : lisibles par tous (l'athlète voit l'offre de son coach),
-- modifiables uniquement par le coach lui-même.
drop policy if exists "coach_offers: readable"     on coach_offers;
drop policy if exists "coach_offers: owner writes" on coach_offers;
drop policy if exists "coach_offers: readable" on coach_offers;
create policy "coach_offers: readable" on coach_offers
  for select using (true);
drop policy if exists "coach_offers: owner writes" on coach_offers;
create policy "coach_offers: owner writes" on coach_offers
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- Abonnements : le coach voit les siens, l'athlète voit les siens.
-- (Écriture = service_role/webhook only → aucune policy d'insert/update user.)
drop policy if exists "coaching_subs: coach reads"   on coaching_subscriptions;
drop policy if exists "coaching_subs: athlete reads" on coaching_subscriptions;
drop policy if exists "coaching_subs: coach reads" on coaching_subscriptions;
create policy "coaching_subs: coach reads" on coaching_subscriptions
  for select using (coach_id = auth.uid());
drop policy if exists "coaching_subs: athlete reads" on coaching_subscriptions;
create policy "coaching_subs: athlete reads" on coaching_subscriptions
  for select using (athlete_id = auth.uid());

-- =============================================================================
--  SEED : une offre par défaut (99 €/mois) pour les coachs existants sans offre
-- =============================================================================
insert into coach_offers (coach_id, name, price)
select p.id, 'Suivi coaching', 99
from profiles p
where p.role = 'coach'
  and not exists (select 1 from coach_offers o where o.coach_id = p.id);


-- ========================= 0009_ai_addon.sql =========================
-- =============================================================================
--  0009_ai_addon.sql
--  ADD-ON « Assistant IA » du COACH (option payante séparée, ~12 €/mois).
--  Donne accès au résumé + recommandations automatiques par séance.
--
--  Deux objets :
--    1. ai_addons            = l'entitlement (le coach a-t-il l'add-on actif ?)
--                             écrit UNIQUEMENT par le webhook Stripe (vérité).
--    2. session_summaries    = cache des résumés déjà générés par le modèle IA
--                             (1 appel API max par séance, jamais recalculé).
--  Voir aussi SILLANCE-AI-ADDON-PLAN.md (coût/marge/justification du prix).
-- =============================================================================

-- ---- Entitlement add-on IA (par coach) --------------------------------------
create table if not exists ai_addons (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references profiles(id) on delete cascade,
  status                  sub_status not null default 'incomplete',
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  price_id                text,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  updated_at              timestamptz not null default now(),
  created_at              timestamptz not null default now()
);
-- non-unique (cohérent avec idx_subs_user) : on garde l'historique des abos ;
-- l'upsert se fait sur stripe_subscription_id, l'« actif ? » via has_ai_addon().
create index if not exists idx_ai_addons_user on ai_addons(user_id);

-- ---- Cache des résumés générés ----------------------------------------------
-- session_key = identifiant stable de la séance (scheduled_session.id si en base,
-- sinon un hash fourni par le front pour les séances démo).
create table if not exists session_summaries (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references profiles(id) on delete cascade,
  athlete_id    uuid references profiles(id) on delete set null,
  session_key   text not null,
  discipline    discipline,
  objective     text,
  bilan         jsonb not null,          -- le payload chiffré envoyé au modèle
  verdict       text,                    -- oui | partiel | non
  headline      text,
  bullets       jsonb,
  recos         jsonb,
  model         text,                    -- identifiant du modèle utilisé
  created_at    timestamptz not null default now(),
  unique (coach_id, session_key)
);
create index if not exists idx_summaries_coach on session_summaries(coach_id);

-- ---- Helper : le coach a-t-il l'add-on IA actif ? ---------------------------
create or replace function has_ai_addon(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from ai_addons
    where user_id = uid
      and status in ('active', 'trialing')
      and (current_period_end is null or current_period_end > now())
  );
$$;

-- ---- RLS ---------------------------------------------------------------------
alter table ai_addons         enable row level security;
alter table session_summaries enable row level security;

-- l'add-on : le coach lit le sien ; écriture = service_role (webhook) uniquement.
drop policy if exists ai_addons_owner_read on ai_addons;
create policy ai_addons_owner_read on ai_addons
  for select using (user_id = auth.uid());

-- les résumés : le coach lit/écrit les siens ; l'athlète concerné peut lire.
drop policy if exists summaries_coach_all on session_summaries;
create policy summaries_coach_all on session_summaries
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

drop policy if exists summaries_athlete_read on session_summaries;
create policy summaries_athlete_read on session_summaries
  for select using (athlete_id = auth.uid());

-- updated_at auto sur ai_addons
drop trigger if exists trg_ai_addons_updated on ai_addons;
create trigger trg_ai_addons_updated before update on ai_addons
  for each row execute function touch_updated_at();


-- ========================= 0010_strava_tos.sql =========================
-- =============================================================================
--  0010_strava_tos.sql  —  CONFORMITÉ aux conditions Strava (MAJ nov. 2024)
--  -----------------------------------------------------------------------------
--  L'API Strava INTERDIT de montrer les données d'un athlète à un tiers (son
--  coach). Or la policy "extact: coach read" (0005) laissait le coach lire TOUTES
--  les activités de l'athlète, y compris celles d'origine Strava → non conforme.
--
--  Correctif (le garde-fou est ici, au niveau base, pas seulement dans l'UI) :
--    • le coach ne peut PLUS lire les activités dont provider = 'strava' ;
--    • Garmin / Coros / upload de fichier (.FIT/.TCX/.GPX) restent partageables
--      avec le coach — ce sont les canaux autorisés pour le cas d'usage coaching.
--  L'athlète, lui, voit toujours TOUTES ses activités (Strava inclus, pour son
--  usage perso) via la policy "extact: self read" inchangée.
-- =============================================================================

-- Nouveau canal : fichiers importés manuellement (Garmin/Coros/montre → .FIT/.TCX/.GPX).
-- Distinct de 'strava' → visible par le coach. (PG15 : ADD VALUE hors usage immédiat = OK)
alter type device_provider add value if not exists 'upload';

-- Restreint la lecture coach : tout SAUF Strava.
drop policy if exists "extact: coach read" on external_activities;
create policy "extact: coach read" on external_activities
  for select using (is_coach_of(user_id) and provider <> 'strava');


-- ========================= 0013_gear_catalog.sql =========================
-- =============================================================================
--  0013_gear_catalog.sql — Catégorie + prix pour le catalogue de chaussures
--  -----------------------------------------------------------------------------
--  La vraie table `gear` (migration 0012_gear.sql, ~/pairform-backend) existe
--  déjà en prod : id, athlete_id, type, name, brand, km, max_km, notified
--  (int[]), retired, created_at/updated_at, RLS (athlète propriétaire + coach
--  lecture seule). Ce bloc ajoute seulement les 2 colonnes du catalogue :
--    • cat   : catégorie du modèle (daily/tempo/race/trail — chaussures only),
--              alimente le conseiller de paire et le garde-fou pré-course.
--    • price : prix d'achat, pour le coût au kilomètre affiché côté app.
--  Le "km de retrait moyen communauté" reste un attribut du catalogue côté
--  client (SHOE_CATALOG), pas une colonne : il évolue avec le catalogue, pas
--  avec l'équipement d'un athlète donné.
--  Fichier miroir de ~/pairform-backend/supabase/migrations/0013_gear_catalog.sql
--  (source de vérité = le repo back-end).
-- =============================================================================
alter table gear add column if not exists cat   text;
alter table gear add column if not exists price numeric;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'gear_cat_check') then
    alter table gear add constraint gear_cat_check check (cat in ('daily','tempo','race','trail'));
  end if;
end $$;

