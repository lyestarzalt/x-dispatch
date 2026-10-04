import FlightStrip from '@/components/Map/widgets/FlightStrip';
import { usePlaneStateStream } from '@/queries/useXPlaneWebSocket';

/** The whole renderer of the detached flight strip window: the strip and nothing else. */
export function FlightStripWindow() {
  usePlaneStateStream();
  return (
    <div className="bg-background flex h-screen w-screen items-center justify-center overflow-hidden">
      <FlightStrip detached onCenterPlane={() => {}} />
    </div>
  );
}
