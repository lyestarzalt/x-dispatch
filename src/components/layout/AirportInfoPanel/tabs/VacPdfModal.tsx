import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import {
  loadVacPdfDocument,
  normalizePdfBytes,
  renderVacPdfPage,
} from '@/modules/sia-france/lib/vacPdfDocument';
import { cn } from '@/lib/utils/helpers';

interface VacPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icao: string;
  chartIcao: string;
  pdfBytes?: Uint8Array | null;
}

export function VacPdfModal({
  open,
  onOpenChange,
  icao,
  chartIcao,
  pdfBytes: pdfBytesProp,
}: VacPdfModalProps) {
  const { t } = useTranslation();
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [scale, setScale] = useState(1.25);
  const pagesHostRef = useRef<HTMLDivElement>(null);
  const renderGenRef = useRef(0);

  const renderPages = useCallback(async (pdfBytes: Uint8Array, zoom: number) => {
    const host = pagesHostRef.current;
    if (!host) return;

    const gen = ++renderGenRef.current;
    setLoading(true);
    setError(null);
    host.replaceChildren();

    try {
      const pdf = await loadVacPdfDocument(pdfBytes);
      if (gen !== renderGenRef.current) return;

      const total = pdf.numPages;
      setPageCount(total);
      setPageIndex((i) => Math.min(i, Math.max(0, total - 1)));

      const fragment = document.createDocumentFragment();
      for (let n = 1; n <= total; n++) {
        if (gen !== renderGenRef.current) return;
        const page = await pdf.getPage(n);
        const canvas = await renderVacPdfPage(page, zoom);
        canvas.className = 'mx-auto mb-4 block max-w-full rounded-sm bg-white shadow-sm';
        canvas.setAttribute('data-page', String(n));
        fragment.appendChild(canvas);
      }

      if (gen !== renderGenRef.current) return;
      host.appendChild(fragment);
    } catch (err) {
      if (gen !== renderGenRef.current) return;
      setError((err as Error).message);
      setPageCount(0);
    } finally {
      if (gen === renderGenRef.current) setLoading(false);
    }
  }, []);

  const fetchBytes = useCallback(async (): Promise<Uint8Array | null> => {
    if (pdfBytesProp?.length) return normalizePdfBytes(pdfBytesProp);
    const fromDisk = await window.siaAPI.getVacPdfBytes(icao);
    return fromDisk?.length ? normalizePdfBytes(fromDisk) : null;
  }, [icao, pdfBytesProp]);

  useEffect(() => {
    if (!open) {
      setBytes(null);
      setError(null);
      setPageCount(0);
      setPageIndex(0);
      renderGenRef.current += 1;
      pagesHostRef.current?.replaceChildren();
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const loaded = await fetchBytes();
      if (cancelled) return;
      if (!loaded?.length) {
        setError(t('vac.previewFailed'));
        setBytes(null);
        setLoading(false);
        return;
      }
      setBytes(loaded);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, fetchBytes, t]);

  useEffect(() => {
    if (!open || !bytes?.length) return;
    void renderPages(bytes, scale);
    return () => {
      renderGenRef.current += 1;
    };
  }, [open, bytes, scale, renderPages]);

  useEffect(() => {
    if (!open || loading) return;
    const host = pagesHostRef.current;
    if (!host?.childElementCount) return;
    const target = host.querySelector<HTMLElement>(`[data-page="${pageIndex + 1}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pageIndex, open, loading]);

  const reload = useCallback(async () => {
    const loaded = await fetchBytes();
    if (!loaded?.length) {
      setError(t('vac.previewFailed'));
      return;
    }
    setBytes(loaded);
  }, [fetchBytes, t]);

  const prevPage = () => setPageIndex((i) => Math.max(0, i - 1));
  const nextPage = () => setPageIndex((i) => Math.min(pageCount - 1, i + 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-3 z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <DialogTitle className="sr-only">
            {t('vac.modalTitle', { icao: chartIcao })}
          </DialogTitle>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2">
            <span className="font-mono text-sm font-semibold text-info">{chartIcao}</span>
            <span className="text-xs text-muted-foreground">{t('vac.chartLabel')}</span>

            <div className="ml-auto flex flex-wrap items-center gap-1">
              {pageCount > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={prevPage}
                    disabled={pageIndex <= 0 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[4.5rem] text-center text-xs text-muted-foreground">
                    {t('vac.pageOf', { page: pageIndex + 1, total: pageCount })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={nextPage}
                    disabled={pageIndex >= pageCount - 1 || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="mx-1 h-4 w-px bg-border/60" />
                </>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
                disabled={loading}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setScale((s) => Math.min(3, s + 0.25))}
                disabled={loading}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void reload()}
                disabled={loading}
                title={t('vac.refresh')}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>

              <span className="mx-1 h-4 w-px bg-border/60" />

              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs"
                onClick={() => void window.siaAPI.openVacPdf(icao)}
              >
                <FileText className="h-3.5 w-3.5" />
                {t('vac.openExternal')}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 bg-muted/20">
            <div className="relative min-h-[200px] p-3">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-popover/80">
                  <Spinner className="size-6 text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">{t('vac.rendering')}</span>
                </div>
              )}
              {error && !loading && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button variant="outline" size="sm" onClick={() => void reload()}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    {t('vac.refresh')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void window.siaAPI.openVacPdf(icao)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t('vac.openExternal')}
                  </Button>
                </div>
              )}
              <div ref={pagesHostRef} className={cn(loading && 'opacity-40')} />
            </div>
          </ScrollArea>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
