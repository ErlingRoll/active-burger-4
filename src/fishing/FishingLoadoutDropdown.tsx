import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { RARITY_VISUALS, type Rarity } from '../content/rarity/Rarity'
import {
  closeAllTooltips,
  registerTooltipCloser,
  tooltipClassName,
} from '../rendering/TooltipShell'
import {
  placeFishingDropdownTooltip,
  type FishingTooltipPlacement,
} from './FishingLoadoutTooltipPlacement'

/*
 * The pond's loadout controls: mode, rod and bait.
 *
 * These were a list of names. A player with two Silverline rods saw the same
 * two words twice and had no way to learn which of them carried the Fortune
 * roll, and a bag of twelve River Worms was twelve entries of "River Worm ·
 * 1". An option now says what it is on one line and what it does on the
 * next, and hovering it floats the same card the bag shows for the item —
 * the tooltip is the one the inventory grid draws, so a rod reads the same
 * wherever it is looked at.
 */

export interface FishingDropdownTooltipRow {
  label: string
  /** The magnitude, when the row has one: "T2 · +11%". */
  value: string | null
  description?: string
}

export interface FishingDropdownTooltip {
  /** What the thing is: a bait's description, a rod's flavour text. */
  description?: string | null
  /** Its numbers: a rod's modifiers, a bait's bonuses. */
  rows?: readonly FishingDropdownTooltipRow[]
  /** What stands in for the rows when there are none. */
  emptyRowsLabel?: string
  /** Bag facts: a stack count, an unlimited supply. */
  facts?: readonly { label: string; value: string }[]
}

export interface FishingDropdownOption {
  value: string
  label: string
  /** One line under the name saying what the choice does. */
  detail?: string
  /** A trailing count: the bait stack. */
  badge?: string
  icon?: ReactNode
  rarity?: Rarity | null
  tooltip?: FishingDropdownTooltip
}

export interface FishingDropdownProps {
  icon: string
  label: string
  value: string
  options: readonly FishingDropdownOption[]
  disabled: boolean
  onChange: (value: string) => void
}

interface TooltipTarget {
  option: FishingDropdownOption
  anchor: HTMLElement
  placement: FishingTooltipPlacement
}

function OptionContent({ option }: { option: FishingDropdownOption }) {
  return (
    <span className="fishing-dropdown-value">
      <span className="fishing-dropdown-value-name">
        {option.icon ? (
          <span className="fishing-dropdown-icon" aria-hidden="true">{option.icon}</span>
        ) : null}
        <span className="fishing-dropdown-label">{option.label}</span>
        {option.badge ? <span className="fishing-dropdown-badge">{option.badge}</span> : null}
      </span>
      {option.detail ? <span className="fishing-dropdown-detail">{option.detail}</span> : null}
    </span>
  )
}

function FishingDropdownTooltipCard({
  id,
  option,
  style,
  tooltipRef,
}: {
  id: string
  option: FishingDropdownOption
  style: CSSProperties
  tooltipRef: RefObject<HTMLDivElement | null>
}) {
  const tooltip = option.tooltip ?? {}
  const rows = tooltip.rows ?? []
  return (
    <div
      className={`${tooltipClassName('inventory-item-tooltip')} fishing-loadout-tooltip`}
      id={id}
      data-rarity={option.rarity ?? undefined}
      role="tooltip"
      ref={tooltipRef}
      style={style}
    >
      <header className="inventory-item-tooltip-heading">
        {option.icon ? (
          <span className="inventory-item-tooltip-icon" aria-hidden="true">{option.icon}</span>
        ) : null}
        <div>
          <strong>{option.label}</strong>
          {option.rarity ? (
            <span className="inventory-rarity-mark" data-rarity={option.rarity}>
              {RARITY_VISUALS[option.rarity].label}
            </span>
          ) : null}
        </div>
      </header>
      {tooltip.description ? (
        <p className="fishing-loadout-tooltip-description">{tooltip.description}</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="fishing-loadout-tooltip-rows">
          {rows.map((row) => (
            <li key={row.label}>
              <span className="fishing-loadout-tooltip-row-label">{row.label}</span>
              {row.value ? (
                <span className="fishing-loadout-tooltip-row-value">{row.value}</span>
              ) : null}
              {row.description ? <small>{row.description}</small> : null}
            </li>
          ))}
        </ul>
      ) : tooltip.emptyRowsLabel ? (
        <p className="fishing-loadout-tooltip-empty">{tooltip.emptyRowsLabel}</p>
      ) : null}
      {tooltip.facts && tooltip.facts.length > 0 ? (
        <dl>
          {tooltip.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

export function FishingDropdown({
  icon,
  label,
  value,
  options,
  disabled,
  onChange,
}: FishingDropdownProps) {
  const [isExpanded, setIsOpen] = useState(false)
  // Derived rather than reset by an effect: a disabled dropdown is closed by
  // definition, so deriving it avoids rendering an open-but-disabled list for
  // one frame before an effect could close it.
  const isOpen = isExpanded && !disabled
  const [tooltipTarget, setTooltipTarget] = useState<TooltipTarget | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({})
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  /* Whether the list was opened from the keyboard, so focus should follow. */
  const focusListOnOpenRef = useRef(false)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]
  const tooltipId = `fishing-dropdown-tooltip-${label.toLowerCase().replace(/\s+/g, '-')}`
  const tooltipOption = tooltipTarget?.option ?? null
  const activeTooltipValue = tooltipOption?.value ?? null

  const showTooltip = (
    option: FishingDropdownOption,
    anchor: HTMLElement,
    placement: FishingTooltipPlacement,
  ): void => {
    if (!option.tooltip) {
      return
    }
    closeAllTooltips()
    setTooltipTarget({ option, anchor, placement })
  }

  const hideTooltip = (): void => {
    setTooltipTarget(null)
  }

  useEffect(() => registerTooltipCloser(() => {
    if (tooltipTarget === null) {
      return false
    }
    setTooltipTarget(null)
    return true
  }), [tooltipTarget])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (event.target instanceof Node && !dropdownRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !focusListOnOpenRef.current) {
      return
    }
    focusListOnOpenRef.current = false
    const selected = menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ??
      menuRef.current?.querySelector<HTMLButtonElement>('[role="option"]')
    selected?.focus()
  }, [isOpen])

  useLayoutEffect(() => {
    const anchor = tooltipTarget?.anchor
    const tooltip = tooltipRef.current
    if (!tooltipTarget || !anchor || !tooltip) {
      return
    }
    const updatePosition = (): void => {
      const position = placeFishingDropdownTooltip(
        anchor.getBoundingClientRect(),
        tooltip.getBoundingClientRect(),
        tooltipTarget.placement,
        { width: window.innerWidth, height: window.innerHeight },
      )
      setTooltipStyle({ left: `${position.left}px`, top: `${position.top}px` })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [tooltipTarget])

  const openList = (fromKeyboard: boolean): void => {
    focusListOnOpenRef.current = fromKeyboard
    hideTooltip()
    setIsOpen(true)
  }

  const moveFocus = (direction: 1 | -1 | 'first' | 'last'): void => {
    const menu = menuRef.current
    if (!menu) {
      return
    }
    const optionButtons = [...menu.querySelectorAll<HTMLButtonElement>('[role="option"]')]
    if (optionButtons.length === 0) {
      return
    }
    const currentIndex = optionButtons.findIndex((button) => button === document.activeElement)
    const nextIndex = direction === 'first'
      ? 0
      : direction === 'last'
        ? optionButtons.length - 1
        : currentIndex === -1
          ? (direction === 1 ? 0 : optionButtons.length - 1)
          : (currentIndex + direction + optionButtons.length) % optionButtons.length
    optionButtons[nextIndex]?.focus()
  }

  return (
    <div className="pond-loadout-control fishing-dropdown" ref={dropdownRef}>
      <span><span aria-hidden="true">{icon}</span> {label}</span>
      <div className="fishing-dropdown-anchor">
        <button
          className="fishing-dropdown-trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-describedby={!isOpen && activeTooltipValue === selectedOption?.value ? tooltipId : undefined}
          disabled={disabled}
          ref={triggerRef}
          onClick={() => {
            if (isOpen) {
              setIsOpen(false)
            } else {
              openList(false)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              openList(true)
            }
          }}
          onMouseEnter={(event) => {
            if (!isOpen && selectedOption) {
              showTooltip(selectedOption, event.currentTarget, 'above')
            }
          }}
          onMouseLeave={hideTooltip}
        >
          {selectedOption ? (
            <OptionContent option={selectedOption} />
          ) : (
            <span className="fishing-dropdown-value">
              <span className="fishing-dropdown-value-name">
                <span className="fishing-dropdown-label">Select an option</span>
              </span>
            </span>
          )}
          <span className="fishing-dropdown-chevron" aria-hidden="true">⌄</span>
        </button>
        {isOpen ? (
          <div
            className="fishing-dropdown-menu"
            role="listbox"
            aria-label={label}
            ref={menuRef}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                moveFocus(1)
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                moveFocus(-1)
              } else if (event.key === 'Home') {
                event.preventDefault()
                moveFocus('first')
              } else if (event.key === 'End') {
                event.preventDefault()
                moveFocus('last')
              }
            }}
          >
            {options.map((option) => {
              const isSelected = option.value === value
              const isDescribed = activeTooltipValue === option.value
              return (
                <button
                  className={`fishing-dropdown-option${isSelected ? ' selected' : ''}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-describedby={isDescribed ? tooltipId : undefined}
                  key={option.value}
                  onClick={() => {
                    hideTooltip()
                    onChange(option.value)
                    setIsOpen(false)
                    triggerRef.current?.focus()
                  }}
                  onMouseEnter={(event) => showTooltip(option, event.currentTarget, 'beside')}
                  onMouseLeave={hideTooltip}
                  onFocus={(event) => showTooltip(option, event.currentTarget, 'beside')}
                  onBlur={hideTooltip}
                >
                  <OptionContent option={option} />
                  <span className="fishing-dropdown-check" aria-hidden="true">
                    {isSelected ? '✓' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
      {tooltipOption ? createPortal(
        <FishingDropdownTooltipCard
          id={tooltipId}
          option={tooltipOption}
          style={tooltipStyle}
          tooltipRef={tooltipRef}
        />,
        document.body,
      ) : null}
    </div>
  )
}
