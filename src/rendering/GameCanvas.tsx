import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  createGame,
  createGameFromCheckpoint,
  DEFAULT_TIME_SCALE,
  MAX_TIME_SCALE,
  MIN_TIME_SCALE,
  DEBUG_SPAWN_COUNTS,
  type Game,
  type DebugSpawnCount,
  type DevelopmentGrantResult,
  type GameUiSnapshot,
  type GearChoice,
  type BehaviorProfileId,
  type RunConfig,
  type PendingChoiceFlow,
  type RunResultSnapshot,
  type GameCheckpoint,
  getEligibleSynergyDefinitions,
} from '../game'
import {
  BEHAVIOR_PROFILE_DEFINITIONS,
  BEHAVIOR_PROFILE_ORDER,
} from '../content/behaviors/BehaviorProfiles'
import {
  FREE_MOVEMENT_KEYS,
  FREE_MOVEMENT_TOGGLE_KEY,
  formatKeybind,
  normalizeKey,
  type GameKeybinds,
} from '../input/Keybinds'
import {
  ALL_ITEM_DEFINITIONS,
  EQUIPMENT_SLOTS,
  EquipmentSlot,
  getItemDisplayName,
  isItemId,
  type EquipmentSlot as EquipmentSlotType,
  type ItemId,
} from '../content/gear/Items'
import {
  formatGearModifier,
  serializeGearModifiers,
} from '../content/gear/ModifierPools'
import { RARITY_VISUALS } from '../content/rarity/Rarity'
import { GEAR_XP_BLESSING_MULTIPLIER } from '../game-config/gear'
import { xpRequiredForNextLevel } from '../content/progression/XpBalance'
import {
  BASIC_ATTACK_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
  isSkillId,
  RALLYING_BANNER_SKILL_ID,
  MIRRORCAST_SKILL_ID,
  CRITICAL_SPELLSTRIKE_SKILL_ID,
  SKILL_DEFINITIONS,
  type SkillId,
} from '../content/skills/Skills'
import {
  ALL_GEAR_SET_DEFINITIONS,
  isGearSetId,
  type GearSetId,
} from '../game-config/gear-sets'
import {
  INITIAL_UPGRADES,
  type LevelUpUpgradeChoice,
} from '../content/upgrades/Upgrades'
import { LevelUpOverlay } from './LevelUpOverlay'
import { PauseMenu } from './PauseMenu'
import { PixiGame } from './PixiGame'
import { SkillIcon } from './SkillIcon'
import { GearSetFormation } from './GearSetFormation'
import { ImplicitModifierList } from './ImplicitModifierList'
import { KeywordText } from './KeywordTooltip'
import {
  closeAllTooltips,
  registerTooltipCloser,
  tooltipClassName,
} from './TooltipShell'
import { formatExperience } from '../ui/formatNumbers'
import { formatCompactDamage } from '../ui/formatNumbers'
import type { BugReportDungeonContext, BugReportImage } from '../bug-report'

interface GameCanvasProps {
  onRunEnd: (result: RunResultSnapshot, checkpoint: GameCheckpoint) => void
  runConfig?: RunConfig
  initialCheckpoint?: GameCheckpoint | null
  onFloorCheckpoint?: (checkpoint: GameCheckpoint) => Promise<void>
  onSaveAndQuit?: () => Promise<void>
  onBehaviorProfileChange?: (profileId: BehaviorProfileId) => void
  keybinds: GameKeybinds
  onKeybindsChange?: (keybinds: GameKeybinds) => Promise<void>
  reportBugRunId?: string
  onSubmitBugReport?: (
    description: string,
    image: BugReportImage | undefined,
    dungeon: BugReportDungeonContext,
  ) => Promise<void>
}

const UI_UPDATE_INTERVAL_MS = 100
const MIN_CAST_PULSE_INTERVAL_MS = 240
const DEVELOPMENT_TIME_SCALE_STORAGE_KEY = 'active-burger:development-time-scale'
const PROFILE_KEYBIND_IDS = {
  aggressive: 'behaviorAggressive',
  balanced: 'behaviorBalanced',
  cautious: 'behaviorCautious',
} as const

const GRANTABLE_GEAR_DEFINITIONS = ALL_ITEM_DEFINITIONS.filter(
  (item) => !item.starterOnly,
)
const GRANTABLE_UPGRADE_DEFINITIONS = INITIAL_UPGRADES.filter(
  (upgrade) => upgrade.synergySkillIds === undefined,
)

const HUD_SLOT_LABELS: Record<EquipmentSlotType, string> = {
  [EquipmentSlot.Weapon]: 'Weapon',
  [EquipmentSlot.Helmet]: 'Helmet',
  [EquipmentSlot.Armor]: 'Armor',
  [EquipmentSlot.Boots]: 'Boots',
  [EquipmentSlot.Ring]: 'Ring',
  [EquipmentSlot.Amulet]: 'Amulet',
}

function formatHudModifier(
  modifier: GameUiSnapshot['skills'][number]['gearModifiers'][number],
): string {
  return formatGearModifier(modifier, { includeTier: false })
}

function formatCadence(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

function formatEstimatedDps(value: number | null): string {
  return value === null ? 'N/A' : Math.ceil(value).toString()
}

type TooltipElementRef<T extends HTMLElement> = { current: T | null }

function useHudTooltipPosition<TAnchor extends HTMLElement, TTooltip extends HTMLElement>(
  isOpen: boolean,
  anchorKey: string | null,
  placement: 'above' | 'right',
  anchorRef: TooltipElementRef<TAnchor>,
  tooltipRef: TooltipElementRef<TTooltip>,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>(() => ({
    visibility: 'hidden',
  }))

  useLayoutEffect(() => {
    if (!isOpen) {
      setStyle((current) =>
        current.visibility === 'hidden' ? current : { visibility: 'hidden' },
      )
      return
    }
    const tooltip = tooltipRef.current
    if (!tooltip) {
      return
    }

    const updatePosition = (): void => {
      const anchor = anchorRef.current
      if (!anchor) {
        return
      }

      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = document.documentElement.clientHeight
      const margin = 12
      const gap = 10
      const anchorBox = anchor.getBoundingClientRect()
      const tooltipBox = tooltip.getBoundingClientRect()
      const tooltipHeight = Math.min(
        Math.max(tooltipBox.height, tooltip.scrollHeight),
        viewportHeight - margin * 2,
      )
      const maxLeft = Math.max(margin, viewportWidth - margin - tooltipBox.width)
      const maxTop = Math.max(margin, viewportHeight - margin - tooltipHeight)

      let left = placement === 'above'
        ? anchorBox.right - tooltipBox.width
        : anchorBox.right + gap
      let top = placement === 'above'
        ? anchorBox.top - gap - tooltipHeight
        : anchorBox.top

      if (placement === 'above' && top < margin) {
        top = anchorBox.bottom + gap
      }
      if (placement === 'right' && left > maxLeft) {
        left = anchorBox.left - gap - tooltipBox.width
      }

      setStyle({
        top: Math.min(Math.max(top, margin), maxTop),
        left: Math.min(Math.max(left, margin), maxLeft),
        right: 'auto',
        bottom: 'auto',
        maxHeight: `${Math.max(0, viewportHeight - margin * 2)}px`,
        visibility: 'visible',
      })
    }

    updatePosition()
    const animationFrame = window.requestAnimationFrame(updatePosition)
    const resizeObserver = new ResizeObserver(updatePosition)
    resizeObserver.observe(tooltip)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorKey, anchorRef, isOpen, placement, tooltipRef])

  return style
}

function getChoiceFlowKey(
  flow: Readonly<PendingChoiceFlow> | null,
): string | null {
  if (!flow) {
    return null
  }
  const choices = flow.choices.map((choice) =>
    'upgradeId' in choice
      ? choice.upgradeId
      : choice.type === 'gear'
        ? `${choice.type}:${choice.itemId}:${choice.slot}:${choice.rarity}:${choice.setId ?? ''}:${serializeGearModifiers(choice.modifiers)}`
        : choice.type === 'upgrade-equipped-item'
          ? `${choice.type}:${choice.itemId}:${choice.slot}:${choice.itemRarity}:${choice.rarity}:${choice.setId ?? ''}:${choice.upgradedModifierId}:${choice.fromTier}:${choice.toTier}:${serializeGearModifiers(choice.upgradedModifiers)}`
          : choice.type === 'gear-rarity-floor'
            ? `${choice.type}:${choice.minimumRarity}:${choice.rarity}`
            : choice.type,
  )
  return `${flow.type}:${'level' in flow ? flow.level : flow.pickupId}:${choices.join(',')}`
}

function getStoredDevelopmentTimeScale(): number | null {
  const storedValue = window.localStorage.getItem(DEVELOPMENT_TIME_SCALE_STORAGE_KEY)
  if (storedValue === null) {
    return null
  }
  const value = Number(storedValue)
  return Number.isFinite(value) && value >= MIN_TIME_SCALE && value <= MAX_TIME_SCALE
    ? value
    : null
}

function storeDevelopmentTimeScale(value: number): void {
  window.localStorage.setItem(DEVELOPMENT_TIME_SCALE_STORAGE_KEY, value.toString())
}

function isFreeMovementKey(
  value: string,
): value is typeof FREE_MOVEMENT_KEYS[number] {
  return FREE_MOVEMENT_KEYS.some((movementKey) => movementKey === value)
}

function applyInitialTimeScale(game: Game): void {
  if (!import.meta.env.DEV) {
    game.setTimeScale(DEFAULT_TIME_SCALE)
    return
  }
  const storedTimeScale = getStoredDevelopmentTimeScale()
  if (storedTimeScale !== null) {
    game.setTimeScale(storedTimeScale)
  }
}

export function GameCanvas({
  onRunEnd,
  runConfig,
  initialCheckpoint,
  onFloorCheckpoint,
  onSaveAndQuit,
  onBehaviorProfileChange,
  keybinds,
  onKeybindsChange,
  reportBugRunId,
  onSubmitBugReport,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const onRunEndRef = useRef(onRunEnd)
  const onFloorCheckpointRef = useRef(onFloorCheckpoint)
  const onSaveAndQuitRef = useRef(onSaveAndQuit)
  const onBehaviorProfileChangeRef = useRef(onBehaviorProfileChange)
  const initialRunConfigRef = useRef<RunConfig>(runConfig ?? { seed: 3 })
  const initialCheckpointRef = useRef(initialCheckpoint)
  const [game, setGame] = useState<Game | null>(null)
  const [snapshot, setSnapshot] = useState<GameUiSnapshot | null>(null)
  const [damageFlashId, setDamageFlashId] = useState(0)
  const [choiceFlow, setChoiceFlow] = useState<Readonly<PendingChoiceFlow> | null>(null)
  const [floorSaveError, setFloorSaveError] = useState<string | null>(null)
  const previousHpRef = useRef<number | null>(null)
  const retryFloorSaveRef = useRef<() => void>(() => undefined)
  const choiceFlowKeyRef = useRef<string | null>(null)
  const choiceFlowRef = useRef<Readonly<PendingChoiceFlow> | null>(null)
  const [activeKeybinds, setActiveKeybinds] = useState(keybinds)
  const activeKeybindsRef = useRef(keybinds)
  const [developmentMenuOpen, setDevelopmentMenuOpen] = useState(
    () => import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('devmenu') === 'open',
  )
  useEffect(() => {
    onRunEndRef.current = onRunEnd
  }, [onRunEnd])

  useEffect(() => {
    onFloorCheckpointRef.current = onFloorCheckpoint
  }, [onFloorCheckpoint])

  useEffect(() => {
    onSaveAndQuitRef.current = onSaveAndQuit
  }, [onSaveAndQuit])

  useEffect(() => {
    onBehaviorProfileChangeRef.current = onBehaviorProfileChange
  }, [onBehaviorProfileChange])

  useEffect(() => {
    const hp = snapshot?.hp
    if (hp === undefined) {
      return
    }

    const previousHp = previousHpRef.current
    previousHpRef.current = hp
    if (previousHp === null || hp >= previousHp) {
      return
    }

    setDamageFlashId((current) => current + 1)
  }, [snapshot?.hp])

  useEffect(() => {
    if (damageFlashId === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDamageFlashId(0)
    }, 320)
    return () => window.clearTimeout(timeoutId)
  }, [damageFlashId])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const game = initialCheckpointRef.current
      ? createGameFromCheckpoint(initialCheckpointRef.current)
      : createGame(initialRunConfigRef.current)
    applyInitialTimeScale(game)
    const pixiGame = new PixiGame(game)
    let disposed = false
    let runEndNotified = false
    let floorSaveRequested = false
    gameRef.current = game
    setGame(game)
    setFloorSaveError(null)

    const publishSnapshot = (): void => {
      if (!disposed) {
        const nextSnapshot = game.getUiSnapshot()
        setSnapshot(nextSnapshot)
        choiceFlowRef.current = nextSnapshot.pendingChoiceFlow
        const nextChoiceFlowKey = getChoiceFlowKey(nextSnapshot.pendingChoiceFlow)
        if (choiceFlowKeyRef.current !== nextChoiceFlowKey) {
          choiceFlowKeyRef.current = nextChoiceFlowKey
          setChoiceFlow(nextSnapshot.pendingChoiceFlow)
        }
      }
    }

    publishSnapshot()
    choiceFlowRef.current = null
    setChoiceFlow(null)
    choiceFlowKeyRef.current = null
    const demo = new URLSearchParams(window.location.search).get('demo')

    // This deterministic setup is only for browser smoke tests and local
    // development; normal runs retain the standard combat-driven progression.
    if (
      import.meta.env.DEV &&
      demo === 'level-up'
    ) {
      game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForNextLevel(1))
    }
    if (
      import.meta.env.DEV &&
      demo === 'gear'
    ) {
      // Two pickups exercise both the empty-slot comparison and the
      // replacement/upgrade flow without changing production drop behavior.
      game.spawnGearPickup({ x: 0, y: 0 })
      game.spawnGearPickup({ x: 0, y: 0 })
    }
    if (
      import.meta.env.DEV &&
      (demo === 'final' || demo === 'final-boss' || demo === 'inferno')
    ) {
      // This only exercises the existing simulation spawn API; production
      // encounter scheduling remains owned by the encounter system.
      game.spawnBoss('inferno-warden')
    }
    if (import.meta.env.DEV && demo === 'stairs') {
      game.spawnStairs({ x: 0, y: 0 })
    }

    const requestFloorSave = (): void => {
      if (disposed || floorSaveRequested || game.phase !== 'floor-transition') {
        return
      }
      const transition = game.state.floorTransition
      if (!transition?.savePending) {
        return
      }
      const checkpoint = game.getFloorCheckpointSnapshot()
      const save = onFloorCheckpointRef.current
      if (!checkpoint || !save) {
        setFloorSaveError('Unable to save the completed floor.')
        return
      }
      floorSaveRequested = true
      setFloorSaveError(null)
      void save(checkpoint)
        .then(() => {
          if (!disposed) {
            floorSaveRequested = false
            game.completeFloorSave()
          }
        })
        .catch((error: unknown) => {
          if (!disposed) {
            floorSaveRequested = false
            setFloorSaveError(
              error instanceof Error ? error.message : 'Unable to save the completed floor.',
            )
            publishSnapshot()
          }
        })
    }
    retryFloorSaveRef.current = requestFloorSave

    const unsubscribe = game.subscribe(() => {
      if (disposed) {
        return
      }

      // Phase changes are published immediately so the level-up overlay never
      // waits for the throttled HUD interval.
      publishSnapshot()
      pixiGame.refresh()

      if (
        (game.phase === 'defeat' || game.phase === 'results') &&
        !runEndNotified
      ) {
        runEndNotified = true
        const checkpoint = game.getTerminalCheckpointSnapshot()
        if (!checkpoint) {
          setFloorSaveError('Unable to capture the completed dungeon run.')
          return
        }
        onRunEndRef.current(game.getRunResultSnapshot(), checkpoint)
      }
      requestFloorSave()
    })

    const pressedMovementKeys = new Set<string>()
    const updateFreeMovementDirection = (): void => {
      let directionX = 0
      let directionY = 0
      if (pressedMovementKeys.has('a')) {
        directionX -= 1
      }
      if (pressedMovementKeys.has('d')) {
        directionX += 1
      }
      if (pressedMovementKeys.has('w')) {
        directionY -= 1
      }
      if (pressedMovementKeys.has('s')) {
        directionY += 1
      }
      game.setFreeMovementDirection(directionX, directionY)
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.closest(
          '[data-keybind-capture="true"][data-keybind-listening="true"]',
        ) || event.target.closest('[data-keyword-term="true"]') ||
        event.target.closest('[data-confirmation-dialog="true"]') ||
        event.target.closest('[data-report-bug-dialog="true"]'))
      ) {
        return
      }

      const key = normalizeKey(event.key)
      if (!key) {
        return
      }

      if (
        key === FREE_MOVEMENT_TOGGLE_KEY &&
        !event.repeat &&
        (game.phase === 'playing' || game.phase === 'level-up')
      ) {
        event.preventDefault()
        game.toggleFreeMovement()
        if (game.freeMovementEnabled) {
          updateFreeMovementDirection()
        } else {
          game.setFreeMovementDirection(0, 0)
        }
        return
      }

      if (isFreeMovementKey(key) && game.freeMovementEnabled && game.phase === 'playing') {
        event.preventDefault()
        pressedMovementKeys.add(key)
        updateFreeMovementDirection()
        return
      }

      if (game.phase === 'level-up' && key === activeKeybindsRef.current.skipChoice) {
        event.preventDefault()
        game.skipChoice()
        return
      }

      const behaviorProfileByKey: Readonly<Record<string, BehaviorProfileId>> = {
        [activeKeybindsRef.current.behaviorAggressive]: 'aggressive',
        [activeKeybindsRef.current.behaviorBalanced]: 'balanced',
        [activeKeybindsRef.current.behaviorCautious]: 'cautious',
      }
      const behaviorProfile = behaviorProfileByKey[key]
      if (behaviorProfile && !game.freeMovementEnabled) {
        event.preventDefault()
        if (game.setBehaviorProfile(behaviorProfile)) {
          onBehaviorProfileChangeRef.current?.(behaviorProfile)
        }
        return
      }

      if (game.phase === 'level-up') {
        const choiceIndex = [
          activeKeybindsRef.current.choiceLeft,
          activeKeybindsRef.current.choiceMiddle,
          activeKeybindsRef.current.choiceRight,
        ].indexOf(key)
        const choice = choiceFlowRef.current?.choices[choiceIndex]
        if (choice) {
          event.preventDefault()
          game.selectChoice(choice)
          return
        }
      }

      if (key !== 'escape') {
        return
      }

      if (game.phase === 'playing' || game.phase === 'level-up') {
        event.preventDefault()
        game.pause()
      } else if (game.phase === 'paused') {
        event.preventDefault()
        game.resume()
      }
    }

    const handleKeyUp = (event: KeyboardEvent): void => {
      const key = normalizeKey(event.key)
      if (!key || !isFreeMovementKey(key)) {
        return
      }
      pressedMovementKeys.delete(key)
      if (game.freeMovementEnabled) {
        updateFreeMovementDirection()
      }
    }

    const handleWindowBlur = (): void => {
      pressedMovementKeys.clear()
      if (game.freeMovementEnabled) {
        updateFreeMovementDirection()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })
    window.addEventListener('blur', handleWindowBlur)
    const snapshotTimer = window.setInterval(() => {
      if (game.phase === 'playing' || game.phase === 'floor-transition') {
        publishSnapshot()
      }
    }, UI_UPDATE_INTERVAL_MS)

    void pixiGame.initialize(container).catch((error: unknown) => {
      if (!disposed) {
        console.error('Unable to initialize the Pixi renderer.', error)
      }
    })

    return () => {
      disposed = true
      window.clearInterval(snapshotTimer)
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
      window.removeEventListener('blur', handleWindowBlur)
      unsubscribe()
      if (gameRef.current === game) {
        gameRef.current = null
      }
      setGame(null)
      choiceFlowKeyRef.current = null
      choiceFlowRef.current = null
      retryFloorSaveRef.current = () => undefined
      pixiGame.destroy()
    }
  }, [])

  const selectChoice = (choice: LevelUpUpgradeChoice | GearChoice): void => {
    gameRef.current?.selectChoice(choice)
  }

  const skipChoice = (): void => {
    gameRef.current?.skipChoice()
  }

  const rerollChoice = (): void => {
    const currentGame = gameRef.current
    if (!currentGame || !currentGame.canRerollActiveChoice) {
      return
    }
    currentGame.rerollActiveChoice()
  }

  const banishChoice = (choice: LevelUpUpgradeChoice): void => {
    gameRef.current?.banishActiveChoice(choice)
  }

  const selectBehaviorProfile = (profileId: BehaviorProfileId): void => {
    const currentGame = gameRef.current
    if (!currentGame) {
      return
    }
    if (currentGame.freeMovementEnabled) {
      currentGame.setFreeMovementEnabled(false)
    }
    if (currentGame.setBehaviorProfile(profileId)) {
      onBehaviorProfileChange?.(profileId)
    }
  }

  const toggleFreeMovement = (): void => {
    gameRef.current?.toggleFreeMovement()
  }

  const updateKeybinds = async (nextKeybinds: GameKeybinds): Promise<void> => {
    const previousKeybinds = activeKeybindsRef.current
    activeKeybindsRef.current = nextKeybinds
    setActiveKeybinds(nextKeybinds)
    try {
      await onKeybindsChange?.(nextKeybinds)
    } catch (error: unknown) {
      activeKeybindsRef.current = previousKeybinds
      setActiveKeybinds(previousKeybinds)
      throw error
    }
  }

  const phase = snapshot?.phase ?? 'loading'
  const dungeon: BugReportDungeonContext = {
    dungeonId: game?.state.run.dungeonId ?? runConfig?.dungeonId ?? 'unknown-dungeon',
    dungeonName: game?.dungeon.name ?? 'Unknown dungeon',
    currentFloor: game?.state.run.floor ?? snapshot?.floor ?? 1,
    maxFloor: game?.state.run.dungeonMaxFloor ?? game?.dungeon.defaultMaxFloor ?? 1,
    characterClassId: game?.state.player.characterClassId ?? runConfig?.characterClassId ?? 'knight',
    worldModifierIds: game?.state.run.worldModifierIds ?? runConfig?.worldModifierIds ?? [],
    runId: reportBugRunId,
  }

  return (
    <div
      className="game-canvas"
      data-game-phase={phase}
      data-world-modifiers={(initialCheckpoint?.gameState.run.worldModifierIds ??
        runConfig?.worldModifierIds ??
        []).join(',')}
      data-character-class={
        initialCheckpoint?.gameState.player.characterClassId ??
        runConfig?.characterClassId ??
        'knight'
      }
    >
      <div
        ref={containerRef}
        className="game-renderer"
        aria-label="Active Burger 4 game arena"
        role="img"
      />
      <div
        className={`damage-flash-overlay${
          damageFlashId > 0 ? ' damage-flash-overlay-active' : ''
        }`}
        aria-hidden="true"
      />
      {snapshot ? (
        <GameplayHud
          snapshot={snapshot}
          onSetMirrorcastTarget={(skillId) => {
            gameRef.current?.setMirrorcastTargetSkill(skillId)
          }}
          onSetCriticalSpellstrikeTarget={(skillId) => {
            gameRef.current?.setCriticalSpellstrikeTargetSkill(skillId)
          }}
          onSetBloodRiteTarget={(skillId) => {
            gameRef.current?.setBloodRiteTargetSkill(skillId)
          }}
        />
      ) : null}
      {snapshot ? <FloorHud snapshot={snapshot} /> : null}
      {snapshot ? <DungeonStats snapshot={snapshot} /> : null}
      {snapshot ? (
        <BehaviorHud
          snapshot={snapshot}
          keybinds={activeKeybinds}
          onSelectProfile={selectBehaviorProfile}
          onToggleFreeMovement={toggleFreeMovement}
        />
      ) : null}
      {import.meta.env.DEV && snapshot && game ? (
        <DevelopmentMenu
          game={game}
          snapshot={snapshot}
          open={developmentMenuOpen}
          onOpenChange={setDevelopmentMenuOpen}
        />
      ) : null}
      {phase === 'paused' ? (
        <PauseMenu
          keybinds={activeKeybinds}
          onKeybindsChange={updateKeybinds}
          onResume={() => gameRef.current?.resume()}
          onSaveAndQuit={async () => {
            await onSaveAndQuitRef.current?.()
          }}
          onForfeit={() => gameRef.current?.forfeit()}
          dungeon={dungeon}
          onSubmitBugReport={
            onSubmitBugReport
              ? (description, image) => onSubmitBugReport(description, image, dungeon)
              : undefined
          }
        />
      ) : null}
      {phase === 'floor-transition' && snapshot?.floorTransition?.savePending ? (
        <section className="floor-save-status" role="status" aria-live="polite">
          <p className="screen-kicker">Floor complete</p>
          <strong>Saving Floor {snapshot.floorTransition.fromFloor}…</strong>
          <progress aria-label="Saving floor checkpoint" />
          {floorSaveError ? (
            <>
              <p className="persistence-error" role="alert">{floorSaveError}</p>
              <button
                className="secondary-action"
                type="button"
                onClick={() => retryFloorSaveRef.current()}
              >
                Retry floor save
              </button>
            </>
          ) : (
            <span>Do not close this tab until the checkpoint is saved.</span>
          )}
        </section>
      ) : null}
      {choiceFlow ? (
        <LevelUpOverlay
          flow={choiceFlow}
          keybinds={activeKeybinds}
          characterClassId={runConfig?.characterClassId ?? 'knight'}
          ownedSkillIds={snapshot?.skills.map((skill) => skill.skillId) ?? []}
          equipment={snapshot?.equipment ?? {}}
          gearSets={snapshot?.gearSets ?? []}
          rerollsRemaining={snapshot?.rerollsRemaining ?? 0}
          banishesRemaining={snapshot?.banishesRemaining ?? 1}
          onSelect={selectChoice}
          onBanish={banishChoice}
          onReroll={rerollChoice}
          onSkip={skipChoice}
        />
      ) : null}
    </div>
  )
}

interface GameplayHudProps {
  snapshot: GameUiSnapshot
  onSetMirrorcastTarget: (skillId: SkillId | null) => void
  onSetCriticalSpellstrikeTarget: (skillId: SkillId | null) => void
  onSetBloodRiteTarget: (skillId: SkillId | null) => void
}

function GameplayHud({
  snapshot,
  onSetMirrorcastTarget,
  onSetCriticalSpellstrikeTarget,
  onSetBloodRiteTarget,
}: GameplayHudProps) {
  const hp = Math.max(0, Math.min(snapshot.hp, snapshot.maxHp))
  const xpPercent = snapshot.xpProgress * 100
  const orderedSkills = [...snapshot.skills].sort((left, right) =>
    left.skillId === BASIC_ATTACK_SKILL_ID
      ? -1
      : right.skillId === BASIC_ATTACK_SKILL_ID
        ? 1
        : 0,
  )
  const emptySkillSlotCount = Math.max(
    0,
    snapshot.skillSlotCount - orderedSkills.length,
  )
  const mirrorcastOwned = snapshot.skills.some(
    (skill) => skill.skillId === MIRRORCAST_SKILL_ID,
  )
  const criticalSpellstrikeOwned = snapshot.skills.some(
    (skill) => skill.skillId === CRITICAL_SPELLSTRIKE_SKILL_ID,
  )
  const bloodRiteOwned = snapshot.skills.some(
    (skill) => skill.skillId === BLOOD_RITE_SKILL_ID,
  )
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null)
  const [activeLoadoutSlot, setActiveLoadoutSlot] = useState<EquipmentSlotType | null>(
    null,
  )
  const [activeCharacterStatId, setActiveCharacterStatId] = useState<string | null>(
    null,
  )
  const skillTooltipAnchorRef = useRef<HTMLButtonElement | null>(null)
  const skillTooltipRef = useRef<HTMLDivElement | null>(null)
  const loadoutTooltipAnchorRef = useRef<HTMLButtonElement | null>(null)
  const loadoutTooltipRef = useRef<HTMLDivElement | null>(null)
  const characterStatTooltipAnchorRef = useRef<HTMLButtonElement | null>(null)
  const characterStatTooltipRef = useRef<HTMLDivElement | null>(null)
  const tooltipCloseTimeoutRef = useRef<number | null>(null)
  const cancelTooltipClose = (): void => {
    if (tooltipCloseTimeoutRef.current !== null) {
      window.clearTimeout(tooltipCloseTimeoutRef.current)
      tooltipCloseTimeoutRef.current = null
    }
  }
  const scheduleTooltipClose = (close: () => void): void => {
    cancelTooltipClose()
    tooltipCloseTimeoutRef.current = window.setTimeout(() => {
      tooltipCloseTimeoutRef.current = null
      close()
    }, 120)
  }
  useEffect(() => registerTooltipCloser(() => {
    const hasOpenTooltip =
      activeSkillId !== null ||
      activeLoadoutSlot !== null ||
      activeCharacterStatId !== null
    if (!hasOpenTooltip) {
      return false
    }
    cancelTooltipClose()
    setActiveSkillId(null)
    setActiveLoadoutSlot(null)
    setActiveCharacterStatId(null)
    return true
  }), [
    activeCharacterStatId,
    activeLoadoutSlot,
    activeSkillId,
  ])
  const skillTooltipStyle = useHudTooltipPosition(
    activeSkillId !== null,
    activeSkillId,
    'above',
    skillTooltipAnchorRef,
    skillTooltipRef,
  )
  const loadoutTooltipStyle = useHudTooltipPosition(
    activeLoadoutSlot !== null,
    activeLoadoutSlot,
    'right',
    loadoutTooltipAnchorRef,
    loadoutTooltipRef,
  )
  const characterStatTooltipStyle = useHudTooltipPosition(
    activeCharacterStatId !== null,
    activeCharacterStatId,
    'right',
    characterStatTooltipAnchorRef,
    characterStatTooltipRef,
  )
  const [castPulseIds, setCastPulseIds] = useState<Record<string, number>>({})
  const previousCastCountsRef = useRef(new Map<string, number>())
  const lastCastPulseTimesRef = useRef(new Map<string, number>())
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const now = performance.now()
    const pulseSkillIds: string[] = []

    for (const skill of snapshot.skills) {
      const previousCastCount = previousCastCountsRef.current.get(skill.skillId)
      if (
        previousCastCount !== undefined &&
        skill.castCount > previousCastCount &&
        now - (lastCastPulseTimesRef.current.get(skill.skillId) ?? -Infinity) >=
          MIN_CAST_PULSE_INTERVAL_MS
      ) {
        lastCastPulseTimesRef.current.set(skill.skillId, now)
        pulseSkillIds.push(skill.skillId)
      }
      previousCastCountsRef.current.set(skill.skillId, skill.castCount)
    }

    if (pulseSkillIds.length > 0) {
      window.setTimeout(() => {
        if (!mountedRef.current) {
          return
        }
        setCastPulseIds((current) => {
          const next = { ...current }
          for (const skillId of pulseSkillIds) {
            next[skillId] = (next[skillId] ?? 0) + 1
          }
          return next
        })
      }, 0)
    }
  }, [snapshot.skills])

  return (
    <section
      className={activeSkillId ? 'gameplay-hud gameplay-hud-tooltip-active' : 'gameplay-hud'}
      aria-labelledby="run-status-title"
    >
      <h2 id="run-status-title" className="visually-hidden">
        Run status
      </h2>
      <dl className="hud-stats">
        <div className="hud-stat hud-health">
          <dt className="visually-hidden">Player survivability</dt>
          <dd className="hud-health-bars">
            <div className="hud-health-row">
              <span className="hud-health-label">HP</span>
              <progress value={hp} max={snapshot.maxHp} aria-label="Player health" />
              <span className="hud-health-value">
                {Math.ceil(hp)} / {Math.ceil(snapshot.maxHp)}
              </span>
            </div>
            {snapshot.shield ? (
              <div className="hud-health-row hud-shield-row">
                <span className="hud-health-label">Shield</span>
                <progress
                  value={snapshot.shield.amount}
                  max={snapshot.shield.maxAmount}
                  aria-label="Absorb shield"
                />
                <span className="hud-health-value">
                  {Math.ceil(snapshot.shield.amount)} HP ·{' '}
                  {snapshot.shield.remainingSeconds.toFixed(1)}s
                </span>
              </div>
            ) : null}
          </dd>
        </div>
        <div className="hud-stat">
          <dt>Level</dt>
          <dd>{snapshot.level}</dd>
        </div>
        <div className="hud-stat hud-xp">
          <dt>XP</dt>
          <dd>
            <progress value={xpPercent} max={100} aria-label="Experience progress" />
            <span>
              {formatExperience(snapshot.xp)} / {formatExperience(snapshot.xpRequired)}
            </span>
          </dd>
        </div>
      </dl>
      {snapshot.boss ? (
        <section className="boss-hud" aria-label="Boss status">
          <div className="boss-hud-heading">
            <strong>{snapshot.boss.name}</strong>
            <span>
              {snapshot.boss.isFinal ? 'Final boss' : snapshot.boss.status}
            </span>
          </div>
          <progress
            value={snapshot.boss.hpProgress * 100}
            max={100}
            aria-label={`${snapshot.boss.name} health`}
          />
          <span>
            {Math.ceil(snapshot.boss.hp)} / {Math.ceil(snapshot.boss.maxHp)} HP
          </span>
          {snapshot.boss.enrage ? (
            <div className="boss-enrage" aria-label="Inferno Warden enrage">
              <strong>Enrage</strong>
              <span>
                {Math.floor(snapshot.boss.enrage.elapsedSeconds)}s · speed{' '}
                {snapshot.boss.enrage.movementSpeedMultiplier.toFixed(2)}x · damage{' '}
                {snapshot.boss.enrage.damageMultiplier.toFixed(2)}x · cooldown{' '}
                {snapshot.boss.enrage.cooldownMultiplier.toFixed(2)}x
              </span>
            </div>
          ) : null}
        </section>
      ) : null}
      {snapshot.stairs ? (
        <section
          className={`stairs-hud${snapshot.stairs.isFinal ? ' stairs-final' : ''}`}
          aria-label="Stairs status"
          aria-live="polite"
        >
          <div className="stairs-heading">
            <strong>
              {snapshot.stairs.isFinal ? 'Final stairs' : 'Stairs'}
            </strong>
            <span>Floor {snapshot.stairs.floorNumber}</span>
          </div>
          <span>
            {snapshot.stairs.rewardsCollected
              ? 'Rewards collected · resolve choices'
              : snapshot.stairs.playerTouching
                ? 'Touching stairs · collecting rewards'
                : 'Touch the stairs to descend'}
          </span>
        </section>
      ) : null}
      {snapshot.floorTransition ? (
        <section className="floor-transition-hud" role="status" aria-live="polite">
          <p className="screen-kicker">
            {snapshot.floorTransition.isFinal ? 'Run complete' : 'Floor transition'}
          </p>
          <strong>
            {snapshot.floorTransition.isFinal
              ? 'Descending to results'
              : snapshot.floorTransition.savePending
                ? 'Saving checkpoint'
              : `Entering Floor ${snapshot.floorTransition.toFloor}`}
          </strong>
          <progress
            value={snapshot.floorTransition.progress * 100}
            max={100}
            aria-label="Floor transition progress"
          />
          <span>
            {snapshot.floorTransition.savePending
              ? 'Waiting for the floor checkpoint to finish'
              : `${snapshot.floorTransition.remainingSeconds.toFixed(1)}s remaining`}
          </span>
        </section>
      ) : null}
      <section className="skill-hud" aria-labelledby="acquired-skills-title">
        <h3 id="acquired-skills-title" className="skill-hud-heading">
          <span>Skills</span>
          <span>{orderedSkills.length}/{snapshot.skillSlotCount}</span>
        </h3>
        <ul className="skill-list">
          {orderedSkills.map((skill) => {
            const tooltipId = `skill-tooltip-${skill.skillId}`
            const isActive = activeSkillId === skill.skillId
            const mirrorcastTargeted = snapshot.mirrorcastTargetSkillId === skill.skillId
            const criticalSpellstrikeTargeted =
              snapshot.criticalSpellstrikeTargetSkillId === skill.skillId
            const bloodRiteTargeted = snapshot.bloodRiteTargetSkillId === skill.skillId
            const canFocusMirrorcast =
              mirrorcastOwned &&
              skill.skillId !== MIRRORCAST_SKILL_ID &&
              skill.tags.includes('triggerable')
            const canFocusCriticalSpellstrike =
              criticalSpellstrikeOwned &&
              skill.tags.includes('triggerable')
            const canFocusBloodRite =
              bloodRiteOwned &&
              skill.skillId !== BASIC_ATTACK_SKILL_ID &&
              skill.skillId !== BLOOD_RITE_SKILL_ID
            const evolvedUpgrade = skill.upgrades.find((upgrade) =>
              upgrade.status === 'acquired' && upgrade.branch !== undefined,
            )
            const totalDamageLabel = skill.totalDamageDealt > 0
              ? `, total damage ${formatCompactDamage(skill.totalDamageDealt)}`
              : ''
            const totalHealingLabel = skill.totalHealingDone > 0
              ? `, total healing ${formatCompactDamage(skill.totalHealingDone)}`
              : ''
            return (
              <li className="skill-entry" key={skill.skillId}>
                <button
                  className={`skill-card${skill.cooldownProgress > 0 ? ' skill-card-on-cooldown' : ''}${skill.resonanceReady ? ' skill-card-resonance-ready' : ''}${evolvedUpgrade ? ' skill-card-evolved' : ''}${mirrorcastTargeted ? ' skill-card-mirrorcast-target' : ''}${criticalSpellstrikeTargeted ? ' skill-card-critical-spellstrike-target' : ''}${bloodRiteTargeted ? ' skill-card-blood-rite-target' : ''}`}
                  type="button"
                  ref={isActive ? skillTooltipAnchorRef : undefined}
                  aria-label={`${skill.name}, level ${skill.level}${evolvedUpgrade ? `, evolved through ${evolvedUpgrade.name}` : ''}${totalDamageLabel}${totalHealingLabel}, single-target DPS ${formatEstimatedDps(skill.estimatedSingleTargetDps)}${skill.resonanceReady ? ', resonance ready' : ''}`}
                  aria-describedby={isActive ? tooltipId : undefined}
                  onFocus={() => {
                    cancelTooltipClose()
                    closeAllTooltips()
                    setActiveSkillId(skill.skillId)
                  }}
                  onBlur={() => scheduleTooltipClose(() => setActiveSkillId(null))}
                  onMouseEnter={() => {
                    cancelTooltipClose()
                    closeAllTooltips()
                    setActiveSkillId(skill.skillId)
                  }}
                  onMouseLeave={() => scheduleTooltipClose(() => setActiveSkillId(null))}
                >
                  {(castPulseIds[skill.skillId] ?? 0) > 0 ? (
                    <span
                      className="skill-cast-pulse"
                      key={castPulseIds[skill.skillId]}
                      aria-hidden="true"
                    />
                  ) : null}
                  {skill.cooldownProgress > 0 ? (
                    <span
                      className="skill-cooldown-overlay"
                      style={{
                        clipPath: `inset(0 0 0 ${(1 - skill.cooldownProgress) * 100}%)`,
                      }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="skill-icon">
                    <SkillIcon skillId={skill.skillId} />
                  </span>
                  <span className={`skill-card-name${evolvedUpgrade ? ' skill-card-name-evolved' : ''}`}>
                    {skill.name}
                  </span>
                  <span className="skill-card-level">Lv. {skill.level}</span>
                  <span className="skill-card-dps">
                    <span>DPS</span>
                    <b>{formatEstimatedDps(skill.estimatedSingleTargetDps)}</b>
                  </span>
                </button>
                {isActive ? (
                  createPortal(
                    <div
                    className={tooltipClassName('skill-tooltip')}
                    id={tooltipId}
                    role="tooltip"
                    ref={skillTooltipRef}
                    style={skillTooltipStyle}
                    onMouseEnter={cancelTooltipClose}
                    onMouseLeave={() => scheduleTooltipClose(() => setActiveSkillId(null))}
                    onFocus={cancelTooltipClose}
                    onBlur={() => scheduleTooltipClose(() => setActiveSkillId(null))}
                  >
                    <strong>{skill.name}</strong>
                    {evolvedUpgrade ? (
                      <span className="skill-tooltip-evolved-badge">
                        EVOLVED
                      </span>
                    ) : null}
                    <p><KeywordText text={skill.description} /></p>
                    {skill.skillId === MIRRORCAST_SKILL_ID ? (
                      <section className="skill-mirrorcast-section" aria-label="Mirrorcast focus instructions">
                        <p className="skill-upgrade-heading">Echo focus</p>
                        <p>
                          By default, Mirrorcast copies the next eligible skill.
                          Open another eligible skill's tooltip and choose
                          <strong> Focus Echo</strong> to make it wait for that skill.
                          Choose <strong>Clear Echo Focus</strong> to return to automatic capture.
                        </p>
                        <p className="skill-mirrorcast-status">
                          {snapshot.mirrorcastTargetSkillId
                            ? `Focused on ${snapshot.skills.find((candidate) =>
                              candidate.skillId === snapshot.mirrorcastTargetSkillId,
                            )?.name ?? snapshot.mirrorcastTargetSkillId}.`
                            : 'Currently capturing the next eligible skill.'}
                        </p>
                      </section>
                    ) : null}
                    {canFocusMirrorcast ? (
                      <section className="skill-mirrorcast-section" aria-label="Mirrorcast focus control">
                        <button
                          className={`skill-mirrorcast-focus-button${mirrorcastTargeted ? ' active' : ''}`}
                          type="button"
                          aria-pressed={mirrorcastTargeted}
                          onClick={() => onSetMirrorcastTarget(
                            mirrorcastTargeted ? null : skill.skillId,
                          )}
                        >
                          {mirrorcastTargeted ? 'Clear Echo Focus' : 'Focus Echo'}
                        </button>
                        <p>
                          {mirrorcastTargeted
                            ? 'Mirrorcast will wait for this skill while focused.'
                            : 'Choose this to make Mirrorcast wait for this skill.'}
                        </p>
                      </section>
                    ) : null}
                    {skill.skillId === CRITICAL_SPELLSTRIKE_SKILL_ID ? (
                      <section className="skill-mirrorcast-section" aria-label="Critical Spellstrike focus instructions">
                        <p className="skill-upgrade-heading">Spellstrike focus</p>
                        <p>
                          Resolved Basic Attack critical hits replay your focused
                          Triggerable skill. Open a Triggerable skill&apos;s tooltip
                          and choose <strong>Focus Spellstrike</strong>.
                        </p>
                        <p className="skill-mirrorcast-status">
                          {snapshot.criticalSpellstrikeTargetSkillId
                            ? `Focused on ${snapshot.skills.find((candidate) =>
                              candidate.skillId === snapshot.criticalSpellstrikeTargetSkillId,
                            )?.name ?? snapshot.criticalSpellstrikeTargetSkillId}.`
                            : 'No Triggerable skill is focused; critical hits will not replay a skill.'}
                        </p>
                      </section>
                    ) : null}
                    {canFocusCriticalSpellstrike ? (
                      <section className="skill-mirrorcast-section" aria-label="Critical Spellstrike focus control">
                        <button
                          className={`skill-mirrorcast-focus-button${criticalSpellstrikeTargeted ? ' active' : ''}`}
                          type="button"
                          aria-pressed={criticalSpellstrikeTargeted}
                          onClick={() => onSetCriticalSpellstrikeTarget(
                            criticalSpellstrikeTargeted ? null : skill.skillId,
                          )}
                        >
                          {criticalSpellstrikeTargeted ? 'Clear Spellstrike Focus' : 'Focus Spellstrike'}
                        </button>
                        <p>
                          {criticalSpellstrikeTargeted
                            ? 'Critical Spellstrike will replay this skill on a Basic Attack critical hit.'
                            : 'Choose this skill for Critical Spellstrike to replay.'}
                        </p>
                      </section>
                    ) : null}
                    {skill.skillId === BLOOD_RITE_SKILL_ID ? (
                      <section className="skill-blood-rite-section" aria-label="Blood Rite focus instructions">
                        <p className="skill-upgrade-heading">Blood Debt focus</p>
                        <p>
                          By default, Blood Debt empowers the next eligible skill.
                          Open another skill's tooltip and choose
                          <strong> Focus Debt</strong> to make it wait for that skill.
                          Choose <strong>Clear Debt Focus</strong> to return to automatic capture.
                        </p>
                        <p className="skill-blood-rite-status">
                          {snapshot.bloodRiteTargetSkillId
                            ? `Focused on ${snapshot.skills.find((candidate) =>
                              candidate.skillId === snapshot.bloodRiteTargetSkillId,
                            )?.name ?? snapshot.bloodRiteTargetSkillId}.`
                            : 'Currently empowering the next eligible skill.'}
                        </p>
                      </section>
                    ) : null}
                    {canFocusBloodRite ? (
                      <section className="skill-blood-rite-section" aria-label="Blood Rite focus control">
                        <button
                          className={`skill-blood-rite-focus-button${bloodRiteTargeted ? ' active' : ''}`}
                          type="button"
                          aria-pressed={bloodRiteTargeted}
                          onClick={() => onSetBloodRiteTarget(
                            bloodRiteTargeted ? null : skill.skillId,
                          )}
                        >
                          {bloodRiteTargeted ? 'Clear Debt Focus' : 'Focus Debt'}
                        </button>
                        <p>
                          {bloodRiteTargeted
                            ? 'Blood Debt will wait for this skill while focused.'
                            : 'Choose this to make Blood Debt wait for this skill.'}
                        </p>
                      </section>
                    ) : null}
                    {skill.resonanceEffect ? (
                      <section className="skill-resonance-section" aria-label="Resonance effect">
                        <p className="skill-upgrade-heading">
                          <KeywordText text="Resonance" />: {skill.resonanceEffect.name}
                        </p>
                        <p><KeywordText text={skill.resonanceEffect.description} /></p>
                      </section>
                    ) : null}
                    <section className="skill-tags-section" aria-label="Skill tags">
                      <p className="skill-upgrade-heading">Skill tags</p>
                      <ul className="skill-tag-list">
                        {skill.tags.map((tag) => (
                          <li className="skill-tag" key={tag}>
                            <KeywordText text={tag} />
                          </li>
                        ))}
                      </ul>
                    </section>
                    {skill.damageTypes.length > 0 ? (
                      <section className="skill-damage-breakdown" aria-label="Calculated damage">
                        <p className="skill-upgrade-heading">Calculated damage</p>
                        <ul className="skill-upgrade-list">
                          {skill.damageTypes.map((damageType) => (
                            <li key={damageType}>
                              <span>{damageType}</span>
                              <span>{Math.round(skill.damage[damageType])}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                    {skill.skillId !== BASIC_ATTACK_SKILL_ID ? (
                      <section className="skill-attunement-breakdown" aria-label="Attunement added damage">
                        <p className="skill-upgrade-heading">
                          <KeywordText text="Attunement added damage" />
                        </p>
                        {skill.attunementDamageTypes.length > 0 ? (
                          <ul className="skill-upgrade-list">
                            {skill.attunementDamageTypes.map((damageType) => (
                              <li key={damageType}>
                                <span>{damageType}</span>
                                <span>{Math.round(skill.attunementDamage[damageType])}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="skill-cadence">None</p>
                        )}
                      </section>
                    ) : null}
                    {skill.totalDamageDealt > 0 ? (
                      <p className="skill-damage-total">
                        <span>Total damage</span>
                        <b>{formatCompactDamage(skill.totalDamageDealt)}</b>
                      </p>
                    ) : null}
                    {skill.totalHealingDone > 0 ? (
                      <p className="skill-healing-total">
                        <span>Total healing</span>
                        <b>{formatCompactDamage(skill.totalHealingDone)}</b>
                      </p>
                    ) : null}
                    {skill.healingPerCast !== null ? (
                      <p className="skill-cadence">
                        <span>
                          {skill.skillId === RALLYING_BANNER_SKILL_ID
                            ? 'Healing per target per cast/pulse'
                            : 'Healing per target'}
                        </span>
                        <b>{formatCadence(skill.healingPerCast)} HP</b>
                      </p>
                    ) : null}
                    {skill.shieldPerCast !== null ? (
                      <p className="skill-cadence">
                        <span>Shield per cast</span>
                        <b>{formatCadence(skill.shieldPerCast)} HP</b>
                      </p>
                    ) : null}
                    {skill.shieldDurationSeconds !== null ? (
                      <p className="skill-cadence">
                        <span>Shield duration</span>
                        <b>{formatCadence(skill.shieldDurationSeconds)}s</b>
                      </p>
                    ) : null}
                    <p className="skill-cadence">
                      <span>
                        {skill.attacksPerSecond === null ? 'Cooldown' : 'Attacks per second'}
                      </span>
                      <b>
                        {skill.attacksPerSecond === null
                          ? `${formatCadence(skill.cooldownSeconds ?? 0)}s`
                          : formatCadence(skill.attacksPerSecond)}
                      </b>
                    </p>
                    <p className="skill-dps">
                      <span>Estimated combined single-target sustained DPS</span>
                      <b>
                        {formatEstimatedDps(skill.estimatedSingleTargetDps)}
                      </b>
                    </p>
                    <p className="skill-assumption">{skill.dpsAssumption}</p>
                    {skill.skillModifiers.length > 0 || skill.gearModifiers.length > 0 ? (
                      <section className="skill-gear-modifiers" aria-label="Modifiers">
                        <p className="skill-upgrade-heading">Modifiers</p>
                        <ul className="skill-upgrade-list">
                          {skill.skillModifiers.map((modifier) => (
                            <li key={`skill-${modifier.id}`}>
                              <span><KeywordText text={modifier.label} /></span>
                              <b>{modifier.value}</b>
                            </li>
                          ))}
                          {skill.gearModifiers.map((modifier) => (
                            <li key={`gear-${modifier.id}`}>
                              <KeywordText text={formatHudModifier(modifier)} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                    {skill.upgrades.some((upgrade) =>
                      upgrade.status === 'acquired' && upgrade.branch !== undefined,
                    ) ? (
                      <section className="skill-evolution-section" aria-label="Skill evolution">
                        <p className="skill-upgrade-heading skill-evolution-heading">Evolution</p>
                        <ul className="skill-evolution-list">
                          {skill.upgrades
                            .filter((upgrade) =>
                              upgrade.status === 'acquired' && upgrade.branch !== undefined,
                            )
                            .map((upgrade) => (
                              <li key={upgrade.upgradeId}>
                                <strong>{upgrade.name}</strong>
                                <span>{upgrade.valueLabel}</span>
                                {upgrade.evolutionTags && upgrade.evolutionTags.length > 0 ? (
                                  <span className="skill-tag-list" aria-label="Evolution tags">
                                    {upgrade.evolutionTags.map((tag) => (
                                      <span className="skill-tag" key={tag}>
                                        <KeywordText text={tag} />
                                      </span>
                                    ))}
                                  </span>
                                ) : null}
                                <p><KeywordText text={upgrade.description} /></p>
                              </li>
                            ))}
                        </ul>
                      </section>
                    ) : null}
                    {skill.upgrades.some((upgrade) =>
                      upgrade.status === 'acquired' && upgrade.synergySkillIds !== undefined,
                    ) ? (
                      <section className="skill-synergy-section" aria-label="Skill synergies">
                        <p className="skill-upgrade-heading skill-synergy-heading">Synergies</p>
                        <ul className="skill-upgrade-list">
                          {skill.upgrades
                            .filter((upgrade) =>
                              upgrade.status === 'acquired' &&
                              upgrade.synergySkillIds !== undefined,
                            )
                            .map((upgrade) => (
                              <li key={upgrade.upgradeId}>
                                <strong>{upgrade.name}</strong>
                                <span>{upgrade.valueLabel}</span>
                                <p><KeywordText text={upgrade.description} /></p>
                              </li>
                            ))}
                        </ul>
                      </section>
                    ) : null}
                    {skill.upgrades.some((upgrade) =>
                      upgrade.status === 'acquired' &&
                      upgrade.branch === undefined &&
                      upgrade.synergySkillIds === undefined,
                    ) ? (
                      <>
                        <p className="skill-upgrade-heading">Upgrades</p>
                        <ul className="skill-upgrade-list">
                          {skill.upgrades
                            .filter((upgrade) =>
                              upgrade.status === 'acquired' &&
                              upgrade.branch === undefined &&
                              upgrade.synergySkillIds === undefined,
                            )
                            .map((upgrade) => (
                              <li key={upgrade.upgradeId}>
                                {upgrade.name} ({upgrade.valueLabel})
                              </li>
                            ))}
                        </ul>
                      </>
                    ) : null}
                    <span className="skill-tooltip-icon">
                      <SkillIcon skillId={skill.skillId} size={28} />
                    </span>
                    </div>,
                    document.body,
                  )
                ) : null}
              </li>
            )
          })}
          {Array.from({ length: emptySkillSlotCount }, (_, index) => (
            <li className="skill-entry" key={`empty-skill-slot-${index}`}>
              <div
                className="skill-card skill-card-empty"
                aria-label="Empty skill slot"
              >
                <span className="skill-icon" aria-hidden="true">＋</span>
                <span className="skill-card-name">Empty slot</span>
                <span className="skill-card-level">Available</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="equipped-loadout" aria-labelledby="equipped-loadout-title">
        <h3 id="equipped-loadout-title">Loadout</h3>
        <ul className="loadout-list">
          {EQUIPMENT_SLOTS.map((slot) => {
            const item = snapshot.equipment[slot]
            const itemSet = item?.setId
              ? snapshot.gearSets.find((set) => set.setId === item.setId)
              : undefined
            const tooltipId = `loadout-tooltip-${slot}`
            const isActive = activeLoadoutSlot === slot
            return (
              <li className="loadout-entry" key={slot}>
                <button
                  className={`loadout-item${item ? ` rarity-${item.rarity}` : ''}`}
                  data-slot={slot}
                  type="button"
                  ref={isActive ? loadoutTooltipAnchorRef : undefined}
                  aria-label={
                    item
                      ? `${HUD_SLOT_LABELS[slot]}: ${item.name}`
                      : `${HUD_SLOT_LABELS[slot]} slot empty`
                  }
                  aria-describedby={isActive ? tooltipId : undefined}
                  onFocus={() => {
                    cancelTooltipClose()
                    closeAllTooltips()
                    setActiveLoadoutSlot(slot)
                  }}
                  onBlur={() => scheduleTooltipClose(() => setActiveLoadoutSlot(null))}
                  onMouseEnter={() => {
                    cancelTooltipClose()
                    closeAllTooltips()
                    setActiveLoadoutSlot(slot)
                  }}
                  onMouseLeave={() => scheduleTooltipClose(() => setActiveLoadoutSlot(null))}
                >
                  <span className="loadout-slot">{HUD_SLOT_LABELS[slot]}</span>
                  {item ? (
                    <>
                      <strong>{item.name}</strong>
                      <span
                        className="loadout-rarity"
                        data-rarity={item.rarity}
                      >
                        {RARITY_VISUALS[item.rarity].icon} {RARITY_VISUALS[item.rarity].label}
                      </span>
                    </>
                  ) : (
                    <span className="loadout-empty">Empty</span>
                  )}
                </button>
                {isActive ? (
                  <div
                    className={tooltipClassName('loadout-tooltip')}
                    id={tooltipId}
                    role="tooltip"
                    ref={isActive ? loadoutTooltipRef : undefined}
                    style={loadoutTooltipStyle}
                    onMouseEnter={cancelTooltipClose}
                    onMouseLeave={() => scheduleTooltipClose(() => setActiveLoadoutSlot(null))}
                    onFocus={cancelTooltipClose}
                    onBlur={() => scheduleTooltipClose(() => setActiveLoadoutSlot(null))}
                  >
                    <strong>{HUD_SLOT_LABELS[slot]}</strong>
                    {item ? (
                      <>
                        <p>
                          {RARITY_VISUALS[item.rarity].label} {item.name}
                        </p>
                        <ImplicitModifierList modifiers={item.implicitModifiers} />
                        <ul>
                          {item.modifiers.map((modifier, index) => (
                            <li key={`${modifier.sourceId}-${modifier.id}-${index}`}>
                              {formatGearModifier(modifier)}
                            </li>
                          ))}
                        </ul>
                        {itemSet ? <GearSetFormation set={itemSet} /> : null}
                      </>
                    ) : (
                      <p>Empty slot</p>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
        <section className="character-stats" aria-labelledby="character-stats-title">
          <h4 id="character-stats-title">Character Stats</h4>
          <div className="character-stat-groups">
            {snapshot.characterStats.groups.map((group) => (
              <section
                className="character-stat-group"
                aria-labelledby={`character-stat-group-${group.id}`}
                key={group.id}
              >
                <h5 id={`character-stat-group-${group.id}`}>{group.title}</h5>
                <ul className="character-stat-list">
                  {group.stats.map((stat) => {
                    const tooltipId = `character-stat-tooltip-${stat.id}`
                    const isActive = activeCharacterStatId === stat.id
                    return (
                      <li className="character-stat-entry" key={stat.id}>
                        <button
                          className="character-stat-button"
                          type="button"
                          ref={isActive ? characterStatTooltipAnchorRef : undefined}
                          aria-label={`${stat.label}: ${stat.value}`}
                          aria-describedby={isActive ? tooltipId : undefined}
                          onFocus={() => {
                            cancelTooltipClose()
                            closeAllTooltips()
                            setActiveCharacterStatId(stat.id)
                          }}
                          onBlur={() => scheduleTooltipClose(() => setActiveCharacterStatId(null))}
                          onMouseEnter={() => {
                            cancelTooltipClose()
                            closeAllTooltips()
                            setActiveCharacterStatId(stat.id)
                          }}
                          onMouseLeave={() => scheduleTooltipClose(() => setActiveCharacterStatId(null))}
                        >
                          <span className="character-stat-label">{stat.label}</span>
                          <span className="character-stat-value">
                            <strong>{stat.value}</strong>
                            {stat.uncappedValue !== undefined ? (
                              <span className="character-stat-uncapped">
                                ({stat.uncappedValue})
                              </span>
                            ) : null}
                          </span>
                        </button>
                        {isActive ? (
                          <div
                            className={tooltipClassName('character-stat-tooltip')}
                            id={tooltipId}
                            role="tooltip"
                            ref={isActive ? characterStatTooltipRef : undefined}
                            style={characterStatTooltipStyle}
                            onMouseEnter={cancelTooltipClose}
                            onMouseLeave={() => scheduleTooltipClose(() => setActiveCharacterStatId(null))}
                            onFocus={cancelTooltipClose}
                            onBlur={() => scheduleTooltipClose(() => setActiveCharacterStatId(null))}
                          >
                            <strong>{stat.label}</strong>
                            <p className="character-stat-tooltip-value">
                              Current value: {stat.value}
                            </p>
                            {stat.uncappedValue !== undefined ? (
                              <p className="character-stat-tooltip-uncapped">
                                Uncapped total: {stat.uncappedValue}
                              </p>
                            ) : null}
                            <p><KeywordText text={stat.description} /></p>
                            {stat.damageBonuses !== undefined ? (
                              <section
                                className="attunement-bonus-panel"
                                aria-label="Current Attunement bonus by damage type"
                              >
                                <div className="attunement-bonus-heading">
                                  <span>Attunement bonus</span>
                                  <small>from Basic Attack</small>
                                </div>
                                <ul className="attunement-bonus-list">
                                  {stat.damageBonuses.map((bonus) => (
                                    <li
                                      className="attunement-bonus"
                                      data-damage-type={bonus.damageType}
                                      key={bonus.damageType}
                                    >
                                      <span className="attunement-bonus-type">
                                        <span className="attunement-bonus-orb" aria-hidden="true" />
                                        {bonus.label}
                                      </span>
                                      <strong>{bonus.value}</strong>
                                    </li>
                                  ))}
                                </ul>
                              </section>
                            ) : null}
                            <p className="character-stat-tooltip-applies">
                              <span>Applies to:</span> <KeywordText text={stat.appliesTo} />
                            </p>
                            {stat.sources !== undefined ? (
                              <div className="character-stat-tooltip-sources">
                                <p>Sources</p>
                                <ul>
                                  {stat.sources.map((source, index) => (
                                    <li key={`${source.label}-${index}`}>
                                      <span>{source.label}</span>
                                      <strong>{source.value}</strong>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </section>
      </section>
    </section>
  )
}

function DungeonStats({ snapshot }: { snapshot: GameUiSnapshot }) {
  return (
    <section
      className="dungeon-stats dungeon-stats-top"
      aria-labelledby="dungeon-stats-title"
    >
      <h3 id="dungeon-stats-title">Dungeon stats</h3>
      <dl className="dungeon-stats-list">
        <div className="dungeon-stat">
          <dt>Floor</dt>
          <dd>{snapshot.floor}</dd>
        </div>
        <div className="dungeon-stat">
          <dt>Essence</dt>
          <dd aria-label="Estimated Essence">{snapshot.estimatedEssence}</dd>
        </div>
        <div className="dungeon-stat">
          <dt>Kills</dt>
          <dd>{snapshot.killCount}</dd>
        </div>
        <div className="dungeon-stat">
          <dt>Gear blessing</dt>
          <dd>{snapshot.gearXpBlessingActive ? `${GEAR_XP_BLESSING_MULTIPLIER}x XP` : 'Inactive'}</dd>
        </div>
      </dl>
    </section>
  )
}

function FloorHud({ snapshot }: { snapshot: GameUiSnapshot }) {
  return (
    <section
      className="floor-hud floor-hud-top"
      aria-label="Floor status"
    >
      <div className="projection-heading">
        <strong>Floor {snapshot.floor}</strong>
        <span>{Math.ceil(snapshot.floorProgress * 100)}%</span>
      </div>
      <progress
        value={snapshot.floorProgress * 100}
        max={100}
        aria-label={`Floor ${snapshot.floor} progress`}
      />
      <span>
        {Math.floor(snapshot.floorElapsedTime)}s /{' '}
        {snapshot.floorDurationSeconds}s
      </span>
    </section>
  )
}

function BehaviorHud({
  snapshot,
  keybinds,
  onSelectProfile,
  onToggleFreeMovement,
}: {
  snapshot: GameUiSnapshot
  keybinds: GameKeybinds
  onSelectProfile: (profileId: BehaviorProfileId) => void
  onToggleFreeMovement: () => void
}) {
  return (
    <section className="behavior-hud behavior-hud-bottom" aria-labelledby="behavior-hud-title">
      <h3 id="behavior-hud-title" className="visually-hidden">
        Behavior
      </h3>
      <p className="behavior-hud-heading">Movement behavior</p>
      <div className="behavior-hud-profile-list">
        {BEHAVIOR_PROFILE_ORDER.map((profileId) => {
          const profile = BEHAVIOR_PROFILE_DEFINITIONS[profileId]
          const selected = !snapshot.behavior.freeMode &&
            snapshot.behavior.profileId === profile.id
          const keybind = keybinds[PROFILE_KEYBIND_IDS[profile.id]]
          return (
            <button
              className={`behavior-hud-profile${selected ? ' selected' : ''}`}
              type="button"
              aria-pressed={selected}
              aria-label={`${profile.name}: ${profile.description}. Shortcut ${formatKeybind(keybind)}`}
              title={profile.description}
              key={profile.id}
              onClick={() => onSelectProfile(profile.id)}
            >
              <span className="behavior-hud-profile-name">{profile.name}</span>
              <span className="keybind-hint">{formatKeybind(keybind)}</span>
            </button>
          )
        })}
        <button
          className={`behavior-hud-profile${snapshot.behavior.freeMode ? ' selected' : ''}`}
          type="button"
          aria-pressed={snapshot.behavior.freeMode}
          aria-label={`Free movement: control the character with WASD. Shortcut F. ${snapshot.behavior.freeMode ? 'Active' : 'Select'}`}
          title="Control the character directly with WASD. Automatic Dodge is disabled."
          onClick={onToggleFreeMovement}
        >
          <span className="behavior-hud-profile-name">Free</span>
          <span className="keybind-hint">F</span>
        </button>
      </div>
      <p className="behavior-hud-current-intent">
        {snapshot.behavior.freeMode
          ? <>WASD movement · Intent: <strong>{snapshot.behavior.activeIntent?.label ?? 'No active intent'}</strong></>
          : <>Intent: <strong>{snapshot.behavior.activeIntent?.label ?? 'No active intent'}</strong></>}
      </p>
    </section>
  )
}

interface DevelopmentMenuProps {
  game: Game
  snapshot: GameUiSnapshot
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DevelopmentMenu({
  game,
  snapshot,
  open,
  onOpenChange,
}: DevelopmentMenuProps) {
  const [timeScaleInput, setTimeScaleInput] = useState(() =>
    game.timeScale.toString(),
  )
  const [timeScaleError, setTimeScaleError] = useState<string | null>(null)
  const [selectedGearId, setSelectedGearId] = useState<ItemId>(
    GRANTABLE_GEAR_DEFINITIONS[0]?.id ?? '',
  )
  const [selectedGearSetId, setSelectedGearSetId] = useState<GearSetId | ''>('')
  const [selectedSkillId, setSelectedSkillId] = useState<string>(
    Object.values(SKILL_DEFINITIONS)[0]?.id ?? '',
  )
  const [selectedUpgradeId, setSelectedUpgradeId] = useState<string>(
    INITIAL_UPGRADES[0]?.id ?? '',
  )
  const [selectedSynergyId, setSelectedSynergyId] = useState<string>('')
  const [grantFeedback, setGrantFeedback] = useState<string | null>(null)
  const eligibleSynergies = getEligibleSynergyDefinitions(game.state)

  const entityCounts = {
    enemies: game.state.enemies.length,
    bosses: game.state.bosses?.length ?? 0,
    projectiles: game.state.projectiles.length,
    pickups: game.state.pickups.length,
    summons: game.state.summons.length,
    effects: game.state.effects.length,
  }
  const totalEntities =
    1 +
    entityCounts.enemies +
    entityCounts.bosses +
    entityCounts.projectiles +
    entityCounts.pickups +
    entityCounts.summons +
    entityCounts.effects

  const handleTimeScaleChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const input = event.target.value
    setTimeScaleInput(input)

    if (input.trim() === '') {
      setTimeScaleError('Enter a simulation speed.')
      return
    }

    const value = Number(input)
    if (!Number.isFinite(value)) {
      setTimeScaleError('Simulation speed must be a finite number.')
      return
    }

    const result = game.setTimeScale(value)
    if (!result.ok) {
      setTimeScaleError(result.error)
      return
    }

    setTimeScaleError(null)
    storeDevelopmentTimeScale(value)
  }

  const togglePause = (): void => {
    if (game.phase === 'paused') {
      game.resume()
    } else {
      game.pause()
    }
  }

  const canSpawnBoss =
    snapshot.phase === 'playing' && snapshot.encounterStatus === 'inactive'

  const spawnBoss = (): void => {
    if (!canSpawnBoss) {
      return
    }
    game.startEncounter()
  }

  const spawnInfernoWarden = (): void => {
    if (
      snapshot.phase !== 'playing' ||
      (game.state.bosses?.length ?? 0) > 0 ||
      game.state.stairs !== undefined
    ) {
      return
    }
    // startEncounter uses the normal named encounter when content provides it.
    // The direct spawn fallback keeps this development harness useful while
    // authored final encounter scheduling is being assembled.
    if (!game.startEncounter('inferno-warden')) {
      game.spawnBoss('inferno-warden')
    }
  }

  const spawnStairsAtPlayer = (isFinal: boolean): void => {
    if (
      snapshot.phase !== 'playing' ||
      game.state.stairs !== undefined ||
      game.state.floorTransition !== undefined
    ) {
      return
    }
    game.spawnStairs(
      { x: game.state.player.x, y: game.state.player.y },
      isFinal,
    )
    // Touch the stairs through the normal update path instead of changing
    // simulation state from React.
    game.update(1 / 60)
  }

  const reportGrantResult = (
    result: DevelopmentGrantResult,
    changedMessage: string,
    unchangedMessage: string,
  ): void => {
    setGrantFeedback(
      result.ok
        ? result.changed
          ? changedMessage
          : unchangedMessage
        : result.error,
    )
  }

  const grantSelectedGear = (): void => {
    if (!selectedGearId) {
      return
    }
    const item = ALL_ITEM_DEFINITIONS.find(
      (candidate) => candidate.id === selectedGearId,
    )
    if (!item || item.starterOnly || !isItemId(selectedGearId)) {
      setGrantFeedback('Select a valid gear item.')
      return
    }
    const setId = selectedGearSetId || undefined
    reportGrantResult(
      game.grantDebugGear(selectedGearId, setId),
      `Granted ${getItemDisplayName(item, setId)}.`,
      `${getItemDisplayName(item, setId)} is already equipped.`,
    )
  }

  const grantSelectedSkill = (): void => {
    if (!isSkillId(selectedSkillId)) {
      return
    }
    const skill = SKILL_DEFINITIONS[selectedSkillId]
    reportGrantResult(
      game.grantDebugSkill(selectedSkillId),
      `Granted ${skill.name}.`,
      `${skill.name} is already equipped.`,
    )
  }

  const grantSelectedUpgrade = (): void => {
    const upgrade = GRANTABLE_UPGRADE_DEFINITIONS.find(
      (candidate) => candidate.id === selectedUpgradeId,
    )
    if (!upgrade) {
      setGrantFeedback('Select a valid upgrade.')
      return
    }
    reportGrantResult(
      game.grantDebugUpgrade(upgrade.id),
      `Granted ${upgrade.name}.`,
      `${upgrade.name} was already granted; applied it again for testing.`,
    )
  }

  const grantSelectedSynergy = (): void => {
    const synergy = eligibleSynergies.find(
      (candidate) => candidate.id === selectedSynergyId,
    )
    if (!synergy) {
      setGrantFeedback('Select an eligible synergy.')
      return
    }
    const skillNames = synergy.synergySkillIds
      .map((skillId) => SKILL_DEFINITIONS[skillId].name)
      .join(' + ')
    reportGrantResult(
      game.grantDebugSynergy(synergy.id),
      `Granted ${synergy.name} (${skillNames}).`,
      `${synergy.name} was already granted.`,
    )
  }

  return (
    <div className="development-controls">
      <button
        className="development-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="development-menu"
        onClick={() => onOpenChange(!open)}
      >
        Development Menu
      </button>
      {open ? (
        <section
          className="development-menu"
          id="development-menu"
          aria-labelledby="development-menu-title"
        >
          <p className="development-kicker">Developer controls</p>
          <h2 id="development-menu-title">Development Menu</h2>
          <button
            className="debug-spawn-button"
            type="button"
            onClick={togglePause}
            disabled={
              snapshot.phase !== 'playing' && snapshot.phase !== 'paused' &&
              snapshot.phase !== 'level-up'
            }
          >
            {snapshot.phase === 'paused' ? 'Resume run' : 'Pause run'}
          </button>
          <button
            className="debug-spawn-button debug-spawn-boss-button"
            type="button"
            onClick={spawnBoss}
            disabled={!canSpawnBoss}
          >
            Spawn Boss
          </button>
          <button
            className="debug-spawn-button debug-spawn-final-button"
            type="button"
            onClick={spawnInfernoWarden}
            disabled={
              snapshot.phase !== 'playing' ||
              (game.state.bosses?.length ?? 0) > 0
            }
          >
            Spawn Inferno Warden
          </button>
          <div className="debug-transition-control">
            <p className="development-control-label">Run-flow preview</p>
            <div className="debug-spawn-actions">
              <button
                className="debug-spawn-button"
                type="button"
                onClick={() => spawnStairsAtPlayer(false)}
                disabled={snapshot.phase !== 'playing'}
              >
                Test stairs transition
              </button>
              <button
                className="debug-spawn-button debug-spawn-final-button"
                type="button"
                onClick={() => spawnStairsAtPlayer(true)}
                disabled={snapshot.phase !== 'playing'}
              >
                Test final stairs & results
              </button>
            </div>
          </div>
          <div className="debug-grant-control">
            <p className="development-control-label">Grant gear</p>
            <div className="debug-grant-row">
              <label className="visually-hidden" htmlFor="debug-gear-set-select">
                Gear set
              </label>
              <select
                id="debug-gear-set-select"
                value={selectedGearSetId}
                onChange={(event) => {
                  const value = event.target.value
                  setSelectedGearSetId(isGearSetId(value) ? value : '')
                }}
              >
                <option value="">No set</option>
                {ALL_GEAR_SET_DEFINITIONS.map((set) => (
                  <option value={set.id} key={set.id}>
                    {set.name} set
                  </option>
                ))}
              </select>
              <label className="visually-hidden" htmlFor="debug-gear-select">
                Gear item
              </label>
              <select
                id="debug-gear-select"
                value={selectedGearId}
                onChange={(event) => setSelectedGearId(event.target.value)}
              >
                {GRANTABLE_GEAR_DEFINITIONS.map((item) => (
                  <option value={item.id} key={item.id}>
                    {getItemDisplayName(item)}
                  </option>
                ))}
              </select>
              <button
                className="debug-spawn-button"
                type="button"
                onClick={grantSelectedGear}
                disabled={snapshot.phase !== 'playing' &&
                  snapshot.phase !== 'paused' &&
                  snapshot.phase !== 'level-up'}
              >
                Give gear
              </button>
            </div>
          </div>
          <div className="debug-grant-control">
            <p className="development-control-label">Grant skill</p>
            <div className="debug-grant-row">
              <label className="visually-hidden" htmlFor="debug-skill-select">
                Skill
              </label>
              <select
                id="debug-skill-select"
                value={selectedSkillId}
                onChange={(event) => setSelectedSkillId(event.target.value)}
              >
                {Object.values(SKILL_DEFINITIONS).map((skill) => (
                  <option value={skill.id} key={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
              <button
                className="debug-spawn-button"
                type="button"
                onClick={grantSelectedSkill}
                disabled={snapshot.phase !== 'playing' &&
                  snapshot.phase !== 'paused' &&
                  snapshot.phase !== 'level-up'}
              >
                Give skill
              </button>
            </div>
          </div>
          <div className="debug-grant-control">
            <p className="development-control-label">Grant eligible synergy</p>
            <div className="debug-grant-row">
              <label className="visually-hidden" htmlFor="debug-synergy-select">
                Synergy
              </label>
              <select
                id="debug-synergy-select"
                value={
                  eligibleSynergies.some((synergy) => synergy.id === selectedSynergyId)
                    ? selectedSynergyId
                    : ''
                }
                onChange={(event) => setSelectedSynergyId(event.target.value)}
                disabled={eligibleSynergies.length === 0}
              >
                <option value="">
                  {eligibleSynergies.length === 0
                    ? 'No eligible synergies'
                    : 'Select a synergy'}
                </option>
                {eligibleSynergies.map((synergy) => (
                  <option value={synergy.id} key={synergy.id}>
                    {synergy.name} ({synergy.synergySkillIds
                      .map((skillId) => SKILL_DEFINITIONS[skillId].name)
                      .join(' + ')})
                  </option>
                ))}
              </select>
              <button
                className="debug-spawn-button"
                type="button"
                onClick={grantSelectedSynergy}
                disabled={
                  eligibleSynergies.length === 0 ||
                  (snapshot.phase !== 'playing' &&
                    snapshot.phase !== 'paused' &&
                    snapshot.phase !== 'level-up')
                }
              >
                Give synergy
              </button>
            </div>
          </div>
          <div className="debug-grant-control">
            <p className="development-control-label">Grant upgrade</p>
            <div className="debug-grant-row">
              <label className="visually-hidden" htmlFor="debug-upgrade-select">
                Upgrade
              </label>
              <select
                id="debug-upgrade-select"
                value={selectedUpgradeId}
                onChange={(event) => setSelectedUpgradeId(event.target.value)}
              >
                {GRANTABLE_UPGRADE_DEFINITIONS.map((upgrade) => (
                  <option value={upgrade.id} key={upgrade.id}>
                    {upgrade.name}
                  </option>
                ))}
              </select>
              <button
                className="debug-spawn-button"
                type="button"
                onClick={grantSelectedUpgrade}
                disabled={snapshot.phase !== 'playing' &&
                  snapshot.phase !== 'paused' &&
                  snapshot.phase !== 'level-up'}
              >
                Give upgrade
              </button>
            </div>
          </div>
          {grantFeedback ? (
            <p className="input-help debug-grant-feedback" role="status">
              {grantFeedback}
            </p>
          ) : null}
          <dl className="entity-counts" aria-label="Entity counts">
            <div>
              <dt>Total entities</dt>
              <dd>{totalEntities}</dd>
            </div>
            <div>
              <dt>Enemies</dt>
              <dd>{entityCounts.enemies}</dd>
            </div>
            <div>
              <dt>Bosses</dt>
              <dd>{entityCounts.bosses}</dd>
            </div>
            <div>
              <dt>Projectiles</dt>
              <dd>{entityCounts.projectiles}</dd>
            </div>
            <div>
              <dt>Pickups</dt>
              <dd>{entityCounts.pickups}</dd>
            </div>
            <div>
              <dt>Summons</dt>
              <dd>{entityCounts.summons}</dd>
            </div>
            <div>
              <dt>Effects</dt>
              <dd>{entityCounts.effects}</dd>
            </div>
          </dl>
          <div className="debug-spawn-control">
            <p className="development-control-label">Stress spawn</p>
            <div className="debug-spawn-actions">
              {DEBUG_SPAWN_COUNTS.map((count: DebugSpawnCount) => (
                <button
                  className="debug-spawn-button"
                  key={count}
                  type="button"
                  onClick={() => game.spawnDebugEnemies(count)}
                  disabled={snapshot.phase !== 'playing'}
                >
                  Spawn {count} enemies
                </button>
              ))}
            </div>
            <p className="input-help">
              Development-only stress spawns add enemies immediately.
            </p>
          </div>
          <div className="time-scale-control">
            <label htmlFor="time-scale-input">Simulation speed</label>
            <div className="time-scale-input-row">
              <input
                id="time-scale-input"
                type="number"
                min={MIN_TIME_SCALE}
                max={MAX_TIME_SCALE}
                step={0.1}
                value={timeScaleInput}
                aria-invalid={timeScaleError !== null}
                aria-describedby={
                  timeScaleError ? 'time-scale-error' : 'time-scale-help'
                }
                onChange={handleTimeScaleChange}
              />
              <span aria-hidden="true">x</span>
            </div>
            {timeScaleError ? (
              <p className="input-error" id="time-scale-error" role="alert">
                {timeScaleError}
              </p>
            ) : (
              <p className="input-help" id="time-scale-help">
                Applied: {game.timeScale}x (range {MIN_TIME_SCALE}x–
                {MAX_TIME_SCALE}x)
              </p>
            )}
          </div>
          <button
            className="end-run-button"
            type="button"
            onClick={() => game.endRun()}
            disabled={snapshot.phase !== 'playing'}
          >
            End Run
          </button>
        </section>
      ) : null}
    </div>
  )
}
