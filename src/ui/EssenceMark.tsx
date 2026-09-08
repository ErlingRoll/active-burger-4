/**
 * The Essence mark.
 *
 * Essence is the one thing in the application with an identity of its own
 * rather than one borrowed from the screen it appears on, so it gets a drawn
 * mark instead of a typographic stand-in: the ✦ and ❖ characters this replaces
 * rendered differently on every platform and could not be relied on to read as
 * a gem at all. The shape is a cut stone — table, girdle, pavilion — which
 * stays legible down to the size of a caption.
 *
 * It is drawn in `currentColor` and sized in `em`, so it inherits the Essence
 * colour and the type size of whatever shows it, and it carries no gradient
 * ids, which would collide with each other once more than one is on screen.
 */

interface EssenceMarkProps {
  /**
   * An accessible name. Omit it wherever the amount beside the mark already
   * says what it is; pass it when the mark stands alone.
   */
  title?: string
  className?: string
}

export function EssenceMark({ title, className }: EssenceMarkProps) {
  return (
    <svg
      className={`essence-mark${className === undefined ? '' : ` ${className}`}`}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      role={title === undefined ? undefined : 'img'}
      aria-hidden={title === undefined ? true : undefined}
      aria-label={title}
      focusable="false"
    >
      <path
        d="M5.4 3.4h13.2l3.4 5.7L12 20.9 2 9.1z"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M2 9.1h20M5.4 3.4 8.6 9.1 12 20.9M18.6 3.4 15.4 9.1 12 20.9"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface EssenceAmountProps {
  /** A balance, a price, or a reward. `null` renders the placeholder dash. */
  value: number | null
  /**
   * Prefixes the amount with a sign, for rewards and costs where the direction
   * matters more than the number.
   */
  signed?: boolean
  className?: string
}

/**
 * An amount of Essence, marked rather than labelled.
 *
 * The accessible name still says "Essence" so the mark is never the only thing
 * carrying the meaning for a screen reader.
 */
export function EssenceAmount({ value, signed = false, className }: EssenceAmountProps) {
  const formatted = value === null
    ? '—'
    : `${signed && value > 0 ? '+' : ''}${value.toLocaleString()}`
  return (
    <span
      className={`essence-amount${className === undefined ? '' : ` ${className}`}`}
      aria-label={value === null ? 'Essence unavailable' : `${formatted} Essence`}
    >
      <EssenceMark />
      <strong aria-hidden="true">{formatted}</strong>
    </span>
  )
}
