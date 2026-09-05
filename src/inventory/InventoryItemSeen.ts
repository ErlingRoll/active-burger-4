import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'active-burger-4:seen-inventory-item-instance-ids'

type StoreListener = () => void

let seenItemInstanceIds: Set<string> | null = null
const listeners = new Set<StoreListener>()

function readStoredItemInstanceIds(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set()
  }

  let storedValue: string | null
  try {
    storedValue = window.localStorage.getItem(STORAGE_KEY)
  } catch (error: unknown) {
    console.warn('Unable to read seen inventory items from local storage.', error)
    return new Set()
  }
  if (storedValue === null) {
    return new Set()
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue)
    if (!Array.isArray(parsedValue) || !parsedValue.every((item): item is string => typeof item === 'string')) {
      console.warn('Seen inventory item storage contained an invalid value.')
      return new Set()
    }
    return new Set(parsedValue)
  } catch (error: unknown) {
    console.warn('Unable to parse seen inventory items from local storage.', error)
    return new Set()
  }
}

function getSeenItemInstanceIds(): Set<string> {
  seenItemInstanceIds ??= readStoredItemInstanceIds()
  return seenItemInstanceIds
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

function handleStorageChange(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) {
    return
  }
  seenItemInstanceIds = readStoredItemInstanceIds()
  notifyListeners()
}

function subscribe(listener: StoreListener): () => void {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageChange)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageChange)
    }
  }
}

function persistSeenItemInstanceIds(itemInstanceIds: Set<string>): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...itemInstanceIds]))
  } catch (error: unknown) {
    console.warn('Unable to persist seen inventory items to local storage.', error)
  }
}

export function markInventoryItemAsSeen(itemInstanceId: string): void {
  const currentIds = getSeenItemInstanceIds()
  if (currentIds.has(itemInstanceId)) {
    return
  }
  seenItemInstanceIds = new Set(currentIds).add(itemInstanceId)
  persistSeenItemInstanceIds(seenItemInstanceIds)
  notifyListeners()
}

export function useSeenInventoryItemIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSeenItemInstanceIds, getSeenItemInstanceIds)
}
