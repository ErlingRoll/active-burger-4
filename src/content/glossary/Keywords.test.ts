import { describe, expect, it } from 'vitest'
import {
  LANCERS_CHARGE_MAX_MOMENTUM_STACKS,
  LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS,
  LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK,
  LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK,
} from '../../game-config/skills'
import { KEYWORD_DEFINITIONS, splitKeywordText } from './Keywords'

describe('keyword glossary text', () => {
  it('keeps Poison details generic across applying skills and modifiers', () => {
    expect(KEYWORD_DEFINITIONS.poison.details).toBe(
      'Each application creates a separate stack of Chaos damage over time. Its damage and duration come from the source skill or modifier; player-owned stacks are increased by DoT multiplier.',
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
      `Each Lancer's Charge grants one stack after it resolves. Each stack adds ${LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK}% increased damage to later Charges (${LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK}% with Vanguard). Momentum caps at ${LANCERS_CHARGE_MAX_MOMENTUM_STACKS} stacks, and any new stack refreshes its ${LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS}-second timer; all stacks are lost when that timer expires.`,
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
