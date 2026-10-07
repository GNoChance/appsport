import { ADULT_AGE, type AgeBand, PARIS_TZ } from '@appsport/contracts';

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y: number, m: number) =>
  m === 2 ? (isLeap(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;

function parseCivil(s: string): [number, number, number] {
  const m = CIVIL_DATE.exec(s);
  if (!m) throw new RangeError(`date civile invalide : ${s}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) {
    throw new RangeError(`date civile invalide : ${s}`);
  }
  return [y, mo, d];
}

const parisFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Date civile 'YYYY-MM-DD' à l'heure de Europe/Paris. */
export function parisDate(instant: Date): string {
  const p = Object.fromEntries(parisFormat.formatToParts(instant).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Années révolues ; un 29/02 fête son anniversaire le 01/03 les années non bissextiles. */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = parseCivil(birthDate);
  const [ty, tm, td] = parseCivil(today);
  const [am, ad] = bm === 2 && bd === 29 && !isLeap(ty) ? [3, 1] : [bm, bd];
  const years = ty - by;
  return tm > am || (tm === am && td >= ad) ? years : years - 1;
}

export function ageBandOn(birthDate: string, today: string): AgeBand {
  return ageOn(birthDate, today) >= ADULT_AGE ? 'adult' : 'minor';
}
