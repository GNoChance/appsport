import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../support/render';

describe('pages publiques', () => {
  it('/privacy reprend la fiche de traitement', async () => {
    await renderApp({ path: '/privacy', me: null });
    await screen.findByRole('heading', { level: 1, name: 'Confidentialité et règles' });
    const text = document.body.textContent ?? '';
    for (const expected of [
      'Version 1.0',
      'peut techniquement lire la base',
      "aucune requête manuelle sur les données d'une personne sans son accord",
      "l'adresse de ton compte Tailscale",
      '90 jours sans usage',
      '365 jours au maximum',
      '12 mois',
      '30 jours au plus',
      '7 jours',
      '24 h',
      '90 jours',
      'ne remplace pas un avis médical',
      'serveur à domicile en France',
      'États-Unis',
      'sauvegardes chiffrées hors du domicile',
    ]) {
      expect(text, expected).toContain(expected);
    }
    expect(screen.getByRole('heading', { name: 'Règles pour les 16-17 ans' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Coach et mineurs' })).toBeTruthy();
    expect(text).not.toMatch(/’/);
  });

  it('/help : numéros cliquables et date de vérification', async () => {
    await renderApp({ path: '/help', me: null });
    await screen.findByRole('heading', { level: 1 });
    const tel = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href') ?? '')
      .filter((h) => h.startsWith('tel:'));
    expect(tel).toEqual(['tel:15', 'tel:112', 'tel:0969325900', 'tel:0800152000', 'tel:3114']);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Numéros vérifiés le 06/10/2026');
    expect(text.split('Horaires :').length - 1).toBe(1);
  });

  it('/credits statique, sans requête', async () => {
    const { api } = await renderApp({ path: '/credits', me: null });
    await screen.findByRole('heading', { level: 1, name: 'Crédits' });
    expect(screen.getByText('Aucune illustration pour le moment.')).toBeTruthy();
    expect(api.calls).toEqual([]);
  });

  it('route inconnue → Page introuvable', async () => {
    await renderApp({ path: '/nulle-part' });
    await screen.findByText('Page introuvable');
  });
});
