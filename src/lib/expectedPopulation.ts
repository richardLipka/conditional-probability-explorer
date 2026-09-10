/*
 * Conditional Probability Explorer - deterministic population at expected counts
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { expectedCounts } from './probability';
import type { SimulationResult } from './simulation';
import type { ModelParams } from './types';

/**
 * A deterministic "population" whose composition matches the expected counts
 * exactly, laid out in blocks. Shown side by side with the random run so the
 * difference between an expectation and a draw is visible, not just asserted.
 */
export function buildExpectedPopulation(params: ModelParams): SimulationResult {
  const c = expectedCounts(params);
  const n = params.populationSize;
  const condition = new Uint8Array(n);
  const test1 = new Uint8Array(n);
  const test2 = new Uint8Array(n);

  const blocks: [number, 1 | 0, 1 | 0, 0 | 1 | 2][] = [
    [Math.round(c.tp1), 1, 1, params.confirmatory ? 2 : 0],
    [Math.round(c.fn1), 1, 0, 0],
    [Math.round(c.fp1), 0, 1, params.confirmatory ? 2 : 0],
    [Math.round(c.tn1), 0, 0, 0],
  ];
  // The confirmatory stage splits the two positive blocks again.
  if (params.confirmatory) {
    blocks[0] = [Math.round(c.tp2), 1, 1, 2];
    blocks.splice(1, 0, [Math.round(c.fn2), 1, 1, 1]);
    const fpIdx = blocks.findIndex((b) => b[1] === 0 && b[2] === 1);
    blocks[fpIdx] = [Math.round(c.fp2), 0, 1, 2];
    blocks.splice(fpIdx + 1, 0, [Math.round(c.tn2), 0, 1, 1]);
  }

  let i = 0;
  for (const [count, cond, t1, t2] of blocks) {
    for (let k = 0; k < count && i < n; k++, i++) {
      condition[i] = cond;
      test1[i] = t1;
      test2[i] = t2;
    }
  }
  for (; i < n; i++) {
    condition[i] = 0;
    test1[i] = 0;
    test2[i] = 0;
  }

  return {
    seed: -1,
    size: n,
    condition,
    test1,
    test2,
    counts: {
      population: n,
      withCondition: c.withCondition,
      withoutCondition: c.withoutCondition,
      tp1: c.tp1,
      fp1: c.fp1,
      tn1: c.tn1,
      fn1: c.fn1,
      positive1: c.positive1,
      negative1: c.negative1,
      tp2: c.tp2,
      fp2: c.fp2,
      tn2: c.tn2,
      fn2: c.fn2,
      positive2: c.positive2,
      negative2: c.negative2,
    },
  };
}
