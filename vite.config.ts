import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const build = process.env.GITHUB_RUN_NUMBER ? `+${process.env.GITHUB_RUN_NUMBER}` : '';

export default defineConfig({
  base: './',
  plugins: [preact()],
  define: { __APP_VERSION__: JSON.stringify(`${pkg.version}${build}`) },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: { manualChunks: { pixi: ['pixi.js'] } },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
