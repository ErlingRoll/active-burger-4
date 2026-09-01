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
  BASIC_ATTACK_SKILL_ID,
  AEGIS_PULSE_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  getBasicAttackVariant,
  getSkillDefinition,
  GLACIAL_ORB_SKILL_ID,
  isSkillId,
  GRAVITY_WELL_SKILL_ID,
  LANCERS_CHARGE_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  RALLYING_BANNER_SKILL_ID,
  RIFT_JAVELIN_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
  STORM_RELAY_SKILL_ID,
  SIGIL_OF_RUIN_SKILL_ID,
  MIRRORCAST_SKILL_ID,
  RAZORWIRE_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
  PRISM_HALO_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from '../content/skills/Skills'
import type {
  BossState,
  EnemyState,
  RelayState,
  SkillEffectState,
  ProjectileState,
  SummonState,
  TelegraphState,
  TrapState,
  StairsState,
  WireState,
  RuinSigilState,
  PrismHaloState,
  HitVisualElement,
  PickupState,
} from '../game/state/GameState'
import {
  getBossDefinition,
  getBossSkillDefinition,
} from '../content/bosses/Bosses'
import {
  getEnemyAbilityDefinition,
  type EnemyAbilityId,
} from '../content/enemies/EnemyAbilities'
import {
  DEFAULT_PLAYSTYLE_ID,
  getPlaystyleDefinition,
} from '../content/playstyles/Playstyles'
import { getUpgradeDefinition } from '../content/upgrades/Upgrades'
import { ARENA_BOUNDS } from '../game-config/arena'

const ENEMY_MELEE_ATTACK_ANIMATION_SECONDS = 0.28
const STATUS_EFFECT_ICON_SIZE = 10
const STATUS_EFFECT_ICON_GAP = 2

interface StatusEffectBadge {
  id: string
}

function getEnemyStatusEffects(
  poisonStackCount: number,
  chillStacks = 0,
  frozenRemainingDuration = 0,
  shockStacks = 0,
  burningStackCount = 0,
): StatusEffectBadge[] {
  const statuses: StatusEffectBadge[] = []
  if (poisonStackCount > 0) {
    statuses.push({ id: 'poison' })
  }
  if (chillStacks > 0) {
    statuses.push({ id: 'chill' })
  }
  if (frozenRemainingDuration > 0) {
    statuses.push({ id: 'freeze' })
  }
  if (shockStacks > 0) {
    statuses.push({ id: 'shock' })
  }
  if (burningStackCount > 0) {
    statuses.push({ id: 'burning' })
  }
  return statuses
}

function getStatusEffectSignature(
  statuses: readonly StatusEffectBadge[],
): string {
  return statuses.map((status) => status.id).join('|')
}

function isEnemyAbilityId(
  skillId: TelegraphState['skillId'],
): skillId is EnemyAbilityId {
  return skillId === 'archer-shot' || skillId === 'brute-shockwave'
}

function getTelegraphName(telegraph: TelegraphState): string {
  if (isEnemyAbilityId(telegraph.skillId)) {
    return getEnemyAbilityDefinition(telegraph.skillId).name
  }
  if (
    telegraph.skillId === 'ground-slam' ||
    telegraph.skillId === 'charge' ||
    telegraph.skillId === 'fire-nova' ||
    telegraph.skillId === 'flame-line' ||
    telegraph.skillId === 'meteor-zone'
  ) {
    return getBossSkillDefinition(telegraph.skillId).name
  }
  return 'Enemy attack'
}

function isLineTelegraphKind(telegraph: TelegraphState): boolean {
  return telegraph.kind === 'charge' ||
    telegraph.kind === 'flame-line' ||
    telegraph.kind === 'enemy-projectile'
}

export class PixiGame {
  private static readonly MAX_IMPACT_PARTICLE_VIEWS = 48
  private static readonly MAX_PROJECTILE_TRAIL_VIEWS = 96
  private static readonly MIN_CAMERA_SCALE = 1 / 3
  private static readonly MAX_CAMERA_SCALE = 1
  private static readonly WHEEL_ZOOM_SENSITIVITY = 0.001
  private static readonly CAMERA_DEAD_ZONE_PIXELS = 28
  private static readonly CAMERA_FOLLOW_RESPONSIVENESS = 12
  private static readonly CAMERA_SNAP_DISTANCE = 150

  private readonly game: Game
  private readonly app = new Application()
  private readonly camera = new Container()
  private readonly reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private readonly enemyViews = new Map<EntityId, EnemyView>()
  private readonly bossViews = new Map<EntityId, BossView>()
  private readonly telegraphViews = new Map<EntityId, TelegraphView>()
  private readonly projectileViews = new Map<EntityId, Graphics>()
  private readonly projectileTrailViews = new Map<EntityId, Graphics>()
  private readonly projectilePositionHistory = new Map<EntityId, RenderPoint[]>()
  private readonly pickupViews = new Map<EntityId, Graphics>()
  private readonly pickupData = new Map<EntityId, PickupState>()
  private readonly pickupFeedbackViews = new Map<EntityId, PickupFeedbackView>()
  private readonly effectViews = new Map<EntityId, Graphics>()
  private readonly effectParticleViews = new Map<EntityId, Graphics>()
  private readonly trapViews = new Map<EntityId, Graphics>()
  private readonly relayViews = new Map<EntityId, Graphics>()
  private readonly wireViews = new Map<EntityId, Graphics>()
  private readonly ruinSigilViews = new Map<EntityId, Graphics>()
  private mirrorcastView: Graphics | undefined
  private bloodRiteView: Graphics | undefined
  private prismHaloView: Graphics | undefined
  private readonly summonViews = new Map<EntityId, SummonView>()
  private readonly stairsViews = new Map<EntityId, StairsView>()
  private enemyLayer: Container | undefined
  private bossLayer: Container | undefined
  private skillObjectLayer: Container | undefined
  private telegraphLayer: Container | undefined
  private projectileLayer: Container | undefined
  private pickupLayer: Container | undefined
  private effectLayer: Container | undefined
  private worldUiLayer: Container | undefined
  private summonLayer: Container | undefined
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
    world.sortableChildren = true
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
    const skillObjects = new Container()
    this.skillObjectLayer = skillObjects
    const player = new Container()
    const summons = new Container()
    this.summonLayer = summons
    const projectiles = new Container()
    this.projectileLayer = projectiles
    const effects = new Container()
    this.effectLayer = effects
    const worldUi = new Container()
    this.worldUiLayer = worldUi

    ground.zIndex = 0
    decorations.zIndex = 10
    pickups.zIndex = 20
    stairs.zIndex = 25
    skillObjects.zIndex = 30
    telegraphs.zIndex = 40
    enemies.zIndex = 50
    bosses.zIndex = 55
    summons.zIndex = 60
    player.zIndex = 70
    projectiles.zIndex = 80
    effects.zIndex = 90
    worldUi.zIndex = 100

    this.camera.addChild(world)
    world.addChild(
      ground,
      decorations,
      pickups,
      stairs,
      telegraphs,
      enemies,
      bosses,
      skillObjects,
      summons,
      player,
      projectiles,
      effects,
      worldUi,
    )
    this.app.stage.addChild(this.camera)

    ground.addChild(this.createGround(), this.createArenaBoundary())
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

  private createArenaBoundary(): Graphics {
    const width = ARENA_BOUNDS.maxX - ARENA_BOUNDS.minX
    const height = ARENA_BOUNDS.maxY - ARENA_BOUNDS.minY
    const boundary = new Graphics()
      .rect(ARENA_BOUNDS.minX, ARENA_BOUNDS.minY, width, height)
      .stroke({ color: '#22d3ee', width: 42, alpha: 0.1 })
      .rect(ARENA_BOUNDS.minX, ARENA_BOUNDS.minY, width, height)
      .stroke({ color: '#0891b2', width: 18, alpha: 0.5 })
      .rect(ARENA_BOUNDS.minX, ARENA_BOUNDS.minY, width, height)
      .stroke({ color: '#a5f3fc', width: 4, alpha: 0.95 })

    const edges: readonly [number, number, number, number][] = [
      [ARENA_BOUNDS.minX, ARENA_BOUNDS.minY, ARENA_BOUNDS.maxX, ARENA_BOUNDS.minY],
      [ARENA_BOUNDS.maxX, ARENA_BOUNDS.minY, ARENA_BOUNDS.maxX, ARENA_BOUNDS.maxY],
      [ARENA_BOUNDS.maxX, ARENA_BOUNDS.maxY, ARENA_BOUNDS.minX, ARENA_BOUNDS.maxY],
      [ARENA_BOUNDS.minX, ARENA_BOUNDS.maxY, ARENA_BOUNDS.minX, ARENA_BOUNDS.minY],
    ]
    for (const [startX, startY, endX, endY] of edges) {
      drawDashedBoundaryEdge(boundary, startX, startY, endX, endY)
    }

    for (const [x, y] of [
      [ARENA_BOUNDS.minX, ARENA_BOUNDS.minY],
      [ARENA_BOUNDS.maxX, ARENA_BOUNDS.minY],
      [ARENA_BOUNDS.maxX, ARENA_BOUNDS.maxY],
      [ARENA_BOUNDS.minX, ARENA_BOUNDS.maxY],
    ]) {
      boundary
        .circle(x, y, 24)
        .fill({ color: '#082f49', alpha: 0.95 })
        .stroke({ color: '#cffafe', width: 3, alpha: 0.95 })
        .circle(x, y, 8)
        .fill('#67e8f9')
    }

    return boundary
  }

  private createPlayerPlaceholder(): PlayerView {
    const playstyle = getPlaystyleDefinition(
      this.game.state.player.playstyleId ?? DEFAULT_PLAYSTYLE_ID,
    )
    const body = new Graphics()
    if (playstyle.id === 'riftwalker') {
      body
        .poly(createPolygonPoints(24, 6, Math.PI / 6))
        .fill(playstyle.visual.fillColor)
        .stroke({ color: playstyle.visual.outlineColor, width: 3 })
        .poly(createPolygonPoints(14, 4, Math.PI / 4))
        .fill({ color: 0x312e81, alpha: 0.9 })
        .stroke({ color: 0xc4b5fd, width: 2 })
        .moveTo(-11, 11)
        .lineTo(11, -11)
        .stroke({ color: 0xf5f3ff, width: 2 })
    } else if (playstyle.id === 'bloodweaver') {
      body
        .poly(createStarPoints(24, 8, 0.7, -Math.PI / 2))
        .fill(playstyle.visual.fillColor)
        .stroke({ color: playstyle.visual.outlineColor, width: 3 })
        .poly(createPolygonPoints(15, 6, Math.PI / 6))
        .fill({ color: 0x450a0a, alpha: 0.9 })
        .stroke({ color: 0xf87171, width: 2 })
        .poly([0, -10, 7, 2, 0, 11, -7, 2])
        .fill({ color: 0xef4444, alpha: 0.85 })
        .stroke({ color: 0xfecaca, width: 1.5 })
    } else {
      body
        .circle(0, 0, 24)
        .fill(playstyle.visual.fillColor)
        .stroke({ color: playstyle.visual.outlineColor, width: 3 })
    }
    const hpBar = new Graphics()
    const shieldBar = new Graphics()
    const hitFlash = new Graphics()
    hitFlash.visible = false
    const root = new Container()
    root.addChild(body, hitFlash, shieldBar, hpBar)
    return { root, body, hitFlash, hpBar, shieldBar }
  }

  private createSummonPlaceholder(
    summon: Readonly<SummonState>,
  ): SummonView {
    const body = summon.skillId === PHANTOM_ARSENAL_SKILL_ID
      ? new Graphics()
          .circle(0, 0, 14)
          .fill({ color: '#60a5fa', alpha: 0.32 })
          .stroke({ color: '#dbeafe', width: 2 })
          .poly([-8, -4, 0, -15, 8, -4, 5, 10, -5, 10])
          .fill('#2563eb')
          .stroke({ color: '#bfdbfe', width: 1.5 })
          .moveTo(-12, 0)
          .quadraticCurveTo(0, 10, 12, 0)
          .stroke({ color: '#e0f2fe', width: 2 })
          .moveTo(0, -5)
          .lineTo(13, -5)
          .stroke({ color: '#fef08a', width: 2 })
      : new Graphics()
          .circle(0, 0, 13)
          .fill('#d8b4fe')
          .stroke({ color: '#faf5ff', width: 2 })
          .circle(0, 0, 7)
          .fill('#7e22ce')
    const hpBar = new Graphics()
    const guardAura = new Graphics()
    guardAura.visible = false
    this.drawEvolutionAccent(
      body,
      summon.skillId ?? RAISE_SKELETON_SKILL_ID,
      8,
    )
    const root = new Container()
    root.addChild(guardAura, body, hpBar)
    return { root, body, hpBar, guardAura }
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
    const poisonAura = new Graphics()
    poisonAura.visible = false
    applyEnemyRenderScale(poisonAura, definition.render)
    root.addChild(poisonAura)
    if (enemy.eliteModifier) {
      const modifier = getEliteModifierDefinition(enemy.eliteModifier)
      const aura = createEliteAura(modifier, radius)
      applyEnemyRenderScale(aura, definition.render)
      root.addChild(aura)
    }
    root.addChild(body)

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
    const statusEffects = new Container()
    const hitFlash = new Graphics()
      .circle(0, 0, radius + 4)
      .fill({ color: '#ffffff', alpha: 0.72 })
    hitFlash.visible = false
    root.addChild(hitFlash, hpBar, statusEffects, label)
    return { root, body, label, hpBar, statusEffects, poisonAura, hitFlash }
  }

  private createProjectilePlaceholder(projectile: ProjectileState): Graphics {
    if (projectile.sourceAbilityId === 'archer-shot') {
      return this.createEnemyArrowProjectile(projectile)
    }
    if (
      !projectile.sourceAbilityId &&
      projectile.skillId === BASIC_ATTACK_SKILL_ID
    ) {
      const variant = getBasicAttackVariant(projectile.basicAttackWeaponArchetype)
      if (variant.id === 'bow') {
        return this.createBowBasicProjectile(projectile, variant.visual)
      }
      if (variant.id === 'wand') {
        return this.createWandBasicProjectile(projectile, variant.visual)
      }
    }
    const visual = projectile.sourceAbilityId
      ? {
          primaryColor: '#ef4444',
          secondaryColor: '#fb7185',
          outlineColor: '#fee2e2',
          trailLength: 24,
          trailWidth: 4,
          projectileShape: 'arrow' as const,
        }
      : projectile.skillId === BASIC_ATTACK_SKILL_ID
        ? getBasicAttackVariant(projectile.basicAttackWeaponArchetype).visual
        : getSkillDefinition(
            projectile.skillId && isSkillId(projectile.skillId)
              ? projectile.skillId
              : BASIC_ATTACK_SKILL_ID,
          ).visual
    const trailLength = visual.trailLength ?? projectile.radius * 3
    const trailWidth = visual.trailWidth ?? projectile.radius
    const view = new Graphics()
      .moveTo(-trailLength, 0)
      .lineTo(0, 0)
      .stroke({
        color: projectile.mendingReturn
          ? '#fef08a'
          : projectile.echoWell
            ? '#c084fc'
            : visual.secondaryColor,
        width: trailWidth,
        alpha: 0.8,
      })
    if (visual.projectileShape === 'orb') {
      view
        .circle(0, 0, projectile.radius * 1.9)
        .fill(visual.primaryColor)
        .stroke({ color: visual.outlineColor, width: 2 })
        .circle(0, 0, projectile.radius * 0.85)
        .fill(visual.secondaryColor)
    } else {
      view
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
    }
    if (
      projectile.skillId === RIFT_JAVELIN_SKILL_ID &&
      (this.game.state.run.selectedUpgradeIds.includes('synergy-rift-javelin-lancers-charge') ||
        this.game.state.run.selectedUpgradeIds.includes('synergy-phantom-arsenal-rift-javelin'))
    ) {
      view
        .poly([
          projectile.radius * 2.8,
          0,
          projectile.radius * 0.7,
          -projectile.radius * 1.5,
          projectile.radius * 0.7,
          projectile.radius * 1.5,
        ])
        .stroke({ color: '#fef08a', width: 1.5, alpha: 0.74 })
    }
    if (
      projectile.skillId === PHANTOM_ARSENAL_SKILL_ID &&
      this.game.state.run.selectedUpgradeIds.includes('synergy-soul-tether-phantom-arsenal')
    ) {
      view
        .poly(createPolygonPoints(projectile.radius * 2.8, 6, Math.PI / 6))
        .stroke({ color: '#bfdbfe', width: 1.5, alpha: 0.7 })
    }
    if (projectile.skillId) {
      this.drawEvolutionAccent(
        view,
        projectile.skillId,
        Math.max(3, projectile.radius * 2.2),
      )
    }
    return view
  }

  private createEnemyArrowProjectile(projectile: ProjectileState): Graphics {
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

  private createBowBasicProjectile(
    projectile: ProjectileState,
    visual: ReturnType<typeof getBasicAttackVariant>['visual'],
  ): Graphics {
    const radius = projectile.radius
    const trailLength = visual.trailLength ?? radius * 4
    const shaftLength = radius * 4.2
    const view = new Graphics()
      .moveTo(-trailLength, 0)
      .lineTo(radius * 0.2, 0)
      .stroke({ color: visual.secondaryColor, width: visual.trailWidth ?? 2, alpha: 0.72 })
      .moveTo(-shaftLength * 0.5, 0)
      .lineTo(shaftLength * 0.5, 0)
      .stroke({ color: visual.outlineColor, width: 2, alpha: 0.94 })
      .poly([
        shaftLength * 0.5,
        0,
        shaftLength * 0.12,
        -radius * 1.2,
        shaftLength * 0.12,
        radius * 1.2,
      ])
      .fill({ color: visual.primaryColor, alpha: 0.92 })
      .stroke({ color: visual.outlineColor, width: 1.5 })
      .poly([
        -shaftLength * 0.5,
        0,
        -shaftLength * 0.95,
        -radius * 1.15,
        -shaftLength * 0.7,
        0,
        -shaftLength * 0.95,
        radius * 1.15,
      ])
      .fill({ color: visual.secondaryColor, alpha: 0.86 })
      .stroke({ color: visual.outlineColor, width: 1 })
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-chain-lightning')) {
      view
        .moveTo(-radius * 1.4, -radius * 0.7)
        .lineTo(-radius * 0.7, radius * 0.4)
        .lineTo(radius * 0.1, -radius * 0.2)
        .stroke({ color: '#fef08a', width: 1.5, alpha: 0.76 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-glacial-orb')) {
      view
        .poly([radius * 0.8, 0, radius * 0.2, -radius * 0.6, -radius * 0.2, 0, radius * 0.2, radius * 0.6])
        .stroke({ color: '#bae6fd', width: 1.5, alpha: 0.72 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-whirlwind')) {
      view
        .poly([shaftLength * 0.54, 0, shaftLength * 0.2, -radius * 1.6, shaftLength * 0.2, radius * 1.6])
        .stroke({ color: '#fef08a', width: 1.5, alpha: 0.72 })
    }
    this.drawEvolutionAccent(view, BASIC_ATTACK_SKILL_ID, radius * 2.2)
    return view
  }

  private createWandBasicProjectile(
    projectile: ProjectileState,
    visual: ReturnType<typeof getBasicAttackVariant>['visual'],
  ): Graphics {
    const radius = projectile.radius
    const trailLength = visual.trailLength ?? radius * 3
    const view = new Graphics()
      .moveTo(-trailLength, 0)
      .lineTo(-radius * 0.3, 0)
      .stroke({ color: visual.secondaryColor, width: visual.trailWidth ?? 4, alpha: 0.56 })
      .poly([
        radius * 2.25, 0,
        radius * 0.75, -radius * 1.25,
        -radius * 0.9, -radius * 0.75,
        -radius * 1.3, 0,
        -radius * 0.9, radius * 0.75,
        radius * 0.75, radius * 1.25,
      ])
      .fill({ color: visual.primaryColor, alpha: 0.88 })
      .stroke({ color: visual.outlineColor, width: 2 })
      .poly([
        radius * 1.3, 0,
        0, -radius * 0.5,
        -radius * 0.65, 0,
        0, radius * 0.5,
      ])
      .fill({ color: visual.secondaryColor, alpha: 0.92 })
      .stroke({ color: visual.outlineColor, width: 1 })
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-chain-lightning')) {
      view
        .moveTo(-radius * 1.45, -radius * 0.5)
        .lineTo(-radius * 0.72, radius * 0.25)
        .lineTo(radius * 0.05, -radius * 0.18)
        .stroke({ color: '#fef08a', width: 1.5, alpha: 0.76 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-glacial-orb')) {
      view
        .poly([radius * 0.9, 0, radius * 0.2, -radius * 0.7, -radius * 0.45, 0, radius * 0.2, radius * 0.7])
        .stroke({ color: '#bae6fd', width: 1.5, alpha: 0.72 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-whirlwind')) {
      view
        .poly(createPolygonPoints(radius * 1.48, 4, Math.PI / 4))
        .stroke({ color: '#fef08a', width: 1.5, alpha: 0.7 })
    }
    this.drawEvolutionAccent(view, BASIC_ATTACK_SKILL_ID, radius * 2.2)
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

  private createTelegraphPlaceholder(telegraph: TelegraphState): TelegraphView {
    const color = telegraph.sourceKind === 'enemy' ? '#b91c1c' : '#be123c'
    const lightColor = '#fecaca'
    const view = this.createTelegraphGraphic(telegraph, color, lightColor)
    const label = new Text({
      text: `DANGER · ${getTelegraphName(telegraph)} · DODGE`,
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

  private createTelegraphGraphic(
    telegraph: TelegraphState,
    color: string,
    lightColor: string,
  ): Graphics {
    if (telegraph.kind === 'ground-slam' || telegraph.kind === 'enemy-shockwave') {
      const radius = telegraph.radius
      const spikeCount = telegraph.kind === 'ground-slam' ? 12 : 10
      const view = new Graphics()
        .poly(createStarPoints(radius, spikeCount, 0.86, Math.PI / spikeCount))
        .stroke({ color: '#450a0a', width: 10, alpha: 0.8 })
        .poly(createStarPoints(radius, spikeCount, 0.86, Math.PI / spikeCount))
        .fill({ color, alpha: 0.16 })
        .stroke({ color: lightColor, width: 3, alpha: 0.92 })
        .poly(createPolygonPoints(radius * 0.72, 8, Math.PI / 8))
        .stroke({ color: lightColor, width: 2, alpha: 0.78 })
      for (let index = 0; index < spikeCount; index += 1) {
        const angle = (Math.PI * 2 * index) / spikeCount
        view
          .moveTo(
            Math.cos(angle) * radius * 0.52,
            Math.sin(angle) * radius * 0.52,
          )
          .lineTo(
            Math.cos(angle) * radius * 0.9,
            Math.sin(angle) * radius * 0.9,
          )
          .stroke({ color: lightColor, width: 1.5, alpha: 0.58 })
      }
      return view
    }
    if (telegraph.kind === 'fire-nova') {
      return new Graphics()
        .poly(createStarPoints(telegraph.radius, 16, 0.52, -Math.PI / 2))
        .stroke({ color: '#450a0a', width: 10, alpha: 0.82 })
        .poly(createStarPoints(telegraph.radius, 16, 0.52, -Math.PI / 2))
        .fill({ color, alpha: 0.22 })
        .stroke({ color: lightColor, width: 3, alpha: 0.94 })
        .poly(createStarPoints(telegraph.radius * 0.64, 10, 0.58))
        .fill({ color: '#facc15', alpha: 0.18 })
        .stroke({ color: '#fff7ed', width: 2, alpha: 0.84 })
    }
    if (telegraph.kind === 'meteor-zone') {
      const radius = telegraph.radius
      return new Graphics()
        .poly(createPolygonPoints(radius, 4, Math.PI / 4))
        .stroke({ color: '#450a0a', width: 10, alpha: 0.82 })
        .poly(createPolygonPoints(radius, 4, Math.PI / 4))
        .fill({ color, alpha: 0.18 })
        .stroke({ color: lightColor, width: 3, alpha: 0.92 })
        .poly(createPolygonPoints(radius * 0.62, 4, 0))
        .stroke({ color: '#fef08a', width: 2, alpha: 0.86 })
        .moveTo(-radius * 0.95, 0)
        .lineTo(radius * 0.95, 0)
        .moveTo(0, -radius * 0.95)
        .lineTo(0, radius * 0.95)
        .stroke({ color: lightColor, width: 1.5, alpha: 0.72 })
    }
    if (isLineTelegraphKind(telegraph)) {
      const start = telegraph.points[0]
      const view = new Graphics()
      if (start) {
        view.moveTo(start.x - telegraph.x, start.y - telegraph.y)
        for (const point of telegraph.points.slice(1)) {
          view.lineTo(point.x - telegraph.x, point.y - telegraph.y)
        }
        view
          .stroke({ color: '#450a0a', width: telegraph.radius * 2 + 10, alpha: 0.82 })
          .moveTo(start.x - telegraph.x, start.y - telegraph.y)
        for (const point of telegraph.points.slice(1)) {
          view.lineTo(point.x - telegraph.x, point.y - telegraph.y)
        }
        view.stroke({ color, width: telegraph.radius * 2, alpha: 0.22 })
        view.moveTo(start.x - telegraph.x, start.y - telegraph.y)
        for (const point of telegraph.points.slice(1)) {
          view.lineTo(point.x - telegraph.x, point.y - telegraph.y)
        }
        view.stroke({ color: lightColor, width: 4, alpha: 0.9 })
        const end = telegraph.points[telegraph.points.length - 1]
        if (end) {
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
      }
      return view
    }
    return new Graphics()
      .poly(createStarPoints(telegraph.radius, 12, 0.78))
      .fill({ color, alpha: 0.22 })
      .stroke({ color: lightColor, width: 3, alpha: 0.9 })
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

  private createPickupPlaceholder(pickup: PickupState): Graphics {
    const view = new Graphics()
    this.drawPickup(view, pickup, 0)
    return view
  }

  private drawPickup(view: Graphics, pickup: PickupState, time: number): void {
    const radius = pickup.radius
    const pulse = this.reducedMotion
      ? 1
      : 1 + Math.sin(time * 4 + pickup.id) * 0.08
    view.clear()
    view.scale.set(pulse)
    if (pickup.kind === 'gear') {
      view
        .poly([0, -radius, radius, 0, 0, radius, -radius, 0])
        .fill({ color: '#f59e0b', alpha: 0.92 })
        .stroke({ color: '#fef3c7', width: 3 })
        .poly([0, -radius * 0.54, radius * 0.54, 0, 0, radius * 0.54, -radius * 0.54, 0])
        .fill({ color: '#7c3aed', alpha: 0.9 })
        .stroke({ color: '#ede9fe', width: 1.5 })
        .moveTo(-radius * 0.68, 0)
        .lineTo(0, radius * 0.68)
        .lineTo(radius * 0.68, 0)
        .stroke({ color: '#fde68a', width: 1, alpha: 0.76 })
      return
    }
    if (pickup.kind === 'healing-potion') {
      view
        .rect(-radius * 0.55, -radius * 0.2, radius * 1.1, radius * 0.95)
        .fill({ color: '#dc2626', alpha: 0.94 })
        .stroke({ color: '#fecaca', width: 2 })
        .rect(-radius * 0.28, -radius * 0.72, radius * 0.56, radius * 0.48)
        .fill('#fee2e2')
        .stroke({ color: '#fecaca', width: 1 })
        .moveTo(-radius * 0.38, radius * 0.02)
        .lineTo(radius * 0.38, radius * 0.02)
        .stroke({ color: '#fca5a5', width: 1.5, alpha: 0.86 })
      return
    }
    view
      .poly(createPolygonPoints(radius * 0.9, 6, Math.PI / 6))
      .fill({ color: '#22c55e', alpha: 0.9 })
      .stroke({ color: '#bbf7d0', width: 2 })
      .poly(createStarPoints(radius * 0.5, 6, 0.38))
      .fill({ color: '#dcfce7', alpha: 0.78 })
      .stroke({ color: '#f0fdf4', width: 1 })
  }

  private createPickupFeedback(
    pickup: PickupState,
    x: number,
    y: number,
    time: number,
  ): void {
    if (!this.worldUiLayer) {
      return
    }
    const isExperience = pickup.kind === 'xp'
    const isGear = pickup.kind === 'gear'
    const text = new Text({
      text: isExperience
        ? `+${pickup.kind === 'xp' ? pickup.xpAmount : 0} XP`
        : isGear
          ? 'GEAR FOUND'
          : 'HEALED',
      style: {
        fill: isExperience ? '#86efac' : isGear ? '#fbbf24' : '#fca5a5',
        fontSize: 12,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        stroke: { color: '#0f172a', width: 4 },
      },
    })
    text.anchor.set(0.5, 1)
    text.position.set(x, y)
    this.worldUiLayer.addChild(text)
    this.pickupFeedbackViews.set(pickup.id, {
      text,
      createdAt: time,
      startY: y,
    })
  }

  private createEffectPlaceholder(effect: SkillEffectState): Graphics {
    if (effect.skillId === RALLYING_BANNER_SKILL_ID) {
      return this.decorateEvolutionEffect(effect, this.createRallyingFlagPlaceholder(effect))
    }
    if (
      effect.skillId === PRISM_HALO_SKILL_ID &&
      effect.prismBeamElement !== undefined
    ) {
      return this.decorateEvolutionEffect(effect, this.createPrismBeamPlaceholder(effect))
    }
    if (effect.skillId === SOUL_TETHER_SKILL_ID && effect.shape === 'line') {
      return this.decorateEvolutionEffect(effect, this.createSoulTetherPlaceholder(effect))
    }
    if (effect.skillId === STORM_RELAY_SKILL_ID && effect.shape === undefined) {
      return this.decorateEvolutionEffect(effect, this.createStormRelayStrikePlaceholder(effect))
    }
    if (effect.shape === undefined) {
      if (effect.skillId === VITALITY_SKILL_ID) {
        return this.decorateEvolutionEffect(effect, this.createVitalityPlaceholder(effect))
      }
      if (effect.skillId === RAISE_SKELETON_SKILL_ID) {
        return this.decorateEvolutionEffect(effect, this.createSkeletonRitualPlaceholder(effect))
      }
      if (effect.skillId === BLOOD_RITE_SKILL_ID) {
        return this.decorateEvolutionEffect(effect, this.createBloodPulsePlaceholder(effect))
      }
      if (effect.skillId === SIGIL_OF_RUIN_SKILL_ID) {
        return this.decorateEvolutionEffect(effect, this.createSigilCastPlaceholder(effect))
      }
      if (effect.skillId === MIRRORCAST_SKILL_ID) {
        return this.decorateEvolutionEffect(effect, this.createMirrorcastCastPlaceholder(effect))
      }
      if (effect.skillId === PHANTOM_ARSENAL_SKILL_ID) {
        return this.decorateEvolutionEffect(effect, this.createPhantomSummonPlaceholder(effect))
      }
    }
    if (effect.shape === 'line') {
      if (effect.skillId === LANCERS_CHARGE_SKILL_ID) {
        return this.decorateEvolutionEffect(effect, this.createLancersChargePlaceholder(effect))
      }
      if (effect.skillId === MIRRORCAST_SKILL_ID) {
        return this.decorateEvolutionEffect(effect, this.createMirrorcastLinkPlaceholder(effect))
      }
      if (effect.skillId === RAISE_SKELETON_SKILL_ID) {
        return this.decorateEvolutionEffect(effect, this.createBoneBoltPlaceholder(effect))
      }
    }
    if (effect.skillId === BASIC_ATTACK_SKILL_ID) {
      if (effect.shape === 'arc') {
        return this.decorateEvolutionEffect(effect, this.createSwordSwingPlaceholder(effect))
      }
      if (effect.shape === undefined) {
        return this.decorateEvolutionEffect(effect, this.createStaffImpactPlaceholder(effect))
      }
    }
    const visual =
      effect.skillId === BASIC_ATTACK_SKILL_ID
        ? getBasicAttackVariant(effect.basicAttackWeaponArchetype).visual
        : getSkillDefinition(
            isSkillId(effect.skillId)
              ? effect.skillId
              : BASIC_ATTACK_SKILL_ID,
          ).visual
    const view = new Graphics()

    if (effect.shape === 'line') {
      const points = effect.points.length > 0
        ? effect.points
        : [{ x: effect.x, y: effect.y }]
      const start = points[0]
      const end = points[points.length - 1]
      if (start && end) {
        const startX = start.x - effect.x
        const startY = start.y - effect.y
        const endX = end.x - effect.x
        const endY = end.y - effect.y
        view
          .moveTo(startX, startY)
          .lineTo(endX, endY)
          .stroke({ color: visual.primaryColor, width: 12, alpha: 0.3 })
        view
          .moveTo(startX, startY)
          .lineTo(endX, endY)
          .stroke({ color: visual.secondaryColor, width: 4, alpha: 0.95 })
        view
          .circle(endX, endY, 7)
          .fill(visual.outlineColor)
      }
    } else if (effect.shape === 'arc') {
      const points = effect.points.length > 0
        ? effect.points
        : [{ x: effect.x, y: effect.y }]
      if (points.length > 1) {
        view
          .poly(points.flatMap((point) => [
            point.x - effect.x,
            point.y - effect.y,
          ]))
          .fill({ color: visual.primaryColor, alpha: 0.22 })
          .stroke({ color: visual.secondaryColor, width: 4, alpha: 0.95 })
        const outerMidpoint = points[Math.floor(points.length / 2)]
        if (outerMidpoint) {
          const offsetX = outerMidpoint.x - effect.x
          const offsetY = outerMidpoint.y - effect.y
          view
            .moveTo(offsetX * 0.25, offsetY * 0.25)
            .lineTo(offsetX * 0.88, offsetY * 0.88)
            .stroke({ color: visual.outlineColor, width: 5, alpha: 0.9 })
        }
      }
    } else if (visual.kind === 'area') {
      return this.decorateEvolutionEffect(effect, this.createSkillBurstPlaceholder(effect, visual))
    } else if (visual.kind === 'chain') {
      if (effect.skillId === CHAIN_LIGHTNING_SKILL_ID) {
        return this.decorateEvolutionEffect(effect, this.createChainLightningPlaceholder(effect))
      }
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

    return this.decorateEvolutionEffect(effect, view)
  }

  private decorateEvolutionEffect(
    effect: SkillEffectState,
    view: Graphics,
  ): Graphics {
    this.drawEvolutionAccent(view, effect.skillId, Math.max(8, effect.radius * 0.28))
    return view
  }

  private drawEvolutionAccent(
    view: Graphics,
    skillId: SkillEffectState['skillId'],
    radius: number,
  ): void {
    const branch = this.game.state.run.selectedUpgradeIds
      .map((upgradeId) => getUpgradeDefinition(upgradeId))
      .find((upgrade) => upgrade.skillId === skillId && upgrade.branch !== undefined)
      ?.branch
    if (!branch) {
      return
    }
    const isCold = branch.includes('frost') || branch.includes('permafrost') ||
      branch.includes('ice-lance')
    const isFire = branch.includes('ember') || branch.includes('inferno') ||
      branch.includes('cinder')
    const isLightning = branch.includes('overload') || branch.includes('overcharge') ||
      branch.includes('conduit') || branch.includes('precision')
    const isDefense = branch.includes('guard') || branch.includes('bulwark') ||
      branch.includes('last-stand') || branch.includes('commander') ||
      branch.includes('reprisal')
    const isSummon = branch.includes('legion') || branch.includes('rotting') ||
      branch.includes('requiem') || branch.includes('volley') ||
      branch.includes('marksman')
    const isMirror = branch.includes('echo') || branch.includes('exposure') ||
      branch.includes('refraction') || branch.includes('horizon') ||
      branch.includes('convergence')
    const color = isCold
      ? '#bae6fd'
      : isFire
        ? '#fdba74'
        : isLightning
          ? '#fef08a'
          : isDefense
            ? '#67e8f9'
            : isSummon
              ? '#c084fc'
              : isMirror
                ? '#e0f2fe'
                : '#fef08a'
    const markerRadius = Math.max(4, Math.min(18, radius))
    if (isDefense) {
      view
        .poly(createPolygonPoints(markerRadius, 6, Math.PI / 6))
        .stroke({ color, width: 2, alpha: 0.82 })
      return
    }
    if (isCold || isMirror) {
      view
        .poly(createPolygonPoints(markerRadius, 4, Math.PI / 4))
        .stroke({ color, width: 1.8, alpha: 0.82 })
      return
    }
    if (isLightning) {
      view
        .moveTo(-markerRadius, -markerRadius * 0.6)
        .lineTo(-markerRadius * 0.25, markerRadius * 0.25)
        .lineTo(markerRadius * 0.2, -markerRadius * 0.25)
        .lineTo(markerRadius, markerRadius * 0.6)
        .stroke({ color, width: 1.8, alpha: 0.84 })
      return
    }
    view
      .poly(createStarPoints(markerRadius, isFire || isSummon ? 6 : 8, 0.42))
      .stroke({ color, width: 1.8, alpha: 0.82 })
  }

  private createSwordSwingPlaceholder(effect: SkillEffectState): Graphics {
    const visual = getBasicAttackVariant('sword').visual
    const points = effect.points.length > 0
      ? effect.points
      : [{ x: effect.x, y: effect.y }]
    const view = new Graphics()
    if (points.length < 2) {
      return view
    }
    const relativePoints = points.map((point) => ({
      x: point.x - effect.x,
      y: point.y - effect.y,
    }))
    const path = relativePoints.flatMap((point) => [point.x, point.y])
    view
      .poly(path)
      .fill({ color: visual.primaryColor, alpha: 0.16 })
      .stroke({ color: visual.outlineColor, width: 7, alpha: 0.22 })
      .poly(path)
      .stroke({ color: visual.secondaryColor, width: 3, alpha: 0.92 })
    const first = relativePoints[0]!
    const arcPoints = relativePoints.slice(1)
    const fallbackImpact = effect.impactPoint
      ? {
          x: effect.impactPoint.x - effect.x,
          y: effect.impactPoint.y - effect.y,
        }
      : arcPoints[Math.floor(arcPoints.length / 2)] ?? first
    const impactPoints = effect.impactPoints?.length
      ? effect.impactPoints.map((point) => ({
          x: point.x - effect.x,
          y: point.y - effect.y,
        }))
      : [fallbackImpact]
    const impact = impactPoints[0] ?? fallbackImpact
    const directionX = impact.x - first.x
    const directionY = impact.y - first.y
    const length = Math.hypot(directionX, directionY) || 1
    const normalX = -directionY / length
    const normalY = directionX / length
    for (const point of impactPoints) {
      const pointDirectionX = point.x - first.x
      const pointDirectionY = point.y - first.y
      const pointLength = Math.hypot(pointDirectionX, pointDirectionY) || 1
      const pointNormalX = -pointDirectionY / pointLength
      const pointNormalY = pointDirectionX / pointLength
      view
        .moveTo(point.x - pointNormalX * 7, point.y - pointNormalY * 7)
        .lineTo(point.x + pointNormalX * 7, point.y + pointNormalY * 7)
        .stroke({ color: visual.outlineColor, width: 2, alpha: 0.92 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-whirlwind')) {
      view
        .moveTo(first.x, first.y)
        .lineTo(impact.x * 0.72, impact.y * 0.72)
        .stroke({ color: '#fef08a', width: 2, alpha: 0.8 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-chain-lightning')) {
      view
        .moveTo(impact.x * 0.42, impact.y * 0.42)
        .lineTo(impact.x * 0.62 + normalX * 8, impact.y * 0.62 + normalY * 8)
        .lineTo(impact.x * 0.82, impact.y * 0.82)
        .stroke({ color: '#fef08a', width: 1.5, alpha: 0.76 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-glacial-orb')) {
      view
        .poly([
          impact.x * 0.72,
          impact.y * 0.72 - 6,
          impact.x * 0.72 + 5,
          impact.y * 0.72,
          impact.x * 0.72,
          impact.y * 0.72 + 6,
          impact.x * 0.72 - 5,
          impact.y * 0.72,
        ])
        .stroke({ color: '#bae6fd', width: 1.5, alpha: 0.72 })
    }
    return view
  }

  private createStaffImpactPlaceholder(effect: SkillEffectState): Graphics {
    const visual = getBasicAttackVariant('staff').visual
    const radius = Math.max(1, effect.radius)
    const view = new Graphics()
      .poly(createPolygonPoints(radius, 8, Math.PI / 8))
      .fill({ color: visual.primaryColor, alpha: 0.12 })
      .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.78 })
      .poly(createPolygonPoints(radius * 0.72, 6, Math.PI / 6))
      .fill({ color: visual.primaryColor, alpha: 0.24 })
      .stroke({ color: visual.outlineColor, width: 2, alpha: 0.9 })
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6
      const inner = radius * 0.26
      const outer = radius * 0.9
      view
        .moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
        .lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
        .stroke({ color: index % 2 === 0 ? '#84cc16' : visual.secondaryColor, width: 2, alpha: 0.78 })
    }
    view
      .poly(createStarPoints(radius * 0.32, 6, 0.45))
      .fill({ color: '#84cc16', alpha: 0.72 })
      .stroke({ color: visual.outlineColor, width: 1.5, alpha: 0.9 })
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-glacial-orb')) {
      view
        .poly(createPolygonPoints(radius * 0.52, 6, Math.PI / 6))
        .stroke({ color: '#bae6fd', width: 2, alpha: 0.72 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-chain-lightning')) {
      view
        .moveTo(-radius * 0.6, -radius * 0.5)
        .lineTo(-radius * 0.12, radius * 0.18)
        .lineTo(radius * 0.42, -radius * 0.18)
        .stroke({ color: '#fef08a', width: 1.5, alpha: 0.76 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-whirlwind')) {
      view
        .poly(createPolygonPoints(radius * 0.88, 4, Math.PI / 4))
        .stroke({ color: '#fef08a', width: 1.5, alpha: 0.72 })
    }
    return view
  }

  private createSkillBurstPlaceholder(
    effect: SkillEffectState,
    visual: ReturnType<typeof getSkillDefinition>['visual'],
  ): Graphics {
    if (effect.skillId === FIERY_TOUCH_SKILL_ID) {
      return this.createFieryTouchBurst(effect, visual)
    }
    if (effect.skillId === GLACIAL_ORB_SKILL_ID) {
      return this.createGlacialOrbBurst(effect, visual)
    }
    if (effect.skillId === WHIRLWIND_SKILL_ID) {
      return this.createWhirlwindBurst(effect, visual)
    }
    if (effect.skillId === GRAVITY_WELL_SKILL_ID) {
      return this.createGravityWellBurst(effect, visual)
    }
    if (effect.skillId === AEGIS_PULSE_SKILL_ID) {
      return this.createAegisPulseBurst(effect, visual)
    }
    if (effect.skillId === CINDER_MINE_SKILL_ID) {
      return this.createCinderMineBurst(effect, visual)
    }

    const radius = Math.max(1, effect.radius)
    return new Graphics()
      .poly(createStarPoints(radius, 12, 0.8))
      .fill({ color: visual.primaryColor, alpha: 0.28 })
      .stroke({ color: visual.outlineColor, width: 3, alpha: 0.9 })
      .poly(createStarPoints(radius * 0.7, 12, 0.7))
      .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.85 })
  }

  private createFieryTouchBurst(
    effect: SkillEffectState,
    visual: ReturnType<typeof getSkillDefinition>['visual'],
  ): Graphics {
    const radius = Math.max(1, effect.radius)
    const view = new Graphics()
    view
      .poly(createStarPoints(radius, 14, 0.58))
      .fill({ color: visual.primaryColor, alpha: 0.62 })
      .stroke({ color: visual.outlineColor, width: 3, alpha: 0.92 })
      .poly(createStarPoints(radius * 0.67, 10, 0.64))
      .fill({ color: visual.secondaryColor, alpha: 0.58 })
      .stroke({ color: visual.outlineColor, width: 2, alpha: 0.82 })
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 - Math.PI / 2
      const inner = radius * 0.34
      const outer = radius * (0.72 + (index % 2) * 0.12)
      view
        .poly([
          Math.cos(angle - 0.16) * inner,
          Math.sin(angle - 0.16) * inner,
          Math.cos(angle) * outer,
          Math.sin(angle) * outer,
          Math.cos(angle + 0.16) * inner,
          Math.sin(angle + 0.16) * inner,
        ])
        .fill({ color: index % 2 === 0 ? visual.secondaryColor : visual.primaryColor, alpha: 0.75 })
        .stroke({ color: visual.outlineColor, width: 1, alpha: 0.75 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-fiery-touch-glacial-orb')) {
      view
        .poly(createPolygonPoints(radius * 0.48, 6, Math.PI / 6))
        .stroke({ color: '#38bdf8', width: 2, alpha: 0.78 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-fiery-touch-gravity-well')) {
      view
        .poly(createPolygonPoints(radius * 1.08, 8, Math.PI / 8))
        .stroke({ color: '#c4b5fd', width: 2, alpha: 0.6 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-cinder-mine-fiery-touch')) {
      view
        .poly(createStarPoints(radius * 0.86, 8, 0.42, Math.PI / 8))
        .stroke({ color: '#facc15', width: 2, alpha: 0.7 })
    }
    return view
  }

  private createGlacialOrbBurst(
    effect: SkillEffectState,
    visual: ReturnType<typeof getSkillDefinition>['visual'],
  ): Graphics {
    const radius = Math.max(1, effect.radius)
    const view = new Graphics()
      .poly(createStarPoints(radius, 12, 0.72, Math.PI / 12))
      .fill({ color: visual.primaryColor, alpha: 0.28 })
      .stroke({ color: visual.outlineColor, width: 3, alpha: 0.9 })
      .poly(createStarPoints(radius * 0.54, 6, 0.82, Math.PI / 6))
      .fill({ color: visual.secondaryColor, alpha: 0.72 })
      .stroke({ color: visual.outlineColor, width: 2, alpha: 0.9 })
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6
      const inner = radius * 0.3
      const outer = radius * 0.9
      view
        .moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
        .lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
        .stroke({ color: visual.outlineColor, width: 2, alpha: 0.8 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-chain-lightning-glacial-orb')) {
      view
        .moveTo(-radius * 0.78, 0)
        .lineTo(-radius * 0.38, -radius * 0.18)
        .lineTo(0, 0)
        .lineTo(radius * 0.38, radius * 0.18)
        .lineTo(radius * 0.78, 0)
        .stroke({ color: '#fef08a', width: 2, alpha: 0.78 })
    }
    return view
  }

  private createWhirlwindBurst(
    effect: SkillEffectState,
    visual: ReturnType<typeof getSkillDefinition>['visual'],
  ): Graphics {
    const radius = Math.max(1, effect.radius)
    const view = new Graphics()
    for (let index = 0; index < 4; index += 1) {
      const angle = (Math.PI * 2 * index) / 4 + 0.28
      const inner = radius * 0.18
      const outer = radius * (0.78 + (index % 2) * 0.12)
      view
        .poly([
          Math.cos(angle - 0.3) * inner,
          Math.sin(angle - 0.3) * inner,
          Math.cos(angle - 0.08) * outer,
          Math.sin(angle - 0.08) * outer,
          Math.cos(angle + 0.22) * outer * 0.82,
          Math.sin(angle + 0.22) * outer * 0.82,
          Math.cos(angle + 0.42) * inner,
          Math.sin(angle + 0.42) * inner,
        ])
        .fill({ color: index % 2 === 0 ? visual.primaryColor : visual.secondaryColor, alpha: 0.42 })
        .stroke({ color: visual.outlineColor, width: 2, alpha: 0.85 })
    }
    view
      .circle(0, 0, radius * 0.2)
      .fill({ color: visual.secondaryColor, alpha: 0.78 })
      .stroke({ color: visual.outlineColor, width: 2 })
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-basic-attack-whirlwind')) {
      view
        .poly(createPolygonPoints(radius * 0.34, 4, Math.PI / 4))
        .stroke({ color: '#fef08a', width: 2, alpha: 0.72 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-whirlwind-lancers-charge')) {
      view
        .poly(createStarPoints(radius * 0.92, 8, 0.62, Math.PI / 8))
        .stroke({ color: '#fdba74', width: 2, alpha: 0.72 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-whirlwind-aegis-pulse')) {
      view
        .poly(createPolygonPoints(radius * 0.48, 6, Math.PI / 6))
        .stroke({ color: '#67e8f9', width: 2, alpha: 0.82 })
    }
    return view
  }

  private createGravityWellBurst(
    effect: SkillEffectState,
    visual: ReturnType<typeof getSkillDefinition>['visual'],
  ): Graphics {
    const radius = Math.max(1, effect.radius)
    const view = new Graphics()
      .poly(createPolygonPoints(radius, 9, Math.PI / 2))
      .fill({ color: visual.primaryColor, alpha: 0.22 })
      .stroke({ color: visual.secondaryColor, width: 3, alpha: 0.8 })
      .poly(createPolygonPoints(radius * 0.66, 8, Math.PI / 8))
      .fill({ color: '#1e1b4b', alpha: 0.64 })
      .stroke({ color: visual.outlineColor, width: 2, alpha: 0.72 })
      .poly(createPolygonPoints(radius * 0.28, 6, 0))
      .fill({ color: visual.outlineColor, alpha: 0.42 })
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6
      const start = radius * 0.86
      const end = radius * 0.58
      view
        .moveTo(Math.cos(angle) * start, Math.sin(angle) * start)
        .lineTo(Math.cos(angle + 0.16) * end, Math.sin(angle + 0.16) * end)
        .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.76 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-chain-lightning-gravity-well')) {
      view
        .poly(createPolygonPoints(radius * 1.08, 6, Math.PI / 6))
        .stroke({ color: '#67e8f9', width: 2, alpha: 0.7 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-raise-skeleton-gravity-well')) {
      view
        .moveTo(-radius * 0.25, -radius * 0.74)
        .lineTo(-radius * 0.25, radius * 0.74)
        .moveTo(radius * 0.25, -radius * 0.74)
        .lineTo(radius * 0.25, radius * 0.74)
        .stroke({ color: '#e9d5ff', width: 2, alpha: 0.68 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-fiery-touch-gravity-well')) {
      view
        .poly(createStarPoints(radius * 1.16, 8, 0.7, Math.PI / 8))
        .stroke({ color: '#fb923c', width: 1.5, alpha: 0.62 })
    }
    return view
  }

  private createAegisPulseBurst(
    effect: SkillEffectState,
    visual: ReturnType<typeof getSkillDefinition>['visual'],
  ): Graphics {
    const radius = Math.max(1, effect.radius)
    const shieldPoints = [
      0, -radius * 0.84,
      radius * 0.62, -radius * 0.4,
      radius * 0.48, radius * 0.48,
      0, radius * 0.84,
      -radius * 0.48, radius * 0.48,
      -radius * 0.62, -radius * 0.4,
    ]
    const view = new Graphics()
      .poly(createStarPoints(radius, 12, 0.86))
      .fill({ color: visual.primaryColor, alpha: 0.18 })
      .stroke({ color: visual.secondaryColor, width: 3, alpha: 0.78 })
      .poly(shieldPoints)
      .fill({ color: visual.primaryColor, alpha: 0.48 })
      .stroke({ color: visual.outlineColor, width: 3, alpha: 0.95 })
      .moveTo(0, -radius * 0.48)
      .lineTo(0, radius * 0.52)
      .moveTo(-radius * 0.28, 0)
      .lineTo(radius * 0.28, 0)
      .stroke({ color: visual.outlineColor, width: 2, alpha: 0.9 })
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-vitality-aegis-pulse')) {
      view
        .poly(createPolygonPoints(radius * 0.54, 6, Math.PI / 6))
        .stroke({ color: '#86efac', width: 2, alpha: 0.78 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-whirlwind-aegis-pulse')) {
      view
        .poly(createStarPoints(radius * 1.1, 8, 0.82, Math.PI / 8))
        .stroke({ color: '#fdba74', width: 1.5, alpha: 0.68 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-lancers-charge-aegis-pulse')) {
      view
        .poly([
          0, -radius * 1.22,
          radius * 0.18, -radius * 0.7,
          0, -radius * 0.42,
          -radius * 0.18, -radius * 0.7,
        ])
        .fill({ color: '#fb923c', alpha: 0.42 })
        .stroke({ color: '#fed7aa', width: 1.5, alpha: 0.76 })
    }
    return view
  }

  private createCinderMineBurst(
    effect: SkillEffectState,
    visual: ReturnType<typeof getSkillDefinition>['visual'],
  ): Graphics {
    const radius = Math.max(1, effect.radius)
    const definition = getSkillDefinition(CINDER_MINE_SKILL_ID)
    const arming = effect.lifetime > definition.effectLifetime * 2
    if (arming) {
      return new Graphics()
        .poly(createPolygonPoints(radius, 8, Math.PI / 8))
        .fill({ color: visual.primaryColor, alpha: 0.08 })
        .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.55 })
        .poly(createPolygonPoints(radius * 0.52, 8, 0))
        .stroke({ color: visual.outlineColor, width: 2, alpha: 0.78 })
        .moveTo(-radius * 0.72, 0)
        .lineTo(radius * 0.72, 0)
        .moveTo(0, -radius * 0.72)
        .lineTo(0, radius * 0.72)
        .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.6 })
    }
    return new Graphics()
      .poly(createStarPoints(radius, 18, 0.5))
      .fill({ color: visual.primaryColor, alpha: 0.58 })
      .stroke({ color: visual.outlineColor, width: 3, alpha: 0.9 })
      .poly(createStarPoints(radius * 0.62, 10, 0.72))
      .fill({ color: visual.secondaryColor, alpha: 0.76 })
      .stroke({ color: visual.outlineColor, width: 2, alpha: 0.86 })
      .moveTo(-radius * 0.72, radius * 0.42)
      .lineTo(radius * 0.72, -radius * 0.42)
      .stroke({
        color: this.game.state.run.selectedUpgradeIds.includes('synergy-rift-javelin-cinder-mine')
          ? '#c4b5fd'
          : visual.outlineColor,
        width: this.game.state.run.selectedUpgradeIds.includes('synergy-rift-javelin-cinder-mine')
          ? 3
          : 1,
        alpha: this.game.state.run.selectedUpgradeIds.includes('synergy-rift-javelin-cinder-mine')
          ? 0.72
          : 0,
      })
  }

  private createStormRelayStrikePlaceholder(effect: SkillEffectState): Graphics {
    const visual = getSkillDefinition(STORM_RELAY_SKILL_ID).visual
    const points = effect.points.length > 0
      ? effect.points
      : [{ x: effect.x, y: effect.y }]
    const view = new Graphics()
    const origin = points[0]
    if (!origin) {
      return view
    }

    const relativePoints = points.map((point) => ({
      x: point.x - effect.x,
      y: point.y - effect.y,
    }))
    view.moveTo(relativePoints[0]!.x, relativePoints[0]!.y)
    for (let index = 1; index < relativePoints.length; index += 1) {
      const point = relativePoints[index]!
      const previous = relativePoints[index - 1]!
      const midX = (previous.x + point.x) / 2
      const midY = (previous.y + point.y) / 2
      const segmentX = point.x - previous.x
      const segmentY = point.y - previous.y
      const segmentLength = Math.hypot(segmentX, segmentY) || 1
      const offset = index % 2 === 0 ? 9 : -9
      view
        .lineTo(
          midX - (segmentY / segmentLength) * offset,
          midY + (segmentX / segmentLength) * offset,
        )
        .lineTo(point.x, point.y)
    }
    view
      .stroke({ color: visual.outlineColor, width: 11, alpha: 0.14 })
      .moveTo(relativePoints[0]!.x, relativePoints[0]!.y)
    for (let index = 1; index < relativePoints.length; index += 1) {
      const point = relativePoints[index]!
      const previous = relativePoints[index - 1]!
      const midX = (previous.x + point.x) / 2
      const midY = (previous.y + point.y) / 2
      const segmentX = point.x - previous.x
      const segmentY = point.y - previous.y
      const segmentLength = Math.hypot(segmentX, segmentY) || 1
      const offset = index % 2 === 0 ? 9 : -9
      view
        .lineTo(
          midX - (segmentY / segmentLength) * offset,
          midY + (segmentX / segmentLength) * offset,
        )
        .lineTo(point.x, point.y)
    }
    view.stroke({ color: visual.secondaryColor, width: 3, alpha: 0.95 })
    for (const point of relativePoints.slice(1)) {
      view
        .poly([point.x, point.y - 7, point.x + 7, point.y, point.x, point.y + 7, point.x - 7, point.y])
        .fill({ color: visual.primaryColor, alpha: 0.8 })
        .stroke({ color: visual.outlineColor, width: 1.5 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-cinder-mine-storm-relay')) {
      view
        .moveTo(relativePoints[0]!.x, relativePoints[0]!.y)
        .lineTo(relativePoints[relativePoints.length - 1]!.x, relativePoints[relativePoints.length - 1]!.y)
        .stroke({ color: '#fb923c', width: 1.5, alpha: 0.7 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-storm-relay-soul-tether')) {
      view
        .moveTo(relativePoints[0]!.x + 5, relativePoints[0]!.y)
        .lineTo(relativePoints[relativePoints.length - 1]!.x + 5, relativePoints[relativePoints.length - 1]!.y)
        .stroke({ color: '#f0abfc', width: 1.5, alpha: 0.68 })
    }
    return view
  }

  private createChainLightningPlaceholder(effect: SkillEffectState): Graphics {
    const visual = getSkillDefinition(CHAIN_LIGHTNING_SKILL_ID).visual
    const points = effect.points.length > 0
      ? effect.points
      : [{ x: effect.x, y: effect.y }]
    const view = new Graphics()
    const relativePoints = points.map((point) => ({
      x: point.x - effect.x,
      y: point.y - effect.y,
    }))
    const drawArc = (width: number, color: string, alpha: number): void => {
      const origin = relativePoints[0]
      if (!origin) {
        return
      }
      view.moveTo(origin.x, origin.y)
      for (let index = 1; index < relativePoints.length; index += 1) {
        const previous = relativePoints[index - 1]!
        const point = relativePoints[index]!
        const segmentX = point.x - previous.x
        const segmentY = point.y - previous.y
        const segmentLength = Math.hypot(segmentX, segmentY) || 1
        const offset = index % 2 === 0 ? 7 : -7
        view
          .lineTo(
            (previous.x + point.x) / 2 - (segmentY / segmentLength) * offset,
            (previous.y + point.y) / 2 + (segmentX / segmentLength) * offset,
          )
          .lineTo(point.x, point.y)
      }
      view.stroke({ color, width, alpha })
    }
    drawArc(10, visual.outlineColor, 0.16)
    drawArc(3, visual.secondaryColor, 0.92)
    for (const point of relativePoints.slice(1)) {
      view
        .poly([point.x, point.y - 6, point.x + 6, point.y, point.x, point.y + 6, point.x - 6, point.y])
        .fill({ color: visual.primaryColor, alpha: 0.85 })
        .stroke({ color: visual.outlineColor, width: 1.5 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-chain-lightning-glacial-orb')) {
      for (const point of relativePoints.slice(1)) {
        view
          .poly([point.x, point.y - 6, point.x + 4, point.y, point.x, point.y + 6, point.x - 4, point.y])
          .stroke({ color: '#bae6fd', width: 1.5, alpha: 0.72 })
      }
    }
    return view
  }

  private createLancersChargePlaceholder(effect: SkillEffectState): Graphics {
    const visual = getSkillDefinition(LANCERS_CHARGE_SKILL_ID).visual
    const points = effect.points.length > 0
      ? effect.points
      : [{ x: effect.x, y: effect.y }]
    const start = points[0]
    const end = points[points.length - 1]
    const view = new Graphics()
    if (!start || !end) {
      return view
    }
    const endX = end.x - effect.x
    const endY = end.y - effect.y
    const directionX = endX - (start.x - effect.x)
    const directionY = endY - (start.y - effect.y)
    const length = Math.hypot(directionX, directionY) || 1
    const forwardX = directionX / length
    const forwardY = directionY / length
    const normalX = -forwardY
    const normalY = forwardX
    const width = Math.max(8, effect.radius)
    const startX = start.x - effect.x
    const startY = start.y - effect.y
    const spearTipX = endX + forwardX * width * 0.72
    const spearTipY = endY + forwardY * width * 0.72
    view
      .poly([
        startX + normalX * width,
        startY + normalY * width,
        endX + normalX * width * 0.62,
        endY + normalY * width * 0.62,
        spearTipX,
        spearTipY,
        endX - normalX * width * 0.62,
        endY - normalY * width * 0.62,
        startX - normalX * width,
        startY - normalY * width,
      ])
      .fill({ color: visual.primaryColor, alpha: 0.28 })
      .stroke({ color: visual.outlineColor, width: 3, alpha: 0.9 })
    for (let index = 1; index < 4; index += 1) {
      const progress = index / 4
      const centerX = startX + directionX * progress
      const centerY = startY + directionY * progress
      view
        .moveTo(centerX + normalX * width * 0.55, centerY + normalY * width * 0.55)
        .lineTo(centerX - normalX * width * 0.55, centerY - normalY * width * 0.55)
        .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.78 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-lancers-charge-aegis-pulse')) {
      view
        .poly([
          endX + normalX * width * 0.8,
          endY + normalY * width * 0.8,
          spearTipX,
          spearTipY,
          endX - normalX * width * 0.8,
          endY - normalY * width * 0.8,
        ])
        .stroke({ color: '#67e8f9', width: 2, alpha: 0.8 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-rift-javelin-lancers-charge')) {
      view
        .moveTo(startX + normalX * width * 0.74, startY + normalY * width * 0.74)
        .lineTo(endX + normalX * width * 0.34, endY + normalY * width * 0.34)
        .moveTo(startX - normalX * width * 0.74, startY - normalY * width * 0.74)
        .lineTo(endX - normalX * width * 0.34, endY - normalY * width * 0.34)
        .stroke({ color: '#fef08a', width: 1.5, alpha: 0.72 })
    }
    return view
  }

  private createMirrorcastLinkPlaceholder(effect: SkillEffectState): Graphics {
    const visual = getSkillDefinition(MIRRORCAST_SKILL_ID).visual
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
      .stroke({ color: visual.primaryColor, width: 9, alpha: 0.12 })
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.78 })
    const shardCount = Math.max(2, Math.min(5, Math.floor(length / 42)))
    for (let index = 1; index <= shardCount; index += 1) {
      const progress = index / (shardCount + 1)
      const centerX = startX + directionX * progress
      const centerY = startY + directionY * progress
      const size = 7 + (index % 2) * 2
      view
        .poly([
          centerX + normalX * size,
          centerY + normalY * size,
          centerX + directionX / length * size,
          centerY + directionY / length * size,
          centerX - normalX * size,
          centerY - normalY * size,
          centerX - directionX / length * size,
          centerY - directionY / length * size,
        ])
        .fill({ color: visual.primaryColor, alpha: 0.34 })
        .stroke({ color: visual.outlineColor, width: 1.5, alpha: 0.85 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-whirlwind-mirrorcast')) {
      view
        .moveTo(startX + normalX * 8, startY + normalY * 8)
        .lineTo(endX + normalX * 8, endY + normalY * 8)
        .stroke({ color: '#f0abfc', width: 1, alpha: 0.62 })
        .moveTo(startX - normalX * 8, startY - normalY * 8)
        .lineTo(endX - normalX * 8, endY - normalY * 8)
        .stroke({ color: '#38bdf8', width: 1, alpha: 0.62 })
    }
    return view
  }

  private createBoneBoltPlaceholder(effect: SkillEffectState): Graphics {
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

  private createVitalityPlaceholder(effect: SkillEffectState): Graphics {
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

  private createSkeletonRitualPlaceholder(effect: SkillEffectState): Graphics {
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

  private createBloodPulsePlaceholder(effect: SkillEffectState): Graphics {
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

  private createSigilCastPlaceholder(effect: SkillEffectState): Graphics {
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

  private createMirrorcastCastPlaceholder(effect: SkillEffectState): Graphics {
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

  private createImpactParticlePlaceholder(effect: SkillEffectState): Graphics {
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

  private createPhantomSummonPlaceholder(effect: SkillEffectState): Graphics {
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

  private createPrismBeamPlaceholder(effect: SkillEffectState): Graphics {
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

  private createSoulTetherPlaceholder(effect: SkillEffectState): Graphics {
    const visual = getSkillDefinition(SOUL_TETHER_SKILL_ID).visual
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
    view
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({ color: visual.primaryColor, width: 12, alpha: 0.2 })
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({ color: visual.secondaryColor, width: 3, alpha: 0.85 })

    for (let index = 1; index < 7; index += 1) {
      const progress = index / 7
      const x = startX + (endX - startX) * progress
      const y = startY + (endY - startY) * progress
      view
        .circle(x, y, 5)
        .fill(visual.primaryColor)
        .stroke({ color: visual.outlineColor, width: 1.5 })
    }
    view
      .circle(startX, startY, 8)
      .fill({ color: visual.primaryColor, alpha: 0.65 })
      .stroke({ color: visual.outlineColor, width: 2 })
      .circle(endX, endY, 8)
      .fill({ color: visual.secondaryColor, alpha: 0.8 })
      .stroke({ color: visual.outlineColor, width: 2 })
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-fiery-touch-soul-tether')) {
      view
        .moveTo(startX, startY)
        .lineTo(endX, endY)
        .stroke({ color: '#fb923c', width: 1.5, alpha: 0.72 })
        .poly([
          endX,
          endY - 8,
          endX + 8,
          endY,
          endX,
          endY + 8,
          endX - 8,
          endY,
        ])
        .fill({ color: '#f97316', alpha: 0.42 })
        .stroke({ color: '#fed7aa', width: 1, alpha: 0.78 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-soul-tether-vitality')) {
      view
        .moveTo(startX, startY)
        .lineTo(endX, endY)
        .stroke({ color: '#86efac', width: 1.5, alpha: 0.62 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-storm-relay-soul-tether')) {
      view
        .moveTo(startX, startY)
        .lineTo(endX, endY)
        .stroke({ color: '#67e8f9', width: 1, alpha: 0.72 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-soul-tether-phantom-arsenal')) {
      view
        .poly([
          endX,
          endY - 7,
          endX + 7,
          endY,
          endX,
          endY + 7,
          endX - 7,
          endY,
        ])
        .stroke({ color: '#bfdbfe', width: 1.5, alpha: 0.72 })
    }
    return view
  }

  private createCinderMinePlaceholder(trap: Readonly<TrapState>): Graphics {
    const view = new Graphics()
    this.drawCinderMine(view, trap, 0)
    return view
  }

  private drawCinderMine(
    view: Graphics,
    trap: Readonly<TrapState>,
    time: number,
  ): void {
    const visual = getSkillDefinition(CINDER_MINE_SKILL_ID).visual
    const animationTime = this.reducedMotion ? 0 : time
    const armed = trap.fuseRemaining <= 0
    const pulse = armed
      ? 1 + Math.sin(animationTime * 12 + trap.id) * 0.08
      : 1 + Math.sin(animationTime * 8 + trap.id) * 0.04
    const mineRadius = 14 * pulse
    view.clear()
    view
      .poly(createPolygonPoints(trap.radius, 8, Math.PI / 8))
      .stroke({
        color: visual.primaryColor,
        width: armed ? 3 : 2,
        alpha: armed ? 0.42 : 0.2,
      })
      .poly([
        0, -mineRadius,
        mineRadius * 0.72, -mineRadius * 0.34,
        mineRadius * 0.62, mineRadius * 0.62,
        0, mineRadius,
        -mineRadius * 0.62, mineRadius * 0.62,
        -mineRadius * 0.72, -mineRadius * 0.34,
      ])
      .fill({ color: visual.primaryColor, alpha: armed ? 0.9 : 0.55 })
      .stroke({ color: visual.outlineColor, width: 2 })
      .poly(createPolygonPoints(mineRadius * 0.42, 6, Math.PI / 6))
      .fill(visual.secondaryColor)
      .stroke({ color: visual.outlineColor, width: 1.5, alpha: 0.9 })
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2
      const inner = mineRadius * 0.72
      const outer = mineRadius * 1.1
      view
        .poly([
          Math.cos(angle - 0.14) * inner,
          Math.sin(angle - 0.14) * inner,
          Math.cos(angle) * outer,
          Math.sin(angle) * outer,
          Math.cos(angle + 0.14) * inner,
          Math.sin(angle + 0.14) * inner,
        ])
        .fill({ color: index % 2 === 0 ? visual.secondaryColor : visual.primaryColor, alpha: armed ? 0.85 : 0.45 })
        .stroke({ color: visual.outlineColor, width: 1, alpha: 0.72 })
    }
    if (!armed) {
      view
        .moveTo(-mineRadius * 0.32, mineRadius * 0.08)
        .lineTo(mineRadius * 0.32, mineRadius * 0.08)
        .moveTo(0, -mineRadius * 0.32)
        .lineTo(0, mineRadius * 0.38)
        .stroke({ color: visual.outlineColor, width: 2 })
    } else {
      view
        .poly(createPolygonPoints(trap.radius * 0.72, 8, Math.PI / 8))
        .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.7 })
        .poly(createStarPoints(trap.radius * 0.32, 8, 0.4))
        .fill({ color: visual.outlineColor, alpha: 0.72 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-rift-javelin-cinder-mine')) {
      view
        .moveTo(-mineRadius * 1.12, 0)
        .lineTo(mineRadius * 1.12, 0)
        .stroke({ color: '#c4b5fd', width: 2, alpha: 0.68 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-cinder-mine-storm-relay')) {
      view
        .moveTo(-mineRadius * 0.9, -mineRadius * 0.5)
        .lineTo(-mineRadius * 0.42, -mineRadius * 0.08)
        .lineTo(-mineRadius * 0.12, -mineRadius * 0.34)
        .stroke({ color: '#38bdf8', width: 1.5, alpha: 0.76 })
    }
    this.drawEvolutionAccent(view, CINDER_MINE_SKILL_ID, mineRadius * 0.7)
  }

  private createStormRelayPlaceholder(relay: Readonly<RelayState>): Graphics {
    const view = new Graphics()
    this.drawStormRelay(view, relay, 0)
    return view
  }

  private drawStormRelay(
    view: Graphics,
    relay: Readonly<RelayState>,
    time: number,
  ): void {
    const visual = getSkillDefinition(STORM_RELAY_SKILL_ID).visual
    const animationTime = this.reducedMotion ? 0 : time
    const pulse = 1 + Math.sin(animationTime * 7 + relay.id) * 0.08
    const radius = 26 * pulse
    view.clear()
    view
      .circle(0, 0, radius)
      .stroke({ color: visual.primaryColor, width: 2, alpha: 0.28 })
      .circle(0, 0, radius * 0.72)
      .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.45 })
      .rect(-5, -18, 10, 36)
      .fill({ color: visual.primaryColor, alpha: 0.9 })
      .stroke({ color: visual.outlineColor, width: 2 })
      .poly([
        -10, -18,
        0, -29,
        10, -18,
        0, -8,
      ])
      .fill(visual.secondaryColor)
      .stroke({ color: visual.outlineColor, width: 2 })

    for (let index = 0; index < 3; index += 1) {
      const angle = animationTime * 1.8 + (Math.PI * 2 * index) / 3
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      view
        .moveTo(0, 0)
        .lineTo(x, y)
        .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.75 })
        .circle(x, y, 4)
        .fill(visual.primaryColor)
        .stroke({ color: visual.outlineColor, width: 1.5 })
    }
    if (relay.spectrumForkPrimed) {
      view
        .poly(createPolygonPoints(radius * 1.28, 6, animationTime * 0.8))
        .stroke({ color: '#fef08a', width: 2, alpha: 0.82 })
        .poly(createPolygonPoints(radius * 1.05, 6, -animationTime * 0.8))
        .stroke({ color: '#38bdf8', width: 1.5, alpha: 0.72 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-storm-relay-rallying-banner')) {
      view
        .poly(createPolygonPoints(radius * 1.42, 4, Math.PI / 4))
        .stroke({ color: '#fef08a', width: 1.5, alpha: 0.58 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-storm-relay-soul-tether')) {
      view
        .poly(createPolygonPoints(radius * 1.18, 8, -animationTime * 1.2))
        .stroke({ color: '#f0abfc', width: 1.5, alpha: 0.62 })
    }
    this.drawEvolutionAccent(view, STORM_RELAY_SKILL_ID, radius * 0.7)
  }

  private drawRuinSigil(
    view: Graphics,
    sigil: Readonly<RuinSigilState>,
    time: number,
  ): void {
    const visual = getSkillDefinition(SIGIL_OF_RUIN_SKILL_ID).visual
    const animationTime = this.reducedMotion ? 0 : time
    const pulse = 1 + Math.sin(animationTime * 6 + sigil.id) * 0.12
    const radius = 20 * pulse
    view.clear()
    view
      .circle(0, 0, radius)
      .fill({ color: visual.primaryColor, alpha: 0.16 })
      .stroke({ color: visual.primaryColor, width: 2, alpha: 0.75 })
      .circle(0, 0, radius * 0.66)
      .stroke({ color: visual.secondaryColor, width: 1.5, alpha: 0.85 })
    const spokes = 6
    for (let index = 0; index < spokes; index += 1) {
      const angle = animationTime * 1.5 + (Math.PI * 2 * index) / spokes
      const innerRadius = radius * 0.32
      const outerRadius = radius * 0.95
      view
        .moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius)
        .lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius)
        .stroke({ color: visual.secondaryColor, width: 1.5, alpha: 0.7 })
    }
    // Charge pips arranged along the top of the sigil.
    for (let index = 0; index < 3; index += 1) {
      const filled = index < sigil.charges
      const pipX = (index - 1) * 8
      const pipY = -radius - 8
      view
        .circle(pipX, pipY, 3)
        .fill({
          color: filled ? visual.outlineColor : visual.primaryColor,
          alpha: filled ? 0.95 : 0.3,
        })
        .stroke({ color: visual.outlineColor, width: 1, alpha: 0.8 })
    }
    if (sigil.armed) {
      view
        .circle(0, 0, radius * 1.2)
        .stroke({ color: visual.outlineColor, width: 1.5, alpha: 0.5 })
    }
    if (sigil.conductiveChargeAdded) {
      view
        .poly(createPolygonPoints(radius * 1.26, 3, -Math.PI / 2))
        .stroke({ color: '#67e8f9', width: 2, alpha: 0.85 })
        .moveTo(-radius * 0.85, radius * 0.15)
        .lineTo(0, -radius * 1.35)
        .lineTo(radius * 0.85, radius * 0.15)
        .stroke({ color: '#22d3ee', width: 1.5, alpha: 0.7 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-sigil-of-ruin-prism-halo')) {
      const prismColors = ['#f97316', '#38bdf8', '#fef08a'] as const
      for (let index = 0; index < 3; index += 1) {
        const angle = animationTime * 0.8 + (Math.PI * 2 * index) / 3
        view
          .poly(createPolygonPoints(radius * 1.42, 3, angle))
          .stroke({ color: prismColors[index]!, width: 1.5, alpha: 0.78 })
      }
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-sigil-of-ruin-blood-rite')) {
      view
        .poly(createStarPoints(radius * 1.34, 6, 0.35, Math.PI / 6))
        .stroke({ color: '#f87171', width: 1.5, alpha: 0.72 })
    }
    this.drawEvolutionAccent(view, SIGIL_OF_RUIN_SKILL_ID, radius * 0.7)
  }

  private createWirePlaceholder(wire: Readonly<WireState>): Graphics {
    const view = new Graphics()
    this.drawRazorwire(view, wire, 0)
    return view
  }

  private drawRazorwire(
    view: Graphics,
    wire: Readonly<WireState>,
    time: number,
  ): void {
    const visual = getSkillDefinition(RAZORWIRE_SKILL_ID).visual
    const animationTime = this.reducedMotion ? 0 : time
    const startX = 0
    const startY = 0
    const endX = wire.bx - wire.ax
    const endY = wire.by - wire.ay
    view.clear()
    // The taut wire between anchors, with a shimmering highlight pass.
    view
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({ color: visual.primaryColor, width: 3, alpha: 0.75 })
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({ color: visual.secondaryColor, width: 1, alpha: 0.9 })
    // Barbs jutting from the wire at regular intervals.
    const dirX = endX - startX
    const dirY = endY - startY
    const length = Math.hypot(dirX, dirY)
    if (length > 0) {
      const normalX = -dirY / length
      const normalY = dirX / length
      const barbCount = Math.max(2, Math.floor(length / 22))
      for (let index = 1; index < barbCount; index += 1) {
        const progress = index / barbCount
        const bx = startX + dirX * progress
        const by = startY + dirY * progress
        const side = index % 2 === 0 ? 1 : -1
        const flick = 4 + Math.sin(animationTime * 8 + wire.id + index) * 1.5
        view
          .moveTo(bx, by)
          .lineTo(bx + normalX * flick * side, by + normalY * flick * side)
          .stroke({ color: visual.outlineColor, width: 1, alpha: 0.7 })
      }
    }
    // Two solid anchor posts.
    for (const [ax, ay] of [[startX, startY], [endX, endY]] as const) {
      view
        .circle(ax, ay, 6)
        .fill({ color: visual.primaryColor, alpha: 0.95 })
        .stroke({ color: visual.outlineColor, width: 2 })
        .circle(ax, ay, 2.5)
        .fill(visual.secondaryColor)
    }
    if (wire.guillotine) {
      view
        .moveTo(startX, startY)
        .lineTo(endX, endY)
        .stroke({ color: visual.outlineColor, width: 6, alpha: 0.12 })
    }
    if ((wire.frostedRemainingDuration ?? 0) > 0) {
      view
        .moveTo(startX, startY)
        .lineTo(endX, endY)
        .stroke({ color: '#bae6fd', width: 8, alpha: 0.28 })
      for (let index = 1; index < 4; index += 1) {
        const progress = index / 4
        const x = startX + (endX - startX) * progress
        const y = startY + (endY - startY) * progress
        view
          .poly([x, y - 7, x + 5, y, x, y + 7, x - 5, y])
          .fill({ color: '#e0f2fe', alpha: 0.78 })
          .stroke({ color: '#7dd3fc', width: 1 })
      }
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-mirrorcast-razorwire')) {
      const offset = 5
      view
          .moveTo(startX, startY + offset)
          .lineTo(endX, endY + offset)
          .stroke({ color: '#e0f2fe', width: 1, alpha: 0.58 })
          .moveTo(startX, startY - offset)
          .lineTo(endX, endY - offset)
          .stroke({ color: '#38bdf8', width: 1, alpha: 0.58 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-razorwire-blood-rite')) {
      view
          .moveTo(startX, startY)
          .lineTo(endX, endY)
          .stroke({ color: '#c084fc', width: 1.5, alpha: 0.62 })
    }
    this.drawEvolutionAccent(view, RAZORWIRE_SKILL_ID, Math.max(6, length * 0.06))
  }

  private drawMirrorcastEcho(view: Graphics, time: number): void {
    const visual = getSkillDefinition(MIRRORCAST_SKILL_ID).visual
    const player = this.game.state.player
    const animationTime = this.reducedMotion ? 0 : time
    const drift = Math.sin(animationTime * 2.4) * 10
    const offsetX = -18 + drift
    const offsetY = -6
    const radius = player.radius
    view.clear()
    // A translucent afterimage of the player silhouette, offset and shimmering.
    view
      .circle(offsetX, offsetY, radius)
      .fill({ color: visual.primaryColor, alpha: 0.16 })
      .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.45 })
      .circle(offsetX, offsetY, radius * 0.6)
      .stroke({ color: visual.outlineColor, width: 1, alpha: 0.4 })
    // Facet lines suggesting a mirror shard.
    for (let index = 0; index < 4; index += 1) {
      const angle = (Math.PI / 2) * index + animationTime * 0.6
      view
        .moveTo(offsetX, offsetY)
        .lineTo(
          offsetX + Math.cos(angle) * radius,
          offsetY + Math.sin(angle) * radius,
        )
        .stroke({ color: visual.secondaryColor, width: 1, alpha: 0.35 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-mirrorcast-prism-halo')) {
      view
        .poly(createPolygonPoints(radius * 1.2, 4, animationTime * 0.8))
        .stroke({ color: '#fef08a', width: 1.5, alpha: 0.66 })
        .poly(createPolygonPoints(radius * 0.86, 4, -animationTime * 0.8))
        .stroke({ color: '#38bdf8', width: 1, alpha: 0.62 })
    }
    this.drawEvolutionAccent(view, MIRRORCAST_SKILL_ID, radius * 0.62)
  }

  private drawBloodRiteRing(view: Graphics, charges: number, time: number): void {
    const visual = getSkillDefinition(BLOOD_RITE_SKILL_ID).visual
    const player = this.game.state.player
    const animationTime = this.reducedMotion ? 0 : time
    const pulse = 1 + Math.sin(animationTime * 5) * 0.06
    const radius = (player.radius + 12) * pulse
    view.clear()
    // A rotating ritual ring of blood around the player.
    view
      .circle(0, 0, radius)
      .stroke({ color: visual.primaryColor, width: 3, alpha: 0.55 })
      .circle(0, 0, radius * 0.82)
      .stroke({ color: visual.secondaryColor, width: 1.5, alpha: 0.4 })
    const droplets = Math.max(3, charges * 3)
    for (let index = 0; index < droplets; index += 1) {
      const angle = animationTime * 1.2 + (Math.PI * 2 * index) / droplets
      const dx = Math.cos(angle) * radius
      const dy = Math.sin(angle) * radius
      view
        .circle(dx, dy, 3)
        .fill({ color: visual.primaryColor, alpha: 0.85 })
        .stroke({ color: visual.outlineColor, width: 1, alpha: 0.6 })
    }
    // Charge glyphs at the center.
    for (let index = 0; index < charges; index += 1) {
      view
        .circle((index - (charges - 1) / 2) * 7, 0, 2.5)
        .fill({ color: visual.outlineColor, alpha: 0.9 })
    }
    if (
      this.game.state.run.selectedUpgradeIds.includes('synergy-aegis-pulse-blood-rite') &&
      (player.aegisPulseShieldRemaining ?? 0) > 0
    ) {
      view
        .poly(createPolygonPoints(radius * 1.28, 6, animationTime * 0.5))
        .stroke({ color: '#67e8f9', width: 2, alpha: 0.78 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-blood-rite-prism-halo')) {
      view
        .poly(createPolygonPoints(radius * 1.18, 3, -animationTime * 0.7))
        .stroke({ color: '#38bdf8', width: 1.5, alpha: 0.68 })
        .poly(createPolygonPoints(radius * 1.06, 3, animationTime * 0.7))
        .stroke({ color: '#f97316', width: 1.5, alpha: 0.68 })
    }
    this.drawEvolutionAccent(view, BLOOD_RITE_SKILL_ID, radius * 0.72)
  }

  private drawPrismHalo(view: Graphics, halo: Readonly<PrismHaloState>): void {
    const player = this.game.state.player
    const visual = getSkillDefinition(PRISM_HALO_SKILL_ID).visual
    const rotation = this.reducedMotion ? 0 : halo.rotation
    const orbitRadius = player.radius + 22
    const shardColors = ['#f97316', '#38bdf8', '#a855f7'] as const
    const shardOutlines = ['#fed7aa', '#bae6fd', '#e9d5ff'] as const
    view.clear()
    // Faint halo ring.
    view
      .circle(0, 0, orbitRadius)
      .stroke({ color: visual.outlineColor, width: 1, alpha: 0.25 })
    for (let index = 0; index < 3; index += 1) {
      const angle = rotation + (Math.PI * 2 * index) / 3
      const sx = Math.cos(angle) * orbitRadius
      const sy = Math.sin(angle) * orbitRadius
      const shardColor = shardColors[index]!
      const outline = shardOutlines[index]!
      // Diamond-shaped elemental shard.
      view
        .poly([sx, sy - 7, sx + 5, sy, sx, sy + 7, sx - 5, sy])
        .fill({ color: shardColor, alpha: halo.firesAllElements ? 0.95 : 0.85 })
        .stroke({ color: outline, width: 1.5 })
      if (halo.firesAllElements) {
        view
          .circle(sx, sy, 9)
          .stroke({ color: outline, width: 1, alpha: 0.4 })
      }
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-mirrorcast-prism-halo')) {
      view
        .poly(createPolygonPoints(orbitRadius + 8, 4, rotation + Math.PI / 4))
        .stroke({ color: '#e0f2fe', width: 1.5, alpha: 0.7 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-sigil-of-ruin-prism-halo')) {
      view
        .poly(createPolygonPoints(orbitRadius + 12, 3, -rotation))
        .stroke({ color: '#f0abfc', width: 1.5, alpha: 0.65 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-blood-rite-prism-halo')) {
      view
        .poly(createStarPoints(orbitRadius + 7, 6, 0.82, rotation))
        .stroke({ color: '#f87171', width: 1.5, alpha: 0.62 })
    }
    this.drawEvolutionAccent(view, PRISM_HALO_SKILL_ID, orbitRadius * 0.5)
  }

  private renderRazorwires(state: Game['state']): void {
    const activeWireIds = new Set<EntityId>()
    for (const wire of state.wires ?? []) {
      activeWireIds.add(wire.id)
      let view = this.wireViews.get(wire.id)
      if (!view) {
        view = this.createWirePlaceholder(wire)
        this.wireViews.set(wire.id, view)
        this.skillObjectLayer?.addChild(view)
      }
      view.position.set(wire.ax, wire.ay)
      this.drawRazorwire(view, wire, state.time)
    }
    for (const [wireId, view] of this.wireViews) {
      if (activeWireIds.has(wireId)) {
        continue
      }
      view.removeFromParent()
      view.destroy()
      this.wireViews.delete(wireId)
    }
  }

  private renderRuinSigils(state: Game['state']): void {
    const activeSigilIds = new Set<EntityId>()
    const sigils = state.player.ruinSigils ?? []
    for (const sigil of sigils) {
      const target: EnemyState | BossState | undefined =
        state.enemies.find((enemy) => enemy.id === sigil.targetId && enemy.hp > 0) ??
        state.bosses?.find((boss) => boss.id === sigil.targetId && boss.hp > 0)
      if (!target) {
        continue
      }
      activeSigilIds.add(sigil.id)
      let view = this.ruinSigilViews.get(sigil.id)
      if (!view) {
        view = new Graphics()
        this.ruinSigilViews.set(sigil.id, view)
        this.skillObjectLayer?.addChild(view)
      }
      view.position.set(target.x, target.y - target.radius - 10)
      this.drawRuinSigil(view, sigil, state.time)
    }
    for (const [sigilId, view] of this.ruinSigilViews) {
      if (activeSigilIds.has(sigilId)) {
        continue
      }
      view.removeFromParent()
      view.destroy()
      this.ruinSigilViews.delete(sigilId)
    }
  }

  private renderMirrorcast(state: Game['state']): void {
    if (!state.player.mirrorcast) {
      if (this.mirrorcastView) {
        this.mirrorcastView.removeFromParent()
        this.mirrorcastView.destroy()
        this.mirrorcastView = undefined
      }
      return
    }
    if (!this.mirrorcastView) {
      this.mirrorcastView = new Graphics()
      this.skillObjectLayer?.addChild(this.mirrorcastView)
    }
    this.mirrorcastView.position.set(state.player.x, state.player.y)
    this.drawMirrorcastEcho(this.mirrorcastView, state.time)
  }

  private renderBloodRite(state: Game['state']): void {
    const debt = state.player.bloodDebt
    if (!debt) {
      if (this.bloodRiteView) {
        this.bloodRiteView.removeFromParent()
        this.bloodRiteView.destroy()
        this.bloodRiteView = undefined
      }
      return
    }
    if (!this.bloodRiteView) {
      this.bloodRiteView = new Graphics()
      this.skillObjectLayer?.addChild(this.bloodRiteView)
    }
    this.bloodRiteView.position.set(state.player.x, state.player.y)
    this.drawBloodRiteRing(this.bloodRiteView, debt.charges, state.time)
  }

  private renderPrismHalo(state: Game['state']): void {
    const halo = state.player.prismHalo
    if (!halo) {
      if (this.prismHaloView) {
        this.prismHaloView.removeFromParent()
        this.prismHaloView.destroy()
        this.prismHaloView = undefined
      }
      return
    }
    if (!this.prismHaloView) {
      this.prismHaloView = new Graphics()
      this.skillObjectLayer?.addChild(this.prismHaloView)
    }
    this.prismHaloView.position.set(state.player.x, state.player.y)
    this.drawPrismHalo(this.prismHaloView, halo)
  }

  private createRallyingFlagPlaceholder(effect: SkillEffectState): Graphics {
    const visual = getSkillDefinition(RALLYING_BANNER_SKILL_ID).visual
    const radius = Math.max(1, effect.radius)
    const poleTop = -radius * 0.62
    const poleBottom = radius * 0.38
    const view = new Graphics()
      .circle(0, 0, radius)
      .fill({ color: visual.primaryColor, alpha: 0.06 })
      .stroke({ color: visual.secondaryColor, width: 2, alpha: 0.38 })
      .circle(0, 0, radius * 0.92)
      .stroke({ color: visual.primaryColor, width: 1, alpha: 0.24 })
      .moveTo(0, poleTop)
      .lineTo(0, poleBottom)
      .stroke({ color: visual.outlineColor, width: 4, alpha: 0.95 })
      .poly([
        0, poleTop,
        radius * 0.5, poleTop + radius * 0.12,
        0, poleTop + radius * 0.28,
      ])
      .fill({ color: visual.primaryColor, alpha: 0.9 })
      .stroke({ color: visual.outlineColor, width: 2, alpha: 0.95 })
      .ellipse(0, poleBottom, radius * 0.12, radius * 0.06)
      .fill({ color: visual.secondaryColor, alpha: 0.85 })
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-vitality-rallying-banner')) {
      view
        .poly(createPolygonPoints(radius * 0.82, 6, Math.PI / 6))
        .stroke({ color: '#86efac', width: 2, alpha: 0.64 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-raise-skeleton-rallying-banner')) {
      view
        .moveTo(-radius * 0.28, radius * 0.68)
        .lineTo(-radius * 0.28, radius * 0.4)
        .moveTo(radius * 0.28, radius * 0.68)
        .lineTo(radius * 0.28, radius * 0.4)
        .stroke({ color: '#c084fc', width: 2, alpha: 0.7 })
    }
    if (this.game.state.run.selectedUpgradeIds.includes('synergy-storm-relay-rallying-banner')) {
      view
        .poly(createStarPoints(radius * 1.08, 8, 0.78, Math.PI / 8))
        .stroke({ color: '#67e8f9', width: 1.5, alpha: 0.62 })
    }
    return view
  }

  private readonly update = (ticker: Ticker): void => {
    const deltaSeconds = ticker.deltaMS / 1000
    this.game.update(deltaSeconds)
    this.renderState()
    this.centerCamera(deltaSeconds)
  }

  private drawProjectileTrail(
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

  private updateEffectAnimation(
    view: Graphics,
    effect: SkillEffectState,
    time: number,
  ): void {
    const progress = effect.lifetime > 0
      ? Math.max(0, Math.min(1, 1 - effect.remainingLifetime / effect.lifetime))
      : 1
    const burst = Math.min(1, progress * 5)
    const settle = Math.min(1, progress * 1.5)
    const isShortEffect = effect.lifetime <= 1.5
    view.alpha = Math.max(0, Math.min(1, effect.remainingLifetime / effect.lifetime))
    if (effect.impactPoints?.length || this.reducedMotion) {
      // Impact markers use world-space target positions relative to the
      // effect origin; scaling the parent would make them drift.
      view.scale.set(1)
      view.rotation = 0
      return
    }
    if (isShortEffect) {
      view.scale.set(0.72 + burst * 0.38 - settle * 0.08)
      if (effect.shape !== 'line') {
        view.rotation = Math.sin(time * 2 + effect.id) * 0.04
      }
    } else {
      view.scale.set(1)
      view.rotation = 0
    }
  }

  private updateImpactParticles(
    view: Graphics,
    effect: SkillEffectState,
    time: number,
  ): void {
    const progress = effect.lifetime > 0
      ? Math.max(0, Math.min(1, 1 - effect.remainingLifetime / effect.lifetime))
      : 1
    const expansion = Math.min(1, progress * 5)
    if (effect.impactPoints?.length || this.reducedMotion) {
      view.scale.set(1)
      view.rotation = 0
      view.alpha = Math.max(0, Math.min(1, 1 - progress * 1.25))
      return
    }
    view.scale.set(0.28 + expansion * 1.1)
    view.rotation = time * (1.2 + (effect.id % 3) * 0.35)
    view.alpha = Math.max(0, Math.min(1, 1 - progress * 1.25))
  }

  private drawHitFlash(
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
      this.drawShieldBar(
        this.playerView.shieldBar,
        40,
        4,
        -40,
        state.player.aegisPulseShieldAmount ?? 0,
        state.player.aegisPulseShieldMaxAmount ?? 0,
      )
      if (
        this.playerView.lastHp !== undefined &&
        state.player.hp < this.playerView.lastHp
      ) {
        this.playerView.hitFlashUntil = state.time + 0.14
      }
      this.playerView.lastHp = state.player.hp
      const playerHitPulse = Math.max(
        0,
        Math.min(1, ((this.playerView.hitFlashUntil ?? 0) - state.time) / 0.14),
      )
      this.drawHitFlash(
        this.playerView.hitFlash,
        26,
        state.player.lastHitVisual,
        playerHitPulse,
      )
    }
    const activeSummonIds = new Set<EntityId>()
    for (const summon of state.summons) {
      activeSummonIds.add(summon.id)
      let summonView = this.summonViews.get(summon.id)
      if (!summonView) {
        summonView = this.createSummonPlaceholder(summon)
        this.summonViews.set(summon.id, summonView)
        this.summonLayer?.addChild(summonView.root)
      }
      summonView.root.position.set(summon.x, summon.y)
      summonView.body.rotation = summon.skillId === PHANTOM_ARSENAL_SKILL_ID
        ? 0
        : this.reducedMotion ? 0 : state.time * 1.5
      const emberGuardActive =
        (summon.emberGuardCharges ?? 0) > 0 &&
        (summon.emberGuardRemaining ?? 0) > 0
      const legionActive =
        state.run.selectedUpgradeIds.includes('synergy-phantom-arsenal-raise-skeleton')
      const spectralPactActive =
        state.run.selectedUpgradeIds.includes('synergy-soul-tether-phantom-arsenal') &&
        summon.skillId === PHANTOM_ARSENAL_SKILL_ID
      const summonSynergyActive = emberGuardActive || legionActive || spectralPactActive
      summonView.guardAura.visible = summonSynergyActive
      if (summonSynergyActive) {
        const guardRadius = 20 + (
          this.reducedMotion ? 0 : Math.sin(state.time * 6 + summon.id) * 2
        )
        const auraColor = emberGuardActive
          ? '#fb923c'
          : spectralPactActive
            ? '#bfdbfe'
            : '#c084fc'
        summonView.guardAura
          .clear()
          .poly(createPolygonPoints(guardRadius, 6, Math.PI / 6))
          .stroke({ color: auraColor, width: 2, alpha: 0.7 })
          .poly(createStarPoints(guardRadius * 0.74, 6, 0.45))
          .fill({ color: auraColor, alpha: 0.18 })
          .stroke({ color: '#f8fafc', width: 1, alpha: 0.72 })
      }
      this.drawHealthBar(
        summonView.hpBar,
        26,
        3,
        -22,
        summon.hp,
        summon.maxHp,
      )
    }
    for (const [summonId, summonView] of this.summonViews) {
      if (!activeSummonIds.has(summonId)) {
        summonView.root.removeFromParent()
        summonView.root.destroy({ children: true })
        this.summonViews.delete(summonId)
      }
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
      if (
        enemyView.lastHp !== undefined &&
        enemy.hp < enemyView.lastHp
      ) {
        enemyView.hitFlashUntil = state.time + 0.12
      }
      enemyView.lastHp = enemy.hp
      const hitPulse = Math.max(
        0,
        Math.min(1, ((enemyView.hitFlashUntil ?? 0) - state.time) / 0.12),
      )
      this.drawHitFlash(
        enemyView.hitFlash,
        enemy.radius,
        enemy.lastHitVisual,
        hitPulse,
      )
      const poisonStackCount = enemy.poisonStacks?.length ?? 0
      const burningStackCount = enemy.burningStacks?.length ?? 0
      const renderScale = getEnemyDefinition(enemy.definitionId).render.scale
      const enemyBarWidth = Math.max(28, enemy.radius * renderScale * 1.8)
      this.drawStatusAura(enemyView.poisonAura, enemy, enemy.radius, state.time)
      const enemyStatuses = getEnemyStatusEffects(
        poisonStackCount,
        enemy.chillStacks,
        enemy.frozenRemainingDuration,
        enemy.shockStacks,
        burningStackCount,
      )
      const enemyStatusSignature = getStatusEffectSignature(enemyStatuses)
      if (enemyView.statusEffectSignature !== enemyStatusSignature) {
        enemyView.statusEffectSignature = enemyStatusSignature
        this.drawStatusEffects(
          enemyView.statusEffects,
          enemyBarWidth,
          enemyStatuses,
        )
      }
      enemyView.label.text = getEnemyDisplayLabel(
        enemy.definitionId,
        enemy.eliteModifier,
      )
      const attackProgress = getEnemyMeleeAttackAnimationProgress(
        state.time,
        enemy.lastMeleeAttackTime,
      )
      const attackIntensity = this.reducedMotion
        ? 0
        : Math.sin(attackProgress * Math.PI)
      const target = enemy.targetId === state.player.id
        ? state.player
        : state.summons.find((summon) => summon.id === enemy.targetId) ?? state.player
      const directionX = target.x - enemy.x
      const directionY = target.y - enemy.y
      const directionLength = Math.hypot(directionX, directionY)
      const normalizedDirectionX = directionLength > 0.0001 ? directionX / directionLength : 1
      const normalizedDirectionY = directionLength > 0.0001 ? directionY / directionLength : 0
      enemyView.body.position.set(
        normalizedDirectionX * enemy.radius * 0.38 * attackIntensity,
        normalizedDirectionY * enemy.radius * 0.38 * attackIntensity,
      )
      enemyView.body.scale.set(
        renderScale * (1 + attackIntensity * 0.14 + hitPulse * 0.1),
      )
      const baseLabelY = -(enemy.radius * renderScale + 16)
      const statusOffset = enemyStatuses.length > 0
        ? STATUS_EFFECT_ICON_SIZE + STATUS_EFFECT_ICON_GAP
        : 0
      const labelY = baseLabelY - statusOffset
      const barY = baseLabelY + 4
      enemyView.label.position.set(0, labelY)
      enemyView.statusEffects.position.set(
        0,
        barY - STATUS_EFFECT_ICON_SIZE - STATUS_EFFECT_ICON_GAP,
      )
      this.drawHealthBar(
        enemyView.hpBar,
        enemyBarWidth,
        4,
        barY,
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
      if (
        bossView.lastHp !== undefined &&
        boss.hp < bossView.lastHp
      ) {
        bossView.hitFlashUntil = state.time + 0.16
      }
      bossView.lastHp = boss.hp
      const bossHitPulse = Math.max(
        0,
        Math.min(1, ((bossView.hitFlashUntil ?? 0) - state.time) / 0.16),
      )
      this.drawHitFlash(
        bossView.hitFlash,
        boss.radius,
        boss.lastHitVisual,
        bossHitPulse,
      )
      const poisonStackCount = boss.poisonStacks?.length ?? 0
      const burningStackCount = boss.burningStacks?.length ?? 0
      const bossBarWidth = boss.radius * 2.5
      this.drawStatusAura(bossView.poisonAura, boss, boss.radius, state.time)
      const bossStatuses = getEnemyStatusEffects(
        poisonStackCount,
        boss.chillStacks,
        boss.frozenRemainingDuration,
        boss.shockStacks,
        burningStackCount,
      )
      const bossStatusSignature = getStatusEffectSignature(bossStatuses)
      if (bossView.statusEffectSignature !== bossStatusSignature) {
        bossView.statusEffectSignature = bossStatusSignature
        this.drawStatusEffects(
          bossView.statusEffects,
          bossBarWidth,
          bossStatuses,
        )
      }
      const bossPulse = this.reducedMotion
        ? 1
        : 1 + Math.sin(state.time * 3 + boss.id) * 0.025
      bossView.root.scale.set(bossPulse)
      const renderScale = 1
      bossView.label.text = getBossDisplayLabel(boss.bossDefinitionId)
      const baseLabelY = -(boss.radius * renderScale + 30)
      const statusOffset = bossStatuses.length > 0
        ? STATUS_EFFECT_ICON_SIZE + STATUS_EFFECT_ICON_GAP
        : 0
      const labelY = baseLabelY - statusOffset
      const barY = -(boss.radius * renderScale + 22)
      bossView.label.position.set(0, labelY)
      bossView.statusEffects.position.set(
        0,
        barY - STATUS_EFFECT_ICON_SIZE - STATUS_EFFECT_ICON_GAP,
      )
      this.drawHealthBar(
        bossView.hpBar,
        bossBarWidth,
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

    const activeTrapIds = new Set<EntityId>()
    for (const trap of state.traps ?? []) {
      activeTrapIds.add(trap.id)
      let view = this.trapViews.get(trap.id)
      if (!view) {
        view = this.createCinderMinePlaceholder(trap)
        this.trapViews.set(trap.id, view)
        this.skillObjectLayer?.addChild(view)
      }
      view.position.set(trap.x, trap.y)
      this.drawCinderMine(view, trap, state.time)
    }
    for (const [trapId, view] of this.trapViews) {
      if (activeTrapIds.has(trapId)) {
        continue
      }
      view.removeFromParent()
      view.destroy()
      this.trapViews.delete(trapId)
    }

    const activeRelayIds = new Set<EntityId>()
    for (const relay of state.relays ?? []) {
      activeRelayIds.add(relay.id)
      let view = this.relayViews.get(relay.id)
      if (!view) {
        view = this.createStormRelayPlaceholder(relay)
        this.relayViews.set(relay.id, view)
        this.skillObjectLayer?.addChild(view)
      }
      view.position.set(relay.x, relay.y)
      this.drawStormRelay(view, relay, state.time)
    }
    for (const [relayId, view] of this.relayViews) {
      if (activeRelayIds.has(relayId)) {
        continue
      }
      view.removeFromParent()
      view.destroy()
      this.relayViews.delete(relayId)
    }

    this.renderRazorwires(state)
    this.renderRuinSigils(state)
    this.renderMirrorcast(state)
    this.renderBloodRite(state)
    this.renderPrismHalo(state)

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
      telegraphView.root.scale.set(0.88 + progress * 0.12)
      telegraphView.label.text = `${getTelegraphName(telegraph)} · DODGE`
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
      let history = this.projectilePositionHistory.get(projectile.id)
      if (!history) {
        history = []
        this.projectilePositionHistory.set(projectile.id, history)
      }
      history.push({ x: projectile.x, y: projectile.y })
      if (history.length > 6) {
        history.shift()
      }
      let trailView = this.projectileTrailViews.get(projectile.id)
      if (
        !trailView &&
        this.projectileTrailViews.size < PixiGame.MAX_PROJECTILE_TRAIL_VIEWS
      ) {
        trailView = new Graphics()
        this.projectileTrailViews.set(projectile.id, trailView)
        this.projectileLayer?.addChildAt(trailView, 0)
      }
      if (trailView) {
        this.drawProjectileTrail(trailView, projectile, history)
      }
    }

    for (const [projectileId, view] of this.projectileViews) {
      if (activeProjectileIds.has(projectileId)) {
        continue
      }

      view.removeFromParent()
      view.destroy()
      this.projectileViews.delete(projectileId)
      const trailView = this.projectileTrailViews.get(projectileId)
      trailView?.removeFromParent()
      trailView?.destroy()
      this.projectileTrailViews.delete(projectileId)
      this.projectilePositionHistory.delete(projectileId)
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
      this.pickupData.set(pickup.id, pickup)
      this.drawPickup(view, pickup, state.time)
    }

    for (const [pickupId, view] of this.pickupViews) {
      if (activePickupIds.has(pickupId)) {
        continue
      }

      const pickup = this.pickupData.get(pickupId)
      if (pickup) {
        this.createPickupFeedback(pickup, view.position.x, view.position.y, state.time)
      }
      view.removeFromParent()
      view.destroy()
      this.pickupViews.delete(pickupId)
      this.pickupData.delete(pickupId)
    }
    for (const [pickupId, feedback] of this.pickupFeedbackViews) {
      const progress = Math.max(0, Math.min(1, (state.time - feedback.createdAt) / 0.9))
      feedback.text.position.y = feedback.startY - progress * 24
      feedback.text.alpha = 1 - progress
      if (progress >= 1) {
        feedback.text.removeFromParent()
        feedback.text.destroy()
        this.pickupFeedbackViews.delete(pickupId)
      }
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
      let particleView = this.effectParticleViews.get(effect.id)
      if (
        effect.lifetime <= 1.5 &&
        !particleView &&
        this.effectParticleViews.size < PixiGame.MAX_IMPACT_PARTICLE_VIEWS
      ) {
        particleView = this.createImpactParticlePlaceholder(effect)
        this.effectParticleViews.set(effect.id, particleView)
        this.effectLayer?.addChild(particleView)
      }
      view.position.set(effect.x, effect.y)
      this.updateEffectAnimation(view, effect, state.time)
      if (particleView) {
        particleView.position.set(effect.x, effect.y)
        this.updateImpactParticles(particleView, effect, state.time)
      }
    }

    for (const [effectId, view] of this.effectViews) {
      if (activeEffectIds.has(effectId)) {
        continue
      }
      view.removeFromParent()
      view.destroy()
      this.effectViews.delete(effectId)
      const particleView = this.effectParticleViews.get(effectId)
      particleView?.removeFromParent()
      particleView?.destroy()
      this.effectParticleViews.delete(effectId)
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

  private drawShieldBar(
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

  private drawStatusAura(
    view: Graphics,
    target: Readonly<EnemyState | BossState>,
    radius: number,
    time: number,
  ): void {
    const animationTime = this.reducedMotion ? 0 : time
    const poisonStacks = target.poisonStacks?.length ?? 0
    const burningStacks = target.burningStacks?.length ?? 0
    const chillStacks = target.chillStacks ?? 0
    const frozen = (target.frozenRemainingDuration ?? 0) > 0
    const shockStacks = target.shockStacks ?? 0
    const hasStatus = poisonStacks > 0 || burningStacks > 0 ||
      chillStacks > 0 || frozen || shockStacks > 0
    view.visible = hasStatus
    if (!hasStatus) {
      view.clear()
      return
    }
    view.clear()
    const intensity = Math.min(
      1,
      Math.max(
        poisonStacks,
        burningStacks,
        chillStacks,
        shockStacks,
        frozen ? 3 : 0,
      ) / 3,
    )
    const auraRadius = radius + 5 + intensity * 7
    if (burningStacks > 0) {
      view
        .poly(createStarPoints(auraRadius, 10, 0.68, -Math.PI / 2))
        .stroke({ color: '#fb923c', width: 2 + intensity, alpha: 0.62 })
      for (let index = 0; index < Math.min(6, burningStacks + 2); index += 1) {
        const angle = animationTime * 1.8 + (Math.PI * 2 * index) / 6
        view
          .poly([
            Math.cos(angle - 0.18) * (radius + 2),
            Math.sin(angle - 0.18) * (radius + 2),
            Math.cos(angle) * (auraRadius + 6 + (index % 2) * 3),
            Math.sin(angle) * (auraRadius + 6 + (index % 2) * 3),
            Math.cos(angle + 0.18) * (radius + 2),
            Math.sin(angle + 0.18) * (radius + 2),
          ])
          .fill({ color: '#f97316', alpha: 0.46 })
      }
    }
    if (chillStacks > 0 || frozen) {
      view
        .poly(createPolygonPoints(auraRadius + (frozen ? 4 : 0), 6, animationTime * 0.12))
        .stroke({ color: frozen ? '#eff6ff' : '#7dd3fc', width: frozen ? 3 : 2, alpha: 0.78 })
      for (let index = 0; index < Math.min(6, chillStacks + 2); index += 1) {
        const angle = (Math.PI * 2 * index) / 6
        view
          .poly([
            Math.cos(angle) * (radius + 2),
            Math.sin(angle) * (radius + 2),
            Math.cos(angle) * (auraRadius + 5),
            Math.sin(angle) * (auraRadius + 5),
            Math.cos(angle + 0.12) * (radius + 2),
            Math.sin(angle + 0.12) * (radius + 2),
          ])
          .stroke({ color: '#bae6fd', width: 1.5, alpha: 0.68 })
      }
    }
    if (shockStacks > 0) {
      for (let index = 0; index < Math.min(4, shockStacks + 1); index += 1) {
        const angle = animationTime * 2.5 + (Math.PI * 2 * index) / 4
        const inner = radius + 2
        const outer = auraRadius + 8
        view
          .moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
          .lineTo(
            Math.cos(angle + 0.18) * (inner + (outer - inner) * 0.5),
            Math.sin(angle + 0.18) * (inner + (outer - inner) * 0.5),
          )
          .lineTo(Math.cos(angle - 0.06) * outer, Math.sin(angle - 0.06) * outer)
          .stroke({ color: '#fef08a', width: 2, alpha: 0.78 })
      }
    }
    if (poisonStacks > 0) {
      view
        .poly(createPolygonPoints(auraRadius + 3, 8, -animationTime * 0.18))
        .stroke({ color: '#84cc16', width: 2, alpha: 0.7 })
      for (let index = 0; index < Math.min(6, poisonStacks + 2); index += 1) {
        const angle = animationTime * 0.8 + (Math.PI * 2 * index) / 6
        view
          .circle(
            Math.cos(angle) * (auraRadius + 4),
            Math.sin(angle) * (auraRadius + 4),
            2 + (index % 2),
          )
          .fill({ color: '#a3e635', alpha: 0.62 })
      }
    }
  }

  private drawStatusEffects(
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
    for (const view of this.projectileTrailViews.values()) {
      view.removeFromParent()
      view.destroy()
    }
    for (const view of this.pickupViews.values()) {
      view.removeFromParent()
      view.destroy()
    }
    for (const feedback of this.pickupFeedbackViews.values()) {
      feedback.text.removeFromParent()
      feedback.text.destroy()
    }
    for (const view of this.effectViews.values()) {
      view.removeFromParent()
      view.destroy()
    }
    for (const view of this.effectParticleViews.values()) {
      view.removeFromParent()
      view.destroy()
    }
    for (const view of this.trapViews.values()) {
      view.removeFromParent()
      view.destroy()
    }
    for (const view of this.relayViews.values()) {
      view.removeFromParent()
      view.destroy()
    }
    for (const view of this.wireViews.values()) {
      view.removeFromParent()
      view.destroy()
    }
    for (const view of this.ruinSigilViews.values()) {
      view.removeFromParent()
      view.destroy()
    }
    this.mirrorcastView?.removeFromParent()
    this.mirrorcastView?.destroy()
    this.mirrorcastView = undefined
    this.bloodRiteView?.removeFromParent()
    this.bloodRiteView?.destroy()
    this.bloodRiteView = undefined
    this.prismHaloView?.removeFromParent()
    this.prismHaloView?.destroy()
    this.prismHaloView = undefined
    for (const { root } of this.summonViews.values()) {
      root.removeFromParent()
      root.destroy({ children: true })
    }
    for (const { root } of this.stairsViews.values()) {
      root.removeFromParent()
      root.destroy({ children: true })
    }
    this.enemyViews.clear()
    this.bossViews.clear()
    this.telegraphViews.clear()
    this.projectileViews.clear()
    this.projectileTrailViews.clear()
    this.projectilePositionHistory.clear()
    this.pickupViews.clear()
    this.pickupData.clear()
    this.pickupFeedbackViews.clear()
    this.effectViews.clear()
    this.effectParticleViews.clear()
    this.trapViews.clear()
    this.relayViews.clear()
    this.wireViews.clear()
    this.ruinSigilViews.clear()
    this.summonViews.clear()
    this.stairsViews.clear()
    this.enemyLayer = undefined
    this.bossLayer = undefined
    this.skillObjectLayer = undefined
    this.telegraphLayer = undefined
    this.projectileLayer = undefined
    this.pickupLayer = undefined
    this.effectLayer = undefined
    this.worldUiLayer = undefined
    this.summonLayer = undefined
    this.stairsLayer = undefined
    this.playerView = undefined
    this.host = undefined
    this.cameraFocusInitialized = false
    this.app.destroy({ removeView: true }, { children: true })
    this.initialized = false
  }
}

function createPolygonPoints(
  radius: number,
  sides: number,
  rotation = 0,
): number[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (Math.PI * 2 * index) / sides
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  }).flat()
}

function createStarPoints(
  radius: number,
  points: number,
  innerRatio: number,
  rotation = 0,
): number[] {
  return Array.from({ length: points * 2 }, (_, index) => {
    const angle = rotation + (Math.PI * index) / points
    const pointRadius = index % 2 === 0 ? radius : radius * innerRatio
    return [Math.cos(angle) * pointRadius, Math.sin(angle) * pointRadius]
  }).flat()
}

function applyEnemyRenderScale(
  view: Graphics,
  render: EnemyRenderDefinition,
): void {
  view.scale.set(render.scale)
}

function createEliteAura(
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

function drawDashedBoundaryEdge(
  graphics: Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): void {
  const length = Math.hypot(endX - startX, endY - startY)
  if (length <= 0) {
    return
  }
  const directionX = (endX - startX) / length
  const directionY = (endY - startY) / length
  const dashLength = 72
  const gapLength = 48

  for (let offset = 0; offset < length; offset += dashLength + gapLength) {
    const dashEnd = Math.min(offset + dashLength, length)
    graphics
      .moveTo(startX + directionX * offset, startY + directionY * offset)
      .lineTo(startX + directionX * dashEnd, startY + directionY * dashEnd)
      .stroke({ color: '#ecfeff', width: 3, alpha: 0.9 })
  }
}

interface EnemyView {
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

interface PlayerView {
  root: Container
  body: Graphics
  hitFlash: Graphics
  hpBar: Graphics
  shieldBar: Graphics
  lastHp?: number
  hitFlashUntil?: number
}

interface SummonView {
  root: Container
  body: Graphics
  hpBar: Graphics
  guardAura: Graphics
}

interface BossView {
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

interface TelegraphView {
  root: Container
  label: Text
}

interface StairsView {
  root: Container
  label: Text
}

interface PickupFeedbackView {
  text: Text
  createdAt: number
  startY: number
}

interface RenderPoint {
  x: number
  y: number
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

export function getEnemyMeleeAttackAnimationProgress(
  currentTime: number,
  lastMeleeAttackTime?: number,
): number {
  if (lastMeleeAttackTime === undefined) {
    return 0
  }
  const elapsed = currentTime - lastMeleeAttackTime
  if (elapsed < 0 || elapsed >= ENEMY_MELEE_ATTACK_ANIMATION_SECONDS) {
    return 0
  }
  return elapsed / ENEMY_MELEE_ATTACK_ANIMATION_SECONDS
}

export function getBossDisplayLabel(definitionId: BossState['bossDefinitionId']): string {
  return `BOSS · ${getBossDefinition(definitionId).name}`
}
