// Sampling parameters (temperature, topP, topK) per model family.
//
// Google's Gemini 3.6 notes (updated 2026-10-13) say that starting with
// gemini-3.6-flash and gemini-3.5-flash-lite, "and all future Gemini model
// releases", temperature/top_p/top_k "are deprecated and ignored. In future
// model generations, supplying these parameters returns an HTTP 400 error."
// So sending a temperature to a current model buys nothing, and sending one to
// the next model breaks every call. Google's advice for determinism on those
// models is explicit system instructions, which every stage prompt already
// carries; the game's structure is deterministic in code either way, and the
// model only supplies the prose.
//
// The rule is therefore opt-in: a temperature is sent only to a family known
// to honor it, which is Gemini 2.x. Every other name gets none: Gemini 3.x and
// later, any name whose version can't be read (a "-latest" alias names no
// version), and any naming scheme Google introduces next.
//
// No seed is sent. The generateContent reference read on 2026-11-26 did not
// document one for current models, and an unprobed generationConfig field is
// how this pipeline has met a bare 400 before (see CLAUDE.md). A fixed seed
// with identical prompts would also return the same case every time.

// Low for schema compliance and a steady voice, not zero: at zero, identical
// stage prompts would produce near-identical cases on every press of
// "Generate a case".
export const HONORED_TEMPERATURE = 0.3;

export interface SamplingConfig {
  temperature?: number;
}

// Reads the major version from names like "gemini-2.5-flash-lite" or
// "gemini-4-argon"; null for anything else.
export function geminiMajorVersion(model: string): number | null {
  const match = /^gemini-(\d+)(?:\.\d+)?-/.exec(model);
  return match?.[1] === undefined ? null : Number(match[1]);
}

export function samplingFor(model: string): SamplingConfig {
  return geminiMajorVersion(model) === 2 ? { temperature: HONORED_TEMPERATURE } : {};
}
