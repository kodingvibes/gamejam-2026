import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);
const threeRoot = join(dirname(require.resolve('three')), '..');
const ammoRuntimeFiles = [
  {
    pathname: '/lib/ammo.js',
    source: require.resolve('ammojs-typed'),
    contentType: 'text/javascript; charset=utf-8',
  },
  {
    pathname: '/lib/ammo.wasm.js',
    source: join(threeRoot, 'examples/jsm/libs/ammo.wasm.js'),
    contentType: 'text/javascript; charset=utf-8',
  },
  {
    pathname: '/lib/ammo.wasm.wasm',
    source: join(threeRoot, 'examples/jsm/libs/ammo.wasm.wasm'),
    contentType: 'application/wasm',
  },
] as const;

function ammoRuntime(): Plugin[] {
  return [{
    name: 'yhozen-ammo-runtime-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        const runtime = ammoRuntimeFiles.find((file) => file.pathname === pathname);
        if (!runtime) {
          next();
          return;
        }

        void readFile(runtime.source)
          .then((contents) => {
            response.statusCode = 200;
            response.setHeader('Content-Type', runtime.contentType);
            response.setHeader('Cache-Control', 'no-cache');
            response.end(contents);
          })
          .catch((error: unknown) => {
            next(error instanceof Error ? error : new Error('Unable to load the Ammo runtime.'));
          });
      });
    },
  }, {
    name: 'yhozen-ammo-runtime-build',
    apply: 'build',
    async buildStart() {
      for (const runtime of ammoRuntimeFiles) {
        this.emitFile({
          type: 'asset',
          fileName: runtime.pathname.slice(1),
          source: await readFile(runtime.source),
        });
      }
    },
  }];
}

export default defineConfig({
  plugins: ammoRuntime(),
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  optimizeDeps: {
    include: ['phaser', 'three', '@enable3d/phaser-extension'],
  },
});
