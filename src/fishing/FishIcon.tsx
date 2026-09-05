import type { CSSProperties } from 'react'

export type FishIconId =
  | 'river-minnow'
  | 'reed-darter'
  | 'glassfin-trout'
  | 'silver-perch'
  | 'lantern-pike'
  | 'moon-carp'
  | 'tideback-catfish'
  | 'revival-koi'
  | 'comet-eel'
  | 'star-koi'

interface FishIconProps {
  icon: FishIconId
  color?: string
}

export function FishIcon({ icon, color }: FishIconProps) {
  const style: CSSProperties | undefined = color ? { color } : undefined

  switch (icon) {
    case 'river-minnow':
      return (
        <svg className="fish-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="currentColor" d="M7 12c1-4 6-6 12-5 4 .5 7 2.5 8 5-1 2.5-4 4.5-8 5-6 1-11-1-12-5Z" />
          <path fill="currentColor" d="m7 12-6-5v10l6-5Z" />
          <circle cx="23" cy="10" r="1" fill="#07111f" />
        </svg>
      )
    case 'reed-darter':
      return (
        <svg className="fish-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="currentColor" d="M3 12c3-3 8-5 16-4 4 .5 7 2 10 4-3 2-6 3.5-10 4-8 1-13-1-16-4Z" />
          <path fill="currentColor" d="m5 12-4-4v8l4-4Zm10-4 3-6 2 7Zm0 8 3 6 2-7Z" />
          <circle cx="25" cy="10" r="1" fill="#07111f" />
        </svg>
      )
    case 'glassfin-trout':
      return (
        <svg className="fish-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="currentColor" d="M5 12c1-5 6-8 12-7 5 1 8 4 10 7-2 3-5 6-10 7-6 1-11-2-12-7Z" />
          <path fill="currentColor" d="m6 12-5-5v10l5-5Zm10-6 3-5 2 6Zm0 12 3 5 2-6Z" />
          <circle cx="22" cy="9" r="1" fill="#07111f" />
          <circle cx="15" cy="10" r="1" fill="#07111f" opacity=".45" />
          <circle cx="18" cy="14" r="1" fill="#07111f" opacity=".45" />
        </svg>
      )
    case 'silver-perch':
      return (
        <svg className="fish-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="currentColor" d="M7 12c0-5 4-8 9-8 6 0 10 3 12 8-2 5-6 8-12 8-5 0-9-3-9-8Z" />
          <path fill="currentColor" d="m7 12-6-5v10l6-5Zm4-7 5-4 1 6Zm0 14 5 4 1-6Z" />
          <path d="M13 5v14m4-15v16" stroke="#07111f" strokeWidth="1" opacity=".35" />
          <circle cx="24" cy="9" r="1" fill="#07111f" />
        </svg>
      )
    case 'lantern-pike':
      return (
        <svg className="fish-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="currentColor" d="M1 12c4-3 9-5 18-4 4 .5 7 2 10 4-3 2-6 3.5-10 4-9 1-14-1-18-4Z" />
          <path fill="currentColor" d="m5 12-4-4v8l4-4Zm11-4 2-6 3 7Zm0 8 2 6 3-7Z" />
          <circle cx="24" cy="10" r="1" fill="#07111f" />
          <circle cx="27" cy="14" r="1.5" fill="currentColor" opacity=".55" />
        </svg>
      )
    case 'moon-carp':
      return (
        <svg className="fish-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="currentColor" d="M6 12c0-4 4-7 10-7 6 0 10 3 11 7-1 4-5 7-11 7-6 0-10-3-10-7Z" />
          <path fill="currentColor" d="m6 12-5-5v10l5-5Zm7-7 3-5 3 6Zm0 14 3 5 3-6Z" />
          <path d="M24 8a3 3 0 1 0 0 6 4 4 0 1 1 0-6Z" fill="#07111f" opacity=".65" />
          <circle cx="22" cy="10" r="1" fill="#07111f" />
        </svg>
      )
    case 'tideback-catfish':
      return (
        <svg className="fish-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="currentColor" d="M5 12c1-4 5-7 11-7 6 0 10 3 11 7-1 4-5 7-11 7-6 0-10-3-11-7Z" />
          <path fill="currentColor" d="m5 12-4-5v10l4-5Zm7-6 3-5 2 6Zm0 12 3 5 2-6Z" />
          <path d="M26 12c3-3 4-3 5-3m-5 3c3 3 4 3 5 3" stroke="currentColor" strokeWidth="1" fill="none" />
          <circle cx="23" cy="10" r="1" fill="#07111f" />
        </svg>
      )
    case 'revival-koi':
      return (
        <svg className="fish-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="currentColor" d="M5 12c1-4 5-7 11-7 6 0 10 3 11 7-1 4-5 7-11 7-6 0-10-3-11-7Z" />
          <path fill="currentColor" d="m5 12-4-6v12l4-6Zm8-6 4-5 2 7Zm0 12 4 5 2-7Z" />
          <path d="M11 8c2 1 2 2 0 3m0 2c2 1 2 2 0 3" stroke="#07111f" strokeWidth="1.5" fill="none" opacity=".5" />
          <circle cx="23" cy="10" r="1" fill="#07111f" />
        </svg>
      )
    case 'comet-eel':
      return (
        <svg className="fish-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path d="M2 16c4-8 8-9 12-5s7 4 16-3" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d="m25 6 2-4m1 5 3-1m-4 3 2 3" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <circle cx="27" cy="8" r="1" fill="#07111f" />
        </svg>
      )
    case 'star-koi':
      return (
        <svg className="fish-icon" viewBox="0 0 32 24" aria-hidden="true" style={style}>
          <path fill="currentColor" d="M5 12c1-4 5-7 11-7 6 0 10 3 11 7-1 4-5 7-11 7-6 0-10-3-11-7Z" />
          <path fill="currentColor" d="m5 12-5-5v10l5-5Zm8-6 4-5 2 7Zm0 12 4 5 2-7Z" />
          <path d="m16 8 .9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3Z" fill="#07111f" opacity=".55" />
          <circle cx="23" cy="10" r="1" fill="#07111f" />
        </svg>
      )
  }
}
