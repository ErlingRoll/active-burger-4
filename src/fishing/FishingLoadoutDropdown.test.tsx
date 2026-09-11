// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, within } from '../testing/render'
import { FishingDropdown, type FishingDropdownOption } from './FishingLoadoutDropdown'

const options: readonly FishingDropdownOption[] = [
  {
    value: '',
    label: 'Wooden rod',
    detail: 'No modifiers',
    rarity: 'common',
    tooltip: { description: 'A stick with yarn.', rows: [], emptyRowsLabel: 'No modifiers' },
  },
  {
    value: 'rod-1',
    label: 'Silverline rod',
    detail: 'T2 +11% Fortune, T4 +2% Quick Line',
    rarity: 'uncommon',
    tooltip: {
      rows: [
        { label: 'Fortune', value: 'T2 · +11%', description: 'Improves the chance of higher-rarity fish.' },
        { label: 'Quick Line', value: 'T4 · +2%', description: 'Reduces the wait.' },
      ],
    },
  },
  {
    value: 'worm',
    label: 'River Worm',
    detail: 'rarity +10%',
    badge: '×12',
    tooltip: { facts: [{ label: 'In bag', value: '×12' }] },
  },
]

function renderDropdown(overrides: Partial<Parameters<typeof FishingDropdown>[0]> = {}) {
  const onChange = vi.fn()
  const result = renderComponent(
    <FishingDropdown
      icon="⌁"
      label="Rod"
      value="rod-1"
      options={options}
      disabled={false}
      onChange={onChange}
      {...overrides}
    />,
  )
  return { ...result, onChange }
}

describe('FishingDropdown', () => {
  it('shows the chosen option with its detail line and a stack count', () => {
    renderDropdown({ value: 'worm' })
    const trigger = screen.getByRole('button', { name: /River Worm/ })
    expect(trigger).toHaveTextContent('×12')
    expect(trigger).toHaveTextContent('rarity +10%')
  })

  it('lists every option with what it does and ticks the selected one', async () => {
    const { user } = renderDropdown()
    await user.click(screen.getByRole('button', { name: /Silverline rod/ }))

    const list = screen.getByRole('listbox', { name: 'Rod' })
    const rows = within(list).getAllByRole('option')
    expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(within(list).getByRole('option', { name: /Silverline rod/ }))
      .toHaveTextContent('T2 +11% Fortune, T4 +2% Quick Line')
    expect(within(list).getByRole('option', { name: /Silverline rod/ })).toHaveTextContent('✓')
    expect(within(list).getByRole('option', { name: /Wooden rod/ })).not.toHaveTextContent('✓')
  })

  it('floats an item card with the modifier rows while an option is hovered', async () => {
    const { user } = renderDropdown()
    await user.click(screen.getByRole('button', { name: /Silverline rod/ }))
    const option = screen.getByRole('option', { name: /Silverline rod/ })

    await user.hover(option)

    const card = screen.getByRole('tooltip')
    expect(card).toHaveTextContent('Silverline rod')
    expect(card).toHaveTextContent('Uncommon')
    expect(card).toHaveTextContent('Fortune')
    expect(card).toHaveTextContent('T2 · +11%')
    expect(card).toHaveTextContent('Improves the chance of higher-rarity fish.')
    expect(option).toHaveAttribute('aria-describedby', card.id)

    await user.unhover(option)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('says what a rod without rolls is instead of listing nothing', async () => {
    const { user } = renderDropdown()
    await user.click(screen.getByRole('button', { name: /Silverline rod/ }))

    await user.hover(screen.getByRole('option', { name: /Wooden rod/ }))

    const card = screen.getByRole('tooltip')
    expect(card).toHaveTextContent('A stick with yarn.')
    expect(card).toHaveTextContent('No modifiers')
  })

  it('shows the chosen option’s card when the closed trigger is hovered', async () => {
    const { user } = renderDropdown()

    await user.hover(screen.getByRole('button', { name: /Silverline rod/ }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Fortune')

    // Opening the list takes the card's place, so the card goes.
    await user.click(screen.getByRole('button', { name: /Silverline rod/ }))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(screen.getByRole('listbox', { name: 'Rod' })).toBeInTheDocument()
  })

  it('reports the picked value and hands focus back to the trigger', async () => {
    const { user, onChange } = renderDropdown()
    const trigger = screen.getByRole('button', { name: /Silverline rod/ })
    await user.click(trigger)

    await user.click(screen.getByRole('option', { name: /River Worm/ }))

    expect(onChange).toHaveBeenCalledWith('worm')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('opens from the keyboard onto the selected option and walks the list with the arrows', async () => {
    const { user, onChange } = renderDropdown()
    const trigger = screen.getByRole('button', { name: /Silverline rod/ })
    trigger.focus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /Silverline rod/ })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /River Worm/ })).toHaveFocus()
    // A focused option shows its card, the same as a hovered one.
    expect(screen.getByRole('tooltip')).toHaveTextContent('In bag')

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /Wooden rod/ })).toHaveFocus()

    await user.keyboard('{End}')
    expect(screen.getByRole('option', { name: /River Worm/ })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('worm')
    expect(trigger).toHaveFocus()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const { user } = renderDropdown()
    const trigger = screen.getByRole('button', { name: /Silverline rod/ })
    await user.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('stays shut while disabled', async () => {
    const { user } = renderDropdown({ disabled: true })

    await user.click(screen.getByRole('button', { name: /Silverline rod/ }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
