import { defineConfig } from 'vite';

// base: './' — чтобы сборку можно было выложить в любую папку (GitHub Pages, Netlify и т.п.)
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
});
