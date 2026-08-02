import Phaser from "phaser";
import { PowerUpOption } from "../systems/LevelUpManager";
import { scaleFactor, scaledFont } from "../core/layout";

/**
 * Modal power-up selection panel. Pauses the scene (caller's responsibility),
 * shows three stacked cards, listens for 1/2/3, and resolves a promise with
 * the chosen option (or null if the player dismissed without picking).
 *
 * Visual style: cyberpunk neon — dark panel, cyan accents, magenta borders,
 * monospace label typography. Each card highlights the selected one (the
 * card the player is currently pointing at with 1/2/3) with a brighter
 * border and brighter text.
 */
export class PowerUpSelect {
  /**
   * Shows the panel. The caller must have already called `scene.scene.pause()`;
   * we'll resume nothing — the caller is also responsible for resuming the
   * scene after the promise resolves.
   */
  public static show(
    scene: Phaser.Scene,
    choices: PowerUpOption[],
    level: number,
  ): Promise<PowerUpOption | null> {
    return new Promise((resolve) => {
      const { width, height } = scene.scale;
      const s = scaleFactor(width);
      const container = scene.add.container(0, 0);
      container.setDepth(2000);
      container.setScrollFactor(0);

      // Backdrop.
      const overlay = scene.add.rectangle(
        width / 2,
        height / 2,
        width,
        height,
        0x000000,
        0.7,
      );
      overlay.setScrollFactor(0);

      // Title.
      const title = scene.add.text(
        width / 2,
        height / 2 - Math.round(200 * s),
        `LEVEL ${level} — Pick a power-up`,
        {
          fontFamily: "monospace",
          fontSize: scaledFont(26, s),
          color: "#00ffff",
          stroke: "#003344",
          strokeThickness: 3,
        },
      );
      title.setOrigin(0.5);
      title.setScrollFactor(0);

      // Hint.
      const hint = scene.add.text(
        width / 2,
        height / 2 - Math.round(165 * s),
        "Press 1, 2 or 3 to choose",
        {
          fontFamily: "monospace",
          fontSize: scaledFont(12, s),
          color: "#888888",
        },
      );
      hint.setOrigin(0.5);
      hint.setScrollFactor(0);

      // Card geometry.
      const cardW = Math.round(420 * s);
      const cardH = Math.round(90 * s);
      const cardGap = Math.round(18 * s);
      const totalH = choices.length * cardH + (choices.length - 1) * cardGap;
      const top = height / 2 - totalH / 2 + Math.round(20 * s);
      const left = width / 2 - cardW / 2;

      const palette = [0x00ffff, 0xff00ff, 0xffd700];
      const slots: {
        bg: Phaser.GameObjects.Graphics;
        border: Phaser.GameObjects.Graphics;
        keyLabel: Phaser.GameObjects.Text;
        nameLabel: Phaser.GameObjects.Text;
        descLabel: Phaser.GameObjects.Text;
      }[] = [];

      choices.forEach((choice, i) => {
        const y = top + i * (cardH + cardGap);
        const accent = palette[i % palette.length] ?? 0x00ffff;

        const bg = scene.add.graphics();
        bg.fillStyle(0x0a0a1a, 0.92);
        bg.fillRect(left, y, cardW, cardH);
        bg.setScrollFactor(0);

        const border = scene.add.graphics();
        border.lineStyle(2, accent, 1);
        border.strokeRect(left, y, cardW, cardH);
        border.setScrollFactor(0);

        const keyLabel = scene.add.text(left + Math.round(16 * s), y + cardH / 2, `[${i + 1}]`, {
          fontFamily: "monospace",
          fontSize: scaledFont(22, s),
          color: "#" + accent.toString(16).padStart(6, "0"),
        });
        keyLabel.setOrigin(0, 0.5);
        keyLabel.setScrollFactor(0);

        const nameLabel = scene.add.text(
          left + Math.round(80 * s),
          y + Math.round(28 * s),
          choice.name,
          {
            fontFamily: "monospace",
            fontSize: scaledFont(18, s),
            color: "#ffffff",
          },
        );
        nameLabel.setOrigin(0, 0.5);
        nameLabel.setScrollFactor(0);

        const descLabel = scene.add.text(
          left + Math.round(80 * s),
          y + Math.round(58 * s),
          choice.description,
          {
            fontFamily: "monospace",
            fontSize: scaledFont(12, s),
            color: "#aaaaaa",
          },
        );
        descLabel.setOrigin(0, 0.5);
        descLabel.setScrollFactor(0);

        slots.push({ bg, border, keyLabel, nameLabel, descLabel });
      });

      container.add([overlay, title, hint, ...slots.flatMap((s) => [s.bg, s.border, s.keyLabel, s.nameLabel, s.descLabel])]);

      let highlighted: number | null = null;
      const highlight = (idx: number | null) => {
        if (highlighted === idx) {
          return;
        }
        // Restore previous.
        if (highlighted !== null) {
          const prev = slots[highlighted];
          if (prev) {
            const accent =
              palette[highlighted % palette.length] ?? 0x00ffff;
            prev.border.clear();
            prev.border.lineStyle(2, accent, 1);
            prev.border.strokeRect(left, top + highlighted * (cardH + cardGap), cardW, cardH);
            prev.bg.clear();
            prev.bg.fillStyle(0x0a0a1a, 0.92);
            prev.bg.fillRect(
              left,
              top + highlighted * (cardH + cardGap),
              cardW,
              cardH,
            );
            prev.nameLabel.setColor("#ffffff");
            prev.descLabel.setColor("#aaaaaa");
          }
        }
        highlighted = idx;
        if (idx === null) {
          return;
        }
        const curr = slots[idx];
        if (!curr) {
          return;
        }
        const y = top + idx * (cardH + cardGap);
        curr.border.clear();
        curr.border.lineStyle(3, 0xffffff, 1);
        curr.border.strokeRect(left, y, cardW, cardH);
        // Glow backing using a slightly oversized fill.
        curr.bg.clear();
        curr.bg.fillStyle(0x112233, 0.95);
        curr.bg.fillRect(left, y, cardW, cardH);
        curr.nameLabel.setColor("#00ffff");
        curr.descLabel.setColor("#cccccc");
      };

      const pick = (idx: number) => {
        const choice = choices[idx];
        cleanup();
        resolve(choice ?? null);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "1") {
          highlight(0);
          pick(0);
        } else if (event.key === "2") {
          highlight(1);
          pick(1);
        } else if (event.key === "3") {
          highlight(2);
          pick(2);
        } else if (event.key === "Escape") {
          cleanup();
          resolve(null);
        }
      };

      // NOTE: The scene is paused while the panel is visible, which disables
      // Phaser's scene InputPlugin (scene.input.on(...) never fires). We
      // therefore listen on `window` and convert client coords to game coords
      // via the canvas bounding rect so both mouse clicks and touch taps work.
      const toGameCoords = (clientX: number, clientY: number) => {
        const canvas = scene.sys.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = scene.scale.gameSize.width / rect.width;
        const scaleY = scene.scale.gameSize.height / rect.height;
        return {
          x: (clientX - rect.left) * scaleX,
          y: (clientY - rect.top) * scaleY,
        };
      };

      const onPointerMove = (event: PointerEvent) => {
        const { x: px, y: py } = toGameCoords(event.clientX, event.clientY);
        let found: number | null = null;
        for (let i = 0; i < choices.length; i++) {
          const y = top + i * (cardH + cardGap);
          if (px >= left && px <= left + cardW && py >= y && py <= y + cardH) {
            found = i;
            break;
          }
        }
        highlight(found);
      };

      const onPointerDown = (event: PointerEvent) => {
        // Ignore events that don't originate from this game's canvas so the
        // panel doesn't react to clicks elsewhere on the page.
        if (event.target !== scene.sys.game.canvas) {
          return;
        }
        const { x: px, y: py } = toGameCoords(event.clientX, event.clientY);
        for (let i = 0; i < choices.length; i++) {
          const y = top + i * (cardH + cardGap);
          if (
            px >= left &&
            px <= left + cardW &&
            py >= y &&
            py <= y + cardH
          ) {
            pick(i);
            return;
          }
        }
        // Click outside the cards: treat as cancel.
        cleanup();
        resolve(null);
      };

      const cleanup = () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerdown", onPointerDown);
        if (container.active) {
          container.destroy();
        }
      };

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerdown", onPointerDown);
    });
  }
}
