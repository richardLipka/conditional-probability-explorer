/*
 * Conditional Probability Explorer - shared model types
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
export type ScenarioId = 'medical' | 'roadside';

export interface TestParams {
  /** P(test positive | condition present) */
  sensitivity: number;
  /** P(test negative | condition absent) */
  specificity: number;
}

export interface ModelParams {
  /** P(condition present) — the base rate */
  prevalence: number;
  test1: TestParams;
  test2: TestParams;
  confirmatory: boolean;
  populationSize: number;
  /**
   * How much the second test simply repeats the first, from 0 (conditionally
   * independent — the textbook assumption) to 1 (it always echoes test 1 and
   * therefore carries no information at all).
   */
  dependence: number;
}

export interface Preset {
  id: string;
  scenario: ScenarioId;
  labelKey?: string;
  name: { en: string; cs: string };
  description?: { en: string; cs: string };
  params: ModelParams;
}

export type Outcome =
  | 'truePositive'
  | 'falsePositive'
  | 'trueNegative'
  | 'falseNegative';

/** Stages a simulation run passes through, in order. */
export type Phase = 'idle' | 'population' | 'condition' | 'test1' | 'split' | 'test2' | 'done';
