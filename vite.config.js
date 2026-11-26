import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const clientEntry = (name) => fileURLToPath(new URL('./client/' + name + '.html', import.meta.url));

export default defineConfig({
  root: 'client',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // three.js alone is ~570 kB
    rolldownOptions: {
      input: {
        main: clientEntry('index'),
        admin: clientEntry('admin'),
        questions: clientEntry('questions'),
        office: clientEntry('office'),
      },
    },
  },
});
