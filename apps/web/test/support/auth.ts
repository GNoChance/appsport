import { fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';

export const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
export const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
export const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** Mode d'affichage de la page : appli installée (`standalone`) ou onglet de navigateur. */
export function stubDisplayMode(standalone: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: standalone && query === '(display-mode: standalone)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

export function stubUserAgent(userAgent: string): void {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
}

/** Adresse de la page avec son fragment, comme à l'ouverture d'un lien d'invitation. */
export function openUrl(path: string): void {
  window.history.replaceState(null, '', path);
}

export function fill(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

export function click(name: string): void {
  fireEvent.click(screen.getByRole('button', { name }));
}
