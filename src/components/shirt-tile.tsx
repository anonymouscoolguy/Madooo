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
 * `--radius-md` and 64px rather than the crest chip's 2px and 20px: this is the
 * page's identity mark, not a label in a row, and foundations gives `--radius-md`
 * to almost everything.
 */
export function ShirtTile({
  team,
  shirtNumber,
}: {
  team: TeamIdentity | null
  shirtNumber: number | null
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
      // `text-stat` is foundations' 32px monospace role: a shirt number is a
      // number you can add up, and this is the largest one on the page.
      className="flex size-16 shrink-0 items-center justify-center rounded-md text-stat"
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
