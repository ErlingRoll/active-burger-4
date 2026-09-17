import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { staleModules, sourceModules } from '../scripts/sync-divine-gamba-sim.mjs'

/**
 * The simulation the Edge Function settles is the simulation the browser
 * animates.
 *
 * The Supabase CLI bundles only what is under supabase/functions/, so the
 * modules under src/divine-gamba/sim/ are copied there by
 * scripts/sync-divine-gamba-sim.mjs and committed. This holds the copy to the
 * source, and holds the source to the rules that let two V8s agree.
 */
const simDirectory = path.resolve(import.meta.dirname, '../src/divine-gamba/sim')

describe('the Divine Gamba simulation copy', () => {
  it('is current in supabase/functions/_shared', () => {
    expect(staleModules()).toEqual([])
  })

  it('ships more than one module', () => {
    expect(sourceModules().length).toBeGreaterThan(3)
  })
})

describe('the Divine Gamba simulation source', () => {
  const sources = sourceModules().map((module) => ({
    module,
    text: readFileSync(path.join(simDirectory, module), 'utf8'),
  }))

  it('uses only arithmetic every V8 rounds identically', () => {
    const forbidden = /Math\.(sin|cos|tan|atan2?|asin|acos|exp|log|pow|hypot|random|cbrt|sinh|cosh|tanh|expm1|log1p|log2|log10)\b|\bDate\b|\*\*/
    for (const { module, text } of sources) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
      expect(code, module).not.toMatch(forbidden)
    }
  })

  it('imports nothing from outside itself', () => {
    for (const { module, text } of sources) {
      for (const [, specifier] of text.matchAll(/from\s+'([^']+)'/g)) {
        expect(specifier, `${module} imports ${specifier}`).toMatch(/^\.\/[a-z]+\.ts$/)
      }
    }
  })
})
