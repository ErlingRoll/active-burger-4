import { Container, Graphics, Text } from 'pixi.js'
import { getEnemyDefinition } from '../../content/enemies/Enemies'
import {
  getEliteModifierDefinition,
  getEliteModifierIds,
  type EliteModifierId,
} from '../../content/enemies/EliteModifiers'
import type {
  BossState,
  HitVisualElement,
  StairsState,
} from '../../game/state/GameState'
import type { HealthBarColors } from './worldTheme'
import { STATUS_EFFECT_ICON_GAP, STATUS_EFFECT_ICON_SIZE } from './constants'
import type { StatusEffectBadge } from './renderState'
import type { BossView, EnemyView, StairsView } from './views'
import { applyEnemyRenderScale, createEliteAura } from './enemyRendering'
import { drawEnemySilhouette } from './enemySilhouettes'
import { getBossDisplayLabel, getEnemyDisplayLabel } from './labels'
import { createPolygonPoints, createStarPoints } from './geometry'

/**
 * Graphics for the entities the simulation owns, plus the bars and badges drawn
 * over them.
 *
 * Every function here is a pure factory or a pure draw call: it reads only its
 * arguments and writes only into the object it is given. Keeping them out of the
 * renderer class is what makes them reachable from a test.
 */

export function createEnemyPlaceholder(enemy: {
  radius: number
  definitionId: string
  eliteModifier?: EliteModifierId
  eliteModifiers?: readonly EliteModifierId[]
}): EnemyView {
  const definition = getEnemyDefinition(enemy.definitionId)
  const body = new Graphics()
  const radius = enemy.radius
  drawEnemySilhouette(body, definition.render.shape, radius, {
    fill: definition.render.color,
    outline: definition.render.outlineColor,
  })
  applyEnemyRenderScale(body, definition.render)

  const root = new Container()
  const poisonAura = new Graphics()
  poisonAura.visible = false
  applyEnemyRenderScale(poisonAura, definition.render)
  root.addChild(poisonAura)
  for (const modifierId of getEliteModifierIds(enemy)) {
    const modifier = getEliteModifierDefinition(modifierId)
    const aura = createEliteAura(modifier, radius)
    applyEnemyRenderScale(aura, definition.render)
    root.addChild(aura)
  }
  root.addChild(body)

  const label = new Text({
    text: getEnemyDisplayLabel(
      enemy.definitionId,
      getEliteModifierIds(enemy),
    ),
    style: {
      fill: '#f8fafc',
      fontSize: 14,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'bold',
      stroke: { color: '#0f172a', width: 4 },
    },
  })
  label.anchor.set(0.5, 1)
  const hpBar = new Graphics()
  const shieldBar = new Graphics()
  const statusEffects = new Container()
  const hitFlash = new Graphics()
    .circle(0, 0, radius + 4)
    .fill({ color: '#ffffff', alpha: 0.72 })
  hitFlash.visible = false
  root.addChild(hitFlash, shieldBar, hpBar, statusEffects, label)
  return {
    root,
    body,
    label,
    hpBar,
    shieldBar,
    statusEffects,
    poisonAura,
    hitFlash,
    hasEliteModifier: getEliteModifierIds(enemy).length > 0,
  }
}

export function createBossPlaceholder(boss: BossState): BossView {
  const body = new Graphics()
    .circle(0, 0, boss.radius)
    .fill('#7c3aed')
    .stroke({ color: '#fef08a', width: 4 })
    .circle(0, 0, boss.radius * 0.72)
    .stroke({ color: '#c4b5fd', width: 2 })
  const marker = new Graphics()
    .poly([
      0,
      -boss.radius * 1.35,
      boss.radius * 0.35,
      -boss.radius * 1.05,
      boss.radius * 0.7,
      -boss.radius * 1.35,
      boss.radius * 0.45,
      -boss.radius * 0.72,
      -boss.radius * 0.45,
      -boss.radius * 0.72,
      -boss.radius * 0.7,
      -boss.radius * 1.35,
      -boss.radius * 0.35,
      -boss.radius * 1.05,
    ])
    .fill('#fef08a')
    .stroke({ color: '#451a03', width: 1 })
  const label = new Text({
    text: getBossDisplayLabel(boss.bossDefinitionId),
    style: {
      fill: '#fef08a',
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'bold',
      stroke: { color: '#0f172a', width: 5 },
    },
  })
  label.anchor.set(0.5, 1)
  const hpBar = new Graphics()
  const poisonAura = new Graphics()
    .circle(0, 0, boss.radius + 8)
    .stroke({ color: '#c084fc', width: 4, alpha: 0.65 })
  poisonAura.visible = false
  const statusEffects = new Container()
  const root = new Container()
  const hitFlash = new Graphics()
    .circle(0, 0, boss.radius + 6)
    .fill({ color: '#ffffff', alpha: 0.78 })
  hitFlash.visible = false
  root.addChild(poisonAura, body, hitFlash, marker, hpBar, statusEffects, label)
  return { root, body, label, hpBar, statusEffects, poisonAura, hitFlash }
}

export function createStairsPlaceholder(stairs: StairsState): StairsView {
  const radius = stairs.radius
  const view = new Graphics()
    .circle(0, 0, radius)
    .fill({ color: stairs.isFinal ? '#991b1b' : '#0e7490', alpha: 0.92 })
    .stroke({ color: stairs.isFinal ? '#fef08a' : '#67e8f9', width: 4 })
    .circle(0, 0, radius * 0.72)
    .stroke({ color: '#e0f2fe', width: 2, alpha: 0.9 })
    .moveTo(-radius * 0.38, -radius * 0.22)
    .lineTo(radius * 0.38, -radius * 0.22)
    .moveTo(-radius * 0.38, 0)
    .lineTo(radius * 0.38, 0)
    .moveTo(-radius * 0.38, radius * 0.22)
    .lineTo(radius * 0.38, radius * 0.22)
    .stroke({ color: '#f8fafc', width: 3 })
  const label = new Text({
    text: stairs.isFinal ? 'STAIRS · FINAL' : 'STAIRS · NEXT FLOOR',
    style: {
      fill: stairs.isFinal ? '#fef08a' : '#cffafe',
      fontSize: 13,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'bold',
      stroke: { color: '#0f172a', width: 4 },
    },
  })
  // Keep the world label below the ring so it cannot overlap a boss health
  // bar or the player's health marker at the same world position.
  label.anchor.set(0.5, 0)
  label.position.set(0, radius + 10)
  const root = new Container()
  root.addChild(view, label)
  return { root, label }
}

export function drawHealthBar(
  view: Graphics,
  width: number,
  height: number,
  y: number,
  hp: number,
  maxHp: number,
  colors: HealthBarColors,
): void {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0
  view.visible = ratio < 1
  if (!view.visible) {
    return
  }

  view
    .clear()
    .rect(-width / 2, y, width, height)
    .fill({ color: colors.background, alpha: 0.9 })
    .rect(-width / 2, y, width * ratio, height)
    .fill(colors.fill)
    .stroke({ color: colors.outline, width: 1 })
}

export function drawShieldBar(
  view: Graphics,
  width: number,
  height: number,
  y: number,
  amount: number,
  maxAmount: number,
): void {
  const ratio = maxAmount > 0
    ? Math.max(0, Math.min(1, amount / maxAmount))
    : 0
  view.visible = ratio > 0
  if (!view.visible) {
    return
  }

  view
    .clear()
    .rect(-width / 2, y, width, height)
    .fill({ color: '#164e63', alpha: 0.95 })
    .rect(-width / 2, y, width * ratio, height)
    .fill('#22d3ee')
    .stroke({ color: '#cffafe', width: 1 })
}

export function drawStatusEffects(
  view: Container,
  barWidth: number,
  statuses: readonly StatusEffectBadge[],
): void {
  for (const child of view.removeChildren()) {
    child.destroy()
  }

  let offsetX = -barWidth / 2
  for (const status of statuses) {
    const icon = new Graphics()
    if (status.id === 'poison') {
      icon
        .circle(STATUS_EFFECT_ICON_SIZE / 2, STATUS_EFFECT_ICON_SIZE * 0.68, 3.2)
        .fill('#22c55e')
        .poly([
          STATUS_EFFECT_ICON_SIZE / 2,
          0,
          1.8,
          STATUS_EFFECT_ICON_SIZE * 0.62,
          STATUS_EFFECT_ICON_SIZE - 1.8,
          STATUS_EFFECT_ICON_SIZE * 0.62,
        ])
        .fill('#22c55e')
        .circle(4, 5.2, 0.8)
        .fill({ color: '#dcfce7', alpha: 0.8 })
    } else if (status.id === 'chill') {
      icon
        .circle(STATUS_EFFECT_ICON_SIZE / 2, STATUS_EFFECT_ICON_SIZE / 2, 4)
        .fill('#38bdf8')
        .stroke({ color: '#e0f2fe', width: 1 })
    } else if (status.id === 'freeze') {
      icon
        .rect(1, 1, STATUS_EFFECT_ICON_SIZE - 2, STATUS_EFFECT_ICON_SIZE - 2)
        .fill('#bfdbfe')
        .stroke({ color: '#eff6ff', width: 1 })
    } else if (status.id === 'shock') {
      icon
        .poly([
         5,
         0,
         1,
         6,
         5,
         6,
         3,
         STATUS_EFFECT_ICON_SIZE,
         9,
         4,
         5,
         4,
        ])
        .fill('#facc15')
    } else if (status.id === 'burning') {
      icon
        .poly([
          STATUS_EFFECT_ICON_SIZE / 2,
          0,
          STATUS_EFFECT_ICON_SIZE - 1,
          STATUS_EFFECT_ICON_SIZE,
          1,
          STATUS_EFFECT_ICON_SIZE,
        ])
        .fill('#f97316')
        .stroke({ color: '#fed7aa', width: 1 })
    }
    icon.position.set(offsetX, 0)
    view.addChild(icon)
    offsetX += STATUS_EFFECT_ICON_SIZE + STATUS_EFFECT_ICON_GAP
  }
}

export function drawHitFlash(
  view: Graphics,
  radius: number,
  hitVisual: { element: HitVisualElement; critical: boolean } | undefined,
  intensity: number,
): void {
  if (!hitVisual || intensity <= 0) {
    view.visible = false
    return
  }
  const color = hitVisual.element === 'fire'
    ? '#fb923c'
    : hitVisual.element === 'cold'
      ? '#7dd3fc'
      : hitVisual.element === 'lightning'
        ? '#fef08a'
        : hitVisual.element === 'chaos'
          ? '#c084fc'
          : hitVisual.element === 'poison'
            ? '#a3e635'
            : '#f8fafc'
  const flashRadius = radius * (1 + intensity * (hitVisual.critical ? 0.28 : 0.14))
  view.visible = true
  view.clear()
  view
    .poly(createStarPoints(flashRadius, hitVisual.critical ? 10 : 8, hitVisual.critical ? 0.35 : 0.62))
    .fill({ color, alpha: intensity * (hitVisual.critical ? 0.34 : 0.2) })
    .stroke({
      color: hitVisual.critical ? '#ffffff' : color,
      width: hitVisual.critical ? 3 : 2,
      alpha: intensity * 0.9,
    })
  if (hitVisual.critical) {
    view
      .poly(createPolygonPoints(flashRadius * 0.62, 6, Math.PI / 6))
      .stroke({ color: '#ffffff', width: 1.5, alpha: intensity * 0.82 })
  }
}
