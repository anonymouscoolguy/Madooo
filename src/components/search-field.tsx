import { Icon } from './icon'

/**
 * A search box: the app's first text input.
 *
 * `foundations.md` has had the tokens for one since the beginning — `--control-h`,
 * the 18px icon size "buttons and fields" get, and `focus-field` — and nothing had
 * used them. The `<textarea>` in the note dialog is the only field that existed
 * before this, and a dialog's one control is not a pattern.
 *
 * Built general rather than as part of the players index, because every list
 * screen that grows a filter row wants the same box. Nothing here knows what it
 * is searching — the screen owns the term and the matching.
 *
 * No `'use client'` directive: a module imported by a client component joins the
 * client graph on its own. Adding one would declare a second entry point to the
 * boundary for no reason, the same way `icon.tsx` does not have one.
 */
export function SearchField({
  label,
  value,
  placeholder,
  onChange,
  className,
}: {
  /** Named for a screen reader, since the design draws no visible label. */
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    /*
      The label *wraps* the input rather than pointing at it with `htmlFor`, so
      the component needs no `id`. An id baked in here would collide the moment
      two of these shared a page, which a shared component cannot rule out.
    */
    <label className={`relative block ${className ?? ''}`}>
      <span className="sr-only">{label}</span>
      {/*
        `pointer-events-none` so a click anywhere in the box — the icon included —
        lands on the input and puts the caret in it. Faint rather than muted: it
        is decoration beside a placeholder, not a second piece of information.
      */}
      <Icon
        name="search"
        size="md"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
      />
      <input
        // `type="search"` for the mobile keyboard's own search affordances. It
        // also brings Safari's pill shape and its own cancel button, which
        // `appearance-none` flattens back to the design's square field.
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        // `focus:`, not `focus-visible:` — a field is focused in order to be
        // typed in, so the state is real however the caret arrived. Foundations
        // gives fields `focus-field` rather than the ring for the same reason.
        className="t-hover h-(--control-h-lg) w-full appearance-none rounded-md border border-border bg-surface pr-3 pl-9 text-body text-text placeholder:text-faint focus:focus-field md:h-(--control-h)"
      />
    </label>
  )
}
