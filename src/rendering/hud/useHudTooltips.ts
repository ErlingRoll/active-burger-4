import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { registerTooltipCloser } from '../TooltipShell'
import type { EquipmentSlot as EquipmentSlotType } from '../../content/gear/Items'

/**
 * Tooltip state for the gameplay HUD.
 *
 * The skill, loadout, and character-stat tooltips look independent but are not:
 * only one may be open, Escape closes whichever is, and they share a single
 * close timer so that moving between two of them cancels the first one's
 * pending close instead of racing it. Holding all three here keeps that
 * coupling in one place and lets the three HUD sections be separate components.
 */

type TooltipElementRef<T extends HTMLElement> = { current: T | null }

function useHudTooltipPosition<TAnchor extends HTMLElement, TTooltip extends HTMLElement>(
  isOpen: boolean,
  anchorKey: string | null,
  placement: 'above' | 'right',
  anchorRef: TooltipElementRef<TAnchor>,
  tooltipRef: TooltipElementRef<TTooltip>,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>(() => ({
    visibility: 'hidden',
  }))

  // Tooltip placement is measured from the live DOM (anchor and tooltip rects),
  // which is exactly the external-system synchronisation a layout effect exists
  // for. It cannot be derived during render: it depends on the rendered size.
  useLayoutEffect(() => {
    if (!isOpen) {
      // oxlint-disable-next-line react/set-state-in-effect
      setStyle((current) =>
        current.visibility === 'hidden' ? current : { visibility: 'hidden' },
      )
      return
    }
    const tooltip = tooltipRef.current
    if (!tooltip) {
      return
    }

    const updatePosition = (): void => {
      const anchor = anchorRef.current
      if (!anchor) {
        return
      }

      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = document.documentElement.clientHeight
      const margin = 12
      const gap = 10
      const anchorBox = anchor.getBoundingClientRect()
      const tooltipBox = tooltip.getBoundingClientRect()
      const tooltipHeight = Math.min(
        Math.max(tooltipBox.height, tooltip.scrollHeight),
        viewportHeight - margin * 2,
      )
      const maxLeft = Math.max(margin, viewportWidth - margin - tooltipBox.width)
      const maxTop = Math.max(margin, viewportHeight - margin - tooltipHeight)

      let left = placement === 'above'
        ? anchorBox.right - tooltipBox.width
        : anchorBox.right + gap
      let top = placement === 'above'
        ? anchorBox.top - gap - tooltipHeight
        : anchorBox.top

      if (placement === 'above' && top < margin) {
        top = anchorBox.bottom + gap
      }
      if (placement === 'right' && left > maxLeft) {
        left = anchorBox.left - gap - tooltipBox.width
      }

      setStyle({
        top: Math.min(Math.max(top, margin), maxTop),
        left: Math.min(Math.max(left, margin), maxLeft),
        right: 'auto',
        bottom: 'auto',
        maxHeight: `${Math.max(0, viewportHeight - margin * 2)}px`,
        visibility: 'visible',
      })
    }

    updatePosition()
    const animationFrame = window.requestAnimationFrame(updatePosition)
    const resizeObserver = new ResizeObserver(updatePosition)
    resizeObserver.observe(tooltip)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorKey, anchorRef, isOpen, placement, tooltipRef])

  return style
}

export interface HudTooltip<TKey, TAnchor extends HTMLElement> {
  activeKey: TKey | null
  setActiveKey: (key: TKey | null) => void
  anchorRef: TooltipElementRef<TAnchor>
  tooltipRef: TooltipElementRef<HTMLDivElement>
  style: CSSProperties
}

export interface HudTooltips {
  skill: HudTooltip<string, HTMLButtonElement>
  loadout: HudTooltip<EquipmentSlotType, HTMLButtonElement>
  characterStat: HudTooltip<string, HTMLButtonElement>
  /** Cancels a pending close, e.g. when the pointer re-enters a tooltip. */
  cancelClose: () => void
  /** Closes after a short grace period so the pointer can cross a gap. */
  scheduleClose: (close: () => void) => void
}

const TOOLTIP_CLOSE_DELAY_MS = 120

export function useHudTooltips(): HudTooltips {
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null)
  const [activeLoadoutSlot, setActiveLoadoutSlot] = useState<EquipmentSlotType | null>(
    null,
  )
  const [activeCharacterStatId, setActiveCharacterStatId] = useState<string | null>(
    null,
  )
  const skillTooltipAnchorRef = useRef<HTMLButtonElement | null>(null)
  const skillTooltipRef = useRef<HTMLDivElement | null>(null)
  const loadoutTooltipAnchorRef = useRef<HTMLButtonElement | null>(null)
  const loadoutTooltipRef = useRef<HTMLDivElement | null>(null)
  const characterStatTooltipAnchorRef = useRef<HTMLButtonElement | null>(null)
  const characterStatTooltipRef = useRef<HTMLDivElement | null>(null)
  const tooltipCloseTimeoutRef = useRef<number | null>(null)

  const cancelClose = (): void => {
    if (tooltipCloseTimeoutRef.current !== null) {
      window.clearTimeout(tooltipCloseTimeoutRef.current)
      tooltipCloseTimeoutRef.current = null
    }
  }

  const scheduleClose = (close: () => void): void => {
    cancelClose()
    tooltipCloseTimeoutRef.current = window.setTimeout(() => {
      tooltipCloseTimeoutRef.current = null
      close()
    }, TOOLTIP_CLOSE_DELAY_MS)
  }

  useEffect(() => registerTooltipCloser(() => {
    const hasOpenTooltip =
      activeSkillId !== null ||
      activeLoadoutSlot !== null ||
      activeCharacterStatId !== null
    if (!hasOpenTooltip) {
      return false
    }
    if (tooltipCloseTimeoutRef.current !== null) {
      window.clearTimeout(tooltipCloseTimeoutRef.current)
      tooltipCloseTimeoutRef.current = null
    }
    setActiveSkillId(null)
    setActiveLoadoutSlot(null)
    setActiveCharacterStatId(null)
    return true
  }), [
    activeCharacterStatId,
    activeLoadoutSlot,
    activeSkillId,
  ])

  const skillStyle = useHudTooltipPosition(
    activeSkillId !== null,
    activeSkillId,
    'above',
    skillTooltipAnchorRef,
    skillTooltipRef,
  )
  const loadoutStyle = useHudTooltipPosition(
    activeLoadoutSlot !== null,
    activeLoadoutSlot,
    'right',
    loadoutTooltipAnchorRef,
    loadoutTooltipRef,
  )
  const characterStatStyle = useHudTooltipPosition(
    activeCharacterStatId !== null,
    activeCharacterStatId,
    'right',
    characterStatTooltipAnchorRef,
    characterStatTooltipRef,
  )

  return {
    skill: {
      activeKey: activeSkillId,
      setActiveKey: setActiveSkillId,
      anchorRef: skillTooltipAnchorRef,
      tooltipRef: skillTooltipRef,
      style: skillStyle,
    },
    loadout: {
      activeKey: activeLoadoutSlot,
      setActiveKey: setActiveLoadoutSlot,
      anchorRef: loadoutTooltipAnchorRef,
      tooltipRef: loadoutTooltipRef,
      style: loadoutStyle,
    },
    characterStat: {
      activeKey: activeCharacterStatId,
      setActiveKey: setActiveCharacterStatId,
      anchorRef: characterStatTooltipAnchorRef,
      tooltipRef: characterStatTooltipRef,
      style: characterStatStyle,
    },
    cancelClose,
    scheduleClose,
  }
}
