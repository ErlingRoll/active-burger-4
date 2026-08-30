export const ENEMY_POST_SPAWN_ACCELERATION = {
  gracePeriodSeconds: 10,
  rampDurationSeconds: 60,
  maxSpeedMultiplier: 4,
  maxDamageMultiplier: 2,
} as const

function getPostSpawnRampProgress(
  currentTime: number,
  spawnTime: number | undefined,
): number {
  if (spawnTime === undefined || !Number.isFinite(spawnTime)) {
    return 0
  }

  const elapsedSinceSpawn = Math.max(0, currentTime - spawnTime)
  const elapsedDuringRamp = elapsedSinceSpawn -
    ENEMY_POST_SPAWN_ACCELERATION.gracePeriodSeconds
  if (elapsedDuringRamp <= 0) {
    return 0
  }

  const rampProgress = Math.min(
    1,
    elapsedDuringRamp / ENEMY_POST_SPAWN_ACCELERATION.rampDurationSeconds,
  )
  return rampProgress
}

export function getPostSpawnSpeedMultiplier(
  currentTime: number,
  spawnTime: number | undefined,
): number {
  return 1 + (
    ENEMY_POST_SPAWN_ACCELERATION.maxSpeedMultiplier - 1
  ) * getPostSpawnRampProgress(currentTime, spawnTime)
}

export function getPostSpawnDamageMultiplier(
  currentTime: number,
  spawnTime: number | undefined,
): number {
  return 1 + (
    ENEMY_POST_SPAWN_ACCELERATION.maxDamageMultiplier - 1
  ) * getPostSpawnRampProgress(currentTime, spawnTime)
}
