import type {
  SkillId,
  SkillTag,
} from '../../content/skills/Skills'
import {
  DEFAULT_MONSTER_CRITICAL_STRIKE,
  DEFAULT_PLAYER_CRITICAL_STRIKE,
  applyFlatDamage,
  applyIncreasedDamage,
  createDamageValues,
  scaleDamageValues,
  type CriticalStrikeStats,
  type DamageValues,
  type PartialDamageValues,
} from '../../content/stats/Damage'
import type {
  BossState,
  DamageEvent,
  EnemyState,
  GameState,
} from '../state/GameState'
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
  damageMultiplier?: number
}

export function createPlayerDamageProfileFromStats(
  stats: Pick<
    PlayerStats,
    'flatDamage' | 'increasedDamage' | 'critChance' | 'critMultiplier'
  >,
  baseDamage: Readonly<PartialDamageValues>,
  context: PlayerDamageProfileContext = {},
): ResolvedOutgoingDamage {
  return {
    damage: scaleDamageValues(
      applyIncreasedDamage(
        applyFlatDamage(baseDamage, stats.flatDamage),
        stats.increasedDamage,
        { isProjectile: context.isProjectile },
      ),
      context.damageMultiplier ?? 1,
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
  return {
    damage: createDamageValues(baseDamage),
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
