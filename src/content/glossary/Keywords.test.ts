import { describe, expect, it } from 'vitest'
import { KEYWORD_DEFINITIONS, splitKeywordText } from './Keywords'

describe('keyword glossary text', () => {
  it('keeps Poison details generic across applying skills and modifiers', () => {
    expect(KEYWORD_DEFINITIONS.poison.details).toBe(
      'Each application creates a separate stack. Its damage and duration come from the source skill or modifier.',
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
})
