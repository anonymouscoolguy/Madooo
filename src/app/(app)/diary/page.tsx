import { requireDbUser } from '@/lib/auth'
import { groupByMonth } from '@/lib/dates'
import { diaryEntries, diaryTotals } from '@/lib/diary'
import { parseFilter } from '@/lib/diary-filters'
import { season } from '@/lib/env'
import { DiaryEntry } from '@/components/diary-entry'
import { DiaryTabs } from '@/components/diary-tabs'
import { PageHeader } from '@/components/page-header'
import { DIARY_TILES, StatTiles } from '@/components/stat-tiles'

/**
 * Render on every request rather than once during `next build`, for the same
 * reason `/fixtures` does: a prerendered diary would freeze whatever the
 * database held when the deployment was built.
 */
export const dynamic = 'force-dynamic'

/**
 * The diary: every judgement this user has recorded, newest first, cut into
 * calendar months.
 *
 * The filter lives in the URL — `/diary?filter=flop` — which is what keeps this
 * a server component with no JavaScript of its own.
 */
export default async function Diary({ searchParams }: PageProps<'/diary'>) {
  const currentSeason = season()
  const { filter } = await searchParams
  const current = parseFilter(filter)

  // A diary belongs to one user, so both reads below need our own `User.id`.
  // The upsert behind this is memoised per request and the shell layout already
  // calls it, so it costs one indexed lookup.
  const user = await requireDbUser()

  const [totals, entries] = await Promise.all([
    diaryTotals(currentSeason, user.id),
    diaryEntries(currentSeason, user.id, current),
  ])

  // Postgres already sorted them; this only cuts the run into months. See
  // `groupByMonth` for why it must not sort.
  const months = groupByMonth(entries, (entry) => entry.createdAt)

  return (
    <>
      {/* Not "every verdict", which is what the reference screenshot says: a
          note with no tag is an entry here too, and it is not a verdict. */}
      <PageHeader title="Diary">
        Everything you have recorded this season, newest first.
      </PageHeader>

      <StatTiles tiles={DIARY_TILES} totals={totals} />
      <DiaryTabs current={current} />

      {months.length === 0 ? (
        // Each filter carries its own sentence, so "no flops" does not read as
        // "no diary" to someone who has written plenty.
        <p className="text-body text-muted">{current.empty}</p>
      ) : (
        months.map((month) => (
          <section key={month.label} className="mb-8 last:mb-0">
            {/* The heading row: the month, a rule taking whatever width is
                left, and the count of what is shown under it. The count follows
                the filter because it counts the list; the tiles above do not,
                because they count the season. */}
            <div className="flex items-center gap-3">
              <h2 className="text-caps text-muted">{month.label}</h2>
              {/* Decorative, so it is a bare span rather than an <hr>, which
                  would announce itself as a thematic break between two things
                  that are one thing. A border rather than a 1px filled box: the
                  border is foundations' primary separator, and `--border-w` is
                  the token that says how thick a hairline is. */}
              <span className="flex-1 border-t border-border" />
              {/* `--surface-alt` would be invisible against `--page` in light,
                  which is the same value; one step further down the ramp is the
                  quiet fill the screenshot draws. */}
              <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-data text-muted">
                {month.items.length}
              </span>
            </div>

            <ul className="divide-y divide-border border-b border-border">
              {month.items.map((entry) => (
                <DiaryEntry key={entry.id} entry={entry} />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  )
}
