import { Graphics } from 'pixi.js'
import type { EnemyRenderDefinition } from '../../content/enemies/Enemies'
import { getEliteModifierDefinition } from '../../content/enemies/EliteModifiers'

/**
 * Enemy silhouette scaling and the elite aura ring.
 *
 * Elite modifiers stack, and each contributes a marker colour to a shared aura,
 * so the aura is built from the whole modifier list rather than per modifier.
 */

export function applyEnemyRenderScale(
  view: Graphics,
  render: EnemyRenderDefinition,
): void {
  view.scale.set(render.scale)
}

export function createEliteAura(
  modifier: ReturnType<typeof getEliteModifierDefinition>,
  radius: number,
): Graphics {
  const auraRadius = radius * 1.35
  const aura = new Graphics()
  aura.circle(0, 0, auraRadius).stroke({
    color: modifier.markerColor,
    width: 3,
    alpha: 0.9,
  })

  if (modifier.auraStyle === 'flames') {
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8
      const innerRadius = auraRadius * 0.85
      const tipRadius = auraRadius * (index % 2 === 0 ? 1.45 : 1.25)
      const sideAngle = 0.18
      aura.poly([
        Math.cos(angle - sideAngle) * innerRadius,
        Math.sin(angle - sideAngle) * innerRadius,
        Math.cos(angle) * tipRadius,
        Math.sin(angle) * tipRadius,
        Math.cos(angle + sideAngle) * innerRadius,
        Math.sin(angle + sideAngle) * innerRadius,
      ]).fill(modifier.markerColor)
    }
  } else if (modifier.auraStyle === 'electric') {
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8
      const directionX = Math.cos(angle)
      const directionY = Math.sin(angle)
      const perpendicularX = -directionY
      const perpendicularY = directionX
      const innerRadius = auraRadius * 0.8
      const outerRadius = auraRadius * 1.4
      const midpointRadius = (innerRadius + outerRadius) / 2
      aura
        .moveTo(directionX * innerRadius, directionY * innerRadius)
        .lineTo(
          directionX * midpointRadius + perpendicularX * radius * 0.22,
          directionY * midpointRadius + perpendicularY * radius * 0.22,
        )
        .lineTo(directionX * outerRadius, directionY * outerRadius)
        .stroke({ color: modifier.markerColor, width: 3 })
    }
  } else if (modifier.auraStyle === 'frost') {
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6
      const crystalRadius = auraRadius * 1.35
      const crystalWidth = radius * 0.28
      const directionX = Math.cos(angle)
      const directionY = Math.sin(angle)
      const perpendicularX = -directionY
      const perpendicularY = directionX
      aura.poly([
        directionX * auraRadius + perpendicularX * crystalWidth,
        directionY * auraRadius + perpendicularY * crystalWidth,
        directionX * crystalRadius,
        directionY * crystalRadius,
        directionX * auraRadius - perpendicularX * crystalWidth,
        directionY * auraRadius - perpendicularY * crystalWidth,
      ]).fill(modifier.markerColor)
    }
  } else if (modifier.auraStyle === 'poison') {
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6
      const bubbleRadius = radius * (0.16 + (index % 2) * 0.05)
      const distance = auraRadius * (0.95 + (index % 3) * 0.08)
      aura.circle(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        bubbleRadius,
      ).fill({ color: modifier.markerColor, alpha: 0.8 })
    }
  }

  return aura
}
