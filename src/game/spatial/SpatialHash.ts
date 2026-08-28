import type { EntityId } from '../ids'

export const DEFAULT_SPATIAL_HASH_CELL_SIZE = 128

interface SpatialEntry<T> {
  id: EntityId
  x: number
  y: number
  radius: number
  value: T
  minCellX: number
  maxCellX: number
  minCellY: number
  maxCellY: number
}

/**
 * A small broad-phase index for circular entities.
 *
 * Entries are indexed by the cells touched by their bounding box. Queries
 * return broad-phase candidates, in stable EntityId order; callers must retain
 * their exact distance checks.
 */
export class SpatialHash<T> {
  private readonly cells = new Map<string, SpatialEntry<T>[]>()
  private readonly entries = new Map<EntityId, SpatialEntry<T>>()
  private readonly cellSize: number

  constructor(cellSize = DEFAULT_SPATIAL_HASH_CELL_SIZE) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new RangeError('Spatial hash cell size must be positive and finite.')
    }
    this.cellSize = cellSize
  }

  clear(): void {
    this.cells.clear()
    this.entries.clear()
  }

  insert(
    id: EntityId,
    x: number,
    y: number,
    radius: number,
    value: T,
  ): void {
    if (
      !Number.isFinite(id) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(radius)
    ) {
      throw new RangeError('Spatial hash entries must contain finite values.')
    }

    const normalizedRadius = Math.max(0, radius)
    const existing = this.entries.get(id)
    if (existing) {
      this.removeFromCells(existing)
    }

    const entry: SpatialEntry<T> = {
      id,
      x,
      y,
      radius: normalizedRadius,
      value,
      minCellX: this.cellFor(x - normalizedRadius),
      maxCellX: this.cellFor(x + normalizedRadius),
      minCellY: this.cellFor(y - normalizedRadius),
      maxCellY: this.cellFor(y + normalizedRadius),
    }

    this.entries.set(id, entry)
    this.addToCells(entry)
  }

  /**
   * Returns entries whose indexed bounds may overlap the query circle.
   * Results are deduplicated and sorted by EntityId for deterministic
   * consumers, but are not exact collision results.
   */
  queryRadius(x: number, y: number, radius: number): T[] {
    return this.queryRadiusInternal(x, y, radius, true)
  }

  /**
   * Returns the same broad-phase candidates as queryRadius without sorting.
   * This is useful when callers only need to aggregate or filter results.
   */
  queryRadiusUnsorted(x: number, y: number, radius: number): T[] {
    return this.queryRadiusInternal(x, y, radius, false)
  }

  private queryRadiusInternal(
    x: number,
    y: number,
    radius: number,
    sortResults: boolean,
  ): T[] {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Number.isNaN(radius) ||
      radius < 0
    ) {
      return []
    }

    if (radius === Number.POSITIVE_INFINITY) {
      const entries = [...this.entries.values()]
      if (sortResults) {
        entries.sort((left, right) => left.id - right.id)
      }
      return entries
        .map((entry) => entry.value)
    }

    const minCellX = this.cellFor(x - radius)
    const maxCellX = this.cellFor(x + radius)
    const minCellY = this.cellFor(y - radius)
    const maxCellY = this.cellFor(y + radius)
    const candidateIds = new Set<EntityId>()

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const entries = this.cells.get(this.keyFor(cellX, cellY))
        if (!entries) {
          continue
        }
        for (const entry of entries) {
          candidateIds.add(entry.id)
        }
      }
    }

    const ids = [...candidateIds]
    if (sortResults) {
      ids.sort((left, right) => left - right)
    }
    return ids
      .map((id) => this.entries.get(id))
      .filter((entry): entry is SpatialEntry<T> => entry !== undefined)
      .map((entry) => entry.value)
  }

  get cellCount(): number {
    return this.cells.size
  }

  private cellFor(coordinate: number): number {
    return Math.floor(coordinate / this.cellSize)
  }

  private keyFor(cellX: number, cellY: number): string {
    return `${cellX}:${cellY}`
  }

  private addToCells(entry: SpatialEntry<T>): void {
    for (let cellY = entry.minCellY; cellY <= entry.maxCellY; cellY += 1) {
      for (let cellX = entry.minCellX; cellX <= entry.maxCellX; cellX += 1) {
        const key = this.keyFor(cellX, cellY)
        const entries = this.cells.get(key)
        if (entries) {
          entries.push(entry)
        } else {
          this.cells.set(key, [entry])
        }
      }
    }
  }

  private removeFromCells(entry: SpatialEntry<T>): void {
    for (let cellY = entry.minCellY; cellY <= entry.maxCellY; cellY += 1) {
      for (let cellX = entry.minCellX; cellX <= entry.maxCellX; cellX += 1) {
        const key = this.keyFor(cellX, cellY)
        const entries = this.cells.get(key)
        if (!entries) {
          continue
        }
        const index = entries.indexOf(entry)
        if (index >= 0) {
          entries.splice(index, 1)
        }
        if (entries.length === 0) {
          this.cells.delete(key)
        }
      }
    }
  }
}
