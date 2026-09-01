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
          <path {...strokeProps} d="M4 20 19 5" />
          <path {...strokeProps} d="m14 4 6 1-1 6" />
          <path {...strokeProps} d="m7 17 3 3" />
          <path {...strokeProps} d="m5 19 2-2" />
        </>
      )
      break
    case 'whirlwind':
      shape = (
        <>
          <path {...strokeProps} d="M4 8c5-5 12-4 16 0" />
          <path {...strokeProps} d="M20 16c-5 5-12 4-16 0" />
          <path {...strokeProps} d="m7 5-3 3 4 1M17 19l3-3-4-1" />
        </>
      )
      break
    case 'chain-lightning':
    case 'storm-relay':
      shape = (
        <>
          <path {...strokeProps} d="m13 2-8 11h6l-1 9 9-13h-6z" />
          <path {...strokeProps} d="M3 18h3M18 6h3" />
        </>
      )
      break
    case 'vitality':
      shape = (
        <>
          <path {...strokeProps} d="M12 21C5 16 4 10 7 7c2-2 4 0 5 2 1-2 3-4 5-2 3 3 2 9-5 14z" />
          <path {...strokeProps} d="M12 7v8M8 11h8" />
        </>
      )
      break
    case 'raise-skeleton':
      shape = (
        <>
          <path {...strokeProps} d="M7 8a5 5 0 0 1 10 0v6l-2 2H9l-2-2z" />
          <path {...strokeProps} d="M9 11h.1M15 11h.1M9 14h6M12 16v4M8 20h8" />
        </>
      )
      break
    case 'fiery-touch':
      shape = (
        <>
          <path {...strokeProps} d="M12 21c-5-3-6-7-3-11 0 3 2 3 3 5 1-4 2-7 1-10 5 4 7 9 4 13-1 2-3 3-5 3z" />
          <path {...strokeProps} d="M12 16c-1-2 0-3 1-4 2 3 1 5-1 6" />
        </>
      )
      break
    case 'glacial-orb':
      shape = (
        <>
          <path {...strokeProps} d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
          <path {...strokeProps} d="M12 5v14M5 12h14" />
        </>
      )
      break
    case 'lancers-charge':
    case 'rift-javelin':
      shape = (
        <>
          <path {...strokeProps} d="M3 20 20 3" />
          <path {...strokeProps} d="m14 3 6 0-1 6" />
          <path {...strokeProps} d="m6 17 4 4M4 19l2-2" />
        </>
      )
      break
    case 'rallying-banner':
      shape = (
        <>
          <path {...strokeProps} d="M6 21V3" />
          <path {...strokeProps} d="M6 4h12l-3 4 3 4H6" />
          <path {...strokeProps} d="M3 21h6" />
        </>
      )
      break
    case 'gravity-well':
      shape = (
        <>
          <path {...strokeProps} d="M12 3a9 9 0 1 1-8 5" />
          <path {...strokeProps} d="M12 7a5 5 0 1 1-4 3" />
          <path {...strokeProps} d="M12 11a1 1 0 1 1 0 2" />
        </>
      )
      break
    case 'aegis-pulse':
      shape = (
        <>
          <path {...strokeProps} d="m12 2 8 3v6c0 5-3 8-8 11-5-3-8-6-8-11V5z" />
          <path {...strokeProps} d="M12 7v9M8 11h8" />
        </>
      )
      break
    case 'cinder-mine':
      shape = (
        <>
          <path {...strokeProps} d="m12 2 8 4v8l-8 8-8-8V6z" />
          <path {...strokeProps} d="m12 6 3 3-3 3-3-3zM4 10h4M16 10h4M12 13v5" />
        </>
      )
      break
    case 'soul-tether':
      shape = (
        <>
          <path {...strokeProps} d="M8 8 5 5a3 3 0 0 0-4 4l4 4a3 3 0 0 0 4 0M16 16l3 3a3 3 0 0 0 4-4l-4-4a3 3 0 0 0-4 0" />
          <path {...strokeProps} d="m8 16 8-8" />
        </>
      )
      break
    case 'phantom-arsenal':
      shape = (
        <>
          <path {...strokeProps} d="M12 21c-5-2-7-6-7-11 2 1 3 0 4-2 1 1 2 1 3 0 1 2 2 3 4 2 1 5-1 9-4 11z" />
          <path {...strokeProps} d="M9 12h6M12 9v8" />
        </>
      )
      break
    case 'sigil-of-ruin':
      shape = (
        <>
          <path {...strokeProps} d="m12 2 9 16H3z" />
          <path {...strokeProps} d="m12 7 4 7H8zM12 14v5" />
        </>
      )
      break
    case 'mirrorcast':
      shape = (
        <>
          <path {...strokeProps} d="m12 2 8 10-8 10-8-10z" />
          <path {...strokeProps} d="m12 6 4 6-4 6-4-6zM3 4l3 3M21 4l-3 3" />
        </>
      )
      break
    case 'razorwire':
      shape = (
        <>
          <path {...strokeProps} d="M3 17 21 7" />
          <path {...strokeProps} d="m6 15-2-4M10 13l-2-4M14 11l-2-4M18 9l-2-4" />
          <path {...strokeProps} d="M3 17h4M17 7h4" />
        </>
      )
      break
    case 'blood-rite':
      shape = (
        <>
          <path {...strokeProps} d="M12 2c3 5 7 8 7 12a7 7 0 1 1-14 0c0-4 4-7 7-12z" />
          <path {...strokeProps} d="M12 9v7M8.5 12.5h7" />
        </>
      )
      break
    case 'prism-halo':
      shape = (
        <>
          <path {...strokeProps} d="M12 12 5 4l-2 8 9 8 9-8-2-8z" />
          <path {...strokeProps} d="m12 12 4-8M12 12l-4 8M12 12l9 0" />
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
