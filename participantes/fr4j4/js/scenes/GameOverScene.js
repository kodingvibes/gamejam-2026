// GameOverScene — Resultados con identidad CRT/arcade

class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }
  init(data) { this.result = data; }

  create() {
    const W = 640, H = 360;
    this.W = W; this.H = H;
    this.cameras.main.setBackgroundColor('#0d0d1a');

    this.bgLayer = this.add.layer().setDepth(0);
    this.uiLayer = this.add.layer().setDepth(10);
    this.modalLayer = this.add.layer().setDepth(20);

    const win = this.result.win;
    const color = win ? '#bdcd9c' : '#ff6b6b';
    const isCampaign = this.result.mode === 'campaign';
    let title = win ? 'VICTORIA' : 'DERROTA';
    if (isCampaign && win && this.result.campaignLast) title = '¡CAMPAÑA COMPLETA!';
    if (isCampaign && !win) title = 'FIN DE CAMPAÑA';

    VFX.stars(this, this.bgLayer, 30);
    VFX.header(this, this.uiLayer, 'RESULTADO', color, { width: W, height: 34, showFullscreen: true, fullscreenCallback: () => this.toggleFullscreen() });
    this.input.on('pointerdown', (pointer) => this.handleFullscreenTap(pointer));

    const pCls = CLASSES.find(c => c.id === this.result.classId) || CLASSES[0];
    VFX.classSeal(this, this.uiLayer, W / 2, 58, 28, pCls.icon, pCls.colorHex, true);

    VFX.lcdPanel(this, this.uiLayer, W / 2, H / 2 + 16, 320, 150);

    const titleTxt = UI.text(this, W / 2, H / 2 - 20, title, {
      fontFamily: '"Press Start 2P"', fontSize: '20px', color: color,
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);
    this.uiLayer.add(titleTxt);

    const stats = [
      `Turnos: ${this.result.turn}`,
      `Daño recibido: ${this.result.damageTaken}`,
      `Cartas jugadas: ${this.result.cardsPlayed}`,
      `Vida restante: ${this.result.hpLeft}`
    ];
    if (isCampaign && win) {
      stats[3] = `Vida restante: ${this.result.hpLeft} (+${Math.max(0, this.result.campaignHp - this.result.hpLeft)} cura)`;
    }
    stats.forEach((s, i) => {
      const t = UI.text(this, W / 2, H / 2 + 14 + i * 18, s, {
        fontFamily: '"VT323"', fontSize: '16px', color: '#8892a0'
      }).setOrigin(0.5);
      this.uiLayer.add(t);
    });

    if (isCampaign) {
      const stageInfo = UI.text(this, W / 2, H / 2 - 46,
        `ETAPA ${(this.result.campaignStage || 0) + 1}/${this.result.campaignTotal} — ${this.result.campaignName || ''}`,
        { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#faba72' }).setOrigin(0.5);
      this.uiLayer.add(stageInfo);

      // Botón principal: Siguiente etapa (si ganó y no es la última), o Reiniciar campaña
      let primaryLabel, primaryColor = '#9fcafd', primaryFn = null;
      if (win && !this.result.campaignLast) {
        primaryLabel = 'SIGUIENTE ETAPA';
        primaryFn = () => this.scene.start('GameScene', {
          mode: 'campaign',
          classId: this.result.classId,
          slotIndex: this.result.slotIndex || 0,
          campaignStage: this.result.campaignNextStage,
          campaignHp: this.result.campaignHp
        });
      } else if (win && this.result.campaignLast) {
        primaryLabel = 'JUGAR DE NUEVO';
        primaryColor = '#bdcd9c';
        primaryFn = () => this.scene.start('DeckPickerScene', { mode: 'campaign' });
      } else {
        primaryLabel = 'REINTENTAR CAMPAÑA';
        primaryColor = '#ff6b6b';
        primaryFn = () => this.scene.start('DeckPickerScene', { mode: 'campaign' });
      }

      const primaryBtn = UI.button(this, W / 2, H - 18, primaryLabel, primaryColor,
        primaryFn, { layer: this.uiLayer, minWidth: 200, height: 26, fontSize: '8px' });
      this.uiLayer.add(primaryBtn.container);
    } else {
      const menuBtn = UI.button(this, W / 2, H - 52, 'MENU PRINCIPAL', '#faba72',
        () => this.scene.start('MenuScene'), { layer: this.uiLayer, minWidth: 240, height: 30, fontSize: '9px' });
      this.uiLayer.add(menuBtn.container);

      if (this.result.mode !== 'test') {
        const rematchBtn = UI.button(this, W / 2, H - 18, 'REVANCHA', '#9fcafd',
          () => this.scene.start('DeckPickerScene', { mode: this.result.mode }), { layer: this.uiLayer, minWidth: 160, height: 26, fontSize: '8px' });
        this.uiLayer.add(rematchBtn.container);
      }
    }

    CRT.addScanlines(this);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      try { document.documentElement.requestFullscreen(); } catch (e) {}
    } else {
      try { document.exitFullscreen(); } catch (e) {}
    }
  }

  handleFullscreenTap(pointer) {
    if (pointer.x > this.W - 40 && pointer.y < 34) {
      this.toggleFullscreen();
    }
  }
}

window.GameOverScene = GameOverScene;
