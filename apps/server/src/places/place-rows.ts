import { ageBandOn, parisDate } from '@appsport/domain';
import type { SessionUser } from '../app-env';
import { writeStamp } from '../db/rev';
import type { DbExecutor } from '../db/schema';
import type { AppDeps } from '../deps';
import { httpError } from '../http/errors';

/** Retire le statut de lieu principal aux lieux actifs de l'utilisateur (sauf `exceptPlaceId`). */
export async function demotePrimaries(
  trx: DbExecutor,
  deps: AppDeps,
  userId: string,
  exceptPlaceId?: string,
): Promise<void> {
  let query = trx
    .selectFrom('place')
    .select('id')
    .where('ownerId', '=', userId)
    .where('deletedAt', 'is', null)
    .where('isPrimary', '=', 1);
  if (exceptPlaceId !== undefined) query = query.where('id', '!=', exceptPlaceId);
  for (const row of await query.execute()) {
    const stamp = await writeStamp(trx, deps, userId);
    await trx
      .updateTable('place')
      .set({ isPrimary: 0, ...stamp })
      .where('id', '=', row.id)
      .execute();
  }
}

/** Crée le lieu « salle » de l'utilisateur ; la salle doit exister et ne pas être supprimée. */
export async function insertGymPlace(
  trx: DbExecutor,
  deps: AppDeps,
  user: SessionUser,
  o: { gymId: string; isPrimary: boolean; visibleAtGym?: boolean },
): Promise<string> {
  const gym = await trx
    .selectFrom('gym')
    .select('id')
    .where('id', '=', o.gymId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();
  if (!gym) throw httpError('not_found');
  const same = await trx
    .selectFrom('place')
    .select('id')
    .where('ownerId', '=', user.id)
    .where('gymId', '=', o.gymId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst();
  if (same) throw httpError('place_exists');
  const active = await trx
    .selectFrom('place')
    .select('id')
    .where('ownerId', '=', user.id)
    .where('deletedAt', 'is', null)
    .limit(1)
    .executeTakeFirst();
  const isPrimary = o.isPrimary || active === undefined;
  const adult = ageBandOn(user.birthDate, parisDate(deps.clock.now())) === 'adult';
  if (isPrimary) await demotePrimaries(trx, deps, user.id);
  const id = deps.ids.uuidv7();
  const stamp = await writeStamp(trx, deps, user.id);
  await trx
    .insertInto('place')
    .values({
      id,
      ownerId: user.id,
      kind: 'gym',
      gymId: o.gymId,
      name: null,
      isPrimary: isPrimary ? 1 : 0,
      visibleAtGym: (o.visibleAtGym ?? adult) ? 1 : 0,
      loadSettings: null,
      createdAt: stamp.updatedAt,
      ...stamp,
    })
    .execute();
  return id;
}
