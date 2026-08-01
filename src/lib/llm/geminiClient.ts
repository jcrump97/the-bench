// Thin wrapper over the Gemini REST API via native fetch. No SDK — the stack
// is locked (see CLAUDE.md), and this surface is small enough not to need one.

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

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

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }
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
