/**
 * Découpe un flux en lignes et préfixe chacune (`[serveur]`, `[web]`) ; une ligne coupée attend la suite.
 * `keep` voit chaque ligne (sans fin de ligne) et peut la retirer de l'affichage en rendant false.
 */
export function createLinePrefixer(
  prefix: string,
  write: (text: string) => void,
  keep: (line: string) => boolean = () => true,
): { push(chunk: string): void; end(): void } {
  let pending = '';
  const emit = (raw: string): void => {
    const line = raw.replace(/\r$/, '');
    if (keep(line)) write(`${prefix} ${line}\n`);
  };
  return {
    push(chunk) {
      const lines = (pending + chunk).split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) emit(line);
    },
    end() {
      if (pending !== '') emit(pending);
      pending = '';
    },
  };
}
