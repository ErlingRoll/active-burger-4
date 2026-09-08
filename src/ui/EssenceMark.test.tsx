// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderComponent } from '../testing/render'
import { EssenceAmount, EssenceMark } from './EssenceMark'

describe('EssenceMark', () => {
  it('is hidden from assistive technology unless it is given a name', () => {
    const { container, rerender } = renderComponent(<EssenceMark />)

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')

    rerender(<EssenceMark title="Essence" />)

    expect(screen.getByRole('img', { name: 'Essence' })).toBeInTheDocument()
  })
})

describe('EssenceAmount', () => {
  it('names the currency for assistive technology even though the mark replaces the label', () => {
    const { container } = renderComponent(<EssenceAmount value={1714} />)

    // Grouping is the reader's locale, not ours, so the expectation is built
    // the same way the component builds it rather than hard-coding a comma.
    // The label is read off the element for the same reason: a locale that
    // groups with a narrow no-break space does not survive a text query.
    const grouped = (1714).toLocaleString()
    const amount = container.querySelector('.essence-amount')
    // Text assertions normalise whitespace; the attribute is compared verbatim.
    expect(amount).toHaveTextContent(grouped.replace(/\s/g, ' '))
    expect(amount).toHaveAttribute('aria-label', `${grouped} Essence`)
  })

  it('signs a reward so the direction reads without a label', () => {
    renderComponent(<EssenceAmount value={7} signed />)

    expect(screen.getByLabelText('+7 Essence')).toBeInTheDocument()
  })

  it('renders a placeholder rather than a zero when the balance is unknown', () => {
    renderComponent(<EssenceAmount value={null} />)

    expect(screen.getByLabelText('Essence unavailable')).toHaveTextContent('—')
  })
})
