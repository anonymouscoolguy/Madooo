/**
 * Every date the app renders, formatted in one place.
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
  timeZone: 'Europe/London',
})

const timeOnly = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/London',
})

/**
 * `formatToParts` rather than `format`, so each piece can be used on its own and
 * recombined. It returns the same output as `format` would, chopped into typed
 * segments — which is the only way to reach the month without also getting the
 * locale's idea of how to punctuate it.
 */
function parts(date: Date): { weekday: string; day: string; month: string } {
  const found = dateParts.formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    found.find((part) => part.type === type)?.value ?? ''
  return {
    weekday: value('weekday'),
    day: value('day'),
    month: value('month').slice(0, 3),
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
