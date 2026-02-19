import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: '../web-dist',
    emptyOutDir: true,
    minify: 'terser',
    rollupOptions: {
      input: {
        main: './index.html',
        widget: './widget-studyplan.html',
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: true,
  },
});
