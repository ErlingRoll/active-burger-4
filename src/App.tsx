import { useCallback, useEffect, useMemo } from 'react'
import { DEFAULT_DUNGEON_CONFIG, DEFAULT_DUNGEON_ID, getDungeonDefinition } from './game'
import { getPlayerDisplayName, NicknameDialog } from './auth'
import { DEFAULT_ARTIFACT_SLOT_COUNT } from './meta/MetaProgressionService'
import { useToaster } from './ui/ToasterContext'
import { useServices } from './services'
import {
  DOCUMENT_SCREENS,
  getCanonicalPath,
  getMusicPlaylistId,
  getRunModeForPath,
  getScreenForPath,
  type AppScreen,
} from './app/routing'
import { AppHeader } from './app/screens/AppHeader'
import {
  LazyAdminReportsScreen,
  LazyCampScreen,
  LazyCollectionsScreen,
  LazyChampionManagementScreen,
  LazyFishingScreen,
  LazyGameCanvas,
  LazyInventoryScreen,
  LazyMetaProgressionScreen,
  LazyNicknameModerationScreen,
  LazyRunChronicleScreen,
  LazyRunSetupScreen,
  LazyShopScreen,
  LazyWikiScreen,
} from './app/lazyScreens'
import { LazyScreen } from './app/LazyScreen'
import { NavigationVeil } from './app/NavigationVeil'
import type { NavigationHints } from './app/navigationHints'
import {
  IDLE_PRELOAD_SCREENS,
  loadScreenData,
  preloadScreen,
  SCREEN_DEFINITIONS,
  type LoadedScreen,
  type LoadedScreenData,
  type ScreenLoaderResults,
} from './app/screenDefinitions'
import type { ScreenRequest } from './app/useScreenNavigator'
import { AuthGateway } from './app/screens/AuthGateway'
import { GameDashboard } from './app/screens/GameDashboard'
import { ResultsScreen } from './app/screens/ResultsScreen'
import type { BugReportDungeonContext, BugReportImage } from './bug-report'
import { DEFAULT_GAME_KEYBINDS } from './input/Keybinds'
import { useMusicPlaylist } from './audio'
import { useAppNavigation, useScreenPreparation } from './app/hooks/useAppNavigation'
import { useAuthenticationActions, useAuthenticationState } from './app/hooks/useAuthentication'
import { useAccountNickname } from './app/hooks/useAccountNickname'
import { useLocalPersistence } from './app/hooks/useLocalPersistence'
import { useEssencePurchases, useMetaProgression } from './app/hooks/useMetaProgression'
import { useDungeonRun } from './app/hooks/useDungeonRun'
import { useAdminModeration } from './app/hooks/useAdminModeration'
import './App.css'

import { APP_VERSION, DEVELOPMENT_TOOLS_ENABLED } from './app/appState'

function warmScreen(screen: AppScreen): void {
  void preloadScreen(screen)
}

/**
 * The application shell.
 *
 * Each domain the screens share keeps its state and its actions in a hook
 * under `app/hooks/`: who is signed in, the local settings, the Essence
 * wallet, the run from the refuge to the results, the administrator routes.
 * This component composes them, holds the few things that cross every
 * domain (routing, bug reports, signing out), and renders the screen the
 * path names.
 */
function App() {
  const { showToast } = useToaster()
  const services = useServices()
  const {
    repository,
    authentication: authenticationService,
    nickname: nicknameService,
    meta: metaProgressionService,
    characters,
    abyssLeaderboard,
    dungeonRunPersistence,
    inventory,
    lootBoxes,
    shop,
    fishing,
    hubPresence,
    bugReport,
    camp,
    contracts,
    collections,
  } = services

  const navigation = useAppNavigation()
  const { screen, navigateToScreen, navigator } = navigation
  const { authentication, setAuthentication } = useAuthenticationState(authenticationService)
  const account = authentication.account
  const {
    nickname,
    requestNicknameChange,
    dismissNicknamePrompt,
    nicknamePromptStatus,
  } = useAccountNickname(nicknameService, account, setAuthentication, showToast)
  const {
    persistence,
    settings,
    profile,
    writeError,
    setWriteError,
    retryLoad,
    selectBehaviorProfile,
    selectTargetPriority,
    updateKeybinds,
    selectCharacterClass,
    toggleWorldModifier,
  } = useLocalPersistence(repository)
  const {
    metaProgression,
    setMetaProgression,
    loadStoreSnapshot,
    refreshMetaProgression,
    requestReload,
    resetMetaProgression,
  } = useMetaProgression(metaProgressionService, account, screen)
  const run = useDungeonRun({
    account,
    dungeonRunPersistence,
    characters,
    metaProgressionService,
    settings,
    profile,
    metaProgression,
    setMetaProgression,
    navigateToScreen,
    showToast,
    setWriteError,
  })
  const { purchaseUnlock, purchaseReroll } = useEssencePurchases({
    metaProgressionService,
    account,
    metaProgression,
    setMetaProgression,
    activeRun: run.activeRun,
    runLoadState: run.runLoadState,
    showToast,
  })
  const admin = useAdminModeration({
    account,
    screen,
    repository,
    bugReport,
    nicknameService,
    navigateToScreen,
    showToast,
  })

  const { runConfig, activeRun, setRunMode, returnToDashboard } = run

  /*
   * What "ready to paint" means for a destination: its chunk has arrived and
   * its first fetch has settled, the two fetched in parallel. A screen whose
   * data a domain hook holds (the Essence store and the two admin dashboards)
   * settles that state; every other screen's loader hands its result back to
   * be rendered as `initialData`. A signed-out visitor gets the chunk alone,
   * since the screen will show the sign-in gate.
   */
  const { loadAdminReports, loadNicknameModeration } = admin
  const prepareScreen = useCallback(async (
    request: ScreenRequest,
  ): Promise<LoadedScreenData | null> => {
    const load = request.screen === 'meta-progression'
      ? loadStoreSnapshot()
      : request.screen === 'admin'
        ? loadAdminReports()
        : request.screen === 'nickname-moderation'
          ? loadNicknameModeration()
          : account
            ? loadScreenData(request.screen, services)
            : Promise.resolve(null)
    const [, data] = await Promise.all([preloadScreen(request.screen), load])
    return data ?? null
  }, [account, loadAdminReports, loadNicknameModeration, loadStoreSnapshot, services])
  useScreenPreparation(navigation, prepareScreen)

  const { navigate } = navigator
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const routePath = getCanonicalPath(window.location.pathname)
    if (window.location.pathname !== routePath) {
      window.history.replaceState(null, '', routePath)
    }
    const handlePopState = (): void => {
      const nextScreen = getScreenForPath(window.location.pathname)
      if (nextScreen === 'run-setup') {
        setRunMode(getRunModeForPath(window.location.pathname))
      }
      // The browser has already moved. The page is held until the destination
      // is ready, as on any other navigation, and history is left alone.
      navigate({ screen: nextScreen, history: 'none' })
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [navigate, setRunMode])

  /*
   * Warming chunks before they are asked for. Bandwidth only: data is never
   * fetched ahead of a click.
   *
   * Once the hub has painted and the browser is idle, the routes it sends
   * players to most. And once the player is preparing a run, the renderer,
   * which is the largest chunk by far and is about to be needed.
   */
  useEffect(() => {
    if (screen !== 'dashboard' || !account?.id || typeof window === 'undefined') {
      return
    }
    const warm = (): void => {
      for (const idleScreen of IDLE_PRELOAD_SCREENS) {
        warmScreen(idleScreen)
      }
    }
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(warm)
      return () => {
        window.cancelIdleCallback(handle)
      }
    }
    const handle = window.setTimeout(warm, 1_000)
    return () => {
      window.clearTimeout(handle)
    }
  }, [account?.id, screen])

  useEffect(() => {
    if (screen === 'run-setup') {
      warmScreen('gameplay')
    }
  }, [screen])

  useEffect(() => {
    if (
      activeRun !== null &&
      navigator.pending === null &&
      (screen === 'run-setup' || screen === 'meta-progression')
    ) {
      // Route guard: an active run must not leave the player stranded on a setup
      // screen. It judges the settled state only: starting a run records the
      // active run and then asks for the dungeon, and while that request is
      // pending the committed screen is still the preparation screen, which
      // is not a player stranded but a player on the way down.
      // navigateToScreen also writes browser history, so this is a sync with an
      // external system (the History API) and not derivable in render.
      // oxlint-disable-next-line react/set-state-in-effect
      navigateToScreen('dashboard', true)
    }
  }, [activeRun, navigateToScreen, navigator.pending, screen])

  const bugReportDungeon = useMemo<BugReportDungeonContext>(() => {
    const dungeonId = activeRun?.dungeonId ?? runConfig?.dungeonId ?? DEFAULT_DUNGEON_ID
    const dungeon = getDungeonDefinition(dungeonId)
    return {
      dungeonId,
      dungeonName: dungeon.name,
      currentFloor: activeRun?.currentFloor ?? 1,
      maxFloor: activeRun?.maxFloor ?? runConfig?.selectedDungeonMaxFloor ?? dungeon.defaultMaxFloor,
      characterClassId: activeRun?.characterClassId ?? runConfig?.characterClassId ?? 'knight',
      worldModifierIds: runConfig?.worldModifierIds ?? [],
      runId: activeRun?.runId,
    }
  }, [activeRun, runConfig])
  useMusicPlaylist(getMusicPlaylistId(screen, runConfig?.modeId ?? run.runMode))

  const submitBugReport = useCallback(async (
    description: string,
    image: BugReportImage | undefined,
    dungeon: BugReportDungeonContext,
  ): Promise<void> => {
    if (!account) {
      throw new Error('Sign in before submitting a bug report.')
    }
    if (!bugReport.service) {
      throw new Error(bugReport.configurationError ?? 'Bug reporting is unavailable.')
    }
    await bugReport.service.submit({
      userId: account.id,
      username: getPlayerDisplayName({
        approvedNickname: nickname.displayName,
        providerDisplayName: account.displayName,
        email: account.email,
      }),
      description,
      image,
      dungeon,
    })
    showToast(
      'Thank you for submitting a bug report! Erling will remember this during The Purge.',
      'info',
    )
  }, [
    account,
    bugReport.configurationError,
    bugReport.service,
    nickname.displayName,
    showToast,
  ])

  /*
   * Signing out clears what the account owned, domain by domain, and goes
   * home. The nickname clears itself when the account goes.
   */
  const { resetDungeonRun } = run
  const { resetAdminModeration } = admin
  const onSignedOut = useCallback((): void => {
    resetDungeonRun()
    resetMetaProgression()
    resetAdminModeration()
    navigateToScreen('dashboard', true)
  }, [navigateToScreen, resetAdminModeration, resetDungeonRun, resetMetaProgression])
  const { signIn, signUp, signInWithDiscord, signOut } = useAuthenticationActions(
    authenticationService,
    setAuthentication,
    { onSignedIn: requestReload, onSignedOut },
  )

  const openFishing = useCallback((): void => {
    navigateToScreen('fishing')
  }, [navigateToScreen])

  const openCamp = useCallback((): void => {
    navigateToScreen('camp')
  }, [navigateToScreen])

  const openChampions = useCallback((): void => {
    navigateToScreen('champions')
  }, [navigateToScreen])

  const openInventory = useCallback((): void => {
    navigateToScreen('inventory')
  }, [navigateToScreen])

  const openShop = useCallback((): void => {
    navigateToScreen('shop')
  }, [navigateToScreen])

  const openRunHistory = useCallback((): void => {
    navigateToScreen('run-history')
  }, [navigateToScreen])

  const openCollections = useCallback((): void => {
    navigateToScreen('collections')
  }, [navigateToScreen])

  const closeRunSetup = useCallback((): void => {
    navigateToScreen('dashboard', true)
  }, [navigateToScreen])

  const closeMetaProgression = useCallback((): void => {
    navigateToScreen('dashboard', true)
  }, [navigateToScreen])

  const navigationHints = useMemo<NavigationHints>(() => ({
    pendingScreen: navigator.pending,
    warmScreen,
  }), [navigator.pending])
  /*
   * While a destination loads, the page underneath is frozen: `inert` on the
   * shell takes the pointer and the keyboard away from it, and the veil makes
   * the freeze visible after 150 ms. The attribute is for the stylesheet and
   * for tooling that wants to know a navigation is in flight.
   */
  const shellPending = navigator.pending !== null
  const shellNavigation = shellPending ? 'pending' : 'settled'
  /** The committed screen's loader result, if it is the screen being rendered. */
  const loadedData = <S extends LoadedScreen>(target: S): ScreenLoaderResults[S] | undefined =>
    navigator.data?.screen === target
      ? (navigator.data.data as ScreenLoaderResults[S])
      : undefined

  const header = (
    <AppHeader
      authentication={authentication}
      nickname={nickname}
      onRequestNicknameChange={requestNicknameChange}
      onSignOut={signOut}
      onNavigateToDashboard={returnToDashboard}
      onOpenAdmin={admin.openAdmin}
      onOpenNicknameModeration={admin.openNicknameModeration}
      onOpenFishing={openFishing}
      onOpenCamp={openCamp}
      onOpenChampions={openChampions}
      onOpenInventory={openInventory}
      onOpenShop={openShop}
      onOpenCollections={openCollections}
      onOpenRunHistory={openRunHistory}
      inventoryService={inventory.service}
      characterService={characters.service}
      bugReportDungeon={bugReportDungeon}
      onSubmitBugReport={(description, image) => submitBugReport(description, image, bugReportDungeon)}
      navigation={navigationHints}
    />
  )
  const veil = <NavigationVeil pending={navigator.pending} />

  if (screen === 'wiki') {
    return (
      <main
        className="app-shell app-shell-document"
        inert={shellPending}
        data-navigation={shellNavigation}
      >
        {header}
        <LazyScreen label={SCREEN_DEFINITIONS.wiki.label}>
          <LazyWikiScreen
            appVersion={APP_VERSION}
            onReturnToApp={() => navigateToScreen('dashboard')}
          />
        </LazyScreen>
        {veil}
      </main>
    )
  }

  if (persistence.loadState === 'loading') {
    return (
      <main className="app-shell" inert={shellPending} data-navigation={shellNavigation}>
        {header}
        <section className="dashboard" aria-labelledby="persistence-loading-title">
          <div className="dashboard-panel" role="status">
            <p className="screen-kicker">Local persistence</p>
            <h2 id="persistence-loading-title">Loading saved run settings…</h2>
            <p>Opening your local profile and saved run settings.</p>
          </div>
        </section>
        {veil}
      </main>
    )
  }

  if (persistence.loadState === 'error' || !settings || !profile || !runConfig) {
    return (
      <main className="app-shell" inert={shellPending} data-navigation={shellNavigation}>
        {header}
        <section className="dashboard" aria-labelledby="persistence-error-title">
          <div className="dashboard-panel" role="alert">
            <p className="screen-kicker">Local persistence error</p>
            <h2 id="persistence-error-title">Saved settings unavailable</h2>
            <p>{persistence.error ?? 'Unable to load local persistence.'}</p>
            <button className="primary-action" type="button" onClick={retryLoad}>
              Retry
            </button>
          </div>
        </section>
        {veil}
      </main>
    )
  }

  return (
    <main
      className={`app-shell${
        screen === 'gameplay'
          ? ' app-shell-gameplay'
          : screen === 'fishing'
            ? ' app-shell-fishing'
            : screen === 'camp'
              ? ' app-shell-camp'
              : screen === 'dashboard'
                ? ' app-shell-hub'
                : ''
      }${DOCUMENT_SCREENS.has(screen) ? ' app-shell-document' : ''}`}
      data-nickname-prompt={nicknamePromptStatus}
      data-navigation={shellNavigation}
      inert={shellPending}
    >
      {screen !== 'gameplay' && nickname.promptOpen && account ? (
        // A run in progress is not interrupted; the prompt waits for the
        // player to come back out of the dungeon.
        <NicknameDialog
          title="Choose a nickname"
          description="Pick the name other players will see. Nicknames are reviewed before appearing publicly, so offensive or hateful names cannot be published. You can change it later from account settings."
          inputLabel="Nickname"
          initialValue=""
          pendingNickname={null}
          cancelLabel="Skip for now"
          submitLabel="Submit for review"
          onCancel={dismissNicknamePrompt}
          onSubmit={requestNicknameChange}
        />
      ) : null}
      {screen !== 'gameplay' ? header : null}
      {screen === 'dashboard' && account ? (
        <GameDashboard
          accountId={account.id}
          approvedNickname={nickname.displayName}
          providerDisplayName={account.displayName}
          email={account.email}
          essenceBalance={metaProgression.snapshot?.wallet.essenceBalance ?? null}
          presenceService={hubPresence.service}
          presenceConfigurationError={hubPresence.configurationError}
          leaderboardService={abyssLeaderboard.service}
          leaderboardConfigurationError={abyssLeaderboard.configurationError}
          contractService={contracts.service}
          contractConfigurationError={contracts.configurationError}
          activeRun={activeRun}
          runLoadState={run.runLoadState}
          runLoadError={run.runLoadError}
          onOpenMetaProgression={run.openMetaProgression}
          onOpenFishing={openFishing}
          onOpenCamp={openCamp}
          onOpenChampions={openChampions}
          onOpenInventory={openInventory}
          onOpenShop={openShop}
          onOpenCollections={openCollections}
          onOpenRunHistory={openRunHistory}
          onOpenAbyss={run.openAbyssSetup}
          championAvailability={run.championAvailability}
          onOpenRunSetup={run.openRunSetup}
          onContinueRun={run.continueRun}
          onForfeitRun={run.forfeitActiveRun}
          navigation={navigationHints}
        />
      ) : null}
      {screen === 'admin' && account?.isAdmin ? (
        <LazyScreen label={SCREEN_DEFINITIONS.admin.label}>
          <LazyAdminReportsScreen
            reports={admin.adminReports.reports}
            hiddenReportIds={new Set(admin.adminReports.hiddenReportIds)}
            showHidden={admin.showHiddenAdminReports}
            loadState={admin.adminReports.loadState === 'idle' ? 'loading' : admin.adminReports.loadState}
            error={admin.adminReports.error}
            onBack={admin.closeAdmin}
            onRefresh={admin.refreshAdminReports}
            onToggleShowHidden={admin.toggleShowHiddenAdminReports}
            onToggleHide={(reportId, hidden) => { void admin.toggleBugReportHidden(reportId, hidden) }}
            onDelete={(reportId) => { void admin.softDeleteBugReport(reportId) }}
            onLoadFloorSnapshot={admin.loadBugReportFloorSnapshot}
          />
        </LazyScreen>
      ) : null}
      {screen === 'nickname-moderation' && account?.isAdmin ? (
        <LazyScreen label={SCREEN_DEFINITIONS['nickname-moderation'].label}>
          <LazyNicknameModerationScreen
            requests={admin.nicknameModeration.requests}
            loadState={admin.nicknameModeration.loadState === 'idle' ? 'loading' : admin.nicknameModeration.loadState}
            error={admin.nicknameModeration.error}
            onBack={admin.closeAdmin}
            onRefresh={admin.refreshNicknameModeration}
            onReview={(requestId, approve) => {
              void admin.reviewNicknameChange(requestId, approve)
            }}
          />
        </LazyScreen>
      ) : null}
      {(screen === 'admin' || screen === 'nickname-moderation') &&
      (!account || !account.isAdmin) ? (
        <section className="dashboard" aria-labelledby="admin-access-title">
          <div className="dashboard-panel" role="alert">
            <p className="screen-kicker">Restricted route</p>
            <h2 id="admin-access-title">Administrator access required</h2>
            <p>Only administrator accounts can view moderation tools.</p>
            <button className="secondary-action" type="button" onClick={admin.closeAdmin}>
              Back to dashboard
            </button>
          </div>
        </section>
      ) : null}
      {(screen === 'dashboard' || screen === 'run-setup' || screen === 'meta-progression' || screen === 'fishing' || screen === 'camp' || screen === 'collections' || screen === 'champions' || screen === 'inventory' || screen === 'run-history') &&
      !account ? (
        <AuthGateway
          authentication={authentication}
          onSignIn={signIn}
          onSignUp={signUp}
          onSignInWithDiscord={signInWithDiscord}
          onSignOut={signOut}
        />
      ) : null}
      {screen === 'run-setup' && account ? (
        <LazyScreen label={SCREEN_DEFINITIONS['run-setup'].label}>
          <LazyRunSetupScreen
            initialData={loadedData('run-setup')}
            initialLoadError={navigator.loadError}
            settings={settings}
            writeError={writeError ?? run.runStartError}
            startState={run.runStartState}
            inventoryService={inventory.service}
            inventoryError={inventory.configurationError}
            characterService={characters.service}
            characterError={characters.configurationError}
            campService={camp.service}
            maximumDungeonFloor={metaProgression.snapshot?.dungeonMaxFloor ?? DEFAULT_DUNGEON_CONFIG.defaultMaxFloor}
            artifactSlotCount={metaProgression.snapshot?.artifactSlotCount ?? DEFAULT_ARTIFACT_SLOT_COUNT}
            initialMode={run.runMode}
            onStart={run.startRun}
            onSelectCharacterClass={selectCharacterClass}
            onToggleWorldModifier={toggleWorldModifier}
            onSelectTargetPriority={selectTargetPriority}
            onBack={closeRunSetup}
          />
        </LazyScreen>
      ) : null}
      {screen === 'meta-progression' && account ? (
        <LazyScreen label={SCREEN_DEFINITIONS['meta-progression'].label}>
          <LazyMetaProgressionScreen
            snapshot={metaProgression.snapshot}
            loadState={metaProgression.loadState}
            loadError={metaProgression.error}
            purchaseState={metaProgression.purchaseState}
            activePurchaseUnlockId={metaProgression.activePurchaseUnlockId}
            onBack={closeMetaProgression}
            onRefresh={refreshMetaProgression}
            onPurchaseUnlock={(unlockId) => { void purchaseUnlock(unlockId) }}
            onPurchaseReroll={() => { void purchaseReroll() }}
          />
        </LazyScreen>
      ) : null}
      {screen === 'fishing' && account ? (
        <LazyScreen label={SCREEN_DEFINITIONS.fishing.label}>
          <LazyFishingScreen
            initialData={loadedData('fishing')}
            initialLoadError={navigator.loadError}
            fishingService={fishing.service}
            inventoryService={inventory.service}
            lootBoxService={lootBoxes.service}
            configurationError={fishing.configurationError ?? inventory.configurationError}
            activityPlayerId={account.id}
            activityPlayerApprovedNickname={nickname.displayName}
            activityPlayerProviderName={account.displayName}
            activityPlayerEmail={account.email}
          />
        </LazyScreen>
      ) : null}
      {screen === 'camp' && account ? (
        <LazyScreen label={SCREEN_DEFINITIONS.camp.label}>
          <LazyCampScreen
            initialData={loadedData('camp')}
            initialLoadError={navigator.loadError}
            service={camp.service}
            configurationError={camp.configurationError}
            characterService={characters.service}
            inventoryService={inventory.service}
            developmentToolsEnabled={DEVELOPMENT_TOOLS_ENABLED && (account?.isAdmin ?? false)}
            collectionService={collections.service}
            onOpenCollections={openCollections}
            onBack={returnToDashboard}
          />
        </LazyScreen>
      ) : null}
      {screen === 'champions' && account ? (
        <LazyScreen label={SCREEN_DEFINITIONS.champions.label}>
          <LazyChampionManagementScreen
            initialData={loadedData('champions')}
            initialLoadError={navigator.loadError}
            service={characters.service}
            inventoryService={inventory.service}
            inventoryError={inventory.configurationError}
            campService={camp.service}
            configurationError={characters.configurationError}
            onBack={returnToDashboard}
          />
        </LazyScreen>
      ) : null}
      {screen === 'inventory' && account ? (
        <LazyScreen label={SCREEN_DEFINITIONS.inventory.label}>
          <LazyInventoryScreen
            initialData={loadedData('inventory')}
            initialLoadError={navigator.loadError}
            inventoryService={inventory.service}
            lootBoxService={lootBoxes.service}
            configurationError={lootBoxes.configurationError ?? inventory.configurationError}
            onBack={returnToDashboard}
          />
        </LazyScreen>
      ) : null}
      {screen === 'shop' && account ? (
        <LazyScreen label={SCREEN_DEFINITIONS.shop.label}>
          <LazyShopScreen
            initialData={loadedData('shop')}
            initialLoadError={navigator.loadError}
            shopService={shop.service}
            inventoryService={inventory.service}
            configurationError={shop.configurationError ?? inventory.configurationError}
            onBack={returnToDashboard}
            onEssenceChanged={refreshMetaProgression}
          />
        </LazyScreen>
      ) : null}
      {screen === 'collections' && account ? (
        <LazyScreen label={SCREEN_DEFINITIONS.collections.label}>
          <LazyCollectionsScreen
            initialData={loadedData('collections')}
            initialLoadError={navigator.loadError}
            service={collections.service}
            configurationError={collections.configurationError}
            onBack={returnToDashboard}
          />
        </LazyScreen>
      ) : null}
      {screen === 'run-history' && account ? (
        <LazyScreen label={SCREEN_DEFINITIONS['run-history'].label}>
          <LazyRunChronicleScreen
            initialData={loadedData('run-history')}
            initialLoadError={navigator.loadError}
            service={dungeonRunPersistence.service}
            configurationError={dungeonRunPersistence.configurationError}
            onBack={returnToDashboard}
          />
        </LazyScreen>
      ) : null}
      {screen === 'gameplay' ? (
        <LazyScreen label={SCREEN_DEFINITIONS.gameplay.label}>
          <LazyGameCanvas
            key={run.runId}
            runConfig={runConfig}
            initialCheckpoint={run.resumeCheckpoint}
            onRunEnd={run.handleRunEnd}
            onFloorCheckpoint={run.saveFloorCheckpoint}
            onSaveAndQuit={run.saveAndQuitRun}
            onBehaviorProfileChange={selectBehaviorProfile}
            onTargetPriorityChange={selectTargetPriority}
            keybinds={settings?.keybinds ?? DEFAULT_GAME_KEYBINDS}
            onKeybindsChange={updateKeybinds}
            reportBugRunId={run.activeRunSubmission?.runId}
            onSubmitBugReport={submitBugReport}
            developmentToolsEnabled={DEVELOPMENT_TOOLS_ENABLED && (account?.isAdmin ?? false)}
          />
        </LazyScreen>
      ) : null}
      {screen === 'results' && run.result ? (
        <ResultsScreen
          result={run.result}
          runReward={run.runReward}
          terminalSaveState={run.terminalSaveState}
          terminalSaveError={run.terminalSaveError}
          championSaveState={run.championSaveState}
          championSaveError={run.championSaveError}
          championConfigurationError={characters.configurationError}
          championRoster={run.championRoster}
          onSaveChampion={run.saveChampion}
          onReplaceChampion={run.replaceChampion}
          onDiscardChampion={run.discardChampion}
          onReturn={returnToDashboard}
          onRetryTerminalSave={run.retryTerminalSave}
          onRetryReward={run.retryRunReward}
        />
      ) : null}
      {veil}
    </main>
  )
}

export default App
