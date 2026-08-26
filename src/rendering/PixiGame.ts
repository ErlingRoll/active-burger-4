import { Application, Container, Graphics, type Ticker } from 'pixi.js'
import type { EntityId } from '../game/ids'
import type { Game } from '../game/Game'
import {
  getEnemyDefinition,
  type EnemyRenderDefinition,
} from '../content/enemies/Enemies'
import {
  BASIC_BOLT_SKILL_ID,
  getSkillDefinition,
  isSkillId,
} from '../content/skills/Skills'
import type { SkillEffectState, ProjectileState } from '../game/state/GameState'

export class PixiGame {
  private readonly game: Game
  private readonly app = new Application()
  private readonly camera = new Container()
  private readonly enemyViews = new Map<EntityId, Graphics>()
  private readonly projectileViews = new Map<EntityId, Graphics>()
  private readonly pickupViews = new Map<EntityId, Graphics>()
  private readonly effectViews = new Map<EntityId, Graphics>()
  private enemyLayer: Container | undefined
  private projectileLayer: Container | undefined
  private pickupLayer: Container | undefined
  private effectLayer: Container | undefined
  private playerView: Graphics | undefined
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
    this.createWorld()
    this.initialized = true

    this.app.ticker.add(this.update)
    this.centerCamera()
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
    const enemies = new Container()
    this.enemyLayer = enemies
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
      enemies,
      player,
      projectiles,
      effects,
      worldUi,
    )
    this.app.stage.addChild(this.camera)

    ground.addChild(this.createGround())
    this.playerView = this.createPlayerPlaceholder()
    player.addChild(this.playerView)
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

  private createPlayerPlaceholder(): Graphics {
    return new Graphics()
      .circle(0, 0, 24)
      .fill('#3b82f6')
      .stroke({ color: '#bfdbfe', width: 3 })
  }

  private createEnemyPlaceholder(enemy: {
    radius: number
    definitionId: string
  }): Graphics {
    const definition = getEnemyDefinition(enemy.definitionId)
    const view = new Graphics()
    const radius = enemy.radius
    if (definition.render.shape === 'diamond') {
      view.poly([0, -radius, radius, 0, 0, radius, -radius, 0])
    } else if (definition.render.shape === 'triangle') {
      view.poly([0, -radius, radius, radius, -radius, radius])
    } else if (definition.render.shape === 'hexagon') {
      const points = Array.from({ length: 6 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2
        return [Math.cos(angle) * radius, Math.sin(angle) * radius]
      }).flat()
      view.poly(points)
    } else {
      view.circle(0, 0, radius)
    }
    view
      .fill(definition.render.color)
      .stroke({ color: definition.render.outlineColor, width: 2 })
    applyEnemyRenderScale(view, definition.render)
    return view
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

  private createPickupPlaceholder(pickup: {
    radius: number
  }): Graphics {
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
    this.game.update(ticker.deltaMS / 1000)
    this.renderState()
    this.centerCamera()
  }

  private renderState(): void {
    const state = this.game.state
    this.playerView?.position.set(state.player.x, state.player.y)

    const activeEnemyIds = new Set<EntityId>()
    for (const enemy of state.enemies) {
      activeEnemyIds.add(enemy.id)
      let view = this.enemyViews.get(enemy.id)

      if (!view) {
        view = this.createEnemyPlaceholder(enemy)
        this.enemyViews.set(enemy.id, view)
        this.enemyLayer?.addChild(view)
      }

      view.position.set(enemy.x, enemy.y)
    }

    for (const [enemyId, view] of this.enemyViews) {
      if (activeEnemyIds.has(enemyId)) {
        continue
      }

      view.removeFromParent()
      view.destroy()
      this.enemyViews.delete(enemyId)
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
  }

  private readonly centerCamera = (): void => {
    this.camera.position.set(
      this.app.renderer.width / 2,
      this.app.renderer.height / 2,
    )
  }

  private destroyApplication(): void {
    this.app.ticker.remove(this.update)
    this.enemyViews.clear()
    this.projectileViews.clear()
    this.pickupViews.clear()
    this.effectViews.clear()
    this.enemyLayer = undefined
    this.projectileLayer = undefined
    this.pickupLayer = undefined
    this.effectLayer = undefined
    this.playerView = undefined
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
