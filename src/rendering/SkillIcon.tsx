import type { ReactElement } from 'react'
import type { SkillId } from '../content/skills/SkillConfigs'

interface SkillIconProps {
  skillId?: SkillId
  className?: string
  size?: number
}

export function SkillIcon({
  skillId,
  className,
  size = 24,
}: SkillIconProps): ReactElement {
  const strokeProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.7,
  }

  let shape: ReactElement
  switch (skillId) {
    case 'basic-attack':
      shape = (
        <>
          <path {...strokeProps} d="M5 19 17 7" />
          <path {...strokeProps} d="m14 5 5 2-2 5" />
          <path {...strokeProps} d="m5 19 4 0M7 17l2 2" />
        </>
      )
      break
    case 'whirlwind':
      shape = (
        <>
          <circle {...strokeProps} cx="12" cy="12" r="2" />
          <path {...strokeProps} d="M12 3c4 1 6 4 5 7M21 12c-1 4-4 6-7 5M12 21c-4-1-6-4-5-7M3 12c1-4 4-6 7-5" />
          <path {...strokeProps} d="m15 4-3-1 1 3M20 15l1-3-3 1M9 20l3 1-1-3M4 9 3 12l3-1" />
        </>
      )
      break
    case 'chain-lightning':
      shape = (
        <>
          <circle {...strokeProps} cx="5" cy="6" r="2" />
          <circle {...strokeProps} cx="19" cy="5" r="2" />
          <circle {...strokeProps} cx="19" cy="19" r="2" />
          <path {...strokeProps} d="M7 7.5 12 11l5-4M13 12l4 5M12 10 11 6" />
          <path {...strokeProps} d="m10 4 2 2-2 2M14 11l-2 2 2 2" />
        </>
      )
      break
    case 'storm-relay':
      shape = (
        <>
          <path {...strokeProps} d="M8 20V8l4-4 4 4v12M5 20h14" />
          <path {...strokeProps} d="M12 4V2M4 8 2 7M20 8l2-1" />
          <path {...strokeProps} d="M10 11h4M10 15h4" />
          <path {...strokeProps} d="M7 5a7 7 0 0 1 10 0" />
        </>
      )
      break
    case 'vitality':
      shape = (
        <>
          <path {...strokeProps} d="M12 21c-1-6-1-11 2-15 2-2 4-2 5-1-1 3-3 5-6 6" />
          <path {...strokeProps} d="M12 21c-2-4-5-6-8-6 0 3 2 5 5 6M12 15c-2-3-4-4-7-4 1-3 4-4 7-2" />
          <path {...strokeProps} d="M12 21V9" />
        </>
      )
      break
    case 'raise-skeleton':
      shape = (
        <>
          <path {...strokeProps} d="M7 10a5 5 0 1 1 10 0v3c0 2-2 3-3 4v2H10v-2c-1-1-3-2-3-4z" />
          <path {...strokeProps} d="M9 11h.1M15 11h.1M9 14c2 1 4 1 6 0M12 19v3M8 22h8" />
        </>
      )
      break
    case 'fiery-touch':
      shape = (
        <>
          <path {...strokeProps} d="M5 20c1-3 1-7 2-10 .3-1 1-1 1.5 0l1 4 1-8c.2-1 1.5-1 1.7 0l.7 7 1-6c.2-1 1.5-1 1.7 0l-.2 7 1.5-4c.4-1 1.7-.5 1.5.5-.5 3-1 6-3 8.5" />
          <path {...strokeProps} d="M5 20c3 1 7 1 10 0" />
          <path {...strokeProps} d="M12 15c-1-2 0-3 1-4 2 3 1 5-1 6" />
        </>
      )
      break
    case 'glacial-orb':
      shape = (
        <>
          <circle {...strokeProps} cx="12" cy="12" r="7" />
          <path {...strokeProps} d="m7 7 5 5 5-5M7 17l5-5 5 5M12 5v14" />
          <path {...strokeProps} d="M19 5c2 2 2 4 1 6" />
        </>
      )
      break
    case 'lancers-charge':
      shape = (
        <>
          <path {...strokeProps} d="M4 16h16M14 13l6 3-6 3M7 13c1-4 4-6 7-5l2 2-2 3" />
          <path {...strokeProps} d="M7 13 5 10l3-1M5 17l-2 2M8 17l-2 3" />
          <circle {...strokeProps} cx="15" cy="10" r="1" />
        </>
      )
      break
    case 'rift-javelin':
      shape = (
        <>
          <path {...strokeProps} d="M12 2v20M9 6l3-4 3 4M9 18l3 4 3-4" />
          <path {...strokeProps} d="M7 4 5 8l2 4-2 4 2 4M17 4l2 4-2 4 2 4-2 4" />
          <path {...strokeProps} d="M9 9h6M9 15h6" />
        </>
      )
      break
    case 'rallying-banner':
      shape = (
        <>
          <path {...strokeProps} d="M6 21V3" />
          <path {...strokeProps} d="M6 4h13l-3 4 3 4H6" />
          <path {...strokeProps} d="M3 21h6M9 7h3M9 10h5" />
        </>
      )
      break
    case 'gravity-well':
      shape = (
        <>
          <ellipse {...strokeProps} cx="12" cy="12" rx="9" ry="4" transform="rotate(-25 12 12)" />
          <ellipse {...strokeProps} cx="12" cy="12" rx="6" ry="2.5" transform="rotate(-25 12 12)" />
          <circle fill="currentColor" cx="12" cy="12" r="2" />
          <circle fill="currentColor" cx="5" cy="7" r="1" />
        </>
      )
      break
    case 'aegis-pulse':
      shape = (
        <>
          <path {...strokeProps} d="m12 3 7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
          <path {...strokeProps} d="M8 13h2l1-3 2 5 1-3h2" />
          <path {...strokeProps} d="M4 5 2 3M20 5l2-2M4 19l-2 2M20 19l2 2" />
        </>
      )
      break
    case 'cinder-mine':
      shape = (
        <>
          <circle {...strokeProps} cx="12" cy="14" r="6" />
          <path {...strokeProps} d="M12 8V5M12 5c2-2 3-1 4 0M6 11l-2-2M18 11l2-2M6 17l-2 2M18 17l2 2" />
          <path {...strokeProps} d="m9 14 2 2 4-4" />
        </>
      )
      break
    case 'soul-tether':
      shape = (
        <>
          <circle {...strokeProps} cx="6" cy="12" r="3" />
          <circle {...strokeProps} cx="18" cy="12" r="3" />
          <path {...strokeProps} d="M9 12c2-6 4 6 6 0M9 12c2 6 4-6 6 0" />
          <path {...strokeProps} d="M6 9V7M18 17v-2" />
        </>
      )
      break
    case 'phantom-arsenal':
      shape = (
        <>
          <path {...strokeProps} d="M6 19 6 6l3-2v15M12 19V3l3 3v13M18 19V8l3-2v13" />
          <path {...strokeProps} d="M4 20h17M8 6l1-2M12 3l2-2M18 8l3-2" />
        </>
      )
      break
    case 'sigil-of-ruin':
      shape = (
        <>
          <path {...strokeProps} d="M3 12c3-5 15-5 18 0-3 5-15 5-18 0z" />
          <circle {...strokeProps} cx="12" cy="12" r="3" />
          <path {...strokeProps} d="m5 6 2 2M19 6l-2 2M5 18l2-2M19 18l-2-2" />
        </>
      )
      break
    case 'mirrorcast':
      shape = (
        <>
          <path {...strokeProps} d="M11 4 5 7v8l6 5zM13 4l6 3v8l-6 5z" />
          <path {...strokeProps} d="M12 4v16M8 9l3 2M16 9l-3 2M8 15l3-2M16 15l-3-2" />
        </>
      )
      break
    case 'critical-spellstrike':
      shape = (
        <>
          <circle {...strokeProps} cx="12" cy="12" r="7" />
          <circle {...strokeProps} cx="12" cy="12" r="2" />
          <path {...strokeProps} d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <path {...strokeProps} d="m8 16 8-8" />
        </>
      )
      break
    case 'razorwire':
      shape = (
        <>
          <path {...strokeProps} d="M3 8c4-4 6 4 9 0s5 4 9 0M3 16c4-4 6 4 9 0s5 4 9 0" />
          <path {...strokeProps} d="m6 6-2-3M12 7l-2-3M18 7l-2-3M6 18l-2 3M12 17l-2 3M18 17l-2 3" />
          <circle fill="currentColor" cx="3" cy="8" r="1" />
          <circle fill="currentColor" cx="21" cy="16" r="1" />
        </>
      )
      break
    case 'blood-rite':
      shape = (
        <>
          <path {...strokeProps} d="M7 10h10l-1 10H8zM5 10h14M9 7h6M10 4h4" />
          <path {...strokeProps} d="M12 10v7M9 13h6" />
          <path {...strokeProps} d="M19 14c2 2 1 4-1 5" />
        </>
      )
      break
    case 'prism-halo':
      shape = (
        <>
          <path {...strokeProps} d="m5 5 14 0-7 14z" />
          <path {...strokeProps} d="M5 5l7 14M19 5l-7 14" />
          <path {...strokeProps} d="M12 8h9M12 12h8M12 16h6" />
        </>
      )
      break
    default:
      shape = <path {...strokeProps} d="M5 5h14v14H5zM9 9h6v6H9z" />
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {shape}
    </svg>
  )
}
