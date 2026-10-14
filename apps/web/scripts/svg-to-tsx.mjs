// Usage : node apps/web/scripts/svg-to-tsx.mjs
// Génère les composants React des avatars des coachs et des pierres de rang dans apps/web/src/ui/art/ (fichiers
// versionnés) depuis les SVG de docs/brand/coachs/{ombre,skald,scribe}/ et docs/brand/rangs/ (avec mini/).
// - attributs en camelCase (stroke-width → strokeWidth), aria-* et data-* gardés tels quels ;
// - chaque `id` et chaque `url(#…)` préfixés par la prop `idPrefix` : deux dessins d'une page ne partagent
//   aucun identifiant, et chaque dégradé ou filtre reste celui de son dessin ;
// - les groupes de premier niveau des coachs (`sys-visor`, `per-eyes`, `emb-glyph`, `emb-glow`…) gardent leur
//   nom dans `data-g`, que visent les animations de repos (art.module.css) ;
// - CSP `default-src 'self'` : jamais d'élément ni d'attribut `style`, d'attribut d'événement, de lien ni de
//   HTML injecté. Une source qui en contient fait échouer la génération au lieu de passer en silence.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const brand = join(repo, 'docs', 'brand');
const outDir = join(here, '..', 'src', 'ui', 'art');

const HEADER = '// fichier généré par svg-to-tsx.mjs : ne pas modifier à la main, relancer le script.';

/** Éléments SVG admis : ceux du dessin, rien qui charge, exécute ou injecte. */
const ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polygon',
  'polyline',
  'linearGradient',
  'radialGradient',
  'stop',
  'filter',
  'feGaussianBlur',
  'feOffset',
  'feMerge',
  'feMergeNode',
  'feColorMatrix',
  'feComposite',
  'feFlood',
  'feBlend',
  'clipPath',
  'mask',
  'pattern',
]);

/** Attributs de la racine source remplacés par ceux du composant (taille, nom accessible). */
const ROOT_DROPPED = new Set(['xmlns', 'width', 'height', 'role', 'aria-label']);

/** Groupe animable d'un coach : préfixe de direction (Système, personnage, emblème) puis nom de la pièce. */
const ANIMATABLE = /^(?:sys|per|emb)-[a-z]+$/;

/** Arbre d'un SVG source : éléments, attributs dans l'ordre ; tout texte autre que des blancs est refusé. */
function parseSvg(source, file) {
  const tag = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  const root = { name: '#root', attrs: [], children: [] };
  const stack = [root];
  let last = 0;
  for (const match of source.matchAll(tag)) {
    const between = source.slice(last, match.index);
    if (between.trim() !== '')
      throw new Error(`${file} : contenu inattendu « ${between.trim().slice(0, 40)} »`);
    last = match.index + match[0].length;
    const [, closing, name, rawAttrs, selfClosing] = match;
    if (!ELEMENTS.has(name)) throw new Error(`${file} : élément <${name}> refusé`);
    if (closing) {
      const open = stack.pop();
      if (open?.name !== name) throw new Error(`${file} : </${name}> ne ferme pas <${open?.name}>`);
      continue;
    }
    const attrs = [...rawAttrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]);
    const element = { name, attrs, children: [] };
    stack.at(-1).children.push(element);
    if (!selfClosing) stack.push(element);
  }
  if (source.slice(last).trim() !== '' || stack.length !== 1) throw new Error(`${file} : SVG mal fermé`);
  const [svg, ...rest] = root.children;
  if (svg?.name !== 'svg' || rest.length > 0) throw new Error(`${file} : un seul <svg> attendu`);
  return svg;
}

/** Nom React d'un attribut SVG ; refuse tout ce qui pourrait styler en ligne, exécuter ou charger. */
function reactName(key, file) {
  if (key === 'style' || /^on/i.test(key) || /href$/i.test(key) || key.includes(':')) {
    throw new Error(`${file} : attribut ${key} refusé`);
  }
  if (key.startsWith('aria-') || key.startsWith('data-')) return key;
  if (key === 'class') return 'className';
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/** Valeur JSX : identifiants et références `url(#…)` préfixés, le reste en chaîne littérale. */
function reactValue(key, value, file) {
  if (/[`${}\\<>]/.test(value)) throw new Error(`${file} : valeur de ${key} refusée « ${value} »`);
  if (key === 'id') return `{\`\${p}-${value}\`}`;
  if (value.includes('url(#')) {
    return `{\`${value.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#\${p}-${id})`)}\`}`;
  }
  return `"${value}"`;
}

function renderElement(element, depth, file) {
  const pad = '  '.repeat(depth);
  const parts = [];
  for (const [key, value] of element.attrs) {
    parts.push(`${reactName(key, file)}=${reactValue(key, value, file)}`);
    if (element.name === 'g' && key === 'id' && ANIMATABLE.test(value) && depth === 3) {
      parts.push(`data-g="${value}"`);
    }
  }
  const open = [element.name, ...parts].join(' ');
  if (element.children.length === 0) return `${pad}<${open} />`;
  const inner = element.children.map((child) => renderElement(child, depth + 1, file)).join('\n');
  return `${pad}<${open}>\n${inner}\n${pad}</${element.name}>`;
}

/** Fonction qui dessine une variante : racine `<svg>` avec les props du composant, puis le dessin source. */
function renderVariant(fnName, variant, path) {
  const file = relative(repo, path).replaceAll('\\', '/');
  const svg = parseSvg(readFileSync(path, 'utf8'), file);
  const rootAttrs = svg.attrs.filter(([key]) => !ROOT_DROPPED.has(key));
  const root = rootAttrs.map(([key, value]) => `${reactName(key, file)}=${reactValue(key, value, file)}`);
  const body = svg.children.map((child) => renderElement(child, 3, file)).join('\n');
  return [
    `/** ${file} */`,
    `function ${fnName}(p: string, svg: ArtSvgProps) {`,
    '  return (',
    "    // biome-ignore lint/a11y/noSvgWithoutTitle: nom accessible posé par l'appelant (role, aria-label)",
    `    <svg ${root.join(' ')} data-variant="${variant}" {...svg}>`,
    body,
    '    </svg>',
    '  );',
    '}',
  ].join('\n');
}

const COACHES = [
  { coach: 'ombre', component: 'CoachOmbre', direction: 'Système (casque, visière glacée)' },
  { coach: 'skald', component: 'CoachSkald', direction: 'personnage (barde encapuchonné)' },
  { coach: 'scribe', component: 'CoachScribe', direction: 'emblème (plume dans le badge)' },
];

const COACH_VARIANTS = [
  { variant: 'training-dark', suffix: '', fn: 'trainingDark' },
  { variant: 'training-light', suffix: '-light', fn: 'trainingLight' },
  { variant: 'nutrition-dark', suffix: '-nutrition', fn: 'nutritionDark' },
  { variant: 'nutrition-light', suffix: '-nutrition-light', fn: 'nutritionLight' },
];

function coachFile({ coach, component, direction }) {
  const variants = COACH_VARIANTS.map(({ variant, suffix, fn }) =>
    renderVariant(fn, variant, join(brand, 'coachs', coach, `${coach}${suffix}.svg`)),
  );
  const table = ['training', 'nutrition'].map(
    (mode) => `  ${mode}: { dark: ${mode}Dark, light: ${mode}Light },`,
  );
  return [
    HEADER,
    `// Avatar du coach ${coach}, direction ${direction}, d'après docs/brand/coachs/${coach}/.`,
    "import type { JSX } from 'react';",
    "import type { ArtSvgProps, CoachArtProps, CoachMode, ColorScheme } from './art-types';",
    '',
    ...variants.flatMap((v) => [v, '']),
    'const VARIANTS: Record<CoachMode, Record<ColorScheme, (p: string, svg: ArtSvgProps) => JSX.Element>> = {',
    ...table,
    '};',
    '',
    `/** Avatar ${coach} : mode entraînement ou nutrition, version sombre ou claire ; ids préfixés par idPrefix. */`,
    `export function ${component}({ mode, scheme, idPrefix, ...svg }: CoachArtProps) {`,
    '  return VARIANTS[mode][scheme](idPrefix, svg);',
    '}',
    '',
  ].join('\n');
}

const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];

function rankFile() {
  const full = RANKS.map((r) => renderVariant(`rank${r}`, r, join(brand, 'rangs', `rank-${r}.svg`)));
  const mini = RANKS.map((r) =>
    renderVariant(`mini${r}`, `${r}-mini`, join(brand, 'rangs', 'mini', `rank-${r}.svg`)),
  );
  return [
    HEADER,
    "// Pierres de rang « Pierre runique » (E galet griffé … S monolithe éveillé), d'après docs/brand/rangs/ ;",
    "// versions mini (24–32 px) d'après docs/brand/rangs/mini/.",
    "import type { JSX } from 'react';",
    "import type { ArtSvgProps, Rank, RankStoneProps } from './art-types';",
    '',
    ...[...full, ...mini].flatMap((v) => [v, '']),
    'const FULL: Record<Rank, (p: string, svg: ArtSvgProps) => JSX.Element> = {',
    ...RANKS.map((r) => `  ${r}: rank${r},`),
    '};',
    '',
    'const MINI: Record<Rank, (p: string, svg: ArtSvgProps) => JSX.Element> = {',
    ...RANKS.map((r) => `  ${r}: mini${r},`),
    '};',
    '',
    '/** Pierre du rang, en grand ou en mini ; ids préfixés par idPrefix. */',
    'export function RankStone({ rank, mini = false, idPrefix, ...svg }: RankStoneProps) {',
    '  return (mini ? MINI : FULL)[rank](idPrefix, svg);',
    '}',
    '',
  ].join('\n');
}

const outputs = [
  ...COACHES.map((c) => [join(outDir, `${c.component}.tsx`), coachFile(c)]),
  [join(outDir, 'RankStone.tsx'), rankFile()],
];
for (const [path, content] of outputs) writeFileSync(path, content);

// Mise en forme du dépôt (biome), pour que `pnpm lint` accepte les fichiers tels quels.
const require = createRequire(import.meta.url);
const biome = join(dirname(require.resolve('@biomejs/biome/package.json')), 'bin', 'biome');
execFileSync(process.execPath, [biome, 'format', '--write', ...outputs.map(([path]) => path)], {
  cwd: repo,
  stdio: 'inherit',
});
for (const [path] of outputs) console.log(`généré : ${relative(repo, path).replaceAll('\\', '/')}`);
