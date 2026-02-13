import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'out'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'out', '**/*.test.ts', '**/*.spec.ts'],
    },
    // Mock vscode module since we're testing pure logic
    alias: {
      vscode: new URL('./src/__tests__/mocks/vscode.ts', import.meta.url).pathname,
    },
  },
});
