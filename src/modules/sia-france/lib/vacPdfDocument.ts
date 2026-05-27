import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let workerReady = false;

export function normalizePdfBytes(data: Uint8Array | ArrayLike<number>): Uint8Array {
  if (data instanceof Uint8Array) {
    return data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
      ? data
      : data.slice();
  }
  return new Uint8Array(data);
}

export async function ensureVacPdfWorker(): Promise<void> {
  if (workerReady) return;
  const fromMain = await window.siaAPI?.getPdfjsWorkerUrl?.();
  pdfjsLib.GlobalWorkerOptions.workerSrc = fromMain ?? pdfWorkerUrl;
  workerReady = true;
}

export async function loadVacPdfDocument(
  pdfBytes: Uint8Array | ArrayLike<number>
): Promise<PDFDocumentProxy> {
  await ensureVacPdfWorker();
  const data = normalizePdfBytes(pdfBytes);
  const task = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  return task.promise;
}

export async function renderVacPdfPage(
  page: Awaited<ReturnType<PDFDocumentProxy['getPage']>>,
  scale: number
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return canvas;
}

export async function renderVacPdfPageToPng(
  pdfBytes: Uint8Array | ArrayLike<number>,
  scale = 2
): Promise<Uint8Array> {
  const pdf = await loadVacPdfDocument(pdfBytes);
  const page = await pdf.getPage(1);
  const canvas = await renderVacPdfPage(page, scale);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}
