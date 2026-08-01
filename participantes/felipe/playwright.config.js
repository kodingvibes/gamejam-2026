import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Serial, not parallel: each test boots a full Phaser + WebGL + WebAudio
  // instance and some run for real time up to 200s. Running 8 of these
  // concurrently starved the machine and produced spurious context-teardown
  // timeouts unrelated to the game itself.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 200,
      threshold: 0.3,
    },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
