/**
 * The icon vocabulary, and the only place it is written down.
 *
 * `docs/design/foundations.md` fixes the set: Material Symbols Outlined, and
 * nothing else — "if a glyph does not exist in Material Symbols, use a word".
 * This array is both the type that `<Icon>` accepts and the subset request that
 * `scripts/fetch-icon-font.ts` sends, so the font file can never contain a glyph
 * the code cannot name, or lack one it can.
 *
 * **Sorted alphabetically, and it has to stay that way.** Google's font API
 * rejects an unsorted `icon_names` list with a bare `400: Invalid selector` and
 * no indication of why. Adding an icon means inserting it in position and
 * re-running `npm run icons`.
 */
export const ICON_NAMES = [
  'add_comment',
  'arrow_forward',
  'calendar_today',
  'check',
  'chevron_left',
  'chevron_right',
  'close',
  'dark_mode',
  'delete',
  'edit_note',
  'expand_more',
  'groups',
  'how_to_reg',
  'light_mode',
  'more_horiz',
  'notifications',
  'search',
  'settings',
  'share',
  'sports_soccer',
  'stadium',
  'star',
  'trending_down',
  'trending_up',
  'two_pager',
  'view_agenda',
  'visibility',
] as const

/**
 * `as const` above makes the array readonly and narrows each element to its own
 * literal type rather than `string`, so this is a union of the 27 exact names.
 * A typo in `<Icon name="stadiun" />` is then a compile error instead of a blank
 * square nobody notices until it ships.
 */
export type IconName = (typeof ICON_NAMES)[number]
