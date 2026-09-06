import { useId } from 'react'
import { updateAudioSettings, useAudioSettings, type AudioChannel } from './AudioSystem'

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
                }}
              />
            </div>
          )
        })}
      </div>
      <button
        className="audio-mute-button"
        type="button"
        aria-pressed={settings.muted}
        onClick={() => { updateAudioSettings({ muted: !settings.muted }) }}
      >
        {settings.muted ? 'Unmute audio' : 'Mute audio'}
      </button>
    </fieldset>
  )
}
