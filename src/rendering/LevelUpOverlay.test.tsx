import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CHARACTER_CLASS_ID } from '../content/classes/CharacterClasses'
import { Rarity } from '../content/rarity/Rarity'
import { DEFAULT_GAME_KEYBINDS } from '../input/Keybinds'
import type { LevelUpChoiceFlow } from '../game/choices/ChoiceFlows'
import { LevelUpOverlay } from './LevelUpOverlay'

describe('LevelUpOverlay', () => {
  it('identifies the skill affected by a repeatable upgrade', () => {
    const flow: LevelUpChoiceFlow = {
      type: 'level-up',
      level: 27,
      choices: [{
        upgradeId: 'chain-lightning-extra-chain',
        rarity: Rarity.Uncommon,
      }],
    }

    const markup = renderToStaticMarkup(
      <LevelUpOverlay
        flow={flow}
        equipment={{}}
        gearSets={[]}
        keybinds={DEFAULT_GAME_KEYBINDS}
        characterClassId={DEFAULT_CHARACTER_CLASS_ID}
        ownedSkillIds={['basic-attack', 'chain-lightning']}
        rerollsRemaining={0}
        onSelect={() => {}}
        onReroll={() => {}}
        onSkip={() => {}}
      />,
    )

    expect(markup).toContain('Upgrade<span class="upgrade-action-skill">')
    expect(markup).toContain('Chain Lightning')
  })
})
