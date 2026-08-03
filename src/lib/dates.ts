/**
 * Every date the app renders, and the one place that decides what calendar month
 * a moment falls in.
 *
 * Grouping is here rather than beside the screen that groups, because "which
 * month is this in" is the same question as "what date is this" — both are
 * answered by the zone below, and two files holding an opinion about the zone is
 * exactly one too many.
 *
 * **A fixed zone, not the server's.** Vercel runs in UTC and a laptop does not,
 * so without pinning it the same kickoff renders as two different local times
 * and, for a late one, two different dates. Europe/London because these are
 * English football fixtures and that is the clock they are played on.
 *
 * **Months are cut to three letters, and that is not laziness.** `en-GB` renders
 * September as `Sept` — four characters, where every other month gets three —
 * and the design's date chips are three-letter months throughout. Left alone it
 * makes one matchday in nine visibly wider than its neighbours. Intl still does
 * the work that matters, which is knowing what month a UTC timestamp falls in
 * over there; the abbreviation is ours.
 *
 * The formatters are built once at module load rather than per call: the `Intl`
 * constructor is the expensive part, and a page of fixtures would build dozens.
 */

const dateParts = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  timeZone: 'Europe/London',
})

const timeOnly = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/London',
})

/**
 * The full month and year, for a diary's group headings. Its own formatter
 * rather than a fourth part above, because this one wants the month spelled out
 * — the truncation in `parts()` is for the chips, where a fourth letter would
 * make one month in twelve visibly wider than its neighbours.
 */
const monthAndYear = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/London',
})

/**
 * `formatToParts` rather than `format`, so each piece can be used on its own and
 * recombined. It returns the same output as `format` would, chopped into typed
 * segments — which is the only way to reach the month without also getting the
 * locale's idea of how to punctuate it.
 *
 * Every caller names the pieces it wants, so a formatter that gained `year` did
 * not disturb the ones that came before it.
 */
function parts(date: Date): { weekday: string; day: string; month: string; year: string } {
  const found = dateParts.formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    found.find((part) => part.type === type)?.value ?? ''
  return {
    weekday: value('weekday'),
    day: value('day'),
    month: value('month').slice(0, 3),
    year: value('year'),
  }
}

/** `Sat 27 Sep` — the fixture card's header. Uppercased in CSS, not here. */
export function kickoffDate(kickoff: Date): string {
  const { weekday, day, month } = parts(kickoff)
  return `${weekday} ${day} ${month}`
}

/** `15:00`, shown in place of a score for a match that has not been played. */
export function kickoffTime(kickoff: Date): string {
  return timeOnly.format(kickoff)
}

/**
 * A matchday's span: `27 Sep`, `27–28 Sep`, or `30 Nov – 1 Dec`.
 *
 * The month is dropped from the first date only when both fall in the same one.
 * A matchday really can straddle two months — the captured season has one — and
 * `30–1 Dec` would be nonsense.
 */
export function dateRange(first: Date, last: Date): string {
  const from = parts(first)
  const to = parts(last)
  if (from.day === to.day && from.month === to.month) return `${to.day} ${to.month}`
  if (from.month === to.month) return `${from.day}–${to.day} ${to.month}`
  return `${from.day} ${from.month} – ${to.day} ${to.month}`
}

/**
 * `27 Sep 25` — the date on a diary entry. Uppercased in CSS, as the others are.
 *
 * No weekday and a two-digit year: the diary is read down a column of dates, so
 * what matters is telling one entry from the next, and a season crosses a new
 * year in January.
 */
export function entryDate(date: Date): string {
  const { day, month, year } = parts(date)
  return `${day} ${month} ${year}`
}

/** `September 2025` — a diary's group heading. Uppercased in CSS. */
export function monthLabel(date: Date): string {
  return monthAndYear.format(date)
}

/** A run of items that fall in one calendar month, labelled by it. */
export interface MonthGroup<T> {
  label: string
  items: T[]
}

/**
 * Cut an **already-sorted** list into calendar months.
 *
 * The precondition is the whole design: this walks the list once and starts a
 * new group whenever the label changes, so it preserves whatever order it was
 * handed and never imposes one. The caller sorts — in the diary's case Postgres
 * does, in the `ORDER BY` that the query was written around — and sorting here
 * as well would be a second opinion about order, free to disagree with it.
 *
 * Generic over `T` with a `(item: T) => Date` accessor rather than requiring a
 * `date` property, so it groups anything without knowing what a judgement is.
 * TypeScript infers `T` from the array at the call site, which is what keeps
 * `groups[0].items[0]` fully typed rather than `unknown`.
 */
export function groupByMonth<T>(items: readonly T[], dateOf: (item: T) => Date): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = []

  for (const item of items) {
    const label = monthLabel(dateOf(item))
    const open = groups.at(-1)

    if (open !== undefined && open.label === label) open.items.push(item)
    else groups.push({ label, items: [item] })
  }

  return groups
}
