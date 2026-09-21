/*
 * Conditional Probability Explorer - individuals moving through the tests
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OUTCOME_COLORS } from './Art';
import type { SimulationResult } from '../lib/simulation';
import type { Phase } from '../lib/types';

/**
 * Beyond this we animate an even sub-sample; the labels keep the true counts.
 * Set above the default population of 10,000 so that the usual case draws every
 * individual — once you can condition on a group, its dots should be countable.
 */
const MAX_DRAWN = 12000;
const MIN_WIDTH = 620;

const COLORS = [
  OUTCOME_COLORS.truePositive,
  OUTCOME_COLORS.falsePositive,
  OUTCOME_COLORS.falseNegative,
  OUTCOME_COLORS.trueNegative,
  OUTCOME_COLORS.cond,
  OUTCOME_COLORS.nocond,
  OUTCOME_COLORS.unknown,
];
const TP = 0;
const FP = 1;
const FN = 2;
const TN = 3;
const COND = 4;
const NOCOND = 5;
const UNKNOWN = 6;

type Draw = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => void;

/**
 * One silhouette per outcome, the same four the legend uses, so the picture
 * survives colour blindness.
 *
 * Every glyph has to stay inside the packer's cell. The packer spaces people
 * `2r` apart, so anything reaching past `r` runs into its neighbour, and a
 * field of overlapping glyphs reads as a solid sheet with holes in it rather
 * than as individuals — the exact opposite of the point. A triangle and a
 * diamond inscribed in that circle carry less ink than a disc does; that is
 * geometry, and losing a little weight beats losing the shape.
 */
const EXTENT = 0.95;
const DISC: Draw = (ctx, x, y, r) => {
  const d = r * EXTENT;
  ctx.moveTo(x + d, y);
  ctx.arc(x, y, d, 0, Math.PI * 2);
};
const BLOCK: Draw = (ctx, x, y, r) => ctx.rect(x - r, y - r, r * 2, r * 2);
const SQUARE: Draw = (ctx, x, y, r) => {
  const h = r * EXTENT * 0.84;
  ctx.rect(x - h, y - h, h * 2, h * 2);
};
const TRIANGLE: Draw = (ctx, x, y, r) => {
  const d = r * EXTENT;
  ctx.moveTo(x, y - d);
  ctx.lineTo(x + d, y + d * 0.66);
  ctx.lineTo(x - d, y + d * 0.66);
  ctx.closePath();
};
const DIAMOND: Draw = (ctx, x, y, r) => {
  const d = r * EXTENT;
  ctx.moveTo(x, y - d);
  ctx.lineTo(x + d, y);
  ctx.lineTo(x, y + d);
  ctx.lineTo(x - d, y);
  ctx.closePath();
};
/** Indexed by the colour constants above. */
const GLYPH: Draw[] = [DISC, SQUARE, TRIANGLE, DIAMOND, DISC, DISC, DISC];

/** Below this radius a silhouette is a smudge and the palette carries it alone. */
const SHAPED_MIN_RADIUS = 3;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Square packing of `count` items inside a box, shrinking the cell until it fits. */
function packer(count: number, box: Box, maxCell = 15) {
  const at = (i: number, cell: number, cols: number): [number, number] => [
    box.x + (i % cols) * cell + cell / 2,
    box.y + Math.floor(i / cols) * cell + cell / 2,
  ];
  if (count <= 0) return { cell: 4, at: (i: number) => at(i, 4, 1) };
  let cell = Math.min(maxCell, Math.sqrt((box.w * box.h) / count) * 0.94);
  let cols = Math.max(1, Math.floor(box.w / cell));
  let guard = 0;
  while (Math.ceil(count / cols) * cell > box.h && cell > 1 && guard++ < 60) {
    cell *= 0.93;
    cols = Math.max(1, Math.floor(box.w / cell));
  }
  return { cell, at: (i: number) => at(i, cell, cols) };
}

function nextFrame(fn: () => void): () => void {
  let fired = false;
  const finish = () => {
    if (fired) return;
    fired = true;
    window.clearTimeout(timeout);
    cancelAnimationFrame(frame);
    fn();
  };
  const frame = requestAnimationFrame(finish);
  const timeout = window.setTimeout(finish, 120);
  return () => {
    fired = true;
    window.clearTimeout(timeout);
    cancelAnimationFrame(frame);
  };
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface ParticleLabels {
  population: string;
  focusTitle: string;
  test1: string;
  test2: string;
  positive1: string;
  negative1: string;
  positiveBoth: string;
  cleared: string;
  sampling: (shown: number, total: number) => string;
  fmt: (v: number) => string;
}

export interface ParticleSimulationProps {
  result: SimulationResult;
  confirmatory: boolean;
  phase: Phase;
  /** Duration of the current phase; 0 renders the end state immediately. */
  sweepMs: number;
  /**
   * Condition on a positive result: everyone else fades away and the positive
   * group expands to fill the frame. This is the conditioning operation itself
   * rather than its result — the population really does become that group.
   */
  focused?: boolean;
  labels: ParticleLabels;
}

/**
 * The population as moving individuals: everybody starts in a pool, travels
 * through the test gate, and lands in the bin for the outcome they got. With
 * confirmatory testing the positive bin sets off again through a second gate.
 */
export function ParticleSimulation({
  result,
  confirmatory,
  phase,
  sweepMs,
  focused = false,
  labels,
}: ParticleSimulationProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(760);
  const H = 430;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  /** Everything about where each individual sits and travels. */
  const scene = useMemo(() => {
    // The scene needs a minimum width to stay legible; narrower containers
    // scroll it rather than squashing the bins into each other.
    const W = Math.max(MIN_WIDTH, width);
    const c = result.counts;

    // Which individuals we actually animate.
    const total = result.size;
    const shown = Math.min(total, MAX_DRAWN);
    const stride = total / shown;
    const idx = new Int32Array(shown);
    for (let k = 0; k < shown; k++) idx[k] = Math.floor(k * stride);

    const pool: Box = { x: 10, y: 46, w: W * 0.24, h: H - 76 };
    const gate1X = W * 0.325;
    const posBox: Box = confirmatory
      ? { x: W * 0.4, y: 44, w: W * 0.17, h: H * 0.22 }
      : { x: W * 0.4, y: 44, w: W * 0.56, h: H * 0.26 };
    const negBox: Box = { x: W * 0.4, y: H * 0.44, w: W * 0.57, h: H * 0.48 };
    const gate2X = W * 0.635;
    // The two stage-2 bins need room between them for their own labels.
    const bothBox: Box = { x: W * 0.69, y: 44, w: W * 0.28, h: H * 0.1 };
    const clearedBox: Box = { x: W * 0.69, y: H * 0.26, w: W * 0.28, h: H * 0.13 };

    // Count what we draw (the sub-sample), so the bins pack exactly.
    let nTP = 0;
    let nFP = 0;
    let nFN = 0;
    let nTN = 0;
    let nTP2 = 0;
    let nFP2 = 0;
    let nFN2 = 0;
    let nTN2 = 0;
    const kind1 = new Uint8Array(shown);
    const kind2 = new Uint8Array(shown);
    for (let k = 0; k < shown; k++) {
      const i = idx[k];
      const cond = result.condition[i] === 1;
      const pos1 = result.test1[i] === 1;
      const g = pos1 ? (cond ? TP : FP) : cond ? FN : TN;
      kind1[k] = g;
      if (g === TP) nTP++;
      else if (g === FP) nFP++;
      else if (g === FN) nFN++;
      else nTN++;
      if (confirmatory && pos1) {
        const pos2 = result.test2[i] === 2;
        const g2 = pos2 ? (cond ? TP : FP) : cond ? FN : TN;
        kind2[k] = g2;
        if (g2 === TP) nTP2++;
        else if (g2 === FP) nFP2++;
        else if (g2 === FN) nFN2++;
        else nTN2++;
      } else {
        kind2[k] = g;
      }
    }

    const poolPack = packer(shown, pool, 9);
    const posPack = packer(nTP + nFP, posBox);
    const negPack = packer(nFN + nTN, negBox, 9);
    const bothPack = packer(nTP2 + nFP2, bothBox);
    const clearedPack = packer(nFN2 + nTN2, clearedBox);

    // Where each positive individual goes when we condition on a positive
    // result: the group is repacked to fill the frame, true positives first.
    const focusBox: Box = { x: 26, y: 62, w: W - 52, h: H - 108 };
    // Generous cap: conditioned on a small group, it should fill the frame.
    const focusPack = packer(nTP + nFP, focusBox, 46);
    const focusX = new Float32Array(shown);
    const focusY = new Float32Array(shown);
    let fTP = 0;
    let fFP = 0;

    const poolX = new Float32Array(shown);
    const poolY = new Float32Array(shown);
    const binX = new Float32Array(shown);
    const binY = new Float32Array(shown);
    const finX = new Float32Array(shown);
    const finY = new Float32Array(shown);
    const moves2 = new Uint8Array(shown);

    // Grouping true and false results into contiguous slots makes the ratio
    // inside each bin readable at a glance.
    let sTP = 0;
    let sFP = 0;
    let sFN = 0;
    let sTN = 0;
    let sTP2 = 0;
    let sFP2 = 0;
    let sFN2 = 0;
    let sTN2 = 0;

    for (let k = 0; k < shown; k++) {
      const [px, py] = poolPack.at(k);
      poolX[k] = px;
      poolY[k] = py;

      const g = kind1[k];
      let slot: number;
      let p: [number, number];
      if (g === TP || g === FP) {
        slot = g === TP ? sTP++ : nTP + sFP++;
        p = posPack.at(slot);
        const f = focusPack.at(g === TP ? fTP++ : nTP + fFP++);
        focusX[k] = f[0];
        focusY[k] = f[1];
      } else {
        slot = g === FN ? sFN++ : nFN + sTN++;
        p = negPack.at(slot);
      }
      binX[k] = p[0];
      binY[k] = p[1];

      if (confirmatory && (g === TP || g === FP)) {
        moves2[k] = 1;
        const g2 = kind2[k];
        let f: [number, number];
        if (g2 === TP || g2 === FP) {
          f = bothPack.at(g2 === TP ? sTP2++ : nTP2 + sFP2++);
        } else {
          f = clearedPack.at(g2 === FN ? sFN2++ : nFN2 + sTN2++);
        }
        finX[k] = f[0];
        finY[k] = f[1];
      } else {
        finX[k] = binX[k];
        finY[k] = binY[k];
      }
    }

    return {
      W, shown, total, idx, kind1, kind2, moves2,
      poolX, poolY, binX, binY, finX, finY, focusX, focusY, focusBox,
      focusCell: globalThis.Math.max(2, focusPack.cell - 1),
      positives: nTP + nFP,
      pool, gate1X, gate2X, posBox, negBox, bothBox, clearedBox,
      cell: Math.max(1.6, poolPack.cell - 1),
      binCell: Math.max(1.6, Math.min(posPack.cell, negPack.cell) - 1),
      counts: c,
    };
  }, [result, width, confirmatory, H]);

  const draw = useCallback(
    (progress: number, ph: Phase, focus = 0) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const s = scene;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(s.W * dpr)) {
        canvas.width = Math.round(s.W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = `${s.W}px`;
        canvas.style.height = `${H}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, s.W, H);

      const p = Math.min(1, Math.max(0, progress));
      const n = s.shown;
      const xs = new Float32Array(n);
      const ys = new Float32Array(n);
      const col = new Uint8Array(n);
      let radius = s.cell / 2;

      const gateY1 = s.pool.y + s.pool.h / 2;
      const gateY2 = s.posBox.y + s.posBox.h / 2;

      if (ph === 'idle' || ph === 'population' || ph === 'condition') {
        const revealed = ph === 'condition' ? Math.ceil(n * p) : 0;
        for (let k = 0; k < n; k++) {
          xs[k] = s.poolX[k];
          ys[k] = s.poolY[k];
          col[k] =
            ph === 'idle' || ph === 'population'
              ? UNKNOWN
              : k < revealed
                ? result.condition[s.idx[k]] === 1
                  ? COND
                  : NOCOND
                : UNKNOWN;
        }
      } else if (ph === 'test1') {
        // Staggered departure: the population leaves as a wave, not a block.
        for (let k = 0; k < n; k++) {
          const depart = (k / n) * 0.55;
          const local = Math.min(1, Math.max(0, (p - depart) / 0.45));
          const cond = result.condition[s.idx[k]] === 1;
          if (local <= 0) {
            xs[k] = s.poolX[k];
            ys[k] = s.poolY[k];
            col[k] = cond ? COND : NOCOND;
            continue;
          }
          const e = easeInOut(local);
          const u = 1 - e;
          // Quadratic Bezier with the control point at the gate: everyone
          // converges on the test, then fans out to their own bin.
          xs[k] = u * u * s.poolX[k] + 2 * u * e * s.gate1X + e * e * s.binX[k];
          ys[k] = u * u * s.poolY[k] + 2 * u * e * gateY1 + e * e * s.binY[k];
          // The outcome is only revealed once the individual clears the gate.
          col[k] = e < 0.5 ? (cond ? COND : NOCOND) : s.kind1[k];
        }
        radius = (s.cell + s.binCell) / 4;
      } else if (ph === 'split') {
        for (let k = 0; k < n; k++) {
          xs[k] = s.binX[k];
          ys[k] = s.binY[k];
          col[k] = s.kind1[k];
        }
        radius = s.binCell / 2;
      } else if (ph === 'test2') {
        let moverIndex = 0;
        const movers = Math.max(1, s.moves2.reduce((a, b) => a + b, 0));
        for (let k = 0; k < n; k++) {
          if (!s.moves2[k]) {
            xs[k] = s.binX[k];
            ys[k] = s.binY[k];
            col[k] = s.kind1[k];
            continue;
          }
          const depart = (moverIndex++ / movers) * 0.45;
          const local = Math.min(1, Math.max(0, (p - depart) / 0.55));
          const e = easeInOut(local);
          const u = 1 - e;
          xs[k] = u * u * s.binX[k] + 2 * u * e * s.gate2X + e * e * s.finX[k];
          ys[k] = u * u * s.binY[k] + 2 * u * e * gateY2 + e * e * s.finY[k];
          col[k] = e < 0.5 ? s.kind1[k] : s.kind2[k];
        }
        radius = s.binCell / 2;
      } else {
        for (let k = 0; k < n; k++) {
          xs[k] = s.finX[k];
          ys[k] = s.finY[k];
          col[k] = s.kind2[k];
        }
        radius = s.binCell / 2;
      }

      // Conditioning: positives travel to the repacked group, everyone else
      // fades out of existence — they are no longer part of the population.
      const alpha = new Float32Array(n).fill(1);
      if (focus > 0) {
        const e = easeInOut(focus);
        for (let k = 0; k < n; k++) {
          const isPos = s.kind1[k] === TP || s.kind1[k] === FP;
          if (isPos) {
            xs[k] += (s.focusX[k] - xs[k]) * e;
            ys[k] += (s.focusY[k] - ys[k]) * e;
          } else {
            alpha[k] = 1 - e;
          }
        }
        radius = radius + (s.focusCell / 2 - radius) * e;
      }

      // Containers first, so the moving dots read as being "inside" them.
      const frame = (b: Box, title: string, value: string, accent: string, on: boolean) => {
        ctx.globalAlpha = (on ? 1 : 0.35) * (1 - focus);
        if (ctx.globalAlpha <= 0.01) return;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(10,15,33,.45)';
        const r = 8;
        ctx.beginPath();
        ctx.moveTo(b.x + r, b.y - 4);
        ctx.arcTo(b.x + b.w + 6, b.y - 4, b.x + b.w + 6, b.y + b.h + 6, r);
        ctx.arcTo(b.x + b.w + 6, b.y + b.h + 6, b.x - 6, b.y + b.h + 6, r);
        ctx.arcTo(b.x - 6, b.y + b.h + 6, b.x - 6, b.y - 4, r);
        ctx.arcTo(b.x - 6, b.y - 4, b.x + b.w + 6, b.y - 4, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.font = '600 11px system-ui, sans-serif';
        const tx = b.x - 4;
        ctx.fillText(title, tx, b.y - 12);
        const titleWidth = ctx.measureText(title).width;
        ctx.fillStyle = '#9aa6c8';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText(value, tx + titleWidth + 9, b.y - 12);
        ctx.globalAlpha = 1;
      };

      const past = (a: Phase) => {
        const order: Phase[] = ['idle', 'population', 'condition', 'test1', 'split', 'test2', 'done'];
        return order.indexOf(ph) >= order.indexOf(a);
      };

      frame(s.pool, labels.population, labels.fmt(s.counts.population), '#7c8cff', !past('split'));
      frame(s.posBox, labels.positive1, labels.fmt(s.counts.positive1), '#c084fc', past('test1'));
      frame(s.negBox, labels.negative1, labels.fmt(s.counts.negative1), '#5b678f', past('test1'));
      if (confirmatory) {
        frame(s.bothBox, labels.positiveBoth, labels.fmt(s.counts.positive2), OUTCOME_COLORS.truePositive, past('test2'));
        frame(s.clearedBox, labels.cleared, labels.fmt(s.counts.negative2), '#8b93b5', past('test2'));
      }

      // Gates.
      const gate = (x: number, y0: number, y1: number, name: string, on: boolean) => {
        ctx.globalAlpha = on ? 1 : 0.4;
        ctx.fillStyle = '#0e1430';
        ctx.strokeStyle = on ? '#7c8cff' : '#3d4a86';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(x - 13, y0, 26, y1 - y0, 8);
        ctx.fill();
        ctx.stroke();
        ctx.save();
        ctx.translate(x, (y0 + y1) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = on ? '#a5b4ff' : '#6b779c';
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(name, 0, 4);
        ctx.restore();
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      };
      if (focus < 1) {
        gate(s.gate1X, 30, H - 24, labels.test1, ph === 'test1');
        if (confirmatory) gate(s.gate2X, 30, H * 0.36, labels.test2, ph === 'test2');
      }
      if (focus > 0) {
        ctx.globalAlpha = focus;
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.4;
        ctx.fillStyle = 'rgba(24,14,40,.5)';
        ctx.beginPath();
        ctx.roundRect(s.focusBox.x - 12, s.focusBox.y - 12, s.focusBox.w + 24, s.focusBox.h + 24, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e9d5ff';
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.fillText(labels.focusTitle, s.focusBox.x - 8, s.focusBox.y - 24);
        ctx.globalAlpha = 1;
      }

      // Dots, batched by colour.
      const r = Math.max(1, radius);
      const faded = focus > 0 && focus < 1;
      const round = r >= 2.6;
      const shaped = r >= SHAPED_MIN_RADIUS;
      for (let c = 0; c < COLORS.length; c++) {
        ctx.beginPath();
        let any = false;
        // One path, one fill, per colour — so giving each outcome its own
        // silhouette costs nothing beyond picking the emitter up front.
        const glyph = shaped ? GLYPH[c] : round ? DISC : BLOCK;
        for (let k = 0; k < n; k++) {
          if (col[k] !== c) continue;
          any = true;
          glyph(ctx, xs[k], ys[k], r);
        }
        if (!any) continue;
        ctx.fillStyle = COLORS[c];
        ctx.globalAlpha = c === UNKNOWN ? 0.5 : 1;
        ctx.fill();
      }
      // Anyone conditioned away is redrawn faded on top of their own colour.
      // The hole that erases someone conditioned away has to cover whichever
      // glyph they were drawn with, and no glyph reaches past r.
      const punch = r * 1.15;
      if (faded) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          if (alpha[k] >= 1) continue;
          ctx.moveTo(xs[k] + r, ys[k]);
          ctx.arc(xs[k], ys[k], punch, 0, globalThis.Math.PI * 2);
        }
        ctx.globalAlpha = easeInOut(focus);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (focus >= 1) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          if (s.kind1[k] === TP || s.kind1[k] === FP) continue;
          ctx.moveTo(xs[k] + r, ys[k]);
          ctx.arc(xs[k], ys[k], punch, 0, globalThis.Math.PI * 2);
        }
        ctx.globalAlpha = 1;
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    },
    [scene, H, confirmatory, labels, result],
  );

  // One rAF loop drives both the phase sweep and the conditioning transition,
  // so the two can never fight over the canvas.
  const focusAmount = useRef(0);
  useEffect(() => {
    let cancel: (() => void) | undefined;
    const start = performance.now();
    const from = focusAmount.current;
    const to = focused ? 1 : 0;
    const focusMs = from === to ? 0 : 850;
    const runMs = Math.max(focusMs, sweepMs);
    const tick = () => {
      const elapsed = performance.now() - start;
      const f = focusMs === 0 ? to : from + (to - from) * Math.min(1, elapsed / focusMs);
      focusAmount.current = f;
      const p = sweepMs <= 0 ? 1 : Math.min(1, elapsed / sweepMs);
      draw(p, phase, f);
      if (elapsed < runMs) cancel = nextFrame(tick);
    };
    tick();
    return () => cancel?.();
  }, [draw, phase, sweepMs, focused]);

  return (
    <div className="pop-wrap stream-scroll" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="pop-grid"
        role="img"
        aria-label={`${labels.population}: ${labels.fmt(scene.counts.population)}`}
      />
      {scene.shown < scene.total && (
        <div className="field-sub" style={{ marginTop: 6 }}>
          {labels.sampling(scene.shown, scene.total)}
        </div>
      )}
    </div>
  );
}
