/**
 * Tiny WebAudio synthesiser: every sound is generated, so there are no audio
 * files to download and the game stays installable/offline. Calls are throttled
 * per sound so hundreds of collisions never flood the audio thread.
 */
type SfxName = 'coin' | 'gate' | 'mult' | 'bumper' | 'buy' | 'deny' | 'level' | 'orb' | 'wheel' | 'pop' | 'jackpot' | 'click';

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private last = new Map<SfxName, number>();
  enabled = true;

  /** Must be called from a user gesture on iOS. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private ready(name: SfxName, minGapMs: number): AudioContext | null {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return null;
    const now = performance.now();
    const prev = this.last.get(name) ?? 0;
    if (now - prev < minGapMs) return null;
    this.last.set(name, now);
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start();
  }

  play(name: SfxName, intensity = 1) {
    switch (name) {
      case 'coin': {
        if (!this.ready(name, 40)) return;
        const base = 1300 + Math.min(intensity, 10) * 90 + Math.random() * 80;
        this.tone(base, 0.09, 'square', 0.05);
        this.tone(base * 1.5, 0.16, 'sine', 0.09, 0.045);
        return;
      }
      case 'jackpot': {
        if (!this.ready(name, 120)) return;
        [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, i * 0.06));
        return;
      }
      case 'gate':
        if (!this.ready(name, 50)) return;
        this.tone(880, 0.12, 'triangle', 0.08, 0, 1760);
        return;
      case 'mult':
        if (!this.ready(name, 60)) return;
        this.tone(660, 0.1, 'sawtooth', 0.04, 0, 1320);
        this.tone(1320, 0.18, 'sine', 0.08, 0.05);
        return;
      case 'bumper':
        if (!this.ready(name, 60)) return;
        this.tone(300, 0.14, 'sine', 0.14, 0, 620);
        return;
      case 'pop':
        if (!this.ready(name, 50)) return;
        this.tone(500, 0.07, 'sine', 0.08, 0, 900);
        return;
      case 'click':
        if (!this.ready(name, 30)) return;
        this.tone(1200, 0.04, 'square', 0.03);
        return;
      case 'buy':
        if (!this.ready(name, 60)) return;
        this.tone(784, 0.1, 'triangle', 0.12);
        this.tone(1175, 0.18, 'triangle', 0.12, 0.07);
        return;
      case 'deny':
        if (!this.ready(name, 120)) return;
        this.tone(220, 0.16, 'square', 0.05, 0, 160);
        return;
      case 'wheel':
        if (!this.ready(name, 100)) return;
        this.noise(0.18, 0.4, 900);
        this.tone(196, 0.3, 'triangle', 0.15, 0.02);
        this.tone(392, 0.3, 'triangle', 0.1, 0.1);
        return;
      case 'orb':
        if (!this.ready(name, 200)) return;
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.12, i * 0.05));
        return;
      case 'level':
        if (!this.ready(name, 300)) return;
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, i * 0.09));
        this.tone(1568, 0.5, 'sine', 0.1, 0.36);
        return;
    }
  }
}

export const sfx = new Sfx();
