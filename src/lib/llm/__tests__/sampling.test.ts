import { describe, it, expect } from 'vitest';
import { HONORED_TEMPERATURE, geminiMajorVersion, samplingFor } from '../sampling';

describe('geminiMajorVersion', () => {
  it('reads the major version from versioned names', () => {
    expect(geminiMajorVersion('gemini-2.5-flash-lite')).toBe(2);
    expect(geminiMajorVersion('gemini-3.5-flash-lite')).toBe(3);
    expect(geminiMajorVersion('gemini-3-flash-preview')).toBe(3);
    expect(geminiMajorVersion('gemini-4-argon')).toBe(4);
  });

  it('returns null for aliases and unknown schemes', () => {
    expect(geminiMajorVersion('gemini-flash-lite-latest')).toBeNull();
    expect(geminiMajorVersion('gemini-flash-latest')).toBeNull();
    expect(geminiMajorVersion('some-new-model')).toBeNull();
  });
});

describe('samplingFor', () => {
  it('sends a low, nonzero temperature only to Gemini 2.x', () => {
    expect(HONORED_TEMPERATURE).toBeGreaterThan(0);
    expect(HONORED_TEMPERATURE).toBeLessThan(0.5);
    expect(samplingFor('gemini-2.5-flash')).toEqual({ temperature: HONORED_TEMPERATURE });
  });

  it('sends nothing to Gemini 3.x and later, which ignore it now and will reject it', () => {
    expect(samplingFor('gemini-3.1-flash-lite')).toEqual({});
    expect(samplingFor('gemini-3.5-flash-lite')).toEqual({});
    expect(samplingFor('gemini-3.8-flash')).toEqual({});
    expect(samplingFor('gemini-4-argon')).toEqual({});
  });

  it('sends nothing when the version cannot be read', () => {
    expect(samplingFor('gemini-flash-lite-latest')).toEqual({});
  });
});
