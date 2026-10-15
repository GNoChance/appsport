import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
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

/**
 * Icône qui s'annoncerait d'elle-même (role img, nommée) : seul l'aria-hidden posé par le composant
 * autour d'elle la tait. Une icône déjà cachée rendrait vides les vérifications « décorative ».
 */
const icon = (
  <svg role="img" aria-label="haltère" viewBox="0 0 24 24">
    <path d="M6 7v10" />
  </svg>
);
/** L'icône d'essai est rendue mais pas annoncée : un ancêtre aria-hidden la retire de l'arbre d'accessibilité. */
const expectIconSilenced = () => {
  expect(screen.getByRole('img', { name: 'haltère', hidden: true })).toBeTruthy();
  expect(screen.queryByRole('img', { name: 'haltère' })).toBeNull();
};

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
    expectIconSilenced();
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

  it('description et describedBy ensemble : la carte désactivée garde les deux, description d’abord', () => {
    render(
      <>
        <p id="raison">Ton objectif demande une salle.</p>
        <ChoiceCard
          type="radio"
          name="place"
          value="home"
          checked={false}
          disabled
          onChange={() => {}}
          title="À la maison"
          description="Poids du corps et haltères"
          describedBy="raison"
        />
      </>,
    );
    const radio = screen.getByRole('radio', {
      name: 'À la maison',
      description: 'Poids du corps et haltères Ton objectif demande une salle.',
    });
    expect((radio as HTMLInputElement).disabled).toBe(true);
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

  const options = ['45', '60', '75'].map((v) => ({ value: v, label: `${v} min` }));
  /** Libellés des pastilles qui portent la coche (la sélection ne passe jamais par la seule couleur). */
  const checkedLabels = () =>
    ['45 min', '60 min', '75 min'].filter((t) =>
      (screen.getByText(t).closest('label') as HTMLElement).querySelector('[data-check]'),
    );

  it('radios sous une légende ; un clic rend la valeur choisie à onChange', () => {
    const onChange = vi.fn();
    render(<Chips name="m" legend="Durée d'une séance" value="60" onChange={onChange} options={options} />);
    const group = screen.getByRole('group', { name: "Durée d'une séance" });
    expect(within(group).getByRole('radio', { name: '60 min', checked: true })).toBeTruthy();
    fireEvent.click(within(group).getByRole('radio', { name: '45 min' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('45');
  });

  it('contrôlée par value : la coche et l’état suivent le parent, rien de coché sans valeur', () => {
    const { rerender } = render(<Rhythm />);
    const group = screen.getByRole('group', { name: "Durée d'une séance" });
    fireEvent.click(within(group).getByRole('radio', { name: '45 min' }));
    expect(within(group).getByRole('radio', { name: '45 min', checked: true })).toBeTruthy();
    expect(within(group).getByRole('radio', { name: '60 min', checked: false })).toBeTruthy();
    expect(checkedLabels()).toEqual(['45 min']);
    rerender(
      <Chips name="m" legend="Durée d'une séance" value={null} onChange={() => {}} options={options} />,
    );
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    expect(checkedLabels()).toEqual([]);
  });

  it('chaque pastille est une cible d’au moins 44 px ; la pastille choisie porte une coche', () => {
    render(<Rhythm />);
    const labels = ['45 min', '60 min', '75 min'].map(
      (t) => screen.getByText(t).closest('label') as HTMLElement,
    );
    for (const label of labels) expect(label.classList.contains(cls('chip'))).toBe(true);
    expect(px(rule('.chip')?.get('min-height'))).toBeGreaterThanOrEqual(44);
    expect(checkedLabels()).toEqual(['60 min']);
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

  it('aria-checked vient du parent : un checked changé sans clic est annoncé', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Switch id="p" label="Partager" checked={false} onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Partager' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    rerender(<Switch id="p" label="Partager" checked onChange={onChange} />);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    rerender(<Switch id="p" label="Partager" checked={false} onChange={onChange} />);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('parent qui refuse le changement : onChange demande true, aria-checked reste l’état réel', () => {
    const onChange = vi.fn();
    render(<Switch id="r" label="Synchroniser" checked={false} onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Synchroniser' });
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  // Espace et Entrée viennent du <button> natif ; happy-dom ne simule pas l'activation au clavier, ce
  // test prouve donc seulement la nature du contrôle. La vérification clavier ira dans un E2E quand un
  // écran rendra un Switch.
  it('bouton natif de type button, sans tabindex forcé ; clic ; cible d’au moins 44 px', () => {
    const onChange = vi.fn();
    render(<Switch id="v" label="Visible" checked onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Visible', checked: true });
    expect(sw.tagName).toBe('BUTTON');
    expect(sw.getAttribute('type')).toBe('button');
    expect(sw.hasAttribute('tabindex')).toBe(false);
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(sw.classList.contains(cls('switch'))).toBe(true);
    expect(px(rule('.switch')?.get('min-height'))).toBeGreaterThanOrEqual(44);
    expect(px(rule('.switch')?.get('min-width'))).toBeGreaterThanOrEqual(44);
  });
});

describe('SegmentedProgress', () => {
  /** État de chaque segment, dans l'ordre de la barre : `true` s'il est fait. */
  const filled = (container: HTMLElement) =>
    [...container.querySelectorAll('[data-segment]')].map((segment) => segment.hasAttribute('data-done'));
  /** Les `done` premiers segments faits sur `total`, les autres non. */
  const firsts = (done: number, total: number) => Array.from({ length: total }, (_, i) => i < done);

  it('« Étape 3 sur 9 », 9 segments dont les 3 premiers faits', () => {
    const { container } = render(<SegmentedProgress step={3} total={9} />);
    expect(screen.getByText('Étape 3 sur 9')).toBeTruthy();
    expect(filled(container)).toEqual([true, true, true, false, false, false, false, false, false]);
    for (const segment of container.querySelectorAll('[data-segment]')) {
      expect(segment.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  // La barre est cachée aux lecteurs d'écran : le texte est la seule copie lisible, il dit donc
  // toujours ce que la barre montre, même pour une étape hors bornes ou non entière.
  it.each([
    { step: 0, done: 0 },
    { step: 1, done: 1 },
    { step: 9, done: 9 },
    { step: 11, done: 9 },
    { step: -1, done: 0 },
    { step: 2.6, done: 3 },
    { step: Number.NaN, done: 0 },
  ])(
    'step=$step total=9 : « Étape $done sur 9 », $done segments faits en tête de barre',
    ({ step, done }) => {
      const { container } = render(<SegmentedProgress step={step} total={9} />);
      expect(screen.getByText(`Étape ${done} sur 9`)).toBeTruthy();
      expect(filled(container)).toEqual(firsts(done, 9));
    },
  );

  // Le total passe par le même arrondi : le texte ne dit jamais « sur 9.4 » ou « sur NaN » à côté
  // d'une barre de 9 ou de 0 segments, et un total infini ne fait pas planter le rendu.
  it.each([
    { total: 9.4, shown: 9, done: 3 },
    { total: 2.6, shown: 3, done: 3 },
    { total: -2, shown: 0, done: 0 },
    { total: Number.NaN, shown: 0, done: 0 },
    { total: Number.POSITIVE_INFINITY, shown: 0, done: 0 },
  ])(
    'step=3 total=$total : « Étape $done sur $shown », $shown segments dont les $done premiers faits',
    ({ total, shown, done }) => {
      const { container } = render(<SegmentedProgress step={3} total={total} />);
      expect(screen.getByText(`Étape ${done} sur ${shown}`)).toBeTruthy();
      expect(filled(container)).toEqual(firsts(done, shown));
    },
  );
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
    expect(link.querySelectorAll('[data-chevron]')).toHaveLength(1);
    for (const svg of link.querySelectorAll('svg'))
      expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
    expectIconSilenced();
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
    expect(password.querySelectorAll('[data-chevron]')).toHaveLength(1);
    expect(logout.querySelector('[data-chevron]')).toBeNull();
    expect(screen.getByText('En ligne').closest('li')?.querySelector('[data-chevron]')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button', { name: /Connexion/ })).toBeNull();
    expect(screen.getByText('En ligne')).toBeTruthy();
  });

  it('emphasis="value" (maquettes C02, C03, C05) : petit libellé au-dessus, valeur en gras, nom et description inchangés', () => {
    render(
      <ListGroup>
        <ListRow label="Objectif" value="Prendre du muscle" emphasis="value" onClick={() => {}} />
        <ListRow label="Connexion" value="En ligne" emphasis="value" />
        <ListRow label="Mot de passe" value="Tes autres appareils seront déconnectés." onClick={() => {}} />
      </ListGroup>,
    );
    const goal = screen.getByRole('button', { name: 'Objectif', description: 'Prendre du muscle' });
    expect(goal.getAttribute('data-emphasis')).toBe('value');
    expect(screen.getByText('En ligne').closest(`.${cls('row')}`)?.getAttribute('data-emphasis')).toBe('value');
    // Par défaut, le libellé reste en gras et la valeur en petit (lignes qui mènent ailleurs, C01).
    expect(screen.getByRole('button', { name: 'Mot de passe' }).hasAttribute('data-emphasis')).toBe(false);
    const label = rule('.row[data-emphasis="value"] .rowLabel');
    const value = rule('.row[data-emphasis="value"] .rowValue');
    expect(label?.get('font-weight')).toBe('400');
    expect(label?.get('font-size')).toBe(rule('.rowValue')?.get('font-size'));
    expect(label?.get('color')).toBe('var(--text-muted)');
    expect(value?.get('font-weight')).toBe('600');
    expect(value?.get('font-size')).toBe('1rem');
    expect(value?.get('color')).toBe('var(--text)');
  });

  it('ligne lien avec onClick : le clic lance onClick puis navigue, sans devenir un bouton', () => {
    const memory = memoryLocation({ path: '/profile', record: true });
    /** Adresses déjà visitées au moment où onClick tourne. */
    const seenFrom: string[][] = [];
    const markSeen = vi.fn(() => {
      seenFrom.push([...(memory.history ?? [])]);
    });
    render(
      <Router hook={memory.hook}>
        <ListGroup>
          <ListRow label="Réglages" href="/settings" onClick={markSeen} />
        </ListGroup>
      </Router>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Réglages' }));
    expect(markSeen).toHaveBeenCalledTimes(1);
    expect(seenFrom).toEqual([['/profile']]);
    expect(memory.history).toEqual(['/profile', '/settings']);
    expect(screen.queryByRole('button')).toBeNull();
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
    expectIconSilenced();
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

  it('sans Retour (onglet, écran) : titre d’écran 28 px, 6 px au-dessus ; avec Retour : titre de page interne 24 px', () => {
    const { rerender } = render(<PageHeader title="Réglages" back="/profile" />);
    const inner = screen.getByRole('heading', { level: 1, name: 'Réglages' });
    expect(inner.classList.contains(cls('pageTitle'))).toBe(true);
    expect(inner.classList.contains(cls('screenTitle'))).toBe(false);
    expect(rule('.pageTitle')?.get('font-size')).toBe('1.5rem');
    rerender(<PageHeader title="Progression" />);
    const top = screen.getByRole('heading', { level: 1, name: 'Progression' });
    expect(top.classList.contains(cls('pageTitle'))).toBe(true);
    expect(top.classList.contains(cls('screenTitle'))).toBe(true);
    // Deux classes : la règle l'emporte sur `.page h1` (une classe et un élément) quel que soit son rang.
    expect(rule('.pageTitle.screenTitle')?.get('font-size')).toBe('1.75rem');
    expect(rule('.pageTitle.screenTitle')?.get('margin-top')).toBe('6px');
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
