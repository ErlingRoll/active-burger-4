import { useEffect, useState } from 'react'
import { describeContractObjective, getContractDefinition } from '../content/contracts/Contracts'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import { getRewardIcon } from '../loot/RewardIcon'
import { useToaster } from '../ui/ToasterContext'
import { useNow } from '../ui/useNow'
import { formatTimeLeft, getContractsByCadence, isContractComplete } from './ContractTypes'
import type { ContractAssignment, ContractService, ContractState } from './ContractTypes'

/**
 * The notices by the gate: the contract board as a panel on the refuge.
 *
 * Three daily contracts and the week's, each one line: the ask, a bar, the
 * pay and a Claim when it is done. The server deals the board from the pool
 * a player can reach and measures progress from what it recorded; the panel
 * reads the state on open and after every claim and never guesses in
 * between. A claimed daily is replaced on the spot, so the board never
 * empties and the day's tally is the only thing that grows.
 *
 * Nothing here pays Essence. A contract hands over materials and boxes, so
 * it is a reason to play the places that exist and never a better run than
 * a run.
 */

interface ContractBoardProps {
  service: ContractService | null
  configurationError: string | null
}

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable'

/** How often the countdown ticks. A window is hours or days long; minutes are enough. */
const BOARD_TICK_MS = 30_000

function itemName(definitionId: string): string {
  return getInventoryItemDefinition(definitionId)?.name ?? definitionId
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to read the contract board.'
}

/** The server's now, carried forward on the client's clock since the state arrived. */
function serverNow(state: ContractState, now: number): number {
  return Date.parse(state.serverTime) + Math.max(0, now - state.receivedAt)
}

interface ContractRowProps {
  assignment: ContractAssignment
  busy: boolean
  onClaim: () => void
}

function ContractRow({ assignment, busy, onClaim }: ContractRowProps) {
  const definition = getContractDefinition(assignment.definitionId)
  const complete = isContractComplete(assignment)
  const claimed = assignment.claimedAt !== null
  const shown = Math.min(assignment.progress, assignment.target)
  const percent = assignment.target > 0 ? Math.round((shown / assignment.target) * 100) : 0
  const name = definition?.name ?? assignment.definitionId
  const reward = definition?.reward ?? []
  return (
    <li
      className="hub-contract"
      data-cadence={assignment.cadence}
      data-state={claimed ? 'claimed' : complete ? 'complete' : 'open'}
      aria-label={`${name}: ${claimed ? 'claimed' : complete ? 'ready to claim' : `${shown} of ${assignment.target}`}`}
    >
      <div className="hub-contract-copy">
        <strong>{name}</strong>
        <small>{definition ? describeContractObjective(definition) : 'A contract this build cannot read.'}</small>
        <div
          className="hub-contract-bar"
          role="progressbar"
          aria-label={`${name} progress`}
          aria-valuemin={0}
          aria-valuemax={assignment.target}
          aria-valuenow={shown}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="hub-contract-side">
        <span className="hub-contract-figure">{shown}/{assignment.target}</span>
        <ul className="hub-contract-reward" aria-label="Reward">
          {reward.map((line) => (
            <li key={line.definitionId} title={`${line.quantity} ${itemName(line.definitionId)}`}>
              <span aria-hidden="true">{getRewardIcon(line.definitionId)}</span>
              <span className="hub-contract-reward-quantity">{line.quantity}</span>
              <span className="visually-hidden">{itemName(line.definitionId)}</span>
            </li>
          ))}
        </ul>
        {claimed ? (
          <span className="hub-contract-claimed">Claimed</span>
        ) : complete ? (
          <button className="hub-contract-claim" type="button" onClick={onClaim} disabled={busy}>
            Claim
          </button>
        ) : null}
      </div>
    </li>
  )
}

export function ContractBoard({ service, configurationError }: ContractBoardProps) {
  const { showLootToast, showToast } = useToaster()
  const now = useNow(BOARD_TICK_MS)
  const [state, setState] = useState<ContractState | null>(null)
  const [loadState, setLoadState] = useState<LoadState>(() => service ? 'loading' : 'unavailable')
  const [error, setError] = useState<string | null>(
    () => service ? configurationError : configurationError ?? 'The contract board is unavailable.',
  )
  const [busyAssignmentId, setBusyAssignmentId] = useState<number | null>(null)

  useEffect(() => {
    if (!service) {
      return
    }
    let cancelled = false
    void service.loadState()
      .then((loaded) => {
        if (cancelled) {
          return
        }
        setState(loaded)
        setLoadState('ready')
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setLoadState('error')
          setError(errorMessage(loadError))
        }
      })
    return () => {
      cancelled = true
    }
  }, [service])

  const claim = async (assignment: ContractAssignment): Promise<void> => {
    if (!service || busyAssignmentId !== null) {
      return
    }
    setBusyAssignmentId(assignment.assignmentId)
    try {
      const result = await service.claimReward(crypto.randomUUID(), assignment.assignmentId)
      const name = getContractDefinition(assignment.definitionId)?.name ?? assignment.definitionId
      if (result.wasProcessed) {
        for (const line of result.paid) {
          showLootToast({
            title: 'Contract fulfilled',
            itemName: itemName(line.definitionId),
            icon: getRewardIcon(line.definitionId),
            reward: `×${line.quantity}`,
            details: [name],
          })
        }
      } else {
        showToast(`${name} was already claimed.`)
      }
      setState(result.state)
      setError(null)
    } catch (claimError: unknown) {
      showToast(claimError instanceof Error ? claimError.message : 'Unable to claim that contract.', 'error')
      // The board may have moved on; read it again rather than trust the row.
      await service.loadState().then(setState).catch(() => undefined)
    } finally {
      setBusyAssignmentId(null)
    }
  }

  const daily = getContractsByCadence(state, 'daily')
  const weekly = getContractsByCadence(state, 'weekly')
  const nowMs = state ? serverNow(state, now) : now
  const dayEnd = daily[0]?.windowEnd
  const weekEnd = weekly[0]?.windowEnd

  return (
    <section className="hub-contracts" aria-labelledby="hub-contracts-title">
      <header className="hub-contracts-heading">
        <div>
          <p className="screen-kicker">Notices by the gate</p>
          <h3 id="hub-contracts-title">Contracts</h3>
        </div>
        {state ? (
          <span className="hub-contracts-tally">
            {state.dailyClaimed} claimed today{dayEnd ? ` · ${formatTimeLeft(dayEnd, nowMs)}` : ''}
          </span>
        ) : null}
      </header>
      {loadState === 'loading' ? (
        <p className="hub-contracts-message" role="status">Reading the board…</p>
      ) : error ? (
        <p className="hub-contracts-message" role="status">{error}</p>
      ) : (
        <>
          <ul className="hub-contract-list" aria-label="Daily contracts">
            {daily.map((assignment) => (
              <ContractRow
                key={assignment.assignmentId}
                assignment={assignment}
                busy={busyAssignmentId !== null}
                onClaim={() => { void claim(assignment) }}
              />
            ))}
          </ul>
          {weekly.length > 0 ? (
            <>
              <p className="hub-contracts-week">
                <span>This week</span>
                {weekEnd ? <span>{formatTimeLeft(weekEnd, nowMs)}</span> : null}
              </p>
              <ul className="hub-contract-list" aria-label="Weekly contract">
                {weekly.map((assignment) => (
                  <ContractRow
                    key={assignment.assignmentId}
                    assignment={assignment}
                    busy={busyAssignmentId !== null}
                    onClaim={() => { void claim(assignment) }}
                  />
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </section>
  )
}
