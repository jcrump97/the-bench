import { describe, it, expect } from 'vitest';
import { selectModel } from '../../modelSelection';
import { LIVE_API_KEY } from './liveEnv';

describe.skipIf(LIVE_API_KEY === null)('selectModel (live)', () => {
  it('discovers a real flash-tier model for this key', async () => {
    const model = await selectModel(LIVE_API_KEY as string);
    expect(model).toMatch(/flash/i);
    expect(model).not.toMatch(/pro|ultra|embedding|vision/i);
  });
});
