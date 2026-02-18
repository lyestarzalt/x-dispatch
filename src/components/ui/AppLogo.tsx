import { cn } from '@/lib/utils/helpers';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite handles this import
import appIcon from '../../../assets/icon.png';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-16 w-16',
  lg: 'h-20 w-20',
};

export function AppLogo({ size = 'md', className }: AppLogoProps) {
  return <img src={appIcon} alt="X-Dispatch" className={cn(sizeClasses[size], className)} />;
}
