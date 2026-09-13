import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioContextStateLike,
  AudioNodeLike,
  AudioParamLike,
  BiquadFilterNodeLike,
  EndedHandlerLike,
  GainNodeLike,
  OscillatorNodeLike,
} from '../AudioContextLike'

/**
 * A recording stand-in for the Web Audio API.
 *
 * Nothing is synthesized; every node remembers what was scheduled on it so a
 * test can assert on envelopes, frequencies and start/stop times, and the
 * context counts the nodes it handed out so a test can prove that a muted
 * player builds none.
 */

export interface ScheduledParamEvent {
  method: 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime' | 'setTargetAtTime' | 'cancelScheduledValues'
  value: number
  time: number
  timeConstant?: number
}

export class FakeAudioParam implements AudioParamLike {
  readonly events: ScheduledParamEvent[] = []
  value: number

  constructor(value: number) {
    this.value = value
  }

  setValueAtTime(value: number, startTime: number): this {
    this.events.push({ method: 'setValueAtTime', value, time: startTime })
    this.value = value
    return this
  }

  linearRampToValueAtTime(value: number, endTime: number): this {
    this.events.push({ method: 'linearRampToValueAtTime', value, time: endTime })
    this.value = value
    return this
  }

  exponentialRampToValueAtTime(value: number, endTime: number): this {
    this.events.push({ method: 'exponentialRampToValueAtTime', value, time: endTime })
    this.value = value
    return this
  }

  setTargetAtTime(target: number, startTime: number, timeConstant: number): this {
    this.events.push({ method: 'setTargetAtTime', value: target, time: startTime, timeConstant })
    this.value = target
    return this
  }

  cancelScheduledValues(cancelTime: number): this {
    this.events.push({ method: 'cancelScheduledValues', value: Number.NaN, time: cancelTime })
    return this
  }
}

export class FakeAudioNode implements AudioNodeLike {
  readonly connections: AudioNodeLike[] = []
  disconnected = false

  connect(destination: AudioNodeLike): AudioNodeLike {
    this.connections.push(destination)
    return destination
  }

  disconnect(): void {
    this.disconnected = true
  }
}

export class FakeGainNode extends FakeAudioNode implements GainNodeLike {
  readonly gain = new FakeAudioParam(1)
}

export class FakeScheduledSource extends FakeAudioNode {
  startedAt: number | undefined
  stoppedAt: number | undefined
  onended: EndedHandlerLike | null = null

  /** Fires the ended handler the way the browser would once the source stops. */
  end(): void {
    (this.onended as (() => void) | null)?.()
  }

  start(when = 0): void {
    this.startedAt = when
  }

  stop(when = 0): void {
    this.stoppedAt = when
  }
}

export class FakeOscillatorNode extends FakeScheduledSource implements OscillatorNodeLike {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeAudioParam(440)
  readonly detune = new FakeAudioParam(0)
}

export class FakeBiquadFilterNode extends FakeAudioNode implements BiquadFilterNodeLike {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeAudioParam(350)
  readonly Q = new FakeAudioParam(1)
}

export class FakeAudioBuffer implements AudioBufferLike {
  private readonly channels: Float32Array[]
  readonly length: number

  constructor(numberOfChannels: number, length: number) {
    this.length = length
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
  }

  getChannelData(channel: number): Float32Array {
    const data = this.channels[channel]
    if (!data) {
      throw new RangeError(`No channel ${channel}`)
    }
    return data
  }
}

export class FakeAudioBufferSourceNode
  extends FakeScheduledSource
  implements AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null = null
  loop = false
  readonly playbackRate = new FakeAudioParam(1)
}

export class FakeAudioContext implements AudioContextLike {
  currentTime = 0
  readonly sampleRate = 48_000
  state: AudioContextStateLike
  readonly destination = new FakeAudioNode()
  readonly oscillators: FakeOscillatorNode[] = []
  readonly gains: FakeGainNode[] = []
  readonly filters: FakeBiquadFilterNode[] = []
  readonly bufferSources: FakeAudioBufferSourceNode[] = []
  readonly buffers: FakeAudioBuffer[] = []
  resumeCalls = 0
  closeCalls = 0

  constructor(state: AudioContextStateLike = 'running') {
    this.state = state
  }

  /** Every node created so far, in creation order across the four kinds. */
  get nodeCount(): number {
    return this.oscillators.length + this.gains.length +
      this.filters.length + this.bufferSources.length
  }

  /** Takes effect on a later microtask, as a real resume does. */
  resume(): Promise<void> {
    this.resumeCalls += 1
    return Promise.resolve().then(() => {
      if (this.state !== 'closed') {
        this.state = 'running'
      }
    })
  }

  close(): Promise<void> {
    this.closeCalls += 1
    this.state = 'closed'
    return Promise.resolve()
  }

  createGain(): FakeGainNode {
    const node = new FakeGainNode()
    this.gains.push(node)
    return node
  }

  createOscillator(): FakeOscillatorNode {
    const node = new FakeOscillatorNode()
    this.oscillators.push(node)
    return node
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    const node = new FakeBiquadFilterNode()
    this.filters.push(node)
    return node
  }

  createBuffer(numberOfChannels: number, length: number): FakeAudioBuffer {
    const buffer = new FakeAudioBuffer(numberOfChannels, length)
    this.buffers.push(buffer)
    return buffer
  }

  createBufferSource(): FakeAudioBufferSourceNode {
    const node = new FakeAudioBufferSourceNode()
    this.bufferSources.push(node)
    return node
  }
}
