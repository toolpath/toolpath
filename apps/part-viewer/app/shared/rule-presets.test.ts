import { describe, expect, test } from 'vitest'
import type { PartFeature } from './contracts'
import { DEFAULT_RULES, DEFAULT_RULE_SET, PRESET_SETS } from './rule-presets'
import { evaluateFeature, evaluatePart, scoreFeature, scorePart } from './rules'

/**
 * The shipped numbers are a shop's judgement rather than an example, so what is
 * pinned here is that they survive the port intact and that the set actually
 * judges a part — not whether any particular threshold is right.
 */

const feature = (over: Record<string, unknown> = {}) =>
  ({
    featureTag: 'hole-1',
    featureType: 'BlindHole',
    regionIdxs: [0],
    machiningDirection: { x: 0, y: 0, z: 1 },
    axis: { x: 0, y: 0, z: 1 },
    datasheet: {
      facts: { kind: 'Hole', diameter: 6.35 },
      zMax: 0,
      zMin: -25.4,
      extendedZMax: 0,
      extendedZMin: -25.4,
    },
    ...over,
  }) as unknown as PartFeature

describe('the shipped set', () => {
  test('ships the prototype’s own rules, rule for rule', () => {
    expect(DEFAULT_RULES).toHaveLength(15)
    expect(DEFAULT_RULES.filter((rule) => rule.type === 'threshold')).toHaveLength(9)
    expect(DEFAULT_RULES.filter((rule) => rule.type === 'match')).toHaveLength(4)
  })

  test('keeps the numbers somebody argued over', () => {
    const drilling = DEFAULT_RULES.find((rule) => rule.id === 'drilling-ld')

    // Past about 4:1 a standard drill wants pecking or a longer series. These
    // are the product; adjusting one because it looks odd on a fixture is not
    // a port.
    expect(drilling).toMatchObject({ thresholds: [3, 5, 8, 12], direction: 'higher is harder' })
  })

  test('says what every rule is for', () => {
    // A threshold nobody can explain is a threshold nobody can argue with.
    expect(DEFAULT_RULES.filter((rule) => !rule.note.trim())).toEqual([])
  })

  test('gives every rule its own id, so the editor can update it by identity', () => {
    expect(new Set(DEFAULT_RULES.map((rule) => rule.id)).size).toBe(DEFAULT_RULES.length)
  })

  test('ships the vendor set under the shop it is for', () => {
    const shipped = PRESET_SETS.find((set) => set.id === 'preset-sendcutsend')

    // The name is the shop the set ships for. Where its numbers started is in
    // the source comment rather than on the set: a citation on screen is a
    // claim about whose limits these are.
    expect(shipped?.name).toBe('Justin Grey Labs')
    expect(shipped?.source).toBeUndefined()
  })
})

describe('judging a part with it', () => {
  test('reaches a verdict rather than staying silent throughout', () => {
    const verdict = evaluateFeature(DEFAULT_RULE_SET.rules, feature())

    // 25.4 deep in a 6.35 bore is 4:1 — something the shipped set has an
    // opinion about, which is the point of shipping it.
    expect(verdict.band).not.toBe(null)
    expect(verdict.results.length).toBeGreaterThan(0)
    expect(scoreFeature(verdict)).toBeGreaterThan(0)
  })

  test('counts what it could not judge instead of scoring it easy', () => {
    const unknown = feature({ featureType: 'wall', datasheet: null })
    const score = scorePart(evaluatePart(DEFAULT_RULE_SET.rules, [unknown]))

    // A feature the Engine described nothing about is not a feature that
    // passed. "0.94, and 200 unjudged" is a different statement from 0.94.
    expect(score.unjudged).toBe(1)
    expect(score.counts.easy).toBe(0)
  })
})
