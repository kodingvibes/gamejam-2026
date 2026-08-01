import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  gamePage: async ({ page }, use) => {
    await page.goto("/?debug=1");
    await page.waitForFunction(
      () => {
        const g = window.__GAME__;
        return g && g.isBooted && g.canvas;
      },
      null,
      { timeout: 10000 },
    );
    await use(page);
  },
});

export { expect };
