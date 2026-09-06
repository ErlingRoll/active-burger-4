import { useEffect, useSyncExternalStore } from 'react'

export type MusicPlaylistId = 'dashboard' | 'fishing' | 'dungeon' | 'abyss'

export interface AudioSettings {
  masterVolume: number
  musicVolume: number
  effectsVolume: number
  muted: boolean
}

export type AudioChannel = 'masterVolume' | 'musicVolume' | 'effectsVolume'
export type AudioSettingsPatch = Partial<AudioSettings>

export const AUDIO_SETTINGS_STORAGE_KEY = 'active-burger:audio-settings'
export const MUSIC_FADE_SECONDS = 1.5

export const DEFAULT_AUDIO_SETTINGS: Readonly<AudioSettings> = Object.freeze({
  masterVolume: 1,
  musicVolume: 1,
  effectsVolume: 1,
  muted: false,
})

/**
 * Tracks are intentionally empty until authored audio files are added. The
 * controller still treats each playlist as a looping sequence when tracks
 * become available.
 */
export const MUSIC_PLAYLISTS: Readonly<Record<MusicPlaylistId, readonly string[]>> = {
  dashboard: [],
  fishing: [],
  dungeon: [],
  abyss: [],
}

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.min(1, Math.max(0, value))
}

export function normalizeAudioSettings(value: unknown): AudioSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ...DEFAULT_AUDIO_SETTINGS }
  }
  const candidate = value as Partial<AudioSettings>
  return {
    masterVolume: clampVolume(candidate.masterVolume, DEFAULT_AUDIO_SETTINGS.masterVolume),
    musicVolume: clampVolume(candidate.musicVolume, DEFAULT_AUDIO_SETTINGS.musicVolume),
    effectsVolume: clampVolume(candidate.effectsVolume, DEFAULT_AUDIO_SETTINGS.effectsVolume),
    muted: typeof candidate.muted === 'boolean' ? candidate.muted : DEFAULT_AUDIO_SETTINGS.muted,
  }
}

function readStoredAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_AUDIO_SETTINGS }
  }
  let stored: string | null
  try {
    stored = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY)
  } catch (error: unknown) {
    console.error('Unable to read saved audio settings.', error)
    return { ...DEFAULT_AUDIO_SETTINGS }
  }
  if (!stored) {
    return { ...DEFAULT_AUDIO_SETTINGS }
  }
  try {
    return normalizeAudioSettings(JSON.parse(stored) as unknown)
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS }
  }
}

function persistAudioSettings(settings: AudioSettings): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch (error: unknown) {
    console.error('Unable to save audio settings.', error)
  }
}

class BrowserAudioSystem {
  private settings = readStoredAudioSettings()
  private readonly listeners = new Set<() => void>()
  private playlistId: MusicPlaylistId | null = null
  private trackIndex = -1
  private audio: HTMLAudioElement | null = null
  private fadeGain = 0
  private fadeRequest = 0
  private transitioning = false

  constructor() {
    if (typeof window !== 'undefined') {
      const resumePlayback = (): void => {
        const audio = this.audio
        if (!audio) {
          return
        }
        void audio.play()
          .then(() => {
            if (this.fadeGain === 0) {
              this.fadeTo(1, MUSIC_FADE_SECONDS)
            }
          })
          .catch(() => undefined)
      }
      window.addEventListener('pointerdown', resumePlayback)
      window.addEventListener('keydown', resumePlayback)
    }
  }

  getSettings = (): AudioSettings => this.settings

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  updateSettings = (patch: AudioSettingsPatch): void => {
    const next = normalizeAudioSettings({ ...this.settings, ...patch })
    if (
      next.masterVolume === this.settings.masterVolume &&
      next.musicVolume === this.settings.musicVolume &&
      next.effectsVolume === this.settings.effectsVolume &&
      next.muted === this.settings.muted
    ) {
      return
    }
    this.settings = next
    persistAudioSettings(next)
    this.applyMusicVolume()
    for (const listener of this.listeners) {
      listener()
    }
  }

  setMusicPlaylist = (playlistId: MusicPlaylistId | null): void => {
    if (playlistId === this.playlistId) {
      return
    }
    this.playlistId = playlistId
    this.stopTrack()
    this.trackIndex = -1
    const playlist = playlistId === null ? [] : MUSIC_PLAYLISTS[playlistId]
    if (playlist.length > 0) {
      this.startTrack(0)
    }
  }

  playEffect = (source: string): void => {
    if (typeof Audio === 'undefined' || this.settings.muted) {
      return
    }
    const effect = new Audio(source)
    effect.volume = this.settings.masterVolume * this.settings.effectsVolume
    void effect.play().catch(() => undefined)
  }

  private getMusicVolume(): number {
    return this.settings.muted
      ? 0
      : this.settings.masterVolume * this.settings.musicVolume
  }

  private applyMusicVolume(): void {
    if (this.audio) {
      this.audio.volume = this.getMusicVolume() * this.fadeGain
    }
  }

  private stopTrack(): void {
    this.fadeRequest += 1
    this.transitioning = false
    if (!this.audio) {
      return
    }
    this.audio.removeEventListener('ended', this.handleTrackEnded)
    this.audio.removeEventListener('timeupdate', this.handleTrackTimeUpdate)
    this.audio.pause()
    this.audio.src = ''
    this.audio = null
    this.fadeGain = 0
  }

  private startTrack(index: number): void {
    const playlist = this.playlistId === null ? [] : MUSIC_PLAYLISTS[this.playlistId]
    const source = playlist[index]
    if (!source || typeof Audio === 'undefined') {
      return
    }
    this.trackIndex = index
    const audio = new Audio(source)
    audio.preload = 'auto'
    audio.volume = 0
    audio.addEventListener('ended', this.handleTrackEnded)
    audio.addEventListener('timeupdate', this.handleTrackTimeUpdate)
    this.audio = audio
    this.fadeGain = 0
    void audio.play()
      .then(() => {
        this.fadeTo(1, MUSIC_FADE_SECONDS)
      })
      .catch(() => undefined)
  }

  private handleTrackEnded = (): void => {
    this.transitionToNextTrack()
  }

  private handleTrackTimeUpdate = (): void => {
    const audio = this.audio
    if (
      !audio ||
      this.transitioning ||
      !Number.isFinite(audio.duration) ||
      audio.duration - audio.currentTime > MUSIC_FADE_SECONDS
    ) {
      return
    }
    this.transitionToNextTrack()
  }

  private transitionToNextTrack(): void {
    if (this.transitioning || !this.audio || this.playlistId === null) {
      return
    }
    const playlist = MUSIC_PLAYLISTS[this.playlistId]
    if (playlist.length === 0) {
      return
    }
    this.transitioning = true
    const previousAudio = this.audio
    this.fadeTo(0, MUSIC_FADE_SECONDS, () => {
      if (this.audio !== previousAudio) {
        return
      }
      previousAudio.pause()
      previousAudio.removeEventListener('ended', this.handleTrackEnded)
      previousAudio.removeEventListener('timeupdate', this.handleTrackTimeUpdate)
      const nextIndex = (this.trackIndex + 1) % playlist.length
      this.audio = null
      this.transitioning = false
      this.startTrack(nextIndex)
    })
  }

  private fadeTo(target: number, durationSeconds: number, onComplete?: () => void): void {
    if (!this.audio || typeof window === 'undefined') {
      return
    }
    const request = ++this.fadeRequest
    const initial = this.fadeGain
    const startedAt = performance.now()
    const durationMs = durationSeconds * 1000
    const step = (now: number): void => {
      if (request !== this.fadeRequest || !this.audio) {
        return
      }
      const progress = durationMs === 0
        ? 1
        : Math.min(1, (now - startedAt) / durationMs)
      this.fadeGain = initial + (target - initial) * progress
      this.applyMusicVolume()
      if (progress >= 1) {
        onComplete?.()
        return
      }
      window.requestAnimationFrame(step)
    }
    window.requestAnimationFrame(step)
  }
}

export const audioSystem = new BrowserAudioSystem()

export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(
    audioSystem.subscribe,
    audioSystem.getSettings,
    () => DEFAULT_AUDIO_SETTINGS,
  )
}

export function updateAudioSettings(patch: AudioSettingsPatch): void {
  audioSystem.updateSettings(patch)
}

export function useMusicPlaylist(playlistId: MusicPlaylistId | null): void {
  useEffect(() => {
    audioSystem.setMusicPlaylist(playlistId)
  }, [playlistId])
}
