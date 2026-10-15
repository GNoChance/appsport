import type { ReactNode } from 'react';

/**
 * Icônes au trait de l'espace Profil (maquettes C01 à C06) : 24 × 24, trait de 1,9, bouts ronds, couleur du
 * texte qui les porte. Toujours décoratives : la ligne, le bouton ou la carte qui les porte dit ce qu'elles
 * montrent.
 */
function Stroke(p: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {p.children}
    </svg>
  );
}

export const TargetIcon = () => (
  <Stroke>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" />
  </Stroke>
);

export const PinIcon = () => (
  <Stroke>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </Stroke>
);

export const HeartIcon = () => (
  <Stroke>
    <path d="M12 20s-7.2-4.4-8.7-9.2C2.3 7.4 4.5 4.5 7.6 4.5c1.9 0 3.4 1 4.4 2.6 1-1.6 2.5-2.6 4.4-2.6 3.1 0 5.3 2.9 4.3 6.3C19.2 15.6 12 20 12 20z" />
  </Stroke>
);

export const ShieldIcon = () => (
  <Stroke>
    <path d="M12 3 4.5 6v5.6c0 4.5 3.2 8.2 7.5 9.4 4.3-1.2 7.5-4.9 7.5-9.4V6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Stroke>
);

export const SlidersIcon = () => (
  <Stroke>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Stroke>
);

export const HelpIcon = () => (
  <Stroke>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2.1-2.4 3.8" />
    <path d="M12 17.2h.01" />
  </Stroke>
);

export const UsersIcon = () => (
  <Stroke>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.9-3.4 3.4-5.5 6.5-5.5s5.6 2.1 6.5 5.5" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
    <path d="M18 14.8c1.8.7 3 2.6 3.5 5.2" />
  </Stroke>
);

export const LogoutIcon = () => (
  <Stroke>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Stroke>
);

export const PulseIcon = () => (
  <Stroke>
    <path d="M3 12h4l3-7 4 14 3-7h4" />
  </Stroke>
);

export const BarsIcon = () => (
  <Stroke>
    <path d="M6 20v-5M12 20V10M18 20V4" />
  </Stroke>
);

export const CalendarIcon = () => (
  <Stroke>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Stroke>
);

export const UserIcon = () => (
  <Stroke>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Stroke>
);

export const IdCardIcon = () => (
  <Stroke>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6 16c.5-1.3 1.6-2 3-2s2.5.7 3 2" />
    <path d="M15 10h3.5M15 14h2.5" />
  </Stroke>
);

export const KeyIcon = () => (
  <Stroke>
    <circle cx="7.5" cy="15.5" r="4" />
    <path d="m10.4 12.6 9.1-9.1" />
    <path d="m16.5 6.5 2.5 2.5" />
    <path d="m14 9 2 2" />
  </Stroke>
);

export const LockIcon = () => (
  <Stroke>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Stroke>
);

export const GaugeIcon = () => (
  <Stroke>
    <path d="M3.5 17a8.5 8.5 0 1 1 17 0" />
    <path d="m12 17 4-5" />
  </Stroke>
);

export const PencilIcon = () => (
  <Stroke>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Stroke>
);

export const TrashIcon = () => (
  <Stroke>
    <path d="M4 7h16" />
    <path d="M9 7V4.5h6V7" />
    <path d="m6 7 1 13h10l1-13" />
  </Stroke>
);

export const PlusIcon = () => (
  <Stroke>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
);

export const SignalIcon = () => (
  <Stroke>
    <path d="M2 8.8a15 15 0 0 1 20 0" />
    <path d="M5.5 12.4a10 10 0 0 1 13 0" />
    <path d="M9 16a5 5 0 0 1 6 0" />
    <path d="M12 19.5h.01" />
  </Stroke>
);

export const OfflineIcon = () => (
  <Stroke>
    <path d="M7 18.5a4.5 4.5 0 0 1-.7-8.9 6 6 0 0 1 11.5-1.1A4.5 4.5 0 0 1 17.5 18.5z" />
    <path d="m9.5 13.5 2 2 3.5-3.5" />
  </Stroke>
);

export const UploadIcon = () => (
  <Stroke>
    <path d="M7 18.5a4.5 4.5 0 0 1-.7-8.9 6 6 0 0 1 11.5-1.1A4.5 4.5 0 0 1 17.5 18.5z" />
    <path d="M12 16v-5" />
    <path d="m9.5 13 2.5-2.5 2.5 2.5" />
  </Stroke>
);

export const AlertIcon = () => (
  <Stroke>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5" />
    <path d="M12 16.5h.01" />
  </Stroke>
);

export const StorageIcon = () => (
  <Stroke>
    <ellipse cx="12" cy="6" rx="7.5" ry="3" />
    <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
    <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
  </Stroke>
);

export const DocumentIcon = () => (
  <Stroke>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Stroke>
);

export const ChatIcon = () => (
  <Stroke>
    <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
  </Stroke>
);

export const PhoneIcon = () => (
  <Stroke>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Stroke>
);

export const DevicesIcon = () => (
  <Stroke>
    <rect x="2.5" y="4" width="13" height="10" rx="1.5" />
    <path d="M6 18h6M9 14v4" />
    <rect x="17" y="8" width="4.5" height="10" rx="1.2" />
  </Stroke>
);
