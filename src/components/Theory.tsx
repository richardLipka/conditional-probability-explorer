/*
 * Conditional Probability Explorer - theory tab
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { OUTCOME_COLORS, Glyph } from './Art';
import { StreamDiagram } from './StreamDiagram';
import { DownloadImage } from './DownloadImage';
import { NegativeAnalysis } from './NegativeAnalysis';
import { Math as Tex, SvgTex, texNum, term, termFromEvent, type TermKey } from './Math';
import { StepNav, type Step } from './StepNav';
import { computeModel, expectedCounts, positiveLikelihoodRatio } from '../lib/probability';
import type { ModelParams, Outcome } from '../lib/types';
import type { Scenario } from '../lib/scenario';

const FREQ_SIZES = [100, 1000, 10000];

/**
 * The same four silhouettes the legend and the simulation use, so a reader who
 * cannot separate the colours can still separate the groups.
 */
const ICON_SHAPE = {
  tp: { borderRadius: '50%' },
  fp: { borderRadius: 2 },
  fn: { clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' },
  tn: { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
} as const;

/** What the table is currently conditioned on. */
type Given = 'none' | 'pos' | 'neg' | 'cond' | 'nocond';

/** A branching probability tree drawn with proportional branch weights. */
function ProbabilityTree({
  params,
  highlight,
}: {
  params: ModelParams;
  highlight: TermKey | null;
}) {
  const { t, pct } = useI18n();
  const m = computeModel(params);
  const p = params.prevalence;
  const se = params.test1.sensitivity;
  const sp = params.test1.specificity;

  const W = 720;
  const H = 300;
  const x0 = 12;
  const x1 = 250;
  const x2 = 520;
  const yRoot = H / 2;
  const yD = 78;
  const yND = 214;

  const leaves: { y: number; w: number; color: string; label: string; from: number; expr: string; key: TermKey }[] = [
    { y: 40, w: m.stage1.tp, color: OUTCOME_COLORS.truePositive, label: t('outcome.truePositive'), from: yD, expr: 'P(D)\\,P(+ \\mid D)', key: 'tp' },
    { y: 112, w: m.stage1.fn, color: OUTCOME_COLORS.falseNegative, label: t('outcome.falseNegative'), from: yD, expr: 'P(D)\\,P(- \\mid D)', key: 'fn' },
    { y: 190, w: m.stage1.fp, color: OUTCOME_COLORS.falsePositive, label: t('outcome.falsePositive'), from: yND, expr: 'P(\\neg D)\\,P(+ \\mid \\neg D)', key: 'fp' },
    { y: 262, w: m.stage1.tn, color: OUTCOME_COLORS.trueNegative, label: t('outcome.trueNegative'), from: yND, expr: 'P(\\neg D)\\,P(- \\mid \\neg D)', key: 'tn' },
  ];

  const stroke = (w: number) => globalThis.Math.max(1.2, globalThis.Math.sqrt(w) * 13);
  // Dim whatever the reader is not pointing at, so the link between a symbol
  // in the formula and a branch of the tree is unmistakable.
  const dim = (keys: TermKey[]) => (highlight === null || keys.includes(highlight) ? 1 : 0.18);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img"
      aria-label={t('theory.step2')}>
      <path d={`M${x0 + 60} ${yRoot} C${x1 - 60} ${yRoot}, ${x1 - 60} ${yD}, ${x1} ${yD}`}
        fill="none" stroke={OUTCOME_COLORS.cond} strokeWidth={stroke(p)}
        opacity={0.75 * dim(['cond', 'tp', 'fn'])} />
      <path d={`M${x0 + 60} ${yRoot} C${x1 - 60} ${yRoot}, ${x1 - 60} ${yND}, ${x1} ${yND}`}
        fill="none" stroke={OUTCOME_COLORS.nocond} strokeWidth={stroke(1 - p)}
        opacity={0.75 * dim(['nocond', 'fp', 'tn'])} />
      {leaves.map((l, i) => (
        <path key={i}
          d={`M${x1 + 70} ${l.from} C${x2 - 70} ${l.from}, ${x2 - 70} ${l.y}, ${x2} ${l.y}`}
          fill="none" stroke={l.color} strokeWidth={stroke(l.w)}
          opacity={0.8 * dim([l.key, l.key === 'tp' || l.key === 'fp' ? 'pos' : 'neg'])} />
      ))}

      <circle cx={x0 + 26} cy={yRoot} r="16" fill="#1b2444" stroke="#3d4a86" />
      <text x={x0 + 26} y={yRoot + 4} textAnchor="middle" fontSize="11" fill="#9aa6c8">N</text>

      <g fontSize="12" fill="#e8ecf8">
        <text x={x1 + 4} y={yD - 8}>D — {t('outcome.hasCondition')}</text>
        <text x={x1 + 4} y={yND - 8}>¬D — {t('outcome.noCondition')}</text>
      </g>
      <SvgTex x={x1 + 4} y={yD + 1} tex={`P(D) = ${texNum(pct(p, 3))}`} />
      <SvgTex x={x1 + 4} y={yND + 1} tex={`P(\\neg D) = ${texNum(pct(1 - p, 3))}`} />

      <SvgTex align="middle" x={(x1 + 70 + x2) / 2} y={46} tex={`P(+ \\mid D) = ${texNum(pct(se, 1))}`} />
      <SvgTex align="middle" x={(x1 + 70 + x2) / 2} y={120} tex={`P(- \\mid D) = ${texNum(pct(1 - se, 1))}`} />
      <SvgTex align="middle" x={(x1 + 70 + x2) / 2} y={170} tex={`P(+ \\mid \\neg D) = ${texNum(pct(1 - sp, 2))}`} />
      <SvgTex align="middle" x={(x1 + 70 + x2) / 2} y={270} tex={`P(- \\mid \\neg D) = ${texNum(pct(sp, 2))}`} />

      {leaves.map((l, i) => (
        <g key={i} opacity={dim([l.key])}>
          <text x={x2 + 10} y={l.y - 3} fontSize="12" fill={l.color}>{l.label}</text>
          <SvgTex x={x2 + 10} y={l.y + 2} color={l.color} tex={texNum(pct(l.w, 4))} />
          <SvgTex x={x2 + 10} y={l.y + 17} size={10.5} tex={l.expr} />
        </g>
      ))}
    </svg>
  );
}

export function Theory({ params, scenario }: { params: ModelParams; scenario: Scenario }) {
  const { t, n, pct, lang } = useI18n();
  const [freqSize, setFreqSize] = useState(10000);
  const [given, setGiven] = useState<Given>('none');
  const [highlight, setHighlight] = useState<TermKey | null>(null);

  const steps: Step[] = useMemo(
    () => [
      { id: 'th-flow', label: t('theory.nav.flow') },
      { id: 'th-frequencies', label: t('theory.step1'), n: 1 },
      { id: 'th-tree', label: t('theory.step2'), n: 2 },
      { id: 'th-table', label: t('theory.step3'), n: 3 },
      { id: 'th-confusion', label: t('theory.nav.confusion') },
      { id: 'th-formula', label: t('theory.step4'), n: 4 },
      { id: 'th-chain', label: t('theory.chain'), n: 5 },
      // NegativeAnalysis draws nothing without a second test, so the rail
      // must not offer a chip that scrolls to an empty anchor.
      ...(params.confirmatory
        ? [{ id: 'th-negatives', label: t('theory.nav.negatives') }]
        : []),
      { id: 'th-refclass', label: t('theory.nav.refclass') },
    ],
    [t, params.confirmatory],
  );

  const m = useMemo(() => computeModel(params), [params]);
  const c = useMemo(
    () => expectedCounts({ ...params, populationSize: freqSize }),
    [params, freqSize],
  );

  const lr1 = positiveLikelihoodRatio(params.test1);
  const lr2 = positiveLikelihoodRatio(m.effectiveTest2);
  const round = (x: number) => globalThis.Math.round(x * 10) / 10;
  const odds = params.prevalence / globalThis.Math.max(1 - params.prevalence, 1e-12);
  const chainedOdds = odds * lr1 * lr2;
  const chained = Number.isFinite(chainedOdds) ? chainedOdds / (1 + chainedOdds) : null;

  // A compact icon array for the natural-frequency picture (capped for legibility).
  const iconTotal = globalThis.Math.min(freqSize, 1000);
  const scale = iconTotal / freqSize;
  const iconTp = globalThis.Math.max(c.tp1 > 0 ? 1 : 0, globalThis.Math.round(c.tp1 * scale));
  const iconFp = globalThis.Math.max(c.fp1 > 0 ? 1 : 0, globalThis.Math.round(c.fp1 * scale));
  const iconFn = globalThis.Math.round(c.fn1 * scale);
  const iconTn = globalThis.Math.max(0, iconTotal - iconTp - iconFp - iconFn);

  /* ------------------------------------------------- the conditioning table */

  const cells: Record<Outcome, number> = {
    truePositive: c.tp1,
    falseNegative: c.fn1,
    falsePositive: c.fp1,
    trueNegative: c.tn1,
  };
  const groups: Record<Exclude<Given, 'none'>, { members: Outcome[]; total: number; label: string; tex: string }> = {
    pos: { members: ['truePositive', 'falsePositive'], total: c.positive1, label: t('flow.positive'), tex: '+' },
    neg: { members: ['falseNegative', 'trueNegative'], total: c.negative1, label: t('flow.negative'), tex: '-' },
    cond: { members: ['truePositive', 'falseNegative'], total: c.withCondition, label: t('outcome.hasCondition'), tex: 'D' },
    nocond: { members: ['falsePositive', 'trueNegative'], total: c.withoutCondition, label: t('outcome.noCondition'), tex: '\\neg D' },
  };
  const active = given === 'none' ? null : groups[given];
  const inGroup = (k: Outcome) => !active || active.members.includes(k);

  const cellText = (k: Outcome) => {
    if (!active) return n(cells[k], 1);
    if (!active.members.includes(k)) return n(cells[k], 1);
    return pct(active.total > 0 ? cells[k] / active.total : 0, 2);
  };

  const cellClass = (k: Outcome, base: string) =>
    `${base}${active && !inGroup(k) ? ' muted-cell' : ''}${highlight === termOf(k) ? ' lit' : ''}`;

  const toggle = (g: Exclude<Given, 'none'>) => setGiven((cur) => (cur === g ? 'none' : g));

  return (
    <div
      className="steps"
      onMouseOver={(e) => setHighlight(termFromEvent(e.target))}
      onMouseLeave={() => setHighlight(null)}
    >
      <StepNav
        steps={steps}
        label={t('theory.nav.label')}
        progress={(cur, total) => t('theory.nav.progress', { n: cur, total })}
      />

      <section className="panel" id="th-flow">
        <div className="panel-title">
          <h3>{t('theory.flow')}</h3>
        </div>
        <div className="field-sub" style={{ marginBottom: 8 }}>
          {t('theory.flow.hint')}
        </div>
        <div className="theory-stream visual">
          <StreamDiagram
            counts={c}
            confirmatory={params.confirmatory}
            phase="done"
            sweepMs={0}
            decimals={1}
          />
          <DownloadImage
            target={() => [...document.querySelectorAll('.theory-stream svg')]}
            title={`${scenario.name[lang]} — ${t('export.theory')}`}
            subtitle={scenario.question[lang]}
            params={params}
            counts={c}
            decimals={1}
            filenameHint={`${scenario.id}-expected-flow`}
          />
        </div>
      </section>

      <section className="panel" id="th-frequencies">
        <div className="panel-title">
          <h3>{t('theory.title')}</h3>
          <span className="hint">{t('nav.theory.desc')}</span>
        </div>
        <div className="step-badge"><i>1</i>{t('theory.step1')}</div>
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <div className="seg" role="group" aria-label={t('theory.step1')}>
            {FREQ_SIZES.map((s) => (
              <button key={s} aria-pressed={freqSize === s} onClick={() => setFreqSize(s)}>
                {n(s)}
              </button>
            ))}
          </div>
        </div>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          {t('theory.freq.intro', { n: n(freqSize) })}
        </p>

        <div className="freq-people" aria-hidden="true">
          {[
            { k: 'tp', c: iconTp, color: OUTCOME_COLORS.truePositive },
            { k: 'fn', c: iconFn, color: OUTCOME_COLORS.falseNegative },
            { k: 'fp', c: iconFp, color: OUTCOME_COLORS.falsePositive },
            { k: 'tn', c: iconTn, color: OUTCOME_COLORS.trueNegative },
          ].flatMap((g) =>
            Array.from({ length: g.c }).map((_, i) => (
              <span
                key={`${g.k}-${i}`}
                style={{
                  width: 8,
                  height: 8,
                  background: g.color,
                  display: 'block',
                  ...ICON_SHAPE[g.k as keyof typeof ICON_SHAPE],
                }}
              />
            )),
          )}
        </div>

        <ul style={{ color: 'var(--muted)', fontSize: 13.5, paddingLeft: 18 }}>
          <li>
            <span style={{ color: OUTCOME_COLORS.cond, fontWeight: 600 }}>
              {t('theory.freq.have', { n: n(c.withCondition, 1) })}
            </span>{' '}
            —{' '}
            <b style={{ color: OUTCOME_COLORS.truePositive }}>{n(c.tp1, 1)}</b>{' '}
            {t('theory.freq.tp')}
          </li>
          <li>
            <span style={{ fontWeight: 600 }}>
              {t('theory.freq.havent', { n: n(c.withoutCondition, 1) })}
            </span>{' '}
            —{' '}
            <b style={{ color: OUTCOME_COLORS.falsePositive }}>{n(c.fp1, 1)}</b>{' '}
            {t('theory.freq.fp')}
          </li>
        </ul>
        <p style={{ fontSize: 14 }}>
          {t('theory.freq.conclusion', {
            pos: n(c.positive1, 1),
            tp: n(c.tp1, 1),
            ppv: pct(m.ppv1, 2),
          })}
        </p>
      </section>

      <section className="panel" id="th-tree">
        <div className="step-badge"><i>2</i>{t('theory.step2')}</div>
        <div className="theory-tree visual">
          <ProbabilityTree params={params} highlight={highlight} />
          <DownloadImage
            target={() => [...document.querySelectorAll('.theory-tree svg')]}
            title={`${scenario.name[lang]} — ${t('export.tree')}`}
            subtitle={scenario.question[lang]}
            params={params}
            counts={c}
            decimals={1}
            filenameHint={`${scenario.id}-tree`}
          />
        </div>
      </section>

      <section className="panel" id="th-table">
        <div className="step-badge"><i>3</i>{t('theory.step3')}</div>
        <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 13.5 }}>
          {t('theory.table.howto')}
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className={`ct${active ? ' conditioned' : ''}`}>
            <thead>
              <tr>
                <th>
                  {t('theory.table.truth')} \ {t('theory.table.observed')}
                </th>
                <th>
                  <button
                    className={`ct-head${given === 'pos' ? ' on' : ''}`}
                    onClick={() => toggle('pos')}
                    aria-pressed={given === 'pos'}
                  >
                    {t('flow.positive')}
                  </button>
                </th>
                <th>
                  <button
                    className={`ct-head${given === 'neg' ? ' on' : ''}`}
                    onClick={() => toggle('neg')}
                    aria-pressed={given === 'neg'}
                  >
                    {t('flow.negative')}
                  </button>
                </th>
                <th style={{ textAlign: 'right' }}>{t('theory.table.total')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>
                  <button
                    className={`ct-head${given === 'cond' ? ' on' : ''}`}
                    onClick={() => toggle('cond')}
                    aria-pressed={given === 'cond'}
                  >
                    {t('outcome.hasCondition')}
                  </button>
                </th>
                <td className={cellClass('truePositive', 'cell-tp')}>{cellText('truePositive')}</td>
                <td className={cellClass('falseNegative', 'cell-fn')}>{cellText('falseNegative')}</td>
                <td>{n(c.withCondition, 1)}</td>
              </tr>
              <tr>
                <th>
                  <button
                    className={`ct-head${given === 'nocond' ? ' on' : ''}`}
                    onClick={() => toggle('nocond')}
                    aria-pressed={given === 'nocond'}
                  >
                    {t('outcome.noCondition')}
                  </button>
                </th>
                <td className={cellClass('falsePositive', 'cell-fp')}>{cellText('falsePositive')}</td>
                <td className={cellClass('trueNegative', 'cell-tn')}>{cellText('trueNegative')}</td>
                <td>{n(c.withoutCondition, 1)}</td>
              </tr>
              <tr className="total">
                <th>{t('theory.table.total')}</th>
                <td>{n(c.positive1, 1)}</td>
                <td>{n(c.negative1, 1)}</td>
                <td>{n(c.population, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {active ? (
          <div className="conditioning">
            <div className="conditioning-head">
              <span className="badge">
                {t('theory.table.now', { group: active.label, n: n(active.total, 1) })}
              </span>
              <button className="btn small ghost" onClick={() => setGiven('none')}>
                {t('theory.table.reset')}
              </button>
            </div>
            <p>{t('theory.table.restrict')}</p>
            <Tex
              display
              tex={
                given === 'pos'
                  ? `P(D \\mid +) = \\frac{P(D \\cap +)}{P(+)} = \\frac{${n(c.tp1, 1)}}{${n(c.positive1, 1)}} = ${pct(m.ppv1, 2).replace('%', '\\%')}`
                  : given === 'cond'
                    ? `P(+ \\mid D) = \\frac{P(+ \\cap D)}{P(D)} = \\frac{${n(c.tp1, 1)}}{${n(c.withCondition, 1)}} = ${pct(params.test1.sensitivity, 1).replace('%', '\\%')}`
                    : given === 'neg'
                      ? `P(\\neg D \\mid -) = \\frac{P(\\neg D \\cap -)}{P(-)} = \\frac{${n(c.tn1, 1)}}{${n(c.negative1, 1)}} = ${pct(m.stage1.npv, 3).replace('%', '\\%')}`
                      : `P(- \\mid \\neg D) = \\frac{P(- \\cap \\neg D)}{P(\\neg D)} = \\frac{${n(c.tn1, 1)}}{${n(c.withoutCondition, 1)}} = ${pct(params.test1.specificity, 2).replace('%', '\\%')}`
              }
            />
            {(given === 'pos' || given === 'cond') && (
              <div className="warn">
                <span aria-hidden="true">⚠</span>
                <span>
                  {t('theory.table.sameNumerator')}{' '}
                  <Tex tex="P(+ \mid D)" /> {t('theory.table.versus')}{' '}
                  <Tex tex="P(D \mid +)" />.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="field-sub">{t('theory.table.hint')}</div>
        )}

        <div className="legend">
          {(['truePositive', 'falsePositive', 'falseNegative', 'trueNegative'] as const).map((k) => (
            <span className="legend-item" key={k}>
              <Glyph kind={k} />
              <b>{t(`outcome.${k}`)}</b> — {t(`outcome.${k}.desc`)}
            </span>
          ))}
        </div>
      </section>

      <section className="panel" id="th-confusion">
        <h3>{t('theory.confusion.title')}</h3>
        <div className="confusion">
          <div className="confusion-card a">
            <div className="expr">
              <Tex tex="P(+ \mid D)" />
            </div>
            <div className="val">{pct(params.test1.sensitivity, 1)}</div>
            <p>{t('theory.confusion.pPosGivenD.label')}</p>
          </div>
          <div className="confusion-card b">
            <div className="expr">
              <Tex tex="P(D \mid +)" />
            </div>
            <div className="val">{pct(m.ppv1, 2)}</div>
            <p>{t('theory.confusion.pDGivenPos.label')}</p>
          </div>
        </div>
        <div className="warn">
          <span aria-hidden="true">⚠</span>
          <span>{t('theory.confusion.warning')}</span>
        </div>
      </section>

      <section className="panel" id="th-formula">
        <div className="step-badge"><i>4</i>{t('theory.step4')}</div>
        <p className="field-sub" style={{ marginTop: 0 }}>{t('theory.hoverHint')}</p>

        <h4 className="formula-title">{t('theory.formula.total')}</h4>
        <Tex
          display
          tex={`P(+) = ${term('tp', 'P(+ \\mid D)\\,P(D)')} + ${term('fp', 'P(+ \\mid \\neg D)\\,P(\\neg D)')}`}
        />
        <Tex
          display
          tex={`\\phantom{P(+)} = ${term('tp', `${pct(params.test1.sensitivity, 1).replace('%', '\\%')} \\cdot ${pct(params.prevalence, 3).replace('%', '\\%')}`)} + ${term('fp', `${pct(1 - params.test1.specificity, 2).replace('%', '\\%')} \\cdot ${pct(1 - params.prevalence, 3).replace('%', '\\%')}`)} = ${pct(m.stage1.pPositive, 4).replace('%', '\\%')}`}
        />

        <h4 className="formula-title">{t('theory.formula.bayes')}</h4>
        <Tex
          display
          tex={`P(D \\mid +) = \\frac{${term('tp', 'P(+ \\mid D)\\,P(D)')}}{${term('pos', 'P(+)')}} = \\frac{${term('tp', pct(m.stage1.tp, 4).replace('%', '\\%'))}}{${term('pos', pct(m.stage1.pPositive, 4).replace('%', '\\%'))}} = \\mathbf{${pct(m.ppv1, 3).replace('%', '\\%')}}`}
        />

        <h4 className="formula-title">{t('theory.formula.negative')}</h4>
        <Tex
          display
          tex={`P(\\neg D \\mid -) = \\frac{${term('tn', 'P(- \\mid \\neg D)\\,P(\\neg D)')}}{${term('neg', 'P(-)')}} = \\mathbf{${pct(m.stage1.npv, 3).replace('%', '\\%')}}`}
        />

        {params.confirmatory && (
          <>
            <h4 className="formula-title">{t('theory.formula.cleared')}</h4>
            <p className="field-sub" style={{ marginTop: -4 }}>{t('theory.formula.cleared.hint')}</p>
            <Tex
              display
              tex={`P(D \\mid +_1 \\cap -_2) = \\frac{P(D)\\,se_1\\,(1 - se_2)}{P(D)\\,se_1(1 - se_2) + P(\\neg D)(1 - sp_1)\\,sp_2} = \\mathbf{${pct(m.negatives.stage2!.missRate, 3).replace('%', '\\%')}}`}
            />
          </>
        )}
      </section>

      <section className="panel" id="th-chain">
        <div className="step-badge">
          <i>5</i>
          {t('theory.chain')}
        </div>
        <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 13.5 }}>
          {t('theory.chain.hint')}
        </p>
        <div className="chain">
          <div className="chain-step">
            <span className="k">{t('theory.chain.prior')}</span>
            <strong>{pct(params.prevalence, 3)}</strong>
          </div>
          <div className="chain-arrow">
            <span>{t('flow.test1')}</span>
            <em>× {n(round(lr1), 1)}</em>
          </div>
          <div className="chain-step">
            <span className="k">{t('theory.chain.after1')}</span>
            <strong style={{ color: 'var(--fn)' }}>{pct(m.ppv1, 2)}</strong>
          </div>
          <div className="chain-arrow">
            <span>{t('flow.test2')}</span>
            <em>× {n(round(lr2), 1)}</em>
          </div>
          <div className="chain-step">
            <span className="k">{t('theory.chain.after2')}</span>
            <strong style={{ color: 'var(--tp)' }}>
              {chained === null ? '—' : pct(chained, 2)}
            </strong>
          </div>
        </div>

        <Tex
          display
          tex={`\\text{odds}(D \\mid +_1 \\cap +_2) = \\underbrace{\\frac{P(D)}{1 - P(D)}}_{${odds.toExponential(2).replace('e', '\\times 10^{') + '}'}} \\times \\underbrace{LR^+_1}_{${n(round(lr1), 1)}} \\times \\underbrace{LR^+_2}_{${n(round(lr2), 1)}}`}
        />
        <Tex
          display
          tex={`P = \\frac{\\text{odds}}{1 + \\text{odds}} = \\mathbf{${chained === null ? '-' : pct(chained, 3).replace('%', '\\%')}}`}
        />

        <div className="stat-row">
          <div className="stat">
            <span className="k">{t('neg.chain')}</span>
            <span className="v">
              {pct(params.test1.sensitivity * m.effectiveTest2.sensitivity, 2)}
            </span>
          </div>
          <div className="stat">
            <span className="k">{t('theory.chain.lr2eff')}</span>
            <span className="v">{n(round(lr2), 1)}</span>
          </div>
        </div>

        <div className="field-sub" style={{ marginTop: 8 }}>{t('theory.chain.always')}</div>
        <div className={params.dependence > 0 ? 'warn' : 'note'} style={{ marginTop: 10 }}>
          {params.dependence > 0 && <span aria-hidden="true">⚠</span>}
          <span>
            {params.dependence > 0
              ? t('theory.dependence.active', { rho: pct(params.dependence, 0) })
              : t('theory.independence')}
          </span>
        </div>
      </section>

      <div id="th-negatives">
        <NegativeAnalysis counts={c} confirmatory={params.confirmatory} decimals={1} />
      </div>

      <section className="panel" id="th-refclass">
        <h3>{t('theory.refclass')}</h3>
        <Tex display tex={`P(D \\mid +) = ${texNum(pct(m.ppv1, 1))}`} />
        <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 13.5 }}>
          {t('theory.refclass.body', { ppv: pct(m.ppv1, 1) })}
        </p>
        <div className="note">{t('theory.refclass.note')}</div>
      </section>
    </div>
  );
}

/** Which highlight key a table cell answers to. */
function termOf(k: Outcome): TermKey {
  return k === 'truePositive' ? 'tp' : k === 'falsePositive' ? 'fp' : k === 'falseNegative' ? 'fn' : 'tn';
}
