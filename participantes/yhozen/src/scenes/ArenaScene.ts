import Phaser from 'phaser';
import { Scene3D, THREE, type ExtendedMesh } from '@enable3d/phaser-extension';
import { SoundSynth } from '../audio/SoundSynth';
import {
  loadTuning,
  REMOTE_INTERPOLATION_BUFFER_MS,
  saveTuning,
  SHOT_COOLDOWN_MS,
  SHOT_RANGE,
  SPAWN_POINTS,
  STATE_SEND_INTERVAL_MS,
  TUNING_DEFAULTS,
  type TuningValues,
} from '../game/config';
import { GameSocket, type NetworkState, type NetworkStatus } from '../network/GameSocket';
import { isOutOfBounds } from '../game/movement';
import { SkateboardController, type SkateInput } from '../physics/SkateboardController';
import type { PlayerSnapshot, ServerMessage, Vec3 } from '../shared/protocol';
import type { TestInput } from '../testing/GameTestApi';

interface ArenaData {
  room: string;
  name: string;
}

interface RemoteRider {
  group: THREE.Group;
  snapshot: PlayerSnapshot;
  frames: Array<{
    receivedAt: number;
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
  }>;
}

interface RemoteVisualResources {
  deckGeometry: THREE.BoxGeometry;
  bodyGeometry: THREE.CapsuleGeometry;
  headGeometry: THREE.SphereGeometry;
  deckMaterial: THREE.MeshStandardMaterial;
  bodyMaterial: THREE.MeshStandardMaterial;
  headMaterial: THREE.MeshStandardMaterial;
}

interface StaticVisual {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: THREE.Vector3;
  color: THREE.Color;
}

type KeyMap = Record<'W' | 'S' | 'A' | 'D' | 'SPACE' | 'C' | 'F3' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'R', Phaser.Input.Keyboard.Key>;

const TUNING_KEYS: Array<keyof TuningValues> = [
  'pushForce', 'brakeForce', 'steering', 'grip', 'recoilImpulse', 'baseFov', 'cameraMotion',
];

const TUNING_STEPS: Record<keyof TuningValues, number> = {
  pushForce: 50,
  brakeForce: 50,
  steering: 0.02,
  grip: 1,
  recoilImpulse: 10,
  baseFov: 1,
  cameraMotion: 0.02,
};

export class ArenaScene extends Scene3D {
  private room = 'TEST';
  private playerName = 'Rider';
  private controller!: SkateboardController;
  private keys!: KeyMap;
  private readonly socket = new GameSocket();
  private readonly audio = new SoundSynth();
  private readonly remotes = new Map<string, RemoteRider>();
  private readonly remotePool: THREE.Group[] = [];
  private readonly worldSurfaces: THREE.Object3D[] = [];
  private readonly staticVisuals: StaticVisual[] = [];
  private readonly testMode = new URLSearchParams(location.search).get('testMode') === '1';
  private remoteVisualResources: RemoteVisualResources | null = null;
  private playerId = '';
  private health = 100;
  private score = 0;
  private yaw = 0;
  private pitch = -0.08;
  private lastShotAt = -Infinity;
  private lastStateAt = -Infinity;
  private lastHudAt = -Infinity;
  private ready = false;
  private overrideInput: TestInput | null = null;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private tuning = loadTuning();
  private tuningVisible = false;
  private tuningIndex = 0;
  private hudText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private tuningText!: Phaser.GameObjects.Text;
  private tuningPanel!: Phaser.GameObjects.Rectangle;
  private crosshair!: Phaser.GameObjects.Graphics;
  private hitMarker!: Phaser.GameObjects.Graphics;
  private tutorialText!: Phaser.GameObjects.Text;
  private testSnapshots: PlayerSnapshot[] = [];
  private wasGrounded = false;
  private lastVerticalVelocity = 0;
  private cameraKick = 0;
  private speedLines!: Phaser.GameObjects.Graphics;
  private speedLinesDrawn = false;
  private receivedRemoteShots = 0;
  private networkState: NetworkState = 'connecting';
  private networkLatencyMs: number | undefined;
  private readonly remoteRotationScratch = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor() {
    super({ key: 'ArenaScene' });
  }

  init(data: ArenaData): void {
    this.room = data.room;
    this.playerName = data.name;
    this.accessThirdDimension({
      gravity: { x: 0, y: -20, z: 0 },
      fixedTimeStep: 1 / 60,
      maxSubSteps: 4,
      antialias: true,
    });
  }

  create(): void {
    this.createWorld();
    const spawnIndex = Math.abs([...this.playerName].reduce((total, char) => total + char.charCodeAt(0), 0)) % SPAWN_POINTS.length;
    this.controller = new SkateboardController(this.third, SPAWN_POINTS[spawnIndex], this.tuning);
    this.yaw = this.controller.heading;
    this.setupInput();
    this.createHud();
    this.setupNetwork();
    this.setupTestApi();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownArena());
    this.ready = true;
  }

  update(time: number, delta: number): void {
    if (!this.ready) return;
    this.updateTuning();
    const input = this.readInput();
    if (this.health <= 0 || this.tuningVisible) {
      input.forward = false;
      input.brake = false;
      input.left = false;
      input.right = false;
      input.ollie = false;
    }
    this.controller.update(input, Math.min(delta, 100) / 1_000);
    this.updateCamera(input);
    this.updateRemoteRiders();
    this.updateHud(time);
    this.drawSpeedLines(this.controller.speed);
    this.audio.updateWheels(this.controller.speed, this.controller.grounded);

    const verticalVelocity = this.controller.getVelocity()[1];
    if (!this.wasGrounded && this.controller.grounded && this.lastVerticalVelocity < -2) {
      this.audio.land(Math.abs(this.lastVerticalVelocity) / 8);
    }
    this.wasGrounded = this.controller.grounded;
    this.lastVerticalVelocity = verticalVelocity;

    const position = this.controller.chassis.position;
    if (isOutOfBounds([position.x, position.y, position.z])) this.respawnLocal();
    if (time - this.lastStateAt >= STATE_SEND_INTERVAL_MS) {
      this.socket.sendState(this.controller.getState(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')));
      this.lastStateAt = time;
    }
  }

  fire(testTargetId?: string): void {
    if (!this.ready || this.health <= 0 || performance.now() - this.lastShotAt < SHOT_COOLDOWN_MS) return;
    this.lastShotAt = performance.now();
    this.audio.shot();
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.third.camera.quaternion).normalize();
    const origin = this.third.camera.position.clone();
    this.controller.applyRecoil(direction, this.tuning.recoilImpulse);

    const raycaster = new THREE.Raycaster(origin, direction, 0, SHOT_RANGE);
    const candidates = [...this.remotes.values()].flatMap((remote) => remote.group.children);
    const remoteHit = raycaster.intersectObjects(candidates, true)[0];
    const worldHit = raycaster.intersectObjects(this.worldSurfaces, false)[0];
    const hit = remoteHit && (!worldHit || remoteHit.distance < worldHit.distance) ? remoteHit : worldHit;
    const targetId = testTargetId ?? (hit?.object.userData.playerId as string | undefined);
    const forcedTarget = testTargetId ? this.remotes.get(testTargetId) : undefined;
    const end = forcedTarget?.group.position.clone().add(new THREE.Vector3(0, 0.75, 0))
      ?? hit?.point
      ?? origin.clone().addScaledVector(direction, SHOT_RANGE);
    this.addTrail(origin, end, 0x83ffc3);
    this.addImpactSparks(end, targetId ? 0xfff06a : 0x9adfff);
    this.socket.shoot(origin.toArray() as Vec3, direction.toArray() as Vec3, targetId);
    if (targetId) this.flashHitMarker();
    if (!this.reducedMotion) this.cameraKick = Math.min(0.07, this.cameraKick + 0.035);
  }

  private createWorld(): void {
    this.worldSurfaces.length = 0;
    this.staticVisuals.length = 0;
    // Dual WebGL canvases are expensive on integrated GPUs. Render the 3D layer
    // slightly below CSS resolution and let the browser upscale it.
    this.third.renderer.setPixelRatio(Math.min(devicePixelRatio, 0.32));
    this.third.renderer.setClearColor(0x03060c);
    this.third.scene.background = new THREE.Color(0x03060c);
    this.third.scene.fog = new THREE.FogExp2(0x07101a, 0.012);
    this.third.scene.add(new THREE.HemisphereLight(0xbdeeff, 0x18343c, 2.35));
    this.third.scene.add(new THREE.AmbientLight(0x6fcfc2, 0.52));
    const sun = new THREE.DirectionalLight(0x83ffc3, 3.2);
    sun.position.set(-12, 22, 8);
    this.third.scene.add(sun);

    const concreteTexture = new THREE.TextureLoader().load('/assets/concrete-surface.png');
    concreteTexture.colorSpace = THREE.SRGBColorSpace;
    concreteTexture.wrapS = THREE.RepeatWrapping;
    concreteTexture.wrapT = THREE.RepeatWrapping;
    concreteTexture.repeat.set(8, 8);
    concreteTexture.anisotropy = Math.min(8, this.third.renderer.capabilities.getMaxAnisotropy());
    const floor = this.third.physics.add.box(
      { name: 'floor', x: 0, y: -0.5, z: 0, width: 40, height: 1, depth: 40, mass: 0 },
      { custom: new THREE.MeshStandardMaterial({ map: concreteTexture, color: 0x9aa4a5, roughness: 0.96 }) },
    );
    this.worldSurfaces.push(floor);
    this.addStaticBox(0, 2, -20, 40, 4, 2, 0, 0x19333a);
    this.addStaticBox(0, 2, 20, 40, 4, 2, 0, 0x19333a);
    this.addStaticBox(-20, 2, 0, 2, 4, 40, 0, 0x19333a);
    this.addStaticBox(20, 2, 0, 2, 4, 40, 0, 0x19333a);

    this.addStaticBox(0, 1.2, -12, 9, 0.6, 5, -0.34, 0x24444d);
    this.addStaticBox(0, 1.2, 12, 9, 0.6, 5, 0.34, 0x24444d);
    this.addStaticBox(-12, 1.2, 0, 5, 0.6, 9, 0, 0x24444d, 0.34);
    this.addStaticBox(12, 1.2, 0, 5, 0.6, 9, 0, 0x24444d, -0.34);
    // A shallow raised bowl: four banks frame a low central flat.
    this.addStaticBox(0, 0.7, -5, 8, 0.35, 3, 0.28, 0x102c35);
    this.addStaticBox(0, 0.7, 5, 8, 0.35, 3, -0.28, 0x102c35);
    this.addStaticBox(-5, 0.7, 0, 3, 0.35, 8, 0, 0x102c35, -0.28);
    this.addStaticBox(5, 0.7, 0, 3, 0.35, 8, 0, 0x102c35, 0.28);
    this.addStaticBox(-7, 1.1, -7, 4, 0.5, 6, -0.28, 0x31515a);
    this.addStaticBox(8, 0.7, 7, 3, 0.4, 5, 0.22, 0x31515a);
    this.addQuarterPipe(-1);
    this.addQuarterPipe(1);
    this.flushStaticVisuals();
    this.prewarmRemotePool();

    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.8, 0.08, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x83ffc3 }),
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.03;
    this.third.scene.add(glowRing);
  }

  private addStaticBox(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    rotationX: number,
    color: number,
    rotationZ = 0,
  ): ExtendedMesh {
    const object = this.third.add.box({ x, y, z, width, height, depth }, { phong: { color, shininess: 25 } });
    object.rotation.set(rotationX, 0, rotationZ);
    this.third.physics.add.existing(object, { shape: 'box', mass: 0 });
    object.visible = false;
    this.staticVisuals.push({
      position: new THREE.Vector3(x, y, z),
      rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, 0, rotationZ)),
      scale: new THREE.Vector3(width, height, depth),
      color: new THREE.Color(color),
    });
    return object;
  }

  private flushStaticVisuals(): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0x071b20,
      emissiveIntensity: 1.1,
      shininess: 25,
      vertexColors: true,
    });
    const instances = new THREE.InstancedMesh(geometry, material, this.staticVisuals.length);
    const matrix = new THREE.Matrix4();
    this.staticVisuals.forEach((visual, index) => {
      matrix.compose(visual.position, visual.rotation, visual.scale);
      instances.setMatrixAt(index, matrix);
      instances.setColorAt(index, visual.color);
    });
    instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    this.third.scene.add(instances);
    this.worldSurfaces.push(instances);
  }

  private addQuarterPipe(zSign: -1 | 1): void {
    const segments = 7;
    const run = 4.8;
    for (let index = 0; index < segments; index += 1) {
      const t = (index + 0.5) / segments;
      const distance = t * run;
      const height = 0.18 + 3.45 * t * t;
      const slope = (6.9 * t) / run;
      this.addStaticBox(
        0,
        height,
        zSign * (14.1 + distance),
        8.5,
        0.3,
        run / segments + 0.08,
        -zSign * Math.atan(slope),
        index % 2 === 0 ? 0x284b54 : 0x315760,
      );
    }
  }

  private setupInput(): void {
    this.keys = this.input.keyboard!.addKeys('W,S,A,D,SPACE,C,F3,UP,DOWN,LEFT,RIGHT,R') as KeyMap;
    this.input.on('pointerdown', () => {
      this.audio.unlock();
      if (!this.input.mouse?.locked && !this.tuningVisible) this.input.mouse?.requestPointerLock();
      else if (!this.tuningVisible) this.fire();
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.input.mouse?.locked || this.tuningVisible) return;
      this.yaw -= pointer.movementX * 0.0018;
      this.pitch = Phaser.Math.Clamp(this.pitch - pointer.movementY * 0.0015, -1.42, 1.28);
    });
  }

  private readInput(): SkateInput {
    if (this.overrideInput) {
      return {
        forward: Boolean(this.overrideInput.forward),
        brake: Boolean(this.overrideInput.brake),
        left: Boolean(this.overrideInput.left),
        right: Boolean(this.overrideInput.right),
        ollie: Boolean(this.overrideInput.ollie),
      };
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.yaw = this.controller.heading;
    return {
      forward: this.keys.W.isDown,
      brake: this.keys.S.isDown,
      left: this.keys.A.isDown,
      right: this.keys.D.isDown,
      ollie: this.keys.SPACE.isDown,
    };
  }

  private updateCamera(input: SkateInput): void {
    const speedRatio = Math.min(1, this.controller.speed / 18);
    const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const roll = this.reducedMotion ? 0 : turn * speedRatio * this.tuning.cameraMotion;
    const rotation = new THREE.Euler(this.pitch + this.cameraKick, this.yaw, roll, 'YXZ');
    this.third.camera.quaternion.setFromEuler(rotation);
    const boardPosition = this.controller.chassis.position;
    this.third.camera.position.set(boardPosition.x, boardPosition.y + 1.45, boardPosition.z);
    const camera = this.third.camera as THREE.PerspectiveCamera;
    camera.fov = Phaser.Math.Linear(camera.fov, this.tuning.baseFov + (this.reducedMotion ? 3 : 12) * speedRatio, 0.08);
    camera.updateProjectionMatrix();
    this.cameraKick *= 0.78;
  }

  private createHud(): void {
    this.hudText = this.add.text(22, 20, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#effff8',
      backgroundColor: '#03060caa', padding: { x: 12, y: 8 },
    }).setDepth(20);
    this.statusText = this.add.text(this.scale.width - 22, 20, 'CONNECTING', {
      fontFamily: 'monospace', fontSize: '14px', color: '#9adfff',
      backgroundColor: '#03060caa', padding: { x: 10, y: 7 },
    }).setOrigin(1, 0).setDepth(20);
    this.tutorialText = this.add.text(this.scale.width / 2, this.scale.height * 0.72,
      'RECOIL IS YOUR SECOND PUSH\nSHOOT BACKWARD: BOOST  ·  FORWARD: BRAKE  ·  DOWN: POP', {
        align: 'center',
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d9fff0',
        backgroundColor: '#03060ccc',
        padding: { x: 14, y: 10 },
        lineSpacing: 6,
      }).setOrigin(0.5).setDepth(20);
    this.crosshair = this.add.graphics().setDepth(20);
    this.hitMarker = this.add.graphics().setDepth(21).setAlpha(0);
    this.speedLines = this.add.graphics().setDepth(19);
    this.tuningPanel = this.add.rectangle(18, 82, 400, 270, 0x03060c, 0.94)
      .setOrigin(0, 0).setStrokeStyle(1, 0x83ffc3).setDepth(30).setVisible(false);
    this.tuningText = this.add.text(34, 98, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#d9fff0', lineSpacing: 7,
    }).setDepth(31).setVisible(false);
    this.drawReticle();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => {
      this.statusText.setPosition(this.scale.width - 22, 20);
      this.tutorialText.setPosition(this.scale.width / 2, this.scale.height * 0.72);
      this.drawReticle();
    });
    this.time.delayedCall(7_500, () => {
      if (!this.tutorialText.active) return;
      if (this.reducedMotion) this.tutorialText.setVisible(false);
      else this.tweens.add({ targets: this.tutorialText, alpha: 0, duration: 700 });
    });
  }

  private drawReticle(): void {
    const x = this.scale.width / 2;
    const y = this.scale.height / 2;
    this.crosshair.clear().lineStyle(2, 0xeffff8, 0.82);
    this.crosshair.lineBetween(x - 10, y, x - 3, y);
    this.crosshair.lineBetween(x + 3, y, x + 10, y);
    this.crosshair.lineBetween(x, y - 10, x, y - 3);
    this.crosshair.lineBetween(x, y + 3, x, y + 10);
  }

  private updateHud(time: number): void {
    if (time - this.lastHudAt < 100) return;
    this.lastHudAt = time;
    const velocity = this.controller.getVelocity();
    this.hudText.setText([
      `HP ${String(this.health).padStart(3, '0')}   SCORE ${this.score}/5`,
      `SPEED ${this.controller.speed.toFixed(1)} m/s`,
      `VECTOR ${velocity.map((value) => value.toFixed(1)).join(' · ')}`,
      `ROOM ${this.room}   RIDERS ${Math.min(4, this.remotes.size + 1)}/4`,
    ]);
  }

  private drawSpeedLines(speed: number): void {
    if (this.reducedMotion || speed < 7) {
      if (this.speedLinesDrawn) this.speedLines.clear();
      this.speedLinesDrawn = false;
      return;
    }
    this.speedLines.clear();
    this.speedLinesDrawn = true;
    const ratio = Phaser.Math.Clamp((speed - 7) / 13, 0, 1);
    const count = Math.round(6 + ratio * 18);
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    this.speedLines.lineStyle(1.5, 0x9adfff, 0.1 + ratio * 0.28);
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + this.game.loop.frame * 0.002;
      const inner = Math.min(this.scale.width, this.scale.height) * (0.32 + (index % 3) * 0.04);
      const length = 10 + ratio * 34;
      const x = centerX + Math.cos(angle) * inner;
      const y = centerY + Math.sin(angle) * inner;
      this.speedLines.lineBetween(x, y, x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    }
  }

  private updateTuning(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.F3)) {
      this.tuningVisible = !this.tuningVisible;
      this.tuningPanel.setVisible(this.tuningVisible);
      this.tuningText.setVisible(this.tuningVisible);
      if (this.tuningVisible) this.input.mouse?.releasePointerLock();
    }
    if (!this.tuningVisible) return;
    let changed = false;
    if (Phaser.Input.Keyboard.JustDown(this.keys.UP)) this.tuningIndex = (this.tuningIndex - 1 + TUNING_KEYS.length) % TUNING_KEYS.length;
    if (Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) this.tuningIndex = (this.tuningIndex + 1) % TUNING_KEYS.length;
    const selected = TUNING_KEYS[this.tuningIndex];
    if (Phaser.Input.Keyboard.JustDown(this.keys.LEFT)) {
      this.tuning[selected] = Math.max(0, this.tuning[selected] - TUNING_STEPS[selected]);
      changed = true;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.RIGHT)) {
      this.tuning[selected] += TUNING_STEPS[selected];
      changed = true;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
      this.tuning = { ...TUNING_DEFAULTS };
      changed = true;
    }
    if (changed) {
      saveTuning(this.tuning);
      this.controller.setTuning(this.tuning);
    }
    this.tuningText.setText([
      'LIVE PHYSICS TUNING  [F3 CLOSE]',
      '↑↓ SELECT  ←→ CHANGE  R RESET',
      '',
      ...TUNING_KEYS.map((key, index) => `${index === this.tuningIndex ? '>' : ' '} ${key.padEnd(15)} ${this.tuning[key].toFixed(2)}`),
    ]);
  }

  private setupNetwork(): void {
    this.socket.onStatus((status) => {
      this.renderNetworkStatus(status);
    });
    this.socket.onMessage((message) => this.handleNetworkMessage(message));
    this.socket.connect(this.room, this.playerName);
  }

  private handleNetworkMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        if (this.playerId && this.playerId !== message.playerId) {
          [...this.remotes.keys()].forEach((id) => this.removeRemote(id));
        }
        this.playerId = message.playerId;
        {
          const localPlayer = message.players.find((player) => player.id === this.playerId);
          this.health = localPlayer?.health ?? 100;
          this.score = localPlayer?.score ?? 0;
          this.testSnapshots = message.players.filter((player) => player.id !== this.playerId);
          this.testSnapshots.forEach((player) => this.upsertRemote(player));
        }
        break;
      case 'snapshot':
        this.testSnapshots = message.players.filter((player) => player.id !== this.playerId);
        {
          [...this.remotes.keys()]
            .filter((id) => !this.testSnapshots.some((player) => player.id === id))
            .forEach((id) => this.removeRemote(id));
        }
        this.testSnapshots.forEach((player) => this.upsertRemote(player));
        break;
      case 'peerJoined':
        if (message.player.id !== this.playerId) this.upsertRemote(message.player);
        break;
      case 'peerLeft':
        this.removeRemote(message.playerId);
        break;
      case 'shot':
        if (message.playerId !== this.playerId) {
          this.receivedRemoteShots += 1;
          const origin = new THREE.Vector3(...message.origin);
          const direction = new THREE.Vector3(...message.direction);
          this.addTrail(origin, origin.clone().addScaledVector(direction, SHOT_RANGE), 0xff5fa2);
        }
        break;
      case 'damage':
        if (message.targetId === this.playerId) {
          this.health = message.health;
          this.audio.hit();
        }
        break;
      case 'score':
        if (message.playerId === this.playerId) this.score = message.score;
        if (message.winnerId) this.showWinner(message.winnerId);
        break;
      case 'respawn':
        if (message.playerId === this.playerId) {
          this.health = message.health;
          this.respawnLocal();
        }
        break;
      case 'error':
        this.statusText.setText(message.code).setColor('#fff06a');
        break;
      default:
        break;
    }
  }

  private renderNetworkStatus(status: NetworkStatus): void {
    this.networkState = status.state;
    this.networkLatencyMs = status.latencyMs;
    let label = status.state.toUpperCase();
    let color = '#9adfff';
    if (status.state === 'connected') {
      label = status.latencyMs === undefined ? 'ONLINE' : `ONLINE · ${status.latencyMs}ms`;
      color = '#83ffc3';
    } else if (status.state === 'reconnecting') {
      const seconds = Math.max(1, Math.ceil((status.retryInMs ?? 1_000) / 1_000));
      label = `RECONNECTING · ${seconds}s`;
      color = '#fff06a';
    } else if (status.state === 'error') {
      label = 'NETWORK ERROR';
      color = '#ff8bb9';
    } else if (status.state === 'disconnected') {
      label = 'OFFLINE';
      color = '#ff8bb9';
    }
    this.statusText.setText(label).setColor(color);
  }

  private upsertRemote(snapshot: PlayerSnapshot): void {
    let remote = this.remotes.get(snapshot.id);
    if (!remote) {
      const group = this.createRemoteRider(snapshot.id);
      remote = {
        group,
        snapshot,
        frames: [],
      };
      this.remotes.set(snapshot.id, remote);
    }
    const frame = remote.frames.length >= 6
      ? remote.frames.shift()!
      : { receivedAt: 0, position: new THREE.Vector3(), rotation: new THREE.Quaternion() };
    frame.receivedAt = performance.now();
    frame.position.set(...snapshot.position);
    this.remoteRotationScratch.set(...snapshot.rotation, 'YXZ');
    frame.rotation.setFromEuler(this.remoteRotationScratch);
    if (remote.frames.length === 0) {
      remote.group.position.copy(frame.position);
      remote.group.quaternion.copy(frame.rotation);
    }
    remote.snapshot = snapshot;
    remote.frames.push(frame);
    remote.group.visible = snapshot.alive;
  }

  private createRemoteRider(playerId: string): THREE.Group {
    const group = this.remotePool.pop() ?? this.buildRemoteRider();
    group.visible = true;
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.userData.playerId = playerId;
    });
    return group;
  }

  private buildRemoteRider(): THREE.Group {
    const group = new THREE.Group();
    const resources = this.getRemoteVisualResources();
    const deck = new THREE.Mesh(
      resources.deckGeometry,
      resources.deckMaterial,
    );
    const body = new THREE.Mesh(
      resources.bodyGeometry,
      resources.bodyMaterial,
    );
    body.position.y = 0.72;
    const head = new THREE.Mesh(
      resources.headGeometry,
      resources.headMaterial,
    );
    head.position.y = 1.48;
    group.add(deck, body, head);
    group.visible = false;
    this.third.scene.add(group);
    return group;
  }

  private prewarmRemotePool(): void {
    this.remotePool.length = 0;
    for (let index = 0; index < 3; index += 1) this.remotePool.push(this.buildRemoteRider());
  }

  private getRemoteVisualResources(): RemoteVisualResources {
    if (this.remoteVisualResources) return this.remoteVisualResources;
    this.remoteVisualResources = {
      deckGeometry: new THREE.BoxGeometry(0.72, 0.13, 1.75),
      bodyGeometry: new THREE.CapsuleGeometry(0.28, 0.85, 5, 10),
      headGeometry: new THREE.SphereGeometry(0.22, 12, 10),
      deckMaterial: new THREE.MeshStandardMaterial({ color: 0x83ffc3, roughness: 0.88 }),
      bodyMaterial: new THREE.MeshStandardMaterial({ color: 0xff5fa2, roughness: 0.6 }),
      headMaterial: new THREE.MeshStandardMaterial({ color: 0x9adfff, roughness: 0.3, metalness: 0.25 }),
    };
    return this.remoteVisualResources;
  }

  private updateRemoteRiders(): void {
    const playbackTime = performance.now() - REMOTE_INTERPOLATION_BUFFER_MS;
    this.remotes.forEach((remote) => {
      while (remote.frames.length > 2 && remote.frames[1].receivedAt <= playbackTime) remote.frames.shift();
      const before = remote.frames[0];
      const after = remote.frames[1];
      if (!before) return;
      if (!after) {
        remote.group.position.lerp(before.position, 0.18);
        remote.group.quaternion.slerp(before.rotation, 0.15);
        return;
      }
      const duration = Math.max(1, after.receivedAt - before.receivedAt);
      const alpha = Phaser.Math.Clamp((playbackTime - before.receivedAt) / duration, 0, 1);
      remote.group.position.lerpVectors(before.position, after.position, alpha);
      remote.group.quaternion.slerpQuaternions(before.rotation, after.rotation, alpha);
    });
  }

  private removeRemote(playerId: string): void {
    const remote = this.remotes.get(playerId);
    if (!remote) return;
    remote.group.visible = false;
    remote.group.traverse((object) => {
      if (object instanceof THREE.Mesh) delete object.userData.playerId;
    });
    this.remotePool.push(remote.group);
    this.remotes.delete(playerId);
  }

  private addTrail(origin: THREE.Vector3, end: THREE.Vector3, color: number): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.third.scene.add(line);
    this.tweens.addCounter({
      from: 0.9,
      to: 0,
      duration: 280,
      onUpdate: (tween) => ((line.material as THREE.LineBasicMaterial).opacity = tween.getValue() ?? 0),
      onComplete: () => {
        this.third.scene.remove(line);
        geometry.dispose();
        (line.material as THREE.Material).dispose();
      },
    });
  }

  private addImpactSparks(point: THREE.Vector3, color: number): void {
    const positions: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2;
      positions.push(
        point.x + Math.cos(angle) * 0.12,
        point.y + ((index % 3) - 1) * 0.1,
        point.z + Math.sin(angle) * 0.12,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color, size: 0.12, transparent: true, opacity: 1 });
    const sparks = new THREE.Points(geometry, material);
    this.third.scene.add(sparks);
    this.tweens.addCounter({
      from: 1,
      to: 0,
      duration: 180,
      onUpdate: (tween) => {
        const value = tween.getValue() ?? 0;
        material.opacity = value;
        sparks.scale.setScalar(1 + (1 - value) * 3);
      },
      onComplete: () => {
        this.third.scene.remove(sparks);
        geometry.dispose();
        material.dispose();
      },
    });
  }

  private flashHitMarker(): void {
    const x = this.scale.width / 2;
    const y = this.scale.height / 2;
    this.hitMarker.clear().lineStyle(3, 0xfff06a, 1);
    this.hitMarker.lineBetween(x - 12, y - 12, x - 5, y - 5);
    this.hitMarker.lineBetween(x + 12, y - 12, x + 5, y - 5);
    this.hitMarker.lineBetween(x - 12, y + 12, x - 5, y + 5);
    this.hitMarker.lineBetween(x + 12, y + 12, x + 5, y + 5);
    this.tweens.add({ targets: this.hitMarker, alpha: { from: 1, to: 0 }, duration: 180 });
  }

  private showWinner(winnerId: string): void {
    const label = winnerId === this.playerId ? 'YOU WIN' : 'RIVAL WINS';
    this.add.text(this.scale.width / 2, this.scale.height / 2, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '64px', fontStyle: 'bold', color: '#83ffc3',
      stroke: '#03060c', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(50);
  }

  private respawnLocal(): void {
    const index = Math.floor(Math.random() * SPAWN_POINTS.length);
    this.controller.respawn(SPAWN_POINTS[index]);
    this.yaw = this.controller.heading;
  }

  private setupTestApi(): void {
    if (!this.testMode) return;
    const scene = this;
    window.__gameTest = {
      get ready() { return scene.ready; },
      get localPlayer() {
        return {
          ...scene.controller.getState(new THREE.Euler(scene.pitch, scene.yaw, 0, 'YXZ')),
          health: scene.health,
          score: scene.score,
          speed: scene.controller.speed,
          fps: scene.game.loop.actualFps,
        };
      },
      get remotePlayers() { return scene.testSnapshots; },
      get events() {
        return {
          remoteShots: scene.receivedRemoteShots,
          tuningVisible: scene.tuningVisible,
          networkState: scene.networkState,
          latencyMs: scene.networkLatencyMs,
        };
      },
      setInput(input: TestInput) {
        scene.overrideInput = { ...input };
        if (Number.isFinite(input.yaw)) scene.yaw = input.yaw!;
        if (Number.isFinite(input.pitch)) scene.pitch = Phaser.Math.Clamp(input.pitch!, -1.42, 1.28);
      },
      fire(targetId?: string) { scene.fire(targetId); },
      advance(milliseconds: number) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); },
    };
  }

  private shutdownArena(): void {
    this.ready = false;
    this.socket.close();
    this.controller?.destroy();
    this.remotes.forEach((remote) => this.third.scene.remove(remote.group));
    this.remotePool.forEach((group) => this.third.scene.remove(group));
    this.remotePool.length = 0;
    this.remotes.clear();
    delete window.__gameTest;
  }
}
