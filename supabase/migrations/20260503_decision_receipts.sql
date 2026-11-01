-- ============================================================
-- ATS DECISION RECEIPTS — dedicated table for ATS research runs
-- ============================================================
--
-- Separate from the marketplace public.decision_receipts table
-- (which has NOT NULL FK constraints on strategy_version_id).
-- ATS receipts are produced by the research co-pilot pipeline
-- (lib/ats/orchestrator.ts) and mirror doc § 3.1 fields.
--
-- Fields:
--   TRIGGER · SOURCE · AGENT VOTES · REGIME ·
--   CAUSAL CHAIN · RISK SIZING · CONSENSUS · TX HASH
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ats_receipts (
  id                 UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             TEXT        NOT NULL UNIQUE,
  user_wallet        TEXT        NOT NULL
    CONSTRAINT ats_receipts_user_lowercase
      CHECK (user_wallet = lower(user_wallet)),
  ticker             TEXT        NOT NULL,
  trigger_type       TEXT        NOT NULL DEFAULT 'user_query'
    CONSTRAINT ats_receipts_trigger_check
      CHECK (trigger_type IN ('user_query', 'scheduled', 'alert')),
  chain_id           INT         NOT NULL DEFAULT 16600,
  tx_hash            TEXT,
  storage_root_hash  TEXT,
  agent_votes        JSONB,
  regime             TEXT,
  causal_chain       JSONB,
  risk_sizing        JSONB,
  consensus          JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.ats_receipts                   IS 'Decision receipts produced by the ATS research co-pilot pipeline. Separate from marketplace strategy receipts.';
COMMENT ON COLUMN public.ats_receipts.run_id            IS 'Unique identifier for the ATS SSE run that produced this receipt.';
COMMENT ON COLUMN public.ats_receipts.user_wallet       IS 'Lowercase EVM address of the user who initiated this ATS run.';
COMMENT ON COLUMN public.ats_receipts.ticker            IS 'Primary asset ticker analysed (e.g. BTC, ETH).';
COMMENT ON COLUMN public.ats_receipts.trigger_type      IS 'What initiated the run: user_query | scheduled | alert.';
COMMENT ON COLUMN public.ats_receipts.chain_id          IS 'EVM chain ID on which the trade was (or would have been) executed. 16600 = 0G Newton Testnet.';
COMMENT ON COLUMN public.ats_receipts.tx_hash           IS 'On-chain transaction hash if execution occurred.';
COMMENT ON COLUMN public.ats_receipts.storage_root_hash IS 'Content-addressed root hash of the full receipt blob on 0G Storage. NULL until upload completes.';
COMMENT ON COLUMN public.ats_receipts.agent_votes       IS 'Array of {agent, vote, confidence, rationale} objects from all 6 ATS agents.';
COMMENT ON COLUMN public.ats_receipts.regime            IS 'Market regime label: bull_trending | bull_volatile | bear_trending | bear_volatile | sideways | accumulation | distribution.';
COMMENT ON COLUMN public.ats_receipts.causal_chain      IS 'Active causal chains identified by the Signal Agent.';
COMMENT ON COLUMN public.ats_receipts.risk_sizing       IS 'Position sizing output: {kelly_fraction, size_usd, max_loss_usd, veto_triggered}.';
COMMENT ON COLUMN public.ats_receipts.consensus         IS 'Final orchestrator consensus: {decision, confidence, rationale, approved_by, vetoed_by}.';

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ats_receipts_user_wallet
  ON public.ats_receipts(user_wallet);

CREATE INDEX IF NOT EXISTS idx_ats_receipts_run_id
  ON public.ats_receipts(run_id);

CREATE INDEX IF NOT EXISTS idx_ats_receipts_ticker
  ON public.ats_receipts(ticker);

CREATE INDEX IF NOT EXISTS idx_ats_receipts_created_at
  ON public.ats_receipts(created_at DESC);

-- ── Row Level Security ─────────────────────────────────────
ALTER TABLE public.ats_receipts ENABLE ROW LEVEL SECURITY;

-- Users may read their own receipts (server sets app.wallet via SET LOCAL)
CREATE POLICY "ats_receipts: owner read"
  ON public.ats_receipts FOR SELECT
  USING (user_wallet = lower(current_setting('app.wallet', true)));

-- Only service role may write
-- (No client-facing write policy — writes go through /api/research/run)

-- ============================================================
-- DONE
-- ============================================================
