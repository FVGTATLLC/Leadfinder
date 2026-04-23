-- Idempotent migration: add last_active_at column if missing.
-- Safe to run multiple times.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
