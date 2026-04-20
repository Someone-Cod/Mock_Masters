import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // Expose all VITE_ prefixed env vars to the client
  envPrefix: 'VITE_',

  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        // Multi-page entry points
        main:      resolve(__dirname, 'index.html'),
        simulator: resolve(__dirname, 'pdf-simulator.html'),
        admin:     resolve(__dirname, 'admin.html'),
      },
    },
  },

  // Dev server config
  server: {
    port: 3000,
    open: true,
  },

  // Resolve aliases so imports stay clean
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
