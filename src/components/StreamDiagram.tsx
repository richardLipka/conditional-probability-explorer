/*
 * Conditional Probability Explorer - proportional flow of the population
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useId, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { OUTCOME_COLORS } from './Art';
import type { Phase } from '../lib/types';

export interface StreamCounts {
  population: number;
  withCondition: number;
  withoutCondition: number;
  tp1: number;
  fp1: number;
  tn1: number;
  fn1: number;
  positive1: number;
  negative1: number;
  tp2: number;
  fp2: number;
  tn2: number;
  fn2: number;
  positive2: number;
  negative2: number;
}

/** Nothing with a non-zero count is allowed to vanish completely. */
const MIN_RIBBON = 1.7;

/**
 * Thickness of each stream, proportional to its count, inside `available` pixels.
 * Non-empty streams get a hairline minimum; if that overflows, everything is
 * scaled back down so the streams still add up to the trunk they came from.
 */
function bandHeights(values: number[], available: number): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0 || available <= 0) return values.map(() => 0);
  const s = available / total;
  const hs = values.map((v) => (v <= 0 ? 0 : Math.max(MIN_RIBBON, v * s)));
  const sum = hs.reduce((a, b) => a + b, 0);
  return sum > available ? hs.map((h) => h * (available / sum)) : hs;
}

/** A ribbon: a band that flows from (x0, a0…a1) to (x1, b0…b1). */
function ribbon(x0: number, x1: number, a0: number, a1: number, b0: number, b1: number): string {
  const xm = (x0 + x1) / 2;
  return `M${x0},${a0} C${xm},${a0} ${xm},${b0} ${x1},${b0} L${x1},${b1} C${xm},${b1} ${xm},${a1} ${x0},${a1} Z`;
}

interface Spec {
  key: string;
  d: string;
  color: string;
  pattern?: string;
  title: string;
  sub: string;
}

export interface StreamDiagramProps {
  counts: StreamCounts;
  confirmatory: boolean;
  phase: Phase;
  sweepMs: number;
  decimals: number;
}

export function StreamDiagram({
  counts: c,
  confirmatory,
  phase,
  sweepMs,
  decimals,
}: StreamDiagramProps) {
  const { t, n, pct } = useI18n();
  const uid = useId().replace(/[:]/g, '');
  const [hover, setHover] = useState<{ x: number; y: number; title: string; sub: string } | null>(
    null,
  );

  const hatch = `hatch-${uid}`;
  const dots = `dots-${uid}`;
  const label = {
    tp: t('outcome.truePositive'),
    fp: t('outcome.falsePositive'),
    fn: t('outcome.falseNegative'),
    tn: t('outcome.trueNegative'),
  };
  const share = (v: number, of: number) => (of > 0 ? pct(v / of, 2) : '—');

  // ---------------------------------------------------------------- main flow
  const A = { W: 1000, H: confirmatory ? 340 : 300, top: 36, bottom: 28, gap: 16 };
  // The second gate needs vertical room for its two labelled outputs even when
  // the positive stream it acts on is only a hairline thick.
  const reserve = confirmatory ? 44 : 0;
  const availA = A.H - A.top - A.bottom - A.gap - reserve;

  const xa = confirmatory
    ? { t0: 10, t1: 128, g1: 156, r1: 404, n1: 436, c1: 480, g2: 508, r2: 742, n2: 774 }
    : { t0: 10, t1: 150, g1: 178, r1: 612, n1: 644, c1: 0, g2: 0, r2: 0, n2: 0 };

  /**
   * Which stage-1 ribbons had to be drawn thicker than the truth.
   *
   * bandHeights floors every non-empty stream at MIN_RIBBON so that a group
   * cannot vanish entirely, which means a caption promising "width is
   * head-count" is only honest about the streams that never hit that floor.
   * Name the ones that did, with the width they would really have had. In the
   * airport scenario that is three of the four; with a common disease it is
   * one; the caption has to say which.
   */
  const widened = useMemo(() => {
    const bands = [
      { key: 'tp' as const, value: c.tp1 },
      { key: 'fn' as const, value: c.fn1 },
      { key: 'fp' as const, value: c.fp1 },
      { key: 'tn' as const, value: c.tn1 },
    ];
    const total = bands.reduce((a, b) => a + b.value, 0);
    if (total <= 0 || availA <= 0) return [];
    const scale = availA / total;
    return bands
      .filter((b) => b.value > 0 && b.value * scale < MIN_RIBBON)
      .map((b) => ({ key: b.key, px: b.value * scale }));
  }, [c, availA]);

  const geo = useMemo(() => {
    const [hTP, hFN, hFP, hTN] = bandHeights([c.tp1, c.fn1, c.fp1, c.tn1], availA);
    const hPos = hTP + hFP;
    const hNeg = hFN + hTN;

    const gap2 = 30;
    const [hTP2, hFN2, hFP2, hTN2] = confirmatory
      ? bandHeights([c.tp2, c.fn2, c.fp2, c.tn2], Math.max(hPos, 4 * MIN_RIBBON))
      : [0, 0, 0, 0];
    const hBoth = hTP2 + hFP2;
    const hCleared = hFN2 + hTN2;

    const posTop = A.top;
    const stage2Extent = confirmatory ? hBoth + gap2 + hCleared : hPos;
    const negTop = A.top + Math.max(hPos, stage2Extent) + A.gap;

    const trunkH = hTP + hFN + hFP + hTN;
    const trunkTop = A.top + (negTop + hNeg - A.top - trunkH) / 2;

    return {
      hTP, hFN, hFP, hTN, hPos, hNeg,
      hTP2, hFN2, hFP2, hTN2, hBoth, hCleared, gap2,
      posTop, negTop, trunkTop, trunkH,
      // trunk sub-bands (source side)
      sTP: trunkTop,
      sFN: trunkTop + hTP,
      sFP: trunkTop + hTP + hFN,
      sTN: trunkTop + hTP + hFN + hFP,
      // node sub-bands (target side)
      tTP: posTop,
      tFP: posTop + hTP,
      tFN: negTop,
      tTN: negTop + hFN,
    };
  }, [c, confirmatory, availA, A.top, A.gap]);

  const g = geo;

  const stage1: Spec[] = [
    {
      key: 'tp',
      d: ribbon(xa.g1, xa.r1, g.sTP, g.sTP + g.hTP, g.tTP, g.tTP + g.hTP),
      color: OUTCOME_COLORS.truePositive,
      title: label.tp,
      sub: `${n(c.tp1, decimals)} · ${share(c.tp1, c.population)}`,
    },
    {
      key: 'fn',
      d: ribbon(xa.g1, xa.r1, g.sFN, g.sFN + g.hFN, g.tFN, g.tFN + g.hFN),
      color: OUTCOME_COLORS.falseNegative,
      pattern: `url(#${dots})`,
      title: label.fn,
      sub: `${n(c.fn1, decimals)} · ${share(c.fn1, c.population)}`,
    },
    {
      key: 'fp',
      d: ribbon(xa.g1, xa.r1, g.sFP, g.sFP + g.hFP, g.tFP, g.tFP + g.hFP),
      color: OUTCOME_COLORS.falsePositive,
      pattern: `url(#${hatch})`,
      title: label.fp,
      sub: `${n(c.fp1, decimals)} · ${share(c.fp1, c.population)}`,
    },
    {
      key: 'tn',
      d: ribbon(xa.g1, xa.r1, g.sTN, g.sTN + g.hTN, g.tTN, g.tTN + g.hTN),
      color: OUTCOME_COLORS.trueNegative,
      title: label.tn,
      sub: `${n(c.tn1, decimals)} · ${share(c.tn1, c.population)}`,
    },
  ].filter((s) => s.d.length > 0);

  // Second gate: the positive stream only. Sources keep the proportions of the
  // band they leave, targets use the stage-2 thicknesses.
  const stage2: Spec[] = useMemo(() => {
    if (!confirmatory) return [];
    const posOf = (a: number, b: number, h: number) => (a + b > 0 ? (h * a) / (a + b) : 0);
    const srcTP2 = posOf(c.tp2, c.fn2, g.hTP);
    const srcFP2 = posOf(c.fp2, c.tn2, g.hFP);
    const yTPsrc = g.posTop;
    const yFNsrc = g.posTop + srcTP2;
    const yFPsrc = g.posTop + g.hTP;
    const yTNsrc = g.posTop + g.hTP + srcFP2;

    const yTP2 = A.top;
    const yFP2 = A.top + g.hTP2;
    const clearedTop = A.top + g.hBoth + g.gap2;
    const yFN2 = clearedTop;
    const yTN2 = clearedTop + g.hFN2;

    return [
      {
        key: 'tp2',
        d: ribbon(xa.g2, xa.r2, yTPsrc, yTPsrc + srcTP2, yTP2, yTP2 + g.hTP2),
        color: OUTCOME_COLORS.truePositive,
        title: label.tp,
        sub: `${n(c.tp2, decimals)} · ${share(c.tp2, c.positive1)}`,
      },
      {
        key: 'fn2',
        d: ribbon(xa.g2, xa.r2, yFNsrc, yFNsrc + (g.hTP - srcTP2), yFN2, yFN2 + g.hFN2),
        color: OUTCOME_COLORS.falseNegative,
        pattern: `url(#${dots})`,
        title: label.fn,
        sub: `${n(c.fn2, decimals)} · ${share(c.fn2, c.positive1)}`,
      },
      {
        key: 'fp2',
        d: ribbon(xa.g2, xa.r2, yFPsrc, yFPsrc + srcFP2, yFP2, yFP2 + g.hFP2),
        color: OUTCOME_COLORS.falsePositive,
        pattern: `url(#${hatch})`,
        title: label.fp,
        sub: `${n(c.fp2, decimals)} · ${share(c.fp2, c.positive1)}`,
      },
      {
        key: 'tn2',
        d: ribbon(xa.g2, xa.r2, yTNsrc, yTNsrc + (g.hFP - srcFP2), yTN2, yTN2 + g.hTN2),
        color: OUTCOME_COLORS.trueNegative,
        title: label.tn,
        sub: `${n(c.tn2, decimals)} · ${share(c.tn2, c.positive1)}`,
      },
    ];
  }, [confirmatory, c, g, xa, decimals, dots, hatch, label, A.top]);

  // ------------------------------------------------------- magnified detail
  // The gap between the two outputs also has to clear their two-line labels,
  // which sit at the top of each node however thin that node is.
  const B = { W: 1000, H: 220, top: 30, bottom: 28, gap: 30 };
  const availB = B.H - B.top - B.bottom - (confirmatory ? B.gap : 0);
  const xb = { t0: 10, t1: 168, g1: 196, r1: 640, n1: 672 };

  const detail = useMemo(() => {
    if (c.positive1 <= 0) return null;
    if (!confirmatory) {
      const [hTP, hFP] = bandHeights([c.tp1, c.fp1], availB);
      return { kind: 'single' as const, hTP, hFP, top: B.top + (availB - hTP - hFP) / 2 };
    }
    const [hTP2, hFN2, hFP2, hTN2] = bandHeights([c.tp2, c.fn2, c.fp2, c.tn2], availB);
    return { kind: 'split' as const, hTP2, hFN2, hFP2, hTN2 };
  }, [c, confirmatory, availB, B.top]);

  /** How much thicker the positive stream is drawn in the detail panel. */
  const magnification =
    c.positive1 > 0 ? (availB / c.positive1) / (availA / Math.max(c.population, 1)) : 1;

  const detailRibbons: Spec[] = useMemo(() => {
    if (!detail || detail.kind !== 'split') return [];
    const srcTP = detail.hTP2 + detail.hFN2;
    const srcFP = detail.hFP2 + detail.hTN2;
    const sTop = B.top + (availB + B.gap - (srcTP + srcFP)) / 2;
    const yTPs = sTop;
    const yFNs = sTop + detail.hTP2;
    const yFPs = sTop + srcTP;
    const yTNs = sTop + srcTP + detail.hFP2;

    const yTP = B.top;
    const yFP = B.top + detail.hTP2;
    const clearedTop = B.top + detail.hTP2 + detail.hFP2 + B.gap;
    const yFN = clearedTop;
    const yTN = clearedTop + detail.hFN2;

    return [
      {
        key: 'dtp',
        d: ribbon(xb.g1, xb.r1, yTPs, yTPs + detail.hTP2, yTP, yTP + detail.hTP2),
        color: OUTCOME_COLORS.truePositive,
        title: label.tp,
        sub: `${n(c.tp2, decimals)} · ${share(c.tp2, c.positive1)}`,
      },
      {
        key: 'dfn',
        d: ribbon(xb.g1, xb.r1, yFNs, yFNs + detail.hFN2, yFN, yFN + detail.hFN2),
        color: OUTCOME_COLORS.falseNegative,
        pattern: `url(#${dots})`,
        title: label.fn,
        sub: `${n(c.fn2, decimals)} · ${share(c.fn2, c.positive1)}`,
      },
      {
        key: 'dfp',
        d: ribbon(xb.g1, xb.r1, yFPs, yFPs + detail.hFP2, yFP, yFP + detail.hFP2),
        color: OUTCOME_COLORS.falsePositive,
        pattern: `url(#${hatch})`,
        title: label.fp,
        sub: `${n(c.fp2, decimals)} · ${share(c.fp2, c.positive1)}`,
      },
      {
        key: 'dtn',
        d: ribbon(xb.g1, xb.r1, yTNs, yTNs + detail.hTN2, yTN, yTN + detail.hTN2),
        color: OUTCOME_COLORS.trueNegative,
        title: label.tn,
        sub: `${n(c.tn2, decimals)} · ${share(c.tn2, c.positive1)}`,
      },
    ];
  }, [detail, c, xb, decimals, dots, hatch, label, availB, B.top, B.gap]);

  // --------------------------------------------------------------- animation
  const revealed = (() => {
    switch (phase) {
      case 'idle':
      case 'population':
      case 'condition':
        return xa.g1 / A.W;
      case 'test1':
      case 'split':
        return confirmatory ? (xa.n1 + 24) / A.W : 1;
      default:
        return 1;
    }
  })();
  const detailShown = phase === 'test1' || phase === 'split' || phase === 'test2' || phase === 'done';
  const detailRevealed = !confirmatory || phase === 'test2' || phase === 'done' ? 1 : xb.g1 / B.W;

  const trunkKnown = phase !== 'idle' && phase !== 'population';
  const condColor = trunkKnown ? OUTCOME_COLORS.cond : OUTCOME_COLORS.unknown;
  const noCondColor = trunkKnown ? OUTCOME_COLORS.nocond : OUTCOME_COLORS.unknown;

  const onRibbon = (e: React.MouseEvent, s: Spec) => {
    const box = (e.currentTarget as SVGElement).ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (!box) return;
    setHover({ x: e.clientX - box.left, y: e.clientY - box.top, title: s.title, sub: s.sub });
  };

  const Defs = () => (
    <defs>
      <pattern
        id={hatch}
        width="7"
        height="7"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(28,4,12,.5)" strokeWidth="3" />
      </pattern>
      <pattern id={dots} width="7" height="7" patternUnits="userSpaceOnUse">
        <circle cx="2.2" cy="2.2" r="1.5" fill="rgba(46,30,2,.55)" />
      </pattern>
    </defs>
  );

  const Ribbons = ({ specs }: { specs: Spec[] }) => (
    <>
      {specs.map((s) => (
        <g
          key={s.key}
          onMouseMove={(e) => onRibbon(e, s)}
          onMouseLeave={() => setHover(null)}
          style={{ cursor: 'help' }}
        >
          <path d={s.d} fill={s.color} opacity="0.9" />
          {s.pattern && <path d={s.d} fill={s.pattern} />}
          <title>{`${s.title} — ${s.sub}`}</title>
        </g>
      ))}
    </>
  );

  const Gate = ({ x, y0, y1, name }: { x: number; y0: number; y1: number; name: string }) => (
    <g>
      <rect
        x={x - 28}
        y={y0 - 10}
        width={28}
        height={Math.max(24, y1 - y0 + 20)}
        rx="7"
        fill="#0e1430"
        stroke="#4c5bb0"
      />
      <text
        x={x - 14}
        y={(y0 + Math.max(y0 + 24, y1)) / 2}
        fill="#a5b4ff"
        fontSize="11"
        fontWeight="600"
        textAnchor="middle"
        transform={`rotate(-90 ${x - 14} ${(y0 + Math.max(y0 + 24, y1)) / 2})`}
      >
        {name}
      </text>
    </g>
  );

  const nodeLabel = (x: number, y: number, title: string, value: string, color = '#e8ecf8') => (
    <g>
      <text x={x} y={y} fontSize="12" fill={color} fontWeight="600">
        {title}
      </text>
      <text x={x} y={y + 15} fontSize="12.5" fill="#9aa6c8" fontFamily="monospace">
        {value}
      </text>
    </g>
  );

  return (
    <div style={{ position: 'relative' }}>
      <div className="pop-wrap stream-scroll">
        <svg
          viewBox={`0 0 ${A.W} ${A.H}`}
          style={{ width: '100%', minWidth: 660, height: 'auto', display: 'block' }}
          role="img"
          aria-label={`${t('flow.population')} ${n(c.population, decimals)} → ${t('flow.test1')}`}
        >
          <Defs />
          <clipPath id={`sweepA-${uid}`}>
            <rect
              x={-A.W}
              y="0"
              width={A.W}
              height={A.H}
              style={{
                transform: `translateX(${A.W * revealed}px)`,
                transition: `transform ${sweepMs}ms linear`,
              }}
            />
          </clipPath>

          <text x={xa.t0} y={20} fontSize="11.5" fill="#6b779c">
            {t('flow.population')} · {n(c.population, decimals)}
          </text>

          <g clipPath={`url(#sweepA-${uid})`}>
            {/* the incoming stream, split by what is actually true */}
            <rect
              x={xa.t0}
              y={g.trunkTop}
              width={xa.t1 - xa.t0}
              height={g.hTP + g.hFN}
              fill={condColor}
              style={{ transition: 'fill .45s' }}
            />
            <rect
              x={xa.t0}
              y={g.trunkTop + g.hTP + g.hFN}
              width={xa.t1 - xa.t0}
              height={g.hFP + g.hTN}
              fill={noCondColor}
              style={{ transition: 'fill .45s' }}
            />
            <Gate x={xa.g1} y0={g.trunkTop} y1={g.trunkTop + g.trunkH} name={t('flow.test1')} />
            <Ribbons specs={stage1} />

            {/* result nodes after test 1 */}
            <rect x={xa.r1} y={g.tTP} width={xa.n1 - xa.r1} height={g.hTP} fill={OUTCOME_COLORS.truePositive} />
            <rect x={xa.r1} y={g.tFP} width={xa.n1 - xa.r1} height={g.hFP} fill={OUTCOME_COLORS.falsePositive} />
            <rect x={xa.r1} y={g.tFN} width={xa.n1 - xa.r1} height={g.hFN} fill={OUTCOME_COLORS.falseNegative} />
            <rect x={xa.r1} y={g.tTN} width={xa.n1 - xa.r1} height={g.hTN} fill={OUTCOME_COLORS.trueNegative} />
            <rect
              x={xa.r1 - 1}
              y={g.posTop - 3}
              width={xa.n1 - xa.r1 + 2}
              height={g.hPos + 6}
              rx="3"
              fill="none"
              stroke="#c084fc"
              strokeWidth="1.2"
            />

            {confirmatory ? (
              <>
                <rect x={xa.n1} y={g.tTP} width={xa.c1 - xa.n1} height={g.hTP} fill={OUTCOME_COLORS.truePositive} />
                <rect x={xa.n1} y={g.tFP} width={xa.c1 - xa.n1} height={g.hFP} fill={OUTCOME_COLORS.falsePositive} />
                <Gate x={xa.g2} y0={g.posTop} y1={g.posTop + g.hPos} name={t('flow.test2')} />
                <Ribbons specs={stage2} />
                <rect x={xa.r2} y={A.top} width={xa.n2 - xa.r2} height={g.hTP2} fill={OUTCOME_COLORS.truePositive} />
                <rect x={xa.r2} y={A.top + g.hTP2} width={xa.n2 - xa.r2} height={g.hFP2} fill={OUTCOME_COLORS.falsePositive} />
                <rect
                  x={xa.r2}
                  y={A.top + g.hBoth + g.gap2}
                  width={xa.n2 - xa.r2}
                  height={g.hFN2}
                  fill={OUTCOME_COLORS.falseNegative}
                />
                <rect
                  x={xa.r2}
                  y={A.top + g.hBoth + g.gap2 + g.hFN2}
                  width={xa.n2 - xa.r2}
                  height={g.hTN2}
                  fill={OUTCOME_COLORS.trueNegative}
                />
                {/* the negatives of test 1 are never retested */}
                <rect x={xa.n1} y={g.tFN} width={xa.n2 - xa.n1} height={g.hFN} fill={OUTCOME_COLORS.falseNegative} opacity="0.55" />
                <rect x={xa.n1} y={g.tTN} width={xa.n2 - xa.n1} height={g.hTN} fill={OUTCOME_COLORS.trueNegative} opacity="0.55" />

                {nodeLabel(xa.n2 + 10, A.top + 4, t('flow.positiveBoth'), n(c.positive2, decimals), OUTCOME_COLORS.truePositive)}
                {nodeLabel(
                  xa.n2 + 10,
                  A.top + g.hBoth + g.gap2 + 4,
                  t('flow.negative2'),
                  n(c.negative2, decimals),
                )}
                {nodeLabel(
                  xa.n2 + 10,
                  g.negTop + g.hNeg / 2 - 6,
                  t('flow.negative1'),
                  `${n(c.negative1, decimals)} · ${t('stream.notRetested')}`,
                )}
                <text x={xa.n1 + 2} y={g.posTop - 8} fontSize="11" fill="#c084fc">
                  {t('flow.positive1')} · {n(c.positive1, decimals)}
                </text>
              </>
            ) : (
              <>
                {nodeLabel(
                  xa.n1 + 12,
                  g.posTop + Math.max(g.hPos / 2, 4),
                  t('flow.positive1'),
                  n(c.positive1, decimals),
                  '#c084fc',
                )}
                {nodeLabel(
                  xa.n1 + 12,
                  g.negTop + g.hNeg / 2 - 6,
                  t('flow.negative1'),
                  n(c.negative1, decimals),
                )}
              </>
            )}
          </g>

          <text x={xa.t0} y={A.H - 8} fontSize="10.5" fill="#6b779c">
            {t('stream.trueScale')}{' '}
            {widened.length === 0
              ? t('stream.trueScale.exact')
              : t('stream.trueScale.thin', {
                  list: widened
                    .map(
                      (w) =>
                        `${label[w.key]} ${n(w.px, w.px < 0.01 ? 3 : w.px < 1 ? 2 : 1)} px`,
                    )
                    .join(' · '),
                })}
          </text>
        </svg>
      </div>

      {detail && (
        <div
          className="pop-wrap stream-scroll"
          style={{
            marginTop: 10,
            opacity: detailShown ? 1 : 0.25,
            transition: 'opacity .4s',
          }}
        >
          <div className="field-sub" style={{ marginBottom: 2 }}>
            {t('stream.detail')} — {t('stream.magnified', { k: n(Math.max(1, Math.round(magnification))) })}
          </div>
          <svg
            viewBox={`0 0 ${B.W} ${B.H}`}
            style={{ width: '100%', minWidth: 660, height: 'auto', display: 'block' }}
            role="img"
            aria-label={t('stream.detail')}
          >
            <Defs />
            <clipPath id={`sweepB-${uid}`}>
              <rect
                x={-B.W}
                y="0"
                width={B.W}
                height={B.H}
                style={{
                  transform: `translateX(${B.W * detailRevealed}px)`,
                  transition: `transform ${sweepMs}ms linear`,
                }}
              />
            </clipPath>

            <text x={xb.t0} y={18} fontSize="11.5" fill="#c084fc">
              {t('flow.positive1')} · {n(c.positive1, decimals)}
            </text>

            <g clipPath={`url(#sweepB-${uid})`}>
              {detail.kind === 'single' ? (
                <>
                  <rect x={xb.t0} y={detail.top} width={xb.n1 - xb.t0} height={detail.hTP} fill={OUTCOME_COLORS.truePositive} />
                  <rect x={xb.t0} y={detail.top + detail.hTP} width={xb.n1 - xb.t0} height={detail.hFP} fill={OUTCOME_COLORS.falsePositive} />
                  <rect
                    x={xb.t0}
                    y={detail.top + detail.hTP}
                    width={xb.n1 - xb.t0}
                    height={detail.hFP}
                    fill={`url(#${hatch})`}
                  />
                  {nodeLabel(xb.n1 + 12, detail.top + detail.hTP / 2, label.tp, `${n(c.tp1, decimals)} · ${share(c.tp1, c.positive1)}`, OUTCOME_COLORS.truePositive)}
                  {nodeLabel(
                    xb.n1 + 12,
                    detail.top + detail.hTP + detail.hFP / 2,
                    label.fp,
                    `${n(c.fp1, decimals)} · ${share(c.fp1, c.positive1)}`,
                    OUTCOME_COLORS.falsePositive,
                  )}
                </>
              ) : (
                <>
                  <rect
                    x={xb.t0}
                    y={B.top + (availB + B.gap - (detail.hTP2 + detail.hFN2 + detail.hFP2 + detail.hTN2)) / 2}
                    width={xb.t1 - xb.t0}
                    height={detail.hTP2 + detail.hFN2}
                    fill={OUTCOME_COLORS.truePositive}
                  />
                  <rect
                    x={xb.t0}
                    y={
                      B.top +
                      (availB + B.gap - (detail.hTP2 + detail.hFN2 + detail.hFP2 + detail.hTN2)) / 2 +
                      detail.hTP2 +
                      detail.hFN2
                    }
                    width={xb.t1 - xb.t0}
                    height={detail.hFP2 + detail.hTN2}
                    fill={OUTCOME_COLORS.falsePositive}
                  />
                  <Gate
                    x={xb.g1}
                    y0={B.top + 6}
                    y1={B.top + availB + B.gap - 6}
                    name={t('flow.test2')}
                  />
                  <Ribbons specs={detailRibbons} />
                  {nodeLabel(
                    xb.n1 + 12,
                    B.top + 4,
                    t('flow.positiveBoth'),
                    `${n(c.positive2, decimals)} · ${share(c.positive2, c.positive1)}`,
                    OUTCOME_COLORS.truePositive,
                  )}
                  {nodeLabel(
                    xb.n1 + 12,
                    B.top + detail.hTP2 + detail.hFP2 + B.gap + 4,
                    t('flow.negative2'),
                    `${n(c.negative2, decimals)} · ${share(c.negative2, c.positive1)}`,
                  )}
                </>
              )}
            </g>
          </svg>
        </div>
      )}

      {hover && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(hover.x + 14, 760),
            top: hover.y + 12,
            pointerEvents: 'none',
            background: 'rgba(9,13,30,.96)',
            border: '1px solid #33406c',
            borderRadius: 8,
            padding: '6px 9px',
            fontSize: 12,
            whiteSpace: 'nowrap',
            zIndex: 6,
          }}
        >
          <b>{hover.title}</b>
          <span style={{ color: 'var(--muted)' }}> — {hover.sub}</span>
        </div>
      )}
    </div>
  );
}
