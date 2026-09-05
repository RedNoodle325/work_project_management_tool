import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import postgres from 'postgres'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })

try {
  const files = (await readdir(resolve('database'))).filter(name => /^\d+.*\.sql$/.test(name)).sort()
  const [legacySchema] = await sql`
    select to_regclass('public.sites') is not null as exists
  `
  await sql`create table if not exists public.app_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`
  const [{ count }] = await sql`select count(*) from public.app_migrations`
  if (legacySchema.exists && Number(count) === 0) {
    const legacyMigrations = files.filter(name => Number.parseInt(name, 10) < 22)
    for (const name of legacyMigrations) {
      await sql`insert into public.app_migrations(name) values(${name}) on conflict do nothing`
    }
    console.log(`Recorded ${legacyMigrations.length} existing schema migrations without replaying the destructive reset`)
  }
  for (const name of files) {
    const [applied] = await sql`select name from public.app_migrations where name=${name}`
    if (applied) continue
    const source = await readFile(resolve('database', name), 'utf8')
    const migration = source.replace(/^\s*begin\s*;/im, '').replace(/commit\s*;\s*$/i, '')
    await sql.begin(async tx => {
      await tx.unsafe(migration)
      await tx`insert into public.app_migrations(name) values(${name})`
    })
    console.log(`Applied ${name}`)
  }
} finally {
  await sql.end()
}
