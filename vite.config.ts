import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      // The docker-compose service name, not "localhost" — this proxy
      // runs *inside* the frontend container, where "localhost" is the
      // frontend container's own loopback, not the backend's. Restarting
      // (or recreating) the frontend container surfaced this: it was
      // only ever proxying successfully by accident, on however this
      // container's network happened to be set up at its original
      // startup — a fresh container reliably gets ECONNREFUSED instead.
      // Matches how `backend` itself already reaches `db` (see
      // DB_HOST: db in docker-compose.yml), the standard pattern for
      // cross-container calls on a compose bridge network.
      '/api': 'http://backend:4000',
      '/uploads': 'http://backend:4000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
  },
});
