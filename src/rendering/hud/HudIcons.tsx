/**
 * The glyphs the in-run toolbar is built from.
 *
 * Drawn rather than set in a font: the HUD has to read the same on a phone as
 * on a desktop, and an emoji or a box-drawing character renders at a different
 * weight, and sometimes a different size, on every platform. Each is sized in
 * `em` and painted with `currentColor`, so a glyph takes the size and the
 * accent of whatever button holds it.
 */

import type { ReactNode } from 'react'

interface HudIconProps {
  className?: string
}

function icon(path: ReactNode, className?: string) {
  return (
    <svg
      className={className === undefined ? 'hud-icon' : `hud-icon ${className}`}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  )
}

/** Gear: a breastplate, so the loadout tab is not confused with settings. */
export function LoadoutIcon({ className }: HudIconProps) {
  return icon(
    <>
      <path d="M12 3 5 5.5v6.2c0 4 2.9 7 7 9.3 4.1-2.3 7-5.3 7-9.3V5.5Z" />
      <path d="M12 3v18" />
      <path d="M5.6 10h12.8" />
    </>,
    className,
  )
}

/** Stats: a rising bar chart. */
export function StatsIcon({ className }: HudIconProps) {
  return icon(
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6" />
      <path d="M12 20V7" />
      <path d="M17 20v-9" />
    </>,
    className,
  )
}

/** Run: a descending stair, the shape the whole run is aimed at. */
export function RunIcon({ className }: HudIconProps) {
  return icon(
    <>
      <path d="M4 6h5v4h5v4h5v4" />
      <path d="M4 6v12h16" />
    </>,
    className,
  )
}

/** Pause: two bars, the one glyph nobody has to learn. */
export function PauseIcon({ className }: HudIconProps) {
  return icon(
    <>
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </>,
    className,
  )
}

/** Behaviour: a figure with a direction, for how the character is being played. */
export function BehaviorIcon({ className }: HudIconProps) {
  return icon(
    <>
      <circle cx="10" cy="6.5" r="2.5" />
      <path d="M10 9.5v5.5l-2.5 5" />
      <path d="M10 15l2.5 5" />
      <path d="M17 8.5l3 3-3 3" />
    </>,
    className,
  )
}

/** Close: the standard cross. */
export function CloseIcon({ className }: HudIconProps) {
  return icon(
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>,
    className,
  )
}
