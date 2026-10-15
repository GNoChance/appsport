import type { ReactNode } from 'react';

/**
 * Icônes des écrans Salles (maquettes D01 à D05) : traits de 24, bouts arrondis, couleur du texte parent
 * (`currentColor`), toujours décoratives (le texte à côté dit la même chose).
 */
function Icon(p: { size?: number; stroke?: number; children: ReactNode }) {
  const size = p.size ?? 24;
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

export const GymIcon = (p: Size) => (
  <Icon size={p.size}>
    <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />
  </Icon>
);

export const HomeIcon = (p: Size) => (
  <Icon size={p.size}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Icon>
);

export const StarIcon = (p: Size) => (
  <Icon size={p.size} stroke={2.2}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z" />
  </Icon>
);

export const ChevronIcon = (p: Size) => (
  <Icon size={p.size ?? 20} stroke={2}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const PlusIcon = (p: Size) => (
  <Icon size={p.size ?? 20} stroke={2.2}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinusIcon = (p: Size) => (
  <Icon size={p.size ?? 15} stroke={2.4}>
    <path d="M5 12h14" />
  </Icon>
);

export const CheckIcon = (p: Size) => (
  <Icon size={p.size ?? 15} stroke={2.6}>
    <path d="m5 12 4.5 4.5L19 7" />
  </Icon>
);

export const PencilIcon = (p: Size) => (
  <Icon size={p.size ?? 20} stroke={2}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Icon>
);

export const PinIcon = (p: Size) => (
  <Icon size={p.size ?? 15} stroke={2}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Icon>
);

export const PeopleIcon = (p: Size) => (
  <Icon size={p.size ?? 15} stroke={2}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
    <path d="M18.5 14.9c1.7.8 2.7 2.5 3 5.1" />
  </Icon>
);

export const FlagIcon = (p: Size) => (
  <Icon size={p.size ?? 15} stroke={2.4}>
    <path d="M5 21V4" />
    <path d="M5 4h12l-2.5 4.5L17 13H5" />
  </Icon>
);

export const SlidersIcon = (p: Size) => (
  <Icon size={p.size ?? 15} stroke={2.4}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Icon>
);

export const TrashIcon = (p: Size) => (
  <Icon size={p.size ?? 18} stroke={2}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13" />
    <path d="M9 7V4h6v3" />
  </Icon>
);

export const SearchIcon = (p: Size) => (
  <Icon size={p.size ?? 20} stroke={2}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const CloseIcon = (p: Size) => (
  <Icon size={p.size ?? 18} stroke={2.2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
