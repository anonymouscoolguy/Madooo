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
 * The ids for the 2024/25 clubs were read out of `scratch/fixtures_39_2024.json`,
 * the Primeira Liga's out of `scratch/fixtures_94_2026.json`, La Liga's out of
 * `scratch/fixtures_140_2026.json` and Serie A's out of
 * `scratch/fixtures_135_2026.json` — read, never transcribed, which is what makes
 * the guard below meaningful. The promoted clubs are included so that changing
 * `SEASON` does not silently blank a chip; if an id is wrong the guard will say
 * so.
 *
 * Codes are the league's own abbreviations rather than the first three letters
 * of the name. That is a deliberate departure from the reference screenshots,
 * which draw `MAN` on both Manchester clubs and `AST` on Aston Villa: a badge
 * whose whole job is to identify a club has to be able to.
 *
 * Colours are not uniformly sourced, and each block says which it is. The
 * Primeira Liga's and La Liga's were checked by the author against the clubs
 * themselves; the Premier League's are commonly published primaries, which
 * leaves that block the one with no authority behind it and the one meant to be
 * edited on sight.
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
  // Every colour below was checked by the author against the clubs themselves,
  // so Vitória SC and Casa Pia are flat black by confirmation rather than by
  // guess. That makes this block better sourced than the Premier League one
  // above it, which is still on commonly published primaries.
  //
  // 224 is why the name beside each id is a guard. The provider renamed it from
  // "Guimaraes" to "Vitória SC" at some point after this table was written, and
  // the development branch never noticed: it had already been seeded, and the
  // sync does not touch these two columns. Only filling an empty database
  // surfaced it, as a club the seed skipped and a chip with no colour.
  211: { name: 'Benfica', code: 'SLB', colour: '#e30613' },
  212: { name: 'FC Porto', code: 'FCP', colour: '#00428c' },
  214: { name: 'Maritimo', code: 'MAR', colour: '#00913f' },
  215: { name: 'Moreirense', code: 'MOR', colour: '#007a3d' },
  217: { name: 'SC Braga', code: 'SCB', colour: '#c8102e' },
  224: { name: 'Vitória SC', code: 'VSC', colour: '#000000' },
  225: { name: 'Nacional', code: 'NAC', colour: '#ebcc1e' },
  226: { name: 'Rio Ave', code: 'RAV', colour: '#00843d' },
  227: { name: 'Santa Clara', code: 'SCL', colour: '#d2232a' },
  228: { name: 'Sporting CP', code: 'SCP', colour: '#008057' },
  230: { name: 'Estoril', code: 'EST', colour: '#fef000' },
  238: { name: 'Academico Viseu', code: 'ACV', colour: '#c8102e' },
  240: { name: 'Arouca', code: 'ARO', colour: '#fef405' },
  242: { name: 'Famalicao', code: 'FAM', colour: '#164194' },
  762: { name: 'GIL Vicente', code: 'GIL', colour: '#d5222a' },
  4716: { name: 'Casa Pia', code: 'CPA', colour: '#000000' },
  4724: { name: 'Alverca', code: 'ALV', colour: '#c8102e' },
  15130: { name: 'Estrela', code: 'ESA', colour: '#0d9040' },

  // La Liga, 2026/27. Codes are the competition's broadcast abbreviations, the
  // same rule the two blocks above follow — RMA and ATM identify a club where
  // the first three letters of "Real Madrid" and "Real Sociedad" would collide,
  // and both Real Betis and Racing Santander would lose to them again.
  //
  // Every colour below was checked by the author against the clubs themselves,
  // so this block is sourced like the Primeira Liga's above rather than like the
  // Premier League's. Two of them are the reason the check mattered: Real Madrid
  // and Valencia both play in white, which no crest chip can draw, so each holds
  // the colour the club is identified by off the shirt — Madrid's crest blue and
  // Valencia's black — rather than a badge accent picked to look distinct.
  529: { name: 'Barcelona', code: 'BAR', colour: '#a50044' },
  530: { name: 'Atletico Madrid', code: 'ATM', colour: '#cb3524' },
  531: { name: 'Athletic Club', code: 'ATH', colour: '#ee2523' },
  532: { name: 'Valencia', code: 'VAL', colour: '#000000' },
  533: { name: 'Villarreal', code: 'VIL', colour: '#ffe667' },
  535: { name: 'Malaga', code: 'MAL', colour: '#0080c8' },
  536: { name: 'Sevilla', code: 'SEV', colour: '#d40026' },
  538: { name: 'Celta Vigo', code: 'CEL', colour: '#8ac3ee' },
  539: { name: 'Levante', code: 'LEV', colour: '#b4053f' },
  540: { name: 'Espanyol', code: 'ESP', colour: '#007fc8' },
  541: { name: 'Real Madrid', code: 'RMA', colour: '#00529f' },
  542: { name: 'Alaves', code: 'ALA', colour: '#0761af' },
  543: { name: 'Real Betis', code: 'BET', colour: '#00954c' },
  544: { name: 'Deportivo La Coruna', code: 'DEP', colour: '#57175e' },
  546: { name: 'Getafe', code: 'GET', colour: '#003da5' },
  548: { name: 'Real Sociedad', code: 'RSO', colour: '#004f9f' },
  727: { name: 'Osasuna', code: 'OSA', colour: '#d91a21' },
  728: { name: 'Rayo Vallecano', code: 'RAY', colour: '#e53027' },
  797: { name: 'Elche', code: 'ELC', colour: '#00913f' },
  4665: { name: 'Racing Santander', code: 'RAC', colour: '#009b48' },

  // Serie A, 2026/27. Codes are Lega Serie A's own three-letter abbreviations,
  // the rule the three blocks above follow — and the competition that needs it
  // most: first-three-letters gives both Milan clubs MIL, says nothing at all
  // for "Inter", and hands Sassuolo and AS Roma initials off the wrong word.
  //
  // Eighteen of the twenty colours were checked by the author against the clubs
  // themselves, so this block is sourced like the Primeira Liga's and La Liga's
  // rather than like the Premier League's. Thirteen of the eighteen moved off
  // the published primary they were drafted from, which is the same rate that
  // block found and the reason the check is not a formality: Lecce is the
  // clearest, drafted yellow off its shirt and corrected to the blue the club
  // is actually identified by.
  //
  // The two exceptions are the two the check cannot settle. Juventus and Udinese
  // both play in black and white, which no crest chip can draw, so both hold
  // flat black and are indistinguishable from each other — the problem Real
  // Madrid and Valencia posed in La Liga, unresolved here because neither club
  // has a second colour to move to. Venezia is the near miss: its shirt is black
  // too, and it takes the orange of its trim rather than being a third black
  // chip.
  487: { name: 'Lazio', code: 'LAZ', colour: '#87d8f7' },
  488: { name: 'Sassuolo', code: 'SAS', colour: '#00a752' },
  489: { name: 'AC Milan', code: 'MIL', colour: '#fb090b' },
  490: { name: 'Cagliari', code: 'CAG', colour: '#ad002a' },
  492: { name: 'Napoli', code: 'NAP', colour: '#12a0d7' },
  494: { name: 'Udinese', code: 'UDI', colour: '#000000' },
  495: { name: 'Genoa', code: 'GEN', colour: '#ad1919' },
  496: { name: 'Juventus', code: 'JUV', colour: '#000000' },
  497: { name: 'AS Roma', code: 'ROM', colour: '#8e1f2f' },
  499: { name: 'Atalanta', code: 'ATA', colour: '#1e71b8' },
  500: { name: 'Bologna', code: 'BOL', colour: '#a21c26' },
  502: { name: 'Fiorentina', code: 'FIO', colour: '#482e92' },
  503: { name: 'Torino', code: 'TOR', colour: '#8a1e03' },
  505: { name: 'Inter', code: 'INT', colour: '#010e80' },
  512: { name: 'Frosinone', code: 'FRO', colour: '#ffdd00' },
  517: { name: 'Venezia', code: 'VEN', colour: '#ef7d00' },
  523: { name: 'Parma', code: 'PAR', colour: '#ffd200' },
  867: { name: 'Lecce', code: 'LEC', colour: '#006086' },
  895: { name: 'Como', code: 'COM', colour: '#10416a' },
  1579: { name: 'Monza', code: 'MON', colour: '#e4022e' },
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
