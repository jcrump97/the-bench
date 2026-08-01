import { listModels } from './geminiClient';

// No hardcoded "the" model — Gemini's lineup shifts over time, so GameService
// discovers what's actually available to this key and picks the cheapest
// capable option. This is only the last-resort pick when discovery itself
// fails (network error, empty/unparseable response, or no candidate survives
// filtering).
const FALLBACK_MODEL = 'gemini-flash-lite-latest';

const EXCLUDED_NAME_PATTERN = /pro|ultra|embedding|vision|aqa|imagen|veo/i;

function rank(name: string): number {
  if (/flash-lite/i.test(name)) return 0;
  if (/flash/i.test(name)) return 1;
  return 2;
}

function stripModelsPrefix(name: string): string {
  return name.startsWith('models/') ? name.slice('models/'.length) : name;
}

// Discovers the cheapest model this key can call. Memoize the result per
// API key in the caller (GameService) so this only runs once per session.
export async function selectModel(apiKey: string): Promise<string> {
  try {
    const models = await listModels(apiKey);
    const candidates = models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent') ?? false)
      .map((m) => stripModelsPrefix(m.name))
      .filter((name) => !EXCLUDED_NAME_PATTERN.test(name));

    if (candidates.length === 0) {
      return FALLBACK_MODEL;
    }

    candidates.sort((a, b) => rank(a) - rank(b));
    return candidates[0] ?? FALLBACK_MODEL;
  } catch {
    return FALLBACK_MODEL;
  }
}
