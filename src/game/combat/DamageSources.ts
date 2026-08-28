import type {
  SkillId,
  SkillTag,
} from '../../content/skills/Skills'
import {
  DEFAULT_MONSTER_CRITICAL_STRIKE,
  DEFAULT_PLAYER_CRITICAL_STRIKE,
  DAMAGE_INCREASE_TYPES,
  applyFlatDamage,
  applyIncreasedDamage,
  createDamageIncreaseValues,
  createDamageValues,
  type CriticalStrikeStats,
  type DamageIncreaseType,
  type DamageValues,
  type PartialDamageValues,
} from '../../content/stats/Damage'
import type {
  BossState,
  DamageEvent,
  EnemyState,
  GameState,
} from '../state/GameState'
import { getEliteModifierDefinition } from '../../content/enemies/EliteModifiers'
import {
  getDerivedPlayerStats,
  type PlayerStats,
} from '../stats/DerivedStats'

export interface ResolvedOutgoingDamage {
  damage: DamageValues
  criticalStrike: CriticalStrikeStats
}

export interface PlayerDamageProfileContext {
  isProjectile?: boolean
  sourceTags?: readonly SkillTag[]
  additionalIncreasedDamage?: Partial<Record<DamageIncreaseType, number>>
}

export function createPlayerDamageProfileFromStats(
  stats: Pick<
    PlayerStats,
    'flatDamage' | 'increasedDamage' | 'critChance' | 'critMultiplier'
  >,
  baseDamage: Readonly<PartialDamageValues>,
  context: PlayerDamageProfileContext = {},
): ResolvedOutgoingDamage {
  const increasedDamage = createDamageIncreaseValues(stats.increasedDamage)
  for (const increaseType of DAMAGE_INCREASE_TYPES) {
    increasedDamage[increaseType] +=
      context.additionalIncreasedDamage?.[increaseType] ?? 0
  }
  return {
    damage: applyIncreasedDamage(
      applyFlatDamage(baseDamage, stats.flatDamage),
      increasedDamage,
      { isProjectile: context.isProjectile },
    ),
    criticalStrike: {
      chance: stats.critChance,
      multiplier: stats.critMultiplier,
    },
  }
}

export function createPlayerDamageProfile(
  state: Readonly<GameState>,
  baseDamage: Readonly<PartialDamageValues>,
  context: PlayerDamageProfileContext = {},
): ResolvedOutgoingDamage {
  return createPlayerDamageProfileFromStats(
    getDerivedPlayerStats(state.player),
    baseDamage,
    context,
  )
}

export function createPlayerDamageEventFromStats(
  stats: Pick<
    PlayerStats,
    'flatDamage' | 'increasedDamage' | 'critChance' | 'critMultiplier'
  >,
  sourceId: number,
  targetId: number,
  sourceSkillId: SkillId | undefined,
  baseDamage: Readonly<PartialDamageValues>,
  context: PlayerDamageProfileContext = {},
): DamageEvent {
  const profile = createPlayerDamageProfileFromStats(stats, baseDamage, context)
  return {
    sourceId,
    sourceSkillId,
    sourceTags: context.sourceTags,
    targetId,
    damage: profile.damage,
    criticalStrike: profile.criticalStrike,
  }
}

export function createPlayerDamageEvent(
  state: Readonly<GameState>,
  sourceId: number,
  targetId: number,
  sourceSkillId: SkillId | undefined,
  baseDamage: Readonly<PartialDamageValues>,
  context: PlayerDamageProfileContext = {},
): DamageEvent {
  const profile = createPlayerDamageProfile(state, baseDamage, context)
  return {
    sourceId,
    sourceSkillId,
    sourceTags: context.sourceTags,
    targetId,
    damage: profile.damage,
    criticalStrike: profile.criticalStrike,
  }
}

interface MonsterDamageSource {
  id: number
  critChance?: number
  critMultiplier?: number
  eliteModifier?: EnemyState['eliteModifier']
}

export function createMonsterCriticalStrikeStats(
  source?: Readonly<MonsterDamageSource>,
): CriticalStrikeStats {
  return {
    chance: source?.critChance ?? DEFAULT_MONSTER_CRITICAL_STRIKE.chance,
    multiplier: source?.critMultiplier ?? DEFAULT_MONSTER_CRITICAL_STRIKE.multiplier,
  }
}

export function createMonsterDamageProfile(
  baseDamage: Readonly<PartialDamageValues>,
  source?: Readonly<MonsterDamageSource>,
): ResolvedOutgoingDamage {
  const damage = createDamageValues(baseDamage)
  const eliteModifier = source?.eliteModifier
    ? getEliteModifierDefinition(source.eliteModifier)
    : undefined
  if (eliteModifier?.extraDamageType) {
    damage[eliteModifier.extraDamageType] +=
      damage.physical * (eliteModifier.extraPhysicalDamageRatio ?? 0)
  }
  return {
    damage,
    criticalStrike: createMonsterCriticalStrikeStats(source),
  }
}

export function createMonsterDamageEvent(
  source: Readonly<MonsterDamageSource>,
  targetId: number,
  baseDamage: Readonly<PartialDamageValues>,
): DamageEvent {
  const profile = createMonsterDamageProfile(baseDamage, source)
  return {
    sourceId: source.id,
    targetId,
    damage: profile.damage,
    criticalStrike: profile.criticalStrike,
  }
}

export function createBossDamageProfile(
  boss: Readonly<EnemyState | BossState>,
  baseDamage: Readonly<PartialDamageValues>,
): ResolvedOutgoingDamage {
  return createMonsterDamageProfile(baseDamage, boss)
}

export function createDefaultPlayerCriticalStrike(): CriticalStrikeStats {
  return { ...DEFAULT_PLAYER_CRITICAL_STRIKE }
}
