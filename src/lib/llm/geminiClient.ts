// Thin wrapper over the Gemini REST API via native fetch. No SDK — the stack
// is locked (see CLAUDE.md), and this surface is small enough not to need one.

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
// A pipeline makes 6+ of these calls; a sustained burst of 429s (e.g. a
// short-window testing cadence hitting the same key repeatedly) used to
// exhaust in ~1.5s (3 attempts, 500/1000ms backoff) and fail the whole case
// generation. 5 attempts with jitter (avoids retries landing in lockstep)
// and Retry-After honored when Gemini sends one gives real rate-limit
// recovery a chance instead of guessing at a backoff.
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 15_000;

// Why a call produced no usable text, when the HTTP request itself succeeded.
// A 200 with no content used to surface as one generic "no candidate text",
// which is three very different problems wearing the same message: the model
// ran out of output budget mid-JSON, a safety filter stopped it, or the
// prompt itself was blocked before generation. They need different responses
// and, from the Mistrial screen, they need to be told apart.
export type GeminiFailureReason = 'MAX_TOKENS' | 'SAFETY' | 'NO_CANDIDATE';

export class GeminiError extends Error {
  readonly status: number | null;
  readonly reason: GeminiFailureReason | null;

  constructor(message: string, status: number | null, reason: GeminiFailureReason | null = null) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.reason = reason;
  }
}

// Gemini's structured-output schema is a constrained subset of OpenAPI's
// Schema object — the pieces this app's stage prompts need.
export interface GeminiSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
  enum?: string[];
  nullable?: boolean;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  propertyOrdering?: string[];
}

export interface GeminiCallOptions {
  systemInstruction: string;
  contents: string;
  responseSchema: GeminiSchema;
  maxOutputTokens?: number;
}

// The pipeline's largest response (EvidenceGen: several exhibits with their
// prose, reaction beats and ruling options, plus witnesses and a transcript)
// needs real headroom. Left unset, an overrun truncates the JSON mid-object
// and the failure reads as "not valid JSON" — a diagnosis that sends you
// looking at the wrong thing entirely. Verified accepted by the API.
const DEFAULT_MAX_OUTPUT_TOKENS = 32_768;

// This is a crime simulation: assault, weapons, narcotics, and custodial
// interrogation are the subject matter, not an accident. Default thresholds
// are tuned for general-purpose use and will stop legitimate case generation,
// so the configurable categories are relaxed to BLOCK_ONLY_HIGH — still
// blocking genuinely harmful output, but not ordinary criminal-court content.
const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' }));

interface RawModel {
  name: string;
  supportedGenerationMethods?: string[];
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Gemini's 429s often carry a Retry-After header (seconds) — honoring it
// beats guessing at a backoff. null when absent or unparseable.
function retryAfterMs(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (header === null) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  let nextDelayMs = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (nextDelayMs > 0) await sleep(nextDelayMs);
    // ±50% jitter so concurrent retries don't land in lockstep.
    const jitter = 0.5 + Math.random() * 0.5;
    nextDelayMs = Math.min(BASE_BACKOFF_MS * 2 ** attempt * jitter, MAX_BACKOFF_MS);

    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      if (!isRetryableStatus(response.status) || attempt === MAX_ATTEMPTS - 1) {
        const body = await response.text().catch(() => '');
        throw new GeminiError(
          `Gemini request failed with status ${response.status}: ${body}`,
          response.status,
        );
      }
      const retryAfter = retryAfterMs(response);
      if (retryAfter !== null) nextDelayMs = Math.min(retryAfter, MAX_BACKOFF_MS);
      lastError = new GeminiError(`Gemini request failed with status ${response.status}`, response.status);
    } catch (err) {
      if (err instanceof GeminiError) throw err;
      lastError = err;
      if (attempt === MAX_ATTEMPTS - 1) {
        throw new GeminiError(
          `Gemini request failed after ${MAX_ATTEMPTS} attempts: ${String(err)}`,
          null,
        );
      }
    }
  }
  throw lastError instanceof Error ? lastError : new GeminiError('Gemini request failed', null);
}

// Calls generateContent with JSON-mode structured output. Returns the raw
// JSON text from the first candidate — callers parse and Zod-validate it.
export async function callGemini(
  apiKey: string,
  model: string,
  options: GeminiCallOptions,
): Promise<string> {
  const url = `${API_ROOT}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: options.systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: options.contents }] }],
      safetySettings: SAFETY_SETTINGS,
      // No thinkingConfig here, and that is a decision rather than an
      // oversight. Three findings, each probed against the live API:
      //
      // 1. `thinkingBudget: 0` — the documented way to switch thinking off —
      //    is rejected outright with 400 INVALID_ARGUMENT by the model
      //    `gemini-flash-lite-latest` currently resolves to. Only a positive
      //    budget and -1 (dynamic) are accepted. Hardcoding the "disable"
      //    value would break every call, which is exactly how the evidence
      //    array's minItems broke this pipeline.
      // 2. The parameter is split by model family (`thinkingBudget` for 2.5,
      //    `thinkingLevel` for 3.x, and sending both is a 400) — but
      //    modelSelection deliberately prefers `-latest` *aliases*, whose
      //    names carry no version. There is no reliable way to pick the right
      //    parameter from the name we actually resolve.
      // 3. The pipeline measures 5/5 with zero failed attempts on the model's
      //    default. There is no failure here for a thinking budget to buy back.
      //
      // So the model's own default stands. If a future stage does need
      // bounded reasoning, add it per-stage behind a probe — never a constant.
      generationConfig: {
        // Structured JSON output is measurably more schema-compliant at
        // lower temperature; 0.7 keeps case-to-case narrative variety (the
        // point of live generation) while cutting down on malformed/schema-
        // violating responses that otherwise burn a generateValidated retry.
        temperature: 0.7,
        maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: options.responseSchema,
      },
    }),
  });

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  // A blocked prompt never reaches generation, so there are no candidates at
  // all — check it before looking for text that cannot exist.
  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason !== undefined) {
    throw new GeminiError(`Gemini blocked the prompt (${blockReason})`, null, 'SAFETY');
  }

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  // Order matters: a MAX_TOKENS candidate can carry partial text, and handing
  // that back as if it were complete is how a truncation gets misreported as
  // malformed JSON. Name the real cause instead.
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new GeminiError(
      `Gemini stopped at the output token limit (${options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS}); the JSON is truncated, not malformed`,
      null,
      'MAX_TOKENS',
    );
  }
  if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') {
    throw new GeminiError(`Gemini stopped generating for ${candidate.finishReason}`, null, 'SAFETY');
  }
  if (text === undefined) {
    const detail = candidate?.finishReason === undefined ? '' : ` (finishReason: ${candidate.finishReason})`;
    throw new GeminiError(`Gemini response contained no candidate text${detail}`, null, 'NO_CANDIDATE');
  }
  return text;
}

// Lists models available to this key, for dynamic model selection.
export async function listModels(apiKey: string): Promise<RawModel[]> {
  const url = `${API_ROOT}/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetchWithRetry(url, { method: 'GET' });
  const data = (await response.json()) as { models?: RawModel[] };
  return data.models ?? [];
}
