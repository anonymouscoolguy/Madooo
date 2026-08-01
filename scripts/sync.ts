/**
 * Pull football into our database.
 *
 *   npm run sync -- --round 1                  fixtures, then hydrate round 1
 *   npm run sync -- --round 1 --limit 2        hydrate only the first 2 matches
 *   npm run sync -- --fixtures-only            the calendar alone, 1 request
 *
 * Costs one request for the whole season's fixtures, then two per hydrated
 * fixture. A full round is 1 + 20 = 21 of the day's 100.
 *
 * Unlike `db-check.ts` this does not refuse to run against production — syncing
 * production is the job's entire purpose. It prints the branch instead.
 */

import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

interface Options {
  round: string | null
  limit: number | null
  fixturesOnly: boolean
}

function parseArgs(argv: string[]): Options {
  const options: Options = { round: null, limit: null, fixturesOnly: false }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--fixtures-only') {
      options.fixturesOnly = true
    } else if (arg === '--round') {
      options.round = argv[++index] ?? null
    } else if (arg === '--limit') {
      const value = Number(argv[++index])
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--limit takes a whole number of fixtures')
      }
      options.limit = value
    } else {
      throw new Error(`Unrecognised argument: ${arg}`)
    }
  }

  if (!options.fixturesOnly && options.round === null) {
    throw new Error('Pass --round <n> to hydrate a round, or --fixtures-only')
  }
  return options
}

function quota(remaining: number | null, limit: number | null): string {
  if (remaining === null) return 'quota unknown'
  return limit === null ? `${remaining} left` : `${remaining}/${limit} requests left`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  // Imported after config(), and dynamically: a static import is hoisted above
  // it, and src/lib/prisma.ts builds its client — reading DATABASE_URL_DEV — the
  // instant it is imported. The same trick as scripts/db-check.ts.
  const { databaseBranch, season } = await import('../src/lib/env')
  const { prisma } = await import('../src/lib/prisma')
  const { roundLabel, syncFixtureDetail, syncSeasonFixtures } = await import(
    '../src/lib/sync'
  )

  const target = season()
  console.log(`\nbranch: ${databaseBranch()}   season: ${target}`)

  console.log('\nfixtures')
  const fixtures = await syncSeasonFixtures(target)
  console.log(`  ok    ${fixtures.leagues} league, ${fixtures.teams} teams`)
  console.log(`  ok    ${fixtures.matches} matches (${quota(fixtures.remaining, fixtures.limit)})`)

  if (options.fixturesOnly || options.round === null) {
    await prisma.$disconnect()
    console.log('\nfixtures synced\n')
    return
  }

  const round = roundLabel(options.round)
  let selected = fixtures.fixtures.filter((fixture) => fixture.round === round)
  if (selected.length === 0) {
    throw new Error(`No fixtures in "${round}" — check the round label`)
  }
  if (options.limit !== null) selected = selected.slice(0, options.limit)

  // Stop before starting rather than halfway through: running out of quota
  // mid-round leaves some matches hydrated and some not, and the day's budget
  // gone either way.
  const needed = selected.length * 2
  if (fixtures.remaining !== null && fixtures.remaining < needed) {
    throw new Error(
      `Need ${needed} requests for ${selected.length} fixtures, ` +
        `only ${fixtures.remaining} left today. Use --limit ${Math.floor(fixtures.remaining / 2)}.`,
    )
  }

  console.log(`\n${round} — ${selected.length} fixtures, ${needed} requests`)
  for (const fixture of selected) {
    const detail = await syncFixtureDetail(fixture.apiFootballId)
    console.log(
      `  ok    ${fixture.label} — ${detail.lineups} lineups, ` +
        `${detail.squadEntries} squad entries (${quota(detail.remaining, fixtures.limit)})`,
    )
  }

  await prisma.$disconnect()
  console.log('\nsync complete\n')
}

main().catch((error) => {
  console.error('\nsync FAILED\n', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
