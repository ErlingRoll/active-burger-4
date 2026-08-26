import { Application, Container, Graphics, type Ticker } from 'pixi.js'
import type { EntityId } from '../game/ids'
import type { Game } from '../game/Game'

export class PixiGame {
  private readonly game: Game
  private readonly app = new Application()
  private readonly camera = new Container()
  private readonly enemyViews = new Map<EntityId, Graphics>()
  private enemyLayer: Container | undefined
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
    const enemies = new Container()
    this.enemyLayer = enemies
    const player = new Container()
    const projectiles = new Container()
    const effects = new Container()
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
  }): Graphics {
    return new Graphics()
      .circle(0, 0, enemy.radius)
      .fill('#ef4444')
      .stroke({ color: '#fecaca', width: 2 })
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
    this.enemyLayer = undefined
    this.playerView = undefined
    this.app.destroy({ removeView: true }, { children: true })
    this.initialized = false
  }
}
