/*
 * Conditional Probability Explorer - the four outcomes in the scenario language
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useI18n } from '../i18n';
import { Glyph, OUTCOME_COLORS } from './Art';
import type { Scenario } from '../lib/scenario';
import type { Outcome } from '../lib/types';

const ORDER: Outcome[] = ['truePositive', 'falsePositive', 'falseNegative', 'trueNegative'];

export interface OutcomeMeaningsProps {
  scenario: Scenario;
  /** Null until a run has produced some. The wording stands on its own. */
  counts: Record<Outcome, number> | null;
  decimals?: number;
}

/**
 * The four cells of the confusion matrix, spelled out in the language of the
 * scenario. "False positive" is an abstraction; "an innocent traveller pulled
 * aside for questioning" is not.
 */
export function OutcomeMeanings({ scenario, counts, decimals = 0 }: OutcomeMeaningsProps) {
  const { t, n, lang } = useI18n();

  return (
    <section className="panel">
      <div className="panel-title">
        <h3>{t('scenario.outcomes')}</h3>
      </div>

      <div className="meaning-pair">
        <div>
          <span className="k">{t('scenario.positiveMeans')}</span>
          <p>{scenario.positiveMeans[lang]}</p>
        </div>
        <div>
          <span className="k">{t('scenario.negativeMeans')}</span>
          <p>{scenario.negativeMeans[lang]}</p>
        </div>
      </div>

      <div className="meanings">
        {ORDER.map((key) => (
          <article className="meaning" key={key} style={{ borderTopColor: OUTCOME_COLORS[key] }}>
            <header>
              <Glyph kind={key} />
              <strong>{t(`outcome.${key}`)}</strong>
              {counts && <span className="count">{n(counts[key], decimals)}</span>}
            </header>
            <p>{scenario.outcomes[key][lang]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
