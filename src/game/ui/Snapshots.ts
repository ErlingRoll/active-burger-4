import {
  xpRequiredForLevel,
  xpRequiredForNextLevel,
} from '../../content/progression/XpBalance'
import {
  EQUIPMENT_SLOTS,
  getItemDefinition,
  type EquipmentSlot,
} from '../../content/gear/Items'
import type { StatKey } from '../../content/stats/Stats'
import type { Rarity } from '../../content/rarity/Rarity'
import {
  getSkillDefinition,
  getSkillDamage,
  isSkillId,
  type SkillId,
} from '../../content/skills/Skills'
import {
  INITIAL_UPGRADES,
  type UpgradeId,
} from '../../content/upgrades/Upgrades'
import type {
  BossState,
  EncounterStatus,
  GameState,
  PlayerMovementCandidate,
  TelegraphState,
} from '../state/GameState'
import type { RunPhase } from '../state/RunPhase'
import { resolveWorldModifierEffects } from '../../content/modifiers/WorldModifiers'
import { SPAWN_BALANCE } from '../../content/spawning/SpawnBalance'
import {
  getBossDefinition,
  type BossDefinitionId,
} from '../../content/bosses/Bosses'
import type { EntityId } from '../ids'
import { getDerivedPlayerStats } from '../stats/DerivedStats'
import {
  DEFAULT_BEHAVIOR_PROFILE_ID,
  getBehaviorProfileDefinition,
  type BehaviorProfileId,
} from '../../content/behaviors/BehaviorProfiles'
import {
  createDungeonEncounterTimeline,
  getDungeonDefinition,
} from '../../content/dungeons/Dungeons'
import type { EncounterDefinition } from '../../content/encounters/Encounters'
import {
  getInfernoWardenEnrageMultipliers,
  type BossEnrageMultipliers,
} from '../systems/boss/BossSystem'
import {
  FLOOR_TRANSITION_SECONDS,
  isPlayerTouchingStairs,
} from '../systems/stairs/StairsSystem'
import {
  cloneChoiceFlow,
  type PendingChoiceFlow,
} from '../choices/ChoiceFlows'

/** Narrow, immutable run data intended for screen-space UI consumers. */
export interface RunHudSnapshot {
  readonly phase: RunPhase
  readonly hp: number
  readonly maxHp: number
  readonly level: number
  readonly xp: number
  readonly xpRequired: number
  readonly xpProgress: number
  readonly elapsedTime: number
  readonly killCount: number
  readonly worldModifierIds?: readonly string[]
  readonly worldModifierRewardMultiplier?: number
  readonly floor: number
  readonly floorProgress: number
  readonly floorDurationSeconds: number
}

export type SkillUpgradeStatus = 'acquired' | 'available' | 'unavailable'

export interface SkillUpgradeSnapshot {
  readonly upgradeId: UpgradeId
  readonly name: string
  readonly description: string
  readonly valueLabel: string
  readonly relevant: true
  readonly status: SkillUpgradeStatus
}

export interface SkillHudSnapshot {
  readonly skillId: SkillId
  readonly name: string
  readonly icon: string
  readonly level: number
  readonly description: string
  readonly estimatedSingleTargetDps: number | null
  readonly dpsAssumption: string
  /** Gear modifiers that affect this skill in the current combat systems. */
  readonly gearModifiers: readonly GearModifierSnapshot[]
  readonly upgrades: readonly SkillUpgradeSnapshot[]
}

export interface BossHudSnapshot {
  readonly id: EntityId | undefined
  readonly bossDefinitionId: BossDefinitionId
  readonly name: string
  readonly status: EncounterStatus
  readonly hp: number
  readonly maxHp: number
  readonly hpProgress: number
  readonly isFinal: boolean
  readonly enrage: BossEnrageHudSnapshot | null
}

export interface BossEnrageHudSnapshot extends BossEnrageMultipliers {
  readonly elapsedSeconds: number
}

export type EncounterTimelineStatus = 'completed' | 'active' | 'upcoming'

export interface EncounterTimelineHudSnapshot {
  readonly id: string
  readonly floorNumber: number
  readonly timeSeconds: number
  readonly name: string
  readonly status: EncounterTimelineStatus
  readonly isFinal: boolean
}

export interface StairsHudSnapshot {
  readonly id: EntityId
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly floorNumber: number
  readonly isFinal: boolean
  readonly rewardsCollected: boolean
  readonly playerTouching: boolean
}

export interface FloorTransitionHudSnapshot {
  readonly remainingSeconds: number
  readonly fromFloor: number
  readonly toFloor: number
  readonly isFinal: boolean
  readonly progress: number
}

export interface PickupHudSnapshot {
  readonly id: EntityId
  readonly kind: 'xp' | 'gear' | 'healing-potion'
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly amount?: number
}

export interface TelegraphHudSnapshot {
  readonly id: EntityId
  readonly sourceId: EntityId
  readonly skillId: TelegraphState['skillId']
  readonly kind: TelegraphState['kind']
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly remainingDuration: number
  readonly duration: number
  readonly progress: number
  readonly points: readonly PointSnapshot[]
}

export interface DodgeHudSnapshot {
  readonly mode: 'autonomous'
  readonly level: number
  readonly reactionTime: number
  readonly active: boolean
  /** Progress through the currently telegraphed Dodge response. */
  readonly progress: number
  readonly activeTelegraphCount: number
  readonly directionX: number
  readonly directionY: number
}

export interface BehaviorIntentHudSnapshot {
  readonly source: PlayerMovementCandidate['source']
  readonly label: string
  readonly directionX: number
  readonly directionY: number
  readonly speed: number
  readonly priority: number
  readonly targetId?: EntityId
  readonly pickupId?: EntityId
  readonly commitmentRemaining?: number
}

export interface BehaviorHudSnapshot {
  readonly profileId: BehaviorProfileId
  readonly profileName: string
  readonly profileDescription: string
  readonly activeIntent: BehaviorIntentHudSnapshot | null
}

interface PointSnapshot {
  readonly x: number
  readonly y: number
}

export interface GameUiSnapshot extends RunHudSnapshot {
  readonly skills: readonly SkillHudSnapshot[]
  readonly equipment: Readonly<
    Partial<Record<EquipmentSlot, EquippedItemSnapshot>>
  >
  readonly encounterStatus: EncounterStatus
  readonly boss: BossHudSnapshot | null
  readonly telegraphs: readonly TelegraphHudSnapshot[]
  readonly dodge: DodgeHudSnapshot
  readonly behavior: BehaviorHudSnapshot
  readonly timeline: readonly EncounterTimelineHudSnapshot[]
  readonly stairs: StairsHudSnapshot | null
  readonly floorTransition: FloorTransitionHudSnapshot | null
  readonly pickups: readonly PickupHudSnapshot[]
  readonly pendingChoiceFlow: Readonly<PendingChoiceFlow> | null
  readonly pendingChoiceCount: number
}

export interface EquippedItemSnapshot {
  readonly itemId: string
  readonly name: string
  readonly slot: EquipmentSlot
  readonly rarity: Rarity
  readonly modifiers: readonly GearModifierSnapshot[]
}

export interface GearModifierSnapshot {
  readonly stat: StatKey
  readonly operation: 'add' | 'multiply'
  readonly value: number
  readonly sourceId: string
}

/** Immutable data retained by the results screen after a run ends. */
export interface RunResultSnapshot {
  readonly phase: RunPhase
  readonly elapsedTime: number
  readonly level: number
  readonly xp: number
  readonly killCount: number
  /** Present only when the completed run ended in a final-boss victory. */
  readonly outcome?: 'victory'
}

export function createUiSnapshot(
  state: GameState,
  pendingChoiceFlows: readonly PendingChoiceFlow[] = [],
): GameUiSnapshot {
  const playerStats = getDerivedPlayerStats(state.player)
  const currentThreshold = xpRequiredForLevel(state.player.level)
  const xpRequired = xpRequiredForNextLevel(state.player.level)
  const thresholdSpan = Math.max(1, xpRequired - currentThreshold)
  const xpProgress = Math.min(
    1,
    Math.max(
      0,
      (state.player.xp - currentThreshold) / thresholdSpan,
    ),
  )

  const eligibilityState = {
    playerLevel: state.player.level,
    selectedUpgradeIds: state.run.selectedUpgradeIds,
    ownedSkillIds: state.player.skills
      .map((skill) => skill.skillId)
      .filter(isSkillId),
    skillLevels: Object.fromEntries(
      state.player.skills.map((skill) => [skill.skillId, skill.level]),
    ),
  }
  const skills = state.player.skills.flatMap((skill) => {
    if (!isSkillId(skill.skillId)) {
      return []
    }
    const definition = getSkillDefinition(skill.skillId)
    const isBasicBolt = skill.skillId === 'basic-bolt'
    const cooldown = isBasicBolt
      ? playerStats.attackSpeed > 0
        ? 1 / playerStats.attackSpeed
        : Number.POSITIVE_INFINITY
      : definition.cooldown
    const damage = isBasicBolt
      ? playerStats.attackDamage +
        getSkillDamage(definition, skill.level) -
        definition.baseDamage
      : getSkillDamage(definition, skill.level)
    const estimatedSingleTargetDps =
      Number.isFinite(cooldown) && cooldown > 0
        ? damage / cooldown
        : null
    const applicableGearStats =
      isBasicBolt
        ? new Set<StatKey>(['attackDamage', 'attackSpeed', 'attackRange'])
        : new Set<StatKey>()
    const gearModifiers = EQUIPMENT_SLOTS.flatMap((slot) => {
      const equipped = state.player.equipment?.[slot]
      if (!equipped) {
        return []
      }
      const definition = getItemDefinition(equipped.itemId)
      return (equipped.modifiers ?? definition.modifiers)
        .filter((modifier) => applicableGearStats.has(modifier.stat))
        .map((modifier) => Object.freeze({ ...modifier }))
    })
    const upgrades = INITIAL_UPGRADES.filter(
      (upgrade) => upgrade.skillId === skill.skillId,
    ).map((upgrade) => {
      const acquired =
        state.run.selectedUpgradeIds.includes(upgrade.id) ||
        (upgrade.skillAction === 'unlock' &&
          state.player.skills.some((candidate) => candidate.skillId === skill.skillId))
      const available = !acquired && upgrade.isEligible(eligibilityState)
      return Object.freeze({
        upgradeId: upgrade.id,
        name: upgrade.name,
        description: upgrade.description,
        valueLabel: upgrade.valueLabel,
        relevant: true as const,
        status: acquired
          ? ('acquired' as const)
          : available
            ? ('available' as const)
            : ('unavailable' as const),
      })
    })

    return [Object.freeze({
      skillId: skill.skillId,
      name: definition.name,
      icon: definition.visual.icon,
      level: skill.level,
      description: definition.description,
      estimatedSingleTargetDps,
      dpsAssumption: isBasicBolt
        ? 'One target sustained at the current Basic Bolt attack cadence.'
        : skill.skillId === 'whirlwind'
          ? 'One target in Whirlwind range, sustained over its cooldown.'
          : 'Primary target sustained over Chain Lightning cooldown.',
      gearModifiers: Object.freeze(gearModifiers),
      upgrades: Object.freeze(upgrades),
    })]
  })

  const equipment = Object.fromEntries(
    EQUIPMENT_SLOTS.flatMap((slot) => {
      const equipped = state.player.equipment?.[slot]
      if (!equipped) {
        return []
      }
      const definition = getItemDefinition(equipped.itemId)
      const modifiers = Object.freeze(
        (equipped.modifiers ?? definition.modifiers).map((modifier) =>
          Object.freeze({ ...modifier }),
        ),
      )
      return [[slot, Object.freeze({
        itemId: equipped.itemId,
        name: definition.name,
        slot: definition.slot,
        rarity: equipped.rarity ?? definition.rarity,
        modifiers,
      })]]
    }),
  )

  const encounterStatus = state.encounter?.status ?? 'inactive'
  const bossState = state.encounter?.bossEntityId
    ? state.bosses?.find((boss) => boss.id === state.encounter?.bossEntityId)
    : (state.bosses ?? [])
      .filter((boss) => boss.hp > 0)
      .sort((left, right) => left.id - right.id)[0]
  const bossDefinitionId = bossState?.bossDefinitionId ?? state.encounter?.bossDefinitionId
  const boss = bossDefinitionId
    ? createBossHudSnapshot(
      bossState,
      bossDefinitionId,
      encounterStatus,
      state,
    )
    : null
  const dungeon = getDungeonDefinition(state.run.dungeonId)
  const floor = state.run.floor ?? 1
  const floorProgress = Math.min(
    1,
    Math.max(
      0,
      (state.time - (floor - 1) * dungeon.floorDurationSeconds) /
        dungeon.floorDurationSeconds,
    ),
  )
  const completedEncounterIds = new Set(state.run.completedEncounterIds ?? [])
  const encounterTimeline = state.run.dungeonLengthSeconds === undefined ||
    state.run.dungeonLengthSeconds === dungeon.defaultLengthSeconds
    ? dungeon.encounterTimeline
    : createDungeonEncounterTimeline(
      state.run.dungeonLengthSeconds,
      dungeon.floorDurationSeconds,
    )
  const timeline = encounterTimeline.map((event) =>
    createEncounterTimelineSnapshot(
      event,
      state.encounter?.encounterId,
      completedEncounterIds,
      dungeon.floorDurationSeconds,
    ),
  )
  const stairs = state.stairs
    ? Object.freeze({
      id: state.stairs.id,
      x: state.stairs.x,
      y: state.stairs.y,
      radius: state.stairs.radius,
      floorNumber: state.stairs.floorNumber,
      isFinal: state.stairs.isFinal,
      rewardsCollected: state.stairs.rewardsCollected,
      playerTouching: isPlayerTouchingStairs(state, state.stairs),
    })
    : null
  const floorTransition = state.floorTransition
    ? Object.freeze({
      remainingSeconds: Math.max(0, state.floorTransition.remainingSeconds),
      fromFloor: state.floorTransition.fromFloor,
      toFloor: state.floorTransition.toFloor,
      isFinal: state.floorTransition.isFinal,
      progress: Math.min(
        1,
        Math.max(
          0,
          1 - state.floorTransition.remainingSeconds / FLOOR_TRANSITION_SECONDS,
        ),
      ),
    })
    : null
  const pickups = Object.freeze(
    state.pickups
      .slice()
      .sort((left, right) => left.id - right.id)
      .map((pickup) =>
        Object.freeze({
          id: pickup.id,
          kind: pickup.kind,
          x: pickup.x,
          y: pickup.y,
          radius: pickup.radius,
          ...(pickup.kind === 'xp' ? { amount: pickup.xpAmount } : {}),
        }),
      ),
  )
  const pendingChoiceFlow = pendingChoiceFlows[0]
    ? freezeChoiceFlow(pendingChoiceFlows[0])
    : null

  const telegraphs = (state.telegraphs ?? [])
    .slice()
    .sort((left, right) => left.id - right.id)
    .map((telegraph) => Object.freeze({
      id: telegraph.id,
      sourceId: telegraph.sourceId,
      skillId: telegraph.skillId,
      kind: telegraph.kind,
      x: telegraph.x,
      y: telegraph.y,
      radius: telegraph.radius,
      remainingDuration: telegraph.remainingDuration,
      duration: telegraph.duration,
      progress: telegraph.duration > 0
        ? Math.min(1, Math.max(0, 1 - telegraph.remainingDuration / telegraph.duration))
        : 1,
      points: Object.freeze(
        telegraph.points.map((point) => Object.freeze({ x: point.x, y: point.y })),
      ),
    }))
  const dodgeTelegraphs = telegraphs.filter(
    (telegraph) => telegraph.remainingDuration > 0,
  )
  const dodge = Object.freeze({
    mode: state.player.dodge?.mode ?? 'autonomous' as const,
    level: state.player.dodge?.level ?? 1,
    reactionTime: state.player.dodge?.reactionTime ?? 0.1,
    active: dodgeTelegraphs.length > 0,
    progress: dodgeTelegraphs.length > 0
      ? Math.max(...dodgeTelegraphs.map((telegraph) => telegraph.progress))
      : 0,
    activeTelegraphCount: dodgeTelegraphs.length,
    directionX: state.player.dodge?.lastDirectionX ?? 0,
    directionY: state.player.dodge?.lastDirectionY ?? 0,
  })
  const profileId = state.player.behaviorController?.profileId ??
    DEFAULT_BEHAVIOR_PROFILE_ID
  const profile = getBehaviorProfileDefinition(profileId)
  const activeIntent = state.player.behaviorController?.lastCandidate
  const intentLabels: Record<PlayerMovementCandidate['source'], string> = {
    dodge: 'Dodge',
    gear: 'Collect gear',
    kite: 'Kite away',
    'combat-range': 'Close to target',
    hold: 'Hold position',
  }
  const behavior = Object.freeze({
    profileId,
    profileName: profile.name,
    profileDescription: profile.description,
    activeIntent: activeIntent
      ? Object.freeze({
        source: activeIntent.source,
        label: intentLabels[activeIntent.source],
        directionX: activeIntent.directionX,
        directionY: activeIntent.directionY,
        speed: activeIntent.speed,
        priority: activeIntent.priority,
        ...(activeIntent.targetId === undefined
          ? {}
          : { targetId: activeIntent.targetId }),
        ...(activeIntent.pickupId === undefined
          ? {}
          : { pickupId: activeIntent.pickupId }),
        ...(state.player.behaviorController?.commitmentRemaining === undefined
          ? {}
          : {
            commitmentRemaining:
              state.player.behaviorController.commitmentRemaining,
          }),
      })
      : null,
  })

  return Object.freeze({
    phase: state.run.phase,
    hp: state.player.hp,
    maxHp: playerStats.maxHp,
    level: state.player.level,
    xp: state.player.xp,
    xpRequired,
    xpProgress,
    elapsedTime: state.time,
    killCount: state.run.killCount,
    ...(state.run.worldModifierIds?.length
      ? {
          worldModifierIds: state.run.worldModifierIds,
          worldModifierRewardMultiplier: resolveWorldModifierEffects(
            state.run.worldModifierIds,
            SPAWN_BALANCE,
          ).essenceRewardMultiplier,
        }
      : {}),
    floor,
    floorProgress,
    floorDurationSeconds: dungeon.floorDurationSeconds,
    skills: Object.freeze(skills),
    equipment: Object.freeze(equipment),
    encounterStatus,
    boss,
    telegraphs: Object.freeze(telegraphs),
    dodge,
    behavior,
    timeline: Object.freeze(timeline),
    stairs,
    floorTransition,
    pickups,
    pendingChoiceFlow,
    pendingChoiceCount: pendingChoiceFlows.length,
  })
}

function createBossHudSnapshot(
  boss: BossState | undefined,
  bossDefinitionId: BossDefinitionId,
  status: EncounterStatus,
  state: Readonly<GameState>,
): BossHudSnapshot {
  const definition = getBossDefinition(bossDefinitionId)
  const maxHp = boss?.maxHp ?? definition.maxHp
  const hp = Math.max(0, Math.min(maxHp, boss?.hp ?? (status === 'complete' ? 0 : maxHp)))
  const isFinal = state.encounter?.isFinal === true ||
    bossDefinitionId === 'inferno-warden'
  const enrage = bossDefinitionId === 'inferno-warden'
    ? Object.freeze({
      elapsedSeconds: Math.max(
        0,
        state.time - (boss?.spawnTime ?? state.encounter?.startedAt ?? state.time),
      ),
      ...getInfernoWardenEnrageMultipliers(
        Math.max(
          0,
          state.time - (boss?.spawnTime ?? state.encounter?.startedAt ?? state.time),
        ),
        definition.enrage,
      ),
    })
    : null
  return Object.freeze({
    id: boss?.id,
    bossDefinitionId,
    name: definition.name,
    status,
    hp,
    maxHp,
    hpProgress: maxHp > 0 ? hp / maxHp : 0,
    isFinal,
    enrage,
  })
}

export function createRunResultSnapshot(
  state: GameState,
): RunResultSnapshot {
  const result = {
    phase: state.run.phase,
    elapsedTime: state.time,
    level: state.player.level,
    xp: state.player.xp,
    killCount: state.run.killCount,
    ...(state.run.phase === 'results' &&
    state.player.hp > 0
      ? { outcome: 'victory' as const }
      : {}),
  }
  return Object.freeze(result)
}

function createEncounterTimelineSnapshot(
  event: EncounterDefinition,
  activeEncounterId: string | undefined,
  completedEncounterIds: ReadonlySet<string>,
  floorDurationSeconds: number,
): EncounterTimelineHudSnapshot {
  const status: EncounterTimelineStatus = completedEncounterIds.has(event.id)
    ? 'completed'
    : activeEncounterId === event.id
      ? 'active'
      : 'upcoming'
  return Object.freeze({
    id: event.id,
    floorNumber:
      event.floorNumber ??
      Math.floor(event.timeSeconds / floorDurationSeconds) + 1,
    timeSeconds: event.timeSeconds,
    name: getBossDefinition(event.bossDefinitionId).name,
    status,
    isFinal: event.isFinal === true,
  })
}

function freezeChoiceFlow(
  flow: Readonly<PendingChoiceFlow>,
): Readonly<PendingChoiceFlow> {
  const cloned = cloneChoiceFlow(flow)
  const choices = cloned.type === 'gear-pickup'
    ? cloned.choices.map((choice) =>
      Object.freeze(
        choice.type === 'upgrade-equipped-item'
          ? {
            ...choice,
            upgradedModifiers: Object.freeze(
              choice.upgradedModifiers.map((modifier) => Object.freeze({ ...modifier })),
            ),
          }
          : { ...choice },
      ),
    )
    : cloned.choices.map((choice) => Object.freeze({ ...choice }))
  return Object.freeze({
    ...cloned,
    choices: Object.freeze(choices),
  }) as Readonly<PendingChoiceFlow>
}
