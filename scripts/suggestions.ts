/**
 * Read what users have asked for.
 *
 *   npm run suggestions                                    the development branch
 *   DATABASE_TARGET=production npm run suggestions          the real ones
 *   npm run suggestions -- --limit 10                       the most recent 10
 *
 * Nothing in the app reads the `Suggestion` table — there is no screen for it
 * and no moderation problem to have, because a suggestion is addressed to the
 * author rather than to the other users. This script is the whole of the read
 * side.
 *
 * **Unlike `db-check.ts` it does not refuse to run against production**, and
 * that is the point: production is where the users are, so a reader that only
 * worked on a laptop's own branch would never show a real suggestion. It is
 * safe to point there because it only ever `findMany`s — the refusal in
 * `db-check.ts` exists because that script writes rows.
 *
 * It prints the branch it is reading, as `sync.ts` does, so a run that comes
 * back empty says which database it asked.
 */

import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

/** How many to print when nobody says otherwise. */
const DEFAULT_LIMIT = 50

function parseLimit(argv: string[]): number {
  const at = argv.indexOf('--limit')
  if (at === -1) return DEFAULT_LIMIT

  const value = Number(argv[at + 1])
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('--limit takes a positive integer')
  }
  return value
}

async function main() {
  const limit = parseLimit(process.argv.slice(2))

  // Imported inside `main`, after `config()` has run: the Prisma client reads
  // the connection string as its module loads, so a top-level import would
  // resolve it before `.env.local` was on `process.env`. The same shape the
  // other scripts use.
  const { databaseBranch } = await import('../src/lib/env')
  const { prisma } = await import('../src/lib/prisma')

  console.log(`\nbranch: ${databaseBranch()}\n`)

  const suggestions = await prisma.suggestion.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { email: true, clerkId: true } },
    },
  })

  if (suggestions.length === 0) {
    console.log('no suggestions yet\n')
    await prisma.$disconnect()
    return
  }

  const total = await prisma.suggestion.count()
  console.log(`${suggestions.length} of ${total}, newest first\n`)

  for (const suggestion of suggestions) {
    // The email is nullable — an account with no primary address is a real row,
    // so the Clerk id is what identifies the sender when there is no address.
    const who = suggestion.user.email ?? suggestion.user.clerkId
    const when = suggestion.createdAt.toISOString().replace('T', ' ').slice(0, 16)

    console.log(`── #${suggestion.id}  ${when}  ${who}`)
    // Indented so a suggestion with its own line breaks still reads as one
    // block rather than running into the next header.
    console.log(
      suggestion.body
        .split('\n')
        .map((line) => `   ${line}`)
        .join('\n'),
    )
    console.log()
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
