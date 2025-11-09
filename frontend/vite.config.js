import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'flow': ['@xyflow/react']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['@xyflow/react']
  },
  server: {
    port: 5173,  // el puerto donde corre el frontend
    host: true,
    proxy: {
      // cualquier llamada que empiece con /apis se redirige al backend
      '/apis': {
        target: 'http://localhost:8083', // puerto del backend
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
