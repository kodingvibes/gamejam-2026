// Dimensiones base del lienzo Phaser. El layout responsive escala este espacio.
const GAME_WIDTH = 800;

// En vertical el mundo crece a lo alto. Con Scale.FIT el canvas escala por el lado que
// primero se queda corto: con un mundo cuadrado eso es el ancho, y en un móvil sobraban
// 420px de negro arriba y abajo. Midiendo #game y adoptando su proporción, el canvas
// llena la pantalla y ese espacio pasa a ser tablero y HUD.
// Sin DOM (pruebas en node) se queda el cuadrado de siempre.
const stageElement = typeof document === 'undefined' ? null : document.getElementById('game');
const stageRect = stageElement ? stageElement.getBoundingClientRect() : null;
const stageAspect = stageRect && stageRect.width > 0 ? stageRect.height / stageRect.width : 1;
// 1.7 deja fuera tablets y ventanas medio altas. No es estética: por debajo de ahí el
// mundo vertical sale tan corto que el tablero centrado sube hasta tapar el aviso de
// PENSANDO y el banner de cadena, y el medidor de terreno cae sobre los botones. Ese
// rango se lee mejor con el layout de escritorio. Lo comprueba Constants.test.js.
const IS_PORTRAIT = stageAspect > 1.7;
// Tope 2.2: más estirado el HUD se despega tanto del tablero que dejan de leerse juntos.
const stageHeightFor = (aspect) => (aspect > 1.7 ? Math.round(GAME_WIDTH * Math.min(2.2, aspect)) : 800);
const GAME_HEIGHT = stageHeightFor(stageAspect);

// El mundo se mide una vez, al cargar. Si después cambia la forma del hueco (girar el
// móvil, activar la emulación del navegador, redimensionar la ventana) el mundo se queda
// con la proporción vieja y Scale.FIT vuelve a dejar barras negras. Recolocar todas las
// escenas en caliente cuesta mucho más que recargar, así que se recarga; el récord vive
// en localStorage y sobrevive. Se compara la altura resultante y no la orientación: dentro
// del vertical el alto sigue al aspecto, y un cambio grande ahí también rompe el encaje.
if (stageElement) {
  let stageResizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(stageResizeTimer);
    // Antirebote: al arrastrar la ventana llegan cientos de eventos, solo importa el final.
    stageResizeTimer = setTimeout(() => {
      const rect = stageElement.getBoundingClientRect();
      if (rect.width <= 0) return;
      const height = stageHeightFor(rect.height / rect.width);
      // 5% de margen: por debajo de eso el letterbox no se nota y no compensa recargar.
      if (Math.abs(height - GAME_HEIGHT) > GAME_HEIGHT * 0.05) window.location.reload();
    }, 250);
  });
}

/**
 * Elige valor según la orientación medida al cargar. Al girar el móvil el listener de
 * arriba recarga la página, que es lo que reordena el layout.
 * @param {*} portrait @param {*} landscape @returns {*}
 */
const responsive = (portrait, landscape) => (IS_PORTRAIT ? portrait : landscape);

// Jerarquía visual compartida por Phaser y las capas DOM/SVG del juego.
const DEPTH = Object.freeze({
  background: 0,
  app: 1,
  board: 20,
  boardInteractive: 60,
  canvas: 50,
  hud: 60,
  controls: 70,
  overlay: 100,
  modal: 110,
  modalContent: 120,
  tooltip: 130,
  footer: 10,
});

// Tipografías cargadas en index.html y compartidas por Phaser y el branding.
const FONTS = Object.freeze({
  TITLE: 'Orbitron, sans-serif',
  GAME: 'Rajdhani, sans-serif',
  BODY: '"Plus Jakarta Sans", sans-serif',
});

// Variantes que deben estar listas antes de crear cualquier Phaser.Text.
const FONT_LOAD_REQUESTS = Object.freeze([
  '400 48px Orbitron',
  '600 48px Orbitron',
  '700 48px Orbitron',
  '400 24px Rajdhani',
  '500 24px Rajdhani',
  '600 24px Rajdhani',
  '700 24px Rajdhani',
  '400 16px "Plus Jakarta Sans"',
  '500 16px "Plus Jakarta Sans"',
  '600 16px "Plus Jakarta Sans"',
  '700 16px "Plus Jakarta Sans"',
]);

const FOOTER_URL = 'https://kodingvibes.github.io/gamejam-2026/';
const FOOTER_TEXT = 'KODINGVIBES GAMEJAM-2026 ···  VIBECODED BY AXES';

// Colores numéricos para Phaser. Los estados activos son los únicos que usan neón.
const COLORS = Object.freeze({
  background: 0x0a0b10,
  panelBg: 0x2a2d38,
  menuPanelBg: 0x111420,
  panelBorder: 0x000000,
  buttonBase: 0x1a1f2c,
  buttonHover: 0x252d40,
  buttonActive: 0x00e5ff,
  buttonPrimaryHover: 0x62f7ff,
  buttonPrimaryPressed: 0x00b8cc,
  confirmDangerHover: 0xff4f8a,
  confirmDangerPressed: 0xc91d50,
  buttonDisabled: 0x0e1117,
  playerOne: 0x00e5ff,
  playerTwo: 0xf626a8,
  textPrimary: 0xe6edf3,
  textMuted: 0x8b949e,
  textDim: 0x5c6270,
  black: 0x000000,

  // Alias antiguos: se conservan para no romper escenas o prototipos existentes.
  text: 0xe6edf3,
  muted: 0x8b949e,
  accent: 0x00e5ff,
  button: 0x1a1f2c,
});

// Colores CSS para SVG, DOM y estilos string.
const SVG_COLORS = Object.freeze({
  bgBase: '#0a0b10',
  grayBorder: '#2a2d38',
  buttonBase: '#1a1f2c',
  buttonHover: '#252d40',
  dot: '#000000',
  emptyLine: '#05070d',
  dotStroke: 'rgba(0, 245, 255, 0.25)',
  hoverLine: '#00f5ff',
  playerOne: '#00e5ff',
  playerTwo: '#f626a8',
  boardCellA: '#12141d',
  boardCellB: '#171a26',
  boardGridBorder: 'rgba(0, 245, 255, 0.08)',
  hoverFill: '#00f5ff40',
  panelBorder: 'rgba(0, 245, 255, 0.20)',
  textPrimary: '#e6edf3',
  textMuted: '#8b949e',
  textDim: '#5c6270',
  glitchCyan: '#00f5ff',
  glitchMagenta: '#f626a8',
  glitchGreen: '#55ff99',
  buttonActiveText: '#0a0b10',
  // Dorado de premio: solo en efectos transitorios, nunca en reposo ni como color de dueño.
  sugar: '#ffd166',
});

// Medidas visuales del tablero. Mantiene el mismo espacio jugable entre fases.
// En vertical el tablero es el protagonista: ocupa casi todo el ancho y se centra en el
// mundo alto. En escritorio se queda exactamente donde estaba.
const BOARD_WIDTH = responsive(740, 520);

const BOARD_STYLE = Object.freeze({
  width: BOARD_WIDTH,
  top: responsive(Math.round((GAME_HEIGHT - BOARD_WIDTH) / 2), 130),
  framePadding: 24,
  dotRadius: 7,
  lineWidth: 6,
  lineHoverWidth: 8,
  hitboxWidth: 40,
  cellRadius: 0,
  cellOpacity: 0.92,
  ownerOpacity: 0.28,
  lineRevealDuration: 240,
  boxRevealDuration: 380,
  boxRevealInitialScale: 0.55,
});

// Posiciones del HUD de partida. En escritorio son las de siempre; en vertical el HUD
// se reparte por las bandas que deja el tablero centrado, con tarjetas y botones grandes.
const BOARD_BOTTOM = BOARD_STYLE.top + BOARD_STYLE.width;
const HUD_LAYOUT = Object.freeze({
  cardY: responsive(64, 36),
  cardWidth: responsive(330, 220),
  cardHeight: responsive(84, 58),
  leftCardX: responsive(180, 150),
  rightCardX: responsive(620, 650),
  // En vertical la píldora de turno baja a su propia fila: al ancho de móvil no cabe
  // entre dos tarjetas grandes.
  turnY: responsive(154, 36),
  turnWidth: responsive(260, 150),
  turnHeight: responsive(52, 42),
  turnFontSize: responsive('26px', '17px'),
  thinkingY: responsive(216, 96),
  thinkingFontSize: responsive('20px', '14px'),
  chainY: responsive(BOARD_STYLE.top - 54, 66),
  chainFontSize: responsive('22px', '15px'),
  buttonY: responsive(GAME_HEIGHT - 90, 750),
  buttonWidth: responsive(300, 150),
  buttonHeight: responsive(76, 42),
  buttonFontSize: responsive('22px', '15px'),
  restartX: responsive(560, 680),
});

// Tiempos breves de presentación que no alteran las reglas del juego.
const GAME_TIMING = Object.freeze({
  gameOverDelay: 900,
  // Milisegundos extra por paso de racha antes de tapar el tablero con el panel final.
  gameOverStreakDelay: 90,
});

const AI_DIFFICULTY = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
});

// Cada cuánto MEDIUM se equivoca a propósito en un turno sin puntuación.
// Sin esto nunca abre una cadena y la partida se decide sola. Medido con 300 partidas
// de 4 puntos por lado (9 cajas) contra un bot casual que come si puede y si no juega al
// azar: rate 0 -> 1.7/9 cajas y 9% de victorias, 0.35 -> 3.2/9 y 23%, 0.5 -> 4.1/9 y 40%.
// Referencias con el mismo bot: EASY 7.7/9 y 100%, HARD 1.3/9 y 5%. Un humano real juega
// mejor que ese bot, así que 0.35 sube sin convertir MEDIUM en un segundo EASY.
// Es la perilla para ajustar dificultad: subirlo ablanda, bajarlo endurece.
const AI_PERSONALITY = Object.freeze({
  [AI_DIFFICULTY.MEDIUM]: Object.freeze({ blunderRate: 0.35 }),
});

const AI_CONFIG = Object.freeze({
  turnDelay: 550,
  // Comiendo cadena la IA va rápido. No bajar de 160: HARD ya gasta hasta 120ms síncronos.
  claimDelay: 240,
  defaultDifficulty: AI_DIFFICULTY.EASY,
  thinkingText: 'IA PENSANDO...',
});

// Parámetros ajustables de HARD. La búsqueda permanece acotada para no congelar la UI.
const HARD_AI_CONFIG = Object.freeze({
  maxThinkTimeMs: 120,
  depthsByBoardSize: Object.freeze({ 3: 7, 4: 5, 5: 3, 6: 2 }),
  scoreTolerance: 4,
  topMoveRandomness: 0.15,
});

const HARD_AI_WEIGHTS = Object.freeze({
  scoreDifference: 100,
  completedBox: 35,
  safeMove: 8,
  givesBox: -40,
  chainRisk: -18,
  futureMobility: 3,
  turnControl: 6,
});

// Glitch experimental de cajas. enabled es la única bandera de activación.
const BOX_CLAIM_GLITCH = Object.freeze({
  // Ahora es el fotograma de impacto bajo el destello, no el evento completo.
  enabled: true,
  duration: 170,
  channelOffset: 6,
  flickerSteps: 3,
  cloneAlpha: 0.42,
  jitter: 6,
  scaleX: 1.08,
  scaleY: 0.97,
  cyan: SVG_COLORS.glitchCyan,
  magenta: SVG_COLORS.glitchMagenta,
});

// Estallido neón al reclamar una caja. Se escala con la posición en la cadena.
const CLAIM_BURST = Object.freeze({
  baseCount: 7,
  countPerChain: 3,
  maxCount: 26,
  radius: 46,
  radiusPerChain: 16,
  particleRadius: 4,
  particleRadiusPerChain: 0.4,
  // Dos aros, blanco y dorado: la onda se lee como luz y no como humo.
  ringTwoDelay: 60,
  ringTwoScale: 1.6,
  // Franja dorada de partículas: se ensancha con la cadena hasta teñir el estallido.
  goldBand: 2,
  goldBandPerChain: 0.6,
  duration: 420,
  durationJitter: 160,
  ringColor: '#ffffff',
  ringDuration: 420,
  coreColor: '#ffffff',
  // Más de 4 y el grupo temporal vive ~1.2s: dos reclamos seguidos dejarían dos grupos.
  sparkleCount: 3,
  sparkleDuration: 950,
  sparkleJitter: 300,
});

// Onda de pulso sobre cajas ya reclamadas. Solo transform: es trabajo de compositor.
const BOARD_PULSE = Object.freeze({
  neighborScale: 1.035,   // por encima de ~1.06 una vecina parece recien reclamada
  neighborDuration: 200,
  neighborStagger: 40,
  waveScale: 1.09,
  waveDuration: 260,
  waveStagger: 85,
  waveMaxDelay: 620,      // cabe dentro de GAME_TIMING.gameOverDelay
});

// Reactividad al audio. Los valores "floor" son los que se ven sin audio disponible.
const AUDIO_REACTIVE = Object.freeze({
  smoothing: 0.18,
  glowFloor: 5,
  glowRange: 24,
  glowAlpha: '55',
  gridOpacityFloor: 0.18,
  gridOpacityRange: 0.1,
  boxOpacityFloor: BOARD_STYLE.ownerOpacity,
  boxOpacityRange: 0.07,
  // El avance de la partida se suma a las expresiones existentes: no añade escrituras.
  heatRange: 18,
  heatOpacityRange: 0.05,
});

// Sacudidas, pop de marcador y aviso de cadena. Todo breve: el juego es por turnos.
// Las intensidades son fracción del ancho base: en píxeles son intensidad * GAME_WIDTH.
const GAME_FEEL = Object.freeze({
  shakeDuration: 140,
  shakeIntensity: 0.0016,
  shakePerChain: 0.0012,
  invalidShakeDuration: 90,
  invalidShakeIntensity: 0.0012,
  // Mismo margen que el guardián de playHover: un click repetido no acumula feedback.
  invalidCooldown: 140,
  scorePopScale: 1.3,
  scorePopDuration: 170,
  chainPopDuration: 200,
  chainHoldDuration: 900,
  chainFadeDuration: 220,
  streakCap: 10,         // cadenas medidas: 7.5-8.3 en 5x5 y 10.6-12.4 en 6x6
  shakeChainCap: 6,      // sacudida y haptics NO siguen al tope nuevo: 10 peldaños marean
  streakStagger: 90,     // separacion visual entre las cajas de una misma jugada
  streakStaggerFast: 60, // a partir de cierta racha la cadena se comprime y suena seguida
  streakStaggerFastFrom: 5,
  flingRiseDuration: 150,
  flingTravelDuration: 300,
  flingFontSize: '40px',
  flingFontSizeBig: '52px',
  flingBigFrom: 2,
  flingMultiplierFrom: 4,
  flingLandOffset: -26,
  scorePopScaleBig: 1.45,
  scorePopBigFrom: 3,
});

// Vibración móvil. navigator.vibrate arranca vibrando: los índices pares son duración.
const HAPTICS = Object.freeze({
  move: 12,
  box: 18,
  boxPerChain: 8,
  boxMax: 90,            // tope de vibración independiente del tope visual
  invalid: 10,
  victory: Object.freeze([40, 60, 40, 60, 120]),
});

// Botón de sonido: mismo formato que REINICIAR, en la esquina opuesta.
const AUDIO_TOGGLE = Object.freeze({
  x: responsive(240, 120),
  y: HUD_LAYOUT.buttonY,
  width: HUD_LAYOUT.buttonWidth,
  height: HUD_LAYOUT.buttonHeight,
  fontSize: HUD_LAYOUT.buttonFontSize,
  labelOn: 'SONIDO: ON',
  labelOff: 'SONIDO: OFF',
  storageKey: 'timbiriche:muted',
});

// Medidas y opacidades comunes de la interfaz Phaser.
const UI_STYLE = Object.freeze({
  panelRadius: 0,
  panelAlpha: 0.96,
  borderWidth: 2,
  titleSize: responsive('72px', '56px'),
  subtitleSize: responsive('26px', '20px'),
  bodySize: responsive('22px', '16px'),
  hudLabelSize: responsive('18px', '13px'),
  scoreSize: responsive('40px', '28px'),
  buttonSize: '20px',
  glitchOffset: 2,
  activePlayerBorderWidth: 2,
  inactivePlayerAlpha: 0.58,
  turnTransitionDuration: 160,
});

// Layout del menú: dos bloques verticales, con medidas compartidas.
// En vertical el bloque entero se cuelga del centro del mundo alto: así crece con la
// pantalla en vez de quedar pegado a un 400 pensado para un lienzo cuadrado.
const MENU_CENTER_Y = responsive(Math.round(GAME_HEIGHT / 2), 400);
/** @param {number} offset distancia al centro del bloque @returns {number} */
const menuY = (offset) => MENU_CENTER_Y + offset;

const MENU_LAYOUT = Object.freeze({
  panelX: GAME_WIDTH / 2,
  panelY: MENU_CENTER_Y,
  panelWidth: responsive(720, 430),
  panelHeight: responsive(800, 430),
  titleY: responsive(menuY(-560), 108),
  subtitleY: responsive(menuY(-480), 172),
  modeTitleY: responsive(menuY(-340), 220),
  sectionTitleSize: responsive('26px', '18px'),
  hotSeatY: responsive(menuY(-260), 270),
  hotSeatWidth: responsive(620, 300),
  hotSeatHeight: responsive(84, 42),
  hotSeatFontSize: responsive('24px', '15px'),
  aiRowY: responsive(menuY(-150), 325),
  aiButtonWidth: responsive(200, 120),
  aiButtonHeight: responsive(84, 42),
  aiButtonGap: responsive(14, 10),
  aiFontSize: responsive('17px', '12px'),
  aiFontSizeLong: responsive('15px', '11px'),
  boardTitleY: responsive(menuY(-30), 380),
  boardTitleSize: responsive('24px', '17px'),
  boardButtonWidth: responsive(260, 120),
  boardButtonHeight: responsive(100, 48),
  boardColumnGap: responsive(30, 20),
  boardRowGap: 16,
  boardFirstRowY: responsive(menuY(70), 435),
  boardSecondRowY: responsive(menuY(190), 499),
  boardFontSize: responsive('30px', '16px'),
  // Antes elegir tablero arrancaba la partida y no lo decía en ninguna parte. El botón
  // ocupa el hueco donde estaba ese texto de ayuda, que ya no hace falta explicar.
  startY: responsive(menuY(302), 558),
  startWidth: responsive(560, 300),
  startHeight: responsive(104, 52),
  startFontSize: responsive('34px', '20px'),
  // Los iconos se dibujan en unidades base y se escalan con el resto del layout.
  iconScale: responsive(1.6, 1),
  recordY: responsive(menuY(420), 660),
  recordSize: responsive('18px', '14px'),
});

// Sistema visual compartido por todos los botones Phaser.
const BUTTON_STYLE = Object.freeze({
  background: COLORS.buttonBase,
  backgroundHover: COLORS.buttonHover,
  backgroundPressed: 0x101521,
  backgroundDisabled: COLORS.buttonDisabled,
  border: COLORS.panelBorder,
  borderActive: COLORS.buttonActive,
  text: SVG_COLORS.textPrimary,
  textDisabled: SVG_COLORS.textDim,
  glitchCyan: 0x00f5ff,
  glitchMagenta: 0xf626a8,
  glitchGreen: 0x55ff99,
  cornerLength: 10,
  cornerInset: 3,
  cornerThickness: 2,
  channelOffset: 1,
  pressScale: 0.98,
  hoverDuration: 120,
  pressDuration: 80,
  glitchDuration: 180,
  hoverAlpha: 0.85,
  pressedAlpha: 1,
  channelDelay: 16,
  selectedAlpha: 0.58,
  disabledAlpha: 0.58,
  actionCooldown: 180,
  borderWidth: 1,
  activeBorderWidth: 2,
  fontFamily: FONTS.GAME,
  fontSize: UI_STYLE.buttonSize,
});

// Los paneles flotantes se miden desde el centro del mundo, que en vertical no es 400.
// Con el mundo cuadrado cada offset devuelve exactamente la coordenada de siempre.
const PANEL_CENTER_Y = Math.round(GAME_HEIGHT / 2);
/** @param {number} offset distancia al centro del panel @returns {number} */
const panelY = (offset) => PANEL_CENTER_Y + offset;

// Layout del panel final: una fila centrada y simétrica.
const GAME_OVER_STYLE = Object.freeze({
  panelWidth: responsive(740, 620),
  panelHeight: 480,
  centerX: GAME_WIDTH / 2,
  centerY: PANEL_CENTER_Y,
  // El panel ocupa 240px a cada lado del centro: libre de las tarjetas del HUD y del botón de sonido.
  titleY: panelY(-175),
  resultY: panelY(-115),
  gradeY: panelY(-38),
  gradeCaptionY: panelY(8),
  scoreY: panelY(52),
  recordY: panelY(94),
  hookY: panelY(126),
  buttonsY: panelY(175),
  buttonWidth: responsive(300, 220),
  buttonHeight: responsive(72, 52),
  buttonGap: 30,
  // Ajusta aquí la posición horizontal de los botones del panel final.
  // Ambos valores son el centro de cada botón; usa el mismo criterio para mantenerlos simétricos.
  leftButtonX: GAME_WIDTH / 2 - (responsive(300, 220) / 2 + 30 / 2),
  rightButtonX: GAME_WIDTH / 2 + (responsive(300, 220) / 2 + 30 / 2),
});

// Layout compartido del modal de confirmación de acciones.
const CONFIRM_MODAL_STYLE = Object.freeze({
  panelWidth: responsive(720, 560),
  panelHeight: responsive(400, 320),
  centerX: GAME_WIDTH / 2,
  centerY: PANEL_CENTER_Y,
  titleY: panelY(responsive(-130, -100)),
  messageY: panelY(responsive(-70, -50)),
  buttonsY: panelY(responsive(30, 25)),
  menuButtonY: panelY(responsive(130, 105)),
  buttonWidth: responsive(300, 150),
  buttonHeight: responsive(76, 48),
  menuButtonWidth: responsive(620, 324),
  menuButtonHeight: responsive(64, 44),
  titleSize: responsive('30px', '24px'),
  buttonFontSize: responsive('22px', '17px'),
  menuFontSize: responsive('18px', '15px'),
  // Línea de corte: separa la respuesta a la pregunta de la tercera salida.
  dividerY: panelY(responsive(84, 68)),
  dividerWidth: responsive(620, 324),
  buttonGap: 24,
  overlayAlpha: 0.78,
  panelAlpha: 0.99,
});

// Telegrafía de caja caliente: 3 de 4 lados trazados. Marca dorada, nunca un relleno.
const HOT_BOX = Object.freeze({
  inset: 0.09,            // fracción del lado de la celda
  strokeWidth: 3,
  dash: '10 7',
  peak: 0.55,
  rest: 0.12,
  period: 1400,
  delayStep: 90,          // ms por (fila + columna): un tablero entero caliente se lee como onda
  densityThreshold: 0.4,  // por encima, la marca baja de intensidad en vez de desaparecer
  densePeak: 0.24,
  densePeriod: 2200,
});

// Impacto de la línea en sus dos puntos. El retraso sigue al revelado, no lo adelanta.
const DOT_IMPACT = Object.freeze({
  delay: 140,             // 0.58 * BOARD_STYLE.lineRevealDuration: la punta llega aquí
  punchScale: 1.5,
  punchDuration: 200,
  ringRadius: 7,
  ringScale: 2.6,
  ringWidth: 4,
  ringDuration: 260,
  hoverScale: 1.2,
});

// Latido de reposo de los puntos. Amplitud por debajo del golpe: nunca se confunden.
const DOT_IDLE = Object.freeze({ scale: 1.12, duration: 3200, delayStep: 140 });

// Hilo que une una caja de la cadena con la anterior. Siempre temporal.
const CHAIN_LINK = Object.freeze({
  width: 3, widthPerStep: 0.6, maxWidth: 7,
  revealDuration: 200, holdDuration: 140, fadeDuration: 300,
  goldFromStep: 4,
});

// Destello dorado sobre todo el marco en una racha larga.
const STREAK_FLASH = Object.freeze({
  minStreak: 4, peak: 0.14, peakPerStep: 0.02, maxPeak: 0.26,
  duration: 260, delay: 120,
});

// Barrido de la IA mientras piensa. Cabe dentro de AI_CONFIG.turnDelay.
const AI_SCAN = Object.freeze({ duration: 480, opacity: 0.22, width: 2 });

// Vista previa al pasar por una línea libre: solo el premio, nunca la trampa.
const HOVER_PREVIEW = Object.freeze({ fillOpacity: 0.16, duration: 120 });

// Reacción de las cajas vacías vecinas a un reclamo. Solo trazo: un relleno parecería dueño.
const EMPTY_RIPPLE = Object.freeze({
  strokeOpacity: 0.25, strokeWidth: 1.5, duration: 180, stagger: 40, radius: 1,
});

// Confeti del panel final. Medido: el vuelo no cuesta frame, solo la construcción.
const CONFETTI = Object.freeze({
  count: 110, recordCount: 140,
  minWidth: 9, maxWidth: 15, aspect: 1.6,
  duration: 1900, durationJitter: 1300,
  driftRange: 80, spinRange: 540, fallDistance: 880,
  stagger: 8, originY: -20,
});

// Medidor de terreno seguro: la tensión del medio juego, hoy invisible.
const SAFE_METER = Object.freeze({
  labelY: responsive(BOARD_BOTTOM + 54, 684),
  barY: responsive(BOARD_BOTTOM + 84, 702),
  width: responsive(520, 360),
  height: responsive(12, 8),
  labelFontSize: responsive('20px', '13px'),
  warnAt: 6, criticalAt: 2,
  // "SIN SALIDA" no decía sin salida de qué. La versión vacía reusa las mismas
  // palabras que la normal, así se lee como el final de esa cuenta y no como otro aviso.
  labelIdle: 'TERRENO SEGURO', labelEmpty: 'SIN TERRENO SEGURO · TOCA REGALAR CAJA',
});

// Coreografía del final de partida.
const GAME_OVER_FEEL = Object.freeze({
  scrimAlpha: 0.72, scrimDuration: 180,
  dissolveDuration: 260,
  panelOpenDuration: 260, panelOpenScaleY: 0.06,
  titleDelay: 300, resultDelay: 420, scoreDelay: 520, countDuration: 520,
  gradeDelay: 900, stampDuration: 180,
  buttonsDelay: 900,
  gradeFontSize: '76px', captionFontSize: '15px',
  storageKey: 'timbiriche:best',
});

// Entrada y latido del menú. Solo transforms de contenedor.
const MENU_FEEL = Object.freeze({
  titleDuration: 320, subtitleDelay: 120, subtitleDuration: 220,
  panelDelay: 180, panelDuration: 260,
  buttonDelay: 300, buttonStagger: 45, buttonDuration: 180,
  idleScale: 1.015, idleDuration: 2400,
  fadeOutDuration: 200,
  // El botón de empezar respira más fuerte que el resto: es la única salida del menú.
  startPulseScale: 1.05, startPulseDuration: 900,
});

// Rejilla de fondo. Tres capas con celda, color y velocidad distintas: la grande y
// rápida se lee como cercana, la fina y lenta como lejana, y eso es el parallax.
// La capa magenta va al contrario para que el cruce no parezca una sola rejilla torcida.
const NEON_GRID = Object.freeze({
  depth: -1,
  // Un neón es un tubo brillante rodeado de luz. Con una sola línea plana el fondo se
  // leía como papel milimetrado gris; el halo ancho por debajo es lo que lo enciende.
  lineWidth: 1,
  glowWidth: 7,
  glowAlpha: 0.22,
  pulseDepth: 0.55,
  pulseDuration: 3200,
  // Barrido CRT: una línea brillante con su banda difusa cruzando de arriba a abajo.
  sweepHeight: 3,
  sweepBandHeight: 150,
  sweepAlpha: 0.5,
  sweepBandAlpha: 0.09,
  sweepDuration: 7000,
  sweepDelay: 4200,
  layers: Object.freeze([
    Object.freeze({ cell: 48, color: COLORS.playerOne, alpha: 0.09, speedX: 4, speedY: 7 }),
    Object.freeze({ cell: 112, color: COLORS.playerTwo, alpha: 0.13, speedX: -9, speedY: 15 }),
    Object.freeze({ cell: 180, color: COLORS.playerOne, alpha: 0.2, speedX: 14, speedY: 24 }),
  ]),
});

// Personalidad de la IA en su compás de pensar. Se rota por índice, no al azar por frame.
const AI_THINKING = Object.freeze({
  easy: Object.freeze(['IA · TANTEANDO', 'IA · A VER...']),
  medium: Object.freeze(['IA · MIDIENDO EL RIESGO', 'IA · CALCULANDO']),
  hard: Object.freeze(['IA · LEYENDO CADENAS', 'IA · TE VEO VENIR']),
  chainTell: 'IA · ME LAS COMO TODAS',
  ellipsisPeriod: 220,
});
