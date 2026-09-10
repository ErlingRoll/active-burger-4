import type { RunModeId } from '../../shared/RunModes'

/**
 * The run facts an Abyss modifier reads.
 *
 * Declared here rather than imported as `Pick<RunState, ...>` so this module
 * stays a content leaf: `game/state/GameState.ts` needs `AbyssModifierId`, and
 * importing `RunState` back would make the simulation's core state module part
 * of an import cycle with its own content.
 */
export interface AbyssRunContext {
  modeId?: RunModeId
  abyssModifierIds?: readonly AbyssModifierId[]
}

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

/**
 * The dangers on offer for surviving a floor.
 *
 * Every danger, every time. They used to be struck off as they were taken,
 * which in a mode with three of them meant the fourth floor had nothing left to
 * ask for: the descent stopped escalating, and the Danger Score — which is also
 * what the floor's loot is graded against — stopped at six for the rest of an
 * endless run. Stacking is what makes it endless. Each one compounds on the
 * last in `getAbyssEnemyEffects`, so the tenth Hardened Shells is a harder
 * bargain than the first, and the count is carried in the tally rather than
 * being a set of flags.
 */
export function getAbyssModifierChoices(): readonly AbyssModifierChoice[] {
  return ABYSS_MODIFIER_DEFINITIONS.map((definition) => ({
    modifierId: definition.id,
    name: definition.name,
    description: definition.description,
    dangerScore: definition.dangerScore,
  }))
}

export function getAbyssEnemyEffects(
  state: AbyssRunContext,
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
