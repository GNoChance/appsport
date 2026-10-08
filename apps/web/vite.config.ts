import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { precachePlugin } from './vite-plugin-precache';

// En développement, le serveur tourne à part sur le port 3000 avec APP_ORIGIN=http://localhost:5173 :
// le proxy rend l'API et les illustrations même origine que la page (cookie de session, en-tête Origin).
const API_SERVER = 'http://localhost:3000';

export default defineConfig({
  // precachePlugin, au build seulement : dist/sw.js précédé du manifeste de précache (ADR 0001).
  plugins: [react(), precachePlugin()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_SERVER },
      '/illustrations': { target: API_SERVER },
    },
  },
});
