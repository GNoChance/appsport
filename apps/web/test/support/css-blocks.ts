/** Une règle CSS lue à plat : sélecteur (ou at-rule), media query englobante, déclarations dans l'ordre. */
export interface CssBlock {
  selector: string;
  media: string | null;
  declarations: Map<string, string>;
}

const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Sélecteur comparable : espaces resserrés, guillemets doubles. */
export const normalizeSelector = (selector: string) =>
  selector
    .replace(/\s+/g, ' ')
    .replace(/'/g, '"')
    .replace(/\s*,\s*/g, ', ')
    .trim();

/** `a: b; c: url(x;y)` → paires, sans couper dans les parenthèses ni les chaînes. */
function parseDeclarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  const flush = (end: number) => {
    const part = body.slice(start, end).trim();
    const colon = part.indexOf(':');
    if (colon > 0) out.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
    start = end + 1;
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ';' && depth === 0) flush(i);
  }
  flush(body.length);
  return out;
}

/** Index de l'accolade fermante qui répond à celle ouverte en `open`. */
function matchingBrace(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i;
  }
  throw new Error(`accolade non fermée à ${open}`);
}

function collect(css: string, media: string | null, out: CssBlock[]): void {
  let pos = 0;
  for (;;) {
    const open = css.indexOf('{', pos);
    if (open < 0) return;
    const close = matchingBrace(css, open);
    const prelude = css.slice(pos, open).trim();
    const body = css.slice(open + 1, close);
    if (prelude.startsWith('@media')) collect(body, prelude.slice('@media'.length).trim(), out);
    else out.push({ selector: normalizeSelector(prelude), media, declarations: parseDeclarations(body) });
    pos = close + 1;
  }
}

/** Règles de premier niveau et celles des `@media` (un niveau), commentaires ôtés. */
export function parseCssBlocks(css: string): CssBlock[] {
  const out: CssBlock[] = [];
  collect(withoutComments(css), null, out);
  return out;
}

/**
 * Déclarations de toutes les règles qui ont exactement ce sélecteur dans ce contexte (`media` null : hors
 * media query), fusionnées dans l'ordre du fichier ; null si aucune règle ne correspond.
 */
export function declarationsOf(
  blocks: readonly CssBlock[],
  selector: string,
  media: string | null = null,
): Map<string, string> | null {
  const wanted = normalizeSelector(selector);
  const matching = blocks.filter((b) => b.selector === wanted && b.media === media);
  if (matching.length === 0) return null;
  return new Map(matching.flatMap((b) => [...b.declarations]));
}
