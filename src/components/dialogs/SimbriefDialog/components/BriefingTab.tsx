import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ChevronDown,
  Cloud,
  FileWarning,
  Info,
  MapPin,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Snowflake,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/helpers';
import type { SimBriefNotam, SimBriefOFP, SimBriefSigmet } from '@/types/simbrief';

interface BriefingTabProps {
  data: SimBriefOFP;
}

export function BriefingTab({ data }: BriefingTabProps) {
  const { t } = useTranslation();
  const { origin, destination, alternate, sigmets, atc } = data;

  // SimBrief XML-to-JSON may return a single object instead of an array
  // when there's only one item, so always coerce to array
  const originNotams = Array.isArray(origin?.notam) ? origin.notam : [];
  const destNotams = Array.isArray(destination?.notam) ? destination.notam : [];
  const altNotams = Array.isArray(alternate?.notam) ? alternate.notam : [];

  const sigmetList = Array.isArray(sigmets?.sigmet) ? sigmets.sigmet : [];

  const firRoute = Array.isArray(atc?.fir_enroute) ? atc.fir_enroute : [];

  const hasNotams = originNotams.length > 0 || destNotams.length > 0 || altNotams.length > 0;
  const hasSigmets = sigmetList.length > 0;

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-4">
        {/* SIGMETs Section */}
        {hasSigmets && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h4 className="text-sm font-semibold text-warning">
                {t('simbrief.briefing.sigmetsTitle', { count: sigmetList.length })}
              </h4>
            </div>
            <p className="mb-3 text-[11px] text-warning/70">{t('simbrief.briefing.sigmetsDesc')}</p>
            <div className="space-y-2">
              {sigmetList.map((sigmet, i) => (
                <SigmetCard key={sigmet.id || i} sigmet={sigmet} />
              ))}
            </div>
          </div>
        )}

        {!hasSigmets && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Cloud className="h-4 w-4" />
              <span className="text-sm">{t('simbrief.briefing.noSigmets')}</span>
            </div>
          </div>
        )}

        {/* FIR Route */}
        {firRoute.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <h4 className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {t('simbrief.briefing.firTitle')}
            </h4>
            <p className="mb-2 text-[11px] text-muted-foreground">
              {t('simbrief.briefing.firDesc')}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              {firRoute.map((fir, i) => (
                <div key={i} className="flex items-center">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {fir}
                  </Badge>
                  {i < firRoute.length - 1 && (
                    <Plane className="mx-1 h-3 w-3 rotate-90 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* NOTAMs Section */}
        <div>
          <h4 className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <FileWarning className="h-3.5 w-3.5" />
            {t('simbrief.briefing.notamsTitle')}
          </h4>
          <p className="mb-3 text-[11px] text-muted-foreground">
            {t('simbrief.briefing.notamsDesc')}
          </p>

          {!hasNotams ? (
            <div className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
              {t('simbrief.briefing.noNotams')}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Origin NOTAMs */}
              {originNotams.length > 0 && (
                <NotamSection
                  icao={origin.icao_code}
                  name={origin.name}
                  notams={originNotams}
                  icon={PlaneTakeoff}
                  label="Departure"
                />
              )}

              {/* Destination NOTAMs */}
              {destNotams.length > 0 && (
                <NotamSection
                  icao={destination.icao_code}
                  name={destination.name}
                  notams={destNotams}
                  icon={PlaneLanding}
                  label="Arrival"
                />
              )}

              {/* Alternate NOTAMs */}
              {altNotams.length > 0 && alternate && (
                <NotamSection
                  icao={alternate.icao_code}
                  name={alternate.name}
                  notams={altNotams}
                  icon={MapPin}
                  label="Alternate"
                />
              )}
            </div>
          )}
        </div>

        {/* Transition Altitudes Summary */}
        <Separator />
        <div className="rounded-lg border bg-card p-4">
          <h4 className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            {t('simbrief.briefing.transAltTitle')}
          </h4>
          <p className="mb-3 text-[11px] text-muted-foreground">
            {t('simbrief.briefing.transAltDesc')}
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">{origin.icao_code}</p>
              <p className="font-mono text-sm font-medium">TA: {origin.trans_alt || '—'} ft</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{destination.icao_code}</p>
              <p className="font-mono text-sm font-medium">
                TL: FL{destination.trans_level || '—'}
              </p>
            </div>
            {alternate && (
              <div>
                <p className="text-sm text-muted-foreground">{alternate.icao_code}</p>
                <p className="font-mono text-sm font-medium">
                  TL: FL{alternate.trans_level || '—'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// SIGMET Card Component
function SigmetCard({ sigmet }: { sigmet: SimBriefSigmet }) {
  const [isOpen, setIsOpen] = useState(false);

  const getHazardIcon = (hazard: string) => {
    const h = hazard.toLowerCase();
    if (h.includes('turb')) return Zap;
    if (h.includes('ice') || h.includes('icing')) return Snowflake;
    if (h.includes('ts') || h.includes('thunder')) return Cloud;
    return AlertTriangle;
  };

  const getHazardColor = (hazard: string) => {
    const h = hazard.toLowerCase();
    if (h.includes('sev')) return 'text-destructive bg-destructive/10 border-destructive/30';
    if (h.includes('mod')) return 'text-warning bg-warning/10 border-warning/30';
    return 'text-warning bg-warning/10 border-warning/30';
  };

  const HazardIcon = getHazardIcon(String(sigmet.hazard ?? ''));
  const colorClasses = getHazardColor(String(sigmet.qualifier ?? sigmet.hazard ?? ''));

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div
          className={cn(
            'flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-muted/20',
            colorClasses
          )}
        >
          <div className="flex items-center gap-2">
            <HazardIcon className="h-4 w-4" />
            <span className="text-sm font-medium uppercase">
              {sigmet.qualifier} {sigmet.hazard}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {sigmet.fir}
            </Badge>
          </div>
          <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-md bg-muted/30 p-3 text-sm">
          <p className="font-mono leading-relaxed">{sigmet.text}</p>
          <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span>
              Valid: {formatSigmetTime(sigmet.start)} - {formatSigmetTime(sigmet.end)}
            </span>
            <span>FIR: {sigmet.fir_name}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// NOTAM Section Component
function NotamSection({
  icao,
  name,
  notams,
  icon: Icon,
  label,
}: {
  icao: string;
  name: string;
  notams: SimBriefNotam[];
  icon: typeof PlaneTakeoff;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Categorize NOTAMs — SimBrief XML-to-JSON may return non-string values
  const runwayNotams = notams.filter((n) => {
    const subject = typeof n.notam_qcode_subject === 'string' ? n.notam_qcode_subject : '';
    const text = typeof n.notam_text === 'string' ? n.notam_text : '';
    const lower = subject.toLowerCase() + ' ' + text.toLowerCase();
    return lower.includes('rwy') || lower.includes('runway');
  });
  const otherNotams = notams.filter((n) => !runwayNotams.includes(n));

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-muted/20">
          <div className="flex items-center gap-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{icao}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={runwayNotams.length > 0 ? 'destructive' : 'outline'}
              className="text-[10px]"
            >
              {notams.length} NOTAM{notams.length !== 1 ? 's' : ''}
            </Badge>
            <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-muted pl-4">
          {/* Runway NOTAMs first (more important) */}
          {runwayNotams.map((notam, i) => (
            <NotamCard key={notam.notam_id || i} notam={notam} isRunway />
          ))}
          {/* Other NOTAMs */}
          {otherNotams.map((notam, i) => (
            <NotamCard key={notam.notam_id || i} notam={notam} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Individual NOTAM Card
function NotamCard({ notam, isRunway }: { notam: SimBriefNotam; isRunway?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Truncate text for preview
  const previewText = notam.notam_text?.slice(0, 100) || '';
  const hasMore = (notam.notam_text?.length || 0) > 100;

  return (
    <div
      className={cn(
        'rounded-md border p-2 text-sm',
        isRunway ? 'border-warning/30 bg-warning/5' : 'bg-card'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {isRunway && <Badge className="mb-1 bg-warning/20 text-[9px] text-warning">RUNWAY</Badge>}
          <p className="font-mono leading-relaxed text-foreground/80">
            {isExpanded ? notam.notam_text : previewText}
            {hasMore && !isExpanded && '...'}
          </p>
          {hasMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-[10px] text-primary hover:underline"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
      {notam.date_effective && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Effective: {formatNotamDate(notam.date_effective)}
          {notam.date_expire && ` - ${formatNotamDate(notam.date_expire)}`}
        </p>
      )}
    </div>
  );
}

// Helper functions
function formatSigmetTime(timestamp: string): string {
  if (!timestamp) return '—';
  try {
    const date = new Date(parseInt(timestamp, 10) * 1000);
    return date.toISOString().slice(11, 16) + 'Z';
  } catch {
    return timestamp;
  }
}

function formatNotamDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    // SimBrief format varies, try to parse
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
