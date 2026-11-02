/**
 * One-time script to create the onboarding table in Supabase.
 *
 * Prerequisites:
 *   Add DATABASE_URL to your .env.local — get it from:
 *   Supabase Dashboard → Settings → Database → Connection string → URI
 *   It looks like: postgresql://postgres.xxxx:[PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres
 *
 * Run with: bun scripts/setup-db.ts
 */

import { Client } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error(
    '\nMissing DATABASE_URL.\n' +
    'Get it from: Supabase Dashboard → Settings → Database → Connection string → URI\n' +
    'Then add it to your .env.local:\n' +
    '  DATABASE_URL=postgresql://postgres.xxxx:[PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres\n'
  )
  process.exit(1)
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
console.log('Connected to Supabase Postgres.')

await client.query(`
  create table if not exists public.user_risk_profiles (
    id                    uuid        default gen_random_uuid() primary key,
    wallet_address        text        unique not null,
    questionnaire_version int         not null,
    answers               jsonb       not null,
    notes                 text,
    risk_score            int         not null,
    risk_category         text        not null,
    created_at            timestamptz default now()
  );
`)

console.log('✓ Table public.user_risk_profiles is ready.')

await client.end()
