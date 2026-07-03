import { defineConfig } from 'vitest/config';
import { transformWithEsbuild } from 'vite';

function jsAsJsx() {
  return {
    name: 'app-connect-js-as-jsx',
    async transform(code, id) {
      if (!id.includes('/src/') && !id.includes('\\src\\')) {
        return null;
      }
      if (!id.endsWith('.js')) {
        return null;
      }
      return transformWithEsbuild(code, id, {
        loader: 'jsx',
        jsx: 'automatic',
      });
    },
  };
}

export default defineConfig({
  plugins: [jsAsJsx()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup/index.js'],
    globals: true,
    clearMocks: true,
    mockReset: false,
    restoreMocks: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}', 'build.js', 'updateVersion.js'],
      exclude: ['dist/**', 'public/**', 'test/**'],
    },
  },
});
