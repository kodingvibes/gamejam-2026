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
    // Ambient: bright neutral base so nothing reads as pitch black. The level
    // environment tunes its intensity per biome.
    const ambient = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambient);
    // Expose the ambient light so the level environment can tune its intensity.
    scene.userData.ambientLight = ambient;

    // Hemisphere light: tints objects with the sky (top) and ground (bottom)
    // colors so ships and props are lit by the environment, not pasted on top.
    const hemi = new THREE.HemisphereLight(0x8899aa, 0x334455, 1.6);
    scene.add(hemi);
    scene.userData.hemisphereLight = hemi;

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    scene.userData.dirLight = dirLight;

    const fillLight = new THREE.DirectionalLight(0x6688ff, 1.5);
    fillLight.position.set(-10, -5, 10);
    scene.add(fillLight);
    scene.userData.fillLight = fillLight;

    const backLight = new THREE.DirectionalLight(0x44aaff, 1.2);
    backLight.position.set(0, 0, -20);
    scene.add(backLight);
    scene.userData.backLight = backLight;

    // Under-rim light from below-behind (+Z, behind the camera). Lights the
    // faces of objects that point back at the camera so they don't fall into
    // shadow from the front/top key lights.
    const underLight = new THREE.DirectionalLight(0x88aaff, 1.6);
    underLight.position.set(0, -12, 25);
    scene.add(underLight);
    scene.userData.underLight = underLight;
  }

  static createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 8.5;
    return renderer;
  }
}
