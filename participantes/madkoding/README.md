# FOXSTAR

Rail shooter estilo **Star Fox** hecho en **Three.js 0.160 + TypeScript 5.4 + Vite 8**. La cámara avanza por un riel mientras pilotas tu nave, esquivas oleadas de enemigos y te enfrentas a un boss final en el espacio profundo.

## Descripción

FoxStar es un shooter sobre raíles: la cámara se desliza por un corredor espacial mientras tú controlas la nave dentro de ese riel. Tienes **3 vidas + escudos + power-ups**, y te enfrentas a **3 patrones de enemigos** (DiveBomb, Circle y Sweep) antes de llegar al **boss final (Mothership)**.

Todo con música de fondo original (**Starfall Vanguard**) y un sistema de efectos completo: nebulosas, campo de estrellas, explosiones, partículas y efectos de pantalla.

## Ejecutar

Requiere **Node.js** y **npm**.

```bash
npm install
npm run dev
```

Abrir la URL que indica Vite (por defecto `http://localhost:5173`).

Para una build de producción:

```bash
npm run build
npm run preview
```

## Controles

| Teclado | Mouse | Gamepad | Acción |
|---------|-------|---------|--------|
| `WASD` / `Flechas` | mover el puntero | stick izquierdo | mover la nave y la mira |
| `ESPACIO` | clic izquierdo | `A` / `RT` | disparar láseres |
| `Z` | clic derecho | `B` | bomba (5 en total, limpia disparos enemigos) |
| `SHIFT` | — | `X` / `LT` | boost (consume el medidor) |
| `Q` / `E` | — | `LB` / `RB` | barrel roll (desvía disparos) |
| `ESC` / `P` | — | `START` | pausa |
| `ENTER` / `ESPACIO` | clic | — | iniciar / reintentar |

El esquema activo (mouse o teclado/gamepad) sigue al último dispositivo usado.

## Motion design y efectos

- **Post-procesado cinematográfico**: bloom a media resolución + pase propio con aberración cromática radial, zoom blur, viñeta, grano, scanlines, flashes y viñeta de latido con poca vida.
- **FxDirector**: hit-stop en impactos, slow-motion (bomba, muerte, boss), pulsos de FOV, bloom y aberración que se apilan y decaen de forma coherente.
- **Cámara con trauma**: shake por ruido suave (posición + rotación), seguimiento independiente del framerate, roll siguiendo a la nave y órbita cinematográfica en el menú.
- **Secuencias**: entrada en warp con título "SECTOR XX", alerta WARNING del boss con franjas y klaxon, MISSION COMPLETE con conteo de bonus y salto al hiperespacio al siguiente sector.
- **HUD vivo**: puntaje que rueda, barras con rastro de daño, combo con temporizador por niveles de color, medidor de boost, hit-markers y lock-on que magnetiza la mira, popups de puntaje en el punto de cada kill.
- **Nave**: barrel roll con burbuja de escudo fresnel, afterburner que crece con el boost, parpadeo de invencibilidad.
- **Enemigos y boss**: aparición con rebote, squash al recibir daño, flash blanco real, boss que sigue el riel con patrones por fase (abanico y anillo giratorio).
- **Pilotos enemigos**: 5 naves con silueta propia (dron de cuchillas, dardo explorador, caza delta, interceptor de alas en X, bombardero ala volante) con toberas animadas y luces de navegación. Vuelan maniobras coreografiadas en el marco del riel —pasadas cruzadas, adelantamientos desde atrás con giro en U, picados, loops, zigzag con snap-rolls, justas de frente—, se inclinan en cada curva, esquivan tus láseres con barrel rolls, cargan los cañones antes de disparar y pueden embestirte.

## Mundos y terreno

- **Terreno por chunks** hasta el horizonte (±1000 u de ancho, 2200 de profundidad) con LOD y faldones; se genera una vez por chunk, no por frame.
- **Valle o cañón que sigue al riel**: el camino serpentea entre cordilleras de crestas reales, con paleta por altura y pendiente (playa, pasto, roca, nieve en cumbres) y niebla del color exacto del horizonte del cielo.
- **Agua** con oleaje, Fresnel, reflejo del cielo del bioma, **reflejo planar real** (nave, enemigos, obstáculos y montañas; se apaga solo si baja el rendimiento), **espuma en la orilla** y destello del sol; **lava** con corteza agrietada, flujo y **erupciones** (burbujas que se hinchan y revientan en fuentes de magma que dañan).
- **Estela al rasar**: volar bajo sobre agua levanta spray y anillos de onda; sobre lava, brasas y anillos fundidos. Las orillas de lava brillan.
- **Vegetación y estructuras**: árboles con viento, rocas, árboles secos, edificios con ventanas iluminadas y cristales luminosos, instanciados por chunk según bioma y pendiente.
- **Biomas cueva y ciudad** en uso: *Cuevas de Cristal* (túnel con cristales cian) e *Infierno de Metal*: avenida con carriles pintados, veredas y faroles (cono de luz + charcos de luz en el asfalto) entre rascacielos cuyas ventanas muestran **interiores con parallax** ([three-fenestra](https://github.com/codedgar/three-fenestra), MIT) en un solo material instanciado, con cortinas/persianas retroiluminadas y ventanas que se encienden una a una a medida que cae la noche. Tráfico en ambos sentidos (faros, luces traseras y haz en el asfalto), letreros de neón que parpadean, balizas rojas en azoteas y faroles sólidos (chocar con uno daña la nave).
- **Espacio** con planeta en el horizonte (continentes, gigante gaseoso con anillos, mundo muerto agrietado, mundo helado con aurora) y cinturón de asteroides con paralaje.
- **Obstáculos reales en la franja de vuelo**: agujas de roca, arcos que hay que cruzar por el hueco, cristales destructibles, estalactitas, pilones y asteroides a la deriva, con colisión tipo cápsula para nave y láseres. Se reparten con separación mínima entre sí y espaciado irregular para dejar espacio de maniobra; las agujas son curvas e inclinadas (la colisión sigue la curva).
- **Realismo**: oclusión ambiental horneada en el terreno + GTAO en pantalla (adaptativa), iluminación por imagen (IBL) desde la foto del cielo y sombras del sol que siguen a la nave.

## Stack tecnológico

- **Three.js** `^0.160.0` — renderizado 3D.
- **three-fenestra** `^0.3.0` — interior mapping para las ventanas de la ciudad.
- **TypeScript** `^5.4.0` — tipado estático.
- **Vite** `^8.2.0` — bundler y dev server.
- **@types/three** `^0.185.3` — tipos para Three.js.

## Estructura del proyecto

```
src/
├── audio/        # AudioManager, MusicPlayer (Starfall Vanguard)
├── camera/       # CameraRig, PostProcessingPipeline
├── core/         # Game, StateManager, CollisionSystem, EventBus,
│                 # GameEventBinder, ScoreSystem, Timekeeper, ...
├── enemies/      # EnemyManager, Enemy, EnemyMeshFactory, EnemyTrail
│   ├── bosses/   # BossBase, BossMothership
│                 # FlightPlans (maniobras por patrón)
├── fx/           # FxDirector, Starfield, ExplosionSystem, PowerUp, Nebulae,
│                 # ParticleManager, ScreenEffects, HitSpark, ...
├── player/       # PlayerShip, InputMapper, FoxTail, PlayerLifeManager,
│                 # PlayerShipMeshFactory
├── rail/         # RailFactory, RailController
├── types/        # config, events, index
├── ui/           # HUD, Announcer, ScorePopups, MenuScreen, PauseOverlay, GameOverScreen,
│                 # VictoryScreen, LivesDisplay, iconRow
├── utils/        # ObjectPool
├── waves/        # WaveDefinition, WaveManager
└── weapons/      # Projectile, WeaponConfig, WeaponSystem
```

## Notas técnicas

- **Arquitectura por módulos**: el juego está separado en dominios claros (`rail`, `enemies`, `player`, `fx`, `core`, `ui`, `weapons`, `waves`), cada uno con responsabilidad única.
- **Refactor SOLID / KISS / DRY**: se aplicó una pasada de limpieza que renombró variables de un solo carácter y encapsuló la IA de los enemigos en métodos `updateCombat()` / `configure()`, dejando cada patrón autocontenido.
- **Patrones de enemigos**: cada patrón (DiveBomb, Circle, Sweep) hereda de `PatternBase` y define su propio comportamiento de movimiento y combate.
- **Boss final**: `BossMothership` extiende `BossBase` y cierra la partida con un enfrentamiento dedicado.
- **Sistema de vidas**: `PlayerLifeManager` gestiona las 3 vidas, los escudos y los power-ups.
- **Audio**: la banda sonora original se carga desde `public/` y se gestiona a través de `AudioManager` / `MusicPlayer`.
- **Pooling**: `ObjectPool` reutiliza objetos (proyectiles, partículas) para evitar picos de garbage collection.
- **Entorno** (`src/environment`): `RailShape` (forma del riel compartida), `TerrainField` (altura/color por bioma), `TerrainManager` (chunks), `LiquidSurfaces`, `LavaEruptions`, `SpaceScenery`, `RockGeometry`.
