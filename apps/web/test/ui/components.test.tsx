import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  Badge,
  Banner,
  Button,
  Chips,
  ChoiceCard,
  ChoiceGroup,
  ChoiceList,
  EmptyState,
  Field,
  ListGroup,
  ListRow,
  PageHeader,
  SegmentedProgress,
  Switch,
} from '../../src/ui';
import styles from '../../src/ui/ui.module.css';
import { declarationsOf, parseCssBlocks } from '../support/css-blocks';

/** Règle de la feuille de base pour une classe du module (la taille d'une cible ne se lit que là). */
const css = parseCssBlocks(readFileSync(resolve(import.meta.dirname, '../../src/ui/ui.module.css'), 'utf8'));
const rule = (selector: string) => declarationsOf(css, selector);
const px = (value: string | undefined) => Number.parseFloat(value ?? '');
/** Classe générée pour `.name` du module ; son absence est une erreur, jamais un « undefined » qui passerait. */
const cls = (name: string): string => {
  const generated = styles[name];
  if (!generated) throw new Error(`classe .${name} absente de ui.module.css`);
  return generated;
};

const icon = (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="M6 7v10" />
  </svg>
);

describe('Button', () => {
  it('bouton de type button par défaut, désactivable, 52 px de haut', () => {
    render(
      <>
        <Button>Continuer</Button>
        <Button variant="ghost">Plus tard</Button>
        <Button variant="danger" disabled>
          Supprimer
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Continuer' }).getAttribute('type')).toBe('button');
    expect(screen.getByRole('button', { name: 'Plus tard' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Supprimer' }) as HTMLButtonElement).disabled).toBe(true);
    expect(px(rule('.button')?.get('min-height'))).toBe(52);
  });

  it('block : pleine largeur', () => {
    render(<Button block>Continuer</Button>);
    expect(screen.getByRole('button', { name: 'Continuer' }).classList.contains(cls('block'))).toBe(true);
    expect(rule('.block')?.get('width')).toBe('100%');
  });
});

describe('Field', () => {
  it('erreur reliée au champ par aria-describedby, avec l’aide, et champ marqué invalide', () => {
    render(
      <Field label="Mot de passe" help="Une phrase de 4 mots ou plus." error="12 caractères au moins.">
        <input type="password" />
      </Field>,
    );
    const input = screen.getByLabelText('Mot de passe');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const described = (input.getAttribute('aria-describedby') ?? '').split(' ');
    const texts = described.map((id) => document.getElementById(id)?.textContent);
    expect(texts).toEqual(['12 caractères au moins.', 'Une phrase de 4 mots ou plus.']);
  });

  it('l’icône d’erreur est décorative : le texte annoncé reste la phrase seule', () => {
    render(
      <Field label="Pseudo" error="Trop court">
        <input type="text" />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Pseudo', description: 'Trop court' });
    const errorId = input.getAttribute('aria-describedby') as string;
    const svg = document.getElementById(errorId)?.querySelector('svg');
    expect(svg?.closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('sans erreur : ni aria-invalid ni description d’erreur ; texte des champs en 16 px', () => {
    render(
      <Field label="Ville">
        <input type="text" />
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: 'Ville' });
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(rule('.field input, .field select, .field textarea')?.get('font-size')).toBe('16px');
  });
});

describe('ChoiceCard et ChoiceGroup', () => {
  it('carte cochée : un vrai bouton radio nommé par son titre, sous la légende du groupe', () => {
    render(
      <ChoiceGroup legend="Quel est ton objectif principal ?">
        <ChoiceCard
          type="radio"
          name="goal"
          value="muscle"
          checked
          onChange={() => {}}
          title="Prendre du muscle"
          icon={icon}
        />
        <ChoiceCard
          type="radio"
          name="goal"
          value="strength"
          checked={false}
          onChange={() => {}}
          title="Gagner en force"
        />
      </ChoiceGroup>,
    );
    const group = screen.getByRole('group', { name: 'Quel est ton objectif principal ?' });
    const radio = within(group).getByRole('radio', { name: 'Prendre du muscle', checked: true });
    expect(radio.tagName).toBe('INPUT');
    expect(within(group).getByRole('radio', { name: 'Gagner en force', checked: false })).toBeTruthy();
  });

  it('la description décrit le choix sans allonger son nom', () => {
    render(
      <ChoiceCard
        type="radio"
        name="gym"
        value="g-1"
        checked={false}
        onChange={() => {}}
        title="Salle du centre"
        description="Lyon · 2 membres visibles"
      />,
    );
    expect(
      screen.getByRole('radio', { name: 'Salle du centre', description: 'Lyon · 2 membres visibles' }),
    ).toBeTruthy();
  });

  it('choix multiple : case à cocher ; onChange au clic, sur la case comme sur la carte', () => {
    const onChange = vi.fn();
    render(
      <ChoiceCard type="checkbox" name="eq" value="bench" checked={false} onChange={onChange} title="Banc" />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Banc', checked: false }));
    fireEvent.click(screen.getByText('Banc'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('sélection jamais par la couleur seule : la carte cochée porte une coche, pas les autres', () => {
    render(
      <>
        <ChoiceCard type="radio" name="k" value="a" checked onChange={() => {}} title="À la salle" />
        <ChoiceCard type="radio" name="k" value="b" checked={false} onChange={() => {}} title="À la maison" />
      </>,
    );
    const card = (name: string) => screen.getByText(name).closest('label') as HTMLElement;
    const mark = card('À la salle').querySelector('[data-check]');
    expect(mark?.closest('[aria-hidden="true"]')).toBeTruthy();
    expect(card('À la maison').querySelector('[data-check]')).toBeNull();
  });
});

describe('ChoiceList (adaptateur vers ChoiceCard, signature inchangée)', () => {
  it('garde le groupe nommé par sa légende, les radios nommés par leur libellé, désactivé et explication', () => {
    const onChange = vi.fn();
    render(
      <>
        <p id="pourquoi">Ton objectif demande un sport.</p>
        <ChoiceList<'no' | 'yes'>
          name="practice"
          legend="Pratiques-tu un autre sport régulièrement ?"
          value="yes"
          onChange={onChange}
          options={[
            { value: 'no', label: 'Non', disabled: true, describedBy: 'pourquoi' },
            { value: 'yes', label: 'Oui' },
          ]}
        />
      </>,
    );
    const group = screen.getByRole('group', { name: 'Pratiques-tu un autre sport régulièrement ?' });
    const no = within(group).getByRole('radio', {
      name: 'Non',
      description: 'Ton objectif demande un sport.',
    });
    expect((no as HTMLInputElement).disabled).toBe(true);
    expect(within(group).getByRole('radio', { name: 'Oui', checked: true })).toBeTruthy();
    expect(screen.getByLabelText('Oui')).toBe(within(group).getByRole('radio', { name: 'Oui' }));
  });

  it('rend la valeur d’origine (nombre compris) à onChange', () => {
    const onChange = vi.fn();
    render(
      <ChoiceList<number>
        name="days"
        legend="Séances par semaine"
        value={null}
        onChange={onChange}
        options={[2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: '3' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe('Chips', () => {
  function Rhythm() {
    const [value, setValue] = useState<string | null>('60');
    return (
      <Chips
        name="minutes"
        legend="Durée d'une séance"
        value={value}
        onChange={setValue}
        options={['45', '60', '75'].map((v) => ({ value: v, label: `${v} min` }))}
      />
    );
  }

  it('radios sous une légende ; un clic change la valeur', () => {
    render(<Rhythm />);
    const group = screen.getByRole('group', { name: "Durée d'une séance" });
    expect(within(group).getByRole('radio', { name: '60 min', checked: true })).toBeTruthy();
    fireEvent.click(within(group).getByRole('radio', { name: '45 min' }));
    expect(within(group).getByRole('radio', { name: '45 min', checked: true })).toBeTruthy();
    expect(within(group).getByRole('radio', { name: '60 min', checked: false })).toBeTruthy();
  });

  it('chaque pastille est une cible d’au moins 44 px ; la pastille choisie porte une coche', () => {
    render(<Rhythm />);
    const labels = ['45 min', '60 min', '75 min'].map(
      (t) => screen.getByText(t).closest('label') as HTMLElement,
    );
    for (const label of labels) expect(label.classList.contains(cls('chip'))).toBe(true);
    expect(px(rule('.chip')?.get('min-height'))).toBeGreaterThanOrEqual(44);
    const checked = labels.filter((l) => l.querySelector('[data-check]'));
    expect(checked.map((l) => l.textContent)).toEqual(['60 min']);
  });
});

describe('Switch', () => {
  function Prudent() {
    const [on, setOn] = useState(false);
    return (
      <Switch
        id="prudent"
        label="Je préfère une progression plus prudente"
        help="Réglage d'entraînement, pas une donnée de santé."
        checked={on}
        onChange={setOn}
      />
    );
  }

  it('role switch, nommé par son libellé, décrit par son aide, aria-checked suit l’état', () => {
    render(<Prudent />);
    const sw = screen.getByRole('switch', {
      name: 'Je préfère une progression plus prudente',
      description: "Réglage d'entraînement, pas une donnée de santé.",
    });
    expect(sw.id).toBe('prudent');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByText('Je préfère une progression plus prudente'));
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('vrai bouton : Espace et Entrée l’actionnent nativement ; cible d’au moins 44 px', () => {
    const onChange = vi.fn();
    render(<Switch id="v" label="Visible" checked onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Visible', checked: true });
    expect(sw.tagName).toBe('BUTTON');
    expect(sw.getAttribute('type')).toBe('button');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(sw.classList.contains(cls('switch'))).toBe(true);
    expect(px(rule('.switch')?.get('min-height'))).toBeGreaterThanOrEqual(44);
    expect(px(rule('.switch')?.get('min-width'))).toBeGreaterThanOrEqual(44);
  });
});

describe('SegmentedProgress', () => {
  it('« Étape 3 sur 9 », 9 segments dont 3 faits', () => {
    const { container } = render(<SegmentedProgress step={3} total={9} />);
    expect(screen.getByText('Étape 3 sur 9')).toBeTruthy();
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(9);
    expect(container.querySelectorAll('[data-segment][data-done]')).toHaveLength(3);
    for (const segment of container.querySelectorAll('[data-segment]')) {
      expect(segment.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });
});

describe('Badge', () => {
  it('affiche son texte, quel que soit le ton', () => {
    render(
      <>
        <Badge tone="accent">Admin</Badge>
        <Badge tone="success">Actif</Badge>
        <Badge tone="muted">Désactivé</Badge>
        <Badge tone="warning">En attente</Badge>
        <Badge tone="danger">Refusé</Badge>
      </>,
    );
    for (const text of ['Admin', 'Actif', 'Désactivé', 'En attente', 'Refusé']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });
});

describe('ListGroup et ListRow', () => {
  it('ligne lien : nommée par son libellé, décrite par sa valeur et son badge, chevron décoratif', () => {
    render(
      <ListGroup title="Compte et appli">
        <ListRow
          icon={icon}
          label="Réglages"
          value="Apparence, synchronisation"
          href="/settings"
          badge={<Badge tone="warning">1 refusé</Badge>}
        />
      </ListGroup>,
    );
    const region = screen.getByRole('region', { name: 'Compte et appli' });
    expect(within(region).getByRole('list')).toBeTruthy();
    const link = within(region).getByRole('link', {
      name: 'Réglages',
      description: 'Apparence, synchronisation 1 refusé',
    });
    expect(link.getAttribute('href')).toBe('/settings');
    expect(link.querySelectorAll('svg').length).toBeGreaterThan(0);
    for (const svg of link.querySelectorAll('svg'))
      expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(link.classList.contains(cls('row'))).toBe(true);
    expect(px(rule('.row')?.get('min-height'))).toBe(56);
  });

  it('ligne bouton (onClick) avec chevron, ligne danger sans chevron, ligne d’information sans action', () => {
    const onClick = vi.fn();
    render(
      <ListGroup>
        <ListRow label="Mot de passe" onClick={onClick} />
        <ListRow label="Se déconnecter" tone="danger" onClick={onClick} />
        <ListRow label="Connexion" value="En ligne" />
      </ListGroup>,
    );
    const password = screen.getByRole('button', { name: 'Mot de passe' });
    const logout = screen.getByRole('button', { name: 'Se déconnecter' });
    fireEvent.click(password);
    fireEvent.click(logout);
    expect(onClick).toHaveBeenCalledTimes(2);
    // Maquettes : une ligne qui mène ailleurs a son chevron ; l'action dangereuse isolée (C01) n'en a pas.
    expect(password.querySelector('svg')).not.toBeNull();
    expect(logout.querySelector('svg')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button', { name: /Connexion/ })).toBeNull();
    expect(screen.getByText('En ligne')).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('titre, phrase et action ; l’icône est décorative', () => {
    render(
      <EmptyState
        icon={icon}
        title="Aucune salle"
        text="Ajoute ta salle pour la retrouver ici."
        action={<Button>Ajouter une salle</Button>}
      />,
    );
    expect(screen.getByText('Aucune salle')).toBeTruthy();
    expect(screen.getByText('Ajoute ta salle pour la retrouver ici.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ajouter une salle' })).toBeTruthy();
    expect(
      screen.getByText('Aucune salle').parentElement?.querySelector('svg')?.closest('[aria-hidden="true"]'),
    ).toBeTruthy();
  });
});

describe('PageHeader', () => {
  it('back="/profile" : lien « Retour » vers /profile, puis le titre de niveau 1', () => {
    render(<PageHeader title="Réglages" back="/profile" />);
    const back = screen.getByRole('link', { name: 'Retour' });
    expect(back.getAttribute('href')).toBe('/profile');
    expect(screen.getByRole('heading', { level: 1, name: 'Réglages' })).toBeTruthy();
    expect(back.classList.contains(cls('backButton'))).toBe(true);
    expect(px(rule('.backButton')?.get('width'))).toBe(44);
    expect(px(rule('.backButton')?.get('height'))).toBe(44);
  });

  it('back fonction : bouton « Retour » qui l’appelle ; sans back, pas de Retour', () => {
    const back = vi.fn();
    const { rerender } = render(<PageHeader title="Mon coach" back={back} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(back).toHaveBeenCalledTimes(1);
    rerender(<PageHeader title="Profil" />);
    expect(screen.queryByRole('button', { name: 'Retour' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Retour' })).toBeNull();
  });
});

describe('Banner', () => {
  it('erreur annoncée tout de suite (alert), le reste poliment (status) ; icône décorative', () => {
    render(
      <>
        <Banner tone="error">Connexion impossible.</Banner>
        <Banner tone="warning">Nécessite le réseau.</Banner>
        <Banner tone="info">Nouvelle version disponible</Banner>
      </>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Connexion impossible.');
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toEqual([
      'Nécessite le réseau.',
      'Nouvelle version disponible',
    ]);
    for (const banner of [alert, ...screen.getAllByRole('status')]) {
      const svg = banner.querySelector('svg');
      expect(svg?.closest('[aria-hidden="true"]')).toBeTruthy();
    }
  });
});
