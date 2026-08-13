/**
 * Pull football into our database.
 *
 *   npm run sync -- --round 1                  fixtures, then round 1 everywhere
 *   npm run sync -- --round 1 --limit 2        hydrate only the first 2 matches
 *   npm run sync -- --league 94 --round 1      one league instead of all of them
 *   npm run sync -- --fixtures-only            the calendars alone, 1 per league
 *
 * Costs one request per league for its whole season of fixtures, then two per
 * hydrated fixture. A Premier League round is 1 + 20 = 21 of the day's 7,500.
 *
 * Which leagues is configuration, `LEAGUES` — never a literal here, the same
 * rule the season follows. `--league` narrows that list for one run; it cannot
 * reach outside it, so a typo costs an error rather than a request.
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
  league: number | null
}

function parseArgs(argv: string[]): Options {
  const options: Options = { round: null, limit: null, fixturesOnly: false, league: null }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--fixtures-only') {
      options.fixturesOnly = true
    } else if (arg === '--round') {
      options.round = argv[++index] ?? null
    } else if (arg === '--league') {
      const value = Number(argv[++index])
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--league takes an API-Football league id, e.g. --league 94')
      }
      options.league = value
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
  const { databaseBranch, season, syncLeagues } = await import('../src/lib/env')
  const { prisma } = await import('../src/lib/prisma')
  const { roundLabel, syncFixtureDetail, syncSeasonFixtures } = await import(
    '../src/lib/sync'
  )

  const target = season()
  const configured = syncLeagues()
  if (options.league !== null && !configured.includes(options.league)) {
    throw new Error(
      `--league ${options.league} is not in LEAGUES (${configured.join(', ')})`,
    )
  }
  const leagues = options.league === null ? configured : [options.league]

  console.log(
    `\nbranch: ${databaseBranch()}   season: ${target}   leagues: ${leagues.join(', ')}`,
  )

  console.log('\nfixtures')
  const results = []
  for (const leagueApiFootballId of leagues) {
    const result = await syncSeasonFixtures(target, leagueApiFootballId)
    results.push(result)
    // The league's name rather than a count of leagues: a name is evidence the
    // right competition came back, where "1 league" is evidence of nothing.
    console.log(
      `  ok    ${result.league.name} — ${result.teams} teams, ` +
        `${result.matches} matches (${quota(result.remaining, result.limit)})`,
    )
  }

  if (options.fixturesOnly || options.round === null) {
    await prisma.$disconnect()
    console.log('\nfixtures synced\n')
    return
  }

  // `--round N` means matchday N of every league in scope. The same number is a
  // different weekend in each, which is fine — they are separate selections
  // concatenated in league order, and each fixture carries its league for the
  // log so the competitions never blur together on screen.
  const round = roundLabel(options.round)
  const skipped: string[] = []
  let selected = results.flatMap((result) => {
    const inRound = result.fixtures.filter((fixture) => fixture.round === round)
    // A league that simply does not have this round is not a failure: the
    // Primeira Liga plays 34 to the Premier League's 38, so `--round 36` is a
    // real asymmetry rather than a mistyped label. Only *no* league matching
    // means the label is wrong.
    if (inRound.length === 0) skipped.push(result.league.name)
    return inRound.map((fixture) => ({ ...fixture, league: result.league.name }))
  })

  if (selected.length === 0) {
    throw new Error(`No fixtures in "${round}" in any league — check the round label`)
  }
  if (options.limit !== null) selected = selected.slice(0, options.limit)

  // Stop before starting rather than halfway through: running out of quota
  // mid-round leaves some matches hydrated and some not, and the day's budget
  // gone either way. The last league's headers are the freshest reading of a
  // quota that is global to the key.
  const budget = results[results.length - 1]
  const needed = selected.length * 2
  if (budget.remaining !== null && budget.remaining < needed) {
    throw new Error(
      `Need ${needed} requests for ${selected.length} fixtures, ` +
        `only ${budget.remaining} left today. Use --limit ${Math.floor(budget.remaining / 2)}.`,
    )
  }

  const count = `${selected.length} fixture${selected.length === 1 ? '' : 's'}`
  console.log(`\n${round} — ${count}, ${needed} requests`)
  for (const name of skipped) console.log(`  skip  ${name} has no "${round}"`)
  for (const fixture of selected) {
    const detail = await syncFixtureDetail(fixture.apiFootballId)
    console.log(
      `  ok    ${fixture.league} · ${fixture.label} — ${detail.lineups} lineups, ` +
        `${detail.squadEntries} squad entries (${quota(detail.remaining, budget.limit)})`,
    )
  }

  await prisma.$disconnect()
  console.log('\nsync complete\n')
}

main().catch((error) => {
  console.error('\nsync FAILED\n', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
