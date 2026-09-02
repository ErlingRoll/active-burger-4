import { describe, expect, it } from 'vitest'
import {
  LANCERS_CHARGE_MAX_MOMENTUM_STACKS,
  LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS,
  LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK,
  LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK,
  RAISE_SKELETON_ROTTING_BONES_POISON_DURATION_SECONDS,
  RAISE_SKELETON_ROTTING_BONES_POISON_PHYSICAL_CHAOS_RATIO,
} from '../../game-config/skills'
import { KEYWORD_DEFINITIONS, splitKeywordText } from './Keywords'

describe('keyword glossary text', () => {
  it('keeps Poison details generic across applying skills and modifiers', () => {
    expect(KEYWORD_DEFINITIONS.poison.details).toBe(
      `Each application creates a separate stack of Chaos damage over time. Base Poison damage per second is (the applying hit's pre-mitigation Physical damage + Chaos damage) × the application's Poison ratio. Each source defines that ratio and duration; Rotting Bones is the current player source, at ${Math.round(RAISE_SKELETON_ROTTING_BONES_POISON_PHYSICAL_CHAOS_RATIO * 100)}% for ${RAISE_SKELETON_ROTTING_BONES_POISON_DURATION_SECONDS} seconds. For player-owned Poison, each tick is base Poison damage × (1 + DoT multiplier / 100).`,
    )
  })

  it('finds mechanics inside generated option descriptions', () => {
    expect(
      splitKeywordText('Applies Chill and briefly freezes enemies.'),
    ).toEqual([
      { type: 'text', value: 'Applies ' },
      { type: 'keyword', value: 'Chill', keywordId: 'chill' },
      { type: 'text', value: ' and briefly ' },
      { type: 'keyword', value: 'freezes', keywordId: 'freeze' },
      { type: 'text', value: ' enemies.' },
    ])
  })

  it('prefers longer phrases and recognizes compact stat labels', () => {
    expect(
      splitKeywordText('20% cooldown reduction and +1 crit chance'),
    ).toEqual([
      { type: 'text', value: '20% ' },
      {
        type: 'keyword',
        value: 'cooldown reduction',
        keywordId: 'cooldown-reduction',
      },
      { type: 'text', value: ' and +1 ' },
      { type: 'keyword', value: 'crit', keywordId: 'critical-strike' },
      { type: 'text', value: ' chance' },
    ])
  })

  it('links Synergy buff terminology to glossary definitions', () => {
    expect(
      splitKeywordText('Prime Basic Attack with Momentum and a Synergy Charge.'),
    ).toEqual([
      { type: 'keyword', value: 'Prime', keywordId: 'primed' },
      { type: 'text', value: ' Basic Attack with ' },
      { type: 'keyword', value: 'Momentum', keywordId: 'momentum' },
      { type: 'text', value: ' and a ' },
      { type: 'keyword', value: 'Synergy Charge', keywordId: 'synergy-charge' },
      { type: 'text', value: '.' },
    ])
  })

  it('documents Momentum bonuses, cap, and decay from live skill settings', () => {
    expect(KEYWORD_DEFINITIONS.momentum.details).toBe(
      `Each Lancer's Charge grants one stack after it resolves. Total increased damage is stacks × ${LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK}% (${LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK}% with Vanguard), up to ${LANCERS_CHARGE_MAX_MOMENTUM_STACKS * LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK}% (${LANCERS_CHARGE_MAX_MOMENTUM_STACKS * LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK}% with Vanguard) at ${LANCERS_CHARGE_MAX_MOMENTUM_STACKS} stacks. Any new stack refreshes its ${LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS}-second timer; all stacks are lost when that timer expires.`,
    )
  })

  it('includes Shock’s Overload calculation in the triggering status tooltip', () => {
    expect(KEYWORD_DEFINITIONS.shock.details).toContain(
      'triggering hit damage × 1.5',
    )
  })

  it('documents the shared defense, recovery, and duration calculations', () => {
    expect(KEYWORD_DEFINITIONS.shield.details).toContain(
      'absorbed damage = min(component damage, remaining shield)',
    )
    expect(KEYWORD_DEFINITIONS.duration.details).toContain(
      'min(maximum duration, remaining duration + extension)',
    )
    expect(KEYWORD_DEFINITIONS.leech.details).toContain(
      'increased healing',
    )
    expect(Object.values(KEYWORD_DEFINITIONS)).toContainEqual(
      expect.objectContaining({
        label: 'Damage reduction',
        details: expect.stringContaining('min(75%, total damage reduction)'),
      }),
    )
  })

  it('links Resonance and Attunement terminology to glossary definitions', () => {
    expect(
      splitKeywordText('Resonance empowers skills through Attunement.'),
    ).toEqual([
      { type: 'keyword', value: 'Resonance', keywordId: 'resonance' },
      { type: 'text', value: ' empowers skills through ' },
      { type: 'keyword', value: 'Attunement', keywordId: 'attunement' },
      { type: 'text', value: '.' },
    ])
  })

  it('explains named triggered effects without treating skill themes as keywords', () => {
    expect(
      splitKeywordText('Three elements trigger a Prism Burst.'),
    ).toEqual([
      { type: 'text', value: 'Three elements trigger a ' },
      { type: 'keyword', value: 'Prism Burst', keywordId: 'prism-burst' },
      { type: 'text', value: '.' },
    ])
    expect(
      splitKeywordText('Prism Halo fires elemental shards.'),
    ).toEqual([
      { type: 'text', value: 'Prism Halo fires elemental shards.' },
    ])
  })
})
