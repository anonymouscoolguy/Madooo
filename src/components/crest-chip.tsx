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
 * and says the same thing. Every caller has to keep that true — the squad panel
 * headers name their club in an `sr-only` span precisely because this mark
 * cannot.
 */

/**
 * The two sizes foundations gives a club mark, written out as whole class
 * strings: **Tailwind finds class names by scanning source as text**, so one
 * assembled from the prop would be a name it never sees and never generates.
 *
 * `sm` is foundations' 20px "Badge, crest chip" row with `--radius-sm` — a label
 * sitting inside a row of other things. `lg` is 40px with `--radius-md`, which
 * foundations gives to "almost everything: buttons, fields, cards, tiles": a
 * mark carrying the identity of the whole page is a tile, not a label, and it is
 * the same reading that put `ShirtTile` on `--radius-md`.
 *
 * `text-caps` at both sizes rather than growing with the box. It is the only
 * role that is bold, tracked *and* capitalised, which is what three letters on a
 * saturated colour need to stay legible, and the reference draws both chips'
 * labels at the same optical size. `text-data` would be wrong outright — a club
 * code is not a number you can add up, which is the whole of the rule that picks
 * the monospaced family.
 */
const SIZES = {
  sm: 'h-5 rounded-sm px-1.5',
  // No horizontal padding: a fixed square centres its content already, and
  // padding on it could only squeeze a four-letter code.
  lg: 'size-10 rounded-md',
} as const

export function CrestChip({
  team,
  size = 'sm',
}: {
  team: TeamIdentity
  size?: keyof typeof SIZES
}) {
  const { label, background, ink } = crest(team)

  return (
    <span
      aria-hidden
      style={{ backgroundColor: background, color: ink }}
      className={`inline-flex shrink-0 items-center justify-center text-caps ${SIZES[size]}`}
    >
      {label}
    </span>
  )
}
