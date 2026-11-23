import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // three.js alone is ~570 kB
    rolldownOptions: { input: { main: 'client/index.html', admin: 'client/admin.html' } },
  },
});
