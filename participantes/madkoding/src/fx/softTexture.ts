// ─── Soft round particle texture (shared) ────────────────────────────────────
// PointsMaterial without a map renders hard squares. Every particle system uses
// this radial glow instead so sparks, stars and debris read as light.

import * as THREE from 'three';

let _soft: THREE.Texture | null = null;

export function getSoftParticleTexture(): THREE.Texture {
  if (_soft) return _soft;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  _soft = new THREE.CanvasTexture(canvas);
  _soft.colorSpace = THREE.SRGBColorSpace;
  return _soft;
}
