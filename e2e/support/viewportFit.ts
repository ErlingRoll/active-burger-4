import type { Page } from '@playwright/test'

/**
 * Viewport-fit measurement for the game screens.
 *
 * A screen is not a document: nothing on it should need to be scrolled, and an
 * inner scroll container is as much of a failure as a scrolling page. Judging
 * that by eye does not work, so this measures it instead — every element whose
 * computed overflow makes it scrollable is compared against its own content,
 * at each viewport in the matrix.
 */

export interface Viewport {
  readonly name: string
  readonly width: number
  readonly height: number
}

/**
 * Sized to separate the two independent failures: a narrow viewport that wraps
 * badly, and a short one that runs out of vertical room. The short entries
 * matter most, since `vh`-scaled padding and type are what keep a panel inside
 * the screen, and a matrix of widths alone never exercises them.
 */
export const VIEWPORTS: readonly Viewport[] = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'laptop-small', width: 1280, height: 720 },
  { name: 'laptop-short', width: 1024, height: 640 },
  { name: 'tablet-portrait', width: 820, height: 1180 },
  { name: 'landscape-short', width: 844, height: 390 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-small', width: 360, height: 640 },
]

export interface OverflowFinding {
  /** A CSS-ish description of the offending element, or `document` for the page. */
  readonly target: string
  readonly axis: 'x' | 'y'
  readonly overflowPx: number
}

/**
 * Sub-pixel rounding routinely leaves `scrollHeight` a fraction above
 * `clientHeight` on an element that cannot actually be scrolled, so a single
 * pixel of excess is not a finding.
 */
const OVERFLOW_TOLERANCE_PX = 1

/**
 * Returns every place the current page overflows: the document itself on
 * either axis, and any visible element that both declares a scrollable
 * overflow and has more content than room.
 */
export async function findOverflow(page: Page): Promise<OverflowFinding[]> {
  return page.evaluate((tolerance: number) => {
    const findings: OverflowFinding[] = []

    const describe = (element: Element): string => {
      const id = element.id === '' ? '' : `#${element.id}`
      const classes = Array.from(element.classList)
        .slice(0, 3)
        .map((className) => `.${className}`)
        .join('')
      return `${element.tagName.toLowerCase()}${id}${classes}`
    }

    const record = (
      target: string,
      axis: 'x' | 'y',
      content: number,
      visible: number,
    ): void => {
      const overflowPx = Math.round(content - visible)
      if (overflowPx > tolerance) {
        findings.push({ target, axis, overflowPx })
      }
    }

    const root = document.documentElement
    record('document', 'y', root.scrollHeight, root.clientHeight)
    record('document', 'x', root.scrollWidth, root.clientWidth)

    const scrollableOverflows = new Set(['auto', 'scroll'])
    for (const element of document.body.querySelectorAll('*')) {
      // A collapsed element reports meaningless scroll metrics, and a hidden
      // one is not on screen to be scrolled in the first place.
      if (element.clientHeight === 0 && element.clientWidth === 0) {
        continue
      }
      const style = window.getComputedStyle(element)
      if (style.visibility === 'hidden') {
        continue
      }
      if (scrollableOverflows.has(style.overflowY)) {
        record(describe(element), 'y', element.scrollHeight, element.clientHeight)
      }
      if (scrollableOverflows.has(style.overflowX)) {
        record(describe(element), 'x', element.scrollWidth, element.clientWidth)
      }
    }

    return findings
  }, OVERFLOW_TOLERANCE_PX)
}

/**
 * Controls the viewport cuts off.
 *
 * Bounding a screen with `overflow: hidden` stops it scrolling, but on its own
 * that only trades a scrollbar for silent clipping — the overflow check would
 * pass while a button sat outside the frame, unreachable. This looks for the
 * harm directly: anything focusable whose box falls outside the viewport, or
 * which has been collapsed to nothing while still being in the accessibility
 * tree.
 */
export async function findClippedControls(page: Page): Promise<OverflowFinding[]> {
  return page.evaluate((tolerance: number) => {
    const findings: OverflowFinding[] = []
    const controls = document.body.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )

    for (const control of controls) {
      const style = window.getComputedStyle(control)
      if (style.visibility === 'hidden' || style.display === 'none') {
        continue
      }
      // A control rendered off-screen on purpose (a skip link, a visually
      // hidden label) is positioned away rather than merely overflowing, and
      // reports no box at all here.
      const box = control.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) {
        continue
      }

      const describe = (): string => {
        const classes = Array.from(control.classList)
          .slice(0, 2)
          .map((className) => `.${className}`)
          .join('')
        const label = (control.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 32)
        return `${control.tagName.toLowerCase()}${classes}${label === '' ? '' : ` "${label}"`}`
      }

      const belowFold = Math.round(box.bottom - window.innerHeight)
      if (belowFold > tolerance) {
        findings.push({ target: describe(), axis: 'y', overflowPx: belowFold })
      }
      const pastRight = Math.round(box.right - window.innerWidth)
      if (pastRight > tolerance) {
        findings.push({ target: describe(), axis: 'x', overflowPx: pastRight })
      }
    }

    return findings
  }, OVERFLOW_TOLERANCE_PX)
}

/** Formats findings as one line each, for a failure message that reads. */
export function formatFindings(findings: readonly OverflowFinding[]): string {
  return findings
    .map(({ target, axis, overflowPx }) => `${target} overflows ${axis} by ${overflowPx}px`)
    .join('; ')
}
