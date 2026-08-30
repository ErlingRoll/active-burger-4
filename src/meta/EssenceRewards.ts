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
  const levelReward = Math.max(1, level)
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
