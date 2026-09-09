// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { renderComponent } from '../../testing/render'
import { TouchControls } from './TouchControls'

/**
 * Steering is the only manual input the arena has, and on a phone it is the
 * only one there is, so what it publishes to the simulation is worth pinning
 * down: a unit direction while a finger is down, nothing inside the dead zone,
 * and a clean stop on release however the pointer goes away.
 */

function pointer(type: string, x: number, y: number, pointerId = 1): PointerEvent {
  // jsdom has no PointerEvent constructor, so a MouseEvent carries the fields
  // the component reads. It listens for pointer events by name only.
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  }) as MouseEvent & { pointerId: number }
  event.pointerId = pointerId
  return event as unknown as PointerEvent
}

function renderStick() {
  const onSteerStart = vi.fn()
  const onSteer = vi.fn()
  const onSteerEnd = vi.fn()
  const view = renderComponent(
    <TouchControls onSteerStart={onSteerStart} onSteer={onSteer} onSteerEnd={onSteerEnd} />,
  )
  const surface = view.container.querySelector('.arena-steering')
  if (surface === null) {
    throw new Error('The steering surface did not render.')
  }
  return { ...view, surface, onSteerStart, onSteer, onSteerEnd }
}

describe('TouchControls', () => {
  it('takes over steering when a finger goes down', () => {
    const { surface, onSteerStart, onSteer } = renderStick()

    act(() => { surface.dispatchEvent(pointer('pointerdown', 200, 200)) })

    expect(onSteerStart).toHaveBeenCalledTimes(1)
    expect(onSteer).toHaveBeenLastCalledWith(0, 0)
  })

  it('draws the stick where the finger landed', () => {
    const { surface, container } = renderStick()

    act(() => { surface.dispatchEvent(pointer('pointerdown', 140, 260)) })

    const stick = container.querySelector<HTMLElement>('.arena-stick')
    expect(stick?.style.left).toBe('140px')
    expect(stick?.style.top).toBe('260px')
  })

  it('publishes a unit direction, not the distance dragged', () => {
    const { surface, onSteer } = renderStick()

    act(() => { surface.dispatchEvent(pointer('pointerdown', 100, 100)) })
    act(() => { window.dispatchEvent(pointer('pointermove', 160, 180)) })

    // 60 across and 80 down is a 3-4-5 triangle, so the unit vector is exact.
    expect(onSteer).toHaveBeenLastCalledWith(0.6, 0.8)
  })

  it('reads a nudge inside the dead zone as standing still', () => {
    const { surface, onSteer } = renderStick()

    act(() => { surface.dispatchEvent(pointer('pointerdown', 100, 100)) })
    act(() => { window.dispatchEvent(pointer('pointermove', 103, 102)) })

    expect(onSteer).toHaveBeenLastCalledWith(0, 0)
  })

  it('stops and hands the character back when the finger lifts', () => {
    const { surface, container, onSteer, onSteerEnd } = renderStick()

    act(() => { surface.dispatchEvent(pointer('pointerdown', 100, 100)) })
    act(() => { window.dispatchEvent(pointer('pointermove', 200, 100)) })
    act(() => { window.dispatchEvent(pointer('pointerup', 200, 100)) })

    expect(onSteer).toHaveBeenLastCalledWith(0, 0)
    expect(onSteerEnd).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.arena-stick')).toBeNull()
  })

  it('stops when the pointer is cancelled rather than lifted', () => {
    // A phone takes the pointer away for a system gesture or an incoming call,
    // and a character left walking into a wall is the result of ignoring it.
    const { surface, onSteerEnd } = renderStick()

    act(() => { surface.dispatchEvent(pointer('pointerdown', 100, 100)) })
    act(() => { window.dispatchEvent(pointer('pointercancel', 100, 100)) })

    expect(onSteerEnd).toHaveBeenCalledTimes(1)
  })

  it('ignores a second finger while one is already steering', () => {
    const { surface, onSteerStart, onSteer } = renderStick()

    act(() => { surface.dispatchEvent(pointer('pointerdown', 100, 100, 1)) })
    act(() => { surface.dispatchEvent(pointer('pointerdown', 300, 300, 2)) })
    act(() => { window.dispatchEvent(pointer('pointermove', 300, 100, 2)) })

    expect(onSteerStart).toHaveBeenCalledTimes(1)
    // The second finger's movement is not the first finger's direction.
    expect(onSteer).toHaveBeenLastCalledWith(0, 0)
  })
})
