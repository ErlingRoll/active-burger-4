export interface ItemImplicitModifier {
  id: string
  label: string
  description: string
}

export const BOW_PRECISION_DAMAGE_INCREASE_PERCENT = 100
export const BOW_PRECISION_IMPLICIT_MODIFIER: ItemImplicitModifier = {
  id: 'bow-precision',
  label: 'Precision',
  description: `+${BOW_PRECISION_DAMAGE_INCREASE_PERCENT}% Basic Attack damage against the primary target.`,
}
