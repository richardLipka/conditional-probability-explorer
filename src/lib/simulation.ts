/*
 * Conditional Probability Explorer - seeded random population and testing pipeline
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import type { ModelParams } from './types';
import { effectiveSecondTest } from './probability';

/** mulberry32 — small, fast, seedable PRNG. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Per-individual record, packed into parallel typed arrays for speed. */
export interface SimulationResult {
  seed: number;
  size: number;
  /** 1 = condition actually present */
  condition: Uint8Array;
  /** 1 = test 1 positive */
  test1: Uint8Array;
  /** 0 = not tested, 1 = test 2 negative, 2 = test 2 positive */
  test2: Uint8Array;
  counts: SimulationCounts;
}

export interface SimulationCounts {
  population: number;
  withCondition: number;
  withoutCondition: number;
  tp1: number;
  fp1: number;
  tn1: number;
  fn1: number;
  positive1: number;
  negative1: number;
  tp2: number;
  fp2: number;
  tn2: number;
  fn2: number;
  positive2: number;
  negative2: number;
}

export function emptyCounts(population = 0): SimulationCounts {
  return {
    population,
    withCondition: 0,
    withoutCondition: 0,
    tp1: 0,
    fp1: 0,
    tn1: 0,
    fn1: 0,
    positive1: 0,
    negative1: 0,
    tp2: 0,
    fp2: 0,
    tn2: 0,
    fn2: 0,
    positive2: 0,
    negative2: 0,
  };
}

/**
 * Draw an actual random population and run the testing pipeline on it.
 * Every individual is sampled independently:
 *   1. condition ~ Bernoulli(prevalence)
 *   2. test 1 ~ Bernoulli(sensitivity) if condition, Bernoulli(1 − specificity) otherwise
 *   3. test 2 (only when test 1 was positive and confirmatory testing is on)
 */
export function runSimulation(params: ModelParams, seed: number): SimulationResult {
  return simulate(params, seed, true);
}

/**
 * The same draw, without the per-person arrays.
 *
 * Repeating a run a hundred times to show how much the answer wobbles means a
 * hundred allocations of three typed arrays that nobody reads. The counts are
 * all that picture needs.
 */
export function simulateCounts(params: ModelParams, seed: number): SimulationCounts {
  return simulate(params, seed, false).counts;
}

function simulate(params: ModelParams, seed: number, keep: boolean): SimulationResult {
  const n = Math.max(0, Math.floor(params.populationSize));
  const rng = makeRng(seed);
  // Length zero when the individuals are not wanted. The draw itself is
  // untouched: every rng() call happens in the same order either way, so the
  // same seed gives the same counts whichever path is taken.
  const size = keep ? n : 0;
  const condition = new Uint8Array(size);
  const test1 = new Uint8Array(size);
  const test2 = new Uint8Array(size);
  const c = emptyCounts(n);

  const { prevalence, confirmatory } = params;
  const se1 = params.test1.sensitivity;
  const fpr1 = 1 - params.test1.specificity;
  // Test 2 as it behaves on the people it is actually given, which includes
  // however much it simply echoes test 1.
  const applied2 = effectiveSecondTest(params);
  const se2 = applied2.sensitivity;
  const fpr2 = 1 - applied2.specificity;

  for (let i = 0; i < n; i++) {
    const hasCond = rng() < prevalence;
    if (keep) condition[i] = hasCond ? 1 : 0;
    if (hasCond) c.withCondition++;
    else c.withoutCondition++;

    const pos1 = rng() < (hasCond ? se1 : fpr1);
    if (keep) test1[i] = pos1 ? 1 : 0;

    if (pos1) {
      c.positive1++;
      if (hasCond) c.tp1++;
      else c.fp1++;
    } else {
      c.negative1++;
      if (hasCond) c.fn1++;
      else c.tn1++;
    }

    if (confirmatory && pos1) {
      const pos2 = rng() < (hasCond ? se2 : fpr2);
      if (keep) test2[i] = pos2 ? 2 : 1;
      if (pos2) {
        c.positive2++;
        if (hasCond) c.tp2++;
        else c.fp2++;
      } else {
        c.negative2++;
        if (hasCond) c.fn2++;
        else c.tn2++;
      }
    }
  }

  return { seed, size: n, condition, test1, test2, counts: c };
}

/** Observed P(D | +₁) from a simulation run. */
export function observedPpv1(c: SimulationCounts): number | null {
  return c.positive1 === 0 ? null : c.tp1 / c.positive1;
}

/** Observed P(D | +₁ ∩ +₂). */
export function observedPpv2(c: SimulationCounts): number | null {
  return c.positive2 === 0 ? null : c.tp2 / c.positive2;
}
