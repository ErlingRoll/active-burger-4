import {
  APP_VERSION,
} from '../appState'
import {
  AccountSettingsMenu,
  getPlayerDisplayName,
  type AuthenticationState,
  type NicknameState,
} from '../../auth'
import type { InventoryService } from '../../inventory'
import {
  type BugReportDungeonContext,
  type BugReportImage,
} from '../../bug-report'
import {
  DevelopmentInventoryMenu,
} from '../../inventory'

export interface AppHeaderProps {
  authentication: AuthenticationState
  nickname: NicknameState
  onRequestNicknameChange: (nickname: string) => Promise<void>
  onSignOut: () => Promise<boolean>
  onNavigateToDashboard: () => void
  onOpenAdmin: () => void
  onOpenNicknameModeration: () => void
  onOpenFishing: () => void
  onOpenChampions: () => void
  onOpenInventory: () => void
  inventoryService: InventoryService | null
  bugReportDungeon: BugReportDungeonContext
  onSubmitBugReport: (description: string, image?: BugReportImage) => Promise<void>
}

export function AppHeader({
  authentication,
  nickname,
  onRequestNicknameChange,
  onSignOut,
  onNavigateToDashboard,
  onOpenAdmin,
  onOpenNicknameModeration,
  onOpenFishing,
  onOpenChampions,
  onOpenInventory,
  inventoryService,
  bugReportDungeon,
  onSubmitBugReport,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-brand">
        <p className="app-kicker">Dungeon Crawler</p>
        <a
          className="app-title-link"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            onNavigateToDashboard()
          }}
        >
          <h1>Active Burger</h1>
        </a>
        <p className="app-version">Version: {APP_VERSION}</p>
      </div>
      <nav className="app-navigation" aria-label="Primary navigation">
        <a className="app-wiki-link" href="/wiki">Wiki</a>
        <button className="app-admin-link" type="button" onClick={onOpenFishing}>Fishing</button>
        <button className="app-admin-link" type="button" onClick={onOpenChampions}>Champions</button>
        <button className="app-admin-link" type="button" onClick={onOpenInventory}>Inventory</button>
        {import.meta.env.DEV && authentication.account?.isAdmin ? (
          <DevelopmentInventoryMenu inventoryService={inventoryService} />
        ) : null}
      </nav>
      {authentication.account ? (
        <div className="app-account">
          <span className="app-account-label">Signed in</span>
          <strong className="app-account-email">
            {getPlayerDisplayName({
              approvedNickname: nickname.displayName,
              providerDisplayName: authentication.account.displayName,
              email: authentication.account.email,
            })}
          </strong>
          {authentication.error ? (
            <span className="app-account-error">{authentication.error}</span>
          ) : null}
          {authentication.account.isAdmin ? (
            <>
              <button className="app-admin-link" type="button" onClick={onOpenAdmin}>
                Bug reports
              </button>
              <button className="app-admin-link" type="button" onClick={onOpenNicknameModeration}>
                Nickname requests
              </button>
            </>
          ) : null}
          <AccountSettingsMenu
            displayName={nickname.displayName}
            pendingNickname={nickname.pendingNickname}
            onRequestNicknameChange={onRequestNicknameChange}
            bugReportDungeon={bugReportDungeon}
            onSubmitBugReport={onSubmitBugReport}
          />
          <button className="app-sign-out" type="button" onClick={() => { void onSignOut() }}>
            Sign out
          </button>
        </div>
      ) : null}
    </header>
  )
}
