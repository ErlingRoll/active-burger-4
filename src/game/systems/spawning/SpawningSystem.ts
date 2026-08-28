import {
  SLIME_DEFINITION_ID,
} from '../../../content/enemies/EnemyConfig'
import { getEnemyDefinition } from '../../../content/enemies/Enemies'
import {
  getEliteModifierDefinition,
  type EliteModifierId,
} from '../../../content/enemies/EliteModifiers'
import { XP_BALANCE } from '../../../content/progression/XpBalance'
import { GEAR_PICKUP_BALANCE } from '../../../content/gear/GearDropConfig'
import { getItemDefinition } from '../../../content/gear/Items'
import { DEFAULT_BEHAVIOR_PROFILE_ID } from '../../../content/behaviors/BehaviorProfiles'
import {
  BASIC_ATTACK_SKILL_ID,
  DEFAULT_SKILL_SLOT_COUNT,
} from '../../../game-config/skills'
import {
  getBossDefinition,
  type BossDefinitionId,
} from '../../../content/bosses/Bosses'
import {
  getDungeonDefinition,
  scaleOrdinaryEnemyStats,
} from '../../../content/dungeons/Dungeons'
import type { WorldModifierEffects } from '../../../content/modifiers/WorldModifiers'
import {
  DEFAULT_PLAYSTYLE_ID,
  getPlaystyleDefinition,
  type PlaystyleId,
} from '../../../content/playstyles/Playstyles'
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

export function createInitialPlayerState(
  id: EntityId,
  effects?: Pick<WorldModifierEffects, 'playerStatMultipliers'>,
  playstyleId: PlaystyleId = DEFAULT_PLAYSTYLE_ID,
): PlayerState {
  const playstyle = getPlaystyleDefinition(playstyleId)
  const playerStatMultipliers = effects?.playerStatMultipliers ?? {}
  const startingSkillIds = [
    BASIC_ATTACK_SKILL_ID,
    ...playstyle.startingSkillIds.filter(
      (skillId) => skillId !== BASIC_ATTACK_SKILL_ID,
    ),
  ]
  const maxHp = playstyle.baseStats.maxHp * (playerStatMultipliers.maxHp ?? 1)
  const movementSpeed = playstyle.baseStats.movementSpeed * (playerStatMultipliers.movementSpeed ?? 1)
  const attackDamage = playstyle.baseStats.attackDamage * (playerStatMultipliers.attackDamage ?? 1)
  return {
    id,
    playstyleId,
    x: 0,
    y: 0,
    radius: 16,
    movementVelocityX: 0,
    movementVelocityY: 0,
    skillSlotCount: DEFAULT_SKILL_SLOT_COUNT,
    hp: maxHp,
    maxHp,
    level: 1,
    xp: 0,
    movementSpeed,
    attackDamage,
    attackSpeed: playstyle.baseStats.attackSpeed,
    attackRange: playstyle.baseStats.attackRange,
    attackCooldownRemaining: 0,
    meleeLeech: 0,
    whirlwindLeech: 0,
    upgradeWhirlwindLeech: 0,
    gearDropChanceMultiplier: 1,
    gearRarityFloor: 'common',
    pickupCollectionRangeMultiplier: 1,
    baseStats: {
      maxHp,
      movementSpeed,
      attackDamage,
      attackSpeed: playstyle.baseStats.attackSpeed,
      attackRange: playstyle.baseStats.attackRange,
    },
    statModifiers: [],
    equipment: {
      weapon: createEquippedItem(getItemDefinition(playstyle.startingWeaponItemId)),
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
    },
    skills: startingSkillIds.map((skillId) => ({
      skillId,
      level: 1,
      cooldownRemaining: 0,
    })),
  }
}

export function spawnEnemy(
  state: GameState,
  idAllocator: EntityIdAllocator,
  definitionId: EnemyDefinitionId,
  position: WorldPosition,
  xpRewardOverride?: number,
  eliteModifier?: EliteModifierId,
  effects?: Pick<
    WorldModifierEffects,
    | 'ordinaryEnemyMaxHpMultiplier'
    | 'ordinaryEnemyContactDamageMultiplier'
    | 'ordinaryEnemySpeedMultiplier'
  >,
): EntityId {
  const definition = getEnemyDefinition(definitionId)
  const modifier = eliteModifier
    ? getEliteModifierDefinition(eliteModifier)
    : undefined
  const baseXpReward = xpRewardOverride ?? definition.xpReward
  const xpReward =
    baseXpReward > 0
      ? Math.round(baseXpReward * (modifier?.xpRewardMultiplier ?? 1))
      : baseXpReward
  const dungeon = getDungeonDefinition(state.run.dungeonId)
  const floor = state.run.floor ?? 1
  const scaledStats = scaleOrdinaryEnemyStats(
    {
      maxHp: definition.maxHp,
      contactDamage: definition.contactDamage,
    },
    floor,
    dungeon,
  )
  const maxHp = scaledStats.maxHp *
    (modifier?.maxHpMultiplier ?? 1) *
    (effects?.ordinaryEnemyMaxHpMultiplier ?? 1)
  const enemy: EnemyState = {
    id: idAllocator.createEntityId(),
    definitionId: definition.id,
    x: position.x,
    y: position.y,
    radius: definition.radius * (modifier?.radiusMultiplier ?? 1),
    hp: maxHp,
    maxHp,
    speed: definition.speed *
      (modifier?.speedMultiplier ?? 1) *
      (effects?.ordinaryEnemySpeedMultiplier ?? 1),
    contactDamage: scaledStats.contactDamage *
      (effects?.ordinaryEnemyContactDamageMultiplier ?? 1),
    contactCooldownRemaining: 0,
    xpReward,
    ...(modifier ? { eliteModifier: modifier.id } : {}),
    targetId: state.player.id,
  }

  state.enemies.push(enemy)
  return enemy.id
}

export function spawnSlime(
  state: GameState,
  idAllocator: EntityIdAllocator,
  position: WorldPosition,
): EntityId {
  const definition = getEnemyDefinition(SLIME_DEFINITION_ID)
  return spawnEnemy(state, idAllocator, definition.id, position)
}

export function spawnBoss(
  state: GameState,
  idAllocator: EntityIdAllocator,
  definitionId: BossDefinitionId,
  position: WorldPosition,
): EntityId {
  const definition = getBossDefinition(definitionId)
  const boss: BossState = {
    id: idAllocator.createEntityId(),
    definitionId: definition.id,
    bossDefinitionId: definition.id,
    x: position.x,
    y: position.y,
    radius: definition.radius,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    speed: definition.speed,
    contactDamage: definition.contactDamage,
    spawnTime: state.time,
    xpReward: definition.xpReward,
    targetId: state.player.id,
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
    | 'ordinaryEnemyContactDamageMultiplier'
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
      request.eliteModifier,
      effects,
    )
  }
}
