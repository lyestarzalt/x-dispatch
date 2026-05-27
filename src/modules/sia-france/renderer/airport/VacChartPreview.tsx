/* eslint-disable react-hooks/set-state-in-effect -- async VAC load on mount */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Expand, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';
import { normalizePdfBytes, renderVacPdfPageToPng } from '@/modules/sia-france/lib/vacPdfDocument';
import { VacPdfModal } from './VacPdfModal';

interface VacChartPreviewProps {
  icao: string;
  chartIcao: string;
  className?: string;
}

export function VacChartPreview({ icao, chartIcao, className }: VacChartPreviewProps) {
  const { t } = useTranslation();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const clearBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const showThumb = useCallback(
    (bytes: Uint8Array) => {
      clearBlob();
      const blob = new Blob([Uint8Array.from(bytes)], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setThumbUrl(url);
      setError(null);
    },
    [clearBlob]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    clearBlob();
    setThumbUrl(null);
    setPdfBytes(null);

    try {
      let png = await window.siaAPI.getVacPngBytes(icao);
      let bytes: Uint8Array | null = null;

      if (!png?.length) {
        const raw = await window.siaAPI.getVacPdfBytes(icao);
        bytes = raw?.length ? normalizePdfBytes(raw) : null;
        setPdfBytes(bytes);

        if (bytes?.length) {
          try {
            png = await renderVacPdfPageToPng(bytes, 2);
            await window.siaAPI.writePngCache(chartIcao, png);
          } catch (pdfJsErr) {
            void pdfJsErr;
          }
        }
      }

      if (!png?.length) {
        png = await window.siaAPI.renderVacPng(icao);
      }

      if (png?.length) {
        showThumb(png);
        if (!bytes?.length) {
          const raw = await window.siaAPI.getVacPdfBytes(icao);
          if (raw?.length) setPdfBytes(normalizePdfBytes(raw));
        }
        return;
      }

      if (!bytes?.length) {
        const raw = await window.siaAPI.getVacPdfBytes(icao);
        bytes = raw?.length ? normalizePdfBytes(raw) : null;
        setPdfBytes(bytes);
      }

      if (bytes?.length) {
        setError(null);
        return;
      }

      setError(t('vac.previewFailed'));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [icao, chartIcao, t, clearBlob, showThumb]);

  useEffect(() => {
    void load();
    return () => clearBlob();
  }, [load, clearBlob]);

  const canOpen = Boolean(thumbUrl || pdfBytes?.length);

  return (
    <>
      <div className={cn('space-y-2', className)}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            disabled={!canOpen && !loading}
            onClick={() => setModalOpen(true)}
          >
            <Expand className="h-3.5 w-3.5" />
            {t('vac.openModal')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => void load()}
            title={t('vac.refresh')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <button
          type="button"
          disabled={!canOpen}
          onClick={() => canOpen && setModalOpen(true)}
          className={cn(
            'group relative w-full overflow-hidden rounded-md border border-border/40 bg-muted/20 text-left transition-colors',
            canOpen && 'cursor-pointer hover:border-primary/40 hover:bg-muted/30',
            !canOpen && 'cursor-default'
          )}
        >
          <div className="max-h-48 overflow-hidden">
            {loading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{t('vac.rendering')}</p>
            ) : thumbUrl ? (
              <img
                src={thumbUrl}
                alt={`VAC ${chartIcao}`}
                className="w-full object-contain object-top"
                draggable={false}
              />
            ) : error ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{error}</p>
            ) : pdfBytes?.length ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{t('vac.tapToOpen')}</p>
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {t('vac.previewFailed')}
              </p>
            )}
          </div>
          {canOpen && thumbUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/20 group-hover:opacity-100">
              <span className="rounded-md bg-popover/90 px-2 py-1 text-xs font-medium shadow">
                {t('vac.openModal')}
              </span>
            </div>
          )}
        </button>
      </div>

      <VacPdfModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        icao={icao}
        chartIcao={chartIcao}
        pdfBytes={pdfBytes}
      />
    </>
  );
}
