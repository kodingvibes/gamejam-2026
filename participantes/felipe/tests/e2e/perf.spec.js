import { test, expect } from "@playwright/test";

test("game loads and boots within a reasonable budget", async ({ page }) => {
  const start = Date.now();
  await page.goto("/?debug=1");
  await page.waitForFunction(
    () => {
      const g = window.__GAME__;
      return g && g.isBooted && g.canvas;
    },
    null,
    { timeout: 10000 },
  );
  const elapsedMs = Date.now() - start;
  // Generous budget for a dev-server (unminified) load — this is a gamejam
  // prototype, not a production build; the point is catching a regression
  // that makes boot take, say, 10x longer, not chasing a tight number.
  expect(elapsedMs).toBeLessThan(6000);
});

test("canvas renders at the configured resolution", async ({ page }) => {
  await page.goto("/?debug=1");
  await page.waitForFunction(() => window.__GAME__?.isBooted, null, { timeout: 10000 });

  const canvasSize = await page.evaluate(() => {
    const canvas = window.__GAME__.canvas;
    return { width: canvas.width, height: canvas.height };
  });
  expect(canvasSize.width).toBeGreaterThan(0);
  expect(canvasSize.height).toBeGreaterThan(0);
});
