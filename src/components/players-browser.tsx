'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { playerHref } from '@/lib/back'
import {
  ALL_LEAGUES,
  PLAYERS_LAYOUT_KEY,
  PLAYERS_LEAGUE_KEY,
  PLAYERS_SORT_KEY,
  PLAYER_SORTS,
  filterPlayers,
  parseLayout,
  parseLeague,
  parseSort,
  type LeagueOption,
  type PlayerIndexRow,
} from '@/lib/players-index'
import { positionLabel } from '@/lib/squad'
import { verdictSplit } from '@/lib/verdict-split'
import { Icon } from './icon'
import { LayoutToggle } from './layout-toggle'
import { SearchField } from './search-field'
import { SelectField } from './select-field'
import { ShirtTile } from './shirt-tile'
import { SplitBar, SplitLegend } from './split-bar'
import { usePreference, writePreference } from './use-preference'
import type { IndexTeam } from '@/lib/players'

/**
 * The players index below its tiles: the controls, and the list they draw.
 *
 * **The slice's only client component, and the only screen in the app whose
 * state is not in the URL.** Everywhere else — the matchday, the diary's filter,
 * a profile's tab — the choice is a *location*, so it lives in the address bar
 * and the page stays a server component. The three controls here are
 * *preferences*: "how do I like this drawn" rather than "what am I looking at".
 * Nobody bookmarks Grid. So they live in `localStorage`, which is also the only
 * store that survives closing the tab.
 *
 * The whole season's players arrive as a prop and the filtering happens here.
 * That is what makes the search box reach a player the reader has never judged
 * without a round trip — the stated point of the screen. It costs ~15 kB
 * compressed for a league of six hundred, which is less than one of the fonts;
 * the expensive part is drawing them, which `SHOWN_STEP` below pays for.
 */

/**
 * How many rows are drawn at once, and how many more each "Show more" adds.
 *
 * The reference drawings show every row, and they were made against a list of
 * eighteen judged players. The list is now the whole league, so ~600 rows would
 * be ~9,000 elements re-examined on every keystroke in the search box — which
 * would work directly against the one thing this screen is for.
 *
 * Nothing is hidden from search or sort: both run over the full array and the
 * header strip states the true count. Divisible by three, so the grid never ends
 * on a ragged row.
 */
const SHOWN_STEP = 60

function Row({ player, team }: { player: PlayerIndexRow; team: IndexTeam | null }) {
  const position = positionLabel(player.position)
  const segments = verdictSplit({
    watched: player.seen,
    mvps: player.mvps,
    standouts: player.standouts,
    flops: player.flops,
  })

  return (
    <li>
      {/*
        The whole row is the link, because the chevron promises it is. Ink rather
        than the link colour and `no-underline` in both states: the base
        stylesheet styles every <a> as prose, which is right for a sentence and
        wrong for a row.

        Two lines below `md`, one from `md` up. The reference is desktop-only, so
        the narrow arrangement is a decision: at 320px a single line leaves no
        room for a bar between a name and a count. `min-h` rather than a fixed
        height, 6.3's choice — the touch row height is a floor the row may grow
        past.

        Club and position sit under the name at every width, which is what the
        grid card does too; the separate position column at `md` is the drawing's
        arrangement, and it is `hidden` below it rather than moved.
      */}
      <Link
        href={playerHref(player.id, '/players')}
        className="t-hover grid min-h-(--row-h-lg) grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-text no-underline hover:bg-surface-alt hover:text-text hover:no-underline focus-visible:focus-ring md:grid-cols-[auto_minmax(0,1fr)_4rem_12rem_auto]"
      >
        <ShirtTile team={team} shirtNumber={player.shirtNumber} size="sm" />

        <span className="min-w-0">
          <span className="block truncate text-body font-medium">{player.name}</span>
          <span className="block truncate text-caption text-muted">
            {[team?.name, position].filter(Boolean).join(' · ')}
          </span>
        </span>

        {/* The drawing's own position column. Hidden below `md`, where the same
            fact is already under the name. */}
        <span className="hidden text-caps text-faint md:block">{position}</span>

        {/*
          The bar spans the full width on line two below `md`, and takes its own
          column at `md`. `SplitBar` is aria-hidden, so the counts are stated
          here — otherwise they would leave the accessibility tree entirely, and
          the row would announce a name and a number with nothing between them.
        */}
        <span className="col-start-2 -col-end-1 md:col-start-4 md:col-end-auto">
          <SplitBar segments={segments} />
          <span className="sr-only">
            {player.mvps} MVP, {player.standouts} standout, {player.flops} flop
          </span>
        </span>

        <span className="col-start-3 row-start-1 flex shrink-0 items-center gap-1 justify-self-end md:col-start-5 md:row-start-auto">
          <span className="text-data">{player.seen}</span>
          <span className="text-caption text-muted">seen</span>
          <Icon name="chevron_right" size="md" className="text-faint" />
        </span>
      </Link>
    </li>
  )
}

function Card({ player, team }: { player: PlayerIndexRow; team: IndexTeam | null }) {
  const position = positionLabel(player.position)
  const segments = verdictSplit({
    watched: player.seen,
    mvps: player.mvps,
    standouts: player.standouts,
    flops: player.flops,
  })

  return (
    <li>
      <Link
        href={playerHref(player.id, '/players')}
        className="t-hover flex h-full flex-col gap-3 rounded-md border border-border bg-surface p-4 text-text no-underline hover:bg-surface-alt hover:text-text hover:no-underline focus-visible:focus-ring"
      >
        <span className="flex items-center gap-3">
          <ShirtTile team={team} shirtNumber={player.shirtNumber} />
          <span className="min-w-0">
            <span className="block truncate text-body font-medium">{player.name}</span>
            <span className="block truncate text-caption text-muted">
              {[team?.name, position].filter(Boolean).join(' · ')}
            </span>
          </span>
        </span>

        <SplitBar segments={segments} />

        {/*
          The three verdicts only. A card has no "seen" number on it, so
          `unrated` would be a remainder of something the reader cannot see — on
          the profile it reads as "watched him and said nothing" precisely
          because the watched count is right there.

          Filtered by key rather than sliced, so a fourth verdict could never
          silently take `unrated`'s place.
        */}
        <SplitLegend
          segments={segments.filter((segment) => segment.key !== 'unrated')}
          className="mt-auto"
        />
      </Link>
    </li>
  )
}

export function PlayersBrowser({
  players,
  teams,
  leagues,
}: {
  players: readonly PlayerIndexRow[]
  teams: readonly IndexTeam[]
  leagues: readonly LeagueOption[]
}) {
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(SHOWN_STEP)

  // The stored strings, each turned into a value by its own tested parser —
  // never trusted as it comes out of storage.
  const layout = parseLayout(usePreference(PLAYERS_LAYOUT_KEY))
  const sort = parseSort(usePreference(PLAYERS_SORT_KEY))
  const leagueId = parseLeague(usePreference(PLAYERS_LEAGUE_KEY), leagues)

  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams])

  /**
   * Every player on this list has a club — the query selects from `MatchSquad` —
   * so a miss here would mean the two queries disagreed, not that the player is
   * unattached. `ShirtTile` draws null as a neutral tile either way, which is the
   * right thing to do with a disagreement.
   */
  const clubOf = (player: PlayerIndexRow) => teamsById.get(player.teamId) ?? null

  const visible = useMemo(
    () => filterPlayers(players, query, leagueId).sort(sort.compare),
    [players, query, leagueId, sort],
  )

  /*
    Reset the cap when the list underneath it changes, **derived during render
    rather than set from an effect**: `react-hooks/set-state-in-effect` rejects
    the effect form, and an effect would also paint one frame of the old cap
    against the new list. Comparing a signature with the last one rendered is
    React's documented way of adjusting state on a prop change.
  */
  const signature = `${query} ${leagueId ?? ''} ${sort.slug}`
  const [lastSignature, setLastSignature] = useState(signature)
  if (signature !== lastSignature) {
    setLastSignature(signature)
    setShown(SHOWN_STEP)
  }

  const drawn = visible.slice(0, shown)

  const leagueOptions = [
    { value: ALL_LEAGUES, label: 'All leagues' },
    ...leagues.map((league) => ({ value: String(league.id), label: league.name })),
  ]

  return (
    <>
      {/*
        Wraps rather than scrolling. Below `md` that is the search box on its own
        line, then the two selects and the toggle on the next — foundations' rule
        that layout changes arrangement at a breakpoint rather than scaling.
      */}
      <div className="mb-6 flex flex-wrap items-center gap-2 md:gap-3">
        <SearchField
          label="Search players by name"
          placeholder="Search for any player by name"
          value={query}
          onChange={setQuery}
          className="basis-full md:basis-0 md:grow"
        />
        <SelectField
          label="League"
          value={leagueId === null ? ALL_LEAGUES : String(leagueId)}
          options={leagueOptions}
          onChange={(value) => writePreference(PLAYERS_LEAGUE_KEY, value)}
          className="grow md:w-44 md:grow-0"
        />
        <SelectField
          label="Sort by"
          value={sort.slug}
          options={PLAYER_SORTS.map((candidate) => ({
            value: candidate.slug,
            label: candidate.label,
          }))}
          onChange={(value) => writePreference(PLAYERS_SORT_KEY, value)}
          className="grow md:w-44 md:grow-0"
        />
        <LayoutToggle
          layout={layout}
          onChange={(value) => writePreference(PLAYERS_LAYOUT_KEY, value)}
        />
      </div>

      {visible.length === 0 ? (
        // Its own sentence, so "nothing matches what you typed" never reads as
        // "there are no players" — the distinction `DIARY_FILTERS` established.
        <p className="text-body text-muted">No players match your search.</p>
      ) : (
        <>
          {layout === 'list' ? (
            // The `SquadPanel` card, so the two screens read as one system.
            <section className="overflow-hidden rounded-md border border-border bg-surface">
              <header className="flex items-center justify-between gap-3 bg-surface-header px-4 py-2">
                <h2 className="truncate text-caps">{sort.label}</h2>
                {/* The true filtered count, not the drawn one: the cap is a
                    drawing decision and should not be reported as a fact about
                    the league. */}
                <span className="shrink-0 text-data text-muted">
                  {visible.length}
                  <span className="sr-only"> players</span>
                </span>
              </header>
              <ul className="divide-y divide-border">
                {drawn.map((player) => (
                  <Row key={player.id} player={player} team={clubOf(player)} />
                ))}
              </ul>
            </section>
          ) : (
            /* Two across at `lg`, three at `xl`. Not `md:grid-cols-2`: at 768px
               the content column is ~488px, so two cards would be ~228px each,
               which will not hold a 64px tile beside "Manchester United · MID"
               with three badges under it. */
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {drawn.map((player) => (
                <Card key={player.id} player={player} team={clubOf(player)} />
              ))}
            </ul>
          )}

          {shown < visible.length ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setShown((current) => current + SHOWN_STEP)}
                className="t-hover inline-flex h-(--control-h-lg) items-center rounded-md border border-border bg-surface px-4 text-label text-text hover:border-border-strong hover:bg-surface-alt active:translate-y-px focus-visible:focus-ring md:h-(--control-h)"
              >
                Show more
                {/* The numbers say how much is left, which a bare "Show more"
                    does not — and the count is already on screen above. */}
                <span className="sr-only"> — {visible.length - shown} players remaining</span>
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
