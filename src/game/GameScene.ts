import Phaser from 'phaser';

export type StickVector = { x: number; y: number };
export type AimState = { active: boolean; angle: number };
export type HUDState = {
  hp: number; maxHP: number; score: number; kills: number; progress: number;
  rocketLevel: number; bladeLevel: number; elapsed: number;
  shieldSeconds: number; speedSeconds: number; rapidSeconds: number;
  level: number; xp: number; xpNeeded: number;
  damageRank: number; fireRateRank: number; movementRank: number; armorRank: number;
};
export type RunResult = { outcome: 'won' | 'lost'; score: number; kills: number; seconds: number };

export type UpgradeId =
  | 'rocket' | 'blades' | 'damage' | 'fire-rate'
  | 'movement' | 'max-health' | 'armor' | 'heal';

export interface UpgradeOption {
  id: UpgradeId;
  title: string;
  description: string;
  icon: string;
  rarity: 'Arma' | 'Passivo' | 'Recupero';
}

export interface LevelUpChoice {
  level: number;
  options: UpgradeOption[];
}


export interface GamePorts {
  move: () => StickVector;
  aim: () => AimState;
  onHUD: (hud: HUDState) => void;
  onEnd: (result: RunResult) => void;
  onLevelUp: (event: LevelUpChoice) => void;
}

type EnemyKind = 'commesso' | 'capo' | 'cliente';
type Enemy = {
  sprite: Phaser.GameObjects.Image;
  kind: EnemyKind;
  hp: number; speed: number; damage: number;
  phase: number; cooldown: number; warning: number; charge: number;
  lastBlade: number; dead: boolean;
};
type Shot = {
  sprite: Phaser.GameObjects.Image; vx: number; vy: number; ttl: number;
  power: number; owner: 'player' | 'enemy'; rocket: boolean; dead: boolean;
};
type LootKind = 'rocket' | 'blades' | 'heal' | 'shield' | 'coffee' | 'ammo';
type Loot = { sprite: Phaser.GameObjects.Image; kind: LootKind };

const WIDTH = 960;
const HEIGHT = 900;
const FINISH_X = 25000;
const ROAD_TOP = 165;
const ROAD_BOTTOM = 735;

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
}
function randomBetween(min: number, max: number): number {
  return Phaser.Math.Between(min, max);
}

export class GameScene extends Phaser.Scene {
  private readonly ports: GamePorts;
  private player!: Phaser.GameObjects.Image;
  private playerScale = 0.97;
  private playerRotationOffset = 0;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private loot: Loot[] = [];
  private blades: Phaser.GameObjects.Image[] = [];
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private running = false;
  private pausedRun = false;
  private health = 100;
  private score = 0;
  private kills = 0;
  private elapsed = 0;
  private invincibleUntil = 0;
  private aimAngle = 0;
  private fireTimer = 0;
  private spawnTimer = 1;
  private missileTimer = 1.5;
  private hudTimer = 0;
  private nextLootX = 850;
  private lootIndex = 0;
  private rocketLevel = 0;
  private bladeLevel = 0;
  private bladeAngle = 0;
  private shieldUntil = 0;
  private speedUntil = 0;
  private rapidUntil = 0;
  private winTriggered = false;
  private maxHP = 100;
  private xp = 0;
  private level = 1;
  private awaitingUpgrade = false;
  private offeredUpgrades: UpgradeOption[] = [];
  private damageRank = 0;
  private fireRateRank = 0;
  private movementRank = 0;
  private armorRank = 0;


  constructor(ports: GamePorts) {
    super({ key: 'Game' });
    this.ports = ports;
  }

  preload(): void {
    const base = import.meta.env.BASE_URL;
    this.load.image('veronica-art', base + 'veronica-topdown.webp');
    this.load.image('street-art', base + 'assets/street/street-v04.webp');
    for (const kind of ['commesso', 'capo', 'cliente']) {
      this.load.image('enemy-' + kind, base + 'assets/enemies/' + kind + '.webp');
    }
    for (const kind of ['mitra', 'missile', 'lame', 'cura', 'scudo', 'caffe', 'munizioni']) {
      this.load.image('item-' + kind, base + 'assets/items/' + kind + '.webp');
    }
    for (const kind of ['giunti', 'giunti-damaged', 'giunti-fire']) {
      this.load.image('bookstore-' + kind, base + 'assets/bookstore/' + kind + '-v04.webp');
    }
  }

  create(): void {
    this.makeTextures();
    this.drawCity();
    this.playerShadow = this.add.ellipse(170, 470, 43, 17, 0x0c0d16, 0.36).setDepth(10);
    const artTexture = this.textures.exists('veronica-art') ? 'veronica-art' : 'veronica';
    this.player = this.add.image(170, 450, artTexture).setDepth(22);
    this.playerScale = artTexture === 'veronica-art' ? 86 / this.player.height : 0.97;
    // The illustration's weapon points down-right; compensate when rotating to aim.
    this.playerRotationOffset = artTexture === 'veronica-art' ? -0.70 : 0;
    this.player.setScale(this.playerScale).setRotation(this.playerRotationOffset);
    this.cameras.main.setBounds(0, 0, FINISH_X + 800, HEIGHT);
    // The old 1:1 camera cropped BOTH sidewalks from the visible 540px view
    // into a 900px world; zooming out exposes the new road geometry immediately.
    this.cameras.main.setZoom(0.74);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.12, -140, 0);
    this.cameras.main.roundPixels = true;
    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
    this.emitHUD();
  }

  startRun(): void {
    this.destroyDynamic();
    this.maxHP = 100;
    this.health = this.maxHP;
    this.level = 1;
    this.xp = 0;
    this.awaitingUpgrade = false;
    this.offeredUpgrades = [];
    this.damageRank = 0;
    this.fireRateRank = 0;
    this.movementRank = 0;
    this.armorRank = 0;
    this.score = 0;
    this.kills = 0;
    this.elapsed = 0;
    this.invincibleUntil = 0;
    this.aimAngle = 0;
    this.fireTimer = 0.15;
    this.spawnTimer = 1;
    this.missileTimer = 2;
    this.hudTimer = 0;
    this.nextLootX = 820;
    this.lootIndex = 0;
    this.rocketLevel = 0;
    this.bladeLevel = 0;
    this.bladeAngle = 0;
    this.shieldUntil = 0;
    this.speedUntil = 0;
    this.rapidUntil = 0;
    this.winTriggered = false;
    this.player.setPosition(170, 450).setRotation(this.playerRotationOffset).clearTint().setScale(this.playerScale);
    this.playerShadow.setPosition(170, 470);
    this.cameras.main.centerOn(370, HEIGHT / 2);
    this.running = true;
    this.pausedRun = false;
    this.emitHUD();
  }

  setPaused(value: boolean): void {
    this.pausedRun = value;
  }

  get isPaused(): boolean { return this.pausedRun; }
  get isRunning(): boolean { return this.running; }
  get isChoosingUpgrade(): boolean { return this.awaitingUpgrade; }

  // The XP remaining after a level-up is carried into the next level.
  private xpNeeded(level = this.level): number {
    return Math.round(40 + (level - 1) * 24 + Math.pow(level - 1, 1.35) * 5);
  }

  private availableUpgrades(): UpgradeOption[] {
    const all: UpgradeOption[] = [
      { id: 'rocket', title: 'Missili a ricerca', description: 'Sblocca o migliora i missili automatici.', icon: '🚀', rarity: 'Arma' },
      { id: 'blades', title: 'Lame orbitanti', description: 'Più lame e più danni intorno a Veronica.', icon: '🔪', rarity: 'Arma' },
      { id: 'damage', title: 'Proiettili rinforzati', description: '+4 danni per ogni colpo del mitra.', icon: '💥', rarity: 'Passivo' },
      { id: 'fire-rate', title: 'Grilletto facile', description: '+12% velocità di fuoco permanente.', icon: '⚡', rarity: 'Passivo' },
      { id: 'movement', title: 'Scarpe da corsa', description: '+7% velocità di movimento permanente.', icon: '👟', rarity: 'Passivo' },
      { id: 'max-health', title: 'Copertina rigida', description: '+20 salute massima e recuperi 20 HP.', icon: '❤️', rarity: 'Passivo' },
      { id: 'armor', title: 'Recensioni blindate', description: '-12% danni subiti (cumulabile).', icon: '🛡️', rarity: 'Passivo' },
      { id: 'heal', title: 'Pausa ristoro', description: 'Recupera 40 punti salute subito.', icon: '☕', rarity: 'Recupero' }
    ];
    return all.filter(option => {
      switch (option.id) {
        case 'rocket': return this.rocketLevel < 3;
        case 'blades': return this.bladeLevel < 3;
        case 'damage': return this.damageRank < 6;
        case 'fire-rate': return this.fireRateRank < 5;
        case 'movement': return this.movementRank < 5;
        case 'max-health': return this.maxHP < 200;
        case 'armor': return this.armorRank < 4;
        case 'heal': return this.health <= this.maxHP - 12;
      }
    });
  }

  private createLevelUpChoice(): void {
    if (!this.running || this.awaitingUpgrade || this.xp < this.xpNeeded()) return;
    this.xp -= this.xpNeeded();
    this.level += 1;
    const pool = this.availableUpgrades();
    Phaser.Utils.Array.Shuffle(pool);
    this.offeredUpgrades = pool.slice(0, 3);
    this.awaitingUpgrade = true;
    this.emitHUD();
    this.ports.onLevelUp({ level: this.level, options: this.offeredUpgrades.map(option => ({ ...option })) });
  }

  chooseUpgrade(id: UpgradeId): boolean {
    if (!this.running || !this.awaitingUpgrade || !this.offeredUpgrades.some(option => option.id === id)) return false;
    switch (id) {
      case 'rocket':
        this.rocketLevel = Math.min(3, this.rocketLevel + 1);
        break;
      case 'blades':
        this.bladeLevel = Math.min(3, this.bladeLevel + 1);
        this.rebuildBlades();
        break;
      case 'damage':
        this.damageRank++;
        break;
      case 'fire-rate':
        this.fireRateRank++;
        break;
      case 'movement':
        this.movementRank++;
        break;
      case 'max-health':
        this.maxHP += 20;
        this.health = Math.min(this.maxHP, this.health + 20);
        break;
      case 'armor':
        this.armorRank++;
        break;
      case 'heal':
        this.health = Math.min(this.maxHP, this.health + 40);
        break;
    }
    this.awaitingUpgrade = false;
    this.offeredUpgrades = [];
    this.emitHUD();
    // Multiple levels gained from a single high-XP event are handled in sequence.
    this.createLevelUpChoice();
    return true;
  }

  private awardXP(points: number): void {
    this.xp += points;
    this.emitHUD();
    this.createLevelUpChoice();
  }

  update(_time: number, deltaMs: number): void {
    if (!this.running || this.pausedRun || this.awaitingUpgrade) return;
    if (window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth) return;

    const dt = Math.min(deltaMs / 1000, 0.05);
    this.elapsed += dt;
    this.updatePlayer(dt);
    this.updateWeapons(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);
    this.updateLoot();
    this.cleanUp();

    if (this.player.x >= FINISH_X - 80 && !this.winTriggered) {
      this.winTriggered = true;
      this.finish('won');
      return;
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      this.emitHUD();
    }
  }

  private updatePlayer(dt: number): void {
    const stick = this.ports.move();
    const move = { x: stick.x, y: stick.y };
    const k = this.keys;
    if (k) {
      if (k.A?.isDown || k.LEFT?.isDown) move.x -= 1;
      if (k.D?.isDown || k.RIGHT?.isDown) move.x += 1;
      if (k.W?.isDown || k.UP?.isDown) move.y -= 1;
      if (k.S?.isDown || k.DOWN?.isDown) move.y += 1;
    }
    const magnitude = Math.hypot(move.x, move.y);
    if (magnitude > 1) {
      move.x /= magnitude; move.y /= magnitude;
    }
    const speed = (this.elapsed < this.speedUntil ? 340 : 255) * (1 + this.movementRank * 0.07);
    this.player.x = Phaser.Math.Clamp(this.player.x + move.x * speed * dt, 90, FINISH_X);
    this.player.y = Phaser.Math.Clamp(this.player.y + move.y * speed * dt, ROAD_TOP + 34, ROAD_BOTTOM - 34);
    this.playerShadow.setPosition(this.player.x + 1, this.player.y + 20);
    this.player.setScale(this.playerScale * (1 + (magnitude > 0.07 ? Math.sin(this.elapsed * 17) * 0.022 : 0)));

    const stickAim = this.ports.aim();
    if (stickAim.active) {
      this.aimAngle = stickAim.angle;
    } else if (!window.matchMedia('(pointer: coarse)').matches && this.input.activePointer) {
      const pointer = this.input.activePointer;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (Math.hypot(world.x - this.player.x, world.y - this.player.y) > 16) {
        this.aimAngle = Math.atan2(world.y - this.player.y, world.x - this.player.x);
      }
    }
    this.player.rotation = this.aimAngle + this.playerRotationOffset;
    if (this.elapsed < this.invincibleUntil) {
      this.player.setAlpha(Math.floor(this.elapsed * 20) % 2 ? 0.40 : 1);
    } else {
      this.player.setAlpha(1).clearTint();
    }
  }

  private updateWeapons(dt: number): void {
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && this.shots.length < 140) {
      this.fireTimer = (this.elapsed < this.rapidUntil ? 0.085 : 0.165) * Math.pow(0.88, this.fireRateRank);
      const angle = this.aimAngle + randomBetween(-3, 3) * Math.PI / 180;
      const muzzle = 35;
      this.addShot(
        this.player.x + Math.cos(angle) * muzzle,
        this.player.y + Math.sin(angle) * muzzle,
        angle, 840, 15 + 4 * this.damageRank, 'player', false
      );
    }

    if (this.rocketLevel > 0) {
      this.missileTimer -= dt;
      if (this.missileTimer <= 0 && this.shots.length < 140) {
        this.missileTimer = Math.max(1.35, 3.2 - this.rocketLevel * 0.5);
        const target = this.nearestEnemy(480);
        if (target) {
          const angle = Math.atan2(target.sprite.y - this.player.y, target.sprite.x - this.player.x);
          this.addShot(this.player.x, this.player.y, angle, 350, 43 + this.rocketLevel * 15, 'player', true);
        }
      }
    }

    if (this.bladeLevel > 0) {
      this.bladeAngle += dt * 3.6;
      for (let i = 0; i < this.blades.length; i++) {
        const a = this.bladeAngle + Math.PI * 2 * i / this.blades.length;
        const blade = this.blades[i];
        blade.setPosition(this.player.x + Math.cos(a) * 77, this.player.y + Math.sin(a) * 77).setRotation(a + Math.PI / 2);
        for (const enemy of this.enemies) {
          if (!enemy.dead && distance(blade, enemy.sprite) < 31 && this.elapsed - enemy.lastBlade > 0.38) {
            enemy.lastBlade = this.elapsed;
            this.hurtEnemy(enemy, 13 + this.bladeLevel * 7);
          }
        }
      }
    }
  }

  private updateEnemies(dt: number): void {
    this.spawnTimer -= dt;
    const progress = this.player.x / FINISH_X;
    if (this.spawnTimer <= 0 && progress < 0.95) {
      this.spawnTimer = Math.max(0.48, 1.54 - progress * 0.82);
      if (this.enemies.length < 28) this.spawnEnemy(progress);
    }

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const s = enemy.sprite;
      let dx = this.player.x - s.x;
      let dy = this.player.y - s.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      dx /= dist; dy /= dist;

      if (enemy.kind === 'capo') {
        enemy.cooldown -= dt;
        if (enemy.warning > 0) {
          enemy.warning -= dt;
          s.setTint(0xffeb7d);
          if (enemy.warning <= 0) { enemy.charge = 0.48; s.setTint(0xff766e); }
        } else {
          if (enemy.charge > 0) enemy.charge -= dt;
          else s.clearTint();
          if (enemy.cooldown <= 0) {
            enemy.warning = 0.65;
            enemy.cooldown = 4.2;
          }
        }
      }

      if (enemy.kind === 'cliente') {
        enemy.phase += dt * 5;
        const lateral = Math.sin(enemy.phase) * 0.76;
        const tx = dx - dy * lateral;
        const ty = dy + dx * lateral;
        const m = Math.max(1, Math.hypot(tx, ty));
        s.x += tx / m * enemy.speed * dt;
        s.y += ty / m * enemy.speed * dt;
        enemy.cooldown -= dt;
        if (enemy.cooldown < 0 && dist < 440 && this.shots.length < 135) {
          enemy.cooldown = randomBetween(20, 32) / 10;
          const angle = Math.atan2(dy, dx);
          this.addShot(s.x, s.y, angle, 235, 12, 'enemy', false);
          s.setTint(0xf7cbff);
          this.time.delayedCall(160, () => { if (!enemy.dead && s.active) s.clearTint(); });
        }
      } else if (enemy.warning <= 0) {
        const speed = enemy.speed * (enemy.charge > 0 ? 3.1 : 1);
        s.x += dx * speed * dt;
        s.y += dy * speed * dt;
      }

      s.y = Phaser.Math.Clamp(s.y, ROAD_TOP + 10, ROAD_BOTTOM - 10);
      // Top-down illustrated enemies stay upright rather than spinning sideways.
      if (s.texture.key.startsWith('enemy-')) {
        s.setFlipX(dx < 0);
      } else {
        s.rotation = Math.atan2(dy, dx);
      }

      if (dist < (enemy.kind === 'capo' ? 44 : 34)) {
        this.hurtPlayer(enemy.damage, dx, dy);
      }
      if (s.x < this.player.x - 1030 || s.x > this.player.x + 1500) {
        enemy.dead = true;
        s.destroy();
      }
    }

    if (this.player.x >= this.nextLootX) {
      const pool: LootKind[] = ['rocket', 'blades', 'heal', 'shield', 'rocket', 'coffee', 'blades', 'ammo'];
      const type = pool[this.lootIndex % pool.length];
      this.placeLoot(type, this.player.x + 290, randomBetween(ROAD_TOP + 90, ROAD_BOTTOM - 90));
      this.lootIndex++;
      this.nextLootX += 1100;
    }
  }

  private updateShots(dt: number): void {
    for (const shot of this.shots) {
      if (shot.dead) continue;
      shot.ttl -= dt;
      if (shot.ttl <= 0) { shot.dead = true; shot.sprite.destroy(); continue; }

      if (shot.rocket) {
        const target = this.nearestEnemyFrom(shot.sprite, 440);
        if (target) {
          const desired = Math.atan2(target.sprite.y - shot.sprite.y, target.sprite.x - shot.sprite.x);
          const current = Math.atan2(shot.vy, shot.vx);
          const delta = Phaser.Math.Angle.Wrap(desired - current);
          const angle = current + Phaser.Math.Clamp(delta, -4 * dt, 4 * dt);
          const speed = 445;
          shot.vx = Math.cos(angle) * speed;
          shot.vy = Math.sin(angle) * speed;
          shot.sprite.rotation = angle;
        }
      }
      shot.sprite.x += shot.vx * dt;
      shot.sprite.y += shot.vy * dt;

      if (shot.owner === 'enemy') {
        if (distance(shot.sprite, this.player) < 27) {
          this.hurtPlayer(shot.power, (this.player.x - shot.sprite.x) / 25, (this.player.y - shot.sprite.y) / 25);
          shot.dead = true; shot.sprite.destroy();
        }
      } else {
        for (const enemy of this.enemies) {
          if (enemy.dead) continue;
          if (distance(shot.sprite, enemy.sprite) < (shot.rocket ? 28 : enemy.kind === 'capo' ? 31 : 24)) {
            if (shot.rocket) {
              for (const other of this.enemies) {
                if (!other.dead && distance(shot.sprite, other.sprite) < 92) this.hurtEnemy(other, shot.power);
              }
              this.explosion(shot.sprite.x, shot.sprite.y);
            } else {
              this.hurtEnemy(enemy, shot.power);
            }
            shot.dead = true; shot.sprite.destroy();
            break;
          }
        }
      }
      if (!shot.dead && (shot.sprite.y < ROAD_TOP - 80 || shot.sprite.y > ROAD_BOTTOM + 80 || Math.abs(shot.sprite.x - this.player.x) > 1100)) {
        shot.dead = true; shot.sprite.destroy();
      }
    }
  }

  private updateLoot(): void {
    for (const pick of this.loot) {
      if (!pick.sprite.active) continue;
      pick.sprite.angle += 1;
      if (distance(pick.sprite, this.player) < 46) {
        if (pick.kind === 'rocket') {
          this.rocketLevel = Math.min(3, this.rocketLevel + 1);
          this.popText(pick.sprite.x, pick.sprite.y, 'MISSILI LV.' + this.rocketLevel, '#c0ff79');
        } else if (pick.kind === 'blades') {
          this.bladeLevel = Math.min(3, this.bladeLevel + 1);
          this.rebuildBlades();
          this.popText(pick.sprite.x, pick.sprite.y, 'LAME LV.' + this.bladeLevel, '#f9a8ff');
        } else if (pick.kind === 'heal') {
          this.health = Math.min(this.maxHP, this.health + 30);
          this.popText(pick.sprite.x, pick.sprite.y, '+30 HP', '#6affcf');
        } else if (pick.kind === 'shield') {
          this.shieldUntil = Math.max(this.shieldUntil, this.elapsed) + 8;
          this.popText(pick.sprite.x, pick.sprite.y, 'SCUDO 8s', '#97e8ff');
        } else if (pick.kind === 'coffee') {
          this.speedUntil = Math.max(this.speedUntil, this.elapsed) + 8;
          this.popText(pick.sprite.x, pick.sprite.y, 'CAFFE TURBO 8s', '#ffe283');
        } else if (pick.kind === 'ammo') {
          this.rapidUntil = Math.max(this.rapidUntil, this.elapsed) + 8;
          this.popText(pick.sprite.x, pick.sprite.y, 'RAFFICA 8s', '#ffd37f');
        }
        pick.sprite.destroy();
        this.emitHUD();
      }
    }
  }

  private addShot(x: number, y: number, angle: number, speed: number, power: number, owner: 'player' | 'enemy', rocket: boolean): void {
    const sprite = this.add.image(x, y, rocket ? 'rocket' : owner === 'enemy' ? 'receipt' : 'bullet')
      .setRotation(angle).setDepth(15);
    this.shots.push({
      sprite, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      power, owner, rocket, ttl: rocket ? 2.4 : 1.25, dead: false
    });
  }

  private spawnEnemy(progress: number): void {
    const roll = Math.random();
    const kind: EnemyKind =
      progress > 0.36 && roll < 0.23 ? 'capo' :
      progress > 0.18 && roll < 0.55 ? 'cliente' : 'commesso';
    const y = Math.random() < 0.5 ? ROAD_TOP + 15 : ROAD_BOTTOM - 15;
    const x = Math.min(FINISH_X - 160, this.player.x + randomBetween(390, 710));
    const spec = {
      commesso: { hp: 38, speed: 112, damage: 9, texture: 'commesso' },
      capo: { hp: 132, speed: 72, damage: 17, texture: 'capo' },
      cliente: { hp: 57, speed: 91, damage: 11, texture: 'cliente' }
    }[kind];
    const texture = this.textures.exists('enemy-' + kind) ? 'enemy-' + kind : spec.texture;
    const sprite = this.add.image(x, y, texture).setDepth(18);
    if (texture !== spec.texture) {
      const width = kind === 'capo' ? 84 : 70;
      sprite.setScale(width / sprite.width);
    }
    this.enemies.push({
      sprite, kind, hp: Math.round(spec.hp * (1 + progress * 0.55)), speed: spec.speed * (1 + progress * 0.14), damage: spec.damage, phase: Math.random() * Math.PI * 2,
      cooldown: kind === 'cliente' ? 1.5 : 3.3, warning: 0, charge: 0, lastBlade: -5, dead: false
    });
  }

  private nearestEnemy(range: number): Enemy | undefined {
    return this.nearestEnemyFrom(this.player, range);
  }
  private nearestEnemyFrom(origin: { x: number; y: number }, range: number): Enemy | undefined {
    let best: Enemy | undefined;
    let bestDistance = range;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const d = distance(origin, enemy.sprite);
      if (d < bestDistance) { bestDistance = d; best = enemy; }
    }
    return best;
  }

  private hurtEnemy(enemy: Enemy, power: number): void {
    if (enemy.dead) return;
    enemy.hp -= power;
    if (enemy.hp <= 0) {
      enemy.dead = true;
      const pos = { x: enemy.sprite.x, y: enemy.sprite.y };
      enemy.sprite.destroy();
      this.kills++;
      const xpGain = enemy.kind === 'capo' ? 24 : enemy.kind === 'cliente' ? 14 : 10;
      this.score += enemy.kind === 'capo' ? 30 : enemy.kind === 'cliente' ? 20 : 10;
      if (Math.random() < 0.095 && this.health < 70) this.placeLoot('heal', pos.x, pos.y);
      this.popText(pos.x, pos.y, '+' + xpGain + ' XP', '#d5f6a4');
      this.awardXP(xpGain);
    } else {
      enemy.sprite.setAlpha(0.67);
      this.time.delayedCall(65, () => { if (!enemy.dead && enemy.sprite.active) enemy.sprite.setAlpha(1); });
    }
  }

  private hurtPlayer(power: number, nx: number, ny: number): void {
    if (this.elapsed < this.invincibleUntil || !this.running) return;
    if (this.elapsed < this.shieldUntil) {
      this.invincibleUntil = this.elapsed + 0.45;
      this.popText(this.player.x, this.player.y, 'BLOCCATO!', '#85dcff');
      return;
    }
    this.health = Math.max(0, this.health - Math.max(1, Math.round(power * Math.pow(0.88, this.armorRank))));
    this.invincibleUntil = this.elapsed + 0.75;
    this.player.setTint(0xff7798);
    const length = Math.max(0.01, Math.hypot(nx, ny));
    this.player.x = Phaser.Math.Clamp(this.player.x + nx / length * 17, 90, FINISH_X);
    this.player.y = Phaser.Math.Clamp(this.player.y + ny / length * 17, ROAD_TOP + 34, ROAD_BOTTOM - 34);
    this.cameras.main.shake(95, 0.002);
    this.emitHUD();
    if (this.health <= 0) this.finish('lost');
  }

  private rebuildBlades(): void {
    for (const blade of this.blades) blade.destroy();
    this.blades = [];
    for (let i = 0; i < 1 + this.bladeLevel; i++) {
      const texture = this.textures.exists('item-lame') ? 'item-lame' : 'blade';
      const blade = this.add.image(this.player.x, this.player.y, texture).setDepth(21);
      if (texture !== 'blade') blade.setScale(37 / Math.max(blade.width, blade.height));
      this.blades.push(blade);
    }
  }

  private placeLoot(kind: LootKind, x: number, y: number): void {
    const imageKeys: Record<LootKind, string> = {
      rocket: 'item-missile', blades: 'item-lame', heal: 'item-cura',
      shield: 'item-scudo', coffee: 'item-caffe', ammo: 'item-munizioni'
    };
    const art = imageKeys[kind];
    const placeholder = kind === 'rocket' ? 'loot-rocket' : kind === 'blades' ? 'loot-blades' : 'loot-heal';
    const texture = this.textures.exists(art) ? art : placeholder;
    const sprite = this.add.image(x, y, texture).setDepth(12);
    if (texture !== placeholder) sprite.setScale(65 / Math.max(sprite.width, sprite.height));
    this.loot.push({ sprite, kind });
  }

  private explosion(x: number, y: number): void {
    const ring = this.add.circle(x, y, 9, 0xf9ad56, 0.8).setDepth(17);
    this.tweens.add({ targets: ring, scaleX: 7, scaleY: 7, alpha: 0, duration: 240, onComplete: () => ring.destroy() });
  }

  private popText(x: number, y: number, value: string, color: string): void {
    const label = this.add.text(x, y - 25, value, {
      fontFamily: 'Arial, sans-serif', fontSize: '19px', fontStyle: 'bold',
      color, stroke: '#27152e', strokeThickness: 5
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: label, y: y - 75, alpha: 0, duration: 820, onComplete: () => label.destroy() });
  }

  private cleanUp(): void {
    this.enemies = this.enemies.filter(enemy => !enemy.dead);
    this.shots = this.shots.filter(shot => !shot.dead);
    this.loot = this.loot.filter(pick => pick.sprite.active && pick.sprite.x > this.player.x - 960);
  }

  private destroyDynamic(): void {
    for (const enemy of this.enemies) if (enemy.sprite.active) enemy.sprite.destroy();
    for (const shot of this.shots) if (shot.sprite.active) shot.sprite.destroy();
    for (const pick of this.loot) if (pick.sprite.active) pick.sprite.destroy();
    for (const blade of this.blades) if (blade.active) blade.destroy();
    this.enemies = []; this.shots = []; this.loot = []; this.blades = [];
  }

  private finish(outcome: 'won' | 'lost'): void {
    this.running = false;
    this.pausedRun = false;
    this.awaitingUpgrade = false;
    this.offeredUpgrades = [];
    this.emitHUD();
    this.ports.onEnd({ outcome, score: this.score, kills: this.kills, seconds: this.elapsed });
  }

  private emitHUD(): void {
    this.ports.onHUD({
      hp: this.health, maxHP: this.maxHP, score: this.score, kills: this.kills,
      progress: Math.min(100, Math.round(this.player ? this.player.x / FINISH_X * 100 : 0)),
      rocketLevel: this.rocketLevel, bladeLevel: this.bladeLevel, elapsed: this.elapsed,
      shieldSeconds: Math.max(0, Math.ceil(this.shieldUntil - this.elapsed)),
      speedSeconds: Math.max(0, Math.ceil(this.speedUntil - this.elapsed)),
      rapidSeconds: Math.max(0, Math.ceil(this.rapidUntil - this.elapsed)),
      level: this.level, xp: this.xp, xpNeeded: this.xpNeeded(),
      damageRank: this.damageRank, fireRateRank: this.fireRateRank,
      movementRank: this.movementRank, armorRank: this.armorRank
    });
  }

  private drawCity(): void {
    const totalWidth = FINISH_X + 800;
    // Wide art-backed road. Repeating segments keeps the level lightweight.
    if (this.textures.exists('street-art')) {
      // Repeat ordinary image quads rather than one 25,800-pixel TileSprite.
      // Large TileSprite canvases may exceed GPU texture limits on mobile.
      const source = this.textures.get('street-art').source[0];
      const scale = HEIGHT / source.height;
      const segmentWidth = source.width * scale;
      for (let x = 0; x < totalWidth; x += segmentWidth) {
        this.add.image(x, HEIGHT / 2, 'street-art')
          .setOrigin(0, 0.5)
          .setScale(scale)
          .setDepth(0);
      }
    } else {
      // Never silently show the old placeholder as if the new artwork were loaded.
      this.add.text(150, HEIGHT / 2, 'ERRORE: GRAFICA STRADA NON CARICATA', {
        fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: '24px',
        color: '#ffbb71', stroke: '#21142b', strokeThickness: 5
      }).setDepth(40);
      const g = this.add.graphics().setDepth(0);
      g.fillStyle(0x314052).fillRect(0, 0, totalWidth, HEIGHT);
      g.fillStyle(0x494b56).fillRect(0, ROAD_TOP, totalWidth, ROAD_BOTTOM - ROAD_TOP);
      g.fillStyle(0xe5d6b6, 0.6);
      for (let x = 30; x < totalWidth; x += 120) g.fillRect(x, HEIGHT / 2 - 3, 62, 6);
    }

    // The blue Giunti bookstore is rendered using the latest transparent sprite
    // separated from the updated art sheet. Alternate damaged/burning textures are preloaded for
    // future encounter phases, without changing the current victory logic.
    const storeX = FINISH_X + 150;
    const storeY = HEIGHT / 2;
    if (this.textures.exists('bookstore-giunti')) {
      const store = this.add.image(storeX, storeY, 'bookstore-giunti').setDepth(2);
      store.setScale(1.22);
    } else {
      this.add.text(storeX, storeY, 'GIUNTI', {
        fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
        fontSize: '58px', color: '#f6e2b9'
      }).setOrigin(0.5).setDepth(2);
    }

    const g = this.add.graphics().setDepth(3);
    g.lineStyle(8, 0xf9e05b, 0.9);
    g.lineBetween(FINISH_X - 80, ROAD_TOP, FINISH_X - 80, ROAD_BOTTOM);
    this.add.text(FINISH_X - 99, HEIGHT / 2, 'TRAGUARDO', {
      fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: '23px',
      color: '#fff1bb', stroke: '#23182d', strokeThickness: 5
    }).setOrigin(0.5).setRotation(-Math.PI / 2).setDepth(4);
  }

  private makeTextures(): void {
    if (this.textures.exists('veronica')) return;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Hero silhouette faces right, so sprite rotation points the weapon at the aim angle.
    g.fillStyle(0x211c2b); g.fillEllipse(34, 37, 50, 49);
    g.fillStyle(0xa342ad); g.fillEllipse(34, 37, 42, 41);
    g.fillStyle(0x432641); g.fillEllipse(25, 19, 33, 31);
    g.fillStyle(0xf9c69f); g.fillEllipse(37, 24, 31, 29);
    g.fillStyle(0x211c2b); g.fillCircle(46, 20, 3); g.fillCircle(46, 30, 3);
    g.fillStyle(0x20212e); g.fillRoundedRect(49, 31, 23, 11, 3);
    g.fillStyle(0xe4f76c); g.fillRect(66, 33, 6, 7);
    g.generateTexture('veronica', 76, 76); g.clear();

    const enemyTexture = (name: string, clothes: number, head: number, wide: number): void => {
      g.fillStyle(0x181b29); g.fillEllipse(30, 31, wide + 9, wide + 10);
      g.fillStyle(clothes); g.fillEllipse(30, 31, wide, wide);
      g.fillStyle(head); g.fillCircle(37, 22, 14);
      g.fillStyle(0x252039); g.fillCircle(45, 18, 3); g.fillCircle(45, 26, 3);
      if (name === 'capo') {
        g.fillStyle(0xf5d96d); g.fillRoundedRect(13, 9, 42, 9, 3);
        g.fillStyle(0xbad1e7); g.fillRoundedRect(6, 31, 10, 26, 2);
      }
      if (name === 'cliente') {
        g.fillStyle(0xf0ecda); g.fillRoundedRect(6, 6, 21, 23, 2);
        g.lineStyle(2, 0xe871a0); g.lineBetween(11, 13, 23, 18);
      }
      g.generateTexture(name, 66, 66); g.clear();
    };
    enemyTexture('commesso', 0x62bcca, 0xf6c699, 37);
    enemyTexture('capo', 0xe8a35c, 0xf2bb95, 49);
    enemyTexture('cliente', 0xf07899, 0xf4ceab, 40);

    g.fillStyle(0xf6f7a0); g.fillRoundedRect(0, 3, 21, 7, 3);
    g.fillStyle(0xffffff); g.fillRect(14, 4, 7, 5);
    g.generateTexture('bullet', 24, 12); g.clear();
    g.fillStyle(0xffa0bb); g.fillRoundedRect(0, 2, 25, 12, 2);
    g.fillStyle(0xf5d3e6); g.fillRect(7, 3, 11, 10);
    g.generateTexture('receipt', 25, 16); g.clear();

    g.fillStyle(0xd7f4a8); g.fillEllipse(16, 12, 30, 15);
    g.fillStyle(0x3b5254); g.fillRoundedRect(4, 8, 22, 10, 3);
    g.fillStyle(0xf5a74f); g.fillTriangle(2, 9, 2, 19, 0, 14);
    g.generateTexture('rocket', 32, 25); g.clear();

    g.fillStyle(0xf9b2f2); g.fillTriangle(20, 0, 31, 24, 5, 36);
    g.fillStyle(0xfdf7da); g.fillTriangle(19, 7, 24, 23, 12, 30);
    g.generateTexture('blade', 38, 40); g.clear();

    const lootTexture = (name: string, fill: number, symbol: string): void => {
      g.fillStyle(0x211b2a); g.fillCircle(28, 28, 28);
      g.fillStyle(fill); g.fillCircle(28, 28, 24);
      g.lineStyle(4, 0xfef5dc); g.strokeCircle(28, 28, 23);
      g.generateTexture(name, 56, 56); g.clear();
      this.add.text(-100, -100, symbol).destroy(); // Symbols are represented by color in the prototype.
    };
    lootTexture('loot-rocket', 0x91d564, 'R');
    lootTexture('loot-blades', 0xcf8ceb, 'L');
    lootTexture('loot-heal', 0x70d9b7, '+');

    g.destroy();
  }
}
