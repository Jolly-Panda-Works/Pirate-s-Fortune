import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: {
    alias: {
      // The original, untouched engine + data files of the 2D build.
      '@engine': path.join(repoRoot, 'js'),
      '@data': path.join(repoRoot, 'data'),
      '@assets': path.join(repoRoot, 'assets'),
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    host: true,
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: path.resolve(here, '../dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
