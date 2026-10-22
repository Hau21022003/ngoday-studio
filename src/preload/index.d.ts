import type { StudioApi } from '../shared/contracts.js';

declare global {
  interface Window {
    studio: StudioApi;
  }
}

export {};
