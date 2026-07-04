import type { CasePayload } from '../../schemas/gameSchemas';

type OceanTraits = CasePayload['defendant']['oceanTraits'];

const TRAIT_LABELS: Record<keyof OceanTraits, string> = {
  openness: 'Openness',
  conscientiousness: 'Conscientiousness',
  extraversion: 'Extraversion',
  agreeableness: 'Agreeableness',
  neuroticism: 'Neuroticism',
};

interface OceanTraitsMeterProps {
  traits: OceanTraits;
}

// Five meter-style micro-bars, one per OCEAN trait (schema range 1-10).
// Single-hue accent fill on a same-ramp track; every value is direct-labeled
// in text tokens, so color never carries information alone.
export function OceanTraitsMeter({ traits }: OceanTraitsMeterProps) {
  return (
    <div className="mt-1 space-y-2.5">
      {(Object.keys(TRAIT_LABELS) as Array<keyof OceanTraits>).map((trait) => (
        <div key={trait}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-(--text-muted)">{TRAIT_LABELS[trait]}</span>
            <span className="text-(--text) tabular-nums">{traits[trait]} / 10</span>
          </div>
          <div
            role="meter"
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={traits[trait]}
            aria-label={TRAIT_LABELS[trait]}
            className="mt-1 h-2 rounded-full bg-(--accent-bg)"
          >
            <div
              className="h-full rounded-full bg-(--accent)"
              style={{ width: `${traits[trait] * 10}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
