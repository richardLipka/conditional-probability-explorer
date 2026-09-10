/*
 * Conditional Probability Explorer - compact funnel used in the comparison
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useI18n } from '../i18n';
import { OUTCOME_COLORS } from './Art';

export interface FlowCounts {
  population: number;
  positive1: number;
  negative1: number;
  tp1: number;
  fp1: number;
  tn1: number;
  fn1: number;
  positive2: number;
  negative2: number;
  tp2: number;
  fp2: number;
}

/**
 * The filtering funnel: whole population -> test 1 -> positives -> test 2.
 * Bar widths are proportional, so the "sliver of true positives inside a wide
 * band of false positives" is visible at a glance.
 */
export function FlowDiagram({
  counts,
  confirmatory,
  decimals = 0,
}: {
  counts: FlowCounts;
  confirmatory: boolean;
  decimals?: number;
}) {
  const { t, n } = useI18n();
  const total = Math.max(counts.population, 1);
  const pos1 = Math.max(counts.positive1, 0);
  const w = (x: number, of: number) => `${(Math.max(x, 0) / Math.max(of, 1e-9)) * 100}%`;

  const Bar = ({
    segments,
    of,
  }: {
    segments: { key: string; value: number; color: string; label: string }[];
    of: number;
  }) => (
    <div className="bar" role="img" aria-label={segments.map((s) => `${s.label}: ${n(s.value, decimals)}`).join(', ')}>
      {segments.map((s) => (
        <span
          key={s.key}
          title={`${s.label}: ${n(s.value, decimals)}`}
          style={{ width: w(s.value, of), background: s.color }}
        />
      ))}
    </div>
  );

  return (
    <div className="flow">
      <div className="flow-node">
        <div className="flow-label">{t('flow.population')}</div>
        <div className="flow-count">{n(counts.population, decimals)}</div>
      </div>
      <Bar
        of={total}
        segments={[
          { key: 'tp', value: counts.tp1, color: OUTCOME_COLORS.truePositive, label: t('outcome.truePositive') },
          { key: 'fp', value: counts.fp1, color: OUTCOME_COLORS.falsePositive, label: t('outcome.falsePositive') },
          { key: 'fn', value: counts.fn1, color: OUTCOME_COLORS.falseNegative, label: t('outcome.falseNegative') },
          { key: 'tn', value: counts.tn1, color: OUTCOME_COLORS.trueNegative, label: t('outcome.trueNegative') },
        ]}
      />
      <div className="flow-arrow">↓ {t('flow.test1')} ↓</div>
      <div className="flow-row">
        <div
          className="flow-node neg"
          style={{ flex: `${Math.max(counts.negative1, total * 0.05)} 1 0` }}
        >
          <div className="flow-label">{t('flow.negative1')}</div>
          <div className="flow-count">{n(counts.negative1, decimals)}</div>
        </div>
        <div className="flow-node pos" style={{ flex: `${Math.max(pos1, total * 0.12)} 1 0` }}>
          <div className="flow-label">{t('flow.positive1')}</div>
          <div className="flow-count">{n(pos1, decimals)}</div>
        </div>
      </div>

      <div style={{ marginLeft: 'auto', width: '100%' }}>
        <div className="field-sub" style={{ marginBottom: 4 }}>
          {t('flow.positive1')} — {n(pos1, decimals)} {t('flow.remaining')}
        </div>
        <Bar
          of={Math.max(pos1, 1e-9)}
          segments={[
            { key: 'tp', value: counts.tp1, color: OUTCOME_COLORS.truePositive, label: t('outcome.truePositive') },
            { key: 'fp', value: counts.fp1, color: OUTCOME_COLORS.falsePositive, label: t('outcome.falsePositive') },
          ]}
        />
      </div>

      {confirmatory && (
        <>
          <div className="flow-arrow">↓ {t('flow.test2')} ↓</div>
          <div className="flow-row">
            <div
              className="flow-node neg"
              style={{ flex: `${Math.max(counts.negative2, pos1 * 0.05)} 1 0` }}
            >
              <div className="flow-label">{t('flow.negative2')}</div>
              <div className="flow-count">{n(counts.negative2, decimals)}</div>
            </div>
            <div
              className="flow-node both"
              style={{ flex: `${Math.max(counts.positive2, pos1 * 0.12)} 1 0` }}
            >
              <div className="flow-label">{t('flow.positiveBoth')}</div>
              <div className="flow-count">{n(counts.positive2, decimals)}</div>
            </div>
          </div>
          <Bar
            of={Math.max(counts.positive2, 1e-9)}
            segments={[
              { key: 'tp', value: counts.tp2, color: OUTCOME_COLORS.truePositive, label: t('outcome.truePositive') },
              { key: 'fp', value: counts.fp2, color: OUTCOME_COLORS.falsePositive, label: t('outcome.falsePositive') },
            ]}
          />
        </>
      )}
    </div>
  );
}
