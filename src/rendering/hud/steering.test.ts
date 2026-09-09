import { describe, expect, it, vi } from 'vitest'
import { createSteeringHandover, type SteerableRun } from './steering'

/**
 * The handover is the half of touch steering that no screenshot shows. A drag
 * that fails to hand the character back leaves a run in free movement with
 * nobody driving it, which looks exactly like a character choosing to stand
 * still until the floor timer runs out.
 */
function run(overrides: Partial<SteerableRun> = {}): SteerableRun {
  return {
    phase: 'playing',
    freeMovementEnabled: false,
    behaviorProfileId: 'cautious',
    setFreeMovementEnabled: vi.fn(),
    setFreeMovementDirection: vi.fn(),
    setBehaviorProfile: vi.fn(),
    ...overrides,
  }
}

describe('steering handover', () => {
  it('takes the character off its profile for the length of a drag', () => {
    const handover = createSteeringHandover()
    const game = run()

    handover.start(game)

    expect(game.setFreeMovementEnabled).toHaveBeenCalledWith(true)
  })

  it('hands the interrupted profile back when the finger lifts', () => {
    const handover = createSteeringHandover()
    const game = run({ behaviorProfileId: 'aggressive' })

    handover.start(game)
    handover.end(game)

    expect(game.setFreeMovementEnabled).toHaveBeenLastCalledWith(false)
    expect(game.setBehaviorProfile).toHaveBeenCalledWith('aggressive')
    expect(game.setFreeMovementDirection).toHaveBeenLastCalledWith(0, 0)
  })

  it('leaves a player who chose free movement in free movement', () => {
    const handover = createSteeringHandover()
    const game = run({ freeMovementEnabled: true })

    handover.start(game)
    handover.end(game)

    expect(game.setFreeMovementEnabled).not.toHaveBeenCalled()
    expect(game.setBehaviorProfile).not.toHaveBeenCalled()
    // The character still stops rather than walking on without a finger.
    expect(game.setFreeMovementDirection).toHaveBeenLastCalledWith(0, 0)
  })

  it('does not take over a run that is not being played', () => {
    const handover = createSteeringHandover()
    const paused = run({ phase: 'paused' })

    handover.start(paused)

    expect(paused.setFreeMovementEnabled).not.toHaveBeenCalled()
  })

  it('hands nothing back after a drag that never started', () => {
    const handover = createSteeringHandover()
    const paused = run({ phase: 'paused' })

    handover.start(paused)
    handover.end(paused)

    expect(paused.setBehaviorProfile).not.toHaveBeenCalled()
  })

  it('forgets the borrowed profile once it has been returned', () => {
    // A second release must not put the character back on a profile it has
    // since been moved off deliberately.
    const handover = createSteeringHandover()
    const game = run({ behaviorProfileId: 'balanced' })

    handover.start(game)
    handover.end(game)
    handover.end(game)

    expect(game.setBehaviorProfile).toHaveBeenCalledTimes(1)
  })

  it('survives the run going away mid-drag', () => {
    const handover = createSteeringHandover()

    expect(() => {
      handover.start(null)
      handover.steer(null, 1, 0)
      handover.end(null)
    }).not.toThrow()
  })
})
