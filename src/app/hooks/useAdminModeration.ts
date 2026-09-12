import { useCallback, useEffect, useState } from 'react'
import type { AuthenticationState, NicknameChangeRequest, NicknameService } from '../../auth'
import type { BugReport, BugReportFloorSnapshot, BugReportService } from '../../bug-report'
import type { PersistenceRepository } from '../../persistence'
import type { ServiceHandle } from '../../services'
import type { ToastKind } from '../../ui/ToasterContext'
import type { AppScreen } from '../routing'
import { errorMessage } from '../runFormatting'

interface AdminReportsState {
  loadState: 'idle' | 'loading' | 'ready' | 'error'
  reports: BugReport[]
  hiddenReportIds: number[]
  error: string | null
}

interface NicknameModerationState {
  loadState: 'idle' | 'loading' | 'ready' | 'error'
  requests: NicknameChangeRequest[]
  error: string | null
}

const INITIAL_ADMIN_REPORTS: AdminReportsState = {
  loadState: 'idle',
  reports: [],
  hiddenReportIds: [],
  error: null,
}

const INITIAL_NICKNAME_MODERATION: NicknameModerationState = {
  loadState: 'idle',
  requests: [],
  error: null,
}

interface AdminModerationInputs {
  account: AuthenticationState['account']
  screen: AppScreen
  repository: PersistenceRepository
  bugReport: ServiceHandle<BugReportService>
  nicknameService: ServiceHandle<NicknameService>
  navigateToScreen: (screen: AppScreen, replace?: boolean) => void
  showToast: (message: string, kind?: ToastKind) => void
}

/**
 * The administrator routes: bug reports and nickname moderation.
 *
 * Both are fetched on navigation to their screen rather than kept current,
 * and both refuse anyone without the admin role on every call, not only at
 * the door.
 */
export function useAdminModeration({
  account,
  screen,
  repository,
  bugReport,
  nicknameService,
  navigateToScreen,
  showToast,
}: AdminModerationInputs) {
  const [adminReports, setAdminReports] = useState<AdminReportsState>(INITIAL_ADMIN_REPORTS)
  const [nicknameModeration, setNicknameModeration] =
    useState<NicknameModerationState>(INITIAL_NICKNAME_MODERATION)
  const [showHiddenAdminReports, setShowHiddenAdminReports] = useState(false)

  const openAdmin = useCallback((): void => {
    if (!account?.isAdmin) {
      showToast('Administrator access is required.', 'error')
      return
    }
    navigateToScreen('admin')
  }, [account, navigateToScreen, showToast])

  const openNicknameModeration = useCallback((): void => {
    if (!account?.isAdmin) {
      showToast('Administrator access is required.', 'error')
      return
    }
    navigateToScreen('nickname-moderation')
  }, [account, navigateToScreen, showToast])

  const closeAdmin = useCallback((): void => {
    navigateToScreen('dashboard', true)
  }, [navigateToScreen])

  const refreshAdminReports = useCallback((): void => {
    if (!account?.isAdmin) {
      return
    }
    if (!bugReport.service) {
      setAdminReports((current) => ({
        ...current,
        loadState: 'error',
        error: bugReport.configurationError ?? 'Bug reporting is unavailable.',
      }))
      return
    }
    setAdminReports((current) => ({ ...current, loadState: 'loading', error: null }))
    void Promise.all([
      bugReport.service.loadAll(),
      repository.getHiddenBugReportIds(account.id),
    ])
      .then(([reports, hiddenReportIds]) => {
        setAdminReports({
          loadState: 'ready',
          reports,
          hiddenReportIds: [...hiddenReportIds],
          error: null,
        })
      })
      .catch((error: unknown) => {
        setAdminReports((current) => ({
          ...current,
          loadState: 'error',
          error: errorMessage(error),
        }))
      })
  }, [
    account,
    bugReport.configurationError,
    bugReport.service,
    repository,
  ])

  useEffect(() => {
    if (screen === 'admin' && account?.isAdmin) {
      // Admin data is fetched on navigation to the admin screen. The fetch is
      // imperative and cannot be derived during render.
      // oxlint-disable-next-line react/set-state-in-effect
      refreshAdminReports()
    }
  }, [account, refreshAdminReports, screen])

  const refreshNicknameModeration = useCallback((): void => {
    if (!account?.isAdmin) {
      return
    }
    if (!nicknameService.service) {
      setNicknameModeration((current) => ({
        ...current,
        loadState: 'error',
        error: nicknameService.configurationError ?? 'Nickname moderation is unavailable.',
      }))
      return
    }
    setNicknameModeration((current) => ({ ...current, loadState: 'loading', error: null }))
    void nicknameService.service.loadPendingChanges()
      .then((requests) => {
        setNicknameModeration({ loadState: 'ready', requests, error: null })
      })
      .catch((error: unknown) => {
        setNicknameModeration((current) => ({
          ...current,
          loadState: 'error',
          error: errorMessage(error),
        }))
      })
  }, [
    account,
    nicknameService.configurationError,
    nicknameService.service,
  ])

  useEffect(() => {
    if (screen === 'nickname-moderation' && account?.isAdmin) {
      // Moderation data is fetched on navigation to the moderation screen. The
      // fetch is imperative and cannot be derived during render.
      // oxlint-disable-next-line react/set-state-in-effect
      refreshNicknameModeration()
    }
  }, [account, refreshNicknameModeration, screen])

  const toggleBugReportHidden = useCallback(async (
    reportId: number,
    hidden: boolean,
  ): Promise<void> => {
    const userId = account?.id
    if (!userId) {
      return
    }
    try {
      await repository.setBugReportHidden(userId, reportId, !hidden)
      setAdminReports((current) => ({
        ...current,
        hiddenReportIds: hidden
          ? current.hiddenReportIds.filter((id) => id !== reportId)
          : current.hiddenReportIds.includes(reportId)
            ? current.hiddenReportIds
            : [...current.hiddenReportIds, reportId],
      }))
    } catch (error: unknown) {
      showToast(`Unable to update bug report visibility: ${errorMessage(error)}`, 'error')
    }
  }, [account, repository, showToast])

  const softDeleteBugReport = useCallback(async (reportId: number): Promise<void> => {
    if (!account?.isAdmin) {
      showToast('Administrator access is required.', 'error')
      return
    }
    if (!bugReport.service) {
      showToast(
        `Unable to delete bug report: ${bugReport.configurationError ?? 'Bug reporting is unavailable.'}`,
        'error',
      )
      return
    }
    try {
      await bugReport.service.softDelete(reportId)
      setAdminReports((current) => ({
        ...current,
        reports: current.reports.filter((report) => report.id !== reportId),
        hiddenReportIds: current.hiddenReportIds.filter((id) => id !== reportId),
      }))
      showToast('Bug report deleted.', 'info')
    } catch (error: unknown) {
      showToast(`Unable to delete bug report: ${errorMessage(error)}`, 'error')
    }
  }, [
    account,
    bugReport.configurationError,
    bugReport.service,
    showToast,
  ])

  const loadBugReportFloorSnapshot = useCallback(async (
    snapshotId: number,
  ): Promise<BugReportFloorSnapshot> => {
    if (!account?.isAdmin) {
      throw new Error('Administrator access is required.')
    }
    if (!bugReport.service) {
      throw new Error(bugReport.configurationError ?? 'Bug reporting is unavailable.')
    }
    return bugReport.service.loadFloorSnapshot(snapshotId)
  }, [
    account,
    bugReport.configurationError,
    bugReport.service,
  ])

  const reviewNicknameChange = useCallback(async (
    requestId: number,
    approve: boolean,
  ): Promise<void> => {
    try {
      if (!account?.isAdmin) {
        throw new Error('Administrator access is required.')
      }
      if (!nicknameService.service) {
        throw new Error(nicknameService.configurationError ?? 'Nickname settings are unavailable.')
      }
      await nicknameService.service.reviewChange(requestId, approve)
      setNicknameModeration((current) => ({
        ...current,
        requests: current.requests.filter((request) => request.id !== requestId),
      }))
      showToast(approve ? 'Nickname approved.' : 'Nickname rejected.', 'info')
    } catch (error: unknown) {
      showToast(`Unable to review nickname: ${errorMessage(error)}`, 'error')
    }
  }, [
    account,
    nicknameService.configurationError,
    nicknameService.service,
    showToast,
  ])

  const toggleShowHiddenAdminReports = useCallback((): void => {
    setShowHiddenAdminReports((current) => !current)
  }, [])

  /** Back to the state before any account: a sign-out's reset. */
  const resetAdminModeration = useCallback((): void => {
    setAdminReports(INITIAL_ADMIN_REPORTS)
    setNicknameModeration(INITIAL_NICKNAME_MODERATION)
    setShowHiddenAdminReports(false)
  }, [])

  return {
    adminReports,
    nicknameModeration,
    showHiddenAdminReports,
    openAdmin,
    openNicknameModeration,
    closeAdmin,
    refreshAdminReports,
    refreshNicknameModeration,
    toggleBugReportHidden,
    softDeleteBugReport,
    loadBugReportFloorSnapshot,
    reviewNicknameChange,
    toggleShowHiddenAdminReports,
    resetAdminModeration,
  }
}
