/*
 * Conditional Probability Explorer - end-to-end verification of the model
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { describe, it, expect } from 'vitest';
import {
  computeModel,
  expectedCounts,
  effectiveSecondTest,
  negativeGroups,
  positiveLikelihoodRatio,
} from './probability';
import { runSimulation } from './simulation';
import { scenarios } from '../presets';
import type { ModelParams } from './types';

/**
 * These tests check the closed-form model against two independent references:
 * a brute-force enumeration of the sample space, and a large Monte Carlo run.
 * If the analytic formulas and the simulation ever drift apart, the app would
 * be teaching two different things at once, so this is the safety net.
 */

const P = (over: Partial<ModelParams> = {}): ModelParams => ({
  prevalence: 0.01,
  test1: { sensitivity: 0.9, specificity: 0.95 },
  test2: { sensitivity: 0.85, specificity: 0.99 },
  confirmatory: true,
  populationSize: 10000,
  dependence: 0,
  ...over,
});

/**
 * Brute-force joint distribution over (condition, test 1, test 2), built from
 * first principles rather than from any formula the app uses.
 */
function enumerate(p: ModelParams) {
  const se1 = p.test1.sensitivity;
  const sp1 = p.test1.specificity;
  const e2 = effectiveSecondTest(p);
  const cells: Record<string, number> = {};
  const add = (k: string, v: number) => (cells[k] = (cells[k] ?? 0) + v);

  for (const d of [true, false]) {
    const pd = d ? p.prevalence : 1 - p.prevalence;
    for (const t1 of [true, false]) {
      const pt1 = d ? (t1 ? se1 : 1 - se1) : t1 ? 1 - sp1 : sp1;
      if (!p.confirmatory || !t1) {
        add(`${d ? 'D' : 'H'}${t1 ? '+' : '-'}.`, pd * pt1);
        continue;
      }
      for (const t2 of [true, false]) {
        const pt2 = d
          ? t2
            ? e2.sensitivity
            : 1 - e2.sensitivity
          : t2
            ? 1 - e2.specificity
            : e2.specificity;
        add(`${d ? 'D' : 'H'}+${t2 ? '+' : '-'}`, pd * pt1 * pt2);
      }
    }
  }
  return cells;
}

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe('closed form against brute-force enumeration', () => {
  const cases: [string, ModelParams][] = [
    ['typical', P()],
    ['rare disease', P({ prevalence: 0.001, test1: { sensitivity: 0.99, specificity: 0.99 } })],
    ['common', P({ prevalence: 0.3 })],
    ['single test', P({ confirmatory: false })],
    ['dependent tests', P({ dependence: 0.6 })],
    ['fully dependent', P({ dependence: 1 })],
    ['perfect test', P({ test1: { sensitivity: 1, specificity: 1 } })],
    ['useless test', P({ test1: { sensitivity: 0, specificity: 1 } })],
  ];

  for (const [name, params] of cases) {
    it(`${name}: the sample space is complete`, () => {
      expect(sum(enumerate(params))).toBeCloseTo(1, 12);
    });

    it(`${name}: P(D | +₁) matches enumeration`, () => {
      const c = enumerate(params);
      const dPos = (c['D+.'] ?? 0) + (c['D++'] ?? 0) + (c['D+-'] ?? 0);
      const hPos = (c['H+.'] ?? 0) + (c['H++'] ?? 0) + (c['H+-'] ?? 0);
      const expected = dPos + hPos === 0 ? 0 : dPos / (dPos + hPos);
      expect(computeModel(params).ppv1).toBeCloseTo(expected, 12);
    });

    it(`${name}: every negative group matches enumeration`, () => {
      const c = enumerate(params);
      const m = computeModel(params);
      const stage1Missed = (c['D-.'] ?? 0) + (c['D--'] ?? 0) + (c['D-+'] ?? 0);
      const stage1Clear = (c['H-.'] ?? 0) + (c['H--'] ?? 0) + (c['H-+'] ?? 0);
      expect(m.negatives.stage1.missed).toBeCloseTo(stage1Missed, 12);
      expect(m.negatives.stage1.clear).toBeCloseTo(stage1Clear, 12);
      if (params.confirmatory) {
        expect(m.negatives.stage2!.missed).toBeCloseTo(c['D+-'] ?? 0, 12);
        expect(m.negatives.stage2!.clear).toBeCloseTo(c['H+-'] ?? 0, 12);
      }
    });
  }

  it('P(D | +₁ ∩ +₂) matches enumeration', () => {
    for (const [, params] of cases.filter(([, p]) => p.confirmatory)) {
      const c = enumerate(params);
      const num = c['D++'] ?? 0;
      const den = num + (c['H++'] ?? 0);
      const expected = den === 0 ? 0 : num / den;
      expect(computeModel(params).ppv2!).toBeCloseTo(expected, 12);
    }
  });

  it('P(D | +₁ ∩ −₂) — the group test 2 cleared — matches enumeration', () => {
    const params = P();
    const c = enumerate(params);
    const expected = (c['D+-'] ?? 0) / ((c['D+-'] ?? 0) + (c['H+-'] ?? 0));
    expect(computeModel(params).negatives.stage2!.missRate).toBeCloseTo(expected, 12);
  });
});

describe('published worked examples', () => {
  /**
   * Czech secondary-school textbook, Podmíněná pravděpodobnost:
   * https://publi.cz/books/201/13.html
   *
   * "Počáteční stadium rakoviny se vyskytuje u 3 z tisíce lidí. Pouze 5 %
   * zdravých má tento test pozitivní a pouze 2 % nemocných má výsledek
   * negativní. Kolik procent z těch, kteří mají výsledek pozitivní, má
   * rakovinu?" — the book works it out as 0,00294 / 0,05279 = 5,6 %.
   */
  it('reproduces the publi.cz cancer-screening example to the last digit', () => {
    const p = P({
      prevalence: 0.003,
      test1: { sensitivity: 0.98, specificity: 0.95 },
      confirmatory: false,
    });
    const m = computeModel(p);
    expect(m.stage1.tp).toBeCloseTo(0.00294, 12);
    expect(m.stage1.fp).toBeCloseTo(0.04985, 12);
    expect(m.stage1.pPositive).toBeCloseTo(0.05279, 12);
    expect(m.ppv1).toBeCloseTo(0.00294 / 0.05279, 12);
    expect((m.ppv1 * 100).toFixed(1)).toBe('5.6');
  });

  it('agrees with the same example run as a simulation', () => {
    const p = P({
      prevalence: 0.003,
      test1: { sensitivity: 0.98, specificity: 0.95 },
      confirmatory: false,
      populationSize: 400000,
    });
    const { counts } = runSimulation(p, 20260921);
    expect(Math.abs(counts.tp1 / counts.positive1 - 0.055692)).toBeLessThan(0.005);
  });
});

describe('the dependence model', () => {
  it('at ρ = 0 the second test is exactly the one that was configured', () => {
    const p = P({ dependence: 0 });
    expect(effectiveSecondTest(p)).toEqual(p.test2);
  });

  it('at ρ = 1 a second positive carries no information at all', () => {
    const p = P({ dependence: 1 });
    const e = effectiveSecondTest(p);
    expect(positiveLikelihoodRatio(e)).toBeCloseTo(1, 12);
    const m = computeModel(p);
    expect(m.ppv2!).toBeCloseTo(m.ppv1, 12);
  });

  it('shared failure modes eat the benefit of confirming, monotonically', () => {
    const ppvs = [0, 0.25, 0.5, 0.75, 1].map((d) => computeModel(P({ dependence: d })).ppv2!);
    for (let i = 1; i < ppvs.length; i++) expect(ppvs[i]).toBeLessThan(ppvs[i - 1]);
    expect(ppvs[ppvs.length - 1]).toBeCloseTo(computeModel(P()).ppv1, 12);
  });

  it('dependence never invents cases the first test already missed', () => {
    for (const d of [0, 0.5, 1]) {
      const m = computeModel(P({ dependence: d }));
      expect(m.negatives.stage1.missed).toBeCloseTo(computeModel(P()).negatives.stage1.missed, 12);
    }
  });

  it('a fully dependent second test clears nobody it should have kept', () => {
    // If test 2 always echoes test 1, everyone positive on test 1 stays positive.
    const m = computeModel(P({ dependence: 1 }));
    expect(m.negatives.stage2!.total).toBeCloseTo(0, 12);
  });
});

describe('Monte Carlo agrees with the closed form', () => {
  const N = 400000;

  const cases: [string, ModelParams][] = [
    ['independent chain', P({ populationSize: N })],
    ['dependent chain', P({ populationSize: N, dependence: 0.5 })],
    ['single test', P({ populationSize: N, confirmatory: false })],
    ['rare condition', P({ populationSize: N, prevalence: 0.002 })],
  ];

  for (const [name, params] of cases) {
    it(`${name}: observed cell frequencies match the model`, () => {
      const { counts } = runSimulation(params, 987654321);
      const m = computeModel(params);
      const n = params.populationSize;
      // Three standard errors of a proportion at this sample size.
      const tol = 3 / Math.sqrt(n) + 1e-3;

      expect(counts.tp1 / n).toBeCloseTo(m.stage1.tp, 2);
      expect(counts.fp1 / n).toBeCloseTo(m.stage1.fp, 2);
      expect(counts.fn1 / n).toBeCloseTo(m.stage1.fn, 2);
      expect(counts.tn1 / n).toBeCloseTo(m.stage1.tn, 2);
      expect(Math.abs(counts.tp1 / counts.positive1 - m.ppv1)).toBeLessThan(tol * 10);
    });

    it(`${name}: the negative groups match the model`, () => {
      const { counts } = runSimulation(params, 13579);
      const g = negativeGroups(counts, params.confirmatory);
      const m = computeModel(params);
      expect(Math.abs(g.combined.missRate - m.negatives.combined.missRate)).toBeLessThan(0.005);
      expect(g.cases.found + g.cases.missedAt1 + g.cases.missedAt2).toBe(counts.withCondition);
    });
  }

  it('the two-stage posterior converges to theory', () => {
    const params = P({ populationSize: N, prevalence: 0.01 });
    const { counts } = runSimulation(params, 24680);
    const observed = counts.tp2 / counts.positive2;
    expect(Math.abs(observed - computeModel(params).ppv2!)).toBeLessThan(0.02);
  });
});

describe('every bundled scenario is internally consistent', () => {
  for (const s of scenarios) {
    it(`${s.id}: counts add up and probabilities stay in range`, () => {
      const m = computeModel(s.params);
      const c = expectedCounts(s.params);

      expect(c.tp1 + c.fp1 + c.tn1 + c.fn1).toBeCloseTo(s.params.populationSize, 6);
      for (const v of [m.ppv1, m.stage1.npv, m.stage1.accuracy, m.negatives.combined.npv]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      if (m.ppv2 !== null) {
        expect(m.ppv2).toBeGreaterThanOrEqual(0);
        expect(m.ppv2).toBeLessThanOrEqual(1);
      }
      expect(Number.isNaN(m.ppv1)).toBe(false);
    });

    it(`${s.id}: a simulated run reproduces the expected composition`, () => {
      const params = { ...s.params, populationSize: 50000 };
      const { counts } = runSimulation(params, 4242);
      const m = computeModel(params);
      expect(Math.abs(counts.tp1 / 50000 - m.stage1.tp)).toBeLessThan(0.01);
      expect(Math.abs(counts.fp1 / 50000 - m.stage1.fp)).toBeLessThan(0.01);
      expect(counts.positive1).toBe(counts.tp1 + counts.fp1);
    });
  }
});
