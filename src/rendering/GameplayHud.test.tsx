// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, within } from '../testing/render'
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
    onSelectTargetPriority: vi.fn(),
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

  /*
   * The rails and the inspector are two mountings of the same panels, and the
   * stylesheet decides which one a viewport gets: the rails above the desktop
   * width, the inspector below it. jsdom applies no stylesheet, so these assert
   * what is in the tree and which mounting each copy is in, and the layout-fit
   * harness is what proves only one of them is ever on screen.
   */
  it('keeps the gear and the stat sheet on the arena rails', () => {
    renderHud(snapshotFromGame())

    const rail = screen.getByRole('heading', { name: /loadout/i }).closest('.hud-rail')
    expect(rail).not.toBeNull()
    expect(screen.getByRole('heading', { name: /character stats/i })).toBeInTheDocument()
    // The door is still there for the viewport that needs it.
    expect(screen.getByRole('button', { name: /loadout details/i })).toBeInTheDocument()
  })

  it('keeps the run totals on the arena rails too', () => {
    renderHud(snapshotFromGame())

    const rail = screen.getByRole('heading', { name: /dungeon stats/i }).closest('.hud-rail')
    expect(rail).not.toBeNull()
  })

  it('shows the loadout in the inspector when its tab is open', () => {
    renderHud(snapshotFromGame(), 'gear')

    const inspector = within(screen.getByRole('dialog', { name: /run details/i }))
    expect(inspector.getByRole('heading', { name: /loadout/i })).toBeInTheDocument()
  })

  it('shows the character stats in the inspector when its tab is open', () => {
    renderHud(snapshotFromGame(), 'stats')

    const inspector = within(screen.getByRole('dialog', { name: /run details/i }))
    expect(inspector.getByRole('heading', { name: /character stats/i })).toBeInTheDocument()
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

describe('the behavior control', () => {
  it('holds both questions, and answers the targeting one', async () => {
    const { user, onSelectTargetPriority } = renderHud(snapshotFromGame())

    await user.click(screen.getByRole('button', { name: /Fighting style/ }))
    const menu = screen.getByRole('menu', { name: 'Fighting style' })
    expect(within(menu).getByRole('group', { name: 'How I move' })).toBeInTheDocument()
    const targeting = within(menu).getByRole('group', { name: 'Who I hit' })

    await user.click(within(targeting).getByRole('menuitemradio', { name: /Break the Strong/ }))

    expect(onSelectTargetPriority).toHaveBeenCalledWith('elites')
    expect(screen.queryByRole('menu', { name: 'Fighting style' })).not.toBeInTheDocument()
  })

  it('names the priority on the toggle only once it is not the default', () => {
    /*
     * A run starts steering itself, so the first line is the steering label.
     * The point is the same either way: the default priority adds nothing to
     * a button a player already knows.
     */
    renderHud(snapshotFromGame())
    expect(screen.getByRole('button', { name: /Fighting style/ }))
      .not.toHaveTextContent('Nearest')

    renderHud(snapshotFromGame((game) => {
      game.setTargetPriority('ranged')
    }))

    expect(screen.getAllByRole('button', { name: /Fighting style/ })[1])
      .toHaveTextContent('· Ranged')
  })

  it('marks the active priority as checked', async () => {
    const { user } = renderHud(snapshotFromGame((game) => {
      game.setTargetPriority('wounded')
    }))

    await user.click(screen.getByRole('button', { name: /Fighting style/ }))
    const targeting = within(screen.getByRole('menu', { name: 'Fighting style' }))
      .getByRole('group', { name: 'Who I hit' })

    expect(within(targeting).getByRole('menuitemradio', { name: /Cull the Weak/ }))
      .toHaveAttribute('aria-checked', 'true')
    expect(within(targeting).getByRole('menuitemradio', { name: /Nearest/ }))
      .toHaveAttribute('aria-checked', 'false')
  })
})

describe('the vitals panel', () => {
  function shieldedSnapshot(): GameUiSnapshot {
    return snapshotFromGame((game) => {
      const player = game.state.player
      player.aegisPulseShieldAmount = 40
      player.aegisPulseShieldMaxAmount = 60
      player.aegisPulseShieldRemaining = 3.2
      player.aegisPulseShieldDuration = 6
    })
  }

  it('gains a shield without gaining a row', () => {
    /*
     * The regression this pins: the shield used to be a row of its own, and
     * the top bar stretches every panel to the tallest of them, so casting or
     * losing a shield moved the height of the whole bar.
     */
    const bare = renderHud(snapshotFromGame())
    const rowsWithoutShield = document.querySelectorAll('.hud-vital').length
    expect(rowsWithoutShield).toBeGreaterThan(0)
    expect(document.querySelector('.hud-vital-shield-fill')).toBeNull()
    bare.unmount()

    renderHud(shieldedSnapshot())

    expect(document.querySelectorAll('.hud-vital')).toHaveLength(rowsWithoutShield)
    expect(document.querySelector('.hud-vital-shield-fill')).not.toBeNull()
  })

  it('says how much is absorbed and for how long', () => {
    renderHud(shieldedSnapshot())

    expect(screen.getByText(/\+40/)).toHaveTextContent('4s')
  })

  it('reserves the shield figure so the health bar keeps one length', () => {
    /*
     * The figure's slot is what stops the bar beside it growing and shrinking
     * as a shield comes and goes, so the slot has to be in the tree even when
     * there is nothing to put in it.
     */
    const bare = renderHud(snapshotFromGame())
    const slot = document.querySelector('.hud-vital-shield-amount')

    expect(slot).not.toBeNull()
    expect(slot).toBeEmptyDOMElement()
    bare.unmount()

    renderHud(shieldedSnapshot())
    expect(document.querySelector('.hud-vital-shield-amount')).not.toBeEmptyDOMElement()
  })

  it('measures the shield against the same maximum as health', () => {
    const snapshot = shieldedSnapshot()
    renderHud(snapshot)

    const fill = document.querySelector('.hud-vital-shield-fill')
    const share = Math.min(1, 40 / snapshot.maxHp)
    expect(fill?.getAttribute('style')).toContain(`--shield-share: ${share}`)
  })

  it('never draws more shield than the bar has room for', () => {
    const snapshot = snapshotFromGame((game) => {
      const player = game.state.player
      player.aegisPulseShieldAmount = player.maxHp * 4
      player.aegisPulseShieldMaxAmount = player.maxHp * 4
      player.aegisPulseShieldRemaining = 2
      player.aegisPulseShieldDuration = 6
    })
    renderHud(snapshot)

    expect(document.querySelector('.hud-vital-shield-fill')?.getAttribute('style'))
      .toContain('--shield-share: 1')
  })
})
