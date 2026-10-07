import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En développement, le serveur tourne à part sur le port 3000 avec APP_ORIGIN=http://localhost:5173 :
// le proxy rend l'API et les illustrations même origine que la page (cookie de session, en-tête Origin).
const API_SERVER = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_SERVER },
      '/illustrations': { target: API_SERVER },
    },
  },
});
