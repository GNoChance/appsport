import { describe, expect, it, vi } from 'vitest';
import { handleAccountDeleted } from '../../src/app-services';
import type { AppDb } from '../../src/local-db/db';
import { getMeta, setMeta } from '../../src/local-db/meta';
import { createTestLocalDb } from '../support/local-db';

describe('handleAccountDeleted', () => {
  it('efface la base locale puis mène à la connexion', async () => {
    const db = createTestLocalDb();
    await setMeta(db, 'userId', 'u-1');
    const navigate = vi.fn();
    await handleAccountDeleted(db, navigate);
    expect(await getMeta(db, 'userId')).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/login?reason=account_deleted');
  });

  it("mène à la connexion même si l'effacement échoue, sans rejet", async () => {
    const broken = {
      tables: [],
      transaction: () => Promise.reject(new Error('base inaccessible')),
    } as unknown as AppDb;
    const navigate = vi.fn();
    await expect(handleAccountDeleted(broken, navigate)).resolves.toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/login?reason=account_deleted');
  });
});
