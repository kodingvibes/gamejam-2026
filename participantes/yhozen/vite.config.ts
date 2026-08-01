import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  optimizeDeps: {
    include: ['phaser', 'three', '@enable3d/phaser-extension'],
  },
});
