import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * The X from Laminar Research's X-Plane 12 wordmark (press kit), as a Lucide-shaped
 * icon so it can stand in for `Plane` wherever an icon means the sim itself.
 * The viewBox is a square centred on the glyph; it fills with `currentColor`.
 */
export const XPlaneMark = forwardRef<SVGSVGElement, LucideProps>(function XPlaneMark(
  { size = 24, color = 'currentColor', className, ...rest },
  ref
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="70 -103.5 540 540"
      fill={color}
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d="M126.073 15H292.722L350.968 84.0323L431.326 15H596.895L422.157 168.165L550.514 318.095H384.944L325.62 250.141L249.037 318.095H82.9281L253.891 168.165L126.073 15Z" />
    </svg>
  );
});
