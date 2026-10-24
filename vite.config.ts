import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // The repository also contains presentation exports, temporary Office files,
      // logs, archives, and build output. None of those are application modules,
      // and watching them can cause Vite to issue full-page reloads while they are
      // being written by PowerPoint, archive tools, or redirected server logs.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/dist/**',
          '**/presentation_assets/**',
          '**/*.log',
          '**/*.err',
          '**/*.tmp',
          '**/*.zip',
          '**/*.pptx',
          '**/*.pdf',
        ],
      },
    },
  };
});
