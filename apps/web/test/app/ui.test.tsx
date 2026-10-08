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
