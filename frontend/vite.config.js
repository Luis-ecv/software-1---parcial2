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
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'flow': ['@xyflow/react']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['@xyflow/react']
  },
  server: {
    port: 5173,
    host: true
  }
})