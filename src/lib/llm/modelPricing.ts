// The Gemini API's ListModels response carries capabilities and token limits
// but no prices: none of its fields (name, baseModelId, version, displayName,
// description, inputTokenLimit, outputTokenLimit, supportedGenerationMethods,
// thinking, temperature, maxTemperature, topP, topK) says what a call costs.
// Prices live only on Google's documentation pages, and this app cannot read
// those at runtime: it has no backend, the pages are HTML, and the production
// CSP allows network requests to this origin and the Gemini API host only.
//
// So cost is this table, maintained by hand. It is data, not a name pin: the
// selector still chooses only among models ListModels says this key can call,
// and a model missing from the table is still usable, just ranked below every
// priced one. Each entry carries the dates that make a price go stale on its
// own (a price that changes on a set day, a shutdown date), so the table
// stays correct between edits rather than only on the day it was written.
//
// Update it when Google's pricing or deprecation pages change, and move
// PRICE_TABLE_AS_OF with it.

export const PRICE_TABLE_AS_OF = '2026-11-26';

export interface PricePeriod {
  // First UTC day this price applies (YYYY-MM-DD). It runs until the next
  // period's start.
  from: string;
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
}

export interface PricedModel {
  // Exactly as ListModels names it, without the "models/" prefix.
  id: string;
  // Release day of this model (YYYY-MM-DD). Among models priced close to the
  // cheapest, the newest wins.
  released: string;
  // Earliest shutdown day Google has announced, or null when none is. A model
  // is not chosen on or after this day, even if ListModels still lists it: a
  // live run once picked a retired build that ListModels kept listing.
  shutdown: string | null;
  // Oldest first.
  prices: readonly PricePeriod[];
  source: string;
}

// Stable text models whose documentation lists structured-output support,
// which every pipeline stage needs. ListModels does not report that
// capability either, so admission to this table is where it is checked.
// Google's 2.5 models are left out on purpose: its models page calls them
// legacy, open only to keys that used them before, so a key that ListModels
// still shows them to falls back to them unpriced rather than having them
// ranked as the cheapest current choice.
export const PRICED_MODELS: readonly PricedModel[] = [
  {
    id: 'gemini-3.5-flash-lite',
    released: '2026-07-21',
    shutdown: null,
    prices: [{ from: '2026-07-21', inputPerMillionTokens: 0.3, outputPerMillionTokens: 2.5 }],
    source: 'https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.6',
  },
  {
    id: 'gemini-3.1-flash-lite',
    released: '2026-05-07',
    shutdown: '2027-05-07',
    prices: [{ from: '2026-05-07', inputPerMillionTokens: 0.25, outputPerMillionTokens: 1.5 }],
    source: 'https://ai.google.dev/gemini-api/docs/pricing',
  },
  {
    id: 'gemini-3.6-flash',
    released: '2026-07-21',
    shutdown: null,
    prices: [{ from: '2026-07-21', inputPerMillionTokens: 1.5, outputPerMillionTokens: 7.5 }],
    source: 'https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.6',
  },
  {
    id: 'gemini-3.8-flash',
    released: '2026-09-02',
    shutdown: null,
    prices: [
      // Introductory price through 2026-12-31.
      { from: '2026-09-02', inputPerMillionTokens: 0.75, outputPerMillionTokens: 3.75 },
      { from: '2027-01-01', inputPerMillionTokens: 1.5, outputPerMillionTokens: 7.5 },
    ],
    source: 'https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.8',
  },
];

// The pipeline's measured token mix for one generated case (paced 10-case
// sweep, 2026-10-14: about 4.3K input and 5.6K output tokens). Comparing on
// this mix rather than on input or output price alone matters, because the
// pipeline writes more than it reads: a model with cheap input and dear
// output is not cheap here.
export const PIPELINE_TOKENS_PER_CASE = { input: 4_300, output: 5_600 } as const;

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// The price in effect on `now`'s UTC day, or null when the model is not live
// that day (not yet released, already shut down, or no period has started).
export function priceOn(model: PricedModel, now: Date): PricePeriod | null {
  const day = utcDay(now);
  if (day < model.released) return null;
  if (model.shutdown !== null && day >= model.shutdown) return null;
  let current: PricePeriod | null = null;
  for (const period of model.prices) {
    if (period.from <= day) current = period;
  }
  return current;
}

// Dollars for one generated case at this price, on the measured token mix.
// Thinking tokens are billed as output and are not in the measured mix, so
// this is a ranking figure, not a bill.
export function costPerCase(price: PricePeriod): number {
  return (
    (PIPELINE_TOKENS_PER_CASE.input * price.inputPerMillionTokens +
      PIPELINE_TOKENS_PER_CASE.output * price.outputPerMillionTokens) /
    1_000_000
  );
}

export function findPricedModel(id: string): PricedModel | undefined {
  return PRICED_MODELS.find((m) => m.id === id);
}
