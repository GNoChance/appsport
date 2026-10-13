import { useState } from 'react';
import { Button } from './Button';

/**
 * Copie `text` dans le presse-papiers ; le libellé confirme la copie. Presse-papiers refusé ou
 * absent : « Copie impossible », et `onResult(false)` laisse l'écran dire quoi sélectionner.
 */
export function CopyButton(p: { text: string; label?: string; onResult?(copied: boolean): void }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    let copied = true;
    try {
      await navigator.clipboard.writeText(p.text);
    } catch {
      copied = false;
    }
    setState(copied ? 'copied' : 'failed');
    p.onResult?.(copied);
  };
  const label =
    state === 'copied' ? 'Copié' : state === 'failed' ? 'Copie impossible' : (p.label ?? 'Copier');
  return (
    <Button variant="secondary" onClick={() => void copy()}>
      {label}
    </Button>
  );
}
