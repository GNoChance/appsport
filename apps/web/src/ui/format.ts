const TIME_ZONE = 'Europe/Paris';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `JJ/MM/AAAA` : une date civile telle quelle, un horodatage à l'heure de Paris. */
export function formatDate(isoOrDate: string): string {
  const civil = CIVIL_DATE.exec(isoOrDate);
  if (civil) return `${civil[3]}/${civil[2]}/${civil[1]}`;
  return dateFormat.format(new Date(isoOrDate));
}

/** `JJ/MM/AAAA à HH:MM`, à l'heure de Paris. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${dateFormat.format(date)} à ${timeFormat.format(date)}`;
}

/** Ancienneté relative : « à l'instant », « il y a 3 min », « il y a 5 h », « il y a 2 j ». */
export function formatAge(iso: string, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000));
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

/** Forme du mot selon `n` (singulier pour 0 et 1, usage français). */
export function plural(n: number, one: string, many: string): string {
  return Math.abs(n) < 2 ? one : many;
}
