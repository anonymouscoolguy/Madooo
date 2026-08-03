/**
 * The verdict helpers.
 *
 * A judgement is **our** data, not the provider's, so there is no captured
 * payload to be ground truth for it — the rule that binds `map.test.ts` and
 * `squad.test.ts` is about API-Football's JSON, where our recollection is the
 * unreliable part. What is asserted here is our own ordering.
 *
 * The players are still real: the summary is built over the captured lineup,
 * ordered exactly as the match page orders it, so the ordering claim is made
 * against the shape the page actually produces rather than against two objects
 * invented to make it pass.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { countVerdicts, isJudgementTag, noteOf, summariseVerdicts, verdictOf } from './verdicts'
import type { JudgementTag } from './verdicts'
import { splitSquad } from './squad'
import { buildSquad } from './api-football/map'
import type { ApiFootballEnvelope, RawLineup, RawPlayerStats } from './api-football/types'

const SCRATCH = join(process.cwd(), 'scratch')

function load<T>(name: string): ApiFootballEnvelope<T> {
  const path = join(SCRATCH, name)
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ApiFootballEnvelope<T>
  } catch {
    throw new Error(
      `Missing ${path}. These tests run against real captured payloads — ` +
        're-create them with `python3 scripts/verify_api.py`.',
    )
  }
}

const lineups = load<RawLineup>('lineup_1208021.json')
const playerStats = load<RawPlayerStats>('players_1208021.json')

const homeTeamId = lineups.response[0].team.id

/** The home eleven, in the order the match page draws it. */
const { starters } = splitSquad(
  buildSquad(lineups.response, playerStats.response).map((entry) => ({
    ...entry,
    teamId: entry.teamApiFootballId,
  })),
  homeTeamId,
)

/** One squad entry with a verdict attached, as the page's query would return it. */
function judged<T>(entry: T, tag: JudgementTag | null) {
  return { ...entry, judgements: tag === null ? [] : [{ tag }] }
}

describe('isJudgementTag', () => {
  it('accepts the three tags the schema declares', () => {
    expect(isJudgementTag('MVP')).toBe(true)
    expect(isJudgementTag('STANDOUT')).toBe(true)
    expect(isJudgementTag('FLOP')).toBe(true)
  })

  it('rejects everything else, including what an object carries by inheritance', () => {
    // The reason the guard uses `Object.hasOwn` rather than `in`: every object
    // has a `toString`, so `in` would wave one of these through into a column
    // Postgres would then reject.
    expect(isJudgementTag('toString')).toBe(false)
    expect(isJudgementTag('mvp')).toBe(false)
    expect(isJudgementTag('BEST')).toBe(false)
    expect(isJudgementTag(null)).toBe(false)
    expect(isJudgementTag(0)).toBe(false)
  })
})

describe('verdictOf', () => {
  it('is null when the user has not judged the player', () => {
    expect(verdictOf({ judgements: [] })).toBeNull()
  })

  it('is null for a judgement that is only a note', () => {
    // Valid from 6.5 onwards, and permitted by the schema now: the CHECK
    // constraint asks for a tag *or* a note, so a null tag is a real row.
    expect(verdictOf({ judgements: [{ tag: null }] })).toBeNull()
  })

  it('unwraps the single judgement the unique constraint allows', () => {
    expect(verdictOf({ judgements: [{ tag: 'FLOP' }] })).toBe('FLOP')
  })
})

describe('noteOf', () => {
  it('is null when the user has not judged the player', () => {
    expect(noteOf({ judgements: [] })).toBeNull()
  })

  it('is null for a judgement that is only a tag', () => {
    expect(noteOf({ judgements: [{ note: null }] })).toBeNull()
  })

  it('unwraps the single judgement the unique constraint allows', () => {
    expect(noteOf({ judgements: [{ note: 'Caught upfield twice.' }] })).toBe('Caught upfield twice.')
  })
})

describe('countVerdicts', () => {
  it('counts only the judged entries', () => {
    const entries = starters.map((entry, index) =>
      judged(entry, index < 3 ? 'STANDOUT' : null),
    )
    expect(countVerdicts(entries)).toBe(3)
  })

  it('is zero for a whole squad nobody has judged', () => {
    expect(countVerdicts(starters.map((entry) => judged(entry, null)))).toBe(0)
  })
})

describe('summariseVerdicts', () => {
  it('drops the players with no verdict', () => {
    const entries = starters.map((entry, index) => judged(entry, index === 0 ? 'MVP' : null))
    const summary = summariseVerdicts(entries)

    expect(summary).toHaveLength(1)
    expect(summary[0].entry.player.name).toBe(starters[0].player.name)
  })

  it('puts the MVP first, then the standouts, then the flops', () => {
    const tags: JudgementTag[] = ['FLOP', 'STANDOUT', 'MVP', 'FLOP', 'STANDOUT']
    const entries = starters
      .slice(0, tags.length)
      .map((entry, index) => judged(entry, tags[index]))

    expect(summariseVerdicts(entries).map((verdict) => verdict.tag)).toEqual([
      'MVP',
      'STANDOUT',
      'STANDOUT',
      'FLOP',
      'FLOP',
    ])
  })

  it('keeps the squad order within a verdict', () => {
    // Stable sort, and the panel order is the input order — so two standouts
    // come out in the order the team sheet lists them, not in whichever order
    // they were tapped.
    const entries = starters.slice(0, 4).map((entry) => judged(entry, 'STANDOUT'))
    const names = summariseVerdicts(entries).map((verdict) => verdict.entry.player.name)

    expect(names).toEqual(starters.slice(0, 4).map((entry) => entry.player.name))
  })

  it('is empty for a match nobody has judged', () => {
    expect(summariseVerdicts(starters.map((entry) => judged(entry, null)))).toEqual([])
  })
})
