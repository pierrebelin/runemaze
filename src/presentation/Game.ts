import { Sfx } from '../infrastructure/audio/Sfx';
import { GameLoop } from '../infrastructure/GameLoop';
import { CREEPS, DIFFICULTY, waveAt } from '../domain/catalog/creeps';
import { BIOMES, MAP_RECIPE } from '../domain/catalog/map';
import { drawMap } from '../domain/rules/mapDraw';
import { BUILDERS } from '../domain/catalog/builders';
import { TOWERS } from '../domain/catalog/towers';
import { GLEANER } from '../domain/catalog/ether';
import { etherPerMinute } from '../domain/rules/etherRate';
import { fittedView, isDrag, zoomView, layOutMaps, panView, mapAt, toWorldPoint, isMapVisible, type CommonWorld, type WorldView } from '../infrastructure/render/commonWorld';
import { Effects } from '../infrastructure/render/Effects';
import { Renderer, type Board, type ViewState } from '../infrastructure/render/Renderer';
import { PAL } from '../infrastructure/render/palette';
import { drawCreep, drawMapThumbnail, drawTower } from '../infrastructure/render/sprites';
import { ARMOR_LABEL, ATTACK_LABEL, ATTACK_TABLE } from '../domain/rules/Damage';
import { dispatch } from '../application/dispatch';
import { canBuild } from '../application/queries/canBuild';
import { canBuyGleaner } from '../application/queries/canBuyGleaner';
import { builderTowers, buildMenu, upgradeOptions } from '../domain/rules/builder';
import { previewRoute } from '../application/queries/previewRoute';
import { goldForecast } from '../application/queries/goldForecast';
import { groupSends, waveBriefing } from '../application/queries/waveBriefing';
import { realign } from '../application/online/realign';
import { Seat, rivalSeats, teamOf } from '../application/online/duel';
import { LOST_LIMIT_MS } from '../application/online/heldGame';
import { ClientMessageType, Mode, NICK_MAX, NICK_MIN, ServerMessageType, Team, validNick } from '../application/online/protocol';
import type { OtherMap, ServerMessage } from '../application/online/protocol';
import { refundValue, upgradeCost } from '../domain/rules/pricing';
import { gleanerCost } from '../domain/rules/gleanerCost';
import { World, type Stats } from '../domain/model/World';
import { restore, type WorldSnapshot } from '../domain/model/snapshot';
import { fingerprint } from '../domain/rules/fingerprint';
import type { ArmorType, AttackType, Biome, Command, Creep, Difficulty, GameEvent, GateUpgrade, MapDef, Result, TargetMode, Tower } from '../domain/model/types';
import { CommandType, GameEventType } from '../domain/model/types';
import { breakerLosses, familyDamage, towerRanking, waveCurve } from '../domain/rules/debrief';
import { withRecord, type RecordBook } from '../domain/rules/records';
import { biomeEffect, biomeLabel, mapFacts, resignPrompt, etherChip,goldForecastChip, goldForecastInfo, briefingChip, briefingInfo, creepInfo, debriefBreakers, debriefFamilies, debriefTowers, debriefWaves, duelVerdictLabel, modeHint, modeLabel, pairRoster, teamRoster, waveRecap, builderCard, elementsLabel, FAMILY_LABEL, fmt0, fmt1, fmtM, gatePanel, gleanerPanel, nextWaveInfo, partnerLabel, placedTowerInfo, reachedTitle, rivalDetail, rivalHeadline, scoreboard, sendPanel, sentMessage, TARGET_LABEL, towerInfo } from './describe';
import { ServerLink } from './ServerLink';

/** Échappe une donnée venant du serveur (pseudo, carte…) avant insertion dans un gabarit HTML. */
function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Carte tirée : grande miniature, puis biome (au choix si `editable`), son effet et les chiffres de la carte. */
function mapPickHtml(map: MapDef, editable: boolean): string {
  const biome = map.biome ?? BIOMES[0];
  const head = editable
    ? `<div class="biomes" role="radiogroup" aria-label="Biome">${BIOMES.map((b) => `<button type="button" class="biome" role="radio" data-biome="${b}" aria-checked="${b === biome}">${biomeLabel(b)}</button>`).join('')}</div>
      <button type="button" class="btn" data-redraw>Retirer une carte</button>`
    : `<h3 class="map-biome">${biomeLabel(biome)}</h3>`;
  return `<canvas class="map-thumb" width="576" height="384" aria-hidden="true"></canvas>
    <div class="map-info">
      <div class="map-head">${head}</div>
      <p class="map-effect">${biomeEffect(biome)}</p>
      <dl class="map-facts">${mapFacts(map).map((f) => `<div><dt>${f.label}</dt><dd>${f.value}</dd></div>`).join('')}</dl>
    </div>`;
}

function paintThumb(root: HTMLElement, map: MapDef): void {
  const c = root.querySelector<HTMLCanvasElement>('.map-thumb')!;
  drawMapThumbnail(c.getContext('2d')!, map, c.width, c.height);
}

const KEYS = ['q', 'w', 'e', 'r', 'a', 's', 'd', 'f', 'z', 'x', 'c', 'v'];
const TARGET_ORDER: TargetMode[] = ['first', 'last', 'strong', 'weak', 'close'];
const BEST_KEY = 'dedale.best.v2';
/** Records par difficulté : les cartes tirées n'ont pas d'identité, une seule clé. */
const RECORD_KEY = 'tirage';
const PENDING_KEY = 'dedale.pending.v1';
const DUEL_SEAT_KEY = 'dedale.duelseat.v1';

const ICON_CANCEL = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M11 11l18 18M29 11L11 29" stroke="#e0664f" stroke-width="4" stroke-linecap="round"/></svg>';
const ICON_HELP = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="none" stroke="#8d939c" stroke-width="2.5"/><path d="M15.5 16a4.5 4.5 0 119 .5c0 3-4.5 3.5-4.5 6.5" fill="none" stroke="#e7e8ea" stroke-width="2.6" stroke-linecap="round"/><circle cx="20" cy="28" r="1.8" fill="#e7e8ea"/></svg>';
const ICON_SELL = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="17" cy="22" r="9" fill="#e9b949" stroke="#8a6320" stroke-width="2"/><circle cx="24" cy="16" r="9" fill="#f2cc66" stroke="#8a6320" stroke-width="2"/><path d="M24 11v10M21 13.5h4.5a1.7 1.7 0 010 3.4h-3a1.7 1.7 0 000 3.4h4.5" fill="none" stroke="#8a6320" stroke-width="1.6"/></svg>';
const ICON_TARGET = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="11" fill="none" stroke="#e7e8ea" stroke-width="2.5"/><circle cx="20" cy="20" r="3" fill="#e0664f"/><path d="M20 4v8M20 28v8M4 20h8M28 20h8" stroke="#e7e8ea" stroke-width="2.5"/></svg>';
const ICON_BACK = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M24 11l-9 9 9 9" fill="none" stroke="#e7e8ea" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

interface Slot {
  label: string;
  icon: string;
  cost?: number;
  poor?: boolean;
  active?: boolean;
  run: () => void;
  info: () => string;
}

enum Overlay {
  Start = 'start',
  Help = 'help',
  End = 'end',
  Pause = 'pause',
  Lost = 'lost',
  Lobby = 'lobby',
  Resign = 'resign',
  Setup = 'setup',
}

type Selection = { kind: 'tower' | 'creep'; id: number; board: number } | null;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class Game {
  private world: World;
  private readonly renderer: Renderer;
  private readonly fx = new Effects();
  private readonly sfx = new Sfx();
  private readonly loop: GameLoop;
  private difficulty: Difficulty = 'normal';
  private seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  private biome: Biome = BIOMES[0];
  private drawnMap: MapDef = drawMap(this.seed, this.biome, MAP_RECIPE);
  private builderId = 'bastion';
  /** Onglet de l'écran titre, gardé d'un retour au titre à l'autre. */
  /** Bâtisseur envoyé dans le salon ; vide tant que le joueur n'a pas cliqué. */
  private lobbyBuilderId: string | null = null;
  /** Qui a choisi son bâtisseur dans le salon (sans l'id adverse). */
  private duelPicked = { host: false, guest: false };
  private link: ServerLink | null = null;
  private launching = false;
  private pausedByVisibility = false;
  private unloading = false;
  private gameId: string | null = null;
  private gameToken: string | null = null;
  private lostElapsed = 0;
  private lostRemaining = -1;
  /** Temps restant avant forfait de l'adversaire déconnecté (décompte local) ; `null` hors gel de duel. */
  private frozenMs: number | null = null;
  private lostRetryAt = 0;
  private lostFinal = false;
  private duelLost = false;
  private reconnecting = false;
  private duelLink: ServerLink | null = null;
  private duelRole: 'host' | 'guest' | null = null;
  private duelCode: string | null = null;
  private duelHostNick = '';
  private duelGuestNick: string | null = null;
  private duelMap: MapDef | null = null;
  private duelDifficulty: Difficulty | null = null;
  private duelInRoom = false;
  /** Mode choisi par l'hôte avant la création, puis mode de la salle reçu du serveur. */
  private duelMode = Mode.Duel;
  private duelTeams: Record<Team, { nick: string; picked: boolean }[]> = { [Team.A]: [], [Team.B]: [] };
  private duelWaiting: string[] = [];
  /** Vrai tant qu'une reprise de siège est en attente de réponse. */
  private duelRejoining = false;
  /** Siège du joueur dans la partie en ligne (0 hors ligne). */
  private duelSeat = 0;
  private ownNick = '';
  /** Autres cartes par siège : restaurées à chaque `Rival`, avancées localement entre deux envois (D3). */
  private others = new Map<number, Omit<Board, 'place'>>();
  /** Dernière vague dont le lancement a été annoncé. Pas recalée par `realign` : un lancement reçu du serveur doit s'annoncer. */
  private announcedWave = 0;
  /** Coin haut-gauche de l'écran dans le monde commun (en cases) et taille d'une case en pixels. */
  private worldView: WorldView = { x: 0, y: 0, scale: 8 };
  private zone = { w: 0, h: 0 };
  private rivalHud: Record<string, string> = {};
  private sendOpen = false;
  private sendTab: 'sends' | 'gleaners' | 'gate' = 'sends';

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
  private sendCache = '';
  private unitCache = '';
  private briefingCache = '';
  private walletCache = '';
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
    this.world = this.createWorld(this.drawnMap, 'normal');
    this.renderer = new Renderer(this.canvas);
    this.loop = new GameLoop(() => this.stepSim(), (dt) => this.frame(dt));
    this.bindInput();
    new ResizeObserver(() => this.resize()).observe(this.stage);
    this.resize();
    this.showStart();
    this.loop.start();
  }

  private createWorld(map: MapDef, d: Difficulty): World {
    const world = new World({ map, difficulty: d, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, builder: this.builderId });
    this.announcedWave = world.wave;
    return world;
  }

  private async newGame(d: Difficulty): Promise<void> {
    if (this.launching) return;
    this.launching = true;
    const map = this.drawnMap;
    const previous = this.loadSeat(PENDING_KEY) ?? undefined;
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
        link.send({ t: ClientMessageType.Open, map, difficulty: d, builder: this.builderId, ...(previous ? { previous } : {}) });
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
    this.announcedWave = this.world.wave;
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
        break;
      case ServerMessageType.Over:
        this.clearSeat(PENDING_KEY);
        this.world = restore(msg.snapshot);
        this.saveBest();
        this.showEnd();
        break;
      case ServerMessageType.Ended:
        this.clearSeat(PENDING_KEY);
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

  /** Coupure en duel : pas de reprise solo ni de décompte ; le joueur revient au titre et rejoint avec son code (`Rejoin`). */
  private onDuelLost(): void {
    this.link = null;
    // L'overlay « adversaire déconnecté » est un `Lost` : un duel gelé doit quand même basculer sur « Connexion perdue ».
    const frozen = this.frozenMs !== null;
    if (this.overlay === Overlay.End || this.overlay === Overlay.Start || (this.overlay === Overlay.Lost && !frozen)) return;
    this.setPaused(true);
    this.resetLostState();
    this.duelLost = true;
    this.openOverlay(Overlay.Lost, `
      <div class="sheet small">
        <header class="sheet-head"><h2>Connexion perdue</h2><p class="lede">Reprenez la partie avec son code dans les 30 s.</p></header>
        <div class="row actions"><button type="button" class="btn primary" id="quitDuelLost">Écran titre</button></div>
      </div>`);
    $('quitDuelLost').addEventListener('click', () => this.leaveLobby());
  }

  /** Envoie un ordre du joueur : `dispatch` fait foi localement, le serveur ne fait que confirmer ou recaler. */
  private order(cmd: Command): Result {
    const r = dispatch(this.world, cmd);
    if (r.ok) this.link?.send({ t: ClientMessageType.Order, tick: this.world.tick, cmd, fingerprint: fingerprint(this.world) });
    return r;
  }

  private sendPace(): void {
    this.link?.send({ t: ClientMessageType.Pace, tick: this.world.tick, paused: this.loop.paused });
  }

  private resize(): void {
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    if (w <= 0 || h <= 0) return;
    this.zone = { w, h };
    this.renderer.resize(w, h);
    this.recenter();
  }

  /**
   * Cartes de la partie et leur monde commun. Duel et coop : une rangée, un siège par carte (RM-09).
   * 2 contre 2 : grille 2×2, son équipe en haut (soi puis coéquipier), les adversaires en bas (RM-11).
   */
  private layout(): { boards: Board[]; common: CommonWorld } {
    const teams = this.duelMode === Mode.Teams;
    const ownNick = this.duelRole === null ? '' : teams ? this.ownNick : (this.duelRole === 'host' ? this.duelHostNick : this.duelGuestNick) ?? '';
    const own = { world: this.world, fx: this.fx, view: this.view, nick: ownNick };
    const seats = [...this.others.keys()].sort((a, b) => a - b);
    const boardsOf = (list: number[]) => list.map((s) => this.others.get(s)!);
    const mates = seats.filter((s) => teamOf(this.duelMode, s) === teamOf(this.duelMode, this.duelSeat));
    const ordered = teams
      ? [own, ...boardsOf(mates), ...boardsOf(seats.filter((s) => !mates.includes(s)))]
      : [...boardsOf(seats.filter((s) => s < this.duelSeat)), own, ...boardsOf(seats.filter((s) => s > this.duelSeat))];
    const sizes = ordered.map((b) => ({ w: b.world.grid.w, h: b.world.grid.h }));
    const common = layOutMaps(sizes, teams ? 2 : ordered.length);
    return { boards: ordered.map((b, i) => ({ ...b, place: common.maps[i] })), common };
  }

  private ownIndex(): number {
    if (this.duelMode === Mode.Teams) return 0;
    return [...this.others.keys()].filter((s) => s < this.duelSeat).length;
  }

  /** Ramène la vue ajustée sur sa carte. */
  private recenter(): void {
    const { boards } = this.layout();
    this.worldView = fittedView(boards[this.ownIndex()].place, this.zone);
  }

  // ─── Simulation ──────────────────────────────────────────────────────────

  private stepSim(): void {
    // Duel gelé : ni notre carte ni la carte adverse n'avancent, `Thawed` recale sur l'horloge du serveur.
    if (this.frozenMs !== null) return;
    // Partie terminée (bilan affiché) : plus rien n'avance, ni vagues ni créatures, des deux côtés.
    if (this.overlay === Overlay.End) return;
    this.world.step();
    // Carte adverse avancée localement entre deux `Rival` : effets visuels, aucun son (pas la nôtre).
    // Un monde restauré repart sans événement : rien n'est rejoué en double.
    for (const o of this.others.values()) {
      o.world.step();
      o.fx.consume(o.world.drainEvents());
    }
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
        this.toast(`Vague ${e.wave + 1} repoussée : +${e.bonus} or${e.income > 0 ? `, +${e.income} de revenu` : e.interest ? `, +${e.interest} d'intérêts` : ''}${e.trade > 0 ? `, +${e.trade} de comptoir` : ''}.`);
        break;
      case GameEventType.Leak:
        // Carte hors champ : l'effet d'écran n'est pas vu, les vies tressautent à la place.
        if (!isMapVisible(this.worldView, this.zone, this.layout().boards[this.ownIndex()].place)) this.flashLives();
        if (w.time - this.leakToastAt > 3) {
          this.leakToastAt = w.time;
          this.toast(e.boss ? `Le chef a franchi la porte : −${e.lives} vies.` : 'Une créature a franchi la porte.', true);
        }
        break;
      default:
        break;
    }
  }

  private flashLives(): void {
    $('lives').animate([{ transform: 'scale(1.6)' }, { transform: 'scale(1)' }], 300);
  }

  private frame(dt: number): void {
    if (this.overlay === Overlay.Lost) {
      if (this.frozenMs !== null) this.updateFrozen(dt);
      else if (!this.duelLost) this.updateLost(dt);
    }
    const w = this.world;
    this.fx.update(this.loop.paused ? 0 : dt);
    for (const o of this.others.values()) o.fx.update(this.loop.paused ? 0 : dt);

    const sw = this.selectedWorld();
    if (this.selected?.kind === 'creep' && !sw?.creeps.some((c) => c.id === this.selected!.id && c.alive)) this.selected = null;
    if (this.selected?.kind === 'tower' && !sw?.towerById.has(this.selected.id)) this.selected = null;

    // Revalide l'emplacement fantôme : les créatures bougent.
    this.ghostCheck -= dt;
    if (this.buildDef && this.anchor && this.ghostCheck <= 0) this.updateGhost();

    this.view.buildDef = this.buildDef;
    const select = (view: ViewState, board: number) => {
      const sel = this.selected?.board === board ? this.selected : null;
      view.selectedTower = sel?.kind === 'tower' ? sel.id : null;
      view.selectedCreep = sel?.kind === 'creep' ? sel.id : null;
    };
    select(this.view, this.duelSeat);
    for (const [seat, o] of this.others) select(o.view, seat);
    this.canvas.classList.toggle('building', !!this.buildDef);

    this.announceWave();
    this.renderer.draw(this.layout().boards, this.worldView, this.ownIndex(), w.time, this.loop.realTime);
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

  private toggleSendPanel(): void {
    if (this.world.duel) this.sendOpen = !this.sendOpen;
  }

  private sendCreep(id: string): void {
    const r = this.order({ c: CommandType.Send, creep: id });
    if (!r.ok) this.fail(r.reason);
    else this.drainNow();
  }

  private buyGleaner(): void {
    const r = this.order({ c: CommandType.Gleaner });
    if (!r.ok) this.fail(r.reason);
    else this.drainNow();
  }

  private upgradeGate(upgrade: GateUpgrade): void {
    const r = this.order({ c: CommandType.Gate, upgrade });
    if (!r.ok) this.fail(r.reason);
    else this.drainNow();
  }

  private setPaused(p: boolean): void {
    this.loop.paused = p;
    $('pauseBtn').setAttribute('aria-pressed', String(p));
  }

  private togglePause(): void {
    if (this.duelRole) return;
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
    if (this.overlay === Overlay.Help || this.overlay === Overlay.Pause || this.overlay === Overlay.Resign) {
      this.closeOverlay();
      if (!this.pausedByOverlay) this.setPaused(false);
      if (!this.duelRole) this.sendPace();
      return;
    }
    if (this.buildDef) this.setBuild(null);
    else this.selected = null;
  }

  // ─── Entrées ─────────────────────────────────────────────────────────────

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    // Appui gauche en cours : point d'appui, dernier point, et glisser reconnu (au-delà du seuil).
    let press: { start: { x: number; y: number }; last: { x: number; y: number }; drag: boolean; touch: boolean } | null = null;
    // Pointeurs actifs : à deux, le pincement zoome autour de leur milieu, sans glisser ni pose.
    const pointers = new Map<number, { x: number; y: number }>();
    const spread = (): number => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.overlay) return;
      this.zoomAt(Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
    }, { passive: false });
    c.addEventListener('pointermove', (e) => {
      const p = { x: e.clientX, y: e.clientY };
      if (pointers.has(e.pointerId)) {
        const before = pointers.size === 2 ? spread() : 0;
        pointers.set(e.pointerId, p);
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const after = spread();
          if (before > 0 && after > 0) this.zoomAt(after / before, (a.x + b.x) / 2, (a.y + b.y) / 2);
          return;
        }
      }
      if (press) {
        if (!press.drag && isDrag(press.start, p)) press.drag = true;
        if (press.drag) {
          this.worldView = panView(this.worldView, p.x - press.last.x, p.y - press.last.y, this.layout().common, this.zone);
          press.last = p;
          return;
        }
      }
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
      const p = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, p);
      // Capture : le relâchement au-dessus d'un panneau posé sur la toile arrive quand même ici.
      c.setPointerCapture(e.pointerId);
      press = pointers.size >= 2 ? null : { start: p, last: p, drag: false, touch: e.pointerType === 'touch' };
    });
    // Fin de pincement : le doigt resté posé fait glisser la vue depuis sa position, sans clic ni pose.
    const release = (id: number): boolean => {
      const pinched = pointers.size === 2;
      pointers.delete(id);
      const rest = pinched ? [...pointers.values()][0] : undefined;
      press = rest ? { start: rest, last: rest, drag: true, touch: true } : null;
      return pinched;
    };
    c.addEventListener('pointercancel', (e) => {
      release(e.pointerId);
    });
    c.addEventListener('pointerup', (e) => {
      const done = press;
      if (release(e.pointerId)) return;
      press = null;
      if (!done || done.drag || this.overlay) return;
      // Clic sur la carte adverse : fiche en lecture seule, sauf tour en main (rien n'est posé).
      const { boards, common } = this.layout();
      const hit = mapAt(common, toWorldPoint(this.worldView, this.renderer.toScreen(e.clientX, e.clientY)));
      if (hit && hit.index !== this.ownIndex() && !this.buildDef) {
        const touched = boards[hit.index].world;
        const seat = [...this.others].find(([, o]) => o.world === touched)![0];
        this.pick(touched, hit.x, hit.y, seat);
        return;
      }
      const g = this.ownCell(e.clientX, e.clientY);
      // Clic hors de sa carte (adverse, écart, hors monde) : rien n'est posé, la tour reste en main.
      if (!g) return;
      if (this.buildDef) {
        const a = this.anchorFor(g.x, g.y);
        if (done.touch) {
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
      this.pick(this.world, g.x, g.y, this.duelSeat);
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
      if (this.duelRole) return;
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

    $('pauseBtn').addEventListener('click', () => this.togglePause());
    $('resignBtn').addEventListener('click', () => this.showResign());
    $('sendBtn').addEventListener('click', () => this.toggleSendPanel());
    // Souris sur `pointerdown` : `#sendPanel` est reconstruit quand l'or franchit un seuil, un `click` serait perdu.
    // `click` ne sert qu'au clavier (`detail === 0`).
    const sendFrom = (e: Event): void => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-send]');
      if (b && !this.overlay && !b.matches(':disabled')) this.sendCreep(b.dataset.send!);
      const g = (e.target as HTMLElement).closest<HTMLElement>('[data-gleaner]');
      if (g && !this.overlay && !g.matches(':disabled')) this.buyGleaner();
      const u = (e.target as HTMLElement).closest<HTMLElement>('[data-gate]');
      if (u && !this.overlay && !u.matches(':disabled')) this.upgradeGate(u.dataset.gate as GateUpgrade);
      const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (tab) this.sendTab = tab.dataset.tab as typeof this.sendTab;
    };
    $('sendPanel').addEventListener('pointerdown', (e) => {
      if (e.button === 0) sendFrom(e);
    });
    $('sendPanel').addEventListener('click', (e) => {
      if (e.detail === 0) sendFrom(e);
    });
    $('muteBtn').addEventListener('click', () => this.toggleMute());
    $('helpBtn').addEventListener('click', () => (this.overlay === Overlay.Help ? this.escape() : this.showHelp()));

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      // Entrée : bouton focalisé (Jouer en solo par défaut), champ pseudo ou code.
      if (this.overlay === Overlay.Start) return;
      if (this.overlay === Overlay.Setup) {
        if (k === 'enter') {
          e.preventDefault();
          $('startBtn').click();
        } else if (k === 'escape') this.showStart();
        return;
      }
      if (this.overlay === Overlay.End || this.overlay === Overlay.Lost) return;
      if (k === 'escape') this.escape();
      else if (k === 'h' || k === '?') this.overlay === Overlay.Help ? this.escape() : this.showHelp();
      else if (k === 'p') this.togglePause();
      else if (this.overlay) return;
      else if (k === 'm') this.toggleMute();
      else if (k === 't') this.toggleSendPanel();
      else if (k === 'l') this.view.showRoute = !this.view.showRoute;
      else if (k === ' ') {
        e.preventDefault();
        this.recenter();
      }
      else if (KEYS.includes(k) && !e.repeat) {
        const i = KEYS.indexOf(k);
        if (this.slots[i]) {
          e.preventDefault();
          this.runSlot(i);
        }
      }
    });
  }

  private zoomAt(factor: number, clientX: number, clientY: number): void {
    const { boards, common } = this.layout();
    const fitted = fittedView(boards[this.ownIndex()].place, this.zone);
    this.worldView = zoomView(this.worldView, factor, this.renderer.toScreen(clientX, clientY), common, fitted, this.zone);
  }

  /** Position écran → coordonnées de la grille de sa carte (cases, fractionnaires), null hors de sa carte. */
  private ownCell(clientX: number, clientY: number): { x: number; y: number } | null {
    const p = toWorldPoint(this.worldView, this.renderer.toScreen(clientX, clientY));
    const hit = mapAt(this.layout().common, p);
    return hit && hit.index === this.ownIndex() ? hit : null;
  }

  private anchorFor(gx: number, gy: number): { x: number; y: number } {
    return { x: Math.round(gx - 1), y: Math.round(gy - 1) };
  }

  private pointerTo(cx: number, cy: number): void {
    if (!this.buildDef) return;
    const g = this.ownCell(cx, cy);
    if (!g) {
      this.anchor = null;
      this.view.ghost = null;
      this.view.previewRoute = null;
      return;
    }
    const a = this.anchorFor(g.x, g.y);
    if (!this.anchor || a.x !== this.anchor.x || a.y !== this.anchor.y) {
      this.anchor = a;
      this.updateGhost();
    }
  }

  private pick(w: World, gx: number, gy: number, board: number): void {
    const cx = Math.floor(gx);
    const cy = Math.floor(gy);
    if (w.grid.inBounds(cx, cy)) {
      const id = w.grid.tower[w.grid.idx(cx, cy)];
      if (id) {
        this.selected = { kind: 'tower', id, board };
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
    this.selected = best ? { kind: 'creep', id: best.id, board } : null;
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

  private selectedWorld(): World | null {
    return this.selected && this.selected.board !== this.duelSeat ? this.others.get(this.selected.board)?.world ?? null : this.world;
  }

  /** Tour sélectionnée sur sa carte : celles de l'adversaire ne se commandent pas. */
  private selectedTower(): Tower | undefined {
    return this.selected?.kind === 'tower' && this.selected.board === this.duelSeat ? this.world.towerById.get(this.selected.id) : undefined;
  }

  private computeSlots(): (Slot | null)[] {
    const w = this.world;
    const slots: (Slot | null)[] = new Array(12).fill(null);
    const t = this.selectedTower();
    if (t) {
      upgradeOptions(t.def, builderTowers(w.builder, TOWERS)).forEach((id, i) => {
        const to = TOWERS[id];
        const cost = upgradeCost(t.def, to);
        const heading = t.def.family === 'wall' ? `Transformer en ${to.name}` : `Améliorer en ${to.name}`;
        slots[i] = {
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
    if (this.selected?.kind === 'creep' && this.selected.board === this.duelSeat) {
      slots[11] = { label: 'Retour', icon: ICON_BACK, run: () => (this.selected = null), info: () => '<h3>Retour</h3><p>Revient au menu de construction (Échap).</p>' };
      return slots;
    }
    buildMenu(w.builder).forEach((id, i) => {
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

  /** Panneau Envois / Glaneurs / Porte, à part de `#info` pour ne pas masquer la fiche des tours. */
  private updateSendPanel(): void {
    let html = '';
    if (this.sendOpen) {
      const tabs = (['sends', 'gleaners', 'gate'] as const)
        .map((t) => `<button type="button" data-tab="${t}"${t === this.sendTab ? ' class="active"' : ''}>${{ sends: 'Envois', gleaners: 'Glaneurs', gate: 'Porte' }[t]}</button>`)
        .join('');
      const body = this.sendTab === 'sends'
        ? sendPanel(this.world.ether, this.world.income)
        : this.sendTab === 'gleaners' ? gleanerPanel(this.world.ether, this.world.gleaners.length, canBuyGleaner(this.world), gleanerCost(GLEANER.cost, this.world.builder)) : gatePanel(this.world.ether, this.world.gate);
      html = `<div class="tabs">${tabs}</div>${body}`;
    }
    if (html === this.sendCache) return;
    this.sendCache = html;
    const panel = $('sendPanel');
    panel.innerHTML = html;
    panel.hidden = html === '';
  }

  private updateInfo(): void {
    this.updateSendPanel();
    const w = this.world;
    let html: string;
    const hover = this.hoverSlot !== null ? this.slots[this.hoverSlot] : null;
    const shown = this.selected?.kind === 'tower' ? this.selectedWorld()?.towerById.get(this.selected.id) : undefined;
    if (hover) html = hover.info();
    else if (this.buildDef) {
      const def = TOWERS[this.buildDef];
      let status = '';
      if (this.view.ghost && !this.view.ghost.ok) status = `<p style="color:var(--bad)">${this.ghostReason}</p>`;
      else if (this.view.ghost) {
        const now = w.mazeLength();
        status = this.previewDelta > 0.01
          ? `<p style="color:var(--accent)">Trajet : ${fmt0(now)} → ${fmt0(now + this.previewDelta)} cases (+${fmt0(this.previewDelta)})</p>`
          : `<p>Trajet inchangé : ${fmt0(now)} cases.</p>`;
      }
      html = towerInfo(def, def.cost) + status;
    } else if (shown) html = placedTowerInfo(shown, this.selected!.board === this.duelSeat);
    else if (this.selected?.kind === 'creep') {
      const c = this.selectedWorld()?.creeps.find((k) => k.id === this.selected!.id);
      html = c ? creepInfo(c, this.world.builder) : nextWaveInfo(waveBriefing(w), this.world.builder);
    } else html = nextWaveInfo(waveBriefing(w), this.world.builder);
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
    } else if (shown && this.selected!.board === this.duelSeat) {
      const family = shown.def.elements ? `${elementsLabel(shown.def)} · hybride` : FAMILY_LABEL[shown.def.family];
      unit = `<h2>${shown.def.name}</h2><div class="sub">${family}${shown.def.tier ? ` · niveau ${shown.def.tier}` : ''}</div><div class="facts">${shown.def.attack ? `${ATTACK_LABEL[shown.def.attack.type]} · ${fmt0(shown.kills)} éliminations` : 'Bloc de labyrinthe'}</div>`;
    } else if (this.selected?.kind === 'creep' && this.selected.board === this.duelSeat) {
      const c = w.creeps.find((k) => k.id === this.selected!.id);
      unit = c
        ? `<h2>${c.def.name}</h2><div class="sub">Armure ${ARMOR_LABEL[c.def.armorType].toLowerCase()} · vague ${c.wave + 1}</div><div class="hpbar"><i style="width:${Math.max(0, (c.hp / c.maxHp) * 100).toFixed(1)}%"></i></div><div class="facts">${fmt0(c.hp)} / ${fmt0(c.maxHp)} PV</div>`
        : '';
    } else {
      const i = w.wave + 1;
      const wg = waveAt(i).groups[0];
      const def = CREEPS[wg.creep];
      unit = `<h2>${def.boss ? def.name : def.plural}</h2><div class="sub">Vague ${i + 1}${wg.count > 1 ? ` · ×${wg.count}` : ' · chef'}</div><div class="facts">Armure ${ARMOR_LABEL[def.armorType].toLowerCase()}${def.air ? ' · volants' : ''}${def.magicImmune ? ' · immunisés' : ''}</div>`;
    }
    if (unit !== this.unitCache) {
      this.unitCache = unit;
      $('unitText').innerHTML = unit;
    }
  }

  /** Résumé de la prochaine vague dans la barre du haut ; détail au survol. */
  private updateBriefing(): void {
    const b = waveBriefing(this.world);
    const html = briefingChip(b) + briefingInfo(b, this.world.builder);
    if (html === this.briefingCache) return;
    this.briefingCache = html;
    $('briefing').hidden = false;
    $('briefingChip').innerHTML = briefingChip(b);
    $('briefingDetail').innerHTML = briefingInfo(b, this.world.builder);
  }

  /** Or et gain prévu, éther et rythme (duel) au-dessus des commandes ; détail au survol ou à l'appui. */
  private updateWallet(): void {
    const w = this.world;
    const forecast = goldForecast(w);
    const gold = goldForecastChip(w.gold, forecast);
    const goldInfo = goldForecastInfo(forecast, w.duel);
    const ether = etherChip(w.ether, etherPerMinute(w.gleaners.length, GLEANER.period));
    const html = gold + goldInfo + ether + w.duel;
    if (html === this.walletCache) return;
    this.walletCache = html;
    $('goldChip').innerHTML = gold;
    $('goldDetail').innerHTML = goldInfo;
    $('etherPouch').hidden = !w.duel;
    $('etherChip').innerHTML = ether;
  }

  private drawPortrait(): void {
    const c = this.portrait;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e0f11';
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
    if (this.selected?.kind === 'creep' && this.selected.board === this.duelSeat) creep = w.creeps.find((k) => k.id === this.selected!.id);
    const def = creep ? creep.def : CREEPS[waveAt(w.wave + 1).groups[0].creep];
    const span = Math.max(1.4, def.radius * 4.2);
    const s = c.width / span;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    drawCreep(ctx, {
      def, x: span / 2, y: span / 2 + (def.air ? 0.3 : 0.05), hp: 1, maxHp: 1,
      slowPct: creep?.slowPct ?? 0, poisons: creep?.poisons ?? [], shred: 0, hitFlash: 0, bob: 0,
    }, 1, 0.6, time, false);
  }

  /** À chaque nouvelle vague : récapitulatif sous la bannière, et en duel annonce de ce qui part chez le rival. */
  private announceWave(): void {
    const w = this.world;
    if (w.wave === this.announcedWave) return;
    this.announcedWave = w.wave;
    const bySeat = (list: { creep: string; seat: number }[]) => {
      const seats = new Map<number, string[]>();
      for (const { creep, seat } of list) seats.set(seat, [...(seats.get(seat) ?? []), creep]);
      return [...seats].sort(([x], [y]) => x - y).map(([seat, creeps]) => ({ nick: this.others.get(seat)?.nick ?? '', groups: groupSends(creeps) }));
    };
    if (this.fx.banner) this.fx.banner.lines = waveRecap(waveBriefing(w, w.wave), bySeat(w.waveSends.received.map((s) => ({ creep: s.creep, seat: s.from }))));
    if (this.duelRole) {
      // `to` est un rang parmi les sièges adverses, pas un siège.
      const rivals = rivalSeats(this.duelMode, this.duelSeat);
      const lines = bySeat(w.waveSends.sent.map((s) => ({ creep: s.creep, seat: rivals[s.to] }))).map((t) => sentMessage(t.groups, t.nick));
      if (lines.length) this.toast(lines.join('\n'));
    }
  }

  private updateHud(): void {
    const w = this.world;
    const set = (id: string, v: string) => {
      if (this.hud[id] === v) return;
      this.hud[id] = v;
      $(id).textContent = v;
    };
    this.updateWallet();
    set('lives', fmt0(w.lives));
    $('lives').style.color = w.lives <= 5 ? PAL.danger : '';
    set('wave', String(Math.max(0, w.wave + 1)));
    const sendHidden = String(!w.duel);
    if (this.hud.sendHidden !== sendHidden) {
      this.hud.sendHidden = sendHidden;
      $('sendBtn').hidden = !w.duel;
    }
    const can = !w.isOver();
    const secs = Math.ceil(Math.max(0, w.nextWaveIn));
    set('timerLabel', can ? 'Vague suivante : ' : '');
    set('timer', can ? `${secs} s` : '');
  }

  // ─── Autres cartes (duel, coop, 2 contre 2) ──────────────────────────────

  /** Crée l'encart permanent d'une autre carte et son bouton de bascule de vue, une fois par siège. */
  private ensureRivalPanel(seat: number): void {
    if (document.getElementById(`rivalPanel${seat}`)) return;
    const side = document.getElementById('stageSide');
    if (!side) return;
    const panel = document.createElement('details');
    panel.id = `rivalPanel${seat}`;
    panel.className = 'rival-panel';
    panel.innerHTML = `<summary id="rivalHeadline${seat}"></summary><div id="rivalDetail${seat}"></div><button type="button" class="btn" id="rivalViewBtn${seat}">Ma carte</button>`;
    side.prepend(panel);
    // Coéquipier d'abord, puis les adversaires, chacun par siège.
    const rank = (el: Element) => {
      const n = Number(el.id.slice('rivalPanel'.length));
      return (this.duelMode === Mode.Teams && teamOf(this.duelMode, n) === teamOf(this.duelMode, this.duelSeat) ? 0 : 10) + n;
    };
    side.prepend(...[...side.querySelectorAll('.rival-panel')].sort((x, y) => rank(x) - rank(y)));
    $(`rivalViewBtn${seat}`).addEventListener('click', () => this.recenter());
  }

  private removeRivalPanel(): void {
    document.querySelectorAll('.rival-panel').forEach((p) => p.remove());
  }

  private applyOthers(others: OtherMap[]): void {
    for (const o of others) this.applyOther(o);
  }

  /** Restaure la carte du siège, garde ses effets et sa vue, met à jour l'encart. */
  private applyOther({ seat, nick, snapshot }: OtherMap): void {
    this.ensureRivalPanel(seat);
    const previous = this.others.get(seat);
    this.others.set(seat, {
      world: restore(snapshot),
      fx: previous?.fx ?? new Effects(false),
      view: previous?.view ?? { buildDef: null, ghost: null, previewRoute: null, selectedTower: null, selectedCreep: null, showRoute: false },
      nick,
    });
    if (!previous) this.recenter();
    this.updateRivalPanel(seat);
  }

  private updateRivalPanel(seat: number): void {
    const other = this.others.get(seat);
    if (!other || !document.getElementById(`rivalPanel${seat}`)) return;
    const set = (id: string, v: string) => {
      if (this.rivalHud[id] === v) return;
      this.rivalHud[id] = v;
      $(id).innerHTML = v;
    };
    set(`rivalHeadline${seat}`, rivalHeadline(other.nick, other.world.lives));
    set(`rivalDetail${seat}`, rivalDetail(other.world));
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
    // Ni barre de ressources ni console des tours tant qu'aucune partie n'a commencé (écran titre, préparation, aide ouverte depuis le titre, salon) : fond d'accueil à la place.
    const home = kind === Overlay.Start || kind === Overlay.Setup || kind === Overlay.Lobby || (kind === Overlay.Help && this.helpFromStart);
    el.classList.toggle('home', home);
    this.setGameChromeHidden(home);
  }

  private setGameChromeHidden(hidden: boolean): void {
    $('bar').hidden = hidden;
    $('console').hidden = hidden;
  }

  private closeOverlay(): void {
    this.setGameChromeHidden(false);
    this.overlay = null;
    $('overlay').hidden = true;
    $('overlay').innerHTML = '';
  }

  private loadBest(): RecordBook {
    try {
      return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as RecordBook;
    } catch {
      return {};
    }
  }

  private saveBest(): void {
    const w = this.world;
    const reached = Math.max(0, w.wave);
    try {
      const best = withRecord(this.loadBest(), RECORD_KEY, this.difficulty, reached);
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch {
      /* stockage indisponible : on s'en passe */
    }
  }

  /** Reprise de partie (solo ou duel) : `{ id, token }` gardé sous `key`. */
  private loadSeat(key: string): { id: string; token: string } | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const p = JSON.parse(raw) as { id?: unknown; token?: unknown };
      return typeof p.id === 'string' && typeof p.token === 'string' ? { id: p.id, token: p.token } : null;
    } catch {
      return null;
    }
  }

  private saveSeat(key: string, id: string, token: string): void {
    try {
      localStorage.setItem(key, JSON.stringify({ id, token }));
    } catch {
      /* stockage indisponible : on s'en passe */
    }
  }

  private savePending(): void {
    if (this.gameId && this.gameToken) this.saveSeat(PENDING_KEY, this.gameId, this.gameToken);
  }

  private clearSeat(key: string): void {
    try {
      localStorage.removeItem(key);
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
    this.duelLost = false;
    this.reconnecting = false;
    this.frozenMs = null;
  }

  private lostHtml(seconds: number): string {
    return `
      <div class="sheet small">
        <header class="sheet-head"><h2>Connexion perdue — ${seconds} s</h2><p class="lede">Nouvelle tentative de connexion en cours…</p></header>
      </div>`;
  }

  private showFrozen(): void {
    this.openOverlay(Overlay.Lost, `
      <div class="sheet small">
        <header class="sheet-head"><h2>${partnerLabel(!this.world.duel)} déconnecté — ${Math.ceil(this.frozenMs! / 1000)} s</h2></header>
        <div class="row actions"><button type="button" class="btn" id="quitFrozen">Quitter la partie</button></div>
      </div>`);
    $('quitFrozen').addEventListener('click', () => {
      this.link = null;
      this.leaveLobby();
    });
  }

  private updateFrozen(dt: number): void {
    const before = Math.ceil(this.frozenMs! / 1000);
    this.frozenMs = Math.max(0, this.frozenMs! - dt * 1000);
    if (Math.ceil(this.frozenMs / 1000) !== before) this.showFrozen();
  }

  private showEndedOverlay(): void {
    this.openOverlay(Overlay.End, `
      <div class="sheet small">
        <header class="sheet-head"><h2>La partie est terminée.</h2></header>
        <div class="row actions"><button type="button" class="btn primary" id="backToStart">Écran titre</button></div>
      </div>`);
    $('backToStart').addEventListener('click', () => this.showStart(true));
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
    this.biome = this.world.map.biome ?? BIOMES[0];
    this.announcedWave = this.world.wave;
    this.difficulty = this.world.difficulty;
    this.resize();
    this.setPaused(msg.paused);
    this.savePending();
    if (msg.paused) this.showPause();
    else this.closeOverlay();
    this.resetLostState();
  }

  private applyAbandon(link: ServerLink, msg: Extract<ServerMessage, { t: ServerMessageType.Over }>): void {
    link.close();
    this.link = null;
    this.clearSeat(PENDING_KEY);
    this.world = restore(msg.snapshot);
    this.biome = this.world.map.biome ?? BIOMES[0];
    this.difficulty = this.world.difficulty;
    this.resize();
    this.saveBest();
    this.toast('La partie est terminée.', true);
    this.showEnd();
    this.resetLostState();
  }

  private applyEnded(link?: ServerLink): void {
    link?.close();
    this.link = null;
    this.clearSeat(PENDING_KEY);
    this.showEndedOverlay();
    this.resetLostState();
  }

  /** `records` : affiche le record solo de chaque difficulté (sans objet en multijoueur). */
  /** `records` : records solo affichés ; `enabled` faux pour l'invité du salon, qui voit le choix de l'hôte sans le changer. */
  private diffsHtml(checked: Difficulty, records: boolean, enabled = true): string {
    const best = records ? (this.loadBest()[RECORD_KEY] ?? {}) : {};
    return (Object.keys(DIFFICULTY) as Difficulty[])
      .map((d) => {
        const D = DIFFICULTY[d];
        const rec = best[d] ? `<span class="record">Record : vague ${best[d]}</span>` : '';
        return `<button type="button" class="diff" role="radio" data-diff="${d}" aria-checked="${d === checked}"${enabled ? '' : ' disabled'}>
          <strong>${D.label}</strong><span>${D.lives} vies · ${D.gold} or · PV ×${fmt1(D.hp)}</span>${rec}</button>`;
      })
      .join('');
  }

  private buildersHtml(checkedId: string | null): string {
    return Object.values(BUILDERS)
      .map((b) => `<button type="button" class="builder" role="radio" data-builder="${b.id}" aria-checked="${b.id === checkedId}">${builderCard(b)}</button>`)
      .join('');
  }

  /** Sélection d'un bâtisseur dans `root` ; `onPick` est appelé après le choix. */
  private bindBuilders(root: HTMLElement, onPick?: () => void): void {
    root.querySelectorAll<HTMLButtonElement>('[data-builder]').forEach((b) =>
      b.addEventListener('click', () => {
        this.builderId = b.dataset.builder!;
        root.querySelectorAll('[data-builder]').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
        onPick?.();
      }),
    );
  }

  private redraw(): void {
    this.seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    this.drawnMap = drawMap(this.seed, this.biome, MAP_RECIPE);
  }

  /** `fresh` : tire une nouvelle carte (RM-09), seulement au retour d’une partie ou d’un salon ; faux au démarrage et depuis l’aide. */
  private showStart(fresh = false): void {
    if (fresh) this.redraw();
    this.link?.close();
    this.link = null;
    this.setPaused(true);
    this.openOverlay(Overlay.Start, `
      <nav class="home-nav" aria-label="Menu">
        <button type="button" class="btn" id="startHelp">Commandes</button>
        <a class="btn" href="sprites.html" target="_blank" rel="noopener">Sprites des factions</a>
      </nav>
      <div class="sheet start">
        <header class="sheet-head">
          <h1>Tower Defense</h1>
          <p class="lede">Ici, pas de chemin tout tracé : c'est vous qui le dessinez, mur après mur, pour égarer les hordes sous le feu de vos tours.</p>
        </header>
        <div class="start-ways">
          <section class="block solo" aria-labelledby="soloTitle">
            <div>
              <h2 id="soloTitle">Solo</h2>
              <p>Huit factions, des vagues sans fin. Tenez le plus longtemps possible.</p>
            </div>
            <div class="row play-row"><button type="button" class="btn primary" id="playBtn">Jouer en solo</button></div>
          </section>
          <section class="block multi" aria-labelledby="multiTitle">
            <h2 id="multiTitle">En ligne</h2>
            <label class="field"><span>Votre pseudo</span><input type="text" id="duelNick" minlength="${NICK_MIN}" maxlength="${NICK_MAX}" value="${escapeHtml(this.ownNick)}" placeholder="${NICK_MIN} à ${NICK_MAX} caractères" autocomplete="nickname" spellcheck="false"></label>
            <p class="label">Mode</p>
            <div class="modes" role="radiogroup" aria-label="Mode">${Object.values(Mode).map((m) => `<button type="button" class="diff" role="radio" data-room-mode="${m}" aria-checked="${m === this.duelMode}"><strong>${modeLabel(m)}</strong><span>${modeHint(m)}</span></button>`).join('')}</div>
            <div class="duel-ways">
              <button type="button" class="btn primary" id="hostDuelBtn">Héberger une partie</button>
              <p class="or">ou</p>
              <div class="code-join"><input type="text" id="duelCode" maxlength="6" placeholder="ABCDEF" aria-label="Code de la partie" autocomplete="off" autocapitalize="characters" spellcheck="false"><button type="button" class="btn" id="joinDuelBtn">Rejoindre</button></div>
            </div>
          </section>
        </div>
      </div>`);
    $('playBtn').addEventListener('click', () => this.showSetup());
    document.querySelectorAll<HTMLButtonElement>('[data-room-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        this.duelMode = b.dataset.roomMode as Mode;
        document.querySelectorAll('[data-room-mode]').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
      }),
    );
    $('startHelp').addEventListener('click', () => this.showHelp(true));
    $('hostDuelBtn').addEventListener('click', () => {
      this.sfx.unlock();
      this.hostDuel();
    });
    $('joinDuelBtn').addEventListener('click', () => this.joinDuel());
    $('duelCode').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.joinDuel();
    });
    $('playBtn').focus();
    this.offerResume();
  }

  /** Choix de la carte et de la difficulté de la préparation solo, rendus à chaque affichage pour refléter le dernier choix. */
  private bindSettings(panel: HTMLElement): void {
    const mapsEl = panel.querySelector<HTMLElement>('.maps')!;
    const diffsEl = panel.querySelector<HTMLElement>('.diffs')!;
    const bindDiffs = (): void => {
      diffsEl.innerHTML = this.diffsHtml(this.difficulty, true);
      diffsEl.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((b) =>
        b.addEventListener('click', () => {
          this.difficulty = b.dataset.diff as Difficulty;
          diffsEl.querySelectorAll('[data-diff]').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
        }),
      );
    };
    const bindMap = (): void => {
      mapsEl.innerHTML = mapPickHtml(this.drawnMap, true);
      paintThumb(mapsEl, this.drawnMap);
      mapsEl.querySelectorAll<HTMLButtonElement>('[data-biome]').forEach((b) =>
        b.addEventListener('click', () => {
          this.biome = b.dataset.biome as Biome;
          this.drawnMap = drawMap(this.seed, this.biome, MAP_RECIPE);
          bindMap();
        }),
      );
      mapsEl.querySelector('[data-redraw]')!.addEventListener('click', () => {
        this.redraw();
        bindMap();
      });
    };
    bindMap();
    bindDiffs();
  }

  /** Second temps avant de lancer une partie solo : carte, bâtisseur et difficulté. */
  private showSetup(): void {
    this.openOverlay(Overlay.Setup, `
      <div class="sheet wide">
        <header class="sheet-head">
          <h2>Préparer la partie</h2>
          <p class="lede">Choisissez votre terrain, votre bâtisseur et le niveau de la menace.</p>
        </header>
        <p class="label">Carte</p>
        <div class="maps"></div>
        <p class="label">Bâtisseur</p>
        <div class="builders" role="radiogroup" aria-label="Bâtisseur">${this.buildersHtml(this.builderId)}</div>
        <p class="label">Difficulté</p>
        <div class="diffs" role="radiogroup" aria-label="Difficulté"></div>
        <div class="row actions"><button type="button" class="btn primary" id="startBtn">Commencer</button><button type="button" class="btn" id="setupBack">Retour</button></div>
      </div>`);
    const el = $('overlay');
    this.bindSettings(el);
    this.bindBuilders(el);
    $('startBtn').addEventListener('click', () => {
      this.sfx.unlock();
      this.newGame(this.difficulty);
    });
    $('setupBack').addEventListener('click', () => this.showStart());
    $('startBtn').focus();
  }

  /** Partie interrompue connue (clé locale) : propose de la reprendre, sans bloquer l'écran titre. Liaison de sondage refermée dès la réponse. */
  private async offerResume(): Promise<void> {
    const pending = this.loadSeat(PENDING_KEY);
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
        this.clearSeat(PENDING_KEY);
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

  // ─── Multijoueur ─────────────────────────────────────────────────────────

  /** Pseudo saisi s'il est valide ; sinon le signale et redonne la main au champ. */
  private chosenNick(): string | null {
    const field = $<HTMLInputElement>('duelNick');
    const nick = validNick(field.value);
    if (nick === null) {
      this.toast(`Choisissez un pseudo de ${NICK_MIN} à ${NICK_MAX} caractères.`, true);
      field.focus();
    }
    return nick;
  }

  private async hostDuel(): Promise<void> {
    if (this.duelLink) return;
    const nick = this.chosenNick();
    if (nick === null) return;
    this.ownNick = nick;
    const map = this.drawnMap;
    const link = new ServerLink();
    this.duelLink = link;
    try {
      await link.connect();
    } catch {
      if (this.duelLink === link) this.duelLink = null;
      this.toast('Impossible de créer la partie, vérifiez votre connexion.', true);
      return;
    }
    this.duelRole = 'host';
    this.lobbyBuilderId = null;
    this.setDuelControlsHidden(true);
    link.onMessage((msg) => this.onLobbyMessage(msg));
    link.send({ t: ClientMessageType.Host, nick, map, difficulty: this.difficulty, mode: this.duelMode });
  }

  private async joinDuel(): Promise<void> {
    if (this.duelLink) return;
    const code = $<HTMLInputElement>('duelCode').value.toUpperCase();
    const seat = this.loadSeat(DUEL_SEAT_KEY);
    const rejoining = !!seat && seat.id === code;
    const nick = rejoining ? this.ownNick : this.chosenNick();
    if (nick === null) return;
    const link = new ServerLink();
    this.duelLink = link;
    try {
      await link.connect();
    } catch {
      if (this.duelLink === link) this.duelLink = null;
      this.toast('Impossible de créer la partie, vérifiez votre connexion.', true);
      return;
    }
    this.duelRole = 'guest';
    this.ownNick = nick;
    this.lobbyBuilderId = null;
    this.setDuelControlsHidden(true);
    link.onMessage((msg) => this.onLobbyMessage(msg));
    this.duelRejoining = rejoining;
    if (seat && rejoining) link.send({ t: ClientMessageType.Rejoin, code, token: seat.token });
    else link.send({ t: ClientMessageType.Join, nick, code });
  }

  private onLobbyMessage(msg: ServerMessage): void {
    switch (msg.t) {
      case ServerMessageType.DuelStarted:
        this.saveSeat(DUEL_SEAT_KEY, msg.code, msg.token);
        this.duelSeat = msg.seat;
        this.startDuelGame(msg.snapshot);
        break;
      case ServerMessageType.Thawed:
        this.duelRole = msg.seat === Seat.Host ? 'host' : 'guest';
        this.duelSeat = msg.seat;
        if (msg.others.length > 1) this.duelMode = Mode.Teams;
        this.startDuelGame(msg.snapshot);
        this.applyOthers(msg.others);
        break;
      case ServerMessageType.Hosted:
        this.duelCode = msg.code;
        this.duelHostNick = msg.host;
        this.duelGuestNick = null;
        this.duelMap = msg.map;
        this.duelDifficulty = msg.difficulty;
        this.duelMode = msg.mode;
        this.duelInRoom = true;
        this.duelPicked = { host: false, guest: false };
        this.showLobby();
        break;
      case ServerMessageType.Room:
        this.duelPicked = msg.picked;
        this.duelHostNick = msg.host;
        this.duelGuestNick = msg.guest;
        this.duelMap = msg.map;
        this.duelDifficulty = msg.difficulty;
        this.duelMode = msg.mode;
        this.duelInRoom = true;
        this.showLobby();
        break;
      case ServerMessageType.TeamRoom:
        this.duelHostNick = msg.host;
        this.duelMap = msg.map;
        this.duelDifficulty = msg.difficulty;
        this.duelMode = Mode.Teams;
        this.duelTeams = msg.teams;
        this.duelWaiting = msg.waiting;
        this.duelInRoom = true;
        this.showLobby();
        break;
      case ServerMessageType.Refused:
        if (this.duelRejoining) {
          this.duelRejoining = false;
          this.clearSeat(DUEL_SEAT_KEY);
        }
        this.toast(msg.reason, true);
        if (!this.duelInRoom) this.closeDuelLink();
        break;
      case ServerMessageType.Cancelled:
        this.closeDuelLink();
        this.showStart(true);
        this.toast('L’hôte a quitté la partie.', true);
        break;
      default:
        break;
    }
  }

  /** Passe du salon à la partie : mêmes réglages que `newGame`, mais la liaison de salon devient la liaison de jeu. */
  private startDuelGame(snapshot: WorldSnapshot): void {
    const link = this.duelLink;
    if (!link) return;
    this.world = restore(snapshot);
    this.announcedWave = this.world.wave;
    this.fx.clear();
    this.selected = null;
    this.buildDef = null;
    this.anchor = null;
    this.endShown = false;
    this.cardKey = '';
    this.hud = {};
    this.others.clear();
    this.rivalHud = {};
    this.resetLostState();
    this.resize();
    this.closeOverlay();
    this.setPaused(false);
    this.gameId = null;
    this.gameToken = null;
    this.link = link;
    link.onMessage((m) => this.onDuelMessage(m));
    link.onLost(() => {
      if (this.link !== link) return;
      this.onDuelLost();
    });
  }

  /** Ordres du serveur reçus une fois le duel lancé : recalage (`Drift`), vue adverse (`Rival`) et issue (`DuelOver`). */
  private onDuelMessage(msg: ServerMessage): void {
    switch (msg.t) {
      case ServerMessageType.Drift:
        this.world = realign(msg.snapshot, this.world.log, this.world.tick);
        break;
      case ServerMessageType.Rival:
        this.applyOther(msg);
        break;
      case ServerMessageType.DuelOver:
        this.clearSeat(DUEL_SEAT_KEY);
        this.link = null;
        this.resetLostState();
        this.showDuelEnd(msg);
        break;
      case ServerMessageType.Frozen:
        this.frozenMs = msg.remainingMs;
        this.showFrozen();
        break;
      case ServerMessageType.Thawed:
        this.world = realign(msg.snapshot, this.world.log, this.world.tick);
        this.applyOthers(msg.others);
        this.frozenMs = null;
        this.closeOverlay();
        break;
      default:
        break;
    }
  }

  /** Bilan d'une partie (tours, familles, vagues, briseurs), factorisé entre l'écran solo et l'écran de duel. */
  private debriefBlockHtml(stats: Stats, gold: number): string {
    const ranking = towerRanking(stats.towers.values());
    const losses = breakerLosses(stats.towers.values());
    return `
      <section class="debrief">
        <p class="label">Meilleures tours</p>
        ${debriefTowers(ranking, (id) => this.icon(id))}
        ${ranking.length ? debriefFamilies(familyDamage(ranking)) : ''}
      </section>
      <section class="debrief">
        <p class="label">Vies perdues par vague</p>
        ${debriefWaves(waveCurve(stats.waves, gold))}
        ${losses.count ? debriefBreakers(losses) : ''}
      </section>`;
  }

  /** Écran de fin de duel : verdict, vies et vague, puis le bilan solo existant par onglet de joueur. En 2 contre 2, les réserves des deux équipes. */
  private showDuelEnd(msg: Extract<ServerMessage, { t: ServerMessageType.DuelOver }>): void {
    const own = restore(msg.snapshot);
    const others = msg.others.map((o) => ({ seat: o.seat, world: restore(o.snapshot), nick: o.nick }));
    const teams = others.length > 1;
    const coop = !own.duel;
    const rivalNick = teams ? '' : (this.duelRole === 'host' ? this.duelGuestNick : this.duelHostNick) ?? partnerLabel(coop);
    const title = coop ? reachedTitle(own.wave) : duelVerdictLabel(msg.verdict);
    const label = (nick: string) => (teams ? nick : rivalNick);
    const board = scoreboard([
      { name: 'Vous', wave: own.wave, lives: own.lives, stats: own.stats },
      ...others.map((o) => ({ name: label(o.nick), wave: o.world.wave, lives: o.world.lives, stats: o.world.stats })),
    ]);
    this.world = own;
    this.openOverlay(Overlay.End, `
      <div class="sheet">
        <header class="sheet-head"><h2>${escapeHtml(title)}</h2></header>
        ${board}
        <p class="label">Détail par joueur</p>
        <div class="duel-tabs" role="tablist">
          <button type="button" class="duel-tab active" data-player="own">Vous</button>
          ${others.map((o) => `<button type="button" class="duel-tab" data-player="${o.seat}">${escapeHtml(label(o.nick))}</button>`).join('')}
        </div>
        <div class="duel-panel" data-player="own">${this.debriefBlockHtml(own.stats, own.gold)}</div>
        ${others.map((o) => `<div class="duel-panel" data-player="${o.seat}" hidden>${this.debriefBlockHtml(o.world.stats, o.world.gold)}</div>`).join('')}
        <div class="row actions"><button type="button" class="btn primary" id="again">Retour à l'accueil</button></div>
      </div>`);
    const el = $('overlay');
    for (const tab of el.querySelectorAll<HTMLButtonElement>('.duel-tab')) {
      tab.addEventListener('click', () => {
        for (const t of el.querySelectorAll('.duel-tab')) t.classList.remove('active');
        tab.classList.add('active');
        for (const panel of el.querySelectorAll<HTMLElement>('.duel-panel')) {
          panel.hidden = panel.dataset.player !== tab.dataset.player;
        }
      });
    }
    $('again').addEventListener('click', () => {
      this.closeDuelLink();
      this.showStart(true);
    });
  }

  private lobbyHtml(): string {
    const code = this.duelRole === 'host'
      ? `<div class="block lobby-code"><p class="label">Code à partager</p><p class="code">${escapeHtml(this.duelCode ?? '')}</p></div>`
      : '';
    const teams = this.duelMode === Mode.Teams;
    const startBtn = this.duelRole === 'host' ? '<button type="button" class="btn primary" id="startDuel">Lancer la partie</button>' : '';
    return `
      <div class="sheet wide">
        <header class="sheet-head">
          <h2>${modeLabel(this.duelMode)}</h2>
        </header>
        ${code}
        ${teams
          ? teamRoster(this.duelTeams, this.duelWaiting)
          : pairRoster({ nick: this.duelHostNick ?? '', picked: this.duelPicked.host }, { nick: this.duelGuestNick, picked: this.duelPicked.guest })}
        ${this.duelMap ? `<p class="label">Carte</p><div class="maps">${mapPickHtml(this.duelMap, this.duelRole === 'host')}</div>` : ''}
        <p class="label">Bâtisseur</p>
        <div class="builders" role="radiogroup" aria-label="Bâtisseur">${this.buildersHtml(this.lobbyBuilderId)}</div>
        ${this.duelDifficulty ? `<p class="label">Difficulté</p><div class="diffs" role="radiogroup" aria-label="Difficulté">${this.diffsHtml(this.duelDifficulty, false, this.duelRole === 'host')}</div>` : ''}
        <div class="row actions">${startBtn}<button type="button" class="btn" id="leaveLobby">Quitter</button></div>
      </div>`;
  }

  private showLobby(): void {
    this.openOverlay(Overlay.Lobby, this.lobbyHtml());
    $('leaveLobby').addEventListener('click', () => this.leaveLobby());
    if (this.duelMap) paintThumb($('overlay'), this.duelMap);
    // La graine reste côté client (ARCH-05) ; l'écran se redessine à la réception du salon.
    const chooseMap = (): void => {
      this.drawnMap = drawMap(this.seed, this.biome, MAP_RECIPE);
      this.duelLink?.send({ t: ClientMessageType.ChooseMap, map: this.drawnMap });
    };
    $('overlay').querySelectorAll<HTMLButtonElement>('[data-biome]').forEach((b) =>
      b.addEventListener('click', () => {
        this.biome = b.dataset.biome as Biome;
        chooseMap();
      }),
    );
    $('overlay').querySelector('[data-redraw]')?.addEventListener('click', () => {
      this.redraw();
      this.duelLink?.send({ t: ClientMessageType.ChooseMap, map: this.drawnMap });
    });
    this.bindBuilders($('overlay'), () => {
      this.lobbyBuilderId = this.builderId;
      this.duelLink?.send({ t: ClientMessageType.ChooseBuilder, builder: this.builderId });
    });
    $('overlay').querySelectorAll<HTMLButtonElement>('[data-diff]').forEach((b) =>
      b.addEventListener('click', () => this.duelLink?.send({ t: ClientMessageType.ChooseDifficulty, difficulty: b.dataset.diff as Difficulty })),
    );
    $('overlay').querySelectorAll<HTMLButtonElement>('[data-team]').forEach((b) =>
      b.addEventListener('click', () => this.duelLink?.send({ t: ClientMessageType.ChooseTeam, team: b.dataset.team as Team })),
    );
    if (this.duelRole === 'host') {
      $('startDuel').addEventListener('click', () => this.duelLink?.send({ t: ClientMessageType.Start }));
    }
  }

  private leaveLobby(): void {
    this.resetLostState();
    this.duelLink?.send({ t: ClientMessageType.Leave });
    this.closeDuelLink();
    this.showStart(true);
  }

  private closeDuelLink(): void {
    this.duelLink?.close();
    this.duelLink = null;
    this.duelRole = null;
    this.lobbyBuilderId = null;
    this.sendOpen = false;
    this.duelCode = null;
    this.duelInRoom = false;
    this.duelMode = Mode.Duel;
    this.setDuelControlsHidden(false);
    this.others.clear();
    this.duelSeat = 0;
    this.removeRivalPanel();
  }

  /** Masque la pause pendant un duel : le rythme y est fixé, commun aux deux joueurs. */
  private setDuelControlsHidden(hidden: boolean): void {
    $('pauseBtn').hidden = hidden;
  }

  /** Bouton « Reprendre la partie » : ouvre une liaison neuve à chaque clic, la clé locale n'est jamais effacée sur échec réseau. */
  private addResumeButton(pending: { id: string; token: string }): void {
    const row = document.querySelector<HTMLElement>('#overlay .play-row');
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
        <header class="sheet-head"><h2>Commandes</h2></header>
        <div class="keys block">
          <kbd>Q W E R A S</kbd><span>Choisir une construction (le panneau suit la disposition de Warcraft III)</span>
          <kbd>Clic</kbd><span>Bâtir ou sélectionner · clic droit ou Échap pour annuler</span>
          <kbd>Glisser</kbd><span>Déplacer la vue · <kbd>Molette</kbd> ou pincement pour zoomer · <kbd>Espace</kbd> revenir sur sa carte</span>
          <kbd>P</kbd><span>Pause · <kbd>M</kbd> son · <kbd>L</kbd> afficher le trajet</span>
          <kbd>Z · V</kbd><span>Sur une tour : changer le ciblage, vendre</span>
        </div>
        <p class="label">Table attaque / armure</p>
        ${this.armorTable()}
        <p class="label">Conseils</p>
        <ol class="block">
          <li>Le trajet en pointillés montre le chemin actuel ; en doré, celui qu'aurait votre prochaine construction.</li>
          <li>Chaque point d'armure réduit les dégâts d'environ 6 % ; la Tour acide et la Corrosion la rongent pour toutes vos tours.</li>
          <li>Les intérêts (4 % de votre or, plafonnés) tombent à la fin de chaque vague : épargner rapporte, mais pas autant que tenir.</li>
          <li>Les spectres de la vague 9 ignorent givre et foudre : prévoyez archers, canons ou venin.</li>
        </ol>
        <div class="row actions"><button type="button" class="btn primary" id="closeHelp">${fromStart ? 'Retour' : 'Reprendre'}</button></div>
      </div>`);
    $('closeHelp').addEventListener('click', () => this.escape());
  }

  private showPause(): void {
    this.pausedByOverlay = false;
    this.openOverlay(Overlay.Pause, `
      <div class="sheet small">
        <header class="sheet-head"><h2>Pause</h2><p class="lede">Le temps est suspendu. Vous pouvez encore consulter vos tours.</p></header>
        <div class="row actions"><button type="button" class="btn primary" id="resume">Reprendre</button><button type="button" class="btn" id="resignPause">Quitter la partie</button></div>
      </div>`);
    $('resume').addEventListener('click', () => this.togglePause());
    $('resignPause').addEventListener('click', () => this.showResign());
  }

  /** Confirmation d'abandon. Le temps ne s'arrête qu'en solo : en ligne, la partie continue pour l'autre joueur. */
  private showResign(): void {
    if (this.overlay && this.overlay !== Overlay.Pause) return;
    const p = resignPrompt();
    const fromPause = this.overlay === Overlay.Pause;
    this.pausedByOverlay = this.loop.paused;
    if (!this.duelRole) {
      this.setPaused(true);
      this.sendPace();
    }
    this.openOverlay(Overlay.Resign, `
      <div class="sheet small">
        <header class="sheet-head"><h2>${p.question}</h2></header>
        <div class="row actions"><button type="button" class="btn primary" id="resignConfirm">${p.confirm}</button><button type="button" class="btn" id="resignCancel">${p.cancel}</button></div>
      </div>`);
    $('resignConfirm').addEventListener('click', () => {
      this.closeOverlay();
      this.order({ c: CommandType.Resign });
      this.drainNow();
    });
    $('resignCancel').addEventListener('click', () => (fromPause ? this.showPause() : this.escape()));
  }

  private showEnd(): void {
    const w = this.world;
    const s = w.stats;
    const reached = Math.max(1, w.wave + 1);
    this.openOverlay(Overlay.End, `
      <div class="sheet">
        <header class="sheet-head">
          <h2>La porte est tombée</h2>
          <p class="lede">Votre défense a tenu jusqu'à la vague ${reached}.</p>
        </header>
        <div class="endstats">
          <div><b>${reached}</b><span>Vague atteinte</span></div>
          <div><b>${fmt0(s.kills)}</b><span>Éliminations</span></div>
          <div><b>${fmt0(s.leaked)}</b><span>Évasions</span></div>
          <div><b>${fmt0(s.goldEarned)}</b><span>Or gagné</span></div>
        </div>
        ${this.debriefBlockHtml(s, w.gold)}
        <div class="row actions"><button type="button" class="btn primary" id="again">Retour à l'accueil</button></div>
      </div>`);
    $('again').addEventListener('click', () => this.showStart(true));
  }
}
