import { defineConfig } from 'vitest/config';
import path from 'path';

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
    alias: {
      vscode: path.resolve(__dirname, './src/__tests__/mocks/vscode.ts'),
    },
  },
});
