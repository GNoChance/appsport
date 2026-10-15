import {
  EQUIPMENT_SHORT_LABELS,
  type EquipmentCode,
  EquipmentCodeSchema,
  type GymDetail,
  type GymHistoryAction,
} from '@rune/contracts';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { formatDateTime } from '../../ui';
import { MemberAvatar } from './GymMembers';
import { FlagIcon, MinusIcon, PencilIcon, PlusIcon, SlidersIcon } from './icons';
import styles from './places.module.css';

type HistoryEntry = GymDetail['history'][number];

const ACTION_LABELS: Record<GymHistoryAction, string> = {
  create: 'Création de la salle',
  update_info: 'Nom ou ville modifiés',
  add_equipment: 'Matériel ajouté',
  remove_equipment: 'Matériel retiré',
  update_load_settings: 'Réglages de charge modifiés',
};

/** Pastille de chaque action dans la frise : ajout en vert, retrait en rouge, création en violet. */
const ACTION_MARKS: Record<GymHistoryAction, { tone: string; icon: ReactNode }> = {
  create: { tone: 'accent-2', icon: <FlagIcon /> },
  update_info: { tone: 'accent', icon: <PencilIcon size={15} /> },
  add_equipment: { tone: 'success', icon: <PlusIcon size={15} /> },
  remove_equipment: { tone: 'danger', icon: <MinusIcon /> },
  update_load_settings: { tone: 'accent', icon: <SlidersIcon /> },
};

const EquipmentDetail = z.object({ code: EquipmentCodeSchema });

/** Matériel d'un ajout ou d'un retrait ; null pour les autres actions ou un code inconnu. */
function equipmentOf(h: HistoryEntry): EquipmentCode | null {
  if (h.action !== 'add_equipment' && h.action !== 'remove_equipment') return null;
  const detail = EquipmentDetail.safeParse(h.detail);
  return detail.success ? detail.data.code : null;
}

/** « Matériel ajouté : Kettlebell » (libellé court), « Nom ou ville modifiés »… */
export function actionText(h: HistoryEntry): string {
  const code = equipmentOf(h);
  return code ? `${ACTION_LABELS[h.action]} : ${EQUIPMENT_SHORT_LABELS[code]}` : ACTION_LABELS[h.action];
}

/**
 * Historique d'une salle en frise (maquettes D01 et D02, R-SAL-6) : une pastille par action reliée à la
 * suivante, l'action, puis « modifié par <pseudo> » et l'heure de Paris. Sans pseudo (compte supprimé, ou
 * auteur invisible à cette salle : le serveur ne le dit pas, R-VIS-4) : « un membre ».
 */
export function GymHistory(p: { entries: readonly HistoryEntry[] }) {
  return (
    <ol className={styles.timeline}>
      {p.entries.map((h, i) => {
        const code = equipmentOf(h);
        const mark = ACTION_MARKS[h.action];
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: entrées sans identifiant, liste en lecture seule remplacée d'un bloc
          <li key={i} className={styles.timelineItem}>
            <span className={styles.timelineMark} data-tone={mark.tone} aria-hidden="true">
              {mark.icon}
            </span>
            <div className={styles.timelineBody}>
              <span className={styles.timelineText}>
                {ACTION_LABELS[h.action]}
                {code ? (
                  <>
                    {' : '}
                    <strong>{EQUIPMENT_SHORT_LABELS[code]}</strong>
                  </>
                ) : null}
              </span>
              <span className={styles.timelineMeta}>
                {h.authorUsername ? <MemberAvatar name={h.authorUsername} size="tiny" /> : null}
                <span>
                  modifié par {h.authorUsername ?? 'un membre'} ·{' '}
                  <time dateTime={h.at}>{formatDateTime(h.at)}</time>
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
