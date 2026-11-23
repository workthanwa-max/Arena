-- PulseArena PostgreSQL Schema Migration 003:
-- Role column on users for exclusive Admin characters & privileges

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player';
