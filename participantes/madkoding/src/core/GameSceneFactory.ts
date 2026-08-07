// ─── Game Scene Factory: creates scene, lights, fog ─────────────────────────

import * as THREE from 'three';
import { COLORS } from '../types/config';

export class GameSceneFactory {
  static create(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.BACKGROUND);
    scene.fog = new THREE.FogExp2(COLORS.FOG, 0.0003);
    return scene;
  }

  static addLights(scene: THREE.Scene): void {
    const ambient = new THREE.AmbientLight(0x8899aa, 2.0);
    scene.add(ambient);
    // Expose the ambient light so the level environment can tune its intensity.
    scene.userData.ambientLight = ambient;

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x6688ff, 1.5);
    fillLight.position.set(-10, -5, 10);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0x44aaff, 1.2);
    backLight.position.set(0, 0, -20);
    scene.add(backLight);
  }

  static createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.2;
    return renderer;
  }
}