import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, LockOpen, X } from 'lucide-react';
import FlightStrip from '@/components/Map/widgets/FlightStrip';
import { Button } from '@/components/ui/button';
import { useFlightStripGuidance } from '@/hooks/useFlightStripGuidance';
import { useSettingsStorageSync } from '@/hooks/useSettingsStorageSync';
import { aspectChanged } from '@/lib/flightStrip/windowFit';
import { cn } from '@/lib/utils/helpers';
import { useFlightStripWindowOptions } from '@/queries';
import { usePlaneStateStream } from '@/queries/useXPlaneWebSocket';

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
 * The whole renderer of the detached flight strip window. The window has no title bar:
 * unlocked, the strip area drags it, the edges resize it and the strip scales to fit.
 * Locked, main lets every click through to the simulator and a faint lock stays in the
 * corner; hovering brings it up (main forwards mouse moves), and it alone takes clicks.
 */
export function FlightStripWindow() {
  usePlaneStateStream();
  useSettingsStorageSync();
  useFlightStripGuidance();
  const { t } = useTranslation();
  const { locked } = useFlightStripWindowOptions();
  const frameRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const scale = useFitScale(frameRef, stripRef);
  useReportStripShape(stripRef);

  return (
    // The padding stays outside the drag region so the window edges keep resizing.
    <div className="group bg-background relative h-screen w-screen overflow-hidden p-1">
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
          <FlightStrip detached onCenterPlane={() => {}} />
        </div>
      </div>
      <div
        className={cn(
          'bg-background/80 absolute top-1 right-1 flex items-center gap-0.5 rounded-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100',
          // Locked, the lock stays faintly visible so the pilot knows why the strip will not move.
          locked ? 'opacity-60' : 'opacity-0'
        )}
        style={noDragStyle}
        // While the pointer is here a locked window takes clicks, so the grip works. Chromium
        // misses enter and leave as the window flips click-through, so moves report the
        // grip and main drops capture once the cursor is off it. The rect goes to main in
        // screen pixels: Interface Zoom scales CSS pixels.
        onMouseMove={(event) => {
          const zoom = window.outerWidth / window.innerWidth || 1;
          const { x, y, width, height } = event.currentTarget.getBoundingClientRect();
          window.appAPI.setFlightStripMouseCapture({
            x: x * zoom,
            y: y * zoom,
            width: width * zoom,
            height: height * zoom,
          });
        }}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(locked ? 'text-primary' : 'text-muted-foreground')}
          onClick={() => window.appAPI.toggleFlightStripLock()}
          aria-pressed={locked}
          aria-label={locked ? t('flightStrip.unlock') : t('flightStrip.lock')}
          tooltip={locked ? t('flightStrip.unlock') : t('flightStrip.lock')}
        >
          {locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
        </Button>
        {!locked && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            onClick={() => window.close()}
            aria-label={t('common.close')}
            tooltip={t('common.close')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
