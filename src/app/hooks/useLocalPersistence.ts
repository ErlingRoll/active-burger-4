import { useCallback, useEffect, useState } from 'react'
import type { BehaviorProfileId, TargetPriorityId } from '../../game'
import {
  DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
  type PersistenceRepository,
  type SettingsPatch,
} from '../../persistence'
import {
  normalizeWorldModifierIds,
  type WorldModifierId,
} from '../../content/modifiers/WorldModifiers'
import type { CharacterClassId } from '../../content/classes/CharacterClasses'
import type { GameKeybinds } from '../../input/Keybinds'
import type { PersistenceState } from '../appState'
import {
  DUNGEON_MAX_FLOOR_CONTRACTS,
  errorMessage,
  isMaxFloorContractUnlocked,
} from '../runFormatting'

/**
 * The local profile and run settings, from IndexedDB.
 *
 * Loaded once per attempt, and written through `persistSettings`, whose
 * failure is shown on the screens that write: a saved setting is the next
 * run's setting, so a write that did not land has to be visible.
 */
export function useLocalPersistence(repository: PersistenceRepository) {
  const [persistence, setPersistence] = useState<PersistenceState>({
    loadState: 'loading',
    settings: null,
    profile: null,
    error: null,
  })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [writeError, setWriteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([repository.getSettings(), repository.getBasicProfile()])
      .then(async ([loadedSettings, profile]) => {
        const selectedContract = DUNGEON_MAX_FLOOR_CONTRACTS.find(
          (contract) => contract.id === loadedSettings.selectedDungeonMaxFloorContractId,
        )
        const validContract = selectedContract !== undefined &&
          isMaxFloorContractUnlocked(profile, selectedContract.id, 'requiredUnlockId' in selectedContract
            ? selectedContract.requiredUnlockId
            : undefined)
        const settings = validContract
          ? loadedSettings
          : await repository.saveSettings({
              ...loadedSettings,
              selectedDungeonMaxFloorContractId: DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
            })
        if (!cancelled) {
          setPersistence({
            loadState: 'ready',
            settings,
            profile,
            error: null,
          })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPersistence((current) => ({
            ...current,
            loadState: 'error',
            error: errorMessage(error),
          }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadAttempt, repository])

  const retryLoad = useCallback((): void => {
    setPersistence((current) => ({
      ...current,
      loadState: 'loading',
      error: null,
    }))
    setLoadAttempt((attempt) => attempt + 1)
  }, [])

  const persistSettings = useCallback(
    async (patch: SettingsPatch): Promise<void> => {
      try {
        const next = await repository.saveSettings(patch)
        setPersistence((current) => ({ ...current, settings: next }))
        setWriteError(null)
      } catch (error: unknown) {
        const message = errorMessage(error)
        setWriteError(message)
        throw error
      }
    },
    [repository],
  )

  const selectBehaviorProfile = useCallback(
    (profileId: BehaviorProfileId): void => {
      void persistSettings({ selectedBehaviorProfileId: profileId }).catch(() => {
        // persistSettings already exposes this error in the UI.
      })
    },
    [persistSettings],
  )

  /*
   * Changing the priority mid-run also changes what the next run starts with,
   * exactly as the behavior profile behaves. It is how the character fights,
   * not how it fought once.
   */
  const selectTargetPriority = useCallback(
    (priorityId: TargetPriorityId): void => {
      void persistSettings({ selectedTargetPriorityId: priorityId }).catch(() => {
        // persistSettings already exposes this error in the UI.
      })
    },
    [persistSettings],
  )

  const updateKeybinds = useCallback(
    async (keybinds: GameKeybinds): Promise<void> => {
      await persistSettings({ keybinds })
    },
    [persistSettings],
  )

  const selectCharacterClass = useCallback(
    (characterClassId: CharacterClassId): void => {
      void persistSettings({ selectedCharacterClassId: characterClassId }).catch(() => {
        // persistSettings already exposes this error in the UI.
      })
    },
    [persistSettings],
  )

  const settings = persistence.settings
  const profile = persistence.profile

  const toggleWorldModifier = useCallback(
    (modifierId: WorldModifierId): void => {
      if (!settings) {
        return
      }
      const selected = settings.selectedWorldModifierIds.includes(modifierId)
      void persistSettings({
        selectedWorldModifierIds: normalizeWorldModifierIds(
          selected
            ? settings.selectedWorldModifierIds.filter((id) => id !== modifierId)
            : [...settings.selectedWorldModifierIds, modifierId],
        ),
      }).catch(() => {
        // persistSettings already exposes this error in the UI.
      })
    },
    [persistSettings, settings],
  )

  return {
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
  }
}
