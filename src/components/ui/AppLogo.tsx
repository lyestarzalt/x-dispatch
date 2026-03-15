import { cn } from '@/lib/utils/helpers';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Show with background (for icon use). Default false = transparent mark only */
  withBackground?: boolean;
}

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-16 w-16',
  lg: 'h-20 w-20',
  xl: 'h-32 w-32',
};

export function AppLogo({ size = 'md', className, withBackground = false }: AppLogoProps) {
  // Unique IDs to avoid conflicts when multiple instances are rendered
  const id = Math.random().toString(36).slice(2, 8);

  return (
    <svg
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(sizeClasses[size], className)}
      role="img"
      aria-label="X-Dispatch"
    >
      <defs>
        {withBackground && (
          <radialGradient id={`bg-${id}`} cx="50%" cy="42%" r="58%" fx="45%" fy="38%">
            <stop offset="0%" stopColor="#182838" />
            <stop offset="40%" stopColor="#0D131A" />
            <stop offset="75%" stopColor="#080D14" />
            <stop offset="100%" stopColor="#050810" />
          </radialGradient>
        )}
        <linearGradient id={`xf-${id}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#D4EEFB" />
          <stop offset="12%" stopColor="#A5D9FA" />
          <stop offset="30%" stopColor="#5DC2F7" />
          <stop offset="50%" stopColor="#1DA0F2" />
          <stop offset="72%" stopColor="#1678B5" />
          <stop offset="100%" stopColor="#0C4A78" />
        </linearGradient>
        <linearGradient id={`xs-${id}`} x1="20%" y1="0%" x2="80%" y2="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.3} />
          <stop offset="30%" stopColor="#fff" stopOpacity={0.08} />
          <stop offset="60%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={`rt-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0F5079" />
          <stop offset="30%" stopColor="#4AB3F5" />
          <stop offset="50%" stopColor="#A5D9FA" />
          <stop offset="70%" stopColor="#4AB3F5" />
          <stop offset="100%" stopColor="#0F5079" />
        </linearGradient>
        <linearGradient id={`rb-${id}`} x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#07283D" />
          <stop offset="50%" stopColor="#1678B5" />
          <stop offset="100%" stopColor="#07283D" />
        </linearGradient>
        <filter id={`rg-${id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
        <filter id={`wg-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="40" />
        </filter>
        <filter id={`xd-${id}`} x="-25%" y="-25%" width="160%" height="160%">
          <feDropShadow dx="8" dy="14" stdDeviation="18" floodColor="#000" floodOpacity={0.65} />
        </filter>
        <filter id={`xg-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="20" />
        </filter>
      </defs>

      {/* Background (optional) */}
      {withBackground && <rect x="0" y="0" width="1024" height="1024" fill={`url(#bg-${id})`} />}

      {/* Ring glow layers */}
      <circle
        cx="512"
        cy="512"
        r="380"
        fill="none"
        stroke="#1DA0F2"
        strokeWidth="20"
        opacity={0.15}
        filter={`url(#wg-${id})`}
      />
      <circle
        cx="512"
        cy="512"
        r="380"
        fill="none"
        stroke="#1DA0F2"
        strokeWidth="8"
        opacity={0.5}
        filter={`url(#rg-${id})`}
      />

      {/* Ring — split top/bottom for metallic sheen */}
      <path
        d="M 132,512 A 380,380 0 0 1 892,512"
        fill="none"
        stroke={`url(#rt-${id})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M 892,512 A 380,380 0 0 1 132,512"
        fill="none"
        stroke={`url(#rb-${id})`}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle
        cx="512"
        cy="512"
        r="374"
        fill="none"
        stroke="#4AB3F5"
        strokeWidth="0.5"
        opacity={0.15}
      />

      {/* X glow */}
      <g transform="translate(512,512)" opacity={0.3} filter={`url(#xg-${id})`}>
        <rect
          x="-76"
          y="-320"
          width="152"
          height="640"
          rx="14"
          transform="rotate(32)"
          fill="#1DA0F2"
        />
        <rect
          x="-76"
          y="-320"
          width="152"
          height="640"
          rx="14"
          transform="rotate(-32)"
          fill="#1DA0F2"
        />
      </g>

      {/* X with drop shadow */}
      <g transform="translate(512,512)" filter={`url(#xd-${id})`}>
        <rect
          x="-76"
          y="-320"
          width="152"
          height="640"
          rx="14"
          transform="rotate(32)"
          fill={`url(#xf-${id})`}
        />
        <rect
          x="-76"
          y="-320"
          width="152"
          height="640"
          rx="14"
          transform="rotate(-32)"
          fill={`url(#xf-${id})`}
        />
      </g>

      {/* Specular highlight */}
      <g transform="translate(512,512)">
        <rect
          x="-76"
          y="-320"
          width="152"
          height="640"
          rx="14"
          transform="rotate(32)"
          fill={`url(#xs-${id})`}
        />
        <rect
          x="-76"
          y="-320"
          width="152"
          height="640"
          rx="14"
          transform="rotate(-32)"
          fill={`url(#xs-${id})`}
        />
      </g>

      {/* Edge highlights */}
      <g transform="translate(512,512)" opacity={0.25}>
        <line
          x1="-76"
          y1="-300"
          x2="-76"
          y2="300"
          transform="rotate(32)"
          stroke="#fff"
          strokeWidth="1.5"
        />
        <line
          x1="-76"
          y1="-300"
          x2="-76"
          y2="300"
          transform="rotate(-32)"
          stroke="#fff"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}
