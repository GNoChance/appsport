import type { ReactNode } from 'react';

/**
 * Icônes de l'administration (maquettes E01 à E05) : traits de 24, bouts arrondis, couleur du texte parent
 * (`currentColor`), toujours décoratives (le texte à côté, ou le nom du bouton, dit la même chose).
 */
function Icon(p: { size?: number; stroke?: number; children: ReactNode }) {
  const size = p.size ?? 22;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={p.stroke ?? 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {p.children}
    </svg>
  );
}

type Size = { size?: number };

export const MoreIcon = () => (
  <Icon stroke={3}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon size={20} stroke={2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon size={16} stroke={2.6}>
    <path d="m5 12 4.5 4.5L19 7" />
  </Icon>
);

export const DashIcon = () => (
  <Icon size={16} stroke={2.4}>
    <path d="M7 12h10" />
  </Icon>
);

export const ClockIcon = (p: Size) => (
  <Icon size={p.size ?? 16} stroke={2.2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const KeyIcon = () => (
  <Icon>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 9.3-9.3M17 6l3 3M14.5 8.5l2.5 2.5" />
  </Icon>
);

export const LogoutIcon = () => (
  <Icon>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Icon>
);

export const ShieldIcon = () => (
  <Icon>
    <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const CalendarIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);

export const UserCheckIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" />
    <path d="m16 11 2 2 4-4" />
  </Icon>
);

export const UserOffIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" />
    <path d="m17 8 4 4M21 8l-4 4" />
  </Icon>
);

export const TrashIcon = () => (
  <Icon>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M9 7V4h6v3" />
  </Icon>
);

export const ServerIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="7" rx="2" />
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01" />
  </Icon>
);

export const DiskIcon = () => (
  <Icon size={20}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </Icon>
);

export const ChipIcon = () => (
  <Icon size={16}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
  </Icon>
);

export const RestartIcon = () => (
  <Icon size={16}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
);

export const WarningIcon = () => (
  <Icon size={16} stroke={2}>
    <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
    <path d="M12 9.5v4" />
    <path d="M12 17h.01" />
  </Icon>
);
