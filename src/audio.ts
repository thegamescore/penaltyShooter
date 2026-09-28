export class MatchAudio {
  private context?: AudioContext;
  muted = false;
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  }
  play(kind: "kick" | "goal" | "save" | "miss") {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const ctx = this.context;
    const notes =
      kind === "goal"
        ? [392, 494, 587, 784]
        : kind === "save"
          ? [160, 100]
          : kind === "miss"
            ? [220, 165]
            : [100];
    notes.forEach((frequency, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * 0.1;
      oscillator.type = kind === "kick" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.13, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.23);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.25);
    });
    if (kind === "goal" || kind === "kick" || kind === "save") {
      const duration = kind === "goal" ? 0.8 : 0.12;
      const buffer = ctx.createBuffer(
        1,
        ctx.sampleRate * duration,
        ctx.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.value = kind === "goal" ? 1600 : 450;
      gain.gain.value = kind === "goal" ? 0.18 : 0.4;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
    }
  }
  suspend() {
    void this.context?.suspend().catch(() => {});
  }
}
