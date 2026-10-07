export type HelpResourceId = 'emergency' | 'pain' | 'eating_disorder' | 'doping' | 'pregnancy' | 'distress';

export interface HelpResource {
  id: HelpResourceId;
  label: string;
  phone: string | null;
  hours: string | null;
  sourceUrl: string | null;
  verifiedOn: string;
}

/** Page Aide (03 §13.7, 07 §5.11) : numéros revérifiés avant chaque mise en production. */
export const HELP_RESOURCES: readonly HelpResource[] = [
  {
    id: 'emergency',
    label: 'Urgence vitale (SAMU 15, numéro européen 112)',
    phone: '15 / 112',
    hours: null,
    sourceUrl: null,
    verifiedOn: '2026-10-06',
  },
  {
    id: 'pain',
    label: 'Douleur : consulte un médecin ou un kinésithérapeute',
    phone: null,
    hours: null,
    sourceUrl: null,
    verifiedOn: '2026-10-06',
  },
  {
    id: 'eating_disorder',
    label: 'Anorexie Boulimie Info Écoute (FFAB), appel non surtaxé',
    phone: '09 69 325 900',
    hours: null,
    sourceUrl: 'https://www.ffab.fr/500-ligne-tca-nouveau-numero',
    verifiedOn: '2026-10-06',
  },
  {
    id: 'doping',
    label: 'Écoute Dopage',
    phone: '0 800 15 2000',
    hours: null,
    sourceUrl: 'https://lannuaire.service-public.gouv.fr/centres-contact/R20697',
    verifiedOn: '2026-10-06',
  },
  {
    id: 'pregnancy',
    label: 'Grossesse ou allaitement : demande conseil à ton médecin ou à une sage-femme',
    phone: null,
    hours: null,
    sourceUrl: null,
    verifiedOn: '2026-10-06',
  },
  {
    id: 'distress',
    label: 'Prévention du suicide',
    phone: '3114',
    hours: '24 h/24, gratuit',
    sourceUrl: 'https://3114.fr/',
    verifiedOn: '2026-10-06',
  },
];
