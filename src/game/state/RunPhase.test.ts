import { describe, expect, it } from 'vitest'
import { isValidRunPhaseTransition } from './RunPhase'

describe('run phase transitions', () => {
  it('allows a freshly loaded run to start playing', () => {
    expect(isValidRunPhaseTransition('loading', 'playing')).toBe(true)
  })

  it('allows pausing and resuming while playing', () => {
    expect(isValidRunPhaseTransition('playing', 'paused')).toBe(true)
    expect(isValidRunPhaseTransition('paused', 'playing')).toBe(true)
  })

  it('allows a paused run to end in defeat when forfeited', () => {
    expect(isValidRunPhaseTransition('paused', 'defeat')).toBe(true)
  })

  it('allows entering and leaving level-up while playing', () => {
    expect(isValidRunPhaseTransition('playing', 'level-up')).toBe(true)
    expect(isValidRunPhaseTransition('level-up', 'playing')).toBe(true)
  })

  it('allows victory and defeat to resolve into results', () => {
    expect(isValidRunPhaseTransition('playing', 'victory')).toBe(true)
    expect(isValidRunPhaseTransition('playing', 'defeat')).toBe(true)
    expect(isValidRunPhaseTransition('victory', 'results')).toBe(true)
    expect(isValidRunPhaseTransition('defeat', 'results')).toBe(true)
  })

  it('rejects transitions that would create invalid combined states', () => {
    // e.g. going straight from loading to paused/defeat would let
    // `paused = true` and `defeat` coexist without ever having played.
    expect(isValidRunPhaseTransition('loading', 'paused')).toBe(false)
    expect(isValidRunPhaseTransition('loading', 'defeat')).toBe(false)
    expect(isValidRunPhaseTransition('results', 'playing')).toBe(false)
    expect(isValidRunPhaseTransition('victory', 'playing')).toBe(false)
  })

  it('has no outgoing transitions from the terminal results phase', () => {
    const anyPhases: Array<Parameters<typeof isValidRunPhaseTransition>[1]> = [
      'loading',
      'playing',
      'level-up',
      'paused',
      'victory',
      'defeat',
      'results',
    ]

    for (const phase of anyPhases) {
      expect(isValidRunPhaseTransition('results', phase)).toBe(false)
    }
  })
})
