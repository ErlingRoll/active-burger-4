import { describe, expect, it } from 'vitest'
import { createGame } from '../game/Game'
import {
  formatCharacterClassName,
  formatRunCompletion,
  formatRunDepth,
  formatRunOutcome,
  formatWorldModifierNames,
  parseRunReport,
} from './RunChronicle'
import type { FinishedDungeonRun } from '../persistence'

/**
 * A stored payload, the way the database holds one.
 *
 * The run went through JSON on its way to the server and comes back the same
 * way, so the test reads a parsed payload rather than a live checkpoint object:
 * a report that only works on the object the simulation happened to produce is
 * not a report the chronicle can show.
 */
function storedCheckpoint(seed = 21): unknown {
  const game = createGame({ seed, worldModifierIds: ['swarming'] })
  return JSON.parse(JSON.stringify(game.createCheckpoint()))
}

function finishedRun(overrides: Partial<FinishedDungeonRun> = {}): FinishedDungeonRun {
  return {
    runId: 'run-1',
    outcome: 'defeat',
    modeId: 'dungeon',
    dungeonId: 'default-dungeon',
    characterClassId: 'ranger',
    worldModifierIds: ['swarming'],
    reachedFloor: 4,
    maxFloor: 10,
    level: 7,
    killCount: 120,
    essenceEarned: 19,
    gameVersion: 'test',
    startedAt: '2026-09-09T10:00:00.000Z',
    completedAt: '2026-09-09T10:24:00.000Z',
    ...overrides,
  }
}

describe('parseRunReport', () => {
  it('rebuilds a run report from the snapshot the run ended on', () => {
    const report = parseRunReport(storedCheckpoint(), 'defeat')

    expect(report).not.toBeNull()
    expect(report?.modeId).toBe('dungeon')
    expect(report?.floor).toBe(1)
    expect(report?.level).toBe(1)
    expect(report?.worldModifierIds).toEqual(['swarming'])
    expect(report?.outcome).toBeUndefined()
    expect(report?.forfeited).toBeUndefined()
  })

  it('marks a run the database recorded as a victory', () => {
    expect(parseRunReport(storedCheckpoint(), 'victory')?.outcome).toBe('victory')
  })

  it('marks an abandoned run as forfeited, which its checkpoint does not know', () => {
    /*
     * A forfeit keeps the last floor checkpoint, saved while the run was still
     * alive. Without the recorded status the report would show the death log
     * of a run that was never killed.
     */
    const report = parseRunReport(storedCheckpoint(), 'forfeited')

    expect(report?.forfeited).toBe(true)
    expect(report?.outcome).toBeUndefined()
  })

  it('reports no record rather than guessing when the payload is not a checkpoint', () => {
    expect(parseRunReport(null, 'defeat')).toBeNull()
    expect(parseRunReport({}, 'defeat')).toBeNull()
    expect(parseRunReport({ version: 1 }, 'defeat')).toBeNull()
  })

  it('refuses a checkpoint from another schema version', () => {
    const payload = storedCheckpoint() as Record<string, unknown>

    expect(parseRunReport({ ...payload, version: 999 }, 'defeat')).toBeNull()
  })

  it('refuses a checkpoint whose state the report cannot read', () => {
    const payload = storedCheckpoint() as { gameState: Record<string, unknown> }
    const withoutSkills = {
      ...payload,
      gameState: { ...payload.gameState, player: {} },
    }

    expect(parseRunReport(withoutSkills, 'defeat')).toBeNull()
  })
})

describe('chronicle row formatting', () => {
  it('names the outcome the way the player experienced it', () => {
    expect(formatRunOutcome('victory')).toBe('Victory')
    expect(formatRunOutcome('defeat')).toBe('Defeat')
    expect(formatRunOutcome('forfeited')).toBe('Abandoned')
  })

  it('names a class, and falls back to the stored id for one that is gone', () => {
    expect(formatCharacterClassName('ranger')).toBe('Ranger')
    expect(formatCharacterClassName('alchemist')).toBe('alchemist')
  })

  it('names the world modifiers a run accepted and drops any that are gone', () => {
    expect(formatWorldModifierNames(['swarming', 'not-a-modifier'])).toEqual(['Swarming'])
    expect(formatWorldModifierNames([])).toEqual([])
  })

  it('measures a dungeon against its contract and the Abyss against nothing', () => {
    expect(formatRunDepth(finishedRun())).toBe('Floor 4 / 10')
    expect(formatRunDepth(finishedRun({ modeId: 'infinite-abyss', reachedFloor: 63 })))
      .toBe('Floor 63')
  })

  it('says so rather than showing an invalid date', () => {
    expect(formatRunCompletion('not a date')).toBe('Unknown date')
    expect(formatRunCompletion('2026-09-09T10:24:00.000Z')).not.toBe('Unknown date')
  })
})
