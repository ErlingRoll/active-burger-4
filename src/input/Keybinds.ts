export interface GameKeybinds {
  behaviorAggressive: string
  behaviorBalanced: string
  behaviorCautious: string
  choiceLeft: string
  choiceMiddle: string
  choiceRight: string
  /** The fourth card, which only an artifact such as the Cartographer's Compass offers. */
  choiceFourth: string
  skipChoice: string
}

export type KeybindId = keyof GameKeybinds

export const FREE_MOVEMENT_TOGGLE_KEY = 'f'
export const FREE_MOVEMENT_KEYS = ['w', 'a', 's', 'd'] as const

export const DEFAULT_GAME_KEYBINDS: Readonly<GameKeybinds> = Object.freeze({
  behaviorAggressive: 'a',
  behaviorBalanced: 's',
  behaviorCautious: 'd',
  choiceLeft: '1',
  choiceMiddle: '2',
  choiceRight: '3',
  choiceFourth: '4',
  skipChoice: '5',
})

export const KEYBIND_DEFINITIONS = [
  {
    id: 'behaviorAggressive',
    label: 'Aggressive',
    description: 'Switch to the aggressive behavior profile.',
  },
  {
    id: 'behaviorBalanced',
    label: 'Balanced',
    description: 'Switch to the balanced behavior profile.',
  },
  {
    id: 'behaviorCautious',
    label: 'Cautious',
    description: 'Switch to the cautious behavior profile.',
  },
  {
    id: 'choiceLeft',
    label: 'First choice',
    description: 'Select the first level-up or gear choice.',
  },
  {
    id: 'choiceMiddle',
    label: 'Second choice',
    description: 'Select the second level-up or gear choice.',
  },
  {
    id: 'choiceRight',
    label: 'Third choice',
    description: 'Select the third level-up or gear choice.',
  },
  {
    id: 'choiceFourth',
    label: 'Fourth choice',
    description: 'Select the fourth level-up choice, when an artifact offers one.',
  },
  {
    id: 'skipChoice',
    label: 'Skip choice',
    description: 'Skip the current level-up or gear choice.',
  },
] as const satisfies ReadonlyArray<{
  id: KeybindId
  label: string
  description: string
}>

/** The choice keys in card order, so a card's key is its index in this list. */
export const CHOICE_KEYBIND_IDS = [
  'choiceLeft',
  'choiceMiddle',
  'choiceRight',
  'choiceFourth',
] as const satisfies readonly KeybindId[]

export function isChoiceKeybind(id: KeybindId): boolean {
  return CHOICE_KEYBIND_IDS.some((choiceId) => choiceId === id)
}

/** The keys that select each card, in the order the cards are laid out. */
export function getChoiceKeybinds(keybinds: Readonly<GameKeybinds>): string[] {
  return CHOICE_KEYBIND_IDS.map((id) => keybinds[id])
}

function isLegacyChoiceDefaults(
  candidate: Record<string, unknown>,
): boolean {
  return normalizeKey(candidate.choiceLeft) === 'q' &&
    normalizeKey(candidate.choiceMiddle) === 'w' &&
    normalizeKey(candidate.choiceRight) === 'e'
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  ' ': 'Space',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  arrowup: 'Up',
  backspace: 'Backspace',
  delete: 'Delete',
  enter: 'Enter',
  tab: 'Tab',
}

export function normalizeKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim().toLowerCase()
  if (trimmed.length === 0) {
    return value === ' ' ? 'space' : null
  }
  return trimmed.length <= 24 ? trimmed : null
}

export function formatKeybind(value: string): string {
  const normalized = normalizeKey(value)
  if (!normalized) {
    return '?'
  }
  if (normalized === 'space') {
    return 'Space'
  }
  return KEY_LABELS[normalized] ?? (
    normalized.length === 1 ? normalized.toUpperCase() : normalized
  )
}

export function normalizeGameKeybinds(value: unknown): GameKeybinds {
  const candidate = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {}
  const legacyChoiceDefaults = isLegacyChoiceDefaults(candidate)
  return KEYBIND_DEFINITIONS.reduce<GameKeybinds>((keybinds, definition) => {
    const key = normalizeKey(candidate[definition.id])
    const reservedForFreeMovement = isChoiceKeybind(definition.id) &&
      key !== null &&
      FREE_MOVEMENT_KEYS.some((movementKey) => movementKey === key)
    keybinds[definition.id] = legacyChoiceDefaults ||
      key === FREE_MOVEMENT_TOGGLE_KEY ||
      reservedForFreeMovement
      ? DEFAULT_GAME_KEYBINDS[definition.id]
      : key ?? DEFAULT_GAME_KEYBINDS[definition.id]
    return keybinds
  }, { ...DEFAULT_GAME_KEYBINDS })
}
