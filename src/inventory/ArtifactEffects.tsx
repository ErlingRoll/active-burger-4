import {
  describeArtifact,
  getArtifactBaseDefinition,
  type ArtifactMetadata,
} from '../content/artifacts/Artifacts'

/**
 * An artifact's card: the implicit first, then every rolled modifier, each
 * with its tier. Shared by the bag's tooltip, the stores inspector and the
 * run setup picker so the same artifact reads the same everywhere.
 */
interface ArtifactEffectListProps {
  metadata: ArtifactMetadata
  /** Whether to open with the base's flavour line. */
  showFlavor?: boolean
}

export function ArtifactEffectList({ metadata, showFlavor = false }: ArtifactEffectListProps) {
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
    </div>
  )
}
