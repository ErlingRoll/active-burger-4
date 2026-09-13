import { describe, expect, it } from 'vitest'
import type { GameState } from '../state/GameState'
import {
  createGameEventSink,
  emitGameEvent,
  MAX_PENDING_GAME_EVENTS,
  takeGameEvents,
} from './GameEvents'

function fakeState(): GameState {
  // The sink only uses the object's identity, so an empty object suffices.
  return {} as GameState
}

describe('game event sink', () => {
  it('drops emissions for a state without a sink', () => {
    const state = fakeState()

    emitGameEvent(state, { type: 'choice-skipped' })

    expect(takeGameEvents(state)).toEqual([])
  })

  it('returns recorded events in order and clears them', () => {
    const state = fakeState()
    createGameEventSink(state)

    emitGameEvent(state, { type: 'choice-rerolled' })
    emitGameEvent(state, { type: 'stairs-reached' })

    expect(takeGameEvents(state)).toEqual([
      { type: 'choice-rerolled' },
      { type: 'stairs-reached' },
    ])
    expect(takeGameEvents(state)).toEqual([])
  })

  it('keeps separate queues per state', () => {
    const first = fakeState()
    const second = fakeState()
    createGameEventSink(first)
    createGameEventSink(second)

    emitGameEvent(first, { type: 'choice-skipped' })

    expect(takeGameEvents(second)).toEqual([])
    expect(takeGameEvents(first)).toHaveLength(1)
  })

  it('drops the oldest half once the cap is reached', () => {
    const state = fakeState()
    createGameEventSink(state)

    for (let index = 0; index < MAX_PENDING_GAME_EVENTS; index += 1) {
      emitGameEvent(state, { type: 'level-up', level: index })
    }
    emitGameEvent(state, { type: 'stairs-reached' })

    const events = takeGameEvents(state)
    expect(events).toHaveLength(MAX_PENDING_GAME_EVENTS / 2 + 1)
    expect(events[0]).toEqual({ type: 'level-up', level: MAX_PENDING_GAME_EVENTS / 2 })
    expect(events.at(-1)).toEqual({ type: 'stairs-reached' })
  })

  it('creating a sink twice keeps the pending events', () => {
    const state = fakeState()
    createGameEventSink(state)
    emitGameEvent(state, { type: 'choice-skipped' })

    createGameEventSink(state)

    expect(takeGameEvents(state)).toHaveLength(1)
  })
})
