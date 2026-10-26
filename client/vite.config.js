import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

export default defineConfig({
  root: here,
  plugins: [react()],
  define: {
    // CI passes the release version (or X.Y.Z-dev.N); locally it's package.json's.
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || pkg.version),
  },
  resolve: {
    alias: {
      // The original, untouched rules engine + its data files.
      '@engine': path.join(repoRoot, 'js'),
      '@data': path.join(repoRoot, 'data'),
      '@assets': path.join(repoRoot, 'assets'),
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5177),
    host: true,
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: path.resolve(here, '../dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
