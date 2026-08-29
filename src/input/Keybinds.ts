export interface GameKeybinds {
  behaviorAggressive: string
  behaviorBalanced: string
  behaviorCautious: string
  choiceLeft: string
  choiceMiddle: string
  choiceRight: string
}

export type KeybindId = keyof GameKeybinds

export const DEFAULT_GAME_KEYBINDS: Readonly<GameKeybinds> = Object.freeze({
  behaviorAggressive: 'a',
  behaviorBalanced: 's',
  behaviorCautious: 'd',
  choiceLeft: 'q',
  choiceMiddle: 'w',
  choiceRight: 'e',
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
    label: 'Left choice',
    description: 'Select the leftmost level-up or gear choice.',
  },
  {
    id: 'choiceMiddle',
    label: 'Middle choice',
    description: 'Select the middle level-up or gear choice.',
  },
  {
    id: 'choiceRight',
    label: 'Right choice',
    description: 'Select the rightmost level-up or gear choice.',
  },
] as const satisfies ReadonlyArray<{
  id: KeybindId
  label: string
  description: string
}>

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
  return KEYBIND_DEFINITIONS.reduce<GameKeybinds>((keybinds, definition) => {
    const key = normalizeKey(candidate[definition.id])
    keybinds[definition.id] = key ?? DEFAULT_GAME_KEYBINDS[definition.id]
    return keybinds
  }, { ...DEFAULT_GAME_KEYBINDS })
}
