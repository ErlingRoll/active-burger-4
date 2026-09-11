import type { CSSProperties } from 'react'
import type { ArtifactBaseId } from '../content/artifacts/Artifacts'

/**
 * The five artifacts, drawn.
 *
 * Drawn rather than typeset for the same reason the fish and the materials
 * are: a glyph renders at a different weight on every platform, and a slot in
 * the bag is small enough that the difference shows. Sized in `em` and
 * painted from `currentColor`, so an artifact takes the size of whatever slot
 * holds it and the accent of whichever base it is.
 */
interface ArtifactIconProps {
  icon: ArtifactBaseId
  color?: string
}

export function ArtifactIcon({ icon, color }: ArtifactIconProps) {
  const style: CSSProperties | undefined = color ? { color } : undefined

  switch (icon) {
    case 'cartographers-compass':
      return (
        <svg className="artifact-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          {/* A compass rose whose needle leans off north: it points at what
              you were about to become, not at where you are. */}
          <circle cx="16" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
          <path fill="currentColor" d="M16 3.5 18 12l-2 8.5L14 12Z" opacity="0.9" />
          <path fill="currentColor" d="M20.5 6.5 17.5 12l4.5 5.5-1.5-5.5Z" opacity="0.55" />
          <circle cx="16" cy="12" r="1.4" fill="#07111f" opacity="0.6" />
        </svg>
      )
    case 'ember-reliquary':
      return (
        <svg className="artifact-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          {/* A squat casket with a flame that has not gone out. */}
          <path fill="currentColor" d="M7 13h18l-1.5 8.5h-15Z" opacity="0.85" />
          <path fill="currentColor" d="M6 11.5h20v2.5H6Z" opacity="0.6" />
          <path
            fill="currentColor"
            d="M16 2c1 2.5 4 4 4 7.5a4 4 0 0 1-8 0c0-1.5.6-2.6 1.5-3.5.2 1 .8 1.7 1.5 2 .1-2.4.3-4.2 1-6Z"
            opacity="0.95"
          />
          <circle cx="16" cy="9.5" r="1.3" fill="#fff7ed" opacity="0.6" />
        </svg>
      )
    case 'echoing-tuning-fork':
      return (
        <svg className="artifact-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          {/* A tuning fork, with the beat that answers it a little late. */}
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            d="M12 3v8a4 4 0 0 0 8 0V3M16 15v7"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            d="M24.5 6.5c2 2.5 2 6.5 0 9M7.5 6.5c-2 2.5-2 6.5 0 9"
            opacity="0.55"
          />
        </svg>
      )
    case 'wayfarers-anklet':
      return (
        <svg className="artifact-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          {/* A cord of beads, drawn mid-swing: the courier never stood still. */}
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            d="M5 14c3-6 8-8 12-6 3 1.5 5 5 9 5"
          />
          <circle cx="9" cy="9.5" r="2" fill="currentColor" />
          <circle cx="16" cy="7.2" r="2" fill="currentColor" opacity="0.85" />
          <circle cx="22" cy="10.5" r="2" fill="currentColor" opacity="0.7" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            d="M6 19h6M4 21.5h4"
            opacity="0.5"
          />
        </svg>
      )
    case 'gluttons-kettle':
      return (
        <svg className="artifact-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          {/* A round-bellied kettle over a lick of steam. */}
          <path fill="currentColor" d="M8 10h16c1 4 0 8-3 11H11c-3-3-4-7-3-11Z" opacity="0.85" />
          <path fill="currentColor" d="M7 9h18v2H7Z" opacity="0.6" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            d="M11 9c0-4 10-4 10 0M24 12c3 0 4 3 1 5"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            d="M14 4.5c0-1.5 1.5-1.5 1.5-3M18 4.5c0-1.5 1.5-1.5 1.5-3"
            opacity="0.5"
          />
        </svg>
      )
  }
}
