/**
 * Turning a match's squad rows into the two lists the match page draws.
 *
 * Pure, and deliberately so: ordering a squad is a decision, not a query, and it
 * is the kind of decision that is worth a test. Prisma is not imported here —
 * everything below is structural, so a mapped entry straight out of the sync
 * satisfies it just as well as a database row, which is what lets the tests run
 * the real captured lineup through it without a database.
 */

/**
 * The shape this module needs, rather than Prisma's `MatchSquad`.
 *
 * Same move as `TeamIdentity` in `teams/identity.ts`, for the same reason:
 * TypeScript types are **structural**, so anything carrying these properties is
 * accepted without being named here.
 */
export interface SquadOrderable {
  position: string | null
  grid: string | null
  shirtNumber: number | null
  player: { name: string }
}

/**
 * `MatchSquad.position` is only ever `G`, `D`, `M` or `F` — that is the whole
 * vocabulary both provider endpoints use, and it is checked against the captured
 * payload in `squad.test.ts`.
 *
 * The reference screenshots label players `RB`, `CB`, `AM`, `LW`. That data does
 * not exist anywhere in the provider's responses. `grid` ("row:column") holds
 * enough to guess a side, but the column convention is unverified and a wrong
 * guess prints a confident falsehood about a real player, so the four letters we
 * hold are expanded and nothing else is inferred.
 */
const POSITION_LABELS: Record<string, string> = {
  G: 'GK',
  D: 'DEF',
  M: 'MID',
  F: 'FWD',
}

/** `GK`, `DEF`, `MID`, `FWD`, or null — and a null renders no position at all. */
export function positionLabel(position: string | null): string | null {
  if (position === null) return null
  return POSITION_LABELS[position.trim().toUpperCase()] ?? null
}

/** Back to front, which is the order a team sheet is read in. Unknown last. */
const POSITION_RANK: Record<string, number> = { G: 0, D: 1, M: 2, F: 3 }

function positionRank(position: string | null): number {
  if (position === null) return POSITION_RANK.F + 1
  return POSITION_RANK[position.trim().toUpperCase()] ?? POSITION_RANK.F + 1
}

/**
 * `"2:4"` to `[2, 4]`; anything else to `[Infinity, Infinity]`, which sorts last.
 *
 * **Parsed rather than compared as a string.** A formation can reach row 10 in
 * principle, and `"10:1" < "2:1"` lexically — the kind of bug that only appears
 * on the one fixture nobody looked at. Substitutes carry no grid at all.
 */
function gridCell(grid: string | null): [number, number] {
  const parts = grid?.split(':') ?? []
  const row = Number(parts[0])
  const column = Number(parts[1])
  if (!Number.isFinite(row) || !Number.isFinite(column)) {
    return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  }
  return [row, column]
}

/**
 * Goalkeeper first, then the defence, the midfield and the attack.
 *
 * Position rank leads rather than the grid, because it is the only key the
 * substitutes have — the provider sends the bench in no useful order, and both
 * reference screenshots show it grouped the same way as the starting XI. Within
 * a group the grid orders the line across the pitch, then the shirt number, then
 * the name, so the result is total and cannot depend on the order Postgres
 * happened to return the rows in.
 */
export function compareSquadEntries(a: SquadOrderable, b: SquadOrderable): number {
  const byPosition = positionRank(a.position) - positionRank(b.position)
  if (byPosition !== 0) return byPosition

  const [rowA, columnA] = gridCell(a.grid)
  const [rowB, columnB] = gridCell(b.grid)
  if (rowA !== rowB) return rowA - rowB
  if (columnA !== columnB) return columnA - columnB

  // A player with no shirt number sorts after one who has one, rather than
  // ahead of everybody the way `null` would if it were coerced to zero.
  const numberA = a.shirtNumber ?? Number.POSITIVE_INFINITY
  const numberB = b.shirtNumber ?? Number.POSITIVE_INFINITY
  if (numberA !== numberB) return numberA - numberB

  return a.player.name.localeCompare(b.player.name)
}

/**
 * What a season roster carries. No `grid`, and that is the difference from
 * `SquadOrderable` rather than an omission: where a player stood is a fact about
 * one match, and a club's roster spans every match of the season.
 */
export interface RosterOrderable {
  position: string | null
  shirtNumber: number | null
  name: string
}

/**
 * The same reading as `compareSquadEntries` — goalkeeper, defence, midfield,
 * attack — with the grid taken out of the middle of it.
 *
 * A shirt number orders a position group about as well as anything else does
 * once the pitch is gone: it is broadly positional at a club, and it is stable,
 * which is what a list drawn on every request needs. Ending in the name makes
 * the order total, so two squad players sharing a number cannot swap places
 * between requests.
 */
export function compareRosterEntries(a: RosterOrderable, b: RosterOrderable): number {
  const byPosition = positionRank(a.position) - positionRank(b.position)
  if (byPosition !== 0) return byPosition

  const numberA = a.shirtNumber ?? Number.POSITIVE_INFINITY
  const numberB = b.shirtNumber ?? Number.POSITIVE_INFINITY
  if (numberA !== numberB) return numberA - numberB

  return a.name.localeCompare(b.name)
}

/**
 * One team's half of the squad, split by `isStarter` and each half ordered.
 *
 * Both lists can come back empty and the caller has to cope: the sync's merge is
 * a union over two endpoints, so a fixture with one published lineup produces
 * rows for one team only.
 */
export function splitSquad<T extends SquadOrderable & { teamId: number; isStarter: boolean }>(
  entries: readonly T[],
  teamId: number,
): { starters: T[]; substitutes: T[] } {
  const mine = entries.filter((entry) => entry.teamId === teamId)
  return {
    starters: mine.filter((entry) => entry.isStarter).sort(compareSquadEntries),
    substitutes: mine.filter((entry) => !entry.isStarter).sort(compareSquadEntries),
  }
}
