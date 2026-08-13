/**
 * The national flag of the country a competition is played in, beside its name.
 *
 * **A mark, not an icon**, which is what lets it exist at all: `foundations.md`
 * bans emoji and hand-drawn SVG under Iconography because both are attempts to
 * say something the Material Symbols vocabulary should say, and a flag competes
 * for no slot in it. The rule it answers to instead is the club mark's — it
 * renders `League.country` as the sync stored it, and nothing at a call site
 * chooses which flag appears.
 *
 * `aria-hidden` for `CrestChip`'s reason: the league's name is the next thing in
 * the pill and says the same thing. Every caller has to keep that true.
 *
 * **Nothing at all for a country we have no file for**, rather than a hidden
 * span — an empty span is still a flex item, and the pill's `gap` would leave a
 * phantom 8px where the mark would have been. Returning `null` is what makes an
 * unmapped league draw exactly the pill it drew before flags existed.
 */

import { flagClass, type LeagueIdentity } from '@/lib/leagues'

export function LeagueFlag({ league }: { league: LeagueIdentity }) {
  const flag = flagClass(league)
  if (flag === null) return null

  /*
    12x16 at 4:3, both on Tailwind's default scale, which is foundations'
    spacing scale — no arbitrary value. 12px tall against the 13px --text-label
    of a 28px pill is the weight a mark wants; the 20px of a badge would crowd
    it. `rounded-sm` is --radius-sm, which foundations gives to badges and crest
    chips, the class of object this is.

    Whole class strings, `CrestChip`'s rule: Tailwind finds class names by
    scanning source as text, so `flag` arrives from `flagClass` as one of three
    literals that appear in globals.css rather than assembled here.
  */
  return <span aria-hidden className={`flag ${flag} inline-block h-3 w-4 shrink-0 rounded-sm`} />
}
