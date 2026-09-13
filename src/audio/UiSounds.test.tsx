// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { playSound } = vi.hoisted(() => ({ playSound: vi.fn() }))
vi.mock('./SoundEffects', () => ({ playSound }))

import { getUiSoundForClick, previewVolumeTick, useUiButtonSounds } from './UiSounds'

function Buttons() {
  useUiButtonSounds()
  return (
    <div>
      <button type="button">Plain</button>
      <button type="button" data-sfx="confirm"><span>Nested confirm</span></button>
      <button type="button" data-sfx="cancel">Cancel</button>
      <button type="button" data-sfx="none">Silent</button>
      <button type="button" disabled>Disabled</button>
      <div role="button" tabIndex={0}>Role button</div>
      <p>Not a button</p>
    </div>
  )
}

beforeEach(() => {
  playSound.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('getUiSoundForClick', () => {
  it('finds the button around a click and honours data-sfx', () => {
    render(<Buttons />)
    const byText = (text: string) => document.evaluate(
      `//*[text()="${text}"]`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
    ).singleNodeValue

    expect(getUiSoundForClick(byText('Plain'))).toBe('ui-press')
    expect(getUiSoundForClick(byText('Nested confirm'))).toBe('ui-confirm')
    expect(getUiSoundForClick(byText('Cancel'))).toBe('ui-cancel')
    expect(getUiSoundForClick(byText('Silent'))).toBeUndefined()
    expect(getUiSoundForClick(byText('Disabled'))).toBeUndefined()
    expect(getUiSoundForClick(byText('Role button'))).toBe('ui-press')
    expect(getUiSoundForClick(byText('Not a button'))).toBeUndefined()
    expect(getUiSoundForClick(null)).toBeUndefined()
  })
})

describe('useUiButtonSounds', () => {
  it('plays a press for any button click on the page, and only for buttons', async () => {
    const user = userEvent.setup()
    const view = render(<Buttons />)

    await user.click(view.getByText('Plain'))
    await user.click(view.getByText('Nested confirm'))
    await user.click(view.getByText('Silent'))
    await user.click(view.getByText('Not a button'))

    expect(playSound.mock.calls.map(([cue]) => cue)).toEqual(['ui-press', 'ui-confirm'])
  })

  it('stops listening once unmounted', async () => {
    const user = userEvent.setup()
    const view = render(<Buttons />)
    const button = view.getByText('Plain')
    view.unmount()
    document.body.appendChild(button)

    await user.click(button)

    expect(playSound).not.toHaveBeenCalled()
    button.remove()
  })
})

describe('previewVolumeTick', () => {
  it('ticks at most once per short interval', () => {
    previewVolumeTick(10_000)
    previewVolumeTick(10_050)
    previewVolumeTick(10_100)

    expect(playSound).toHaveBeenCalledTimes(2)
    expect(playSound).toHaveBeenCalledWith('volume-tick')
  })
})
