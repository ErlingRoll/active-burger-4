import type {
  PlayerMovementCandidate,
  GameState,
} from '../../state/GameState'
import { PLAYER_MOVEMENT } from '../../../game-config/movement'

function finiteVelocity(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function applyMovementCandidate(
  state: GameState,
  candidate: PlayerMovementCandidate,
  fixedStepSeconds: number,
): void {
  const directionLength = Math.hypot(candidate.directionX, candidate.directionY)
  if (!Number.isFinite(directionLength) || !Number.isFinite(candidate.speed) || candidate.speed < 0) {
    return
  }
  const seconds = Number.isFinite(fixedStepSeconds)
    ? Math.max(0, fixedStepSeconds)
    : 0
  const targetVelocityX = directionLength > 0
    ? candidate.directionX / directionLength * candidate.speed
    : 0
  const targetVelocityY = directionLength > 0
    ? candidate.directionY / directionLength * candidate.speed
    : 0
  const currentVelocityX = finiteVelocity(state.player.movementVelocityX)
  const currentVelocityY = finiteVelocity(state.player.movementVelocityY)
  const deltaX = targetVelocityX - currentVelocityX
  const deltaY = targetVelocityY - currentVelocityY
  const deltaLength = Math.hypot(deltaX, deltaY)
  const currentSpeed = Math.hypot(currentVelocityX, currentVelocityY)
  const targetSpeed = Math.hypot(targetVelocityX, targetVelocityY)
  const response = targetSpeed < currentSpeed
    ? PLAYER_MOVEMENT.deceleration
    : PLAYER_MOVEMENT.acceleration
  const maxDelta = response * seconds
  const scale = deltaLength > 0 && deltaLength > maxDelta
    ? maxDelta / deltaLength
    : 1
  const velocityX = currentVelocityX + deltaX * scale
  const velocityY = currentVelocityY + deltaY * scale

  state.player.movementVelocityX = velocityX
  state.player.movementVelocityY = velocityY
  state.player.x += velocityX * seconds
  state.player.y += velocityY * seconds
}
