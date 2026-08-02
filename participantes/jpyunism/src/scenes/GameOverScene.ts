import Phaser from "phaser";
import { MetaProgress } from "../store/MetaProgress";
import { scaleFactor, scaledFont } from "../core/layout";
import { MobileBootstrap } from "../systems/MobileBootstrap";
import { RotateOverlay } from "../systems/RotateOverlay";

interface GameOverData {
  runCoins?: number;
  waveReached?: number;
  levelReached?: number;
}

interface ShopLineRefs {
  damage: Phaser.GameObjects.Text;
  speed: Phaser.GameObjects.Text;
  shield: Phaser.GameObjects.Text;
  regen: Phaser.GameObjects.Text;
  cadence: Phaser.GameObjects.Text;
}

type UpgradeKey = keyof ReturnType<typeof MetaProgress.load>["upgrades"];
const UPGRADE_KEYS: UpgradeKey[] = [
  "damage",
  "speed",
  "shield",
  "regen",
  "cadence",
];

export class GameOverScene extends Phaser.Scene {
  private runCoins: number = 0;
  private waveReached: number = 0;
  private levelReached: number = 0;

  private shopPanel: Phaser.GameObjects.Container | null = null;
  private shopLines: ShopLineRefs | null = null;
  private shopStatus: Phaser.GameObjects.Text | null = null;
  private coinsLabel: Phaser.GameObjects.Text | null = null;
  private isShopOpen: boolean = false;
  private shopHandlers: Array<{ event: string; fn: () => void }> = [];

  /** Track keyboard handlers for cleanup in shutdown(). */
  private keydownRHandler!: (event: KeyboardEvent) => void;
  private keydownMHandler!: (event: KeyboardEvent) => void;
  private keydownSHandler!: (event: KeyboardEvent) => void;

  /** Mobile bootstrap (fullscreen latch, orientation lock). */
  private mobileBootstrap: MobileBootstrap | null = null;
  /** Rotate overlay for portrait orientation. */
  private rotateOverlay: RotateOverlay | null = null;

  /** Resize handler reference for cleanup. */
  private resizeHandler: ((gameSize: Phaser.Structs.Size) => void) | null = null;

  constructor() {
    super("GameOverScene");
  }

  init(data: GameOverData): void {
    this.runCoins = data.runCoins ?? 0;
    this.waveReached = data.waveReached ?? 0;
    this.levelReached = data.levelReached ?? 0;
  }

  create(): void {
    const { width, height } = this.scale;

    // Keep the battle music playing in the background — it fades back to the
    // menu theme when the player returns to the menu (see MenuScene).

    this.buildLayout(width, height);
    this.bindInput();

    // Mobile bootstrap + rotate overlay
    this.mobileBootstrap = new MobileBootstrap(this);
    this.rotateOverlay = new RotateOverlay(this);

    // Subscribe to resize events
    this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
      this.buildLayout(gameSize.width, gameSize.height);
    };
    this.scale.on("resize", this.resizeHandler);
  }

  private buildLayout(width: number, height: number): void {
    const s = scaleFactor(width);

    // Clear existing elements
    this.children.removeAll(true);
    this.coinsLabel = null;

    // Title
    const title = this.add
      .text(width / 2, Math.round(100 * s), "GAME OVER", {
        fontFamily: "monospace",
        fontSize: scaledFont(56, s),
        color: "#ff00ff",
      })
      .setOrigin(0.5);
    title.setShadow(0, 0, "#ff00ff", Math.round(18 * s), true, true);

    // Run summary
    this.add
      .text(width / 2, Math.round(200 * s), `Wave reached: ${this.waveReached}`, {
        fontFamily: "monospace",
        fontSize: scaledFont(20, s),
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, Math.round(232 * s), `Level reached: ${this.levelReached}`, {
        fontFamily: "monospace",
        fontSize: scaledFont(20, s),
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, Math.round(264 * s), `Coins this run: ${this.runCoins}`, {
        fontFamily: "monospace",
        fontSize: scaledFont(20, s),
        color: "#ffd700",
      })
      .setOrigin(0.5);

    // Total coins (persisted meta)
    this.coinsLabel = this.add
      .text(
        width / 2,
        Math.round(296 * s),
        `Total coins: ${MetaProgress.load().coins}`,
        {
          fontFamily: "monospace",
          fontSize: scaledFont(18, s),
          color: "#ffd700",
        },
      )
      .setOrigin(0.5);

    // Instructions
    const hintStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "monospace",
      fontSize: scaledFont(16, s),
      color: "#00ffff",
      align: "center",
    };

    this.add
      .text(width / 2, Math.round(360 * s), "[R] Restart", hintStyle)
      .setOrigin(0.5);
    this.add
      .text(width / 2, Math.round(388 * s), "[M] Menu", hintStyle)
      .setOrigin(0.5);
    this.add
      .text(width / 2, Math.round(416 * s), "[S] Shop", hintStyle)
      .setOrigin(0.5);

    // Bottom hint
    this.add
      .text(
        width / 2,
        height - Math.round(40 * s),
        "Tip: spend coins in the shop to make future runs easier.",
        {
          fontFamily: "monospace",
          fontSize: scaledFont(12, s),
          color: "#888888",
          align: "center",
        },
      )
      .setOrigin(0.5);
  }

  private bindInput(): void {
    this.keydownRHandler = (): void => {
      this.scene.start("GameScene");
    };
    this.input.keyboard?.on("keydown-R", this.keydownRHandler);

    this.keydownMHandler = (): void => {
      this.scene.start("MenuScene");
    };
    this.input.keyboard?.on("keydown-M", this.keydownMHandler);

    // Shop toggle
    this.keydownSHandler = (): void => {
      this.toggleShop();
    };
    this.input.keyboard?.on("keydown-S", this.keydownSHandler);
  }

  shutdown(): void {
    this.input.keyboard?.off("keydown-R", this.keydownRHandler);
    this.input.keyboard?.off("keydown-M", this.keydownMHandler);
    this.input.keyboard?.off("keydown-S", this.keydownSHandler);
    this.closeShop();
    this.mobileBootstrap?.destroy();
    this.rotateOverlay?.destroy();
    if (this.resizeHandler) {
      this.scale.off("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
  }

  private toggleShop(): void {
    if (this.isShopOpen) {
      this.closeShop();
    } else {
      this.openShop();
    }
  }

  private openShop(): void {
    if (this.isShopOpen) {
      return;
    }
    this.isShopOpen = true;

    const { width, height } = this.scale;
    const s = scaleFactor(width);

    const panel = this.add.container(width / 2, height / 2 + Math.round(20 * s));
    const bg = this.add.rectangle(0, 0, Math.round(520 * s), Math.round(360 * s), 0x10102a, 0.92);
    bg.setStrokeStyle(2, 0x00ffff, 1);
    panel.add(bg);

    const header = this.add
      .text(0, Math.round(-150 * s), "SHOP — spend coins on permanent upgrades", {
        fontFamily: "monospace",
        fontSize: scaledFont(16, s),
        color: "#00ffff",
        align: "center",
      })
      .setOrigin(0.5);
    panel.add(header);

    const data = MetaProgress.load();
    const lineStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "monospace",
      fontSize: scaledFont(14, s),
      color: "#ffffff",
      align: "center",
    };

    const labels: UpgradeKey[] = ["damage", "speed", "shield", "regen", "cadence"];
    const yStart = Math.round(-110 * s);
    const yStep = Math.round(38 * s);
    const lines: Partial<ShopLineRefs> = {};

    for (let i = 0; i < labels.length; i++) {
      const key = labels[i];
      const lvl = data.upgrades[key];
      const max = MetaProgress.getMaxLevel(key);
      const cost = MetaProgress.getUpgradeCost(key, lvl);
      const effect = MetaProgress.getUpgradeEffect(key, lvl);
      const hotkey = i + 1;

      let line: string;
      if (lvl >= max) {
        line = `[${hotkey}] ${capitalize(key)} Lv MAX/${max} — ${effect}`;
      } else {
        line = `[${hotkey}] ${capitalize(key)} Lv ${lvl}/${max} — ${effect} — Cost: ${cost}`;
      }

      const txt = this.add.text(0, yStart + i * yStep, line, lineStyle);
      txt.setOrigin(0.5);
      panel.add(txt);
      lines[key] = txt;
    }

    const status = this.add
      .text(0, Math.round(110 * s), "Press 1-5 to buy — ESC to close", {
        fontFamily: "monospace",
        fontSize: scaledFont(12, s),
        color: "#888888",
      })
      .setOrigin(0.5);
    panel.add(status);

    this.shopPanel = panel;
    this.shopLines = lines as ShopLineRefs;
    this.shopStatus = status;

    // Bind purchase hotkeys 1-5
    for (let i = 0; i < UPGRADE_KEYS.length; i++) {
      const key = UPGRADE_KEYS[i];
      const hotkeyDigit = i + 1;
      const hotkeyCode = `keydown-${hotkeyDigit}`;
      const fn = (): void => {
        this.tryPurchase(key);
      };
      this.input.keyboard?.on(hotkeyCode, fn);
      this.shopHandlers.push({ event: hotkeyCode, fn });
    }

    // ESC closes the shop
    const escFn = (): void => {
      if (this.isShopOpen) {
        this.closeShop();
      }
    };
    this.input.keyboard?.on("keydown-ESC", escFn);
    this.shopHandlers.push({ event: "keydown-ESC", fn: escFn });
  }

  private tryPurchase(key: UpgradeKey): void {
    if (!this.isShopOpen) {
      return;
    }
    const before = MetaProgress.load();
    const lvl = before.upgrades[key];
    const max = MetaProgress.getMaxLevel(key);
    if (lvl >= max) {
      this.flashStatus(`${capitalize(key)} already MAXED`, "#888888");
      return;
    }
    const cost = MetaProgress.getUpgradeCost(key, lvl);
    if (before.coins < cost) {
      this.flashStatus("Not enough coins", "#ff4444");
      return;
    }
    const ok = MetaProgress.purchaseUpgrade(key);
    if (!ok) {
      this.flashStatus("Purchase failed", "#ff4444");
      return;
    }
    this.flashStatus(`Bought ${capitalize(key)} Lv ${lvl + 1}!`, "#00ff00");
    this.refreshShop();
  }

  private refreshShop(): void {
    if (!this.shopLines) {
      return;
    }
    const data = MetaProgress.load();
    const labels: UpgradeKey[] = ["damage", "speed", "shield", "regen", "cadence"];
    for (let i = 0; i < labels.length; i++) {
      const key = labels[i];
      const lvl = data.upgrades[key];
      const max = MetaProgress.getMaxLevel(key);
      const cost = MetaProgress.getUpgradeCost(key, lvl);
      const effect = MetaProgress.getUpgradeEffect(key, lvl);
      const hotkey = i + 1;

      let line: string;
      if (lvl >= max) {
        line = `[${hotkey}] ${capitalize(key)} Lv MAX/${max} — ${effect}`;
      } else {
        line = `[${hotkey}] ${capitalize(key)} Lv ${lvl}/${max} — ${effect} — Cost: ${cost}`;
      }

      const txt = this.shopLines[key];
      txt.setText(line);
      txt.setColor(canAfford(data.coins, cost, lvl, max) ? "#ffffff" : "#666666");
    }

    if (this.coinsLabel) {
      this.coinsLabel.setText(`Total coins: ${data.coins}`);
    }
  }

  private closeShop(): void {
    if (!this.isShopOpen) {
      return;
    }
    this.isShopOpen = false;

    if (this.shopPanel) {
      this.shopPanel.destroy(true);
      this.shopPanel = null;
    }
    this.shopLines = null;
    this.shopStatus = null;

    // Unbind every shop-scoped keyboard listener we registered.
    for (const { event, fn } of this.shopHandlers) {
      this.input.keyboard?.off(event, fn);
    }
    this.shopHandlers = [];

    // Refresh total coins in the main view (in case purchases happened)
    if (this.coinsLabel) {
      this.coinsLabel.setText(`Total coins: ${MetaProgress.load().coins}`);
    }
  }

  private flashStatus(msg: string, color: string): void {
    if (!this.shopStatus) {
      return;
    }
    this.shopStatus.setText(msg);
    this.shopStatus.setColor(color);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function canAfford(
  coins: number,
  cost: number,
  level: number,
  max: number,
): boolean {
  if (level >= max) {
    return false;
  }
  return coins >= cost;
}
