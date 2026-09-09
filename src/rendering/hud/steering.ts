import type { BehaviorProfileId } from '../../game'

/**
 * Lending the character to the player's thumb, and handing it back.
 *
 * The arena plays itself through a behaviour profile; steering is a takeover
 * rather than a mode change. Holding the screen switches free movement on for
 * the length of the drag and remembers which profile was interrupted, and
 * letting go restores it. A player who has already chosen free movement is left
 * in it, because there is nothing to hand back to.
 *
 * This is a small object rather than a few lines inside the canvas component
 * because the handover is the part that can be got wrong in a way no screenshot
 * shows: a run left in free movement with no finger on it stands still while
 * the floor timer runs out.
 */

/** The slice of the game this needs, so a test does not have to build one. */
export interface SteerableRun {
  readonly phase: string
  readonly freeMovementEnabled: boolean
  readonly behaviorProfileId: BehaviorProfileId
  setFreeMovementEnabled: (enabled: boolean) => unknown
  setFreeMovementDirection: (directionX: number, directionY: number) => unknown
  setBehaviorProfile: (profileId: BehaviorProfileId) => unknown
}

export interface SteeringHandover {
  start: (run: SteerableRun | null) => void
  steer: (run: SteerableRun | null, directionX: number, directionY: number) => void
  end: (run: SteerableRun | null) => void
}

export function createSteeringHandover(): SteeringHandover {
  /** The profile a drag interrupted, or null when nothing was borrowed. */
  let borrowedProfile: BehaviorProfileId | null = null

  return {
    start(run) {
      // Steering a paused or finished run would take a character nowhere and
      // leave free movement switched on behind the pause menu.
      if (run === null || run.phase !== 'playing') {
        return
      }
      if (run.freeMovementEnabled) {
        borrowedProfile = null
        return
      }
      borrowedProfile = run.behaviorProfileId
      run.setFreeMovementEnabled(true)
    },

    steer(run, directionX, directionY) {
      run?.setFreeMovementDirection(directionX, directionY)
    },

    end(run) {
      const profile = borrowedProfile
      borrowedProfile = null
      if (run === null) {
        return
      }
      run.setFreeMovementDirection(0, 0)
      if (profile === null) {
        return
      }
      run.setFreeMovementEnabled(false)
      run.setBehaviorProfile(profile)
    },
  }
}
