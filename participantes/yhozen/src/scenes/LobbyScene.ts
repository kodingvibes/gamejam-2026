import Phaser from 'phaser';

interface LobbyData {
  notice?: string;
}

function generatedRoom(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export class LobbyScene extends Phaser.Scene {
  private room = '';
  private playerName = '';

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(data: LobbyData = {}): void {
    const params = new URLSearchParams(location.search);
    this.room = (params.get('room') || generatedRoom()).toUpperCase();
    this.playerName = params.get('name') || params.get('player') || `Rider-${Math.floor(Math.random() * 900 + 100)}`;
    params.set('room', this.room);
    params.set('name', this.playerName);
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);

    const width = this.scale.width;
    const height = this.scale.height;
    if (this.textures.exists('lobby-key-art')) {
      const art = this.add.image(width / 2, height / 2, 'lobby-key-art');
      art.setDisplaySize(width, height).setAlpha(0.48);
    }
    this.add.rectangle(width / 2, height / 2, width, height, 0x03060c, 0.62);

    this.add.text(width / 2, height * 0.24, 'SKATEFIRE', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(42, Math.min(92, width * 0.09))}px`,
      fontStyle: 'bold',
      color: '#effff8',
      stroke: '#071519',
      strokeThickness: 8,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.38, 'FIRST-PERSON SKATEBOARD COMBAT', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#83ffc3',
      letterSpacing: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.49, `ROOM ${this.room}  ·  ${this.playerName}`, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#9adfff',
      backgroundColor: '#07101acc',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5);

    const start = this.add.text(width / 2, height * 0.64, 'CLICK TO DROP IN', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#03100c',
      backgroundColor: '#83ffc3',
      padding: { x: 28, y: 16 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    start.on('pointerover', () => start.setScale(1.04));
    start.on('pointerout', () => start.setScale(1));
    start.on('pointerdown', () => this.launchArena());

    this.add.text(width / 2, height * 0.77,
      'W PUSH  ·  S BRAKE  ·  A/D STEER  ·  SPACE OLLIE\nMOUSE AIM  ·  CLICK FIRE  ·  C RECENTER  ·  F3 TUNE', {
        align: 'center',
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#c8dbe0',
        lineSpacing: 9,
      }).setOrigin(0.5);

    if (data.notice) {
      this.add.text(width / 2, height * 0.88, data.notice, {
        align: 'center',
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#fff06a',
        backgroundColor: '#07101acc',
        padding: { x: 12, y: 8 },
      }).setOrigin(0.5);
    }

    if (params.get('testMode') === '1') this.time.delayedCall(100, () => this.launchArena());
  }

  private launchArena(): void {
    this.scene.start('ArenaScene', { room: this.room, name: this.playerName });
  }
}
