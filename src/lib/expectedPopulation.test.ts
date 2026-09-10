import { describe, it, expect } from 'vitest';
import { buildExpectedPopulation } from './expectedPopulation';
import { expectedCounts } from './probability';
import { scenarios, scenarioById } from '../presets';
import { parseScenario, buildQuery, readQuery, applyOverrides } from './scenario';
import type { ModelParams } from './types';

const base: ModelParams = {
  prevalence: 0.001,
  test1: { sensitivity: 0.99, specificity: 0.99 },
  test2: { sensitivity: 0.99, specificity: 0.999 },
  confirmatory: false,
  populationSize: 10000,
  dependence: 0,
};

describe('buildExpectedPopulation', () => {
  it('fills exactly the requested population', () => {
    const r = buildExpectedPopulation(base);
    expect(r.size).toBe(10000);
    expect(r.condition.length).toBe(10000);
  });

  it('reproduces the expected composition to within rounding', () => {
    const r = buildExpectedPopulation({ ...base, prevalence: 0.01 });
    const c = expectedCounts({ ...base, prevalence: 0.01 });
    let tp = 0;
    let fp = 0;
    for (let i = 0; i < r.size; i++) {
      if (r.test1[i] === 1) (r.condition[i] ? tp++ : fp++);
    }
    expect(Math.abs(tp - c.tp1)).toBeLessThanOrEqual(1);
    expect(Math.abs(fp - c.fp1)).toBeLessThanOrEqual(1);
  });

  it('retests exactly the test-1 positives when confirmatory testing is on', () => {
    const r = buildExpectedPopulation({ ...base, prevalence: 0.02, confirmatory: true });
    for (let i = 0; i < r.size; i++) {
      if (r.test1[i] === 1) expect(r.test2[i]).toBeGreaterThan(0);
      else expect(r.test2[i]).toBe(0);
    }
  });
});

describe('scenarios', () => {
  it('ships a scenario for every bundled file, fully localised', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(7);
    for (const s of scenarios) {
      for (const field of [s.name, s.description, s.question, s.condition, s.noCondition]) {
        expect(field.en.length).toBeGreaterThan(0);
        expect(field.cs.length).toBeGreaterThan(0);
      }
      for (const key of ['truePositive', 'falsePositive', 'trueNegative', 'falseNegative'] as const) {
        expect(s.outcomes[key].en.length).toBeGreaterThan(0);
        expect(s.outcomes[key].cs.length).toBeGreaterThan(0);
      }
      expect(s.params.prevalence).toBeGreaterThanOrEqual(0);
      expect(s.params.prevalence).toBeLessThan(1);
    }
  });

  it('has unique ids so a URL can name one', () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(scenarioById('airport-ai')?.params.populationSize).toBe(100000);
    expect(scenarioById('nope')).toBeUndefined();
  });

  it('ships the accuracy trap: a test that never says positive', () => {
    const lazy = scenarioById('lazy-test')!;
    expect(lazy.params.test1.sensitivity).toBe(0);
    expect(lazy.params.test1.specificity).toBe(1);
  });

  it('round-trips a scenario through JSON', () => {
    const parsed = parseScenario(JSON.parse(JSON.stringify(scenarios[0])));
    expect(parsed?.params).toEqual(scenarios[0].params);
    expect(parsed?.outcomes.falsePositive.cs).toEqual(scenarios[0].outcomes.falsePositive.cs);
  });

  it('clamps nonsense values from an imported file', () => {
    const parsed = parseScenario({
      params: {
        populationSize: 10 ** 9,
        prevalence: 5,
        test1: { sensitivity: -3, specificity: 'x' },
      },
    });
    expect(parsed!.params.populationSize).toBe(100000);
    expect(parsed!.params.prevalence).toBe(1);
    expect(parsed!.params.test1.sensitivity).toBe(0);
    expect(parsed!.params.test1.specificity).toBe(0.99);
  });

  it('falls back to the English text when a translation is missing', () => {
    const parsed = parseScenario({ name: { en: 'Only English' }, params: {} });
    expect(parsed!.name.cs).toBe('Only English');
  });

  it('rejects values that are not objects', () => {
    expect(parseScenario(null)).toBeNull();
    expect(parseScenario('nope')).toBeNull();
  });
});

describe('shareable links', () => {
  const scenario = scenarios[0];

  it('shares an untouched scenario as just its name', () => {
    const q = buildQuery(scenario.id, scenario.params, scenario.params, 'en');
    expect(q).toBe(`?scenario=${scenario.id}&lang=en`);
  });

  it('carries only the parameters that were changed', () => {
    const changed = { ...scenario.params, prevalence: 0.02 };
    const q = buildQuery(scenario.id, changed, scenario.params, 'cs');
    expect(q).toContain('prev=0.02');
    expect(q).toContain('lang=cs');
    expect(q).not.toContain('se1=');
  });

  it('round-trips through the query string', () => {
    const changed = {
      ...scenario.params,
      prevalence: 0.037,
      populationSize: 2500,
      confirmatory: !scenario.params.confirmatory,
      test2: { sensitivity: 0.912, specificity: 0.9995 },
    };
    const state = readQuery(buildQuery(scenario.id, changed, scenario.params, 'en'));
    expect(state.scenario).toBe(scenario.id);
    expect(state.lang).toBe('en');
    expect(applyOverrides(scenario.params, state.params)).toEqual(changed);
  });

  it('ignores junk in the query string', () => {
    const state = readQuery('?scenario=rare-disease&prev=banana&n=&conf=maybe');
    expect(state.scenario).toBe('rare-disease');
    expect(state.params).toBeUndefined();
  });

  it('clamps out-of-range overrides rather than trusting them', () => {
    const state = readQuery('?scenario=x&prev=9&n=99999999');
    const p = applyOverrides(scenario.params, state.params);
    expect(p.prevalence).toBe(1);
    expect(p.populationSize).toBe(100000);
  });
});
