/**
 * Which database we talk to, and how.
 *
 * The default is the *development* branch, always. Production is reached only
 * by setting DATABASE_TARGET=production — a variable that should never exist on
 * a developer's machine. This inverts Prisma's own default, where the plainly
 * named DATABASE_URL wins and a stray `prisma migrate dev` would migrate
 * production from a laptop.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

/**
 * Neon's direct endpoint is the pooled hostname minus the `-pooler` suffix.
 * Both are needed: the app runs through the pooler, but Prisma's migration
 * engine takes a Postgres advisory lock, which pgbouncer in transaction mode
 * does not support.
 */
function toDirectUrl(pooled: string): string {
  return pooled.replace('-pooler.', '.')
}

export function isProductionDatabase(): boolean {
  return process.env.DATABASE_TARGET === 'production'
}

/** Which Neon branch is in play. Safe to log; the URL is not. */
export function databaseBranch(): 'production' | 'development' {
  return isProductionDatabase() ? 'production' : 'development'
}

/** Pooled URL — for the running application. */
export function databaseUrl(): string {
  return isProductionDatabase()
    ? required('DATABASE_URL')
    : required('DATABASE_URL_DEV')
}

/** Direct URL — for `prisma migrate` and `prisma studio` only. */
export function migrationDatabaseUrl(): string {
  const override = isProductionDatabase()
    ? process.env.DATABASE_URL_UNPOOLED
    : process.env.DATABASE_URL_DEV_UNPOOLED
  return override ?? toDirectUrl(databaseUrl())
}
