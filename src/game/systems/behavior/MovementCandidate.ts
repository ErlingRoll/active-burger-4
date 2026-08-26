import type {
  PlayerMovementCandidate,
  GameState,
} from '../../state/GameState'

export function applyMovementCandidate(
  state: GameState,
  candidate: PlayerMovementCandidate,
  fixedStepSeconds: number,
): void {
  const directionLength = Math.hypot(candidate.directionX, candidate.directionY)
  if (
    directionLength === 0 ||
    !Number.isFinite(directionLength) ||
    !Number.isFinite(candidate.speed) ||
    candidate.speed < 0
  ) {
    return
  }
  const seconds = Number.isFinite(fixedStepSeconds)
    ? Math.max(0, fixedStepSeconds)
    : 0
  state.player.x += candidate.directionX / directionLength * candidate.speed * seconds
  state.player.y += candidate.directionY / directionLength * candidate.speed * seconds
}
