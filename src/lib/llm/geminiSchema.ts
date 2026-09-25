import { z } from 'zod';
import { ENGINE_OWNED } from '../../schemas/gameSchemas';
import type { GeminiSchema } from './geminiClient';

// ============================================================================
// Zod -> Gemini responseSchema compiler.
//
// The Gemini `responseSchema` used to be a second, hand-transcribed copy of
// every Zod schema a stage validates against — ~500 lines that had to be kept
// in step by hand, and weren't: `relevanceScore` was 1-10 in Zod and a bare
// number in Gemini (the "Mistrial most of the time" report), a nullable string
// dropped its minimum, and two stage schemas re-declared fields and lost their
// `noJury` refinement on the way. Every one of those was a transcription bug,
// so patching fields one at a time left the thing generating them intact.
//
// This compiles the Gemini dialect *from* the Zod schema instead, so the model
// is told exactly what the trust boundary enforces. It rides on Zod's own
// `z.toJSONSchema()` rather than walking Zod internals, and then translates
// JSON Schema into Gemini's OpenAPI subset. The translation is strict: any
// keyword it does not know how to express throws, so a Zod feature Gemini
// cannot represent fails in `npm test` instead of as a bare 400 in a player's
// Mistrial screen.
//
// Refinements (`.refine`/`.superRefine`) are not representable in either
// dialect and are silently absent from the output — they stay enforced by Zod
// on the way back in, and the stage prompts state them in words.
// ============================================================================

type JsonSchema = Record<string, unknown>;

// JSON Schema keywords the translation understands. Anything else throws.
const KNOWN_KEYWORDS = new Set([
  '$schema',
  'type',
  'description',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'const',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minItems',
  'maxItems',
  'anyOf',
  'oneOf',
  ENGINE_OWNED,
]);

// Zod reports the platform safe-integer range for a bare `.int()`. That is not
// a domain bound, and sending it would only add noise to the request.
const isDomainBound = (value: unknown): value is number =>
  typeof value === 'number' && Math.abs(value) < Number.MAX_SAFE_INTEGER;

export function toGeminiSchema(schema: z.ZodType): GeminiSchema {
  const json = z.toJSONSchema(schema, {
    // What the model sends is the *input* side of any transform.
    io: 'input',
    // Gemini has no $ref: every reused schema is written out in place.
    reused: 'inline',
    unrepresentable: 'throw',
  }) as JsonSchema;
  return stripUnsafeMinItems(convert(json, '$'));
}

function fail(path: string, message: string): never {
  throw new Error(`toGeminiSchema: ${path}: ${message}`);
}

function convert(node: JsonSchema, path: string): GeminiSchema {
  for (const key of Object.keys(node)) {
    if (!KNOWN_KEYWORDS.has(key)) fail(path, `JSON Schema keyword "${key}" has no Gemini equivalent`);
  }

  const union = (node.anyOf ?? node.oneOf) as JsonSchema[] | undefined;
  if (union !== undefined) return convertUnion(node, union, path);

  const out = convertTyped(node, path);
  if (typeof node.description === 'string') out.description = node.description;
  return out;
}

function convertTyped(node: JsonSchema, path: string): GeminiSchema {
  switch (node.type) {
    case 'string': {
      const out: GeminiSchema = { type: 'string' };
      // A z.literal is a one-member enum as far as the model is concerned.
      if (node.const !== undefined) out.enum = [String(node.const)];
      if (Array.isArray(node.enum)) out.enum = node.enum.map(String);
      if (typeof node.minLength === 'number' && node.minLength > 0) out.minLength = node.minLength;
      if (typeof node.maxLength === 'number') out.maxLength = node.maxLength;
      if (typeof node.pattern === 'string') out.pattern = node.pattern;
      return out;
    }
    case 'integer':
    case 'number': {
      const out: GeminiSchema = { type: node.type };
      if (isDomainBound(node.minimum)) out.minimum = node.minimum;
      if (isDomainBound(node.maximum)) out.maximum = node.maximum;
      // Gemini has only inclusive bounds. For an integer the exclusive form
      // converts exactly (`.positive()` is "> 0", which is ">= 1"); for a
      // real number it cannot, and silently widening it would be the exact
      // loosening this compiler exists to prevent.
      if (isDomainBound(node.exclusiveMinimum)) {
        if (node.type !== 'integer') fail(path, 'an exclusive minimum on a non-integer has no Gemini equivalent');
        out.minimum = node.exclusiveMinimum + 1;
      }
      if (isDomainBound(node.exclusiveMaximum)) {
        if (node.type !== 'integer') fail(path, 'an exclusive maximum on a non-integer has no Gemini equivalent');
        out.maximum = node.exclusiveMaximum - 1;
      }
      return out;
    }
    case 'boolean':
      return { type: 'boolean' };
    case 'array': {
      if (node.items === undefined) fail(path, 'array without an item schema');
      const out: GeminiSchema = { type: 'array', items: convert(node.items as JsonSchema, `${path}[]`) };
      if (typeof node.minItems === 'number' && node.minItems > 0) out.minItems = node.minItems;
      if (typeof node.maxItems === 'number') out.maxItems = node.maxItems;
      return out;
    }
    case 'object': {
      const properties: Record<string, GeminiSchema> = {};
      for (const [key, child] of Object.entries((node.properties ?? {}) as Record<string, JsonSchema>)) {
        // Fields the engine owns (e.g. `isAdmitted`, set by player action) are
        // never the model's to write. Omitting them is the difference between
        // "the model doesn't mention it" and "the model can't".
        if (child[ENGINE_OWNED] === true) continue;
        properties[key] = convert(child, `${path}.${key}`);
      }
      const required = ((node.required ?? []) as string[]).filter((key) => key in properties);
      return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) };
    }
    default:
      // `{}` — what Zod emits for z.unknown() or z.any(): nothing the model
      // could be told to produce.
      return fail(path, `no representable type (got ${JSON.stringify(node.type)})`);
  }
}

function convertUnion(node: JsonSchema, members: JsonSchema[], path: string): GeminiSchema {
  const nonNull = members.filter((m) => m.type !== 'null');

  // `.nullable()` — X or null.
  if (nonNull.length === 1 && members.length === 2) {
    const out = convert(nonNull[0]!, path);
    out.nullable = true;
    if (typeof node.description === 'string') out.description = node.description;
    return out;
  }
  if (nonNull.length !== members.length) fail(path, 'a nullable union of several types has no Gemini equivalent');

  // A discriminated union of objects. Gemini's dialect has no union at all,
  // so the branches are flattened into one object: every property any branch
  // declares, required only where every branch requires it, with enums and
  // bounds widened to admit every branch. That is looser than Zod on purpose
  // and in one direction only — the model sees every unit, say, and Zod
  // correlates the unit back to the sentence type on the way in. SentenceSchema
  // is the one union a stage reaches today.
  if (!nonNull.every((m) => m.type === 'object')) fail(path, 'only unions of objects can be flattened');
  const branches = nonNull.map((m, i) => convert(m, `${path}|${i}`));

  const keys: string[] = [];
  for (const branch of branches) {
    for (const key of Object.keys(branch.properties ?? {})) if (!keys.includes(key)) keys.push(key);
  }
  const properties: Record<string, GeminiSchema> = {};
  for (const key of keys) {
    properties[key] = widen(
      branches.flatMap((b) => (b.properties?.[key] !== undefined ? [b.properties[key]] : [])),
      `${path}.${key}`,
    );
  }
  const required = keys.filter((key) => branches.every((b) => b.required?.includes(key)));
  const out: GeminiSchema = { type: 'object', properties, ...(required.length > 0 ? { required } : {}) };
  if (typeof node.description === 'string') out.description = node.description;
  return out;
}

// The narrowest single schema that admits every one of `variants`.
function widen(variants: GeminiSchema[], path: string): GeminiSchema {
  const [first, ...rest] = variants;
  if (first === undefined) fail(path, 'no variants to widen');
  if (rest.length === 0) return first;
  if (!rest.every((v) => v.type === first.type)) fail(path, 'union branches disagree on the type of this field');

  const out: GeminiSchema = { type: first.type };
  const all = <K extends keyof GeminiSchema>(key: K) => variants.every((v) => v[key] !== undefined);
  const nums = (key: 'minLength' | 'maxLength' | 'minimum' | 'maximum' | 'minItems' | 'maxItems') =>
    variants.map((v) => v[key] as number);

  if (all('enum')) {
    out.enum = [];
    for (const v of variants) for (const member of v.enum!) if (!out.enum.includes(member)) out.enum.push(member);
  }
  // A lower bound survives only if every branch has one, and then at its
  // loosest; the same for upper bounds. A bound only some branches carry is
  // dropped — keeping it would forbid values another branch allows.
  if (all('minLength')) out.minLength = Math.min(...nums('minLength'));
  if (all('maxLength')) out.maxLength = Math.max(...nums('maxLength'));
  if (all('minimum')) out.minimum = Math.min(...nums('minimum'));
  if (all('maximum')) out.maximum = Math.max(...nums('maximum'));
  if (all('minItems')) out.minItems = Math.min(...nums('minItems'));
  if (all('maxItems')) out.maxItems = Math.max(...nums('maxItems'));
  if (variants.some((v) => v.nullable)) out.nullable = true;
  if (first.pattern !== undefined && variants.every((v) => v.pattern === first.pattern)) out.pattern = first.pattern;
  if (first.items !== undefined) out.items = widen(variants.map((v) => v.items!), `${path}[]`);
  if (first.properties !== undefined) {
    fail(path, 'widening nested objects across union branches is not supported');
  }
  if (first.description !== undefined) out.description = first.description;
  return out;
}

// The one hard-won API carve-out, applied structurally rather than remembered
// per field: Gemini rejects the *whole request* with a bare 400
// INVALID_ARGUMENT when `minItems` is set on an array whose item schema has a
// nested object that may be absent — nullable *or* simply not required. Found
// by live bisection twice: first with `evidence[]`'s nullable `interrogation`
// (case generation 5/5 -> 0/5), and again when this compiler first shipped the
// accurate translation of that field (optional, not nullable) and the same
// 0/5 came back. Removing `minItems` alone restored the request both times.
// Zod's `.min()` still enforces the count on the way back in, and the stage
// prompt states it.
function stripUnsafeMinItems(schema: GeminiSchema): GeminiSchema {
  const out: GeminiSchema = { ...schema };
  if (out.properties !== undefined) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([key, child]) => [key, stripUnsafeMinItems(child)]),
    );
  }
  if (out.items !== undefined) {
    out.items = stripUnsafeMinItems(out.items);
    const itemRequired = new Set(out.items.required ?? []);
    const itemHasAbsentableObject = Object.entries(out.items.properties ?? {}).some(
      ([key, child]) => child.type === 'object' && (child.nullable === true || !itemRequired.has(key)),
    );
    if (itemHasAbsentableObject) delete out.minItems;
  }
  return out;
}
