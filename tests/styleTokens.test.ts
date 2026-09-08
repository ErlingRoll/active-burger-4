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

const CHANNEL_TRIPLET = /^\d{1,3} \d{1,3} \d{1,3}$/

/**
 * The palette expressed as space-separated RGB channels.
 *
 * A screen accent is declared as channels rather than a colour so that lines,
 * washes and glows can be composed from it at the point of use with an alpha —
 * `rgb(var(--accent-rgb) / 26%)`. That is the one place a shade is written in a
 * form other than its hex, so the channels are checked back against the palette
 * here instead of being taken on trust.
 */
function paletteChannels(): Map<string, string> {
  const channels = new Map<string, string>()
  for (const match of tokensSource.matchAll(/^\s*(--color-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/gm)) {
    const [, name, hex] = match
    if (name === undefined || hex === undefined) {
      continue
    }
    const triplet = [1, 3, 5]
      .map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
      .join(' ')
    channels.set(triplet, name)
  }
  return channels
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
      const isChannels = CHANNEL_TRIPLET.test(declaration)
      expect(isLiteral || isReference || isChannels, `${name ?? ''}: ${declaration}`).toBe(true)
    }
  })

  it('writes channel tokens as channels of a colour that is in the palette', () => {
    const channels = paletteChannels()
    const declarations = [...tokensSource.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)]
      .map(([, name, value]) => [name ?? '', value?.trim() ?? ''] as const)
      .filter(([, value]) => CHANNEL_TRIPLET.test(value))

    expect(declarations.length).toBeGreaterThan(0)
    for (const [name, value] of declarations) {
      expect(channels.has(value), `${name}: ${value} is not a palette colour`).toBe(true)
      expect(name.endsWith('-rgb'), `${name} holds channels and must be named -rgb`).toBe(true)
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
