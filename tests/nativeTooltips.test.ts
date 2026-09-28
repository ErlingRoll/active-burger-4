import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * No native tooltips.
 *
 * A `title` attribute on a DOM element is the browser's own tooltip: unstyled,
 * a second late, and never shown on a phone, which is a target platform. The
 * project's hints go through `HoverTooltip` (`HintHover` for a one-liner),
 * which styles the card, portals it out of clipped panels, closes on Escape
 * with every other tooltip and opens on a tap. This reads every component
 * file for a `title=` on a lowercase, that is native, JSX element, so a
 * generated `<button title="…">` fails the build instead of waiting for a
 * review. A `title` prop on a component (`<ConfirmationDialog title=…>`) is
 * that component's business and passes.
 *
 * `src/testing/setup.ts` checks the rendered DOM after every component spec
 * for the cases a source scan cannot see, such as a `title` arriving through
 * a props spread.
 */

const projectRoot = path.resolve(import.meta.dirname, '..')

function componentFiles(directory: string): string[] {
  const found: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const candidate = path.join(current, entry)
      if (statSync(candidate).isDirectory()) {
        walk(candidate)
      } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
        found.push(candidate)
      }
    }
  }
  walk(path.join(projectRoot, directory))
  return found
}

interface NativeTitle {
  file: string
  line: number
  element: string
}

/**
 * Walks each opening tag of a native element to its closing `>`, tracking
 * JSX expression braces and string quotes so a ternary or a style object
 * inside an attribute does not end the tag early, and reports the tag when
 * its attribute text carries a `title=`.
 */
function nativeTitlesIn(file: string): NativeTitle[] {
  const source = readFileSync(file, 'utf8')
  const found: NativeTitle[] = []
  const OPENING_TAG = /<([a-z][\w-]*)(?=[\s/>])/g
  for (const match of source.matchAll(OPENING_TAG)) {
    const element = match[1] ?? ''
    let index = match.index + match[0].length
    let depth = 0
    let quote: string | null = null
    let attributes = ''
    while (index < source.length) {
      const character = source[index] ?? ''
      if (quote !== null) {
        if (character === quote) {
          quote = null
        }
      } else if (character === '"' || character === "'" || character === '`') {
        quote = character
      } else if (character === '{') {
        depth += 1
      } else if (character === '}') {
        depth -= 1
      } else if (character === '>' && depth === 0) {
        break
      }
      attributes += character
      index += 1
    }
    if (/(^|\s)title=/.test(attributes)) {
      const line = source.slice(0, match.index).split('\n').length
      found.push({
        file: path.relative(projectRoot, file).split(path.sep).join('/'),
        line,
        element,
      })
    }
  }
  return found
}

describe('native tooltips', () => {
  it('are not used: every hint goes through the shared HoverTooltip', () => {
    const offenders = componentFiles('src')
      .flatMap(nativeTitlesIn)
      .map(({ file, line, element }) => `${file}:${line} <${element} title=…>`)

    expect(offenders).toEqual([])
  })
})
