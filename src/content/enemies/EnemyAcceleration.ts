export const ENEMY_POST_SPAWN_ACCELERATION = {
  gracePeriodSeconds: 10,
  rampDurationSeconds: 90,
  maxSpeedMultiplier: 4,
} as const

export function getPostSpawnSpeedMultiplier(
  currentTime: number,
  spawnTime: number | undefined,
): number {
  if (spawnTime === undefined || !Number.isFinite(spawnTime)) {
    return 1
  }

  const elapsedSinceSpawn = Math.max(0, currentTime - spawnTime)
  const elapsedDuringRamp = elapsedSinceSpawn -
    ENEMY_POST_SPAWN_ACCELERATION.gracePeriodSeconds
  if (elapsedDuringRamp <= 0) {
    return 1
  }

  const rampProgress = Math.min(
    1,
    elapsedDuringRamp / ENEMY_POST_SPAWN_ACCELERATION.rampDurationSeconds,
  )
  return 1 + (
    ENEMY_POST_SPAWN_ACCELERATION.maxSpeedMultiplier - 1
  ) * rampProgress
}
