import { Application, Container, Graphics } from 'pixi.js'

export class PixiGame {
  private readonly app = new Application()
  private readonly camera = new Container()
  private initialized = false
  private disposed = false

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

    this.app.ticker.add(this.centerCamera)
    this.centerCamera()
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
    player.addChild(this.createPlayerPlaceholder())
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

  private readonly centerCamera = (): void => {
    this.camera.position.set(
      this.app.renderer.width / 2,
      this.app.renderer.height / 2,
    )
  }

  private destroyApplication(): void {
    this.app.ticker.remove(this.centerCamera)
    this.app.destroy({ removeView: true }, { children: true })
    this.initialized = false
  }
}
