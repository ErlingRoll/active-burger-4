// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor } from '../testing/render'
import { DevelopmentEssenceGrant } from './DevelopmentEssenceGrant'
import type { MetaProgressionService } from './MetaProgressionService'

function fakeService(grant: (amount: number) => Promise<number>): MetaProgressionService {
  return { grantDevelopmentEssence: vi.fn(grant) } as unknown as MetaProgressionService
}

/** The section's own error line, as opposed to the toaster's copy of it. */
function sectionAlert(): HTMLElement {
  const alert = screen.getAllByRole('alert').find((element) => element.classList.contains('development-inventory-error'))
  if (alert === undefined) {
    throw new Error('The section shows no error.')
  }
  return alert
}

describe('DevelopmentEssenceGrant', () => {
  it('grants a quick amount and tells the app the wallet changed', async () => {
    const service = fakeService(async (amount) => 1000 + amount)
    const onGranted = vi.fn()
    const { user } = renderComponent(<DevelopmentEssenceGrant metaService={service} onGranted={onGranted} />)
    await user.click(screen.getByRole('button', { name: '+1,000 Essence' }))
    await waitFor(() => expect(onGranted).toHaveBeenCalledTimes(1))
    expect(service.grantDevelopmentEssence).toHaveBeenCalledWith(1000)
  })

  it('grants the typed amount', async () => {
    const service = fakeService(async (amount) => amount)
    const { user } = renderComponent(<DevelopmentEssenceGrant metaService={service} onGranted={vi.fn()} />)
    const input = screen.getByLabelText('Amount')
    await user.clear(input)
    await user.type(input, '2500')
    await user.click(screen.getByRole('button', { name: 'Grant Essence' }))
    await waitFor(() => expect(service.grantDevelopmentEssence).toHaveBeenCalledWith(2500))
  })

  it('refuses a non-positive amount without calling the server', async () => {
    const service = fakeService(async (amount) => amount)
    const { user } = renderComponent(<DevelopmentEssenceGrant metaService={service} onGranted={vi.fn()} />)
    const input = screen.getByLabelText('Amount')
    await user.clear(input)
    await user.type(input, '0')
    await user.click(screen.getByRole('button', { name: 'Grant Essence' }))
    expect(sectionAlert()).toHaveTextContent('positive whole-number')
    expect(service.grantDevelopmentEssence).not.toHaveBeenCalled()
  })

  it('shows the server\'s refusal', async () => {
    const service = fakeService(async () => { throw new Error('Administrator access is required for development Essence grants.') })
    const { user } = renderComponent(<DevelopmentEssenceGrant metaService={service} onGranted={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+100 Essence' }))
    // The shared toaster shows the refusal too; the section's own alert is the one checked.
    await waitFor(() => expect(sectionAlert()).toHaveTextContent('Administrator access'))
  })
})
