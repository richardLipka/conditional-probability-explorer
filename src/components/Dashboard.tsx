/*
 * Conditional Probability Explorer - positive and negative result headlines
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useI18n } from '../i18n';
import { OUTCOME_COLORS } from './Art';
import type { ModelResult } from '../lib/probability';

/**
 * Czech needs three plural forms (1 / 2–4 / 5+); English collapses the last two.
 * Picking the key here keeps both dictionaries honest.
 */
function plural(base: 'dash.trueOf100' | 'dash.falseOf100', count: number) {
  if (count === 1) return `${base}.one` as 'dash.trueOf100.one';
  if (count >= 2 && count <= 4) return `${base}.few` as 'dash.trueOf100.few';
  return base;
}

function tone(p: number) {
  return p < 0.35 ? 'low' : p < 0.7 ? 'mid' : 'high';
}

/** The "out of 100 positive results" square — 100 tiles, green for true positives. */
function HundredGrid({ ppv }: { ppv: number }) {
  const trues = Math.round(ppv * 100);
  return (
    <div className="hundred-grid" aria-hidden="true">
      {Array.from({ length: 100 }).map((_, i) => (
        <i
          key={i}
          style={{
            background: i < trues ? OUTCOME_COLORS.truePositive : OUTCOME_COLORS.falsePositive,
            opacity: i < trues ? 1 : 0.85,
            animationDelay: `${i * 4}ms`,
          }}
        />
      ))}
    </div>
  );
}

export interface DashboardProps {
  model: ModelResult;
  /** Plain-language reading of a negative result in this scenario. */
  negativeMeans?: string;
  /** Observed values from a random run, when there is one. */
  observed?: { ppv1: number | null; ppv2: number | null } | null;
}

/** The reassuring half of the story: what a negative result is worth. */
function NegativeCard({
  model,
  negativeMeans,
}: {
  model: ModelResult;
  negativeMeans?: string;
}) {
  const { t, pct, n } = useI18n();
  // With a chain, "negative" means everyone the chain finally clears — the
  // test-1 negatives plus the people test 2 took back out of the positives.
  const npv = model.negatives.combined.npv;
  const missed = model.negatives.combined.missRate;
  const clearOf100 = Math.round(npv * 100);

  return (
    <div className="big-card negative" style={{ marginTop: 14 }}>
      <div className="stage-tag">{t('dash.negative.stage')}</div>
      <div className="headline">{t('dash.negative.headline')}</div>
      <div className="big-number high">{pct(npv, npv > 0.999 ? 3 : 1)}</div>
      <div className="given">{t('dash.negative.given')}</div>
      {negativeMeans && (
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>{negativeMeans}</p>
      )}

      <div className="hundred">
        <div className="hundred-label">{t('dash.negative.outOf')}</div>
        <div className="hundred-grid" aria-hidden="true">
          {Array.from({ length: 100 }).map((_, i) => (
            <i
              key={i}
              style={{
                background:
                  i < clearOf100 ? OUTCOME_COLORS.trueNegative : OUTCOME_COLORS.falseNegative,
                animationDelay: `${i * 4}ms`,
              }}
            />
          ))}
        </div>
        <div className="hundred-legend">
          <span className="chip">
            <i className="swatch" style={{ background: OUTCOME_COLORS.trueNegative }} />
            {t('dash.negative.clearOf100', { n: clearOf100 })}
          </span>
          <span className="chip">
            <i className="swatch" style={{ background: OUTCOME_COLORS.falseNegative }} />
            {t('dash.negative.missedOf100', { n: 100 - clearOf100 })}
          </span>
        </div>
        <div className="field-sub" style={{ marginTop: 8 }}>
          {missed > 0
            ? t('dash.negative.oneIn', { n: n(Math.round(1 / missed)) })
            : t('dash.negative.perfect')}
        </div>
      </div>

      <div className="insight" style={{ marginTop: 12 }}>
        {npv > 0.99 ? t('dash.negative.insight') : t('dash.negative.insightCommon')}
      </div>
    </div>
  );
}

export function Dashboard({ model, observed, negativeMeans }: DashboardProps) {
  const { t, pct, n } = useI18n();
  const ppv1 = model.ppv1;
  const ppv2 = model.ppv2;

  const oddsGain =
    ppv2 !== null && ppv1 > 0 && ppv1 < 1
      ? (ppv2 / (1 - ppv2)) / (ppv1 / (1 - ppv1))
      : null;

  // "99 % accurate" is the figure people are quoted; flag it whenever it is
  // flattering compared with what a positive result is actually worth.
  const accuracyTrap = model.stage1.accuracy > 0.9 && ppv1 < 0.5;

  const insight =
    ppv2 !== null
      ? t('dash.insight.confirm')
      : ppv1 < 0.4
        ? t('dash.insight.rare')
        : t('dash.insight.common');

  const Card = ({
    stage,
    value,
    given,
    obs,
    second,
  }: {
    stage: string;
    value: number;
    given: string;
    obs: number | null | undefined;
    second?: boolean;
  }) => {
    const trues = Math.round(value * 100);
    return (
      <div className={`big-card${second ? ' stage2' : ''}`}>
        <div className="stage-tag">{stage}</div>
        <div className="headline">{t('dash.headline')}</div>
        <div className={`big-number ${tone(value)}`}>{pct(value, value < 0.1 ? 2 : 1)}</div>
        <div className="given">{given}</div>

        <div className="hundred">
          <div className="hundred-label">{t('dash.outOf100')}</div>
          <HundredGrid ppv={value} />
          <div className="hundred-legend">
            <span className="chip">
              <i className="swatch" style={{ background: OUTCOME_COLORS.truePositive }} />
              {t(plural('dash.trueOf100', trues), { n: trues })}
            </span>
            <span className="chip">
              <i className="swatch" style={{ background: OUTCOME_COLORS.falsePositive }} />
              {t(plural('dash.falseOf100', 100 - trues), { n: 100 - trues })}
            </span>
          </div>
        </div>

        {obs !== undefined && (
          <div className="stat-row">
            <div className="stat">
              <span className="k">{t('dash.theoretical')}</span>
              <span className="v">{pct(value, 2)}</span>
            </div>
            <div className="stat">
              <span className="k">{t('dash.observed')}</span>
              <span className="v">{obs === null ? '—' : pct(obs, 2)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="dash">
        {model.stage1.pPositive === 0 ? (
          <div className="big-card">
            <div className="stage-tag">{t('dash.afterTest1')}</div>
            <div className="big-number low" style={{ fontSize: 40 }}>
              —
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: 0 }}>
              {t('dash.neverPositive')}
            </p>
          </div>
        ) : (
          <Card
            stage={t('dash.afterTest1')}
            value={ppv1}
            given={t('dash.given1')}
            obs={observed ? observed.ppv1 : undefined}
          />
        )}
        {ppv2 !== null && (
          <Card
            stage={t('dash.afterBoth')}
            value={ppv2}
            given={t('dash.given2')}
            obs={observed ? observed.ppv2 : undefined}
            second
          />
        )}
      </div>

      {oddsGain !== null && (
        <div className="compare-row">
          <span>{t('dash.improvement', { n: n(oddsGain, oddsGain < 100 ? 1 : 0) })}</span>
          <span className="delta">
            {pct(ppv1, 1)} → {pct(ppv2!, 1)}
          </span>
        </div>
      )}

      <NegativeCard model={model} negativeMeans={negativeMeans} />

      <div className="stat-row">
        <div className="stat">
          <span className="k">{t('dash.accuracy')}</span>
          <span className="v">{pct(model.stage1.accuracy, 2)}</span>
        </div>
        <div className="stat">
          <span className="k">P(+) — {t('flow.positive1')}</span>
          <span className="v">{pct(model.stage1.pPositive, 2)}</span>
        </div>
        <div className="stat">
          <span className="k">{t('dash.npv')}</span>
          <span className="v">{pct(model.stage1.npv, 3)}</span>
        </div>
        <div className="stat">
          <span className="k">{t('dash.missed')}</span>
          <span className="v">{pct(model.stage1.fn, 3)}</span>
        </div>
        {model.pBothPositive !== null && (
          <div className="stat">
            <span className="k">P(+₁ ∩ +₂)</span>
            <span className="v">{pct(model.pBothPositive, 3)}</span>
          </div>
        )}
      </div>

      {accuracyTrap && (
        <div className="warn" style={{ marginTop: 12 }}>
          <span aria-hidden="true">⚠</span>
          <span>
            <b style={{ display: 'block' }}>
              {t('dash.accuracy')}: {pct(model.stage1.accuracy, 2)}
            </b>
            {t('dash.accuracy.trap')}
          </span>
        </div>
      )}

      <div className="insight">
        <b>{t('dash.keyInsight')}</b>
        {insight}
      </div>
    </>
  );
}
