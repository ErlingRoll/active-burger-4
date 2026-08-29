import { describe, expect, it } from 'vitest'
import { splitKeywordText } from './Keywords'

describe('keyword glossary text', () => {
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
})
