/*
 * Conditional Probability Explorer - simulation tab
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Glyph, ScenarioArt } from './Art';
import { ParticleSimulation } from './ParticleSimulation';
import { StreamDiagram } from './StreamDiagram';
import { Dashboard } from './Dashboard';
import { runSimulation, observedPpv1, observedPpv2 } from '../lib/simulation';
import { computeModel } from '../lib/probability';
import { buildExpectedPopulation } from '../lib/expectedPopulation';
import type { ModelParams, Outcome, Phase } from '../lib/types';
import type { Scenario } from '../lib/scenario';
import { OutcomeMeanings } from './OutcomeMeanings';
import { NegativeAnalysis } from './NegativeAnalysis';
import { DownloadImage } from './DownloadImage';
import { RevealGate } from './RevealGate';

type Mode = 'random' | 'expected';

const PHASES: { phase: Phase; ms: number }[] = [
  { phase: 'population', ms: 500 },
  { phase: 'condition', ms: 800 },
  { phase: 'test1', ms: 2400 },
  { phase: 'split', ms: 500 },
  { phase: 'test2', ms: 1900 },
];

export interface SimulationProps {
  params: ModelParams;
  seed: number;
  onNewSeed: () => void;
  scenario: Scenario;
  /** Shown once a run has finished, before any panel gives the answer away. */
  reveal?: ReactNode;
  /** False until the reader has committed to a guess, skipped, or run it. */
  revealed: boolean;
  onReveal: () => void;
}

export function Simulation({
  params,
  seed,
  onNewSeed,
  scenario,
  reveal,
  revealed,
  onReveal,
}: SimulationProps) {
  const { t, n, pct, lang } = useI18n();
  const [mode, setMode] = useState<Mode>('random');
  const [focused, setFocused] = useState(false);
  const [animate, setAnimate] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [sweepMs, setSweepMs] = useState(0);
  const [hasRun, setHasRun] = useState(false);
  const timer = useRef<number>();

  const model = useMemo(() => computeModel(params), [params]);

  const randomResult = useMemo(
    () => runSimulation(params, seed),
    [params, seed],
  );
  const expected = useMemo(() => buildExpectedPopulation(params), [params]);
  const result = mode === 'random' ? randomResult : expected;

  const stopAnimation = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  useEffect(() => stopAnimation, [stopAnimation]);

  const play = useCallback(() => {
    stopAnimation();
    setHasRun(true);
    const steps = PHASES.filter((p) => p.phase !== 'test2' || params.confirmatory);
    if (!animate) {
      setPhase('done');
      setSweepMs(0);
      return;
    }
    // Only the phase changes go through React; the reveal sweep itself is
    // animated inside the canvas, so a run costs five renders, not three hundred.
    let idx = 0;
    const step = () => {
      if (idx >= steps.length) {
        setPhase('done');
        setSweepMs(0);
        return;
      }
      const s = steps[idx++];
      setPhase(s.phase);
      setSweepMs(s.ms);
      timer.current = window.setTimeout(step, s.ms + 90);
    };
    step();
  }, [animate, params.confirmatory, stopAnimation]);

  // Changing the parameters invalidates the drawn run.
  useEffect(() => {
    stopAnimation();
    setPhase('idle');
    setSweepMs(0);
    setHasRun(false);
    setFocused(false);
  }, [params, stopAnimation]);

  const reset = () => {
    stopAnimation();
    setPhase('idle');
    setSweepMs(0);
    setHasRun(false);
  };

  const run = () => {
    // Running it is committing to look, so it opens the gate as well.
    onReveal();
    // Ask for a seed first: unlocked that means a new draw, locked it is a
    // no-op and the identical run replays.
    onNewSeed();
    window.setTimeout(play, 0);
  };

  const counts = result.counts;
  const decimals = mode === 'expected' ? 1 : 0;

  const stageLabel: Record<Phase, string> = {
    idle: t('sim.stage.idle'),
    population: t('sim.stage.population'),
    condition: t('sim.stage.condition'),
    test1: t('sim.stage.test1'),
    split: t('sim.stage.split1'),
    test2: t('sim.stage.test2'),
    done: t('sim.stage.done'),
  };

  // What the legend must report is exactly what the canvas is drawing: once the
  // confirmatory stage has run, the people it cleared join the negative groups.
  const afterTest2 = params.confirmatory && phase === 'done';
  const legendCounts: Record<Outcome, number> = afterTest2
    ? {
        truePositive: counts.tp2,
        falsePositive: counts.fp2,
        falseNegative: counts.fn1 + counts.fn2,
        trueNegative: counts.tn1 + counts.tn2,
      }
    : {
        truePositive: counts.tp1,
        falsePositive: counts.fp1,
        falseNegative: counts.fn1,
        trueNegative: counts.tn1,
      };


  return (
    <div className="steps">
      <section className="panel">
        <div className="panel-title">
          <h3>{t('nav.simulation')}</h3>
          <span className="hint">{t('sim.mode.hint')}</span>
        </div>

        <div className="toolbar" style={{ marginBottom: 12 }}>
          <button className="btn primary" onClick={run}>
            {hasRun ? t('sim.again') : t('sim.run')}
          </button>
          <button className="btn ghost" onClick={reset} disabled={!hasRun}>
            {t('sim.reset')}
          </button>
          <div className="seg" role="group" aria-label={t('sim.mode.random')}>
            <button aria-pressed={mode === 'random'} onClick={() => setMode('random')}>
              {t('sim.mode.random')}
            </button>
            <button aria-pressed={mode === 'expected'} onClick={() => setMode('expected')}>
              {t('sim.mode.expected')}
            </button>
          </div>
          <label className="switch" style={{ marginLeft: 4 }}>
            <input
              type="checkbox"
              checked={animate}
              onChange={(e) => setAnimate(e.target.checked)}
            />
            <span className="switch-track" />
            <span style={{ fontSize: 13 }}>{animate ? t('sim.animate') : t('sim.skip')}</span>
          </label>
          <button
            className="btn small"
            onClick={() => setFocused((v) => !v)}
            disabled={!hasRun || counts.positive1 === 0}
          >
            {focused ? t('sim.focus.off') : t('sim.focus')}
          </button>
          <div className="spacer" />
        </div>

        {focused && hasRun && (
          <div className="conditioning-banner">
            {t('sim.focus.caption', {
              n: n(counts.positive1, decimals),
              ppv: pct(counts.positive1 > 0 ? counts.tp1 / counts.positive1 : 0, 1),
            })}
          </div>
        )}

        <div className="stage-line" aria-live="polite">
          {phase !== 'idle' && phase !== 'done' && <span className="pulse" />}
          {stageLabel[phase]}
          {mode === 'expected' && ` · ${t('sim.mode.expected')}`}
        </div>

        <div className="sim-stage">
          <div className="visual" style={{ flex: '1 1 320px', minWidth: 0 }}>
            <ParticleSimulation
              result={result}
              confirmatory={params.confirmatory}
              phase={hasRun ? phase : 'idle'}
              sweepMs={hasRun ? sweepMs : 0}
              focused={focused && hasRun}
              labels={{
                population: t('flow.population'),
                focusTitle: t('sim.focus.title', { n: n(counts.positive1, decimals) }),
                test1: t('flow.test1'),
                test2: t('flow.test2'),
                positive1: t('flow.positive1'),
                negative1: t('flow.negative1'),
                positiveBoth: t('flow.positiveBoth'),
                cleared: t('flow.negative2'),
                sampling: (shown, total) =>
                  t('sim.sampling', { shown: n(shown), total: n(total) }),
                fmt: (v) => n(v, decimals),
              }}
            />
            <DownloadImage
              target={() => document.querySelector('.sim-stage canvas')}
              title={`${scenario.name[lang]} — ${t('export.simulation')}`}
              subtitle={scenario.question[lang]}
              params={params}
              counts={counts}
              decimals={decimals}
              filenameHint={`${scenario.id}-simulation`}
            />
          </div>
          <ScenarioArt art={scenario.art} className="intro-art sim-art" />
        </div>

        {/* A count is a result. Until the run has happened this is only the key
            to the colours and the shapes, otherwise the answer sits on screen
            before anybody has watched anything. */}
        <div className="legend">
          {(['truePositive', 'falsePositive', 'falseNegative', 'trueNegative'] as const).map((k) => (
            <span className="legend-item" key={k}>
              <Glyph kind={k} />
              <b>{t(`outcome.${k}`)}</b>
              {hasRun && ` — ${n(legendCounts[k], decimals)}`}
            </span>
          ))}
        </div>
      </section>

      {hasRun && reveal}

      {hasRun && (
        <section className="panel">
          <div className="panel-title">
            <h3>{t('sim.finalResult')}</h3>
            <span className="hint">{t('sim.finalResult.hint')}</span>
          </div>
          <div className="final-stream visual">
            <StreamDiagram
              counts={counts}
              confirmatory={params.confirmatory}
              phase="done"
              sweepMs={0}
              decimals={decimals}
            />
            <DownloadImage
              target={() => [...document.querySelectorAll('.final-stream svg')]}
              title={`${scenario.name[lang]} — ${t('export.stream')}`}
              subtitle={scenario.question[lang]}
              params={params}
              counts={counts}
              decimals={decimals}
              filenameHint={`${scenario.id}-flow`}
            />
          </div>
        </section>
      )}

      <RevealGate revealed={revealed} onReveal={onReveal}>
        <section className="panel">
          <div className="panel-title">
            <h3>{t('dash.headline')}</h3>
          </div>
          <Dashboard
            negativeMeans={scenario.negativeMeans[lang]}
            model={model}
            params={params}
            seed={seed}
            observed={
              hasRun && mode === 'random'
                ? { ppv1: observedPpv1(counts), ppv2: observedPpv2(counts) }
                : null
            }
          />
          {hasRun && mode === 'random' && counts.positive1 === 0 && (
            <div className="note">{t('dash.noPositives')}</div>
          )}
        </section>
      </RevealGate>

      {hasRun && (
        <NegativeAnalysis
          counts={counts}
          confirmatory={params.confirmatory}
          decimals={decimals}
        />
      )}

      <OutcomeMeanings
        scenario={scenario}
        decimals={decimals}
        counts={
          hasRun
            ? {
                truePositive: legendCounts.truePositive,
                falsePositive: legendCounts.falsePositive,
                falseNegative: legendCounts.falseNegative,
                trueNegative: legendCounts.trueNegative,
              }
            : null
        }
      />
    </div>
  );
}
