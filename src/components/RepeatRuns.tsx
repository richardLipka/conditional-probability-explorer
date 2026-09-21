/*
 * Conditional Probability Explorer - what one run is worth
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { observedPpv1, simulateCounts } from '../lib/simulation';
import { computeModel } from '../lib/probability';
import type { ModelParams } from '../lib/types';

/** Matches the population presets in the parameter panel. */
const ROWS = [100, 1000, 10000];
const RUNS = 100;

const W = 640;
const L = 92;
const R = 14;
const SPAN = W - L - R;
const ROW_H = 56;
const STACK = 38;
const TOP = 26;
const BUCKET = 4;

const TICK = '#7c8cff';
const THEORY = '#22d3ee';
const MINE = '#e8ecf8';
const AXIS = '#222a4d';
const LABEL = '#6b779c';

/**
 * The same settings, run a hundred times, at three population sizes.
 *
 * This answers the question the dashboard provokes two lines above it: the
 * theoretical figure and the observed one disagree, so which one is wrong.
 * Neither. One run is one sample, and the spread of the samples is the answer.
 *
 * It is also the base-rate lesson wearing different clothes. A positive result
 * means little for a rare condition because the true positives are a tiny count
 * swamped by false ones — and the estimate wobbles for exactly that reason, the
 * same tiny count. At a hundred people it stops being an estimate at all.
 */
export function RepeatRuns({
  params,
  seed,
  yourRun,
}: {
  params: ModelParams;
  seed: number;
  /** Where the run the reader actually watched landed, if it had any positives. */
  yourRun: number | null;
}) {
  const { t, n: num, pct } = useI18n();

  const theory = useMemo(() => computeModel({ ...params, confirmatory: false }).ppv1, [params]);

  const rows = useMemo(() => {
    // Test 2 is left out on purpose: this chart is about P(D | +₁), and running
    // a second test would consume draws without changing what is plotted.
    const base: ModelParams = { ...params, confirmatory: false };
    return ROWS.map((pop) => {
      const p: ModelParams = { ...base, populationSize: pop };
      const values: number[] = [];
      let none = 0;
      // Seeds run on from the reader's own seed, so the picture is reproducible
      // and a shared link shows a whole class the same thing.
      for (let i = 0; i < RUNS; i++) {
        const v = observedPpv1(simulateCounts(p, seed + i));
        if (v === null) none++;
        else values.push(v);
      }
      return { pop, values, none };
    });
    // Population is deliberately absent: the rows set their own. Test 2 and the
    // dependence slider cannot move P(D | +₁), so they are absent too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.prevalence, params.test1.sensitivity, params.test1.specificity, seed]);

  const x = (v: number) => L + Math.max(0, Math.min(1, v)) * SPAN;
  const baseline = (i: number) => TOP + STACK + i * ROW_H;
  const height = TOP + STACK + (ROWS.length - 1) * ROW_H + 40;
  const empties = rows.filter((r) => r.none > 0);

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        style={{ width: '100%', height: 'auto' }}
        role="img"
        aria-label={t('repeat.axis')}
      >
        {/* What the theory predicts, straight through every row. */}
        <line
          x1={x(theory)}
          x2={x(theory)}
          y1={TOP - 12}
          y2={baseline(ROWS.length - 1) + 6}
          stroke={THEORY}
          strokeWidth="1.4"
          strokeDasharray="4 3"
        />
        <text
          x={x(theory) + (theory > 0.8 ? -5 : 5)}
          y={TOP - 15}
          fontSize="11"
          fill={THEORY}
          textAnchor={theory > 0.8 ? 'end' : 'start'}
        >
          {t('repeat.theory')} {pct(theory, 1)}
        </text>

        {rows.map((row, i) => {
          const y0 = baseline(i);
          const mine = row.pop === params.populationSize ? yourRun : null;

          // One tick per run, stacked where several land in the same column. The
          // pitch shrinks to fit, so a pile-up at 0 % cannot run off the top.
          const columns = new Map<number, number>();
          for (const v of row.values) {
            const c = Math.round((x(v) - L) / BUCKET);
            columns.set(c, (columns.get(c) ?? 0) + 1);
          }
          const tallest = Math.max(1, ...columns.values());
          const pitch = Math.min(4, STACK / tallest);
          const tickH = Math.max(0.9, pitch - 0.8);

          return (
            <g key={row.pop}>
              <line x1={L} x2={W - R} y1={y0} y2={y0} stroke={AXIS} />
              <text x={L - 10} y={y0 - 3} fontSize="11.5" fill="#e8ecf8" textAnchor="end">
                {t('repeat.people', { n: num(row.pop) })}
              </text>
              {row.pop === params.populationSize && (
                <text x={L - 10} y={y0 + 11} fontSize="10" fill={LABEL} textAnchor="end">
                  {t('repeat.yourSetting')}
                </text>
              )}

              {[...columns.entries()].map(([c, k]) =>
                Array.from({ length: k }).map((_, j) => (
                  <rect
                    key={`${c}-${j}`}
                    x={L + c * BUCKET - BUCKET / 2 + 0.5}
                    y={y0 - (j + 1) * pitch}
                    width={BUCKET - 1}
                    height={tickH}
                    fill={TICK}
                    opacity={0.85}
                  />
                )),
              )}

              {mine !== null && (
                <g>
                  <path d={`M${x(mine)} ${y0 + 3}l4.5 7h-9z`} fill={MINE} />
                  <text
                    x={x(mine) + (mine > 0.8 ? -7 : 7)}
                    y={y0 + 12}
                    fontSize="10"
                    fill={MINE}
                    textAnchor={mine > 0.8 ? 'end' : 'start'}
                  >
                    {t('repeat.yours')}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* One axis under all three rows, so the widths can be compared. */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text
            key={v}
            x={x(v)}
            y={height - 16}
            fontSize="10.5"
            fill={LABEL}
            textAnchor={v === 0 ? 'start' : v === 1 ? 'end' : 'middle'}
          >
            {pct(v, 0)}
          </text>
        ))}
        <text x={W / 2} y={height - 2} fontSize="10.5" fill={LABEL} textAnchor="middle">
          {t('repeat.axis')}
        </text>
      </svg>

      <p className="field-sub" style={{ marginTop: 2 }}>
        {t('repeat.tick', { n: num(RUNS) })}
      </p>

      {/* Runs that produced no answer at all. The point, not an aside. */}
      {empties.length > 0 && (
        <div className="note" style={{ marginTop: 10, display: 'grid', gap: 4 }}>
          {empties.map((r) => (
            <span key={r.pop}>
              {t('repeat.none', { pop: num(r.pop), n: num(r.none), runs: num(RUNS) })}
            </span>
          ))}
        </div>
      )}

      <div className="insight" style={{ marginTop: 12 }}>
        {t('repeat.insight')}
      </div>
    </>
  );
}
