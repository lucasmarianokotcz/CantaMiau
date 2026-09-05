import { defineConfig, type PreviewServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { scanSongs } from './scripts/song-catalog.mjs';

function catalogMiddleware(server: ViteDevServer | PreviewServer, root: string) {
  server.middlewares.use('/__songs/catalog', (req, res, next) => {
    if (req.url?.split('?')[0] !== '/') return next();
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET');
      return res.end();
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    scanSongs(root).then(entries => {
      res.end(JSON.stringify(entries));
    }).catch(error => {
      server.config.logger.error('Falha ao ler a coleção de músicas: ' + error.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Não foi possível ler a pasta de músicas. Confira o terminal.' }));
    });
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-song-catalog',
      configureServer(server) {
        catalogMiddleware(server, path.join(server.config.publicDir, 'songs'));
      },
      configurePreviewServer(server) {
        catalogMiddleware(server, path.resolve(server.config.root, server.config.build.outDir, 'songs'));
      },
    },
  ],
});
