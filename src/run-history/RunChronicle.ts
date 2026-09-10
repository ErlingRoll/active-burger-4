import { isValidCheckpoint } from '../game/checkpoint/GameCheckpoint'
import { createRunResultSnapshot, type RunResultSnapshot } from '../game/ui/Snapshots'
import {
  getWorldModifierDefinitions,
  normalizeWorldModifierIds,
} from '../content/modifiers/WorldModifiers'
import {
  CHARACTER_CLASS_DEFINITIONS,
  isCharacterClassId,
} from '../content/classes/CharacterClasses'
import type { DungeonRunOutcome, FinishedDungeonRun } from '../persistence'

/**
 * Reading a finished run's report back out of what the run stored.
 *
 * Nothing new is written for the chronicle. Every run that ended already saved
 * its final checkpoint, and the end-of-run report is a pure function of the
 * game state inside it, so the report a player saw when the run ended can be
 * rebuilt from that snapshot on demand.
 *
 * The checkpoint envelope is version-checked rather than trusted. A run saved
 * by an older schema is a run whose detail cannot be shown, which the screen
 * says plainly instead of guessing at the numbers.
 */

export function parseRunReport(
  payload: unknown,
  outcome: DungeonRunOutcome,
): RunResultSnapshot | null {
  if (!isValidCheckpoint(payload)) {
    return null
  }
  try {
    return reconcileOutcome(createRunResultSnapshot(payload.gameState), outcome)
  } catch {
    /*
     * The guard validates the envelope, not every field the report reads. A
     * state it cannot read is a missing report, not a broken screen.
     */
    return null
  }
}

/**
 * Makes the rebuilt report agree with how the run is recorded as having ended.
 *
 * An abandoned run keeps the last floor checkpoint it saved, which was written
 * while the run was still alive and so knows nothing about being abandoned.
 * The recorded status is the authority on that, and it decides whether the
 * report shows a death log or none.
 */
function reconcileOutcome(
  report: RunResultSnapshot,
  outcome: DungeonRunOutcome,
): RunResultSnapshot {
  const base = {
    phase: report.phase,
    modeId: report.modeId,
    floor: report.floor,
    abyssScore: report.abyssScore,
    abyssDangerScore: report.abyssDangerScore,
    elapsedTime: report.elapsedTime,
    level: report.level,
    xp: report.xp,
    killCount: report.killCount,
    worldModifierIds: report.worldModifierIds,
    playerCombatLog: report.playerCombatLog,
    skillDamage: report.skillDamage,
    skillHealing: report.skillHealing,
  }
  if (outcome === 'victory') {
    return { ...base, outcome: 'victory' }
  }
  if (outcome === 'forfeited') {
    return { ...base, forfeited: true }
  }
  return base
}

export function formatRunOutcome(outcome: DungeonRunOutcome): string {
  if (outcome === 'victory') {
    return 'Victory'
  }
  return outcome === 'forfeited' ? 'Abandoned' : 'Defeat'
}

export function formatCharacterClassName(classId: string): string {
  return isCharacterClassId(classId)
    ? CHARACTER_CLASS_DEFINITIONS[classId].name
    : classId
}

export function formatWorldModifierNames(
  ids: readonly string[],
): readonly string[] {
  return getWorldModifierDefinitions(normalizeWorldModifierIds(ids))
    .map((modifier) => modifier.name)
}

/**
 * When a run ended, in the reader's own time zone.
 *
 * A chronicle of one player's runs is read as "the one I did on Tuesday", so
 * the day comes first and the clock second, and both are local.
 */
export function formatRunCompletion(completedAt: string): string {
  const completed = Date.parse(completedAt)
  if (Number.isNaN(completed)) {
    return 'Unknown date'
  }
  return new Date(completed).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** How deep a run got, against the depth it set out for. */
export function formatRunDepth(run: FinishedDungeonRun): string {
  return run.modeId === 'infinite-abyss'
    ? `Floor ${run.reachedFloor}`
    : `Floor ${run.reachedFloor} / ${run.maxFloor}`
}
