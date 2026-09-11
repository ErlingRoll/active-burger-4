// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor } from '../testing/render'
import { DevelopmentChampionGenerator } from './DevelopmentChampionGenerator'
import { isCharacterBuildSnapshot, type CharacterService, type ChampionSnapshot } from './CharacterTypes'
import type { CreateDevelopmentChampionInput } from './CharacterTypes'

function createCharacterService() {
  const createDevelopmentChampion = vi.fn(async (input: CreateDevelopmentChampionInput): Promise<ChampionSnapshot> => ({
    championId: input.championId,
    name: input.name,
    sourceRunId: `development:${input.championId}`,
    contentVersion: input.contentVersion,
    build: input.build,
    exhaustionUntil: input.exhaustionHours > 0
      ? new Date(Date.now() + input.exhaustionHours * 3_600_000).toISOString()
      : null,
    archived: false,
    createdAt: '2026-09-11T00:00:00.000Z',
  }))
  return {
    service: { createDevelopmentChampion } as unknown as CharacterService,
    createDevelopmentChampion,
  }
}

describe('DevelopmentChampionGenerator', () => {
  it('creates a rested level 20 Champion with one click on the defaults', async () => {
    const { service, createDevelopmentChampion } = createCharacterService()
    const { user } = renderComponent(
      <DevelopmentChampionGenerator characterService={service} contentVersion="test" />,
    )

    await user.click(screen.getByRole('button', { name: 'Create random Champion' }))

    await waitFor(() => {
      expect(createDevelopmentChampion).toHaveBeenCalledTimes(1)
    })
    const [input] = createDevelopmentChampion.mock.calls[0]!
    expect(isCharacterBuildSnapshot(input.build)).toBe(true)
    expect(input.build.level).toBe(20)
    expect(input.exhaustionHours).toBe(0)
    expect(input.contentVersion).toBe('test')
    expect(input.name.length).toBeGreaterThan(0)
  })

  it('honours the class, the name and an exhaustion of a day', async () => {
    const { service, createDevelopmentChampion } = createCharacterService()
    const { user } = renderComponent(
      <DevelopmentChampionGenerator characterService={service} contentVersion="test" />,
    )

    await user.selectOptions(screen.getByLabelText('Class'), 'knight')
    await user.type(screen.getByLabelText('Name'), 'Sir Test')
    await user.click(screen.getByLabelText('Exhausted'))
    await user.click(screen.getByRole('button', { name: 'Create random Champion' }))

    await waitFor(() => {
      expect(createDevelopmentChampion).toHaveBeenCalledTimes(1)
    })
    const [input] = createDevelopmentChampion.mock.calls[0]!
    expect(input.build.classId).toBe('knight')
    expect(input.name).toBe('Sir Test')
    expect(input.exhaustionHours).toBe(24)
  })

  it('refuses an out-of-range level before calling the server', async () => {
    const { service, createDevelopmentChampion } = createCharacterService()
    const { user } = renderComponent(
      <DevelopmentChampionGenerator characterService={service} contentVersion="test" />,
    )

    const level = screen.getByLabelText('Level')
    await user.clear(level)
    await user.type(level, '999')
    await user.click(screen.getByRole('button', { name: 'Create random Champion' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Level must be a whole number')
    expect(createDevelopmentChampion).not.toHaveBeenCalled()
  })
})
