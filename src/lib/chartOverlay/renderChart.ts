import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { LonLat } from '@/types/geo';
import { pageRectCorners, parsePdfGeoreference } from './georeference';
import { type ChartInk, nightSheet } from './pixels';

/** A chart ready for the map: the page as drawn, and where its corners lie. */
export interface RenderedChart {
  canvas: HTMLCanvasElement;
  /** Top-left, top-right, bottom-right, bottom-left. */
  corners: [LonLat, LonLat, LonLat, LonLat];
}

/** The chart carries no map position: it cannot be laid on the map. */
export class ChartNotGeoreferencedError extends Error {
  constructor() {
    super('The chart PDF carries no georeference');
    this.name = 'ChartNotGeoreferencedError';
  }
}

/**
 * Canvas pixels per PDF point. Four gives about 290 dpi: a page near 1550 by 2380 px, sharp
 * when zoomed in on the final approach and still one small texture.
 */
const RENDER_SCALE = 4;

/**
 * Draws page one of an FAA approach chart for the map: the whole page, placed by the position
 * its plan view carries. The PDF is drawn in the window (pdf.js); nothing leaves the machine.
 */
export async function renderChart(pdf: Uint8Array, ink: ChartInk): Promise<RenderedChart> {
  const geo = parsePdfGeoreference(pdf);
  if (!geo) throw new ChartNotGeoreferencedError();

  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  // pdf.js takes ownership of the bytes it is given, so it gets a copy.
  const task = pdfjs.getDocument({
    data: pdf.slice(),
    useWasm: false,
    useWorkerFetch: false,
    disableWorkerRendering: true,
  });
  try {
    const document = await task.promise;
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { willReadFrequently: ink === 'light' });
    if (!context) throw new Error('No 2D canvas for the chart');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    if (ink === 'light') {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      nightSheet(pixels.data);
      context.putImageData(pixels, 0, 0);
    }
    const whole = { x: 0, y: 0, width: geo.page.width, height: geo.page.height };
    return { canvas, corners: pageRectCorners(geo, whole) };
  } finally {
    void task.destroy();
  }
}
