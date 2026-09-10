import { useState } from 'react'
import {
  BOSS_DEFINITION_IDS,
  getBossDefinition,
  isBossDefinitionId,
  type BossDefinitionId,
} from '../content/bosses/Bosses'
import type { ChangeEvent } from 'react'
import {
  MAX_TIME_SCALE,
  MIN_TIME_SCALE,
  DEBUG_SPAWN_COUNTS,
  type Game,
  type DebugSpawnCount,
  type DevelopmentGrantResult,
  type GameUiSnapshot,
  getEligibleSynergyDefinitions,
} from '../game'
import {
  ALL_ITEM_DEFINITIONS,
  getItemDisplayName,
  isItemId,
  type ItemId,
} from '../content/gear/Items'
import {
  isSkillId,
  SKILL_DEFINITIONS,
} from '../content/skills/Skills'
import {
  ALL_GEAR_SET_DEFINITIONS,
  isGearSetId,
  type GearSetId,
} from '../game-config/gear-sets'
import {
  INITIAL_UPGRADES,
} from '../content/upgrades/Upgrades'
import {
  storeDevelopmentTimeScale,
} from './developmentTimeScale'

const GRANTABLE_GEAR_DEFINITIONS = ALL_ITEM_DEFINITIONS.filter(
  (item) => !item.starterOnly,
)
const GRANTABLE_UPGRADE_DEFINITIONS = INITIAL_UPGRADES.filter(
  (upgrade) => upgrade.synergySkillIds === undefined,
)


/**
 * The in-run development menu.
 *
 * Only mounted when `import.meta.env.DEV` is set or `?devmenu=open` is present,
 * so it never reaches players. It lives apart from GameCanvas because it is the
 * single largest component in the renderer and shares nothing with the HUD but
 * the game instance.
 */

export interface DevelopmentMenuProps {
  game: Game
  snapshot: GameUiSnapshot
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DevelopmentMenu({
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
  const [selectedBossId, setSelectedBossId] = useState<BossDefinitionId>(
    BOSS_DEFINITION_IDS[0] ?? 'stone-golem',
  )
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

  /*
   * Summons any boss in the roster.
   *
   * This used to be one button for the Inferno Warden, which was reasonable
   * while there were two bosses. A floor now draws from the whole roster, so
   * the only way to look at a given boss is to ask for it by name.
   */
  const summonBoss = (): void => {
    if (
      snapshot.phase !== 'playing' ||
      (game.state.bosses?.length ?? 0) > 0 ||
      game.state.stairs !== undefined
    ) {
      return
    }
    if (!game.startEncounter(selectedBossId)) {
      game.spawnBoss(selectedBossId)
    }
  }

  const jumpToFinalFloor = (): void => {
    if (
      snapshot.phase !== 'playing' ||
      (game.state.bosses?.length ?? 0) > 0 ||
      game.state.stairs !== undefined
    ) {
      return
    }
    game.jumpToFinalFloor()
  }

  const toggleGodMode = (): void => {
    game.toggleGodMode()
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
          <div className="debug-grant-row">
            <label className="visually-hidden" htmlFor="debug-boss-select">
              Boss
            </label>
            <select
              id="debug-boss-select"
              value={selectedBossId}
              onChange={(event) => {
                const value = event.target.value
                if (isBossDefinitionId(value)) {
                  setSelectedBossId(value)
                }
              }}
            >
              {BOSS_DEFINITION_IDS.map((id) => {
                const boss = getBossDefinition(id)
                return (
                  <option value={id} key={id}>
                    {boss.name}
                    {boss.role === 'final' ? ' (final)' : ` (floor ${boss.minFloor}+)`}
                  </option>
                )
              })}
            </select>
            <button
              className="debug-spawn-button debug-spawn-final-button"
              type="button"
              onClick={summonBoss}
              disabled={
                snapshot.phase !== 'playing' ||
                (game.state.bosses?.length ?? 0) > 0
              }
            >
              Summon boss
            </button>
          </div>
          <button
            className="debug-spawn-button debug-spawn-final-button"
            type="button"
            onClick={jumpToFinalFloor}
            disabled={
              snapshot.phase !== 'playing' ||
              (game.state.bosses?.length ?? 0) > 0 ||
              game.state.stairs !== undefined
            }
          >
            Jump to final floor
          </button>
          <button
            className="debug-spawn-button debug-spawn-final-button"
            type="button"
            aria-pressed={game.godModeEnabled}
            onClick={toggleGodMode}
            disabled={
              snapshot.phase !== 'playing' &&
              snapshot.phase !== 'paused' &&
              snapshot.phase !== 'level-up'
            }
          >
            Godmode: {game.godModeEnabled ? 'ON' : 'OFF'}
          </button>
          <p className="input-help">
            Invulnerable; aura deals 10,000 physical damage per second within 144 units.
          </p>
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
