import { Graphics } from 'pixi.js'
import type { ProjectileState, SkillEffectState, TelegraphState } from '../../game/state/GameState'
import {
  BASIC_ATTACK_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  getBasicAttackVariant,
  getSkillDefinition,
  isSkillId,
  MIRRORCAST_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
  PRISM_HALO_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  SIGIL_OF_RUIN_SKILL_ID,
  VITALITY_SKILL_ID,
} from '../../content/skills/Skills'
import { createPolygonPoints, createStarPoints } from './geometry'
import type { DamageType } from '../../content/stats/Damage'
import type { RenderPoint } from './views'

/**
 * Graphics for projectiles, summons, and the self-contained skill effects.
 *
 * As with the entity graphics, these read only their arguments so they can be
 * exercised without an Application or a running game.
 */

export function createEnemyArrowProjectile(projectile: ProjectileState): Graphics {
  const radius = projectile.radius
  const shaftLength = radius * 4.8
  return new Graphics()
    .moveTo(-shaftLength * 0.9, 0)
    .lineTo(shaftLength * 0.5, 0)
    .stroke({ color: '#450a0a', width: 7, alpha: 0.82 })
    .moveTo(-shaftLength * 0.9, 0)
    .lineTo(shaftLength * 0.5, 0)
    .stroke({ color: '#fecdd3', width: 2, alpha: 0.92 })
    .poly([
      shaftLength * 0.9,
      0,
      shaftLength * 0.4,
      -radius * 1.4,
      shaftLength * 0.4,
      radius * 1.4,
    ])
    .fill({ color: '#dc2626', alpha: 0.94 })
    .stroke({ color: '#fee2e2', width: 1.5 })
    .poly([
      -shaftLength * 0.9,
      0,
      -shaftLength * 1.25,
      -radius * 1.1,
      -shaftLength * 0.98,
      0,
      -shaftLength * 1.25,
      radius * 1.1,
    ])
    .fill({ color: '#fb7185', alpha: 0.78 })
    .stroke({ color: '#fecdd3', width: 1 })
}

export function createBoneBoltPlaceholder(effect: SkillEffectState): Graphics {
  const visual = getSkillDefinition(RAISE_SKELETON_SKILL_ID).visual
  const points = effect.points.length > 0
    ? effect.points
    : [{ x: effect.x, y: effect.y }]
  const start = points[0]
  const end = points[points.length - 1]
  const view = new Graphics()
  if (!start || !end) {
    return view
  }
  const startX = start.x - effect.x
  const startY = start.y - effect.y
  const endX = end.x - effect.x
  const endY = end.y - effect.y
  const directionX = endX - startX
  const directionY = endY - startY
  const length = Math.hypot(directionX, directionY) || 1
  const normalX = -directionY / length
  const normalY = directionX / length
  view
    .moveTo(startX, startY)
    .lineTo(endX, endY)
    .stroke({ color: visual.primaryColor, width: 7, alpha: 0.16 })
    .moveTo(startX, startY)
    .lineTo(endX, endY)
    .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.9 })
  const boneCount = Math.max(2, Math.min(6, Math.floor(length / 30)))
  for (let index = 1; index <= boneCount; index += 1) {
    const progress = index / (boneCount + 1)
    const centerX = startX + directionX * progress
    const centerY = startY + directionY * progress
    view
      .moveTo(centerX - normalX * 5, centerY - normalY * 5)
      .lineTo(centerX + normalX * 5, centerY + normalY * 5)
      .stroke({ color: visual.outlineColor, width: 2, alpha: 0.85 })
  }
  return view
}

export function createVitalityPlaceholder(effect: SkillEffectState): Graphics {
  const visual = getSkillDefinition(VITALITY_SKILL_ID).visual
  const radius = Math.max(1, effect.radius)
  const view = new Graphics()
    .poly(createPolygonPoints(radius, 8, Math.PI / 8))
    .fill({ color: visual.primaryColor, alpha: 0.12 })
    .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.7 })
    .poly([
      0, -radius * 0.52,
      radius * 0.4, -radius * 0.18,
      0, radius * 0.66,
      -radius * 0.4, -radius * 0.18,
    ])
    .fill({ color: visual.primaryColor, alpha: 0.62 })
    .stroke({ color: visual.outlineColor, width: 2, alpha: 0.92 })
    .moveTo(0, -radius * 0.36)
    .lineTo(0, radius * 0.42)
    .moveTo(-radius * 0.25, 0)
    .lineTo(radius * 0.25, 0)
    .stroke({ color: visual.outlineColor, width: 2, alpha: 0.9 })
  for (let index = 0; index < 4; index += 1) {
    const angle = (Math.PI / 2) * index
    const x = Math.cos(angle) * radius * 0.82
    const y = Math.sin(angle) * radius * 0.82
    view
      .poly([
        x,
        y - 5,
        x + Math.cos(angle) * 8,
        y + Math.sin(angle) * 8,
        x + Math.sin(angle) * 5,
        y - Math.cos(angle) * 5,
      ])
      .fill({ color: visual.secondaryColor, alpha: 0.68 })
  }
  return view
}

export function createSkeletonRitualPlaceholder(effect: SkillEffectState): Graphics {
  const visual = getSkillDefinition(RAISE_SKELETON_SKILL_ID).visual
  const radius = Math.max(1, effect.radius)
  return new Graphics()
    .poly(createPolygonPoints(radius, 8, Math.PI / 8))
    .fill({ color: visual.primaryColor, alpha: 0.1 })
    .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.76 })
    .poly([
      -radius * 0.3, -radius * 0.18,
      -radius * 0.3, radius * 0.24,
      -radius * 0.12, radius * 0.4,
      radius * 0.12, radius * 0.4,
      radius * 0.3, radius * 0.24,
      radius * 0.3, -radius * 0.18,
      radius * 0.12, -radius * 0.4,
      -radius * 0.12, -radius * 0.4,
    ])
    .fill({ color: visual.primaryColor, alpha: 0.65 })
    .stroke({ color: visual.outlineColor, width: 2, alpha: 0.92 })
    .circle(-radius * 0.12, -radius * 0.1, 2.5)
    .fill(visual.outlineColor)
    .circle(radius * 0.12, -radius * 0.1, 2.5)
    .fill(visual.outlineColor)
    .moveTo(-radius * 0.2, radius * 0.18)
    .lineTo(radius * 0.2, radius * 0.18)
    .stroke({ color: visual.outlineColor, width: 2 })
}

export function createBloodPulsePlaceholder(effect: SkillEffectState): Graphics {
  const visual = getSkillDefinition(BLOOD_RITE_SKILL_ID).visual
  const radius = Math.max(1, effect.radius)
  const view = new Graphics()
    .poly(createStarPoints(radius, 16, 0.5))
    .fill({ color: visual.primaryColor, alpha: 0.26 })
    .stroke({ color: visual.outlineColor, width: 3, alpha: 0.88 })
    .poly(createPolygonPoints(radius * 0.58, 8, Math.PI / 8))
    .fill({ color: visual.secondaryColor, alpha: 0.38 })
    .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.8 })
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8
    view
      .moveTo(Math.cos(angle) * radius * 0.26, Math.sin(angle) * radius * 0.26)
      .lineTo(Math.cos(angle) * radius * 0.82, Math.sin(angle) * radius * 0.82)
      .stroke({ color: visual.outlineColor, width: 1.5, alpha: 0.58 })
  }
  return view
}

export function createSigilCastPlaceholder(effect: SkillEffectState): Graphics {
  const visual = getSkillDefinition(SIGIL_OF_RUIN_SKILL_ID).visual
  const radius = Math.max(1, effect.radius)
  const view = new Graphics()
    .poly(createPolygonPoints(radius, 6, -Math.PI / 2))
    .fill({ color: visual.primaryColor, alpha: 0.2 })
    .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.82 })
    .poly(createPolygonPoints(radius * 0.62, 3, -Math.PI / 2))
    .fill({ color: visual.secondaryColor, alpha: 0.18 })
    .stroke({ color: visual.outlineColor, width: 2, alpha: 0.86 })
  for (let index = 0; index < 3; index += 1) {
    const angle = (Math.PI * 2 * index) / 3 - Math.PI / 2
    view
      .moveTo(Math.cos(angle) * radius * 0.18, Math.sin(angle) * radius * 0.18)
      .lineTo(Math.cos(angle) * radius * 0.82, Math.sin(angle) * radius * 0.82)
      .stroke({ color: visual.outlineColor, width: 1.5, alpha: 0.72 })
  }
  return view
}

export function createMirrorcastCastPlaceholder(effect: SkillEffectState): Graphics {
  const visual = getSkillDefinition(MIRRORCAST_SKILL_ID).visual
  const radius = Math.max(1, effect.radius)
  const view = new Graphics()
    .poly(createPolygonPoints(radius, 4, Math.PI / 4))
    .fill({ color: visual.primaryColor, alpha: 0.18 })
    .stroke({ color: visual.outlineColor, width: 2, alpha: 0.9 })
    .poly(createPolygonPoints(radius * 0.54, 4, 0))
    .fill({ color: visual.secondaryColor, alpha: 0.34 })
    .stroke({ color: visual.outlineColor, width: 1.5, alpha: 0.82 })
  for (let index = 0; index < 4; index += 1) {
    const angle = (Math.PI / 2) * index + Math.PI / 4
    view
      .moveTo(Math.cos(angle) * radius * 0.65, Math.sin(angle) * radius * 0.65)
      .lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
      .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.72 })
  }
  return view
}

export function createImpactParticlePlaceholder(effect: SkillEffectState): Graphics {
  const visual = effect.skillId === BASIC_ATTACK_SKILL_ID
    ? getBasicAttackVariant(effect.basicAttackWeaponArchetype).visual
    : getSkillDefinition(effect.skillId).visual
  const points = effect.points.length > 0
    ? effect.points
    : [{ x: effect.x, y: effect.y }]
  const arcPoints = effect.shape === 'arc' ? points.slice(1) : points
  const fallbackImpact = effect.impactPoint ?? arcPoints[Math.floor(arcPoints.length / 2)] ??
    arcPoints[arcPoints.length - 1] ??
    points[0]
  const impactPoints = effect.impactPoints?.length
    ? effect.impactPoints
    : fallbackImpact
      ? [fallbackImpact]
      : []
  const radius = Math.max(8, Math.min(46, effect.radius * 0.28))
  const view = new Graphics()
  for (const [pointIndex, impact] of impactPoints.entries()) {
    const impactX = impact.x - effect.x
    const impactY = impact.y - effect.y
    const particleCount = impactPoints.length > 1 ? 6 : 9
    for (let index = 0; index < particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / particleCount +
        (effect.id % 7) * 0.11 + pointIndex * 0.19
      const distance = radius * (0.72 + (index % 3) * 0.18)
      const size = 2 + (index % 2)
      const x = impactX + Math.cos(angle) * distance
      const y = impactY + Math.sin(angle) * distance
      view
        .poly([
          x + Math.cos(angle) * size * 2.6,
          y + Math.sin(angle) * size * 2.6,
          x + Math.cos(angle + 2.1) * size,
          y + Math.sin(angle + 2.1) * size,
          x + Math.cos(angle - 2.1) * size,
          y + Math.sin(angle - 2.1) * size,
        ])
        .fill({ color: index % 2 === 0 ? visual.secondaryColor : visual.primaryColor, alpha: 0.85 })
        .stroke({ color: visual.outlineColor, width: 1, alpha: 0.72 })
    }
  }
  return view
}

export function createPhantomSummonPlaceholder(effect: SkillEffectState): Graphics {
  const visual = getSkillDefinition(PHANTOM_ARSENAL_SKILL_ID).visual
  const radius = Math.max(1, effect.radius)
  const view = new Graphics()
    .poly(createPolygonPoints(radius, 6, -Math.PI / 2))
    .fill({ color: visual.primaryColor, alpha: 0.12 })
    .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.72 })
    .poly([
      -radius * 0.42, radius * 0.26,
      -radius * 0.22, -radius * 0.38,
      0, -radius * 0.62,
      radius * 0.22, -radius * 0.38,
      radius * 0.42, radius * 0.26,
      radius * 0.18, radius * 0.52,
      -radius * 0.18, radius * 0.52,
    ])
    .fill({ color: visual.primaryColor, alpha: 0.5 })
    .stroke({ color: visual.outlineColor, width: 2, alpha: 0.88 })
    .moveTo(-radius * 0.2, -radius * 0.06)
    .lineTo(radius * 0.2, -radius * 0.06)
    .moveTo(0, -radius * 0.24)
    .lineTo(0, radius * 0.3)
    .stroke({ color: visual.outlineColor, width: 2, alpha: 0.82 })
  return view
}

export function createPrismBeamPlaceholder(effect: SkillEffectState): Graphics {
  const visual = getSkillDefinition(PRISM_HALO_SKILL_ID).visual
  const points = effect.points.length > 0
    ? effect.points
    : [{ x: effect.x, y: effect.y }]
  const start = points[0]
  const end = points[points.length - 1]
  const view = new Graphics()
  if (!start || !end) {
    return view
  }

  const startX = start.x - effect.x
  const startY = start.y - effect.y
  const endX = end.x - effect.x
  const endY = end.y - effect.y
  const length = Math.hypot(endX - startX, endY - startY)
  if (length <= 0) {
    return view
  }

  const directionX = (endX - startX) / length
  const directionY = (endY - startY) / length
  const perpendicularX = -directionY
  const perpendicularY = directionX
  const beamColors = effect.prismBeamElement === 'all'
    ? (['#f97316', '#38bdf8', '#fef08a'] as const)
    : effect.prismBeamElement === 'fire'
      ? (['#f97316'] as const)
      : effect.prismBeamElement === 'cold'
        ? (['#38bdf8'] as const)
        : (['#fef08a'] as const)

  const facetCount = Math.max(3, Math.min(8, Math.floor(length / 46)))
  const facetHalfWidth = effect.prismBeamElement === 'all' ? 9 : 7

  // Prism Halo is built from angular facets and a refracting core, not a
  // tether-like line with circular nodes.
  view
    .moveTo(startX, startY)
    .lineTo(endX, endY)
    .stroke({ color: visual.outlineColor, width: 24, alpha: 0.12 })
    .moveTo(startX, startY)
    .lineTo(endX, endY)
    .stroke({ color: visual.primaryColor, width: 13, alpha: 0.16 })

  for (let index = 0; index < facetCount; index += 1) {
    const startProgress = index / facetCount
    const endProgress = (index + 1) / facetCount
    const centerProgress = (startProgress + endProgress) / 2
    const facetStartX = startX + (endX - startX) * startProgress
    const facetStartY = startY + (endY - startY) * startProgress
    const facetEndX = startX + (endX - startX) * endProgress
    const facetEndY = startY + (endY - startY) * endProgress
    const centerX = startX + (endX - startX) * centerProgress
    const centerY = startY + (endY - startY) * centerProgress
    const width = facetHalfWidth * (index % 2 === 0 ? 1 : 0.72)
    const color = beamColors[index % beamColors.length]!
    const leftStartX = facetStartX + perpendicularX * width
    const leftStartY = facetStartY + perpendicularY * width
    const rightStartX = facetStartX - perpendicularX * width
    const rightStartY = facetStartY - perpendicularY * width
    const leftEndX = facetEndX + perpendicularX * width
    const leftEndY = facetEndY + perpendicularY * width
    const rightEndX = facetEndX - perpendicularX * width
    const rightEndY = facetEndY - perpendicularY * width

    view
      .poly([
        leftStartX, leftStartY,
        centerX, centerY - perpendicularY * width * 0.68,
        leftEndX, leftEndY,
        rightEndX, rightEndY,
        centerX, centerY + perpendicularY * width * 0.68,
        rightStartX, rightStartY,
      ])
      .fill({ color, alpha: effect.prismBeamElement === 'all' ? 0.52 : 0.62 })
      .stroke({ color: visual.outlineColor, width: 1.5, alpha: 0.82 })
      .moveTo(leftStartX, leftStartY)
      .lineTo(rightEndX, rightEndY)
      .stroke({ color: visual.outlineColor, width: 1, alpha: 0.55 })
  }

  const corePoints: number[] = [startX, startY]
  for (let index = 1; index < facetCount; index += 1) {
    const progress = index / facetCount
    const offset = index % 2 === 0 ? -2.5 : 2.5
    corePoints.push(
      startX + (endX - startX) * progress + perpendicularX * offset,
      startY + (endY - startY) * progress + perpendicularY * offset,
    )
  }
  corePoints.push(endX, endY)
  view
    .poly(corePoints)
    .stroke({ color: visual.outlineColor, width: 2, alpha: 0.95 })

  const crestLength = Math.min(24, Math.max(12, length * 0.1))
  const crestX = endX - directionX * crestLength
  const crestY = endY - directionY * crestLength
  view
    .moveTo(crestX + perpendicularX * 10, crestY + perpendicularY * 10)
    .lineTo(endX, endY)
    .lineTo(crestX - perpendicularX * 10, crestY - perpendicularY * 10)
    .lineTo(
      crestX - directionX * crestLength * 0.34,
      crestY - directionY * crestLength * 0.34,
    )
    .closePath()
    .fill({ color: beamColors[beamColors.length - 1]!, alpha: 0.7 })
    .stroke({ color: visual.outlineColor, width: 2, alpha: 0.9 })

  const apertureSize = effect.prismBeamElement === 'all' ? 15 : 12
  for (let endpointIndex = 0; endpointIndex < 2; endpointIndex += 1) {
    const point = endpointIndex === 0 ? start : end
    const pointX = point.x - effect.x
    const pointY = point.y - effect.y
    const aperturePoints: number[] = []
    for (let index = 0; index < 6; index += 1) {
      const angle = Math.atan2(directionY, directionX) +
        (Math.PI / 3) * index
      aperturePoints.push(
        pointX + Math.cos(angle) * apertureSize,
        pointY + Math.sin(angle) * apertureSize,
      )
    }
    view
      .poly(aperturePoints)
      .fill({ color: beamColors[endpointIndex % beamColors.length]!, alpha: 0.16 })
      .stroke({ color: visual.outlineColor, width: 2, alpha: 0.9 })
  }

  return view
}

export function drawProjectileTrail(
  view: Graphics,
  projectile: ProjectileState,
  history: readonly RenderPoint[],
): void {
  view.clear()
  if (history.length < 2) {
    return
  }
  const visual = projectile.sourceAbilityId
    ? {
        primaryColor: '#ef4444',
        secondaryColor: '#fb7185',
        outlineColor: '#fee2e2',
      }
    : projectile.skillId === BASIC_ATTACK_SKILL_ID
      ? getBasicAttackVariant(projectile.basicAttackWeaponArchetype).visual
      : projectile.skillId && isSkillId(projectile.skillId)
        ? getSkillDefinition(projectile.skillId).visual
        : getSkillDefinition(BASIC_ATTACK_SKILL_ID).visual
  if (projectile.skillId === CHAIN_LIGHTNING_SKILL_ID) {
    const drawElectricalSegment = (
      previous: RenderPoint,
      point: RenderPoint,
      index: number,
      color: string,
      maximumWidth: number,
      alpha: number,
      zigZagAmplitude: number,
    ): void => {
      const segmentX = point.x - previous.x
      const segmentY = point.y - previous.y
      const segmentLength = Math.hypot(segmentX, segmentY) || 1
      const amplitude = Math.min(zigZagAmplitude, segmentLength * 0.38)
      const direction = (index + projectile.id) % 2 === 0 ? 1 : -1
      const progress = index / (history.length - 1)
      view
        .moveTo(previous.x, previous.y)
        .lineTo(
          (previous.x + point.x) / 2 - (segmentY / segmentLength) * amplitude * direction,
          (previous.y + point.y) / 2 + (segmentX / segmentLength) * amplitude * direction,
        )
        .lineTo(point.x, point.y)
        .stroke({
          color,
          width: Math.max(1, maximumWidth * (0.35 + progress * 0.65)),
          alpha: alpha * (0.08 + progress * 0.92),
        })
    }
    for (let index = 1; index < history.length; index += 1) {
      const previous = history[index - 1]!
      const point = history[index]!
      drawElectricalSegment(
        previous,
        point,
        index,
        '#0891b2',
        projectile.radius * 4.4,
        0.12,
        5,
      )
      drawElectricalSegment(
        previous,
        point,
        index,
        visual.primaryColor,
        projectile.radius * 2,
        0.38,
        4,
      )
      drawElectricalSegment(previous, point, index, '#fefce8', 2.2, 0.92, 3)
    }
    return
  }
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1]!
    const point = history[index]!
    const progress = index / history.length
    view
      .moveTo(previous.x, previous.y)
      .lineTo(point.x, point.y)
      .stroke({
        color: projectile.mendingReturn
          ? '#fef08a'
          : projectile.echoWell
            ? '#c084fc'
          : index % 2 === 0
            ? visual.primaryColor
            : visual.secondaryColor,
        width: Math.max(1, projectile.radius * (0.45 + progress * 0.7)),
        alpha: progress * 0.46,
      })
  }
}

export function drawTelegraphLine(
  view: Graphics,
  telegraph: TelegraphState,
  palette: TelegraphPalette,
): void {
  const { color, lightColor } = palette
  view.clear()
  const start = telegraph.points[0]
  if (!start) {
    return
  }
  const drawPath = (): void => {
    view.moveTo(start.x - telegraph.x, start.y - telegraph.y)
    for (const point of telegraph.points.slice(1)) {
      view.lineTo(point.x - telegraph.x, point.y - telegraph.y)
    }
  }
  drawPath()
  view.stroke({
    color: palette.darkColor,
    width: telegraph.radius * 2 + 10,
    alpha: 0.82,
  })
  drawPath()
  view.stroke({
    color: HOSTILE_TELEGRAPH_RIM,
    width: telegraph.radius * 2 + 5,
    alpha: 0.95,
  })
  drawPath()
  view.stroke({ color, width: telegraph.radius * 2, alpha: 0.26 })
  drawPath()
  view.stroke({ color: lightColor, width: 4, alpha: 0.9 })

  const end = telegraph.points[telegraph.points.length - 1]
  if (!end) {
    return
  }
  const endX = end.x - telegraph.x
  const endY = end.y - telegraph.y
  const previous = telegraph.points[telegraph.points.length - 2] ?? start
  const directionX = end.x - previous.x
  const directionY = end.y - previous.y
  const length = Math.hypot(directionX, directionY) || 1
  const normalX = -directionY / length
  const normalY = directionX / length
  const arrowSize = Math.max(10, telegraph.radius * 0.8)
  view
    .poly([
      endX,
      endY,
      endX - directionX / length * arrowSize + normalX * arrowSize * 0.6,
      endY - directionY / length * arrowSize + normalY * arrowSize * 0.6,
      endX - directionX / length * arrowSize - normalX * arrowSize * 0.6,
      endY - directionY / length * arrowSize - normalY * arrowSize * 0.6,
    ])
    .fill(lightColor)
    .stroke({ color, width: 1 })
}

/**
 * The one colour that means "this is aimed at you".
 *
 * Telegraphs used to be red and nothing else, which said that much and no
 * more: a freezing cone and a meteor read identically. Colouring them by damage
 * school fixed that and broke this - a cold warning came out the same cyan as
 * the player's own Glacial Orb, and a chaos one the same violet as Sigil of
 * Ruin, so the thing that hurts you and the thing you cast looked alike.
 *
 * Both are wanted, so they are carried by different parts of the shape. The
 * interior is the damage school, which is also what the hit is resisted as. The
 * rim is this, on every hostile warning and nothing else: a red edge means
 * incoming, and the colour inside it says what kind.
 *
 * Nothing the player owns may use it. `effectGraphics.test.ts` fails if a skill
 * takes this colour, because the rule only works while it is exclusive.
 */
export const HOSTILE_TELEGRAPH_RIM = '#f43f5e'

/**
 * The palette a telegraph is drawn in.
 *
 * Colour follows the damage school, which is also what the hit will be resisted
 * as - and the halo behind the shape follows it too, because a dark red rim
 * around a grey wedge read as a rendering fault rather than as a shadow.
 */
export interface TelegraphPalette {
  /** The area's own colour, laid over the ground at low alpha. */
  color: string
  /** The bright edge that says exactly where the danger stops. */
  lightColor: string
  /** The shadow that lifts the whole shape off the floor. */
  darkColor: string
}

const TELEGRAPH_PALETTES = {
  physical: { color: '#d6d3d1', lightColor: '#fafaf9', darkColor: '#1c1917' },
  fire: { color: '#ea580c', lightColor: '#fed7aa', darkColor: '#450a0a' },
  cold: { color: '#22d3ee', lightColor: '#cffafe', darkColor: '#083344' },
  lightning: { color: '#eab308', lightColor: '#fef3c7', darkColor: '#422006' },
  chaos: { color: '#a855f7', lightColor: '#f5d0fe', darkColor: '#3b0764' },
} as const satisfies Record<DamageType, TelegraphPalette>

const UNKNOWN_TELEGRAPH_PALETTE: TelegraphPalette = {
  color: '#be123c',
  lightColor: '#fecaca',
  darkColor: '#450a0a',
}

export function getTelegraphPalette(
  telegraph: Pick<TelegraphState, 'element'>,
): TelegraphPalette {
  const element = telegraph.element
  return element && element in TELEGRAPH_PALETTES
    ? TELEGRAPH_PALETTES[element]
    : UNKNOWN_TELEGRAPH_PALETTE
}

/** Every palette a telegraph can be drawn in, for the colour-clash guard. */
export const ALL_TELEGRAPH_PALETTES: readonly TelegraphPalette[] = [
  ...Object.values(TELEGRAPH_PALETTES),
  UNKNOWN_TELEGRAPH_PALETTE,
]

/** A marked circle: a jagged ring with a crosshair over the ground it covers. */
export function drawTelegraphDisc(
  view: Graphics,
  telegraph: Pick<TelegraphState, 'radius'>,
  palette: TelegraphPalette,
): Graphics {
  const radius = telegraph.radius
  const spikeCount = 12
  view
    .poly(createStarPoints(radius, spikeCount, 0.86, Math.PI / spikeCount))
    .stroke({ color: palette.darkColor, width: 10, alpha: 0.8 })
    .poly(createStarPoints(radius, spikeCount, 0.86, Math.PI / spikeCount))
    .fill({ color: palette.color, alpha: 0.2 })
    // The danger rim, then the school's own edge inside it.
    .stroke({ color: HOSTILE_TELEGRAPH_RIM, width: 7, alpha: 0.95 })
    .poly(createStarPoints(radius, spikeCount, 0.86, Math.PI / spikeCount))
    .stroke({ color: palette.lightColor, width: 3, alpha: 0.92 })
    .poly(createPolygonPoints(radius * 0.72, 8, Math.PI / 8))
    .stroke({ color: palette.lightColor, width: 2, alpha: 0.78 })
    .moveTo(-radius * 0.5, 0)
    .lineTo(radius * 0.5, 0)
    .moveTo(0, -radius * 0.5)
    .lineTo(0, radius * 0.5)
    .stroke({ color: palette.lightColor, width: 1.5, alpha: 0.7 })
  return view
}

/**
 * A lethal band with a safe middle.
 *
 * The band is a single thick stroke at its mid-radius, so its two edges are
 * exactly where the danger starts and stops, and the hollow centre is marked
 * with its own quiet ring: the counterplay is to be inside it, and a telegraph
 * that does not show where safety is is not a telegraph.
 */
export function drawTelegraphRing(
  view: Graphics,
  telegraph: Pick<TelegraphState, 'radius' | 'innerRadius'>,
  palette: TelegraphPalette,
): Graphics {
  const outer = telegraph.radius
  const inner = Math.max(0, Math.min(telegraph.innerRadius ?? 0, outer - 1))
  const band = outer - inner
  const middle = inner + band / 2
  view
    .circle(0, 0, middle)
    .stroke({ color: palette.darkColor, width: band + 10, alpha: 0.72 })
    .circle(0, 0, middle)
    .stroke({ color: palette.color, width: band, alpha: 0.26 })
    // Both edges of the band carry the rim: either one can be the one you cross.
    .circle(0, 0, outer)
    .stroke({ color: HOSTILE_TELEGRAPH_RIM, width: 7, alpha: 0.95 })
    .circle(0, 0, outer)
    .stroke({ color: palette.lightColor, width: 3, alpha: 0.92 })
    .circle(0, 0, inner)
    .stroke({ color: HOSTILE_TELEGRAPH_RIM, width: 7, alpha: 0.95 })
    .circle(0, 0, inner)
    .stroke({ color: palette.lightColor, width: 3, alpha: 0.92 })
  // The safe eye, drawn as a dashed inner ring so it reads as shelter rather
  // than as another edge to stay away from.
  const safeRadius = inner * 0.58
  if (safeRadius > 4) {
    for (let index = 0; index < 10; index += 1) {
      const from = (Math.PI * 2 * index) / 10
      view
        .arc(0, 0, safeRadius, from, from + Math.PI / 10)
        .stroke({ color: '#bbf7d0', width: 2, alpha: 0.6 })
    }
  }
  return view
}

/**
 * A sector in front of the caster, drawn already turned to its own heading.
 *
 * The geometry is baked at its final angle rather than rotated at draw time
 * because a cone's heading is fixed when it is cast: the renderer only moves it
 * with its caster.
 */
export function drawTelegraphCone(
  view: Graphics,
  telegraph: Pick<TelegraphState, 'radius' | 'angle' | 'arc'>,
  palette: TelegraphPalette,
): Graphics {
  const radius = telegraph.radius
  const arc = Math.min(Math.PI * 2, Math.max(0.05, telegraph.arc ?? Math.PI / 2))
  const centre = telegraph.angle ?? 0
  const from = centre - arc / 2
  const to = centre + arc / 2
  const sector = (): void => {
    view.moveTo(0, 0).arc(0, 0, radius, from, to).closePath()
  }
  sector()
  view.stroke({ color: palette.darkColor, width: 10, alpha: 0.8 })
  sector()
  view
    .fill({ color: palette.color, alpha: 0.24 })
    .stroke({ color: HOSTILE_TELEGRAPH_RIM, width: 7, alpha: 0.95 })
  sector()
  view.stroke({ color: palette.lightColor, width: 3, alpha: 0.92 })
  // The two edges to round, plus the centre line that says which way it faces.
  view
    .moveTo(0, 0)
    .lineTo(Math.cos(from) * radius, Math.sin(from) * radius)
    .moveTo(0, 0)
    .lineTo(Math.cos(to) * radius, Math.sin(to) * radius)
    .stroke({ color: palette.lightColor, width: 2.5, alpha: 0.85 })
    .moveTo(0, 0)
    .lineTo(Math.cos(centre) * radius * 0.88, Math.sin(centre) * radius * 0.88)
    .stroke({ color: palette.lightColor, width: 1.5, alpha: 0.5 })
  return view
}
