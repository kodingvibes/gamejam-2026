import { test, expect } from "../fixtures/game-test.js";

// Only stable, non-animating scenes get screenshot regression — active
// gameplay has falling rain / a moving truck, which makes pixel-diff
// screenshots inherently flaky (see game-qa skill's "What NOT to Test").

test("menu screen looks right", async ({ gamePage }) => {
  await gamePage.waitForTimeout(300); // let the menu finish its first draw
  await expect(gamePage).toHaveScreenshot("menu.png");
});

// No pixel-diff test for the game-over (Final) screen: it has continuous
// tweens (arm-swing yoyo, rising-water animation in FinalScene.pintarPresidente)
// running the moment it draws, so a screenshot comparison is inherently flaky —
// confirmed by an actual failed diff while writing this baseline. Text-content
// correctness for that screen is covered in game.spec.js instead.
