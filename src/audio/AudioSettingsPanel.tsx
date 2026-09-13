import { useId } from 'react'
import { updateAudioSettings, useAudioSettings, type AudioChannel } from './AudioSystem'
import { playUiSound, previewVolumeTick } from './UiSounds'

const AUDIO_CHANNELS: ReadonlyArray<{
  id: AudioChannel
  label: string
}> = [
  { id: 'masterVolume', label: 'Master' },
  { id: 'musicVolume', label: 'Music' },
  { id: 'effectsVolume', label: 'Effects' },
]

export function AudioSettingsPanel() {
  const settings = useAudioSettings()
  const titleId = useId()

  return (
    <fieldset className="audio-settings-panel">
      <legend id={titleId}>Audio</legend>
      <div className="audio-channel-list">
        {AUDIO_CHANNELS.map((channel) => {
          const value = settings[channel.id]
          const inputId = `${titleId}-${channel.id}`
          return (
            <div className="audio-channel-row" key={channel.id}>
              <label htmlFor={inputId}>
                <span>{channel.label}</span>
                <output htmlFor={inputId}>{Math.round(value * 100)}%</output>
              </label>
              <input
                id={inputId}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={value}
                onChange={(event) => {
                  updateAudioSettings({ [channel.id]: Number(event.target.value) })
                  // Settings apply synchronously, so the tick plays at the new
                  // level; the music channel is silent here by design.
                  if (channel.id !== 'musicVolume') {
                    previewVolumeTick()
                  }
                }}
              />
            </div>
          )
        })}
      </div>
      <button
        className="audio-mute-button"
        type="button"
        data-sfx="none"
        aria-pressed={settings.muted}
        onClick={() => {
          // Muting plays its tick first, riding the gain's short ramp down;
          // unmuting plays once the gain is back so it can be heard.
          if (!settings.muted) {
            playUiSound('mute')
          }
          updateAudioSettings({ muted: !settings.muted })
          if (settings.muted) {
            playUiSound('unmute')
          }
        }}
      >
        {settings.muted ? 'Unmute audio' : 'Mute audio'}
      </button>
    </fieldset>
  )
}
