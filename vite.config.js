import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = dirname(fileURLToPath(import.meta.url));

function adminRoutePlugin() {
  const rewriteAdminRoute = (request, _response, next) => {
    if (request.url === '/admin' || request.url === '/admin/') {
      request.url = '/admin.html';
    }
    next();
  };

  return {
    name: 'leigh-admin-route',
    configureServer(server) {
      server.middlewares.use(rewriteAdminRoute);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewriteAdminRoute);
    },
  };
}

export default defineConfig({
  plugins: [adminRoutePlugin()],
  build: {
    rollupOptions: {
      input: {
        app: resolve(projectRoot, 'index.html'),
        admin: resolve(projectRoot, 'admin.html'),
      },
      external: (source) => source.startsWith('https://www.gstatic.com/firebasejs/'),
    },
  },
});
