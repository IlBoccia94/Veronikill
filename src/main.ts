import Phaser from 'phaser';
import { GameScene, type StickVector, type AimState, type HUDState, type RunResult, type LevelUpChoice, type UpgradeOption, type UpgradeId } from './game/GameScene';
import './styles.css';

const el = <T extends HTMLElement>(id: string): T => {
  const item = document.getElementById(id);
  if (!item) throw new Error('Elemento UI mancante: ' + id);
  return item as T;
};
const panel = el<HTMLDivElement>('screen');
const title = el<HTMLHeadingElement>('screen-title');
const copy = el<HTMLParagraphElement>('screen-copy');
const subline = el<HTMLDivElement>('screen-subline');
const brandedLogo = el<HTMLImageElement>('custom-logo');
const playBtn = el<HTMLButtonElement>('play-btn');
const pauseBtn = el<HTMLButtonElement>('pause-btn');
const hud = el<HTMLDivElement>('hud');
const mobileControls = el<HTMLDivElement>('mobile-controls');
const hpBar = el<HTMLDivElement>('hp-bar');
const hpText = el<HTMLSpanElement>('hp-text');
const scoreText = el<HTMLElement>('score');
const progressBar = el<HTMLDivElement>('progress-bar');
const loadout = el<HTMLDivElement>('loadout');
const progressWidget = document.querySelector<HTMLElement>('.progress-track');
const progressLabel = document.querySelector<HTMLElement>('.progress-track span');
const xpBar = el<HTMLDivElement>('xp-bar');
const xpNumber = el<HTMLSpanElement>('xp-number');
const levelText = el<HTMLSpanElement>('player-level');
const levelUpPanel = el<HTMLDivElement>('levelup-screen');
const levelUpTitle = el<HTMLSpanElement>('levelup-level');
const upgradeOptions = el<HTMLDivElement>('upgrade-options');

// Boss HUD stays in DOM so it scales correctly with the landscape PWA viewport.
const bossHud = document.createElement('div');
bossHud.className = 'boss-hud hidden';
bossHud.setAttribute('role', 'group');
bossHud.setAttribute('aria-label', 'Salute del Direttore Generale');
const bossHeading = document.createElement('div');
bossHeading.className = 'boss-heading';
bossHeading.textContent = 'IL DIRETTORE GENERALE';
const bossTrack = document.createElement('div');
bossTrack.className = 'boss-track';
const bossFill = document.createElement('div');
bossFill.className = 'boss-fill';
bossTrack.append(bossFill);
const bossCount = document.createElement('div');
bossCount.className = 'boss-count';
bossHud.append(bossHeading, bossTrack, bossCount);
hud.append(bossHud);

// Peripheral, short-lived notices. No floating world labels over Veronica or enemies.
const notice = document.createElement('div');
notice.className = 'hud-notice hidden';
notice.setAttribute('role', 'status');
notice.setAttribute('aria-live', 'polite');
hud.append(notice);
let noticeTimeout: number | undefined;
let lastNotice = '';
let lastNoticeAt = 0;
function showNotice(message: string): void {
  const now = Date.now();
  if (message === lastNotice && now - lastNoticeAt < 1400) return;
  lastNotice = message;
  lastNoticeAt = now;
  window.clearTimeout(noticeTimeout);
  notice.textContent = message;
  notice.classList.remove('hidden');
  noticeTimeout = window.setTimeout(() => {
    notice.classList.add('hidden');
    notice.textContent = '';
  }, 1500);
}

type LoadoutChip = { icon: string; name: string; rank?: number; temporary?: boolean };
const MAX_WEAPON_LEVEL = 5;
function renderLoadout(chips: LoadoutChip[]): void {
  const nodes = chips.map(chip => {
    const el = document.createElement('span');
    const maxed = chip.rank === MAX_WEAPON_LEVEL;
    el.className = 'loadout-chip' + (maxed ? ' maxed' : '') + (chip.temporary ? ' temporary' : '');
    el.textContent = chip.icon + ' ' + chip.name +
      (chip.rank !== undefined ? ' ' + (maxed ? 'MAX' : chip.rank + '/5') : '');
    if (maxed) el.title = chip.name + ' - LIVELLO MASSIMO';
    return el;
  });
  loadout.replaceChildren(...nodes);
}

class TouchStick {
  private readonly region: HTMLElement;
  private readonly ring: HTMLElement;
  private readonly knob: HTMLElement;
  private pointerId: number | null = null;
  private dx = 0;
  private dy = 0;
  private rememberedAngle = 0;
  private hasAimed = false;

  constructor(id: string, private readonly isAim: boolean) {
    this.region = el(id);
    this.ring = this.region.querySelector('.stick-ring') as HTMLElement;
    this.knob = this.region.querySelector('.stick-knob') as HTMLElement;
    this.region.addEventListener('pointerdown', (event) => {
      if (this.pointerId !== null) return;
      event.preventDefault();
      event.stopPropagation();
      this.pointerId = event.pointerId;
      this.region.setPointerCapture(event.pointerId);
      this.readPointer(event);
      this.region.classList.add('engaged');
    }, { passive: false });
    this.region.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.pointerId) return;
      event.preventDefault();
      this.readPointer(event);
    }, { passive: false });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.region.addEventListener(type, (event: Event) => {
        const point = event as PointerEvent;
        if (point.pointerId !== this.pointerId) return;
        this.pointerId = null;
        this.dx = 0;
        this.dy = 0;
        this.knob.style.transform = 'translate(-50%, -50%)';
        this.region.classList.remove('engaged');
      });
    }
  }

  private readPointer(event: PointerEvent): void {
    const rect = this.ring.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = Math.max(22, rect.width / 2 - 23);
    const rawX = (event.clientX - centerX) / radius;
    const rawY = (event.clientY - centerY) / radius;
    const magnitude = Math.max(1, Math.hypot(rawX, rawY));
    const x = rawX / magnitude;
    const y = rawY / magnitude;
    // Analog dead zone; preserves sensitivity near the middle.
    this.dx = Math.abs(x) > 0.10 ? x : 0;
    this.dy = Math.abs(y) > 0.10 ? y : 0;
    this.knob.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
    if (this.isAim && Math.hypot(x, y) > 0.18) {
      this.rememberedAngle = Math.atan2(y, x);
      this.hasAimed = true;
    }
  }

  vector(): StickVector { return { x: this.dx, y: this.dy }; }
  aim(): AimState { return { active: this.hasAimed, angle: this.rememberedAngle }; }
  reset(): void {
    this.dx = this.dy = 0;
    this.hasAimed = false;
    this.rememberedAngle = 0;
    this.knob.style.transform = 'translate(-50%, -50%)';
  }
}

const moveStick = new TouchStick('stick-move', false);
const aimStick = new TouchStick('stick-aim', true);
const isTouch = window.matchMedia('(pointer: coarse)').matches;
let mode: 'start' | 'playing' | 'paused' | 'result' | 'levelup' = 'start';
let best = 0;
try { best = Number(localStorage.getItem('veronikill-best-v1') || '0') || 0; }
catch { /* private browsing can block localStorage */ }

const upgradeImages: Partial<Record<UpgradeId, string>> = {
  rocket: 'assets/items/missile.webp',
  blades: 'assets/items/lame.webp',
  heal: 'assets/items/cura.webp',
  armor: 'assets/items/scudo.webp'
};
let activeLevelOptions: UpgradeOption[] = [];

const scene = new GameScene({
  move: () => moveStick.vector(),
  aim: () => isTouch ? aimStick.aim() : { active: false, angle: 0 },
  onHUD: (data: HUDState) => {
    hpBar.style.width = Math.max(0, data.hp / data.maxHP * 100) + '%';
    hpBar.classList.toggle('low', data.hp < 30);
    hpText.textContent = String(Math.round(data.hp));
    scoreText.textContent = String(data.score);
    progressBar.style.width = data.progress + '%';
    if (progressLabel) progressLabel.textContent = 'LIBRERIA · ' + data.progress + '%';
    progressWidget?.classList.toggle('hidden', data.bossActive);
    bossHud.classList.toggle('hidden', !data.bossActive);
    if (data.bossActive) {
      const fraction = Math.max(0, data.bossHP / Math.max(1, data.bossMaxHP));
      bossFill.style.width = (fraction * 100).toFixed(1) + '%';
      bossHud.classList.toggle('enraged', fraction <= 0.45);
      bossCount.textContent = Math.ceil(data.bossHP) + ' / ' + data.bossMaxHP;
    }
    xpBar.style.width = (100 * Math.min(data.xp, data.xpNeeded) / Math.max(1, data.xpNeeded)).toFixed(1) + '%';
    xpNumber.textContent = data.xp + ' / ' + data.xpNeeded + ' XP';
    levelText.textContent = 'LIV. ' + data.level;
    // Bottom-center inventory strip; never render a full line across the arena.
    const chips: LoadoutChip[] = [
      { icon: '🔫', name: 'MITRA', rank: 1 + data.damageRank }
    ];
    if (data.rocketLevel) chips.push({ icon: '🚀', name: 'MISSILI', rank: data.rocketLevel });
    if (data.bladeLevel) chips.push({ icon: '✂', name: 'LAME', rank: data.bladeLevel });
    if (data.fireRateRank) chips.push({ icon: '⚡', name: 'CADENZA', rank: data.fireRateRank });
    if (data.movementRank) chips.push({ icon: '👟', name: 'CORSA', rank: data.movementRank });
    if (data.armorRank) chips.push({ icon: '🛡', name: 'DIFESA', rank: data.armorRank });
    const healthRank = Math.round((data.maxHP - 100) / 20);
    if (healthRank) chips.push({ icon: '♥', name: 'VITA', rank: healthRank });
    if (data.shieldSeconds) chips.push({ icon: '🛡', name: 'SCUDO ' + data.shieldSeconds + 's', temporary: true });
    if (data.speedSeconds) chips.push({ icon: '☕', name: 'TURBO ' + data.speedSeconds + 's', temporary: true });
    if (data.rapidSeconds) chips.push({ icon: '🔥', name: 'RAFFICA ' + data.rapidSeconds + 's', temporary: true });
    renderLoadout(chips);
  },
  onNotice: showNotice,
  onLevelUp: ({ level, options }: LevelUpChoice) => {
    mode = 'levelup';
    activeLevelOptions = options;
    levelUpTitle.textContent = String(level);
    upgradeOptions.replaceChildren();
    for (const option of options) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-option';
      const art = document.createElement('span');
      art.className = 'upgrade-option-icon';
      const artFile = upgradeImages[option.id];
      if (artFile) {
        const img = document.createElement('img');
        img.src = import.meta.env.BASE_URL + artFile;
        img.alt = '';
        img.onerror = () => { art.textContent = option.icon; };
        art.append(img);
      } else {
        art.textContent = option.icon;
      }
      const tag = document.createElement('span');
      tag.className = 'upgrade-option-tag';
      tag.textContent = option.rarity;
      const name = document.createElement('strong');
      name.className = 'upgrade-option-title';
      name.textContent = option.title;
      const description = document.createElement('span');
      description.className = 'upgrade-option-desc';
      description.textContent = option.description;
      card.append(art, tag, name, description);
      card.addEventListener('click', () => chooseUpgrade(option.id));
      upgradeOptions.append(card);
    }
    mobileControls.classList.add('hidden');
    levelUpPanel.classList.remove('hidden');
  },
  onEnd: (result: RunResult) => {
    levelUpPanel.classList.add('hidden');
    mode = 'result';
    brandedLogo.hidden = true;
    mobileControls.classList.add('hidden');
    if (result.score > best) {
      best = result.score;
      try { localStorage.setItem('veronikill-best-v1', String(best)); } catch { /* optional */ }
    }
    bossHud.classList.add('hidden');
    notice.classList.add('hidden');
    window.clearTimeout(noticeTimeout);
    title.textContent = result.outcome === 'won' ? 'MISSIONE COMPIUTA!' : 'FUORI CATALOGO!';
    copy.textContent = result.outcome === 'won'
      ? 'Direttore Generale sconfitto! La libreria è passata da integra a danneggiata e infine in fiamme. Veronica ha vinto la sua battaglia editoriale!'
      : 'I commessi hanno avuto la meglio, per questa volta. C’è sempre una seconda edizione.';
    subline.textContent = `KO: ${result.kills}  ·  PUNTI: ${result.score}  ·  RECORD: ${best}  ·  TEMPO: ${Math.round(result.seconds)}s`;
    playBtn.textContent = 'GIOCA ANCORA ➜';
    panel.classList.remove('hidden');
  }
});

// Use the *available* display viewport, not a fixed 16:9 letterboxed canvas.
const gameHost = el<HTMLDivElement>('game');
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: Math.max(1, gameHost.clientWidth),
  height: Math.max(1, gameHost.clientHeight),
  backgroundColor: '#243044',
  antialias: true,
  render: { pixelArt: false },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
  scene: [scene]
});

function chooseUpgrade(id: UpgradeId): void {
  if (mode !== 'levelup' || !scene.chooseUpgrade(id)) return;
  if (!scene.isChoosingUpgrade) {
    mode = 'playing';
    activeLevelOptions = [];
    levelUpPanel.classList.add('hidden');
    mobileControls.classList.toggle('hidden', !isTouch);
  }
}

const showHUD = (visible: boolean): void => {
  hud.classList.toggle('hidden', !visible);
  mobileControls.classList.toggle('hidden', !visible || !isTouch);
};
playBtn.addEventListener('click', () => {
  // A tap/press is a valid fullscreen user gesture on supporting Android browsers.
  // Standalone PWAs can reject the request; gameplay must continue regardless.
  if (isTouch && !document.fullscreenElement && document.fullscreenEnabled) {
    void document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .catch(() => { /* unsupported or blocked by the hosting browser */ });
  }
  notice.classList.add('hidden');
  window.clearTimeout(noticeTimeout);
  levelUpPanel.classList.add('hidden');
  activeLevelOptions = [];
  if (mode === 'paused') {
    scene.setPaused(false);
  } else {
    moveStick.reset();
    aimStick.reset();
    scene.startRun();
  }
  mode = 'playing';
  panel.classList.add('hidden');
  showHUD(true);
});
const pauseRun = (): void => {
  if (mode !== 'playing' || !scene.isRunning) return;
  mode = 'paused';
  brandedLogo.hidden = true;
  scene.setPaused(true);
  title.textContent = 'PAUSA CAFFÈ';
  copy.textContent = 'Anche le rivoluzioni editoriali hanno bisogno di una pausa.';
  subline.textContent = 'Due joystick, sparo automatico. Il gioco riprenderà esattamente da qui.';
  playBtn.textContent = 'RIPRENDI ➜';
  panel.classList.remove('hidden');
  showHUD(false);
};
pauseBtn.addEventListener('click', pauseRun);
window.addEventListener('keydown', (event) => {
  if (mode === 'levelup' && ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(event.code)) {
    const choiceIndex = Number(event.code.at(-1)) - 1;
    const option = activeLevelOptions[choiceIndex];
    if (option) chooseUpgrade(option.id);
    return;
  }
  if (event.code !== 'Escape' && event.code !== 'Space') return;
  if (event.code === 'Space') event.preventDefault();
  if (mode === 'playing') pauseRun();
  else if (mode === 'paused') playBtn.click();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseRun();
});
window.addEventListener('blur', () => {
  if (isTouch) pauseRun();
});
el('game').addEventListener('contextmenu', event => event.preventDefault());
showHUD(false);


/**
 * Refresh existing PWA installations when GitHub Pages publishes new assets.
 * Never reload an active run: controllerchange reloads only on the title screen.
 * Crucially, do NOT wipe origin-wide caches: other PWAs share this Pages domain.
 */
if ('serviceWorker' in navigator) {
  const wasControlled = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  let refreshOnNextStart = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled || refreshing) return;
    if (mode !== 'start') {
      refreshOnNextStart = true; // Don't interrupt a run or the boss fight.
      return;
    }
    refreshing = true;
    window.location.reload();
  });
  // Runs that remain open during an update refresh when the user starts again.
  playBtn.addEventListener('click', () => {
    if (!refreshOnNextStart || refreshing || mode !== 'result') return;
    refreshing = true;
    window.location.reload();
  }, { capture: true });
  const checkForUpdate = (): void => {
    navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      .then(registration => registration?.update())
      .catch(error => console.warn('Aggiornamento PWA non disponibile:', error));
  };
  if (document.readyState === 'complete') checkForUpdate();
  else window.addEventListener('load', checkForUpdate, { once: true });
}
