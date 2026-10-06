import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function tracexEnvAndCspPlugin(mode: string, command: 'build' | 'serve'): Plugin {
  let currentRequestSaveData = false;

  return {
    name: 'tracex-env-and-csp',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '/';
        const isAssetOrModule =
          url.startsWith('/@') ||
          url.startsWith('/src/') ||
          url.startsWith('/node_modules/') ||
          /\.(?:ts|tsx|js|css|avif|webp|jpg|jpeg|png|svg|ico|json)(?:\?|$)/i.test(url);
        if (!isAssetOrModule) {
          const saveDataHeader = req.headers['save-data'];
          const headerVal = Array.isArray(saveDataHeader) ? saveDataHeader[0] : saveDataHeader;
          currentRequestSaveData = (headerVal ?? '').trim().toLowerCase() === 'on';
        }
        next();
      });
    },
    configResolved() {
      const env = loadEnv(mode, process.cwd(), '');
      const apiBaseUrl = process.env.VITE_API_BASE_URL ?? env.VITE_API_BASE_URL ?? '';

      if (command === 'build' && mode === 'production') {
        if (!apiBaseUrl || apiBaseUrl.trim() === '') {
          throw new Error(
            'PRODUCTION BUILD ERROR: VITE_API_BASE_URL is required for production builds and must be a valid https:// URL.'
          );
        }
        if (!apiBaseUrl.trim().startsWith('https://')) {
          throw new Error(
            `PRODUCTION BUILD ERROR: VITE_API_BASE_URL must use https:// in production builds (received: "${apiBaseUrl}").`
          );
        }
        try {
          new URL(apiBaseUrl.trim());
        } catch {
          throw new Error(
            `PRODUCTION BUILD ERROR: VITE_API_BASE_URL is not a valid URL (received: "${apiBaseUrl}").`
          );
        }
      }
    },
    transformIndexHtml(html) {
      if (command === 'serve') {
        if (currentRequestSaveData) {
          return html.replace('<html lang="en"', '<html lang="en" data-save-data="on"');
        }
        return html;
      }
      if (mode !== 'production') {
        return html;
      }
      const env = loadEnv(mode, process.cwd(), '');
      const apiBaseUrl = (process.env.VITE_API_BASE_URL ?? env.VITE_API_BASE_URL ?? '').trim();
      const apiOrigin = new URL(apiBaseUrl).origin;
      const cspContent = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        `connect-src 'self' ${apiOrigin}`,
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; ');

      const metaTag = `    <meta http-equiv="Content-Security-Policy" content="${cspContent}" />\n`;
      return html.replace('</head>', `${metaTag}  </head>`);
    }
  };
}

export default defineConfig(({ mode, command }) => ({
  plugins: [react(), tracexEnvAndCspPlugin(mode, command)],
  build: {
    assetsInlineLimit: 0
  },
  server: {
    port: 5174,
    strictPort: true
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/features/**/*.{ts,tsx}',
        'src/api/**/*.{ts,tsx}',
        'src/auth/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}'
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/api/generated/**',
        'src/features/styleguide/**',
        'src/components/ui/index.ts'
      ],
      thresholds: {
        statements: 70
      }
    }
  }
}));
