type Sound = "kick" | "goal" | "save" | "miss" | "ready";
type Note = readonly [frequency: number, delay: number, duration: number];

const melodies: Record<Exclude<Sound, "kick">, readonly Note[]> = {
  goal: [
    [523.25, 0, 0.09],
    [659.25, 0.09, 0.09],
    [783.99, 0.18, 0.09],
    [1046.5, 0.3, 0.3],
  ],
  save: [[293.66, 0, 0.1], [196, 0.11, 0.18]],
  miss: [[329.63, 0, 0.13], [261.63, 0.14, 0.13], [164.81, 0.28, 0.24]],
  ready: [[523.25, 0, 0.055], [783.99, 0.075, 0.09]],
};

export class MatchAudio {
  private context?: AudioContext;
  private output?: GainNode;
  private noise?: AudioBuffer;
  private sources = new Set<AudioScheduledSourceNode>();
  private silent = false;
  private generation = 0;

  get muted() {
    return this.silent;
  }

  set muted(value: boolean) {
    this.silent = value;
    if (value) this.stop();
    if (this.context && this.output)
      this.output.gain.setValueAtTime(value ? 0 : 0.55, this.context.currentTime);
  }

  unlock() {
    try {
      if (!this.context) {
        const ctx = new AudioContext();
        this.context = ctx;
        this.output = ctx.createGain();
        this.output.gain.value = this.muted ? 0 : 0.55;
        this.output.connect(ctx.destination);
        this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  }

  play(kind: Sound) {
    if (this.muted || !this.context || !this.output) return;
    const ctx = this.context;
    const generation = this.generation;
    const schedule = () => {
      if (this.muted || generation !== this.generation || ctx.state !== "running")
        return;
      const at = ctx.currentTime + 0.005;
      if (kind === "kick") {
        this.tone(180, at, 0.16, "triangle", 0.65, 42);
        this.burst(at, 0.075, 1300, 0.3);
        return;
      }
      for (const [frequency, delay, duration] of melodies[kind])
        this.tone(
          frequency, at + delay, duration, "square",
          kind === "ready" ? 0.07 : 0.12,
        );
      if (kind === "goal") {
        this.tone(130.81, at, 0.18, "triangle", 0.28);
        this.tone(261.63, at + 0.3, 0.32, "triangle", 0.25);
        this.burst(at, 0.13, 3200, 0.12);
        this.burst(at + 0.3, 0.2, 4200, 0.1);
      } else if (kind === "save") {
        this.tone(210, at, 0.19, "triangle", 0.45, 65);
        this.burst(at, 0.12, 850, 0.4);
      } else if (kind === "miss") {
        this.tone(165, at + 0.28, 0.25, "triangle", 0.2, 75);
      }
    };
    // The first keyboard shot can happen before the browser finishes unlocking audio.
    if (ctx.state === "suspended") void ctx.resume().then(schedule).catch(() => {});
    else schedule();
  }

  private tone(
    frequency: number,
    at: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency?: number,
  ) {
    const ctx = this.context!;
    const source = ctx.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(frequency, at);
    if (endFrequency)
      source.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    this.voice(source, at, duration, volume);
  }

  private burst(at: number, duration: number, frequency: number, volume: number) {
    const ctx = this.context!;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    source.buffer = this.noise!;
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    source.connect(filter);
    this.voice(source, at, duration, volume, filter);
  }

  private voice(
    source: AudioScheduledSourceNode,
    at: number,
    duration: number,
    volume: number,
    node: AudioNode = source,
  ) {
    const gain = this.context!.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    gain.gain.linearRampToValueAtTime(0, at + duration + 0.01);
    node.connect(gain).connect(this.output!);
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();
      if (node !== source) node.disconnect();
      gain.disconnect();
      this.sources.delete(source);
    };
    source.start(at);
    source.stop(at + duration + 0.015);
  }

  private stop() {
    this.generation++;
    for (const source of this.sources) source.stop();
    this.sources.clear();
  }

  suspend() {
    this.stop();
    void this.context?.suspend().catch(() => {});
  }
}
