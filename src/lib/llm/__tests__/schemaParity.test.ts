import { describe, it, expect } from 'vitest';
import type { GeminiSchema } from '../geminiClient';
import {
  SENTENCE_GEMINI_SCHEMA,
  CHARGE_CORE_GEMINI_SCHEMA,
  CHARGE_GEMINI_SCHEMA,
  ENVIRONMENT_GEMINI_SCHEMA,
  CHARACTER_GEMINI_SCHEMA,
  INTERROGATION_GEMINI_SCHEMA,
  WITNESS_GEMINI_SCHEMA,
  EVIDENCE_GEMINI_SCHEMA,
} from '../stages';
import {
  ChargeCoreSchema,
  ChargeSchema,
  EnvironmentSchema,
  CharacterSchema,
  InterrogationSchema,
  WitnessSchema,
  EvidenceSchema,
  SentenceTypeEnum,
  SentenceUnitEnum,
} from '../../../schemas/gameSchemas';

// ===========================================================================
// Zod <-> Gemini schema parity
//
// These are two hand-maintained descriptions of the same data. Zod is the
// trust boundary that decides what the game accepts; the Gemini
// `responseSchema` is what the model is *told* to produce. Nothing forced
// them to agree, and when they silently disagreed it cost a live debugging
// session: `relevanceScore` was 1-10 in Zod and a bare `number` in the Gemini
// schema, so the model kept answering with a 0-1 confidence score, Zod kept
// rejecting it, and the player saw "Mistrial" with no explanation.
//
// THE INVARIANT: the Gemini schema must never be *looser* than Zod.
//
// Not "identical" — looser is the direction that actually hurts. If Gemini
// permits something Zod rejects, the model will eventually emit it and burn a
// retry (or the whole generation). If Gemini is tighter than Zod, the model is
// simply held to a stricter standard than the gate requires, which is safe.
// That asymmetry is why this file compares bounds rather than asserting
// equality: it catches the failure mode without generating busywork every time
// a prompt-side constraint is deliberately tightened.
//
// DELIBERATELY NOT COMPARED: array item counts (`minItems`/`maxItems`).
// Whether an array carries `minItems` on the Gemini side is a per-field
// judgment call, not a transcription: setting it on `evidence` — whose item
// schema nests a nullable `interrogation` object — makes the API reject every
// request with a bare 400, which took case generation from 5/5 to 0/5. Zod's
// `.min()` and the prompt remain the enforcement there. See CLAUDE.md.
// ===========================================================================

interface ZodLike {
  _zod?: { def?: Record<string, unknown> };
  minLength?: number | null;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  options?: readonly string[];
}

interface Unwrapped {
  schema: ZodLike | null;
  /** True if any peeled wrapper was `.nullable()` — see the min-length rule below. */
  nullable: boolean;
}

/** Peel optional/nullable/default/readonly/pipe wrappers down to the payload type. */
function unwrap(schema: unknown): Unwrapped {
  let current = schema as ZodLike | undefined;
  let nullable = false;
  for (let guard = 0; guard < 20; guard++) {
    const def = current?._zod?.def;
    if (def === undefined) return { schema: null, nullable };
    const type = def.type as string;
    if (type === 'nullable') {
      nullable = true;
      current = def.innerType as ZodLike;
      continue;
    }
    if (type === 'optional' || type === 'default' || type === 'readonly') {
      current = def.innerType as ZodLike;
      continue;
    }
    // `.transform()` produces a pipe; the input side is what the model sends.
    if (type === 'pipe') {
      current = (def.in ?? def.out) as ZodLike;
      continue;
    }
    return { schema: current ?? null, nullable };
  }
  return { schema: current ?? null, nullable };
}

const UNION_TYPES = new Set(['union', 'discriminated_union']);

function zodType(schema: ZodLike | null): string | undefined {
  return schema?._zod?.def?.type as string | undefined;
}

function zodShape(schema: ZodLike | null): Record<string, unknown> | null {
  const def = schema?._zod?.def;
  if (def === undefined) return null;
  if (def.type === 'object') return def.shape as Record<string, unknown>;
  return null;
}

type Finding = string;

/**
 * Walk a Gemini schema against its Zod counterpart, reporting every place the
 * Gemini side would admit a value Zod rejects.
 */
function findLoosenings(gemini: GeminiSchema, zod: unknown, path: string): Finding[] {
  const findings: Finding[] = [];
  const { schema: target, nullable } = unwrap(zod);

  if (target === null) {
    findings.push(`${path}: no Zod counterpart — the Gemini schema declares a field Zod does not know about`);
    return findings;
  }

  // A Zod union has no single shape to compare field-by-field. The only union
  // reachable from these schemas is SentenceSchema, whose deliberately
  // flattened Gemini counterpart is pinned by its own test below — so rather
  // than skip silently, prove that is the union we actually hit.
  if (UNION_TYPES.has(zodType(target) ?? '')) {
    if (gemini !== SENTENCE_GEMINI_SCHEMA) {
      findings.push(
        `${path}: Zod is a union but the Gemini schema is not SENTENCE_GEMINI_SCHEMA — ` +
          'an unchecked union has appeared and needs its own parity assertion',
      );
    }
    return findings;
  }

  // ---- enums ------------------------------------------------------------
  if (gemini.enum !== undefined) {
    const zodOptions = target.options;
    if (zodOptions === undefined) {
      findings.push(`${path}: Gemini declares an enum but Zod does not constrain the value`);
    } else {
      const extra = gemini.enum.filter((member) => !zodOptions.includes(member));
      const missing = zodOptions.filter((member) => !gemini.enum!.includes(member));
      if (extra.length > 0) {
        findings.push(`${path}: Gemini permits [${extra.join(', ')}] which Zod rejects`);
      }
      if (missing.length > 0) {
        findings.push(`${path}: Zod permits [${missing.join(', ')}] which Gemini never offers the model`);
      }
    }
  }

  // ---- string length ----------------------------------------------------
  if (gemini.type === 'string' && zodType(target) === 'string') {
    const zodMax = target.maxLength;
    const zodMin = target.minLength;
    if (zodMax != null && (gemini.maxLength === undefined || gemini.maxLength > zodMax)) {
      findings.push(
        `${path}: Zod caps length at ${zodMax} but Gemini allows ${gemini.maxLength ?? 'unbounded'}`,
      );
    }
    // A nullable field is exempt from the minimum on purpose. Zod's `.min(1)`
    // binds the non-null branch only, and a Gemini schema has no way to say
    // "null, or a string of at least one character" — declaring minLength
    // there would forbid the null the field explicitly permits. The maximum
    // still applies, since it constrains the same non-null branch harmlessly.
    if (
      !nullable &&
      zodMin != null &&
      zodMin > 0 &&
      (gemini.minLength === undefined || gemini.minLength < zodMin)
    ) {
      findings.push(
        `${path}: Zod requires at least ${zodMin} chars but Gemini allows ${gemini.minLength ?? 0}`,
      );
    }
  }

  // ---- numeric range ----------------------------------------------------
  if ((gemini.type === 'integer' || gemini.type === 'number') && zodType(target) === 'number') {
    const zodMin = target.minValue;
    const zodMax = target.maxValue;
    // Zod reports the platform safe-integer bounds for a bare `.int()`, which
    // is not a real domain constraint — only compare bounds tighter than that.
    const isRealBound = (v: number | null | undefined): v is number =>
      v != null && Math.abs(v) < Number.MAX_SAFE_INTEGER;
    if (isRealBound(zodMin) && (gemini.minimum === undefined || gemini.minimum < zodMin)) {
      findings.push(`${path}: Zod requires >= ${zodMin} but Gemini allows ${gemini.minimum ?? '-inf'}`);
    }
    if (isRealBound(zodMax) && (gemini.maximum === undefined || gemini.maximum > zodMax)) {
      findings.push(`${path}: Zod requires <= ${zodMax} but Gemini allows ${gemini.maximum ?? '+inf'}`);
    }
  }

  // ---- recurse ----------------------------------------------------------
  if (gemini.type === 'object' && gemini.properties !== undefined) {
    const shape = zodShape(target);
    for (const [key, child] of Object.entries(gemini.properties)) {
      if (shape === null) {
        findings.push(`${path}.${key}: Gemini nests an object where Zod has none`);
        continue;
      }
      findings.push(...findLoosenings(child, shape[key], `${path}.${key}`));
    }
  }

  if (gemini.type === 'array' && gemini.items !== undefined) {
    const element = target._zod?.def?.element;
    findings.push(...findLoosenings(gemini.items, element, `${path}[]`));
  }

  return findings;
}

// The building blocks that describe the same entity on both sides.
// SentenceSchema is absent on purpose — it is a discriminated union, checked
// separately below.
const PAIRS: [name: string, gemini: GeminiSchema, zod: unknown][] = [
  ['ChargeCore', CHARGE_CORE_GEMINI_SCHEMA, ChargeCoreSchema],
  ['Charge', CHARGE_GEMINI_SCHEMA, ChargeSchema],
  ['Environment', ENVIRONMENT_GEMINI_SCHEMA, EnvironmentSchema],
  ['Character', CHARACTER_GEMINI_SCHEMA, CharacterSchema],
  ['Interrogation', INTERROGATION_GEMINI_SCHEMA, InterrogationSchema],
  ['Witness', WITNESS_GEMINI_SCHEMA, WitnessSchema],
  ['Evidence', EVIDENCE_GEMINI_SCHEMA, EvidenceSchema],
];

describe('Zod <-> Gemini schema parity', () => {
  for (const [name, gemini, zod] of PAIRS) {
    it(`${name}: the Gemini schema is no looser than Zod`, () => {
      expect(findLoosenings(gemini, zod, name)).toEqual([]);
    });
  }

  // SentenceSchema is a discriminated union: PRISON/JAIL take YEARS|MONTHS|DAYS,
  // PROBATION takes YEARS|MONTHS, FINE takes DOLLARS, COMMUNITY_SERVICE takes
  // HOURS. Gemini's dialect cannot express that correlation, so the Gemini
  // schema flattens every unit into one enum and lets Zod re-correlate them on
  // the way in. That is the one place the "no looser than Zod" rule is broken
  // on purpose, so it is pinned explicitly instead.
  it('Sentence: the flattened union offers exactly the declared vocabularies', () => {
    const props = SENTENCE_GEMINI_SCHEMA.properties!;
    expect(props.type!.enum).toEqual([...SentenceTypeEnum.options]);
    expect(props.unit!.enum).toEqual([...SentenceUnitEnum.options]);
  });

  it('Sentence: every unit the model may send is one Zod knows how to bound', () => {
    // SENTENCE_UNIT_MAX is keyed by SentenceUnitEnum, so this holds by
    // construction — the assertion is here to fail loudly if that key type is
    // ever widened independently of the enum the model is shown.
    expect(new Set(SENTENCE_GEMINI_SCHEMA.properties!.unit!.enum)).toEqual(
      new Set(SentenceUnitEnum.options),
    );
  });
});
