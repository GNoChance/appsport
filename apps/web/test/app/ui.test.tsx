import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Banner, Dialog, Field, HEALTH_WARNING_TEXT, HealthWarning } from '../../src/ui';

describe('ui', () => {
  it('Field associe son libellé au champ (useId, htmlFor)', () => {
    render(
      <Field label="Pseudo" hint="3 à 24 caractères" error="Trop court">
        <input type="text" />
      </Field>,
    );
    const input = screen.getByLabelText('Pseudo');
    expect(input.tagName).toBe('INPUT');
    expect(input.id).not.toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const described = (input.getAttribute('aria-describedby') ?? '').split(' ');
    const texts = described.map((id) => document.getElementById(id)?.textContent);
    expect(texts).toEqual(expect.arrayContaining(['3 à 24 caractères', 'Trop court']));
  });

  it('Dialog : role dialog, modal, nommé par son titre ; rien quand fermé', () => {
    const { rerender } = render(
      <Dialog open title="Se déconnecter ?" onClose={() => {}} actions={<button type="button">OK</button>}>
        <p>Contenu</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Se déconnecter ?' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    rerender(
      <Dialog open={false} title="Se déconnecter ?" onClose={() => {}} actions={null}>
        <p>Contenu</p>
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Dialog : Tab et Maj+Tab restent dans le dialogue (fenêtre modale)', () => {
    render(
      <>
        <button type="button">Dehors</button>
        <Dialog
          open
          title="Modifier"
          onClose={() => {}}
          actions={
            <>
              <button type="button">Annuler</button>
              <button type="button" disabled>
                Inactif
              </button>
              <button type="button">Enregistrer</button>
            </>
          }
        >
          <input aria-label="Nom" />
        </Dialog>
      </>,
    );
    const dialog = screen.getByRole('dialog');
    const field = screen.getByLabelText('Nom');
    const save = screen.getByRole('button', { name: 'Enregistrer' });
    // Dernier élément → premier ; le bouton désactivé ne compte pas.
    save.focus();
    expect(fireEvent.keyDown(save, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(field);
    // Premier élément, ou le dialogue lui-même (focus à l'ouverture) → dernier.
    expect(fireEvent.keyDown(field, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(save);
    dialog.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(save);
    // Focus sorti du dialogue : Tab y revient.
    const outside = screen.getByRole('button', { name: 'Dehors' });
    outside.focus();
    fireEvent.keyDown(outside, { key: 'Tab' });
    expect(document.activeElement).toBe(field);
    // Au milieu : le navigateur avance seul.
    expect(fireEvent.keyDown(field, { key: 'Tab' })).toBe(true);
  });

  it('Dialog inertOutside : reste de la page inerte et caché, rendu à la fermeture', () => {
    const page = (open: boolean) => (
      <>
        <header>
          <a href="/">Accueil</a>
        </header>
        <main>
          <p aria-hidden="true">Décor</p>
          <button type="button">Dehors</button>
          <Dialog open={open} inertOutside title="Porte" onClose={() => {}} actions={null}>
            <p>Contenu</p>
          </Dialog>
        </main>
      </>
    );
    const { rerender } = render(page(true));
    expect(screen.getByText('Accueil').closest('header')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Accueil').closest('header')?.hasAttribute('inert')).toBe(true);
    expect(screen.getByText('Dehors').hasAttribute('inert')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Dehors' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Accueil' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Porte' })).toBeTruthy();
    // Déjà caché par la page : pas touché.
    expect(screen.getByText('Décor').hasAttribute('inert')).toBe(false);
    rerender(page(false));
    expect(document.querySelector('[inert]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Dehors' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Accueil' })).toBeTruthy();
    expect(screen.getByText('Décor').getAttribute('aria-hidden')).toBe('true');
  });

  it("Dialog inertOutside par-dessus un autre dialogue : il garde le clavier, l'autre le reprend après", () => {
    const closed: string[] = [];
    const page = (top: boolean) => (
      <main>
        <section>
          <Dialog open title="Dessous" onClose={() => closed.push('dessous')} actions={null}>
            <input aria-label="Nom" />
          </Dialog>
        </section>
        <Dialog open={top} inertOutside title="Dessus" onClose={() => closed.push('dessus')} actions={null}>
          <button type="button">Choix</button>
        </Dialog>
      </main>
    );
    const { rerender } = render(page(true));
    expect(screen.getByLabelText('Nom').closest('[inert]')).not.toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Dessous' })).toBeNull();
    const choice = screen.getByRole('button', { name: 'Choix' });
    choice.focus();
    fireEvent.keyDown(choice, { key: 'Escape' });
    expect(closed).toEqual(['dessus']);
    // Tab : seul le dialogue du dessus garde le focus.
    expect(fireEvent.keyDown(choice, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(choice);
    rerender(page(false));
    expect(document.querySelector('[inert]')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closed).toEqual(['dessus', 'dessous']);
  });

  it('Dialog inertOutside empilés : un élément reste inerte tant qu’un dialogue le tient', () => {
    const page = (second: boolean) => (
      <>
        <header>Haut</header>
        <main>
          <Dialog open inertOutside title="Premier" onClose={() => {}} actions={null}>
            <p>Un</p>
          </Dialog>
          <Dialog open={second} inertOutside title="Second" onClose={() => {}} actions={null}>
            <p>Deux</p>
          </Dialog>
        </main>
      </>
    );
    const { rerender, unmount } = render(page(true));
    const header = screen.getByText('Haut');
    expect(header.hasAttribute('inert')).toBe(true);
    rerender(page(false));
    expect(header.hasAttribute('inert')).toBe(true);
    expect(header.getAttribute('aria-hidden')).toBe('true');
    unmount();
    expect(header.hasAttribute('inert')).toBe(false);
    expect(header.hasAttribute('aria-hidden')).toBe(false);
  });

  it('Banner : role alert pour une erreur, status sinon', () => {
    render(
      <>
        <Banner tone="error">Erreur</Banner>
        <Banner tone="warning">Attention</Banner>
        <Banner tone="info">Info</Banner>
      </>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Erreur');
    expect(screen.getAllByRole('status').map((b) => b.textContent)).toEqual(['Attention', 'Info']);
  });

  it("HealthWarning affiche l'avertissement santé", () => {
    expect(HEALTH_WARNING_TEXT).toBe(
      'appsport ne remplace pas un avis médical. Consultez un médecin avant de reprendre une activité si vous avez un problème de santé, et arrêtez en cas de douleur.',
    );
    render(<HealthWarning />);
    expect(screen.getByText(HEALTH_WARNING_TEXT)).toBeTruthy();
  });
});
