import { useId, useState } from 'react'
import { ARTIFACT_BASE_DEFINITIONS, type ArtifactMetadata } from '../content/artifacts/Artifacts'
import { RARITY_VISUALS } from '../content/rarity/Rarity'
import { ArtifactEffectList, ArtifactPotential } from '../inventory/ArtifactEffects'
import { countHeldQuantity } from '../inventory/CraftingRecipes'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import type { InventoryItemInstance } from '../inventory/InventoryTypes'
import { EssenceAmount } from '../ui/EssenceMark'
import {
  FORGE_ESSENCE_CAP,
  FORGE_FEES,
  FORGE_POTENTIAL_COST,
  clampForgeStake,
  describeForgeOutcomes,
  forgeFeeAsCost,
  formatBasisPoints,
  isArtifactFinished,
  listForgeTargets,
  type ForgeTarget,
} from './Forge'

/**
 * The bench: one artifact on the anvil, the line the player wants raised,
 * the Essence they are willing to risk on it, and the odds of each way the
 * strike can go, all read before the hammer comes down. The odds are the
 * server's own arithmetic, so what is promised here is what is rolled.
 */
interface ForgeBenchProps {
  artifact: ArtifactMetadata
  held: readonly InventoryItemInstance[]
  /** The wallet, or null when it could not be read; a null wallet allows no stake. */
  essenceBalance: number | null
  busy: boolean
  onStrike: (target: ForgeTarget, essence: number) => void
  onBack: () => void
}

/** The stake slider moves in steps a player can reason about. */
const STAKE_STEP = 500

export function ForgeBench({ artifact, held, essenceBalance, busy, onStrike, onBack }: ForgeBenchProps) {
  const id = useId()
  const base = ARTIFACT_BASE_DEFINITIONS[artifact.baseId]
  const targets = listForgeTargets(artifact)
  const [chosenTarget, setChosenTarget] = useState<ForgeTarget | null>(null)
  const [stake, setStake] = useState(0)
  const target = targets.some((option) => option.target === chosenTarget)
    ? chosenTarget
    : targets[0]?.target ?? null
  const stakeCap = Math.min(FORGE_ESSENCE_CAP, Math.max(0, essenceBalance ?? 0))
  const essence = Math.min(clampForgeStake(stake), stakeCap)
  const fee = FORGE_FEES[artifact.rarity]
  const cost = forgeFeeAsCost(fee)
  const affordable = Object.entries(cost).every(([definitionId, quantity]) => countHeldQuantity(held, definitionId) >= quantity)
  const finished = isArtifactFinished(artifact)
  const outcomes = target ? describeForgeOutcomes(artifact, target, essence) : null
  const canStrike = !busy && !finished && affordable && target !== null && essenceBalance !== null

  return (
    <div className="forge-bench" role="group" aria-label={`Work ${base.name}`}>
      <div className="forge-bench-head">
        <strong>{base.name}</strong>
        <span>{RARITY_VISUALS[artifact.rarity].label}</span>
        <ArtifactPotential metadata={artifact} />
      </div>
      <ArtifactEffectList metadata={artifact} showPotential={false} />

      {finished ? (
        <p className="forge-bench-note">
          Its Potential is spent. Whatever it became, it is what it is now.
        </p>
      ) : (
        <>
          <fieldset className="forge-targets">
            <legend>Work toward</legend>
            {targets.length === 0 ? (
              <p className="forge-bench-note">Every line is at its best tier already.</p>
            ) : targets.map((option) => (
              <label key={option.target} className="forge-target">
                <input
                  type="radio"
                  name={`${id}-target`}
                  value={option.target}
                  checked={target === option.target}
                  onChange={() => setChosenTarget(option.target)}
                  disabled={busy}
                />
                <span>{option.label}</span>
                {option.tier !== null && option.nextTier !== null ? (
                  <em>T{option.tier} → T{option.nextTier}</em>
                ) : null}
              </label>
            ))}
          </fieldset>

          <div className="forge-stake">
            <label htmlFor={`${id}-stake`}>
              Stake <EssenceAmount value={essence} />
              <small>of {stakeCap.toLocaleString()} you can spare, {FORGE_ESSENCE_CAP.toLocaleString()} at most</small>
            </label>
            <input
              id={`${id}-stake`}
              type="range"
              min={0}
              max={stakeCap}
              step={Math.min(STAKE_STEP, Math.max(1, stakeCap))}
              value={essence}
              onChange={(event) => setStake(Number(event.currentTarget.value))}
              disabled={busy || stakeCap === 0}
            />
            <input
              className="forge-stake-number"
              type="number"
              inputMode="numeric"
              min={0}
              max={stakeCap}
              step={1}
              value={essence}
              aria-label="Essence to stake"
              onChange={(event) => setStake(Number(event.currentTarget.value))}
              disabled={busy || stakeCap === 0}
            />
          </div>

          {outcomes ? (
            <dl className="forge-odds" aria-label="Odds of each outcome">
              <div data-outcome="target"><dt>Lands where aimed</dt><dd>{formatBasisPoints(outcomes.target)}</dd></div>
              <div data-outcome="stray"><dt>Lands elsewhere</dt><dd>{formatBasisPoints(outcomes.stray)}</dd></div>
              <div data-outcome="miss"><dt>Misses</dt><dd>{formatBasisPoints(outcomes.miss)}</dd></div>
              <div data-outcome="setback"><dt>Misses and a line slips</dt><dd>{formatBasisPoints(outcomes.setback)}</dd></div>
            </dl>
          ) : null}

          <p className="forge-bench-note">
            A strike that lands spends {FORGE_POTENTIAL_COST.landed.min} to {FORGE_POTENTIAL_COST.landed.max} Potential;
            one that misses spends {FORGE_POTENTIAL_COST.missed.min} to {FORGE_POTENTIAL_COST.missed.max}.
            The fee and the stake are spent either way.
          </p>

          <div className="forge-fee">
            <span className="camp-cost">
              {Object.entries(cost).map(([definitionId, quantity]) => (
                <span key={definitionId} data-short={countHeldQuantity(held, definitionId) < quantity ? 'true' : undefined}>
                  {quantity} {getInventoryItemDefinition(definitionId)?.name ?? definitionId}
                </span>
              ))}
            </span>
          </div>
        </>
      )}

      <div className="forge-bench-actions">
        <button className="camp-picker-cancel" type="button" onClick={onBack} disabled={busy}>
          Back
        </button>
        {!finished ? (
          <button
            className="camp-send-action"
            type="button"
            onClick={() => { if (target) onStrike(target, essence) }}
            disabled={!canStrike}
            aria-label={`Strike ${base.name}`}
          >
            Strike
          </button>
        ) : null}
      </div>
    </div>
  )
}
