// Bundle de production : un seul dist/server.mjs ESM, sans import hors node:* ; l'image ne contient pas de
// node_modules (01 §2, R-DEP-2). Le bandeau fournit `require` aux dépendances CommonJS embarquées.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: 'dist/server.mjs',
  banner: {
    js: "import { createRequire as __appsportCreateRequire } from 'node:module'; const require = __appsportCreateRequire(import.meta.url);",
  },
  legalComments: 'eof',
});
