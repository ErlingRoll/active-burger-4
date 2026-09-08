import { useEffect, useState } from 'react'

/**
 * A timestamp that refreshes on an interval.
 *
 * Screens that render a countdown (champion exhaustion, cooldowns) must not call
 * `Date.now()` while rendering: the value is unstable across the renders React
 * may perform for a single commit, and the displayed remaining time otherwise
 * only refreshes when some unrelated state happens to change. Reading the clock
 * from state instead keeps a render pure and gives the countdown a defined
 * refresh cadence.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, intervalMs)
    return () => {
      window.clearInterval(timer)
    }
  }, [intervalMs])

  return now
}
