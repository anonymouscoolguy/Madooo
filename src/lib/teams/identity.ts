/**
 * The three-letter code and club colour the design puts where a crest would go.
 *
 * Both are columns on `Team`, seeded by `npm run db:seed-teams` and never
 * written by the sync — API-Football publishes neither. This module is the
 * read side: it turns a team row into the two values the chip needs, and copes
 * with a club nobody has seeded yet.
 */

/**
 * The shape this module needs, rather than Prisma's `Team`.
 *
 * TypeScript types are **structural**: anything carrying these three properties
 * is accepted, so a full `Team` row satisfies it without being named here. That
 * keeps the helper testable with a plain object and keeps a pure function from
 * depending on the generated Prisma client.
 */
export interface TeamIdentity {
  name: string
  code: string | null
  colour: string | null
}

/** What a crest chip renders: a label, and the two colours it paints itself in. */
export interface Crest {
  label: string
  background: string
  ink: string
}

/**
 * The code, or the first three letters of the name if the club has not been
 * seeded. The fallback can collide — it is what gives both Manchester clubs
 * `MAN` — which is exactly why the seeded codes exist.
 */
export function teamCode(team: TeamIdentity): string {
  const code = team.code?.trim()
  if (code) return code.toUpperCase()
  return team.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
}

/** `"#da2128"` and `"#abc"` to `[r, g, b]`, or null for anything else. */
function parseHex(colour: string): [number, number, number] | null {
  const hex = colour.trim().replace(/^#/, '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

/**
 * WCAG relative luminance. The gamma curve is not decoration: a naive average of
 * the channels calls Manchester City's sky blue dark and prints white on it.
 */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const srgb = value / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * Black or white ink on a club colour, whichever contrasts more.
 *
 * **Base tokens, not semantic ones.** The chip sits on a fixed club colour, so
 * its ink must not move with the theme the way `--text-inverse` would — white on
 * Chelsea blue is right in the dark theme too. `foundations.md` guarantees the
 * neutral ramp never changes across themes, which is what makes `--gray-0` and
 * `--gray-9` the correct names here and `--text` the wrong one.
 *
 * 0.179 is where the two contrast ratios cross over, from WCAG's own formula.
 */
export function crestInk(colour: string): string {
  const rgb = parseHex(colour)
  if (rgb === null) return 'var(--gray-0)'
  return relativeLuminance(rgb) > 0.179 ? 'var(--gray-9)' : 'var(--gray-0)'
}

/**
 * The whole chip, fallback included. An unseeded club gets the neutral sunken
 * surface rather than an invented colour: a wrong club colour reads as a fact
 * about the club, where a grey one reads as missing data.
 */
export function crest(team: TeamIdentity): Crest {
  const colour = team.colour?.trim()
  if (!colour || parseHex(colour) === null) {
    return {
      label: teamCode(team),
      background: 'var(--surface-sunken)',
      ink: 'var(--text-muted)',
    }
  }
  return { label: teamCode(team), background: colour, ink: crestInk(colour) }
}
