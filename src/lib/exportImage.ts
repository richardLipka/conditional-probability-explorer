/*
 * Conditional Probability Explorer - self-contained PNG export of a visualisation
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
/**
 * Export a visualisation as a self-contained PNG: title, the picture itself,
 * a legend and the parameters it was produced with. The point is that the file
 * still makes sense once it has left the app and been pasted into a report.
 */

export interface LegendEntry {
  color: string;
  label: string;
  value?: string;
  /** Shape hint so the legend survives a black-and-white printout. */
  shape?: 'circle' | 'square' | 'triangle' | 'diamond';
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  legend?: LegendEntry[];
  /** Parameter line printed under the legend. */
  footer?: string;
  credit?: string;
  filename: string;
  /** Extra pixel scale for crisper output. */
  scale?: number;
}

const BG = '#0b1020';
const TEXT = '#e8ecf8';
const MUTED = '#9aa6c8';
const FAINT = '#6b779c';
const FONT = 'system-ui, "Segoe UI", sans-serif';

/** Rasterise an inline <svg> element via a data URL. */
function svgToImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const box = svg.getBoundingClientRect();
  const vb = svg.getAttribute('viewBox')?.split(/[ ,]+/).map(Number);
  const w = vb ? vb[2] : box.width;
  const h = vb ? vb[3] : box.height;
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  // The page background does not travel with the element, so paint it in.
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', String(w));
  bg.setAttribute('height', String(h));
  bg.setAttribute('fill', BG);
  clone.insertBefore(bg, clone.firstChild);

  const xml = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG could not be rasterised'));
    img.src = url;
  });
}

function drawSwatch(
  ctx: CanvasRenderingContext2D,
  entry: LegendEntry,
  x: number,
  y: number,
  s: number,
) {
  ctx.fillStyle = entry.color;
  ctx.beginPath();
  switch (entry.shape) {
    case 'square':
      ctx.rect(x - s / 2, y - s / 2, s, s);
      break;
    case 'triangle':
      ctx.moveTo(x, y - s * 0.62);
      ctx.lineTo(x + s * 0.6, y + s * 0.48);
      ctx.lineTo(x - s * 0.6, y + s * 0.48);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(x, y - s * 0.6);
      ctx.lineTo(x + s * 0.6, y);
      ctx.lineTo(x, y + s * 0.6);
      ctx.lineTo(x - s * 0.6, y);
      ctx.closePath();
      break;
    default:
      ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** Wrap text to a width, returning the lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const attempt = line ? `${line} ${w}` : w;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type Source = HTMLCanvasElement | SVGSVGElement;

/**
 * Export one or several visuals stacked vertically. Several matter because the
 * stream view is two pictures — the true-scale flow and the magnified detail —
 * and the second is the one that explains the first.
 */
export async function exportVisual(
  source: Source | Source[],
  options: ExportOptions,
): Promise<void> {
  const scale = options.scale ?? 2;
  const sources = Array.isArray(source) ? source : [source];
  if (!sources.length) return;

  const pictures = await Promise.all(
    sources.map(async (el) => {
      const image: CanvasImageSource =
        el instanceof HTMLCanvasElement ? el : await svgToImage(el);
      const w = el instanceof HTMLCanvasElement ? el.width : (image as HTMLImageElement).naturalWidth;
      const h =
        el instanceof HTMLCanvasElement ? el.height : (image as HTMLImageElement).naturalHeight;
      return { image, w, h };
    }),
  );

  // Lay the pictures out at a common width and scale their heights to match.
  const width = Math.max(720, Math.min(1600, Math.max(...pictures.map((p) => p.w))));
  const gap = 12;
  const heights = pictures.map((p) => (p.h / p.w) * width);
  const pictureH = heights.reduce((a, b) => a + b, 0) + gap * (pictures.length - 1);

  const pad = 26;
  const legend = options.legend ?? [];
  const legendCols = Math.min(2, Math.max(1, Math.ceil(legend.length / 4)));
  const legendRows = Math.ceil(legend.length / legendCols);

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `13px ${FONT}`;
  const footerLines = options.footer ? wrap(measure, options.footer, width - pad * 2) : [];

  const headerH = options.subtitle ? 74 : 52;
  const legendH = legend.length ? legendRows * 26 + 14 : 0;
  const footerH = footerLines.length * 19 + (options.credit ? 22 : 0) + 10;
  const height = headerH + pictureH + legendH + footerH + pad;

  const out = document.createElement('canvas');
  out.width = Math.round(width * scale);
  out.height = Math.round(height * scale);
  const ctx = out.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = TEXT;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(options.title, pad, 32);
  if (options.subtitle) {
    ctx.fillStyle = MUTED;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(options.subtitle, pad, 54);
  }

  let py = headerH;
  pictures.forEach((p, i) => {
    ctx.drawImage(p.image, 0, py, width, heights[i]);
    py += heights[i] + gap;
  });

  let y = headerH + pictureH + 22;
  if (legend.length) {
    const colW = (width - pad * 2) / legendCols;
    legend.forEach((entry, i) => {
      const col = Math.floor(i / legendRows);
      const row = i % legendRows;
      const x = pad + col * colW;
      const ly = y + row * 26;
      drawSwatch(ctx, entry, x + 7, ly - 4, 13);
      ctx.fillStyle = TEXT;
      ctx.font = `600 13px ${FONT}`;
      ctx.fillText(entry.label, x + 22, ly);
      if (entry.value) {
        const w = ctx.measureText(entry.label).width;
        ctx.fillStyle = MUTED;
        ctx.font = `13px ui-monospace, monospace`;
        ctx.fillText(entry.value, x + 30 + w, ly);
      }
    });
    y += legendRows * 26 + 8;
  }

  ctx.fillStyle = FAINT;
  ctx.font = `13px ${FONT}`;
  for (const line of footerLines) {
    ctx.fillText(line, pad, y);
    y += 19;
  }
  if (options.credit) {
    ctx.font = `12px ${FONT}`;
    ctx.fillText(options.credit, pad, y + 4);
  }

  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options.filename.endsWith('.png') ? options.filename : `${options.filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Filesystem-safe slug for a filename. */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
