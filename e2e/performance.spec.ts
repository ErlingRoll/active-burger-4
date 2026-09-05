import { expect, test } from '@playwright/test'

interface RenderPerformanceSample {
  enemyCount: number
  meanMs: number
  p95Ms: number
  maxMs: number
}

test('reports Pixi enemy-rendering cost at 100, 200, and 500 enemies', async ({
  page,
}) => {
  await page.goto('/')

  const samples = await page.evaluate(async (): Promise<RenderPerformanceSample[]> => {
    const [{ createGame }, { PixiGame }] = await Promise.all([
      import('/src/game/Game.ts'),
      import('/src/rendering/PixiGame.ts'),
    ])

    const results: RenderPerformanceSample[] = []
    for (const enemyCount of [100, 200, 500]) {
      const game = createGame({
        seed: 20_260_905 + enemyCount,
        freeMovementEnabled: true,
      })
      for (let spawned = 0; spawned < enemyCount; spawned += 100) {
        game.spawnDebugEnemies(100)
      }
      game.state.player.skills = []

      const host = document.createElement('div')
      host.style.width = '1280px'
      host.style.height = '720px'
      document.body.appendChild(host)
      const pixi = new PixiGame(game)
      await pixi.initialize(host)

      const harness = pixi as unknown as {
        app: { ticker: { stop: () => void } }
        renderState: () => void
      }
      harness.app.ticker.stop()
      for (let tick = 0; tick < 10; tick += 1) {
        harness.renderState()
      }

      const measured: number[] = []
      for (let tick = 0; tick < 60; tick += 1) {
        const start = performance.now()
        harness.renderState()
        measured.push(performance.now() - start)
      }
      const sorted = [...measured].sort((left, right) => left - right)
      results.push({
        enemyCount,
        meanMs: measured.reduce((total, sample) => total + sample, 0) / measured.length,
        p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        maxMs: sorted.at(-1) ?? 0,
      })
      pixi.destroy()
      host.remove()
    }

    return results
  })

  console.info(`enemy-rendering-performance ${JSON.stringify(samples)}`)
  expect(samples).toHaveLength(3)
  expect(samples.every((sample) =>
    Number.isFinite(sample.meanMs) &&
    Number.isFinite(sample.p95Ms) &&
    Number.isFinite(sample.maxMs),
  )).toBe(true)
  expect(samples.find((sample) => sample.enemyCount === 500)?.p95Ms ?? Infinity)
    .toBeLessThan(16.7)
})
