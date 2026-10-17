import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

/** Every .html page in the site (excluding partials/ and dist/) becomes a build entry. */
function collectPages(dir: string, pages: Record<string, string> = {}): Record<string, string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (['node_modules', 'dist', 'partials', 'public', 'src'].includes(name)) continue;
    if (statSync(full).isDirectory()) collectPages(full, pages);
    else if (name.endsWith('.html')) {
      pages[relative(root, full).replace(/\.html$/, '').replace(/\\/g, '/')] = full;
    }
  }
  return pages;
}

/**
 * Shared header/footer without a framework: `<!-- @include header -->` in a
 * page is replaced with partials/header.html. Pages mark their own nav item
 * with `<body data-nav="pricing">`; the matching link gets aria-current.
 */
function includePartials(): Plugin {
  return {
    name: 'omb-include-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const nav = /<body[^>]*data-nav="([^"]+)"/.exec(html)?.[1];
        return html.replace(/<!-- @include (\w[\w-]*) -->/g, (_, name: string) => {
          let partial = readFileSync(resolve(root, 'partials', `${name}.html`), 'utf8');
          if (nav) {
            partial = partial.replace(
              new RegExp(`data-nav-item="${nav}"`, 'g'),
              `data-nav-item="${nav}" aria-current="page"`
            );
          }
          return partial;
        });
      },
    },
  };
}

/** Dev/preview servers: serve /pricing from pricing.html, matching Vercel's cleanUrls. */
function cleanUrls(): Plugin {
  const pages = new Set(Object.keys(collectPages(root)));
  const rewrite = (req: { url?: string }) => {
    if (!req.url) return;
    const [path, query = ''] = req.url.split('?');
    const key = path.replace(/^\//, '').replace(/\/$/, '');
    if (key && pages.has(key)) req.url = `/${key}.html${query ? `?${query}` : ''}`;
  };
  return {
    name: 'omb-clean-urls',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => (rewrite(req), next()));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => (rewrite(req), next()));
    },
  };
}

export default defineConfig({
  plugins: [includePartials(), cleanUrls()],
  build: {
    rollupOptions: { input: collectPages(root) },
  },
});
