'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { teamHref } from '@/lib/back'
import {
  ALL_LEAGUES,
  SORTS,
  filterRows,
  parseLayout,
  parseLeague,
  parseSort,
  type LeagueOption,
} from '@/lib/rankings'
import {
  TEAMS_LAYOUT_KEY,
  TEAMS_LEAGUE_KEY,
  TEAMS_SORT_KEY,
  type TeamIndexRow,
} from '@/lib/teams-index'
import { verdictMix } from '@/lib/verdict-split'
import { CrestChip } from './crest-chip'
import { LayoutToggle } from './layout-toggle'
import { SearchField } from './search-field'
import { SelectField } from './select-field'
import { SplitBar, SplitLegend } from './split-bar'
import { TeamRow } from './team-row'
import { usePreference, writePreference } from './use-preference'

/**
 * The teams index below its header: the controls, and the list they draw.
 *
 * The second of the app's two client-rendered lists, and
 * [`players-browser.tsx`](./players-browser.tsx) is the template — that file
 * carries the full argument for why these three controls live in `localStorage`
 * rather than the URL, and what the first paint costs. In short: a *location*
 * belongs in the address bar, a *preference* does not, and nobody bookmarks Grid.
 *
 * **What is deliberately not copied is the row cap.** `SHOWN_STEP` exists over
 * there because ~600 rows would be re-examined on every keystroke; a competition
 * has twenty clubs, and five leagues would still be a hundred. A cap that never
 * triggers is a control that does nothing, and 6.1 refused one of those already.
 * That also means the "Show more" button, and the reset-on-filter-change dance
 * around it, are both absent.
 */

/**
 * The row is `TeamRow`; the card is here, because only this screen has one.
 *
 * Its shape is `players-browser`'s card exactly — mark, name, a meta line, the
 * bar, the legend — so the two grids read as one system rather than as two
 * screens that happen to use cards.
 */
function Card({ team }: { team: TeamIndexRow }) {
  const segments = verdictMix(team)

  return (
    <li>
      <Link
        href={teamHref(team.id, '/teams')}
        className="t-hover flex h-full flex-col gap-3 rounded-md border border-border bg-surface p-4 text-text no-underline hover:bg-surface-alt hover:text-text hover:no-underline focus-visible:focus-ring"
      >
        <span className="flex items-center gap-3">
          <CrestChip team={team} size="lg" />
          <span className="min-w-0">
            <span className="block truncate text-body font-medium">{team.name}</span>
            {/*
              The drawing writes "Premier League · 14 judged" here and "14 seen"
              on the list row, for the same number. One word — `seen` — because
              "judged" already means something else on a club's own profile,
              where a squad row's `N judged` counts judgements on that player.
              `filter(Boolean)` so a club with no competition draws no bullet.
            */}
            <span className="block truncate text-caption text-muted">
              {[team.league, `${team.seen} seen`].filter(Boolean).join(' · ')}
            </span>
          </span>
        </span>

        <SplitBar segments={segments} />

        {/*
          `verdictMix` returns the three verdicts and no `unrated`, so unlike the
          players card there is nothing here to filter out — the absent remainder
          is a fact about the arithmetic rather than a choice about the legend.
        */}
        <SplitLegend segments={segments} className="mt-auto" />
      </Link>
    </li>
  )
}

export function TeamsBrowser({
  teams,
  leagues,
}: {
  teams: readonly TeamIndexRow[]
  leagues: readonly LeagueOption[]
}) {
  const [query, setQuery] = useState('')

  // The stored strings, each turned into a value by its own tested parser —
  // never trusted as it comes out of storage.
  const layout = parseLayout(usePreference(TEAMS_LAYOUT_KEY))
  const sort = parseSort(usePreference(TEAMS_SORT_KEY))
  const leagueId = parseLeague(usePreference(TEAMS_LEAGUE_KEY), leagues)

  const visible = useMemo(
    () => filterRows(teams, query, leagueId).sort(sort.compare),
    [teams, query, leagueId, sort],
  )

  const leagueOptions = [
    { value: ALL_LEAGUES, label: 'All leagues' },
    ...leagues.map((league) => ({ value: String(league.id), label: league.name })),
  ]

  return (
    <>
      {/*
        Wraps rather than scrolling. Below `md` that is the search box on its own
        line, then the two selects and the toggle on the next — foundations' rule
        that layout changes arrangement at a breakpoint rather than scaling. The
        same classes as the players index, because foundations requires a filter
        row's controls to read as one set.
      */}
      <div className="mb-6 flex flex-wrap items-center gap-2 md:gap-3">
        <SearchField
          label="Search teams by name"
          placeholder="Search by name"
          value={query}
          onChange={setQuery}
          className="basis-full md:basis-0 md:grow"
        />
        <SelectField
          label="League"
          value={leagueId === null ? ALL_LEAGUES : String(leagueId)}
          options={leagueOptions}
          onChange={(value) => writePreference(TEAMS_LEAGUE_KEY, value)}
          className="grow md:w-44 md:grow-0"
        />
        <SelectField
          label="Sort by"
          value={sort.slug}
          options={SORTS.map((candidate) => ({ value: candidate.slug, label: candidate.label }))}
          onChange={(value) => writePreference(TEAMS_SORT_KEY, value)}
          className="grow md:w-44 md:grow-0"
        />
        <LayoutToggle
          layout={layout}
          onChange={(value) => writePreference(TEAMS_LAYOUT_KEY, value)}
        />
      </div>

      {visible.length === 0 ? (
        // Its own sentence, so "nothing matches what you typed" never reads as
        // "there are no teams" — the distinction `DIARY_FILTERS` established.
        <p className="text-body text-muted">No teams match your search.</p>
      ) : layout === 'list' ? (
        // The `SquadPanel` card, so every list in the app reads as one system.
        <section className="overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between gap-3 bg-surface-header px-4 py-2">
            <h2 className="truncate text-caps">{sort.label}</h2>
            <span className="shrink-0 text-data text-muted">
              {visible.length}
              <span className="sr-only"> teams</span>
            </span>
          </header>
          <ul className="divide-y divide-border">
            {visible.map((team) => (
              <TeamRow key={team.id} team={team} href={teamHref(team.id, '/teams')} />
            ))}
          </ul>
        </section>
      ) : (
        /* Two across at `lg`, three at `xl` — the players index's breakpoints and
           its reasoning: at 768px the content column is ~488px, which will not
           hold a 40px crest beside a club name with three badges under it. */
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visible.map((team) => (
            <Card key={team.id} team={team} />
          ))}
        </ul>
      )}
    </>
  )
}
