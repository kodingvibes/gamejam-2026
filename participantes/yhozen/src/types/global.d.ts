import type { GameTestApi } from '../testing/GameTestApi';

declare global {
  interface ImportMetaEnv {
    readonly VITE_MULTIPLAYER_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    __gameTest?: GameTestApi;
  }
}

export {};
