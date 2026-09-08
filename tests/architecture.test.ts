import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Executable architecture rules.
 *
 * PLAN.md states two dependency rules that nothing enforced: the simulation
 * must not depend on React, PixiJS, Supabase, Dexie, or the DOM, and the
 * content/config layering must be one-directional. Both had drifted. These
 * tests read the import graph so a regression fails the build rather than
 * waiting to be noticed in a review.
 */

const projectRoot = path.resolve(import.meta.dirname, '..')

function sourceFiles(directory: string): string[] {
  const absolute = path.join(projectRoot, directory)
  const found: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const candidate = path.join(current, entry)
      if (statSync(candidate).isDirectory()) {
        walk(candidate)
      } else if (/\.tsx?$/.test(entry)) {
        found.push(candidate)
      }
    }
  }
  walk(absolute)
  return found
}

function relative(file: string): string {
  return path.relative(projectRoot, file).split(path.sep).join('/')
}

interface ModuleImport {
  file: string
  specifier: string
  typeOnly: boolean
}

const IMPORT_PATTERN =
  /(?:^|\n)\s*(?:import|export)\s+([^'"\n;]*?)\s*from\s*['"]([^'"]+)['"]/g

function importsOf(file: string): ModuleImport[] {
  const source = readFileSync(file, 'utf8')
  const results: ModuleImport[] = []
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const clause = match[1] ?? ''
    const specifier = match[2] ?? ''
    const braced = clause.match(/^\{([\s\S]*)\}$/)
    const bracedNames = braced
      ? (braced[1] ?? '').split(',').map((name: string) => name.trim()).filter(Boolean)
      : []
    const typeOnly =
      /^type\s/.test(clause) ||
      (bracedNames.length > 0 && bracedNames.every((name: string) => /^type\s/.test(name)))
    results.push({ file: relative(file), specifier, typeOnly })
  }
  return results
}

function resolveRelative(file: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) {
    return null
  }
  const base = path.resolve(path.dirname(file), specifier)
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    base,
  ]
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) {
        return relative(candidate)
      }
    } catch {
      continue
    }
  }
  return null
}

const PRODUCTION_FILE = (file: string): boolean => !/\.test\.tsx?$/.test(file)

describe('simulation independence', () => {
  const simulationFiles = sourceFiles('src/game').filter(PRODUCTION_FILE)

  it.each([
    'react',
    'react-dom',
    'pixi.js',
    'dexie',
    '@supabase/supabase-js',
  ])('does not let src/game import %s', (packageName) => {
    const offenders = simulationFiles
      .flatMap(importsOf)
      .filter((entry) => entry.specifier === packageName)
      .map((entry) => entry.file)

    expect(offenders).toEqual([])
  })

  it('does not let src/game reach upward into a feature module', () => {
    const allowedPrefixes = ['src/game/', 'src/content/', 'src/game-config/', 'src/shared/']
    const offenders = simulationFiles.flatMap((file) =>
      importsOf(file)
        .map((entry) => ({ ...entry, target: resolveRelative(file, entry.specifier) }))
        .filter((entry) =>
          entry.target !== null &&
          !allowedPrefixes.some((prefix) => entry.target?.startsWith(prefix)),
        )
        .map((entry) => `${entry.file} -> ${entry.target ?? entry.specifier}`),
    )

    expect(offenders).toEqual([])
  })
})

describe('content and configuration layering', () => {
  it('keeps src/content free of imports from src/game', () => {
    const offenders = sourceFiles('src/content')
      .filter(PRODUCTION_FILE)
      .flatMap((file) =>
        importsOf(file)
          .map((entry) => ({ ...entry, target: resolveRelative(file, entry.specifier) }))
          .filter((entry) => entry.target?.startsWith('src/game/') === true)
          .map((entry) => `${entry.file} -> ${entry.target ?? entry.specifier}`),
      )

    expect(offenders).toEqual([])
  })
})

describe('import cycles', () => {
  it('has none', () => {
    const files = [...sourceFiles('src')]
    const graph = new Map<string, string[]>()
    for (const file of files) {
      const dependencies = importsOf(file)
        .map((entry) => resolveRelative(file, entry.specifier))
        .filter((target): target is string => target !== null)
      graph.set(relative(file), [...new Set(dependencies)])
    }

    const state = new Map<string, 'visiting' | 'done'>()
    const stack: string[] = []
    const cycles: string[] = []
    const visit = (node: string): void => {
      state.set(node, 'visiting')
      stack.push(node)
      for (const dependency of graph.get(node) ?? []) {
        if (state.get(dependency) === 'visiting') {
          cycles.push([...stack.slice(stack.indexOf(dependency)), dependency].join(' -> '))
        } else if (!state.has(dependency)) {
          visit(dependency)
        }
      }
      stack.pop()
      state.set(node, 'done')
    }
    for (const node of [...graph.keys()].sort()) {
      if (!state.has(node)) {
        visit(node)
      }
    }

    expect(cycles).toEqual([])
  })
})
