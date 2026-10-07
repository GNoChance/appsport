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

const IOS_HELP =
  "Sur iPhone : touche Partager, puis « Sur l'écran d'accueil ». Ouvre ensuite appsport depuis l'écran d'accueil et colle le code.";
const ANDROID_HELP = "Sur Android : ouvre le menu ⋮ puis « Installer l'application ».";

/** Consigne d'installation du système, les deux quand il n'est pas reconnu (R-ARR-2). */
export function installHelp(platform: InstallPlatform): string[] {
  if (platform === 'ios') return [IOS_HELP];
  if (platform === 'android') return [ANDROID_HELP];
  return [IOS_HELP, ANDROID_HELP];
}
