import type {
  BehaviorControllerState,
  GameState,
  PlayerMovementCandidate,
} from '../../state/GameState'
import { SpatialHash } from '../../spatial/SpatialHash'
import {
  DEFAULT_BEHAVIOR_PROFILE_ID,
  getBehaviorProfilePolicy,
} from '../../../content/behaviors/BehaviorProfiles'
import {
  getPlayerBehaviorCandidates,
} from './BehaviorIntents'
import { applyMovementCandidate } from './MovementCandidate'

export { applyMovementCandidate } from './MovementCandidate'
export {
  BEHAVIOR_INTENT_BALANCE,
  BEHAVIOR_INTENT_PRIORITIES,
  createBehaviorCandidates,
  evaluateBehaviorIntents,
  getPackThreatScore,
  getPlayerBehaviorCandidates,
  getThreatScore,
} from './BehaviorIntents'
export {
  BOSS_THREAT_SCORE,
  DEFAULT_THREAT_SCORE_DEFINITION,
  THREAT_SCORE_DEFINITIONS,
  getEntityPackThreatScore,
  getEntityThreatScore,
  getThreatScoreDefinition,
} from '../../../content/behaviors/ThreatScoring'
export type { ThreatScoreDefinition } from '../../../content/behaviors/ThreatScoring'

function getControllerState(state: GameState): BehaviorControllerState {
  return state.player.behaviorController ??= {
    profileId: DEFAULT_BEHAVIOR_PROFILE_ID,
  }
}

/**
 * Selects one candidate deterministically. Future behaviors can add candidates
 * without changing the tie-break rule or consuming random state.
 */
export function selectMovementCandidate(
  candidates: readonly PlayerMovementCandidate[],
): PlayerMovementCandidate | undefined {
  const sourceOrder: Record<PlayerMovementCandidate['source'], number> = {
    stairs: 0,
    free: 1,
    dodge: 2,
    gear: 3,
    xp: 4,
    kite: 5,
    'combat-range': 6,
    hold: 7,
  }
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) =>
      Number.isFinite(candidate.priority) &&
      Number.isFinite(candidate.directionX) &&
      Number.isFinite(candidate.directionY) &&
      Number.isFinite(candidate.speed) &&
      candidate.speed >= 0,
    )
    .sort(({ candidate: left, index: leftIndex }, { candidate: right, index: rightIndex }) =>
      right.priority - left.priority ||
      sourceOrder[left.source] - sourceOrder[right.source] ||
      leftIndex - rightIndex,
    )[0]?.candidate
}

function committedCandidate(
  controller: BehaviorControllerState,
  candidates: readonly PlayerMovementCandidate[],
): PlayerMovementCandidate | undefined {
  const previous = controller.lastCandidate
  if (!previous || (controller.commitmentRemaining ?? 0) <= 0) {
    return undefined
  }
  // Commitment is to an intent family, not a stale coordinate or target
  // snapshot. The evaluator supplies fresh direction/target data each tick.
  return candidates.find((candidate) => candidate.source === previous.source)
}

function chooseCommittedCandidate(
  controller: BehaviorControllerState,
  candidates: readonly PlayerMovementCandidate[],
  fixedStepSeconds: number,
): PlayerMovementCandidate | undefined {
  const policy = getBehaviorProfilePolicy(controller.profileId)
  const preferred = selectMovementCandidate(candidates)
  const elapsed = Number.isFinite(fixedStepSeconds)
    ? Math.max(0, fixedStepSeconds)
    : 0
  controller.commitmentRemaining = Math.max(
    0,
    (controller.commitmentRemaining ?? 0) - elapsed,
  )

  // Dodge is an interrupt in autonomous mode: telegraphs must always be able
  // to supersede a movement goal, including one that is currently committed.
  const dodge = candidates.find((candidate) => candidate.source === 'dodge')
  if (dodge) {
    return dodge
  }

  const committed = committedCandidate(controller, candidates)
  if (committed) {
    return committed
  }

  if (!preferred) {
    return undefined
  }

  const previous = controller.lastCandidate
  const previousStillAvailable = candidates.find((candidate) =>
    candidate.source === previous?.source,
  )
  if (
    previousStillAvailable &&
    previousStillAvailable.priority + policy.hysteresisPriority >=
      preferred.priority
  ) {
    controller.commitmentRemaining = policy.commitmentSeconds
    return previousStillAvailable
  }

  controller.commitmentRemaining = policy.commitmentSeconds
  return preferred
}

function rememberCommitment(
  controller: BehaviorControllerState,
  candidate: PlayerMovementCandidate | undefined,
): void {
  controller.committedSource = candidate?.source
  controller.committedTargetId = candidate?.targetId
  controller.committedPickupId = candidate?.pickupId
}

/**
 * Evaluates the ordered behavior pipeline and applies exactly one movement.
 * Candidate producers never mutate player position; this is the sole executor.
 */
export function updatePlayerBehavior(
  state: GameState,
  fixedStepSeconds: number,
  spatialHash?: SpatialHash<GameState['enemies'][number] | NonNullable<GameState['bosses']>[number]>,
): PlayerMovementCandidate | undefined {
  const controller = getControllerState(state)
  const candidate = chooseCommittedCandidate(
    controller,
    getPlayerBehaviorCandidates(state, spatialHash),
    fixedStepSeconds,
  )
  controller.lastCandidate = candidate
  rememberCommitment(controller, candidate)
  if (candidate) {
    applyMovementCandidate(state, candidate, fixedStepSeconds)
  }
  return candidate
}

export const updateBehaviorController = updatePlayerBehavior
