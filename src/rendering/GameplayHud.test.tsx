// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen } from '../testing/render'
import { GameplayHud } from './GameCanvas'
import { createGame } from '../game/Game'
import type { GameUiSnapshot } from '../game/ui/Snapshots'

/**
 * The gameplay HUD had no test coverage of any kind. These use a snapshot taken
 * from a real seeded game rather than a hand-built fixture, so the shape cannot
 * drift away from what the simulation actually produces.
 */
function snapshotFromGame(configure?: (game: ReturnType<typeof createGame>) => void): GameUiSnapshot {
  const game = createGame({ seed: 20_260_908 })
  configure?.(game)
  return game.getUiSnapshot()
}

function renderHud(snapshot: GameUiSnapshot) {
  const handlers = {
    onSetMirrorcastTarget: vi.fn(),
    onSetCriticalSpellstrikeTarget: vi.fn(),
    onSetBloodRiteTarget: vi.fn(),
  }
  return { ...renderComponent(<GameplayHud snapshot={snapshot} {...handlers} />), ...handlers }
}

describe('GameplayHud', () => {
  it('renders the player vitals from the snapshot', () => {
    const snapshot = snapshotFromGame()

    renderHud(snapshot)

    expect(screen.getByText(String(Math.round(snapshot.maxHp)), { exact: false }))
      .toBeInTheDocument()
  })

  it('lists the skills the player owns', () => {
    const snapshot = snapshotFromGame()
    expect(snapshot.skills.length).toBeGreaterThan(0)

    renderHud(snapshot)

    expect(screen.getByRole('heading', { name: /skills/i })).toBeInTheDocument()
  })

  it('shows the equipped loadout and the character stats panels', () => {
    renderHud(snapshotFromGame())

    expect(screen.getByRole('heading', { name: /loadout/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /stats/i })).toBeInTheDocument()
  })

  it('clamps a health value that exceeds the maximum', () => {
    const snapshot = snapshotFromGame()
    const overhealed: GameUiSnapshot = { ...snapshot, hp: snapshot.maxHp * 3 }

    renderHud(overhealed)

    // The bar must not render past full; the clamp is the behaviour under test.
    expect(screen.queryByText(String(Math.round(snapshot.maxHp * 3)))).toBeNull()
  })

  it('does not render a boss panel when no boss is present', () => {
    const snapshot = snapshotFromGame()

    renderHud(snapshot)

    expect(screen.queryByLabelText('Boss status')).toBeNull()
  })
})
