import { Icon } from './icon'
import type { IconName } from './icon-names'
import type { SeasonTotals } from '@/lib/fixtures'

/**
 * The four tallies above the league row: what the user has watched, and what
 * they said about it.
 *
 * The same card as `FixtureCard` and `SquadPanel` — a bordered `--surface` at
 * `--radius-md` with no shadow — so the page reads as one system rather than as
 * a dashboard bolted above a list.
 */

type Tile = {
  key: keyof SeasonTotals
  icon: IconName
  label: string
  /**
   * The number's colour, written out in full and never assembled from the key.
   * **Tailwind finds class names by scanning source as text**, so a name built at
   * runtime is one it never sees and never generates CSS for.
   */
  ink: string
  /** Only the first tile carries one, exactly as the design draws it. */
  sub?: string
}

const TILES: Tile[] = [
  { key: 'watched', icon: 'visibility', label: 'Watched', ink: 'text-text', sub: 'this season' },
  { key: 'standouts', icon: 'trending_up', label: 'Standouts', ink: 'text-standout' },
  { key: 'flops', icon: 'trending_down', label: 'Flops', ink: 'text-flop' },
  // A note is not a verdict, so it takes the informational blue rather than one
  // of the three verdict colours — the same distinction the match page draws by
  // leaving notes out of its header counts.
  { key: 'notes', icon: 'edit_note', label: 'Notes', ink: 'text-info' },
]

export function StatTiles({ totals }: { totals: SeasonTotals }) {
  return (
    /*
      Four across at `md`, two-by-two below it. The reference screens are
      desktop-only and `foundations.md`'s rule is that layout changes arrangement
      at a breakpoint rather than scaling, so the tiles rewrap rather than
      shrinking: at 320px each is ~144px, which holds "STANDOUTS" at 11px caps
      beside a 14px icon.

      Grid items stretch, so the three tiles with no sub-line come out the same
      height as the one that has it, with the space left under the number. That
      is what the screenshot shows and it needs no second declaration.
    */
    <ul className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
      {TILES.map((tile) => (
        <li key={tile.key} className="rounded-md border border-border bg-surface p-4">
          {/* Not a heading. A tile is a datum, not a section of the page, and
              an <h2> here would put four of them between the page title and the
              fixture list in a screen reader's outline. */}
          <span className="flex items-center gap-2 text-caps">
            <Icon name={tile.icon} size="xs" />
            {tile.label}
          </span>
          {/* A number you can add up, so it is monospaced — `text-stat` is the
              32px mono role foundations reserves for exactly this. */}
          <p className={`mt-2 text-stat ${tile.ink}`}>{totals[tile.key]}</p>
          {tile.sub ? <p className="mt-1 text-caption text-muted">{tile.sub}</p> : null}
        </li>
      ))}
    </ul>
  )
}
