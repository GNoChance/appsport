import { parisDate } from '@appsport/domain';

/**
 * Délai avant de libérer l'URL du fichier : Safari annule un téléchargement dont l'URL `blob:` est
 * révoquée trop tôt ; la valeur est celle de FileSaver.js.
 */
const REVOKE_AFTER_MS = 40_000;

/** `appsport-export-AAAA-MM-JJ.json`, date civile de Paris (R-EXP-1). */
export function exportFileName(nowMs: number): string {
  return `appsport-export-${parisDate(new Date(nowMs))}.json`;
}

/** Télécharge `data` en JSON indenté : lien `download` ajouté, cliqué puis retiré, URL libérée ensuite. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  }
}
