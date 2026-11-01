-- ============================================================
-- MARKETPLACE PAYMENTS — Pricing, 0G Storage hash, Purchases
-- ============================================================

-- ── Pricing columns on strategies ─────────────────────────────
ALTER TABLE public.strategies
  ADD COLUMN IF NOT EXISTS is_free        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS price_amount   NUMERIC          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_token    TEXT             DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS payout_wallet  TEXT;

COMMENT ON COLUMN public.strategies.is_free       IS 'true = no purchase required; false = buyer must pay before activation';
COMMENT ON COLUMN public.strategies.price_amount  IS 'Amount in price_token units (e.g. 2.0 for 2 USDC)';
COMMENT ON COLUMN public.strategies.price_token   IS 'Token ticker: ''free'' | ''OG'' | ''USDC''';
COMMENT ON COLUMN public.strategies.payout_wallet IS 'EVM address that receives purchase proceeds. Defaults to creator wallet at publish time.';

-- ── 0G root hash on strategy_versions ────────────────────────
-- Replaces storing the raw payload in the payload column.
-- The payload column now holds only { encrypted: true, rootHash }
-- while the actual ciphertext lives on 0G Storage.
ALTER TABLE public.strategy_versions
  ADD COLUMN IF NOT EXISTS zerog_root_hash TEXT;

COMMENT ON COLUMN public.strategy_versions.zerog_root_hash IS 'Content-addressed root hash of the AES-256-GCM encrypted strategy blob on 0G Storage. Null for legacy unencrypted versions.';

-- ── strategy_purchases ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.strategy_purchases (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet         TEXT        NOT NULL
    CONSTRAINT strategy_purchases_user_lowercase
      CHECK (user_wallet = lower(user_wallet)),
  strategy_id         UUID        NOT NULL
    REFERENCES public.strategies(id) ON DELETE CASCADE,
  strategy_version_id UUID
    REFERENCES public.strategy_versions(id) ON DELETE SET NULL,
  tx_hash             TEXT        NOT NULL UNIQUE,
  amount_paid         NUMERIC,
  token_paid          TEXT,
  chain_id            INT,
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.strategy_purchases                  IS 'On-chain payment records for paid strategy acquisitions.';
COMMENT ON COLUMN public.strategy_purchases.tx_hash          IS 'EVM transaction hash of the buyer''s payment, used for on-chain verification.';
COMMENT ON COLUMN public.strategy_purchases.verified_at      IS 'Set by the server after viem getTransactionReceipt confirms the payment.';

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_purchases_user_wallet
  ON public.strategy_purchases(user_wallet);

CREATE INDEX IF NOT EXISTS idx_purchases_strategy_id
  ON public.strategy_purchases(strategy_id);

CREATE INDEX IF NOT EXISTS idx_purchases_tx_hash
  ON public.strategy_purchases(tx_hash);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.strategy_purchases ENABLE ROW LEVEL SECURITY;

-- Buyers can read their own purchases
CREATE POLICY "purchases: owner read"
  ON public.strategy_purchases FOR SELECT
  USING (user_wallet = lower(current_setting('app.wallet', true)));

-- Only the service role (backend) may insert purchases (after on-chain verification)
-- No user-facing insert policy — inserts must go through the API route.

-- ============================================================
-- DONE
-- ============================================================
