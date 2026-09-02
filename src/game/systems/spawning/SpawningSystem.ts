import {
  SLIME_DEFINITION_ID,
} from '../../../content/enemies/EnemyConfig'
import { getEnemyDefinition } from '../../../content/enemies/Enemies'
import {
  getEliteModifierDefinition,
  getEliteModifierRewardMultiplier,
  normalizeEliteModifierIds,
  isEliteModifierAllowedForEnemy,
  type EliteModifierInput,
} from '../../../content/enemies/EliteModifiers'
import { XP_BALANCE } from '../../../content/progression/XpBalance'
import {
  STARTING_LEVEL_BASE,
  getStartingLevelForRank,
} from '../../../content/progression/StartingLevel'
import { getLevelMaxHpBonus } from '../../../content/progression/LevelScaling'
import { GEAR_PICKUP_BALANCE } from '../../../content/gear/GearDropConfig'
import { getItemDefinition } from '../../../content/gear/Items'
import { Rarity } from '../../../content/rarity/Rarity'
import { DEFAULT_BEHAVIOR_PROFILE_ID } from '../../../content/behaviors/BehaviorProfiles'
import {
  BASIC_ATTACK_SKILL_ID,
  DEFAULT_RESONANCE_ATTACKS,
  DEFAULT_ATTUNEMENT_PERCENT,
  DEFAULT_SKILL_SLOT_COUNT,
} from '../../../game-config/skills'
import {
  getBossDefinition,
  type BossDefinitionId,
} from '../../../content/bosses/Bosses'
import {
  getDungeonDefinition,
  getBossContactDamageMultiplier,
  getBossDamageMultiplier,
  getBossHpMultiplier,
  getFloorDifficultyProfile,
  scaleOrdinaryEnemyStats,
} from '../../../content/dungeons/Dungeons'
import type { WorldModifierEffects } from '../../../content/modifiers/WorldModifiers'
import {
  DEFAULT_CHARACTER_CLASS_ID,
  getCharacterClassDefinition,
  type CharacterClassId,
} from '../../../content/classes/CharacterClasses'
import type {
  EnemyDefinitionId,
  EntityId,
  EntityIdAllocator,
} from '../../ids'
import type { SpawnDirector } from '../../spawning/SpawnDirector'
import { createEquippedItem } from '../../equipment/EquipmentState'
import type {
  EnemyState,
  BossState,
  GameState,
  GearPickupState,
  HealingPotionPickupState,
  XpPickupState,
  PlayerState,
} from '../../state/GameState'
import { projectPointToPlayerArena } from '../../../game-config/arena'
import {
  STAT_KEYS,
  type StatModifier,
} from '../../../content/stats/Stats'

export interface WorldPosition {
  x: number
  y: number
}

function reachablePickupPosition(
  state: GameState,
  position: WorldPosition,
): WorldPosition {
  return projectPointToPlayerArena(
    position.x,
    position.y,
    state.player.radius,
  )
}

function getEnemyMovementSpeedMultiplier(entityId: EntityId): number {
  return 0.92 + (entityId % 17) * 0.01
}

export function createInitialPlayerState(
  id: EntityId,
  effects?: Pick<WorldModifierEffects, 'playerStatMultipliers'>,
  characterClassId: CharacterClassId = DEFAULT_CHARACTER_CLASS_ID,
  startingLevel = 1,
  skillSlotCount = DEFAULT_SKILL_SLOT_COUNT,
): PlayerState {
  const characterClass = getCharacterClassDefinition(characterClassId)
  const playerStatMultipliers = effects?.playerStatMultipliers ?? {}
  const normalizedSkillSlotCount =
    typeof skillSlotCount === 'number' && Number.isFinite(skillSlotCount)
      ? Math.max(1, Math.floor(skillSlotCount))
      : DEFAULT_SKILL_SLOT_COUNT
  const startingSkillIds = [
    BASIC_ATTACK_SKILL_ID,
    ...characterClass.startingSkillIds.filter(
      (skillId) => skillId !== BASIC_ATTACK_SKILL_ID,
    ),
  ]
  const initialLevel = Number.isFinite(startingLevel)
    ? getStartingLevelForRank(startingLevel - STARTING_LEVEL_BASE)
    : STARTING_LEVEL_BASE
  const getStatMultiplier = (stat: keyof typeof playerStatMultipliers): number =>
    playerStatMultipliers[stat] ?? 1
  const statModifiers: StatModifier[] = STAT_KEYS.flatMap((stat) => {
    const multiplier = playerStatMultipliers[stat]
    return multiplier !== undefined && Number.isFinite(multiplier) && multiplier > 0
      ? [{
          stat,
          operation: 'multiply',
          value: multiplier,
          sourceId: `world-modifier:${stat}`,
        }]
      : []
  })
  const baseStats = { ...characterClass.baseStats }
  const maxHp = (baseStats.maxHp + getLevelMaxHpBonus(initialLevel)) *
    getStatMultiplier('maxHp')
  const movementSpeed = baseStats.movementSpeed * getStatMultiplier('movementSpeed')
  const attackDamage = baseStats.attackDamage * getStatMultiplier('attackDamage')
  const attackSpeed = baseStats.attackSpeed * getStatMultiplier('attackSpeed')
  return {
    id,
    characterClassId,
    x: 0,
    y: 0,
    radius: 16,
    movementVelocityX: 0,
    movementVelocityY: 0,
    skillSlotCount: normalizedSkillSlotCount,
    hp: maxHp,
    maxHp,
    level: initialLevel,
    xp: 0,
    movementSpeed,
    attackDamage,
    attackSpeed,
    attackCooldownRemaining: 0,
    resonance: baseStats.resonance ?? DEFAULT_RESONANCE_ATTACKS,
    attunement: baseStats.attunement ?? DEFAULT_ATTUNEMENT_PERCENT,
    attunementBonusPercent: 0,
    meleeLeech: 0,
    whirlwindLeech: 0,
    increasedHealing: 0,
    dotMultiplier: 0,
    soulTethers: [],
    ruinSigils: [],
    prismConvergence: [],
    skeletonMaxCountBonus: 0,
    chainLightningChainBonus: 0,
    upgradeWhirlwindLeech: 0,
    gearDropChanceMultiplier: 1,
    gearRarityFloor: Rarity.Common,
    pickupCollectionRangeMultiplier: 1,
    bossMagnetRemaining: 0,
    baseStats,
    statModifiers,
    equipment: {
      weapon: createEquippedItem(getItemDefinition(characterClass.startingWeaponItemId)),
    },
    targetId: undefined,
    dodge: {
      mode: 'autonomous',
      level: 1,
      reactionTime: 0.1,
      lastDirectionX: 0,
      lastDirectionY: 0,
    },
    behaviorController: {
      profileId: DEFAULT_BEHAVIOR_PROFILE_ID,
      freeMode: false,
      freeMovementDirectionX: 0,
      freeMovementDirectionY: 0,
    },
    skills: startingSkillIds.map((skillId) => ({
      skillId,
      level: 1,
      cooldownRemaining: 0,
      resonanceAttackCount: 0,
    })),
  }
}

export function spawnEnemy(
  state: GameState,
  idAllocator: EntityIdAllocator,
  definitionId: EnemyDefinitionId,
  position: WorldPosition,
  xpRewardOverride?: number,
  eliteModifiers?: EliteModifierInput,
  effects?: Pick<
    WorldModifierEffects,
    | 'ordinaryEnemyMaxHpMultiplier'
    | 'ordinaryEnemyDamageMultiplier'
    | 'ordinaryEnemySpeedMultiplier'
  >,
  canDropLoot = true,
): EntityId {
  const definition = getEnemyDefinition(definitionId)
  const eligibleEliteModifiers = normalizeEliteModifierIds(eliteModifiers).filter(
    (modifierId) => isEliteModifierAllowedForEnemy(definition.id, modifierId),
  )
  const modifiers = eligibleEliteModifiers.map(getEliteModifierDefinition)
  const baseXpReward = xpRewardOverride ?? definition.xpReward
  const xpReward =
    baseXpReward > 0
      ? Math.round(
          baseXpReward *
            getEliteModifierRewardMultiplier(
              eligibleEliteModifiers,
              'xpRewardMultiplier',
            ),
        )
      : baseXpReward
  const dungeon = getDungeonDefinition(state.run.dungeonId)
  const floor = state.run.floor ?? 1
  const floorDifficulty = getFloorDifficultyProfile(floor)
  const scaledStats = scaleOrdinaryEnemyStats(
    {
      maxHp: definition.maxHp,
      contactDamage: definition.contactDamage,
    },
    floor,
    dungeon,
  )
  const maxHp = scaledStats.maxHp *
    floorDifficulty.ordinaryEnemyHpMultiplier *
    modifiers.reduce(
      (multiplier, modifier) => multiplier * modifier.maxHpMultiplier,
      1,
    ) *
    (effects?.ordinaryEnemyMaxHpMultiplier ?? 1)
  const physicalResistance = modifiers.reduce(
    (resistance, modifier) => resistance + (modifier.physicalResistance ?? 0),
    definition.resistances?.physical ?? 0,
  )
  const wardMaxHp = maxHp * modifiers.reduce(
    (ratio, modifier) => Math.max(ratio, modifier.wardMaxHpRatio ?? 0),
    0,
  )
  const enemyId = idAllocator.createEntityId()
  const enemy: EnemyState = {
    id: enemyId,
    definitionId: definition.id,
    x: position.x,
    y: position.y,
    radius: definition.radius * modifiers.reduce(
      (multiplier, modifier) => multiplier * modifier.radiusMultiplier,
      1,
    ),
    hp: maxHp,
    maxHp,
    spawnTime: state.time,
    speed: definition.speed *
      getEnemyMovementSpeedMultiplier(enemyId) *
      floorDifficulty.ordinaryEnemySpeedMultiplier *
      modifiers.reduce(
        (multiplier, modifier) => multiplier * modifier.speedMultiplier,
        1,
      ) *
      (effects?.ordinaryEnemySpeedMultiplier ?? 1),
    contactDamage: scaledStats.contactDamage *
      floorDifficulty.ordinaryEnemyContactDamageMultiplier *
      (effects?.ordinaryEnemyDamageMultiplier ?? 1),
    contactCooldownRemaining: 0,
    xpReward,
    canDropLoot,
    ...(definition.controlResistance !== undefined
      ? { controlResistance: definition.controlResistance }
      : {}),
    ...(physicalResistance > 0 || definition.resistances
      ? {
          resistances: {
            ...definition.resistances,
            ...(physicalResistance > 0 ? { physical: physicalResistance } : {}),
          },
        }
      : {}),
    ...(wardMaxHp > 0 ? { wardHp: wardMaxHp, wardMaxHp } : {}),
    ...(eligibleEliteModifiers.length > 0
      ? {
          eliteModifier: eligibleEliteModifiers[0],
          eliteModifiers: eligibleEliteModifiers,
        }
      : {}),
    abilityCooldownRemaining: 0,
    targetId: state.player.id,
  }

  state.enemies.push(enemy)
  return enemy.id
}

export function spawnSlime(
  state: GameState,
  idAllocator: EntityIdAllocator,
  position: WorldPosition,
  effects?: Pick<
    WorldModifierEffects,
    | 'ordinaryEnemyMaxHpMultiplier'
    | 'ordinaryEnemyDamageMultiplier'
    | 'ordinaryEnemySpeedMultiplier'
  >,
): EntityId {
  const definition = getEnemyDefinition(SLIME_DEFINITION_ID)
  return spawnEnemy(state, idAllocator, definition.id, position, undefined, undefined, effects)
}

export function spawnBoss(
  state: GameState,
  idAllocator: EntityIdAllocator,
  definitionId: BossDefinitionId,
  position: WorldPosition,
): EntityId {
  const definition = getBossDefinition(definitionId)
  const floor = state.run.floor ?? 1
  const hpMultiplier = getBossHpMultiplier(floor)
  const contactDamageMultiplier = getBossContactDamageMultiplier(floor)
  const damageMultiplier = getBossDamageMultiplier(floor)
  const boss: BossState = {
    id: idAllocator.createEntityId(),
    definitionId: definition.id,
    bossDefinitionId: definition.id,
    x: position.x,
    y: position.y,
    radius: definition.radius,
    hp: definition.maxHp * hpMultiplier,
    maxHp: definition.maxHp * hpMultiplier,
    spawnTime: state.time,
    speed: definition.speed,
    contactDamage: definition.contactDamage *
      contactDamageMultiplier *
      damageMultiplier,
    xpReward: definition.xpReward,
    targetId: state.player.id,
    // Bosses can be controlled, but should not be permanently locked down.
    controlResistance: 50,
    skills: definition.skills.map((skillId, index) => ({
      skillId,
      // The first skill is ready on spawn; subsequent skills follow in order.
      cooldownRemaining: index === 0 ? 0 : 0.5,
    })),
    nextSkillIndex: 0,
  }
  state.bosses ??= []
  state.bosses.push(boss)
  return boss.id
}

export function spawnXpPickup(
  state: GameState,
  idAllocator: EntityIdAllocator,
  position: WorldPosition,
  xpAmount: number,
): EntityId {
  const reachablePosition = reachablePickupPosition(state, position)
  const pickup: XpPickupState = {
    id: idAllocator.createEntityId(),
    kind: 'xp',
    x: reachablePosition.x,
    y: reachablePosition.y,
    xpAmount,
    radius: XP_BALANCE.pickupRadius,
    attractionRadius: XP_BALANCE.pickupAttractionRadius,
    attractionSpeed: XP_BALANCE.pickupAttractionSpeed,
  }

  state.pickups.push(pickup)
  return pickup.id
}

export function spawnGearPickup(
  state: GameState,
  idAllocator: EntityIdAllocator,
  position: WorldPosition,
  sourceEnemyDefinitionId?: EnemyDefinitionId,
): EntityId {
  const reachablePosition = reachablePickupPosition(state, position)
  const pickup: GearPickupState = {
    id: idAllocator.createEntityId(),
    kind: 'gear',
    x: reachablePosition.x,
    y: reachablePosition.y,
    radius: GEAR_PICKUP_BALANCE.radius,
    attractionRadius: GEAR_PICKUP_BALANCE.attractionRadius,
    attractionSpeed: GEAR_PICKUP_BALANCE.attractionSpeed,
    ...(sourceEnemyDefinitionId ? { sourceEnemyDefinitionId } : {}),
  }

  state.pickups.push(pickup)
  state.run.gearDropGenerated = true
  return pickup.id
}

export function spawnHealingPotion(
  state: GameState,
  idAllocator: EntityIdAllocator,
  position: WorldPosition,
): EntityId {
  const reachablePosition = reachablePickupPosition(state, position)
  const pickup: HealingPotionPickupState = {
    id: idAllocator.createEntityId(),
    kind: 'healing-potion',
    x: reachablePosition.x,
    y: reachablePosition.y,
    radius: 12,
    attractionRadius: 180,
    attractionSpeed: 360,
  }
  state.pickups.push(pickup)
  return pickup.id
}

export function updateEnemySpawns(
  state: GameState,
  spawnDirector: SpawnDirector,
  idAllocator: EntityIdAllocator,
  fixedStepSeconds: number,
  effects?: Pick<
    WorldModifierEffects,
    | 'ordinaryEnemyMaxHpMultiplier'
    | 'ordinaryEnemyDamageMultiplier'
    | 'ordinaryEnemySpeedMultiplier'
  >,
): void {
  if (
    state.encounter?.normalSpawnsSuspended ||
    state.stairs !== undefined ||
    state.floorTransition !== undefined
  ) {
    return
  }
  const requests = spawnDirector.update(state, fixedStepSeconds)
  for (const request of requests) {
    spawnEnemy(
      state,
      idAllocator,
      request.definitionId,
      request,
      undefined,
      request.eliteModifiers ?? request.eliteModifier,
      effects,
    )
  }
}
