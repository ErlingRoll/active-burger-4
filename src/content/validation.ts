import {
  ENEMY_DEFINITIONS,
  type EnemyDefinition,
} from './enemies/Enemies'
import {
  PROJECTILE_DEFINITIONS,
  type ProjectileDefinition,
} from './projectiles/Projectiles'
import {
  XP_BALANCE,
  type XpBalance,
} from './progression/XpBalance'
import {
  SPAWN_BALANCE,
  type SpawnBalance,
} from './spawning/SpawnBalance'
import {
  INITIAL_UPGRADES,
  type UpgradeDefinition,
} from './upgrades/Upgrades'

export interface ContentCatalog {
  enemies: readonly EnemyDefinition[]
  projectiles: readonly ProjectileDefinition[]
  upgrades: readonly UpgradeDefinition[]
  xpBalance: XpBalance
  spawnBalance: SpawnBalance
  upgradeChoicesPerLevel: number
}

export const CURRENT_CONTENT: ContentCatalog = {
  enemies: Object.values(ENEMY_DEFINITIONS),
  projectiles: Object.values(PROJECTILE_DEFINITIONS),
  upgrades: INITIAL_UPGRADES,
  xpBalance: XP_BALANCE,
  spawnBalance: SPAWN_BALANCE,
  upgradeChoicesPerLevel: 3,
}

const VALID_UPGRADE_STATS = new Set([
  'attackDamage',
  'attackSpeed',
  'movementSpeed',
])

function validateIds(
  errors: string[],
  collectionName: string,
  definitions: readonly { id: string }[],
): Set<string> {
  const ids = new Set<string>()

  definitions.forEach((definition, index) => {
    const id = definition.id
    if (typeof id !== 'string' || id.trim() === '') {
      errors.push(`${collectionName}[${index}].id must be a non-empty string.`)
      return
    }

    if (ids.has(id)) {
      errors.push(`${collectionName} contains duplicate id "${id}".`)
      return
    }

    ids.add(id)
  })

  return ids
}

function validateFiniteNumber(
  errors: string[],
  path: string,
  value: number,
  requirement: string,
): void {
  if (!Number.isFinite(value)) {
    errors.push(`${path} must be a finite number; received ${String(value)}.`)
    return
  }

  if (!requirement) {
    return
  }

  const isValid = requirement === 'non-negative'
    ? value >= 0
    : requirement === 'positive'
      ? value > 0
      : requirement === 'integer-positive'
        ? Number.isInteger(value) && value > 0
        : true
  if (!isValid) {
    errors.push(`${path} must be ${requirement}; received ${String(value)}.`)
  }
}

function validateDefinitions(
  errors: string[],
  catalog: ContentCatalog,
): void {
  catalog.enemies.forEach((enemy, index) => {
    validateFiniteNumber(errors, `enemies[${index}].radius`, enemy.radius, 'positive')
    validateFiniteNumber(errors, `enemies[${index}].maxHp`, enemy.maxHp, 'positive')
    validateFiniteNumber(errors, `enemies[${index}].speed`, enemy.speed, 'non-negative')
    validateFiniteNumber(
      errors,
      `enemies[${index}].contactDamage`,
      enemy.contactDamage,
      'non-negative',
    )
    validateFiniteNumber(errors, `enemies[${index}].xpReward`, enemy.xpReward, 'non-negative')
  })

  catalog.projectiles.forEach((projectile, index) => {
    validateFiniteNumber(errors, `projectiles[${index}].speed`, projectile.speed, 'non-negative')
    validateFiniteNumber(errors, `projectiles[${index}].radius`, projectile.radius, 'positive')
    validateFiniteNumber(errors, `projectiles[${index}].lifetime`, projectile.lifetime, 'positive')
  })

  catalog.upgrades.forEach((upgrade, index) => {
    validateFiniteNumber(errors, `upgrades[${index}].amount`, upgrade.amount, 'positive')
    if (typeof upgrade.isEligible !== 'function') {
      errors.push(`upgrades[${index}].isEligible must be a function.`)
    }
    if (!VALID_UPGRADE_STATS.has(upgrade.stat)) {
      errors.push(
        `upgrades[${index}].stat must reference a supported player stat; received "${String(upgrade.stat)}".`,
      )
    }

  })
}

function validateXpBalance(errors: string[], balance: XpBalance): void {
  if (balance.levelThresholds.length === 0) {
    errors.push('xpBalance.levelThresholds must contain at least level 1.')
  }

  balance.levelThresholds.forEach((threshold, index) => {
    validateFiniteNumber(
      errors,
      `xpBalance.levelThresholds[${index}]`,
      threshold,
      'non-negative',
    )
    const previous = balance.levelThresholds[index - 1]
    if (previous !== undefined && threshold <= previous) {
      errors.push(
        `xpBalance.levelThresholds[${index}] must be greater than the previous threshold (${previous}).`,
      )
    }
  })

  if (balance.levelThresholds[0] !== 0) {
    errors.push('xpBalance.levelThresholds[0] must be 0 for level 1.')
  }

  validateFiniteNumber(errors, 'xpBalance.pickupRadius', balance.pickupRadius, 'positive')
  validateFiniteNumber(
    errors,
    'xpBalance.pickupAttractionRadius',
    balance.pickupAttractionRadius,
    'positive',
  )
  validateFiniteNumber(
    errors,
    'xpBalance.pickupAttractionSpeed',
    balance.pickupAttractionSpeed,
    'positive',
  )
}

function validateSpawnBalance(
  errors: string[],
  balance: SpawnBalance,
  enemyIds: Set<string>,
): void {
  validateFiniteNumber(
    errors,
    'spawnBalance.baseThreatPerSecond',
    balance.baseThreatPerSecond,
    'non-negative',
  )
  validateFiniteNumber(
    errors,
    'spawnBalance.threatGrowthPerMinute',
    balance.threatGrowthPerMinute,
    'non-negative',
  )
  validateFiniteNumber(
    errors,
    'spawnBalance.maxActiveEnemies',
    balance.maxActiveEnemies,
    'integer-positive',
  )
  validateFiniteNumber(
    errors,
    'spawnBalance.spawnRingInnerRadius',
    balance.spawnRingInnerRadius,
    'non-negative',
  )
  validateFiniteNumber(
    errors,
    'spawnBalance.spawnRingOuterRadius',
    balance.spawnRingOuterRadius,
    'positive',
  )
  if (balance.spawnRingOuterRadius <= balance.spawnRingInnerRadius) {
    errors.push(
      'spawnBalance.spawnRingOuterRadius must be greater than spawnRingInnerRadius.',
    )
  }

  if (balance.spawnEntries.length === 0) {
    errors.push('spawnBalance.spawnEntries must contain at least one entry.')
  }
  balance.spawnEntries.forEach((entry, index) => {
    if (!enemyIds.has(entry.definitionId)) {
      errors.push(
        `spawnBalance.spawnEntries[${index}].definitionId references unknown enemy "${entry.definitionId}".`,
      )
    }
    validateFiniteNumber(
      errors,
      `spawnBalance.spawnEntries[${index}].threatCost`,
      entry.threatCost,
      'positive',
    )
    validateFiniteNumber(
      errors,
      `spawnBalance.spawnEntries[${index}].weight`,
      entry.weight,
      'positive',
    )
  })
}

export function validateContent(catalog: ContentCatalog): string[] {
  const errors: string[] = []
  const enemyIds = validateIds(errors, 'enemies', catalog.enemies)
  validateIds(errors, 'projectiles', catalog.projectiles)
  const upgradeIds = validateIds(errors, 'upgrades', catalog.upgrades)

  validateDefinitions(errors, catalog)
  validateXpBalance(errors, catalog.xpBalance)
  validateSpawnBalance(errors, catalog.spawnBalance, enemyIds)

  validateFiniteNumber(
    errors,
    'upgradeChoicesPerLevel',
    catalog.upgradeChoicesPerLevel,
    'integer-positive',
  )
  if (
    Number.isInteger(catalog.upgradeChoicesPerLevel) &&
    catalog.upgradeChoicesPerLevel > 0 &&
    upgradeIds.size < catalog.upgradeChoicesPerLevel
  ) {
    errors.push(
      `upgradeChoicesPerLevel (${catalog.upgradeChoicesPerLevel}) cannot exceed the ${upgradeIds.size} unique upgrade definitions.`,
    )
  }

  // Eligibility is intentionally evaluated against a neutral state so broken
  // content predicates fail validation before a run tries to show choices.
  const eligibilityState = { playerLevel: 1, selectedUpgradeIds: [] as const }
  let eligibleUpgradeCount = 0
  catalog.upgrades.forEach((upgrade, index) => {
    if (typeof upgrade.isEligible !== 'function') {
      return
    }
    try {
      const eligible = upgrade.isEligible(eligibilityState)
      if (typeof eligible !== 'boolean') {
        errors.push(`upgrades[${index}].isEligible must return a boolean.`)
      } else if (eligible) {
        eligibleUpgradeCount += 1
      }
    } catch (error) {
      errors.push(
        `upgrades[${index}].isEligible threw during validation: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  })
  if (
    Number.isInteger(catalog.upgradeChoicesPerLevel) &&
    catalog.upgradeChoicesPerLevel > 0 &&
    eligibleUpgradeCount < catalog.upgradeChoicesPerLevel
  ) {
    errors.push(
      `upgradeChoicesPerLevel (${catalog.upgradeChoicesPerLevel}) exceeds the ${eligibleUpgradeCount} upgrades eligible at player level 1.`,
    )
  }

  return errors
}

export function assertValidContent(catalog: ContentCatalog = CURRENT_CONTENT): void {
  const errors = validateContent(catalog)
  if (errors.length > 0) {
    throw new Error(`Content validation failed:\n- ${errors.join('\n- ')}`)
  }
}
