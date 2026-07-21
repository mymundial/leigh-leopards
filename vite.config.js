import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const cleanRoutes = new Map([
  ['/admin', '/admin.html'],
  ['/admin/', '/admin.html'],
  ['/bigscreen', '/bigscreen.html'],
  ['/bigscreen/', '/bigscreen.html'],
]);

function cleanRoutePlugin() {
  const rewrite = (request, _response, next) => {
    const pathname = String(request.url || '').split('?')[0];
    const destination = cleanRoutes.get(pathname);
    if (destination) request.url = destination;
    next();
  };

  return {
    name: 'leigh-clean-routes',
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
}

export default defineConfig({
  plugins: [cleanRoutePlugin()],
  build: {
    rollupOptions: {
      input: {
        app: resolve(projectRoot, 'index.html'),
        admin: resolve(projectRoot, 'admin.html'),
        bigscreen: resolve(projectRoot, 'bigscreen.html'),
      },
      external: (source) => source.startsWith('https://www.gstatic.com/firebasejs/'),
    },
  },
});
