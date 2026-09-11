import type {
  DodgeState,
  DodgeMovementCandidate,
  GameState,
  TelegraphState,
} from '../../state/GameState'
import { getEffectivePlayerMovementSpeed } from '../../stats/DerivedStats'
import { getTelegraphEscapeVector } from '../../geometry/TelegraphGeometry'
import { applyMovementCandidate } from '../behavior/MovementCandidate'

function getDodgeState(state: GameState): DodgeState {
  return state.player.dodge ??= {
    mode: 'autonomous',
    level: 1,
    reactionTime: 0.1,
    lastDirectionX: 0,
    lastDirectionY: 0,
  }
}

/**
 * The telegraphs the character has had time to notice, oldest first. A
 * telegraph younger than the reaction time is not yet dodged, which is what
 * keeps the response from being instantaneous.
 */
export function getImminentTelegraphs(state: GameState): TelegraphState[] {
  const dodge = getDodgeState(state)
  return [...(state.telegraphs ?? [])]
    .filter(
      (telegraph) =>
        telegraph.remainingDuration > 0 &&
        telegraph.remainingDuration <=
          Math.max(0, telegraph.duration - dodge.reactionTime),
    )
    .sort((left, right) => left.id - right.id)
}

/**
 * Produces a movement candidate only in response to an active telegraph. A
 * quiet run remains stationary and fully deterministic; movement is applied by
 * the behavior controller.
 *
 * Which way is out belongs to the telegraph's shape, so it is asked for rather
 * than recomputed here: a ring is left by closing on its safe centre and a lane
 * by stepping off it sideways, neither of which is "away from the middle".
 * The behavior evaluator then weighs that way out against every other, so the
 * exit chosen is also the one that lands somewhere safe.
 */
export function getPlayerDodgeCandidate(
  state: GameState,
): DodgeMovementCandidate | undefined {
  const player = state.player
  const dodge = getDodgeState(state)
  const telegraphs = getImminentTelegraphs(state)

  let directionX = 0
  let directionY = 0
  for (const telegraph of telegraphs) {
    const escape = getTelegraphEscapeVector(
      telegraph,
      player.x,
      player.y,
      player.radius,
    )
    if (!escape) {
      continue
    }
    directionX += escape.x
    directionY += escape.y
  }

  const directionLength = Math.hypot(directionX, directionY)
  if (directionLength === 0) {
    return undefined
  }
  directionX /= directionLength
  directionY /= directionLength
  dodge.lastDirectionX = directionX
  dodge.lastDirectionY = directionY
  return {
    source: 'dodge',
    directionX,
    directionY,
    speed: getEffectivePlayerMovementSpeed(player),
    priority: 100,
  }
}

export const getDodgeCandidate = getPlayerDodgeCandidate
export const createDodgeCandidate = getPlayerDodgeCandidate

/** Legacy name retained while callers migrate to the candidate contract. */
export function updatePlayerDodge(
  state: GameState,
  fixedStepSeconds = 0,
): DodgeMovementCandidate | undefined {
  const candidate = getPlayerDodgeCandidate(state)
  if (candidate) {
    applyMovementCandidate(state, candidate, fixedStepSeconds)
  }
  return candidate
}
