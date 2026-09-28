import type { GameEvent } from '../../domain/model/types';
import { GameEventType } from '../../domain/model/types';

/**
 * Effets sonores synthétisés avec la Web Audio API : aucun fichier à charger.
 * Le contexte audio n'est créé qu'après une action du joueur (règle des navigateurs).
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private last = new Map<string, number>();

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  /** Limite la fréquence d'un même son pour éviter la cacophonie en vitesse x3. */
  private gate(key: string, minGap: number): boolean {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    if (now - (this.last.get(key) ?? -1) < minGap) return false;
    this.last.set(key, now);
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  play(events: GameEvent[]): void {
    if (!this.ctx || this.muted) return;
    for (const e of events) {
      switch (e.t) {
        case GameEventType.Fire:
          if (e.family === 'cannon' && this.gate('cannon', 0.12)) this.noise(0.18, 0.5, 600);
          else if (e.family === 'archer' && this.gate('arrow', 0.09)) this.tone(900, 0.05, 'triangle', 0.08, 500);
          else if (e.family === 'frost' && this.gate('frost', 0.12)) this.tone(1500, 0.12, 'sine', 0.06, 2200);
          else if (e.family === 'venom' && this.gate('venom', 0.14)) this.tone(260, 0.1, 'sine', 0.07, 140);
          break;
        case GameEventType.Chain:
          if (this.gate('zap', 0.1)) this.noise(0.12, 0.25, 4000);
          break;
        case GameEventType.Kill:
          if (e.boss) {
            this.tone(220, 0.6, 'sawtooth', 0.15, 55);
            this.noise(0.6, 0.6, 400);
          } else if (this.gate('kill', 0.06)) this.tone(520, 0.08, 'square', 0.05, 260);
          break;
        case GameEventType.Leak:
          this.tone(110, 0.35, 'sawtooth', 0.18, 70);
          break;
        case GameEventType.Built:
          this.noise(0.1, 0.4, 900);
          this.tone(180, 0.1, 'triangle', 0.15, 120);
          break;
        case GameEventType.Upgraded:
          this.tone(520, 0.12, 'triangle', 0.12);
          this.tone(780, 0.18, 'triangle', 0.12, undefined, 0.08);
          break;
        case GameEventType.Sold:
          this.tone(1200, 0.08, 'square', 0.06);
          this.tone(1600, 0.1, 'square', 0.06, undefined, 0.06);
          break;
        case GameEventType.Destroyed:
          this.noise(0.18, 0.5, 600);
          break;
        case GameEventType.WaveStart:
          // Cor de guerre : deux quintes superposées.
          this.tone(e.boss ? 98 : 147, 0.9, 'sawtooth', 0.12);
          this.tone(e.boss ? 147 : 220, 0.9, 'sawtooth', 0.08);
          break;
        case GameEventType.WaveCleared:
          this.tone(660, 0.12, 'triangle', 0.1);
          this.tone(880, 0.2, 'triangle', 0.1, undefined, 0.1);
          break;
        case GameEventType.Victory:
          [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.14, undefined, i * 0.15));
          break;
        case GameEventType.Defeat:
          [330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.12, undefined, i * 0.2));
          break;
        default:
          break;
      }
    }
  }

  error(): void {
    if (this.gate('err', 0.15)) this.tone(160, 0.12, 'square', 0.08);
  }

  click(): void {
    this.tone(700, 0.04, 'triangle', 0.05);
  }
}
