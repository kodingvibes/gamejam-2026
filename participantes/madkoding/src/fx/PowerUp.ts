// ─── PowerUp: drops from destroyed enemies, floats toward the player ────────

import * as THREE from 'three';

export type PowerUpType = 'HEALTH' | 'BOMB';

export class PowerUp {
  private group: THREE.Group;
  private _type: PowerUpType = 'HEALTH';
  private _active = false;
  private _velocity = new THREE.Vector3();
  private _age = 0;
  private _maxAge = 15;
  private _spin = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
  }

  get type(): PowerUpType { return this._type; }
  get active(): boolean { return this._active; }
  get position(): THREE.Vector3 { return this.group.position; }
  get mesh(): THREE.Group { return this.group; }

  init(position: THREE.Vector3, type: PowerUpType): void {
    this._type = type;
    this._active = true;
    this._age = 0;
    this._spin = Math.random() * Math.PI * 2;
    this.group.position.copy(position);
    this.group.visible = true;
    this.group.clear();

    const color = type === 'HEALTH' ? 0x00ff66 : 0xff8800;
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    // Octahedron core
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), mat);
    this.group.add(core);
    // Glow halo
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.group.add(halo);
    // Ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.05, 6, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);
  }

  update(dt: number, playerPos: THREE.Vector3): { collected: boolean } {
    if (!this._active) return { collected: false };
    this._age += dt;
    this._spin += dt * 3;

    // Float and slowly drift toward the player
    const toPlayer = playerPos.clone().sub(this.group.position);
    const dist = toPlayer.length();
    toPlayer.normalize();
    this._velocity.lerp(toPlayer.multiplyScalar(15), 0.02);
    this.group.position.add(this._velocity.clone().multiplyScalar(dt));

    // Spin
    this.group.rotation.y = this._spin;
    this.group.rotation.z = this._spin * 0.7;

    // Collected when close to player
    if (dist < 2.5) {
      this._active = false;
      this.group.visible = false;
      return { collected: true };
    }

    // Expire
    if (this._age > this._maxAge) {
      this._active = false;
      this.group.visible = false;
    }
    return { collected: false };
  }

  reset(): void {
    this._active = false;
    this.group.visible = false;
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
    this.group.traverse((c) => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    });
  }
}