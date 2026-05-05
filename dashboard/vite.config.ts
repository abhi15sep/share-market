import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// In dev, serve ../data/ files at /data/ so local ETL output is visible immediately
function localDataPlugin() {
  return {
    name: 'local-data',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/data/')) return next();
        const filePath = path.resolve(__dirname, '..', req.url.slice(1));
        if (!existsSync(filePath)) return next();
        const content = readFileSync(filePath);
        const ext = path.extname(filePath);
        res.setHeader('Content-Type', ext === '.json' ? 'application/json' : ext === '.csv' ? 'text/csv' : 'application/octet-stream');
        res.end(content);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localDataPlugin()],
  base: '/',
  publicDir: 'public',
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-recharts': ['recharts'],
          'vendor-charts': ['lightweight-charts'],
          'vendor-table': ['@tanstack/react-table'],
        },
      },
    },
  },
});
