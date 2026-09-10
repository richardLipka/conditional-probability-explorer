/*
 * Conditional Probability Explorer - scenario schema, validation and URL sharing
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import type { ModelParams, Outcome } from './types';

export type Lang = 'en' | 'cs';
export type ArtKey = 'virus' | 'clinic' | 'roadside' | 'lab' | 'crowd' | 'airport' | 'lazy';

export interface Localized {
  en: string;
  cs: string;
}

/**
 * A scenario is the whole teaching unit: the story, the labels for the two
 * groups, what each of the four outcomes means for a real person in that
 * story, and the parameters to start from. Scenarios live as JSON files so
 * they can be added, edited and shared without touching the code.
 */
export interface Scenario {
  id: string;
  art: ArtKey;
  name: Localized;
  description: Localized;
  /** The one question the scenario exists to answer. */
  question: Localized;
  /** Label for the people who really have the condition / really did the thing. */
  condition: Localized;
  noCondition: Localized;
  /** Plain-language reading of a positive and of a negative result. */
  positiveMeans: Localized;
  negativeMeans: Localized;
  /** What each cell of the confusion matrix means for someone in this story. */
  outcomes: Record<Outcome, Localized>;
  disclaimer?: Localized;
  params: ModelParams;
}

const ART_KEYS: ArtKey[] = ['virus', 'clinic', 'roadside', 'lab', 'crowd', 'airport', 'lazy'];

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

const loc = (v: unknown, fallback = ''): Localized => {
  if (typeof v === 'string') return { en: v, cs: v };
  const o = (v ?? {}) as Record<string, unknown>;
  const en = str(o.en, fallback);
  return { en, cs: str(o.cs, en) };
};

const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const x = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, x));
};

/** Validate and coerce arbitrary parsed JSON into a usable scenario. */
export function parseScenario(raw: unknown): Scenario | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, any>;
  const p = (o.params ?? {}) as Record<string, any>;
  if (typeof p !== 'object' || p === null) return null;

  const test = (t: any, seFallback: number, spFallback: number) => ({
    sensitivity: num(t?.sensitivity, seFallback, 0, 1),
    specificity: num(t?.specificity, spFallback, 0, 1),
  });
  const outcome = (key: Outcome, fallback: string) => loc(o.outcomes?.[key], fallback);

  return {
    id: str(o.id, 'imported'),
    art: ART_KEYS.includes(o.art) ? o.art : 'virus',
    name: loc(o.name, 'Imported scenario'),
    description: loc(o.description),
    question: loc(o.question),
    condition: loc(o.condition, 'Condition present'),
    noCondition: loc(o.noCondition, 'Condition absent'),
    positiveMeans: loc(o.positiveMeans),
    negativeMeans: loc(o.negativeMeans),
    outcomes: {
      truePositive: outcome('truePositive', ''),
      falsePositive: outcome('falsePositive', ''),
      trueNegative: outcome('trueNegative', ''),
      falseNegative: outcome('falseNegative', ''),
    },
    disclaimer: o.disclaimer ? loc(o.disclaimer) : undefined,
    params: {
      populationSize: Math.round(num(p.populationSize, 10000, 10, 100000)),
      prevalence: num(p.prevalence, 0.001, 0, 1),
      test1: test(p.test1, 0.99, 0.99),
      test2: test(p.test2, 0.99, 0.999),
      confirmatory: Boolean(p.confirmatory),
      dependence: num(p.dependence, 0, 0, 1),
    },
  };
}

/* ------------------------------------------------------------------ sharing */

export interface UrlState {
  scenario?: string;
  params?: Partial<ModelParams>;
  lang?: Lang;
}

const PARAM_KEYS = {
  n: 'populationSize',
  prev: 'prevalence',
  se1: 'test1.sensitivity',
  sp1: 'test1.specificity',
  se2: 'test2.sensitivity',
  sp2: 'test2.specificity',
  dep: 'dependence',
} as const;

const get = (p: ModelParams, path: string): number => {
  const [a, b] = path.split('.');
  return b ? (p as any)[a][b] : (p as any)[a];
};

/**
 * A shareable query string: the scenario file to load, plus only those
 * parameters the reader has actually changed, so an untouched scenario shares
 * as a short `?scenario=<id>` link.
 */
export function buildQuery(scenarioId: string, params: ModelParams, base: ModelParams, lang: Lang) {
  const q = new URLSearchParams();
  q.set('scenario', scenarioId);
  for (const [key, path] of Object.entries(PARAM_KEYS)) {
    const v = get(params, path);
    if (Math.abs(v - get(base, path)) > 1e-12) {
      q.set(key, key === 'n' ? String(Math.round(v)) : String(Number(v.toFixed(6))));
    }
  }
  if (params.confirmatory !== base.confirmatory) q.set('conf', params.confirmatory ? '1' : '0');
  q.set('lang', lang);
  return `?${q.toString()}`;
}

export function readQuery(search: string): UrlState {
  const q = new URLSearchParams(search);
  const state: UrlState = {};
  const id = q.get('scenario');
  if (id) state.scenario = id;
  const lang = q.get('lang');
  if (lang === 'en' || lang === 'cs') state.lang = lang;

  const params: Record<string, any> = {};
  const setPath = (path: string, value: number) => {
    const [a, b] = path.split('.');
    if (b) {
      params[a] = { ...(params[a] ?? {}), [b]: value };
    } else {
      params[a] = value;
    }
  };
  for (const [key, path] of Object.entries(PARAM_KEYS)) {
    const raw = q.get(key);
    // Number('') is 0, so an empty parameter has to be rejected explicitly
    // rather than silently becoming a population of zero.
    if (raw === null || raw.trim() === '') continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    setPath(path, key === 'n' ? Math.round(v) : v);
  }
  const conf = q.get('conf');
  if (conf === '0' || conf === '1') params.confirmatory = conf === '1';
  if (Object.keys(params).length) state.params = params as Partial<ModelParams>;
  return state;
}

/** Merge URL overrides onto a scenario's own parameters, clamped to valid ranges. */
export function applyOverrides(base: ModelParams, over?: Partial<ModelParams>): ModelParams {
  if (!over) return base;
  const t = (b: { sensitivity: number; specificity: number }, o?: Partial<typeof b>) => ({
    sensitivity: num(o?.sensitivity, b.sensitivity, 0, 1),
    specificity: num(o?.specificity, b.specificity, 0, 1),
  });
  return {
    populationSize: Math.round(num(over.populationSize, base.populationSize, 10, 100000)),
    prevalence: num(over.prevalence, base.prevalence, 0, 1),
    test1: t(base.test1, over.test1),
    test2: t(base.test2, over.test2),
    dependence: num(over.dependence, base.dependence, 0, 1),
    confirmatory:
      typeof over.confirmatory === 'boolean' ? over.confirmatory : base.confirmatory,
  };
}
