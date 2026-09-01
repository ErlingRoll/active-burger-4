import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  KEYWORD_DEFINITIONS,
  splitKeywordText,
  type KeywordId,
} from '../content/glossary/Keywords'
import {
  closeAllTooltips,
  registerTooltipCloser,
  tooltipClassName,
} from './TooltipShell'

function KeywordPopover({
  keywordId,
  tooltipId,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  keywordId: KeywordId
  tooltipId: string
  style: CSSProperties
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const definition = KEYWORD_DEFINITIONS[keywordId]
  return (
    <span
      className={tooltipClassName('keyword-tooltip')}
      id={tooltipId}
      role="tooltip"
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <strong>{definition.label}</strong>
      <span>{definition.summary}</span>
      <span>{definition.details}</span>
    </span>
  )
}

export function KeywordTerm({ keywordId, value }: { keywordId: KeywordId; value: string }) {
  const definition = KEYWORD_DEFINITIONS[keywordId]
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)
  const termRef = useRef<HTMLSpanElement | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({})

  const cancelClose = (): void => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  const scheduleClose = (): void => {
    cancelClose()
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null
      setOpen(false)
    }, 120)
  }

  useEffect(() => registerTooltipCloser(() => {
    if (!open) {
      return false
    }
    setOpen(false)
    return true
  }), [open])

  useLayoutEffect(() => {
    if (!open || !termRef.current) {
      return
    }
    const bounds = termRef.current.getBoundingClientRect()
    const tooltipWidth = Math.min(304, window.innerWidth * 0.7)
    const left = Math.min(
      Math.max(12, bounds.left),
      Math.max(12, window.innerWidth - tooltipWidth - 12),
    )
    setTooltipStyle({
      top: 'auto',
      right: 'auto',
      bottom: Math.max(12, window.innerHeight - bounds.top + 8),
      left,
      visibility: 'visible',
    })
  }, [open])

  const toggle = (event: ReactMouseEvent<HTMLSpanElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    setOpen((current) => !current)
  }

  return (
    <span
      className="keyword-term-wrap"
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <span
        className="keyword-term"
        ref={termRef}
        role="term"
        tabIndex={0}
        data-keyword-term="true"
        aria-label={`${definition.label}: ${definition.summary}`}
        aria-describedby={open ? tooltipId : undefined}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            closeAllTooltips()
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            setOpen((current) => !current)
          }
        }}
        onMouseEnter={() => {
          cancelClose()
          setOpen(true)
        }}
        onFocus={() => {
          cancelClose()
          setOpen(true)
        }}
        onBlur={scheduleClose}
      >
        {value}
      </span>
      {open ? createPortal(
        <KeywordPopover
          keywordId={keywordId}
          tooltipId={tooltipId}
          style={tooltipStyle}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />,
        document.body,
      ) : null}
    </span>
  )
}

export function KeywordText({ text }: { text: string }) {
  return (
    <>
      {splitKeywordText(text).map((segment, index) =>
        segment.type === 'keyword' && segment.keywordId ? (
          <KeywordTerm
            key={`${segment.keywordId}-${index}`}
            keywordId={segment.keywordId}
            value={segment.value}
          />
        ) : (
          <span key={`text-${index}`}>{segment.value}</span>
        ),
      )}
    </>
  )
}
