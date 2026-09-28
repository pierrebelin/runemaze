import { Sfx } from '../infrastructure/audio/Sfx';
import { GameLoop } from '../infrastructure/GameLoop';
import { CAMPAIGN_LENGTH, CREEPS, DIFFICULTY, waveAt } from '../domain/catalog/creeps';
import { MAPS } from '../domain/catalog/map';
import { BUILD_MENU, TOWERS } from '../domain/catalog/towers';
import { Effects } from '../infrastructure/render/Effects';
import { Renderer, type ViewState } from '../infrastructure/render/Renderer';
import { PAL } from '../infrastructure/render/palette';
import { drawCreep, drawMapThumbnail, drawTower } from '../infrastructure/render/sprites';
import { ARMOR_LABEL, ATTACK_LABEL, ATTACK_TABLE } from '../domain/rules/Damage';
import { dispatch } from '../application/dispatch';
import { canBuild } from '../application/queries/canBuild';
import { infusionLock } from '../application/queries/infusionLock';
import { previewRoute } from '../application/queries/previewRoute';
import { waveBriefing } from '../application/queries/waveBriefing';
import { realign } from '../application/online/realign';
import { LOST_LIMIT_MS } from '../application/online/heldGame';
import { ClientMessageType, ServerMessageType } from '../application/online/protocol';
import type { ServerMessage } from '../application/online/protocol';
import { refundValue, upgradeCost } from '../domain/rules/pricing';
import { canLaunchNext } from '../domain/systems/waves';
import { World } from '../domain/model/World';
import { restore } from '../domain/model/snapshot';
import { fingerprint } from '../domain/rules/fingerprint';
import type { ArmorType, AttackType, Command, Creep, Difficulty, GameEvent, MapDef, Result, TargetMode, Tower } from '../domain/model/types';
import { CommandType, GameEventType, Phase } from '../domain/model/types';
import { breakerLosses, familyDamage, towerRanking, waveCurve } from '../domain/rules/debrief';
import { importLegacyRecords, withRecord, type RecordBook } from '../domain/rules/records';
import { briefingChip, briefingInfo, creepInfo, debriefBreakers, debriefFamilies, debriefTowers, debriefWaves, elementsLabel, FAMILY_LABEL, fmt0, fmt1, fmtM, nextWaveInfo, TARGET_LABEL, towerInfo } from './describe';
import { ServerLink } from './ServerLink';

const KEYS = ['q', 'w', 'e', 'r', 'a', 's', 'd', 'f', 'z', 'x', 'c', 'v'];
const TARGET_ORDER: TargetMode[] = ['first', 'last', 'strong', 'weak', 'close'];
const BEST_KEY = 'dedale.best.v2';
const LEGACY_BEST_KEY = 'dedale.best.v1';
const PENDING_KEY = 'dedale.pending.v1';

const ICON_CANCEL = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M11 11l18 18M29 11L11 29" stroke="#e0664f" stroke-width="4" stroke-linecap="round"/></svg>';
const ICON_HELP = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="none" stroke="#b98d4c" stroke-width="2.5"/><path d="M15.5 16a4.5 4.5 0 119 .5c0 3-4.5 3.5-4.5 6.5" fill="none" stroke="#efe3c4" stroke-width="2.6" stroke-linecap="round"/><circle cx="20" cy="28" r="1.8" fill="#efe3c4"/></svg>';
const ICON_SELL = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="17" cy="22" r="9" fill="#e9b949" stroke="#8a6320" stroke-width="2"/><circle cx="24" cy="16" r="9" fill="#f2cc66" stroke="#8a6320" stroke-width="2"/><path d="M24 11v10M21 13.5h4.5a1.7 1.7 0 010 3.4h-3a1.7 1.7 0 000 3.4h4.5" fill="none" stroke="#8a6320" stroke-width="1.6"/></svg>';
const ICON_TARGET = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="11" fill="none" stroke="#efe3c4" stroke-width="2.5"/><circle cx="20" cy="20" r="3" fill="#e0664f"/><path d="M20 4v8M20 28v8M4 20h8M28 20h8" stroke="#efe3c4" stroke-width="2.5"/></svg>';
const ICON_BACK = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M24 11l-9 9 9 9" fill="none" stroke="#efe3c4" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

interface Slot {
  label: string;
  icon: string;
  cost?: number;
  poor?: boolean;
  active?: boolean;
  locked?: string;
  run: () => void;
  info: () => string;
}

enum Overlay {
  Start = 'start',
  Help = 'help',
  End = 'end',
  Pause = 'pause',
  Lost = 'lost',
}

type Selection = { kind: 'tower'; id: number } | { kind: 'creep'; id: number } | null;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class Game {
  private world: World;
  private readonly renderer: Renderer;
  private readonly fx = new Effects();
  private readonly sfx = new Sfx();
  private readonly loop: GameLoop;
  private difficulty: Difficulty = 'normal';
  private mapId: string = MAPS[0].id;
  private link: ServerLink | null = null;
  private launching = false;
  private pausedByVisibility = false;
  private unloading = false;
  private gameId: string | null = null;
  private gameToken: string | null = null;
  private lostElapsed = 0;
  private lostRemaining = -1;
  private lostRetryAt = 0;
  private lostFinal = false;
  private reconnecting = false;

  private selected: Selection = null;
  private buildDef: string | null = null;
  private anchor: { x: number; y: number } | null = null;
  private ghostReason = '';
  private previewDelta = 0;
  private ghostCheck = 0;
  private touchPending: { x: number; y: number } | null = null;
  private hoverSlot: number | null = null;
  private slots: (Slot | null)[] = [];
  private cardKey = '';
  private infoCache = '';
  private unitCache = '';
  private briefingCache = '';
  private hud: Record<string, string> = {};
  private overlay: Overlay | null = null;
  private pausedByOverlay = false;
  private helpFromStart = false;
  private endShown = false;
  private toastTimer = 0;
  private leakToastAt = -10;
  private icons = new Map<string, string>();
  private view: ViewState = { buildDef: null, ghost: null, previewRoute: null, selectedTower: null, selectedCreep: null, showRoute: true };

  private readonly canvas = $<HTMLCanvasElement>('game');
  private readonly stage = $<HTMLElement>('stage');
  private readonly portrait = $<HTMLCanvasElement>('portrait');

  constructor() {
    this.world = this.createWorld(MAPS[0], 'normal');
    this.renderer = new Renderer(this.canvas, this.world);
    this.loop = new GameLoop(() => this.stepSim(), (dt) => this.frame(dt));
    this.bindInput();
    new ResizeObserver(() => this.resize()).observe(this.stage);
    this.resize();
    this.showStart();
    this.loop.start();
  }

  private createWorld(map: MapDef, d: Difficulty): World {
    return new World({ map, difficulty: d, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
  }

  private async newGame(d: Difficulty): Promise<void> {
    if (this.launching) return;
    this.launching = true;
    const map = MAPS.find((m) => m.id === this.mapId) ?? MAPS[0];
    const previous = this.loadPending() ?? undefined;
    this.link?.close();
    this.link = null;
    const link = new ServerLink();
    let opened: Extract<ServerMessage, { t: ServerMessageType.Opened }>;
    try {
      await link.connect();
      opened = await new Promise((resolve, reject) => {
        link.onLost(() => reject(new Error('connexion perdue')));
        link.onMessage((msg) => {
          if (msg.t === ServerMessageType.Opened) resolve(msg);
        });
        link.send({ t: ClientMessageType.Open, map, difficulty: d, ...(previous ? { previous } : {}) });
      });
    } catch {
      this.launching = false;
      this.toast('Impossible de lancer la partie, vérifiez votre connexion.', true);
      return;
    }

    this.launching = false;
    this.difficulty = d;
    this.link = link;
    this.gameId = opened.id;
    this.gameToken = opened.token;
    this.world = restore(opened.snapshot);
    this.renderer.setWorld(this.world);
    this.fx.clear();
    this.selected = null;
    this.buildDef = null;
    this.anchor = null;
    this.endShown = false;
    this.cardKey = '';
    this.hud = {};
    this.resize();
    this.closeOverlay();
    this.setPaused(false);
    this.sendPace();
    this.savePending();
    this.resetLostState();
    this.toast(`${DIFFICULTY[d].label} : ${DIFFICULTY[d].lives} vies. Bâtissez avant la première vague.`);
    this.attachLink(link);
  }

  /** Rebranche les gestionnaires d'une liaison de partie ; factorisé entre lancement et reprise. */
  private attachLink(link: ServerLink): void {
    link.onMessage((msg) => {
      if (this.link !== link) return;
      this.onServerMessage(msg);
    });
    link.onLost(() => {
      if (this.link !== link) return;
      this.onLost();
    });
  }

  /** Un ordre du serveur qui recale ou termine la partie. */
  private onServerMessage(msg: ServerMessage): void {
    switch (msg.t) {
      case ServerMessageType.Drift:
        this.world = realign(msg.snapshot, this.world.log, this.world.tick);
        this.renderer.setWorld(this.world);
        break;
      case ServerMessageType.Over:
        this.clearPending();
        this.world = restore(msg.snapshot);
        this.renderer.setWorld(this.world);
        this.saveBest();
        this.showEnd();
        break;
      case ServerMessageType.Ended:
        this.clearPending();
        this.link?.close();
        this.link = null;
        this.showEndedOverlay();
        break;
      default:
        break;
    }
  }

  /** Coupure de connexion pendant une partie non terminée : gel avec décompte, reconnexion automatique. */
  private onLost(): void {
    this.link = null;
    if (this.overlay === Overlay.End || this.overlay === Overlay.Lost || this.overlay === Overlay.Start) return;
    this.setPaused(true);
    this.resetLostState();
    this.lostRemaining = Math.ceil(LOST_LIMIT_MS / 1000);
    this.openOverlay(Overlay.Lost, this.lostHtml(this.lostRemaining));
  }

  /** Envoie un ordre du joueur : `dispatch` fait foi localement, le serveur ne fait que confirmer ou recaler. */
  private order(cmd: Command): Result {
    const r = dispatch(this.world, cmd);
    if (r.ok) this.link?.send({ t: ClientMessageType.Order, tick: this.world.tick, cmd, fingerprint: fingerprint(this.world) });
    return r;
  }

  private sendPace(): void {
    this.link?.send({ t: ClientMessageType.Pace, tick: this.world.tick, paused: this.loop.paused, speed: this.loop.speed });
  }

  private resize(): void {
    const cs = getComputedStyle(this.stage);
    const w = this.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
    const h = this.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
    if (w > 0 && h > 0) this.renderer.fit(w, h);
  }

  // ─── Simulation ──────────────────────────────────────────────────────────

  private stepSim(): void {
    this.world.step();
    const events = this.world.drainEvents();
    if (events.length === 0) return;
    this.fx.consume(events);
    this.sfx.play(events);
    for (const e of events) this.onEvent(e);
  }

  private onEvent(e: GameEvent): void {
    const w = this.world;
    switch (e.t) {
      case GameEventType.WaveCleared:
        this.toast(`Vague ${e.wave + 1} repoussée : +${e.bonus} or${e.interest ? `, +${e.interest} d'intérêts` : ''}.`);
        break;
      case GameEventType.Leak:
        if (w.time - this.leakToastAt > 3) {
          this.leakToastAt = w.time;
          this.toast(e.boss ? `Le chef a franchi la porte : −${e.lives} vies.` : 'Une créature a franchi la porte.', true);
        }
        break;
      default:
        break;
    }
  }

  private frame(dt: number): void {
    if (this.overlay === Overlay.Lost) this.updateLost(dt);
    const w = this.world;
    this.fx.update(this.loop.paused ? 0 : dt * this.loop.speed);

    if (this.selected?.kind === 'creep' && !w.creeps.some((c) => c.id === this.selected!.id && c.alive)) this.selected = null;
    if (this.selected?.kind === 'tower' && !w.towerById.has(this.selected.id)) this.selected = null;

    // Revalide l'emplacement fantôme : les créatures bougent.
    this.ghostCheck -= dt;
    if (this.buildDef && this.anchor && this.ghostCheck <= 0) this.updateGhost();

    this.view.buildDef = this.buildDef;
    this.view.selectedTower = this.selected?.kind === 'tower' ? this.selected.id : null;
    this.view.selectedCreep = this.selected?.kind === 'creep' ? this.selected.id : null;
    this.canvas.classList.toggle('building', !!this.buildDef);

    this.renderer.draw(this.view, this.fx, w.time, this.loop.realTime);
    this.renderer.pruneFacing();
    this.updateHud();
    this.updateCard();
    this.updateInfo();
    this.updateBriefing();
    this.drawPortrait();

    if (w.isOver() && !this.endShown && !this.fx.banner) {
      this.endShown = true;
      this.link?.send({ t: ClientMessageType.Check, tick: w.tick, fingerprint: fingerprint(w) });
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) $('toast').classList.remove('show');
    }
  }

  // ─── Commandes ───────────────────────────────────────────────────────────

  private setBuild(id: string | null): void {
    this.buildDef = id;
    this.touchPending = null;
    this.view.previewRoute = null;
    this.view.ghost = null;
    if (id) {
      this.selected = null;
      this.updateGhost();
    }
  }

  private updateGhost(): void {
    this.ghostCheck = 0.15;
    const a = this.anchor;
    const g = this.world.grid;
    if (!this.buildDef || !a || !g.inBounds(a.x, a.y) || !g.inBounds(a.x + 1, a.y + 1)) {
      this.view.ghost = null;
      this.view.previewRoute = null;
      return;
    }
    const r = canBuild(this.world, this.buildDef, a.x, a.y);
    this.view.ghost = { x: a.x, y: a.y, ok: r.ok };
    this.ghostReason = r.ok ? '' : r.reason;
    if (r.ok) {
      const p = previewRoute(this.world, a.x, a.y);
      this.previewDelta = p.length - this.world.mazeLength();
      this.view.previewRoute = this.previewDelta > 0.01 ? p.route : null;
    } else {
      this.view.previewRoute = null;
    }
  }

  private build(): void {
    const a = this.anchor;
    if (!this.buildDef || !a) return;
    this.sfx.unlock();
    const r = this.order({ c: CommandType.Build, def: this.buildDef, x: a.x, y: a.y });
    if (!r.ok) this.fail(r.reason);
    else this.drainNow();
    this.touchPending = null;
    this.updateGhost();
  }

  /** Les ordres produisent des événements hors du pas de simulation : on les traite tout de suite. */
  private drainNow(): void {
    const ev = this.world.drainEvents();
    this.fx.consume(ev);
    this.sfx.play(ev);
    for (const e of ev) this.onEvent(e);
  }

  private fail(reason: string): void {
    this.sfx.error();
    this.toast(reason, true);
  }

  private upgrade(t: Tower, to: string): void {
    const r = this.order({ c: CommandType.Upgrade, tower: t.id, def: to });
    if (!r.ok) this.fail(r.reason);
    else this.drainNow();
    this.hoverSlot = null;
  }

  private sell(t: Tower): void {
    const r = this.order({ c: CommandType.Sell, tower: t.id });
    if (!r.ok) this.fail(r.reason);
    else {
      this.drainNow();
      this.selected = null;
    }
  }

  private callWave(): void {
    this.sfx.unlock();
    if (this.overlay) return;
    const r = this.order({ c: CommandType.CallWave });
    if (!r.ok) this.fail(r.reason);
    else this.drainNow();
  }

  private setSpeed(s: number): void {
    this.loop.speed = s;
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === s)));
    this.sendPace();
  }

  private setPaused(p: boolean): void {
    this.loop.paused = p;
    $('pauseBtn').setAttribute('aria-pressed', String(p));
  }

  private togglePause(): void {
    if (this.overlay === Overlay.Start || this.overlay === Overlay.End || this.overlay === Overlay.Lost) return;
    if (this.overlay === Overlay.Pause) {
      this.closeOverlay();
      this.setPaused(false);
    } else if (!this.overlay) {
      this.setPaused(true);
      this.showPause();
    }
    this.sendPace();
  }

  private toggleMute(): void {
    this.sfx.setMuted(!this.sfx.muted);
    $('muteWave').style.opacity = this.sfx.muted ? '0.15' : '1';
    $('muteBtn').setAttribute('aria-pressed', String(this.sfx.muted));
  }

  private escape(): void {
    if (this.overlay === Overlay.Help && this.helpFromStart) {
      this.showStart();
      return;
    }
    if (this.overlay === Overlay.Help || this.overlay === Overlay.Pause) {
      this.closeOverlay();
      if (!this.pausedByOverlay) this.setPaused(false);
      return;
    }
    if (this.buildDef) this.setBuild(null);
    else this.selected = null;
  }

  // ─── Entrées ─────────────────────────────────────────────────────────────

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.pointerTo(e.clientX, e.clientY);
    });
    c.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'touch') return;
      this.anchor = null;
      this.view.ghost = null;
      this.view.previewRoute = null;
    });
    c.addEventListener('pointerdown', (e) => {
      if (this.overlay) return;
      this.sfx.unlock();
      if (e.button === 2) {
        this.escape();
        return;
      }
      const g = this.renderer.toGrid(e.clientX, e.clientY);
      if (this.buildDef) {
        const a = this.anchorFor(g.x, g.y);
        if (e.pointerType === 'touch') {
          // Au doigt : premier appui = aperçu, second appui au même endroit = construction.
          if (this.touchPending && this.touchPending.x === a.x && this.touchPending.y === a.y) {
            this.build();
          } else {
            this.anchor = a;
            this.touchPending = a;
            this.updateGhost();
          }
          return;
        }
        this.anchor = a;
        this.updateGhost();
        this.build();
        return;
      }
      this.pick(g.x, g.y);
    });

    const card = $('card');
    card.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if (!b) return;
      this.sfx.unlock();
      this.runSlot(Number(b.dataset.slot));
    });
    card.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      this.hoverSlot = b ? Number(b.dataset.slot) : null;
    });
    card.addEventListener('pointerleave', () => (this.hoverSlot = null));

    window.addEventListener('pagehide', () => {
      this.unloading = true;
    });

    document.addEventListener('visibilitychange', () => {
      if (this.unloading) return;
      if (document.hidden) {
        if (!this.loop.paused) {
          this.pausedByVisibility = true;
          this.setPaused(true);
          this.sendPace();
        }
      } else if (this.pausedByVisibility) {
        this.pausedByVisibility = false;
        if (this.overlay !== Overlay.Lost) {
          this.setPaused(false);
          this.sendPace();
        }
      }
    });

    $('callBtn').addEventListener('click', () => this.callWave());
    $('pauseBtn').addEventListener('click', () => this.togglePause());
    $('muteBtn').addEventListener('click', () => this.toggleMute());
    $('helpBtn').addEventListener('click', () => (this.overlay === Overlay.Help ? this.escape() : this.showHelp()));
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) =>
      b.addEventListener('click', () => this.setSpeed(Number(b.dataset.speed))),
    );

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (this.overlay === Overlay.Start) {
        if (k === 'enter') {
          e.preventDefault();
          ($('startBtn') as HTMLButtonElement | null)?.click();
        }
        return;
      }
      if (this.overlay === Overlay.End || this.overlay === Overlay.Lost) return;
      if (k === 'escape') this.escape();
      else if (k === 'h' || k === '?') this.overlay === Overlay.Help ? this.escape() : this.showHelp();
      else if (k === 'p') this.togglePause();
      else if (this.overlay) return;
      else if (k === ' ') {
        e.preventDefault();
        if (!e.repeat) this.callWave();
      } else if (k === 'm') this.toggleMute();
      else if (k === '1' || k === '2' || k === '3') this.setSpeed(Number(k));
      else if (k === 'l') this.view.showRoute = !this.view.showRoute;
      else if (KEYS.includes(k) && !e.repeat) {
        const i = KEYS.indexOf(k);
        if (this.slots[i]) {
          e.preventDefault();
          this.runSlot(i);
        }
      }
    });
  }

  private anchorFor(gx: number, gy: number): { x: number; y: number } {
    return { x: Math.round(gx - 1), y: Math.round(gy - 1) };
  }

  private pointerTo(cx: number, cy: number): void {
    if (!this.buildDef) return;
    const g = this.renderer.toGrid(cx, cy);
    const a = this.anchorFor(g.x, g.y);
    if (!this.anchor || a.x !== this.anchor.x || a.y !== this.anchor.y) {
      this.anchor = a;
      this.updateGhost();
    }
  }

  private pick(gx: number, gy: number): void {
    const w = this.world;
    const cx = Math.floor(gx);
    const cy = Math.floor(gy);
    if (w.grid.inBounds(cx, cy)) {
      const id = w.grid.tower[w.grid.idx(cx, cy)];
      if (id) {
        this.selected = { kind: 'tower', id };
        this.sfx.click();
        return;
      }
    }
    let best: Creep | undefined;
    let bestD = Infinity;
    for (const c of w.creeps) {
      const d = Math.hypot(c.x - gx, c.y - (c.def.air ? gy + 0.45 : gy));
      if (c.alive && d < c.def.radius + 0.45 && d < bestD) {
        best = c;
        bestD = d;
      }
    }
    this.selected = best ? { kind: 'creep', id: best.id } : null;
  }

  private runSlot(i: number): void {
    const s = this.slots[i];
    if (!s || this.overlay) return;
    s.run();
    this.cardKey = '';
  }

  // ─── Panneau de commandes ────────────────────────────────────────────────

  private icon(defId: string): string {
    let url = this.icons.get(defId);
    if (!url) {
      const c = document.createElement('canvas');
      c.width = c.height = 80;
      const ctx = c.getContext('2d')!;
      const s = 80 / 2.2;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      drawTower(ctx, TOWERS[defId], 1.1, 1.1, -Math.PI / 4, 0.4);
      url = c.toDataURL();
      this.icons.set(defId, url);
    }
    return `<img src="${url}" alt="">`;
  }

  private selectedTower(): Tower | undefined {
    return this.selected?.kind === 'tower' ? this.world.towerById.get(this.selected.id) : undefined;
  }

  private computeSlots(): (Slot | null)[] {
    const w = this.world;
    const slots: (Slot | null)[] = new Array(12).fill(null);
    const t = this.selectedTower();
    if (t) {
      t.def.upgrades.forEach((id, i) => {
        const to = TOWERS[id];
        const cost = upgradeCost(t.def, to);
        const heading = t.def.family === 'wall' ? `Transformer en ${to.name}` : `Améliorer en ${to.name}`;
        const locked = infusionLock(w, t.id, id);
        slots[i] = locked
          ? {
              label: to.name, icon: this.icon(id), cost, poor: true, locked,
              run: () => this.toast(locked, true),
              info: () => towerInfo(to, cost, heading, locked),
            }
          : {
              label: to.name, icon: this.icon(id), cost, poor: w.gold < cost,
              run: () => this.upgrade(t, id),
              info: () => towerInfo(to, cost, heading),
            };
      });
      if (t.def.attack) {
        slots[8] = {
          label: `Ciblage : ${TARGET_LABEL[t.targetMode]}`, icon: ICON_TARGET,
          run: () => {
            const next = TARGET_ORDER[(TARGET_ORDER.indexOf(t.targetMode) + 1) % TARGET_ORDER.length];
            this.order({ c: CommandType.Target, tower: t.id, mode: next });
            this.toast(`Ciblage : ${TARGET_LABEL[next]}.`);
          },
          info: () => `<h3>Ciblage : ${TARGET_LABEL[t.targetMode]}</h3><p>Change la priorité de tir : premier (le plus avancé), dernier, plus robuste, plus faible ou plus proche.</p>`,
        };
      }
      const refund = refundValue(t);
      slots[10] = { label: 'Retour', icon: ICON_BACK, run: () => (this.selected = null), info: () => '<h3>Retour</h3><p>Revient au menu de construction (Échap).</p>' };
      slots[11] = {
        label: `Vendre +${refund}`, icon: ICON_SELL, cost: refund,
        run: () => this.sell(t),
        info: () => `<h3>Vendre · +${refund} or</h3><p>La moitié de l'or investi est rendue, à tout moment.</p>`,
      };
      return slots;
    }
    if (this.selected?.kind === 'creep') {
      slots[11] = { label: 'Retour', icon: ICON_BACK, run: () => (this.selected = null), info: () => '<h3>Retour</h3><p>Revient au menu de construction (Échap).</p>' };
      return slots;
    }
    BUILD_MENU.forEach((id, i) => {
      const def = TOWERS[id];
      slots[i] = {
        label: def.name, icon: this.icon(id), cost: def.cost, poor: w.gold < def.cost, active: this.buildDef === id,
        run: () => this.setBuild(this.buildDef === id ? null : id),
        info: () => towerInfo(def, def.cost),
      };
    });
    slots[11] = this.buildDef
      ? { label: 'Annuler', icon: ICON_CANCEL, run: () => this.setBuild(null), info: () => '<h3>Annuler</h3><p>Quitte le mode construction (Échap ou clic droit).</p>' }
      : { label: 'Aide', icon: ICON_HELP, run: () => this.showHelp(), info: () => '<h3>Aide</h3><p>Commandes, table des armures et conseils de labyrinthe (H).</p>' };
    return slots;
  }

  private updateCard(): void {
    this.slots = this.computeSlots();
    const key = this.slots.map((s) => (s ? `${s.label}|${s.cost}|${s.poor}|${s.active}` : '-')).join(';');
    if (key === this.cardKey) return;
    this.cardKey = key;
    $('card').innerHTML = this.slots
      .map((s, i) => {
        const hk = KEYS[i].toUpperCase();
        if (!s) return `<div class="slot empty" aria-hidden="true"></div>`;
        const cls = ['slot', s.poor ? 'poor' : '', s.active ? 'active' : ''].join(' ');
        const cost = s.cost !== undefined ? `<span class="cost">${s.cost}</span>` : '';
        return `<button type="button" class="${cls}" data-slot="${i}" title="${s.label} (${hk})" aria-label="${s.label}, touche ${hk}">${s.icon}<span class="hk">${hk}</span>${cost}</button>`;
      })
      .join('');
  }

  // ─── Panneaux d'information ──────────────────────────────────────────────

  private updateInfo(): void {
    const w = this.world;
    let html: string;
    const hover = this.hoverSlot !== null ? this.slots[this.hoverSlot] : null;
    const t = this.selectedTower();
    if (hover) html = hover.info();
    else if (this.buildDef) {
      const def = TOWERS[this.buildDef];
      let status = '';
      if (this.view.ghost && !this.view.ghost.ok) status = `<p style="color:var(--bad)">${this.ghostReason}</p>`;
      else if (this.view.ghost) {
        const now = w.mazeLength();
        status = this.previewDelta > 0.01
          ? `<p style="color:var(--gold)">Trajet : ${fmt0(now)} → ${fmt0(now + this.previewDelta)} cases (+${fmt0(this.previewDelta)})</p>`
          : `<p>Trajet inchangé : ${fmt0(now)} cases.</p>`;
      }
      html = towerInfo(def, def.cost) + status;
    } else if (t) {
      const extra = t.def.attack
        ? `<p>${fmt0(t.kills)} éliminations · ${fmt0(t.damage)} dégâts infligés · ciblage ${TARGET_LABEL[t.targetMode].toLowerCase()} · revente ${refundValue(t)} or</p>`
        : `<p>Revente ${refundValue(t)} or. Sélectionnez une tour à transformer.</p>`;
      html = towerInfo(t.def, null) + extra;
    } else if (this.selected?.kind === 'creep') {
      const c = w.creeps.find((k) => k.id === this.selected!.id);
      html = c ? creepInfo(c) : nextWaveInfo(waveBriefing(w));
    } else html = nextWaveInfo(waveBriefing(w));
    if (html !== this.infoCache) {
      this.infoCache = html;
      $('info').innerHTML = html;
    }

    // Colonne de gauche : nom, niveau, état.
    let unit: string;
    if (this.buildDef) {
      const def = TOWERS[this.buildDef];
      const touch = matchMedia('(pointer: coarse)').matches;
      unit = `<h2>${def.name}</h2><div class="sub">Construction · ${def.cost} or</div><div class="facts">${touch ? 'Touchez pour prévisualiser, touchez à nouveau pour bâtir.' : 'Clic pour bâtir · Échap pour annuler'}</div>`;
    } else if (t) {
      const family = t.def.elements ? `${elementsLabel(t.def)} · hybride` : FAMILY_LABEL[t.def.family];
      unit = `<h2>${t.def.name}</h2><div class="sub">${family}${t.def.tier ? ` · niveau ${t.def.tier}` : ''}</div><div class="facts">${t.def.attack ? `${ATTACK_LABEL[t.def.attack.type]} · ${fmt0(t.kills)} éliminations` : 'Bloc de labyrinthe'}</div>`;
    } else if (this.selected?.kind === 'creep') {
      const c = w.creeps.find((k) => k.id === this.selected!.id);
      unit = c
        ? `<h2>${c.def.name}</h2><div class="sub">Armure ${ARMOR_LABEL[c.def.armorType].toLowerCase()} · vague ${c.wave + 1}</div><div class="hpbar"><i style="width:${Math.max(0, (c.hp / c.maxHp) * 100).toFixed(1)}%"></i></div><div class="facts">${fmt0(c.hp)} / ${fmt0(c.maxHp)} PV</div>`
        : '';
    } else {
      const i = w.wave + 1;
      if (!w.endless && i >= CAMPAIGN_LENGTH) unit = `<h2>Tenez bon</h2><div class="sub">Dernière vague en cours</div>`;
      else {
        const wg = waveAt(i).groups[0];
        const def = CREEPS[wg.creep];
        unit = `<h2>${def.boss ? def.name : def.plural}</h2><div class="sub">Vague ${i + 1}${wg.count > 1 ? ` · ×${wg.count}` : ' · chef'}</div><div class="facts">Armure ${ARMOR_LABEL[def.armorType].toLowerCase()}${def.air ? ' · volants' : ''}${def.magicImmune ? ' · immunisés' : ''}</div>`;
      }
    }
    if (unit !== this.unitCache) {
      this.unitCache = unit;
      $('unitText').innerHTML = unit;
    }
  }

  /** Résumé de la prochaine vague dans la barre du haut ; détail au survol. */
  private updateBriefing(): void {
    const b = waveBriefing(this.world);
    const html = b ? briefingChip(b) + briefingInfo(b) : '';
    if (html === this.briefingCache) return;
    this.briefingCache = html;
    $('briefing').hidden = !b;
    if (!b) return;
    $('briefingChip').innerHTML = briefingChip(b);
    $('briefingDetail').innerHTML = briefingInfo(b);
  }

  private drawPortrait(): void {
    const c = this.portrait;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0f0d0a';
    ctx.fillRect(0, 0, c.width, c.height);
    const w = this.world;
    const t = this.selectedTower();
    const buildDef = this.buildDef ? TOWERS[this.buildDef] : null;
    const time = this.loop.realTime;
    if (t || buildDef) {
      const def = t ? t.def : buildDef!;
      const s = c.width / 2.4;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      drawTower(ctx, def, 1.2, 1.25, t ? t.aim : -Math.PI / 4, time);
      return;
    }
    let creep: Creep | undefined;
    if (this.selected?.kind === 'creep') creep = w.creeps.find((k) => k.id === this.selected!.id);
    const def = creep ? creep.def : CREEPS[waveAt(Math.min(w.wave + 1, w.endless ? Infinity : CAMPAIGN_LENGTH - 1)).groups[0].creep];
    const span = Math.max(1.4, def.radius * 4.2);
    const s = c.width / span;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    drawCreep(ctx, {
      def, x: span / 2, y: span / 2 + (def.air ? 0.3 : 0.05), hp: 1, maxHp: 1,
      slowPct: creep?.slowPct ?? 0, poisons: creep?.poisons ?? [], shred: 0, hitFlash: 0, bob: 0,
    }, 1, 0.6, time, false);
  }

  private updateHud(): void {
    const w = this.world;
    const set = (id: string, v: string) => {
      if (this.hud[id] === v) return;
      this.hud[id] = v;
      $(id).textContent = v;
    };
    set('gold', fmt0(w.gold));
    set('lives', fmt0(w.lives));
    $('lives').style.color = w.lives <= 5 ? PAL.danger : '';
    set('wave', String(Math.max(0, w.wave + 1)));
    set('waveMax', w.endless ? '/ ∞' : `/ ${CAMPAIGN_LENGTH}`);
    set('maze', fmt0(w.mazeLength()));
    const can = canLaunchNext(w);
    const secs = Math.ceil(Math.max(0, w.nextWaveIn));
    set('timerLabel', can ? 'Vague suivante : ' : '');
    set('timer', can ? `${secs} s` : w.phase === Phase.Playing ? 'Dernière vague' : '');
    const bonus = can && Number.isFinite(w.nextWaveIn) ? Math.floor(Math.max(0, w.nextWaveIn) * 0.5) : 0;
    const label = can ? (bonus > 0 ? `Appeler +${bonus}` : 'Appeler') : 'Appeler';
    if (this.hud.call !== label + can) {
      this.hud.call = label + can;
      const b = $<HTMLButtonElement>('callBtn');
      b.innerHTML = `${label}<kbd>Espace</kbd>`;
      b.disabled = !can;
      b.style.opacity = can ? '' : '0.45';
    }
  }

  private toast(msg: string, bad = false): void {
    const el = $('toast');
    el.textContent = msg;
    el.classList.toggle('bad', bad);
    el.classList.add('show');
    this.toastTimer = bad ? 2.2 : 2.8;
  }

  // ─── Écrans superposés ───────────────────────────────────────────────────

  private openOverlay(kind: Overlay, html: string): void {
    const el = $('overlay');
    this.overlay = kind;
    el.innerHTML = html;
    el.hidden = false;
  }

  private closeOverlay(): void {
    this.overlay = null;
    $('overlay').hidden = true;
    $('overlay').innerHTML = '';
  }

  private loadBest(): RecordBook {
    try {
      const book = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as RecordBook;
      const legacy = JSON.parse(localStorage.getItem(LEGACY_BEST_KEY) ?? '{}') as Partial<Record<Difficulty, number>>;
      return importLegacyRecords(book, legacy, 'crossing');
    } catch {
      return {};
    }
  }

  private saveBest(): void {
    const w = this.world;
    const reached = w.phase === Phase.Victory ? w.wave + 1 : Math.max(0, w.wave);
    try {
      const best = withRecord(this.loadBest(), this.mapId, this.difficulty, reached);
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch {
      /* stockage indisponible : on s'en passe */
    }
  }

  private loadPending(): { id: string; token: string } | null {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw) as { id?: unknown; token?: unknown };
      return typeof p.id === 'string' && typeof p.token === 'string' ? { id: p.id, token: p.token } : null;
    } catch {
      return null;
    }
  }

  private savePending(): void {
    try {
      if (this.gameId && this.gameToken) localStorage.setItem(PENDING_KEY, JSON.stringify({ id: this.gameId, token: this.gameToken }));
    } catch {
      /* stockage indisponible : on s'en passe */
    }
  }

  private clearPending(): void {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* stockage indisponible : on s'en passe */
    }
  }

  // ─── Coupure de connexion ────────────────────────────────────────────────

  private resetLostState(): void {
    this.lostElapsed = 0;
    this.lostRemaining = -1;
    this.lostRetryAt = 0;
    this.lostFinal = false;
    this.reconnecting = false;
  }

  private lostHtml(seconds: number): string {
    return `
      <div class="sheet" style="width:min(360px,100%);text-align:center">
        <h2>Connexion perdue — ${seconds} s</h2>
        <p class="lede">Nouvelle tentative de connexion en cours…</p>
      </div>`;
  }

  private showEndedOverlay(): void {
    this.openOverlay(Overlay.End, `
      <div class="sheet" style="width:min(360px,100%);text-align:center">
        <h2>La partie est terminée.</h2>
        <div class="row" style="justify-content:center"><button type="button" class="btn primary" id="backToStart">Écran titre</button></div>
      </div>`);
    $('backToStart').addEventListener('click', () => this.showStart());
  }

  /** Décompte affiché pendant le gel, et tentatives de reconnexion toutes les ~2 s. */
  private updateLost(dt: number): void {
    this.lostElapsed += dt;
    const remainingMs = Math.max(0, LOST_LIMIT_MS - this.lostElapsed * 1000);
    const remaining = Math.ceil(remainingMs / 1000);
    if (remaining !== this.lostRemaining) {
      this.lostRemaining = remaining;
      this.openOverlay(Overlay.Lost, this.lostHtml(remaining));
    }
    if (remainingMs <= 0) {
      // Le décompte est écoulé : la tentative en cours (ou la prochaine) sera la dernière.
      this.lostFinal = true;
      if (!this.reconnecting) void this.tryReconnect();
      return;
    }
    this.lostRetryAt -= dt;
    if (this.lostRetryAt <= 0 && !this.reconnecting) {
      this.lostRetryAt = 2;
      void this.tryReconnect();
    }
  }

  /** Tente de reprendre la partie gelée. La dernière chance se décide à l'échec (`lostFinal`), pas au lancement. */
  private async tryReconnect(): Promise<void> {
    if (this.reconnecting || !this.gameId || !this.gameToken) return;
    this.reconnecting = true;
    try {
      const { link, reply } = await this.requestResume(this.gameId, this.gameToken);
      this.reconnecting = false;
      this.handleResumeReply(link, reply);
    } catch {
      this.reconnecting = false;
      if (this.lostFinal) this.applyEnded();
    }
  }

  /** Ouvre une liaison neuve, envoie `resume` et rend la liaison avec sa réponse. Rejette sur échec de connexion ou coupure : la liaison est alors déjà fermée. */
  private async requestResume(id: string, token: string): Promise<{ link: ServerLink; reply: Extract<ServerMessage, { t: ServerMessageType.Resumed | ServerMessageType.Over | ServerMessageType.Ended }> }> {
    const link = new ServerLink();
    try {
      await link.connect();
      const reply = await new Promise<Extract<ServerMessage, { t: ServerMessageType.Resumed | ServerMessageType.Over | ServerMessageType.Ended }>>((resolve, reject) => {
        link.onLost(() => reject(new Error('connexion perdue')));
        link.onMessage((msg) => {
          if (msg.t === ServerMessageType.Resumed || msg.t === ServerMessageType.Over || msg.t === ServerMessageType.Ended) resolve(msg);
        });
        link.send({ t: ClientMessageType.Resume, id, token });
      });
      return { link, reply };
    } catch (e) {
      link.close();
      throw e;
    }
  }

  /** Réponse à une reprise (`resumed`/`over`/`ended`), commune à la reconnexion automatique et au bouton de reprise. */
  private handleResumeReply(link: ServerLink, reply: Extract<ServerMessage, { t: ServerMessageType.Resumed | ServerMessageType.Over | ServerMessageType.Ended }>): void {
    if (reply.t === ServerMessageType.Resumed) this.applyResumed(link, reply);
    else if (reply.t === ServerMessageType.Over) this.applyAbandon(link, reply);
    else this.applyEnded(link);
  }

  private applyResumed(link: ServerLink, msg: Extract<ServerMessage, { t: ServerMessageType.Resumed }>): void {
    this.link = link;
    this.attachLink(link);
    this.world = restore(msg.snapshot);
    this.mapId = this.world.map.id;
    this.difficulty = this.world.difficulty;
    this.renderer.setWorld(this.world);
    this.resize();
    this.loop.speed = msg.speed;
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === msg.speed)));
    this.setPaused(msg.paused);
    this.savePending();
    if (msg.paused) this.showPause();
    else this.closeOverlay();
    this.resetLostState();
  }

  private applyAbandon(link: ServerLink, msg: Extract<ServerMessage, { t: ServerMessageType.Over }>): void {
    link.close();
    this.link = null;
    this.clearPending();
    this.world = restore(msg.snapshot);
    this.mapId = this.world.map.id;
    this.difficulty = this.world.difficulty;
    this.renderer.setWorld(this.world);
    this.resize();
    this.saveBest();
    this.toast('La partie est terminée.', true);
    this.showEnd();
    this.resetLostState();
  }

  private applyEnded(link?: ServerLink): void {
    link?.close();
    this.link = null;
    this.clearPending();
    this.showEndedOverlay();
    this.resetLostState();
  }

  private diffsHtml(mapId: string): string {
    const best = this.loadBest()[mapId] ?? {};
    return (Object.keys(DIFFICULTY) as Difficulty[])
      .map((d) => {
        const D = DIFFICULTY[d];
        const rec = best[d] ? `<span class="record">Record : vague ${best[d]}</span>` : '';
        return `<button type="button" class="diff" role="radio" data-diff="${d}" aria-checked="${d === this.difficulty}">
          <strong>${D.label}</strong><span>${D.lives} vies · ${D.gold} or</span><span>PV des créatures ×${fmt1(D.hp)}</span>${rec}</button>`;
      })
      .join('');
  }

  private showStart(): void {
    this.link?.close();
    this.link = null;
    this.setPaused(true);
    const maps = MAPS.map(
      (m) => `<button type="button" class="map" role="radio" data-map="${m.id}" aria-checked="${m.id === this.mapId}">
        <canvas class="map-thumb" data-thumb="${m.id}" width="64" height="64"></canvas><span>${m.name}</span></button>`,
    ).join('');
    this.openOverlay(Overlay.Start, `
      <div class="sheet">
        <h1>Dédale</h1>
        <p class="lede">Bâtissez le labyrinthe, tenez la porte. Trente vagues, trois chefs, et un seul chemin que vous dessinez vous-même.</p>
        <ol>
          <li><b>Les créatures passent par les pierres runiques, dans l'ordre</b> avant de rejoindre la porte : votre champ est traversé à chaque tronçon.</li>
          <li><b>Murs à 3 pièces d'or</b> pour allonger leur trajet, transformables ensuite en tours. Le passage ne peut jamais être fermé.</li>
          <li><b>Chaque attaque a ses proies</b> : perçant contre léger, siège contre fortifié, magie contre lourd. Les volants ignorent le labyrinthe.</li>
          <li><b>Remboursement intégral</b> de ce que vous bâtissez avant le lancement de la vague suivante.</li>
        </ol>
        <p class="label">Carte</p>
        <div class="maps" role="radiogroup" aria-label="Carte">${maps}</div>
        <p class="label">Difficulté</p>
        <div class="diffs" role="radiogroup" aria-label="Difficulté"></div>
        <div class="row"><button type="button" class="btn primary" id="startBtn">Commencer</button><button type="button" class="btn" id="startHelp">Commandes et armures</button></div>
      </div>`);
    const el = $('overlay');
    el.querySelectorAll<HTMLCanvasElement>('[data-thumb]').forEach((c) => {
      const map = MAPS.find((m) => m.id === c.dataset.thumb)!;
      drawMapThumbnail(c.getContext('2d')!, map, c.width);
    });
    const bindDiffs = (): void => {
      const diffsEl = el.querySelector<HTMLElement>('.diffs')!;
      diffsEl.innerHTML = this.diffsHtml(this.mapId);
      diffsEl.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((b) =>
        b.addEventListener('click', () => {
          this.difficulty = b.dataset.diff as Difficulty;
          diffsEl.querySelectorAll('[data-diff]').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
        }),
      );
    };
    bindDiffs();
    el.querySelectorAll<HTMLButtonElement>('[data-map]').forEach((b) =>
      b.addEventListener('click', () => {
        this.mapId = b.dataset.map!;
        el.querySelectorAll('[data-map]').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
        bindDiffs();
      }),
    );
    $('startBtn').addEventListener('click', () => {
      this.sfx.unlock();
      this.newGame(this.difficulty);
    });
    $('startHelp').addEventListener('click', () => this.showHelp(true));
    ($('startBtn') as HTMLButtonElement).focus();
    this.offerResume();
  }

  /** Partie interrompue connue (clé locale) : propose de la reprendre, sans bloquer l'écran titre. Liaison de sondage refermée dès la réponse. */
  private async offerResume(): Promise<void> {
    const pending = this.loadPending();
    if (!pending) return;
    const link = new ServerLink();
    try {
      await link.connect();
      const reply = await new Promise<Extract<ServerMessage, { t: ServerMessageType.Resumable }>>((resolve, reject) => {
        link.onLost(() => reject(new Error('connexion perdue')));
        link.onMessage((msg) => {
          if (msg.t === ServerMessageType.Resumable) resolve(msg);
        });
        link.send({ t: ClientMessageType.Resumable, id: pending.id, token: pending.token });
      });
      link.close();
      if (!reply.ok) {
        this.clearPending();
        return;
      }
      if (this.overlay !== Overlay.Start) return;
      this.gameId = pending.id;
      this.gameToken = pending.token;
      this.addResumeButton(pending);
    } catch {
      link.close();
    }
  }

  /** Bouton « Reprendre la partie » : ouvre une liaison neuve à chaque clic, la clé locale n'est jamais effacée sur échec réseau. */
  private addResumeButton(pending: { id: string; token: string }): void {
    const row = document.querySelector<HTMLElement>('#overlay .sheet .row');
    if (!row) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn primary';
    btn.textContent = 'Reprendre la partie';
    btn.addEventListener('click', () => {
      if (btn.disabled || this.launching) return;
      btn.disabled = true;
      this.launching = true;
      this.sfx.unlock();
      this.requestResume(pending.id, pending.token)
        .then(({ link, reply }) => {
          this.launching = false;
          this.handleResumeReply(link, reply);
        })
        .catch(() => {
          this.launching = false;
          this.toast('Impossible de reprendre la partie, vérifiez votre connexion.', true);
          btn.disabled = false;
        });
    });
    row.insertBefore(btn, row.firstChild);
  }

  private armorTable(): string {
    const armors = Object.keys(ARMOR_LABEL) as ArmorType[];
    const attacks = Object.keys(ATTACK_LABEL) as AttackType[];
    const head = armors.map((a) => `<th scope="col">${ARMOR_LABEL[a]}</th>`).join('');
    const rows = attacks
      .map((t) => {
        const cells = armors
          .map((a) => {
            const m = ATTACK_TABLE[t][a];
            return `<td class="${m >= 1.25 ? 'g' : m <= 0.75 ? 'b' : ''}">×${fmtM(m)}</td>`;
          })
          .join('');
        return `<tr><th scope="row">${ATTACK_LABEL[t]}</th>${cells}</tr>`;
      })
      .join('');
    return `<div class="table-wrap"><table class="armor"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  private showHelp(fromStart = false): void {
    if (this.overlay === Overlay.Lost) return;
    this.helpFromStart = fromStart;
    this.pausedByOverlay = this.loop.paused;
    this.setPaused(true);
    this.openOverlay(Overlay.Help, `
      <div class="sheet">
        <h2>Commandes</h2>
        <div class="keys">
          <kbd>Q W E R A S</kbd><span>Choisir une construction (le panneau suit la disposition de Warcraft III)</span>
          <kbd>Clic</kbd><span>Bâtir ou sélectionner · clic droit ou Échap pour annuler</span>
          <kbd>Espace</kbd><span>Appeler la vague suivante en avance, contre de l'or</span>
          <kbd>1 2 3</kbd><span>Vitesse de jeu</span>
          <kbd>P</kbd><span>Pause · <kbd>M</kbd> son · <kbd>L</kbd> afficher le trajet</span>
          <kbd>Z · V</kbd><span>Sur une tour : changer le ciblage, vendre</span>
        </div>
        <p class="label">Table attaque / armure</p>
        ${this.armorTable()}
        <p class="label">Conseils</p>
        <ol>
          <li>Le trajet en pointillés montre le chemin actuel ; en doré, celui qu'aurait votre prochaine construction.</li>
          <li>Chaque point d'armure réduit les dégâts d'environ 6 % ; la Tour acide et la Corrosion la rongent pour toutes vos tours.</li>
          <li>Les intérêts (4 % de votre or, plafonnés) tombent à la fin de chaque vague : épargner rapporte, mais pas autant que tenir.</li>
          <li>Les spectres de la vague 9 ignorent givre et foudre : prévoyez archers, canons ou venin.</li>
        </ol>
        <div class="row"><button type="button" class="btn primary" id="closeHelp">${fromStart ? 'Retour' : 'Reprendre'}</button></div>
      </div>`);
    $('closeHelp').addEventListener('click', () => this.escape());
  }

  private showPause(): void {
    this.pausedByOverlay = false;
    this.openOverlay(Overlay.Pause, `
      <div class="sheet" style="width:min(360px,100%);text-align:center">
        <h2>Pause</h2>
        <p class="lede">Le temps est suspendu. Vous pouvez encore consulter vos tours.</p>
        <div class="row" style="justify-content:center"><button type="button" class="btn primary" id="resume">Reprendre</button></div>
      </div>`);
    $('resume').addEventListener('click', () => this.togglePause());
  }

  private showEnd(): void {
    const w = this.world;
    const win = w.phase === Phase.Victory;
    const s = w.stats;
    const reached = win ? w.wave + 1 : Math.max(1, w.wave + 1);
    this.openOverlay(Overlay.End, `
      <div class="sheet">
        <h2>${win ? (w.endless ? 'Vous tenez encore' : 'Victoire') : 'La porte est tombée'}</h2>
        <p class="lede">${win ? `Les trente vagues sont venues se briser sur votre labyrinthe, avec ${w.lives} vies restantes.` : `Votre défense a tenu jusqu'à la vague ${reached}.`}</p>
        <div class="endstats">
          <div><b>${reached}</b><span>Vagues</span></div>
          <div><b>${fmt0(s.kills)}</b><span>Éliminations</span></div>
          <div><b>${fmt0(s.leaked)}</b><span>Évasions</span></div>
          <div><b>${fmt0(s.longestMaze)}</b><span>Plus long trajet</span></div>
          <div><b>${fmt0(s.goldEarned)}</b><span>Or gagné</span></div>
        </div>
        <div class="debrief-tabs" role="tablist">
          <button type="button" class="debrief-tab active" data-tab="towers">Tours</button>
          <button type="button" class="debrief-tab" data-tab="families">Familles</button>
          <button type="button" class="debrief-tab" data-tab="waves">Vagues</button>
          <button type="button" class="debrief-tab" data-tab="breakers">Briseurs</button>
        </div>
        <div class="debrief-panel" data-panel="towers">${debriefTowers(towerRanking(s.towers.values()))}</div>
        <div class="debrief-panel" data-panel="families" hidden>${debriefFamilies(familyDamage(s.towers.values()))}</div>
        <div class="debrief-panel" data-panel="waves" hidden>${debriefWaves(waveCurve(s.waves, w.gold))}</div>
        <div class="debrief-panel" data-panel="breakers" hidden>${debriefBreakers(breakerLosses(s.towers.values()))}</div>
        <div class="row">
          ${win ? '<button type="button" class="btn primary" id="endless">Continuer en mode infini</button>' : ''}
          <button type="button" class="btn ${win ? '' : 'primary'}" id="again">Nouvelle partie</button>
        </div>
      </div>`);
    for (const tab of document.querySelectorAll<HTMLButtonElement>('.debrief-tab')) {
      tab.addEventListener('click', () => {
        for (const t of document.querySelectorAll('.debrief-tab')) t.classList.remove('active');
        tab.classList.add('active');
        for (const panel of document.querySelectorAll<HTMLElement>('.debrief-panel')) {
          panel.hidden = panel.dataset.panel !== tab.dataset.tab;
        }
      });
    }
    $('again').addEventListener('click', () => this.showStart());
    if (win) {
      $('endless').addEventListener('click', () => {
        const r = this.order({ c: CommandType.Endless });
        if (r.ok) this.savePending();
        this.endShown = false;
        this.closeOverlay();
        this.toast('Mode infini : les vagues ne s’arrêtent plus.');
      });
    }
  }
}
