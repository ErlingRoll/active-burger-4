import {
  describeArtifact,
  getArtifactBaseDefinition,
  getArtifactPotential,
  type ArtifactMetadata,
} from '../content/artifacts/Artifacts'

/**
 * An artifact's card: the implicit first, then every rolled modifier, each
 * with its tier, and under them the Potential the Forge has left to work
 * with. Shared by the bag's tooltip, the stores inspector and the run setup
 * picker so the same artifact reads the same everywhere.
 */
interface ArtifactEffectListProps {
  metadata: ArtifactMetadata
  /** Whether to open with the base's flavour line. */
  showFlavor?: boolean
  /** Whether to close with the Potential line. On by default; the Forge's own bench draws its own. */
  showPotential?: boolean
}

/** The Potential line on its own, for anywhere the card is not drawn whole. */
export function ArtifactPotential({ metadata }: { metadata: ArtifactMetadata }) {
  const potential = getArtifactPotential(metadata)
  const finished = potential < 1
  return (
    <p
      className="artifact-potential"
      data-finished={finished ? 'true' : 'false'}
      title={finished
        ? 'Its Potential is spent: the Forge can do no more with it.'
        : 'How much the Forge can still work it. Every strike spends some.'}
    >
      {finished ? 'Finished' : `Potential ${potential}`}
    </p>
  )
}

export function ArtifactEffectList({ metadata, showFlavor = false, showPotential = true }: ArtifactEffectListProps) {
  const base = getArtifactBaseDefinition(metadata.baseId)
  return (
    <div className="artifact-effects">
      {showFlavor && base ? (
        <p className="artifact-effects-flavor">{base.flavorText}</p>
      ) : null}
      <ul className="artifact-effects-list">
        {describeArtifact(metadata).map((line) => (
          <li
            key={line.id}
            className="artifact-effect"
            data-kind={line.kind}
            data-tier={line.tier}
          >
            <span className="artifact-effect-text">{line.text}</span>
            <span className="artifact-effect-tier" title={`Tier ${line.tier} of 5, tier 1 is best`}>
              T{line.tier}
            </span>
          </li>
        ))}
      </ul>
      {showPotential ? <ArtifactPotential metadata={metadata} /> : null}
    </div>
  )
}
