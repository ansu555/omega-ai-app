/**
 * ATS Database Migration Script
 *
 * Creates the three tables needed for the ATS research co-pilot:
 *   1. agent_wallets   — encrypted burner EOA per user
 *   2. user_settings   — OpenRouter API key + model + mode
 *   3. ats_receipts    — decision receipts from ATS pipeline runs
 *
 * Usage:
 *   bun run scripts/migrate-ats.ts
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   (or set them in the environment before running)
 *
 * IMPORTANT: This script requires the database password, not the JWT key.
 * Set SUPABASE_DB_PASSWORD in your environment (find it in the Supabase
 * dashboard under Settings → Database → Connection string).
 *
 * If you don't have DB access, apply the SQL manually in the Supabase
 * SQL Editor at: https://supabase.com/dashboard/project/txryxbaibwauhunzhchr/sql
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import pg from 'pg'

const { Client } = pg

const PROJECT_REF = 'txryxbaibwauhunzhchr'
const DB_HOST     = `db.${PROJECT_REF}.supabase.co`
const DB_NAME     = 'postgres'
const DB_USER     = 'postgres'
const DB_PORT     = 5432

async function main() {
  const password = process.env.SUPABASE_DB_PASSWORD
  if (!password) {
    console.error('❌ SUPABASE_DB_PASSWORD is not set.')
    console.error('')
    console.error('Find your database password at:')
    console.error(`  https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database`)
    console.error('')
    console.error('Then run:')
    console.error(`  SUPABASE_DB_PASSWORD=<your_password> bun run scripts/migrate-ats.ts`)
    console.error('')
    console.error('─── OR ─── apply manually in the Supabase SQL Editor:')
    console.error(`  https://supabase.com/dashboard/project/${PROJECT_REF}/sql`)
    console.error('')
    printManualSQL()
    process.exit(1)
  }

  const client = new Client({
    host:     DB_HOST,
    port:     DB_PORT,
    database: DB_NAME,
    user:     DB_USER,
    password,
    ssl:      { rejectUnauthorized: false },
  })

  console.log(`Connecting to ${DB_HOST}:${DB_PORT}/${DB_NAME}...`)
  await client.connect()
  console.log('✓ Connected\n')

  const migrations = [
    '20260503_agent_wallets.sql',
    '20260503_user_settings.sql',
    '20260503_decision_receipts.sql',
  ]

  for (const filename of migrations) {
    const filepath = join(process.cwd(), 'supabase', 'migrations', filename)
    const sql = readFileSync(filepath, 'utf-8')
    console.log(`Applying ${filename}...`)
    try {
      await client.query(sql)
      console.log(`  ✓ Applied ${filename}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already exists') || msg.includes('IF NOT EXISTS')) {
        console.log(`  ↩ ${filename} already applied (skipped)`)
      } else {
        console.error(`  ✗ Error in ${filename}: ${msg}`)
      }
    }
  }

  await client.end()
  console.log('\n✅ Migrations complete.')
}

function printManualSQL() {
  console.log('Manual SQL to apply in the Supabase SQL Editor:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const migrations = [
    '20260503_agent_wallets.sql',
    '20260503_user_settings.sql',
    '20260503_decision_receipts.sql',
  ]
  for (const f of migrations) {
    try {
      const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', f), 'utf-8')
      console.log(`\n-- === ${f} ===`)
      console.log(sql)
    } catch {
      console.log(`  (could not read ${f})`)
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
