/**
 * Array helpers that keep `noUncheckedIndexedAccess` honest.
 *
 * Registries such as the rarity ladder and the fish drop table are declared as
 * literals and are structurally guaranteed to hold at least one entry, but the
 * compiler cannot prove that `values[values.length - 1]` is defined. Constraining
 * the parameter to a non-empty tuple moves that guarantee into the type system
 * instead of suppressing it with a cast or a non-null assertion.
 */

/** A readonly array the compiler knows holds at least one element. */
export type NonEmptyArray<T> = readonly [T, ...T[]]

/**
 * Returns the final element of a non-empty array.
 *
 * The generic is constrained to the tuple rather than its element type so that
 * heterogeneous literal tuples (`as const` registries) widen to the union of
 * their members instead of collapsing onto the first entry's type.
 */
export function lastElement<TValues extends NonEmptyArray<unknown>>(
  values: TValues,
): TValues[number] {
  const [first] = values
  return values.at(-1) ?? first
}
