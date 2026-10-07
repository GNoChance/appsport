import { PRIVACY_POLICY_VERSION } from '@appsport/contracts';
import { hashPassword } from '../../src/auth/password-hash';
import { writeStamp } from '../../src/db/rev';
import type { TestContext } from './context';

export interface TestUser {
  id: string;
  username: string;
  password: string;
}

export interface CreateUserOptions {
  username?: string;
  password?: string;
  role?: 'admin' | 'member';
  status?: 'active' | 'disabled';
  birthDate?: string;
  onboarded?: boolean;
  passwordChangedAt?: string | null;
  createdAt?: string;
}

let counter = 0;

/** Insère un compte directement (sans invitation) ; le mot de passe n'est pas validé. */
export async function createUser(ctx: TestContext, o: CreateUserOptions = {}): Promise<TestUser> {
  const { deps } = ctx;
  counter += 1;
  const username = o.username ?? `membre${counter}`;
  const password = o.password ?? 'tortue verte du jardin';
  const passwordHash = await hashPassword(password, deps.config.argon2, deps.ids);
  const now = deps.clock.now().toISOString();
  const id = deps.ids.uuidv7();
  const stamp = await writeStamp(deps.db, deps, null);
  await deps.db
    .insertInto('user')
    .values({
      id,
      username,
      usernameKey: username.normalize('NFKC').toLowerCase(),
      passwordHash,
      role: o.role ?? 'member',
      ...(o.status ? { status: o.status } : {}),
      birthDate: o.birthDate ?? '1990-01-01',
      termsVersion: PRIVACY_POLICY_VERSION,
      termsAcceptedAt: now,
      passwordChangedAt: o.passwordChangedAt ?? null,
      onboardingStep: o.onboarded ? 'ready' : null,
      onboardingCompletedAt: o.onboarded ? now : null,
      rev: stamp.rev,
      createdAt: o.createdAt ?? now,
      updatedAt: stamp.updatedAt,
    })
    .execute();
  return { id, username, password };
}

/** Connecte via POST /api/auth/login et renvoie `nom=valeur` du cookie ; lève si le statut n'est pas 200. */
export async function login(
  ctx: TestContext,
  username: string,
  password: string,
  ip = '100.64.0.1',
): Promise<string> {
  const res = await ctx.request('/api/auth/login', { method: 'POST', json: { username, password }, ip });
  if (res.status !== 200) throw new Error(`Connexion refusée (${res.status}) pour ${username}`);
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Set-Cookie absent');
  return cookie;
}

/** Crée un compte puis le connecte (`login` avec le mot de passe de la fabrique). */
export async function createUserAndLogin(
  ctx: TestContext,
  o: CreateUserOptions = {},
): Promise<TestUser & { cookie: string }> {
  const user = await createUser(ctx, o);
  return { ...user, cookie: await login(ctx, user.username, user.password) };
}
