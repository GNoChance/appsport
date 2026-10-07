import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, createApiClient, NetworkRequiredError } from '../../src/api/client';
import { createFakeApi, type FakeApi } from '../support/fake-api';

function setup(): { api: FakeApi; hooks: { onUnauthenticated: () => void; onAccountDeleted: () => void } } {
  const api = createFakeApi();
  return { api, hooks: { onUnauthenticated: vi.fn(), onAccountDeleted: vi.fn() } };
}

const Ok = z.object({ ok: z.literal(true) });

afterEach(() => {
  vi.useRealTimers();
});

describe('createApiClient', () => {
  it('send POST : JSON, protocole 1, sans Origin, same-origin', async () => {
    const { api, hooks } = setup();
    api.on('POST', '/api/things', { status: 200, body: { ok: true } });
    const client = createApiClient(api.transport, hooks);
    await expect(client.send('POST', '/api/things', { a: 1 }, Ok)).resolves.toEqual({ ok: true });
    const [call] = api.calls;
    expect(call?.headers.get('Content-Type')).toBe('application/json');
    expect(call?.headers.get('X-Appsport-Protocol')).toBe('1');
    expect(call?.headers.has('Origin')).toBe(false);
    expect(call?.init.credentials).toBe('same-origin');
    expect(call?.body).toEqual({ a: 1 });
  });

  it('send sans corps envoie {}', async () => {
    const { api, hooks } = setup();
    api.on('POST', '/api/logout', { status: 204 });
    await createApiClient(api.transport, hooks).send('POST', '/api/logout');
    expect(api.calls[0]?.init.body).toBe('{}');
  });

  it('get valide la réponse ; hors schéma → rejet', async () => {
    const { api, hooks } = setup();
    api.on('GET', '/api/good', { status: 200, body: { ok: true } });
    api.on('GET', '/api/bad', { status: 200, body: { ok: 'oui' } });
    const client = createApiClient(api.transport, hooks);
    await expect(client.get('/api/good', Ok)).resolves.toEqual({ ok: true });
    await expect(client.get('/api/bad', Ok)).rejects.toThrow();
  });

  it('409 username_taken → ApiError { status, code, body }', async () => {
    const { api, hooks } = setup();
    api.on('PATCH', '/api/me', { status: 409, body: { error: 'username_taken' } });
    const error = await createApiClient(api.transport, hooks)
      .send('PATCH', '/api/me', { username: 'x' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'username_taken', body: { error: 'username_taken' } });
  });

  it('transport muet : rien à 3999 ms, NetworkRequiredError à 4000 ms', async () => {
    vi.useFakeTimers();
    const { api, hooks } = setup();
    api.setOffline('hang');
    let outcome: unknown = 'pending';
    void createApiClient(api.transport, hooks)
      .get('/api/me', Ok)
      .then(
        () => {
          outcome = 'resolved';
        },
        (e: unknown) => {
          outcome = e;
        },
      );
    await vi.advanceTimersByTimeAsync(3999);
    expect(outcome).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toBeInstanceOf(NetworkRequiredError);
    expect((outcome as Error).message).toBe('Nécessite le réseau');
  });

  it('transport en échec → NetworkRequiredError', async () => {
    const { api, hooks } = setup();
    api.setOffline('reject');
    await expect(createApiClient(api.transport, hooks).get('/api/me', Ok)).rejects.toBeInstanceOf(
      NetworkRequiredError,
    );
  });

  it('410 account_deleted → onAccountDeleted une fois ; 410 watermark_expired → non', async () => {
    const { api, hooks } = setup();
    api.on('GET', '/api/gone', { status: 410, body: { error: 'account_deleted' } });
    api.on('GET', '/api/old', { status: 410, body: { error: 'watermark_expired' } });
    const client = createApiClient(api.transport, hooks);
    await expect(client.get('/api/gone', Ok)).rejects.toMatchObject({ status: 410, code: 'account_deleted' });
    expect(hooks.onAccountDeleted).toHaveBeenCalledTimes(1);
    await expect(client.get('/api/old', Ok)).rejects.toMatchObject({ code: 'watermark_expired' });
    expect(hooks.onAccountDeleted).toHaveBeenCalledTimes(1);
    expect(hooks.onUnauthenticated).not.toHaveBeenCalled();
  });

  it('401 unauthenticated → onUnauthenticated une fois', async () => {
    const { api, hooks } = setup();
    api.on('GET', '/api/me', { status: 401, body: { error: 'unauthenticated' } });
    await expect(createApiClient(api.transport, hooks).get('/api/me', Ok)).rejects.toMatchObject({
      status: 401,
      code: 'unauthenticated',
    });
    expect(hooks.onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(hooks.onAccountDeleted).not.toHaveBeenCalled();
  });

  it('401 invalid_credentials → ApiError seule, aucun hook', async () => {
    const { api, hooks } = setup();
    api.on('POST', '/api/auth/login', { status: 401, body: { error: 'invalid_credentials' } });
    const error = await createApiClient(api.transport, hooks)
      .send('POST', '/api/auth/login', { username: 'a', password: 'b' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: 'invalid_credentials' });
    expect(hooks.onUnauthenticated).not.toHaveBeenCalled();
    expect(hooks.onAccountDeleted).not.toHaveBeenCalled();
  });
});
