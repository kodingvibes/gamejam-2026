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
  emptyLine: '#000000',
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
  hitboxWidth: 28,
  cellRadius: 0,
  cellOpacity: 0.92,
  ownerOpacity: 0.28,
  lineRevealDuration: 240,
  boxRevealDuration: 380,
  boxRevealInitialScale: 0.55,
});

// Tiempos breves de presentación que no alteran las reglas del juego.
const GAME_TIMING = Object.freeze({
  gameOverDelay: 650,
  // Milisegundos extra por paso de racha antes de tapar el tablero con el panel final.
  gameOverStreakDelay: 90,
});

const AI_DIFFICULTY = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
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
  countPerChain: 2,
  maxCount: 16,
  radius: 46,
  radiusPerChain: 11,
  particleRadius: 4,
  duration: 420,
  durationJitter: 160,
  ringColor: '#ffffff',
  ringDuration: 380,
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
  glowRange: 16,
  glowAlpha: '55',
  gridOpacityFloor: 0.18,
  gridOpacityRange: 0.1,
  boxOpacityFloor: BOARD_STYLE.ownerOpacity,
  boxOpacityRange: 0.07,
  // El avance de la partida se suma a las expresiones existentes: no añade escrituras.
  heatRange: 10,
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
  streakCap: 6,          // mismo tope que ya aplican playClaimBurst y playBoxClaim
  streakScaleStep: 0.07,
  streakStagger: 90,     // separacion visual entre las cajas de una misma jugada
  flingRiseDuration: 150,
  flingTravelDuration: 300,
  flingFontSize: '40px',
});

// Vibración móvil. navigator.vibrate arranca vibrando: los índices pares son duración.
const HAPTICS = Object.freeze({
  move: 12,
  box: 18,
  boxPerChain: 8,
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
  panelHeight: 390,
  centerX: GAME_WIDTH / 2,
  centerY: GAME_HEIGHT / 2,
  titleY: 265,
  resultY: 335,
  scoreY: 395,
  buttonsY: 500,
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
