import { useState } from 'react';
import { Button } from './Button';

/** Copie `text` dans le presse-papiers ; le libellé confirme la copie. */
export function CopyButton(p: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.text);
      setState('copied');
    } catch {
      setState('failed');
    }
  };
  const label =
    state === 'copied' ? 'Copié' : state === 'failed' ? 'Copie impossible' : (p.label ?? 'Copier');
  return (
    <Button variant="secondary" onClick={() => void copy()}>
      {label}
    </Button>
  );
}
