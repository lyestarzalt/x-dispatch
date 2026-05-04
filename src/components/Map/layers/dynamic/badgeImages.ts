import maplibregl from 'maplibre-gl';

export type PillImageOptions = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  fontSize: number;
  height: number;
  minWidth: number;
  paddingX: number;
  radius: number;
  borderWidth?: number;
  pixelRatio?: number;
};

type ImageDataLike = {
  width: number;
  height: number;
  data: Uint8Array;
};

const DEFAULT_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const clampedRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + clampedRadius, y);
  ctx.lineTo(x + width - clampedRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
  ctx.lineTo(x + width, y + height - clampedRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - clampedRadius, y + height);
  ctx.lineTo(x + clampedRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
  ctx.lineTo(x, y + clampedRadius);
  ctx.quadraticCurveTo(x, y, x + clampedRadius, y);
  ctx.closePath();
}

function createPillImageData(text: string, options: PillImageOptions): ImageDataLike {
  const pixelRatio = Math.max(1, options.pixelRatio ?? 1);
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) {
    throw new Error('Canvas 2D context unavailable');
  }

  measureCtx.font = `700 ${options.fontSize}px ${DEFAULT_FONT_FAMILY}`;
  const textWidth = Math.ceil(measureCtx.measureText(text).width);

  const width = Math.max(options.minWidth, textWidth + options.paddingX * 2);
  const height = options.height;
  const borderWidth = options.borderWidth ?? 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.scale(pixelRatio, pixelRatio);

  ctx.clearRect(0, 0, width, height);
  drawRoundedRect(
    ctx,
    borderWidth / 2,
    borderWidth / 2,
    width - borderWidth,
    height - borderWidth,
    options.radius
  );
  ctx.fillStyle = options.backgroundColor;
  ctx.fill();

  if (borderWidth > 0) {
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = options.borderColor;
    ctx.stroke();
  }

  ctx.font = `700 ${options.fontSize}px ${DEFAULT_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = options.textColor;
  ctx.fillText(text, width / 2, height / 2 + 0.5);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    data: new Uint8Array(imageData.data.buffer),
  };
}

export function ensurePillImage(
  map: maplibregl.Map,
  imageId: string,
  text: string,
  options: PillImageOptions
): void {
  if (map.hasImage(imageId)) {
    return;
  }

  const pixelRatio = Math.max(1, options.pixelRatio ?? 1);
  map.addImage(imageId, createPillImageData(text, options), { pixelRatio });
}
