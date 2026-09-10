/*
 * Conditional Probability Explorer - prevalence comparison tab
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { OUTCOME_COLORS } from './Art';
import { computeModel, expectedCounts, oneInN } from '../lib/probability';
import type { ModelParams } from '../lib/types';
import { FlowDiagram } from './FlowDiagram';

const PREV_MIN = 0.0001;
const PREV_MAX = 0.5;
const toSlider = (p: number) =>
  (Math.log(p / PREV_MIN) / Math.log(PREV_MAX / PREV_MIN)) * 1000;
const fromSlider = (v: number) => PREV_MIN * Math.pow(PREV_MAX / PREV_MIN, v / 1000);

function PrevalenceSlider({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const { pct, n, t } = useI18n();
  const s = toSlider(value);
  return (
    <div className="field" style={{ marginBottom: 10 }}>
      <div className="field-head">
        <label>{label}</label>
        <span className="field-value">{pct(value, value < 0.01 ? 3 : 1)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={s}
        style={{ ['--fill' as string]: `${s / 10}%` }}
        onChange={(e) => onChange(fromSlider(Number(e.target.value)))}
        aria-label={label}
      />
      <div className="field-sub">{t('controls.oneIn', { n: n(Math.round(oneInN(value))) })}</div>
    </div>
  );
}

/** PPV as a function of prevalence, on a log x-axis, with both populations marked. */
function PpvCurve({ params, a, b }: { params: ModelParams; a: number; b: number }) {
  const { t, pct } = useI18n();
  const W = 620;
  const H = 220;
  const L = 46;
  const B = 34;

  const pts = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i <= 160; i++) {
      const p = PREV_MIN * Math.pow(PREV_MAX / PREV_MIN, i / 160);
      out.push([p, computeModel({ ...params, prevalence: p }).ppv1]);
    }
    return out;
  }, [params]);

  const x = (p: number) => L + (toSlider(p) / 1000) * (W - L - 12);
  const y = (v: number) => H - B - v * (H - B - 14);

  const d = pts.map(([p, v], i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  const marks = [
    { p: a, color: '#7c8cff', label: t('compare.a') },
    { p: b, color: '#22d3ee', label: t('compare.b') },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img"
      aria-label={t('compare.curve')}>
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - 12} y1={y(v)} y2={y(v)} stroke="#222a4d" />
          <text x={L - 8} y={y(v) + 4} fontSize="10.5" fill="#6b779c" textAnchor="end">
            {Math.round(v * 100)}%
          </text>
        </g>
      ))}
      {[0.0001, 0.001, 0.01, 0.1, 0.5].map((p) => (
        <text key={p} x={x(p)} y={H - 14} fontSize="10.5" fill="#6b779c" textAnchor="middle">
          {pct(p, p < 0.01 ? 2 : 0)}
        </text>
      ))}
      <path d={d} fill="none" stroke={OUTCOME_COLORS.truePositive} strokeWidth="2.4" />
      {marks.map((m) => {
        const v = computeModel({ ...params, prevalence: m.p }).ppv1;
        return (
          <g key={m.label}>
            <line x1={x(m.p)} x2={x(m.p)} y1={y(0)} y2={y(v)} stroke={m.color} strokeDasharray="3 3" />
            <circle cx={x(m.p)} cy={y(v)} r="5" fill={m.color} stroke="#0b1020" strokeWidth="2" />
            <text x={x(m.p) + 9} y={y(v) - 7} fontSize="11.5" fill={m.color}>
              {m.label} · {pct(v, 1)}
            </text>
          </g>
        );
      })}
      <text x={W / 2} y={H - 1} fontSize="10.5" fill="#6b779c" textAnchor="middle">
        {t('compare.axis.prevalence')}
      </text>
      <text
        x={-H / 2}
        y={12}
        fontSize="10.5"
        fill="#6b779c"
        textAnchor="middle"
        transform="rotate(-90)"
      >
        {t('compare.axis.ppv')}
      </text>
    </svg>
  );
}

export function Compare({ params }: { params: ModelParams }) {
  const { t, pct, n } = useI18n();
  const [prevA, setPrevA] = useState(0.1);
  const [prevB, setPrevB] = useState(0.001);

  const cards = [
    { key: 'a', title: t('compare.a'), prev: prevA, set: setPrevA },
    { key: 'b', title: t('compare.b'), prev: prevB, set: setPrevB },
  ];

  return (
    <div className="steps">
      <section className="panel">
        <div className="panel-title">
          <h3>{t('compare.title')}</h3>
          <button className="btn small ghost" onClick={() => { setPrevA(prevB); setPrevB(prevA); }}>
            {t('compare.swap')}
          </button>
        </div>
        <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 13.5 }}>{t('compare.intro')}</p>
        <p className="field-sub">
          {t('compare.identical', {
            se: pct(params.test1.sensitivity, 1),
            sp: pct(params.test1.specificity, 2),
          })}
        </p>

        <div className="compare-grid" style={{ marginTop: 14 }}>
          {cards.map((card) => {
            const p: ModelParams = { ...params, prevalence: card.prev, confirmatory: false };
            const m = computeModel(p);
            const c = expectedCounts({ ...p, populationSize: 10000 });
            return (
              <div className="compare-card" key={card.key}>
                <h3>
                  <span>{card.title}</span>
                  <span className="prev">{pct(card.prev, card.prev < 0.01 ? 3 : 1)}</span>
                </h3>
                <PrevalenceSlider
                  value={card.prev}
                  onChange={card.set}
                  label={t('controls.prevalence')}
                />
                <div className="hundred-label">{t('compare.ppv')}</div>
                <div
                  className={`big-number ${m.ppv1 < 0.35 ? 'low' : m.ppv1 < 0.7 ? 'mid' : 'high'}`}
                  style={{ fontSize: 44 }}
                >
                  {pct(m.ppv1, 1)}
                </div>
                <div className="given">P(D | +)</div>
                <div className="stat-row">
                  <div className="stat">
                    <span className="k">{t('outcome.truePositive')} / 10 000</span>
                    <span className="v" style={{ color: OUTCOME_COLORS.truePositive }}>
                      {n(c.tp1, 1)}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="k">{t('outcome.falsePositive')} / 10 000</span>
                    <span className="v" style={{ color: OUTCOME_COLORS.falsePositive }}>
                      {n(c.fp1, 1)}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <FlowDiagram counts={c} confirmatory={false} decimals={1} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="insight">
          <b>{t('dash.keyInsight')}</b>
          {t('compare.conclusion')}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h3>{t('compare.curve')}</h3>
          <span className="hint">{t('compare.curve.hint')}</span>
        </div>
        <PpvCurve params={params} a={prevA} b={prevB} />
      </section>
    </div>
  );
}
