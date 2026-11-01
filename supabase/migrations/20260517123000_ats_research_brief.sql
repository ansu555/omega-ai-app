-- ============================================================
-- ATS RESEARCH BRIEF EXTENSIONS
-- ============================================================
--
-- Adds first-class prompt and report fields to public.ats_receipts so the
-- research UI can reopen a completed run without recomputing the agent brief.
-- ============================================================

ALTER TABLE public.ats_receipts
  ADD COLUMN IF NOT EXISTS query TEXT,
  ADD COLUMN IF NOT EXISTS research_brief JSONB,
  ADD COLUMN IF NOT EXISTS proof_ref TEXT;

COMMENT ON COLUMN public.ats_receipts.query IS
  'The original user research prompt that initiated the ATS run.';

COMMENT ON COLUMN public.ats_receipts.research_brief IS
  'Structured report-first summary rendered by the research dock UI.';

COMMENT ON COLUMN public.ats_receipts.proof_ref IS
  'Optional 0G Compute proof reference when a future run returns one.';
