/** Découpe un flux en lignes et préfixe chacune (`[serveur]`, `[web]`) ; une ligne coupée attend la suite. */
export function createLinePrefixer(
  prefix: string,
  write: (text: string) => void,
): { push(chunk: string): void; end(): void } {
  let pending = '';
  const emit = (line: string): void => write(`${prefix} ${line.replace(/\r$/, '')}\n`);
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
