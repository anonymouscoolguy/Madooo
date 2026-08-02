/**
 * Fetches the Material Symbols subset the app actually uses.
 *
 *   npm run icons
 *
 * Run it after changing `ICON_NAMES`, and never otherwise — the output is
 * committed, because unlike `src/generated/` it is build *input*: a fresh clone
 * has to build without reaching Google.
 *
 * Why a subset at all: the full variable font is 3.96 MB, which is not
 * shippable, and `next/font/google` has no entry for Material Symbols to
 * subset it for us. Google's own font API will do it, though — given
 * `icon_names` it returns only those glyphs, and given a `FILL@0..1` axis
 * selector it keeps them variable. The whole vocabulary comes to about 5.7 kB,
 * which is why the design's "FILL 1 means on" rule is affordable.
 *
 * Both parts of the URL are order-sensitive and fail identically when they are
 * wrong — `400: Invalid selector`, with no hint as to which part is at fault:
 *
 *   - `icon_names` must be sorted alphabetically. `ICON_NAMES` is.
 *   - axis names must be sorted lowercase-first, then uppercase, so
 *     `opsz,wght,FILL,GRAD` and not the alphabetical order a reader expects.
 */

import { writeFile } from 'node:fs/promises'
import { ICON_NAMES } from '../src/components/icon-names'

const DESTINATION = new URL('../src/app/fonts/material-symbols-subset.woff2', import.meta.url)

/**
 * `opsz` and `wght` are pinned to the values `foundations.md` specifies, and
 * `GRAD` to its default, so only `FILL` stays variable. Pinning the rest is
 * what keeps the file small: every axis left free multiplies the masters that
 * have to be stored.
 */
const CSS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0' +
  `&icon_names=${ICON_NAMES.join(',')}`

/**
 * The API serves the old static `Material Icons` font to clients it does not
 * recognise as supporting variable fonts, and decides that from the User-Agent
 * alone. Without one that looks like a current browser, the response is a
 * different font that silently lacks the FILL axis.
 */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function main() {
  const cssResponse = await fetch(CSS_URL, { headers: { 'User-Agent': BROWSER_UA } })
  if (!cssResponse.ok) {
    throw new Error(
      `Google Fonts refused the request (HTTP ${cssResponse.status}). ` +
        'The usual cause is ICON_NAMES having fallen out of alphabetical order.',
    )
  }

  const css = await cssResponse.text()
  const source = css.match(/src: url\((https:\/\/[^)]+)\)/)?.[1]
  if (!source) {
    throw new Error(`No font URL in the stylesheet Google returned:\n${css.slice(0, 500)}`)
  }

  const fontResponse = await fetch(source)
  if (!fontResponse.ok) {
    throw new Error(`Could not download the font itself (HTTP ${fontResponse.status}).`)
  }

  const font = Buffer.from(await fontResponse.arrayBuffer())
  await writeFile(DESTINATION, font)

  const kb = (font.byteLength / 1024).toFixed(1)
  console.log(`${ICON_NAMES.length} icons, ${kb} kB → src/app/fonts/material-symbols-subset.woff2`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
