import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import FlightStrip from '@/components/Map/widgets/FlightStrip';
import { Button } from '@/components/ui/button';
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

/**
 * The whole renderer of the detached flight strip window. The window has no title bar:
 * the strip area drags it, the edges resize it and the strip scales to fit.
 */
export function FlightStripWindow() {
  usePlaneStateStream();
  const { t } = useTranslation();
  const frameRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const scale = useFitScale(frameRef, stripRef);

  return (
    // The padding stays outside the drag region so the window edges keep resizing.
    <div className="group bg-background relative h-screen w-screen overflow-hidden p-1">
      <div
        ref={frameRef}
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={dragStyle}
      >
        <div
          ref={stripRef}
          className="shrink-0"
          style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
        >
          <FlightStrip detached onCenterPlane={() => {}} />
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground absolute top-1 right-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        style={noDragStyle}
        onClick={() => window.close()}
        aria-label={t('common.close')}
        tooltip={t('common.close')}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
