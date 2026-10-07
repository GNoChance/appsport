export type LogFields = Partial<{
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  event: string;
  code: string;
  count: number;
  migration: string;
  job: string;
}>;

export interface Logger {
  info(msg: string, f?: LogFields): void;
  warn(msg: string, f?: LogFields): void;
  error(msg: string, f?: LogFields): void;
}

const ALLOWED: readonly (keyof LogFields)[] = [
  'requestId',
  'method',
  'route',
  'status',
  'durationMs',
  'event',
  'code',
  'count',
  'migration',
  'job',
];

const defaultWrite = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

/** Une ligne JSON par événement ; seuls les champs de la liste blanche sont écrits (P-LOG-2). */
export function createLogger(write: (line: string) => void = defaultWrite): Logger {
  const emit = (level: 'info' | 'warn' | 'error', msg: string, f?: LogFields): void => {
    const entry: Record<string, unknown> = { level, msg };
    for (const key of ALLOWED) {
      const value = f?.[key];
      if (value !== undefined) entry[key] = value;
    }
    entry.time = new Date().toISOString();
    write(JSON.stringify(entry));
  };
  return {
    info: (msg, f) => emit('info', msg, f),
    warn: (msg, f) => emit('warn', msg, f),
    error: (msg, f) => emit('error', msg, f),
  };
}
