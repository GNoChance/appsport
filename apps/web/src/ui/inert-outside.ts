/** Éléments rendus inertes par un dialogue ouvert, avec le nombre de dialogues qui les tiennent. */
const heldBy = new Map<Element, number>();

/** Jamais touchés : rien à lire ni à atteindre. */
const SKIPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT']);

/**
 * Rend inerte et caché aux lecteurs d'écran (`inert`, `aria-hidden`) tout ce qui est hors de
 * `root` : les frères de `root` et de chacun de ses ancêtres jusqu'à `body`. Ni le curseur
 * virtuel d'un lecteur d'écran ni la recherche dans la page n'atteignent l'écran derrière un
 * dialogue modal. Renvoie de quoi tout rendre. Dialogues empilés : un élément reste inerte tant
 * qu'un dialogue le tient ; un élément déjà caché par la page n'est pas touché.
 */
export function inertOutside(root: Element): () => void {
  const held: Element[] = [];
  for (let node: Element = root; node.parentElement && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || SKIPPED.has(sibling.tagName)) continue;
      const count = heldBy.get(sibling);
      if (count === undefined) {
        if (sibling.hasAttribute('inert') || sibling.getAttribute('aria-hidden') === 'true') continue;
        sibling.setAttribute('inert', '');
        sibling.setAttribute('aria-hidden', 'true');
      }
      heldBy.set(sibling, (count ?? 0) + 1);
      held.push(sibling);
    }
  }
  return () => {
    for (const el of held) {
      const count = (heldBy.get(el) ?? 1) - 1;
      if (count > 0) {
        heldBy.set(el, count);
        continue;
      }
      heldBy.delete(el);
      el.removeAttribute('inert');
      el.removeAttribute('aria-hidden');
    }
  };
}
