import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/renderer/**/*.test.ts', 'tests/renderer/**/*.test.tsx'],
    setupFiles: ['./tests/renderer/setup.ts'],
  },
});
