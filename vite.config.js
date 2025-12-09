import react from '@vitejs/plugin-react'; // You might need to install this if not present, or remove if not using vite react plugin explicitly
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy physics engine into its own file
          physics: ['@dimforge/rapier3d-compat'],
          // Split 3D engine into its own file
          three: ['three'],
          // Others
          vendor: [
            'react',
            'react-dom',
            'zustand',
            'lucide-react',
            'clsx',
            'simplex-noise',
            'tailwind-merge',
          ],
        },
      },
    },
  },
});
