import { listModels } from './geminiClient';

// No hardcoded "the" model — Gemini's lineup shifts over time, so GameService
// discovers what's actually available to this key and picks the cheapest
// capable option. This is only the last-resort pick when discovery itself
// fails (network error, empty/unparseable response, or no candidate survives
// filtering).
const FALLBACK_MODEL = 'gemini-flash-lite-latest';

// Excludes both non-text-generation model families (image/audio/video/tool-
// use specialists that happen to have "flash" in the name, e.g.
// "gemini-3.1-flash-lite-image") and the larger reasoning tiers we don't
// want for cost reasons.
const EXCLUDED_NAME_PATTERN =
  /pro|ultra|embedding|vision|aqa|imagen|veo|image|tts|robotics|lyria|computer-use|antigravity|deep-research|omni|nano-banana|customtools/i;

// Cost/capability tier: cheapest first. Checked independently of stability
// below, since a deprecated flash-lite build is still preferable to a
// current-but-pricier flash model.
function tier(name: string): number {
  if (/flash-lite/i.test(name)) return 0;
  if (/flash/i.test(name)) return 1;
  return 2;
}

// Within a tier, prefer names Google keeps pointing at a working model over
// ones that can silently retire. A live run against this exact ranking once
// picked "gemini-2.0-flash-lite-001" — a pinned build ListModels still
// listed as generateContent-capable, but generateContent itself 404'd on it
// as retired — ahead of "gemini-flash-lite-latest", which never breaks this
// way. Preview/dated-snapshot names are deprioritized for the same reason:
// they're the ones most likely to be retired next.
function stability(name: string): number {
  if (/-latest$/i.test(name)) return 0;
  if (/preview|-\d{2}-\d{4}$/i.test(name)) return 2;
  if (/-\d+$/.test(name)) return 2;
  return 1;
}

function rank(name: string): [number, number] {
  return [tier(name), stability(name)];
}

function compareRank(a: string, b: string): number {
  const [tierA, stabilityA] = rank(a);
  const [tierB, stabilityB] = rank(b);
  return tierA - tierB || stabilityA - stabilityB;
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

    candidates.sort(compareRank);
    return candidates[0] ?? FALLBACK_MODEL;
  } catch {
    return FALLBACK_MODEL;
  }
}
