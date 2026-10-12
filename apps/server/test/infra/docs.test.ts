import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIVACY_POLICY_VERSION } from '@appsport/contracts';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** Procédures écrites de 08 §12, une page chacune (`docs/exploitation/Pn-…md`). */
const PROCEDURES = [
  'P1-installation',
  'P2-deverrouiller',
  'P3-deployer',
  'P4-restaurer',
  'P5-rotation-secrets',
  'P6-proches',
  'P7-maintenance',
  'P8-incident',
  'P9-admin-indisponible',
] as const;
const RUNBOOK = 'infra/RUNBOOK-reconstruction.md';

const doc = (name: string): string => read(`docs/exploitation/${name}.md`);
const p = Object.fromEntries(PROCEDURES.map((name, i) => [i + 1, doc(name)])) as Record<number, string>;
const installer = doc('installer-appsport');
const recette = doc('recette-telephones');
const runbook = read(RUNBOOK);
const fiche = read('docs/fiche-de-traitement.md');
const incidents = read('docs/incidents.md');

/** Toutes les pages d'exploitation et le runbook : là où l'admin trouve les commandes. */
const opsText = (): string => [...Object.values(p), installer, recette, runbook].join('\n');

/** Lignes marquées dans un bloc de code ou non (blocs indentés dans une étape compris). */
function proseLines(text: string): { line: string; code: boolean }[] {
  let code = false;
  return text.split(/\r?\n/).map((line) => {
    if (line.trimStart().startsWith('```')) {
      code = !code;
      return { line, code: true };
    }
    return { line, code };
  });
}

/** Sections `## Titre`, dans l'ordre : titre et corps jusqu'au titre `##` suivant. */
function sections(text: string): { title: string; body: string }[] {
  const out: { title: string; lines: string[] }[] = [];
  for (const { line, code } of proseLines(text)) {
    const heading = code ? null : /^## (.+)$/.exec(line);
    if (heading) out.push({ title: (heading[1] as string).trim(), lines: [] });
    else out.at(-1)?.lines.push(line);
  }
  return out.map((s) => ({ title: s.title, body: s.lines.join('\n') }));
}

function section(text: string, title: string): string {
  const found = sections(text).find((s) => s.title === title);
  if (!found) throw new Error(`Section « ${title} » absente`);
  return found.body;
}

/** Étapes `N. **action**` : chacune jusqu'à l'étape ou au titre suivant. */
function steps(text: string): { n: number; head: string; body: string }[] {
  const out: { n: number; head: string; lines: string[] }[] = [];
  let open = false;
  for (const { line, code } of proseLines(text)) {
    if (!code && /^#{1,6} /.test(line)) {
      open = false;
      continue;
    }
    const step = code ? null : /^(\d+)\. \*\*(.+?)\*\*/.exec(line);
    if (step) {
      out.push({ n: Number(step[1]), head: step[2] as string, lines: [] });
      open = true;
    } else if (open) out.at(-1)?.lines.push(line);
  }
  return out.map((s) => ({ n: s.n, head: s.head, body: s.lines.join('\n') }));
}

/** Première occurrence de chaque chaîne, strictement dans l'ordre donné. */
function expectInOrder(text: string, needles: readonly string[]): void {
  let previous = -1;
  needles.forEach((needle, i) => {
    const at = text.indexOf(needle);
    expect(at, `« ${needle} » absent`).toBeGreaterThanOrEqual(0);
    if (i > 0) expect(at, `« ${needle} » avant « ${needles[i - 1]} »`).toBeGreaterThan(previous);
    previous = at;
  });
}

function expectSteps(name: string, text: string): void {
  const all = steps(text);
  expect(all.length, `${name} : aucune étape numérotée`).toBeGreaterThan(0);
  for (const s of all) {
    expect(s.body, `${name}, étape ${s.n} « ${s.head} » : Résultat attendu`).toContain('Résultat attendu :');
    expect(s.body, `${name}, étape ${s.n} « ${s.head} » : Sinon`).toContain('Sinon :');
  }
}

/** Contrôles de 01 §9.3 R-TST-4, mot pour mot, sans la ponctuation finale (ruling C2 : 7 contrôles). */
const RTST4 = [
  'démarrage à froid en mode avion, appli tuée',
  '100 séries hors ligne, puis retour du VPN : ni perte ni doublon, et le compteur revient à 0',
  "Tailscale coupé avec le Wi-Fi ou la 4G actifs : la saisie reste fluide et l'appli affiche « hors ligne » en 4 s au plus",
  'redémarrage du téléphone avec une file non vide',
  'mise à jour de la PWA avec une file non vide, hors séance',
  'une fois à la recette du socle, puis à chaque changement du stockage : 7 jours sans réseau, puis synchro',
  'onboarding complet en moins de 2 min, hors écran Santé (section Comptes, R-ONB-4)',
] as const;
/** Contrôles sans saisie J avant la brique 3 : seuls 2, 4 et 5 peuvent être « sans objet au socle ». */
const RTST4_SANS_OBJET = new Set([1, 3, 4]);

const CLI = [
  'init',
  'db:check',
  'admin:bootstrap',
  'admin:reset',
  'snapshot',
  'restore',
  'privacy:collect',
  'privacy:reapply',
  'sessions:active',
  'db:stats',
] as const;
const SCRIPTS = [
  'appsport-unlock',
  'appsport-update',
  'appsport-backup',
  'appsport-restore-test',
  'appsport-alive',
  'appsport-check',
] as const;
/** Préfixe des commandes compose des scripts hôte (infra/host/lib/common.sh). */
const COMPOSE =
  'docker compose --project-name appsport -f /opt/appsport/infra/compose.yaml --env-file /srv/appsport/deploy.env';

describe('docs/exploitation : procédures P1 à P9 (08 §12)', () => {
  PROCEDURES.forEach((name, i) => {
    const n = i + 1;
    it(`${name} : titre « # P${n} », Quand, Durée, étapes avec résultat attendu et sinon, commandes`, () => {
      const text = p[n] as string;
      expect(text.split(/\r?\n/)[0]).toMatch(new RegExp(`^# P${n} \\S`));
      expect(text).toContain('Quand : ');
      expect(text).toContain('Durée : ');
      expect(text).toContain('```');
      expectSteps(name, text);
    });
  });

  it("fiche « Installer appsport », recette sur téléphones et runbook : même format d'étapes", () => {
    expectSteps('installer-appsport', installer);
    expectSteps('recette-telephones', recette);
    expectSteps(RUNBOOK, runbook);
  });

  it('les 6 scripts appsport-* de 08 §15 sont cités', () => {
    for (const script of SCRIPTS) expect(opsText()).toContain(script);
  });

  it.each(CLI)('server.mjs %s est cité', (c) =>
    expect(opsText()).toMatch(new RegExp(`server\\.mjs ${c}(?![\\w:-])`)),
  );

  it('chaque commande docker compose des procédures a le préfixe des scripts hôte', () => {
    const lines = proseLines(opsText())
      .filter((l) => l.code && l.line.includes('docker compose'))
      .map((l) => l.line);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toContain(COMPOSE);
  });

  it('commandes de la CLI : exec -T si app tourne, run --rm --no-deps sinon', () => {
    for (const { line, code } of proseLines(opsText())) {
      if (!code || !line.includes(COMPOSE) || !line.includes('server.mjs')) continue;
      expect(line).toMatch(/ (exec -T|run --rm --no-deps) app node \/app\/server\.mjs /);
    }
  });
});

describe('P1 Installation initiale', () => {
  const p1 = p[1] as string;

  it("sections dans l'ordre de 08 §12", () => {
    expect(sections(p1).map((s) => s.title)).toEqual([
      'BIOS',
      'Debian',
      'Volume chiffré',
      'Docker',
      'Tailscale',
      'Pare-feu (ufw)',
      'Dépôt et secrets',
      'Dépôts restic',
      'Timers systemd',
      'Healthchecks',
      'Initialisation de la base et invitation admin',
      'Premier déploiement',
      'Recette',
      'Exercice de reconstruction',
      'Enveloppe de secours',
    ]);
  });

  it('chaque décision dans sa section', () => {
    const where: Record<string, readonly string[]> = {
      'Volume chiffré': [
        'appsport /dev/disk/by-partlabel/appsport-data none luks,noauto',
        '/dev/mapper/appsport /srv/appsport ext4 noauto,nofail 0 2',
        'chattr +i /srv/appsport',
        '6 mots',
      ],
      Docker: ['systemctl disable docker.service docker.socket', '"data-root": "/srv/appsport/docker"'],
      Tailscale: [
        'tailscale up --ssh',
        'tailscale serve --bg --https=443 http://127.0.0.1:3000',
        'tailscale set --auto-update',
      ],
      'Pare-feu (ufw)': ['IPV6=yes', '/etc/default/ufw', 'allow in on tailscale0'],
      'Dépôt et secrets': [
        'known_hosts',
        'ln -s /opt/appsport/infra/host/appsport-* /usr/local/sbin/',
        'VITE_OWNER_FIRST_NAME',
        'chmod 600',
      ],
      'Dépôts restic': [
        'EU Central',
        'limitée au bucket',
        'RESTIC_OFFSITE_REPOSITORY',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
      ],
      Healthchecks: ['APPSPORT_URL'],
      'Initialisation de la base et invitation admin': ['chown -R 1000:1000 /srv/appsport/data'],
    };
    for (const [title, needles] of Object.entries(where)) {
      const body = section(p1, title);
      for (const needle of needles) expect(body, `${title} : ${needle}`).toContain(needle);
    }
  });

  it('chattr +i sur le point de montage vide avant le premier montage (R-OPS-1)', () => {
    const body = section(p1, 'Volume chiffré');
    expect(body.indexOf('chattr +i /srv/appsport')).toBeLessThan(body.indexOf('mount /srv/appsport'));
  });

  it("known_hosts de root vérifié contre l'empreinte publiée par GitHub", () => {
    const body = section(p1, 'Dépôt et secrets');
    expect(body).toContain('/root/.ssh/known_hosts');
    expect(body).toMatch(/empreinte[^\n]*publiée par GitHub/);
  });

  it('Healthchecks : les 4 contrôles de 08 §9 et leurs délais [décision plan]', () => {
    const body = section(p1, 'Healthchecks');
    for (const check of [
      'alive : 5 min, grâce 8 min',
      'backup : 24 h, grâce 2 h',
      'host : 24 h, grâce 2 h',
      'restore-test : 35 j, grâce 3 j',
    ]) {
      expect(body).toContain(check);
    }
  });

  it("première installation dans l'ordre, sans appsport-update (qui exige une appli saine)", () => {
    const text = [
      section(p1, 'Initialisation de la base et invitation admin'),
      section(p1, 'Premier déploiement'),
    ].join('\n');
    expectInOrder(text, [
      'APPSPORT_VERSION=v',
      ' pull',
      '.appsport-volume',
      'server.mjs init',
      'server.mjs admin:bootstrap',
      ' up -d',
    ]);
    expect(text).toContain(`${COMPOSE} run --rm --no-deps app node /app/server.mjs init`);
    expect(text).toContain(`${COMPOSE} run --rm --no-deps app node /app/server.mjs admin:bootstrap`);
    expect(text).not.toContain('appsport-update');
  });

  it('Recette : les 11 critères de 08 §13, puis la recette sur téléphones', () => {
    const body = section(p1, 'Recette');
    const items = steps(body);
    expect(items.length).toBeGreaterThanOrEqual(12);
    const eleventh = body.indexOf((items[10] as { head: string }).head);
    expect(body.indexOf('recette-telephones.md')).toBeGreaterThan(eleventh);
  });

  it('Exercice de reconstruction avant la première invitation (R-OPS-12)', () => {
    const body = section(p1, 'Exercice de reconstruction');
    expect(body).toContain('RUNBOOK-reconstruction.md');
    expect(body).toContain('avant la première invitation');
  });

  it('Enveloppe de secours (R-OPS-14)', () => {
    const body = section(p1, 'Enveloppe de secours');
    for (const word of ['phrase LUKS', 'compte Unix', 'mot de passe restic', 'clé B2', 'P2', 'P9', 'datée']) {
      expect(body).toContain(word);
    }
  });
});

describe('P2 à P9', () => {
  it('P2 : Tailscale SSH puis appsport-unlock, sinon P8', () => {
    expectInOrder(p[2] as string, [
      'ssh appsport',
      'sudo appsport-unlock',
      'OK : appsport répond (version vX.Y.Z).',
    ]);
    expect(p[2]).toContain('P8');
  });

  it('P3 : contrôles avant le tag, déploiement, deploy.log, retour arrière', () => {
    const p3 = p[3] as string;
    const tag = p3.indexOf('git tag');
    expect(tag).toBeGreaterThan(0);
    for (const before of ['numéros de la page Aide', 'recette-telephones.md', 'src/sw', 'local-db', 'iOS']) {
      const at = p3.indexOf(before);
      expect(at, before).toBeGreaterThanOrEqual(0);
      expect(at, `${before} avant git tag`).toBeLessThan(tag);
    }
    expectInOrder(p3, ['git tag', 'release', 'sudo appsport-update vX.Y.Z', 'deploy.log']);
    for (const result of [
      'ok',
      'pull-failed',
      'backup-failed',
      'rolled-back-image',
      'rolled-back-restore',
      'rollback-failed',
    ]) {
      expect(p3).toContain(`| \`${result}\` |`);
    }
    expect(p3).toContain('sudo appsport-update --rollback');
    expect(p3).toMatch(/jeton GHCR expiré[^\n]*P5/);
  });

  it('P4 « Sur place » : collecte, arrêt, restauration, réapplication, puis seulement redémarrage', () => {
    const body = section(p[4] as string, 'Sur place');
    expectInOrder(body, [
      'server.mjs privacy:collect',
      'stop app',
      'server.mjs restore',
      'server.mjs privacy:reapply',
      'up -d',
    ]);
    expect(body).toContain('--source');
    expect(body).toContain('replaced-');
    expect(body).toContain('Aucun administrateur actif');
    expect(body).toContain('reapply-pending');
    expect(body).toContain('60 derniers jours');
  });

  it('P4 « Nouvelle machine » : identité Tailscale restaurée avant de démarrer tailscaled', () => {
    const body = section(p[4] as string, 'Nouvelle machine');
    expectInOrder(body, ['/var/lib/tailscale', 'systemctl start tailscaled']);
    expect(body).toContain('même version');
  });

  it('P5 : tableau de 08 §10, rotations et enveloppe refaite', () => {
    for (const needle of [
      'appsport-prod-AAAAMM',
      'restic key add',
      'key remove',
      'luksAddKey',
      'luksRemoveKey',
      'docker login ghcr.io',
      'enveloppe',
    ]) {
      expect(p[5]).toContain(needle);
    }
  });

  it('P6 : chaque proche a son propre compte Tailscale (P-MIN-4)', () => {
    expect(p[6]).toContain('son propre compte Tailscale');
    expect(p[6]).toContain('installer-appsport.md');
  });

  it('P7 : conteneur recréé chaque mois (journaux de 90 jours au plus, R-OPS-15)', () => {
    for (const needle of ['apt full-upgrade', 'reboot-required', 'up -d --force-recreate app', '90 jours']) {
      expect(p[7]).toContain(needle);
    }
  });

  it("P8 : une section par alerte de 08 §9, interrupteur d'urgence, vol ou fuite", () => {
    const p8 = p[8] as string;
    const titles = sections(p8).map((s) => s.title);
    for (const check of ['alive', 'backup', 'restore-test', 'host']) {
      expect(
        titles.some((t) => t.includes(`\`${check}\``)),
        `section de l'alerte ${check}`,
      ).toBe(true);
    }
    expectInOrder(section(p8, "Interrupteur d'urgence"), [
      'SW_KILL_SWITCH=1',
      'secrets/app.env',
      '"swKill":true',
      '"swKill":false',
    ]);
    const theft = section(p8, 'Vol, cambriolage ou fuite');
    for (const needle of ['72 h', 'server.mjs admin:reset', 'P5', 'docs/incidents.md']) {
      expect(theft).toContain(needle);
    }
  });

  it('P9 : déverrouillage au clavier, export par les proches, rien sans admin', () => {
    for (const needle of [
      'appsport-unlock',
      'export',
      "Aucune invitation ni réinitialisation n'est possible sans admin.",
    ]) {
      expect(p[9]).toContain(needle);
    }
  });
});

describe('fiches pour les proches et recette', () => {
  it('installer-appsport : 08 §6 côté proche et §11, une capture par étape', () => {
    for (const needle of [
      "Sur l'écran d'accueil",
      "Installer l'application",
      'VPN permanent',
      'Bloquer les connexions sans VPN',
      'Site introuvable',
      'son propre compte Tailscale',
    ]) {
      expect(installer).toContain(needle);
    }
    const all = steps(installer);
    for (const s of all) {
      const nn = String(s.n).padStart(2, '0');
      expect(s.body).toContain(`Capture : à ajouter pendant P1 (captures/installer-${nn}.png).`);
    }
    expect(installer.match(/Capture : à ajouter pendant P1/g)).toHaveLength(all.length);
  });

  it('recette-telephones : les 7 contrôles R-TST-4 mot pour mot, tirés de 01 §9.3', () => {
    const spec = read('docs/superpowers/specs/2026-10-06-appsport-design/01-architecture.md');
    const heads = steps(recette).map((s) => s.head);
    RTST4.forEach((control, i) => {
      expect(spec).toContain(control);
      expect(heads, control).toContain(control);
      const body = steps(recette).find((s) => s.head === control)?.body ?? '';
      if (!RTST4_SANS_OBJET.has(i)) expect(body, control).not.toContain('sans objet au socle');
    });
  });

  it('recette-telephones : iPhone et Android, R-ONB-4 chronométré, interrupteur et bandeau, tableau', () => {
    for (const needle of [
      'iPhone',
      'Android',
      "Interrupteur d'urgence",
      'Bandeau de mise à jour',
      '| Date | Version | Appareil | Résultat |',
    ]) {
      expect(recette).toContain(needle);
    }
    expect(recette).toMatch(/chronom/i);
  });

  it('runbook de reconstruction (R-OPS-12) : chronométré, moins de 2 h, B2, copie détruite, journal', () => {
    expect(runbook).toMatch(/chronom/i);
    for (const needle of [
      'moins de 2 h',
      'B2',
      'server.mjs restore',
      'Détruire la copie',
      '## Journal des exercices',
      '| Date | Durée | Écarts constatés |',
    ]) {
      expect(runbook).toContain(needle);
    }
  });
});

describe('registres de vie privée (03 §1, §14)', () => {
  it('fiche de traitement : sections, catégories, destinataires, version de la page Confidentialité', () => {
    const wanted = [
      'Responsable',
      'Finalités',
      'Personnes concernées',
      'Catégories de données',
      'Destinataires',
      'Transferts hors UE',
      'Durées de conservation',
      'Mesures de sécurité',
    ];
    expect(
      sections(fiche)
        .map((s) => s.title)
        .filter((t) => wanted.includes(t)),
    ).toEqual(wanted);
    for (const word of ['C0', 'C1', 'C2', 'C3', 'Anthropic', 'Backblaze', 'Tailscale', '30 jours']) {
      expect(fiche).toContain(word);
    }
    expect(fiche).toContain(`Version ${PRIVACY_POLICY_VERSION}`);
    expect(fiche).toContain('privacy-content.ts');
  });

  it('registre des incidents : consigne de 03 §14 et tableau vide', () => {
    expect(incidents).toContain('72 h');
    expect(incidents).toContain('| Date | Faits | Données exposées | Mesures | Personnes prévenues |');
    expect(incidents).toContain('Aucun incident enregistré.');
  });
});

describe('hygiène des documents', () => {
  const docs = {
    ...Object.fromEntries(PROCEDURES.map((name, i) => [`docs/exploitation/${name}.md`, p[i + 1] as string])),
    'docs/exploitation/installer-appsport.md': installer,
    'docs/exploitation/recette-telephones.md': recette,
    [RUNBOOK]: runbook,
    'docs/fiche-de-traitement.md': fiche,
    'docs/incidents.md': incidents,
  };

  it('aucun nom de tailnet, jeton ni URL de ping réels : des gabarits seulement', () => {
    for (const [path, text] of Object.entries(docs)) {
      for (const host of text.match(/\S*\.ts\.net/g) ?? []) {
        expect(host, path).toMatch(/(<tailnet>|\*)\.ts\.net$/);
      }
      expect(text, path).not.toMatch(/ghp_|github_pat_|tskey-|sk-ant-|hc-ping\.com\/[0-9a-f]{8}-/);
    }
  });

  it('les liens relatifs entre documents mènent à des fichiers du dépôt', () => {
    for (const [path, text] of Object.entries(docs)) {
      for (const [, target] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (/^[a-z]+:/.test(target as string)) continue;
        expect(existsSync(join(ROOT, dirname(path), target as string)), `${path} → ${target}`).toBe(true);
      }
    }
  });
});

describe('page Aide (07, 03 §13.7)', () => {
  /** Ancien numéro de la ligne TCA, jamais écrit en entier (ruling C5). */
  const OLD_TCA = new RegExp(['0810', '037', '037'].join('[ .]?'));
  const SKIP_NAMES = new Set([
    'node_modules',
    '.git',
    'dist',
    '.e2e-data',
    'test-results',
    'playwright-report',
  ]);
  const SKIP_PATHS = new Set(['docs/research', 'docs/superpowers', '.superpowers']);

  function textFiles(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (SKIP_NAMES.has(entry.name) || SKIP_PATHS.has(rel)) return [];
      if (entry.isDirectory()) return textFiles(rel);
      return entry.isFile() ? [rel] : [];
    });
  }

  it("l'ancien numéro de la ligne TCA n'apparaît dans aucun fichier texte du dépôt", () => {
    const files = textFiles('');
    expect(files).toContain('docs/fiche-de-traitement.md');
    const hits = files.filter((rel) => {
      const bytes = readFileSync(join(ROOT, rel));
      return !bytes.includes(0) && OLD_TCA.test(bytes.toString('utf8'));
    });
    expect(hits).toEqual([]);
  });
});
