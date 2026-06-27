import { defineConfig } from 'vitest/config';

// lib/calc.ts is pure (no React/DOM), so the default node environment is enough.
// resolve.tsconfigPaths resolves the "@/*" alias from tsconfig.json natively.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
