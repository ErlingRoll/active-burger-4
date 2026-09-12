// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, within } from '../testing/render'
import { CollectionsScreen } from './CollectionsScreen'
import type { CollectionService } from './CollectionService'
import type { CollectionState } from '../content/collections/Collections'

const STATE: CollectionState = {
  fish: [
    { definitionId: 'river-minnow', catches: 4, bestRarity: 'uncommon', recordSizePercentile: 1 },
    { definitionId: 'lantern-pike', catches: 1, bestRarity: 'rare', recordSizePercentile: 0 },
  ],
  artifacts: [
    { definitionId: 'artifact-ember-reliquary', found: 2, bestRarity: 'epic' },
  ],
  classes: [
    { classId: 'knight', victories: 3, deepestAbyssFloor: 14 },
    { classId: 'ranger', victories: 0, deepestAbyssFloor: 6 },
  ],
}

function fakeService(state: CollectionState = STATE): CollectionService {
  return { loadState: vi.fn(async () => state) }
}

describe('CollectionsScreen', () => {
  it('shows every page with what has been found and what has not', async () => {
    renderComponent(<CollectionsScreen service={fakeService()} configurationError={null} onBack={() => {}} />)

    const fish = await screen.findByRole('region', { name: 'Fish' })
    expect(within(fish).getByText('2 / 10 species')).toBeVisible()
    const minnow = within(fish).getByRole('listitem', { name: 'River Minnow: found' })
    expect(within(minnow).getByText('River Minnow')).toBeVisible()
    expect(within(minnow).getByText(/4 catches · Best Uncommon · Record 0\.18 kg/)).toBeVisible()
    const trout = within(fish).getByRole('listitem', { name: 'Glassfin Trout: not yet found' })
    expect(within(trout).getByText('???')).toBeVisible()

    const artifacts = screen.getByRole('region', { name: 'Artifacts' })
    expect(within(artifacts).getByText('1 / 5 relics')).toBeVisible()
    expect(within(artifacts).getByText(/2 found · Best Epic/)).toBeVisible()

    const champions = screen.getByRole('region', { name: 'Champions' })
    expect(within(champions).getByText('1 / 8 classes')).toBeVisible()
    const knight = within(champions).getByRole('listitem', { name: 'Knight: cleared with' })
    expect(within(knight).getByText(/3 victories · Abyss floor 14/)).toBeVisible()
    // A class taken into the Abyss but never to a dungeon victory is not cleared with.
    const ranger = within(champions).getByRole('listitem', { name: 'Ranger: not yet cleared with' })
    expect(within(ranger).getByText(/0 victories · Abyss floor 6/)).toBeVisible()
  })

  it('lists each page’s milestones, ticking the ones reached', async () => {
    renderComponent(<CollectionsScreen service={fakeService()} configurationError={null} onBack={() => {}} />)

    const fishMilestones = await screen.findByRole('list', { name: 'Fish milestones' })
    const rows = within(fishMilestones).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveAttribute('data-reached', 'true')
    expect(within(rows[0]!).getByText('A minnow in a jar on the sill.')).toBeVisible()
    expect(rows[1]).toHaveAttribute('data-reached', 'false')
    expect(within(rows[1]!).getByText('5 species for a display in the Trophy hall')).toBeVisible()
  })

  it('reads an empty account as pages with nothing found', async () => {
    renderComponent(
      <CollectionsScreen service={fakeService({ fish: [], artifacts: [], classes: [] })} configurationError={null} onBack={() => {}} />,
    )
    const fish = await screen.findByRole('region', { name: 'Fish' })
    expect(within(fish).getByText('0 / 10 species')).toBeVisible()
    expect(within(fish).getAllByText('???')).toHaveLength(10)
  })

  it('explains itself when the service is missing or the read fails', async () => {
    renderComponent(<CollectionsScreen service={null} configurationError="Supabase is not configured." onBack={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Supabase is not configured.')

    const failing: CollectionService = { loadState: vi.fn(async () => { throw new Error('The cases are locked.') }) }
    renderComponent(<CollectionsScreen service={failing} configurationError={null} onBack={() => {}} />)
    expect(await screen.findByText('The cases are locked.')).toBeVisible()
  })

  it('goes back when asked', async () => {
    const onBack = vi.fn()
    const { user } = renderComponent(<CollectionsScreen service={fakeService()} configurationError={null} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: /Back to the refuge/ }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
