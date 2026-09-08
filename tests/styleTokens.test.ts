import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards the colour token layer.
 *
 * The stylesheets previously repeated a fixed palette as 1,280 hex literals, so
 * changing a shade meant a project-wide find and replace and nothing could
 * confirm a surface stayed within the documented palette. These tests keep the
 * tokens the single source of truth and stop unused ones accumulating.
 */

const projectRoot = path.resolve(import.meta.dirname, '..')
const tokensPath = path.join(projectRoot, 'src/styles/tokens.css')
const tokensSource = readFileSync(tokensPath, 'utf8')

function stylesheets(): string[] {
  const found: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const candidate = path.join(current, entry)
      if (statSync(candidate).isDirectory()) {
        walk(candidate)
      } else if (entry.endsWith('.css') && entry !== 'tokens.css') {
        found.push(candidate)
      }
    }
  }
  walk(path.join(projectRoot, 'src'))
  return found
}

const otherStyles = stylesheets()
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

function declaredTokens(): string[] {
  return [...tokensSource.matchAll(/^\s*(--[a-z0-9-]+):/gm)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
}

describe('colour tokens', () => {
  it('declares every token exactly once', () => {
    const names = declaredTokens()

    expect(names).toEqual([...new Set(names)])
  })

  it('has no unused tokens', () => {
    const unused = declaredTokens()
      .filter((name) => !otherStyles.includes(`var(${name})`))

    expect(unused).toEqual([])
  })

  it('defines each token as either a raw palette value or a reference to one', () => {
    const declarations = [...tokensSource.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)]

    expect(declarations.length).toBeGreaterThan(0)
    for (const [, name, value] of declarations) {
      const declaration = value?.trim() ?? ''
      // A palette token holds a literal colour; a semantic token names a role
      // and must resolve to a palette token rather than restating a value, so
      // that a shade is only ever written down once.
      const isLiteral = /^#[0-9a-fA-F]{3,8}$/.test(declaration)
      const isReference = declaration.startsWith('var(--')
      expect(isLiteral || isReference, `${name ?? ''}: ${declaration}`).toBe(true)
    }
  })

  it('keeps repeated colours in the token layer rather than as literals', () => {
    const counts = new Map<string, number>()
    for (const match of otherStyles.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const value = match[0].toLowerCase()
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    // A colour used more than twice is a decision, not a one-off, and belongs
    // in tokens.css where it can be changed in one place.
    const repeated = [...counts.entries()]
      .filter(([, count]) => count > 2)
      .map(([value, count]) => `${value} (${count} uses)`)

    expect(repeated).toEqual([])
  })
})
