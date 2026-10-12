import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
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

/** Les mêmes pages, par chemin : les contrôles de format et de commandes se font page par page. */
const OPS_DOCS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(PROCEDURES.map((name, i) => [`docs/exploitation/${name}.md`, p[i + 1] as string])),
  'docs/exploitation/installer-appsport.md': installer,
  'docs/exploitation/recette-telephones.md': recette,
  [RUNBOOK]: runbook,
};

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

/** Lignes des blocs de code seulement. */
const codeOf = (text: string): string =>
  proseLines(text)
    .filter((l) => l.code)
    .map((l) => l.line)
    .join('\n');

/** Motifs Healthchecks d'un script hôte : `ko "<message>" "<motif>"`, `ko|fail "<motif>"`, `problems+=("<motif>")`. */
function scriptMotifs(script: string): string[] {
  const out: string[] = [];
  for (const m of script.matchAll(/\b(?:ko|fail) "([^"]*)"(?: "([^"]*)")?/g))
    out.push((m[2] ?? m[1]) as string);
  for (const m of script.matchAll(/problems\+=\("([^"]*)"\)/g)) out.push(m[1] as string);
  return out.filter((motif) => !motif.startsWith('$'));
}

/** Motif → expression : une variable du shell (`$x`, `${x}`, `$((…))`) vaut un mot de la page (`N`, `<disque>`, `local`). */
function motifPattern(motif: string): RegExp {
  const parts = motif.split(/\$\(\([^)]*\)\)|\$\{[^}]*\}|\$\w+/);
  return new RegExp(parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\S+'));
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

/** Texte entre la ligne qui commence par `start` et la suivante qui commence par `end`. */
function between(text: string, start: string, end: string): string {
  const lines = text.split(/\r?\n/);
  const from = lines.findIndex((line) => line.startsWith(start));
  if (from < 0) throw new Error(`« ${start} » absent`);
  const to = lines.findIndex((line, i) => i > from && line.startsWith(end));
  return lines.slice(from + 1, to < 0 ? undefined : to).join('\n');
}

/** Cellules des lignes d'un tableau Markdown, sans la ligne d'en-tête ni le séparateur, gras retiré. */
function tableRows(text: string): string[][] {
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('|') && !/^\|[-| ]+\|$/.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim().replaceAll('**', '')),
    );
  return rows.slice(1);
}

/** Durées citées (« 30 jours », « 24 h », « tant que le compte existe »…), dans l'ordre. */
function durations(text: string): string[] {
  return (
    text.match(
      /\d+ (?:jours|mois|ans|h)(?![\p{L}\d])|tant que le compte existe|jusqu'à la déconnexion|jusqu'à leur expiration absolue/gu,
    ) ?? []
  );
}

/** Phrases de la section « Durées de conservation » de la page Confidentialité (T28). */
function pageRetention(): string {
  const source = read('apps/web/src/features/public/privacy-content.ts');
  const start = source.indexOf("title: 'Durées de conservation'");
  expect(start, 'section « Durées de conservation » de privacy-content.ts').toBeGreaterThanOrEqual(0);
  const end = source.indexOf('title:', start + 1);
  const block = source.slice(source.indexOf('items:', start), end < 0 ? undefined : end);
  return [...block.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]).join('\n');
}

const INCIDENTS_HEADER = '| Date | Faits | Données exposées | Mesures | Personnes prévenues |';

/** Le registre des incidents : tableau vide avec « Aucun incident enregistré. », ou lignes datées sans elle. */
function incidentProblems(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const header = lines.indexOf(INCIDENTS_HEADER);
  if (header < 0) return ['en-tête absent'];
  const problems: string[] = [];
  if (lines[header + 1] !== '|---|---|---|---|---|') problems.push('séparateur absent');
  const rows: string[] = [];
  for (let i = header + 2; lines[i]?.startsWith('|'); i += 1) rows.push(lines[i] as string);
  for (const row of rows) {
    if (!/^\| \d{4}-\d{2}-\d{2} \|(?: [^|]+ \|){4}$/.test(row)) problems.push(`ligne mal formée : ${row}`);
  }
  const none = /^Aucun incident enregistré\.$/m.test(text);
  if (rows.length === 0 && !none) problems.push('tableau vide sans « Aucun incident enregistré. »');
  if (rows.length > 0 && none) problems.push('« Aucun incident enregistré. » au-dessus de lignes');
  return problems;
}

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

  it('chaque page : blocs de code refermés, et toute ligne numérotée est une étape « N. **action** »', () => {
    for (const [path, text] of Object.entries(OPS_DOCS)) {
      const fences = text.split(/\r?\n/).filter((line) => line.trimStart().startsWith('```')).length;
      expect(fences % 2, `${path} : bloc de code non refermé`).toBe(0);
      for (const { line, code } of proseLines(text)) {
        if (!code && /^\s*\d+\. /.test(line)) expect(line, path).toMatch(/^\d+\. \*\*.+?\*\*/);
      }
    }
  });

  it('les 6 scripts appsport-* de 08 §15 sont cités', () => {
    for (const script of SCRIPTS) expect(opsText()).toContain(script);
  });

  it.each(CLI)('server.mjs %s est cité', (c) =>
    expect(opsText()).toMatch(new RegExp(`server\\.mjs ${c}(?![\\w:-])`)),
  );

  it('chaque commande docker compose des procédures a le préfixe des scripts hôte', () => {
    let count = 0;
    for (const [path, text] of Object.entries(OPS_DOCS)) {
      for (const { line, code } of proseLines(text)) {
        if (!code || !line.includes('docker compose')) continue;
        count += 1;
        expect(line, path).toContain(COMPOSE);
      }
    }
    expect(count).toBeGreaterThan(0);
  });

  it('commandes de la CLI : préfixe compose, exec -T si app tourne, run --rm --no-deps une fois arrêtée', () => {
    for (const [path, text] of Object.entries(OPS_DOCS)) {
      // État de `app` dans la section, d'après ses commandes : inconnu au début de chaque section.
      let app: 'inconnu' | 'arrêtée' | 'en marche' = 'inconnu';
      for (const { line, code } of proseLines(text)) {
        if (!code) {
          if (/^#{1,6} /.test(line)) app = 'inconnu';
          continue;
        }
        if (line.includes(COMPOSE) && /\s(?:stop|down)(?:\s+app)?\s*$/.test(line)) app = 'arrêtée';
        if (line.includes(COMPOSE) && /\sup -d\b/.test(line)) app = 'en marche';
        if (path.startsWith('docs/exploitation/') && line.includes('/app/server.mjs')) {
          expect(line, `${path} : CLI sans le préfixe compose`).toContain(COMPOSE);
        }
        if (!line.includes(COMPOSE) || !line.includes('server.mjs')) continue;
        expect(line, path).toMatch(/ (exec -T|run --rm --no-deps) app node \/app\/server\.mjs /);
        if (app === 'arrêtée') expect(line, `${path} : app arrêtée`).toContain(' run --rm --no-deps app ');
        if (app === 'en marche') expect(line, `${path} : app en marche`).toContain(' exec -T app ');
      }
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
      Docker: [
        'systemctl disable docker.service docker.socket',
        '"data-root": "/srv/appsport/docker"',
        'RequiresMountsFor=/srv/appsport',
      ],
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

  it("IPv6 filtré avant l'activation du pare-feu (03 §10)", () => {
    expectInOrder(section(p1, 'Pare-feu (ufw)'), ['IPV6=yes', 'ufw enable']);
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
      'chown -R 1000:1000 /srv/appsport/data',
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

  it('P3 : recette en échec, pas de tag ; les chemins comparés par git diff existent', () => {
    const p3 = p[3] as string;
    const recetteStep = steps(p3).find((s) => s.body.includes('recette-telephones.md'));
    expect(recetteStep?.body).toMatch(/Sinon :[^\n]*pas de tag/);
    const diff = proseLines(p3).find(({ line, code }) => code && /^\s*git diff .* -- /.test(line));
    const paths = (diff?.line.split(' -- ')[1] ?? '').trim().split(/\s+/).filter(Boolean);
    expect(paths.length, 'git diff sans chemins').toBeGreaterThan(0);
    for (const path of paths) expect(existsSync(join(ROOT, path)), `chemin du git diff : ${path}`).toBe(true);
  });

  it('P4 « Sur place » : collecte, marqueur, arrêt, restauration, réapplication, liste retirée, puis seulement redémarrage', () => {
    const body = section(p[4] as string, 'Sur place');
    expectInOrder(body, [
      'server.mjs privacy:collect',
      'tee /srv/appsport/reapply-pending',
      'stop app',
      'server.mjs restore',
      'server.mjs privacy:reapply',
      'rm /srv/appsport/data/ops/privacy-',
      'up -d',
    ]);
    expect(body).toContain(`${COMPOSE} run --rm --no-deps app node /app/server.mjs restore`);
    expect(body).toContain(`${COMPOSE} run --rm --no-deps app node /app/server.mjs privacy:reapply`);
    const rm = body.split(/\r?\n/).find((line) => line.includes('rm /srv/appsport/data/ops/privacy-'));
    expect(rm, 'la liste et le marqueur sont retirés ensemble').toContain('/srv/appsport/reapply-pending');
    expect(body).toContain('--source');
    expect(body).toContain('replaced-');
    expect(body).toContain('Aucun administrateur actif');
    expect(body).toContain('reapply-pending');
    expect(body).toContain('60 derniers jours');
  });

  it('P4 « Nouvelle machine » : identité Tailscale restaurée avant de démarrer tailscaled', () => {
    const body = section(p[4] as string, 'Nouvelle machine');
    // Les commandes seules : le préambule « Après un vol » cite l'option dans sa prose.
    const code = codeOf(body);
    const restore = code.split(/\r?\n/).find((line) => line.includes('--include /var/lib/tailscale'));
    expect(restore, 'restauration B2 de /var/lib/tailscale').toMatch(
      /restic -r "\$RESTIC_OFFSITE_REPOSITORY" [^\n]*restore latest/,
    );
    expectInOrder(code, ['--include /var/lib/tailscale', 'systemctl start tailscaled']);
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

  it("P6 : 08 §6 côté admin, retrait dans l'ordre, chaque proche a son propre compte Tailscale (P-MIN-4)", () => {
    const p6 = p[6] as string;
    expect(p6).toContain('son propre compte Tailscale');
    expectInOrder(section(p6, 'Ajouter un proche'), [
      'Invitations',
      'date de naissance',
      'MIN_AGE',
      'Share',
      'installer-appsport.md',
    ]);
    expectInOrder(section(p6, 'Retirer un proche'), ['Share', 'Désactiver']);
  });

  it('P7 : conteneur recréé chaque mois (journaux de 90 jours au plus, R-OPS-15)', () => {
    for (const needle of ['apt full-upgrade', 'reboot-required', 'up -d --force-recreate app', '90 jours']) {
      expect(p[7]).toContain(needle);
    }
  });

  it("P8 : une section par alerte de 08 §9, interrupteur d'urgence, vol ou fuite", () => {
    const p8 = p[8] as string;
    const titles = sections(p8).map((s) => s.title);
    expect(titles).toContain('Alerte `alive` : silence');
    expect(titles).toContain('Alerte `alive` : /fail');
    for (const check of ['backup', 'restore-test', 'host']) {
      expect(
        titles.some((t) => t.includes(`\`${check}\``)),
        `section de l'alerte ${check}`,
      ).toBe(true);
    }
    expectInOrder(section(p8, "Interrupteur d'urgence"), [
      'SW_KILL_SWITCH=1',
      'secrets/app.env',
      'up -d app',
      '"swKill":true',
      'Publier le correctif',
      'P3',
      "sed -i '/^SW_KILL_SWITCH=/d'",
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

describe('P4 et P8 : restauration sans retour de données, alertes et incidents', () => {
  const p4 = p[4] as string;
  const p8 = p[8] as string;
  const surPlace = section(p4, 'Sur place');
  const nouvelle = section(p4, 'Nouvelle machine');
  const aliveFail = section(p8, 'Alerte `alive` : /fail');
  const theft = section(p8, 'Vol, cambriolage ou fuite');

  it("instantané recopié avec sa date (-p) : l'instant de collecte n'est jamais l'heure actuelle (03 §8)", () => {
    for (const [name, text] of [
      ['P4', p4],
      [RUNBOOK, runbook],
    ] as const) {
      const copies = proseLines(text).filter(
        (l) => l.code && /^\s*(sudo )?(install|cp) /.test(l.line) && l.line.includes('.db'),
      );
      expect(copies.length, name).toBeGreaterThan(0);
      for (const { line } of copies) expect(line, name).toMatch(/ -p /);
      expect(text, name).toContain("jamais l'heure actuelle");
    }
  });

  it("« Sur place », étape 1 : un marqueur ne prouve pas la restauration, l'état se vérifie d'abord", () => {
    const first = steps(surPlace)[0]?.body ?? '';
    expect(first).toContain("-name 'replaced-*' -newer /srv/appsport/reapply-pending");
    expect(first).toContain('Marqueur');
    expect(first).not.toContain('la base est déjà restaurée');
  });

  it("« Sur place » : un instantané pre-vX.Y.Z se restaure avec la version d'avant (08 §8, R-DEP-4)", () => {
    expectInOrder(surPlace, [
      'APPSPORT_VERSION=v<précédente>',
      'git -C /opt/appsport checkout v<précédente>',
      'stop app',
      'server.mjs restore',
      'server.mjs privacy:reapply',
    ]);
    expect(surPlace).toContain('appsport-update --rollback');
  });

  it("« Sur place », réapplication : admin désactivé, l'amorçage refusé a sa conduite (R-ROLE-5)", () => {
    const reapply = steps(surPlace).find((s) => s.body.includes('server.mjs privacy:reapply'))?.body ?? '';
    expect(reapply).toContain('Aucun administrateur actif');
    expect(reapply).toContain('Un administrateur existe déjà');
  });

  it("« Sur place » : l'arrêt d'app est vérifié par ps, et « Nouvelle machine » ne le saute jamais", () => {
    const stop = steps(surPlace).find((s) => codeOf(s.body).includes(`${COMPOSE} stop app`));
    expect(codeOf(stop?.body ?? '')).toContain(`${COMPOSE} ps`);
    expect(nouvelle).not.toMatch(/sans objet/);
    expect(nouvelle).toContain('Étapes 5 à 10 de « Sur place »');
  });

  it('« Nouvelle machine » : dépôt à la version restaurée dès le clone, instant de collecte calculé', () => {
    expectInOrder(nouvelle, [
      'cat /srv/appsport/deploy.env',
      'git -C /opt/appsport checkout vX.Y.Z',
      'Timers systemd',
      'pull app',
      'stat -c %Y',
      'server.mjs privacy:collect',
    ]);
  });

  it("« Nouvelle machine » après un vol : P8 étape 1 d'abord, sans l'identité Tailscale volée", () => {
    const intro = nouvelle.slice(0, nouvelle.search(/^1\. \*\*/m));
    for (const needle of ['Après un vol', 'P8', 'étape 1', 'sans `--include /var/lib/tailscale`']) {
      expect(intro).toContain(needle);
    }
    expect(theft).toContain("sans l'ancienne identité Tailscale");
  });

  it("alerte alive /fail et déverrouillage : jamais de up -d tant qu'une réapplication attend (03 §8)", () => {
    expect(codeOf(steps(aliveFail)[1]?.body ?? '')).toContain('sudo cat /srv/appsport/reapply-pending');
    for (const title of ['Alerte `alive` : /fail', 'Déverrouillage en échec']) {
      const ups = codeOf(section(p8, title))
        .split('\n')
        .filter((line) => line.includes(`${COMPOSE} up -d`));
      expect(ups.length, title).toBeGreaterThan(0);
      for (const line of ups) {
        expect(line.trim(), title).toMatch(
          /^sudo test ! -e \/srv\/appsport\/reapply-pending && sudo docker compose /,
        );
      }
    }
  });

  it('chaque motif envoyé à Healthchecks par les scripts a sa conduite dans la section de son alerte (08 §9)', () => {
    const where: Record<string, string> = {
      'appsport-alive': 'Alerte `alive` : /fail',
      'appsport-unlock': 'Alerte `alive` : /fail',
      'appsport-backup': 'Alerte `backup`',
      'appsport-restore-test': 'Alerte `restore-test`',
      'appsport-check': 'Alerte `host`',
    };
    for (const [script, title] of Object.entries(where)) {
      const motifs = scriptMotifs(read(`infra/host/${script}`));
      expect(motifs.length, script).toBeGreaterThan(2);
      const body = section(p8, title);
      for (const motif of motifs) expect(body, `${script} : ${motif}`).toMatch(motifPattern(motif));
    }
  });

  it('déverrouillage en échec : Docker arrêté avant de fermer le volume (R-OPS-2)', () => {
    expectInOrder(section(p8, 'Déverrouillage en échec'), [
      'systemctl stop docker.service docker.socket',
      'umount /srv/appsport',
      'cryptsetup close appsport',
      'cryptsetup status appsport',
    ]);
  });

  it('restore-test : vérification du dépôt hors site et dépôt local abîmé mis de côté avant init (R-OPS-11)', () => {
    const body = section(p8, 'Alerte `restore-test`');
    expect(body).toContain(
      'restic -r "$RESTIC_OFFSITE_REPOSITORY" --password-file /srv/appsport/secrets/restic.pass check',
    );
    expectInOrder(body, [
      'sudo mv /srv/backup/restic /srv/backup/restic.abime-',
      '/srv/appsport/secrets/restic.pass init',
    ]);
  });

  it("alive silence : timer et HC_ALIVE_URL à l'étape 3 ; PR de l'incident sur le PC", () => {
    const silence = steps(section(p8, 'Alerte `alive` : silence'));
    expect(silence[0]?.body).not.toContain('/fail');
    expect(silence[0]?.body).toContain('étape 3');
    expect(silence[2]?.body).toContain('HC_ALIVE_URL');
    expect(steps(theft).find((s) => s.body.includes('git switch'))?.body).toMatch(/sur le PC/i);
  });

  it("vol ou fuite : prévenir sous 72 h juste après l'évaluation, sans attendre secrets ni reconstruction (03 §14)", () => {
    const all = steps(theft);
    const notice = all.findIndex((s) => s.head.includes('72 h'));
    expect(notice).toBe(2);
    expect(all[notice]?.body).toContain('découverte');
    expect(notice).toBeLessThan(all.findIndex((s) => s.head.includes('secrets')));
    expect(notice).toBeLessThan(all.findIndex((s) => s.body.includes('server.mjs admin:reset')));
  });

  it('vol ou fuite : les sessions se ferment vraiment, un lien seul ne ferme rien (P-AUT-8)', () => {
    const close = steps(theft).find((s) => s.body.includes('server.mjs admin:reset'))?.body ?? '';
    for (const needle of [
      '« Fermer les sessions »',
      '« Déconnecter tous mes appareils »',
      "n'a aucune session ouverte",
    ]) {
      expect(close).toContain(needle);
    }
    expect(close).not.toContain('Générer un lien de réinitialisation');
    expect(close).not.toContain("toutes les sessions de l'admin sont fermées");
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
    // 08 §6, côté proche, étape 6 : VPN permanent, mais sans couper Internet quand Tailscale est coupé.
    expect(installer).toMatch(/« VPN permanent »[^\n]*\*\*sans\*\* « Bloquer les connexions sans VPN »/);
    // 08 §11 : les proches savent dès l'arrivée que la synchro et le coach attendent le retour de l'admin.
    expect(installer).toMatch(/la synchronisation et le coach[^\n]*restent bloqués jusqu'à son retour/);
    // Une capture par étape : la ligne d'attente, remplacée par l'image une fois la capture faite
    // (P1, « Recette ») ; le test des liens relatifs vérifie alors que l'image existe.
    const all = steps(installer);
    for (const s of all) {
      const nn = String(s.n).padStart(2, '0');
      const pending = s.body.includes(`Capture : à ajouter pendant P1 (captures/installer-${nn}.png).`);
      const image = s.body.includes(`](captures/installer-${nn}.png)`);
      expect(pending !== image, `étape ${s.n} : une capture ou sa ligne d'attente`).toBe(true);
    }
    expect(
      installer.match(/Capture : à ajouter pendant P1|\]\(captures\/installer-\d\d\.png\)/g),
    ).toHaveLength(all.length);
  });

  it('recette-telephones : les 7 contrôles R-TST-4 mot pour mot, tirés de 01 §9.3', () => {
    const spec = read('docs/superpowers/specs/2026-10-06-appsport-design/01-architecture.md');
    const controls = steps(section(recette, 'Contrôles R-TST-4'));
    const heads = controls.map((s) => s.head);
    RTST4.forEach((control, i) => {
      expect(spec).toContain(control);
      expect(heads, control).toContain(control);
      const body = controls.find((s) => s.head === control)?.body ?? '';
      if (!RTST4_SANS_OBJET.has(i)) expect(body, control).not.toContain('sans objet au socle');
    });
  });

  it('recette-telephones : iPhone et Android, R-ONB-4 chronométré, interrupteur et bandeau sur iPhone, tableau', () => {
    for (const needle of ['iPhone', 'Android', '| Date | Version | Appareil | Résultat |']) {
      expect(recette).toContain(needle);
    }
    const onboarding = steps(section(recette, 'Contrôles R-TST-4')).find((s) => s.head === RTST4[6]);
    expect(onboarding?.body, 'R-ONB-4 chronométré').toMatch(/chronom/i);
    const iphone = steps(section(recette, 'Contrôles sur iPhone')).map((s) => s.head);
    expect(iphone).toContain("Interrupteur d'urgence");
    expect(iphone).toContain('Bandeau de mise à jour');
    // Décision du porteur du 2026-10-08 : les contrôles en paysage suivent les 7 contrôles, sans les remplacer.
    const titles = sections(recette).map((s) => s.title);
    expect(titles.indexOf('Contrôles R-TST-4')).toBeGreaterThanOrEqual(0);
    expect(titles.indexOf('Écrans en paysage')).toBeGreaterThan(titles.indexOf('Contrôles R-TST-4'));
  });

  it('runbook de reconstruction (R-OPS-12) : chronométré, moins de 2 h, B2, copie détruite, journal', () => {
    expect(runbook).toMatch(/chronom/i);
    expect(runbook).toMatch(/restic -r "\$RESTIC_OFFSITE_REPOSITORY" [^\n]*restore latest/);
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

  /** Donnée et durée des lignes du tableau de 03 §7, mot pour mot (gras retiré). */
  const retention = (): { data: string; duration: string }[] =>
    tableRows(
      between(
        read('docs/superpowers/specs/2026-10-06-appsport-design/03-vie-privee.md'),
        '### 7. Conservation',
        '### 8.',
      ),
    ).map(([data, duration]) => ({ data: data as string, duration: duration as string }));
  const ficheRetention = (): string[][] => tableRows(section(fiche, 'Durées de conservation'));
  /** Lignes de la fiche qui complètent 03 §7 sans le contredire, avec leur source. */
  const FICHE_ONLY: Readonly<Record<string, string>> = {
    "Journal d'idempotence de la synchro (`applied_op` : identifiants d'opération, sans contenu)":
      'R-SYN-23 : 12 mois (APPLIED_OP_TTL_MONTHS), supprimé avec le compte',
  };

  it('fiche de traitement : chaque ligne de 03 §7, dans le même ordre, avec sa durée', () => {
    const rows = retention();
    expect(rows.length).toBeGreaterThanOrEqual(14);
    const labels = ficheRetention().map(([data]) => data as string);
    for (const label of Object.keys(FICHE_ONLY)) expect(labels, label).toContain(label);
    expect(labels.filter((label) => !(label in FICHE_ONLY))).toEqual(rows.map((r) => r.data));
    for (const { data, duration } of rows) {
      const row = ficheRetention().find(([label]) => label === data);
      expect(row?.[1]?.startsWith(duration), `${data} : ${duration}`).toBe(true);
    }
  });

  it('fiche de traitement et page Confidentialité (privacy-content.ts) : mêmes durées, dans les deux sens', () => {
    /** Où chaque ligne de 03 §7 se lit sur la page ; null : absente de la page, avec sa raison. */
    const ON_PAGE: Readonly<Record<string, RegExp | null>> = {
      'C0 de compte, C1': /Compte et données personnelles : ([^.]*)/,
      C2: /Données de santé : ([^.]*)/,
      'Fils et messages du coach (C3)': /Conversations du coach : ([^;.]*)/,
      'Signalements (C3)': /signalements : ([^.]*)/,
      "Journal d'usage du coach (sans contenu)": /Journal d'usage du coach, sans contenu : ([^.]*)/,
      'Côté Anthropic': /Côté Anthropic : ([^.]*)/,
      Sessions: /Sessions de connexion : ([^.]*)/,
      // Sessions anonymisées (user_id NULL, P-DRT-3) : plus rien ne les relie à une personne.
      'Sessions `account_deleted`': null,
      'Invitations, liens de réinitialisation': /Invitations et liens de réinitialisation : ([^.]*)/,
      'Journal de sécurité': /Journal de sécurité : ([^.]*)/,
      'Journaux techniques': /Journaux techniques : ([^.]*)/,
      'Marques de suppression de la synchro (tombstones)':
        /Marques de suppression de la synchronisation : ([^.]*)/,
      Sauvegardes: /Sauvegardes : ([^.]*)/,
      'Données locales du téléphone': /Données du téléphone : ([^.]*)/,
    };
    const page = pageRetention();
    expect(Object.keys(ON_PAGE)).toEqual(retention().map((r) => r.data));
    let matched = 0;
    for (const [label, duration] of ficheRetention()) {
      // Ligne propre à la fiche (FICHE_ONLY) : la page la reprendra à la relecture de T28.
      if ((label as string) in FICHE_ONLY) continue;
      expect(Object.keys(ON_PAGE), label).toContain(label);
      const where = ON_PAGE[label as string];
      if (!where) continue;
      const fragment = where.exec(page)?.[1];
      expect(fragment, `page Confidentialité : ${label}`).toBeDefined();
      expect(durations(fragment ?? ''), `${label} : fiche « ${duration} », page « ${fragment} »`).toEqual(
        durations(duration as string),
      );
      matched += durations(fragment ?? '').length;
    }
    // Sens inverse : aucune durée de la page ne manque à la fiche.
    expect(matched, 'durée de la page absente de la fiche').toBe(durations(page).length);
  });

  it('registre des incidents : consigne de 03 §14, tableau vide ou lignes datées, jamais les deux', () => {
    expect(incidents).toContain('72 h');
    expect(incidents).toContain(INCIDENTS_HEADER);
    expect(incidents).toContain('retirer la phrase « Aucun incident enregistré. »');
    expect(incidents).toContain('`| AAAA-MM-JJ | … | … | … | … |`');
    expect(incidentProblems(incidents)).toEqual([]);
  });

  it('registre des incidents : le premier incident consigné garde le registre valide', () => {
    const table = `${INCIDENTS_HEADER}\n|---|---|---|---|---|`;
    const row = '| 2026-11-02 | faits | données | mesures | pseudos |';
    expect(incidentProblems(`${table}\n\nAucun incident enregistré.\n`)).toEqual([]);
    expect(incidentProblems(`${table}\n${row}\n`)).toEqual([]);
    expect(incidentProblems(`${table}\n${row}\n\nAucun incident enregistré.\n`)).toEqual([
      '« Aucun incident enregistré. » au-dessus de lignes',
    ]);
    expect(incidentProblems(`${table}\n`)).toEqual(['tableau vide sans « Aucun incident enregistré. »']);
    expect(incidentProblems(`${table}\n| AAAA-MM-JJ | … | … | … | … |\n`)).toContain(
      'ligne mal formée : | AAAA-MM-JJ | … | … | … | … |',
    );
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

  /** Jetons GitHub, Tailscale, Anthropic ; URL de ping Healthchecks (UUID ou clé de ping) ; clé B2. */
  const FORBIDDEN: readonly RegExp[] = [
    /ghp_/,
    /github_pat_/,
    /tskey-/,
    /sk-ant-/,
    /hc-ping\.com\/(?!<|…)[A-Za-z0-9_-]{6,}/,
    /\bK00\d[A-Za-z0-9+/]{27}\b/,
    /\b00[0-9a-f]{23}\b/,
  ];
  /** Valeur attendue de chaque secret écrit dans un bloc de code : un gabarit `<…>`. */
  const PLACEHOLDERS: readonly [RegExp, RegExp][] = [
    [/^\s*AWS_ACCESS_KEY_ID=(.*)$/, /^<[^<>]+>$/],
    [/^\s*AWS_SECRET_ACCESS_KEY=(.*)$/, /^<[^<>]+>$/],
    [/^\s*HC_[A-Z_]+_URL=(.*)$/, /^https:\/\/hc-ping\.com\/<[^<>]+>$/],
    [/^\s*RESTIC_OFFSITE_REPOSITORY=(.*)$/, /^s3:https:\/\/<[^<>]+>\/[\w.-]+$/],
  ];

  it('aucun nom de tailnet, jeton, clé ni URL de ping réels : des gabarits seulement', () => {
    const seen = PLACEHOLDERS.map(() => 0);
    for (const [path, text] of Object.entries(docs)) {
      for (const host of text.match(/\S*\.ts\.net/g) ?? []) {
        expect(host, path).toMatch(/(<tailnet>|\*)\.ts\.net$/);
      }
      for (const pattern of FORBIDDEN) expect(text, path).not.toMatch(pattern);
      for (const { line, code } of proseLines(text)) {
        if (!code) continue;
        PLACEHOLDERS.forEach(([assignment, placeholder], i) => {
          const value = assignment.exec(line)?.[1];
          if (value === undefined) return;
          seen[i] = (seen[i] as number) + 1;
          expect(value.trim(), `${path} : ${line.trim()}`).toMatch(placeholder);
        });
      }
    }
    // Chaque secret est bien écrit quelque part (P1, runbook) : le contrôle ne passe pas à vide.
    for (const count of seen) expect(count).toBeGreaterThan(0);
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

  /**
   * Fichiers suivis par git (ceux que la CI voit), dans leur état de la copie de travail ; ni sortie
   * ignorée, ni note locale, ni worktree imbriqué.
   */
  function textFiles(): string[] {
    const listed = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
    return listed.split('\0').filter((rel) => {
      if (!rel) return false;
      if (rel.split('/').some((part) => SKIP_NAMES.has(part))) return false;
      if ([...SKIP_PATHS].some((skip) => rel === skip || rel.startsWith(`${skip}/`))) return false;
      return statSync(join(ROOT, rel), { throwIfNoEntry: false })?.isFile() ?? false;
    });
  }

  it("l'ancien numéro de la ligne TCA n'apparaît dans aucun fichier texte du dépôt", () => {
    const files = textFiles();
    expect(files).toContain('docs/fiche-de-traitement.md');
    const hits = files.filter((rel) => {
      const bytes = readFileSync(join(ROOT, rel));
      return !bytes.includes(0) && OLD_TCA.test(bytes.toString('utf8'));
    });
    expect(hits).toEqual([]);
  });
});

/** Blocs de code délimités par ```, chacun en lignes (blocs indentés dans une étape compris). */
function codeBlocks(text: string): string[][] {
  const out: string[][] = [];
  let current: string[] | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trimStart().startsWith('```')) current?.push(line);
    else if (current) {
      out.push(current);
      current = null;
    } else current = [];
  }
  return out;
}

describe('commandes sûres à recopier', () => {
  it('après up -d ou docker run -d, /api/health est attendu 2 min au plus (R-OPS-6), jamais sondé une seule fois', () => {
    const pages = {
      ...Object.fromEntries(PROCEDURES.map((name, i) => [name, p[i + 1] as string])),
      'installer-appsport': installer,
      'recette-telephones': recette,
      [RUNBOOK]: runbook,
    };
    let probes = 0;
    for (const [name, text] of Object.entries(pages)) {
      for (const block of codeBlocks(text)) {
        const start = block.findIndex((l) => / up -d|docker run -d/.test(l));
        if (start < 0) continue;
        for (const line of block.slice(start + 1).filter((l) => l.includes('/api/health'))) {
          probes++;
          expect(line, name).toMatch(
            /--retry 60 --retry-delay 2 --retry-all-errors|^\s*for i in \$\(seq 60\)/,
          );
        }
      }
    }
    expect(probes).toBeGreaterThanOrEqual(7);
  });

  it('P5 : restic garde son cache sur le volume chiffré, comme les scripts hôte', () => {
    expect(read('infra/host/lib/common.sh')).toContain('RESTIC_CACHE_DIR="$APPSPORT_ROOT/cache/restic"');
    const lines = proseLines(p[5] as string).filter((l) => l.code && /\brestic -r\b/.test(l.line));
    expect(lines.length).toBeGreaterThan(0);
    for (const { line } of lines) expect(line).toContain('--cache-dir /srv/appsport/cache/restic');
  });

  it('P5 : clé de développement vérifiée sur le PC ; enveloppe refaite après le mot de passe Unix', () => {
    const dev = section(p[5] as string, 'Clé API Anthropic de développement');
    expect(dev).toContain('sur le PC');
    expect(dev).toContain('https://api.anthropic.com/v1/models');
    expect(p[5]).toMatch(/Toutes les commandes se lancent sur le serveur[^\n]*sauf/);
    const unix = steps(section(p[5] as string, 'Mot de passe du compte Unix'));
    expect(unix.some((s) => s.head.includes("refaire l'enveloppe"))).toBe(true);
  });

  it("P5 : la nouvelle clé de déploiement est essayée avant de remplacer ou de supprimer l'ancienne", () => {
    expectInOrder(section(p[5] as string, 'Clé de déploiement git'), [
      'ssh-keygen',
      'Add deploy key',
      '-i /srv/appsport/secrets/deploy_key.new ',
      'mv /srv/appsport/secrets/deploy_key.new ',
      "Supprimer l'ancienne clé sur GitHub",
    ]);
  });

  it('P5 : URL Healthchecks : les 4 contrôles neufs au vert avant de supprimer les anciens (08 §9)', () => {
    const body = section(p[5] as string, 'URL de ping Healthchecks');
    expectInOrder(body, [
      'sudoedit /etc/appsport/healthchecks.env',
      'sudo appsport-check',
      'sudo systemctl start appsport-backup.service',
      'HC_RESTORE_TEST_URL',
      'Supprimer les anciens contrôles',
    ]);
    expect(body).toMatch(/4 contrôles neufs[^\n]*au vert/);
  });

  it('P2 : tout message autre que OK mène à P8 ; les rattrapages se lisent sur leurs services', () => {
    const all = steps(p[2] as string);
    const unlock = all.find((s) => s.n === 2)?.body ?? '';
    expect(unlock).toContain('tout autre message');
    expect(unlock).toContain('disque');
    const catchUp = all.find((s) => s.n === 3)?.body ?? '';
    expect(catchUp).toContain('systemctl status appsport-backup.service appsport-restore-test.service');
    expect(catchUp).toContain('Sauvegarde terminée : local+offsite.');
    expect(catchUp).not.toContain('list-units');
  });

  it('runbook : clés B2 dans un sous-shell, sans cache restic, secrets vérifiés, identité Tailscale remise', () => {
    const code = proseLines(runbook)
      .filter((l) => l.code)
      .map((l) => l.line);
    const sourced = code.filter((l) => l.includes('b2.env') && l.includes('set -a'));
    expect(sourced.length).toBeGreaterThan(0);
    for (const line of sourced) expect(line).toMatch(/\(\s*set -a;/);
    for (const line of code.filter((l) => /\brestic -r\b/.test(l))) expect(line).toContain('--no-cache');
    expect(runbook).toContain('ls restaure/srv/appsport/secrets');
    const all = steps(runbook);
    const putBack = all.find((s) => s.head.startsWith("Remettre l'identité Tailscale"));
    expect(putBack?.body).toContain('sudo mv /var/lib/tailscale.avant-exercice /var/lib/tailscale');
    const destroy = all.find((s) => s.head.startsWith('Détruire la copie'));
    expect(destroy?.body).toContain('/var/lib/tailscale.avant-exercice');
  });
});

describe('fiches des proches et recette : revue de la tâche 45', () => {
  it("installer-appsport : absence de l'admin selon 08 §11, MagicDNS des deux côtés, invitation depuis la connexion", () => {
    expect(installer).not.toContain('tout consulter');
    expect(installer).toContain('la synchronisation et le coach');
    const help = section(installer, 'Dépannage');
    expect(help).toContain('Use Tailscale DNS');
    expect(help).toMatch(/console Tailscale[^\n]*DNS[^\n]*MagicDNS/);
    expect(read('apps/web/src/features/auth/LoginPage.tsx')).toContain("J'ai un code d'invitation");
    expect(installer).toMatch(/^5\. \*\*[^\n]*J'ai un code d'invitation/m);
    expect(section(p[1] as string, 'Premier déploiement')).toContain("J'ai un code d'invitation");
  });

  it('captures de la fiche faites en P1 avec une identité de test et masquées ; fiche envoyée en PDF (P6)', () => {
    const body = section(p[1] as string, 'Recette');
    expect(body).toContain('docs/exploitation/captures/installer-01.png');
    expect(body).toMatch(/[Mm]asquer/);
    expect(body).toContain('compte Tailscale de test');
    expect(p[6]).toContain('PDF');
  });

  it("P6 : libellés de l'écran Membres et règle du dernier administrateur actif (R-ROLE-2)", () => {
    const members = read('apps/web/src/features/admin/MembersPage.tsx');
    expect(members).toContain("act('delete', 'Supprimer', true)");
    expect(members).toContain('confirmLabel="Supprimer définitivement"');
    const lastAdmin = 'Il doit rester au moins un administrateur actif.';
    expect(read('apps/web/src/ui/errors.ts')).toContain(lastAdmin);
    const leave = section(p[6] as string, 'Retirer un proche');
    for (const needle of [
      '« Supprimer »',
      '« Supprimer définitivement »',
      lastAdmin,
      'dernier administrateur actif',
    ]) {
      expect(leave).toContain(needle);
    }
    expect(leave).not.toContain('« Supprimer le compte »');
  });

  it("recette-telephones : téléphones des proches, données fictives, chaque build avec son contenu, base vidée d'abord", () => {
    expect(recette).not.toContain("(ou de l'admin)");
    expect(recette).not.toContain('$PWD/data');
    expect(recette).toMatch(/fictiv/);
    const prep = section(recette, 'Préparation');
    expectInOrder(prep, ['rm -rf ~/appsport-recette', 'cp -r']);
    expect(prep).toContain('APPSPORT_CONTENT_DIR=~/appsport-recette/a/content');
    expect(recette).toContain('APPSPORT_CONTENT_DIR=~/appsport-recette/b/content');
    expect(prep).toContain('La base existe déjà');
    expect(prep).toContain('Un administrateur existe déjà');
  });

  it('recette-telephones : nom de machine neutre dans les journaux de certificats (03 §10.5)', () => {
    expect(recette).not.toContain('<poste>');
    expectInOrder(section(recette, 'Préparation'), [
      'Edit machine name',
      'APP_ORIGIN=https://recette.<tailnet>.ts.net',
      'tailscale serve --bg',
    ]);
  });

  it('recette-telephones : cas P1 sur le serveur réel, compte de test supprimé ensuite', () => {
    const prep = steps(section(recette, 'Préparation'));
    for (const n of [1, 2])
      expect(prep.find((s) => s.n === n)?.body, `Préparation ${n}`).toContain('En P1 :');
    expect(recette).toContain('Administration → Invitations');
    const banner = steps(section(recette, 'Contrôles sur iPhone')).find(
      (s) => s.head === 'Bandeau de mise à jour',
    );
    expect(banner?.body).toContain('En P1 :');
    expect(banner?.body).toContain('tableau des résultats');
  });

  it('recette-telephones : fin de recette : serve retiré, partages révoqués, données de test effacées', () => {
    const end = section(recette, 'Fin de la recette');
    for (const needle of [
      'tailscale serve reset',
      'tailscale serve status',
      'rm -rf ~/appsport-recette',
      'Administration → Membres',
      'partage',
      'données du site',
    ]) {
      expect(end).toContain(needle);
    }
    expectSteps('Fin de la recette', end);
  });
});

describe('registres de vie privée : revue de la tâche 45', () => {
  it('fiche : catégories de 03 §2, exception des sessions, secrets hors catégorie, journal de sécurité (P-LOG-1)', () => {
    const body = section(fiche, 'Catégories de données');
    for (const needle of [
      'modèles de programmes',
      'nombre de sessions actives',
      'coût IA du mois',
      'visibilité par lieu',
      'records',
      'détail des sessions',
      'ne sont pas exportées',
      "ni renvoyées par l'API",
      'IP du tailnet',
    ]) {
      expect(body, needle).toContain(needle);
    }
  });

  it("fiche : durées de 03 §7 que la purge applique, journal d'idempotence de la synchro (R-SYN-23)", () => {
    const body = section(fiche, 'Durées de conservation');
    expect(body).toContain("| Sessions `account_deleted` | jusqu'à leur expiration absolue");
    expect(body).toContain("les salles et lieux supprimés restent, pour l'historique");
    expect(body).toMatch(/`applied_op`[^\n]*\| 12 mois/);
  });

  it('fiche : envois au coach (P-COA-1), exception de P-ADM-1 et mesures de 03 §10 et P-AUT-9', () => {
    const to = section(fiche, 'Destinataires');
    expect(to).toContain("jamais l'âge exact");
    expect(to).toContain('sauf un échange signalé');
    const measures = section(fiche, 'Mesures de sécurité');
    for (const needle of [
      'Tailscale SSH',
      'réseau local',
      '127.0.0.1',
      'journaux publics de certificats',
      'limite de dépense',
      'Flux sortants',
      'HSTS',
      'sauf un échange signalé',
    ]) {
      expect(measures, needle).toContain(needle);
    }
  });

  it('registre des incidents : 72 h après la découverte, secrets tournés, catégories exposées, jamais de pseudo', () => {
    expect(incidents).toContain('72 h après la découverte');
    expect(incidents).toMatch(/faire tourner[^\n]*P5/);
    expect(incidents).toContain('jamais leur contenu');
    expect(incidents).not.toContain('par pseudo');
    expect(incidents).toContain('jamais de pseudo');
    expect(section(p[8] as string, 'Vol, cambriolage ou fuite')).toMatch(
      /^\d+\. \*\*Consigner l'incident\.\*\*[^\n]*jamais de pseudo/m,
    );
  });
});
