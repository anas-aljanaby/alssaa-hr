-- ============================================================
-- ALSSAA HR — Reseed Demo Data (Convenience Script)
-- Runs:
--   1) 003_reset_demo_data.sql
--   2) 004_seed_demo.sql
--
-- Usage (from repo root, with psql pointing at your DB):
--   psql "$DATABASE_URL" -f supabase/reseed_demo_data.sql
--
-- This is just a thin wrapper around the existing reset + seed scripts.
-- ============================================================

\ir migrations/003_reset_demo_data.sql
\ir migrations/004_seed_demo.sql

