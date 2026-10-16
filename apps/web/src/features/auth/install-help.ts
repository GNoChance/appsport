export type InstallPlatform = 'ios' | 'android' | 'other';

/** Appli installée sur l'écran d'accueil (R-ARR-1) : `display-mode: standalone`, ou `navigator.standalone` sur iOS. */
export function isStandalone(win: Window = window): boolean {
  const displayMode =
    typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches;
  return displayMode || (win.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function detectPlatform(userAgent: string): InstallPlatform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'other';
}

/** Pictogramme du bouton à toucher : Partager, Sur l'écran d'accueil, menu ⋮, Installer. */
export type InstallIcon = 'share' | 'add' | 'menu' | 'download';

/**
 * Une étape : le texte, puis le pictogramme du bouton dont elle parle. `iconLabel` : nom lu du pictogramme
 * quand le texte ne le dit pas (le menu ⋮) ; sans lui, le pictogramme est décoratif.
 */
export interface InstallStep {
  text: string;
  icon?: InstallIcon;
  iconLabel?: string;
}

export interface InstallGuide {
  title: string;
  steps: readonly InstallStep[];
}

/** Maquette A05 : les mêmes consignes, en étapes numérotées. */
const IOS_GUIDE: InstallGuide = {
  title: 'Sur iPhone',
  steps: [
    { text: 'Touche Partager', icon: 'share' },
    { text: "Puis « Sur l'écran d'accueil »", icon: 'add' },
    { text: "Ouvre ensuite Rune depuis l'écran d'accueil et colle le code." },
  ],
};

const ANDROID_GUIDE: InstallGuide = {
  title: 'Sur Android',
  steps: [
    { text: 'Ouvre le menu', icon: 'menu', iconLabel: '⋮' },
    { text: "Puis « Installer l'application »", icon: 'download' },
  ],
};

/** Consignes d'installation du système, les deux quand il n'est pas reconnu (R-ARR-2) ; Aide montre les deux. */
export function installHelp(platform: InstallPlatform): InstallGuide[] {
  if (platform === 'ios') return [IOS_GUIDE];
  if (platform === 'android') return [ANDROID_GUIDE];
  return [IOS_GUIDE, ANDROID_GUIDE];
}
