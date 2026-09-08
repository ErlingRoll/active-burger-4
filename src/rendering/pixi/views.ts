import type { Container, Graphics, Text } from 'pixi.js'

/**
 * The Pixi display objects the renderer keeps per simulation entity.
 *
 * The renderer holds a view per entity id and mutates it each frame rather than
 * rebuilding the scene graph, so these describe what is retained between
 * frames. Extra fields such as `lastHp` and `hitFlashUntil` are the memory a
 * view needs to animate a change the state alone does not express.
 */

export interface EnemyView {
  root: Container
  body: Graphics
  hitFlash: Graphics
  label: Text
  hpBar: Graphics
  shieldBar: Graphics
  statusEffects: Container
  statusEffectSignature?: string
  poisonAura: Graphics
  hasEliteModifier: boolean
  hpRatio?: number
  shieldRatio?: number
  lastHp?: number
  hitFlashUntil?: number
}

export interface PlayerView {
  root: Container
  body: Graphics
  hitFlash: Graphics
  hpBar: Graphics
  shieldBar: Graphics
  lastHp?: number
  hitFlashUntil?: number
}

export interface SummonView {
  root: Container
  body: Graphics
  hpBar: Graphics
  guardAura: Graphics
}

export interface BossView {
  root: Container
  body: Graphics
  hitFlash: Graphics
  label: Text
  hpBar: Graphics
  statusEffects: Container
  statusEffectSignature?: string
  poisonAura: Graphics
  lastHp?: number
  hitFlashUntil?: number
}

export interface TelegraphView {
  root: Container
  graphic: Graphics
  label: Text
}

export interface StairsView {
  root: Container
  label: Text
}

export interface PickupFeedbackView {
  text: Text
  createdAt: number
  startY: number
}

export interface RenderPoint {
  x: number
  y: number
}
