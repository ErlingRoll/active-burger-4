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
  type PendingChoiceFlow,
  type RunResultSnapshot,
} from '../game'
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '../content/gear/Items'
import { RARITY_VISUALS } from '../content/rarity/Rarity'
import { xpRequiredForNextLevel } from '../content/progression/XpBalance'
import type { UpgradeChoice } from '../content/upgrades/Upgrades'
import { LevelUpOverlay } from './LevelUpOverlay'
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
    ? `${Math.abs((modifier.value - 1) * 100).toFixed(0)}%`
    : Number.isInteger(modifier.value)
      ? modifier.value.toString()
      : Math.abs(modifier.value).toFixed(1)
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
      unsubscribe()
      if (gameRef.current === game) {
        gameRef.current = null
      }
      setGame(null)
      pixiGame.destroy()
    }
  }, [onRunEnd])

  const selectChoice = (choice: UpgradeChoice | GearChoice): void => {
    gameRef.current?.selectChoice(choice)
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
      {snapshot ? <GameplayHud snapshot={snapshot} /> : null}
      {import.meta.env.DEV && snapshot && game && !choiceFlow ? (
        <DevelopmentMenu game={game} snapshot={snapshot} />
      ) : null}
      {choiceFlow ? (
        <LevelUpOverlay
          flow={choiceFlow}
          equipment={snapshot?.equipment ?? {}}
          onSelect={selectChoice}
        />
      ) : null}
    </div>
  )
}

interface GameplayHudProps {
  snapshot: GameUiSnapshot
}

function GameplayHud({ snapshot }: GameplayHudProps) {
  const hp = Math.max(0, Math.min(snapshot.hp, snapshot.maxHp))
  const xpPercent = snapshot.xpProgress * 100
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null)
  const equippedItems = EQUIPMENT_SLOTS.flatMap((slot) => {
    const item = snapshot.equipment[slot]
    return item ? [{ item, slot }] : []
  })

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
            <span>{Math.ceil(hp)} / {snapshot.maxHp}</span>
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
      </dl>
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
                          : skill.estimatedSingleTargetDps.toFixed(1)}
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
      <section className="equipped-loadout" aria-labelledby="equipped-loadout-title">
        <h3 id="equipped-loadout-title">Loadout</h3>
        {equippedItems.length === 0 ? (
          <p className="loadout-empty-state">No gear equipped</p>
        ) : (
          <ul className="loadout-list">
            {equippedItems.map(({ item, slot }) => (
              <li
                className={`loadout-item rarity-${item.rarity}`}
                data-slot={slot}
                key={slot}
              >
                <span className="loadout-slot">{HUD_SLOT_LABELS[slot]}</span>
                <strong>{item.name}</strong>
                <span
                  className="loadout-rarity"
                  data-rarity={item.rarity}
                >
                  {RARITY_VISUALS[item.rarity].icon} {RARITY_VISUALS[item.rarity].label}
                </span>
              </li>
            ))}
          </ul>
        )}
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
    projectiles: game.state.projectiles.length,
    pickups: game.state.pickups.length,
    summons: game.state.summons.length,
    effects: game.state.effects.length,
  }
  const totalEntities =
    1 +
    entityCounts.enemies +
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
