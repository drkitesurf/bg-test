import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', '../gates/tests/**/*.test.ts'],
    environment: 'node'
  }
});
