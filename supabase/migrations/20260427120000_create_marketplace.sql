-- ============================================================
-- ATS MARKETPLACE — COMPLETE SCHEMA WITH RLS
-- Copy paste entire block into Supabase SQL Editor
-- Click "Run and enable RLS" when prompted
-- ============================================================

-- ── Helper: auto-update updated_at ──────────────────────────
create or replace function public.set_updated_at_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- TABLES
-- ============================================================

-- ── Creators ─────────────────────────────────────────────────
create table if not exists public.creators (
  wallet_address text primary key
    constraint creators_wallet_lowercase check (wallet_address = lower(wallet_address)),
  handle         text,
  bio            text,
  accepted_terms_at timestamptz,
  created_at     timestamptz not null default now()
);

-- ── Strategies ───────────────────────────────────────────────
create table if not exists public.strategies (
  id                  uuid primary key default gen_random_uuid(),
  creator_wallet      text not null references public.creators(wallet_address) on delete cascade,
  name                text not null,
  slug                text unique,
  description         text not null default '',
  tags                jsonb not null default '[]'::jsonb,
  asset_pairs         jsonb not null default '[]'::jsonb,
  risk_level          text not null default 'medium',
  status              text not null default 'draft'
    constraint strategies_status_check check (
      status in (
        'draft', 'validated', 'published', 'paper_only', 'live_eligible',
        'watch', 'paused', 'delisted'
      )
    ),
  current_version_id  uuid,
  draft_payload       jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Strategy Versions ────────────────────────────────────────
create table if not exists public.strategy_versions (
  id               uuid primary key default gen_random_uuid(),
  strategy_id      uuid not null references public.strategies(id) on delete cascade,
  version_number   int not null,
  payload          jsonb not null default '{}'::jsonb,
  human_summary    text,
  validation_status text not null default 'pending'
    constraint strategy_versions_validation_check check (
      validation_status in ('pending', 'passed', 'failed')
    ),
  created_at       timestamptz not null default now(),
  unique (strategy_id, version_number)
);

-- ── FK: strategies → current version (added after versions table) ──
alter table public.strategies
  drop constraint if exists strategies_current_version_fk;

alter table public.strategies
  add constraint strategies_current_version_fk
  foreign key (current_version_id)
  references public.strategy_versions(id)
  on delete set null;

-- ── Indicators ───────────────────────────────────────────────
create table if not exists public.indicators (
  id                 uuid primary key default gen_random_uuid(),
  creator_wallet     text not null references public.creators(wallet_address) on delete cascade,
  name               text not null,
  slug               text unique,
  description        text not null default '',
  output_type        text not null default 'scalar'
    constraint indicators_output_type_check check (
      output_type in ('scalar', 'boolean', 'direction')
    ),
  status             text not null default 'draft'
    constraint indicators_status_check check (
      status in ('draft', 'published', 'paused', 'delisted')
    ),
  current_version_id uuid,
  draft_payload      jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Indicator Versions ───────────────────────────────────────
create table if not exists public.indicator_versions (
  id               uuid primary key default gen_random_uuid(),
  indicator_id     uuid not null references public.indicators(id) on delete cascade,
  version_number   int not null,
  payload          jsonb not null default '{}'::jsonb,
  input_schema     jsonb not null default '[]'::jsonb,
  output_handle    text not null default 'out',
  created_at       timestamptz not null default now(),
  unique (indicator_id, version_number)
);

-- ── FK: indicators → current version ────────────────────────
alter table public.indicators
  drop constraint if exists indicators_current_version_fk;

alter table public.indicators
  add constraint indicators_current_version_fk
  foreign key (current_version_id)
  references public.indicator_versions(id)
  on delete set null;

-- ── Strategy ↔ Indicator Dependencies ───────────────────────
create table if not exists public.strategy_indicator_dependencies (
  strategy_version_id  uuid not null references public.strategy_versions(id) on delete cascade,
  indicator_version_id uuid not null references public.indicator_versions(id) on delete cascade,
  primary key (strategy_version_id, indicator_version_id)
);

-- ── Activations ──────────────────────────────────────────────
create table if not exists public.activations (
  id                    uuid primary key default gen_random_uuid(),
  user_wallet           text not null
    constraint activations_user_lowercase check (user_wallet = lower(user_wallet)),
  strategy_id           uuid not null references public.strategies(id) on delete cascade,
  strategy_version_id   uuid not null references public.strategy_versions(id) on delete cascade,
  mode                  text not null default 'live'
    constraint activations_mode_check check (mode in ('live', 'research', 'paper')),
  allocation_pct        numeric not null default 5,
  max_position_pct      numeric not null default 2,
  max_trades_per_day    int not null default 3,
  max_daily_loss_pct    numeric not null default 3,
  slippage_bps          int not null default 75,
  requires_confirmation boolean not null default true,
  status                text not null default 'active'
    constraint activations_status_check check (
      status in ('active', 'paused', 'blocked', 'completed')
    ),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── Decision Receipts ────────────────────────────────────────
create table if not exists public.decision_receipts (
  id                   uuid primary key default gen_random_uuid(),
  activation_id        uuid references public.activations(id) on delete set null,
  strategy_version_id  uuid not null references public.strategy_versions(id) on delete cascade,
  mode                 text not null default 'live',
  asset_pair           text,
  signal               jsonb,
  input_snapshot       jsonb,
  risk_checks          jsonb,
  execution_request    jsonb,
  execution_result     jsonb,
  status               text not null default 'pending',
  failure_reason       text,
  tx_hash              text,
  fees_native          text,
  slippage_bps_actual  int,
  pnl_native           text,
  opened_at            timestamptz not null default now(),
  closed_at            timestamptz
);

-- ── Bookmarks ────────────────────────────────────────────────
create table if not exists public.bookmarks (
  user_wallet  text not null
    constraint bookmarks_user_lowercase check (user_wallet = lower(user_wallet)),
  strategy_id  uuid not null references public.strategies(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_wallet, strategy_id)
);

-- ── Reports ──────────────────────────────────────────────────
create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_wallet  text not null
    constraint reports_reporter_lowercase check (reporter_wallet = lower(reporter_wallet)),
  target_type      text not null
    constraint reports_target_type_check check (target_type in ('strategy', 'indicator')),
  target_id        uuid not null,
  reason           text not null,
  status           text not null default 'open'
    constraint reports_status_check check (status in ('open', 'resolved')),
  created_at       timestamptz not null default now()
);

-- ── Admin Actions ────────────────────────────────────────────
create table if not exists public.admin_actions (
  id            uuid primary key default gen_random_uuid(),
  admin_wallet  text not null
    constraint admin_actions_admin_lowercase check (admin_wallet = lower(admin_wallet)),
  action_type   text not null,
  target_type   text not null,
  target_id     uuid not null,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ── Backtest Runs ────────────────────────────────────────────
create table if not exists public.backtest_runs (
  id                  uuid primary key default gen_random_uuid(),
  strategy_id         uuid references public.strategies(id) on delete cascade,
  strategy_version_id uuid references public.strategy_versions(id) on delete cascade,
  run_by_wallet       text not null,
  candles_source      text,
  summary             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  constraint backtest_runs_target_check check (
    strategy_id is not null or strategy_version_id is not null
  )
);

-- ── Alpha Scores (live performance per strategy version) ─────
create table if not exists public.alpha_scores (
  id                  uuid primary key default gen_random_uuid(),
  strategy_version_id uuid not null references public.strategy_versions(id) on delete cascade,
  total_trades        int not null default 0,
  win_count           int not null default 0,
  loss_count          int not null default 0,
  win_rate_pct        numeric,
  avg_alpha           numeric,
  max_drawdown_pct    numeric,
  last_calculated_at  timestamptz not null default now(),
  unique (strategy_version_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_strategies_creator        on public.strategies(creator_wallet);
create index if not exists idx_strategies_status         on public.strategies(status);
create index if not exists idx_strategy_versions_strategy on public.strategy_versions(strategy_id);
create index if not exists idx_indicators_creator        on public.indicators(creator_wallet);
create index if not exists idx_indicators_status         on public.indicators(status);
create index if not exists idx_activations_user          on public.activations(user_wallet);
create index if not exists idx_activations_strategy      on public.activations(strategy_id);
create index if not exists idx_receipts_activation       on public.decision_receipts(activation_id);
create index if not exists idx_receipts_strategy_version on public.decision_receipts(strategy_version_id);
create index if not exists idx_receipts_opened           on public.decision_receipts(opened_at desc);
create index if not exists idx_alpha_strategy_version    on public.alpha_scores(strategy_version_id);

-- ============================================================
-- TRIGGERS (auto updated_at)
-- ============================================================

drop trigger if exists trg_strategies_set_updated_at on public.strategies;
create trigger trg_strategies_set_updated_at
  before update on public.strategies
  for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_indicators_set_updated_at on public.indicators;
create trigger trg_indicators_set_updated_at
  before update on public.indicators
  for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_activations_set_updated_at on public.activations;
create trigger trg_activations_set_updated_at
  before update on public.activations
  for each row execute function public.set_updated_at_timestamp();

-- ============================================================
-- ROW LEVEL SECURITY — Enable on all tables
-- ============================================================

alter table public.creators                       enable row level security;
alter table public.strategies                     enable row level security;
alter table public.strategy_versions              enable row level security;
alter table public.indicators                     enable row level security;
alter table public.indicator_versions             enable row level security;
alter table public.strategy_indicator_dependencies enable row level security;
alter table public.activations                    enable row level security;
alter table public.decision_receipts              enable row level security;
alter table public.bookmarks                      enable row level security;
alter table public.reports                        enable row level security;
alter table public.admin_actions                  enable row level security;
alter table public.backtest_runs                  enable row level security;
alter table public.alpha_scores                   enable row level security;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- ── creators ─────────────────────────────────────────────────
-- Anyone can read creator profiles (public marketplace)
create policy "creators: public read"
  on public.creators for select
  using (true);

-- Only the creator themselves can insert/update their profile
create policy "creators: insert own"
  on public.creators for insert
  with check (wallet_address = lower(current_setting('app.wallet', true)));

create policy "creators: update own"
  on public.creators for update
  using (wallet_address = lower(current_setting('app.wallet', true)));

-- ── strategies ───────────────────────────────────────────────
-- Anyone can read published strategies
create policy "strategies: public read published"
  on public.strategies for select
  using (status = 'published');

-- Creator can read all their own strategies (including drafts)
create policy "strategies: creator read own"
  on public.strategies for select
  using (creator_wallet = lower(current_setting('app.wallet', true)));

-- Creator can insert their own strategies
create policy "strategies: creator insert"
  on public.strategies for insert
  with check (creator_wallet = lower(current_setting('app.wallet', true)));

-- Creator can update their own strategies
create policy "strategies: creator update"
  on public.strategies for update
  using (creator_wallet = lower(current_setting('app.wallet', true)));

-- ── strategy_versions ────────────────────────────────────────
-- Anyone can read versions of published strategies
create policy "strategy_versions: public read"
  on public.strategy_versions for select
  using (
    exists (
      select 1 from public.strategies s
      where s.id = strategy_id
        and s.status = 'published'
    )
  );

-- Creator can read all versions of their own strategies
create policy "strategy_versions: creator read own"
  on public.strategy_versions for select
  using (
    exists (
      select 1 from public.strategies s
      where s.id = strategy_id
        and s.creator_wallet = lower(current_setting('app.wallet', true))
    )
  );

-- Creator can insert versions for their own strategies
create policy "strategy_versions: creator insert"
  on public.strategy_versions for insert
  with check (
    exists (
      select 1 from public.strategies s
      where s.id = strategy_id
        and s.creator_wallet = lower(current_setting('app.wallet', true))
    )
  );

-- ── indicators ───────────────────────────────────────────────
create policy "indicators: public read published"
  on public.indicators for select
  using (status = 'published');

create policy "indicators: creator read own"
  on public.indicators for select
  using (creator_wallet = lower(current_setting('app.wallet', true)));

create policy "indicators: creator insert"
  on public.indicators for insert
  with check (creator_wallet = lower(current_setting('app.wallet', true)));

create policy "indicators: creator update"
  on public.indicators for update
  using (creator_wallet = lower(current_setting('app.wallet', true)));

-- ── indicator_versions ───────────────────────────────────────
create policy "indicator_versions: public read"
  on public.indicator_versions for select
  using (
    exists (
      select 1 from public.indicators i
      where i.id = indicator_id
        and i.status = 'published'
    )
  );

create policy "indicator_versions: creator read own"
  on public.indicator_versions for select
  using (
    exists (
      select 1 from public.indicators i
      where i.id = indicator_id
        and i.creator_wallet = lower(current_setting('app.wallet', true))
    )
  );

create policy "indicator_versions: creator insert"
  on public.indicator_versions for insert
  with check (
    exists (
      select 1 from public.indicators i
      where i.id = indicator_id
        and i.creator_wallet = lower(current_setting('app.wallet', true))
    )
  );

-- ── strategy_indicator_dependencies ─────────────────────────
create policy "dependencies: public read"
  on public.strategy_indicator_dependencies for select
  using (true);

-- ── activations ──────────────────────────────────────────────
-- Users can only see and manage their own activations
create policy "activations: owner select"
  on public.activations for select
  using (user_wallet = lower(current_setting('app.wallet', true)));

create policy "activations: owner insert"
  on public.activations for insert
  with check (user_wallet = lower(current_setting('app.wallet', true)));

create policy "activations: owner update"
  on public.activations for update
  using (user_wallet = lower(current_setting('app.wallet', true)));

-- ── decision_receipts ────────────────────────────────────────
-- Users can only see receipts tied to their own activations
create policy "receipts: owner select"
  on public.decision_receipts for select
  using (
    activation_id in (
      select id from public.activations
      where user_wallet = lower(current_setting('app.wallet', true))
    )
  );

-- Only backend (service role) can insert receipts — no user insert policy

-- ── bookmarks ────────────────────────────────────────────────
create policy "bookmarks: owner all"
  on public.bookmarks for all
  using (user_wallet = lower(current_setting('app.wallet', true)))
  with check (user_wallet = lower(current_setting('app.wallet', true)));

-- ── reports ──────────────────────────────────────────────────
-- Users can submit reports
create policy "reports: user insert"
  on public.reports for insert
  with check (reporter_wallet = lower(current_setting('app.wallet', true)));

-- Users can read their own reports
create policy "reports: reporter read own"
  on public.reports for select
  using (reporter_wallet = lower(current_setting('app.wallet', true)));

-- ── admin_actions ────────────────────────────────────────────
-- No public policies — admin_actions is service role only
-- Your backend must use the service role key to access this table
-- RLS is enabled but no policies = zero public access

-- ── backtest_runs ────────────────────────────────────────────
-- User can read their own backtest runs
create policy "backtest_runs: owner read"
  on public.backtest_runs for select
  using (run_by_wallet = lower(current_setting('app.wallet', true)));

-- User can insert their own backtest runs
create policy "backtest_runs: owner insert"
  on public.backtest_runs for insert
  with check (run_by_wallet = lower(current_setting('app.wallet', true)));

-- ── alpha_scores ─────────────────────────────────────────────
-- Anyone can read alpha scores (public marketplace data)
create policy "alpha_scores: public read"
  on public.alpha_scores for select
  using (true);

-- Only backend (service role) can insert/update alpha scores
-- No user-facing insert/update policy

-- ============================================================
-- DONE
-- ============================================================