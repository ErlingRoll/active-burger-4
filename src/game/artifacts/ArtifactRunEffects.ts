import type { ArtifactMetadata } from '../../content/artifacts/Artifacts'
import type { PlayerState } from '../state/GameState'

/**
 * What an artifact loadout does to a run, summed across every artifact on
 * it. Resolved from the rolled metadata the server copied into the run's
 * preparation; the simulation never reads the bag.
 *
 * Every number is a percentage except `critChance`, which is flat points,
 * and every one is zero when no artifact carries it. The implicits are here
 * too, so the systems that act on them read one shape.
 */
export interface ArtifactRunEffects {
  maxHpPercent: number
  movementSpeedPercent: number
  attackSpeedPercent: number
  cooldownReductionPercent: number
  areaOfEffectPercent: number
  critChance: number
  critMultiplierPercent: number
  increasedDamagePercent: number
  dotMultiplierPercent: number
  meleeLeechPercent: number
  eliteDamagePercent: number
  experiencePercent: number
  healingReceivedPercent: number
  /** Physical and elemental resistance while below the Last Stand threshold. */
  lastStandResistancePercent: number
  /** Area of effect for a few seconds after a kill. */
  killAreaSurgePercent: number
  /** Chance on kill to reset a random skill cooldown. */
  killCooldownResetChancePercent: number
  /** Damage bonus on the next Basic Attack after a skill cast. */
  primedStrikePercent: number
  /** Shield worth this share of max HP at the start of every floor. */
  floorShieldPercent: number
  /** True when a Cartographer's Compass is on the loadout. */
  chartedChoices: boolean
  /** The Compass roll: chance for each level-up choice to arrive a rarity higher. */
  chartedChoicesChancePercent: number
  /** Ember Reliquary: share of a killed enemy's max HP dealt as fire around it. */
  corpseDetonationPercent: number
  /** Echoing Tuning Fork: effectiveness of every third skill cast's echo. */
  skillEchoPercent: number
  /** Wayfarer's Anklet: attack and movement speed at full Momentum. */
  momentumPercent: number
  /** Glutton's Kettle. Resolved server-side into the meal; carried for display. */
  heartyMealPercent: number
}

export const EMPTY_ARTIFACT_RUN_EFFECTS: Readonly<ArtifactRunEffects> = Object.freeze({
  maxHpPercent: 0,
  movementSpeedPercent: 0,
  attackSpeedPercent: 0,
  cooldownReductionPercent: 0,
  areaOfEffectPercent: 0,
  critChance: 0,
  critMultiplierPercent: 0,
  increasedDamagePercent: 0,
  dotMultiplierPercent: 0,
  meleeLeechPercent: 0,
  eliteDamagePercent: 0,
  experiencePercent: 0,
  healingReceivedPercent: 0,
  lastStandResistancePercent: 0,
  killAreaSurgePercent: 0,
  killCooldownResetChancePercent: 0,
  primedStrikePercent: 0,
  floorShieldPercent: 0,
  chartedChoices: false,
  chartedChoicesChancePercent: 0,
  corpseDetonationPercent: 0,
  skillEchoPercent: 0,
  momentumPercent: 0,
  heartyMealPercent: 0,
})

/** World units. Scaled by the player's area of effect like any other area. */
export const ARTIFACT_CORPSE_DETONATION_RADIUS = 96
/** How long after its third cast a skill's hits are echoed. */
export const ARTIFACT_SKILL_ECHO_WINDOW_SECONDS = 0.75

export function resolveArtifactRunEffects(
  artifacts: readonly ArtifactMetadata[],
): ArtifactRunEffects {
  const effects: ArtifactRunEffects = { ...EMPTY_ARTIFACT_RUN_EFFECTS }
  for (const artifact of artifacts) {
    switch (artifact.implicit.id) {
      case 'charted-choices':
        effects.chartedChoices = true
        effects.chartedChoicesChancePercent += artifact.implicit.value
        break
      case 'corpse-detonation':
        effects.corpseDetonationPercent += artifact.implicit.value
        break
      case 'skill-echo':
        effects.skillEchoPercent += artifact.implicit.value
        break
      case 'momentum':
        effects.momentumPercent += artifact.implicit.value
        break
      case 'hearty-meal':
        effects.heartyMealPercent += artifact.implicit.value
        break
    }
    for (const modifier of artifact.modifiers) {
      switch (modifier.id) {
        case 'max-hp': effects.maxHpPercent += modifier.value; break
        case 'movement-speed': effects.movementSpeedPercent += modifier.value; break
        case 'attack-speed': effects.attackSpeedPercent += modifier.value; break
        case 'cooldown-reduction': effects.cooldownReductionPercent += modifier.value; break
        case 'area-of-effect': effects.areaOfEffectPercent += modifier.value; break
        case 'crit-chance': effects.critChance += modifier.value; break
        case 'crit-multiplier': effects.critMultiplierPercent += modifier.value; break
        case 'increased-damage': effects.increasedDamagePercent += modifier.value; break
        case 'dot-multiplier': effects.dotMultiplierPercent += modifier.value; break
        case 'melee-leech': effects.meleeLeechPercent += modifier.value; break
        case 'kill-area-surge': effects.killAreaSurgePercent += modifier.value; break
        case 'kill-cooldown-reset': effects.killCooldownResetChancePercent += modifier.value; break
        case 'primed-strike': effects.primedStrikePercent += modifier.value; break
        case 'last-stand': effects.lastStandResistancePercent += modifier.value; break
        case 'floor-shield': effects.floorShieldPercent += modifier.value; break
        case 'elite-damage': effects.eliteDamagePercent += modifier.value; break
        case 'experience-gain': effects.experiencePercent += modifier.value; break
        case 'healing-received': effects.healingReceivedPercent += modifier.value; break
      }
    }
  }
  return effects
}

/*
 * Resolved once per loadout rather than once per read. The derived stats are
 * recomputed many times a tick, and the loadout never changes inside a run,
 * so the array identity is the cache key: a restored checkpoint gets a new
 * array and a new entry.
 */
const cache = new WeakMap<readonly ArtifactMetadata[], ArtifactRunEffects>()

/** The run effects of whatever the player carries; empty when nothing. */
export function getPlayerArtifactEffects(
  player: Readonly<Pick<PlayerState, 'artifacts'>>,
): Readonly<ArtifactRunEffects> {
  const artifacts = player.artifacts
  if (!artifacts || artifacts.length === 0) {
    return EMPTY_ARTIFACT_RUN_EFFECTS
  }
  let effects = cache.get(artifacts)
  if (!effects) {
    effects = resolveArtifactRunEffects(artifacts)
    cache.set(artifacts, effects)
  }
  return effects
}

/** Bonus damage to elites and bosses from the meal and the loadout together. */
export function getPlayerEliteDamagePercent(
  player: Readonly<Pick<PlayerState, 'artifacts' | 'preparationEliteDamagePercent'>>,
): number {
  return Math.max(0, player.preparationEliteDamagePercent ?? 0) +
    getPlayerArtifactEffects(player).eliteDamagePercent
}
