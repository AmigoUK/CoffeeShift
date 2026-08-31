import Phaser from 'phaser';
import type { DrinkOrder, ExtractionPull, FeedbackId, JugId, MilkId, MilkResult, PreparedDrink, ScoreReport, VesselId } from '../domain/types';
import { EXTRACTION, MILK_TEMP, parFor, recipeFor } from '../domain/recipes';
import { generateOrders, mulberry32, archetypeForOrderIndex, orderLine } from '../domain/orders';
import { levelById } from '../domain/levels';
import type { LevelDef } from '../domain/levels';
import { grade } from '../domain/grading';
import { recordResult } from '../domain/progression';
import { loadSave, writeSave } from '../domain/save';
import type { SaveData } from '../domain/save';
import { sfx } from './audio';
import { getTimeScale } from './timeScale';
import { FEEDBACK_LABELS, GAME_COPY, MENU } from '../ui/copy';
export interface LevelCompletePayload {
  levelId: string;
  reports: { order: DrinkOrder; total: number; feedback: FeedbackId[] }[];
  masteryBefore: Record<string, number>;
}

interface ExtractionState {
  grind: 'fine' | 'medium' | 'coarse';
  doseGrams: number;
  tampKg: number;
  tampPeakKg: number;
  tampGood: boolean;
  tampHeld: boolean;
  brewing: boolean;
  brewSeconds: number;
  yieldGrams: number;
  pulls: ExtractionPull[];
}

interface MilkState {
  used: boolean;
  type: MilkId;
  jug: JugId | null;
  fillMl: number;
  filling: boolean;
  purged: boolean;
  steaming: boolean;
  wandDepth: 'shallow' | 'deep';
  tempC: number;
  foamCm: number;
  ruined: boolean;
  hotWarned: boolean;
}

interface AssemblySnapshot {
  vessel: VesselId | null;
  shotsUsed: number;
  waterMl: number | null;
  milkPoured: boolean;
  actions: string[];
}

interface AssemblyState extends AssemblySnapshot {
  pouringWater: boolean;
  undoStack: AssemblySnapshot[];
}

const GRIND_FACTOR: Record<string, number> = { fine: 1.0, medium: 1.6, coarse: 2.2 };
const VESSEL_DRINK: Record<string, string> = {
  demitasse: 'espresso', 'americano-mug': 'americano', 'latte-glass': 'latte',
  'cappuccino-cup': 'cappuccino', 'flat-white-cup': 'flat-white',
};
const COL = { panel: 0xf5f0e6, dark: 0x3b2417, coffee: 0x6f4e37, teal: 0x2f8f83, red: 0xc0392b, green: 0x3a7d44 };

function freshExtraction(): ExtractionState {
  return { grind: 'fine', doseGrams: 14, tampKg: 0, tampPeakKg: 0, tampGood: false, tampHeld: false, brewing: false, brewSeconds: 0, yieldGrams: 0, pulls: [] };
}
function freshMilk(level: LevelDef): MilkState {
  return { used: false, type: level.milks[0] ?? 'whole', jug: null, fillMl: 0, filling: false, purged: false, steaming: false, wandDepth: 'shallow', tempC: 5, foamCm: 0, ruined: false, hotWarned: false };
}
function freshAssembly(): AssemblyState {
  return { vessel: null, shotsUsed: 0, waterMl: null, milkPoured: false, actions: [], pouringWater: false, undoStack: [] };
}

export class GameScene extends Phaser.Scene {
  private level: LevelDef | null = null;
  private save: SaveData = loadSave();
  private orders: DrinkOrder[] = [];
  private drinkIndex = 0;
  private clockGame = 0;
  private orderStartClock = 0;
  private orderChanged = false;
  private orderChangeAt: number | null = null;
  private transitioning = false;
  private wasteEvents: string[] = [];
  private reports: LevelCompletePayload['reports'] = [];
  private masteryBefore: Record<string, number> = {};

  private ext: ExtractionState = freshExtraction();
  private milk: MilkState = freshMilk({ milks: ['whole'] } as LevelDef);
  private asm: AssemblyState = freshAssembly();

  private ticketFields: Record<string, Phaser.GameObjects.Text> = {};
  private ticketPanel: Phaser.GameObjects.Container | null = null;
  private patienceBar: Phaser.GameObjects.Rectangle | null = null;
  private guidedText: Phaser.GameObjects.Text | null = null;
  private stationView: Phaser.GameObjects.Container | null = null;
  private activeStation: 'espresso' | 'milk' | 'assembly' | null = null;
  private controlsView: Phaser.GameObjects.Container | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;
  private feedbackCard: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('game');
  }

  create(data: { levelId?: string }): void {
    const level = data.levelId != null ? levelById(data.levelId) : undefined;
    if (level == null) {
      this.game.events.emit('level-complete', { levelId: '', reports: [], masteryBefore: {} } satisfies LevelCompletePayload);
      this.scene.stop();
      return;
    }
    this.level = level;
    this.save = loadSave();
    sfx.enabled = this.save.settings.sound;
    this.masteryBefore = { ...this.save.mastery };
    this.orders = generateOrders(level, mulberry32((Math.random() * 2 ** 32) >>> 0), this.save);
    this.drinkIndex = 0;
    this.reports = [];
    this.transitioning = false;
    this.orderChanged = false;
    this.orderChangeAt = null;
    // Phaser reuses the scene instance across scene.start, so every field below still
    // holds last run's value. A feedback card left open when the player exits via
    // Menu would keep update() and serve() short-circuiting for the whole next level,
    // and a stale activeStation makes startDrink's switchStation('espresso') a no-op,
    // leaving the first station blank.
    this.feedbackCard = null;
    this.activeStation = null;
    this.toastText = null;
    this.controlsBand = null;
    this.ticketFields = {};
    this.clockGame = 0;
    this.orderStartClock = 0;
    this.wasteEvents = [];

    this.add.rectangle(195, 135, 390, 270, COL.panel).setStrokeStyle(2, COL.dark);
    this.add.rectangle(195, 730, 390, 224, COL.panel).setStrokeStyle(2, COL.dark);
    this.buildTicket();
    this.buildStationTabs();
    this.controlsView = this.add.container(0, 0);
    this.buildBottomRow();
    this.guidedText = this.add.text(195, 618, '', {
      fontSize: '12px', color: '#2f8f83', align: 'center', wordWrap: { width: 370 }, fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.startDrink();
    if (level.parallelPrep) {
      this.time.delayedCall(1500, () => this.toast(GAME_COPY.parallelTip));
    }
  }

  // ---------- top band ----------

  private buildTicket(): void {
    const archetype = 'customer-regular-1';
    this.add.image(60, 105, archetype).setScale(3).setName('customer-sprite');
    this.add.text(135, 40, '', {
      wordWrap: { width: 225 }, fontSize: '13px', color: '#2d2016', backgroundColor: '#ffffff', padding: { x: 8, y: 6 },
    }).setName('speech-bubble');

    this.ticketPanel = this.add.container(195, 205);
    const bg = this.add.rectangle(0, 0, 360, 92, 0xffffff).setStrokeStyle(2, COL.coffee).setName('ticket-bg');
    this.ticketPanel.add(bg);
    this.ticketPanel.add(this.add.text(-170, -40, GAME_COPY.ticket, { fontSize: '12px', color: '#6f4e37', fontStyle: 'bold' }));
    for (const key of ['drink', 'second', 'milkTemp', 'serve']) {
      const label = this.add.text(-170, key === 'drink' ? -20 : key === 'second' ? 0 : key === 'milkTemp' ? 22 : 42, '', { fontSize: '11px', color: '#2d2016', wordWrap: { width: 340 } });
      this.ticketFields[key] = label;
      this.ticketPanel.add(label);
    }

    this.add.text(340, 135, '', { fontSize: '11px', color: '#7a6a5c' }).setOrigin(0.5).setName('queue-label');
    // Patience is never colour-only: icon + label travel with the bar.
    this.add.text(15, 246, '\u23F1 Patience', { fontSize: '9px', color: '#7a6a5c' });
    this.add.rectangle(195, 258, 360, 6, 0xe7dcc9);
    this.patienceBar = this.add.rectangle(15, 258, 360, 6, COL.teal).setOrigin(0, 0.5).setName('patience-bar');

    const exit = this.add.text(378, 14, '\u2630 Menu', {
      fontSize: '12px', color: '#fdf6ec', backgroundColor: '#6f4e37', padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    exit.on('pointerdown', () => {
      this.game.events.emit('exit-level');
      this.scene.stop();
    });
  }

  private buildStationTabs(): void {
    const tabs: ['espresso' | 'milk' | 'assembly', string][] = [
      ['espresso', GAME_COPY.stationEspresso], ['milk', GAME_COPY.stationMilk], ['assembly', GAME_COPY.stationAssembly],
    ];
    tabs.forEach(([id, label], i) => {
      const btn = this.add.text(65 + i * 130, 290, label, {
        fontSize: '14px', color: '#fdf6ec', backgroundColor: '#6f4e37', padding: { x: 14, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setName(`tab-${id}`);
      btn.on('pointerdown', () => this.switchStation(id));
    });
    this.stationView = this.add.container(0, 0);
  }

  private buildBottomRow(): void {
    this.controlsBand?.destroy(true);
    const undo = this.makeButton(60, 812, 150, 48, () => MENU.undo, () => this.undoAssembly());
    const bin = this.makeButton(195, 812, 90, 48, () => MENU.bin, () => this.binDrink());
    const serve = this.makeButton(320, 812, 130, 48, () => MENU.serve, () => this.serve(), COL.green);
    this.controlsView?.add([undo, bin, serve]);
  }
  private controlsBand: Phaser.GameObjects.Container | null = null;

  // ---------- helpers ----------

  private makeButton(x: number, y: number, w: number, h: number, label: () => string, onPress: () => void, fill = COL.coffee, name?: string): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    if (name != null) c.setName(name);
    const bg = this.add.rectangle(0, 0, w, h, fill).setStrokeStyle(2, COL.dark).setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, '', { fontSize: '12px', color: '#fdf6ec', align: 'center', wordWrap: { width: w - 12 } }).setOrigin(0.5);
    text.setText(label());
    c.add([bg, text]);
    c.setData('refresh', () => text.setText(label()));
    bg.on('pointerdown', () => {
      onPress();
      this.refreshControls();
    });
    return c;
  }

  private makeHoldButton(x: number, y: number, w: number, h: number, label: () => string, onDown: () => void, onUp: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, COL.teal).setStrokeStyle(2, COL.dark).setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, '', { fontSize: '12px', color: '#fdf6ec', align: 'center', wordWrap: { width: w - 12 } }).setOrigin(0.5);
    text.setText(label());
    c.add([bg, text]);
    c.setData('refresh', () => text.setText(label()));
    bg.on('pointerdown', () => {
      onDown();
      this.refreshControls();
    });
    bg.on('pointerup', () => {
      onUp();
      this.refreshControls();
    });
    bg.on('pointerout', () => {
      onUp();
      this.refreshControls();
    });
    return c;
  }

  private refreshControls(): void {
    this.controlsView?.getAll().forEach((obj) => {
      const refresh = (obj as Phaser.GameObjects.Container).getData?.('refresh') as (() => void) | undefined;
      refresh?.();
    });
    this.refreshStationText();
  }

  private toast(message: string): void {
    this.toastText?.destroy();
    this.toastText = this.add.text(195, 590, message, {
      fontSize: '13px', color: '#fdf6ec', backgroundColor: '#3b2417', padding: { x: 10, y: 6 }, align: 'center',
      wordWrap: { width: 330 },
    }).setOrigin(0.5).setDepth(60);
    this.time.delayedCall(2200, () => {
      this.toastText?.destroy();
      this.toastText = null;
    });
  }

  // ---------- order flow ----------

  private currentDrink(): DrinkOrder | null {
    return this.orders[this.drinkIndex] ?? null;
  }

  /** The other drink on a multi-drink ticket, if any. */
  private pairDrink(): DrinkOrder | null {
    if (!this.level?.multiDrink || this.drinkIndex % 2 === 1) return null;
    return this.orders[this.drinkIndex + 1] ?? null;
  }

  private startDrink(): void {
    if (this.currentDrink() == null) {
      this.finishLevel();
      return;
    }
    this.ext = freshExtraction();
    this.milk = freshMilk(this.level ?? ({ milks: ['whole'] } as LevelDef));
    this.asm = freshAssembly();
    this.wasteEvents = [];
    this.orderChanged = false;
    this.orderChangeAt = null;
    this.transitioning = false;
    this.orderStartClock = this.clockGame;
    this.renderOrder();
    this.switchStation('espresso');
  }

  private drinkLine(order: DrinkOrder): string {
    const recipe = recipeFor(order.drink);
    const parts = [
      recipe.name.toLowerCase(),
      order.drink === 'espresso' ? '' : order.size,
      order.milk !== 'whole' && recipe.milkDrink ? order.milk : '',
    ].filter((p) => p.length > 0);
    let line = `${parts.join(' ')} \u00b7 ${order.shots}\u00d7 shot`;
    if (order.extraHot) line += ' \u00b7 extra hot';
    if (order.takeaway) line += ' \u00b7 takeaway';
    return line;
  }

  private renderOrder(): void {
    const order = this.currentDrink();
    if (order == null) return;
    const archetype = archetypeForOrderIndex(this.customerIndex());
    const sprite = this.children.getByName('customer-sprite') as Phaser.GameObjects.Image | null;
    if (sprite != null) {
      sprite.setTexture(`customer-${archetype.id}-1`).setScale(3);
      this.tweens.killTweensOf(sprite);
      if (!this.save.settings.reduceAnimations) {
        this.tweens.add({ targets: sprite, y: 100, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      }
    }
    const bubble = this.children.getByName('speech-bubble') as Phaser.GameObjects.Text | null;
    if (bubble != null) {
      bubble.setText(`\u201C${orderLine(order, archetype)}\u201D`);
      if (!this.save.settings.reduceAnimations) {
        this.tweens.add({ targets: bubble, scale: { from: 0.8, to: 1 }, duration: 220, ease: 'back.out' });
      }
    }
    this.renderTicket();
  }

  private renderTicket(): void {
    const order = this.currentDrink();
    if (order == null) return;
    const pair = this.pairDrink();
    const recipe = recipeFor(order.drink);
    const served = (i: number): boolean => i < this.drinkIndex;
    const first = `${served(0) ? '\u2713 ' : '\u25B8 '}1. ${this.drinkLine(this.orders[0] ?? order)}`;
    this.ticketFields['drink']?.setText(pair || this.level?.multiDrink ? first : `\u25B8 ${this.drinkLine(order)}`);
    if (pair != null) {
      this.ticketFields['second']?.setText(`2. ${this.drinkLine(pair)}`);
    } else if (this.level?.multiDrink) {
      this.ticketFields['second']?.setText(served(this.drinkIndex) ? `\u2713 2. ${this.drinkLine(order)}` : `2. ${this.drinkLine(order)}`);
    } else {
      this.ticketFields['second']?.setText('');
    }
    const tempRange = order.extraHot
      ? `${MILK_TEMP.extraHot.target[0]}\u2013${MILK_TEMP.extraHot.target[1]}\u00b0C`
      : recipe.milkDrink ? `${MILK_TEMP.dairy.target[0]}\u2013${MILK_TEMP.dairy.target[1]}\u00b0C` : '\u2014';
    this.ticketFields['milkTemp']?.setText(`${GAME_COPY.milk}: ${recipe.milkDrink ? GAME_COPY[order.milk] : '\u2014'} \u00b7 ${GAME_COPY.temperature}: ${tempRange} \u00b7 ${order.takeaway ? GAME_COPY.takeaway : GAME_COPY.inHouse}`);
    const queue = this.children.getByName('queue-label') as Phaser.GameObjects.Text | null;
    queue?.setText(`${this.remainingCustomers()} \u25CF`);
  }

  private customerIndex(): number {
    return this.level?.multiDrink ? Math.floor(this.drinkIndex / 2) : this.drinkIndex;
  }

  private totalCustomers(): number {
    if (this.level == null) return 0;
    return this.level.multiDrink ? Math.ceil(this.orders.length / 2) : this.orders.length;
  }

  private remainingCustomers(): number {
    return Math.max(0, this.totalCustomers() - this.customerIndex() - 1);
  }

  private serve(): void {
    if (this.feedbackCard != null || this.transitioning) return;
    const order = this.currentDrink();
    if (order == null || this.level == null) return;
    const report = grade(order, this.buildPreparedDrink(order), recipeFor(order.drink));
    recordResult(this.save, order, report);
    this.reports.push({ order, total: report.total, feedback: report.feedback });
    writeSave(this.save);
    sfx.stopSteam();
    sfx.clink();
    if (report.total >= 70) { sfx.success(); this.buzz([30, 50, 30]); } else { sfx.failure(); }
    this.showFeedbackCard(report);
    this.game.events.emit('served', report);
  }

  private buildPreparedDrink(order: DrinkOrder): PreparedDrink {
    const vessel = this.asm.vessel ?? 'demitasse';
    const drink = (vessel === 'takeaway-cup' ? order.drink : VESSEL_DRINK[vessel] ?? order.drink) as PreparedDrink['drink'];
    const milkUsed = this.milk.used && !this.milk.ruined;
    const milk: MilkResult | null = milkUsed
      ? {
          typeUsed: this.milk.type, tempC: this.milk.tempC, foamCm: this.milk.foamCm,
          wandPurged: this.milk.purged, jug: this.milk.jug, volumeMl: this.milk.fillMl,
        }
      : null;
    return {
      drink, vessel,
      pulls: this.ext.pulls,
      milk,
      waterMl: this.asm.waterMl,
      assemblyActions: this.asm.actions,
      wasteEvents: this.wasteEvents,
      elapsedSeconds: Math.max(0, this.clockGame - this.orderStartClock),
      timedLevel: this.level?.timeScoring ?? false,
    };
  }

  private showFeedbackCard(report: ScoreReport): void {
    const card = this.add.container(195, 445).setDepth(50);
    const bg = this.add.rectangle(0, 0, 370, 470, 0xffffff).setStrokeStyle(3, COL.coffee);
    const title = this.add.text(0, -200, `${report.total}%`, {
      fontSize: '34px', color: report.total >= 70 ? '#3a7d44' : '#c0392b', fontStyle: 'bold',
    }).setOrigin(0.5);
    const chipTexts = report.feedback.slice(0, 6).map((tag, i) => this.add.text(0, -150 + i * 25, `\u25CF ${FEEDBACK_LABELS[tag]}`, {
      fontSize: '13px', color: tag === 'PERFECT_ORDER' || tag === 'CORRECT_DRINK' ? '#3a7d44' : '#c0392b',
    }).setOrigin(0.5));
    const summaryText = this.add.text(0, 20, report.summarySentence, {
      fontSize: '14px', color: '#2d2016', align: 'center', wordWrap: { width: 330 },
    }).setOrigin(0.5);
    const bd = this.add.text(0, 110, [
      `Order match ${report.breakdown.orderMatch}/45`, `Recipe ${report.breakdown.recipe}/25`,
      `Technique ${report.breakdown.technique}/15`, `Time ${report.breakdown.time}/10`, `Waste ${report.breakdown.waste}/5`,
    ].join('\n'), { fontSize: '12px', color: '#7a6a5c', align: 'center', lineSpacing: 4 }).setOrigin(0.5);
    const next = this.makeButton(0, 195, 220, 52, () => 'Next', () => this.dismissFeedbackCard(), COL.teal);
    card.add([bg, title, ...chipTexts, summaryText, bd, next]);
    this.feedbackCard = card;
  }

  private dismissFeedbackCard(): void {
    this.feedbackCard?.destroy();
    this.feedbackCard = null;
    this.drinkIndex += 1;
    if (this.currentDrink() == null) {
      this.finishLevel();
    } else {
      this.startDrink();
    }
  }

  private finishLevel(): void {
    const levelId = this.level?.id ?? '';
    const reports = this.reports;
    this.level = null;
    this.game.events.emit('level-complete', { levelId, reports, masteryBefore: this.masteryBefore } satisfies LevelCompletePayload);
    this.scene.stop();
  }

  // ---------- stations ----------

  private switchStation(id: 'espresso' | 'milk' | 'assembly'): void {
    if (this.activeStation === id) return;
    this.activeStation = id;
    this.stationView?.removeAll(true);
    this.controlsView?.getAll().forEach((obj) => obj.destroy(true));
    if (id === 'espresso') this.renderExtraction();
    else if (id === 'milk') this.renderMilk();
    else this.renderAssembly();
    this.buildBottomRow();
    this.refreshStationText();
  }

  private statusLine(name: string): void {
    const text = this.add.text(20, 320, '', { fontSize: '12px', color: '#2d2016', wordWrap: { width: 350 }, lineSpacing: 3 }).setName(name);
    this.stationView?.add(text);
  }

  private renderExtraction(): void {
    this.stationView?.add(this.add.image(100, 450, 'machine').setScale(3));
    this.stationView?.add(this.add.image(295, 465, 'grinder').setScale(3));
    // Espresso streams under the two group heads — visible feedback while brewing.
    for (const x of [76, 124]) {
      const stream = this.add.rectangle(x, 462, 5, 34, 0x3b2417).setOrigin(0.5, 0).setName(`brew-stream-${x}`);
      stream.setVisible(false);
      this.stationView?.add(stream);
    }
    this.statusLine('ext-status');

    const grinds: ('fine' | 'medium' | 'coarse')[] = ['fine', 'medium', 'coarse'];
    const labels: Record<'fine' | 'medium' | 'coarse', string> = { fine: GAME_COPY.grindFine, medium: GAME_COPY.grindMedium, coarse: GAME_COPY.grindCoarse };
    grinds.forEach((g, i) => {
      this.controlsView?.add(this.makeButton(65 + i * 130, 655, 120, 48, () => labels[g], () => { this.ext.grind = g; }, this.ext.grind === g ? COL.teal : COL.coffee));
    });
    this.controlsView?.add(this.makeButton(65, 712, 120, 48, () => `Dose +1 g (${this.ext.doseGrams} g)`, () => {
      if (this.ext.doseGrams < 22) this.ext.doseGrams += 1;
    }));
    this.controlsView?.add(this.makeHoldButton(195, 712, 120, 48, () => `Tamp ${Math.round(this.ext.tampKg)} kg`, () => { this.ext.tampHeld = true; }, () => {
      if (!this.ext.tampHeld) return;
      this.ext.tampHeld = false;
      this.ext.tampGood = this.ext.tampPeakKg >= EXTRACTION.tampBandKg[0] && this.ext.tampPeakKg <= EXTRACTION.tampBandKg[1];
      this.buzz(this.ext.tampGood ? 25 : 0);
      this.ext.tampKg = 0;
      this.ext.tampPeakKg = 0;
    }));
    this.controlsView?.add(this.makeButton(325, 712, 120, 48, () => (this.ext.brewing ? 'STOP' : 'Brew'), () => {
      if (this.ext.brewing) this.stopPull();
      else if (this.ext.pulls.length < 3) { this.ext.brewing = true; sfx.startExtraction(); }
      else this.toast('Three shots pulled already \u2014 that\u2019s the maximum.');
    }, this.ext.brewing ? COL.red : COL.coffee));
    this.controlsView?.add(this.makeButton(195, 764, 240, 40, () => 'Empty grinder \u00b7 start over', () => {
      this.ext = freshExtraction();
    }));
  }

  private stopPull(): void {
    this.ext.pulls.push({
      grind: this.ext.grind, doseGrams: this.ext.doseGrams, tampOk: this.ext.tampGood,
      seconds: Math.round(this.ext.brewSeconds * 10) / 10,
    });
    const inBand = this.ext.brewSeconds >= EXTRACTION.timeBandSeconds[0] && this.ext.brewSeconds <= EXTRACTION.timeBandSeconds[1];
    sfx.stopExtraction();
    this.buzz(inBand ? 30 : 0);
    this.toast(`Shot pulled: ${Math.round(this.ext.brewSeconds * 10) / 10}s${inBand ? ' \u2713' : ''}`);
    this.ext.brewing = false;
    this.ext.brewSeconds = 0;
    this.ext.yieldGrams = 0;
    this.ext.tampGood = false;
    this.ext.doseGrams = 14;
  }

  private renderMilk(): void {
    const jugSprite = this.add.image(100, 450, 'jug-large').setScale(3).setName('jug-sprite');
    this.stationView?.add(jugSprite);
    this.stationView?.add(this.add.image(290, 445, 'wand').setScale(3));
    this.statusLine('milk-status');

    this.controlsView?.add(this.makeButton(65, 655, 120, 48, () => 'Small jug', () => {
      this.milk.jug = 'small-jug';
      this.milk.used = true;
      jugSprite.setTexture('jug-small');
    }, this.milk.jug === 'small-jug' ? COL.teal : COL.coffee));
    this.controlsView?.add(this.makeButton(195, 655, 120, 48, () => 'Large jug', () => {
      this.milk.jug = 'large-jug';
      this.milk.used = true;
      jugSprite.setTexture('jug-large');
    }, this.milk.jug === 'large-jug' ? COL.teal : COL.coffee));
    const milks = this.level?.milks ?? ['whole'];
    this.controlsView?.add(this.makeButton(325, 655, 120, 48, () => GAME_COPY[this.milk.type], () => {
      const next = milks[(milks.indexOf(this.milk.type) + 1) % milks.length] ?? 'whole';
      this.milk.type = next;
    }));
    this.controlsView?.add(this.makeHoldButton(65, 712, 120, 48, () => `Fill ${Math.round(this.milk.fillMl)} ml`, () => { this.milk.filling = true; this.milk.used = true; }, () => { this.milk.filling = false; }));
    this.controlsView?.add(this.makeButton(195, 712, 120, 48, () => (this.milk.purged ? 'Purged \u2713' : 'Purge wand'), () => { this.milk.purged = true; }, this.milk.purged ? COL.green : COL.coffee));
    this.controlsView?.add(this.makeButton(325, 712, 120, 48, () => (this.milk.ruined ? 'Empty jug' : this.milk.steaming ? 'Remove jug' : 'Steam'), () => {
      if (this.milk.ruined) {
        this.wasteEvents.push('emptied-jug');
        this.milk = freshMilk(this.level ?? ({ milks: ['whole'] } as LevelDef));
        this.toast('Jug emptied \u2014 refill and steam again.');
        return;
      }
      if (this.milk.steaming) {
        this.milk.steaming = false;
        sfx.stopSteam();
        const order = this.currentDrink();
        if (order != null) {
          const target = order.extraHot ? MILK_TEMP.extraHot.target : this.milk.type === 'oat' ? MILK_TEMP.oat.target : MILK_TEMP.dairy.target;
          const inBand = this.milk.tempC >= target[0] && this.milk.tempC <= target[1];
          this.buzz(inBand ? [20, 40, 20] : 0);
        }
        this.checkJugOverflow();
      } else if (this.milk.jug != null && this.milk.fillMl > 0) {
        this.milk.used = true;
        this.milk.steaming = true;
        sfx.startSteam();
        sfx.setSteamDepth(this.milk.wandDepth === 'deep');
      } else {
        this.toast('Pick a jug and fill it with milk first.');
      }
    }, this.milk.steaming ? COL.red : COL.coffee));
    this.controlsView?.add(this.makeButton(195, 764, 240, 40, () => `Wand depth: ${this.milk.wandDepth} (tap to toggle)`, () => {
      this.milk.wandDepth = this.milk.wandDepth === 'shallow' ? 'deep' : 'shallow';
      sfx.setSteamDepth(this.milk.wandDepth === 'deep');
    }));
  }

  private checkJugOverflow(): void {
    const order = this.currentDrink();
    if (order == null || this.milk.jug == null) return;
    const spec = recipeFor(order.drink).milkVolumeMl[order.size] ?? 0;
    if (this.milk.jug === 'small-jug' && spec > 150) {
      this.wasteEvents.push('jug-overflow');
      this.milk.ruined = true;
      this.milk.fillMl = 0;
      this.toast('The small jug overflows \u2014 empty it and use the large jug.');
    }
  }

  private renderAssembly(): void {
    this.stationView?.add(this.add.image(195, 480, 'counter').setScale(3));
    const vesselSprite = this.add.image(195, 440, 'vessel-demitasse').setScale(3).setName('vessel-sprite');
    this.stationView?.add(vesselSprite);
    this.statusLine('asm-status');

    const vessels: VesselId[] = ['demitasse', 'americano-mug', 'cappuccino-cup', 'latte-glass', 'flat-white-cup', 'takeaway-cup'];
    vessels.forEach((v, i) => {
      const x = 65 + (i % 3) * 130;
      const y = 655 + Math.floor(i / 3) * 56;
      this.controlsView?.add(this.makeButton(x, y, 120, 48, () => v.replaceAll('-', ' '), () => {
        this.pushUndo();
        this.asm.vessel = v;
        this.asm.actions = ['vessel'];
        vesselSprite.setTexture(`vessel-${v}`);
      }, this.asm.vessel === v ? COL.teal : COL.coffee));
    });
    this.controlsView?.add(this.makeButton(65, 764, 120, 48, () => GAME_COPY.addEspresso, () => this.addShot()));
    this.controlsView?.add(this.makeHoldButton(195, 764, 120, 48, () => `${GAME_COPY.addWater}${this.asm.waterMl != null ? ` ${Math.round(this.asm.waterMl)}ml` : ''}`, () => { this.asm.pouringWater = true; }, () => {
      this.asm.pouringWater = false;
      if (this.asm.waterMl != null && this.asm.waterMl > 0 && !this.asm.actions.includes('water')) {
        this.asm.actions.push('water');
      }
    }));
    this.controlsView?.add(this.makeHoldButton(325, 764, 120, 48, () => GAME_COPY.pourMilk, () => {
      if (!this.milk.used || this.milk.ruined) {
        this.toast('Steam some milk first.');
        return;
      }
      this.pushUndo();
      this.asm.milkPoured = true;
      if (!this.asm.actions.includes('milk')) this.asm.actions.push('milk');
    }, () => undefined));
  }

  private addShot(): void {
    const available = this.ext.pulls.length - this.asm.shotsUsed;
    if (available <= 0) {
      this.toast(GAME_COPY.pullShotFirst);
      return;
    }
    this.pushUndo();
    this.asm.shotsUsed += 1;
    if (!this.asm.actions.includes('shot')) this.asm.actions.push('shot');
  }

  private pushUndo(): void {
    this.asm.undoStack.push({
      vessel: this.asm.vessel, shotsUsed: this.asm.shotsUsed, waterMl: this.asm.waterMl,
      milkPoured: this.asm.milkPoured, actions: [...this.asm.actions],
    });
    if (this.asm.undoStack.length > 5) this.asm.undoStack.shift();
  }

  private undoAssembly(): void {
    const prev = this.asm.undoStack.pop();
    if (prev == null) {
      this.toast('Nothing to undo.');
      return;
    }
    const { pouringWater: _pw, undoStack: _us, ...snapshot } = this.asm;
    void _pw; void _us;
    this.asm = { ...snapshot, ...prev, pouringWater: false, undoStack: this.asm.undoStack };
    const sprite = this.stationView?.getByName('vessel-sprite') as Phaser.GameObjects.Image | null;
    if (sprite != null && this.asm.vessel != null) sprite.setTexture(`vessel-${this.asm.vessel}`);
    this.refreshControls();
  }

  private binDrink(): void {
    this.wasteEvents.push('binned-drink');
    this.asm = freshAssembly();
    const sprite = this.stationView?.getByName('vessel-sprite') as Phaser.GameObjects.Image | null;
    sprite?.setTexture('vessel-demitasse');
    this.toast('Drink binned \u2014 starting fresh.');
    this.refreshControls();
  }

  private refreshStationText(): void {
    const order = this.currentDrink();
    const recipe = order != null ? recipeFor(order.drink) : null;
    const extStatus = this.stationView?.getByName('ext-status') as Phaser.GameObjects.Text | null;
    if (extStatus != null) {
      extStatus.setText([
        `Grind ${this.ext.grind} \u00b7 dose ${this.ext.doseGrams} g (target 18 \u00b12) \u00b7 tamp ${Math.round(this.ext.tampKg)} kg`,
        this.ext.brewing
          ? `Brewing \u2014 ${Math.round(this.ext.brewSeconds * 10) / 10}s \u00b7 yield ${Math.round(this.ext.yieldGrams)} g \u00b7 STOP in 24\u201331s`
          : `Shots pulled: ${this.ext.pulls.length}`,
      ].join('\n'));
    }
    const milkStatus = this.stationView?.getByName('milk-status') as Phaser.GameObjects.Text | null;
    if (milkStatus != null && recipe != null && order != null) {
      const spec = recipe.milkVolumeMl[order.size] ?? null;
      const tempTarget = order.extraHot ? MILK_TEMP.extraHot.target : this.milk.type === 'oat' ? MILK_TEMP.oat.target : MILK_TEMP.dairy.target;
      milkStatus.setText([
        `Jug ${this.milk.jug ?? 'none'} \u00b7 ${this.milk.type} \u00b7 wand ${this.milk.wandDepth}${this.milk.purged ? ' \u00b7 purged \u2713' : ''}${this.milk.ruined ? ' \u00b7 SCORCHED' : ''}`,
        `Fill ${Math.round(this.milk.fillMl)}${spec != null ? `/${spec}` : ''} ml \u00b7 ${Math.round(this.milk.tempC)}\u00b0C \u00b7 foam ${this.milk.foamCm.toFixed(1)} cm \u00b7 target ${tempTarget[0]}\u2013${tempTarget[1]}\u00b0C`,
      ].join('\n'));
    }
    const asmStatus = this.stationView?.getByName('asm-status') as Phaser.GameObjects.Text | null;
    if (asmStatus != null) {
      const shotsAvailable = this.ext.pulls.length - this.asm.shotsUsed;
      asmStatus.setText([
        `Vessel ${this.asm.vessel ?? 'none'} \u00b7 shots in cup ${this.asm.shotsUsed} (${shotsAvailable} spare)`,
        `Water ${this.asm.waterMl != null ? `${Math.round(this.asm.waterMl)} ml` : '\u2014'} \u00b7 milk ${this.asm.milkPoured ? `${Math.round(this.milk.fillMl)} ml / ${this.milk.foamCm.toFixed(1)} cm foam` : '\u2014'}`,
        `Steps: ${this.asm.actions.length > 0 ? this.asm.actions.join(' \u2192 ') : 'none yet'}`,
      ].join('\n'));
    }
    this.guidedText?.setText(this.level?.guided === true ? this.guidedHint() : '');
  }

  // ---------- guided lessons ----------

  private guidedHint(): string {
    const order = this.currentDrink();
    if (order == null) return '';
    const recipe = recipeFor(order.drink);
    if (this.ext.grind !== 'fine') return '1. Set the grinder to fine.';
    if (this.ext.doseGrams < 16 || this.ext.doseGrams > 20) return '2. Tap Dose until you reach 18 g (16\u201320 g works).';
    if (this.ext.pulls.length === 0) {
      if (!this.ext.tampGood) return '3. Hold Tamp and release inside 15\u201320 kg.';
      return '4. Tap Brew, then STOP between 24 and 31 seconds.';
    }
    if (this.ext.pulls.length < order.shots) {
      if (!this.ext.tampGood) return '5. Tamp the fresh dose (each shot needs its own tamp).';
      return '6. Tap Brew, then STOP between 24 and 31 seconds.';
    }
    if (recipe.milkDrink && !this.asm.milkPoured) {
      if (this.milk.jug == null) return `5. Milk tab: pick the ${(recipe.milkVolumeMl[order.size] ?? 0) > 150 ? 'large' : 'small'} jug.`;
      if (this.milk.fillMl === 0) return `6. Hold Fill to the line (${recipe.milkVolumeMl[order.size] ?? 0} ml).`;
      if (!this.milk.purged) return '7. Tap Purge wand before steaming.';
      if (!this.milk.steaming && this.milk.tempC < 50) return '8. Tap Steam, watch the gauge, remove the jug on target.';
      if (this.milk.steaming) return '8. Steaming \u2014 remove the jug on target temperature.';
    }
    if (this.asm.vessel == null) return '9. Assembly tab: choose the right cup.';
    if (recipe.assembly.includes('shot') && !this.asm.actions.includes('shot')) return '10. Tap Add espresso.';
    if (recipe.assembly.includes('water') && !this.asm.actions.includes('water')) return '11. Hold Add water to the line.';
    if (recipe.assembly.includes('milk') && !this.asm.actions.includes('milk')) return '12. Tap Pour milk.';
    return 'Serve when the drink matches the ticket!';
  }

  // ---------- simulation ----------

  update(_time: number, delta: number): void {
    const order = this.currentDrink();
    const dt = (Math.min(delta, 250) / 1000) * getTimeScale();
    this.clockGame += dt;

    if (order == null || this.feedbackCard != null || this.transitioning || this.level == null) return;

    if (this.ext.tampHeld) {
      this.ext.tampKg = Math.min(25, this.ext.tampKg + EXTRACTION.tampRampKgPerS * dt);
      this.ext.tampPeakKg = Math.max(this.ext.tampPeakKg, this.ext.tampKg);
    }
    if (this.ext.brewing) {
      this.ext.brewSeconds += dt;
      const doseFactor = 1 + 0.075 * (18 - this.ext.doseGrams);
      this.ext.yieldGrams += 1.2 * (GRIND_FACTOR[this.ext.grind] ?? 1) * doseFactor * dt;
    }

    for (const x of [76, 124]) {
      const stream = this.stationView?.getByName(`brew-stream-${x}`) as Phaser.GameObjects.Rectangle | null;
      if (stream == null) continue;
      stream.setVisible(this.ext.brewing);
      stream.alpha = this.save.settings.reduceAnimations ? 1 : 0.55 + 0.3 * Math.sin(this.clockGame * 9);
    }

    if (this.milk.filling) {
      this.milk.fillMl += 90 * dt;
      this.milk.used = true;
    }
    if (this.milk.steaming) {
      const rate = this.milk.type === 'oat' ? 3.5 : 3;
      this.milk.tempC += rate * dt;
      this.milk.foamCm += (this.milk.wandDepth === 'shallow' ? 0.14 : 0.02) * dt;
      const failAt = order.extraHot ? MILK_TEMP.extraHot.failAt : this.milk.type === 'oat' ? MILK_TEMP.oat.failAt : MILK_TEMP.dairy.failAt;
      if (!this.milk.hotWarned && this.milk.tempC >= failAt) {
        this.milk.hotWarned = true;
        this.toast('The milk is too hot \u2014 remove the jug now.');
      }
      if (this.milk.tempC >= failAt + 5) {
        this.milk.steaming = false;
        this.milk.ruined = true;
        sfx.stopSteam();
        this.toast('The milk is scorched \u2014 empty the jug and start again.');
      }
    }

    if (this.asm.pouringWater) {
      this.asm.waterMl = (this.asm.waterMl ?? 0) + 60 * dt;
    }

    if ((this.ext.tampHeld || this.ext.brewing || this.milk.filling || this.milk.steaming || this.asm.pouringWater)) {
      this.refreshStationText();
      this.refreshControls();
    }

    if (this.level.patience && this.patienceBar != null) {
      // A customer cannot reasonably expect faster than par × 1.2 — big multi-shot
      // orders were unwinnable against flat level patience (S6 latte large: 81 s of
      // brewing alone vs 55 s patience).
      const patience = Math.max(this.level.patienceSeconds, Math.ceil(parFor(order) * 1.2));
      const remaining = 1 - (this.clockGame - this.orderStartClock) / patience;
      if (remaining <= 0) {
        this.loseCustomer();
        return;
      }
      this.patienceBar.width = 360 * remaining;
      this.patienceBar.fillColor = remaining < 0.3 ? COL.red : COL.teal;
    }


    // Order changes fire at most once, on ~half of eligible orders, between 8-15 s
    // (firing at a fixed 5 s on every order forced a full redo of every drink).
    if (this.level.orderChanges && !this.orderChanged && this.orderChangeAt == null && this.clockGame - this.orderStartClock > 1) {
      this.orderChangeAt = 8 + Math.random() * 7;
    }
    if (this.level.orderChanges && !this.orderChanged && this.orderChangeAt != null && this.clockGame - this.orderStartClock > this.orderChangeAt) {
      this.changeOrder();
    }
  }

  /** Haptic feedback gated by the vibration setting. Pass 0 or [] for "no buzz". */
  private buzz(pattern: number | number[]): void {
    if (!this.save.settings.vibration) return;
    const p = Array.isArray(pattern) ? pattern : [pattern];
    if (p.length === 0 || p[0] === 0) return;
    try {
      navigator.vibrate?.(p);
    } catch {
      // vibration unsupported — ignore
    }
  }


  private changeOrder(): void {
    if (Math.random() >= 0.5) {
      this.orderChanged = true; // no change this time — do not retry
      return;
    }
    const order = this.currentDrink();
    if (order == null) return;
    const recipe = recipeFor(order.drink);
    if (order.size !== 'large' && recipe.allowedSizes.includes('large')) {
      order.size = 'large';
      order.shots = recipe.defaultShots[order.size] ?? order.shots;
      this.orderChanged = true;
      const bubble = this.children.getByName('speech-bubble') as Phaser.GameObjects.Text | null;
      bubble?.setText(`\u201C${GAME_COPY.orderChange}\u201D`);
      this.toast('The ticket changed \u2014 check it!');
      this.renderTicket();
      if (this.ticketPanel != null && !this.save.settings.reduceAnimations) {
        this.tweens.add({ targets: this.ticketPanel, alpha: { from: 1, to: 0.4 }, duration: 250, yoyo: true, repeat: 3 });
      }
    }
  }

  private loseCustomer(): void {
    const order = this.currentDrink();
    if (order == null) return;
    this.transitioning = true;
    this.wasteEvents.push('lost-customer');
    this.reports.push({ order, total: 0, feedback: [] });
    this.toast(GAME_COPY.customerLeft);
    this.time.delayedCall(1600, () => {
      this.drinkIndex += 1;
      if (this.currentDrink() == null) this.finishLevel();
      else this.startDrink();
    });
  }
}
