import { crest, type TeamIdentity } from '@/lib/teams/identity'

/**
 * A player's shirt number on his club's colour, beside his name.
 *
 * **The second place in product code that carries a colour not from the token
 * set**, after [`crest-chip.tsx`](./crest-chip.tsx), and it reaches it the same
 * way: through `crest()`, which returns the club colour with WCAG-correct black
 * or white ink over it and falls back to a neutral `--surface-sunken` for a club
 * nobody has seeded. A wrong club colour reads as a fact about the club; a grey
 * one reads as missing data.
 *
 * `--radius-md` rather than the crest chip's 2px: this is an identity mark, not a
 * label in a row, and foundations gives `--radius-md` to almost everything.
 */

/**
 * The two sizes, **written out as whole class strings** — the same reason
 * `CrestChip` does it: Tailwind finds class names by scanning source as text, so
 * one assembled from the prop is a name it never sees and never generates.
 *
 * The number is half the box in both, which is what makes them read as one
 * object at two scales rather than as two components. `text-tally` exists for the
 * small one: the mono scale jumps 13px to 32px, and neither works in 40px.
 */
const SIZES = {
  /** 40px — a list row, where the tile sits beside a name rather than above one. */
  sm: 'size-10 text-tally',
  /** 64px — a profile header and a grid card, where it is the identity mark. */
  lg: 'size-16 text-stat',
} as const

export function ShirtTile({
  team,
  shirtNumber,
  size = 'lg',
}: {
  team: TeamIdentity | null
  shirtNumber: number | null
  size?: keyof typeof SIZES
}) {
  // No squad row this season means no club to take a colour from — a real state,
  // reachable by typing a profile URL for a player who has not been named yet.
  const { background, ink } =
    team === null
      ? { background: 'var(--surface-sunken)', ink: 'var(--text-muted)' }
      : crest(team)

  return (
    <span
      style={{ backgroundColor: background, color: ink }}
      // Monospaced at either size: a shirt number is a number you can add up.
      className={`flex shrink-0 items-center justify-center rounded-md ${SIZES[size]}`}
      // With no number there is nothing to announce, and the em dash standing in
      // for one would be read aloud as punctuation.
      aria-hidden={shirtNumber === null ? true : undefined}
    >
      {shirtNumber === null ? (
        '—'
      ) : (
        <>
          {/* Otherwise a screen reader opens the page with a bare "20". */}
          <span className="sr-only">Shirt number </span>
          {shirtNumber}
        </>
      )}
    </span>
  )
}
