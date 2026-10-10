import {
  AlertTriangle,
  Cloud,
  CloudRain,
  CloudSnow,
  Eye,
  Haze,
  type LucideIcon,
  Snowflake,
  Sun,
  Wind,
  Zap,
} from 'lucide-react';
import type { WeatherCategory } from '@/lib/weatherScan/parseMetarFeed';

export const WEATHER_CATEGORY_ICON: Record<WeatherCategory, LucideIcon> = {
  snow: CloudSnow,
  freezing: Snowflake,
  fog: Eye,
  lowVisibility: Eye,
  lowCeiling: Cloud,
  heavyPrecipitation: CloudRain,
  thunderstorm: Zap,
  severe: AlertTriangle,
  dustSand: Haze,
  strongWind: Wind,
  clear: Sun,
};
