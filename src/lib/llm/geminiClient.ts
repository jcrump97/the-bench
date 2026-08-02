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

export class GeminiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
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
}

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
      generationConfig: {
        // Structured JSON output is measurably more schema-compliant at
        // lower temperature; 0.7 keeps case-to-case narrative variety (the
        // point of live generation) while cutting down on malformed/schema-
        // violating responses that otherwise burn a generateValidated retry.
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: options.responseSchema,
      },
    }),
  });

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text === undefined) {
    throw new GeminiError('Gemini response contained no candidate text', null);
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
