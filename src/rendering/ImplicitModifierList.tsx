import type { ItemImplicitModifier } from '../content/gear/Items'
import { KeywordText } from './KeywordTooltip'

export function ImplicitModifierList({
  modifiers,
}: {
  modifiers: readonly ItemImplicitModifier[]
}) {
  if (modifiers.length === 0) {
    return null
  }
  return (
    <>
      <span className="gear-implicit-heading">Implicit</span>
      <ul className="implicit-modifier-list">
        {modifiers.map((modifier) => (
          <li key={modifier.id}>
            <strong>{modifier.label}</strong>
            <KeywordText text={modifier.description} />
          </li>
        ))}
      </ul>
    </>
  )
}
