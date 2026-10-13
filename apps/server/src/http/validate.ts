import type { Context } from 'hono';
import type { z } from 'zod';
import type { AppEnv } from '../app-env';
import { httpError } from './errors';

function issuesOf(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }));
}

export async function parseJson<T>(c: Context<AppEnv>, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw httpError('validation');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw httpError('validation', { issues: issuesOf(result.error) });
  return result.data;
}

export function parseQuery<T>(c: Context<AppEnv>, schema: z.ZodType<T>): T {
  const result = schema.safeParse(c.req.query());
  if (!result.success) throw httpError('validation', { issues: issuesOf(result.error) });
  return result.data;
}
