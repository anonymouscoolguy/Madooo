import { Icon } from './icon'

/**
 * A dropdown: the app's first `<select>`.
 *
 * **Native, not a hand-rolled listbox.** Keyboard behaviour, type-ahead, the
 * wheel a phone shows instead of a menu, and the popup's own light or dark
 * rendering all arrive for nothing — `color-scheme` already re-points the
 * browser's form controls, which is the same mechanism the theme switch runs on.
 * A custom listbox would be a large accessibility surface rebuilt by hand to gain
 * a styled popup nobody asked for.
 *
 * What styling a native select does allow is the closed box, which is the part
 * the design draws: `appearance-none` removes the platform arrow, and the
 * `expand_more` glyph beside it is ours.
 *
 * ### Why the league is a select here and a pill on `/fixtures`
 *
 * `foundations.md` gives league scope to the pill tab, and this does not
 * contradict it. **A pill chooses the scope the page was drawn for; a select
 * narrows what is already on screen.** The league row on `/fixtures` is what the
 * server queried — a fact about which page you are on — and it shows every league
 * at once. In a row of filters over one list, beside a search box and a sort, the
 * same choice is a select: those controls have to read as one set, and none of
 * them changes what was fetched.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  className,
}: {
  /** Named for a screen reader; the design draws no visible label. */
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  /**
   * The raw string, never a parsed value. Turning it into one is the caller's
   * own `parse*` function, which is where the fallback lives and where it is
   * tested — one place rather than one per control.
   */
  onChange: (value: string) => void
  className?: string
}) {
  return (
    // Wrapping the select rather than pointing at it with `htmlFor`, so this
    // needs no `id` and two of them can share a page.
    <label className={`relative block ${className ?? ''}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // `pr-8` leaves the glyph its room. `cursor-pointer` because a select is
        // pressed rather than typed in, unlike the field it otherwise matches.
        className="t-hover h-(--control-h-lg) w-full cursor-pointer appearance-none rounded-md border border-border bg-surface pr-8 pl-3 text-body text-text hover:border-border-strong focus:focus-field md:h-(--control-h)"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {/* `pointer-events-none` so clicking the arrow opens the select rather
          than landing on a span in front of it. */}
      <Icon
        name="expand_more"
        size="md"
        className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted"
      />
    </label>
  )
}
