import { useMemo } from 'react';
import { cn } from '@/lib/utils/helpers';

interface TrailThumbnailProps {
  /** `[lat, lon]` pairs, already decimated. */
  preview: [number, number][];
  width?: number;
  height?: number;
  className?: string;
}

/** Equirectangular sketch of a flight's track, for list cards. */
export function TrailThumbnail({
  preview,
  width = 96,
  height = 56,
  className,
}: TrailThumbnailProps) {
  const path = useMemo(() => {
    if (preview.length < 2) return null;
    const lons = preview.map((p) => p[1]);
    const lats = preview.map((p) => p[0]);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const spanLon = Math.max(1e-4, (maxLon - minLon) * Math.cos(midLat));
    const spanLat = Math.max(1e-4, maxLat - minLat);
    const pad = 6;
    const scale = Math.min((width - pad * 2) / spanLon, (height - pad * 2) / spanLat);
    const offsetX = (width - spanLon * scale) / 2;
    const offsetY = (height - spanLat * scale) / 2;
    return preview
      .map(([lat, lon], i) => {
        const x = offsetX + (lon - minLon) * Math.cos(midLat) * scale;
        const y = offsetY + (maxLat - lat) * scale;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [preview, width, height]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('shrink-0', className)}
      aria-hidden
    >
      {path ? (
        <>
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
          <circle
            cx={parseFloat(path.split(' ')[0]!.slice(1))}
            cy={parseFloat(path.split(' ')[1]!)}
            r={2.5}
            fill="currentColor"
            opacity={0.6}
          />
        </>
      ) : (
        <circle cx={width / 2} cy={height / 2} r={3} fill="currentColor" opacity={0.4} />
      )}
    </svg>
  );
}
