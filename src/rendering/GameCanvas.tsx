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
  type RunConfig,
  type PendingChoiceFlow,
  type RunResultSnapshot,
} from '../game'
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '../content/gear/Items'
import {
  formatGearModifier,
  serializeGearModifiers,
} from '../content/gear/ModifierPools'
import { RARITY_VISUALS } from '../content/rarity/Rarity'
import { xpRequiredForNextLevel } from '../content/progression/XpBalance'
import type { UpgradeChoice } from '../content/upgrades/Upgrades'
import { LevelUpOverlay } from './LevelUpOverlay'
import { BehaviorScreen } from './BehaviorScreen'
import { PixiGame } from './PixiGame'
import {
  DEFAULT_PLAYSTYLE_ID,
  getPlaystyleDefinition,
} from '../content/playstyles/Playstyles'

interface GameCanvasProps {
  onRunEnd: (result: RunResultSnapshot) => void
  runConfig?: RunConfig
  onBehaviorProfileChange?: (profileId: BehaviorProfileId) => void
}

const UI_UPDATE_INTERVAL_MS = 100
const DEVELOPMENT_TIME_SCALE_STORAGE_KEY = 'active-burger:development-time-scale'

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
  return formatGearModifier(modifier)
}

function formatCadence(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

function formatEstimatedDps(value: number | null): string {
  return value === null ? 'N/A' : Math.ceil(value).toString()
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
        ? `${choice.type}:${choice.itemId}:${choice.slot}:${choice.rarity}:${serializeGearModifiers(choice.modifiers)}`
        : `${choice.type}:${choice.itemId}:${choice.slot}:${choice.rarity}:${choice.upgradedModifierId}:${choice.fromTier}:${choice.toTier}:${serializeGearModifiers(choice.upgradedModifiers)}`,
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

export function GameCanvas({
  onRunEnd,
  runConfig,
  onBehaviorProfileChange,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const initialRunConfigRef = useRef<RunConfig>(runConfig ?? { seed: 3 })
  const [game, setGame] = useState<Game | null>(null)
  const [snapshot, setSnapshot] = useState<GameUiSnapshot | null>(null)
  const [choiceFlow, setChoiceFlow] = useState<Readonly<PendingChoiceFlow> | null>(null)
  const choiceFlowKeyRef = useRef<string | null>(null)
  const [behaviorScreenOpen, setBehaviorScreenOpen] = useState(false)
  const behaviorScreenOpenRef = useRef(false)
  const [developmentMenuOpen, setDevelopmentMenuOpen] = useState(
    () => import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('devmenu') === 'open',
  )
  const [guideDismissed, setGuideDismissed] = useState(false)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const game = createGame(initialRunConfigRef.current)
    const storedTimeScale = getStoredDevelopmentTimeScale()
    if (storedTimeScale !== null) {
      game.setTimeScale(storedTimeScale)
    }
    const pixiGame = new PixiGame(game)
    let disposed = false
    let runEndNotified = false
    gameRef.current = game
    setGame(game)

    const publishSnapshot = (): void => {
      if (!disposed) {
        const nextSnapshot = game.getUiSnapshot()
        setSnapshot(nextSnapshot)
        const nextChoiceFlowKey = getChoiceFlowKey(nextSnapshot.pendingChoiceFlow)
        if (choiceFlowKeyRef.current !== nextChoiceFlowKey) {
          choiceFlowKeyRef.current = nextChoiceFlowKey
          setChoiceFlow(nextSnapshot.pendingChoiceFlow)
        }
      }
    }

    publishSnapshot()
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

    const unsubscribe = game.subscribe(() => {
      if (disposed) {
        return
      }

      // Phase changes are published immediately so the level-up overlay never
      // waits for the throttled HUD interval.
      publishSnapshot()

      if (
        (game.phase === 'defeat' || game.phase === 'results') &&
        !runEndNotified
      ) {
        runEndNotified = true
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
      choiceFlowKeyRef.current = null
      pixiGame.destroy()
    }
  }, [onRunEnd])

  const selectChoice = (choice: UpgradeChoice | GearChoice): void => {
    gameRef.current?.selectChoice(choice)
  }

  const skipChoice = (): void => {
    gameRef.current?.skipChoice()
  }

  const selectBehaviorProfile = (profileId: BehaviorProfileId): void => {
    if (gameRef.current?.setBehaviorProfile(profileId)) {
      onBehaviorProfileChange?.(profileId)
    }
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
      data-world-modifiers={(runConfig?.worldModifierIds ?? []).join(',')}
      data-playstyle={runConfig?.playstyleId ?? 'knight'}
    >
      <div
        ref={containerRef}
        className="game-renderer"
        aria-label="Active Burger 4 game arena"
        role="img"
      />
      {snapshot ? (
        <GameplayHud snapshot={snapshot} />
      ) : null}
      {snapshot ? <FloorHud snapshot={snapshot} /> : null}
      {snapshot ? (
        <BehaviorHud snapshot={snapshot} onOpenBehavior={openBehaviorScreen} />
      ) : null}
      {snapshot && !guideDismissed ? (
        <RunGuide
          playstyleId={runConfig?.playstyleId ?? DEFAULT_PLAYSTYLE_ID}
          onDismiss={() => setGuideDismissed(true)}
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
        <p className="paused-indicator" role="status">
          Paused
        </p>
      ) : null}
      {choiceFlow ? (
        <LevelUpOverlay
          flow={choiceFlow}
          equipment={snapshot?.equipment ?? {}}
          onSelect={selectChoice}
          onSkip={skipChoice}
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

function RunGuide({
  playstyleId,
  onDismiss,
}: {
  playstyleId: Parameters<typeof getPlaystyleDefinition>[0]
  onDismiss: () => void
}) {
  const playstyle = getPlaystyleDefinition(playstyleId)
  const special =
    playstyleId === 'necromancer'
      ? 'Your skeleton follows you and attacks nearby enemies.'
      : 'Your skills fire automatically when enemies are in range.'
  return (
    <aside className="run-guide" aria-label="Run guide">
      <div>
        <strong>{playstyle.name}</strong>
        <span>{special} Behavior controls movement; choose upgrades when the run pauses.</span>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss run guide">
        Got it
      </button>
    </aside>
  )
}

interface GameplayHudProps {
  snapshot: GameUiSnapshot
}

function GameplayHud({ snapshot }: GameplayHudProps) {
  const hp = Math.max(0, Math.min(snapshot.hp, snapshot.maxHp))
  const xpPercent = snapshot.xpProgress * 100
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null)
  const [activeLoadoutSlot, setActiveLoadoutSlot] = useState<EquipmentSlot | null>(
    null,
  )
  const [activeCharacterStatId, setActiveCharacterStatId] = useState<string | null>(
    null,
  )

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
              : `Entering Floor ${snapshot.floorTransition.toFloor}`}
          </strong>
          <progress
            value={snapshot.floorTransition.progress * 100}
            max={100}
            aria-label="Floor transition progress"
          />
          <span>
            {snapshot.floorTransition.remainingSeconds.toFixed(1)}s remaining
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
                  aria-label={`${skill.name}, level ${skill.level}, single-target DPS ${formatEstimatedDps(skill.estimatedSingleTargetDps)}`}
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
                  <span className="skill-card-dps">
                    <span>DPS</span>
                    <b>{formatEstimatedDps(skill.estimatedSingleTargetDps)}</b>
                  </span>
                </button>
                {isActive ? (
                  <div
                    className="skill-tooltip"
                    id={tooltipId}
                    role="tooltip"
                  >
                    <strong>{skill.name}</strong>
                    <p>{skill.description}</p>
                    <section className="skill-tags-section" aria-label="Skill tags">
                      <p className="skill-upgrade-heading">Skill tags</p>
                      <ul className="skill-tag-list">
                        {skill.tags.map((tag) => (
                          <li className="skill-tag" key={tag}>
                            {tag}
                          </li>
                        ))}
                      </ul>
                    </section>
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
                    {skill.gearModifiers.length > 0 ? (
                      <section className="skill-gear-modifiers" aria-label="Derived gear modifiers">
                        <p className="skill-upgrade-heading">Derived gear modifiers</p>
                        <ul className="skill-upgrade-list">
                          {skill.gearModifiers.map((modifier, index) => (
                            <li key={`${modifier.sourceId}-${modifier.id}-${index}`}>
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
                            <li key={`${modifier.sourceId}-${modifier.id}-${index}`}>
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
                          aria-label={`${stat.label}: ${stat.value}`}
                          aria-describedby={isActive ? tooltipId : undefined}
                          onFocus={() => setActiveCharacterStatId(stat.id)}
                          onBlur={() => setActiveCharacterStatId(null)}
                          onMouseEnter={() => setActiveCharacterStatId(stat.id)}
                          onMouseLeave={() => setActiveCharacterStatId(null)}
                        >
                          <span>{stat.label}</span>
                          <strong>{stat.value}</strong>
                        </button>
                        {isActive ? (
                          <div
                            className="character-stat-tooltip"
                            id={tooltipId}
                            role="tooltip"
                          >
                            <strong>{stat.label}</strong>
                            <p className="character-stat-tooltip-value">
                              Current value: {stat.value}
                            </p>
                            <p>{stat.description}</p>
                            <p className="character-stat-tooltip-applies">
                              <span>Applies to:</span> {stat.appliesTo}
                            </p>
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
  onOpenBehavior,
}: {
  snapshot: GameUiSnapshot
  onOpenBehavior: () => void
}) {
  return (
    <section className="behavior-hud behavior-hud-bottom" aria-labelledby="behavior-hud-title">
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
        <span>Intent: {snapshot.behavior.activeIntent?.label ?? 'No active intent'}</span>
      </button>
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
