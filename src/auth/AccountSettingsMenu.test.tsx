// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen } from '../testing/render'
import { AccountSettingsMenu } from './AccountSettingsMenu'

function renderMenu(overrides: Partial<Parameters<typeof AccountSettingsMenu>[0]> = {}) {
  const onRequestNicknameChange = vi.fn(() => Promise.resolve())
  const result = renderComponent(
    <AccountSettingsMenu
      displayName="Mira"
      pendingNickname={null}
      onRequestNicknameChange={onRequestNicknameChange}
      bugReportDungeon={{
        dungeonId: 'sunken-keep',
        dungeonName: 'Sunken Keep',
        currentFloor: 1,
        maxFloor: 10,
        characterClassId: 'knight',
        worldModifierIds: [],
      }}
      onSubmitBugReport={() => Promise.resolve()}
      {...overrides}
    />,
  )
  return { ...result, onRequestNicknameChange }
}

async function openNicknameDialog(user: ReturnType<typeof renderMenu>['user']): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Account settings' }))
  await user.click(screen.getByRole('menuitem', { name: 'Change nickname' }))
}

describe('AccountSettingsMenu', () => {
  it('seeds the nickname draft from the display name when the dialog opens', async () => {
    const { user } = renderMenu()

    await openNicknameDialog(user)

    expect(screen.getByLabelText('New nickname')).toHaveValue('Mira')
  })

  it('prefers a pending nickname over the display name when seeding the draft', async () => {
    const { user } = renderMenu({ pendingNickname: 'Mirabel' })

    await openNicknameDialog(user)

    expect(screen.getByLabelText('New nickname')).toHaveValue('Mirabel')
  })

  it('discards an edited draft when the dialog is reopened', async () => {
    const { user } = renderMenu()

    await openNicknameDialog(user)
    const input = screen.getByLabelText('New nickname')
    await user.clear(input)
    await user.type(input, 'Something else')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await openNicknameDialog(user)

    expect(screen.getByLabelText('New nickname')).toHaveValue('Mira')
  })

  it('submits a valid nickname for review', async () => {
    const { user, onRequestNicknameChange } = renderMenu()

    await openNicknameDialog(user)
    const input = screen.getByLabelText('New nickname')
    await user.clear(input)
    await user.type(input, 'Ashling')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))

    expect(onRequestNicknameChange).toHaveBeenCalledWith('Ashling')
  })
})
