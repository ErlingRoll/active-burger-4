import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  createGame,
  MAX_TIME_SCALE,
  MIN_TIME_SCALE,
  DEBUG_SPAWN_COUNTS,
  type Game,
  type DebugSpawnCount,
  type GameUiSnapshot,
  type GearChoice,
  type BehaviorProfileId,
  type PendingChoiceFlow,
  type RunResultSnapshot,
} from '../game'
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '../content/gear/Items'
import { RARITY_VISUALS } from '../content/rarity/Rarity'
import { xpRequiredForNextLevel } from '../content/progression/XpBalance'
import type { UpgradeChoice } from '../content/upgrades/Upgrades'
import { LevelUpOverlay } from './LevelUpOverlay'
import { BehaviorScreen } from './BehaviorScreen'
import { PixiGame } from './PixiGame'

interface GameCanvasProps {
  onRunEnd: (result: RunResultSnapshot) => void
}

const UI_UPDATE_INTERVAL_MS = 100

function formatElapsedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainder = totalSeconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

const HUD_STAT_LABELS = {
  maxHp: 'Max HP',
  movementSpeed: 'Movement speed',
  attackDamage: 'Attack damage',
  attackSpeed: 'Attack speed',
  attackRange: 'Attack range',
} as const

const HUD_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  helmet: 'Helmet',
  armor: 'Armor',
  boots: 'Boots',
  ring: 'Ring',
  amulet: 'Amulet',
}

function formatHudModifier(
  modifier: GameUiSnapshot['skills'][number]['gearModifiers'][number],
): string {
  const value = modifier.operation === 'multiply'
    ? `${Math.ceil(Math.abs((modifier.value - 1) * 100))}%`
    : Math.ceil(Math.abs(modifier.value)).toString()
  const isPositive = modifier.operation === 'multiply'
    ? modifier.value >= 1
    : modifier.value >= 0
  return `${isPositive ? '+' : '-'}${value} ${HUD_STAT_LABELS[modifier.stat]}`
}

export function GameCanvas({ onRunEnd }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [snapshot, setSnapshot] = useState<GameUiSnapshot | null>(null)
  const [choiceFlow, setChoiceFlow] = useState<PendingChoiceFlow | null>(null)
  const [behaviorScreenOpen, setBehaviorScreenOpen] = useState(false)
  const behaviorScreenOpenRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const game = createGame({ seed: 3 })
    const pixiGame = new PixiGame(game)
    let disposed = false
    let defeatNotified = false
    gameRef.current = game
    setGame(game)

    const publishSnapshot = (): void => {
      if (!disposed) {
        setSnapshot(game.getUiSnapshot())
      }
    }

    publishSnapshot()
    setChoiceFlow(null)

    // This deterministic setup is only for browser smoke tests and local
    // development; normal runs retain the standard combat-driven progression.
    if (
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('demo') === 'level-up'
    ) {
      game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForNextLevel(1))
    }
    if (
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('demo') === 'gear'
    ) {
      // Two pickups exercise both the empty-slot comparison and the
      // replacement/upgrade flow without changing production drop behavior.
      game.spawnGearPickup({ x: 0, y: 0 })
      game.spawnGearPickup({ x: 0, y: 0 })
    }

    const unsubscribe = game.subscribe(() => {
      if (disposed) {
        return
      }

      // Phase changes are published immediately so the level-up overlay never
      // waits for the throttled HUD interval.
      publishSnapshot()
      setChoiceFlow(game.getPendingChoiceFlow() ?? null)

      if (game.phase === 'defeat' && !defeatNotified) {
        defeatNotified = true
        onRunEnd(game.getRunResultSnapshot())
      }
    })

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return
      }

      if (behaviorScreenOpenRef.current) {
        event.preventDefault()
        behaviorScreenOpenRef.current = false
        setBehaviorScreenOpen(false)
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

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    const snapshotTimer = window.setInterval(
      publishSnapshot,
      UI_UPDATE_INTERVAL_MS,
    )

    void pixiGame.initialize(container).catch((error: unknown) => {
      if (!disposed) {
        console.error('Unable to initialize the Pixi renderer.', error)
      }
    })

    return () => {
      disposed = true
      window.clearInterval(snapshotTimer)
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      unsubscribe()
      if (gameRef.current === game) {
        gameRef.current = null
      }
      setGame(null)
      behaviorScreenOpenRef.current = false
      pixiGame.destroy()
    }
  }, [onRunEnd])

  const selectChoice = (choice: UpgradeChoice | GearChoice): void => {
    gameRef.current?.selectChoice(choice)
  }

  const selectBehaviorProfile = (profileId: BehaviorProfileId): void => {
    gameRef.current?.setBehaviorProfile(profileId)
  }

  const openBehaviorScreen = (): void => {
    behaviorScreenOpenRef.current = true
    setBehaviorScreenOpen(true)
  }

  const closeBehaviorScreen = (): void => {
    behaviorScreenOpenRef.current = false
    setBehaviorScreenOpen(false)
  }

  const phase = snapshot?.phase ?? 'loading'

  return (
    <div
      className="game-canvas"
      data-game-phase={phase}
    >
      <div
        ref={containerRef}
        className="game-renderer"
        aria-label="Active Burger 4 game arena"
        role="img"
      />
      {snapshot ? (
        <GameplayHud snapshot={snapshot} onOpenBehavior={openBehaviorScreen} />
      ) : null}
      {import.meta.env.DEV && snapshot && game ? (
        <DevelopmentMenu game={game} snapshot={snapshot} />
      ) : null}
      {phase === 'paused' ? (
        <p className="paused-indicator" role="status">
          Paused
        </p>
      ) : null}
      {choiceFlow ? (
        <LevelUpOverlay
          flow={choiceFlow}
          equipment={snapshot?.equipment ?? {}}
          onSelect={selectChoice}
        />
      ) : null}
      {behaviorScreenOpen && snapshot ? (
        <BehaviorScreen
          behavior={snapshot.behavior}
          onSelectProfile={selectBehaviorProfile}
          onClose={closeBehaviorScreen}
        />
      ) : null}
    </div>
  )
}

interface GameplayHudProps {
  snapshot: GameUiSnapshot
  onOpenBehavior: () => void
}

function GameplayHud({ snapshot, onOpenBehavior }: GameplayHudProps) {
  const hp = Math.max(0, Math.min(snapshot.hp, snapshot.maxHp))
  const xpPercent = snapshot.xpProgress * 100
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null)
  const [activeLoadoutSlot, setActiveLoadoutSlot] = useState<EquipmentSlot | null>(
    null,
  )

  return (
    <section className="gameplay-hud" aria-labelledby="run-status-title">
      <h2 id="run-status-title" className="visually-hidden">
        Run status
      </h2>
      <dl className="hud-stats">
        <div className="hud-stat hud-health">
          <dt>HP</dt>
          <dd>
            <progress value={hp} max={snapshot.maxHp} aria-label="Player health" />
            <span>{Math.ceil(hp)} / {Math.ceil(snapshot.maxHp)}</span>
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
            <span>{snapshot.xp} / {snapshot.xpRequired}</span>
          </dd>
        </div>
        <div className="hud-stat">
          <dt>Time</dt>
          <dd>{formatElapsedTime(snapshot.elapsedTime)}</dd>
        </div>
        <div className="hud-stat">
          <dt>Kills</dt>
          <dd>{snapshot.killCount}</dd>
        </div>
        <div className="hud-stat hud-dodge">
          <dt>Dodge Lv. {snapshot.dodge.level}</dt>
          <dd>
            <progress
              value={snapshot.dodge.progress * 100}
              max={100}
              aria-label="Dodge telegraph progress"
            />
            <span>
              {snapshot.dodge.active
                ? `Evading (${snapshot.dodge.activeTelegraphCount})`
                : `${snapshot.dodge.reactionTime.toFixed(2)}s reaction`}
            </span>
          </dd>
        </div>
      </dl>
      {snapshot.boss ? (
        <section className="boss-hud" aria-label="Boss status">
          <div className="boss-hud-heading">
            <strong>{snapshot.boss.name}</strong>
            <span>{snapshot.boss.status}</span>
          </div>
          <progress
            value={snapshot.boss.hpProgress * 100}
            max={100}
            aria-label={`${snapshot.boss.name} health`}
          />
          <span>
            {Math.ceil(snapshot.boss.hp)} / {Math.ceil(snapshot.boss.maxHp)} HP
          </span>
        </section>
      ) : null}
      <section className="skill-hud" aria-labelledby="acquired-skills-title">
        <h3 id="acquired-skills-title" className="visually-hidden">
          Acquired skills
        </h3>
        <ul className="skill-list">
          {snapshot.skills.map((skill) => {
            const tooltipId = `skill-tooltip-${skill.skillId}`
            const isActive = activeSkillId === skill.skillId
            return (
              <li className="skill-entry" key={skill.skillId}>
                <button
                  className="skill-card"
                  type="button"
                  aria-label={`${skill.name}, level ${skill.level}`}
                  aria-describedby={isActive ? tooltipId : undefined}
                  onFocus={() => setActiveSkillId(skill.skillId)}
                  onBlur={() => setActiveSkillId(null)}
                  onMouseEnter={() => setActiveSkillId(skill.skillId)}
                  onMouseLeave={() => setActiveSkillId(null)}
                >
                  <span className="skill-icon" aria-hidden="true">
                    {skill.icon}
                  </span>
                  <span className="skill-card-name">{skill.name}</span>
                  <span className="skill-card-level">Lv. {skill.level}</span>
                </button>
                {isActive ? (
                  <div
                    className="skill-tooltip"
                    id={tooltipId}
                    role="tooltip"
                  >
                    <strong>{skill.name}</strong>
                    <p>{skill.description}</p>
                    <p className="skill-dps">
                      <span>Estimated SINGLE-TARGET sustained DPS</span>
                      <b>
                        {skill.estimatedSingleTargetDps === null
                          ? 'N/A'
                          : Math.ceil(skill.estimatedSingleTargetDps)}
                      </b>
                    </p>
                    <p className="skill-assumption">{skill.dpsAssumption}</p>
                    {skill.gearModifiers.length > 0 ? (
                      <section className="skill-gear-modifiers" aria-label="Derived gear modifiers">
                        <p className="skill-upgrade-heading">Derived gear modifiers</p>
                        <ul className="skill-upgrade-list">
                          {skill.gearModifiers.map((modifier, index) => (
                            <li key={`${modifier.sourceId}-${modifier.stat}-${index}`}>
                              {formatHudModifier(modifier)}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                    <p className="skill-upgrade-heading">
                      Relevant upgrades
                    </p>
                    <ul className="skill-upgrade-list">
                      {skill.upgrades.map((upgrade) => (
                        <li key={upgrade.upgradeId}>
                          <span>
                            {upgrade.name} ({upgrade.valueLabel})
                          </span>
                          <span className={`upgrade-status ${upgrade.status}`}>
                            {upgrade.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>
      <section className="behavior-hud" aria-labelledby="behavior-hud-title">
        <h3 id="behavior-hud-title" className="visually-hidden">
          Behavior
        </h3>
        <button
          className="behavior-summary"
          type="button"
          aria-label={`Behavior: ${snapshot.behavior.profileName}. Intent: ${
            snapshot.behavior.activeIntent?.label ?? 'No active intent'
          }`}
          onClick={onOpenBehavior}
        >
          <span className="behavior-summary-label">Behavior</span>
          <strong>{snapshot.behavior.profileName}</strong>
          <span>
            Intent: {snapshot.behavior.activeIntent?.label ?? 'No active intent'}
          </span>
        </button>
      </section>
      <section className="equipped-loadout" aria-labelledby="equipped-loadout-title">
        <h3 id="equipped-loadout-title">Loadout</h3>
        <ul className="loadout-list">
          {EQUIPMENT_SLOTS.map((slot) => {
            const item = snapshot.equipment[slot]
            const tooltipId = `loadout-tooltip-${slot}`
            const isActive = activeLoadoutSlot === slot
            return (
              <li className="loadout-entry" key={slot}>
                <button
                  className={`loadout-item${item ? ` rarity-${item.rarity}` : ''}`}
                  data-slot={slot}
                  type="button"
                  aria-label={
                    item
                      ? `${HUD_SLOT_LABELS[slot]}: ${item.name}`
                      : `${HUD_SLOT_LABELS[slot]} slot empty`
                  }
                  aria-describedby={isActive ? tooltipId : undefined}
                  onFocus={() => setActiveLoadoutSlot(slot)}
                  onBlur={() => setActiveLoadoutSlot(null)}
                  onMouseEnter={() => setActiveLoadoutSlot(slot)}
                  onMouseLeave={() => setActiveLoadoutSlot(null)}
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
                  <div className="loadout-tooltip" id={tooltipId} role="tooltip">
                    <strong>{HUD_SLOT_LABELS[slot]}</strong>
                    {item ? (
                      <>
                        <p>
                          {RARITY_VISUALS[item.rarity].label} {item.name}
                        </p>
                        <ul>
                          {item.modifiers.map((modifier, index) => (
                            <li key={`${modifier.sourceId}-${modifier.stat}-${index}`}>
                              {formatHudModifier(modifier)}
                            </li>
                          ))}
                        </ul>
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
      </section>
    </section>
  )
}

interface DevelopmentMenuProps {
  game: Game
  snapshot: GameUiSnapshot
}

function DevelopmentMenu({ game, snapshot }: DevelopmentMenuProps) {
  const [open, setOpen] = useState(false)
  const [timeScaleInput, setTimeScaleInput] = useState(() =>
    game.timeScale.toString(),
  )
  const [timeScaleError, setTimeScaleError] = useState<string | null>(null)
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

  return (
    <div className="development-controls">
      <button
        className="development-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="development-menu"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        Development Menu
      </button>
      {open ? (
        <section
          className="development-menu"
          id="development-menu"
          aria-labelledby="development-menu-title"
        >
          <p className="development-kicker">Development-only controls</p>
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
              Development-only stress spawns intentionally bypass the normal
              active-enemy cap.
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
