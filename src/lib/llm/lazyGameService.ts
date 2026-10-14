import type { CaseSource } from '../caseSource';

// The generation pipeline — seven stages of prompts, response schemas and
// repair logic — is only ever needed by a player who brought a key. Importing
// it statically put all of it in the bundle every demo player downloads. This
// is the same CaseSource, loaded on first use: the module is fetched when the
// first generateCase/generateAftermath call is made, and never for a player
// who only plays the docket.
//
// A failed load (offline, a stale deploy) rejects that call like any other
// generation failure, and is not cached — the next attempt fetches again.
export function createLazyGameService(apiKey: string): CaseSource {
  let service: Promise<CaseSource> | null = null;
  const load = (): Promise<CaseSource> => {
    service ??= import('./gameService')
      .then(({ createGameService }) => createGameService(apiKey))
      .catch((err: unknown) => {
        service = null;
        throw err;
      });
    return service;
  };

  return {
    generateCase: async (options) => (await load()).generateCase(options),
    generateAftermath: async (ctx) => (await load()).generateAftermath(ctx),
  };
}
