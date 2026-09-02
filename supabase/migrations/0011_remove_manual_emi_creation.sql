-- Phase 12 — Remove the manual EMI creation entry point.
--
-- Existing emi_plans / emi_installments records are intentionally preserved.
-- This only removes the RPC that allowed users to create new manual EMI plans.
-- The normal convert-to-EMI flow and all existing EMI payment/preclosure
-- operations remain unchanged. The Phase 11 columns remain so any existing
-- manually-registered plans continue to render and function safely.

drop function if exists public.create_manual_emi_plan(
  uuid, text, numeric, numeric, int, numeric, numeric, numeric, date
);
