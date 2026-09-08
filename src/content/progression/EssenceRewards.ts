/**
 * Essence reward maths.
 *
 * This is balance content, not a property of the meta-progression service, so
 * it sits under `content/` where `game/ui/Snapshots.ts` may depend on it. The
 * `meta` feature re-exports it for its own consumers.
 */
export interface EssenceRewardCalculation {
  levelReward: number
  killReward: number
  baseEssence: number
  modifierMultiplier: number
  victoryMultiplier: number
  projectedReward: number
}

export function calculateEssenceReward(
  level: number,
  killCount: number,
  modifierMultiplier: number,
  isVictory = false,
): EssenceRewardCalculation {
  const levelReward = 1 + Math.max(0, Math.max(1, level) - 1) * 10
  const killReward = Math.floor(Math.max(0, killCount) / 10)
  const baseEssence = levelReward + killReward
  const victoryMultiplier = isVictory ? 1.1 : 1

  return {
    levelReward,
    killReward,
    baseEssence,
    modifierMultiplier,
    victoryMultiplier,
    projectedReward: Math.max(
      1,
      Math.floor(baseEssence * modifierMultiplier * victoryMultiplier),
    ),
  }
}
