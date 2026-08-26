import { useEffect, useRef } from 'react'
import {
  getUpgradeDefinition,
  type UpgradeChoice,
  type UpgradeId,
} from '../content/upgrades/Upgrades'

interface LevelUpOverlayProps {
  level: number
  choices: readonly UpgradeChoice[]
  onSelect: (upgradeId: UpgradeId) => void
}

export function LevelUpOverlay({
  level,
  choices,
  onSelect,
}: LevelUpOverlayProps) {
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstButtonRef.current?.focus()
  }, [choices])

  return (
    <section
      className="level-up-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-up-title"
    >
      <div className="level-up-panel">
        <p className="level-up-kicker">Upgrade available</p>
        <h2 id="level-up-title">Level {level}</h2>
        <p className="level-up-instructions">
          Choose one upgrade to continue the run.
        </p>
        <div className="upgrade-choice-list">
          {choices.map((choice, index) => {
            const definition = getUpgradeDefinition(choice.upgradeId)
            return (
              <button
                key={choice.upgradeId}
                ref={index === 0 ? firstButtonRef : undefined}
                className="upgrade-choice"
                type="button"
                onClick={() => onSelect(choice.upgradeId)}
              >
                <span className="upgrade-choice-name">{definition.name}</span>
                <span className="upgrade-choice-value">
                  {definition.valueLabel}
                </span>
                <span className="upgrade-choice-description">
                  {definition.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
