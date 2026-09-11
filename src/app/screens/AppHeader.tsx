import { useState } from 'react'
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
  onOpenShop: () => void
  onOpenRunHistory: () => void
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
  onOpenShop,
  onOpenRunHistory,
  inventoryService,
  bugReportDungeon,
  onSubmitBugReport,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  /*
   * Every destination closes the menu on its way out.
   *
   * The header outlives the screen it sits above, so an open drawer is not
   * dismissed by arriving somewhere: without this, tapping Fishing leaves the
   * drawer hanging over the pond.
   */
  const leaveFor = (open: () => void) => (): void => {
    setMenuOpen(false)
    open()
  }

  return (
    <header className="app-header">
      <div className="app-brand">
        <p className="app-kicker">Dungeon Crawler</p>
        <a
          className="app-title-link"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            setMenuOpen(false)
            onNavigateToDashboard()
          }}
        >
          <h1>Active Burger</h1>
        </a>
        <p className="app-version">Version: {APP_VERSION}</p>
      </div>
      {/*
        The drawer's handle. It is the header on a phone and nothing at all on a
        desktop, where the same links have room to stay on show.
      */}
      <button
        aria-controls={APP_MENU_ID}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="Menu"
        className="app-menu-toggle"
        type="button"
        onClick={() => { setMenuOpen((open) => !open) }}
      >
        <MenuIcon open={menuOpen} />
      </button>
      {/*
        Everything the header offers besides its own name. One box so that a
        phone can hide it behind the handle above; `display: contents` on a
        desktop, where it goes back to being a nav and an account block sitting
        directly in the header's row.
      */}
      <div
        className={`app-header-menu${menuOpen ? ' app-header-menu-open' : ''}`}
        id={APP_MENU_ID}
      >
        <nav className="app-navigation" aria-label="Primary navigation">
          <a className="app-wiki-link" href="/wiki">Wiki</a>
          <button className="app-admin-link" type="button" onClick={leaveFor(onOpenFishing)}>Fishing</button>
          <button className="app-admin-link" type="button" onClick={leaveFor(onOpenChampions)}>Champions</button>
          <button className="app-admin-link" type="button" onClick={leaveFor(onOpenInventory)}>Inventory</button>
          <button className="app-admin-link" type="button" onClick={leaveFor(onOpenShop)}>Shop</button>
          <button className="app-admin-link" type="button" onClick={leaveFor(onOpenRunHistory)}>Chronicle</button>
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
                <button className="app-admin-link" type="button" onClick={leaveFor(onOpenAdmin)}>
                  Bug reports
                </button>
                <button className="app-admin-link" type="button" onClick={leaveFor(onOpenNicknameModeration)}>
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
      </div>
    </header>
  )
}

const APP_MENU_ID = 'app-header-menu'

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {open ? (
        <path d="M5.3 4 4 5.3 10.7 12 4 18.7 5.3 20 12 13.3 18.7 20 20 18.7 13.3 12 20 5.3 18.7 4 12 10.7Z" />
      ) : (
        <path d="M3 5.5h18v2H3ZM3 11h18v2H3ZM3 16.5h18v2H3Z" />
      )}
    </svg>
  )
}
