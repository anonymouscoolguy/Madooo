import { Icon } from './icon'
import type { IconName } from './icon-names'
import type { DiaryTotals } from '@/lib/diary'
import type { SeasonTotals } from '@/lib/fixtures'

/**
 * The four tallies a screen opens with: what the user has done, and what they
 * said about it.
 *
 * The same card as `FixtureCard` and `SquadPanel` — a bordered `--surface` at
 * `--radius-md` with no shadow — so the page reads as one system rather than as
 * a dashboard bolted above a list.
 *
 * Both screens that have tiles draw the same four boxes over different numbers,
 * so this is generic over the keys rather than duplicated. The tables below are
 * what differ; the markup is the constant.
 *
 * Both totals types arrive through `import type`, which TypeScript **erases** at
 * compile time. A component file can therefore name a type out of a module that
 * imports Prisma without the client reaching the browser bundle — the import is
 * a compile-time fact only, and nothing of it survives into the output.
 */

/**
 * `K` is the union of keys the tiles read, so a tile naming something the totals
 * object does not have is a compile error rather than an `undefined` rendered as
 * blank. `extends string` is what lets `Record<K, number>` below be an object
 * with those exact keys.
 */
export type Tile<K extends string> = {
  key: K
  icon: IconName
  label: string
  /**
   * The number's colour, written out in full and never assembled from the key.
   * **Tailwind finds class names by scanning source as text**, so a name built at
   * runtime is one it never sees and never generates CSS for.
   */
  ink: string
  /** Only `/fixtures`' first tile carries one, exactly as the design draws it. */
  sub?: string
}

/** `/fixtures`: the season, and the three verdict tallies in it. */
export const FIXTURE_TILES: readonly Tile<keyof SeasonTotals>[] = [
  { key: 'watched', icon: 'visibility', label: 'Watched', ink: 'text-text', sub: 'this season' },
  { key: 'standouts', icon: 'trending_up', label: 'Standouts', ink: 'text-standout' },
  { key: 'flops', icon: 'trending_down', label: 'Flops', ink: 'text-flop' },
  // A note is not a verdict, so it takes the informational blue rather than one
  // of the three verdict colours — the same distinction the match page draws by
  // leaving notes out of its header counts.
  { key: 'notes', icon: 'edit_note', label: 'Notes', ink: 'text-info' },
]

/**
 * `/diary`: the same three, under a count of the list below rather than of the
 * matches it came from. `two_pager` is the sidebar's own Diary glyph, so the
 * tile and the destination agree.
 *
 * No `sub` on any of them, as the reference screenshot draws it — the diary
 * says "this season" in its subtitle instead.
 */
export const DIARY_TILES: readonly Tile<keyof DiaryTotals>[] = [
  { key: 'entries', icon: 'two_pager', label: 'Entries', ink: 'text-text' },
  { key: 'standouts', icon: 'trending_up', label: 'Standouts', ink: 'text-standout' },
  { key: 'flops', icon: 'trending_down', label: 'Flops', ink: 'text-flop' },
  { key: 'notes', icon: 'edit_note', label: 'Notes', ink: 'text-info' },
]

type Props<K extends string> = {
  tiles: readonly Tile<K>[]
  totals: Record<K, number>
}

export function StatTiles<K extends string>({ tiles, totals }: Props<K>) {
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
      {tiles.map((tile) => (
        <li key={tile.key} className="rounded-md border border-border bg-surface p-4">
          {/* Not a heading. A tile is a datum, not a section of the page, and
              an <h2> here would put four of them between the page title and the
              list in a screen reader's outline. */}
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
