// Headless playtest: boots Tapa'o under Chromium, drives it with real keyboard
// input, and screenshots it so a human (or an agent) can confirm it actually
// runs without opening a browser window.
//
// Requires a Vite dev server already running (npm run dev -- --port 5183)
// and Playwright installed somewhere on this machine — it does not install
// its own copy. Point PLAYWRIGHT_PATH at any local playwright/index.mjs,
// e.g. an existing DEAD-AIR checkout:
//   PLAYWRIGHT_PATH="C:/Users/Beetlejuice/Desktop/DEAD-AIR/tools/harness/node_modules/playwright/index.mjs" node tools/playtest.mjs

import { mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const playwrightPath =
  process.env.PLAYWRIGHT_PATH ??
  "C:/Users/Beetlejuice/Desktop/DEAD-AIR/tools/harness/node_modules/playwright/index.mjs";
const { chromium } = await import(pathToFileURL(playwrightPath).href);

const PORT = process.env.TAPAO_PORT ?? "5183";
const URL = `http://localhost:${PORT}/?debug=1`;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".playtest");
mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => pageErrors.push(String(err)));

const readPartida = async () => page.evaluate(() => {
  try {
    const escena = window.__tapao?.scene.getScene("Juego");
    if (!escena) return null;
    const p = escena.partida;
    return {
      terminada: p.terminada,
      resultado: p.resultado ?? null,
      tiempoSegundos: Math.round(p.tiempoSegundos * 10) / 10,
      caudal: Math.round(p.caudal * 100) / 100,
      puntaje: p.puntaje?.total ?? null,
      jugadorMetro: Math.round(p.jugador.metro * 10) / 10,
      frenteMetro: Math.round(p.frente.metro * 10) / 10,
    };
  } catch (e) { return { error: String(e) }; }
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/01-menu.png` });

await page.keyboard.press("Space"); // start TEMPORAL (default highlighted mode)
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/02-start.png` });

for (let i = 0; i < 6; i++) {
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(700);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.down("Space");
  await page.waitForTimeout(700);
  await page.keyboard.up("Space");
  await page.screenshot({ path: `${OUT}/03-tick-${i}.png` });
}

const finalState = await readPartida();
console.log("final state:", JSON.stringify(finalState));
console.log("console errors:", JSON.stringify(consoleErrors));
console.log("page errors:", JSON.stringify(pageErrors));
console.log(consoleErrors.length === 0 && pageErrors.length === 0 ? "PASS" : "FAIL");

await browser.close();
