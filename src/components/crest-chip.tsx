import { crest, type TeamIdentity } from '@/lib/teams/identity'

/**
 * The three-letter code on a club-coloured rectangle, where the design would
 * otherwise put a crest. It is a substitute for a crest, not a step towards one:
 * `Team.logo` still renders nowhere, because club badges are a trademark
 * question this project has not cleared.
 *
 * **The one place in product code that carries a colour not from the token
 * set.** A club's colour is a fact about the club, not a decision about the
 * interface, so there is no semantic token it could ever be — it comes out of
 * the database and goes straight into a style attribute. `foundations.md`
 * records this as the single sanctioned exception to its no-hex rule.
 *
 * `aria-hidden` for the same reason `<Icon>` is: the club's name is next to it
 * and says the same thing.
 */
export function CrestChip({ team }: { team: TeamIdentity }) {
  const { label, background, ink } = crest(team)

  return (
    <span
      aria-hidden
      style={{ backgroundColor: background, color: ink }}
      // h-5 is foundations' 20px badge/crest-chip height; rounded-sm its 2px.
      className="inline-flex h-5 shrink-0 items-center justify-center rounded-sm px-1.5 text-caps"
    >
      {label}
    </span>
  )
}
