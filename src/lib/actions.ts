'use server'

/**
 * The app's Server Actions — the only code that writes.
 *
 * `'use server'` at the top of a file marks **every export** as a Server Action.
 * Next compiles the bodies out of the client bundle and leaves behind a
 * reference that POSTs back, which means each export is a public endpoint
 * reachable by anyone who can send that POST. Two consequences, and both are
 * load-bearing:
 *
 *   - Nothing but async actions may be exported from here. A helper exported
 *     alongside them would become an endpoint of its own — which is why
 *     `clearTag` below is deliberately module-private.
 *   - Every action authenticates and validates its own arguments. Rendering the
 *     buttons only on a signed-in page is not a security boundary; the request
 *     does not have to come from the page.
 */

import { refresh } from 'next/cache'

import { requireDbUser } from './auth'
import { prisma } from './prisma'
import { isJudgementTag, NOTE_MAX_LENGTH, type JudgementTag } from './verdicts'
import type { Prisma } from '@/generated/prisma/client'

/**
 * Take the tag off every judgement the filter matches, without losing a note.
 *
 * Two statements, and **the delete has to come first**. `judgement_has_content` —
 * the CHECK constraint added by hand in the initial migration — requires a tag
 * or a note, and a `CHECK` in Postgres is non-deferrable: only `UNIQUE`, foreign
 * keys and `EXCLUDE` can be told to wait for commit, so it is evaluated as each
 * statement runs and no transaction buys a moment where a row may say nothing.
 * Blanking the tag first therefore fails with `23514` on exactly the rows the
 * delete was about to remove.
 *
 * So: delete the judgements that are only a tag, then blank the tag on whatever
 * survives, which is precisely the ones carrying a note. Each statement leaves
 * every row it touches valid on its own.
 *
 * Returns the operations rather than running them, so a caller can put them in
 * one transaction alongside its own write.
 */
function clearTag(where: Prisma.JudgementWhereInput) {
  return [
    prisma.judgement.deleteMany({ where: { ...where, note: null } }),
    prisma.judgement.updateMany({ where, data: { tag: null } }),
  ]
}

/**
 * Take the note off every judgement the filter matches, without losing a tag.
 *
 * The mirror of `clearTag`, and delete-before-update for exactly the same
 * reason — see its comment. Written out rather than shared with it through a
 * parameter, because what differs is which column each statement reads and which
 * it writes, and a version that took the column name would say less than these
 * four lines do.
 */
function clearNote(where: Prisma.JudgementWhereInput) {
  return [
    prisma.judgement.deleteMany({ where: { ...where, tag: null } }),
    prisma.judgement.updateMany({ where, data: { note: null } }),
  ]
}

/**
 * Set — or clear — the signed-in user's verdict on one player in one match.
 *
 * **Set-semantics, not toggle-semantics.** The caller sends the state it wants
 * rather than "flip this", so the action is idempotent, needs no read before its
 * write, and cannot race itself into the opposite of what was tapped. Deciding
 * that a second tap on the active verdict means `null` is the client's job,
 * because the client is what knows the verdict it just drew.
 *
 * **MVP is exclusive within a match.** Awarding it to a second player takes it
 * off the first, who is left with no judgement at all — or with their note and
 * no tag, if they have one. Standout and flop have no such rule: any number of
 * players can be either.
 *
 * No ownership query, and none is needed. `userId` comes from the session rather
 * than from the caller, and `Judgement` is unique on `(userId, matchSquadId)`,
 * so there is no row here that is not this user's own.
 */
export async function setVerdict(matchSquadId: number, tag: JudgementTag | null) {
  const user = await requireDbUser()

  // Both arguments crossed the network, so both are untrusted — see the file
  // comment. `isJudgementTag` is a type predicate, which is what turns the
  // string this may have arrived as into the enum Prisma will accept.
  if (!Number.isInteger(matchSquadId)) throw new Error('setVerdict: matchSquadId must be an integer')
  if (tag !== null && !isJudgementTag(tag)) throw new Error(`setVerdict: unknown tag ${tag}`)

  /*
    Which match this is gets **derived from the squad row, never taken from the
    caller**. Only the MVP branch needs it, but taking a match id as an argument
    would let a crafted request scope the demotion below to some other match and
    strip the MVP off a player in it. A lookup by primary key is the cheap way to
    have the scope come from the database instead.

    It doubles as the existence check the foreign key would otherwise make on our
    behalf, and turns a bogus id into a clear message rather than a constraint
    violation.
  */
  const entry = await prisma.matchSquad.findUnique({
    where: { id: matchSquadId },
    select: { matchId: true },
  })
  if (entry === null) throw new Error(`setVerdict: no squad entry ${matchSquadId}`)

  const mine = { userId: user.id, matchSquadId }

  if (tag === null) {
    await prisma.$transaction(clearTag(mine))
  } else {
    const award = prisma.judgement.upsert({
      // The compound unique index, addressed by the name Prisma gives it —
      // the two field names joined by an underscore.
      where: { userId_matchSquadId: { userId: user.id, matchSquadId } },
      update: { tag },
      create: { userId: user.id, matchSquadId, tag },
    })

    if (tag === 'MVP') {
      /*
        Demote whoever held it. The filter reaches through the relation to
        `MatchSquad.matchId`, so it is scoped to this match and cannot touch the
        user's MVP in any other one, and it excludes the player being awarded —
        without that, the clear and the upsert would fight over the same row.

        The demotion runs in the same transaction as the award, so a match can
        never be left with two MVPs or none.
      */
      const previous = {
        userId: user.id,
        // Narrowed to `'MVP'` by the branch, so the filter cannot drift from
        // the tag being awarded.
        tag,
        matchSquadId: { not: matchSquadId },
        matchSquad: { matchId: entry.matchId },
      }
      await prisma.$transaction([...clearTag(previous), award])
    } else {
      await award
    }
  }

  /*
    `refresh()`, not `revalidatePath()`. Almost everything written about Next
    says the latter, but `revalidatePath` invalidates a *cache* and the match
    page is `force-dynamic` with nothing cached to invalidate. `refresh()` says
    what is actually wanted — re-render the current route — and Next streams the
    new RSC payload back inside this action's own response, so the panel counts
    and the summary update without a second request.

    It is also what moves the demoted MVP's chip: that row is a separate island
    with its own optimistic state and no knowledge of this one, so the server's
    answer is the only thing that can un-fill it.
  */
  refresh()
}

/**
 * Set — or clear — the signed-in user's note on one player in one match.
 *
 * Set-semantics again, and the same shape as `setVerdict` throughout: the caller
 * sends the text it wants stored, and **the empty string is how a note is
 * deleted**. There is no separate delete action and the design draws no delete
 * button; clearing the box and saving is the one gesture.
 *
 * A note with no tag is a valid judgement, so a note may create a row on its own.
 * Clearing the last of the two is what removes it, which is `clearNote`'s job.
 */
export async function setNote(matchSquadId: number, note: string) {
  const user = await requireDbUser()

  // Untrusted, both of them — see the file comment. `typeof` is the check that
  // matters for the second: this arrives as JSON, so it could be a number, an
  // object, or absent entirely, and `.trim()` on any of those throws something
  // unreadable instead of saying what was wrong.
  if (!Number.isInteger(matchSquadId)) throw new Error('setNote: matchSquadId must be an integer')
  if (typeof note !== 'string') throw new Error('setNote: note must be a string')

  const text = note.trim()
  if (text.length > NOTE_MAX_LENGTH) throw new Error('setNote: note is too long')

  /*
    The same lookup `setVerdict` makes, for one of its two reasons rather than
    both: nothing here needs the match, but a bogus id needs to become a clear
    message. Without it the two branches fail differently and neither says much —
    the upsert with a raw foreign-key violation, and the clear not at all, since
    `deleteMany` matching nothing is a success.
  */
  const entry = await prisma.matchSquad.findUnique({
    where: { id: matchSquadId },
    select: { id: true },
  })
  if (entry === null) throw new Error(`setNote: no squad entry ${matchSquadId}`)

  const mine = { userId: user.id, matchSquadId }

  if (text === '') {
    await prisma.$transaction(clearNote(mine))
  } else {
    await prisma.judgement.upsert({
      where: { userId_matchSquadId: { userId: user.id, matchSquadId } },
      update: { note: text },
      create: { userId: user.id, matchSquadId, note: text },
    })
  }

  refresh()
}
