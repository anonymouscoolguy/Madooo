/**
 * How this process is configured: which database we talk to, which season we
 * run against, and the API-Football credential.
 *
 * The database default is the *development* branch, always. Production is
 * reached only by setting DATABASE_TARGET=production — a variable that should
 * never exist on a developer's machine. This inverts Prisma's own default, where
 * the plainly named DATABASE_URL wins and a stray `prisma migrate dev` would
 * migrate production from a laptop.
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

/**
 * The season to sync and read. Configuration, never a literal: development runs
 * against 2024 because API-Football's free tier stops there, and production will
 * run against the current season on a paid plan.
 *
 * Parsed strictly. `Number('')` is 0 and `Number('twenty')` is NaN, either of
 * which would sail on and sync a season that does not exist, presenting as an
 * API problem rather than a configuration one.
 */
export function season(): number {
  const raw = required('SEASON')
  const parsed = Number(raw)
  if (!Number.isInteger(parsed)) {
    throw new Error(`SEASON must be a whole year, got: ${raw}`)
  }
  return parsed
}

/**
 * Which leagues the sync fetches — API-Football's own ids, `LEAGUES=39,94,140,135`.
 *
 * **Only the sync reads this, and nothing under `src/app/` ever may.** The sync
 * writes `League` rows; every read side discovers leagues from Postgres instead
 * — `leaguesWithMatches`, `leaguesInSeason`, `parseLeague`. A page reading this
 * variable would have two sources for "which leagues exist" and could disagree
 * with its own database. It is configuration *for* the sync, exactly as
 * `apiFootballKey()` is, which is why it sits beside it and why the function is
 * named `syncLeagues` rather than `leagues`.
 *
 * That asymmetry is also why a Vercel environment needs only DATABASE_URL_DEV
 * and SEASON, and stays that way: the scheduled sync runs from GitHub Actions
 * rather than from a route handler, so neither this nor `apiFootballKey()` ever
 * has to exist in the deployed environment.
 *
 * Parsed as strictly as `season()`, for the same reason: a bad value must
 * present as a configuration error rather than as "the API returned nothing".
 * Order is preserved because it is the order the CLI syncs and prints in.
 */
export function syncLeagues(): number[] {
  const ids: number[] = []
  for (const token of required('LEAGUES').split(',')) {
    const trimmed = token.trim()
    if (trimmed === '') continue
    const parsed = Number(trimmed)
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error(`LEAGUES must be whole league ids, got: ${trimmed}`)
    }
    if (!ids.includes(parsed)) ids.push(parsed)
  }
  if (ids.length === 0) throw new Error('LEAGUES is empty — nothing to sync')
  return ids
}

/** API-Football credential, sent as the `x-apisports-key` header. */
export function apiFootballKey(): string {
  return required('API_FOOTBALL_KEY')
}
