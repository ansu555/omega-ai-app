create extension if not exists pgcrypto;

create table if not exists public.user_risk_profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  questionnaire_version smallint not null default 1,
  answers jsonb not null,
  notes text null,
  risk_score smallint not null,
  risk_category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_risk_profiles_wallet_lowercase
    check (wallet_address = lower(wallet_address)),
  constraint user_risk_profiles_risk_score_range
    check (risk_score between 0 and 100),
  constraint user_risk_profiles_risk_category_allowed
    check (risk_category in ('conservative', 'balanced', 'aggressive'))
);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_risk_profiles_set_updated_at on public.user_risk_profiles;

create trigger trg_user_risk_profiles_set_updated_at
before update on public.user_risk_profiles
for each row
execute function public.set_updated_at_timestamp();
