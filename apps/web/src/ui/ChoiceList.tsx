import { ChoiceCard, ChoiceGroup } from './ChoiceCard';

/**
 * Groupe de boutons radio sous une légende, en cartes de choix. `describedBy` d'une option : id du
 * texte qui l'explique (par exemple la raison d'une option désactivée), lu avec elle.
 */
export function ChoiceList<T extends string | number>(p: {
  name: string;
  legend: string;
  value: T | null;
  onChange(v: T): void;
  options: readonly { value: T; label: string; disabled?: boolean; describedBy?: string }[];
}) {
  return (
    <ChoiceGroup legend={p.legend}>
      {p.options.map((o) => (
        <ChoiceCard
          key={String(o.value)}
          type="radio"
          name={p.name}
          value={String(o.value)}
          checked={p.value === o.value}
          disabled={o.disabled}
          describedBy={o.describedBy}
          onChange={() => p.onChange(o.value)}
          title={o.label}
        />
      ))}
    </ChoiceGroup>
  );
}
