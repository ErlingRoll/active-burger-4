import type { EntityId } from '../ids'
import type { GearChoice } from '../equipment/GearChoices'
import type { LevelUpUpgradeChoice } from '../../content/upgrades/Upgrades'

export interface LevelUpChoiceFlow {
  type: 'level-up'
  level: number
  choices: LevelUpUpgradeChoice[]
}

export interface GearPickupChoiceFlow {
  type: 'gear-pickup'
  pickupId: EntityId
  choices: GearChoice[]
}

export type PendingChoiceFlow = LevelUpChoiceFlow | GearPickupChoiceFlow

export function cloneChoiceFlow(
  flow: Readonly<PendingChoiceFlow>,
): PendingChoiceFlow {
  if (flow.type === 'level-up') {
    return {
      ...flow,
      choices: flow.choices.map((choice) => ({ ...choice })),
    }
  }

  return {
    ...flow,
    choices: flow.choices.map((choice) =>
      choice.type === 'upgrade-equipped-item'
        ? {
            ...choice,
            upgradedModifiers: choice.upgradedModifiers.map((modifier) => ({
              ...modifier,
            })),
          }
        : {
            ...choice,
            modifiers: choice.modifiers.map((modifier) => ({
              ...modifier,
            })),
          },
    ),
  } as PendingChoiceFlow
}
