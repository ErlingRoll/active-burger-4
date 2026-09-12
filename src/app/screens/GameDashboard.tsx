import {
  type RunLoadState,
} from '../appState'
import { useState } from 'react'
import {
  type ActiveDungeonRun,
} from '../../persistence'
import { AdventureHubScene } from '../../hub/AdventureHubScene'
import {
  errorMessage,
} from '../runFormatting'
import type { AbyssLeaderboardService } from '../../leaderboard/AbyssLeaderboardService'
import type { HubPresenceService } from '../../hub/HubPresenceService'
import { ConfirmationDialog } from '../../ui/ConfirmationDialog'
import {
  CHARACTER_CLASS_DEFINITIONS,
} from '../../content/classes/CharacterClasses'

export interface GameDashboardProps {
  accountId: string
  approvedNickname: string | null
  providerDisplayName: string | null
  email: string | null
  essenceBalance: number | null
  presenceService: HubPresenceService | null
  presenceConfigurationError: string | null
  leaderboardService: AbyssLeaderboardService | null
  leaderboardConfigurationError: string | null
  activeRun: ActiveDungeonRun | null
  runLoadState: RunLoadState
  runLoadError: string | null
  onOpenRunSetup: () => void
  onOpenMetaProgression: () => void
  onOpenFishing: () => void
  onOpenCamp: () => void
  onOpenChampions: () => void
  onOpenInventory: () => void
  onOpenShop: () => void
  onOpenContracts: () => void
  onOpenCollections: () => void
  onOpenRunHistory: () => void
  onOpenAbyss: () => void
  championAvailability: 'loading' | 'available' | 'none' | 'error'
  onContinueRun: () => void
  onForfeitRun: () => Promise<void>
}

export function GameDashboard({
  accountId,
  approvedNickname,
  providerDisplayName,
  email,
  essenceBalance,
  presenceService,
  presenceConfigurationError,
  leaderboardService,
  leaderboardConfigurationError,
  activeRun,
  runLoadState,
  runLoadError,
  onOpenRunSetup,
  onOpenMetaProgression,
  onOpenFishing,
  onOpenCamp,
  onOpenChampions,
  onOpenInventory,
  onOpenShop,
  onOpenContracts,
  onOpenCollections,
  onOpenRunHistory,
  onOpenAbyss,
  championAvailability,
  onContinueRun,
  onForfeitRun,
}: GameDashboardProps) {
  const [forfeitConfirmationOpen, setForfeitConfirmationOpen] = useState(false)
  const [forfeiting, setForfeiting] = useState(false)
  const [forfeitError, setForfeitError] = useState<string | null>(null)
  const activeCharacterClass = activeRun
    ? Object.values(CHARACTER_CLASS_DEFINITIONS).find(
      (characterClass) => characterClass.id === activeRun.characterClassId,
    )
    : undefined
  const confirmForfeit = (): void => {
    if (forfeiting) {
      return
    }
    setForfeiting(true)
    setForfeitError(null)
    void onForfeitRun()
      .catch((error: unknown) => {
        setForfeitError(errorMessage(error))
      })
      .finally(() => {
        setForfeiting(false)
        setForfeitConfirmationOpen(false)
      })
  }

  return (
    <>
      <AdventureHubScene
        accountId={accountId}
        approvedNickname={approvedNickname}
        providerDisplayName={providerDisplayName}
        email={email}
        essenceBalance={essenceBalance}
        presenceService={presenceService}
        presenceConfigurationError={presenceConfigurationError}
        leaderboardService={leaderboardService}
        leaderboardConfigurationError={leaderboardConfigurationError}
        activeRun={activeRun}
        activeCharacterClassName={activeCharacterClass?.name ?? null}
        runLoadState={runLoadState}
        runLoadError={runLoadError}
        championAvailability={championAvailability}
        forfeiting={forfeiting}
        forfeitError={forfeitError}
        onOpenRunSetup={onOpenRunSetup}
        onOpenMetaProgression={onOpenMetaProgression}
        onOpenFishing={onOpenFishing}
        onOpenCamp={onOpenCamp}
        onOpenChampions={onOpenChampions}
        onOpenInventory={onOpenInventory}
        onOpenShop={onOpenShop}
        onOpenContracts={onOpenContracts}
        onOpenCollections={onOpenCollections}
        onOpenRunHistory={onOpenRunHistory}
        onOpenAbyss={onOpenAbyss}
        onContinueRun={onContinueRun}
        onRequestForfeit={() => setForfeitConfirmationOpen(true)}
      />
      {forfeitConfirmationOpen ? (
        <ConfirmationDialog
          title="Forfeit dungeon run?"
          message="Are you sure you want to forfeit this run? It will end as a defeat and cannot be continued."
          confirmLabel="Forfeit run"
          onConfirm={confirmForfeit}
          onCancel={() => setForfeitConfirmationOpen(false)}
        />
      ) : null}
    </>
  )
}
