import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CHARACTER_CLASS_ID } from '../content/classes/CharacterClasses'
import { EquipmentSlot } from '../content/gear/Items'
import { Rarity } from '../content/rarity/Rarity'
import { DEFAULT_GAME_KEYBINDS } from '../input/Keybinds'
import type {
  GearPickupChoiceFlow,
  LevelUpChoiceFlow,
} from '../game/choices/ChoiceFlows'
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

  it('gives a fourth card its own key and tells the panel how many cards it holds', () => {
    // The Cartographer's Compass adds a fourth card to a level-up.
    const flow: LevelUpChoiceFlow = {
      type: 'level-up',
      level: 5,
      choices: [
        { upgradeId: 'chain-lightning-unlock', rarity: Rarity.Common },
        { upgradeId: 'basic-attack-level', rarity: Rarity.Uncommon },
        { upgradeId: 'blood-rite-unlock', rarity: Rarity.Rare },
        { upgradeId: 'basic-attack-fire-attunement', rarity: Rarity.Epic },
      ],
    }

    const markup = renderToStaticMarkup(
      <LevelUpOverlay
        flow={flow}
        equipment={{}}
        gearSets={[]}
        keybinds={{ ...DEFAULT_GAME_KEYBINDS, choiceFourth: 'r' }}
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

    expect(markup).toContain('data-choice-count="4"')
    expect(markup.match(/class="upgrade-choice choice-card/g)).toHaveLength(4)
    expect(markup).toContain('aria-keyshortcuts="r"')
    expect(markup).toContain('<span class="choice-keybind-hint" aria-hidden="true">R</span>')
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

    expect(markup).toContain('Enhancement:<span class="upgrade-action-skill">')
    expect(markup).not.toContain('UPGRADE · ENHANCEMENT')
    expect(markup).toContain('Chain Lightning')
  })

  it('labels a level upgrade simply as Upgrade', () => {
    const flow: LevelUpChoiceFlow = {
      type: 'level-up',
      level: 4,
      choices: [{
        upgradeId: 'basic-attack-level',
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
        ownedSkillIds={['basic-attack']}
        rerollsRemaining={0}
        banishesRemaining={0}
        onSelect={() => {}}
        onBanish={() => {}}
        onReroll={() => {}}
        onSkip={() => {}}
      />,
    )

    expect(markup).toContain('Upgrade:<span class="upgrade-action-skill">')
    expect(markup).toContain('+1 Level to Basic Attack')
    expect(markup).toContain('+10% increased Basic Attack damage')
    expect(markup).not.toContain('Upgrade level:')
  })

  it('keeps Basic Attack evolution choices separate from the level upgrade', () => {
    const flow: LevelUpChoiceFlow = {
      type: 'level-up',
      level: 4,
      choices: [{
        upgradeId: 'basic-attack-brutality',
        rarity: Rarity.Rare,
      }],
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

    expect(markup).toContain('Basic Attack deals 10% more ')
    expect(markup).toContain(' after increases. This also increases ')
    expect(markup).not.toContain('Each additional rank:')
    expect(markup).not.toContain('+10% increased Basic Attack damage')
  })

  it('shows only the equipped item rarity for an item upgrade', () => {
    const flow: GearPickupChoiceFlow = {
      type: 'gear-pickup',
      pickupId: 1,
      choices: [{
        type: 'upgrade-equipped-item',
        itemId: 'iron-cleaver',
        slot: EquipmentSlot.Weapon,
        itemRarity: Rarity.Common,
        rarity: Rarity.Uncommon,
        upgradedModifierId: 'melee-leech',
        fromTier: 4,
        toTier: 3,
        upgradedModifiers: [{
          id: 'melee-leech',
          tier: 3,
          value: 3,
          sourceId: 'test',
        }],
      }],
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

    expect(markup).toContain('Item rarity: Common')
    expect(markup).not.toContain('Offer rarity')
    expect(markup.match(/rarity-badge/g)).toHaveLength(1)
  })
})

describe('LevelUpOverlay synergy and build plan cues', () => {
  const baseProps = {
    equipment: {},
    gearSets: [],
    keybinds: DEFAULT_GAME_KEYBINDS,
    characterClassId: DEFAULT_CHARACTER_CLASS_ID,
    rerollsRemaining: 0,
    banishesRemaining: 0,
    onSelect: () => {},
    onBanish: () => {},
    onReroll: () => {},
    onSkip: () => {},
  }

  it('lists every synergy partner on an unlock card, marking the owned ones', () => {
    const flow: LevelUpChoiceFlow = {
      type: 'level-up',
      level: 2,
      choices: [{ upgradeId: 'glacial-orb-unlock', rarity: Rarity.Common }],
    }

    const markup = renderToStaticMarkup(
      <LevelUpOverlay
        {...baseProps}
        flow={flow}
        ownedSkillIds={['basic-attack', 'whirlwind']}
      />,
    )

    // Partners come from the synergy graph, not from what is owned.
    const partnerCount = markup.match(/class="upgrade-synergy-partner(?: owned)?(?: planned)?(?: upgrade-synergy-partner-overflow)?"/g)?.length ?? 0
    expect(partnerCount).toBeGreaterThan(1)
    expect(markup).toContain('class="upgrade-synergy-partner owned"')
    expect(markup).toContain('aria-label="Synergies:"')
    // Each partner is a hover term whose popover names the synergy between them.
    expect(markup).toContain('class="keyword-term synergy-term"')
    expect(markup).toContain('aria-label="Chain Lightning: Stormfrost"')
    // Status data: Glacial Orb applies Chill and Freeze, and Whirlwind Shatters it.
    // Only owned status partners are named, and without a tick: Raise Skeleton
    // would Shatter too, but it is not in this run.
    expect(markup).toContain('aria-label="Applies"')
    const pairsWith = markup.slice(markup.indexOf('aria-label="Pairs with:"'))
    expect(pairsWith).toContain('Whirlwind<span class="upgrade-synergy-partner-keywords"> (Freeze)</span>')
    expect(pairsWith).not.toContain('Raise Skeleton')
    expect(pairsWith).not.toContain('upgrade-synergy-partner-owned')
  })

  it('marks exactly the cards that belong to the active build plan, the fourth card included', () => {
    const flow: LevelUpChoiceFlow = {
      type: 'level-up',
      level: 5,
      choices: [
        { upgradeId: 'chain-lightning-unlock', rarity: Rarity.Common },
        { upgradeId: 'basic-attack-level', rarity: Rarity.Uncommon },
        { upgradeId: 'blood-rite-unlock', rarity: Rarity.Rare },
        { upgradeId: 'synergy-basic-attack-whirlwind', rarity: Rarity.Epic },
      ],
    }

    const markup = renderToStaticMarkup(
      <LevelUpOverlay
        {...baseProps}
        flow={flow}
        keybinds={{ ...DEFAULT_GAME_KEYBINDS, choiceFourth: 'r' }}
        ownedSkillIds={['basic-attack', 'whirlwind']}
        activeBuildPlan={{
          id: 'plan',
          name: 'Storm',
          skillIds: ['chain-lightning', 'whirlwind'],
          upgradeIds: ['synergy-basic-attack-whirlwind'],
        }}
      />,
    )

    expect(markup.match(/data-planned="true"/g)).toHaveLength(2)
    expect(markup.match(/Planned<\/span>/g)).toHaveLength(2)
    const cards = markup.split('class="choice-card-wrap').slice(1)
    expect(cards.map((card) => card.includes('planned-card'))).toEqual([true, false, false, true])
  })

  it('tells the player a synergy takes both skills\' single slot', () => {
    const flow: LevelUpChoiceFlow = {
      type: 'level-up',
      level: 3,
      choices: [{ upgradeId: 'synergy-basic-attack-whirlwind', rarity: Rarity.Epic }],
    }

    const markup = renderToStaticMarkup(
      <LevelUpOverlay {...baseProps} flow={flow} ownedSkillIds={['basic-attack', 'whirlwind']} />,
    )

    expect(markup).toContain('Each skill holds one synergy.')
    expect(markup).not.toContain('data-planned')
  })
})
