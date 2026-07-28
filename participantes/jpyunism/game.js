// Whack Combo — game.js
// Phaser 3 clicker con combo, dificultad, pausa, ranking local y soporte touch.

const W = 720;
const H = 540;
const GRID = 3;
const CELL = 180;
const BOARD_X = W / 2 - (CELL * GRID) / 2;
const BOARD_Y = H / 2 - (CELL * GRID) / 2 + 10;
const TARGET_R = 44;

const DIFFICULTIES = {
  easy:   { spawnBase: 1100, spawnMin: 500,  permanence: 1500, comboCap: 5,  spawnStep: 70 },
  normal: { spawnBase:  900, spawnMin: 400,  permanence: 1100, comboCap: 10, spawnStep: 60 },
  hard:   { spawnBase:  600, spawnMin: 280,  permanence:  800, comboCap: 10, spawnStep: 50 },
};

const RANKING_KEY = 'whackcombo:ranking:v1';

// ---------- helpers de ranking ----------
function loadRanking() {
  try {
    const raw = localStorage.getItem(RANKING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveRanking(ranking) {
  try {
    localStorage.setItem(RANKING_KEY, JSON.stringify(ranking));
  } catch (e) {
    // silencioso: localStorage lleno o deshabilitado no rompe el juego.
  }
}

function pushRanking(entry) {
  const ranking = loadRanking();
  ranking.push(entry);
  ranking.sort((a, b) => b.score - a.score);
  const top = ranking.slice(0, 10);
  saveRanking(top);
  return top.findIndex((r) => r === entry);
}

// ---------- generador procedural del target ----------
function makeTargetTexture(scene, key, color) {
  const size = 128;
  const g = scene.add.graphics({ x: 0, y: 0 });
  // sombra
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(size / 2, size - 12, size * 0.7, size * 0.18);
  // cuerpo
  g.fillStyle(color, 1);
  g.fillCircle(size / 2, size / 2, size / 2 - 6);
  // borde
  g.lineStyle(4, 0x3a2410, 1);
  g.strokeCircle(size / 2, size / 2, size / 2 - 6);
  // ojo
  g.fillStyle(0xffffff, 1);
  g.fillCircle(size / 2 - 8, size / 2 - 6, 12);
  g.fillStyle(0x000000, 1);
  g.fillCircle(size / 2 - 4, size / 2 - 4, 6);
  g.generateTexture(key, size, size);
  g.destroy();
}

// ---------- escena: Menu ----------
class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.add.text(W / 2, 110, 'WHACK COMBO', {
      fontSize: '56px',
      fontStyle: 'bold',
      color: '#f4e4c1',
    }).setOrigin(0.5);

    this.add.text(W / 2, 170, 'Click the targets. Build your combo.', {
      fontSize: '18px',
      color: '#c9b48a',
    }).setOrigin(0.5);

    const makeButton = (label, y, color, onClick) => {
      const btn = this.add.text(W / 2, y, label, {
        fontSize: '32px',
        color: '#1a1410',
        backgroundColor: color,
        padding: { x: 28, y: 12 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => btn.setScale(1.05));
      btn.on('pointerout',  () => btn.setScale(1));
      btn.on('pointerdown', onClick);
      return btn;
    };

    makeButton('EASY',   270, '#9bbf6c', () => this.startGame('easy'));
    makeButton('NORMAL', 340, '#e9b872', () => this.startGame('normal'));
    makeButton('HARD',   410, '#d96a52', () => this.startGame('hard'));

    this.add.text(W / 2, 480, 'View Ranking', {
      fontSize: '20px',
      color: '#c9b48a',
      backgroundColor: '#2a2018',
      padding: { x: 18, y: 8 },
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.showRanking());

    this.input.keyboard.on('keydown-R', () => this.scene.start('Menu'));
  }

  startGame(difficulty) {
    this.scene.start('Game', { difficulty });
  }

  showRanking() {
    const ranking = loadRanking();
    const lines = ranking.length === 0
      ? ['No scores yet.']
      : ranking.map((r, i) => `${i + 1}. ${r.name}  ${r.score}  (${r.difficulty})`);

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.8).setInteractive();
    const box = this.add.rectangle(W / 2, H / 2, W - 80, H - 80, 0x2a2018).setStrokeStyle(2, 0xc9b48a);

    this.add.text(W / 2, 80, 'TOP 10', {
      fontSize: '32px', fontStyle: 'bold', color: '#f4e4c1',
    }).setOrigin(0.5);

    this.add.text(W / 2, 130, lines.join('\n'), {
      fontSize: '18px',
      color: '#f4e4c1',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5);

    const close = this.add.text(W / 2, H - 60, 'Close', {
      fontSize: '22px',
      color: '#1a1410',
      backgroundColor: '#e9b872',
      padding: { x: 24, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    close.on('pointerdown', () => {
      overlay.destroy(); box.destroy(); close.destroy();
      this.scene.restart();
    });
  }
}

// ---------- escena: Game ----------
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.difficultyKey = data.difficulty || 'normal';
    this.cfg = DIFFICULTIES[this.difficultyKey];
  }

  create() {
    this.score = 0;
    this.combo = 1;
    this.hits = 0;
    this.timeLeft = 60;
    this.paused = false;
    this.gameOver = false;
    this.activeTarget = null;
    this.spawnTimer = null;

    this.add.image(W / 2, H / 2 + 10, 'background').setDisplaySize(CELL * GRID + 40, CELL * GRID + 40);

    // guias sutiles del tablero
    const guide = this.add.graphics();
    guide.lineStyle(2, 0x3a2410, 0.4);
    for (let i = 1; i < GRID; i++) {
      guide.lineBetween(BOARD_X + i * CELL, BOARD_Y, BOARD_X + i * CELL, BOARD_Y + CELL * GRID);
      guide.lineBetween(BOARD_X, BOARD_Y + i * CELL, BOARD_X + CELL * GRID, BOARD_Y + i * CELL);
    }

    // HUD
    this.scoreText  = this.add.text(20,  20, 'Score: 0',    { fontSize: '22px', color: '#f4e4c1' });
    this.comboText  = this.add.text(W / 2, 20, 'Combo: x1',  { fontSize: '22px', color: '#f4e4c1' }).setOrigin(0.5, 0);
    this.timeText   = this.add.text(W - 20, 20, 'Time: 60',   { fontSize: '22px', color: '#f4e4c1' }).setOrigin(1, 0);
    this.diffText   = this.add.text(W - 20, 50, this.difficultyKey.toUpperCase(), { fontSize: '14px', color: '#c9b48a' }).setOrigin(1, 0);

    // boton pausa
    this.pauseBtn = this.add.text(20, 50, '||', {
      fontSize: '22px', color: '#c9b48a', backgroundColor: '#2a2018', padding: { x: 8, y: 4 },
    }).setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => this.togglePause());

    // click/touch en vacio = miss
    this.input.on('pointerdown', (pointer, targets) => {
      if (this.paused || this.gameOver) return;
      if (targets.length === 0) {
        this.onMiss();
      }
    });

    // teclas
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-R', () => this.scene.restart({ difficulty: this.difficultyKey }));
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));

    // pausa automatica al perder foco
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      if (!this.paused && !this.gameOver) this.togglePause();
    });

    // timer
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.paused || this.gameOver) return;
        this.timeLeft -= 1;
        this.refreshHud();
        if (this.timeLeft <= 10 && this.timeText.style.color !== '#ff6b6b') {
          this.timeText.setColor('#ff6b6b');
        }
        if (this.timeLeft <= 0) this.endGame();
      },
    });

    this.scheduleSpawn(400);
  }

  refreshHud() {
    this.scoreText.setText(`Score: ${this.score}`);
    this.comboText.setText(`Combo: x${this.combo}`);
    this.timeText.setText(`Time: ${this.timeLeft}`);
  }

  scheduleSpawn(delay) {
    if (this.spawnTimer) this.spawnTimer.remove();
    this.spawnTimer = this.time.addEvent({
      delay,
      callback: () => this.spawnTarget(),
    });
  }

  spawnTarget() {
    if (this.paused || this.gameOver) return;
    const idx = Phaser.Math.Between(0, GRID * GRID - 1);
    const col = idx % GRID;
    const row = Math.floor(idx / GRID);
    const x = BOARD_X + col * CELL + CELL / 2;
    const y = BOARD_Y + row * CELL + CELL / 2;

    const isHot = this.combo >= 5;
    const key = isHot ? 'target-hot' : 'target';
    const target = this.add.sprite(x, y, key).setInteractive({ useHandCursor: true });
    target.setScale(0);
    this.tweens.add({
      targets: target,
      scale: 1,
      duration: 180,
      ease: 'Back.easeOut',
    });

    target.on('pointerdown', () => this.onHit(target));
    this.activeTarget = target;

    // auto-expiracion
    this.time.addEvent({
      delay: this.cfg.permanence,
      callback: () => {
        if (target && target.active) target.destroy();
      },
    });

    const nextSpawn = Math.max(this.cfg.spawnMin, this.cfg.spawnBase - this.hits * this.cfg.spawnStep);
    this.scheduleSpawn(nextSpawn);
  }

  onHit(target) {
    if (this.paused || this.gameOver) return;
    const gained = 10 * this.combo;
    this.score += gained;
    this.hits += 1;
    if (this.hits % 5 === 0) {
      this.combo = Math.min(this.cfg.comboCap, this.combo + 1);
    }
    this.refreshHud();

    this.sound.play('hit', { volume: 0.5 });

    // animacion: escala 1 -> 1.4 -> 0
    this.tweens.add({
      targets: target,
      scale: 1.4,
      duration: 100,
      yoyo: false,
      onComplete: () => {
        if (target.active) target.destroy();
      },
    });
  }

  onMiss() {
    if (this.combo > 1) {
      this.combo = 1;
      this.refreshHud();
      this.sound.play('miss', { volume: 0.25 });
    }
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.scene.launch('Pause');
      this.scene.pause();
    } else {
      this.scene.stop('Pause');
      this.scene.resume();
    }
  }

  endGame() {
    this.gameOver = true;
    this.sound.play('gameover', { volume: 0.6 });
    this.cameras.main.flash(300, 0, 0, 0);
    this.scene.start('GameOver', {
      score: this.score,
      difficulty: this.difficultyKey,
    });
  }
}

// ---------- escena: Pause ----------
class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6);
    this.add.text(W / 2, H / 2 - 30, 'PAUSED', {
      fontSize: '48px', fontStyle: 'bold', color: '#f4e4c1',
    }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 + 20, 'Press P or click [||] to resume', {
      fontSize: '20px', color: '#c9b48a',
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown-P', () => this.resume());
  }

  resume() {
    this.scene.stop();
    this.game.scene.keys.Game.togglePause();
  }
}

// ---------- escena: GameOver ----------
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this.finalScore = data.score;
    this.difficulty = data.difficulty;
  }

  create() {
    const ranking = loadRanking();
    const qualifies = ranking.length < 10 || this.finalScore > ranking[ranking.length - 1].score;

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75);
    this.add.text(W / 2, 130, 'TIME!', {
      fontSize: '48px', fontStyle: 'bold', color: '#f4e4c1',
    }).setOrigin(0.5);
    this.add.text(W / 2, 200, `Score: ${this.finalScore}`, {
      fontSize: '32px', color: '#e9b872',
    }).setOrigin(0.5);

    if (qualifies) {
      this.add.text(W / 2, 250, 'New high score!', {
        fontSize: '20px', color: '#9bbf6c',
      }).setOrigin(0.5);

      const html = `
        <input id="playerName" maxlength="12" placeholder="Player"
               style="font-size:18px;padding:6px 10px;width:180px;text-align:center;
                      border-radius:4px;border:1px solid #c9b48a;background:#1a1410;color:#f4e4c1" />
      `;
      const el = this.add.dom(W / 2, 310).createFromHTML(html);
      const save = this.add.text(W / 2, 370, 'Save Score', {
        fontSize: '22px', color: '#1a1410', backgroundColor: '#9bbf6c', padding: { x: 22, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      save.on('pointerdown', () => {
        const input = document.getElementById('playerName');
        const name = (input.value || 'Player').trim().slice(0, 12) || 'Player';
        const idx = pushRanking({
          name,
          score: this.finalScore,
          difficulty: this.difficulty,
          date: new Date().toISOString(),
        });
        el.destroy();
        save.destroy();
        this.showActions(idx + 1);
      });
    } else {
      this.showActions(null);
    }
  }

  showActions(rank) {
    if (rank) {
      this.add.text(W / 2, 320, `Rank #${rank}`, {
        fontSize: '20px', color: '#c9b48a',
      }).setOrigin(0.5);
    }

    const playAgain = this.add.text(W / 2, 400, 'Play Again', {
      fontSize: '26px', color: '#1a1410', backgroundColor: '#e9b872', padding: { x: 22, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    playAgain.on('pointerdown', () => this.scene.start('Game', { difficulty: this.difficulty }));

    const menu = this.add.text(W / 2, 460, 'Main Menu', {
      fontSize: '22px', color: '#f4e4c1', backgroundColor: '#2a2018', padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    menu.on('pointerdown', () => this.scene.start('Menu'));
  }
}

// ---------- bootstrap: registrar texturas y audio en una escena temporal ----------
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    this.load.image('background', 'assets/images/background.png');
    this.load.audio('hit',      'assets/audio/hit.ogg');
    this.load.audio('miss',     'assets/audio/miss.ogg');
    this.load.audio('gameover', 'assets/audio/gameover.ogg');
  }
  create() {
    // texturas procedurales (necesitan scene.add.graphics -> ya existe)
    makeTargetTexture(this, 'target',     0xe9b872);
    makeTargetTexture(this, 'target-hot', 0xff8c42);
    this.scene.start('Menu');
  }
}

// ---------- configuracion ----------
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#1a1410',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, PauseScene, GameOverScene],
};

new Phaser.Game(config);
