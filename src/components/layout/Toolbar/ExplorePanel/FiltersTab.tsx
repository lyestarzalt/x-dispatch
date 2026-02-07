import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FiltersTabProps } from './types';

export function FiltersTab({
  country,
  region,
  type,
  hasIata,
  onCountryChange,
  onRegionChange,
  onTypeChange,
  onHasIataChange,
}: FiltersTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('explore.filters.country')}</Label>
          <Select
            value={country || 'all'}
            onValueChange={(v) => onCountryChange(v === 'all' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('explore.filters.allCountries')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('explore.filters.allCountries')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('explore.filters.region')}</Label>
          <Select
            value={region || 'all'}
            onValueChange={(v) => onRegionChange(v === 'all' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('explore.filters.allRegions')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('explore.filters.allRegions')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('explore.filters.type')}</Label>
          <Select value={type} onValueChange={onTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('explore.filters.allTypes')}</SelectItem>
              <SelectItem value="land">{t('explore.filters.land')}</SelectItem>
              <SelectItem value="seaplane">{t('explore.filters.seaplane')}</SelectItem>
              <SelectItem value="heliport">{t('explore.filters.heliport')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2 pt-6">
          <input
            type="checkbox"
            id="hasIata"
            checked={hasIata}
            onChange={(e) => onHasIataChange(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="hasIata">{t('explore.filters.hasIata')}</Label>
        </div>
      </div>
    </div>
  );
}
