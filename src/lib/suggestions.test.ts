/**
 * Our own rule about our own text, so there is no captured payload to be ground
 * truth for it — the rule binding `map.test.ts` is about API-Football's JSON,
 * where recollection is the unreliable part.
 *
 * What is worth testing here is the untrusted-input half. `normaliseSuggestion`
 * sits behind a public POST endpoint, so the cases that matter are the ones no
 * one using the dialog can produce.
 */

import { describe, expect, it } from 'vitest'

import { normaliseSuggestion, SUGGESTION_MAX_LENGTH } from './suggestions'

describe('normaliseSuggestion', () => {
  it('keeps an ordinary suggestion as it was written', () => {
    expect(normaliseSuggestion('Please add the Bundesliga')).toBe('Please add the Bundesliga')
  })

  it('trims the ends', () => {
    expect(normaliseSuggestion('  Please add the Bundesliga\n')).toBe('Please add the Bundesliga')
  })

  it('keeps interior line breaks, because the textarea allows them', () => {
    expect(normaliseSuggestion('Two things:\n\n1. Bundesliga\n2. Dark mode')).toBe(
      'Two things:\n\n1. Bundesliga\n2. Dark mode',
    )
  })

  it('rejects an empty box', () => {
    expect(normaliseSuggestion('')).toBeNull()
  })

  it('rejects whitespace pretending to be content', () => {
    expect(normaliseSuggestion('   \n\t  ')).toBeNull()
  })

  it('accepts a suggestion of exactly the maximum length', () => {
    const exact = 'x'.repeat(SUGGESTION_MAX_LENGTH)
    expect(normaliseSuggestion(exact)).toBe(exact)
  })

  it('measures the limit after trimming, so trailing space is not content', () => {
    const padded = `${'x'.repeat(SUGGESTION_MAX_LENGTH)}     `
    expect(normaliseSuggestion(padded)).toBe('x'.repeat(SUGGESTION_MAX_LENGTH))
  })

  it('rejects one character past the limit rather than truncating it', () => {
    expect(normaliseSuggestion('x'.repeat(SUGGESTION_MAX_LENGTH + 1))).toBeNull()
  })

  /*
    The dialog's textarea can only ever hand this a string. A direct POST can
    hand it anything at all, which is the whole reason the parameter is
    `unknown` — these are the cases a `string` annotation would have promised
    were impossible.
  */
  it('rejects what a crafted POST can send that a textarea cannot', () => {
    expect(normaliseSuggestion(undefined)).toBeNull()
    expect(normaliseSuggestion(null)).toBeNull()
    expect(normaliseSuggestion(42)).toBeNull()
    expect(normaliseSuggestion({ body: 'Please add the Bundesliga' })).toBeNull()
    expect(normaliseSuggestion(['Please add the Bundesliga'])).toBeNull()
  })
})
