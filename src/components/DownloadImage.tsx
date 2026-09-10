/*
 * Conditional Probability Explorer - image export control
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useState } from 'react';
import { useI18n } from '../i18n';
import { OUTCOME_COLORS } from './Art';
import { exportVisual, slug, type LegendEntry } from '../lib/exportImage';
import type { ModelParams } from '../lib/types';

export interface DownloadImageProps {
  /** Resolved at click time, because the canvas/svg is drawn by a sibling. */
  target: () => Element | Element[] | null;
  title: string;
  subtitle?: string;
  params: ModelParams;
  counts: { tp1: number; fp1: number; fn1: number; tn1: number };
  decimals?: number;
  filenameHint: string;
}

/**
 * Saves the picture next to it as a PNG that still explains itself: title,
 * legend with the counts, and the parameters it came from.
 */
export function DownloadImage({
  target,
  title,
  subtitle,
  params,
  counts,
  decimals = 0,
  filenameHint,
}: DownloadImageProps) {
  const { t, n, pct } = useI18n();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const found = target();
    const els = (Array.isArray(found) ? found : found ? [found] : []).filter(Boolean);
    if (!els.length || busy) return;
    setBusy(true);
    try {
      const legend: LegendEntry[] = [
        {
          color: OUTCOME_COLORS.truePositive,
          label: t('outcome.truePositive'),
          value: n(counts.tp1, decimals),
          shape: 'circle',
        },
        {
          color: OUTCOME_COLORS.falsePositive,
          label: t('outcome.falsePositive'),
          value: n(counts.fp1, decimals),
          shape: 'square',
        },
        {
          color: OUTCOME_COLORS.falseNegative,
          label: t('outcome.falseNegative'),
          value: n(counts.fn1, decimals),
          shape: 'triangle',
        },
        {
          color: OUTCOME_COLORS.trueNegative,
          label: t('outcome.trueNegative'),
          value: n(counts.tn1, decimals),
          shape: 'diamond',
        },
      ];

      const second = params.confirmatory
        ? t('export.params.second', {
            se2: pct(params.test2.sensitivity, 1),
            sp2: pct(params.test2.specificity, 2),
          })
        : '';

      await exportVisual(els as (HTMLCanvasElement | SVGSVGElement)[], {
        title,
        subtitle,
        legend,
        footer: t('export.params', {
          n: n(params.populationSize),
          prev: pct(params.prevalence, params.prevalence < 0.01 ? 3 : 1),
          se: pct(params.test1.sensitivity, 1),
          sp: pct(params.test1.specificity, 2),
          second,
        }),
        credit: t('export.credit'),
        filename: `${slug(filenameHint)}.png`,
      });
    } finally {
      setBusy(false);
    }
  };

  // A quiet affordance parked in the corner of the picture: present when you
  // look for it, out of the way when you are reading the visualisation.
  return (
    <button
      className="download-icon"
      onClick={save}
      disabled={busy}
      title={t('export.image')}
      aria-label={t('export.image')}
    >
      {busy ? '…' : '⤓'}
    </button>
  );
}
