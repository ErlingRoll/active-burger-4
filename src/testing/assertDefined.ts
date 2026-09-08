/**
 * Assertion helpers for tests.
 *
 * Under `noUncheckedIndexedAccess` every array index and map lookup widens to
 * `T | undefined`. Tests that legitimately know an entry exists use these
 * helpers so the assumption fails loudly with a readable message instead of
 * being hidden behind a non-null assertion.
 *
 * This module is imported only by `*.test.ts` files and never reaches the
 * production bundle.
 */

/** Narrows away `undefined`/`null`, throwing a labelled error when absent. */
export function assertDefined<TValue>(
  value: TValue | undefined | null,
  label = 'value',
): TValue {
  if (value === undefined || value === null) {
    throw new Error(`Expected ${label} to be defined.`)
  }
  return value
}

/** Reads `values[index]`, throwing a labelled error when the entry is absent. */
export function definedAt<TValue>(
  values: readonly TValue[],
  index: number,
  label = 'entry',
): TValue {
  return assertDefined(values[index], `${label}[${index}]`)
}
