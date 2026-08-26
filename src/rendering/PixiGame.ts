import { Application, Container, Graphics, Text, type Ticker } from 'pixi.js'
import type { EntityId } from '../game/ids'
import type { Game } from '../game/Game'
import {
  getEnemyDefinition,
  type EnemyRenderDefinition,
} from '../content/enemies/Enemies'
import {
  getEliteModifierDefinition,
  type EliteModifierId,
} from '../content/enemies/EliteModifiers'
import {
  BASIC_BOLT_SKILL_ID,
  getSkillDefinition,
  isSkillId,
} from '../content/skills/Skills'
import type {
  BossState,
  SkillEffectState,
  ProjectileState,
  TelegraphState,
  StairsState,
} from '../game/state/GameState'
import {
  getBossDefinition,
  getBossSkillDefinition,
} from '../content/bosses/Bosses'
import {
  DEFAULT_PLAYSTYLE_ID,
  getPlaystyleDefinition,
} from '../content/playstyles/Playstyles'

export class PixiGame {
  private static readonly MIN_CAMERA_SCALE = 1 / 3
  private static readonly MAX_CAMERA_SCALE = 1
  private static readonly WHEEL_ZOOM_SENSITIVITY = 0.001
  private static readonly CAMERA_DEAD_ZONE_PIXELS = 28
  private static readonly CAMERA_FOLLOW_RESPONSIVENESS = 12
  private static readonly CAMERA_SNAP_DISTANCE = 150

  private readonly game: Game
  private readonly app = new Application()
  private readonly camera = new Container()
  private readonly enemyViews = new Map<EntityId, EnemyView>()
  private readonly bossViews = new Map<EntityId, BossView>()
  private readonly telegraphViews = new Map<EntityId, TelegraphView>()
  private readonly projectileViews = new Map<EntityId, Graphics>()
  private readonly pickupViews = new Map<EntityId, Graphics>()
  private readonly effectViews = new Map<EntityId, Graphics>()
  private readonly stairsViews = new Map<EntityId, StairsView>()
  private enemyLayer: Container | undefined
  private bossLayer: Container | undefined
  private telegraphLayer: Container | undefined
  private projectileLayer: Container | undefined
  private pickupLayer: Container | undefined
  private effectLayer: Container | undefined
  private stairsLayer: Container | undefined
  private playerView: PlayerView | undefined
  private host: HTMLElement | undefined
  private cameraScale = PixiGame.MAX_CAMERA_SCALE
  private cameraFocusX = 0
  private cameraFocusY = 0
  private cameraFocusInitialized = false
  private initialized = false
  private disposed = false

  constructor(game: Game) {
    this.game = game
  }

  async initialize(host: HTMLElement): Promise<void> {
    await this.app.init({
      antialias: true,
      backgroundColor: '#0f172a',
      resizeTo: host,
    })

    if (this.disposed) {
      this.destroyApplication()
      return
    }

    host.appendChild(this.app.canvas)
    this.host = host
    host.addEventListener('wheel', this.handleWheel, { passive: false })
    this.createWorld()
    this.initialized = true

    this.app.ticker.add(this.update)
    this.centerCamera(0)
    this.renderState()
  }

  destroy(): void {
    this.disposed = true

    if (this.initialized) {
      this.destroyApplication()
    }
  }

  private createWorld(): void {
    const world = new Container()
    const ground = new Container()
    const decorations = new Container()
    const pickups = new Container()
    this.pickupLayer = pickups
    const stairs = new Container()
    this.stairsLayer = stairs
    const telegraphs = new Container()
    this.telegraphLayer = telegraphs
    const enemies = new Container()
    this.enemyLayer = enemies
    const bosses = new Container()
    this.bossLayer = bosses
    const player = new Container()
    const projectiles = new Container()
    this.projectileLayer = projectiles
    const effects = new Container()
    this.effectLayer = effects
    const worldUi = new Container()

    this.camera.addChild(world)
    world.addChild(
      ground,
      decorations,
      pickups,
      stairs,
      telegraphs,
      enemies,
      bosses,
      player,
      projectiles,
      effects,
      worldUi,
    )
    this.app.stage.addChild(this.camera)

    ground.addChild(this.createGround())
    this.playerView = this.createPlayerPlaceholder()
    player.addChild(this.playerView.root)
  }

  private createGround(): Graphics {
    const ground = new Graphics()
    const extent = 2_000
    const gridSize = 100

    ground.rect(-extent, -extent, extent * 2, extent * 2).fill('#162033')

    for (let coordinate = -extent; coordinate <= extent; coordinate += gridSize) {
      ground
        .moveTo(coordinate, -extent)
        .lineTo(coordinate, extent)
        .stroke({ color: '#26354f', width: 1 })
      ground
        .moveTo(-extent, coordinate)
        .lineTo(extent, coordinate)
        .stroke({ color: '#26354f', width: 1 })
    }

    return ground
  }

  private createPlayerPlaceholder(): PlayerView {
    const playstyle = getPlaystyleDefinition(
      this.game.state.player.playstyleId ?? DEFAULT_PLAYSTYLE_ID,
    )
    const body = new Graphics()
      .circle(0, 0, 24)
      .fill(playstyle.visual.fillColor)
      .stroke({ color: playstyle.visual.outlineColor, width: 3 })
    const hpBar = new Graphics()
    const root = new Container()
    root.addChild(body, hpBar)
    return { root, hpBar }
  }

  private createEnemyPlaceholder(enemy: {
    radius: number
    definitionId: string
    eliteModifier?: EliteModifierId
  }): EnemyView {
    const definition = getEnemyDefinition(enemy.definitionId)
    const body = new Graphics()
    const radius = enemy.radius
    if (definition.render.shape === 'diamond') {
      body.poly([0, -radius, radius, 0, 0, radius, -radius, 0])
    } else if (definition.render.shape === 'triangle') {
      body.poly([0, -radius, radius, radius, -radius, radius])
    } else if (definition.render.shape === 'hexagon') {
      const points = Array.from({ length: 6 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2
        return [Math.cos(angle) * radius, Math.sin(angle) * radius]
      }).flat()
      body.poly(points)
    } else {
      body.circle(0, 0, radius)
    }
    body
      .fill(definition.render.color)
      .stroke({ color: definition.render.outlineColor, width: 2 })
    applyEnemyRenderScale(body, definition.render)

    const root = new Container()
    root.addChild(body)
    if (enemy.eliteModifier) {
      const modifier = getEliteModifierDefinition(enemy.eliteModifier)
      const marker = new Graphics()
        .circle(0, 0, radius * 1.2)
        .stroke({ color: modifier.markerColor, width: 4 })
      applyEnemyRenderScale(marker, definition.render)
      root.addChild(marker)
    }

    const label = new Text({
      text: getEnemyDisplayLabel(enemy.definitionId, enemy.eliteModifier),
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
    root.addChild(hpBar, label)
    return { root, label, hpBar }
  }

  private createProjectilePlaceholder(projectile: ProjectileState): Graphics {
    const skillId =
      projectile.skillId && isSkillId(projectile.skillId)
        ? projectile.skillId
        : BASIC_BOLT_SKILL_ID
    const visual = getSkillDefinition(skillId).visual
    const trailLength = visual.trailLength ?? projectile.radius * 3
    const trailWidth = visual.trailWidth ?? projectile.radius
    const view = new Graphics()
      .moveTo(-trailLength, 0)
      .lineTo(0, 0)
      .stroke({ color: visual.secondaryColor, width: trailWidth, alpha: 0.8 })
      .circle(0, 0, projectile.radius * 1.8)
      .fill(visual.primaryColor)
      .stroke({ color: visual.outlineColor, width: 2 })
      .poly([
        projectile.radius * 2.4,
        0,
        projectile.radius * 0.4,
        -projectile.radius,
        projectile.radius * 0.4,
        projectile.radius,
      ])
      .fill(visual.secondaryColor)
      .stroke({ color: visual.outlineColor, width: 1 })
    return view
  }

  private createBossPlaceholder(boss: BossState): BossView {
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
    const root = new Container()
    root.addChild(body, marker, hpBar, label)
    return { root, label, hpBar }
  }

  private createTelegraphPlaceholder(telegraph: TelegraphState): TelegraphView {
    const skill = getBossSkillDefinition(telegraph.skillId)
    const view = new Graphics()
    if (telegraph.kind === 'charge') {
      const start = telegraph.points[0]
      if (start) {
        view.moveTo(start.x - telegraph.x, start.y - telegraph.y)
        for (const point of telegraph.points.slice(1)) {
          view.lineTo(point.x - telegraph.x, point.y - telegraph.y)
        }
        view.stroke({ color: '#fb7185', width: telegraph.radius * 2, alpha: 0.22 })
        view.moveTo(start.x - telegraph.x, start.y - telegraph.y)
        for (const point of telegraph.points.slice(1)) {
          view.lineTo(point.x - telegraph.x, point.y - telegraph.y)
        }
        view.stroke({ color: '#fecdd3', width: 4, alpha: 0.9 })
      }
    } else {
      view
        .circle(0, 0, telegraph.radius)
        .fill({ color: '#ef4444', alpha: 0.22 })
        .stroke({ color: '#fca5a5', width: 4, alpha: 0.95 })
        .circle(0, 0, telegraph.radius * 0.72)
        .stroke({ color: '#fecaca', width: 2, alpha: 0.8 })
    }
    const label = new Text({
      text: `${skill.name} · DODGE`,
      style: {
        fill: '#fee2e2',
        fontSize: 13,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        stroke: { color: '#450a0a', width: 4 },
      },
    })
    label.anchor.set(0.5, 1)
    const root = new Container()
    root.addChild(view, label)
    return { root, label }
  }

  private createStairsPlaceholder(stairs: StairsState): StairsView {
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

  private createPickupPlaceholder(pickup: {
    radius: number
    kind?: 'xp' | 'gear'
  }): Graphics {
    if (pickup.kind === 'gear') {
      const radius = pickup.radius
      return new Graphics()
        .poly([0, -radius, radius, 0, 0, radius, -radius, 0])
        .fill('#f59e0b')
        .stroke({ color: '#fef3c7', width: 3 })
        .circle(0, 0, radius * 0.35)
        .fill('#7c3aed')
    }

    return new Graphics()
      .circle(0, 0, pickup.radius)
      .fill('#22c55e')
      .stroke({ color: '#bbf7d0', width: 2 })
  }

  private createEffectPlaceholder(effect: SkillEffectState): Graphics {
    const skillId = isSkillId(effect.skillId)
      ? effect.skillId
      : BASIC_BOLT_SKILL_ID
    const visual = getSkillDefinition(skillId).visual
    const view = new Graphics()

    if (visual.kind === 'area') {
      view
        .circle(0, 0, effect.radius)
        .fill(visual.primaryColor)
        .stroke({ color: visual.outlineColor, width: 4 })
        .circle(0, 0, effect.radius * 0.72)
        .stroke({ color: visual.secondaryColor, width: 3 })
    } else if (visual.kind === 'chain') {
      const points = effect.points.length > 0
        ? effect.points
        : [{ x: effect.x, y: effect.y }]
      const origin = points[0]
      if (origin) {
        view.moveTo(origin.x - effect.x, origin.y - effect.y)
        for (const point of points.slice(1)) {
          view.lineTo(point.x - effect.x, point.y - effect.y)
        }
        view.stroke({ color: visual.secondaryColor, width: 8, alpha: 0.35 })
        view.moveTo(origin.x - effect.x, origin.y - effect.y)
        for (const point of points.slice(1)) {
          view.lineTo(point.x - effect.x, point.y - effect.y)
        }
        view.stroke({ color: visual.primaryColor, width: 3 })
        for (const point of points) {
          view
            .circle(point.x - effect.x, point.y - effect.y, visual.nodeRadius ?? 10)
            .fill(visual.primaryColor)
            .stroke({ color: visual.outlineColor, width: 2 })
        }
      }
    } else {
      view
        .circle(0, 0, effect.radius * 0.6)
        .fill(visual.primaryColor)
        .stroke({ color: visual.outlineColor, width: 2 })
    }

    return view
  }

  private readonly update = (ticker: Ticker): void => {
    const deltaSeconds = ticker.deltaMS / 1000
    this.game.update(deltaSeconds)
    this.renderState()
    this.centerCamera(deltaSeconds)
  }

  private renderState(): void {
    const state = this.game.state
    this.playerView?.root.position.set(state.player.x, state.player.y)
    if (this.playerView) {
      this.drawHealthBar(
        this.playerView.hpBar,
        40,
        4,
        -34,
        state.player.hp,
        state.player.maxHp,
      )
    }

    const activeEnemyIds = new Set<EntityId>()
    for (const enemy of state.enemies) {
      activeEnemyIds.add(enemy.id)
      let enemyView = this.enemyViews.get(enemy.id)

      if (!enemyView) {
        enemyView = this.createEnemyPlaceholder(enemy)
        this.enemyViews.set(enemy.id, enemyView)
        this.enemyLayer?.addChild(enemyView.root)
      }

      enemyView.root.position.set(enemy.x, enemy.y)
      enemyView.label.text = getEnemyDisplayLabel(
        enemy.definitionId,
        enemy.eliteModifier,
      )
      const renderScale = getEnemyDefinition(enemy.definitionId).render.scale
      const labelY = -(enemy.radius * renderScale + 16)
      enemyView.label.position.set(0, labelY)
      this.drawHealthBar(
        enemyView.hpBar,
        Math.max(28, enemy.radius * renderScale * 1.8),
        4,
        labelY + 4,
        enemy.hp,
        enemy.maxHp,
      )
    }

    for (const [enemyId, enemyView] of this.enemyViews) {
      if (activeEnemyIds.has(enemyId)) {
        continue
      }

      enemyView.root.removeFromParent()
      enemyView.root.destroy({ children: true })
      this.enemyViews.delete(enemyId)
    }

    const activeBossIds = new Set<EntityId>()
    for (const boss of state.bosses ?? []) {
      if (boss.hp <= 0) {
        continue
      }
      activeBossIds.add(boss.id)
      let bossView = this.bossViews.get(boss.id)
      if (!bossView) {
        bossView = this.createBossPlaceholder(boss)
        this.bossViews.set(boss.id, bossView)
        this.bossLayer?.addChild(bossView.root)
      }
      bossView.root.position.set(boss.x, boss.y)
      const renderScale = 1
      bossView.label.text = getBossDisplayLabel(boss.bossDefinitionId)
      bossView.label.position.set(0, -(boss.radius * renderScale + 30))
      const barWidth = boss.radius * 2.5
      const barY = -(boss.radius * renderScale + 22)
      this.drawHealthBar(
        bossView.hpBar,
        barWidth,
        6,
        barY,
        boss.hp,
        boss.maxHp,
      )
    }

    for (const [bossId, bossView] of this.bossViews) {
      if (activeBossIds.has(bossId)) {
        continue
      }
      bossView.root.removeFromParent()
      bossView.root.destroy({ children: true })
      this.bossViews.delete(bossId)
    }

    const activeTelegraphIds = new Set<EntityId>()
    for (const telegraph of state.telegraphs ?? []) {
      activeTelegraphIds.add(telegraph.id)
      let telegraphView = this.telegraphViews.get(telegraph.id)
      if (!telegraphView) {
        telegraphView = this.createTelegraphPlaceholder(telegraph)
        this.telegraphViews.set(telegraph.id, telegraphView)
        this.telegraphLayer?.addChild(telegraphView.root)
      }
      telegraphView.root.position.set(telegraph.x, telegraph.y)
      telegraphView.label.position.set(0, -(telegraph.radius + 10))
      const progress = telegraph.duration > 0
        ? Math.max(0, Math.min(1, 1 - telegraph.remainingDuration / telegraph.duration))
        : 1
      telegraphView.root.alpha = 0.7 + progress * 0.3
      telegraphView.label.text = `${getBossSkillDefinition(telegraph.skillId).name} · DODGE`
    }

    for (const [telegraphId, telegraphView] of this.telegraphViews) {
      if (activeTelegraphIds.has(telegraphId)) {
        continue
      }
      telegraphView.root.removeFromParent()
      telegraphView.root.destroy({ children: true })
      this.telegraphViews.delete(telegraphId)
    }

    const activeProjectileIds = new Set<EntityId>()
    for (const projectile of state.projectiles) {
      activeProjectileIds.add(projectile.id)
      let view = this.projectileViews.get(projectile.id)

      if (!view) {
        view = this.createProjectilePlaceholder(projectile)
        this.projectileViews.set(projectile.id, view)
        this.projectileLayer?.addChild(view)
      }

      view.position.set(projectile.x, projectile.y)
      view.rotation = Math.atan2(projectile.velocityY, projectile.velocityX)
    }

    for (const [projectileId, view] of this.projectileViews) {
      if (activeProjectileIds.has(projectileId)) {
        continue
      }

      view.removeFromParent()
      view.destroy()
      this.projectileViews.delete(projectileId)
    }

    const activePickupIds = new Set<EntityId>()
    for (const pickup of state.pickups) {
      activePickupIds.add(pickup.id)
      let view = this.pickupViews.get(pickup.id)

      if (!view) {
        view = this.createPickupPlaceholder(pickup)
        this.pickupViews.set(pickup.id, view)
        this.pickupLayer?.addChild(view)
      }

      view.position.set(pickup.x, pickup.y)
    }

    for (const [pickupId, view] of this.pickupViews) {
      if (activePickupIds.has(pickupId)) {
        continue
      }

      view.removeFromParent()
      view.destroy()
      this.pickupViews.delete(pickupId)
    }

    const activeEffectIds = new Set<EntityId>()
    for (const effect of state.effects) {
      activeEffectIds.add(effect.id)
      let view = this.effectViews.get(effect.id)
      if (!view) {
        view = this.createEffectPlaceholder(effect)
        this.effectViews.set(effect.id, view)
        this.effectLayer?.addChild(view)
      }
      view.position.set(effect.x, effect.y)
      view.alpha = Math.max(0, Math.min(1, effect.remainingLifetime / effect.lifetime))
    }

    for (const [effectId, view] of this.effectViews) {
      if (activeEffectIds.has(effectId)) {
        continue
      }
      view.removeFromParent()
      view.destroy()
      this.effectViews.delete(effectId)
    }

    const activeStairsIds = new Set<EntityId>()
    const stairs = state.stairs
    if (stairs) {
      activeStairsIds.add(stairs.id)
      let stairsView = this.stairsViews.get(stairs.id)
      if (!stairsView) {
        stairsView = this.createStairsPlaceholder(stairs)
        this.stairsViews.set(stairs.id, stairsView)
        this.stairsLayer?.addChild(stairsView.root)
      }
      stairsView.root.position.set(stairs.x, stairs.y)
      stairsView.label.text = stairs.isFinal
        ? 'STAIRS · FINAL'
        : 'STAIRS · NEXT FLOOR'
      stairsView.root.alpha = stairs.rewardsCollected ? 0.65 : 1
    }
    for (const [stairsId, stairsView] of this.stairsViews) {
      if (activeStairsIds.has(stairsId)) {
        continue
      }
      stairsView.root.removeFromParent()
      stairsView.root.destroy({ children: true })
      this.stairsViews.delete(stairsId)
    }
  }

  private readonly centerCamera = (deltaSeconds: number): void => {
    const player = this.game.state.player
    if (!this.cameraFocusInitialized) {
      this.cameraFocusX = player.x
      this.cameraFocusY = player.y
      this.cameraFocusInitialized = true
    }

    const offsetX = player.x - this.cameraFocusX
    const offsetY = player.y - this.cameraFocusY
    const offsetDistance = Math.hypot(offsetX, offsetY)
    const deadZoneWorldRadius =
      PixiGame.CAMERA_DEAD_ZONE_PIXELS / this.cameraScale
    let targetFocusX = this.cameraFocusX
    let targetFocusY = this.cameraFocusY

    if (offsetDistance > deadZoneWorldRadius) {
      const offsetRatio = deadZoneWorldRadius / offsetDistance
      targetFocusX = player.x - offsetX * offsetRatio
      targetFocusY = player.y - offsetY * offsetRatio
    }

    const targetDistance = Math.hypot(
      targetFocusX - this.cameraFocusX,
      targetFocusY - this.cameraFocusY,
    )
    if (targetDistance >= PixiGame.CAMERA_SNAP_DISTANCE) {
      this.cameraFocusX = targetFocusX
      this.cameraFocusY = targetFocusY
    } else {
      const elapsed = Number.isFinite(deltaSeconds)
        ? Math.max(0, deltaSeconds)
        : 0
      const followAmount = 1 - Math.exp(
        -PixiGame.CAMERA_FOLLOW_RESPONSIVENESS * elapsed,
      )
      this.cameraFocusX += (targetFocusX - this.cameraFocusX) * followAmount
      this.cameraFocusY += (targetFocusY - this.cameraFocusY) * followAmount
    }

    this.camera.scale.set(this.cameraScale)
    this.camera.position.set(
      this.app.renderer.width / 2 - this.cameraFocusX * this.cameraScale,
      this.app.renderer.height / 2 - this.cameraFocusY * this.cameraScale,
    )
  }

  private drawHealthBar(
    view: Graphics,
    width: number,
    height: number,
    y: number,
    hp: number,
    maxHp: number,
  ): void {
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0
    view.visible = ratio < 1
    if (!view.visible) {
      return
    }

    view
      .clear()
      .rect(-width / 2, y, width, height)
      .fill({ color: '#450a0a', alpha: 0.9 })
      .rect(-width / 2, y, width * ratio, height)
      .fill('#ef4444')
      .stroke({ color: '#fee2e2', width: 1 })
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault()
    const scaleChange = Math.exp(
      -event.deltaY * PixiGame.WHEEL_ZOOM_SENSITIVITY,
    )
    this.cameraScale = Math.min(
      PixiGame.MAX_CAMERA_SCALE,
      Math.max(
        PixiGame.MIN_CAMERA_SCALE,
        this.cameraScale * scaleChange,
      ),
    )
    this.centerCamera(0)
  }

  private destroyApplication(): void {
    this.app.ticker.remove(this.update)
    this.host?.removeEventListener('wheel', this.handleWheel)
    for (const { root } of this.enemyViews.values()) {
      root.removeFromParent()
      root.destroy({ children: true })
    }
    for (const { root } of this.bossViews.values()) {
      root.removeFromParent()
      root.destroy({ children: true })
    }
    for (const { root } of this.telegraphViews.values()) {
      root.removeFromParent()
      root.destroy({ children: true })
    }
    for (const view of this.projectileViews.values()) {
      view.removeFromParent()
      view.destroy()
    }
    for (const view of this.pickupViews.values()) {
      view.removeFromParent()
      view.destroy()
    }
    for (const view of this.effectViews.values()) {
      view.removeFromParent()
      view.destroy()
    }
    for (const { root } of this.stairsViews.values()) {
      root.removeFromParent()
      root.destroy({ children: true })
    }
    this.enemyViews.clear()
    this.bossViews.clear()
    this.telegraphViews.clear()
    this.projectileViews.clear()
    this.pickupViews.clear()
    this.effectViews.clear()
    this.stairsViews.clear()
    this.enemyLayer = undefined
    this.bossLayer = undefined
    this.telegraphLayer = undefined
    this.projectileLayer = undefined
    this.pickupLayer = undefined
    this.effectLayer = undefined
    this.stairsLayer = undefined
    this.playerView = undefined
    this.host = undefined
    this.cameraFocusInitialized = false
    this.app.destroy({ removeView: true }, { children: true })
    this.initialized = false
  }
}

function applyEnemyRenderScale(
  view: Graphics,
  render: EnemyRenderDefinition,
): void {
  view.scale.set(render.scale)
}

interface EnemyView {
  root: Container
  label: Text
  hpBar: Graphics
}

interface PlayerView {
  root: Container
  hpBar: Graphics
}

interface BossView {
  root: Container
  label: Text
  hpBar: Graphics
}

interface TelegraphView {
  root: Container
  label: Text
}

interface StairsView {
  root: Container
  label: Text
}

export function getEnemyDisplayLabel(
  definitionId: string,
  eliteModifier?: EliteModifierId,
): string {
  const definition = getEnemyDefinition(definitionId)
  if (!eliteModifier) {
    return definition.name
  }
  return `${definition.name} · ${getEliteModifierDefinition(eliteModifier).name}`
}

export function getBossDisplayLabel(definitionId: BossState['bossDefinitionId']): string {
  return `BOSS · ${getBossDefinition(definitionId).name}`
}
