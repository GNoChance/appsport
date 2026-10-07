// Usage : node apps/server/scripts/make-common-passwords.mjs <10k-most-common.txt>
// Génère apps/server/src/auth/common-passwords-list.ts à partir de
// SecLists/Passwords/Common-Credentials/10k-most-common.txt (téléchargé à la main).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = process.argv[2];
if (!input) {
  console.error('Usage : node make-common-passwords.mjs <10k-most-common.txt>');
  process.exit(1);
}

const header = [
  '# Source: SecLists, Passwords/Common-Credentials/10k-most-common.txt (https://github.com/danielmiessler/SecLists)',
  '# Licence : MIT, Copyright (c) Daniel Miessler. Converti en minuscules et dédoublonné pour appsport.',
];
const entries = new Set();
for (const line of readFileSync(input, 'utf8').split(/\r?\n/)) {
  const p = line.trim().toLowerCase();
  if (p !== '' && !p.startsWith('#')) entries.add(p);
}
const text = `${[...header, ...entries].join('\n')}\n`;

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'auth', 'common-passwords-list.ts');
const banner =
  '// Fichier généré par apps/server/scripts/make-common-passwords.mjs : ne pas modifier à la main.';
writeFileSync(out, `${banner}\nexport const COMMON_PASSWORDS_RAW = ${JSON.stringify(text)};\n`);
console.log(`${entries.size} entrées écrites dans ${out}`);
