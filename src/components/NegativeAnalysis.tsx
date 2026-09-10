/*
 * Conditional Probability Explorer - where the negative results come from
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useI18n } from '../i18n';
import { OUTCOME_COLORS } from './Art';
import { negativeGroups, type CountsLike, type NegativeGroup } from '../lib/probability';
import { Math as Tex } from './Math';

export interface NegativeAnalysisProps {
  counts: CountsLike;
  /** Only meaningful when a second test is actually run. */
  confirmatory: boolean;
  decimals?: number;
}

/**
 * Where the negative results come from when two tests are chained.
 *
 * The positive side gets all the attention, but a confirmatory test can only
 * remove people from the positive pile — so every genuine case it clears stops
 * being a true positive and becomes a new missed case. This panel puts the
 * three negative groups side by side so that cost is visible.
 */
export function NegativeAnalysis({ counts, confirmatory, decimals = 0 }: NegativeAnalysisProps) {
  const { t, n, pct } = useI18n();
  if (!confirmatory) return null;

  const g = negativeGroups(counts, true);
  const { cases } = g;

  const Group = ({
    group,
    title,
    hint,
    accent,
    strong,
    tex,
  }: {
    group: NegativeGroup;
    title: string;
    hint: string;
    accent: string;
    strong?: boolean;
    tex?: string;
  }) => (
    <article className={`neg-group${strong ? ' total' : ''}`} style={{ borderTopColor: accent }}>
      <header>
        <strong>{title}</strong>
        <span>{hint}</span>
      </header>
      {tex && (
        <div className="neg-tex">
          <Tex tex={tex} />
        </div>
      )}
      <div className="neg-total">{n(group.total, decimals)}</div>
      <dl>
        <div>
          <dt>{t('neg.missed')}</dt>
          <dd style={{ color: OUTCOME_COLORS.falseNegative }}>{n(group.missed, decimals)}</dd>
        </div>
        <div>
          <dt>{t('neg.clear')}</dt>
          <dd>{pct(group.npv, group.npv > 0.999 ? 3 : 2)}</dd>
        </div>
        <div>
          <dt>{t('neg.risk')}</dt>
          <dd>
            {group.missRate > 0
              ? t('neg.oneIn', { n: n(Math.round(1 / group.missRate)) })
              : t('neg.none')}
          </dd>
        </div>
      </dl>
    </article>
  );

  const bar = (v: number) => `${(cases.total > 0 ? (v / cases.total) * 100 : 0).toFixed(2)}%`;

  return (
    <section className="panel">
      <div className="panel-title">
        <h3>{t('neg.title')}</h3>
        <span className="hint">{t('neg.hint')}</span>
      </div>

      <div className="neg-groups">
        <Group
          group={g.stage1}
          title={t('neg.stage1')}
          hint={t('neg.stage1.hint')}
          accent={OUTCOME_COLORS.trueNegative}
          tex="P(D \mid -_1)"
        />
        <Group
          group={g.stage2!}
          title={t('neg.stage2')}
          hint={t('neg.stage2.hint')}
          accent={OUTCOME_COLORS.falseNegative}
          tex="P(D \mid +_1 \cap -_2)"
        />
        <Group
          group={g.combined}
          title={t('neg.combined')}
          hint={t('neg.combined.hint')}
          accent="#7c8cff"
          strong
          tex="P(D \mid \text{declared negative})"
        />
      </div>

      <div className="ledger">
        <div className="hundred-label">{t('neg.ledger', { n: n(cases.total, decimals) })}</div>
        <div className="bar" role="img" aria-label={t('neg.title')}>
          <span style={{ width: bar(cases.found), background: OUTCOME_COLORS.truePositive }} />
          <span style={{ width: bar(cases.missedAt1), background: OUTCOME_COLORS.trueNegative }} />
          <span style={{ width: bar(cases.missedAt2), background: OUTCOME_COLORS.falseNegative }} />
        </div>
        <ul className="ledger-list">
          <li>
            <i style={{ background: OUTCOME_COLORS.truePositive }} />
            {t('neg.ledger.found', { n: n(cases.found, decimals) })}
          </li>
          <li>
            <i style={{ background: OUTCOME_COLORS.trueNegative }} />
            {t('neg.ledger.missed1', { n: n(cases.missedAt1, decimals) })}
          </li>
          <li>
            <i style={{ background: OUTCOME_COLORS.falseNegative }} />
            {t('neg.ledger.missed2', { n: n(cases.missedAt2, decimals) })}
            <em>{t('neg.ledger.cost')}</em>
          </li>
        </ul>
      </div>
    </section>
  );
}
