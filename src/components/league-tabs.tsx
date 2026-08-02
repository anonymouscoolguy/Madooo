/**
 * The league row from the design: Premier League selected, La Liga beside it.
 *
 * Neither is a link, and that is the honest markup rather than a shortcut. Only
 * one league is in the database, so the selected tab navigates nowhere and the
 * other one cannot be reached at all. Rendering them as buttons or as
 * `role="tab"` would promise a control that does not exist; rendering them as
 * text with `aria-current` and `aria-disabled` says exactly what is true.
 *
 * When a second league lands, these become links and the disabled branch goes.
 */

const LEAGUES = [
  { name: 'Premier League', available: true },
  { name: 'La Liga', available: false },
] as const

export function LeagueTabs() {
  return (
    <nav aria-label="League" className="flex items-center gap-1">
      {LEAGUES.map((league) =>
        league.available ? (
          <span
            key={league.name}
            aria-current="page"
            // 28px and rounded-full: foundations gives the pill tab that height,
            // and --radius-pill belongs to exactly two things, of which this is
            // one.
            className="inline-flex h-7 items-center rounded-full bg-surface-inverse px-4 text-label text-inverse"
          >
            {league.name}
          </span>
        ) : (
          <span
            key={league.name}
            aria-disabled="true"
            // foundations' disabled treatment, unchanged: opacity and a cursor,
            // nothing else.
            className="inline-flex h-7 cursor-not-allowed items-center rounded-full px-4 text-label text-muted opacity-40"
          >
            {league.name}
          </span>
        ),
      )}
    </nav>
  )
}
