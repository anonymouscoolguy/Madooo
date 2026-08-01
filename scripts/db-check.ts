/**
 * Proves the database layer works. Step 2 is deliberately not user-facing, so
 * there is nothing to look at in a browser — this script is the equivalent.
 *
 *   npx tsx scripts/db-check.ts
 *
 * It writes and then deletes a small fixture graph, so it must never be pointed
 * at production. It refuses to run if it is.
 */

import { config } from 'dotenv'
import { Client } from 'pg'

config({ path: '.env.local', quiet: true })

type Prisma = (typeof import('../src/lib/prisma'))['prisma']

// Sentinels for this script's throwaway rows. Negative ids because every real
// API-Football id is positive, so these can never collide with synced data.
const FIXTURE_IDS = [-1, -2, -3]
const FIXTURE_CLERK_ID = 'db-check-user'

/**
 * Removes this script's rows. Idempotent, and run both before and after the
 * checks — a run that dies partway would otherwise leave rows that make the
 * next run fail on a unique constraint for entirely the wrong reason.
 */
async function removeFixtures(prisma: Prisma) {
  const apiFootballId = { in: FIXTURE_IDS }
  await prisma.user.deleteMany({ where: { clerkId: FIXTURE_CLERK_ID } })
  await prisma.match.deleteMany({ where: { apiFootballId } })
  await prisma.player.deleteMany({ where: { apiFootballId } })
  await prisma.team.deleteMany({ where: { apiFootballId } })
  await prisma.league.deleteMany({ where: { apiFootballId } })
}

function pass(message: string) {
  console.log(`  ok    ${message}`)
}

/**
 * Throws rather than calling process.exit, so the cleanup in main()'s `finally`
 * still runs. Exiting here would leave the fixture rows behind on any failure.
 */
function fail(message: string): never {
  throw new Error(`FAIL  ${message}`)
}

/**
 * Runs `action`, expecting the database to reject it *for the stated reason*.
 *
 * Asserting on `marker` matters: a bare "it threw" would also pass if the row
 * were refused by an unrelated error, which would leave the constraint we care
 * about untested while looking green.
 */
async function expectRejection(
  description: string,
  marker: string,
  action: () => Promise<unknown>,
) {
  try {
    await action()
  } catch (error) {
    const detail = [
      error instanceof Error ? error.message : String(error),
      // Prisma puts its error code and the offending constraint on the error
      // object rather than in the message.
      ...Object.entries(error as Record<string, unknown>).map(
        ([key, value]) => `${key}=${JSON.stringify(value)}`,
      ),
    ].join(' ')

    if (!detail.includes(marker)) {
      fail(`${description} — rejected, but not by ${marker}:\n${detail}`)
    }
    pass(`${description} — rejected by ${marker}`)
    return
  }
  fail(`${description} — was ACCEPTED, but should have been rejected`)
}

async function main() {
  // Imported here, not at the top of the file: src/lib/prisma.ts builds its
  // client the moment it is imported, so .env.local must already be loaded.
  // ES module imports are hoisted above config(), dynamic ones are not.
  const { databaseBranch, databaseUrl, migrationDatabaseUrl, isProductionDatabase } =
    await import('../src/lib/env')
  const { prisma } = await import('../src/lib/prisma')

  console.log(`\nbranch: ${databaseBranch()}`)
  if (isProductionDatabase()) {
    fail('refusing to run against production — this script writes rows')
  }
  pass('targeting the development branch')

  // 1. Both endpoints resolve. The direct URL is derived by dropping "-pooler"
  //    from the hostname; if Neon ever changes that convention, it fails here
  //    rather than in the middle of a migration.
  console.log('\nconnections')
  for (const [label, url] of [
    ['pooled  (application)', databaseUrl()],
    ['direct  (migrations)', migrationDatabaseUrl()],
  ] as const) {
    const client = new Client({ connectionString: url })
    await client.connect()
    await client.query('SELECT 1')
    await client.end()
    pass(`${label} — ${new URL(url).hostname}`)
  }

  // 2. Every table is reachable through the generated client. Clear any rows a
  //    previous failed run left behind first, so the counts below are a true
  //    baseline.
  await removeFixtures(prisma)
  console.log('\ntables')
  const counts = {
    league: await prisma.league.count(),
    team: await prisma.team.count(),
    player: await prisma.player.count(),
    match: await prisma.match.count(),
    matchLineup: await prisma.matchLineup.count(),
    matchSquad: await prisma.matchSquad.count(),
    user: await prisma.user.count(),
    judgement: await prisma.judgement.count(),
  }
  for (const [table, count] of Object.entries(counts)) pass(`${table}: ${count} rows`)

  // 3. A throwaway fixture graph. Negative apiFootballIds so these can never
  //    collide with anything the real sync writes.
  console.log('\nconstraints')
  const league = await prisma.league.create({
    data: { apiFootballId: -1, name: 'Check League', country: 'Nowhere' },
  })
  const [home, away] = await Promise.all([
    prisma.team.create({ data: { apiFootballId: -1, name: 'Check Home' } }),
    prisma.team.create({ data: { apiFootballId: -2, name: 'Check Away' } }),
  ])
  // Three players, because each judgement assertion below needs its own squad
  // entry to sit on — the one-judgement-per-squad-entry rule is what we are
  // testing, so they cannot share.
  const players = await Promise.all(
    [-1, -2, -3].map((apiFootballId) =>
      prisma.player.create({
        data: { apiFootballId, name: `Check Player ${-apiFootballId}` },
      }),
    ),
  )
  const match = await prisma.match.create({
    data: {
      apiFootballId: -1,
      leagueId: league.id,
      // Not a season literal in the sense AGENTS.md forbids — 1900 is a
      // sentinel that cannot collide with a real one, not configuration.
      season: 1900,
      round: 'Check Round - 1',
      kickoff: new Date('1900-01-01T00:00:00Z'),
      status: 'FT',
      homeTeamId: home.id,
      awayTeamId: away.id,
    },
  })
  const squad = await Promise.all(
    players.map((player, index) =>
      prisma.matchSquad.create({
        data: {
          matchId: match.id,
          teamId: home.id,
          playerId: player.id,
          shirtNumber: index + 1,
          position: index === 0 ? 'G' : 'D',
          isStarter: true,
          grid: `${index + 1}:1`,
          minutes: 90,
        },
      }),
    ),
  )
  const user = await prisma.user.create({ data: { clerkId: FIXTURE_CLERK_ID } })
  pass('fixture graph written')

  try {
    await prisma.judgement.create({
      data: { userId: user.id, matchSquadId: squad[0].id, tag: 'MVP' },
    })
    pass('judgement with a tag accepted')

    // The load-bearing constraint: one judgement per user per player per match.
    // Worth watching fail rather than assuming.
    await expectRejection(
      'second judgement on the same squad entry',
      'P2002', // Prisma's code for a unique constraint violation
      () =>
        prisma.judgement.create({
          data: { userId: user.id, matchSquadId: squad[0].id, tag: 'FLOP' },
        }),
    )

    // A note with no tag is a valid judgement — the product rule that made
    // `tag` nullable in the first place.
    await prisma.judgement.create({
      data: {
        userId: user.id,
        matchSquadId: squad[1].id,
        note: 'quiet game, barely touched it',
      },
    })
    pass('judgement with a note and no tag accepted')

    // Neither is not. This must reach Postgres to prove anything: passing an
    // incomplete object would be refused by Prisma's own validation first, and
    // the CHECK constraint would go untested while the check looked green.
    await expectRejection(
      'judgement with neither tag nor note',
      'judgement_has_content', // the hand-written CHECK constraint
      () =>
        prisma.judgement.create({
          data: {
            userId: user.id,
            matchSquadId: squad[2].id,
            tag: null,
            note: null,
          },
        }),
    )
  } finally {
    // 4. Cascades. Deleting the user and the match should take the judgement,
    //    the squad entry and the lineup with them.
    await removeFixtures(prisma)
  }

  console.log('\ncleanup')
  const after = {
    judgement: await prisma.judgement.count(),
    matchSquad: await prisma.matchSquad.count(),
    match: await prisma.match.count(),
    user: await prisma.user.count(),
  }
  for (const [table, count] of Object.entries(after)) {
    if (count !== counts[table as keyof typeof counts]) {
      fail(`${table}: ${count} rows left behind`)
    }
  }
  pass('all fixture rows removed, cascades intact')

  await prisma.$disconnect()
  console.log('\ndatabase check passed\n')
}

main().catch((error) => {
  console.error('\ndatabase check FAILED\n', error)
  process.exitCode = 1
})
