import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const rawBase = process.env.VITE_BASE_PATH || '/';
  const basePath = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  const segmentCount = basePath.split('/').filter(Boolean).length;

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'keepsake-gh-pages-404',
        writeBundle() {
          const dist404 = path.resolve(__dirname, 'dist', '404.html');
          if (fs.existsSync(dist404)) {
            const content = fs.readFileSync(dist404, 'utf8');
            const updated = content.replace(
              /var pathSegmentsToKeep\s*=\s*\d+;/,
              `var pathSegmentsToKeep = ${segmentCount};`
            );
            fs.writeFileSync(dist404, updated, 'utf8');
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
