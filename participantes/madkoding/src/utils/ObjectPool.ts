// ─── Object Pool ─────────────────────────────────────────────────────────────

import * as THREE from 'three';

export class ObjectPool<T extends THREE.Object3D> {
  private pool: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  private resetFn: (obj: T) => void;
  private initialSize: number;

  constructor(factory: () => T, resetFn: (obj: T) => void, initialSize = 20) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.initialSize = initialSize;
    this.grow(initialSize);
  }

  private grow(count: number): void {
    for (let i = 0; i < count; i++) {
      const obj = this.factory();
      obj.visible = false;
      this.pool.push(obj);
    }
  }

  acquire(): T {
    let obj: T;
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else {
      obj = this.factory();
    }
    this.resetFn(obj);
    obj.visible = true;
    this.active.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (!this.active.has(obj)) return;
    this.active.delete(obj);
    obj.visible = false;
    if (obj.parent) {
      obj.parent.remove(obj);
    }
    this.pool.push(obj);
  }

  releaseAll(): void {
    for (const obj of this.active) {
      obj.visible = false;
      if (obj.parent) {
        obj.parent.remove(obj);
      }
      this.pool.push(obj);
    }
    this.active.clear();
  }

  dispose(): void {
    this.releaseAll();
    this.pool.length = 0;
  }
}
