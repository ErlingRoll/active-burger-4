/** Simulation ticks run at a fixed rate, independent of render FPS. */
export const FIXED_STEP_SECONDS = 1 / 60
const STEP_EPSILON_SECONDS = 1e-12

/**
 * Upper bound on raw wall-clock time consumed from a single update call. This
 * prevents a backgrounded browser tab from causing a burst of catch-up ticks;
 * at the maximum 10x scale, one update can still consume at most 2.5 seconds
 * of simulation time.
 */
export const MAX_FRAME_SECONDS = 0.25

/**
 * Fixed-timestep accumulator used by the simulation facade. The callback is
 * checked before every tick because a tick may change the run phase.
 */
export class FixedTimestepClock {
  private accumulatedSeconds = 0

  advance(
    rawDeltaSeconds: number,
    timeScale: number,
    canAdvance: () => boolean,
    step: () => void,
  ): void {
    if (!canAdvance()) {
      return
    }

    // Clamp wall-clock time before applying the scale. This preserves the
    // configured multiplier while still bounding background-tab catch-up.
    const clampedDelta = Math.min(
      Math.max(rawDeltaSeconds, 0),
      MAX_FRAME_SECONDS,
    )
    this.accumulatedSeconds += clampedDelta * timeScale

    while (
      this.accumulatedSeconds + STEP_EPSILON_SECONDS >= FIXED_STEP_SECONDS &&
      canAdvance()
    ) {
      step()
      this.accumulatedSeconds -= FIXED_STEP_SECONDS
    }

    // Time from a frame that triggered a suspended phase must not become
    // catch-up time after a future action resumes the run.
    if (!canAdvance()) {
      this.accumulatedSeconds = 0
    }
  }
}
