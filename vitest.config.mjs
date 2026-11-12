import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${src}/` },
      // `server-only` throws outside a React Server environment; tests are plain Node.
      { find: 'server-only', replacement: fileURLToPath(new URL('./test/empty.js', import.meta.url)) },
    ],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.{js,jsx}'],
    testTimeout: 20_000,
    hookTimeout: 240_000,
  },
});
