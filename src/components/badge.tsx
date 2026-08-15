import { Icon } from './icon'
import type { IconName } from './icon-names'
import type { JudgementTag } from '@/lib/verdicts'

/**
 * A verdict read back: the glyph, the word, and the tint that belongs to it.
 *
 * 28px — the chip height — because this is the same object as a selected verdict
 * chip, seen after the fact rather than pressed. It is a label, not a control:
 * nothing here is clickable, and no screen that draws one lets you change the
 * verdict from it.
 *
 * Extracted from [`judgement-entry.tsx`](./judgement-entry.tsx) when the landing
 * page needed the same badge over content that never came out of the database.
 * Two copies of this markup would be two opinions about what a verdict looks
 * like, and the landing page is the one place nobody would notice them drifting.
 */

/**
 * **A fourth key over a three-value enum.** `NOTE` is not a `JudgementTag` and
 * never reaches the database — it is how a judgement carrying a note and no tag
 * is drawn, which 6.5 made a valid row. It takes the informational blue for the
 * same reason the Notes tile does: a note is not a verdict.
 */
export type BadgeKey = JudgementTag | 'NOTE'

/**
 * The tints, written out per key rather than composed, for the reason Tailwind
 * forces: it finds class names by scanning source text, so a name assembled at
 * runtime never reaches the stylesheet. The three tags reuse the selected-chip
 * vocabulary from [`verdict-controls.tsx`](./verdict-controls.tsx) exactly.
 *
 * A caller with a key of its own — the landing page's `UNRATED`, which exists in
 * no enum because the app has no such state — writes its own entry beside this
 * one rather than adding to it. What is in here is what a real judgement can be.
 */
export const VERDICT_BADGE: Record<BadgeKey, { icon: IconName; classes: string }> = {
  MVP: { icon: 'star', classes: 'border-mvp bg-mvp-bg text-mvp' },
  STANDOUT: { icon: 'trending_up', classes: 'border-standout bg-standout-bg text-standout' },
  FLOP: { icon: 'trending_down', classes: 'border-flop bg-flop-bg text-flop' },
  NOTE: { icon: 'edit_note', classes: 'border-info bg-info-bg text-info' },
}

/**
 * A match being played, drawn where its score would go.
 *
 * Deliberately outside `VERDICT_BADGE`: that table is what a real judgement can
 * be, and this is a fact about the fixture rather than anything the reader said.
 * It takes `--live`, which resolves to the same red as `--flop` and is still its
 * own token — `foundations.md` states why.
 *
 * No icon, for the reason the unrated badge has none: Material Symbols has no
 * glyph for "in play", and foundations' answer to a missing glyph is a word.
 */
export const LIVE_BADGE = 'border-live bg-live-bg text-live'

type Props = {
  /**
   * Optional, because a badge saying *no* verdict was given has no glyph to
   * show: the three verdicts each own one, and there is no Material Symbol for
   * the absence of them. Foundations' answer to a missing glyph is to use a
   * word, which is all that badge is.
   */
  icon?: IconName
  /** Uppercased by `text-caps`, so it is written here in the case it is read in. */
  label: string
  /** The border, tint and ink as one string — an entry from a table like `VERDICT_BADGE`. */
  classes: string
  /**
   * `FILL 1` means "on", and a badge is almost always something that was
   * applied. The exception is a badge saying a verdict was *not* given, which is
   * off and has to look it.
   */
  filled?: boolean
}

export function Badge({ icon, label, classes, filled = true }: Props) {
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-caps ${classes}`}
    >
      {icon ? <Icon name={icon} size="sm" filled={filled} /> : null}
      {label}
    </span>
  )
}
