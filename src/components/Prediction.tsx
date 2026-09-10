/*
 * Conditional Probability Explorer - predict before, reveal after
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useState } from 'react';
import { useI18n } from '../i18n';
import type { ModelParams } from '../lib/types';
import { computeModel } from '../lib/probability';

/**
 * Predict, then run, then compare. The two halves are deliberately separated:
 * the guess is made before anything is on screen, and the answer only appears
 * underneath the simulation once it has actually been run.
 */

export interface PredictionInputProps {
  params: ModelParams;
  guess: number | null;
  onGuess: (value: number | null) => void;
}

export function PredictionInput({ params, guess, onGuess }: PredictionInputProps) {
  const { t, pct } = useI18n();
  const [slider, setSlider] = useState(50);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <section className="panel quiz">
      <div className="panel-title">
        <h3>{t('quiz.title')}</h3>
        <button className="btn small ghost" onClick={() => setDismissed(true)}>
          {t('quiz.skip')}
        </button>
      </div>
      <p style={{ marginTop: 0, fontSize: 13.5 }}>
        {t('quiz.q1', {
          sp: pct(params.test1.specificity, 2),
          se: pct(params.test1.sensitivity, 1),
          prev: pct(params.prevalence, params.prevalence < 0.01 ? 3 : 1),
        })}
      </p>
      <p className="field-sub" style={{ marginTop: -4 }}>
        {t('quiz.intro')}
      </p>

      <div className="guess-row">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={guess ?? slider}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSlider(v);
            if (guess !== null) onGuess(v);
          }}
          style={{ flex: 1, minWidth: 200, ['--fill' as string]: `${guess ?? slider}%` }}
          aria-label={t('quiz.yourGuess')}
        />
        <span className="guess-value">{guess ?? slider} %</span>
        {guess === null ? (
          <button className="btn primary" onClick={() => onGuess(slider)}>
            {t('quiz.submit')}
          </button>
        ) : (
          <button className="btn ghost" onClick={() => onGuess(null)}>
            {t('quiz.again')}
          </button>
        )}
      </div>

      {guess !== null && (
        <div className="field-sub" style={{ marginTop: 10 }}>
          {t('quiz.locked')}
        </div>
      )}
    </section>
  );
}

export function PredictionReveal({ params, guess }: { params: ModelParams; guess: number | null }) {
  const { t, pct } = useI18n();
  if (guess === null) return null;

  const actual = computeModel({ ...params, confirmatory: false }).ppv1;
  const diff = guess / 100 - actual;
  const verdict =
    Math.abs(diff) < 0.05 ? t('quiz.close') : diff > 0 ? t('quiz.over') : t('quiz.under');

  return (
    <section className="panel quiz">
      <div className="panel-title">
        <h3>{t('quiz.reveal')}</h3>
      </div>

      <div className="reveal">
        <div className="r">
          <span>{t('quiz.yourGuess')}</span>
          <strong style={{ color: 'var(--accent)' }}>{guess} %</strong>
        </div>
        <div className="r">
          <span>{t('quiz.actual')}</span>
          <strong style={{ color: 'var(--tp)' }}>{pct(actual, 2)}</strong>
        </div>
        <div className="r" style={{ flex: 1, minWidth: 220 }}>
          <span>&nbsp;</span>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{verdict}</p>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="hundred-label">{t('quiz.explore')}</div>
        {([1, 2, 3, 4] as const).map((i) => (
          <details className="qa" key={i}>
            <summary>{t(`quiz.explore.${i}` as 'quiz.explore.1')}</summary>
            <p>{t(`quiz.answer.${i}` as 'quiz.answer.1')}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
