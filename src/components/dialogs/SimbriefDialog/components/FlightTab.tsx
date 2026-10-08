import { useTranslation } from 'react-i18next';
import { Fuel, PlaneLanding, Scale, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatFuel, formatWeight } from '@/queries/useSimbriefQuery';
import type { SimBriefOFP } from '@/types/simbrief';
import { VerticalProfile } from './';

// Flight Tab (with vertical profile)
export function FlightTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {/* Vertical Profile */}
      <div className="bg-card rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {t('simbriefDialog.flight.verticalProfile')}
          </h4>
          <div className="flex items-center gap-2">
            {data.general.sid_ident && (
              <Badge variant="secondary" className="text-2xs">
                {t('simbriefDialog.flight.sid', { id: data.general.sid_ident })}
              </Badge>
            )}
            {data.general.star_ident && (
              <Badge variant="secondary" className="text-2xs">
                {t('simbriefDialog.flight.star', { id: data.general.star_ident })}
              </Badge>
            )}
          </div>
        </div>
        <VerticalProfile fixes={data.navlog.fix} className="h-48" />
      </div>

      {/* Route String */}
      <div className="bg-card rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {t('simbriefDialog.flight.route')}
          </h4>
          <Badge variant="outline" className="text-2xs">
            {t('simbriefDialog.flight.fixesCount', { count: data.navlog.fix.length })}
          </Badge>
        </div>
        <p className="text-foreground/80 font-mono text-sm leading-relaxed">{data.general.route}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Fuel Summary */}
        <div className="bg-card rounded-lg border p-4">
          <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
            <Fuel className="h-3.5 w-3.5" />
            {t('simbriefDialog.flight.fuelSummary')}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.blockFuel')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatFuel(data.fuel.plan_ramp, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.tripFuel')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatFuel(data.fuel.enroute_burn, apiUnit)}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.landingFuel')}
              </span>
              <span className="text-success font-mono text-sm font-medium">
                {formatFuel(data.fuel.plan_landing, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Weights Summary */}
        <div className="bg-card rounded-lg border p-4">
          <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
            <Scale className="h-3.5 w-3.5" />
            {t('simbriefDialog.flight.weightsSummary')}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.weights.zfw')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.est_zfw, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.weights.tow')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.est_tow, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.weights.ldw')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.est_ldw, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Payload */}
        <div className="bg-card rounded-lg border p-4">
          <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
            <Users className="h-3.5 w-3.5" />
            {t('simbriefDialog.flight.payload')}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.passengers')}
              </span>
              <span className="font-mono text-sm font-medium">{data.weights.pax_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.cargo')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.cargo, apiUnit)}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">
                {t('simbriefDialog.flight.totalPayload')}
              </span>
              <span className="font-mono text-sm font-medium">
                {formatWeight(data.weights.payload, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Alternate */}
        {data.alternate && (
          <div className="bg-card rounded-lg border p-4">
            <h4 className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
              <PlaneLanding className="h-3.5 w-3.5" />
              {t('simbriefDialog.flight.alternate')}
            </h4>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-bold">{data.alternate.icao_code}</span>
              <div>
                <p className="text-sm">{data.alternate.name}</p>
                <p className="text-muted-foreground text-sm">
                  {t('simbriefDialog.header.runway', { rwy: data.alternate.plan_rwy })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
