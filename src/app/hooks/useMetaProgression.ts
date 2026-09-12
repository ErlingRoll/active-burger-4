import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { AuthenticationState } from '../../auth'
import type { MetaProgressionService } from '../../meta'
import type { ActiveDungeonRun } from '../../persistence'
import type { ServiceHandle } from '../../services'
import type { ToastKind } from '../../ui/ToasterContext'
import type { MetaProgressionState, RunLoadState } from '../appState'
import type { AppScreen } from '../routing'
import { errorMessage } from '../runFormatting'

function createInitialMetaProgressionState(
  service: MetaProgressionService | null,
  configurationError: string | null,
): MetaProgressionState {
  return service
    ? {
        loadState: 'idle',
        snapshot: null,
        error: null,
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }
    : {
        loadState: 'unavailable',
        snapshot: null,
        error: configurationError ?? 'Meta progression is unavailable.',
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }
}

/**
 * The Essence wallet and the account's unlocks.
 *
 * Loaded when an account is present and the run is not on screen, and again
 * whenever something asks for a fresh read: a sign-in, a sale at the shop,
 * a run's reward. The two attempt counters are how a request for a reload is
 * told apart from a load that already answered.
 */
export function useMetaProgression(
  metaProgressionService: ServiceHandle<MetaProgressionService>,
  account: AuthenticationState['account'],
  screen: AppScreen,
) {
  const [metaProgression, setMetaProgression] = useState<MetaProgressionState>(() =>
    createInitialMetaProgressionState(
      metaProgressionService.service,
      metaProgressionService.configurationError,
    ),
  )
  const [metaLoadAttempt, setMetaLoadAttempt] = useState(0)
  const [metaLoadedAttempt, setMetaLoadedAttempt] = useState(0)

  useEffect(() => {
    const service = metaProgressionService.service
    if (!account) {
      return
    }
    if (!service || screen === 'gameplay') {
      return
    }
    if (metaProgression.loadState === 'ready' && metaProgression.snapshot !== null && metaLoadAttempt === metaLoadedAttempt) {
      return
    }
    let cancelled = false
    const requestedAttempt = metaLoadAttempt
    void service.load()
      .then((snapshot) => {
        if (!cancelled) {
          setMetaProgression((current) => ({
            ...current,
            loadState: 'ready',
            snapshot,
            error: null,
            purchaseState: 'idle',
            activePurchaseUnlockId: null,
          }))
          setMetaLoadedAttempt(requestedAttempt)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMetaProgression((current) => ({
            ...current,
            loadState: 'error',
            error: errorMessage(error),
          }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    account,
    metaLoadAttempt,
    metaLoadedAttempt,
    metaProgression.loadState,
    metaProgression.snapshot,
    metaProgressionService.service,
    screen,
  ])

  /** Asks for a fresh read and shows the store as loading meanwhile. */
  const refreshMetaProgression = useCallback((): void => {
    setMetaProgression((current) => ({
      ...current,
      loadState: 'loading',
      error: null,
    }))
    setMetaLoadAttempt((attempt) => attempt + 1)
  }, [])

  /** Asks for a fresh read without touching what is shown: a sign-in's reload. */
  const requestReload = useCallback((): void => {
    setMetaLoadAttempt((attempt) => attempt + 1)
  }, [])

  /** Back to the state before any account: a sign-out's reset. */
  const resetMetaProgression = useCallback((): void => {
    setMetaProgression(createInitialMetaProgressionState(
      metaProgressionService.service,
      metaProgressionService.configurationError,
    ))
    setMetaLoadAttempt(0)
    setMetaLoadedAttempt(0)
  }, [metaProgressionService.configurationError, metaProgressionService.service])

  return {
    metaProgression,
    setMetaProgression,
    refreshMetaProgression,
    requestReload,
    resetMetaProgression,
  }
}

interface EssencePurchasesInputs {
  metaProgressionService: ServiceHandle<MetaProgressionService>
  account: AuthenticationState['account']
  metaProgression: MetaProgressionState
  setMetaProgression: Dispatch<SetStateAction<MetaProgressionState>>
  activeRun: ActiveDungeonRun | null
  runLoadState: RunLoadState
  showToast: (message: string, kind?: ToastKind) => void
}

/** Spending Essence at the store, refused while a run is open or unknown. */
export function useEssencePurchases({
  metaProgressionService,
  account,
  metaProgression,
  setMetaProgression,
  activeRun,
  runLoadState,
  showToast,
}: EssencePurchasesInputs) {
  const purchaseUnlock = useCallback(async (unlockId: string): Promise<void> => {
    if (activeRun !== null) {
      showToast('Finish or forfeit your current dungeon run before purchasing upgrades.', 'error')
      return
    }
    if (runLoadState !== 'ready') {
      showToast('Dungeon run status is still loading. Try again in a moment.', 'error')
      return
    }
    if (!metaProgressionService.service || !account) {
      return
    }
    const snapshot = metaProgression.snapshot
    if (!snapshot) {
      return
    }
    const definition = snapshot.definitions.find((candidate) => candidate.id === unlockId)
    if (!definition) {
      showToast(`Unknown unlock definition: ${unlockId}`, 'error')
      return
    }
    setMetaProgression((current) => ({
      ...current,
      purchaseState: 'purchasing',
      activePurchaseUnlockId: unlockId,
    }))
    try {
      const nextSnapshot = await metaProgressionService.service.purchaseUnlock(unlockId)
      setMetaProgression((current) => ({
        ...current,
        snapshot: nextSnapshot,
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }))
    } catch (error: unknown) {
      setMetaProgression((current) => ({
        ...current,
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }))
      showToast(`Unable to purchase upgrade: ${errorMessage(error)}`, 'error')
    }
  }, [
    account,
    activeRun,
    metaProgression.snapshot,
    metaProgressionService.service,
    runLoadState,
    setMetaProgression,
    showToast,
  ])

  const purchaseReroll = useCallback(async (): Promise<void> => {
    if (activeRun !== null) {
      showToast('Finish or forfeit your current dungeon run before purchasing rerolls.', 'error')
      return
    }
    if (runLoadState !== 'ready') {
      showToast('Dungeon run status is still loading. Try again in a moment.', 'error')
      return
    }
    if (!metaProgressionService.service || !account || !metaProgression.snapshot) {
      showToast('Meta progression is unavailable.', 'error')
      return
    }
    setMetaProgression((current) => ({
      ...current,
      purchaseState: 'purchasing',
      activePurchaseUnlockId: 'reroll',
    }))
    try {
      const nextSnapshot = await metaProgressionService.service.purchaseReroll()
      setMetaProgression((current) => ({
        ...current,
        snapshot: nextSnapshot,
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }))
    } catch (error: unknown) {
      setMetaProgression((current) => ({
        ...current,
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }))
      showToast(`Unable to purchase reroll: ${errorMessage(error)}`, 'error')
    }
  }, [
    account,
    activeRun,
    metaProgression.snapshot,
    metaProgressionService.service,
    runLoadState,
    setMetaProgression,
    showToast,
  ])

  return { purchaseUnlock, purchaseReroll }
}
