import type {
  PlayerMovementCandidate,
  GameState,
} from '../../state/GameState'
import { PLAYER_MOVEMENT } from '../../../game-config/movement'
import {
  clampPlayerPosition,
  constrainPlayerMovementDirection,
} from '../../../game-config/arena'

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
  const constrainedDirection = constrainPlayerMovementDirection(
    state.player.x,
    state.player.y,
    state.player.radius,
    candidate.directionX,
    candidate.directionY,
  )
  const targetVelocityX = directionLength > 0
    ? constrainedDirection.directionX * candidate.speed
    : 0
  const targetVelocityY = directionLength > 0
    ? constrainedDirection.directionY * candidate.speed
    : 0
  const currentVelocityX = finiteVelocity(state.player.movementVelocityX)
  const currentVelocityY = finiteVelocity(state.player.movementVelocityY)
  const deltaX = targetVelocityX - currentVelocityX
  const deltaY = targetVelocityY - currentVelocityY
  const deltaLength = Math.hypot(deltaX, deltaY)
  const currentSpeed = Math.hypot(currentVelocityX, currentVelocityY)
  const targetSpeed = Math.hypot(targetVelocityX, targetVelocityY)
  const freeMovement = candidate.source === 'free'
  const response = targetSpeed < currentSpeed
    ? freeMovement ? PLAYER_MOVEMENT.freeDeceleration : PLAYER_MOVEMENT.deceleration
    : freeMovement ? PLAYER_MOVEMENT.freeAcceleration : PLAYER_MOVEMENT.acceleration
  const maxDelta = response * seconds
  const scale = deltaLength > 0 && deltaLength > maxDelta
    ? maxDelta / deltaLength
    : 1
  const velocityX = currentVelocityX + deltaX * scale
  const velocityY = currentVelocityY + deltaY * scale

  const currentPosition = clampPlayerPosition(
    state.player.x,
    state.player.y,
    state.player.radius,
  )
  const proposedX = currentPosition.x + velocityX * seconds
  const proposedY = currentPosition.y + velocityY * seconds
  const nextPosition = clampPlayerPosition(
    proposedX,
    proposedY,
    state.player.radius,
  )
  const blockedX = nextPosition.x !== proposedX
  const blockedY = nextPosition.y !== proposedY

  state.player.movementVelocityX = blockedX ? 0 : velocityX
  state.player.movementVelocityY = blockedY ? 0 : velocityY
  state.player.x = nextPosition.x
  state.player.y = nextPosition.y
}
