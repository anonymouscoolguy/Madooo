/**
 * Fills `Team.code` and `Team.colour`.
 *
 *   npm run db:seed-teams
 *
 * API-Football publishes no club abbreviations and no club colours, so these are
 * ours. They are entered by hand and they are **data about football clubs, not
 * design decisions** — which is why a hex is allowed here and nowhere in product
 * code. `foundations.md` records the exception.
 *
 * Only ever `update`, never `create`. A club that is not already in the database
 * means the sync has not run, not that there is a row to invent.
 *
 * Idempotent, and safe to re-run after every sync. The sync itself cannot undo
 * it: `upsertTeams` in src/lib/sync.ts lists its update columns one by one, so a
 * re-sync leaves both of these alone.
 */

import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

interface Identity {
  /** The name as API-Football spells it. Checked, not written — see below. */
  name: string
  /** The league's own three-letter abbreviation for the club. */
  code: string
  colour: string
}

/**
 * Keyed by API-Football team id, with the provider's own spelling of the name
 * alongside. **The name is a guard, not a value**: the script refuses to write
 * to a row whose stored name does not match, so an id typed wrong paints nothing
 * rather than painting some other club in the wrong colours. Nothing here
 * overwrites `Team.name`.
 *
 * The ids for the 2024/25 clubs were read out of `scratch/fixtures_39_2024.json`
 * and the Primeira Liga's out of `scratch/fixtures_94_2026.json` — read, never
 * transcribed, which is what makes the guard below meaningful. The promoted
 * clubs are included so that changing `SEASON` does not silently blank a chip;
 * if an id is wrong the guard will say so.
 *
 * Codes are the league's own abbreviations rather than the first three letters
 * of the name. That is a deliberate departure from the reference screenshots,
 * which draw `MAN` on both Manchester clubs and `AST` on Aston Villa: a badge
 * whose whole job is to identify a club has to be able to.
 *
 * Colours are each club's commonly published primary. They are the one thing
 * here with no authority behind it, and are meant to be edited on sight.
 */
const IDENTITIES: Record<number, Identity> = {
  33: { name: 'Manchester United', code: 'MUN', colour: '#da291c' },
  34: { name: 'Newcastle', code: 'NEW', colour: '#241f20' },
  35: { name: 'Bournemouth', code: 'BOU', colour: '#da291c' },
  36: { name: 'Fulham', code: 'FUL', colour: '#000000' },
  39: { name: 'Wolves', code: 'WOL', colour: '#fdb913' },
  40: { name: 'Liverpool', code: 'LIV', colour: '#c8102e' },
  41: { name: 'Southampton', code: 'SOU', colour: '#d71920' },
  42: { name: 'Arsenal', code: 'ARS', colour: '#ef0107' },
  45: { name: 'Everton', code: 'EVE', colour: '#003399' },
  46: { name: 'Leicester', code: 'LEI', colour: '#003090' },
  47: { name: 'Tottenham', code: 'TOT', colour: '#132257' },
  48: { name: 'West Ham', code: 'WHU', colour: '#7a263a' },
  49: { name: 'Chelsea', code: 'CHE', colour: '#034694' },
  50: { name: 'Manchester City', code: 'MCI', colour: '#6cabdd' },
  51: { name: 'Brighton', code: 'BHA', colour: '#0057b8' },
  52: { name: 'Crystal Palace', code: 'CRY', colour: '#1b458f' },
  55: { name: 'Brentford', code: 'BRE', colour: '#e30613' },
  57: { name: 'Ipswich', code: 'IPS', colour: '#3a64a3' },
  65: { name: 'Nottingham Forest', code: 'NFO', colour: '#dd0000' },
  66: { name: 'Aston Villa', code: 'AVL', colour: '#670e36' },

  // Promoted after 2024/25. The table spans every season the database has held
  // rather than one season's twenty, because it is keyed by the provider's team
  // id and only ever updates rows that already exist — a club that is not in
  // the database costs nothing but a line here.
  44: { name: 'Burnley', code: 'BUR', colour: '#6c1d45' },
  63: { name: 'Leeds', code: 'LEE', colour: '#1d428a' },
  64: { name: 'Hull City', code: 'HUL', colour: '#f18a00' },
  746: { name: 'Sunderland', code: 'SUN', colour: '#eb172b' },
  1346: { name: 'Coventry', code: 'COV', colour: '#78d0f3' },

  // Primeira Liga, 2026/27. The codes are the clubs' own initials, which is the
  // same rule the Premier League block follows — SLB and FCP identify a club to
  // a Portuguese reader the way MUN and AVL do to an English one, where the
  // first three letters of "Sporting CP" and "Santa Clara" would not.
  //
  // The colours are the weakest data in this file. The big six are safe; the
  // smaller clubs are a best reading of commonly published primaries and are
  // meant to be corrected on sight, exactly as the note above says.
  211: { name: 'Benfica', code: 'SLB', colour: '#e30613' },
  212: { name: 'FC Porto', code: 'FCP', colour: '#00428c' },
  214: { name: 'Maritimo', code: 'MAR', colour: '#00913f' },
  215: { name: 'Moreirense', code: 'MOR', colour: '#007a3d' },
  217: { name: 'SC Braga', code: 'SCB', colour: '#c8102e' },
  224: { name: 'Guimaraes', code: 'VSC', colour: '#000000' },
  225: { name: 'Nacional', code: 'NAC', colour: '#000000' },
  226: { name: 'Rio Ave', code: 'RAV', colour: '#00843d' },
  227: { name: 'Santa Clara', code: 'SCL', colour: '#d2232a' },
  228: { name: 'Sporting CP', code: 'SCP', colour: '#008057' },
  230: { name: 'Estoril', code: 'EST', colour: '#ffd200' },
  238: { name: 'Academico Viseu', code: 'ACV', colour: '#c8102e' },
  240: { name: 'Arouca', code: 'ARO', colour: '#ffd200' },
  242: { name: 'Famalicao', code: 'FAM', colour: '#164194' },
  762: { name: 'GIL Vicente', code: 'GIL', colour: '#d5222a' },
  4716: { name: 'Casa Pia', code: 'CPA', colour: '#000000' },
  4724: { name: 'Alverca', code: 'ALV', colour: '#c8102e' },
  15130: { name: 'Estrela', code: 'ESA', colour: '#008057' },
}

async function main() {
  // Imported dynamically, after config(): a static import is hoisted above it,
  // and src/lib/prisma.ts reads DATABASE_URL_DEV the instant it is imported.
  // The same trick as scripts/db-check.ts and scripts/sync.ts.
  const { databaseBranch } = await import('../src/lib/env')
  const { prisma } = await import('../src/lib/prisma')

  console.log(`\nbranch: ${databaseBranch()}`)

  const teams = await prisma.team.findMany({
    select: { id: true, apiFootballId: true, name: true },
    orderBy: { name: 'asc' },
  })

  let seeded = 0
  const unnamed: string[] = []
  const mismatched: string[] = []

  for (const team of teams) {
    const identity = IDENTITIES[team.apiFootballId]
    if (identity === undefined) {
      unnamed.push(`${team.name} (${team.apiFootballId})`)
      continue
    }
    if (identity.name !== team.name) {
      mismatched.push(
        `${team.apiFootballId}: database says "${team.name}", table says "${identity.name}"`,
      )
      continue
    }

    await prisma.team.update({
      where: { id: team.id },
      data: { code: identity.code, colour: identity.colour },
    })
    seeded += 1
  }

  console.log(`\n  ok    ${seeded} of ${teams.length} teams seeded`)

  // Reported, not thrown. A club with no identity renders a neutral fallback
  // chip, which is a missing row rather than a broken app.
  for (const team of unnamed) console.log(`  none  no identity for ${team}`)
  for (const line of mismatched) console.log(`  skip  ${line}`)

  await prisma.$disconnect()
  console.log('')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
