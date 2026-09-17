export const SOURCE_DIRECTORY: string
export const TARGET_DIRECTORY: string
/** The modules that ship: every source file that is not a test. */
export function sourceModules(): string[]
export function expectedCopy(module: string): string
/** Modules whose copy differs from the source, plus any file in the copy that has no source. */
export function staleModules(): string[]
