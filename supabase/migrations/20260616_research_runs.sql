-- ============================================================
-- DEEP RESEARCH — durable runs + replayable event log (P5)
-- ============================================================
--
-- Backs the long-running Deep Research brain (lib/research/lead.ts) run as a
-- durable background job (lib/research/run-manager.ts). A run can exceed the
-- serverless ceiling and a client can disconnect and reconnect; these tables
-- make the run's RunEvent stream durable and REPLAYABLE.
--
--   research_runs   — one row per run: status, query, the final ResearchReport
--                     (P4), and the 0G Storage root hash of the report blob.
--   research_events — append-only RunEvent log keyed by (run_id, seq); a
--                     reconnecting client replays events with seq > afterSeq.
--
-- Writes go through lib/research/run-store.ts (service role only). Distinct from
-- public.ats_receipts, which stores the legacy single-asset ATS decisions.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.research_runs (
  run_id            TEXT        NOT NULL PRIMARY KEY,
  user_wallet       TEXT
    CONSTRAINT research_runs_user_lowercase
      CHECK (user_wallet IS NULL OR user_wallet = lower(user_wallet)),
  query             TEXT,
  query_type        TEXT,
  status            TEXT        NOT NULL DEFAULT 'running'
    CONSTRAINT research_runs_status_check
      CHECK (status IN ('running', 'done', 'error')),
  chain_id          INT,
  report            JSONB,
  storage_root_hash TEXT,
  proof_ref         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.research_runs                   IS 'Deep Research runs (durable background jobs). One row per run.';
COMMENT ON COLUMN public.research_runs.run_id            IS 'Unique id of the Deep Research SSE run (matches RunEvent.run_id).';
COMMENT ON COLUMN public.research_runs.user_wallet       IS 'Lowercase EVM address that started the run (NULL if anonymous). Gates reconnect.';
COMMENT ON COLUMN public.research_runs.query_type        IS 'Intake classification: asset_deep_dive | allocation | market_overview | comparison | defi_yield | conceptual.';
COMMENT ON COLUMN public.research_runs.status            IS 'Lifecycle: running | done | error.';
COMMENT ON COLUMN public.research_runs.report            IS 'The full cited ResearchReport (P4) once composed; NULL while running / on failure.';
COMMENT ON COLUMN public.research_runs.storage_root_hash IS 'Content-addressed root hash of the report blob on 0G Storage (best-effort).';
COMMENT ON COLUMN public.research_runs.proof_ref         IS '0G sealed-attestation reference for the report summary (P6).';

CREATE TABLE IF NOT EXISTS public.research_events (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id      TEXT        NOT NULL
    REFERENCES public.research_runs(run_id) ON DELETE CASCADE,
  seq         INT         NOT NULL,
  type        TEXT        NOT NULL,
  event       JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT research_events_run_seq_unique UNIQUE (run_id, seq)
);

COMMENT ON TABLE  public.research_events        IS 'Append-only RunEvent log for Deep Research runs. Replayed on reconnect by (run_id, seq).';
COMMENT ON COLUMN public.research_events.seq    IS 'Monotonic per-run sequence number assigned by the run manager. Client resumes from afterSeq.';
COMMENT ON COLUMN public.research_events.type   IS 'RunEvent.type (denormalised for cheap filtering).';
COMMENT ON COLUMN public.research_events.event  IS 'The full serialised RunEvent.';

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_research_runs_user_wallet
  ON public.research_runs(user_wallet);

CREATE INDEX IF NOT EXISTS idx_research_runs_created_at
  ON public.research_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_events_run_seq
  ON public.research_events(run_id, seq);

-- ── Row Level Security ─────────────────────────────────────
-- Writes go through the service role (run-store.ts); no client write policy.
ALTER TABLE public.research_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_events ENABLE ROW LEVEL SECURITY;

-- Owner read (server sets app.wallet via SET LOCAL when querying as a user).
CREATE POLICY "research_runs: owner read"
  ON public.research_runs FOR SELECT
  USING (user_wallet = lower(current_setting('app.wallet', true)));

CREATE POLICY "research_events: owner read"
  ON public.research_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.research_runs r
      WHERE r.run_id = research_events.run_id
        AND r.user_wallet = lower(current_setting('app.wallet', true))
    )
  );

-- ── updated_at maintenance ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.research_runs_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_research_runs_updated_at ON public.research_runs;
CREATE TRIGGER trg_research_runs_updated_at
  BEFORE UPDATE ON public.research_runs
  FOR EACH ROW EXECUTE FUNCTION public.research_runs_touch_updated_at();

-- ============================================================
-- DONE
-- ============================================================
