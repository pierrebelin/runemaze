import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Port du serveur de partie (src/server/main.ts) : même choix des deux côtés.
const SERVER_PORT = Number(process.env.PORT) || 8080;

// Un seul fichier HTML autonome, publiable tel quel (le serveur de partie reste requis).
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000 },
  server: { proxy: { '/partie': { target: `ws://localhost:${SERVER_PORT}`, ws: true } } },
  test: { environment: 'node' },
});
