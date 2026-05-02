-- Phase 4: Row-Level Security for Supabase Auth
-- File: 0002_phase4_auth_rls.sql
--
-- Idempotent: safe to re-apply. All policy changes use DROP IF EXISTS then CREATE.
-- Apply as the postgres user (BYPASSRLS=true) or service_role.
--
-- Overview:
--   1. players, teams, confidence_snapshots → public SELECT; service-role writes
--   2. sync_meta, users, manager_squads    → service-role only (no permissive policies)
--   3. watchlist                           → auth_user_id column + user-scoped policies
--   4. user_profiles                       → new table; SELECT + UPDATE policies only
--
-- NOTE on GRANTs: RLS policies restrict which rows a role can see, but the role
-- must first have table-level privileges to access the table at all. These GRANTs
-- are idempotent (GRANT IF NOT EXISTS is not valid SQL; re-granting existing
-- privileges is a no-op in PostgreSQL).


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Schema and table grants
--    Ensure anon/authenticated/service_role have the minimum required privileges.
--    postgres (the superuser) owns all tables and already has full access.
-- ─────────────────────────────────────────────────────────────────────────────

-- Schema usage: required before any table access is possible.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- service_role gets full access to every table (BYPASSRLS + operational writes).
GRANT ALL ON TABLE players, teams, confidence_snapshots, sync_meta, users, manager_squads, watchlist TO service_role;

-- anon and authenticated: public read tables only.
GRANT SELECT ON TABLE players              TO anon, authenticated;
GRANT SELECT ON TABLE teams                TO anon, authenticated;
GRANT SELECT ON TABLE confidence_snapshots TO anon, authenticated;

-- watchlist: authenticated users can manage their own rows (SELECT, INSERT, DELETE).
-- anon has no grant here — the RLS policies would block them anyway, but no
-- table-level privilege means PostgREST returns 42501 before RLS is even checked.
GRANT SELECT, INSERT, DELETE ON TABLE watchlist TO authenticated;

-- user_profiles: authenticated users can SELECT and UPDATE their own row.
-- No INSERT grant — profile creation is service_role only.
GRANT SELECT, UPDATE ON TABLE user_profiles TO authenticated;
-- service_role also needs INSERT/DELETE for profile lifecycle management.
GRANT ALL ON TABLE user_profiles TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Public read-only tables
--    Anonymous and authenticated clients may read freely.
--    Writes are exclusively via the cron sync pipeline (postgres / service_role,
--    both of which have BYPASSRLS=true).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE players              ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS players_public_read              ON players;
DROP POLICY IF EXISTS teams_public_read                ON teams;
DROP POLICY IF EXISTS confidence_snapshots_public_read ON confidence_snapshots;

CREATE POLICY players_public_read
  ON players FOR SELECT USING (true);

CREATE POLICY teams_public_read
  ON teams FOR SELECT USING (true);

CREATE POLICY confidence_snapshots_public_read
  ON confidence_snapshots FOR SELECT USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Service-role-only tables
--    No permissive SELECT policy → anonymous and authenticated clients receive
--    zero rows on SELECT and permission-denied on writes.
--    Only roles with BYPASSRLS (postgres, service_role) can read or write.
--
--    manager_squads note: intentionally ungated in Phase 4. The table is a
--    global FPL squad cache keyed on (team_id, gameweek, squad_position); the
--    vestigial user_id column will be removed in a future migration once the
--    My Team feature is re-architected around auth_user_id in user_profiles.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sync_meta      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_squads ENABLE ROW LEVEL SECURITY;

-- No CREATE POLICY statements for these tables — that is the intent.


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. watchlist — add auth column and user-scoped policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Link each watchlist row to a Supabase auth identity.
-- ON DELETE CASCADE keeps the table clean when a user deletes their account.
-- IF NOT EXISTS makes this idempotent.
ALTER TABLE watchlist
  ADD COLUMN IF NOT EXISTS auth_user_id UUID
    REFERENCES auth.users (id) ON DELETE CASCADE;

-- Efficient per-user scans for the SELECT policy evaluation.
CREATE INDEX IF NOT EXISTS idx_watchlist_auth_user ON watchlist (auth_user_id);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watchlist_select ON watchlist;
DROP POLICY IF EXISTS watchlist_insert ON watchlist;
DROP POLICY IF EXISTS watchlist_delete ON watchlist;

CREATE POLICY watchlist_select
  ON watchlist FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY watchlist_insert
  ON watchlist FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY watchlist_delete
  ON watchlist FOR DELETE
  USING (auth.uid() = auth_user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. user_profiles — create table and add per-user policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  -- Primary key is the Supabase auth UUID, not the legacy INTEGER user.id.
  user_id        UUID        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Nullable until the user connects their FPL account via Settings.
  fpl_manager_id INTEGER,
  display_name   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select ON user_profiles;
DROP POLICY IF EXISTS user_profiles_update ON user_profiles;

-- Users may only read their own profile row.
CREATE POLICY user_profiles_select
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users may only update their own profile row.
-- Server actions validate the payload before calling Supabase; no column
-- restrictions here — the application layer enforces what fields are mutable.
CREATE POLICY user_profiles_update
  ON user_profiles FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No INSERT policy: only service_role (BYPASSRLS) may create profiles.
-- Profile creation is performed by a server action using the service-role client
-- immediately after a successful Supabase Auth sign-up.
-- Omitting the INSERT policy means anon and authenticated roles get
-- "permission denied" on INSERT — this is the desired behaviour.
