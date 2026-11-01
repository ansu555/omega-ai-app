-- ============================================================
-- USER SETTINGS — per-user agent configuration
-- ============================================================
--
-- Stores the user's OpenRouter API key (encrypted), preferred LLM
-- model, and trading mode for the ATS research co-pilot.
--
-- The API key is encrypted server-side with AES-256-GCM using
-- AGENT_WALLET_MASTER_KEY before storage (same key as agent_wallets).
-- If api_key_ct is NULL, the server falls back to the env-level
-- OPENROUTER_API_KEY.
--
-- mode values:
--   autonomous — full pipeline runs; execution agent signs & submits
--                the swap automatically on consensus + risk approval.
--   assisted   — pipeline runs; user sees a research dossier +
--                one-click "Approve & Execute" button before any trade.
--   solo       — research-only; no execution agent invoked; minimal
--                audit receipt written for Memory Module comparison.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_wallet  TEXT        NOT NULL PRIMARY KEY
    CONSTRAINT user_settings_user_lowercase
      CHECK (user_wallet = lower(user_wallet)),
  api_key_ct   TEXT,
  api_key_iv   TEXT,
  api_key_tag  TEXT,
  model        TEXT        NOT NULL DEFAULT 'anthropic/claude-sonnet-4-5',
  mode         TEXT        NOT NULL DEFAULT 'assisted'
    CONSTRAINT user_settings_mode_check
      CHECK (mode IN ('autonomous', 'assisted', 'solo')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.user_settings              IS 'Per-user agent configuration: encrypted OpenRouter API key, preferred LLM model, and trading mode.';
COMMENT ON COLUMN public.user_settings.user_wallet  IS 'Lowercase EVM address of the user.';
COMMENT ON COLUMN public.user_settings.api_key_ct   IS 'Hex-encoded AES-256-GCM ciphertext of the user''s OpenRouter API key. NULL = use server fallback key.';
COMMENT ON COLUMN public.user_settings.api_key_iv   IS 'Hex-encoded 12-byte GCM IV used to encrypt the API key.';
COMMENT ON COLUMN public.user_settings.api_key_tag  IS 'Hex-encoded 16-byte GCM auth tag for the encrypted API key.';
COMMENT ON COLUMN public.user_settings.model        IS 'OpenRouter model slug. E.g. anthropic/claude-sonnet-4-5, google/gemini-2.5-flash-lite, openai/gpt-4o.';
COMMENT ON COLUMN public.user_settings.mode         IS 'Trading mode: autonomous | assisted | solo.';

-- ── Auto-update updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_user_settings_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_user_settings_updated_at();

-- ── Row Level Security ─────────────────────────────────────
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users may read their own settings (the server sets app.wallet via SET LOCAL)
DROP POLICY IF EXISTS "user_settings: owner read" ON public.user_settings;
CREATE POLICY "user_settings: owner read"
  ON public.user_settings FOR SELECT
  USING (user_wallet = lower(current_setting('app.wallet', true)));

-- Only the service role (backend API) may insert or update settings.
-- No client-facing write policy — writes must go through /api/user-settings.

-- ============================================================
-- DONE
-- ============================================================
