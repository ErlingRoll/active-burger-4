import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CHARACTER_CLASS_ID } from '../content/classes/CharacterClasses'
import { Rarity } from '../content/rarity/Rarity'
import { DEFAULT_GAME_KEYBINDS } from '../input/Keybinds'
import type { LevelUpChoiceFlow } from '../game/choices/ChoiceFlows'
import { LevelUpOverlay } from './LevelUpOverlay'

describe('LevelUpOverlay', () => {
  it('shows Banish only for skill-unlock cards', () => {
    const flow: LevelUpChoiceFlow = {
      type: 'level-up',
      level: 2,
      choices: [
        { upgradeId: 'chain-lightning-unlock', rarity: Rarity.Common },
        { upgradeId: 'chain-lightning-extra-chain', rarity: Rarity.Uncommon },
      ],
    }

    const markup = renderToStaticMarkup(
      <LevelUpOverlay
        flow={flow}
        equipment={{}}
        gearSets={[]}
        keybinds={DEFAULT_GAME_KEYBINDS}
        characterClassId={DEFAULT_CHARACTER_CLASS_ID}
        ownedSkillIds={['basic-attack']}
        rerollsRemaining={0}
        banishesRemaining={1}
        onSelect={() => {}}
        onBanish={() => {}}
        onReroll={() => {}}
        onSkip={() => {}}
      />,
    )

    expect(markup).toContain('Banish (1 available)')
    expect(markup.match(/Banish \(1 available\)/g)).toHaveLength(1)
    expect(markup).toContain(
      'Permanently remove this skill unlock from the run and replace it with another weighted skill unlock.',
    )
    expect(markup).toContain('aria-describedby="banish-choice-tooltip-0"')
  })

  it('hides Banish controls when none remain', () => {
    const flow: LevelUpChoiceFlow = {
      type: 'level-up',
      level: 2,
      choices: [
        { upgradeId: 'chain-lightning-unlock', rarity: Rarity.Common },
      ],
    }

    const markup = renderToStaticMarkup(
      <LevelUpOverlay
        flow={flow}
        equipment={{}}
        gearSets={[]}
        keybinds={DEFAULT_GAME_KEYBINDS}
        characterClassId={DEFAULT_CHARACTER_CLASS_ID}
        ownedSkillIds={['basic-attack']}
        rerollsRemaining={0}
        banishesRemaining={0}
        onSelect={() => {}}
        onBanish={() => {}}
        onReroll={() => {}}
        onSkip={() => {}}
      />,
    )

    expect(markup).not.toContain('Banish')
    expect(markup).not.toContain('banish-choice-tooltip')
  })

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
        banishesRemaining={0}
        onSelect={() => {}}
        onBanish={() => {}}
        onReroll={() => {}}
        onSkip={() => {}}
      />,
    )

    expect(markup).toContain('Upgrade<span class="upgrade-action-skill">')
    expect(markup).toContain('Chain Lightning')
  })
})
