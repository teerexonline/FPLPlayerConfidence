-- Migration 0003: per-user watchlist uniqueness
--
-- Problem: addForAuthUser used user_id = 1 for every authenticated user.
-- The PRIMARY KEY (user_id, player_id) is therefore a global singleton per
-- player — only ONE user can ever have a given player_id in their watchlist.
-- Any subsequent user (or re-add after the auth migration) silently fails
-- via ON CONFLICT (user_id, player_id) DO NOTHING.
--
-- Fix: create a partial UNIQUE index on (auth_user_id, player_id) scoped to
-- non-null auth_user_id values. This gives each authenticated user their own
-- per-player uniqueness scope, independent of user_id.
--
-- The INSERT in addForAuthUser now uses hashtext(auth_user_id) as user_id,
-- so each auth user occupies a distinct (user_id, player_id) PK namespace.
-- Existing rows with user_id = 1 remain valid and are still returned by
-- findByAuthUser (which queries by auth_user_id, not user_id).

CREATE UNIQUE INDEX IF NOT EXISTS watchlist_auth_user_player_unique
  ON watchlist (auth_user_id, player_id)
  WHERE auth_user_id IS NOT NULL;
