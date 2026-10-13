import { Link } from 'wouter';
import { Page } from '../../ui';

export function NotFound() {
  return (
    <Page title="Page introuvable">
      <p>Cette page n'existe pas ou n'est pas encore disponible.</p>
      <Link href="/">Retour à l'accueil</Link>
    </Page>
  );
}
