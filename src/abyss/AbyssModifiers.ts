import type { RunState } from '../game/state/GameState'

export type AbyssModifierId = 'enemy-health' | 'enemy-speed' | 'enemy-damage'

export interface AbyssModifierDefinition {
  id: AbyssModifierId
  name: string
  description: string
  dangerScore: number
}

export interface AbyssModifierChoice {
  modifierId: AbyssModifierId
  name: string
  description: string
  dangerScore: number
}

export interface AbyssEnemyEffects {
  maxHpMultiplier: number
  damageMultiplier: number
  speedMultiplier: number
}

export const ABYSS_MODIFIER_DEFINITIONS: readonly AbyssModifierDefinition[] = [
  {
    id: 'enemy-health',
    name: 'Hardened Shells',
    description: 'Enemies gain 25% maximum health.',
    dangerScore: 2,
  },
  {
    id: 'enemy-speed',
    name: 'Predatory Pace',
    description: 'Enemies move 15% faster.',
    dangerScore: 2,
  },
  {
    id: 'enemy-damage',
    name: 'Rending Blows',
    description: 'Enemies deal 20% more contact damage.',
    dangerScore: 2,
  },
]

export function getAbyssModifierDefinition(
  modifierId: AbyssModifierId,
): AbyssModifierDefinition {
  const definition = ABYSS_MODIFIER_DEFINITIONS.find((candidate) => candidate.id === modifierId)
  if (!definition) {
    throw new Error(`Unknown Abyss modifier: ${modifierId}`)
  }
  return definition
}

export function getAbyssModifierChoices(
  selectedModifierIds: readonly AbyssModifierId[],
): readonly AbyssModifierChoice[] {
  const selected = new Set(selectedModifierIds)
  return ABYSS_MODIFIER_DEFINITIONS
    .filter((definition) => !selected.has(definition.id))
    .map((definition) => ({
      modifierId: definition.id,
      name: definition.name,
      description: definition.description,
      dangerScore: definition.dangerScore,
    }))
}

export function getAbyssEnemyEffects(
  state: Pick<RunState, 'modeId' | 'abyssModifierIds'>,
): AbyssEnemyEffects {
  const effects: AbyssEnemyEffects = {
    maxHpMultiplier: state.modeId === 'infinite-abyss' ? 10 : 1,
    damageMultiplier: state.modeId === 'infinite-abyss' ? 10 : 1,
    speedMultiplier: 1,
  }
  for (const modifierId of state.abyssModifierIds ?? []) {
    if (modifierId === 'enemy-health') {
      effects.maxHpMultiplier *= 1.25
    } else if (modifierId === 'enemy-speed') {
      effects.speedMultiplier *= 1.15
    } else if (modifierId === 'enemy-damage') {
      effects.damageMultiplier *= 1.2
    }
  }
  return effects
}
