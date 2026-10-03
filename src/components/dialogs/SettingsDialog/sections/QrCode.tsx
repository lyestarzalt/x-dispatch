import { useMemo } from 'react';
import QRCode from 'qrcode';

/** Draws the modules as one path in `currentColor`, so it follows the theme. */
export function qrPath(value: string): { path: string; size: number } {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  let path = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { path, size };
}

export function QrCode({ value, className }: { value: string; className?: string }) {
  const { path, size } = useMemo(() => qrPath(value), [value]);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
