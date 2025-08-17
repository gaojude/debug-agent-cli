import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  esbuild: {
    legalComments: 'inline',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true
  }
});