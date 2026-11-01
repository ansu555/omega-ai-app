-- ============================================================
-- AGENT WALLETS — server-managed burner EOA per user
-- ============================================================
--
-- Each authenticated user gets exactly one agent burner wallet
-- per chain. The private key is encrypted with AES-256-GCM
-- using the server-side AGENT_WALLET_MASTER_KEY before storage.
-- Plaintext private keys NEVER touch the database.
--
-- Key fields:
--   user_wallet   — the user's connected EVM address (PK)
--   agent_address — the derived burner EOA address (unique)
--   ciphertext    — hex-encoded AES-256-GCM ciphertext of the raw private key
--   iv            — hex-encoded 12-byte GCM initialisation vector
--   auth_tag      — hex-encoded 16-byte GCM authentication tag
--   chain_id      — default chain for this agent wallet (0G Newton = 16600)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_wallets (
  user_wallet    TEXT        NOT NULL PRIMARY KEY
    CONSTRAINT agent_wallets_user_lowercase
      CHECK (user_wallet = lower(user_wallet)),
  agent_address  TEXT        NOT NULL UNIQUE
    CONSTRAINT agent_wallets_agent_lowercase
      CHECK (agent_address = lower(agent_address)),
  ciphertext     TEXT        NOT NULL,
  iv             TEXT        NOT NULL,
  auth_tag       TEXT        NOT NULL,
  chain_id       INT         NOT NULL DEFAULT 16600,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.agent_wallets                  IS 'Server-managed burner EOA wallets for autonomous agent execution. Private keys stored encrypted with AES-256-GCM.';
COMMENT ON COLUMN public.agent_wallets.user_wallet      IS 'Lowercase EVM address of the authenticated user who owns this agent wallet.';
COMMENT ON COLUMN public.agent_wallets.agent_address    IS 'Lowercase EVM address of the generated burner wallet. Used as the execution signer.';
COMMENT ON COLUMN public.agent_wallets.ciphertext       IS 'Hex-encoded AES-256-GCM ciphertext of the private key (without 0x prefix).';
COMMENT ON COLUMN public.agent_wallets.iv               IS 'Hex-encoded 12-byte GCM IV used during encryption.';
COMMENT ON COLUMN public.agent_wallets.auth_tag         IS 'Hex-encoded 16-byte GCM authentication tag for tamper detection.';
COMMENT ON COLUMN public.agent_wallets.chain_id         IS 'Default chain ID for this agent wallet. 16600 = 0G Newton Testnet.';

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agent_wallets_agent_address
  ON public.agent_wallets(agent_address);

-- ── Row Level Security ─────────────────────────────────────
ALTER TABLE public.agent_wallets ENABLE ROW LEVEL SECURITY;

-- Only the service role (backend API) may read/write agent wallets.
-- No client-facing policies — all access must go through the API routes.

-- ============================================================
-- DONE
-- ============================================================
