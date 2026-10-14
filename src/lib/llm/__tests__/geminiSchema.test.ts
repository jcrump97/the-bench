import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { toGeminiSchema } from '../geminiSchema';
import { STAGE_RESPONSE_SCHEMAS } from '../stages';
import { ENGINE_OWNED } from '../../../schemas/gameSchemas';

describe('toGeminiSchema', () => {
  it('carries string, number, and array bounds across', () => {
    const schema = z.object({
      name: z.string().min(1).max(40),
      caseId: z.string().regex(/^[0-9]{2}-CR-[0-9]{5}$/),
      score: z.number().int().min(1).max(10),
      tags: z.array(z.string()).min(2).max(6),
    });
    expect(toGeminiSchema(schema)).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 40 },
        caseId: { type: 'string', pattern: '^[0-9]{2}-CR-[0-9]{5}$' },
        score: { type: 'integer', minimum: 1, maximum: 10 },
        tags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 6 },
      },
      required: ['name', 'caseId', 'score', 'tags'],
    });
  });

  it('converts .positive() on an integer to an inclusive minimum and drops the safe-integer range', () => {
    expect(toGeminiSchema(z.number().int().positive())).toEqual({ type: 'integer', minimum: 1 });
  });

  it('refuses an exclusive bound on a real number rather than widening it', () => {
    expect(() => toGeminiSchema(z.number().positive())).toThrow(/exclusive minimum on a non-integer/);
  });

  it('marks a nullable field nullable and keeps its description', () => {
    const schema = z.object({ objection: z.string().min(1).nullable().describe('null when waived') });
    expect(toGeminiSchema(schema).properties!.objection).toEqual({
      type: 'string',
      minLength: 1,
      nullable: true,
      description: 'null when waived',
    });
  });

  it('leaves optional fields out of required', () => {
    const schema = z.object({ a: z.string(), b: z.string().optional() });
    expect(toGeminiSchema(schema).required).toEqual(['a']);
  });

  it('writes literals and enums as enums', () => {
    const schema = z.object({ kind: z.literal('FINE'), speaker: z.enum(['CLERK', 'DEFENSE']) });
    expect(toGeminiSchema(schema).properties).toEqual({
      kind: { type: 'string', enum: ['FINE'] },
      speaker: { type: 'string', enum: ['CLERK', 'DEFENSE'] },
    });
  });

  it('omits engine-owned fields entirely, including from required', () => {
    const schema = z.object({
      id: z.string(),
      isAdmitted: z.boolean().meta({ [ENGINE_OWNED]: true }),
    });
    expect(toGeminiSchema(schema)).toEqual({
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    });
  });

  it('flattens a discriminated union into one object admitting every branch', () => {
    const schema = z.discriminatedUnion('type', [
      z.object({ type: z.literal('JAIL'), unit: z.enum(['YEARS', 'DAYS']), amount: z.number().int().min(1).max(100) }),
      z.object({ type: z.literal('FINE'), unit: z.literal('DOLLARS'), amount: z.number().int().min(1).max(5000) }),
      z.object({
        type: z.literal('PROBATION'),
        unit: z.enum(['YEARS']),
        amount: z.number().int().min(1),
        conditions: z.array(z.string()).min(1),
      }),
    ]);
    expect(toGeminiSchema(schema)).toEqual({
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['JAIL', 'FINE', 'PROBATION'] },
        unit: { type: 'string', enum: ['YEARS', 'DAYS', 'DOLLARS'] },
        // PROBATION has no upper bound, so the widened field has none either.
        amount: { type: 'integer', minimum: 1 },
        // One branch only: present but never required.
        conditions: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
      required: ['type', 'unit', 'amount'],
    });
  });

  it('strips minItems from an array whose items nest an object that may be absent — the live-API 400', () => {
    const tape = z.object({ lines: z.string() });
    expect(toGeminiSchema(z.array(z.object({ tape: tape.nullable() })).min(3)).minItems).toBeUndefined();
    expect(toGeminiSchema(z.array(z.object({ tape: tape.optional() })).min(3)).minItems).toBeUndefined();
    // A required nested object is fine — charges[] carries minItems this way.
    expect(toGeminiSchema(z.array(z.object({ tape })).min(3)).minItems).toBe(3);
  });

  it('refuses a field with no representable type', () => {
    // z.unknown() compiles to `{}` — nothing the model could be told to produce.
    expect(() => toGeminiSchema(z.object({ x: z.unknown() }))).toThrow(/no representable type/);
  });

  it('refuses a JSON Schema keyword Gemini cannot express', () => {
    expect(() => toGeminiSchema(z.string().email())).toThrow(/"format" has no Gemini equivalent/);
  });
});

describe('compiled stage response schemas', () => {
  // What the model is actually sent, pinned. A change here is a change to a
  // live API request, and the mocked suite cannot vouch for one: `minItems` in
  // the wrong place is a bare 400 from Gemini. When this snapshot moves, run
  // `npm run test:live` before shipping (see CLAUDE.md).
  for (const [stage, { gemini }] of Object.entries(STAGE_RESPONSE_SCHEMAS)) {
    it(stage, () => {
      expect(gemini).toMatchSnapshot();
    });
  }
});
