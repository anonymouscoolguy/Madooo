/**
 * The three typefaces `docs/design/foundations.md` specifies, loaded once.
 *
 * Next's own guidance is that every call to a font loader creates a separate
 * hosted instance of that font, so the same family loaded in two files is
 * downloaded twice. Hence one module that everything imports.
 *
 * All three are self-hosted: `next/font` downloads them at build time and
 * serves them from our own origin, so the browser never talks to Google. That
 * is a privacy property, not just a speed one.
 */

import { Archivo, JetBrains_Mono } from 'next/font/google'
import localFont from 'next/font/local'

/** Everything spoken. Variable, so no `weight` is needed — the whole 100–900 range comes in one file. */
export const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
})

/** Everything counted: scores, tallies, shirt numbers, dates, minute marks. */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
})

/**
 * Material Symbols Outlined, subset to the vocabulary in `icon-names.ts` by
 * `npm run icons`. Loaded from a local file rather than `next/font/google`
 * because Google's font list in Next has no entry for it at all.
 *
 * `display: 'block'` rather than the usual `'swap'`: icons are written in the
 * markup as ligature text (`<span>groups</span>`), so a fallback font would
 * render the literal word "groups" on screen until the real font arrived.
 * `block` shows nothing for that moment instead.
 *
 * `adjustFontFallback: false` for the same reason — there is no fallback whose
 * metrics are worth matching, and the synthetic one Next would otherwise
 * generate is dead weight.
 */
export const materialSymbols = localFont({
  src: './fonts/material-symbols-subset.woff2',
  weight: '400',
  style: 'normal',
  display: 'block',
  adjustFontFallback: false,
  variable: '--font-material-symbols',
})
