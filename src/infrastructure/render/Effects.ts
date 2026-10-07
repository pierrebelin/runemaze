import { CREEPS } from '../../domain/catalog/creeps';
import type { GameEvent } from '../../domain/model/types';
import { FAMILY_COLOR, PAL } from './palette';
import { GameEventType } from '../../domain/model/types';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Floater { x: number; y: number; text: string; color: string; life: number; big: boolean }
interface Bolt { points: { x: number; y: number }[]; life: number; seed: number }
interface Ring { x: number; y: number; r: number; life: number; max: number; color: string }

/** Durée d'affichage de la bannière de vague, en secondes. */
export const BANNER_LIFE = 4;

/** Effets visuels éphémères, alimentés par les événements de la simulation. */
export class Effects {
  /** Faux pour la carte adverse : ni bannière de vague ni voile de fuite (ils sont à l'écran du joueur). */
  constructor(readonly own = true) {}

  particles: Particle[] = [];
  floaters: Floater[] = [];
  bolts: Bolt[] = [];
  rings: Ring[] = [];
  recoil = new Map<number, number>();
  leakFlash = 0;
  /** `lines` : détail sous le titre, remplaçable par l'écran (récapitulatif de vague). */
  banner: { title: string; lines: string[]; life: number; boss: boolean } | null = null;

  consume(events: GameEvent[]): void {
    for (const e of events) {
      switch (e.t) {
        case GameEventType.Kill:
          this.floaters.push({ x: e.x, y: e.y - 0.4, text: `+${e.bounty}`, color: PAL.gold, life: 1.1, big: e.boss });
          this.burst(e.x, e.y, e.boss ? 26 : 8, e.boss ? PAL.gold : '#b9b6ae', e.boss ? 3 : 1.6);
          break;
        case GameEventType.Hit: {
          const col = FAMILY_COLOR[e.family];
          if (e.splash > 0) this.rings.push({ x: e.x, y: e.y, r: e.splash, life: 0.35, max: 0.35, color: col.glow });
          this.burst(e.x, e.y, e.splash > 0 ? 6 : 2, col.main, 1.2);
          if (e.crit) this.floaters.push({ x: e.x, y: e.y - 0.5, text: `${e.dmg}!`, color: '#ffdf7a', life: 0.8, big: false });
          break;
        }
        case GameEventType.Chain:
          this.bolts.push({ points: e.points, life: 0.2, seed: Math.random() * 1000 });
          break;
        case GameEventType.Fire:
          this.recoil.set(e.towerId, 0.12);
          break;
        case GameEventType.Leak:
          if (this.own) this.leakFlash = 0.6;
          break;
        case GameEventType.Built:
        case GameEventType.Upgraded:
          break;
        case GameEventType.Sold:
          this.floaters.push({ x: e.x, y: e.y - 0.5, text: `+${e.refund}`, color: PAL.gold, life: 1, big: false });
          this.burst(e.x, e.y, 10, PAL.stone, 1.5);
          break;
        case GameEventType.Destroyed:
          this.burst(e.x, e.y, 10, PAL.stone, 1.5);
          break;
        case GameEventType.WaveStart: {
          if (!this.own) break;
          const def = CREEPS[e.creep];
          const flags = [def.air ? 'volants' : '', def.magicImmune ? 'immunisés à la magie' : '', def.regen && !def.boss ? 'régénération' : '']
            .filter(Boolean)
            .join(' · ');
          this.banner = {
            title: e.boss ? `Vague ${e.wave + 1} · Chef` : `Vague ${e.wave + 1}`,
            lines: [e.boss ? def.name : `${def.plural}${flags ? ' · ' + flags : ''}`],
            life: BANNER_LIFE,
            boss: e.boss,
          };
          break;
        }
        default:
          break;
      }
    }
  }

  burst(x: number, y: number, n: number, color: string, speed: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random());
      const max = 0.35 + Math.random() * 0.35;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, life: max, max, color, size: 0.05 + Math.random() * 0.06 });
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 3 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= dt * 0.7;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter((b) => b.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const [k, v] of this.recoil) {
      if (v - dt <= 0) this.recoil.delete(k);
      else this.recoil.set(k, v - dt);
    }
    if (this.leakFlash > 0) this.leakFlash -= dt;
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
  }

  clear(): void {
    this.particles = [];
    this.floaters = [];
    this.bolts = [];
    this.rings = [];
    this.recoil.clear();
    this.leakFlash = 0;
    this.banner = null;
  }
}
