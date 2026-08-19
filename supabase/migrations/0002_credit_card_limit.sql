-- ============================================================================
-- Phase 1 — Credit Card Foundation.
-- Adds `credit_limit` to accounts. Run once against an existing project that
-- was already provisioned from an earlier copy of schema.sql (a fresh
-- install using the current schema.sql already has this column).
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.accounts
  add column if not exists credit_limit numeric(14, 2);
