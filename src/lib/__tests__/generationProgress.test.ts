import { describe, it, expect } from 'vitest';
import {
  GENERATION_STEPS,
  applyGenerationProgress,
  initialGenerationProgress,
} from '../generationProgress';

describe('generation progress', () => {
  it('starts every step pending', () => {
    const progress = initialGenerationProgress();
    expect(Object.keys(progress)).toEqual(GENERATION_STEPS.map((step) => step.id));
    expect(Object.values(progress).every((step) => step.status === 'PENDING')).toBe(true);
  });

  it('declares each step once', () => {
    const ids = GENERATION_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The panel teaches the architecture's split, so the labels must be true to
  // it: a step is a model call only where the model writes the output.
  // FINALIZE is one (it always writes the summary, statement of facts and
  // closings); model selection is not (code ranks what ListModels reports).
  it('labels as model calls exactly the steps where the model writes', () => {
    const modelCalls = GENERATION_STEPS.filter((step) => step.kind === 'MODEL').map((step) => step.id);
    expect(modelCalls).toEqual([
      'STATUTES',
      'SCENE',
      'DEFENDANT',
      'INTERROGATION',
      'EVIDENCE',
      'VERDICT_VOICE',
      'FINALIZE',
      'PLEA_NARRATIVE',
    ]);
  });

  it('records when a step started and when it finished', () => {
    let progress = initialGenerationProgress();
    progress = applyGenerationProgress(progress, { stepId: 'SCENE', status: 'STARTED', at: 100 });
    expect(progress.SCENE).toEqual({ status: 'RUNNING', startedAt: 100, finishedAt: null });

    progress = applyGenerationProgress(progress, { stepId: 'SCENE', status: 'DONE', at: 350 });
    expect(progress.SCENE).toEqual({ status: 'DONE', startedAt: 100, finishedAt: 350 });
  });

  it('marks a skipped step finished without ever running it', () => {
    const progress = applyGenerationProgress(initialGenerationProgress(), {
      stepId: 'INTERROGATION',
      status: 'SKIPPED',
      at: 500,
    });
    expect(progress.INTERROGATION).toEqual({ status: 'SKIPPED', startedAt: 500, finishedAt: 500 });
  });

  it('never moves a finished step back to running', () => {
    let progress = initialGenerationProgress();
    progress = applyGenerationProgress(progress, { stepId: 'EVIDENCE', status: 'STARTED', at: 1 });
    progress = applyGenerationProgress(progress, { stepId: 'EVIDENCE', status: 'DONE', at: 2 });
    const late = applyGenerationProgress(progress, { stepId: 'EVIDENCE', status: 'STARTED', at: 3 });
    expect(late).toBe(progress);
  });

  it('leaves every other step untouched', () => {
    const before = initialGenerationProgress();
    const after = applyGenerationProgress(before, { stepId: 'STATUTES', status: 'STARTED', at: 1 });
    expect(after.DEFENDANT).toBe(before.DEFENDANT);
  });
});
