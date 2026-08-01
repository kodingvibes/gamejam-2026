import type { GameTestApi } from '../testing/GameTestApi';

declare global {
  interface Window {
    __gameTest?: GameTestApi;
  }
}

export {};
