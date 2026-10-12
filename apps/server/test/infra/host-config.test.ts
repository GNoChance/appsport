import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** Lignes `Clé=valeur` d'une section `[Nom]` d'une unité systemd. */
function unitSection(text: string, section: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let current = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      current = header[1] as string;
      continue;
    }
    if (current !== section) continue;
    const eq = line.indexOf('=');
    const key = line.slice(0, eq);
    out[key] = [...(out[key] ?? []), line.slice(eq + 1)];
  }
  return out;
}

function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(ROOT, rel)).isDirectory() ? filesUnder(rel) : [rel];
  });
}

/** Timers de 08 §15 (le 1er dimanche du mois : un dimanche entre le 1er et le 7). */
const timers = {
  'appsport-alive': '*:0/5',
  'appsport-backup': '*-*-* 03:30:00',
  'appsport-check': '*-*-* 04:00:00',
  'appsport-restore-test': 'Sun *-*-01..07 05:00:00',
};

describe('infra/systemd : timers et services (08 §9, §15)', () => {
  for (const [name, calendar] of Object.entries(timers)) {
    it(`${name}.timer : ${calendar}, timers.target${name === 'appsport-alive' ? '' : ', Persistent=true'}`, () => {
      const text = read(`infra/systemd/${name}.timer`);
      const timer = unitSection(text, 'Timer');
      expect(timer.OnCalendar).toEqual([calendar]);
      // alive : un ping manqué pendant l'arrêt n'a pas à être rattrapé au démarrage.
      expect(timer.Persistent).toEqual(name === 'appsport-alive' ? undefined : ['true']);
      expect(unitSection(text, 'Install').WantedBy).toEqual(['timers.target']);
    });

    it(`${name}.service : oneshot, /usr/local/sbin/${name}`, () => {
      const service = unitSection(read(`infra/systemd/${name}.service`), 'Service');
      expect(service.Type).toEqual(['oneshot']);
      expect(service.ExecStart).toEqual([`/usr/local/sbin/${name}`]);
    });
  }

  it('docker.service.d/appsport.conf : Docker exige le volume monté (R-OPS-2, R-DEP-5)', () => {
    const unit = unitSection(read('infra/systemd/docker.service.d/appsport.conf'), 'Unit');
    expect(unit.RequiresMountsFor).toEqual(['/srv/appsport']);
  });
});

describe('infra/docker/daemon.json (08 §4)', () => {
  it('data-root sur le volume chiffré, journaux locaux bornés, live-restore', () => {
    expect(JSON.parse(read('infra/docker/daemon.json'))).toEqual({
      'data-root': '/srv/appsport/docker',
      'log-driver': 'local',
      'log-opts': { 'max-size': '10m', 'max-file': '5' },
      'live-restore': true,
    });
  });
});

describe('aucun redémarrage automatique (08 §2, §13.11)', () => {
  it('unattended-upgrades sans redémarrage automatique', () => {
    expect(read('infra/apt/52appsport-unattended')).toMatch(
      /^Unattended-Upgrade::Automatic-Reboot "false";$/m,
    );
  });

  it('aucun fichier de infra/systemd ni infra/host ne redémarre ni n’arrête la machine', () => {
    const files = [...filesUnder('infra/systemd'), ...filesUnder('infra/host')];
    expect(files).toContain('infra/systemd/appsport-backup.service');
    expect(files).toContain('infra/host/appsport-backup');
    const offenders = files.filter((file) =>
      /systemctl\s+(reboot|poweroff|kexec)|shutdown\s+-[rh]|^\s*(reboot|poweroff|halt)\b/m.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });
});

describe('infra/tailscale-policy.hujson (08 §5, R-OPS-8)', () => {
  const text = read('infra/tailscale-policy.hujson');

  it('commenté en tête : partage de la machine seulement', () => {
    expect(text.split(/\r?\n/)[0]).toBe(
      "// Collé dans la console Tailscale (Access controls). Aucun proche n'est membre : partage de la machine seulement (R-OPS-8).",
    );
  });

  it('politique de 08 §5 : membres partout, partagés sur tcp:443, SSH check vers soi', () => {
    const policy = JSON.parse(
      text
        .split(/\r?\n/)
        .filter((line) => !line.trimStart().startsWith('//'))
        .join('\n'),
    );
    expect(policy).toEqual({
      grants: [
        { src: ['autogroup:member'], dst: ['*'], ip: ['*'] },
        { src: ['autogroup:shared'], dst: ['*'], ip: ['tcp:443'] },
      ],
      ssh: [
        { action: 'check', src: ['autogroup:member'], dst: ['autogroup:self'], users: ['autogroup:nonroot'] },
      ],
    });
  });
});
