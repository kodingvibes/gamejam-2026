// VFX — shared visual helpers for the CRT/arcade identity
// All helpers take `scene` as the first argument and add objects to `container`.

window.UI = {
  text(scene, x, y, content, style) {
    const t = scene.add.text(x, y, content, style || {});
    if (t.setResolution) t.setResolution(2);
    return t;
  },

  button(scene, x, y, label, colorHex, callback, options = {}) {
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const fontSize = options.fontSize || '8px';
    const minWidth = options.minWidth || 80;
    const padding = options.padding || 16;
    const height = options.height || 26;
    const targetLayer = options.layer || null;

    const container = scene.add.container(x, y);

    const textObj = UI.text(scene, 0, 0, label, {
      fontFamily: '"Press Start 2P"', fontSize, color: colorHex
    }).setOrigin(0.5);
    const textW = Math.max(textObj.width, textObj.getBounds().width);
    const bgW = Math.max(minWidth, textW + padding);

    const bg = scene.add.rectangle(0, 0, bgW, height, 0x16213e)
      .setStrokeStyle(2, color);
    const hi = scene.add.rectangle(0, -height / 2 + 1, bgW - 2, 1, 0x3a3a5e).setOrigin(0.5, 0);
    const lo = scene.add.rectangle(0, height / 2 - 1, bgW - 2, 1, 0x050510).setOrigin(0.5, 1);
    const led = scene.add.circle(-bgW / 2 + 10, 0, 3, color);
    if (Phaser.BlendModes && Phaser.BlendModes.ADD) led.setBlendMode(Phaser.BlendModes.ADD);

    container.add([bg, hi, lo, led, textObj]);
    container.setSize(bgW, height);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      bg.setFillStyle(0x1a2a4e);
      container.setScale(1.04);
    });
    container.on('pointerout', () => {
      bg.setFillStyle(0x16213e);
      container.setScale(1);
    });
    container.on('pointerdown', () => {
      if (callback) callback();
    });

    if (targetLayer) {
      targetLayer.add(container);
    }

    return { container, bg, text: textObj, width: bgW, height };
  },

  tooltip(scene, x, y, title, desc, options = {}) {
    const width = options.width || 200;
    const maxWidth = options.maxWidth || width;
    const colorHex = options.color || '#faba72';
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const fontSize = options.fontSize || '8px';
    const targetLayer = options.layer || null;
    const minHeight = options.minHeight || 56;
    const VIEW_W = 640;
    const VIEW_H = 360;

    const container = scene.add.container(x, y);

    const titleTxt = UI.text(scene, 0, 0, title, {
      fontFamily: '"Press Start 2P"', fontSize, color: colorHex
    }).setOrigin(0.5);

    const descTxt = UI.text(scene, 0, 0, desc, {
      fontFamily: '"VT323"', fontSize: '13px', color: '#e0e0e0',
      align: 'center', wordWrap: { width: maxWidth - 16 }
    }).setOrigin(0.5);
    const descH = Math.max(20, descTxt.height || 20);
    const panelH = Math.max(minHeight, descH + 34);
    const half = panelH / 2;
    const titleY = -Math.min(16, half - 14);
    const descY = Math.min(half - 14, 14);

    const bg = scene.add.rectangle(0, 0, width, panelH, 0x0a0a14, 0.95)
      .setStrokeStyle(2, color);
    const hi = scene.add.rectangle(0, -half + 1, width - 2, 1, 0x3a3a5e).setOrigin(0.5, 0);
    const lo = scene.add.rectangle(0, half - 1, width - 2, 1, 0x050510).setOrigin(0.5, 1);

    titleTxt.setY(titleY);
    descTxt.setY(descY);

    container.add([bg, hi, lo, titleTxt, descTxt]);

    // Clamp y flip: mantiene el panel dentro de la vista 640x360
    let cx = container.x;
    let cy = container.y;
    if (cx - width / 2 < 2) cx = width / 2 + 2;
    if (cx + width / 2 > VIEW_W - 2) cx = VIEW_W - width / 2 - 2;
    if (cy - half < 2) cy = half + 2;
    if (cy + half > VIEW_H - 2) cy = VIEW_H - half - 2;
    container.setPosition(cx, cy);

    if (targetLayer) {
      targetLayer.add(container);
    }

    return { container, bg, title: titleTxt, desc: descTxt, width, height: panelH };
  }
};

window.VFX = {
  _add(container, obj) {
    if (Array.isArray(obj)) { obj.forEach(o => this._add(container, o)); return; }
    if (container.add && typeof container.add === 'function') container.add(obj);
    else container.add.existing(obj);
  },

  lcdPanel(scene, container, x, y, w, h, label) {
    const g = scene.add.graphics();
    g.fillStyle(0x0a1828, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 2);
    g.lineStyle(1, 0x3a3a5e, 0.5);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 2);
    g.fillStyle(0x000000, 0.15);
    for (let i = 0; i < h; i += 2) g.fillRect(x - w / 2, y - h / 2 + i, w, 1);
    this._add(container, g);
    if (label) {
    const t = UI.text(scene, x, y - h / 2 + 5, label, {
      fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#555570'
    }).setOrigin(0.5, 0);
      this._add(container, t);
    }
    return g;
  },

  switchButton(scene, container, x, y, w, h, label, colorHex, callback) {
    const c = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const txt = UI.text(scene, x, y, label, {
      fontFamily: '"Press Start 2P"', fontSize: '7px',
      color: '#' + c.toString(16).padStart(6, '0')
    }).setOrigin(0.5);
    const textW = Math.max(txt.width, txt.getBounds().width);
    const finalW = Math.max(w, textW + 14);
    const bg = scene.add.rectangle(x, y, finalW, h, 0x16213e)
      .setStrokeStyle(2, c)
      .setInteractive({ useHandCursor: true });
    const hi = scene.add.rectangle(x, y - h / 2 + 1, finalW - 2, 1, 0x3a3a5e).setOrigin(0.5, 0);
    const lo = scene.add.rectangle(x, y + h / 2 - 1, finalW - 2, 1, 0x050510).setOrigin(0.5, 1);
    const led = scene.add.circle(x - finalW / 2 + 10, y, 3, c);
    if (Phaser.BlendModes && Phaser.BlendModes.ADD) led.setBlendMode(Phaser.BlendModes.ADD);
    bg.on('pointerover', () => bg.setFillStyle(0x1a2a4e));
    bg.on('pointerout', () => bg.setFillStyle(0x16213e));
    if (callback) bg.on('pointerdown', callback);
    this._add(container, [bg, hi, lo, led, txt]);
    return bg;
  },

  classSeal(scene, container, x, y, radius, iconStr, colorHex, active) {
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const g = scene.add.graphics();
    if (active) {
      g.fillStyle(color, 0.18); g.fillCircle(x, y, radius + 4);
      g.fillStyle(color, 0.28); g.fillCircle(x, y, radius + 2);
    }
    g.lineStyle(2, active ? color : 0x2a2a4a, 1);
    g.fillStyle(active ? color : 0x0a0a14, active ? 0.35 : 1);
    g.fillCircle(x, y, radius);
    g.strokeCircle(x, y, radius);
    g.lineStyle(1, active ? color : 0x3a3a5e, active ? 0.8 : 0.4);
    g.strokeCircle(x, y, radius - 3);
    const t = UI.text(scene, x, y, iconStr, { fontSize: Math.floor(radius * 0.85) + 'px' }).setOrigin(0.5);
    this._add(container, [g, t]);
    return g;
  },

  stars(scene, container, count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      const s = scene.add.rectangle(
        Phaser.Math.Between(0, 640), Phaser.Math.Between(0, 360),
        Phaser.Math.Between(1, 2), Phaser.Math.Between(1, 2),
        0x9fcafd, Phaser.Math.FloatBetween(0.1, 0.3)
      );
      this._add(container, s);
      stars.push({ obj: s, speed: Phaser.Math.FloatBetween(0.002, 0.008), phase: Math.random() * Math.PI * 2 });
    }
    return stars;
  },

  header(scene, container, title, accentColorHex, options = {}) {
    const W = options.width || 640;
    const H = options.height || 34;
    const bar = scene.add.graphics();
    bar.fillStyle(0x0a0a14, 1); bar.fillRect(0, 0, W, H);
    bar.lineStyle(1, 0x3a3a5e, 0.4); bar.lineBetween(0, H, W, H);
    this._add(container, bar);

    let titleStartX = 8;
    if (options.stepCount) {
      for (let i = 0; i < options.stepCount; i++) {
        const active = i + 1 === options.activeStep;
        const done = i + 1 < options.activeStep;
        const ledColor = active ? 0xfaba72 : (done ? 0xbdcd9c : 0x2a2a4a);
        const lx = 8 + i * 11;
        const led = scene.add.circle(lx, H / 2, 3.5, ledColor);
        if (active && Phaser.BlendModes && Phaser.BlendModes.ADD) led.setBlendMode(Phaser.BlendModes.ADD);
        this._add(container, led);
      }
      titleStartX = 8 + options.stepCount * 11 + 10;
    }

    const titleX = (titleStartX + (W - 30)) / 2;
    const titleW = W - 30 - titleStartX;
    const titleObj = UI.text(scene, titleX, H / 2, title, {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#8892a0',
      wordWrap: { width: titleW }, align: 'center'
    }).setOrigin(0.5, 0.5);
    this._add(container, titleObj);

    if (options.showFullscreen) {
      const fs = UI.text(scene, W - 8, H / 2, '⛶', {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#8892a0'
      }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
      fs.on('pointerover', () => fs.setColor('#faba72'));
      fs.on('pointerout', () => fs.setColor('#8892a0'));
      if (options.fullscreenCallback) fs.on('pointerdown', options.fullscreenCallback);
      this._add(container, fs);
    }
    return bar;
  },

  eqBar(scene, container, x, baseY, height, color, peak) {
    const g = scene.add.graphics();
    const w = 8;
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const segH = height / segs;
      const yy = baseY - (i + 1) * segH;
      const a = 1 - (i / segs) * 0.6;
      g.fillStyle(color, a);
      g.fillRect(x - w / 2, yy, w, segH);
    }
    if (peak !== undefined) {
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(x - w / 2, baseY - peak - 2, w, 1);
    }
    this._add(container, g);
    return g;
  },

  costHex(scene, container, x, y, size, value, colorHex) {
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const g = scene.add.graphics();
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      pts.push({ x: x + size * Math.cos(a), y: y + size * Math.sin(a) });
    }
    g.fillStyle(0x0a0a14, 1);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 6; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath(); g.fillPath();
    g.lineStyle(2, color, 1); g.strokePath();
    const t = UI.text(scene, x, y, `${value}`, {
      fontFamily: '"Press Start 2P"', fontSize: '8px',
      color: '#' + color.toString(16).padStart(6, '0')
    }).setOrigin(0.5);
    this._add(container, [g, t]);
    return g;
  },

  titleMarquee(scene, container, x, y, text, accentColorHex) {
    const color = Phaser.Display.Color.HexStringToColor(accentColorHex).color;
    const c = scene.add.container(x, y);
    const base = UI.text(scene, 0, 0, text, {
      fontFamily: '"Press Start 2P"', fontSize: '40px', color: '#ffffff'
    }).setOrigin(0.5);
    const glow = UI.text(scene, 0, 0, text, {
      fontFamily: '"Press Start 2P"', fontSize: '40px', color: accentColorHex
    }).setOrigin(0.5).setAlpha(0.35);
    if (Phaser.BlendModes && Phaser.BlendModes.ADD) glow.setBlendMode(Phaser.BlendModes.ADD);
    const shadow = UI.text(scene, 4, 4, text, {
      fontFamily: '"Press Start 2P"', fontSize: '40px', color: '#050510'
    }).setOrigin(0.5).setAlpha(0.7);
    c.add([shadow, glow, base]);
    scene.tweens.add({
      targets: glow, alpha: 0.6, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    this._add(container, c);
    return c;
  },

  gamejamEditionBadge(scene, container, x, y, accentColorHex) {
    const accent = accentColorHex || '#faba72';
    const c = scene.add.container(x, y);

    const underlineG = scene.add.graphics();
    underlineG.lineStyle(1, 0xfaba72, 0.35);
    underlineG.lineBetween(-78, 11, 78, 11);
    underlineG.lineStyle(1, 0xfaba72, 0.18);
    underlineG.lineBetween(-72, 13, 72, 13);
    c.add(underlineG);

    const shadow = UI.text(scene, 2, 2, 'GAMEJAM EDITION', {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#050510'
    }).setOrigin(0.5).setAlpha(0.7);
    c.add(shadow);

    const ghostCyan = UI.text(scene, -1.5, 0, 'GAMEJAM EDITION', {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#00e5ff'
    }).setOrigin(0.5).setAlpha(0.55);
    if (Phaser.BlendModes && Phaser.BlendModes.SCREEN) ghostCyan.setBlendMode(Phaser.BlendModes.SCREEN);

    const ghostMagenta = UI.text(scene, 1.5, 0, 'GAMEJAM EDITION', {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#ff4dd2'
    }).setOrigin(0.5).setAlpha(0.55);
    if (Phaser.BlendModes && Phaser.BlendModes.SCREEN) ghostMagenta.setBlendMode(Phaser.BlendModes.SCREEN);

    const glow = UI.text(scene, 0, 0, 'GAMEJAM EDITION', {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: accent
    }).setOrigin(0.5).setAlpha(0.45);
    if (Phaser.BlendModes && Phaser.BlendModes.ADD) glow.setBlendMode(Phaser.BlendModes.ADD);

    const base = UI.text(scene, 0, 0, 'GAMEJAM EDITION', {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#f5f5ff'
    }).setOrigin(0.5);

    const sheenRect = scene.add.rectangle(0, 0, 220, 18, 0xffffff, 0.07).setOrigin(0.5);

    c.add([sheenRect, ghostMagenta, ghostCyan, glow, base]);

    scene.tweens.add({
      targets: ghostCyan, x: -1.5, duration: 1, onComplete: () => {
        scene.tweens.add({
          targets: ghostCyan, x: { from: -3, to: 0 }, duration: 1200,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      }
    });
    scene.tweens.add({
      targets: ghostMagenta, duration: 1, onComplete: () => {
        scene.tweens.add({
          targets: ghostMagenta, x: { from: 3, to: 0 }, duration: 1200,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300
        });
      }
    });

    scene.tweens.add({
      targets: glow, alpha: { from: 0.25, to: 0.65 }, duration: 1400,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    scene.tweens.add({
      targets: sheenRect, x: { from: -90, to: 90 }, alpha: { from: 0.0, to: 0.12 },
      duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    scene.tweens.add({
      targets: c, scale: { from: 0.94, to: 1 }, alpha: { from: 0, to: 1 },
      duration: 700, delay: 500, ease: 'Back.easeOut'
    });

    c.blinkTimer = scene.time.addEvent({
      delay: 4200, loop: true,
      callback: () => {
        scene.tweens.add({
          targets: base, alpha: 0.2, duration: 80, yoyo: true, repeat: 3
        });
      }
    });

    this._add(container, c);
    return c;
  },

  glitchTitle(scene, container, x, y, text, accentColorHex) {
    const c = scene.add.container(x, y);
    const measure = UI.text(scene, 0, 0, text, {
      fontFamily: '"Press Start 2P"', fontSize: '40px'
    }).setOrigin(0.5);
    const charW = measure.width / text.length;
    measure.destroy();

    const chars = text.split('');
    const totalW = charW * chars.length;
    const startX = -totalW / 2 + charW / 2;
    const letters = [];
    const shadows = [];

    chars.forEach((ch, i) => {
      const lx = startX + i * charW;
      const shadow = UI.text(scene, lx + 3, 3, ch, {
        fontFamily: '"Press Start 2P"', fontSize: '40px', color: '#050510'
      }).setOrigin(0.5).setAlpha(0.6);
      const letter = UI.text(scene, lx, 0, ch, {
        fontFamily: '"Press Start 2P"', fontSize: '40px', color: '#ffffff'
      }).setOrigin(0.5);
      shadows.push(shadow);
      letters.push(letter);
      c.add([shadow, letter]);
    });

    c.letters = letters;
    c.shadows = shadows;

    const glyphs = ['$', '%', '#', '!', '?', '0', '1', '×', '¤', '¶'];
    const red = UI.text(scene, 0, 0, '', {
      fontFamily: '"Press Start 2P"', fontSize: '40px', color: '#ff6b6b'
    }).setOrigin(0.5).setAlpha(0);
    const cyan = UI.text(scene, 0, 0, '', {
      fontFamily: '"Press Start 2P"', fontSize: '40px', color: '#9fcafd'
    }).setOrigin(0.5).setAlpha(0);
    c.add([red, cyan]);

    function triggerGlitch() {
      const idx = Phaser.Math.Between(0, letters.length - 1);
      const target = letters[idx];
      const original = chars[idx];
      const glyph = glyphs[Phaser.Math.Between(0, glyphs.length - 1)];
      const baseX = startX + idx * charW;

      target.setText(glyph).setColor(accentColorHex).setX(baseX + Phaser.Math.Between(-2, 2));
      shadows[idx].setText(glyph);

      red.setText(glyph).setAlpha(0.7).setPosition(baseX - 4, 0);
      cyan.setText(glyph).setAlpha(0.7).setPosition(baseX + 4, 0);

      scene.time.delayedCall(90, () => {
        target.setX(baseX + Phaser.Math.Between(-2, 2));
        red.setX(baseX - 3);
        cyan.setX(baseX + 3);
      });
      scene.time.delayedCall(220, () => {
        target.setText(original).setColor('#ffffff').setX(baseX);
        shadows[idx].setText(original);
        red.setAlpha(0);
        cyan.setAlpha(0);
      });
    }
    c.triggerGlitch = triggerGlitch;

    const timer = scene.time.addEvent({
      delay: Phaser.Math.Between(3500, 6000),
      callback: () => {
        triggerGlitch();
        timer.delay = Phaser.Math.Between(3500, 6000);
      },
      loop: true
    });
    c.glitchTimer = timer;

    scene.tweens.add({
      targets: c, alpha: 0.92, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    this._add(container, c);
    return c;
  },

  terminalFooter(scene, container, x, y, text) {
    const full = text;
    const style = { fontFamily: '"VT323"', fontSize: '13px', color: '#9fcafd' };
    const measure = UI.text(scene, 0, 0, full, style);
    const finalW = measure.width;
    measure.destroy();
    const t = UI.text(scene, x - finalW, y, '', style).setOrigin(0, 1);
    const cursor = UI.text(scene, x - finalW, y, '▌', style).setOrigin(0, 1).setAlpha(0);
    this._add(container, [t, cursor]);

    let shown = '';
    const timer = scene.time.addEvent({
      delay: 45, loop: true,
      callback: () => {
        shown += full[shown.length] || '';
        t.setText(shown);
        cursor.setX(t.x + t.width);
        cursor.setAlpha(1);
        if (shown.length >= full.length) {
          timer.remove();
          let blinks = 0;
          const blinkTimer = scene.time.addEvent({
            delay: 260, loop: true,
            callback: () => {
              cursor.setAlpha(cursor.alpha === 1 ? 0 : 1);
              blinks++;
              if (blinks >= 8) {
                blinkTimer.remove();
                scene.tweens.add({ targets: cursor, alpha: 0, duration: 200 });
              }
            }
          });
          t.blinkTimer = blinkTimer;
        }
      }
    });
    t.timer = timer;
    t.cursor = cursor;
    return t;
  },

  ambientParticles(scene, container, count, colors) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const color = Phaser.Display.Color.HexStringToColor(
        colors[Phaser.Math.Between(0, colors.length - 1)]
      ).color;
      const s = scene.add.circle(
        Phaser.Math.Between(0, 640), Phaser.Math.Between(360, 720),
        Phaser.Math.Between(1, 3), color
      ).setAlpha(Phaser.Math.FloatBetween(0.15, 0.35));
      if (Phaser.BlendModes && Phaser.BlendModes.ADD) s.setBlendMode(Phaser.BlendModes.ADD);
      this._add(container, s);
      const dur = Phaser.Math.Between(4000, 8000);
      scene.tweens.add({
        targets: s, y: -20, duration: dur, repeat: -1,
        delay: Phaser.Math.Between(0, dur),
        onRepeat: () => {
          s.x = Phaser.Math.Between(0, 640);
          s.y = 380;
        }
      });
      particles.push(s);
    }
    return particles;
  },

  classSealWatermark(scene, container, x, y, radius, iconStr, colorHex) {
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    g.lineStyle(2, color, 0.12);
    g.strokeCircle(0, 0, radius);
    g.lineStyle(1, color, 0.08);
    g.strokeCircle(0, 0, radius - 4);
    const t = UI.text(scene, 0, 0, iconStr, {
      fontSize: Math.floor(radius * 0.8) + 'px', color: colorHex
    }).setOrigin(0.5).setAlpha(0.12);
    c.add([g, t]);
    scene.tweens.add({
      targets: c, angle: 360, duration: 20000 + Phaser.Math.Between(0, 10000),
      repeat: -1, ease: 'Linear'
    });
    this._add(container, c);
    return c;
  }
};
