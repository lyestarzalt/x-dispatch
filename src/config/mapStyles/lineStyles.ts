import { LineType } from '@/lib/aptParser/types';

export interface LineStyle {
  color: string;
  width: number;
  dashArray?: number[];
  hasBorder: boolean;
  borderColor?: string;
  borderWidth?: number;
}

/**
 * Complete line type to style mapping for all 50+ X-Plane line types
 * Follows real-world airport marking standards (FAA/ICAO)
 */
export const LINE_STYLES: Record<number, LineStyle> = {
  // ===== YELLOW LINES (Taxiway markings) =====
  // LineType.NONE (0) = No painted line, should never render
  [LineType.NONE]: {
    color: 'rgba(0,0,0,0)',
    width: 0,
    hasBorder: false,
  },
  [LineType.SOLID_YELLOW]: {
    color: '#FFD700',
    width: 2,
    hasBorder: false,
  },
  [LineType.BROKEN_YELLOW]: {
    color: '#FFD700',
    width: 2,
    dashArray: [4, 4],
    hasBorder: false,
  },
  [LineType.DOUBLE_SOLID_YELLOW]: {
    color: '#FFD700',
    width: 4,
    hasBorder: false,
  },
  [LineType.RUNWAY_HOLD]: {
    color: '#FFD700',
    width: 4,
    dashArray: [2, 2, 6, 2],
    hasBorder: false,
  },
  [LineType.OTHER_HOLD]: {
    color: '#FFD700',
    width: 3,
    dashArray: [3, 3],
    hasBorder: false,
  },
  [LineType.ILS_HOLD]: {
    color: '#FFD700',
    width: 4,
    dashArray: [1, 1, 1, 1, 4, 1],
    hasBorder: false,
  },
  [LineType.ILS_CRITICAL_CENTERLINE]: {
    color: '#FFD700',
    width: 2,
    dashArray: [2, 2],
    hasBorder: false,
  },
  [LineType.SEPARATED_BROKEN_YELLOW]: {
    color: '#FFD700',
    width: 2,
    dashArray: [8, 4],
    hasBorder: false,
  },
  [LineType.SEPARATED_DOUBLE_BROKEN_YELLOW]: {
    color: '#FFD700',
    width: 4,
    dashArray: [8, 4],
    hasBorder: false,
  },
  [LineType.WIDE_SOLID_YELLOW]: {
    color: '#FFD700',
    width: 5,
    hasBorder: false,
  },
  [LineType.WIDE_ILS_CRITICAL_CENTERLINE]: {
    color: '#FFD700',
    width: 4,
    dashArray: [2, 2],
    hasBorder: false,
  },
  [LineType.WIDE_RUNWAY_HOLD]: {
    color: '#FFD700',
    width: 6,
    dashArray: [2, 2, 6, 2],
    hasBorder: false,
  },
  [LineType.WIDE_OTHER_HOLD]: {
    color: '#FFD700',
    width: 5,
    dashArray: [3, 3],
    hasBorder: false,
  },
  [LineType.WIDE_ILS_HOLD]: {
    color: '#FFD700',
    width: 6,
    dashArray: [1, 1, 1, 1, 4, 1],
    hasBorder: false,
  },
  [LineType.VERY_WIDE_YELLOW]: {
    color: '#FFD700',
    width: 8,
    hasBorder: false,
  },

  // ===== WHITE LINES (Road/runway markings) =====
  [LineType.SOLID_WHITE]: {
    color: '#FFFFFF',
    width: 2,
    hasBorder: false,
  },
  [LineType.CHEQUERED_WHITE]: {
    color: '#FFFFFF',
    width: 3,
    dashArray: [1, 1],
    hasBorder: false,
  },
  [LineType.BROKEN_WHITE]: {
    color: '#FFFFFF',
    width: 2,
    dashArray: [4, 4],
    hasBorder: false,
  },
  [LineType.SHORT_BROKEN_WHITE]: {
    color: '#FFFFFF',
    width: 2,
    dashArray: [2, 2],
    hasBorder: false,
  },
  [LineType.WIDE_SOLID_WHITE]: {
    color: '#FFFFFF',
    width: 5,
    hasBorder: false,
  },
  [LineType.WIDE_BROKEN_WHITE]: {
    color: '#FFFFFF',
    width: 5,
    dashArray: [4, 4],
    hasBorder: false,
  },

  // ===== RED LINES (Danger zones) =====
  [LineType.SOLID_RED]: {
    color: '#FF0000',
    width: 3,
    hasBorder: false,
  },
  [LineType.BROKEN_RED]: {
    color: '#FF0000',
    width: 3,
    dashArray: [4, 4],
    hasBorder: false,
  },
  [LineType.WIDE_SOLID_RED]: {
    color: '#FF0000',
    width: 5,
    hasBorder: false,
  },

  // ===== OTHER COLORS =====
  [LineType.SOLID_ORANGE]: {
    color: '#FFA500',
    width: 2,
    hasBorder: false,
  },
  [LineType.SOLID_BLUE]: {
    color: '#0066FF',
    width: 2,
    hasBorder: false,
  },
  [LineType.SOLID_GREEN]: {
    color: '#00FF00',
    width: 2,
    hasBorder: false,
  },

  // ===== YELLOW LINES WITH BLACK BORDER =====
  [LineType.SOLID_YELLOW_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 2,
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 4,
  },
  [LineType.BROKEN_YELLOW_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 2,
    dashArray: [4, 4],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 4,
  },
  [LineType.DOUBLE_SOLID_YELLOW_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 4,
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 6,
  },
  [LineType.RUNWAY_HOLD_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 4,
    dashArray: [2, 2, 6, 2],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 6,
  },
  [LineType.OTHER_HOLD_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 3,
    dashArray: [3, 3],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 5,
  },
  [LineType.ILS_HOLD_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 4,
    dashArray: [1, 1, 1, 1, 4, 1],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 6,
  },
  [LineType.ILS_CRITICAL_CENTERLINE_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 2,
    dashArray: [2, 2],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 4,
  },
  [LineType.SEPARATED_BROKEN_YELLOW_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 2,
    dashArray: [8, 4],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 4,
  },
  [LineType.SEPARATED_DOUBLE_BROKEN_YELLOW_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 4,
    dashArray: [8, 4],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 6,
  },
  [LineType.WIDE_SOLID_YELLOW_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 5,
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 7,
  },
  [LineType.WIDE_ILS_CRITICAL_CENTERLINE_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 4,
    dashArray: [2, 2],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 6,
  },
  [LineType.WIDE_RUNWAY_HOLD_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 6,
    dashArray: [2, 2, 6, 2],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 8,
  },
  [LineType.WIDE_OTHER_HOLD_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 5,
    dashArray: [3, 3],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 7,
  },
  [LineType.WIDE_ILS_HOLD_WITH_BLACK_BORDER]: {
    color: '#FFD700',
    width: 6,
    dashArray: [1, 1, 1, 1, 4, 1],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 8,
  },

  // ===== WHITE LINES WITH BLACK BORDER =====
  [LineType.SOLID_WHITE_WITH_BLACK_BORDER]: {
    color: '#FFFFFF',
    width: 2,
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 4,
  },
  [LineType.CHEQUERED_WHITE_WITH_BLACK_BORDER]: {
    color: '#FFFFFF',
    width: 3,
    dashArray: [1, 1],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 5,
  },
  [LineType.BROKEN_WHITE_WITH_BLACK_BORDER]: {
    color: '#FFFFFF',
    width: 2,
    dashArray: [4, 4],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 4,
  },
  [LineType.SHORT_BROKEN_WHITE_WITH_BLACK_BORDER]: {
    color: '#FFFFFF',
    width: 2,
    dashArray: [2, 2],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 4,
  },
  [LineType.WIDE_SOLID_WHITE_WITH_BLACK_BORDER]: {
    color: '#FFFFFF',
    width: 5,
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 7,
  },
  [LineType.WIDE_BROKEN_WHITE_WITH_BLACK_BORDER]: {
    color: '#FFFFFF',
    width: 5,
    dashArray: [4, 4],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 7,
  },

  // ===== RED LINES WITH BLACK BORDER =====
  [LineType.SOLID_RED_WITH_BLACK_BORDER]: {
    color: '#FF0000',
    width: 3,
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 5,
  },
  [LineType.BROKEN_RED_WITH_BLACK_BORDER]: {
    color: '#FF0000',
    width: 3,
    dashArray: [4, 4],
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 5,
  },
  [LineType.WIDE_SOLID_RED_WITH_BLACK_BORDER]: {
    color: '#FF0000',
    width: 5,
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 7,
  },

  // ===== OTHER COLORS WITH BLACK BORDER =====
  [LineType.SOLID_ORANGE_WITH_BLACK_BORDER]: {
    color: '#FFA500',
    width: 2,
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 4,
  },
  [LineType.SOLID_BLUE_WITH_BLACK_BORDER]: {
    color: '#0066FF',
    width: 2,
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 4,
  },
  [LineType.SOLID_GREEN_WITH_BLACK_BORDER]: {
    color: '#00FF00',
    width: 2,
    hasBorder: true,
    borderColor: '#000000',
    borderWidth: 4,
  },
};

/**
 * Default style for unknown line types - transparent so they don't render
 * If an artist uses a line type that's not defined, it should not show
 */
const DEFAULT_LINE_STYLE: LineStyle = {
  color: 'rgba(0,0,0,0)',
  width: 0,
  hasBorder: false,
};

/**
 * Get line style with fallback to default
 */
export function getLineStyle(lineType: number): LineStyle {
  return LINE_STYLES[lineType] ?? DEFAULT_LINE_STYLE;
}

/**
 * Build MapLibre paint expression for line colors
 */
export function buildLineColorExpression(): maplibregl.ExpressionSpecification {
  const matchExpression: unknown[] = ['match', ['get', 'lineType']];

  for (const [type, style] of Object.entries(LINE_STYLES)) {
    matchExpression.push(parseInt(type), style.color);
  }

  matchExpression.push(DEFAULT_LINE_STYLE.color); // fallback
  return matchExpression as maplibregl.ExpressionSpecification;
}

/**
 * Build MapLibre paint expression for line widths
 */
export function buildLineWidthExpression(): maplibregl.ExpressionSpecification {
  const matchExpression: unknown[] = ['match', ['get', 'lineType']];

  for (const [type, style] of Object.entries(LINE_STYLES)) {
    matchExpression.push(parseInt(type), style.width);
  }

  matchExpression.push(DEFAULT_LINE_STYLE.width); // fallback
  return matchExpression as maplibregl.ExpressionSpecification;
}

/**
 * Build MapLibre paint expression for border colors
 */
export function buildBorderColorExpression(): maplibregl.ExpressionSpecification {
  const matchExpression: unknown[] = ['match', ['get', 'lineType']];

  for (const [type, style] of Object.entries(LINE_STYLES)) {
    if (style.hasBorder && style.borderColor) {
      matchExpression.push(parseInt(type), style.borderColor);
    }
  }

  matchExpression.push('transparent'); // fallback
  return matchExpression as maplibregl.ExpressionSpecification;
}

/**
 * Build MapLibre paint expression for border widths
 */
export function buildBorderWidthExpression(): maplibregl.ExpressionSpecification {
  const matchExpression: unknown[] = ['match', ['get', 'lineType']];

  for (const [type, style] of Object.entries(LINE_STYLES)) {
    if (style.hasBorder && style.borderWidth) {
      matchExpression.push(parseInt(type), style.borderWidth);
    }
  }

  matchExpression.push(0); // fallback
  return matchExpression as maplibregl.ExpressionSpecification;
}
