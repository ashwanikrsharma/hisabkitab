import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['./test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@hisabkitab/services': path.resolve(__dirname, '../services/src/index.ts'),
      '@hisabkitab/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
