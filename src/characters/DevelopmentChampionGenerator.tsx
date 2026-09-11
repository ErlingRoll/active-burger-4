import { useState } from 'react'
import {
  CHARACTER_CLASS_DEFINITIONS,
  CHARACTER_CLASS_IDS,
  isCharacterClassId,
} from '../content/classes/CharacterClasses'
import { RARITIES, type Rarity } from '../content/rarity/Rarity'
import {
  BEHAVIOR_PROFILE_ORDER,
  isBehaviorProfileId,
} from '../content/behaviors/BehaviorProfiles'
import { ALL_GEAR_SET_DEFINITIONS, isGearSetId } from '../game-config/gear-sets'
import { Random } from '../game/random/Random'
import { useToaster } from '../ui/ToasterContext'
import { isChampionRosterFullError } from './CharacterService'
import type { CharacterService } from './CharacterTypes'
import {
  DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS,
  DEVELOPMENT_CHAMPION_EXTRA_SKILL_RANGE,
  DEVELOPMENT_CHAMPION_LEVEL_RANGE,
  generateDevelopmentChampionBuild,
  generateDevelopmentChampionName,
  type DevelopmentChampionOptions,
} from './DevelopmentChampion'

interface DevelopmentChampionGeneratorProps {
  characterService: CharacterService | null
  /** Stamped on the Champion as the content it was built against. */
  contentVersion: string
}

const DEFAULT_EXHAUSTION_HOURS = 24

/**
 * The header's "Random Champion" tool.
 *
 * Every control defaults to something a tester would pick anyway, so one
 * click gives a level 20 Champion of a random class in rare-or-better gear
 * with a scattering of sets. The controls exist for the cases that need a
 * particular shape: a Knight in Giant's gear for the quarry, a legendary
 * roster for the Abyss picker, an exhausted Champion for revival.
 */
export function DevelopmentChampionGenerator({
  characterService,
  contentVersion,
}: DevelopmentChampionGeneratorProps) {
  const { showToast } = useToaster()
  const [options, setOptions] = useState<DevelopmentChampionOptions>(
    DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS,
  )
  const [levelInput, setLevelInput] = useState(String(DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS.level))
  const [extraSkillsInput, setExtraSkillsInput] = useState(
    String(DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS.extraSkillCount),
  )
  const [name, setName] = useState('')
  const [exhausted, setExhausted] = useState(false)
  const [exhaustionHoursInput, setExhaustionHoursInput] = useState(String(DEFAULT_EXHAUSTION_HOURS))
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseWholeNumber = (value: string, min: number, max: number): number | null => {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null
  }

  const createChampion = async (): Promise<void> => {
    if (!characterService || creating) {
      return
    }
    const level = parseWholeNumber(
      levelInput,
      DEVELOPMENT_CHAMPION_LEVEL_RANGE.min,
      DEVELOPMENT_CHAMPION_LEVEL_RANGE.max,
    )
    const extraSkillCount = parseWholeNumber(
      extraSkillsInput,
      DEVELOPMENT_CHAMPION_EXTRA_SKILL_RANGE.min,
      DEVELOPMENT_CHAMPION_EXTRA_SKILL_RANGE.max,
    )
    const exhaustionHours = exhausted ? parseWholeNumber(exhaustionHoursInput, 1, 168) : 0
    if (level === null) {
      setError(`Level must be a whole number from ${DEVELOPMENT_CHAMPION_LEVEL_RANGE.min} to ${DEVELOPMENT_CHAMPION_LEVEL_RANGE.max}.`)
      return
    }
    if (extraSkillCount === null) {
      setError(`Extra skills must be a whole number from ${DEVELOPMENT_CHAMPION_EXTRA_SKILL_RANGE.min} to ${DEVELOPMENT_CHAMPION_EXTRA_SKILL_RANGE.max}.`)
      return
    }
    if (exhaustionHours === null) {
      setError('Exhaustion must be a whole number of hours from 1 to 168.')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const rng = new Random(Math.floor(Math.random() * 0x7fffffff))
      const build = generateDevelopmentChampionBuild({ ...options, level, extraSkillCount }, rng)
      const championName = name.trim() || generateDevelopmentChampionName(build.classId, rng)
      const champion = await characterService.createDevelopmentChampion({
        championId: crypto.randomUUID(),
        name: championName,
        contentVersion,
        build,
        exhaustionHours,
      })
      showToast(
        `${champion.name} joined the roster: level ${build.level} ${CHARACTER_CLASS_DEFINITIONS[build.classId].name}` +
          (exhaustionHours > 0 ? `, exhausted for ${exhaustionHours}h` : '') +
          '. Open Champions to see it.',
        'info',
      )
      setName('')
    } catch (createError: unknown) {
      const message = isChampionRosterFullError(createError)
        ? 'The roster is full at ten. Delete a Champion on the Champions page first.'
        : createError instanceof Error ? createError.message : 'Unable to create the Champion.'
      setError(message)
      showToast(message, 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="development-champion-generator">
      <div className="development-champion-row">
        <label>
          Class
          <select
            value={options.classId}
            onChange={(event) => {
              const value = event.target.value
              setOptions((current) => ({
                ...current,
                classId: isCharacterClassId(value) ? value : 'random',
              }))
            }}
            disabled={creating}
          >
            <option value="random">Random class</option>
            {CHARACTER_CLASS_IDS.map((classId) => (
              <option key={classId} value={classId}>{CHARACTER_CLASS_DEFINITIONS[classId].name}</option>
            ))}
          </select>
        </label>
        <label>
          Level
          <input
            type="number"
            min={DEVELOPMENT_CHAMPION_LEVEL_RANGE.min}
            max={DEVELOPMENT_CHAMPION_LEVEL_RANGE.max}
            step="1"
            value={levelInput}
            onChange={(event) => { setLevelInput(event.target.value) }}
            disabled={creating}
          />
        </label>
      </div>
      <div className="development-champion-row">
        <label>
          Gear at least
          <select
            value={options.minimumGearRarity}
            onChange={(event) => {
              setOptions((current) => ({ ...current, minimumGearRarity: event.target.value as Rarity }))
            }}
            disabled={creating}
          >
            {RARITIES.map((rarity) => (
              <option key={rarity} value={rarity}>{rarity.charAt(0).toUpperCase() + rarity.slice(1)}</option>
            ))}
          </select>
        </label>
        <label>
          Gear set
          <select
            value={options.gearSetId}
            onChange={(event) => {
              const value = event.target.value
              setOptions((current) => ({
                ...current,
                gearSetId: value === 'none' ? 'none' : isGearSetId(value) ? value : 'random',
              }))
            }}
            disabled={creating}
          >
            <option value="random">Some pieces, random sets</option>
            <option value="none">No sets</option>
            {ALL_GEAR_SET_DEFINITIONS.map((set) => (
              <option key={set.id} value={set.id}>{set.name} set</option>
            ))}
          </select>
        </label>
      </div>
      <div className="development-champion-row">
        <label>
          Behaviour
          <select
            value={options.behaviorProfileId}
            onChange={(event) => {
              const value = event.target.value
              setOptions((current) => ({
                ...current,
                behaviorProfileId: isBehaviorProfileId(value) ? value : 'random',
              }))
            }}
            disabled={creating}
          >
            <option value="random">Random behaviour</option>
            {BEHAVIOR_PROFILE_ORDER.map((profileId) => (
              <option key={profileId} value={profileId}>
                {profileId.charAt(0).toUpperCase() + profileId.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Extra skills
          <input
            type="number"
            min={DEVELOPMENT_CHAMPION_EXTRA_SKILL_RANGE.min}
            max={DEVELOPMENT_CHAMPION_EXTRA_SKILL_RANGE.max}
            step="1"
            value={extraSkillsInput}
            onChange={(event) => { setExtraSkillsInput(event.target.value) }}
            disabled={creating}
          />
        </label>
      </div>
      <label>
        Name
        <input
          type="text"
          maxLength={32}
          placeholder="Named after its class if left blank"
          value={name}
          onChange={(event) => { setName(event.target.value) }}
          disabled={creating}
        />
      </label>
      <div className="development-champion-row development-champion-exhaustion">
        <label className="development-champion-checkbox">
          <input
            type="checkbox"
            checked={exhausted}
            onChange={(event) => { setExhausted(event.target.checked) }}
            disabled={creating}
          />
          Exhausted
        </label>
        {exhausted ? (
          <label>
            Hours left
            <input
              type="number"
              min="1"
              max="168"
              step="1"
              value={exhaustionHoursInput}
              onChange={(event) => { setExhaustionHoursInput(event.target.value) }}
              disabled={creating}
            />
          </label>
        ) : null}
      </div>
      <button
        className="development-inventory-grant"
        type="button"
        onClick={() => { void createChampion() }}
        disabled={creating || characterService === null}
      >
        {creating ? 'Creating…' : 'Create random Champion'}
      </button>
      {error ? <p className="development-inventory-error" role="alert">{error}</p> : null}
    </div>
  )
}
