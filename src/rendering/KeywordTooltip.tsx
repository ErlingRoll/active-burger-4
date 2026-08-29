import { useId, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import {
  KEYWORD_DEFINITIONS,
  splitKeywordText,
  type KeywordId,
} from '../content/glossary/Keywords'

function KeywordPopover({ keywordId, tooltipId }: { keywordId: KeywordId; tooltipId: string }) {
  const definition = KEYWORD_DEFINITIONS[keywordId]
  return (
    <span className="keyword-tooltip" id={tooltipId} role="tooltip">
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

  const toggle = (event: ReactMouseEvent<HTMLSpanElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    setOpen((current) => !current)
  }

  return (
    <span className="keyword-term-wrap">
      <span
        className="keyword-term"
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
            setOpen(false)
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            setOpen((current) => !current)
          }
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {value}
      </span>
      {open ? <KeywordPopover keywordId={keywordId} tooltipId={tooltipId} /> : null}
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
