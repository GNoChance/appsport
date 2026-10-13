import { useSyncExternalStore } from 'react';

/**
 * Apparence choisie dans Profil › Réglages, gardée sur l'appareil (spec refonte §4) : ni synchro, ni
 * colonne serveur. Auto suit le réglage du téléphone par la media query de tokens.css ; un thème forcé
 * pose `data-theme` sur la racine et l'emporte toujours sur ce réglage.
 */
export type ThemeChoice = 'auto' | 'clair' | 'sombre' | 'carnet' | 'nuit';

export const THEME_CHOICES: readonly ThemeChoice[] = ['auto', 'clair', 'sombre', 'carnet', 'nuit'];

const STORAGE_KEY = 'rune.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Couleur de la barre du navigateur et de l'appli installée : le --bg de chaque thème (tokens.css). */
const THEME_COLORS: Record<Exclude<ThemeChoice, 'auto'>, string> = {
  clair: '#F1F3F7',
  sombre: '#070A12',
  carnet: '#F2ECDF',
  nuit: '#05070D',
};

const isThemeChoice = (value: unknown): value is ThemeChoice =>
  (THEME_CHOICES as readonly unknown[]).includes(value);

/** Choix gardé, « auto » par défaut, quand la valeur est inconnue ou quand le stockage est bloqué. */
export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeChoice(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

/** Garde le choix ; si le stockage le refuse, il vaut pour la page ouverte seulement. */
export function writeThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Stockage plein ou bloqué : rien à faire, le thème reste appliqué jusqu'au rechargement.
  }
}

/** Composants abonnés au thème appliqué (useThemeChoice). */
const subscribers = new Set<() => void>();
/** Écoute du réglage du téléphone, active seulement en Auto. */
let stopFollowingPhone: (() => void) | null = null;
/** Écoute des autres onglets, posée une fois par page au premier thème appliqué. */
let followingOtherTabs = false;

/**
 * Un autre onglet ouvert change le choix ou vide le stockage : cette page l'applique aussi, sans attendre un
 * rechargement. L'événement `storage` n'arrive qu'aux autres pages de la même origine, jamais à l'auteur.
 */
function followOtherTabs(doc: Document): void {
  const win = doc.defaultView;
  if (followingOtherTabs || !win) return;
  followingOtherTabs = true;
  win.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) applyTheme(readThemeChoice(), doc.documentElement);
  });
}

function setThemeColor(doc: Document, color: string): void {
  const metas = [...doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
  if (metas.length === 0) {
    const meta = doc.createElement('meta');
    meta.name = 'theme-color';
    doc.head.append(meta);
    metas.push(meta);
  }
  for (const meta of metas) meta.content = color;
}

/**
 * Applique le choix à `root` : `data-theme` pour un thème forcé, aucun attribut pour Auto (les couleurs
 * suivent alors la media query CSS). Pour la page (racine du document, par défaut), met aussi à jour
 * `theme-color` ; en Auto, il suit le téléphone à l'appel puis à chaque changement de son réglage. La page
 * suit ensuite le choix fait dans un autre onglet.
 * Une autre racine (un aperçu) ne reçoit que l'attribut : tokens.css ne vise que `:root[data-theme]`, et la
 * barre, l'écoute du téléphone et les composants abonnés restent ceux de la page.
 */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  const doc = root.ownerDocument;
  if (root !== doc.documentElement) return;
  followOtherTabs(doc);
  stopFollowingPhone?.();
  stopFollowingPhone = null;
  if (choice === 'auto') {
    const query = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(DARK_QUERY) : null;
    const follow = () => setThemeColor(doc, query?.matches ? THEME_COLORS.sombre : THEME_COLORS.clair);
    follow();
    // Appelé avant le premier rendu : un navigateur sans écoute de media query garde la couleur du démarrage.
    if (typeof query?.addEventListener === 'function') {
      query.addEventListener('change', follow);
      stopFollowingPhone = () => query.removeEventListener('change', follow);
    }
  } else {
    setThemeColor(doc, THEME_COLORS[choice]);
  }
  for (const notify of subscribers) notify();
}

const subscribe = (onChange: () => void) => {
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
};

/** Le thème appliqué à la page : ce que l'on voit, posé au démarrage par main.tsx puis par le réglage. */
const appliedChoice = (): ThemeChoice => {
  const attr = document.documentElement.getAttribute('data-theme');
  return isThemeChoice(attr) ? attr : 'auto';
};

function chooseTheme(choice: ThemeChoice): void {
  writeThemeChoice(choice);
  applyTheme(choice);
}

/** Choix en cours et réglage qui le garde puis l'applique ; tous les composants abonnés suivent. */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  return [useSyncExternalStore(subscribe, appliedChoice), chooseTheme];
}
