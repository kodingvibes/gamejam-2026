// ─── Particle Manager (delegates to Starfield + Nebulae + emitters) ─────────

import * as THREE from 'three';
import { Starfield } from './Starfield';
import { Nebulae } from './Nebulae';

interface ParticleEmitter {
  points: THREE.Points;
  particles: { position: THREE.Vector3; velocity: THREE.Vector3; life: number; maxLife: number }[];
  timer: number;
  duration: number;
}

export class ParticleManager {
  private scene: THREE.Scene;
  private starfield: Starfield;
  private nebulae: Nebulae;
  private emitters: ParticleEmitter[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.starfield = new Starfield(scene);
    this.nebulae = new Nebulae(scene);
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.starfield.update(dt, playerPos);
    this.nebulae.update(dt, playerPos);
    this.updateEmitters(dt);
  }

  private updateEmitters(dt: number): void {
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i];
      e.timer += dt;
      let allDead = true;
      const posAttr = e.points.geometry.attributes.position as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;

      for (let j = 0; j < e.particles.length; j++) {
        const p = e.particles[j];
        p.life += dt;
        if (p.life < p.maxLife) {
          allDead = false;
          p.position.add(p.velocity.clone().multiplyScalar(dt));
          p.velocity.multiplyScalar(0.95);
          positions[j * 3] = p.position.x;
          positions[j * 3 + 1] = p.position.y;
          positions[j * 3 + 2] = p.position.z;
        }
      }
      posAttr.needsUpdate = true;
      (e.points.material as THREE.PointsMaterial).opacity = 1 - (e.timer / e.duration);
      if (allDead || e.timer >= e.duration) {
        this.scene.remove(e.points);
        e.points.geometry.dispose();
        (e.points.material as THREE.Material).dispose();
        this.emitters.splice(i, 1);
      }
    }
  }

  reset(): void {
    for (const e of this.emitters) {
      this.scene.remove(e.points);
      e.points.geometry.dispose();
      (e.points.material as THREE.Material).dispose();
    }
    this.emitters = [];
  }

  dispose(): void {
    this.reset();
    this.starfield.dispose();
    this.nebulae.dispose();
  }
}