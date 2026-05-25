import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { renderVacPdfToPng } from '@/lib/sia/pdfToPng';
import { vacPdfPreviewUrl } from '@/lib/sia/vacPdfUrl';
import { cn } from '@/lib/utils/helpers';

type PreviewMode = 'png' | 'pdf' | null;

interface VacChartPreviewProps {
  icao: string;
  chartIcao: string;
  className?: string;
}

export function VacChartPreview({ icao, chartIcao, className }: VacChartPreviewProps) {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const blobUrlRef = useRef<string | null>(null);

  const clearBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const showPng = useCallback(
    (bytes: Uint8Array) => {
      clearBlob();
      const blob = new Blob([Uint8Array.from(bytes)], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setPreviewUrl(url);
      setPreviewMode('png');
      setError(null);
    },
    [clearBlob]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    clearBlob();
    setPreviewUrl(null);
    setPreviewMode(null);
    setZoom(1);

    try {
      let png = await window.siaAPI.getVacPngBytes(icao);
      let pdfBytes: Uint8Array | null = null;

      if (!png?.length) {
        pdfBytes = await window.siaAPI.getVacPdfBytes(icao);
        if (pdfBytes?.length) {
          try {
            png = await renderVacPdfToPng(pdfBytes, 2.5);
            await window.siaAPI.writePngCache(chartIcao, png);
          } catch (pdfJsErr) {
            console.warn('VAC pdf.js render failed, trying main capture', pdfJsErr);
          }
        }
      }

      if (!png?.length) {
        png = await window.siaAPI.renderVacPng(icao);
      }

      if (png?.length) {
        showPng(png);
        return;
      }

      if (!pdfBytes?.length) {
        pdfBytes = await window.siaAPI.getVacPdfBytes(icao);
      }
      if (pdfBytes?.length) {
        setPreviewUrl(vacPdfPreviewUrl(chartIcao));
        setPreviewMode('pdf');
        return;
      }

      setError(t('vac.previewFailed'));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [icao, chartIcao, t, clearBlob, showPng]);

  useEffect(() => {
    void load();
    return () => clearBlob();
  }, [load, clearBlob]);

  const zoomIn = () => setZoom((z) => Math.min(4, z + 0.25));
  const zoomOut = () => setZoom((z) => Math.max(0.5, z - 0.25));

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={!previewUrl}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={!previewUrl}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void load()} title={t('vac.refresh')}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="max-h-[min(70vh,560px)] overflow-auto rounded-md border border-border/40 bg-muted/30 p-1">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t('vac.rendering')}</p>
        ) : previewMode === 'png' && previewUrl ? (
          <img
            src={previewUrl}
            alt={`VAC ${chartIcao}`}
            className="origin-top-left"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            draggable={false}
          />
        ) : previewMode === 'pdf' && previewUrl ? (
          <iframe
            src={previewUrl}
            title={`VAC ${chartIcao}`}
            className="min-h-[480px] w-full border-0 bg-white"
            style={{ height: `${480 * zoom}px` }}
          />
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {error ?? t('vac.previewFailed')}
          </p>
        )}
      </div>
    </div>
  );
}
