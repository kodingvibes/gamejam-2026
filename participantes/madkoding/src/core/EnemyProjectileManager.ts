// ─── Enemy Projectile Manager: plasma bolts + collision with player ─────────
// Swept (segment) collision so fast bolts can't tunnel through the ship, and
// distance-based culling so curved rails don't delete live shots. While the
// player is barrel-rolling, bolts are deflected instead of dealing damage.

import * as THREE from 'three';
import { PLAYER } from '../types/config';
import { AudioManager } from '../audio/AudioManager';

const BOLT_COLOR = 0xff3355;
const BOLT_RADIUS = 0.22;
const BOLT_LENGTH = 3.2;
const BOLT_SPEED = 200;
const MAX_DIST = 320;

interface EnemyProjectile {
  position: THREE.Vector3;
  prev: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Mesh;
  active: boolean;
  deflected: boolean;
  age: number;
}

const _seg = new THREE.Vector3();
const _toP = new THREE.Vector3();
const _closest = new THREE.Vector3();

function segmentDistance(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  _seg.subVectors(b, a);
  const len2 = _seg.lengthSq();
  if (len2 < 1e-6) return p.distanceTo(a);
  const t = THREE.MathUtils.clamp(_toP.subVectors(p, a).dot(_seg) / len2, 0, 1);
  _closest.copy(a).addScaledVector(_seg, t);
  return p.distanceTo(_closest);
}

export class EnemyProjectileManager {
  private scene: THREE.Scene;
  private projectiles: EnemyProjectile[] = [];
  private geo: THREE.BufferGeometry;
  private haloGeo: THREE.BufferGeometry;
  private coreMat: THREE.MeshBasicMaterial;
  private haloMat: THREE.MeshBasicMaterial;
  private deflectMat: THREE.MeshBasicMaterial;
  /** World positions of bolts deflected this frame (for spark FX). */
  readonly deflections: THREE.Vector3[] = [];

  constructor(private audio: AudioManager, scene: THREE.Scene, poolSize = 80) {
    this.scene = scene;
    this.geo = new THREE.CapsuleGeometry(BOLT_RADIUS, BOLT_LENGTH, 3, 8);
    this.geo.rotateX(Math.PI / 2);
    this.haloGeo = new THREE.CapsuleGeometry(BOLT_RADIUS * 2.8, BOLT_LENGTH * 1.1, 3, 8);
    this.haloGeo.rotateX(Math.PI / 2);
    this.coreMat = new THREE.MeshBasicMaterial({
      color: 0xffe0e6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.haloMat = new THREE.MeshBasicMaterial({
      color: BOLT_COLOR, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.deflectMat = new THREE.MeshBasicMaterial({
      color: 0x66ffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (let i = 0; i < poolSize; i++) {
      const mesh = new THREE.Mesh(this.geo, this.coreMat);
      const halo = new THREE.Mesh(this.haloGeo, this.haloMat);
      halo.name = 'halo';
      mesh.add(halo);
      mesh.visible = false;
      mesh.renderOrder = 999;
      scene.add(mesh);
      this.projectiles.push({
        position: new THREE.Vector3(), prev: new THREE.Vector3(), velocity: new THREE.Vector3(),
        mesh, active: false, deflected: false, age: 0,
      });
    }
  }

  spawn(position: THREE.Vector3, direction: THREE.Vector3, speed = BOLT_SPEED): void {
    const slot = this.projectiles.find(p => !p.active);
    if (!slot) return;
    this.audio.playEnemyLaser();
    slot.active = true;
    slot.deflected = false;
    slot.age = 0;
    slot.position.copy(position);
    slot.prev.copy(position);
    slot.velocity.copy(direction).normalize().multiplyScalar(speed);
    slot.mesh.position.copy(position);
    slot.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _seg.copy(slot.velocity).normalize());
    (slot.mesh.children[0] as THREE.Mesh).material = this.haloMat;
    slot.mesh.visible = true;
  }

  /**
   * Advance bolts. Returns hit=true if a bolt struck the player this frame.
   * When `deflecting` is true (barrel roll) bolts bounce off instead.
   */
  update(dt: number, playerPos: THREE.Vector3, deflecting = false, invulnerable = false): { hit: boolean } {
    let hit = false;
    this.deflections.length = 0;
    const hitRadius = PLAYER.HITBOX_RADIUS;
    const deflectRadius = PLAYER.HITBOX_RADIUS * 2.4;

    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.age += dt;
      p.prev.copy(p.position);
      p.position.addScaledVector(p.velocity, dt);
      p.mesh.position.copy(p.position);

      if (p.position.distanceToSquared(playerPos) > MAX_DIST * MAX_DIST || p.age > 4) {
        this.kill(p);
        continue;
      }
      if (p.deflected) continue;

      const d = segmentDistance(playerPos, p.prev, p.position);
      if (deflecting && d < deflectRadius) {
        // Bounce the bolt back out with a random spread — classic barrel roll.
        p.deflected = true;
        p.velocity.multiplyScalar(-0.9);
        p.velocity.x += (Math.random() - 0.5) * 120;
        p.velocity.y += (Math.random() - 0.5) * 120;
        p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _seg.copy(p.velocity).normalize());
        (p.mesh.children[0] as THREE.Mesh).material = this.deflectMat;
        this.deflections.push(p.position.clone());
        continue;
      }
      if (d < hitRadius) {
        this.kill(p);
        if (!invulnerable) hit = true;
      }
    }
    return { hit };
  }

  private kill(p: EnemyProjectile): void {
    p.active = false;
    p.mesh.visible = false;
  }

  clear(): void {
    for (const p of this.projectiles) this.kill(p);
  }

  dispose(): void {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.geo.dispose();
    this.haloGeo.dispose();
    this.coreMat.dispose();
    this.haloMat.dispose();
    this.deflectMat.dispose();
    this.projectiles = [];
  }
}
