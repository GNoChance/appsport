import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BottomSheet,
  Button,
  CoachAvatar,
  CoachBubble,
  CountUp,
  Dialog,
  RankBadge,
  SystemPanel,
  useReducedMotion,
} from '../../src/ui';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';

const UI = resolve(import.meta.dirname, '../../src/ui');
const read = (path: string) => readFileSync(resolve(UI, path), 'utf8');
const REDUCE = '(prefers-reduced-motion: reduce)';
const DARK = '(prefers-color-scheme: dark)';

/** Réglages du téléphone simulés : les media queries listées répondent vrai, les autres faux. */
function phoneSettings(...matching: string[]) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
});

/** Écran d'essai : un déclencheur, du contenu à côté, la feuille « Se déconnecter ». */
function LogoutScreen(p: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <main>
        <p>Contenu de la page</p>
        <button type="button" onClick={() => setOpen(true)}>
          Ouvrir
        </button>
      </main>
      <BottomSheet
        open={open}
        title="Se déconnecter"
        onClose={() => {
          p.onClose?.();
          setOpen(false);
        }}
      >
        <button type="button">Cet appareil</button>
        <button type="button">Tous mes appareils</button>
      </BottomSheet>
    </>
  );
}

describe('BottomSheet (spec refonte §6 : poignée, fond assombri, focus piégé)', () => {
  it('ouverte : un dialogue modal nommé par son titre, le reste de la page inerte', () => {
    render(<LogoutScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const sheet = screen.getByRole('dialog', { name: 'Se déconnecter' });
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('main')?.hasAttribute('inert')).toBe(true);
    expect(sheet.closest('[inert]')).toBeNull();
    expect(sheet.contains(document.activeElement)).toBe(true);
  });

  it('poignée décorative, cachée aux lecteurs d’écran', () => {
    render(<LogoutScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const handle = screen.getByRole('dialog').querySelector('[data-sheet-handle]');
    expect(handle?.getAttribute('aria-hidden')).toBe('true');
  });

  it('Échap appelle onClose, le focus revient au déclencheur et le fond n’est plus inerte', () => {
    const onClose = vi.fn();
    render(<LogoutScreen onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Ouvrir' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector('main')?.hasAttribute('inert')).toBe(false);
    expect(document.querySelector('main')?.hasAttribute('aria-hidden')).toBe(false);
  });

  it('démontée ouverte : le fond redevient atteignable', () => {
    const { unmount } = render(<LogoutScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const main = document.querySelector('main');
    expect(main?.hasAttribute('inert')).toBe(true);
    unmount();
    expect(main?.hasAttribute('inert')).toBe(false);
  });

  it('Tab depuis le dernier élément revient au premier, Maj+Tab depuis le premier va au dernier', () => {
    render(<LogoutScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const first = screen.getByRole('button', { name: 'Cet appareil' });
    // Sans actions, la feuille porte son propre bouton « Fermer », dernier élément atteignable.
    const last = screen.getByRole('button', { name: 'Fermer' });
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('l’écran qui pose lui-même le focus à la fermeture (un titre, un message) le garde', () => {
    function Screen() {
      const [open, setOpen] = useState(false);
      const title = useRef<HTMLHeadingElement>(null);
      const wasOpen = useRef(false);
      // Avant les effets : comme un écran qui annonce l'issue en y posant le focus dès son rendu.
      useLayoutEffect(() => {
        if (wasOpen.current && !open) title.current?.focus();
        wasOpen.current = open;
      }, [open]);
      return (
        <>
          <h1 ref={title} tabIndex={-1}>
            Titre
          </h1>
          <button type="button" onClick={() => setOpen(true)}>
            Ouvrir
          </button>
          <BottomSheet open={open} title="Se déconnecter" onClose={() => setOpen(false)}>
            <button type="button" onClick={() => setOpen(false)}>
              Terminer
            </button>
          </BottomSheet>
        </>
      );
    }
    render(<Screen />);
    const trigger = screen.getByRole('button', { name: 'Ouvrir' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Titre' }));
  });

  it('sans actions : un bouton « Fermer » intégré la ferme au toucher, le focus revient au déclencheur', () => {
    const onClose = vi.fn();
    render(<LogoutScreen onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Ouvrir' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('avec actions : pas de bouton « Fermer » ajouté, les actions de l’appelant suffisent', () => {
    render(
      <BottomSheet open title="Se déconnecter" onClose={() => {}} actions={<Button>Annuler</Button>}>
        <p>Texte</p>
      </BottomSheet>,
    );
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).queryByRole('button', { name: 'Fermer' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'Annuler' })).toBeTruthy();
  });

  it('actions={null} : l’appelant renonce au bouton « Fermer » (il offre sa propre sortie)', () => {
    render(
      <BottomSheet open title="Choisir" onClose={() => {}} actions={null}>
        <button type="button">Choix</button>
      </BottomSheet>,
    );
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Fermer' })).toBeNull();
  });

  it('un champ qui prend le focus à l’ouverture (autoFocus) le garde, et le focus revient au déclencheur', () => {
    function Screen() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Renommer
          </button>
          <BottomSheet open={open} title="Renommer" onClose={() => setOpen(false)}>
            <label>
              Nom
              {/* biome-ignore lint/a11y/noAutofocus: cas éprouvé, un champ qui prend le focus à l'ouverture */}
              <input autoFocus />
            </label>
          </BottomSheet>
        </>
      );
    }
    render(<Screen />);
    const trigger = screen.getByRole('button', { name: 'Renommer' });
    trigger.focus();
    fireEvent.click(trigger);
    const input = screen.getByRole('textbox', { name: 'Nom' });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('BottomSheet : au-dessus de la page', () => {
  /** Toutes les feuilles de style de l'appli, composants et écrans. */
  const sheets = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const path = resolve(dir, e.name);
      if (e.isDirectory()) return sheets(path);
      return e.name.endsWith('.css') ? [path] : [];
    });

  // Rendue sur place (sans portail), la feuille partage le contexte d'empilement de la page : un contrôle
  // positionné avec un z-index (champ transparent d'une ChoiceCard ou d'une Chip) la couvrirait et prendrait
  // ses touchers.
  it('le voile a un z-index au-dessus de tout autre z-index de l’appli', () => {
    const backdrop = Number(
      declarationsOf(parseCssBlocks(read('ui.module.css')), '.backdrop')?.get('z-index'),
    );
    expect(backdrop).toBeGreaterThan(0);
    for (const file of sheets(resolve(UI, '..'))) {
      for (const block of parseCssBlocks(readFileSync(file, 'utf8'))) {
        if (block.selector === '.backdrop') continue;
        const z = Number(block.declarations.get('z-index') ?? Number.NaN);
        if (Number.isFinite(z)) expect(z, `${file} ${block.selector}`).toBeLessThan(backdrop);
      }
    }
  });
});

describe('Dialog : même API, rendu en feuille du bas', () => {
  it('titre, contenu et actions dans une feuille avec poignée', () => {
    render(
      <>
        <main>Page</main>
        <Dialog open title="Supprimer ce lieu ?" onClose={() => {}} actions={<Button>Supprimer</Button>}>
          <p>Le lieu disparaît.</p>
        </Dialog>
      </>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Supprimer ce lieu ?' });
    expect(within(dialog).getByText('Le lieu disparaît.')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Supprimer' })).toBeTruthy();
    expect(dialog.querySelector('[data-sheet-handle]')).not.toBeNull();
  });

  it('inertOutside : le reste de la page inerte, comme avant', () => {
    render(
      <>
        <main>Page</main>
        <Dialog open inertOutside title="Accord santé" onClose={() => {}} actions={<Button>Accepter</Button>}>
          <p>Texte</p>
        </Dialog>
      </>,
    );
    expect(document.querySelector('main')?.hasAttribute('inert')).toBe(true);
  });
});

describe('RankBadge (pierres runiques, spec refonte §9)', () => {
  it('une image nommée « Rang E »', () => {
    render(<RankBadge rank="E" size={48} />);
    const badge = screen.getByRole('img', { name: 'Rang E' });
    expect(badge.getAttribute('width')).toBe('48');
    expect(badge.getAttribute('data-variant')).toBe('E');
  });

  it('mini : la version 24–32 px dessinée pour les petites tailles', () => {
    render(<RankBadge rank="S" size={24} mini />);
    expect(screen.getByRole('img', { name: 'Rang S' }).getAttribute('data-variant')).toBe('S-mini');
  });

  it('verrouillé : toujours visible et nommé, mais atténué', () => {
    render(<RankBadge rank="A" size={32} locked />);
    const badge = screen.getByRole('img', { name: 'Rang A' });
    expect(badge.getAttribute('data-locked')).toBe('true');
    const muted = declarationsOf(parseCssBlocks(read('art.module.css')), '.locked');
    expect(Number(muted?.get('opacity'))).toBeGreaterThan(0.3);
    expect(Number(muted?.get('opacity'))).toBeLessThan(1);
  });
});

describe('CountUp (les compteurs défilent, spec refonte §7)', () => {
  /** Chiffre affiché (caché aux lecteurs d'écran) et texte lu par les lecteurs d'écran. */
  const visibleOf = (root: HTMLElement) => root.querySelector('[aria-hidden="true"]')?.textContent;
  const spokenOf = (root: HTMLElement) => {
    const copy = root.cloneNode(true) as HTMLElement;
    for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
    return copy.textContent;
  };

  it('mouvement réduit : affiche directement la valeur dès le premier rendu', () => {
    phoneSettings(REDUCE);
    expect(renderToString(<CountUp to={3} />)).toContain('3');
    const { container } = render(<CountUp to={3} />);
    expect(visibleOf(container)).toBe('3');
    expect(spokenOf(container)).toBe('3');
  });

  it('sinon : part de 0 et arrive à la valeur', async () => {
    phoneSettings();
    expect(renderToString(<CountUp to={3} />)).toContain('0');
    const { container } = render(<CountUp to={3} duration={50} />);
    await waitFor(() => expect(visibleOf(container)).toBe('3'));
  });

  it('pendant le défilement, le lecteur d’écran lit déjà la valeur finale, jamais un chiffre de passage', () => {
    phoneSettings();
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const { container } = render(<CountUp to={12} />);
    expect(visibleOf(container)).toBe('0');
    expect(spokenOf(container)).toBe('12');
  });

  it('durée nulle ou négative : la valeur tout de suite, ni NaN ni boucle sans fin', () => {
    phoneSettings();
    const frames = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', frames);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    for (const duration of [0, -100, Number.NaN]) {
      const { container, unmount } = render(<CountUp to={7} duration={duration} />);
      expect(visibleOf(container), String(duration)).toBe('7');
      expect(container.textContent, String(duration)).not.toContain('NaN');
      unmount();
    }
    expect(frames).not.toHaveBeenCalled();
  });
});

describe('useReducedMotion', () => {
  it('suit prefers-reduced-motion, faux sans matchMedia', () => {
    phoneSettings(REDUCE);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
    phoneSettings();
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });
});

describe('CoachAvatar (spec refonte §8 : avatars générés, identifiants préfixés par instance)', () => {
  const allIds = (root: ParentNode) => [...root.querySelectorAll('[id]')].map((el) => el.id);

  it('deux avatars sur la même page n’ont aucun id en double', () => {
    const { container } = render(
      <>
        <CoachAvatar coach="skald" size={40} />
        <CoachAvatar coach="skald" size={40} />
        <CoachAvatar coach="ombre" size={40} />
        <CoachAvatar coach="scribe" mode="nutrition" size={40} />
      </>,
    );
    const ids = allIds(container);
    expect(ids.length).toBeGreaterThan(4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('identifiants sans deux-points, et chaque url(#…) vise un id du même avatar', () => {
    const { container } = render(
      <>
        <CoachAvatar coach="ombre" size={64} />
        <CoachAvatar coach="ombre" size={64} />
      </>,
    );
    for (const svg of container.querySelectorAll('svg')) {
      const ids = new Set(allIds(svg));
      for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
      const refs = [...svg.outerHTML.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) expect(ids.has(ref ?? ''), ref).toBe(true);
    }
  });

  it('nommé par le coach, et le mode nutrition se dit aussi', () => {
    render(
      <>
        <CoachAvatar coach="ombre" size={40} />
        <CoachAvatar coach="skald" mode="nutrition" size={40} />
        <CoachAvatar coach="scribe" size={40} />
      </>,
    );
    expect(screen.getByRole('img', { name: "L'Ombre" })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Le Skald, mode nutrition' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Le Scribe' })).toBeTruthy();
  });

  it('version claire ou sombre selon le thème effectif', () => {
    document.documentElement.setAttribute('data-theme', 'clair');
    const { unmount } = render(<CoachAvatar coach="skald" size={40} />);
    expect(screen.getByRole('img').getAttribute('data-variant')).toBe('training-light');
    unmount();
    document.documentElement.setAttribute('data-theme', 'nuit');
    const second = render(<CoachAvatar coach="skald" mode="nutrition" size={40} />);
    expect(screen.getByRole('img').getAttribute('data-variant')).toBe('nutrition-dark');
    second.unmount();
    document.documentElement.removeAttribute('data-theme');
    phoneSettings(DARK);
    render(<CoachAvatar coach="ombre" size={40} />);
    expect(screen.getByRole('img').getAttribute('data-variant')).toBe('training-dark');
  });

  it('groupes animables gardés : yeux du Skald, visière de l’Ombre, lueur et plume du Scribe', () => {
    document.documentElement.setAttribute('data-theme', 'sombre');
    const { container } = render(
      <>
        <CoachAvatar coach="skald" size={40} animated />
        <CoachAvatar coach="ombre" size={40} animated />
        <CoachAvatar coach="scribe" size={40} animated />
      </>,
    );
    for (const group of ['per-eyes', 'per-body', 'sys-visor', 'sys-helm', 'emb-glow', 'emb-glyph']) {
      expect(container.querySelector(`[data-g="${group}"]`), group).not.toBeNull();
    }
  });
});

describe('CoachAvatar décoratif (à côté d’un nom écrit)', () => {
  it('decorative : caché aux lecteurs d’écran, sans rôle ni nom, pour ne pas lire le nom deux fois', () => {
    const { container } = render(<CoachAvatar coach="skald" size={40} decorative />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.hasAttribute('role')).toBe(false);
    expect(svg?.hasAttribute('aria-label')).toBe(false);
    expect(screen.queryByRole('img', { hidden: true })).toBeNull();
  });
});

describe('CoachBubble (textes écrits à l’avance, étiquetés, jamais « en train d’écrire »)', () => {
  it('avatar de 40 px, nom du coach, étiquette et texte', () => {
    render(
      <CoachBubble coach="scribe" label="Aujourd'hui">
        Un plan simple pour commencer.
      </CoachBubble>,
    );
    expect(screen.getByText('Le Scribe')).toBeTruthy();
    expect(screen.getByText("Aujourd'hui")).toBeTruthy();
    expect(screen.getByText('Un plan simple pour commencer.')).toBeTruthy();
    // L'avatar est décoratif : le nom est écrit dans la bulle, il n'est lu qu'une fois.
    expect(screen.queryByRole('img', { hidden: true })).toBeNull();
    const avatar = document.querySelector('svg');
    expect(avatar?.getAttribute('aria-hidden')).toBe('true');
    expect(avatar?.getAttribute('width')).toBe('40');
  });

  it('animation de repos bornée : quelques cycles puis l’avatar se pose (WCAG 2.2.2)', async () => {
    phoneSettings();
    const { container } = render(
      <CoachBubble coach="skald" label="Aperçu">
        Texte.
      </CoachBubble>,
    );
    await act(async () => {});
    const wrapper = container.querySelector('[data-animated]');
    expect(wrapper?.getAttribute('data-animated')).toBe('brief');
    const art = parseCssBlocks(read('art.module.css'));
    const brief = declarationsOf(art, '.animated.brief [data-g]');
    const count = Number(brief?.get('animation-iteration-count'));
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(3);
    // Pas de retour brusque à la fin : la dernière image reste posée.
    expect(brief?.get('animation-fill-mode')).toBe('forwards');
  });

  it('mode nutrition : le nom le dit', () => {
    render(
      <CoachBubble coach="ombre" label="Aperçu" mode="nutrition">
        De l'eau au fil de la journée.
      </CoachBubble>,
    );
    expect(screen.getByText("L'Ombre · Nutrition")).toBeTruthy();
  });
});

describe('SystemPanel (la voix du Système)', () => {
  it('groupe nommé par son titre (pas un repère de page), étiquette « [ SYSTÈME ] »', () => {
    render(
      <SystemPanel title="Éveil terminé.">
        <p>Ta progression commence au rang E.</p>
      </SystemPanel>,
    );
    expect(screen.queryByRole('region')).toBeNull();
    const panel = screen.getByRole('group', { name: 'Éveil terminé.' });
    const label = panel.querySelector('[data-system-label]') as HTMLElement;
    expect(label.textContent).toBe('[ SYSTÈME ]');
    expect(within(panel).getByRole('heading', { name: 'Éveil terminé.', level: 2 })).toBeTruthy();
    expect(within(panel).getByText('Ta progression commence au rang E.')).toBeTruthy();
  });

  it('crochets tus : le lecteur d’écran lit « SYSTÈME », pas la ponctuation', () => {
    render(<SystemPanel title="T">x</SystemPanel>);
    const label = screen.getByRole('group').querySelector('[data-system-label]') as HTMLElement;
    const copy = label.cloneNode(true) as HTMLElement;
    for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
    expect(copy.textContent?.trim()).toBe('SYSTÈME');
  });

  it('headingLevel : le titre suit le plan de la page (h3 dans une feuille ou une section en h2)', () => {
    render(
      <SystemPanel title="Quête remplie." headingLevel={3}>
        x
      </SystemPanel>,
    );
    expect(screen.getByRole('heading', { name: 'Quête remplie.', level: 3 })).toBeTruthy();
  });

  it('ton succès distinct du ton par défaut', () => {
    render(
      <>
        <SystemPanel title="A">a</SystemPanel>
        <SystemPanel title="B" tone="success">
          b
        </SystemPanel>
      </>,
    );
    const a = screen.getByRole('group', { name: 'A' });
    const b = screen.getByRole('group', { name: 'B' });
    expect(a.getAttribute('data-tone')).toBe('default');
    expect(b.getAttribute('data-tone')).toBe('success');
  });

  it('titre dans la police des titres du thème (Newsreader en Carnet), étiquette en police d’affichage', () => {
    const voice = parseCssBlocks(read('voice.module.css'));
    expect(declarationsOf(voice, '.panelTitle')?.get('font-family')).toBe('var(--font-title)');
    expect(declarationsOf(voice, '.systemLabel')?.get('font-family')).toBe('var(--font-display)');
  });

  it('Carnet (maquette Carnet) : carte de papier à cadre d’encre et ombre franche, sans barre dégradée', () => {
    const voice = parseCssBlocks(read('voice.module.css'));
    const carnet = ':global(:root[data-theme="carnet"])';
    const panel = declarationsOf(voice, `${carnet} .panel`);
    expect(panel?.get('border')).toBe('1.5px solid var(--text)');
    expect(panel?.get('box-shadow')).toBe('4px 4px 0 var(--text)');
    expect(panel?.get('border-radius')).toBe('var(--radius-card)');
    expect(declarationsOf(voice, `${carnet} .panel::before`)?.get('display')).toBe('none');
    // Newsreader n'est embarqué qu'en 600 : pas de gras synthétisé par le navigateur.
    expect(declarationsOf(voice, `${carnet} .panelTitle`)?.get('font-weight')).toBe('600');
  });
});

describe('art généré (svg-to-tsx.mjs, CSP default-src self)', () => {
  const ART = resolve(UI, 'art');
  const generated = ['CoachOmbre.tsx', 'CoachSkald.tsx', 'CoachScribe.tsx', 'RankStone.tsx'];

  it('les fichiers générés existent et portent leur en-tête', () => {
    const files = readdirSync(ART);
    for (const file of generated) {
      expect(files).toContain(file);
      expect(read(`art/${file}`)).toContain('fichier généré par svg-to-tsx.mjs');
    }
  });

  it('aucun élément style, aucune chaîne style, aucun attribut d’événement, aucun HTML injecté', () => {
    for (const file of generated) {
      const source = read(`art/${file}`);
      expect(source, file).not.toMatch(/<style\b/i);
      expect(source, file).not.toMatch(/\bstyle=["'{]/);
      expect(source, file).not.toContain('dangerouslySetInnerHTML');
      expect(source, file).not.toMatch(/\son[A-Z][a-zA-Z]*=/);
    }
  });

  it('rendu : aucun élément style dans le DOM des avatars et des rangs', () => {
    const { container } = render(
      <>
        <CoachAvatar coach="ombre" mode="nutrition" size={40} />
        <CoachAvatar coach="skald" size={40} />
        <CoachAvatar coach="scribe" size={40} />
        <RankBadge rank="B" size={48} />
        <RankBadge rank="S" size={24} mini />
      </>,
    );
    expect(container.querySelector('style')).toBeNull();
    expect(container.querySelector('[style*="{"]')).toBeNull();
  });
});

describe('mouvement (motion.css et animations de repos)', () => {
  const motion = () => parseCssBlocks(read('motion.css'));
  const art = () => parseCssBlocks(read('art.module.css'));

  it('variables de mouvement : courbe unique et durées du brief', () => {
    const root = declarationsOf(motion(), ':root');
    expect(root?.get('--ease')).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(root?.get('--dur-fast')).toBe('200ms');
    expect(root?.get('--dur-screen')).toBe('380ms');
    expect(root?.get('--dur-celebrate')).toBe('900ms');
  });

  it('entrée, cascade et ressort : neutralisés sous mouvement réduit', () => {
    for (const selector of ['.enter-up', '.stagger > *', '.pop']) {
      expect(declarationsOf(motion(), selector)?.get('animation'), selector).toBeTruthy();
      const reduced = declarationsOf(motion(), selector, REDUCE);
      expect(reduced, selector).not.toBeNull();
    }
    expect(declarationsOf(motion(), '.pop', REDUCE)?.get('animation')).toBe('none');
    // Cascade : aucun retard sous mouvement réduit, et un simple fondu sans déplacement.
    expect(declarationsOf(motion(), '.stagger > *', REDUCE)?.get('animation-delay')).toBe('0ms');
    expect(declarationsOf(motion(), '.enter-up', REDUCE)?.get('animation-name')).toBe('rune-fade');
  });

  it('la cascade retarde chaque élément selon son rang', () => {
    const delay = (n: number) =>
      declarationsOf(motion(), `.stagger > :nth-child(${n})`)?.get('animation-delay');
    expect(delay(2)).toBeTruthy();
    expect(delay(2)).not.toBe(delay(3));
  });

  it('jamais caché hors animation : aucune règle ne pose opacity 0 en dehors des keyframes', () => {
    for (const blocks of [motion(), art()]) {
      for (const block of blocks) {
        if (block.selector.startsWith('@keyframes')) continue;
        expect(block.declarations.get('opacity'), block.selector).not.toBe('0');
        expect(block.declarations.get('visibility'), block.selector).not.toBe('hidden');
      }
    }
  });

  it('animations de repos des avatars : seulement si animées, éteintes sous mouvement réduit', () => {
    const reduced = declarationsOf(art(), '.animated [data-g]', REDUCE);
    expect(reduced?.get('animation')).toBe('none');
    const idle = art().filter(
      (b) =>
        b.media === null && b.selector.startsWith('.animated [data-g=') && b.declarations.has('animation'),
    );
    expect(idle.length).toBeGreaterThanOrEqual(4);
  });

  it('feuilles des composants : couleurs prises dans les jetons', () => {
    for (const file of ['art.module.css', 'voice.module.css', 'motion.css']) {
      const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
      expect(css.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi) ?? [], file).toEqual([]);
    }
  });
});

describe('avatars sans animation : rien n’est animé par défaut', () => {
  beforeEach(() => phoneSettings());

  it('animated absent : pas de classe d’animation de repos', () => {
    render(<CoachAvatar coach="skald" size={40} />);
    const wrapper = screen.getByRole('img').parentElement;
    expect(wrapper?.getAttribute('data-animated')).toBe('false');
  });

  it('animated : la classe d’animation de repos est posée', async () => {
    render(<CoachAvatar coach="skald" size={40} animated />);
    await act(async () => {});
    expect(screen.getByRole('img').parentElement?.getAttribute('data-animated')).toBe('true');
  });
});
