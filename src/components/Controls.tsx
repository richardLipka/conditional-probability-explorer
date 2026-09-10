/*
 * Conditional Probability Explorer - parameter panel
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useId, useRef } from 'react';
import { useI18n } from '../i18n';
import type { ModelParams } from '../lib/types';
import { oneInN } from '../lib/probability';
import { parseScenario, type Scenario } from '../lib/scenario';

const PREV_MIN = 0.0001;
const PREV_MAX = 0.5;

/** Prevalence uses a logarithmic slider: the interesting behaviour is all near zero. */
const prevToSlider = (p: number) =>
  (Math.log(Math.min(PREV_MAX, Math.max(PREV_MIN, p)) / PREV_MIN) / Math.log(PREV_MAX / PREV_MIN)) *
  1000;
const sliderToPrev = (v: number) => PREV_MIN * Math.pow(PREV_MAX / PREV_MIN, v / 1000);

function Slider({
  label,
  hint,
  value,
  display,
  sub,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  display: string;
  sub?: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id} title={hint}>
          {label}
        </label>
        <span className="field-value">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--fill' as string]: `${fill}%` }}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {(sub || hint) && (
        <div className="field-sub" id={`${id}-hint`}>
          {sub ?? hint}
        </div>
      )}
    </div>
  );
}

export interface ControlsProps {
  params: ModelParams;
  onChange: (next: ModelParams) => void;
  /** Back to the scenario's own starting values. */
  onReset: () => void;
  onImport: (s: Scenario) => void;
  scenario: Scenario;
  seed: number;
  onSeed: (s: number) => void;
  seedLocked: boolean;
  onSeedLocked: (locked: boolean) => void;
  onReroll: () => void;
}

const POP_PRESETS = [100, 1000, 10000];

export function Controls({
  params,
  onChange,
  onReset,
  onImport,
  scenario,
  seed,
  onSeed,
  seedLocked,
  onSeedLocked,
  onReroll,
}: ControlsProps) {
  const { t, n, pct } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<ModelParams>) => onChange({ ...params, ...patch });

  const exportJson = () => {
    // Export the whole scenario, so the story and the outcome wording travel
    // with the numbers and the file can be loaded straight back in.
    const data: Scenario = { ...scenario, id: `${scenario.id}-custom`, params };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseScenario(JSON.parse(String(reader.result)));
        if (parsed) onImport(parsed);
      } catch {
        /* ignore malformed files */
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="panel">
      <div className="panel-title">
        <h3>{t('controls.title')}</h3>
      </div>

      <div className="field">
        <div className="toolbar">
          <button className="btn small ghost" onClick={exportJson}>
            {t('controls.preset.export')}
          </button>
          <button className="btn small ghost" onClick={() => fileRef.current?.click()}>
            {t('controls.preset.import')}
          </button>
          <button className="btn small ghost" onClick={onReset}>
            {t('controls.reset')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="field">
        <div className="field-head">
          <label>{t('controls.population')}</label>
          <span className="field-value">{n(params.populationSize)}</span>
        </div>
        <div className="seg" role="group" aria-label={t('controls.population')}>
          {POP_PRESETS.map((p) => (
            <button
              key={p}
              aria-pressed={params.populationSize === p}
              onClick={() => set({ populationSize: p })}
            >
              {n(p)}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={10}
          max={100000}
          step={100}
          value={params.populationSize}
          aria-label={t('controls.population.custom')}
          onChange={(e) =>
            set({
              populationSize: Math.min(100000, Math.max(10, Math.round(Number(e.target.value) || 0))),
            })
          }
          style={{ marginTop: 8 }}
        />
      </div>

      <Slider
        label={t('controls.prevalence')}
        hint={t('controls.prevalence.hint')}
        value={prevToSlider(params.prevalence)}
        min={0}
        max={1000}
        step={1}
        display={pct(params.prevalence, params.prevalence < 0.01 ? 3 : 1)}
        sub={t('controls.oneIn', { n: n(Math.round(oneInN(params.prevalence))) })}
        onChange={(v) => set({ prevalence: sliderToPrev(v) })}
      />

      <fieldset className="fieldset">
        <legend>{t('controls.test1')}</legend>
        <Slider
          label={t('controls.sensitivity')}
          hint={t('controls.sensitivity.hint')}
          value={params.test1.sensitivity * 100}
          min={0}
          max={100}
          step={0.1}
          display={pct(params.test1.sensitivity, 1)}
          onChange={(v) => set({ test1: { ...params.test1, sensitivity: v / 100 } })}
        />
        <Slider
          label={t('controls.specificity')}
          hint={t('controls.specificity.hint')}
          value={params.test1.specificity * 100}
          min={0}
          max={100}
          step={0.01}
          display={pct(params.test1.specificity, 2)}
          onChange={(v) => set({ test1: { ...params.test1, specificity: v / 100 } })}
        />
      </fieldset>

      <div className="field">
        <label className="switch">
          <input
            type="checkbox"
            checked={params.confirmatory}
            onChange={(e) => set({ confirmatory: e.target.checked })}
          />
          <span className="switch-track" />
          <span>
            <span style={{ fontSize: 13, fontWeight: 570 }}>{t('controls.confirmatory')}</span>
            <span className="field-sub" style={{ display: 'block' }}>
              {t('controls.confirmatory.hint')}
            </span>
          </span>
        </label>
      </div>

      <fieldset className={`fieldset${params.confirmatory ? '' : ' inactive'}`}>
        <legend>{t('controls.test2')}</legend>
        {!params.confirmatory && <div className="field-sub">{t('controls.test2.note')}</div>}
        <Slider
          label={t('controls.sensitivity')}
          value={params.test2.sensitivity * 100}
          min={0}
          max={100}
          step={0.1}
          display={pct(params.test2.sensitivity, 1)}
          onChange={(v) => set({ test2: { ...params.test2, sensitivity: v / 100 } })}
        />
        <Slider
          label={t('controls.specificity')}
          value={params.test2.specificity * 100}
          min={0}
          max={100}
          step={0.01}
          display={pct(params.test2.specificity, 2)}
          onChange={(v) => set({ test2: { ...params.test2, specificity: v / 100 } })}
        />
      </fieldset>

      <fieldset className={`fieldset${params.confirmatory ? '' : ' inactive'}`}>
        <legend>{t('controls.dependence')}</legend>
        <Slider
          label={t('controls.dependence')}
          hint={t('controls.dependence.hint')}
          value={params.dependence * 100}
          min={0}
          max={100}
          step={1}
          display={pct(params.dependence, 0)}
          sub={
            params.dependence === 0
              ? t('controls.dependence.independent')
              : t('controls.dependence.some', { n: pct(params.dependence, 0) })
          }
          onChange={(v) => set({ dependence: v / 100 })}
        />
      </fieldset>

      <div className="field" style={{ marginBottom: 0 }}>
        <div className="field-head">
          <label htmlFor="seed">{t('controls.seed')}</label>
        </div>
        <div className="seg" role="group" aria-label={t('controls.seed')}>
          <button aria-pressed={!seedLocked} onClick={() => onSeedLocked(false)}>
            {t('controls.seed.auto')}
          </button>
          <button aria-pressed={seedLocked} onClick={() => onSeedLocked(true)}>
            {t('controls.seed.fixed')}
          </button>
        </div>
        <div className="toolbar" style={{ marginTop: 8, flexWrap: 'nowrap' }}>
          <input
            id="seed"
            type="number"
            min={1}
            value={seed}
            aria-describedby="seed-hint"
            onChange={(e) => onSeed(Math.max(1, Math.round(Number(e.target.value) || 1)))}
          />
          <button
            className="btn small ghost"
            onClick={onReroll}
            title={t('controls.seed.reroll')}
            aria-label={t('controls.seed.reroll')}
          >
            ⟳
          </button>
        </div>
        <div className="field-sub" id="seed-hint">
          {seedLocked ? t('controls.seed.hint.fixed') : t('controls.seed.hint.auto')}
        </div>
      </div>
    </div>
  );
}
