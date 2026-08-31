import { LEVELS, levelById, levelsForMode } from '../domain/levels';
import {
  isLearnUnlocked,
  isPracticeUnlocked,
  isShiftUnlocked,
  LEARN_PASS,
  rankFor,
  starsFor,
} from '../domain/progression';
import { DRINK_IDS, EXTRACTION, MILK_TEMP, parFor, RECIPES } from '../domain/recipes';
import type { SaveData } from '../domain/save';
import { defaultSave, loadSave, savePersistence, writeSave } from '../domain/save';
import type { DrinkId } from '../domain/types';
import {
  APP_NAME,
  FEEDBACK_LABELS,
  GAME_COPY,
  MENU,
  MODE_COPY,
  RECIPE_BOOK_COPY,
  SETTINGS_COPY,
  VESSEL_LABELS,
} from './copy';
import { renderFooter } from './footer';

export type ScreenId = 'menu' | 'mode' | 'levels' | 'settings' | 'recipe-book' | 'summary' | 'game';

export interface LevelSummaryData {
  levelId: string;
  avg: number;
  stars: number;
  reports: { order: { drink: string }; total: number; feedback: string[] }[];
  masteryAfter: Record<string, number>;
  hints: string[];
}
type Mode = 'learn' | 'practice' | 'shift';

/**
 * Escape anything that reaches innerHTML from stored data. Mastery keys, error tags and
 * habit hints all originate in localStorage, so a known-good drink name is the happy path,
 * not a guarantee.
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;',
  );
}

let save: SaveData = loadSave();
let selectedMode: Mode = 'learn';
let startLevelHandler: ((levelId: string) => void) | null = null;
let installPrompt: { prompt: () => Promise<void> } | null = null;
let summaryData: LevelSummaryData | null = null;
let currentScreenId: ScreenId = 'menu';
let exitGameHandler: (() => void) | null = null;

/** Lets main.ts stop the Phaser scene when Back is pressed during play. */
export function setExitGameHandler(handler: () => void): void {
  exitGameHandler = handler;
}

export function setStartLevelHandler(handler: (levelId: string) => void): void {
  startLevelHandler = handler;
}

export function setInstallPrompt(promptEvent: { prompt: () => Promise<void> } | null): void {
  installPrompt = promptEvent;
}

export function currentSave(): SaveData {
  return save;
}

export function show(id: ScreenId, options: { fromHistory?: boolean } = {}): void {
  const overlay = document.getElementById('overlay');
  if (overlay == null) return;
  const previous = currentScreenId;
  currentScreenId = id;
  // Android's hardware Back unloads the page when there is nothing on the history stack,
  // dropping the player straight out of the game. Give it somewhere to go.
  if (options.fromHistory !== true && id !== previous) {
    history.pushState({ screen: id }, '');
  }
  if (id === 'game') {
    overlay.hidden = true;
    return;
  }
  // The game writes progress after every serve, so this module's cached copy goes stale as
  // soon as a level starts. Re-read before rendering, or the shell shows yesterday's numbers.
  save = loadSave();
  overlay.hidden = false;
  overlay.replaceChildren();
  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.dataset.screen = id;
  screen.innerHTML = renderScreen(id);
  overlay.appendChild(screen);
  wireScreen(id, screen);
  // After replacing the screen the focus would otherwise fall back to <body>, leaving
  // keyboard and screen-reader users with no position on the page.
  const heading = screen.querySelector('.screen__title');
  if (heading instanceof HTMLElement) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function shell(title: string, body: string, subtitle = ''): string {
  return `
    <h1 class="screen__title">${title}</h1>
    ${subtitle ? `<p class="screen__subtitle">${subtitle}</p>` : ''}
    ${body}
    ${renderFooter()}`;
}

function renderScreen(id: ScreenId): string {
  switch (id) {
    case 'menu':
      return renderMenu();
    case 'mode':
      return renderMode();
    case 'levels':
      return renderLevels();
    case 'settings':
      return renderSettings();
    case 'recipe-book':
      return renderRecipeBook();
    case 'summary':
      return renderSummary();
    default:
      return shell(APP_NAME, '');
  }
}

// ---- Main menu ----

function renderMenu(): string {
  return shell(
    APP_NAME,
    `
    <div class="stack" style="margin-top:24px">
      <button class="btn btn--primary" data-action="mode">${MENU.play}</button>
      <button class="btn" data-action="recipe-book">${MENU.recipeBook}</button>
      <button class="btn" data-action="settings">${MENU.settings}</button>
    </div>
    <span class="version-chip">v${__APP_VERSION__}</span>
    <p class="screen__subtitle" style="margin-top:16px">${MODE_COPY.rank}: ${rankFor(save) === 'barista' ? 'Barista' : 'Trainee'}</p>
  `,
    'Learn caf\u00e9-quality coffee, one shift at a time.',
  );
}

// ---- Mode select ----

function renderMode(): string {
  const learnDone = levelsForMode('learn').filter((_, i) => (save.progress.learn[i] ?? 0) >= LEARN_PASS).length;
  const practiceDone = levelsForMode('practice').filter(
    (_, i) => (save.progress.practice[i] ?? 0) >= LEARN_PASS,
  ).length;
  const shiftStars = save.progress.shift.reduce((s, e) => s + e.stars, 0);
  const shiftDone = save.progress.shift.filter((e) => e.stars >= 1).length;

  const card = (mode: Mode, done: number, total: number, extra: string, locked: boolean): string => `
    <button class="mode-card" data-mode="${mode}" ${locked ? 'disabled' : ''}>
      <span>
        <span class="mode-card__name">${MODE_COPY[mode].name}</span>
        <span class="mode-card__meta" style="display:block">${MODE_COPY[mode].blurb}</span>
        <span class="mode-card__meta" style="display:block">${done}/${total} ${MODE_COPY.levelsComplete}${extra}</span>
      </span>
      ${locked ? `<span class="lock">\u{1F512} ${MODE_COPY.locked}</span>` : '<span aria-hidden="true">\u25B8</span>'}
    </button>`;

  return shell(
    MENU.play,
    `
    <div class="mode-grid">
      ${card('learn', learnDone, 5, '', false)}
      ${card('practice', practiceDone, 5, '', !isPracticeUnlocked(save, 0))}
      ${card('shift', shiftDone, 10, ` \u00b7 ${shiftStars} ${MODE_COPY.starsEarned}`, !isShiftUnlocked(save, 0))}
    </div>
    <div class="btn-row"><button class="btn btn--ghost" data-action="menu">${MENU.back}</button></div>
  `,
  );
}

// ---- Level select ----

function starString(stars: number, locked: boolean): string {
  const glyphs = '\u2605\u2605\u2605'.slice(0, stars) + '\u2606\u2606\u2606'.slice(0, 3 - stars);
  const cls = locked ? 'stars stars--locked' : 'stars';
  return `<span class="${cls}" aria-label="${stars} of 3 stars">${glyphs}</span>`;
}

function renderLevels(): string {
  const levels = levelsForMode(selectedMode);
  const unlocked = (i: number): boolean =>
    selectedMode === 'learn'
      ? isLearnUnlocked(save, i)
      : selectedMode === 'practice'
        ? isPracticeUnlocked(save, i)
        : isShiftUnlocked(save, i);
  const bestAt = (i: number): number =>
    selectedMode === 'learn'
      ? (save.progress.learn[i] ?? 0)
      : selectedMode === 'practice'
        ? (save.progress.practice[i] ?? 0)
        : (save.progress.shift[i]?.best ?? 0);
  const starsAt = (i: number): number =>
    selectedMode === 'shift' ? (save.progress.shift[i]?.stars ?? 0) : bestAt(i) >= LEARN_PASS ? starsFor(bestAt(i)) : 0;

  const cards = levels
    .map((level, i) => {
      const open = unlocked(i);
      const goal = `<span class="mode-card__meta" style="display:block">${level.goal}</span>`;
      return `
      <button class="level-card" data-level="${level.id}" ${open ? '' : 'disabled'}>
        <span><strong>${level.id}</strong> ${open ? starString(starsAt(i), false) : `<span class="lock">\u{1F512} ${MODE_COPY.locked}</span>`}${goal}</span>
        <span aria-hidden="true">\u25B8</span>
      </button>`;
    })
    .join('');

  return shell(
    MODE_COPY[selectedMode].name,
    `
    <div class="level-grid">${cards}</div>
    <div class="btn-row"><button class="btn btn--ghost" data-action="mode">${MENU.back}</button></div>
  `,
  );
}

// ---- Settings ----

function renderSettings(): string {
  const toggle = (id: string, label: string, checked: boolean): string => `
    <label class="setting-row"><span>${label}</span><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}></label>`;

  return shell(
    SETTINGS_COPY.title,
    `
    <div class="stack">
      ${toggle('set-sound', SETTINGS_COPY.sound, save.settings.sound)}
      ${toggle('set-vibration', SETTINGS_COPY.vibration, save.settings.vibration)}
      ${toggle('set-reduce', SETTINGS_COPY.reduceAnimations, save.settings.reduceAnimations)}
      ${!savePersistence.persisted ? `<p class="notice">${SETTINGS_COPY.notPersisted}</p>` : ''}
      ${installPrompt != null ? `<p class="notice">${SETTINGS_COPY.installHint}</p>` : ''}
      <div class="btn-row" id="reset-row">
        <button class="btn btn--danger" data-action="reset-ask">${SETTINGS_COPY.resetProgress}</button>
      </div>
      <div class="btn-row"><button class="btn btn--ghost" data-action="menu">${MENU.back}</button></div>
    </div>
  `,
  );
}

function wireResetConfirm(row: HTMLElement): void {
  row.innerHTML = `
    <p class="notice">${SETTINGS_COPY.resetConfirm}</p>
    <div class="btn-row">
      <button class="btn btn--danger" data-action="reset-confirm">${MENU.confirm}</button>
      <button class="btn" data-action="settings">${MENU.cancel}</button>
    </div>`;
  row.querySelector('[data-action="reset-confirm"]')?.addEventListener('click', () => {
    save = defaultSave();
    writeSave(save);
    show('settings');
  });
  row.querySelector('[data-action="settings"]')?.addEventListener('click', () => show('settings'));
}

// ---- Recipe Book ----

function parRange(drink: DrinkId): string {
  const c = RECIPE_BOOK_COPY;
  const recipe = RECIPES[drink];
  const pars = recipe.allowedSizes.map((size) =>
    parFor({ drink, shots: recipe.defaultShots[size] ?? 1, takeaway: false }),
  );
  const min = Math.min(...pars);
  const max = Math.max(...pars);
  return min === max ? `${min}${c.seconds}` : `${min}\u2013${max}${c.seconds}`;
}

function recipeCard(drink: DrinkId): string {
  const r = RECIPES[drink];
  const c = RECIPE_BOOK_COPY;
  const sizeList = r.allowedSizes.map((s) => `${GAME_COPY[s]} (${r.defaultShots[s] ?? 1}\u00d7)`).join(' \u00b7 ');
  const milkList = r.milkDrink
    ? Object.entries(r.milkVolumeMl)
        .map(([size, ml]) => `${GAME_COPY[size as keyof typeof GAME_COPY] ?? size} ${ml}${c.ml}`)
        .join(' \u00b7 ')
    : '\u2014';
  const waterList =
    drink === 'americano'
      ? Object.entries(r.waterVolumeMl)
          .map(([size, ml]) => `${GAME_COPY[size as keyof typeof GAME_COPY] ?? size} ${ml}${c.ml}`)
          .join(' \u00b7 ')
      : '\u2014';
  const foam = r.foamBandCm != null ? `${r.foamBandCm[0]}\u2013${r.foamBandCm[1]}${c.cm}` : '\u2014';

  return `
    <div class="recipe-card">
      <h3>${r.name}</h3>
      <dl>
        <dt>${c.sizes}</dt><dd>${sizeList}</dd>
        <dt>${c.vessel}</dt><dd>${VESSEL_LABELS[r.houseVessel] ?? r.houseVessel}</dd>
        <dt>${c.milk}</dt><dd>${milkList}</dd>
        <dt>${c.water}</dt><dd>${waterList}</dd>
        <dt>${c.foam}</dt><dd>${foam}</dd>
        <dt>${c.parTime}</dt><dd>${parRange(drink)}</dd>
      </dl>
    </div>`;
}

function renderRecipeBook(): string {
  const c = RECIPE_BOOK_COPY;
  return shell(
    c.title,
    `
    <p class="disclaimer"><strong>${c.houseStandardTitle}.</strong> ${c.houseStandard}</p>
    <div class="stack">${DRINK_IDS.map(recipeCard).join('')}</div>
    <p class="disclaimer">${c.longBlackNote}</p>
    <p class="disclaimer">Dose ${EXTRACTION.doseTargetGrams}\u00a0g \u00b1\u00a02 \u00b7 extraction ${EXTRACTION.timeBandSeconds[0]}\u2013${EXTRACTION.timeBandSeconds[1]}\u00a0s \u00b7 milk ${MILK_TEMP.dairy.target[0]}\u2013${MILK_TEMP.dairy.target[1]}\u00a0\u00b0C (oat ${MILK_TEMP.oat.target[0]}\u2013${MILK_TEMP.oat.target[1]}\u00a0\u00b0C).</p>
    <div class="btn-row"><button class="btn btn--ghost" data-action="menu">${MENU.back}</button></div>
  `,
  );
}

// ---- Level summary ----

export function showSummary(data: LevelSummaryData): void {
  summaryData = data;
  save = loadSave();
  show('summary');
}

function nextLevelId(levelId: string): string | null {
  const index = LEVELS.findIndex((l) => l.id === levelId);
  if (index < 0 || index + 1 >= LEVELS.length) return null;
  const current = LEVELS[index]!;
  const next = LEVELS[index + 1]!;
  if (next.mode !== current.mode) return null;
  const nextIndexInMode = LEVELS.filter((l) => l.mode === next.mode).findIndex((l) => l.id === next.id);
  const unlocked =
    next.mode === 'learn'
      ? isLearnUnlocked(save, nextIndexInMode)
      : next.mode === 'practice'
        ? isPracticeUnlocked(save, nextIndexInMode)
        : isShiftUnlocked(save, nextIndexInMode);
  return unlocked ? next.id : null;
}

function renderSummary(): string {
  const s = summaryData;
  if (s == null)
    return shell(APP_NAME, `<div class="btn-row"><button class="btn" data-action="menu">${MENU.back}</button></div>`);
  const level = levelById(s.levelId);
  const title = level?.mode === 'learn' ? GAME_COPY.learnComplete : GAME_COPY.levelComplete;
  const starGlyphs = '\u2605\u2605\u2605'.slice(0, s.stars) + '\u2606\u2606\u2606'.slice(0, 3 - s.stars);
  const chips = s.reports
    .map((r, i) => {
      const labels = r.feedback
        .filter((f) => f !== 'PERFECT_ORDER' && f !== 'CORRECT_DRINK')
        .map((f) => escapeHtml(FEEDBACK_LABELS[f as keyof typeof FEEDBACK_LABELS] ?? f));
      const good = labels.length === 0;
      return `<span class="chip ${good ? 'chip--good' : 'chip--bad'}">#${i + 1} ${r.total}%${labels.length > 0 ? ` \u00b7 ${labels.slice(0, 2).join(', ')}` : ' \u00b7 Perfect'}</span>`;
    })
    .join('');
  const masteryLines = Object.entries(s.masteryAfter)
    .filter(([key]) => key.startsWith('drink:'))
    .map(([key, value]) => {
      const drinkName = RECIPES[key.slice('drink:'.length) as DrinkId]?.name ?? key;
      return `${escapeHtml(drinkName)} mastery: ${Math.round(value)}%`;
    });
  const nextId = nextLevelId(s.levelId);
  return shell(
    title,
    `
    <p class="screen__subtitle" style="font-size:2rem;color:${s.avg >= 70 ? '#3a7d44' : '#c0392b'}">${s.avg}%</p>
    <p class="stars" aria-label="${s.stars} of 3 stars" style="text-align:center;font-size:1.6rem">${starGlyphs}</p>
    <div class="summary-chips">${chips}</div>
    ${masteryLines.length > 0 ? `<div class="stack">${masteryLines.map((l) => `<span class="chip">${l}</span>`).join('')}</div>` : ''}
    ${s.hints.length > 0 ? `<div class="stack">${s.hints.map((h) => `<p class="notice">${escapeHtml(h)}</p>`).join('')}</div>` : ''}
    <div class="btn-row">
      <button class="btn" data-action="retry">${MENU.retry}</button>
      ${nextId != null ? `<button class="btn btn--primary" data-action="next-level" data-next-id="${nextId}">${MENU.next}</button>` : ''}
      <button class="btn btn--ghost" data-action="menu">${MENU.back}</button>
    </div>
  `,
    level?.goal ?? '',
  );
}

// ---- wiring ----

function wireScreen(id: ScreenId, screen: HTMLElement): void {
  screen.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => {
      const action = (el as HTMLElement).dataset.action;
      if (action === 'menu') show('menu');
      else if (action === 'mode') show('mode');
      else if (action === 'recipe-book') show('recipe-book');
      else if (action === 'settings') show('settings');
      else if (action === 'retry') {
        if (summaryData != null) startLevelHandler?.(summaryData.levelId);
      } else if (action === 'next-level') {
        const nextId = (el as HTMLElement).dataset.nextId;
        if (nextId != null) startLevelHandler?.(nextId);
      } else if (action === 'reset-ask') wireResetConfirm(document.getElementById('reset-row') ?? screen);
    });
  });

  screen.querySelectorAll('[data-mode]').forEach((el) => {
    el.addEventListener('click', () => {
      selectedMode = (el as HTMLElement).dataset.mode as Mode;
      show('levels');
    });
  });

  screen.querySelectorAll('[data-level]').forEach((el) => {
    el.addEventListener('click', () => {
      const levelId = (el as HTMLElement).dataset.level;
      if (levelId != null) startLevelHandler?.(levelId);
    });
  });

  if (id === 'settings') {
    const bind = (inputId: string, key: 'sound' | 'vibration' | 'reduceAnimations'): void => {
      screen.querySelector(`#${inputId}`)?.addEventListener('change', (ev) => {
        // Re-read before writing: persisting this module's copy verbatim would roll back
        // every mastery, stat and unlock the game recorded since the screen was built.
        save = loadSave();
        save.settings[key] = (ev.target as HTMLInputElement).checked;
        writeSave(save);
      });
    };
    bind('set-sound', 'sound');
    bind('set-vibration', 'vibration');
    bind('set-reduce', 'reduceAnimations');
  }
}

window.addEventListener('popstate', (event) => {
  const state = event.state as { screen?: ScreenId } | null;
  if (currentScreenId === 'game') {
    // Leaving a level needs the scene stopped, not just the overlay swapped.
    exitGameHandler?.();
    return;
  }
  show(state?.screen ?? 'menu', { fromHistory: true });
});
