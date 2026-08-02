// Dimensiones base del lienzo Phaser. El layout responsive escala este espacio.
const GAME_WIDTH = 800;
const GAME_HEIGHT = 800;

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
const BOARD_STYLE = Object.freeze({
  width: 520,
  top: 130,
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
  x: 120,
  y: 750,
  width: 150,
  height: 42,
  fontSize: '15px',
  labelOn: 'SONIDO: ON',
  labelOff: 'SONIDO: OFF',
  storageKey: 'timbiriche:muted',
});

// Medidas y opacidades comunes de la interfaz Phaser.
const UI_STYLE = Object.freeze({
  panelRadius: 0,
  panelAlpha: 0.96,
  borderWidth: 2,
  titleSize: '56px',
  subtitleSize: '20px',
  bodySize: '16px',
  hudLabelSize: '13px',
  scoreSize: '28px',
  buttonSize: '20px',
  glitchOffset: 2,
  activePlayerBorderWidth: 2,
  inactivePlayerAlpha: 0.58,
  turnTransitionDuration: 160,
});

// Layout del menú: dos bloques verticales, con medidas compartidas.
const MENU_LAYOUT = Object.freeze({
  panelX: GAME_WIDTH / 2,
  panelY: 400,
  panelWidth: 430,
  panelHeight: 430,
  modeTitleY: 220,
  hotSeatY: 270,
  hotSeatWidth: 300,
  hotSeatHeight: 42,
  aiRowY: 325,
  aiButtonWidth: 120,
  aiButtonHeight: 42,
  aiButtonGap: 10,
  boardTitleY: 380,
  boardButtonWidth: 120,
  boardButtonHeight: 48,
  boardColumnGap: 20,
  boardRowGap: 16,
  boardFirstRowY: 435,
  boardSecondRowY: 499,
  helpY: 560,
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

// Layout del panel final: una fila centrada y simétrica.
const GAME_OVER_STYLE = Object.freeze({
  panelWidth: 620,
  panelHeight: 480,
  centerX: GAME_WIDTH / 2,
  centerY: GAME_HEIGHT / 2,
  // El panel ocupa y 160..640: libre de las tarjetas del HUD y del botón de sonido.
  titleY: 225,
  resultY: 285,
  gradeY: 362,
  gradeCaptionY: 408,
  scoreY: 452,
  recordY: 494,
  hookY: 526,
  buttonsY: 575,
  buttonWidth: 220,
  buttonHeight: 52,
  buttonGap: 30,
  // Ajusta aquí la posición horizontal de los botones del panel final.
  // Ambos valores son el centro de cada botón; usa el mismo criterio para mantenerlos simétricos.
  leftButtonX: GAME_WIDTH / 2 - (220 / 2 + 30 / 2),
  rightButtonX: GAME_WIDTH / 2 + (220 / 2 + 30 / 2),
});

// Layout compartido del modal de confirmación de acciones.
const CONFIRM_MODAL_STYLE = Object.freeze({
  panelWidth: 560,
  panelHeight: 320,
  centerX: GAME_WIDTH / 2,
  centerY: GAME_HEIGHT / 2,
  titleY: 300,
  messageY: 350,
  buttonsY: 425,
  menuButtonY: 505,
  buttonWidth: 150,
  buttonHeight: 48,
  menuButtonWidth: 324,
  menuButtonHeight: 44,
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
  labelY: 684, barY: 702, width: 360, height: 8,
  warnAt: 6, criticalAt: 2,
  labelIdle: 'TERRENO SEGURO', labelEmpty: 'SIN SALIDA',
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
  recordY: 660,
});

// Personalidad de la IA en su compás de pensar. Se rota por índice, no al azar por frame.
const AI_THINKING = Object.freeze({
  easy: Object.freeze(['IA · TANTEANDO', 'IA · A VER...']),
  medium: Object.freeze(['IA · MIDIENDO EL RIESGO', 'IA · CALCULANDO']),
  hard: Object.freeze(['IA · LEYENDO CADENAS', 'IA · TE VEO VENIR']),
  chainTell: 'IA · ME LAS COMO TODAS',
  ellipsisPeriod: 220,
});
