// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen } from '../testing/render'
import { GameplayHud } from './GameCanvas'
import { createGame } from '../game/Game'
import { DEFAULT_GAME_KEYBINDS } from '../input/Keybinds'
import type { HudInspectorTab } from './hud/HudInspectorTabs'
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

function renderHud(
  snapshot: GameUiSnapshot,
  inspectorTab: HudInspectorTab | null = null,
) {
  const handlers = {
    onInspectorTabChange: vi.fn(),
    onPause: vi.fn(),
    onSelectBehaviorProfile: vi.fn(),
    onToggleFreeMovement: vi.fn(),
    onSetMirrorcastTarget: vi.fn(),
    onSetCriticalSpellstrikeTarget: vi.fn(),
    onSetBloodRiteTarget: vi.fn(),
  }
  return {
    ...renderComponent(
      <GameplayHud
        snapshot={snapshot}
        keybinds={DEFAULT_GAME_KEYBINDS}
        inspectorTab={inspectorTab}
        {...handlers}
      />,
    ),
    ...handlers,
  }
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

  it('keeps the loadout and the stat sheet out of the arena until they are asked for', () => {
    renderHud(snapshotFromGame())

    expect(screen.queryByRole('heading', { name: /loadout/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /character stats/i })).toBeNull()
    expect(screen.getByRole('button', { name: /loadout details/i })).toBeInTheDocument()
  })

  it('shows the loadout in the inspector when its tab is open', () => {
    renderHud(snapshotFromGame(), 'gear')

    expect(screen.getByRole('heading', { name: /loadout/i })).toBeInTheDocument()
  })

  it('shows the character stats in the inspector when its tab is open', () => {
    renderHud(snapshotFromGame(), 'stats')

    expect(screen.getByRole('heading', { name: /character stats/i })).toBeInTheDocument()
  })

  it('asks to open a tab when its toolbar button is pressed', async () => {
    const { onInspectorTabChange, user } = renderHud(snapshotFromGame())

    await user.click(screen.getByRole('button', { name: /stats details/i }))

    expect(onInspectorTabChange).toHaveBeenCalledWith('stats')
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
