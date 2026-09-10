/*
 * Conditional Probability Explorer - exact probabilities, Bayes and the negative side
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import type { ModelParams, TestParams } from './types';

/**
 * Exact (expected) probabilities for the diagnostic-testing model.
 *
 * Notation:
 *   D   = the condition is actually present
 *   ¬D  = the condition is absent
 *   +   = the test result is positive
 *
 *   prevalence  = P(D)
 *   sensitivity = P(+ | D)
 *   specificity = P(− | ¬D)
 *
 * The two-stage model assumes the two tests are CONDITIONALLY INDEPENDENT
 * given the true condition status.
 */

export interface StageProbabilities {
  /** P(D ∩ + ) — true positive */
  tp: number;
  /** P(¬D ∩ + ) — false positive */
  fp: number;
  /** P(¬D ∩ − ) — true negative */
  tn: number;
  /** P(D ∩ − ) — false negative */
  fn: number;
  /** P(+) — total probability of a positive result at this stage */
  pPositive: number;
  /** PPV = P(D | +) */
  ppv: number;
  /** NPV = P(¬D | −) */
  npv: number;
  /** P(¬D | +) — the false discovery rate */
  fdr: number;
  /**
   * P(test is right) = TP + TN. Reported because "99 % accurate" is the number
   * people are usually given, and it is dominated by whichever group is bigger:
   * a test that always answers negative scores 99.9 % on a 1-in-1000 condition.
   */
  accuracy: number;
  /** P(D | −) — how often a negative result is wrong. */
  falseOmissionRate: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Safe division that returns 0 when the denominator vanishes. */
export function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

/**
 * The second test as it actually behaves on the people it is given.
 *
 * Textbook chaining assumes conditional independence. Real confirmatory tests
 * share failure modes — the same interfering substance, the same sample, the
 * same model bias — so some of the time the second test just repeats the
 * first one's verdict. `dependence` is the probability that it does:
 *
 *   se₂' = ρ + (1 − ρ)·se₂          sp₂' = (1 − ρ)·sp₂
 *
 * At ρ = 0 this is the independent case. At ρ = 1 the likelihood ratio of a
 * second positive collapses to exactly 1: the confirmation tells you nothing.
 */
export function effectiveSecondTest(params: ModelParams): TestParams {
  const rho = clamp01(params.dependence ?? 0);
  return {
    sensitivity: clamp01(rho + (1 - rho) * clamp01(params.test2.sensitivity)),
    specificity: clamp01((1 - rho) * clamp01(params.test2.specificity)),
  };
}

/**
 * Joint distribution of (condition, test result) for a single test applied to a
 * population whose prior probability of the condition is `prior`.
 */
export function singleStage(prior: number, test: TestParams): StageProbabilities {
  const p = clamp01(prior);
  const se = clamp01(test.sensitivity);
  const sp = clamp01(test.specificity);

  const tp = p * se;
  const fn = p * (1 - se);
  const fp = (1 - p) * (1 - sp);
  const tn = (1 - p) * sp;

  const pPositive = tp + fp;
  const pNegative = tn + fn;

  return {
    tp,
    fp,
    tn,
    fn,
    pPositive,
    ppv: safeDiv(tp, pPositive),
    npv: safeDiv(tn, pNegative),
    fdr: safeDiv(fp, pPositive),
    accuracy: tp + tn,
    falseOmissionRate: safeDiv(fn, pNegative),
  };
}

export interface ModelResult {
  prevalence: number;
  stage1: StageProbabilities;
  /** Second stage, applied ONLY to the individuals positive on test 1. */
  stage2: StageProbabilities | null;
  /** P(D | +₁) */
  ppv1: number;
  /** P(D | +₁ ∩ +₂) — null when confirmatory testing is off */
  ppv2: number | null;
  /** P(+₁ ∩ +₂) as a fraction of the WHOLE population */
  pBothPositive: number | null;
  /** Probability of a positive test 2 given a positive test 1 */
  pPositive2GivenPositive1: number | null;
  /** The negative side, split by which stage produced the negative. */
  negatives: NegativeGroups;
  /** P(+₁ ∩ +₂ | D) = se₁·se₂ — the share of real cases the chain keeps. */
  chainSensitivity: number;
  /** Test 2 after the dependence adjustment; equals test2 when independent. */
  effectiveTest2: TestParams;
}

export function computeModel(params: ModelParams): ModelResult {
  const stage1 = singleStage(params.prevalence, params.test1);

  // Whole-population probabilities for the second stage, so the negative
  // analysis can add stage 1 and stage 2 together without rescaling.
  const test2 = effectiveSecondTest(params);
  const se2 = test2.sensitivity;
  const sp2 = test2.specificity;
  const unit: CountsLike = {
    withCondition: params.prevalence,
    tp1: stage1.tp,
    fp1: stage1.fp,
    tn1: stage1.tn,
    fn1: stage1.fn,
    tp2: stage1.tp * se2,
    fn2: stage1.tp * (1 - se2),
    fp2: stage1.fp * (1 - sp2),
    tn2: stage1.fp * sp2,
  };

  if (!params.confirmatory) {
    return {
      prevalence: params.prevalence,
      stage1,
      stage2: null,
      ppv1: stage1.ppv,
      ppv2: null,
      pBothPositive: null,
      pPositive2GivenPositive1: null,
      negatives: negativeGroups(unit, false),
      chainSensitivity: params.test1.sensitivity,
      effectiveTest2: test2,
    };
  }

  // Everyone positive on test 1 forms a new sub-population whose prior is PPV₁.
  // Test 2 is applied there with whatever independence it actually has.
  const stage2 = singleStage(stage1.ppv, test2);

  return {
    prevalence: params.prevalence,
    stage1,
    stage2,
    ppv1: stage1.ppv,
    ppv2: stage2.ppv,
    pBothPositive: stage1.pPositive * stage2.pPositive,
    pPositive2GivenPositive1: stage2.pPositive,
    negatives: negativeGroups(unit, true),
    chainSensitivity: params.test1.sensitivity * se2,
    effectiveTest2: test2,
  };
}

/** Expected (non-random) counts for a population of the given size. */
export interface ExpectedCounts {
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

export function expectedCounts(params: ModelParams): ExpectedCounts {
  const n = params.populationSize;
  const m = computeModel(params);
  const s1 = m.stage1;
  const positive1 = s1.pPositive * n;

  const base: ExpectedCounts = {
    population: n,
    withCondition: params.prevalence * n,
    withoutCondition: (1 - params.prevalence) * n,
    tp1: s1.tp * n,
    fp1: s1.fp * n,
    tn1: s1.tn * n,
    fn1: s1.fn * n,
    positive1,
    negative1: (s1.tn + s1.fn) * n,
    tp2: 0,
    fp2: 0,
    tn2: 0,
    fn2: 0,
    positive2: 0,
    negative2: 0,
  };

  if (m.stage2) {
    const s2 = m.stage2;
    base.tp2 = s2.tp * positive1;
    base.fp2 = s2.fp * positive1;
    base.tn2 = s2.tn * positive1;
    base.fn2 = s2.fn * positive1;
    base.positive2 = s2.pPositive * positive1;
    base.negative2 = (s2.tn + s2.fn) * positive1;
  }
  return base;
}

/** Anything that carries the twelve cell counts, in people or in probabilities. */
export interface CountsLike {
  withCondition: number;
  tp1: number;
  fp1: number;
  tn1: number;
  fn1: number;
  tp2: number;
  fp2: number;
  tn2: number;
  fn2: number;
}

export interface NegativeGroup {
  /** Everyone in this group. */
  total: number;
  /** …who genuinely do not have the condition. */
  clear: number;
  /** …who do have it and were told otherwise. */
  missed: number;
  /** P(no condition | in this group). */
  npv: number;
  /** P(condition | in this group) — the false omission rate. */
  missRate: number;
}

export interface NegativeGroups {
  /** Declared negative by test 1 and never retested. */
  stage1: NegativeGroup;
  /** Positive on test 1, then cleared by test 2. Null without chaining. */
  stage2: NegativeGroup | null;
  /** Everyone the chain finally declares negative. */
  combined: NegativeGroup;
  /** Where the people who really have the condition ended up. */
  cases: { total: number; found: number; missedAt1: number; missedAt2: number };
}

/**
 * The negative side of a chain, split by where the negative came from.
 *
 * This matters because a confirmatory test can only ever remove people from the
 * positive pile: every genuine case it removes stops being a true positive and
 * becomes a NEW missed case. The gain in precision is paid for here.
 *
 * Scale-free — pass counts to get counts, or probabilities to get probabilities.
 */
export function negativeGroups(c: CountsLike, confirmatory: boolean): NegativeGroups {
  const group = (clear: number, missed: number): NegativeGroup => {
    const total = clear + missed;
    return { total, clear, missed, npv: safeDiv(clear, total), missRate: safeDiv(missed, total) };
  };

  const stage1 = group(c.tn1, c.fn1);
  const stage2 = confirmatory ? group(c.tn2, c.fn2) : null;
  const combined = confirmatory ? group(c.tn1 + c.tn2, c.fn1 + c.fn2) : stage1;

  return {
    stage1,
    stage2,
    combined,
    cases: {
      total: c.withCondition,
      found: confirmatory ? c.tp2 : c.tp1,
      missedAt1: c.fn1,
      missedAt2: confirmatory ? c.fn2 : 0,
    },
  };
}

/** Bayes factor of a positive result: sensitivity / (1 − specificity). */
export function positiveLikelihoodRatio(test: TestParams): number {
  return safeDiv(test.sensitivity, 1 - test.specificity);
}

/** Negative likelihood ratio: (1 − sensitivity) / specificity. */
export function negativeLikelihoodRatio(test: TestParams): number {
  return safeDiv(1 - test.sensitivity, test.specificity);
}

/** "1 in N" natural-frequency form of a probability. Returns Infinity for 0. */
export function oneInN(p: number): number {
  return p <= 0 ? Infinity : 1 / p;
}
