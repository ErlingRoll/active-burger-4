import type { EntityId } from '../ids'
import type { GearChoice } from '../equipment/GearChoices'
import type { UpgradeChoice } from '../../content/upgrades/Upgrades'

export interface LevelUpChoiceFlow {
  type: 'level-up'
  level: number
  choices: UpgradeChoice[]
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
  return {
    ...flow,
    choices: flow.choices.map((choice) => ({ ...choice })),
  } as PendingChoiceFlow
}
