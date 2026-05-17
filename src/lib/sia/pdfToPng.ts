import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let workerReady = false;

async function ensurePdfWorker(): Promise<void> {
  if (workerReady) return;
  const fromMain = await window.siaAPI?.getPdfjsWorkerUrl?.();
  pdfjsLib.GlobalWorkerOptions.workerSrc = fromMain ?? pdfWorkerUrl;
  workerReady = true;
}

/** Render first page of a VAC PDF to PNG bytes (renderer process). */
export async function renderVacPdfToPng(pdfBytes: Uint8Array, scale = 2): Promise<Uint8Array> {
  await ensurePdfWorker();
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}
