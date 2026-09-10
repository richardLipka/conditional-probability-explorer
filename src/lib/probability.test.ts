import { describe, it, expect } from 'vitest';
import {
  singleStage,
  computeModel,
  negativeGroups,
  expectedCounts,
  positiveLikelihoodRatio,
  negativeLikelihoodRatio,
  oneInN,
  safeDiv,
} from './probability';
import { runSimulation, observedPpv1, observedPpv2, makeRng } from './simulation';
import type { ModelParams } from './types';

const params = (over: Partial<ModelParams> = {}): ModelParams => ({
  prevalence: 0.001,
  test1: { sensitivity: 0.99, specificity: 0.99 },
  test2: { sensitivity: 0.99, specificity: 0.999 },
  confirmatory: false,
  populationSize: 10000,
  dependence: 0,
  ...over,
});

describe('singleStage', () => {
  it('partitions the population into four cells summing to 1', () => {
    const s = singleStage(0.3, { sensitivity: 0.8, specificity: 0.7 });
    expect(s.tp + s.fp + s.tn + s.fn).toBeCloseTo(1, 12);
  });

  it('matches the textbook rare-disease example', () => {
    // 0.1% prevalence, 99% sensitivity, 99% specificity
    const s = singleStage(0.001, { sensitivity: 0.99, specificity: 0.99 });
    expect(s.tp).toBeCloseTo(0.00099, 12);
    expect(s.fp).toBeCloseTo(0.00999, 12);
    // P(D|+) = 0.00099 / 0.01098 = 9.02%
    expect(s.ppv).toBeCloseTo(0.00099 / 0.01098, 12);
    expect(s.ppv).toBeCloseTo(0.0901639, 6);
  });

  it('P(+|D) and P(D|+) are genuinely different quantities', () => {
    const test = { sensitivity: 0.99, specificity: 0.99 };
    const s = singleStage(0.001, test);
    expect(test.sensitivity).toBeCloseTo(0.99, 12);
    expect(s.ppv).toBeLessThan(0.1);
  });

  it('is Bayes-consistent with the explicit formula', () => {
    const p = 0.037;
    const se = 0.83;
    const sp = 0.915;
    const s = singleStage(p, { sensitivity: se, specificity: sp });
    const expected = (se * p) / (se * p + (1 - sp) * (1 - p));
    expect(s.ppv).toBeCloseTo(expected, 12);
  });

  it('fdr is the complement of ppv', () => {
    const s = singleStage(0.2, { sensitivity: 0.9, specificity: 0.8 });
    expect(s.ppv + s.fdr).toBeCloseTo(1, 12);
  });

  it('gives a perfect test a PPV of 1', () => {
    const s = singleStage(0.01, { sensitivity: 1, specificity: 1 });
    expect(s.ppv).toBe(1);
    expect(s.npv).toBe(1);
  });

  it('gives an uninformative test a PPV equal to the prevalence', () => {
    // specificity = 1 - sensitivity means the positive likelihood ratio is 1
    const s = singleStage(0.25, { sensitivity: 0.6, specificity: 0.4 });
    expect(s.ppv).toBeCloseTo(0.25, 12);
    expect(positiveLikelihoodRatio({ sensitivity: 0.6, specificity: 0.4 })).toBeCloseTo(1, 12);
  });

  it('PPV decreases monotonically as prevalence falls', () => {
    const t = { sensitivity: 0.95, specificity: 0.98 };
    const ppvs = [0.5, 0.1, 0.01, 0.001, 0.0001].map((p) => singleStage(p, t).ppv);
    for (let i = 1; i < ppvs.length; i++) expect(ppvs[i]).toBeLessThan(ppvs[i - 1]);
  });

  it('handles the degenerate zero-prevalence case without NaN', () => {
    const s = singleStage(0, { sensitivity: 0.99, specificity: 0.99 });
    expect(s.ppv).toBe(0);
    expect(Number.isNaN(s.ppv)).toBe(false);
  });

  it('clamps out-of-range inputs', () => {
    const s = singleStage(1.5, { sensitivity: 2, specificity: -1 });
    expect(s.tp + s.fp + s.tn + s.fn).toBeCloseTo(1, 12);
  });
});

describe('computeModel - two-stage confirmatory testing', () => {
  it('returns no second stage when confirmatory testing is off', () => {
    const m = computeModel(params());
    expect(m.stage2).toBeNull();
    expect(m.ppv2).toBeNull();
    expect(m.pBothPositive).toBeNull();
  });

  it('computes the two-stage posterior by the conditional-independence formula', () => {
    const p = params({
      confirmatory: true,
      prevalence: 0.001,
      test1: { sensitivity: 0.95, specificity: 0.98 },
      test2: { sensitivity: 0.99, specificity: 0.999 },
    });
    const m = computeModel(p);
    const num = 0.001 * 0.95 * 0.99;
    const den = num + 0.999 * 0.02 * 0.001;
    expect(m.ppv2).toBeCloseTo(num / den, 12);
  });

  it('a second positive test raises the posterior above the first', () => {
    const m = computeModel(params({ confirmatory: true, prevalence: 0.002 }));
    expect(m.ppv2!).toBeGreaterThan(m.ppv1);
  });

  it('sequential updating equals one-shot Bayes with the product likelihood ratio', () => {
    const pr = 0.004;
    const t1 = { sensitivity: 0.9, specificity: 0.95 };
    const t2 = { sensitivity: 0.85, specificity: 0.99 };
    const m = computeModel(params({ prevalence: pr, test1: t1, test2: t2, confirmatory: true }));
    const oddsPrior = pr / (1 - pr);
    const lr = positiveLikelihoodRatio(t1) * positiveLikelihoodRatio(t2);
    const post = (oddsPrior * lr) / (1 + oddsPrior * lr);
    expect(m.ppv2).toBeCloseTo(post, 12);
  });

  it('the joint positive probability factorises correctly', () => {
    const m = computeModel(params({ confirmatory: true, prevalence: 0.05 }));
    expect(m.pBothPositive).toBeCloseTo(m.stage1.pPositive * m.pPositive2GivenPositive1!, 12);
  });

  it('the joint positive probability also equals the direct marginal', () => {
    const pr = 0.05;
    const t1 = { sensitivity: 0.99, specificity: 0.99 };
    const t2 = { sensitivity: 0.99, specificity: 0.999 };
    const m = computeModel(params({ prevalence: pr, test1: t1, test2: t2, confirmatory: true }));
    const direct =
      pr * t1.sensitivity * t2.sensitivity +
      (1 - pr) * (1 - t1.specificity) * (1 - t2.specificity);
    expect(m.pBothPositive).toBeCloseTo(direct, 12);
  });

  it('order of the two tests does not change the final posterior', () => {
    const t1 = { sensitivity: 0.9, specificity: 0.95 };
    const t2 = { sensitivity: 0.8, specificity: 0.999 };
    const a = computeModel(params({ prevalence: 0.01, test1: t1, test2: t2, confirmatory: true }));
    const b = computeModel(params({ prevalence: 0.01, test1: t2, test2: t1, confirmatory: true }));
    expect(a.ppv2).toBeCloseTo(b.ppv2!, 12);
  });
});

describe('the negative side of a chain', () => {
  const chained = params({
    confirmatory: true,
    prevalence: 0.01,
    test1: { sensitivity: 0.95, specificity: 0.98 },
    test2: { sensitivity: 0.9, specificity: 0.999 },
  });

  it('splits the negatives into the two places they come from', () => {
    const m = computeModel(chained);
    const g = m.negatives;
    expect(g.stage2).not.toBeNull();
    expect(g.combined.total).toBeCloseTo(g.stage1.total + g.stage2!.total, 12);
    expect(g.combined.missed).toBeCloseTo(g.stage1.missed + g.stage2!.missed, 12);
  });

  it('accounts for every person: final positives plus every negative is the whole population', () => {
    const m = computeModel(chained);
    expect(m.negatives.combined.total + m.pBothPositive!).toBeCloseTo(1, 12);
  });

  it('accounts for every real case: found, missed at test 1, or cleared by test 2', () => {
    const { cases } = computeModel(chained).negatives;
    expect(cases.found + cases.missedAt1 + cases.missedAt2).toBeCloseTo(cases.total, 12);
    expect(cases.total).toBeCloseTo(chained.prevalence, 12);
  });

  it('a second test creates missed cases that a single test would not have', () => {
    const single = computeModel({ ...chained, confirmatory: false });
    const two = computeModel(chained);
    expect(two.negatives.combined.missed).toBeGreaterThan(single.negatives.combined.missed);
    expect(two.negatives.stage2!.missed).toBeGreaterThan(0);
  });

  it('a perfectly sensitive second test adds no missed cases', () => {
    const m = computeModel({ ...chained, test2: { sensitivity: 1, specificity: 0.999 } });
    expect(m.negatives.stage2!.missed).toBeCloseTo(0, 12);
    expect(m.negatives.combined.missed).toBeCloseTo(m.negatives.stage1.missed, 12);
  });

  it('chain sensitivity is the product of the two sensitivities', () => {
    expect(computeModel(chained).chainSensitivity).toBeCloseTo(0.95 * 0.9, 12);
    const single = computeModel({ ...chained, confirmatory: false });
    expect(single.chainSensitivity).toBeCloseTo(0.95, 12);
  });

  it('the cleared group is a far worse place to be than the test-1 negatives', () => {
    // Everyone cleared by test 2 was flagged by test 1, so the condition is
    // much more common among them than in the untested-again majority.
    const g = computeModel(chained).negatives;
    expect(g.stage2!.missRate).toBeGreaterThan(g.stage1.missRate);
  });

  it('reports no second group when there is no second test', () => {
    const g = computeModel({ ...chained, confirmatory: false }).negatives;
    expect(g.stage2).toBeNull();
    expect(g.combined).toEqual(g.stage1);
    expect(g.cases.missedAt2).toBe(0);
  });

  it('works on plain counts as well as probabilities', () => {
    const g = negativeGroups(
      { withCondition: 100, tp1: 90, fp1: 200, tn1: 9700, fn1: 10, tp2: 81, fp2: 2, tn2: 198, fn2: 9 },
      true,
    );
    expect(g.combined.total).toBe(9700 + 198 + 10 + 9);
    expect(g.combined.missed).toBe(19);
    expect(g.cases.found + g.cases.missedAt1 + g.cases.missedAt2).toBe(100);
    expect(g.stage1.npv).toBeCloseTo(9700 / 9710, 12);
  });

  it('does not divide by zero on an empty group', () => {
    const g = negativeGroups(
      { withCondition: 0, tp1: 0, fp1: 0, tn1: 0, fn1: 0, tp2: 0, fp2: 0, tn2: 0, fn2: 0 },
      true,
    );
    expect(g.combined.npv).toBe(0);
    expect(Number.isNaN(g.stage2!.missRate)).toBe(false);
  });
});

describe('expectedCounts', () => {
  it('conserves the population across the first split', () => {
    const c = expectedCounts(params({ populationSize: 10000, prevalence: 0.01 }));
    expect(c.tp1 + c.fp1 + c.tn1 + c.fn1).toBeCloseTo(10000, 9);
    expect(c.positive1 + c.negative1).toBeCloseTo(10000, 9);
  });

  it('the second stage conserves the positives of the first', () => {
    const c = expectedCounts(
      params({ confirmatory: true, populationSize: 10000, prevalence: 0.01 }),
    );
    expect(c.tp2 + c.fp2 + c.tn2 + c.fn2).toBeCloseTo(c.positive1, 9);
  });

  it('reproduces the classic 10,000-person natural-frequency picture', () => {
    const c = expectedCounts(params({ populationSize: 10000, prevalence: 0.001 }));
    expect(c.withCondition).toBeCloseTo(10, 9);
    expect(c.tp1).toBeCloseTo(9.9, 9);
    expect(c.fp1).toBeCloseTo(99.9, 9);
  });
});

describe('helpers', () => {
  it('safeDiv avoids division by zero', () => {
    expect(safeDiv(1, 0)).toBe(0);
    expect(safeDiv(1, 4)).toBe(0.25);
  });

  it('oneInN inverts a probability', () => {
    expect(oneInN(0.001)).toBe(1000);
    expect(oneInN(0)).toBe(Infinity);
  });

  it('negative likelihood ratio is defined as (1-se)/sp', () => {
    expect(negativeLikelihoodRatio({ sensitivity: 0.9, specificity: 0.8 })).toBeCloseTo(0.125, 12);
  });
});

describe('simulation', () => {
  it('is deterministic for a fixed seed and varies across seeds', () => {
    const p = params({ populationSize: 2000, prevalence: 0.05 });
    const a = runSimulation(p, 42);
    const b = runSimulation(p, 42);
    const c = runSimulation(p, 43);
    expect(a.counts).toEqual(b.counts);
    expect(a.counts.tp1 === c.counts.tp1 && a.counts.fp1 === c.counts.fp1).toBe(false);
  });

  it('keeps the bookkeeping consistent', () => {
    const p = params({ populationSize: 5000, prevalence: 0.02, confirmatory: true });
    const { counts: c } = runSimulation(p, 7);
    expect(c.withCondition + c.withoutCondition).toBe(5000);
    expect(c.tp1 + c.fp1 + c.tn1 + c.fn1).toBe(5000);
    expect(c.positive1).toBe(c.tp1 + c.fp1);
    expect(c.tp2 + c.fp2 + c.tn2 + c.fn2).toBe(c.positive1);
  });

  it('never runs test 2 on a test-1-negative individual', () => {
    const p = params({ populationSize: 3000, prevalence: 0.1, confirmatory: true });
    const r = runSimulation(p, 11);
    for (let i = 0; i < r.size; i++) {
      if (r.test1[i] === 0) expect(r.test2[i]).toBe(0);
      else expect(r.test2[i]).toBeGreaterThan(0);
    }
  });

  it('converges to the theoretical PPV for a large population', () => {
    const p = params({ populationSize: 400000, prevalence: 0.01 });
    const r = runSimulation(p, 2024);
    const theory = computeModel(p).ppv1;
    expect(Math.abs(observedPpv1(r.counts)! - theory)).toBeLessThan(0.03);
  });

  it('converges to the theoretical two-stage PPV as well', () => {
    const p = params({ populationSize: 400000, prevalence: 0.01, confirmatory: true });
    const r = runSimulation(p, 99);
    const theory = computeModel(p).ppv2!;
    expect(Math.abs(observedPpv2(r.counts)! - theory)).toBeLessThan(0.05);
  });

  it('returns null observed PPV when nobody tested positive', () => {
    const p = params({
      populationSize: 50,
      prevalence: 0,
      test1: { sensitivity: 1, specificity: 1 },
    });
    const r = runSimulation(p, 5);
    expect(observedPpv1(r.counts)).toBeNull();
  });

  it('rng stays inside [0,1)', () => {
    const rng = makeRng(1234);
    for (let i = 0; i < 10000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
