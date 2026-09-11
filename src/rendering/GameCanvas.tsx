import { useEffect, useRef, useState } from 'react'
import {
  createGame,
  createGameFromCheckpoint,
  DEFAULT_TIME_SCALE,
  type Game,
  type GameUiSnapshot,
  type GearChoice,
  type BehaviorProfileId,
  type TargetPriorityId,
  type RunConfig,
  type PendingChoiceFlow,
  type RunResultSnapshot,
  type GameCheckpoint,
} from '../game'
import type { AbyssModifierChoice } from '../content/modifiers/AbyssModifiers'
import {
  FREE_MOVEMENT_KEYS,
  FREE_MOVEMENT_TOGGLE_KEY,
  normalizeKey,
  type GameKeybinds,
} from '../input/Keybinds'
import {
  serializeGearModifiers,
} from '../content/gear/ModifierPools'
import { xpRequiredForNextLevel } from '../content/progression/XpBalance'
import {
  type SkillId,
} from '../content/skills/Skills'
import {
  type LevelUpUpgradeChoice,
} from '../content/upgrades/Upgrades'
import { LevelUpOverlay } from './LevelUpOverlay'
import { AbyssModifierOverlay } from '../abyss/AbyssModifierOverlay'
import { PauseMenu } from './PauseMenu'
import { PixiGame } from './PixiGame'
import type { BugReportDungeonContext, BugReportImage } from '../bug-report'

interface GameCanvasProps {
  onRunEnd: (result: RunResultSnapshot, checkpoint: GameCheckpoint) => void
  runConfig?: RunConfig
  initialCheckpoint?: GameCheckpoint | null
  onFloorCheckpoint?: (checkpoint: GameCheckpoint) => Promise<void>
  onSaveAndQuit?: () => Promise<void>
  onBehaviorProfileChange?: (profileId: BehaviorProfileId) => void
  onTargetPriorityChange?: (priorityId: TargetPriorityId) => void
  keybinds: GameKeybinds
  onKeybindsChange?: (keybinds: GameKeybinds) => Promise<void>
  reportBugRunId?: string
  onSubmitBugReport?: (
    description: string,
    image: BugReportImage | undefined,
    dungeon: BugReportDungeonContext,
  ) => Promise<void>
  /**
   * Whether the development menu, its hotkey, the demo query parameters and
   * the remembered simulation speed are on. The app sets it from the build's
   * environment and the signed-in account's admin role, so a player on the
   * dev deployment sees a plain arena.
   */
  developmentToolsEnabled?: boolean
}

const UI_UPDATE_INTERVAL_MS = 100
const MIN_CAST_PULSE_INTERVAL_MS = 240


import { DevelopmentMenu } from './DevelopmentMenu'
import { FloorHud, VitalsPanel } from './hud/StatusPanels'
import { useHudTooltips } from './hud/useHudTooltips'
import { SkillHud } from './hud/SkillHud'
import { BehaviorControl } from './hud/BehaviorControl'
import { CharacterStatsPanel, LoadoutPanel } from './hud/EquippedLoadout'
import { HudInspector, RunStatsPanel } from './hud/HudInspector'
import type { HudInspectorTab } from './hud/HudInspectorTabs'
import { HudToolbar } from './hud/HudToolbar'
import { TouchControls } from './hud/TouchControls'
import { useTouchOnlyDevice } from '../input/useTouchOnlyDevice'
import { createSteeringHandover } from './hud/steering'
import { getStoredDevelopmentTimeScale } from './developmentTimeScale'



function getChoiceFlowKey(
  flow: Readonly<PendingChoiceFlow> | null,
): string | null {
  if (!flow) {
    return null
  }
  const choices = flow.choices.map((choice) =>
    'modifierId' in choice
      ? `abyss:${choice.modifierId}`
      : 'upgradeId' in choice
      ? choice.upgradeId
      : choice.type === 'gear'
        ? `${choice.type}:${choice.itemId}:${choice.slot}:${choice.rarity}:${choice.setId ?? ''}:${serializeGearModifiers(choice.modifiers)}`
        : choice.type === 'upgrade-equipped-item'
          ? `${choice.type}:${choice.itemId}:${choice.slot}:${choice.itemRarity}:${choice.rarity}:${choice.setId ?? ''}:${choice.upgradedModifierId}:${choice.fromTier}:${choice.toTier}:${serializeGearModifiers(choice.upgradedModifiers)}`
          : choice.type === 'gear-rarity-floor'
            ? `${choice.type}:${choice.minimumRarity}:${choice.rarity}`
            : choice.type,
  )
  const flowIdentity = flow.type === 'level-up'
    ? flow.level
    : flow.type === 'gear-pickup'
      ? flow.pickupId
      : flow.floor
  return `${flow.type}:${flowIdentity}:${choices.join(',')}`
}

function isFreeMovementKey(
  value: string,
): value is typeof FREE_MOVEMENT_KEYS[number] {
  return FREE_MOVEMENT_KEYS.some((movementKey) => movementKey === value)
}

function applyInitialTimeScale(game: Game, developmentToolsEnabled: boolean): void {
  if (!developmentToolsEnabled) {
    return
  }
  game.setTimeScale(getStoredDevelopmentTimeScale() ?? DEFAULT_TIME_SCALE)
}

export function GameCanvas({
  onRunEnd,
  runConfig,
  initialCheckpoint,
  onFloorCheckpoint,
  onSaveAndQuit,
  onBehaviorProfileChange,
  onTargetPriorityChange,
  keybinds,
  onKeybindsChange,
  reportBugRunId,
  onSubmitBugReport,
  developmentToolsEnabled = false,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Read by the mount-once effect below, which cannot see prop changes.
  const developmentToolsRef = useRef(developmentToolsEnabled)
  useEffect(() => {
    developmentToolsRef.current = developmentToolsEnabled
  }, [developmentToolsEnabled])
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
  // The inspector lives here rather than inside the HUD because Escape has to
  // choose between closing it and pausing the run, and the key handler that
  // makes that choice is in this component.
  const [inspectorTab, setInspectorTab] = useState<HudInspectorTab | null>(null)
  const inspectorTabRef = useRef<HudInspectorTab | null>(null)
  useEffect(() => {
    inspectorTabRef.current = inspectorTab
  }, [inspectorTab])
  // Holds the profile a steering drag interrupted, and restores it on release.
  const steeringRef = useRef(createSteeringHandover())
  const touchOnly = useTouchOnlyDevice()
  const [developmentMenuOpen, setDevelopmentMenuOpen] = useState(
    () => developmentToolsEnabled &&
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

  /*
   * Free movement is a keyboard mode, and a run can arrive in it: saved on a
   * desktop and resumed on a phone, or left in it before the mode was hidden
   * from touch devices. Standing still with no way to steer but a held finger
   * reads as the game having stopped, so a touch device is handed back to its
   * profile on arrival. A steering drag turns free movement on again for its
   * own length, which is after this has run.
   */
  useEffect(() => {
    if (!touchOnly || game === null || !game.freeMovementEnabled) {
      return
    }
    game.setFreeMovementEnabled(false)
  }, [game, touchOnly])

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

    const demo = new URLSearchParams(window.location.search).get('demo')
    const game = initialCheckpointRef.current
      ? createGameFromCheckpoint(initialCheckpointRef.current)
      : createGame(
          developmentToolsRef.current && demo === 'starting-level-up'
            ? {
                ...initialRunConfigRef.current,
                startingLevel: Math.max(
                  2,
                  initialRunConfigRef.current.startingLevel ?? 1,
                ),
              }
            : initialRunConfigRef.current,
        )
    applyInitialTimeScale(game, developmentToolsRef.current)
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

    // This deterministic setup is only for browser smoke tests and local
    // development; normal runs retain the standard combat-driven progression.
    if (
      developmentToolsRef.current &&
      demo === 'level-up'
    ) {
      game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForNextLevel(1))
    }
    if (
      developmentToolsRef.current &&
      demo === 'gear'
    ) {
      // Two pickups exercise both the empty-slot comparison and the
      // replacement/upgrade flow without changing production drop behavior.
      game.spawnGearPickup({ x: 0, y: 0 })
      game.spawnGearPickup({ x: 0, y: 0 })
    }
    if (
      developmentToolsRef.current &&
      (demo === 'final' || demo === 'final-boss' || demo === 'inferno')
    ) {
      // This only exercises the existing simulation spawn API; production
      // encounter scheduling remains owned by the encounter system.
      game.spawnBoss('inferno-warden')
    }
    if (developmentToolsRef.current && demo === 'stairs') {
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

      // The backquote toggles the development menu wherever the tools are on.
      // Checked before normalisation, which drops keys the keybinds don't use.
      if (developmentToolsRef.current && event.key === '`' && !event.repeat) {
        event.preventDefault()
        setDevelopmentMenuOpen((menuOpen) => !menuOpen)
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

      // Escape unwinds one layer at a time: an open HUD popover closes itself,
      // then the inspector, and the run pauses only once nothing is open over
      // it. The popover is read from the DOM because this handler runs before
      // the popover's own, and pausing underneath it is the bug that produced.
      if (document.querySelector('[data-hud-popover="open"]') !== null) {
        return
      }
      if (inspectorTabRef.current !== null) {
        event.preventDefault()
        setInspectorTab(null)
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

  const selectChoice = (
    choice: LevelUpUpgradeChoice | GearChoice | AbyssModifierChoice,
  ): void => {
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

  const selectTargetPriority = (priorityId: TargetPriorityId): void => {
    const currentGame = gameRef.current
    /*
     * No free-movement reset here, unlike the profile above: steering the
     * character yourself does not stop it attacking, so the priority applies
     * either way and turning steering off would be a surprise.
     */
    if (currentGame?.setTargetPriority(priorityId) === true) {
      onTargetPriorityChange?.(priorityId)
    }
  }

  const toggleFreeMovement = (): void => {
    gameRef.current?.toggleFreeMovement()
  }

  /*
   * Steering the arena by pointer. The handover between the behaviour profile
   * and the player's thumb lives in `createSteeringHandover`, which is where
   * its rules are tested.
   */
  const startSteering = (): void => {
    steeringRef.current.start(gameRef.current)
  }

  const steer = (directionX: number, directionY: number): void => {
    steeringRef.current.steer(gameRef.current, directionX, directionY)
  }

  const endSteering = (): void => {
    steeringRef.current.end(gameRef.current)
  }

  const pauseRun = (): void => {
    setInspectorTab(null)
    gameRef.current?.pause()
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
      data-run-mode={
        initialCheckpoint?.gameState.run.modeId ??
        runConfig?.modeId ??
        'dungeon'
      }
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
      <div className="arena-vignette" aria-hidden="true" />
      <div
        className={`damage-flash-overlay${
          damageFlashId > 0 ? ' damage-flash-overlay-active' : ''
        }`}
        aria-hidden="true"
      />
      {phase === 'playing' ? (
        <TouchControls
          onSteerStart={startSteering}
          onSteer={steer}
          onSteerEnd={endSteering}
        />
      ) : null}
      {snapshot ? (
        <GameplayHud
          snapshot={snapshot}
          keybinds={activeKeybinds}
          inspectorTab={inspectorTab}
          onInspectorTabChange={setInspectorTab}
          onPause={pauseRun}
          onSelectBehaviorProfile={selectBehaviorProfile}
          onSelectTargetPriority={selectTargetPriority}
          onToggleFreeMovement={toggleFreeMovement}
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
      {developmentToolsEnabled && snapshot && game ? (
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
      {choiceFlow?.type === 'abyss-modifier' ? (
        <AbyssModifierOverlay
          flow={choiceFlow}
          onSelect={(modifierId) => {
            gameRef.current?.selectChoice({
              modifierId,
              name: choiceFlow.choices.find((choice) => choice.modifierId === modifierId)?.name ?? '',
              description: choiceFlow.choices.find((choice) => choice.modifierId === modifierId)?.description ?? '',
              dangerScore: choiceFlow.choices.find((choice) => choice.modifierId === modifierId)?.dangerScore ?? 0,
            })
          }}
        />
      ) : choiceFlow ? (
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


export interface GameplayHudProps {
  snapshot: GameUiSnapshot
  keybinds: GameKeybinds
  inspectorTab: HudInspectorTab | null
  onInspectorTabChange: (tab: HudInspectorTab | null) => void
  onPause: () => void
  onSelectBehaviorProfile: (profileId: BehaviorProfileId) => void
  onSelectTargetPriority: (priorityId: TargetPriorityId) => void
  onToggleFreeMovement: () => void
  onSetMirrorcastTarget: (skillId: SkillId | null) => void
  onSetCriticalSpellstrikeTarget: (skillId: SkillId | null) => void
  onSetBloodRiteTarget: (skillId: SkillId | null) => void
}

/**
 * The in-run HUD, laid out as a frame around the arena rather than as panels
 * dropped onto it.
 *
 * Every region is a cell of one grid whose tracks size to their contents, so
 * two panels can no longer end up on top of each other the way the old
 * independently positioned corners did at 1280x720. What stays resident is what
 * changes second to second: vitals, the floor clock, the skill bar, and the
 * banners for a boss, the stairs and a floor change. Everything else is a tab
 * of the inspector.
 */
export function GameplayHud({
  snapshot,
  keybinds,
  inspectorTab,
  onInspectorTabChange,
  onPause,
  onSelectBehaviorProfile,
  onSelectTargetPriority,
  onToggleFreeMovement,
  onSetMirrorcastTarget,
  onSetCriticalSpellstrikeTarget,
  onSetBloodRiteTarget,
}: GameplayHudProps) {
  // Held here rather than inside each panel: only one tooltip may be open
  // across the three, and they share one close timer.
  const tooltips = useHudTooltips()
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
      className={tooltips.skill.activeKey !== null
        ? 'gameplay-hud gameplay-hud-tooltip-active'
        : 'gameplay-hud'}
      aria-labelledby="run-status-title"
    >
      <h2 id="run-status-title" className="visually-hidden">
        Run status
      </h2>
      <div className="hud-bar hud-bar-top">
        <div className="hud-region hud-region-top-start">
          <VitalsPanel snapshot={snapshot} />
        </div>
        <div className="hud-region hud-region-top-center">
          <FloorHud snapshot={snapshot} />
        </div>
        <div className="hud-region hud-region-top-end">
          <BehaviorControl
            snapshot={snapshot}
            keybinds={keybinds}
            onSelectProfile={onSelectBehaviorProfile}
            onSelectTargetPriority={onSelectTargetPriority}
            onToggleFreeMovement={onToggleFreeMovement}
          />
          <HudToolbar
            activeTab={inspectorTab}
            onToggleTab={(tab) =>
              onInspectorTabChange(inspectorTab === tab ? null : tab)}
            onPause={onPause}
          />
        </div>
      </div>
      <div className="hud-middle">
        {/*
          The reference panels, where there is room for them.
          
          These are the same components the inspector renders, mounted a second
          time rather than moved, so a wide screen reads its gear and stats
          without opening anything and a phone still gets one arena and a
          toolbar. The rails are `display: none` until the HUD is wide enough,
          and the stylesheet hides the inspector and its three tab buttons at
          the same width so the two copies can never both be on screen.
        */}
        <div className="hud-rail hud-rail-start">
          <LoadoutPanel snapshot={snapshot} tooltips={tooltips} />
          <CharacterStatsPanel snapshot={snapshot} tooltips={tooltips} />
        </div>
        <div className="hud-region hud-region-center">
        {snapshot.boss ? (
          <section className="boss-hud hud-panel" aria-label="Boss status">
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
            <span className="boss-hud-tactics">{snapshot.boss.tactics}</span>
            {snapshot.boss.enrage ? (
              <div className="boss-enrage" aria-label={`${snapshot.boss.name} enrage`}>
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
            className={`stairs-hud hud-panel${snapshot.stairs.isFinal ? ' stairs-final' : ''}`}
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
          <section className="floor-transition-hud hud-panel" role="status" aria-live="polite">
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
        </div>
        <div className="hud-rail hud-rail-end">
          <RunStatsPanel snapshot={snapshot} />
        </div>
        {inspectorTab === null ? null : (
          <HudInspector
            snapshot={snapshot}
            tooltips={tooltips}
            tab={inspectorTab}
            onTabChange={onInspectorTabChange}
            onClose={() => onInspectorTabChange(null)}
          />
        )}
      </div>
      <div className="hud-bar hud-bar-bottom">
        <div className="hud-region hud-region-bottom-center">
          <SkillHud
            snapshot={snapshot}
            castPulseIds={castPulseIds}
            tooltips={tooltips}
            onSetMirrorcastTarget={onSetMirrorcastTarget}
            onSetCriticalSpellstrikeTarget={onSetCriticalSpellstrikeTarget}
            onSetBloodRiteTarget={onSetBloodRiteTarget}
          />
        </div>
      </div>
    </section>
  )
}
