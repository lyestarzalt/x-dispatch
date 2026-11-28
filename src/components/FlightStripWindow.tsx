import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, LockOpen, Map as MapIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import FlightStrip from '@/components/Map/widgets/FlightStrip';
import TaxiMiniMap from '@/components/Map/widgets/TaxiMiniMap';
import { Button } from '@/components/ui/button';
import { useFlightStripGuidance } from '@/hooks/useFlightStripGuidance';
import { useFlightStripOpacity } from '@/hooks/useFlightStripOpacity';
import { useSettingsStorageSync } from '@/hooks/useSettingsStorageSync';
import { aspectChanged } from '@/lib/flightStrip/windowFit';
import { cn } from '@/lib/utils/helpers';
import { useFlightStripWindowOptions } from '@/queries';
import { usePlaneStateStream } from '@/queries/useXPlaneWebSocket';
import { usePlaneStore } from '@/stores/planeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTaxiGuidanceStore } from '@/stores/taxiGuidanceStore';

const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;

/** The scale that fits the content inside the frame, recomputed when either resizes. */
function useFitScale(
  frameRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>
) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    const update = () => {
      // offsetWidth ignores the transform, so this is the strip's own size.
      const { offsetWidth: w, offsetHeight: h } = content;
      if (!w || !h) return;
      setScale(Math.min(frame.clientWidth / w, frame.clientHeight / h));
    };
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(content);
    update();
    return () => observer.disconnect();
  }, [frameRef, contentRef]);
  return scale;
}

/** Padding around the strip (`p-1` on both sides), part of the window's shape. */
const FRAME_PADDING_PX = 8;

/**
 * Tells main the strip's natural size whenever its shape changes (a readout turned
 * on or off), so the window keeps the strip's proportions instead of showing bars.
 */
function useReportStripShape(contentRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    let reported: number | null = null;
    const report = () => {
      const width = content.offsetWidth + FRAME_PADDING_PX;
      const height = content.offsetHeight + FRAME_PADDING_PX;
      if (width <= FRAME_PADDING_PX || height <= FRAME_PADDING_PX) return;
      const ratio = width / height;
      if (!aspectChanged(reported, ratio)) return;
      reported = ratio;
      window.appAPI.setFlightStripContentSize({ width, height });
    };
    const observer = new ResizeObserver(report);
    observer.observe(content);
    report();
    return () => observer.disconnect();
  }, [contentRef]);
}

/**
 * Tells main where the strip's buttons are (one set at each end) whenever they move or
 * resize (window resize, Interface Zoom, the strip's scale), so main can watch the cursor
 * over them. The rects go in CSS pixels; main knows the zoom factor that turns them into
 * screen pixels. (`outerWidth / innerWidth` is not that factor: on Windows `outerWidth` is
 * physical pixels plus the invisible resize borders.)
 */
function useReportGrips(gripRefs: React.RefObject<HTMLDivElement | null>[], scale: number) {
  const [leading, trailing] = gripRefs;
  useEffect(() => {
    const grips = [leading?.current, trailing?.current].filter((el) => el != null);
    if (grips.length === 0) return;
    const report = () => {
      window.appAPI.setFlightStripGrip(
        grips.map((grip) => {
          const { x, y, width, height } = grip.getBoundingClientRect();
          return { x, y, width, height };
        })
      );
    };
    const observer = new ResizeObserver(report);
    for (const grip of grips) observer.observe(grip);
    observer.observe(document.documentElement);
    window.addEventListener('resize', report);
    report();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
    };
  }, [leading, trailing, scale]);
}

/**
 * The strip window's buttons: close, lock and the taxi map. The strip carries them at both
 * ends, so they stay in reach whichever side of the screen it is stowed on (GitHub #401).
 */
function StripControls({
  gripRef,
  quiet = false,
  locked,
  taxiMap,
  onToggleTaxiMap,
  inFlight,
}: {
  gripRef: React.RefObject<HTMLDivElement | null>;
  /** The second set: faint until the pointer is on it, so the strip does not show six buttons. */
  quiet?: boolean;
  locked: boolean;
  taxiMap: boolean;
  inFlight: boolean;
  onToggleTaxiMap: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      ref={gripRef}
      className={cn(
        'flex flex-col',
        quiet && 'opacity-30 transition-opacity focus-within:opacity-100 hover:opacity-100'
      )}
      style={noDragStyle}
    >
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground h-5 w-5"
        onClick={() => window.close()}
        aria-label={t('common.close')}
        tooltip={t('common.close')}
      >
        <X className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className={cn('h-5 w-5', locked ? 'text-primary' : 'text-muted-foreground')}
        // A locked window can miss the first click, so pilots double-click; the
        // second click of a double-click would lock it again.
        onClick={(event) => {
          if (event.detail > 1) return;
          window.appAPI.toggleFlightStripLock();
        }}
        aria-pressed={locked}
        aria-label={locked ? t('flightStrip.unlock') : t('flightStrip.lock')}
        tooltip={locked ? t('flightStrip.unlock') : t('flightStrip.lock')}
      >
        {locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className={cn('h-5 w-5', taxiMap ? 'text-primary' : 'text-muted-foreground')}
        onClick={onToggleTaxiMap}
        aria-pressed={taxiMap}
        aria-label={t(inFlight ? 'settings.flightStrip.flightMap' : 'flightStrip.taxiMap')}
        tooltip={t(inFlight ? 'settings.flightStrip.flightMap' : 'flightStrip.taxiMap')}
      >
        <MapIcon className="h-3 w-3" />
      </Button>
    </div>
  );
}

/**
 * The whole renderer of the detached flight strip window. The window has no title bar:
 * unlocked, the strip area drags it, the edges resize it and the strip scales to fit.
 * Locked, main lets every click through to the simulator; main watches the cursor and
 * lets the strip's buttons alone take clicks.
 */
export function FlightStripWindow() {
  usePlaneStateStream();
  useSettingsStorageSync();
  useFlightStripOpacity(true);
  const keepMap = useSettingsStore((s) => s.flightStrip.flightMapOnTakeoff);
  const airborne = usePlaneStore((s) => s.state?.onGround === false);
  const mapOpacity = useSettingsStore((s) => s.flightStrip.taxiMapOpacity);
  useFlightStripGuidance();
  const { t } = useTranslation();
  const { locked } = useFlightStripWindowOptions();
  const frameRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const leadingGripRef = useRef<HTMLDivElement>(null);
  const trailingGripRef = useRef<HTMLDivElement>(null);
  // Map visibility follows the pilot’s toggle; its content follows the flight phase.
  const [taxiMap, setTaxiMap] = useState(false);
  // With automatic switching off, takeoff closes the panel until the pilot reopens it.
  useEffect(
    () =>
      usePlaneStore.subscribe((s, prev) => {
        if (!keepMap && s.state?.onGround === false && prev.state?.onGround === true)
          setTaxiMap(false);
      }),
    [keepMap]
  );
  const hasRoute = useTaxiGuidanceStore((s) => !!(s.departure ?? s.arrival));
  const toggleTaxiMap = () => {
    if (!taxiMap && !hasRoute && !(airborne && keepMap)) {
      toast.info(t('flightStrip.taxiMapNoRoute'));
      return;
    }
    setTaxiMap((open) => !open);
  };
  const scale = useFitScale(frameRef, stripRef);
  useReportStripShape(stripRef);
  useReportGrips([leadingGripRef, trailingGripRef], scale);

  return (
    // The padding stays outside the drag region so the window edges keep resizing.
    <div className="relative h-screen w-screen overflow-hidden p-1">
      <div
        ref={frameRef}
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={locked ? undefined : dragStyle}
      >
        <div
          ref={stripRef}
          className="shrink-0"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
        >
          <FlightStrip
            detached
            onCenterPlane={() => {}}
            leadingActions={
              <StripControls
                quiet
                gripRef={leadingGripRef}
                locked={locked}
                taxiMap={taxiMap}
                inFlight={keepMap && airborne}
                onToggleTaxiMap={toggleTaxiMap}
              />
            }
            actions={
              <StripControls
                gripRef={trailingGripRef}
                locked={locked}
                taxiMap={taxiMap}
                inFlight={keepMap && airborne}
                onToggleTaxiMap={toggleTaxiMap}
              />
            }
            footer={
              taxiMap && (
                <div
                  role="region"
                  aria-label={t(
                    keepMap && airborne ? 'settings.flightStrip.flightMap' : 'flightStrip.taxiMap'
                  )}
                  data-strip-opacity="map"
                  className="bg-card border-border/50 h-56 w-0 min-w-full overflow-hidden rounded-b-xl border-t"
                  style={{ ...noDragStyle, opacity: mapOpacity }}
                >
                  <TaxiMiniMap scale={scale} airborne={airborne && keepMap} />
                </div>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
