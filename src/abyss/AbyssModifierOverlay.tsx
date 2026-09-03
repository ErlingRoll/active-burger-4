import type { AbyssModifierDefinition } from './AbyssModifiers'
import type { AbyssModifierChoiceFlow } from '../game/choices/ChoiceFlows'

interface AbyssModifierOverlayProps {
  flow: Readonly<AbyssModifierChoiceFlow>
  onSelect: (modifierId: AbyssModifierDefinition['id']) => void
}

export function AbyssModifierOverlay({
  flow,
  onSelect,
}: AbyssModifierOverlayProps) {
  return (
    <>
      <div className="level-up-overlay" aria-hidden="true" />
      <section
        className="level-up-dialog abyss-modifier-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="abyss-modifier-title"
        tabIndex={-1}
      >
        <div className="level-up-panel">
          <p className="level-up-kicker">Abyss floor {flow.floor} complete</p>
          <h2 id="abyss-modifier-title">Choose the next danger</h2>
          <p className="level-up-instructions">
            Select one persistent enemy modifier. It remains active for the rest of this attempt.
          </p>
          <div className="upgrade-choice-list">
            {flow.choices.map((choice) => (
              <button
                className="abyss-modifier-choice"
                type="button"
                key={choice.modifierId}
                onClick={() => onSelect(choice.modifierId)}
              >
                <span>
                  <strong>{choice.name}</strong>
                  <small>{choice.description}</small>
                </span>
                <em>Danger +{choice.dangerScore}</em>
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
