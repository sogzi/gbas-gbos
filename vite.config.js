import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js alone is ~600 kB minified; one chunk is fine for this demo
    chunkSizeWarningLimit: 900,
  },
});
