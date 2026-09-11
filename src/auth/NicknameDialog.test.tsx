// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen } from '../testing/render'
import { NicknameDialog } from './NicknameDialog'

function renderPrompt(overrides: Partial<Parameters<typeof NicknameDialog>[0]> = {}) {
  const onCancel = vi.fn()
  const onSubmit = vi.fn(() => Promise.resolve())
  const result = renderComponent(
    <NicknameDialog
      title="Choose a nickname"
      description="Pick the name other players will see."
      inputLabel="Nickname"
      initialValue=""
      pendingNickname={null}
      cancelLabel="Skip for now"
      submitLabel="Submit for review"
      onCancel={onCancel}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return { ...result, onCancel, onSubmit }
}

describe('NicknameDialog', () => {
  it('lets a new account skip choosing a nickname for now', async () => {
    const { user, onCancel, onSubmit } = renderPrompt()

    expect(screen.getByRole('dialog', { name: 'Choose a nickname' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a trimmed nickname for review', async () => {
    const { user, onSubmit } = renderPrompt()

    await user.type(screen.getByLabelText('Nickname'), '  Ashling  ')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))

    expect(onSubmit).toHaveBeenCalledWith('Ashling')
  })

  it('shows why a nickname was rejected instead of closing', async () => {
    const { user, onCancel } = renderPrompt({
      onSubmit: () => Promise.reject(new Error('That nickname is taken.')),
    })

    await user.type(screen.getByLabelText('Nickname'), 'Ashling')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That nickname is taken.')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('rejects an invalid nickname before asking the server', async () => {
    const { user, onSubmit } = renderPrompt()

    await user.type(screen.getByLabelText('Nickname'), 'no!')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
