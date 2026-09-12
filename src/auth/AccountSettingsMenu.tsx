import { useState } from 'react'
import { NicknameDialog } from './NicknameDialog'
import { AudioSettingsPanel } from '../audio'
import { ReportBugModal } from '../rendering/ReportBugModal'
import type { BugReportDungeonContext, BugReportImage } from '../bug-report'

/** What the menu offers a signed-in player beyond the audio settings. */
export interface AccountSettingsAccount {
  displayName: string | null
  pendingNickname: string | null
  onRequestNicknameChange: (nickname: string) => Promise<void>
  bugReportDungeon: BugReportDungeonContext
  onSubmitBugReport: (description: string, image?: BugReportImage) => Promise<void>
}

interface AccountSettingsMenuProps {
  /**
   * The signed-in player's items, or `null` for a visitor. The audio settings
   * belong to the device rather than the account, so a visitor on the sign-in
   * page gets the same menu with only those in it: the refuge's music plays
   * for them too, and they must be able to turn it down.
   */
  account: AccountSettingsAccount | null
}

export function AccountSettingsMenu({ account }: AccountSettingsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reportBugOpen, setReportBugOpen] = useState(false)

  const openNicknameDialog = (): void => {
    setMenuOpen(false)
    setDialogOpen(true)
  }

  const openBugReport = (): void => {
    setMenuOpen(false)
    setReportBugOpen(true)
  }

  return (
    <>
      <div className="account-settings">
        <button
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={account ? 'Account settings' : 'Settings'}
          className="account-settings-toggle"
          type="button"
          onClick={() => { setMenuOpen((open) => !open) }}
        >
          <SettingsIcon />
        </button>
        {menuOpen ? (
          <div className="account-settings-menu" role="menu">
            <AudioSettingsPanel />
            {account ? (
              <>
                <button role="menuitem" type="button" onClick={openNicknameDialog}>
                  Change nickname
                </button>
                <button role="menuitem" type="button" onClick={openBugReport}>
                  Report a bug
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {dialogOpen && account ? (
        // The dialog mounts fresh each time it opens, which is what seeds the
        // draft from the current name: the closed dialog renders nothing, so
        // there is no draft to keep in sync while no one can see it.
        <NicknameDialog
          title="Change nickname"
          description="Nicknames are reviewed before appearing publicly, so offensive or hateful names cannot be published."
          inputLabel="New nickname"
          initialValue={account.pendingNickname ?? account.displayName ?? ''}
          pendingNickname={account.pendingNickname}
          cancelLabel="Cancel"
          submitLabel="Submit for review"
          onCancel={() => setDialogOpen(false)}
          onSubmit={async (nickname) => {
            await account.onRequestNicknameChange(nickname)
            setDialogOpen(false)
          }}
        />
      ) : null}
      {reportBugOpen && account ? (
        <ReportBugModal
          dungeon={account.bugReportDungeon}
          onClose={() => { setReportBugOpen(false) }}
          onSubmit={async (description, image) => {
            await account.onSubmitBugReport(description, image)
            setReportBugOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58-1.92-3.32-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54h-3.84l-.36 2.54a7.1 7.1 0 0 0-1.63.94l-2.39-.96-1.92 3.32 2.03 1.58A7.43 7.43 0 0 0 4.81 12c0 .32.02.63.05.94l-2.03 1.58 1.92 3.32 2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54h3.84l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96 1.92-3.32-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
    </svg>
  )
}
