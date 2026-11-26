import { DEFAULT_MAX_OUTPUT_TOKENS, listModels, type RawModel } from './geminiClient';
import { costPerCase, findPricedModel, priceOn } from './modelPricing';

// The model is chosen at runtime from what ListModels says this key can call,
// never from a hardcoded name: Gemini's lineup and its names change. This
// constant is used only when discovery itself fails (network error,
// unparseable response, or nothing survives the filters). It is Google's own
// alias, the one name that keeps pointing at a working model without this
// code knowing which one.
const FALLBACK_MODEL = 'gemini-flash-lite-latest';

// Excludes non-text-generation families that happen to support
// generateContent and even carry "flash" in the name (e.g.
// "gemini-3.1-flash-lite-image"), plus the larger reasoning tiers this
// pipeline doesn't need. ListModels reports no "family" or "modality" field,
// so names are the only signal for these.
const EXCLUDED_NAME_PATTERN =
  /pro|ultra|embedding|vision|aqa|imagen|veo|image|tts|robotics|lyria|computer-use|antigravity|deep-research|omni|nano-banana|customtools/i;

// What the pipeline needs from a model, checked against the limits ListModels
// reports. Output: every call asks for DEFAULT_MAX_OUTPUT_TOKENS, and a model
// capped below that would stop mid-JSON. Input: the largest prompt (the
// whole-case repair round) is a few thousand tokens; 32K leaves ample room. A
// model that reports no limit is not rejected for it.
const MIN_INPUT_TOKENS = 32_768;
const MIN_OUTPUT_TOKENS = DEFAULT_MAX_OUTPUT_TOKENS;

// The most a generated case should cost, in dollars, on the measured token
// mix. Among priced models within it, the newest wins: pure cheapest-first
// would keep the pipeline on an older generation to save a fraction of a cent
// per case, and newest-first alone would buy a pricier tier the game doesn't
// need. When no priced model is within it, the cheapest one is used. On the
// 2026-11-26 table this picks gemini-3.5-flash-lite (about $0.015 a case) over
// gemini-3.1-flash-lite (about $0.009), and leaves out gemini-3.8-flash (about
// $0.024 at its introductory price, $0.048 from 2027-01-01). Thinking tokens
// are not in the measured mix, so the real bill runs somewhat higher.
export const MAX_COST_PER_CASE_USD = 0.02;

function stripModelsPrefix(name: string): string {
  return name.startsWith('models/') ? name.slice('models/'.length) : name;
}

function meetsPipelineNeeds(m: RawModel): boolean {
  if (!(m.supportedGenerationMethods?.includes('generateContent') ?? false)) return false;
  if (EXCLUDED_NAME_PATTERN.test(stripModelsPrefix(m.name))) return false;
  if (m.inputTokenLimit !== undefined && m.inputTokenLimit < MIN_INPUT_TOKENS) return false;
  if (m.outputTokenLimit !== undefined && m.outputTokenLimit < MIN_OUTPUT_TOKENS) return false;
  return true;
}

// --- Unpriced fallback ranking -------------------------------------------
// Used only when no listed model is in the price table. With nothing to
// compare on cost, the name is the best remaining signal.

// Cheapest-sounding first.
function tier(name: string): number {
  if (/flash-lite/i.test(name)) return 0;
  if (/flash/i.test(name)) return 1;
  return 2;
}

// Within a tier, prefer names Google keeps pointing at a working model over
// ones that can silently retire. A live run once picked
// "gemini-2.0-flash-lite-001", a pinned build ListModels still listed as
// generateContent-capable but that generateContent 404'd on as retired, ahead
// of "gemini-flash-lite-latest". Preview/dated-snapshot names are
// deprioritized for the same reason.
function stability(name: string): number {
  if (/-latest$/i.test(name)) return 0;
  if (/preview|-\d{2}-\d{4}$/i.test(name)) return 2;
  if (/-\d+$/.test(name)) return 2;
  return 1;
}

function compareUnpriced(a: string, b: string): number {
  return tier(a) - tier(b) || stability(a) - stability(b) || a.localeCompare(b);
}

// --- Choice ----------------------------------------------------------------

interface PricedCandidate {
  id: string;
  released: string;
  cost: number;
}

// Pure: the same model list and day always give the same model. Priced
// candidates (live on `now`, per the table) are ranked on the per-case budget
// and recency; unpriced ones only when no priced candidate is available.
export function chooseModel(models: readonly RawModel[], now: Date): string | null {
  const names = models.filter(meetsPipelineNeeds).map((m) => stripModelsPrefix(m.name));

  const priced: PricedCandidate[] = [];
  for (const id of names) {
    const entry = findPricedModel(id);
    const price = entry === undefined ? null : priceOn(entry, now);
    if (entry !== undefined && price !== null) {
      priced.push({ id, released: entry.released, cost: costPerCase(price) });
    }
  }

  if (priced.length > 0) {
    const withinBudget = priced.filter((c) => c.cost <= MAX_COST_PER_CASE_USD);
    if (withinBudget.length > 0) {
      withinBudget.sort(
        (a, b) => b.released.localeCompare(a.released) || a.cost - b.cost || a.id.localeCompare(b.id),
      );
      return withinBudget[0]?.id ?? null;
    }
    priced.sort((a, b) => a.cost - b.cost || b.released.localeCompare(a.released) || a.id.localeCompare(b.id));
    return priced[0]?.id ?? null;
  }

  // A model in the table but not live today (shut down) is not a fallback
  // either: it is known to be gone.
  const unpriced = names.filter((id) => findPricedModel(id) === undefined).sort(compareUnpriced);
  return unpriced[0] ?? null;
}

// Discovers the model this key should use today.
export async function selectModel(apiKey: string, now: Date = new Date()): Promise<string> {
  try {
    const models = await listModels(apiKey);
    return chooseModel(models, now) ?? FALLBACK_MODEL;
  } catch {
    return FALLBACK_MODEL;
  }
}

// Module-scoped cache, not instance-scoped: the app can end up creating more
// than one GameService for the same key within a session (WelcomeScreen's
// generateCase and SentencingControl's later generateAftermath each build
// their own instance via useCaseSource/createGameService), and a fresh React
// component's local memoization wouldn't survive WelcomeScreen unmounting
// once Act 1 starts. Caching here instead means every GameService for the
// same key reuses the one resolved model instead of re-querying ListModels
// (and risking a different pick) partway through a single playthrough.
const modelCache = new Map<string, Promise<string>>();

export function getOrSelectModel(apiKey: string): Promise<string> {
  let cached = modelCache.get(apiKey);
  if (cached === undefined) {
    cached = selectModel(apiKey);
    modelCache.set(apiKey, cached);
  }
  return cached;
}

// Test-only: clears the module-scoped cache so tests reusing the same
// literal API key don't leak a resolved model between cases.
export function clearModelCache(): void {
  modelCache.clear();
}
