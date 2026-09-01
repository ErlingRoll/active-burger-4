import type {
  SkillId,
  SkillTag,
} from '../../content/skills/Skills'
import { BASIC_ATTACK_SKILL_ID } from '../../content/skills/Skills'
import { getSkillDamageIncreasePercent } from '../../content/upgrades/Upgrades'
import {
  DEFAULT_MONSTER_CRITICAL_STRIKE,
  DEFAULT_PLAYER_CRITICAL_STRIKE,
  DAMAGE_TYPES,
  DAMAGE_INCREASE_TYPES,
  addDamageValues,
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
  /** Typed Attunement contribution added after native skill increases. */
  attunementDamage?: DamageValues
  poisonApplication?: DamageEvent['poisonApplication']
}

/**
 * Player damage pipeline:
 * 1. Basic Attacks add flat damage, then apply increased damage.
 * 2. Other sources apply their native base damage and increased damage.
 * 3. Attunement is calculated from the finalized, pre-crit Basic Attack and
 *    appended as typed damage without reapplying the skill's native increases.
 * 4. Periodic player damage applies DoT multiplier once when the event resolves.
 * 5. Critical strikes (when present) and target resistance resolve afterward.
 */

export function getAttunementSourceAdditionalIncreasedDamage(
  state: Readonly<GameState>,
): Partial<Record<DamageIncreaseType, number>> {
  const basicAttack = state.player.skills.find(
    (skill) => skill.skillId === BASIC_ATTACK_SKILL_ID,
  )
  return {
    global: getSkillDamageIncreasePercent(
      BASIC_ATTACK_SKILL_ID,
      basicAttack?.level ?? 1,
      state.run.selectedUpgradeIds,
    ),
  }
}

export interface PlayerDamageProfileContext {
  isProjectile?: boolean
  /** Basic Attack already contains attackDamage and must not add Attunement. */
  isBasicAttack?: boolean
  sourceTags?: readonly SkillTag[]
  additionalIncreasedDamage?: Partial<Record<DamageIncreaseType, number>>
  attunementSourceAdditionalIncreasedDamage?: Partial<Record<DamageIncreaseType, number>>
}

export function getBasicAttackDamageBeforeCritFromStats(
  stats: Pick<
    PlayerStats,
    'flatDamage' | 'increasedDamage'
  > & Partial<Pick<PlayerStats, 'attackDamage' | 'basicAttackIsProjectile'>>,
  additionalIncreasedDamage: Partial<Record<DamageIncreaseType, number>> = {},
): DamageValues {
  const increasedDamage = createDamageIncreaseValues(stats.increasedDamage)
  for (const increaseType of DAMAGE_INCREASE_TYPES) {
    increasedDamage[increaseType] += additionalIncreasedDamage[increaseType] ?? 0
  }
  return applyIncreasedDamage(
    applyFlatDamage(
      { physical: stats.attackDamage ?? 0 },
      stats.flatDamage,
    ),
    increasedDamage,
    { isProjectile: stats.basicAttackIsProjectile },
  )
}

export function getAttunementDamageFromStats(
  stats: Pick<
    PlayerStats,
    'flatDamage' | 'increasedDamage'
  > & Partial<Pick<PlayerStats, 'attackDamage' | 'attunement' | 'basicAttackIsProjectile'>>,
  additionalIncreasedDamage: Partial<Record<DamageIncreaseType, number>> = {},
): DamageValues {
  const basicAttackDamage = getBasicAttackDamageBeforeCritFromStats(
    stats,
    additionalIncreasedDamage,
  )
  const masteredDamage = createDamageValues()
  const attunementPercent = Math.max(0, stats.attunement ?? 0) / 100
  for (const damageType of DAMAGE_TYPES) {
    masteredDamage[damageType] = Math.ceil(
      basicAttackDamage[damageType] * attunementPercent,
    )
  }
  return masteredDamage
}

export function createPlayerDamageProfileFromStats(
  stats: Pick<
    PlayerStats,
    'flatDamage' | 'increasedDamage' | 'critChance' | 'critMultiplier'
  > & Partial<Pick<PlayerStats, 'attackDamage' | 'attunement' | 'basicAttackIsProjectile'>>,
  baseDamage: Readonly<PartialDamageValues>,
  context: PlayerDamageProfileContext = {},
): ResolvedOutgoingDamage {
  const increasedDamage = createDamageIncreaseValues(stats.increasedDamage)
  for (const increaseType of DAMAGE_INCREASE_TYPES) {
    increasedDamage[increaseType] +=
      context.additionalIncreasedDamage?.[increaseType] ?? 0
  }
  const attunementDamage = context.isBasicAttack
    ? createDamageValues()
    : getAttunementDamageFromStats(
        stats,
        context.attunementSourceAdditionalIncreasedDamage,
      )
  const nativeDamage = applyIncreasedDamage(
    applyFlatDamage(
      baseDamage,
      context.isBasicAttack ? stats.flatDamage : {},
    ),
    increasedDamage,
    { isProjectile: context.isProjectile },
  )
  return {
    damage: addDamageValues(nativeDamage, attunementDamage),
    criticalStrike: {
      chance: stats.critChance,
      multiplier: stats.critMultiplier,
    },
    attunementDamage,
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
    {
      ...context,
      attunementSourceAdditionalIncreasedDamage:
        context.attunementSourceAdditionalIncreasedDamage ??
        getAttunementSourceAdditionalIncreasedDamage(state),
    },
  )
}

export function createPlayerDamageEventFromStats(
  stats: Pick<
    PlayerStats,
    'flatDamage' | 'increasedDamage' | 'critChance' | 'critMultiplier'
  > & Partial<Pick<PlayerStats, 'attackDamage' | 'attunement' | 'basicAttackIsProjectile'>>,
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
    ...(eliteModifier?.poisonApplication
      ? { poisonApplication: eliteModifier.poisonApplication }
      : {}),
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
    ...(profile.poisonApplication
      ? { poisonApplication: profile.poisonApplication }
      : {}),
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
