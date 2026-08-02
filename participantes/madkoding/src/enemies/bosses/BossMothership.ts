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
  private declare engineGlows: THREE.Mesh[];
  private attackTimer = 0;
  private attackInterval = 2;
  private volleyEven = false;

  constructor() {
    super(BOSS.MOTHERSHIP);
  }

  protected buildMesh(): void {
    // Field initializers run AFTER the base constructor calls buildMesh(),
    // so initialize these arrays here.
    this.turrets = [];
    this.engineGlows = [];

    // ── Main body (large disc-like hull) ──
    const bodyMat = new THREE.MeshPhongMaterial({
      color: this._color,
      emissive: this._color,
      emissiveIntensity: 0.2,
      shininess: 40,
    });

    // Central hull (flattened sphere)
    const hullGeo = new THREE.SphereGeometry(this._size * 0.6, 16, 12);
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

    // ── Shield bubble ──
    const shieldMat = new THREE.MeshPhongMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.12,
      emissive: 0x44aaff,
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide,
    });
    const shieldGeo = new THREE.SphereGeometry(this._size * 0.9, 20, 20);
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

    // ── Engine glows ──
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.5,
    });
    for (let idx = -2; idx <= 2; idx += 1.5) {
      const glowGeo = new THREE.CircleGeometry(0.4, 8);
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(idx, 0, -this._size * 0.8);
      glow.rotation.x = Math.PI / 2;
      this.group.add(glow);
      this.engineGlows.push(glow);
    }

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
        (this.shield.material as THREE.MeshPhongMaterial).color.setHex(0xff4444);
        (this.shield.material as THREE.MeshPhongMaterial).emissive.setHex(0xff4444);
        break;
      case 3:
        // Phase 3: enraged
        this.attackInterval = 0.6;
        (this.core.material as THREE.MeshBasicMaterial).color.setHex(0xff0000);
        (this.shield.material as THREE.MeshPhongMaterial).color.setHex(0xff0000);
        (this.shield.material as THREE.MeshPhongMaterial).opacity = 0.3;
        break;
    }
  }

  init(position: THREE.Vector3): void {
    super.init(position);
    this.attackTimer = 0;
    this.attackInterval = 2;
    this.volleyEven = false;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this._active) return;
    super.update(dt, playerPos);

    // Maintain a standoff position ~45 units ahead of the player (don't chase into them)
    const desiredZ = playerPos.z - 45;
    const dz = desiredZ - this.group.position.z;
    this.group.position.z += dz * 0.8 * dt;
    // Slight lateral drift for visual interest
    this.group.position.x = Math.sin(this._age * 0.4) * 4;

    // Always face the player
    this.group.lookAt(playerPos);

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

    // Shield pulse
    (this.shield.material as THREE.MeshPhongMaterial).opacity =
      Math.sin(this._age * 2) * 0.1 + 0.2;

    // Engine glow pulse
    for (const glow of this.engineGlows) {
      (glow.material as THREE.MeshBasicMaterial).opacity =
        Math.sin(this._age * 4 + glow.position.x) * 0.3 + 0.5;
    }

    // Attack timer
    this.attackTimer += dt;
  }

  canAttack(): boolean {
    return this._active && this.attackTimer >= this.attackInterval;
  }

  resetAttackTimer(): void {
    this.attackTimer = 0;
  }

  // Alternate volley: fire from every other turret, alternating each volley
  computeVolley(playerPos: THREE.Vector3): { position: THREE.Vector3; dir: THREE.Vector3 }[] {
    this.volleyEven = !this.volleyEven;
    const shots: { position: THREE.Vector3; dir: THREE.Vector3 }[] = [];
    const turrets = this.getTurretPositions();
    for (let idx = 0; idx < turrets.length; idx++) {
      if ((idx % 2 === 0) !== this.volleyEven) continue;
      shots.push({
        position: turrets[idx],
        dir: playerPos.clone().sub(turrets[idx]).normalize(),
      });
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
    this.attackInterval = 2;
    this.volleyEven = false;
    (this.core.material as THREE.MeshBasicMaterial).color.setHex(0xff8844);
    (this.shield.material as THREE.MeshPhongMaterial).color.setHex(0x44aaff);
    (this.shield.material as THREE.MeshPhongMaterial).emissive.setHex(0x44aaff);
    (this.shield.material as THREE.MeshPhongMaterial).opacity = 0.15;
  }
}
