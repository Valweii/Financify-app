import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          
          // UI libraries
          if (id.includes('node_modules/@radix-ui') || id.includes('node_modules/lucide-react')) {
            return 'ui-vendor';
          }
          
          // Utility libraries
          if (id.includes('node_modules/clsx') || id.includes('node_modules/tailwind-merge') || 
              id.includes('node_modules/class-variance-authority') || id.includes('node_modules/zod')) {
            return 'utils-vendor';
          }
          
          // Charts and visualization
          if (id.includes('node_modules/recharts')) {
            return 'charts-vendor';
          }
          
          // Supabase
          if (id.includes('node_modules/@supabase') || id.includes('node_modules/supabase')) {
            return 'supabase-vendor';
          }
          
          // PDF processing
          if (id.includes('node_modules/pdfjs-dist') || id.includes('node_modules/tesseract.js')) {
            return 'pdf-vendor';
          }
          
          // State management
          if (id.includes('node_modules/zustand') || id.includes('node_modules/@tanstack/react-query')) {
            return 'state-vendor';
          }
          
          // Form handling
          if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/@hookform/resolvers')) {
            return 'form-vendor';
          }
          
          // Date handling
          if (id.includes('node_modules/date-fns')) {
            return 'date-vendor';
          }
          
          // App screens (lazy loaded)
          if (id.includes('/screens/')) {
            return 'screens';
          }
          
          // App components
          if (id.includes('/components/') && !id.includes('/ui/')) {
            return 'components';
          }
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop().replace('.tsx', '').replace('.ts', '') : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(css)$/.test(assetInfo.name)) {
            return `assets/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        }
      }
    },
    cssMinify: true,
    minify: 'esbuild',
    sourcemap: false,
    target: 'esnext',
    modulePreload: {
      polyfill: false
    }
  },
  css: {
    devSourcemap: true,
  },
}));
