import {
  ENEMY_DEFINITIONS,
  type EnemyDefinition,
} from './enemies/Enemies'
import {
  ELITE_MODIFIER_DEFINITIONS,
  type EliteModifierDefinition,
} from './enemies/EliteModifiers'
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
import {
  SKILL_DEFINITIONS,
  type SkillDefinition,
} from './skills/Skills'
import {
  EQUIPMENT_SLOTS,
  INITIAL_ITEMS,
  isItemId,
  type ItemDefinition,
} from './gear/Items'
import {
  isRarity,
  RARITY_WEIGHTS,
  validateRarityWeights,
} from './rarity/Rarity'
import {
  isStatKey,
  type StatModifier,
} from './stats/Stats'
import {
  GEAR_DROP_CHANCES,
  GEAR_PICKUP_BALANCE,
  validateGearDropChances,
  validateGearPickupBalance,
} from './gear/GearDrops'
import {
  BOSS_DEFINITIONS,
  BOSS_SKILL_DEFINITIONS,
  type BossDefinition,
  type BossSkillDefinition,
} from './bosses/Bosses'
import {
  ENCOUNTER_DEFINITIONS,
  type EncounterDefinition,
} from './encounters/Encounters'
import {
  BEHAVIOR_PROFILE_DEFINITIONS,
  type BehaviorProfileDefinition,
  type BehaviorIntentSource,
} from './behaviors/BehaviorProfiles'

export interface ContentCatalog {
  enemies: readonly EnemyDefinition[]
  eliteModifiers: readonly EliteModifierDefinition[]
  projectiles: readonly ProjectileDefinition[]
  upgrades: readonly UpgradeDefinition[]
  items: readonly ItemDefinition[]
  skills: readonly SkillDefinition[]
  bosses: readonly BossDefinition[]
  bossSkills: readonly BossSkillDefinition[]
  encounters: readonly EncounterDefinition[]
  behaviorProfiles: readonly BehaviorProfileDefinition[]
  xpBalance: XpBalance
  spawnBalance: SpawnBalance
  upgradeChoicesPerLevel: number
}

export const CURRENT_CONTENT: ContentCatalog = {
  enemies: Object.values(ENEMY_DEFINITIONS),
  eliteModifiers: Object.values(ELITE_MODIFIER_DEFINITIONS),
  projectiles: Object.values(PROJECTILE_DEFINITIONS),
  upgrades: INITIAL_UPGRADES,
  items: INITIAL_ITEMS,
  skills: Object.values(SKILL_DEFINITIONS),
  bosses: Object.values(BOSS_DEFINITIONS),
  bossSkills: Object.values(BOSS_SKILL_DEFINITIONS),
  encounters: ENCOUNTER_DEFINITIONS,
  behaviorProfiles: Object.values(BEHAVIOR_PROFILE_DEFINITIONS),
  xpBalance: XP_BALANCE,
  spawnBalance: SPAWN_BALANCE,
  upgradeChoicesPerLevel: 3,
}

const VALID_UPGRADE_STATS = new Set([
  'attackDamage',
  'attackSpeed',
  'movementSpeed',
])

const VALID_SKILL_KINDS = new Set(['projectile', 'area', 'chain'])
const VALID_SKILL_VISUAL_KINDS = new Set(['projectile', 'area', 'chain'])
const VALID_SKILL_TAGS = new Set([
  'physical',
  'projectile',
  'melee',
  'area',
  'lightning',
])
const VALID_UPGRADE_CATEGORIES = new Set(['passive', 'skill'])
const VALID_SKILL_ACTIONS = new Set(['unlock', 'level'])
const VALID_MODIFIER_OPERATIONS = new Set(['add', 'multiply'])
const VALID_ENEMY_BEHAVIORS = new Set(['chase', 'standoff', 'split'])
const VALID_ENEMY_SHAPES = new Set([
  'circle',
  'diamond',
  'triangle',
  'hexagon',
])

function validateBehaviorProfiles(
  errors: string[],
  profiles: readonly BehaviorProfileDefinition[],
): void {
  const intentSources: readonly BehaviorIntentSource[] = [
    'dodge',
    'gear',
    'kite',
    'combat-range',
    'hold',
  ]
  validateIds(errors, 'behaviorProfiles', profiles)
  profiles.forEach((profile, index) => {
    if (typeof profile.id === 'string' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profile.id)) {
      errors.push(
        `behaviorProfiles[${index}].id must use lowercase ASCII letters, numbers, and hyphens; received "${profile.id}".`,
      )
    }
    if (typeof profile.name !== 'string' || profile.name.trim() === '') {
      errors.push(`behaviorProfiles[${index}].name must be a non-empty string.`)
    }
    if (typeof profile.description !== 'string' || profile.description.trim() === '') {
      errors.push(`behaviorProfiles[${index}].description must be a non-empty string.`)
    }
    for (const source of intentSources) {
      if (!Number.isFinite(profile.intentPriorities?.[source])) {
        errors.push(
          `behaviorProfiles[${index}].intentPriorities.${source} must be a finite number.`,
        )
      }
    }
    const thresholds = profile.thresholds
    for (const [name, value] of Object.entries(thresholds ?? {})) {
      if (!Number.isFinite(value) || value < 0) {
        errors.push(
          `behaviorProfiles[${index}].thresholds.${name} must be a non-negative finite number.`,
        )
      }
    }
    if (!Number.isFinite(profile.commitmentSeconds) || profile.commitmentSeconds < 0) {
      errors.push(
        `behaviorProfiles[${index}].commitmentSeconds must be a non-negative finite number.`,
      )
    }
    if (!Number.isFinite(profile.hysteresisPriority) || profile.hysteresisPriority < 0) {
      errors.push(
        `behaviorProfiles[${index}].hysteresisPriority must be a non-negative finite number.`,
      )
    }
  })
  if (profiles.length === 0) {
    errors.push('behaviorProfiles must contain at least one profile.')
  }
}

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

function validateModifiers(
  errors: string[],
  path: string,
  modifiers: readonly StatModifier[] | undefined,
  expectedSourceId?: string,
): void {
  if (!Array.isArray(modifiers)) {
    errors.push(`${path} must be an array when provided.`)
    return
  }
  modifiers.forEach((modifier, index) => {
    if (!modifier || typeof modifier !== 'object') {
      errors.push(`${path}[${index}] must define a modifier object.`)
      return
    }
    if (!isStatKey(modifier.stat)) {
      errors.push(`${path}[${index}].stat is not supported; received "${String(modifier.stat)}".`)
    }
    if (!VALID_MODIFIER_OPERATIONS.has(modifier.operation)) {
      errors.push(
        `${path}[${index}].operation is not supported; received "${String(modifier.operation)}".`,
      )
    }
    validateFiniteNumber(errors, `${path}[${index}].value`, modifier.value, '')
    if (typeof modifier.sourceId !== 'string' || modifier.sourceId.trim() === '') {
      errors.push(`${path}[${index}].sourceId must be a non-empty string.`)
    } else if (expectedSourceId && modifier.sourceId !== expectedSourceId) {
      errors.push(
        `${path}[${index}].sourceId must be "${expectedSourceId}"; received "${modifier.sourceId}".`,
      )
    }
  })
}

function validateEliteModifiers(
  errors: string[],
  modifiers: readonly EliteModifierDefinition[],
): Set<string> {
  const modifierIds = validateIds(errors, 'eliteModifiers', modifiers)
  modifiers.forEach((modifier, index) => {
    if (typeof modifier.name !== 'string' || modifier.name.trim() === '') {
      errors.push(`eliteModifiers[${index}].name must be a non-empty string.`)
    }
    for (const key of [
      'speedMultiplier',
      'radiusMultiplier',
      'maxHpMultiplier',
      'xpRewardMultiplier',
      'gearDropChanceMultiplier',
    ] as const) {
      validateFiniteNumber(
        errors,
        `eliteModifiers[${index}].${key}`,
        modifier[key],
        'positive',
      )
    }
    if (
      typeof modifier.markerColor !== 'string' ||
      modifier.markerColor.trim() === ''
    ) {
      errors.push(`eliteModifiers[${index}].markerColor must be a non-empty string.`)
    }
  })
  return modifierIds
}

function validateDefinitions(
  errors: string[],
  catalog: ContentCatalog,
  skillIds: Set<string>,
  projectileIds: Set<string>,
  enemyIds: Set<string>,
): void {
  catalog.skills.forEach((skill, index) => {
    if (!VALID_SKILL_KINDS.has(skill.kind)) {
      errors.push(`skills[${index}].kind is not supported; received "${String(skill.kind)}".`)
    }
    if (
      !skill.visual ||
      !VALID_SKILL_VISUAL_KINDS.has(skill.visual.kind) ||
      skill.visual.kind !== skill.kind
    ) {
      errors.push(`skills[${index}].visual.kind must match the skill kind.`)
    }
    if (
      !skill.visual ||
      typeof skill.visual.icon !== 'string' ||
      skill.visual.icon.trim() === ''
    ) {
      errors.push(`skills[${index}].visual.icon must be a non-empty string.`)
    }
    for (const property of ['primaryColor', 'secondaryColor', 'outlineColor'] as const) {
      if (
        !skill.visual ||
        typeof skill.visual[property] !== 'string' ||
        skill.visual[property].trim() === ''
      ) {
        errors.push(`skills[${index}].visual.${property} must be a non-empty string.`)
      }
    }
    validateFiniteNumber(errors, `skills[${index}].cooldown`, skill.cooldown, 'positive')
    validateFiniteNumber(errors, `skills[${index}].baseDamage`, skill.baseDamage, 'non-negative')
    if (
      !Array.isArray(skill.tags) ||
      skill.tags.length === 0 ||
      skill.tags.some((tag) => !VALID_SKILL_TAGS.has(tag))
    ) {
      errors.push(`skills[${index}].tags must contain supported skill tags.`)
    }
    validateFiniteNumber(
      errors,
      `skills[${index}].damagePerLevel`,
      skill.damagePerLevel,
      'non-negative',
    )
    validateFiniteNumber(
      errors,
      `skills[${index}].effectLifetime`,
      skill.effectLifetime,
      'positive',
    )
    if (skill.kind === 'area') {
      validateFiniteNumber(errors, `skills[${index}].radius`, skill.radius ?? Number.NaN, 'positive')
    }
    if (skill.kind === 'chain') {
      validateFiniteNumber(errors, `skills[${index}].maxRange`, skill.maxRange ?? Number.NaN, 'positive')
      validateFiniteNumber(errors, `skills[${index}].jumpRange`, skill.jumpRange ?? Number.NaN, 'positive')
      validateFiniteNumber(
        errors,
        `skills[${index}].maxTargets`,
        skill.maxTargets ?? Number.NaN,
        'integer-positive',
      )
    }
    if (
      skill.kind === 'projectile' &&
      (!skill.projectileDefinitionId ||
        !projectileIds.has(skill.projectileDefinitionId))
    ) {
      errors.push(`skills[${index}].projectileDefinitionId must reference a projectile.`)
    }
  })

  catalog.enemies.forEach((enemy, index) => {
    if (typeof enemy.name !== 'string' || enemy.name.trim() === '') {
      errors.push(`enemies[${index}].name must be a non-empty string.`)
    }
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
    validateFiniteNumber(
      errors,
      `enemies[${index}].gearDropChance`,
      enemy.gearDropChance,
      'non-negative',
    )
    if (enemy.gearDropChance > 1) {
      errors.push(`enemies[${index}].gearDropChance must be at most 1.`)
    }

    if (!enemy.behavior || !VALID_ENEMY_BEHAVIORS.has(enemy.behavior.kind)) {
      errors.push(
        `enemies[${index}].behavior.kind is not supported; received "${String(enemy.behavior?.kind)}".`,
      )
    } else if (enemy.behavior.kind === 'standoff') {
      validateFiniteNumber(
        errors,
        `enemies[${index}].behavior.desiredDistance`,
        enemy.behavior.desiredDistance,
        'positive',
      )
      validateFiniteNumber(
        errors,
        `enemies[${index}].behavior.retreatDistance`,
        enemy.behavior.retreatDistance,
        'positive',
      )
      if (enemy.behavior.retreatDistance >= enemy.behavior.desiredDistance) {
        errors.push(
          `enemies[${index}].behavior.retreatDistance must be less than desiredDistance.`,
        )
      }
    } else if (enemy.behavior.kind === 'split') {
      const split = enemy.behavior.split
      const child = split
        ? catalog.enemies.find(
            (candidate) => candidate.id === split.childDefinitionId,
          )
        : undefined
      if (!split || !child || !enemyIds.has(split.childDefinitionId)) {
        errors.push(
          `enemies[${index}].behavior.split.childDefinitionId must reference an enemy.`,
        )
      } else if (child.radius >= enemy.radius) {
        errors.push(
          `enemies[${index}].behavior.split child enemy must be smaller than its parent.`,
        )
      }
      validateFiniteNumber(
        errors,
        `enemies[${index}].behavior.split.childCount`,
        split?.childCount ?? Number.NaN,
        'integer-positive',
      )
      validateFiniteNumber(
        errors,
        `enemies[${index}].behavior.split.spreadRadius`,
        split?.spreadRadius ?? Number.NaN,
        'non-negative',
      )
      if (typeof split?.childrenAwardXp !== 'boolean') {
        errors.push(
          `enemies[${index}].behavior.split.childrenAwardXp must be a boolean.`,
        )
      }
    }
    if (
      !enemy.render ||
      typeof enemy.render.color !== 'string' ||
      enemy.render.color.trim() === ''
    ) {
      errors.push(`enemies[${index}].render.color must be a non-empty string.`)
    }
    if (
      !enemy.render ||
      typeof enemy.render.outlineColor !== 'string' ||
      enemy.render.outlineColor.trim() === ''
    ) {
      errors.push(
        `enemies[${index}].render.outlineColor must be a non-empty string.`,
      )
    }
    if (!enemy.render || !VALID_ENEMY_SHAPES.has(enemy.render.shape)) {
      errors.push(
        `enemies[${index}].render.shape is not supported; received "${String(enemy.render?.shape)}".`,
      )
    }
    validateFiniteNumber(
      errors,
      `enemies[${index}].render.scale`,
      enemy.render?.scale ?? Number.NaN,
      'positive',
    )
  })

  catalog.projectiles.forEach((projectile, index) => {
    validateFiniteNumber(errors, `projectiles[${index}].speed`, projectile.speed, 'non-negative')
    validateFiniteNumber(errors, `projectiles[${index}].radius`, projectile.radius, 'positive')
    validateFiniteNumber(errors, `projectiles[${index}].lifetime`, projectile.lifetime, 'positive')
  })

  catalog.items.forEach((item, index) => {
    if (typeof item.name !== 'string' || item.name.trim() === '') {
      errors.push(`items[${index}].name must be a non-empty string.`)
    }
    if (!isRarity(item.rarity)) {
      errors.push(`items[${index}].rarity is not supported; received "${String(item.rarity)}".`)
    }
    if (!EQUIPMENT_SLOTS.includes(item.slot)) {
      errors.push(`items[${index}].slot is not supported; received "${String(item.slot)}".`)
    }
    if (!Array.isArray(item.modifiers) || item.modifiers.length === 0) {
      errors.push(`items[${index}].modifiers must contain at least one modifier.`)
    }
    validateModifiers(
      errors,
      `items[${index}].modifiers`,
      item.modifiers,
      typeof item.id === 'string' ? `item:${item.id}` : undefined,
    )
  })

  catalog.upgrades.forEach((upgrade, index) => {
    validateFiniteNumber(errors, `upgrades[${index}].amount`, upgrade.amount, 'positive')
    if (upgrade.dodgeReactionTimeReduction !== undefined) {
      validateFiniteNumber(
        errors,
        `upgrades[${index}].dodgeReactionTimeReduction`,
        upgrade.dodgeReactionTimeReduction,
        'positive',
      )
    }
    if (typeof upgrade.isEligible !== 'function') {
      errors.push(`upgrades[${index}].isEligible must be a function.`)
    }
    if (!isRarity(upgrade.rarity)) {
      errors.push(
        `upgrades[${index}].rarity is not supported; received "${String(upgrade.rarity)}".`,
      )
    }
    if (upgrade.modifiers) {
      validateModifiers(errors, `upgrades[${index}].modifiers`, upgrade.modifiers)
    }
    if (
      upgrade.category === 'passive' &&
      (upgrade.stat === undefined || !VALID_UPGRADE_STATS.has(upgrade.stat))
    ) {
      errors.push(
        `upgrades[${index}].stat must reference a supported player stat; received "${String(upgrade.stat)}".`,
      )
    }

    if (
      !VALID_UPGRADE_CATEGORIES.has(upgrade.category)
    ) {
      errors.push(`upgrades[${index}].category is not supported; received "${String(upgrade.category)}".`)
    }
    if (
      upgrade.category === 'skill' &&
      (!upgrade.skillId ||
        !skillIds.has(upgrade.skillId) ||
        !upgrade.skillAction ||
        !VALID_SKILL_ACTIONS.has(upgrade.skillAction))
    ) {
      errors.push(`upgrades[${index}] must define a known skillId and skillAction.`)
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
  eliteModifierIds: Set<string>,
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
    'spawnBalance.eliteChance',
    balance.eliteChance,
    'non-negative',
  )
  if (balance.eliteChance > 1) {
    errors.push('spawnBalance.eliteChance must be at most 1.')
  }
  validateFiniteNumber(
    errors,
    'spawnBalance.eliteStartTimeSeconds',
    balance.eliteStartTimeSeconds,
    'non-negative',
  )
  const eliteWeights = balance.eliteModifierWeights ?? {}
  let positiveEliteWeight = false
  for (const [modifierId, weight] of Object.entries(eliteWeights)) {
    if (!eliteModifierIds.has(modifierId)) {
      errors.push(
        `spawnBalance.eliteModifierWeights.${modifierId} references unknown elite modifier.`,
      )
    }
    validateFiniteNumber(
      errors,
      `spawnBalance.eliteModifierWeights.${modifierId}`,
      weight,
      'non-negative',
    )
    if (weight > 0) {
      positiveEliteWeight = true
    }
  }
  if (!positiveEliteWeight) {
    errors.push(
      'spawnBalance.eliteModifierWeights must contain at least one positive weight.',
    )
  }
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
    if (entry.startTimeSeconds !== undefined) {
      validateFiniteNumber(
        errors,
        `spawnBalance.spawnEntries[${index}].startTimeSeconds`,
        entry.startTimeSeconds,
        'non-negative',
      )
    }
  })
}

export function validateContent(catalog: ContentCatalog): string[] {
  const errors: string[] = [
    ...validateRarityWeights(RARITY_WEIGHTS),
    ...validateGearDropChances(GEAR_DROP_CHANCES),
    ...validateGearPickupBalance(GEAR_PICKUP_BALANCE),
  ]
  const enemyIds = validateIds(errors, 'enemies', catalog.enemies)
  const eliteModifierIds = validateEliteModifiers(
    errors,
    catalog.eliteModifiers ?? [],
  )
  const projectileIds = validateIds(errors, 'projectiles', catalog.projectiles)
  const skillIds = validateIds(errors, 'skills', catalog.skills)
  const bossIds = validateIds(errors, 'bosses', catalog.bosses)
  const bossSkillIds = validateIds(errors, 'bossSkills', catalog.bossSkills)
  validateIds(errors, 'encounters', catalog.encounters)
  validateBehaviorProfiles(errors, catalog.behaviorProfiles ?? [])
  const upgradeIds = validateIds(errors, 'upgrades', catalog.upgrades)
  validateIds(errors, 'items', catalog.items)

  catalog.items.forEach((item, index) => {
    if (typeof item.id === 'string' && !isItemId(item.id)) {
      errors.push(
        `items[${index}].id must use lowercase ASCII letters, numbers, and hyphens; received "${item.id}".`,
      )
    }
  })
  if (new Set(EQUIPMENT_SLOTS).size !== EQUIPMENT_SLOTS.length) {
    errors.push('equipment slots must be unique.')
  }

  validateDefinitions(errors, catalog, skillIds, projectileIds, enemyIds)
  catalog.bosses.forEach((boss, index) => {
    validateFiniteNumber(errors, `bosses[${index}].radius`, boss.radius, 'positive')
    validateFiniteNumber(errors, `bosses[${index}].maxHp`, boss.maxHp, 'positive')
    validateFiniteNumber(errors, `bosses[${index}].speed`, boss.speed, 'non-negative')
    validateFiniteNumber(
      errors,
      `bosses[${index}].contactDamage`,
      boss.contactDamage,
      'non-negative',
    )
    if (!boss.skills.every((skillId) => bossSkillIds.has(skillId))) {
      errors.push(`bosses[${index}].skills must reference known boss skills.`)
    }
  })
  catalog.bossSkills.forEach((skill, index) => {
    validateFiniteNumber(errors, `bossSkills[${index}].cooldown`, skill.cooldown, 'positive')
    validateFiniteNumber(
      errors,
      `bossSkills[${index}].telegraphDuration`,
      skill.telegraphDuration,
      'positive',
    )
    validateFiniteNumber(errors, `bossSkills[${index}].damage`, skill.damage, 'non-negative')
    validateFiniteNumber(errors, `bossSkills[${index}].radius`, skill.radius, 'positive')
  })
  catalog.encounters.forEach((encounter, index) => {
    validateFiniteNumber(
      errors,
      `encounters[${index}].timeSeconds`,
      encounter.timeSeconds,
      'non-negative',
    )
    if (!bossIds.has(encounter.bossDefinitionId)) {
      errors.push(
        `encounters[${index}].bossDefinitionId references unknown boss "${encounter.bossDefinitionId}".`,
      )
    }
    if (encounter.type !== 'boss') {
      errors.push(`encounters[${index}].type is not supported; received "${String(encounter.type)}".`)
    }
  })
  validateXpBalance(errors, catalog.xpBalance)
  validateSpawnBalance(
    errors,
    catalog.spawnBalance,
    enemyIds,
    eliteModifierIds,
  )

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
  const eligibilityState = {
    playerLevel: 1,
    selectedUpgradeIds: [] as const,
    ownedSkillIds: ['basic-bolt'] as const,
    skillLevels: { 'basic-bolt': 1 },
  }
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

  // Check the other meaningful boundary as well: a completed skill set must
  // still leave enough repeatable choices for the level-up UI.
  const fullyOwnedState = {
    playerLevel: 2,
    selectedUpgradeIds: [] as const,
    ownedSkillIds: catalog.skills.map((skill) => skill.id),
    skillLevels: Object.fromEntries(catalog.skills.map((skill) => [skill.id, 1])),
  }
  const fullyOwnedEligibleCount = catalog.upgrades.filter((upgrade) => {
    try {
      return upgrade.isEligible(fullyOwnedState)
    } catch {
      return false
    }
  }).length
  if (
    Number.isInteger(catalog.upgradeChoicesPerLevel) &&
    catalog.upgradeChoicesPerLevel > 0 &&
    fullyOwnedEligibleCount < catalog.upgradeChoicesPerLevel
  ) {
    errors.push(
      `upgradeChoicesPerLevel (${catalog.upgradeChoicesPerLevel}) exceeds the ${fullyOwnedEligibleCount} upgrades eligible with all skills owned.`,
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
