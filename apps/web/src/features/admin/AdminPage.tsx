import type { ReactNode } from 'react';
import { Page } from '../../ui';
import { AdminNav } from './AdminNav';

/**
 * Cadre des écrans d'administration (maquettes E01 à E05) : titre « Administration » et Retour vers le Profil,
 * où l'admin y entre (groupe Cercle), puis la sous-navigation ; chaque section porte ensuite ses titres de niveau 2.
 */
export function AdminPage(p: { children: ReactNode }) {
  return (
    <Page title="Administration" back="/profile">
      <AdminNav />
      {p.children}
    </Page>
  );
}
