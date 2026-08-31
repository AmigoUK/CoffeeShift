/**
 * WebAudio-synthesised sound effects — no audio files. All sounds are gated
 * by the `enabled` flag, which mirrors settings.sound.
 */
class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private extractionNodes: { osc: OscillatorNode; noise: AudioBufferSourceNode; gain: GainNode } | null = null;
  private steamNodes: { noise: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;

  private context(): AudioContext | null {
    if (!this.enabled) return null;
    if (this.ctx == null) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Espresso trickle: quiet high noise + low tone while extracting. */
  startExtraction(): void {
    const ctx = this.context();
    if (ctx == null || this.extractionNodes != null) return;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    gain.connect(ctx.destination);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2400;
    filter.Q.value = 1.2;
    filter.connect(gain);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx);
    noise.loop = true;
    noise.connect(filter);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 180;
    osc.connect(gain);
    noise.start();
    osc.start();
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.15);
    this.extractionNodes = { osc, noise, gain };
  }

  stopExtraction(): void {
    const nodes = this.extractionNodes;
    const ctx = this.ctx;
    if (nodes == null || ctx == null) return;
    this.extractionNodes = null;
    nodes.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
    setTimeout(() => {
      try {
        nodes.noise.stop();
        nodes.osc.stop();
      } catch {
        /* already stopped */
      }
    }, 200);
  }

  /** Steam hiss: filtered noise whose pitch tracks wand depth. */
  startSteam(): void {
    const ctx = this.context();
    if (ctx == null || this.steamNodes != null) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;
    filter.connect(gain);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx);
    noise.loop = true;
    noise.connect(filter);
    noise.start();
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.2);
    this.steamNodes = { noise, filter, gain };
  }

  setSteamDepth(deep: boolean): void {
    if (this.steamNodes?.filter != null && this.ctx != null) {
      this.steamNodes.filter.frequency.setTargetAtTime(deep ? 500 : 1400, this.ctx.currentTime, 0.1);
    }
  }

  stopSteam(): void {
    const nodes = this.steamNodes;
    const ctx = this.ctx;
    if (nodes == null || ctx == null) return;
    this.steamNodes = null;
    nodes.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    setTimeout(() => {
      try {
        nodes.noise.stop();
      } catch {
        /* already stopped */
      }
    }, 250);
  }

  /** Cup-on-saucer clink on Serve. */
  clink(): void {
    const ctx = this.context();
    if (ctx == null) return;
    for (const [delay, freq] of [
      [0, 1720],
      [0.07, 2380],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.15);
    }
  }

  success(): void {
    this.chimes([523.25, 659.25, 783.99]);
  }

  failure(): void {
    this.chimes([392, 311.13]);
  }

  private chimes(freqs: number[]): void {
    const ctx = this.context();
    if (ctx == null) return;
    freqs.forEach((freq, i) => {
      const delay = i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.14, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.35);
    });
  }
}

export const sfx = new Sfx();
