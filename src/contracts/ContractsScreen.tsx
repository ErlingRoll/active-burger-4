import { useEffect, useState } from 'react'
import {
  describeContractObjective,
  describeContractPlace,
  getContractDefinition,
  type ContractCadence,
} from '../content/contracts/Contracts'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import { getRewardIcon } from '../loot/RewardIcon'
import { useToaster } from '../ui/ToasterContext'
import { useNow } from '../ui/useNow'
import { formatTimeLeft, getContractsByCadence, isContractComplete } from './ContractTypes'
import type { ContractAssignment, ContractService, ContractState } from './ContractTypes'

/**
 * The contract board.
 *
 * Three daily contracts and one weekly, dealt by the server from the pool a
 * player can reach and measured by the server from what it recorded. The
 * board reads the state on open and after every claim and never guesses in
 * between; the one thing the browser adds is a countdown to the window's
 * end, carried forward on the client's clock from the server's.
 *
 * Nothing here pays Essence. A contract hands over materials and boxes, so
 * it is a reason to play the places that exist and never a better run than
 * a run.
 */

interface ContractsScreenProps {
  service: ContractService | null
  configurationError: string | null
  onBack: () => void
}

type LoadState = 'loading' | 'ready' | 'error'

/** How often the countdowns tick. A window is hours or days long; minutes are enough. */
const BOARD_TICK_MS = 30_000

function itemName(definitionId: string): string {
  return getInventoryItemDefinition(definitionId)?.name ?? definitionId
}

/** The server's now, carried forward on the client's clock since the state arrived. */
function serverNow(state: ContractState, now: number): number {
  return Date.parse(state.serverTime) + Math.max(0, now - state.receivedAt)
}

interface ContractCardProps {
  assignment: ContractAssignment
  nowMs: number
  busy: boolean
  onClaim: () => void
}

function ContractCard({ assignment, nowMs, busy, onClaim }: ContractCardProps) {
  const definition = getContractDefinition(assignment.definitionId)
  const complete = isContractComplete(assignment)
  const claimed = assignment.claimedAt !== null
  const shown = Math.min(assignment.progress, assignment.target)
  const percent = assignment.target > 0 ? Math.round((shown / assignment.target) * 100) : 0
  const name = definition?.name ?? assignment.definitionId
  const reward = definition?.reward ?? []
  return (
    <li
      className="contract-card"
      data-cadence={assignment.cadence}
      data-state={claimed ? 'claimed' : complete ? 'complete' : 'open'}
      aria-label={`${name}: ${claimed ? 'claimed' : complete ? 'ready to claim' : `${shown} of ${assignment.target}`}`}
    >
      <div className="contract-card-heading">
        <p className="screen-kicker">{definition ? describeContractPlace(definition.objective) : 'A contract'}</p>
        <h4>{name}</h4>
        <p className="contract-card-objective">
          {definition ? describeContractObjective(definition) : 'A contract this build cannot read.'}
        </p>
      </div>
      <div className="contract-card-progress">
        <div
          className="contract-progress-bar"
          role="progressbar"
          aria-label={`${name} progress`}
          aria-valuemin={0}
          aria-valuemax={assignment.target}
          aria-valuenow={shown}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className="contract-progress-figure">
          <strong>{shown}</strong> / {assignment.target}
        </span>
      </div>
      <ul className="contract-card-reward" aria-label="Reward">
        {reward.map((line) => (
          <li key={line.definitionId}>
            <span className="contract-reward-icon" aria-hidden="true">{getRewardIcon(line.definitionId)}</span>
            <span>{line.quantity} {itemName(line.definitionId)}</span>
          </li>
        ))}
      </ul>
      <div className="contract-card-foot">
        <small>{claimed ? 'Claimed' : formatTimeLeft(assignment.windowEnd, nowMs)}</small>
        <button
          className="primary-action contract-claim-action"
          type="button"
          onClick={onClaim}
          disabled={busy || claimed || !complete}
        >
          {claimed ? 'Claimed' : complete ? 'Claim' : 'In progress'}
        </button>
      </div>
    </li>
  )
}

interface ContractBoardProps {
  cadence: ContractCadence
  title: string
  lede: string
  state: ContractState
  nowMs: number
  busyAssignmentId: number | null
  onClaim: (assignment: ContractAssignment) => void
}

function ContractBoard({ cadence, title, lede, state, nowMs, busyAssignmentId, onClaim }: ContractBoardProps) {
  const contracts = getContractsByCadence(state, cadence)
  const first = contracts[0]
  return (
    <section className="app-panel contracts-board" aria-labelledby={`contracts-${cadence}-title`} data-cadence={cadence}>
      <header className="app-panel-heading">
        <div>
          <p className="screen-kicker">{lede}</p>
          <h3 id={`contracts-${cadence}-title`}>{title}</h3>
        </div>
        {first ? <span className="app-panel-meta">{formatTimeLeft(first.windowEnd, nowMs)}</span> : null}
      </header>
      {contracts.length === 0 ? (
        <p className="contracts-empty">Nothing on the board. It is dealt again when the period turns.</p>
      ) : (
        <ul className="contract-card-list">
          {contracts.map((assignment) => (
            <ContractCard
              key={assignment.assignmentId}
              assignment={assignment}
              nowMs={nowMs}
              busy={busyAssignmentId !== null}
              onClaim={() => onClaim(assignment)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export function ContractsScreen({ service, configurationError, onBack }: ContractsScreenProps) {
  const { showLootToast, showToast } = useToaster()
  const now = useNow(BOARD_TICK_MS)
  const [state, setState] = useState<ContractState | null>(null)
  const [loadState, setLoadState] = useState<LoadState>(() => service ? 'loading' : 'error')
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
          setError(loadError instanceof Error ? loadError.message : 'Unable to read the contract board.')
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
    setError(null)
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
    } catch (claimError: unknown) {
      const message = claimError instanceof Error ? claimError.message : 'Unable to claim that contract.'
      showToast(message, 'error')
      setError(message)
      // The board may have moved on; read it again rather than trust the card,
      // keeping the message so the player knows why the claim did not land.
      await service.loadState().then(setState).catch(() => undefined)
    } finally {
      setBusyAssignmentId(null)
    }
  }

  const nowMs = state ? serverNow(state, now) : now

  return (
    <section className="app-screen contracts-screen" aria-labelledby="contracts-title">
      <div className="app-screen-topbar">
        <button className="app-screen-back" type="button" onClick={onBack}>
          ← Back to the refuge
        </button>
      </div>
      <div className="app-screen-title">
        <p className="screen-kicker">The board by the gate</p>
        <h2 id="contracts-title">Contracts</h2>
        <p className="app-screen-lede">
          Three a day and one a week, drawn from what you can reach. Progress is counted from what
          the refuge already records, so play first and read the board after if you like. A contract
          pays in materials and boxes, never in Essence, and an unfinished one simply rotates away.
        </p>
      </div>
      {error ? <p className="persistence-error" role="alert">{error}</p> : null}
      <div className="app-screen-frame contracts-frame">
        {loadState === 'loading' ? (
          <p role="status">Reading the board…</p>
        ) : state ? (
          <div className="app-screen-panels contracts-panels">
            <ContractBoard
              cadence="daily"
              title="Today"
              lede="Daily contracts"
              state={state}
              nowMs={nowMs}
              busyAssignmentId={busyAssignmentId}
              onClaim={(assignment) => { void claim(assignment) }}
            />
            <ContractBoard
              cadence="weekly"
              title="This week"
              lede="Weekly contract"
              state={state}
              nowMs={nowMs}
              busyAssignmentId={busyAssignmentId}
              onClaim={(assignment) => { void claim(assignment) }}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
