/**
 * Pull football into our database.
 *
 *   npm run sync -- --due                      the calendars, then whatever needs reading
 *   npm run sync -- --due --dry-run            say what --due would do, spending nothing
 *   npm run sync -- --round 1                  fixtures, then round 1 everywhere
 *   npm run sync -- --round 1 --limit 2        hydrate only the first 2 matches
 *   npm run sync -- --league 94 --due          one league instead of all of them
 *   npm run sync -- --fixtures-only            the calendars alone, 1 per league
 *
 * Costs one request per league for its whole season of fixtures, then two per
 * hydrated fixture and one per team sheet. A Premier League round is
 * 1 + 20 = 21 of the day's 7,500.
 *
 * **`--due` is the mode the scheduler runs and `--round` is the one a person
 * runs.** `--round` names a matchday and asks for it; `--due` names nothing and
 * asks our own table what wants reading, which is why it needs no answer to
 * "which round is current" in four leagues that are at four different points
 * of their seasons. `--round` stays because it is the repair tool: it reaches a
 * match the fortnight window has already dropped.
 *
 * `--due` reads **two** queues, and they are selected by different predicates
 * for opposite reasons. Finished matches want both detail endpoints, once the
 * result has settled. Matches about to kick off want `/fixtures/lineups` alone,
 * which carries no statistics to be provisional about — that is what makes a
 * fixture openable and judgeable before it is played. Team sheets are fetched
 * first: their window closes at full time, where a fixture waiting to be
 * hydrated has a fortnight.
 *
 * Which leagues is configuration, `LEAGUES` — never a literal here, the same
 * rule the season follows. `--league` narrows that list for one run; it cannot
 * reach outside it, so a typo costs an error rather than a request.
 *
 * Nothing here throws its way out of a run any more. A scheduled job has nobody
 * reading its advice, so a league or a fixture that fails is logged, counted and
 * stepped over, and the process exits non-zero at the end if anything did. One
 * league returning nothing used to kill the run before hydration began, which
 * left two healthy competitions unread for a hiccup in a third.
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
  due: boolean
  dryRun: boolean
  league: number | null
}

/** One fixture to read detail for, however it was selected. */
interface Target {
  apiFootballId: number
  league: string
  label: string
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    round: null,
    limit: null,
    fixturesOnly: false,
    due: false,
    dryRun: false,
    league: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--fixtures-only') {
      options.fixturesOnly = true
    } else if (arg === '--due') {
      options.due = true
    } else if (arg === '--dry-run') {
      options.dryRun = true
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

  const modes = [options.round !== null, options.fixturesOnly, options.due]
  if (modes.filter(Boolean).length !== 1) {
    throw new Error('Pass exactly one of --due, --round <n> or --fixtures-only')
  }
  // A dry run of --round would still have to fetch every calendar to know what
  // is in the round, so it could not honour the promise the flag makes.
  if (options.dryRun && !options.due) {
    throw new Error('--dry-run only applies to --due')
  }
  return options
}

function quota(remaining: number | null, limit: number | null): string {
  if (remaining === null) return 'quota unknown'
  return limit === null ? `${remaining} left` : `${remaining}/${limit} requests left`
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  // Imported after config(), and dynamically: a static import is hoisted above
  // it, and src/lib/prisma.ts builds its client — reading DATABASE_URL_DEV — the
  // instant it is imported. The same trick as scripts/db-check.ts.
  const { databaseBranch, season, syncLeagues } = await import('../src/lib/env')
  const { prisma } = await import('../src/lib/prisma')
  const { planRun, REQUESTS_PER_FIXTURE, REQUESTS_PER_LINEUP } = await import(
    '../src/lib/hydration'
  )
  const {
    dueFixtures,
    leagueRows,
    lineupDueFixtures,
    roundLabel,
    syncFixtureDetail,
    syncFixtureLineups,
    syncSeasonFixtures,
  } = await import('../src/lib/sync')

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

  // Every failure past this point is counted rather than thrown. The run's exit
  // code is what tells GitHub to email; the log is what says which league it was.
  const failures: string[] = []

  const results = []
  if (!options.dryRun) {
    console.log('\nfixtures')
    for (const leagueApiFootballId of leagues) {
      try {
        const result = await syncSeasonFixtures(target, leagueApiFootballId)
        results.push(result)
        // The league's name rather than a count of leagues: a name is evidence
        // the right competition came back, where "1 league" is evidence of
        // nothing.
        console.log(
          `  ok    ${result.league.name} — ${result.teams} teams, ` +
            `${result.matches} matches (${quota(result.remaining, result.limit)})`,
        )
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        failures.push(`league ${leagueApiFootballId}: ${reason}`)
        console.log(`  FAIL  league ${leagueApiFootballId} — ${reason}`)
      }
    }
  }

  if (options.fixturesOnly) {
    await prisma.$disconnect()
    console.log(`\nsummary: calendars ${results.length}/${leagues.length}\n`)
    if (failures.length > 0) process.exitCode = 1
    return
  }

  // The freshest reading of a quota that is global to the key. Null when every
  // calendar failed, or on a dry run, in which case nothing is clamped.
  const budgetSource = results.length > 0 ? results[results.length - 1] : null
  const quotaLimit = budgetSource?.limit ?? null

  // Resolved once, before the branch, so neither the selection nor the heading
  // below has to assert that `--round` was given. `parseArgs` guarantees exactly
  // one mode and `--fixtures-only` has already returned, but that is an
  // invariant the type system cannot see.
  const round = options.round === null ? null : roundLabel(options.round)

  const skipped: string[] = []
  let due: Target[]
  // Fixtures wanting a team sheet before they have been played out. Only `--due`
  // fills this: `--round` is the post-match repair tool and always has been.
  let lineupsDue: Target[] = []

  // No round means `--due`: `--fixtures-only` has returned already, and
  // `parseArgs` allows no third possibility.
  if (round === null) {
    const rows = await leagueRows(leagues)
    const missing = leagues.length - rows.length
    if (missing > 0) {
      // A configured league with no row has never been synced, so there is
      // nothing of it to read. Worth saying rather than presenting as zero due.
      skipped.push(`${plural(missing, 'league')} not in the database yet`)
    }
    const leagueIds = rows.map((row) => row.id)
    const now = new Date()
    // Both selections resolved before either is fetched, so the heading below
    // can state the whole run rather than one queue at a time.
    lineupsDue = await lineupDueFixtures(target, now, leagueIds)
    due = await dueFixtures(target, now, leagueIds)
  } else {
    due = results.flatMap((result) => {
      const inRound = result.fixtures.filter((fixture) => fixture.round === round)
      // A league that simply does not have this round is not a failure: the
      // Primeira Liga plays 34 to the Premier League's 38, so `--round 36` is a
      // real asymmetry rather than a mistyped label. Only *no* league matching
      // means the label is wrong.
      if (inRound.length === 0) skipped.push(`${result.league.name} has no "${round}"`)
      return inRound.map((fixture) => ({
        apiFootballId: fixture.apiFootballId,
        league: result.league.name,
        label: fixture.label,
      }))
    })

    if (due.length === 0 && failures.length === 0) {
      throw new Error(`No fixtures in "${round}" in any league — check the round label`)
    }
  }

  // Clamped, never refused. This used to throw and tell the author to pass
  // --limit, which has no reader in a scheduled run — and refusing outright
  // hydrates nothing where hydrating some would have been right.
  //
  // `--limit` caps the hydration queue alone. It is the tool for a person
  // running `--round` against a whole matchday; the lineup queue is bounded to
  // whatever kicks off in the next ninety minutes and never needs capping.
  const wanted = options.limit === null ? due.length : Math.min(due.length, options.limit)
  const budget = planRun(lineupsDue.length, wanted, budgetSource?.remaining ?? null)

  const lineupsSelected = lineupsDue.slice(0, budget.lineups)
  const selected = due.slice(0, budget.fixtures)
  const unread = due.length - selected.length + (lineupsDue.length - lineupsSelected.length)

  const requests =
    lineupsSelected.length * REQUESTS_PER_LINEUP + selected.length * REQUESTS_PER_FIXTURE

  const heading = round ?? 'due'
  const work = [
    // The lineup queue is named only when it has something in it: on most runs
    // of the day it is empty, and a permanent "0 lineups" would be noise in a
    // log whose whole job is to be skimmed.
    lineupsSelected.length > 0 ? plural(lineupsSelected.length, 'lineup') : null,
    `${plural(due.length, 'fixture')}, ${selected.length} this run`,
  ].filter((part) => part !== null)

  console.log(`\n${heading} — ${work.join(', ')}, ${plural(requests, 'request')}`)
  for (const note of skipped) console.log(`  skip  ${note}`)
  if (budget.fixtures < wanted || budget.lineups < lineupsDue.length) {
    console.log(`  note  clamped by the day's remaining quota`)
  }

  if (options.dryRun) {
    for (const fixture of lineupsSelected) {
      console.log(`  would  lineup · ${fixture.league} · ${fixture.label}`)
    }
    for (const fixture of selected) {
      console.log(`  would  ${fixture.league} · ${fixture.label}`)
    }
    await prisma.$disconnect()
    console.log(
      `\ndry run — nothing fetched, ${plural(lineupsSelected.length, 'lineup')} and ` +
        `${plural(selected.length, 'fixture')} due\n`,
    )
    return
  }

  // Team sheets first. Their window closes at full time where the hydration
  // queue's is a fortnight wide, so if the run dies part way through it should
  // die having done the work that could not have waited.
  let sheets = 0
  for (const fixture of lineupsSelected) {
    try {
      const detail = await syncFixtureLineups(fixture.apiFootballId)
      sheets += 1
      console.log(
        `  ok    lineup · ${fixture.league} · ${fixture.label} — ${detail.lineups} lineups, ` +
          `${detail.squadEntries} squad entries (${quota(detail.remaining, quotaLimit)})`,
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      failures.push(`lineup ${fixture.apiFootballId}: ${reason}`)
      console.log(`  FAIL  lineup · ${fixture.league} · ${fixture.label} — ${reason}`)
    }
  }

  let hydrated = 0
  for (const fixture of selected) {
    try {
      const detail = await syncFixtureDetail(fixture.apiFootballId)
      hydrated += 1
      console.log(
        `  ok    ${fixture.league} · ${fixture.label} — ${detail.lineups} lineups, ` +
          `${detail.squadEntries} squad entries (${quota(detail.remaining, quotaLimit)})`,
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      failures.push(`fixture ${fixture.apiFootballId}: ${reason}`)
      console.log(`  FAIL  ${fixture.league} · ${fixture.label} — ${reason}`)
    }
  }

  await prisma.$disconnect()

  // One line the Actions log can be read down to. `still due` is the number the
  // budget left behind, which is the difference between "nothing to do" and
  // "ran out of room" — the two states a run of zero could otherwise mean.
  console.log(
    `\nsummary: calendars ${results.length}/${leagues.length}, ` +
      `lineups ${sheets}/${lineupsSelected.length}, ` +
      `hydrated ${hydrated}/${selected.length}, still due ${unread}, ` +
      `failed ${failures.length}\n`,
  )
  if (failures.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('\nsync FAILED\n', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
