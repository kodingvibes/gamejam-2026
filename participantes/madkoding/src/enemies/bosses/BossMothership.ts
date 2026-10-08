// ─── Boss Mothership ─────────────────────────────────────────────────────────

import * as THREE from 'three';
import { BOSS } from '../../types/config';
import { BossBase } from './BossBase';

export class BossMothership extends BossBase {
  // Assigned in buildMesh(), which runs from the base constructor. With
  // useDefineForClassFields (ES2022), plain field declarations would clobber
  // them with `undefined` after super(), so declare them as ambient.
  private declare turrets: THREE.Mesh[];
  private declare core: THREE.Mesh;
  private declare shield: THREE.Mesh;
  private declare hullMat: THREE.MeshPhongMaterial;
  private declare coreHalo: THREE.Sprite;
  private attackTimer = 0;
  private attackInterval = 2;
  private volleyEven = false;
  private volleyCount = 0;
  private hitFlash = 0;
  private _desired = new THREE.Vector3();

  constructor() {
    super(BOSS.MOTHERSHIP);
  }

  protected buildMesh(): void {
    // Field initializers run AFTER the base constructor calls buildMesh(),
    // so initialize these arrays here.
    this.turrets = [];

    // ── Main body (large disc-like hull) ──
    const bodyMat = new THREE.MeshPhongMaterial({
      color: this._color,
      emissive: this._color,
      emissiveIntensity: 0.2,
      shininess: 40,
    });

    // Central hull (flattened sphere)
    const hullGeo = new THREE.SphereGeometry(this._size * 0.6, 16, 12);
    this.hullMat = bodyMat;
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.scale.set(1.8, 0.5, 1.2);
    this.group.add(hull);

    // Upper deck
    const deckMat = new THREE.MeshPhongMaterial({
      color: 0x884422,
      emissive: 0x442211,
      emissiveIntensity: 0.1,
    });
    const deckGeo = new THREE.CylinderGeometry(this._size * 0.8, this._size * 0.9, 0.3, 16);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = this._size * 0.3;
    this.group.add(deck);

    // Lower hull panels
    const panelMat = new THREE.MeshPhongMaterial({
      color: 0x664422,
      emissive: 0x221100,
      emissiveIntensity: 0.1,
    });
    for (let idx = 0; idx < 6; idx++) {
      const angle = (idx / 6) * Math.PI * 2;
      const panelGeo = new THREE.BoxGeometry(0.8, 0.1, 1.5);
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(
        Math.cos(angle) * this._size * 0.7,
        -this._size * 0.2,
        Math.sin(angle) * this._size * 0.5
      );
      panel.rotation.y = -angle;
      this.group.add(panel);
    }

    // ── Core (glowing sphere) ──
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xff8844,
      transparent: true,
      opacity: 0.8,
    });
    const coreGeo = new THREE.SphereGeometry(this._size * 0.25, 12, 12);
    this.core = new THREE.Mesh(coreGeo, coreMat);
    this.core.position.y = 0.5;
    this.group.add(this.core);

    // Pulsing reactor halo (bloom makes it bleed light).
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = haloCanvas.height = 64;
    const hctx = haloCanvas.getContext('2d')!;
    const hg = hctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    hg.addColorStop(0, 'rgba(255,255,255,1)');
    hg.addColorStop(0.3, 'rgba(255,200,140,0.6)');
    hg.addColorStop(1, 'rgba(255,120,40,0)');
    hctx.fillStyle = hg;
    hctx.fillRect(0, 0, 64, 64);
    this.coreHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(haloCanvas), color: 0xff8844, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.coreHalo.position.y = 0.5;
    this.coreHalo.scale.setScalar(this._size * 1.4);
    this.group.add(this.coreHalo);

    // Core ring (rotating)
    const ringMat = new THREE.MeshPhongMaterial({
      color: 0xff8844,
      emissive: 0xff4400,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.6,
    });
    const ringGeo = new THREE.TorusGeometry(this._size * 0.4, 0.05, 8, 24);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.5;
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);

    // ── Shield bubble: fresnel rim + scrolling hex cells, transparent core ──
    const shieldMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x44aaff) },
        uTime: { value: 0 },
        uHit: { value: 0 },
        uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          vP = position;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uTime; uniform float uHit; uniform float uOpacity;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        float hex(vec2 p) {
          p = abs(p);
          return max(p.x * 0.866 + p.y * 0.5, p.y);
        }
        void main() {
          float rim = pow(1.0 - abs(dot(vN, vV)), 2.5);
          vec3 n = normalize(vP);
          vec2 uv = vec2(atan(n.z, n.x) * 3.0, n.y * 5.0 + uTime * 0.3);
          vec2 cell = vec2(1.0, 1.732);
          vec2 a = mod(uv, cell) - cell * 0.5;
          vec2 b = mod(uv - cell * 0.5, cell) - cell * 0.5;
          vec2 g = dot(a, a) < dot(b, b) ? a : b;
          float edge = smoothstep(0.42, 0.48, hex(g));
          float scan = 0.5 + 0.5 * sin(n.y * 12.0 - uTime * 3.0);
          float alpha = (rim * 0.9 + edge * (0.12 + rim * 0.5) * scan + uHit * (0.25 + edge * 0.6)) * uOpacity;
          gl_FragColor = vec4(uColor * (1.4 + uHit * 2.0), alpha);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const shieldGeo = new THREE.SphereGeometry(this._size * 0.9, 40, 28);
    this.shield = new THREE.Mesh(shieldGeo, shieldMat);
    this.group.add(this.shield);

    // ── Turrets ──
    const turretMat = new THREE.MeshPhongMaterial({
      color: 0xcc3333,
      emissive: 0xff4444,
      emissiveIntensity: 0.3,
    });
    const turretPositions = [
      new THREE.Vector3(-3, 0.5, 2),
      new THREE.Vector3(3, 0.5, 2),
      new THREE.Vector3(-2.5, -0.3, -2),
      new THREE.Vector3(2.5, -0.3, -2),
      new THREE.Vector3(-1.5, 0.8, 0),
      new THREE.Vector3(1.5, 0.8, 0),
    ];
    for (const pos of turretPositions) {
      // Turret base
      const baseGeo = new THREE.CylinderGeometry(0.3, 0.5, 0.4, 6);
      const base = new THREE.Mesh(baseGeo, turretMat);
      base.position.copy(pos);
      this.group.add(base);

      // Turret barrel
      const barrelMat = new THREE.MeshPhongMaterial({
        color: 0x888888,
        emissive: 0x444444,
        emissiveIntensity: 0.2,
      });
      const barrelGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.5, 6);
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.position.set(pos.x, pos.y + 0.3, pos.z);
      barrel.rotation.x = Math.PI / 2;
      this.group.add(barrel);

      // Store turret mesh for reference
      this.turrets.push(base);
    }

    // ── Central cannon ──
    const cannonMat = new THREE.MeshPhongMaterial({
      color: 0x666666,
      emissive: 0x444444,
      emissiveIntensity: 0.3,
    });
    const cannonGeo = new THREE.CylinderGeometry(0.2, 0.4, 1.5, 8);
    const cannon = new THREE.Mesh(cannonGeo, cannonMat);
    cannon.position.set(0, 0, -this._size * 0.6);
    cannon.rotation.x = Math.PI / 2;
    this.group.add(cannon);

    // Cannon tip glow
    const tipMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.7,
    });
    const tipGeo = new THREE.SphereGeometry(0.2, 6, 6);
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(0, 0, -this._size * 0.6 - 0.8);
    this.group.add(tip);

    // ── Rotating ring (visual flair) ──
    const ring2Mat = new THREE.MeshPhongMaterial({
      color: 0x44aaff,
      emissive: 0x2244aa,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.4,
    });
    const ring2Geo = new THREE.TorusGeometry(this._size * 0.7, 0.04, 8, 32);
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.position.y = 0.2;
    ring2.rotation.x = Math.PI / 3;
    this.group.add(ring2);

    // Scale the whole group
    this.group.scale.set(1, 1, 1);
  }

  protected onPhaseChange(phase: number): void {
    switch (phase) {
      case 2:
        // Phase 2: faster attacks, spawn drones
        this.attackInterval = 1.2;
        // Change shield color
        this.shieldUniforms.uColor.value.setHex(0xff7744);
        break;
      case 3:
        // Phase 3: enraged
        this.attackInterval = 0.85;
        (this.core.material as THREE.MeshBasicMaterial).color.setHex(0xff0000);
        this.shieldUniforms.uColor.value.setHex(0xff2244);
        break;
    }
  }

  init(position: THREE.Vector3): void {
    super.init(position);
    this.attackTimer = -2.5; // grace period while it swoops in
    this.attackInterval = 2;
    this.volleyEven = false;
    this.volleyCount = 0;
    this.hitFlash = 0;
  }

  takeDamage(amount: number): boolean {
    this.hitFlash = 1;
    return super.takeDamage(amount);
  }

  /**
   * @param anchor point on the rail ~45 units ahead of the ship. The boss
   * holds station around it (the old version used absolute world X/Y, so on
   * winding rails it hovered off to the side of the path).
   */
  update(dt: number, playerPos: THREE.Vector3, anchor?: THREE.Vector3): void {
    if (!this._active) return;
    super.update(dt, playerPos);

    const a = anchor ?? this._desired.set(0, 0, playerPos.z - 45);
    const sway = this._currentPhase >= 3 ? 1.6 : 1;
    this._desired.set(
      a.x + Math.sin(this._age * 0.45 * sway) * 7,
      a.y + 2 + Math.sin(this._age * 0.7 * sway) * 3,
      a.z,
    );
    // Critically-damped follow: fast swoop-in on entry, smooth afterwards.
    const k = 1 - Math.exp(-(this._age < 3 ? 1.6 : 2.4) * dt);
    this.group.position.lerp(this._desired, k);

    // Always face the player
    this.group.lookAt(playerPos);

    // Hit flash on the hull + phase-tinted reactor halo.
    this.hitFlash = Math.max(0, this.hitFlash - dt * 8);
    this.hullMat.emissiveIntensity = 0.2 + this.hitFlash * 1.6;
    const haloPulse = 1 + Math.sin(this._age * (2 + this._currentPhase * 2)) * 0.18 + this.hitFlash * 0.3;
    this.coreHalo.scale.setScalar(this._size * 1.4 * haloPulse);

    // Rotate slowly
    this.group.rotation.z += dt * 0.3;

    // Rotating ring animation
    const ring = this.group.children.find(c => c instanceof THREE.Mesh && c.geometry.type === 'TorusGeometry' && c.position.y === 0.5);
    if (ring) {
      ring.rotation.z += dt * 1.5;
    }
    const ring2 = this.group.children.find(c => c instanceof THREE.Mesh && c.geometry.type === 'TorusGeometry' && c.position.y === 0.2);
    if (ring2) {
      ring2.rotation.y += dt * 0.8;
      ring2.rotation.x = Math.PI / 3 + Math.sin(this._age * 0.5) * 0.2;
    }

    // Core pulse
    const pulse = Math.sin(this._age * 3) * 0.3 + 0.7;
    (this.core.material as THREE.MeshBasicMaterial).opacity = pulse;

    // Shield shader: scroll + flare on hits
    this.shieldUniforms.uTime.value = this._age;
    this.shieldUniforms.uHit.value = this.hitFlash;

    // Attack timer
    this.attackTimer += dt;
  }

  private get shieldUniforms(): { uColor: { value: THREE.Color }; uTime: { value: number }; uHit: { value: number }; uOpacity: { value: number } } {
    return (this.shield.material as THREE.ShaderMaterial).uniforms as never;
  }

  canAttack(): boolean {
    return this._active && this.attackTimer >= this.attackInterval;
  }

  resetAttackTimer(): void {
    this.attackTimer = 0;
  }

  // Phase 1: alternating turret volley · Phase 2: + aimed fan from the core
  // Phase 3: + rotating ring burst. Each pattern leaves dodgeable gaps.
  computeVolley(playerPos: THREE.Vector3): { position: THREE.Vector3; dir: THREE.Vector3 }[] {
    this.volleyEven = !this.volleyEven;
    this.volleyCount++;
    const shots: { position: THREE.Vector3; dir: THREE.Vector3 }[] = [];
    const turrets = this.getTurretPositions();
    for (let idx = 0; idx < turrets.length; idx++) {
      if ((idx % 2 === 0) !== this.volleyEven) continue;
      shots.push({
        position: turrets[idx],
        dir: playerPos.clone().sub(turrets[idx]).normalize(),
      });
    }
    const corePos = new THREE.Vector3();
    this.core.getWorldPosition(corePos);
    const toPlayer = playerPos.clone().sub(corePos).normalize();
    const right = new THREE.Vector3().crossVectors(toPlayer, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, toPlayer).normalize();
    if (this._currentPhase >= 2 && this.volleyCount % 2 === 0) {
      for (let i = -2; i <= 2; i++) {
        shots.push({ position: corePos.clone(), dir: toPlayer.clone().addScaledVector(right, i * 0.09).normalize() });
      }
    }
    if (this._currentPhase >= 3 && this.volleyCount % 3 === 0) {
      const n = 10;
      const spin = this._age * 1.3;
      for (let i = 0; i < n; i++) {
        const ang = spin + (i / n) * Math.PI * 2;
        const dir = toPlayer.clone()
          .addScaledVector(right, Math.cos(ang) * 0.28)
          .addScaledVector(up, Math.sin(ang) * 0.28)
          .normalize();
        shots.push({ position: corePos.clone(), dir });
      }
    }
    return shots;
  }

  getTurretPositions(): THREE.Vector3[] {
    return this.turrets.map(t => {
      const worldPos = new THREE.Vector3();
      t.getWorldPosition(worldPos);
      return worldPos;
    });
  }

  reset(): void {
    super.reset();
    this.attackTimer = 0;
    this.volleyCount = 0;
    this.hitFlash = 0;
    this.hullMat.emissiveIntensity = 0.2;
    this.coreHalo.scale.setScalar(this._size * 1.4);
    this.attackInterval = 2;
    this.volleyEven = false;
    (this.core.material as THREE.MeshBasicMaterial).color.setHex(0xff8844);
    this.shieldUniforms.uColor.value.setHex(0x44aaff);
    this.shieldUniforms.uHit.value = 0;
  }
}
