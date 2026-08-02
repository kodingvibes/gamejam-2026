// Escribe `assets/reactor.svg` desde la MISMA geometria que dibuja el juego (`reactor.js`),
// y antes de escribirlo lo chequea. Una sola verdad y dos backends solo sirve si algo falla
// cuando se desincronizan.
//
//   node tools/reactor-svg.js
//
// Sin dependencias: node, `assert` y `fs`. Igual que `test.js` y `test-music.js`.
import assert from "node:assert";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toSVG, parts, coreParts, wingParts, wave, drawReactor, WING_ROT, CX, radioMax, BOX,
  DIM, RX, bass, kick } from "../reactor.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = toSVG();

// --- 1. los ids que se animan desde fuera tienen que estar --------------------------------
for (const id of ["reactor", "core", "wing-1", "wing-2", "wing-3", "wave-1", "wave-2", "wave-3"]) {
  assert.ok(svg.includes(`id="${id}"`), `falta id="${id}" en el svg`);
}
// y las ondas tienen que ser <path> de verdad, no una polilinea ni una imagen: se les
// reescribe la `d` desde JS para animar fase, amplitud y frecuencia.
for (let i = 1; i <= 3; i++) {
  assert.match(svg, new RegExp(`<path id="wave-${i}" d="M [0-9.]+ [0-9.]+ L`),
    `wave-${i} no es un <path> con su propia d`);
}

// --- 2. las tres alas son IDENTICAS salvo la rotacion --------------------------------------
// Se compara el cuerpo del grupo con los ids y las `d` de las ondas borrados: la geometria
// mecanica tiene que ser la misma linea por linea, y lo unico que puede diferir es la traza.
const cuerpo = (i) => {
  const m = svg.match(new RegExp(`<g id="wing-${i}" transform="rotate\\((-?[0-9.]+) ${CX} ${CX}\\)">\\n([\\s\\S]*?)\\n {4}</g>`));
  assert.ok(m, `no se encontro el grupo wing-${i}`);
  return { rot: Number(m[1]), body: m[2].replace(/id="wave-\d" d="[^"]*"/g, "id=wave d=onda") };
};
const alas = [1, 2, 3].map(cuerpo);
assert.deepEqual(alas.map((a) => a.rot), WING_ROT, "las alas no van a 0/120/240");
assert.equal(alas[0].body, alas[1].body, "el ala 2 no es el ala 1");
assert.equal(alas[0].body, alas[2].body, "el ala 3 no es el ala 1");
// y las tres ondas SI tienen que ser distintas: cada pantalla muestra lo suyo
const ondas = [1, 2, 3].map((i) => svg.match(new RegExp(`id="wave-${i}" d="([^"]*)"`))[1]);
assert.ok(new Set(ondas).size === 3, "las tres ondas salieron iguales");

// --- 3. el dibujo es simetrico respecto del eje vertical -----------------------------------
// Con el ala 1 apuntando arriba, espejar en x=512 tiene que devolver EXACTAMENTE el mismo
// dibujo: el ala 1 cae sobre si misma y las otras dos se intercambian. Se compara el
// multiconjunto de primitivas, con los puntos ordenados: asi da igual por donde arranque un
// poligono (espejar un poligono invierte su sentido de giro).
// Las ondas quedan fuera: son una traza, no geometria mecanica.
const clave = (p, esp) => {
  const x = (v) => (esp ? BOX - v : v);
  const r = (v) => Math.round(v * 100) / 100;
  // `d` va en la clave: dos piezas espejadas tienen que apagarse igual, o al bajar el alpha
  // la mitad del reactor se iria antes que la otra.
  const cab = [p.k, p.c, r(p.a), r(p.w ?? 0), r(p.r ?? 0), r(p.glow ?? 0), p.fill ? 1 : 0,
    r(p.d ?? 1)];
  const pts = p.k === "poly"
    ? p.pts.map(([a, b]) => `${r(x(a))},${r(b)}`).sort()
    : [`${r(x(p.x))},${r(p.y)}`];
  return cab.join("|") + "#" + pts.join(";");
};
const geo = parts().filter((p) => !p.id);
const der = geo.map((p) => clave(p, false)).sort();
const izq = geo.map((p) => clave(p, true)).sort();
assert.deepEqual(izq, der, "el reactor no es simetrico respecto del eje vertical");

// --- 4. entra en el cuadro -----------------------------------------------------------------
const rmax = radioMax();
assert.ok(rmax < BOX / 2, `el reactor se sale del cuadro: r=${rmax.toFixed(1)}`);

// --- 5. el otro backend tambien dibuja -----------------------------------------------------
// `drawReactor` no importa Phaser: recibe el Graphics, o sea que se puede correr con un doble
// desde node. Esto es lo que atrapa que el SVG este bien y el juego reviente igual.
const llam = [];
const doble = new Proxy({}, { get: (_, m) => (...a) => llam.push([m, ...a]) });
const P = (x, y) => ({ x: 100 + x * 0.5, y: 200 + y * 0.5 });   // semejanza: escala 0.5
drawReactor(doble, P, { t: 1.3, beat: 0.7, pulse: 0.4, spin: 0.9 });
assert.ok(llam.length > parts().length, "drawReactor no dibujo todas las primitivas");
for (const [m, ...a] of llam) {
  assert.ok(a.every((v) => typeof v !== "number" || Number.isFinite(v)), `${m} con NaN`);
}
// el radio del nucleo tiene que salir escalado por P (0.5) y no en unidades del viewBox
const circs = llam.filter((c) => c[0] === "fillCircle");
assert.ok(circs.some((c) => Math.abs(c[3] - 9 * 0.5) < 1e-9),
  "el punto central no salio a escala de P");
// --- 6. el alpha no es un multiplicador plano, es una CURVA POR PIEZA ----------------------
// `alpha^d` con `d` de `DIM`: el chasis se apaga mucho mas que el nucleo. Dos cosas que
// chequear, y las dos llamada por llamada.
const conAlpha = (op) => {
  const c = [];
  const d = new Proxy({}, { get: (_, m) => (...a) => c.push([m, ...a]) });
  drawReactor(d, P, { t: 1.3, beat: 0.7, pulse: 0.4, spin: 0.9, ...op });
  return c;
};
const A0 = conAlpha({}), A1 = conAlpha({ alpha: 1 }), A5 = conAlpha({ alpha: 0.5 });
// (a) la curva es la IDENTIDAD en alpha=1: el SVG estatico y el dibujo de referencia no se
//     enteran de que existe la tabla. Sin esto, tocar un exponente moveria el dibujo entero.
assert.deepEqual(A1, A0, "alpha=1 no da exactamente el mismo dibujo que sin alpha");
// (b) a 0.5 nadie sube de opacidad, la geometria no se mueve, y todo factor que aparezca
//     tiene que salir de la TABLA (un `d` suelto seria una pieza sin familia). El color no
//     alcanza para saber la familia: el cyan es cable, rejilla, filo de pantalla y nucleo.
assert.equal(A1.length, A5.length, "el alpha cambio cuantas primitivas se dibujan");
const tabla = Object.values(DIM).map((d) => 0.5 ** d);
const factor = new Map();
for (let i = 0; i < A1.length; i++) {
  const [m, ...a] = A1[i], b = A5[i].slice(1);
  assert.equal(m, A5[i][0], "el alpha cambio el orden de dibujo");
  if (m !== "fillStyle" && m !== "lineStyle") {
    assert.deepEqual(b, a, `${m} cambio de geometria con el alpha`);
    continue;
  }
  // fillStyle(color, alpha) y lineStyle(ancho, color, alpha): el alpha es el ultimo
  const a1 = a[a.length - 1], a5 = b[b.length - 1], col = m === "fillStyle" ? a[0] : a[1];
  assert.ok(a5 <= a1 + 1e-9, `${m} pidio MAS opacidad con el alpha bajo`);
  if (a1 <= 0) continue;
  const f = a5 / a1;
  assert.ok(tabla.some((v) => Math.abs(v - f) < 1e-9),
    `${m} se apago x${f.toFixed(3)}, que no esta en DIM`);
  if (!factor.has(col)) factor.set(col, new Set());
  factor.get(col).add(Math.round(f * 1e6));
}
// (c) y el numero que era el bug: el chasis (todo el metal) tiene que apagarse MUCHO mas que
//     el nucleo. Los dos colores que si dicen la familia solos: `metal` es siempre chasis y
//     `white` solo lo usan el brillo y el punto central del nucleo.
const uno = (c, cual) => {
  const s = factor.get(c);
  assert.equal(s.size, 1, `${cual} se apago con ${s.size} factores distintos`);
  return [...s][0] / 1e6;
};
const fMetal = uno(RX.metal, "el metal"), fNucleo = uno(RX.white, "el nucleo");
assert.ok(Math.abs(fMetal - 0.5 ** DIM.chasis) < 1e-6, "el metal no se apago con DIM.chasis");
assert.ok(Math.abs(fNucleo - 0.5 ** DIM.nucleo) < 1e-6, "el nucleo no se apago con DIM.nucleo");
assert.ok(fMetal * 4 < fNucleo,
  `el chasis no se apaga mas que el nucleo: ${fMetal.toFixed(3)} vs ${fNucleo.toFixed(3)}`);

// --- 7. el latido no depende de que haya cues ---------------------------------------------
// Medido en el juego: el drop2 de `orbit-motion` no tiene NI UN evento de bass, o sea
// `pulse`=0 el 100% del tramo. `kick()` cae en el FFT, que si esta vivo.
assert.equal(bass(null), 0, "sin fft el latido tiene que ser 0 (el SVG sale quieto)");
assert.equal(bass(new Uint8Array(128)), 0, "en silencio el latido tiene que ser 0");
assert.equal(kick({}), 0, "sin nada el latido tiene que ser 0");
assert.equal(kick({ pulse: 0.4 }), 0.4, "sin fft el latido tiene que ser `pulse`");
const fuerte = kick({ pulse: 0, fft: new Uint8Array(128).fill(240) });
assert.ok(fuerte > 0.9, `con el grave arriba el latido dio ${fuerte.toFixed(2)}`);
// y tiene que MOVER el dibujo: el halo del nucleo se abre con el golpe
const halo = (kkfft) => parts({ fft: kkfft }).find((p) => p.c === RX.white && p.k === "disc").glow;
assert.ok(halo(new Uint8Array(128).fill(240)) > halo(null) * 3,
  "el golpe no abre el halo del nucleo");

// y con FFT en cero (el juego en pausa, o el modo diseno) la onda no puede volverse una raya
// ni un NaN: tiene que caer al sintetico, o sea dar EXACTAMENTE lo mismo que sin fft.
const conFft = wave(0, { fft: new Uint8Array(128), beat: 1, t: 2.4 });
const sinFft = wave(0, { beat: 1, t: 2.4 });
assert.equal(conFft.length, 65);
assert.ok(conFft.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
assert.deepEqual(conFft, sinFft, "con el FFT en cero la onda no cayo al sintetico");
const ys = conFft.map(([, y]) => y);
const rec = Math.max(...ys) - Math.min(...ys);
assert.ok(rec > 20, `con el FFT en cero la onda salio plana: ${rec.toFixed(1)}px de recorrido`);
// y con senal de verdad tiene que salir OTRA cosa (si no, el fallback se comio el analizador)
const viva = wave(0, { fft: Uint8Array.from({ length: 128 }, (_, k) => 40 + k), beat: 1, t: 2.4 });
assert.notDeepEqual(viva, sinFft, "con el FFT vivo la onda sigue siendo la sintetica");

mkdirSync(join(raiz, "assets"), { recursive: true });
writeFileSync(join(raiz, "assets", "reactor.svg"), svg);

console.log(`assets/reactor.svg  ${svg.length} bytes`);
console.log(`primitivas: ${parts().length} (nucleo ${coreParts().length}, ala ${wingParts(0).length} x3)`);
console.log(`radio maximo medido: ${rmax.toFixed(1)} de ${BOX / 2} (margen ${(BOX / 2 - rmax).toFixed(1)})`);
console.log(`drawReactor: ${llam.length} llamadas al Graphics con un doble, sin NaN`);
console.log(`alpha: identidad en 1 (${A1.length} llamadas), y a 0.5 el metal queda en `
  + `${fMetal.toFixed(3)} contra ${fNucleo.toFixed(3)} del nucleo (era 0.5 parejo)`);
console.log(`curva por pieza: ` + Object.entries(DIM)
  .map(([k, d]) => `${k} ${(0.5 ** d).toFixed(3)}`).join(", "));
console.log(`onda con FFT en cero: ${rec.toFixed(1)}px de recorrido (sintetica, no plana)`);
console.log("ok: ids, alas identicas salvo rotacion, simetria, encuadre, alpha, onda y Phaser");
