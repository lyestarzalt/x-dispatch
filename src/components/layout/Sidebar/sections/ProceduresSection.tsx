import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface ProcedureWaypoint {
  fixId: string;
  fixRegion: string;
  fixType: string;
  pathTerminator: string;
  course: number | null;
  distance: number | null;
  altitude: { descriptor: string; altitude1: number | null; altitude2: number | null } | null;
  speed: number | null;
  turnDirection: 'L' | 'R' | null;
}

export interface Procedure {
  type: 'SID' | 'STAR' | 'APPROACH';
  name: string;
  runway: string | null;
  transition: string | null;
  waypoints: ProcedureWaypoint[];
}

interface AirportProcedures {
  icao: string;
  sids: Procedure[];
  stars: Procedure[];
  approaches: Procedure[];
}

interface ProceduresSectionProps {
  icao: string;
  onSelectProcedure: (procedure: Procedure) => void;
  selectedProcedure: Procedure | null;
}

type TabType = 'SID' | 'STAR' | 'APP';

export default function ProceduresSection({
  icao,
  onSelectProcedure,
  selectedProcedure,
}: ProceduresSectionProps) {
  const { t } = useTranslation();
  const [procedures, setProcedures] = useState<AirportProcedures | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('SID');

  // Load procedures when airport changes
  useEffect(() => {
    if (!icao) {
      setProcedures(null);
      return;
    }

    const loadProcedures = async () => {
      setLoading(true);
      try {
        const data = await window.navAPI.getAirportProcedures(icao);
        setProcedures(data);
      } catch (err) {
        window.appAPI.log.error(`Failed to load procedures for ${icao}`, err);
        setProcedures(null);
      } finally {
        setLoading(false);
      }
    };

    loadProcedures();
  }, [icao]);

  const counts = {
    SID: procedures?.sids.length || 0,
    STAR: procedures?.stars.length || 0,
    APP: procedures?.approaches.length || 0,
  };

  if (loading) {
    return (
      <div className="py-4 text-center">
        <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!procedures || (counts.SID === 0 && counts.STAR === 0 && counts.APP === 0)) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">{t('procedures.noData')}</div>
    );
  }

  const tabLabels: Record<TabType, string> = {
    SID: t('procedures.tabs.sid'),
    STAR: t('procedures.tabs.star'),
    APP: t('procedures.tabs.app'),
  };

  const getProcedures = (tab: TabType): Procedure[] => {
    switch (tab) {
      case 'SID':
        return procedures.sids;
      case 'STAR':
        return procedures.stars;
      case 'APP':
        return procedures.approaches;
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="w-full">
      <TabsList className="grid h-8 grid-cols-3 bg-muted/50">
        {(['SID', 'STAR', 'APP'] as TabType[]).map((tab) => (
          <TabsTrigger
            key={tab}
            value={tab}
            className="font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {tabLabels[tab]}
            <Badge variant="secondary" className="ml-1.5 h-4 px-1 py-0 text-xs">
              {counts[tab]}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Procedure List */}
      {(['SID', 'STAR', 'APP'] as TabType[]).map((tab) => {
        const procs = getProcedures(tab);
        return (
          <TabsContent key={tab} value={tab} className="mt-2">
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {procs.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {t('procedures.noTypeData', { type: tabLabels[tab] })}
                </div>
              ) : (
                <>
                  {procs.slice(0, 20).map((proc, idx) => {
                    const isSelected =
                      selectedProcedure?.name === proc.name &&
                      selectedProcedure?.runway === proc.runway;
                    return (
                      <Button
                        key={`${proc.name}-${proc.runway}-${idx}`}
                        variant="ghost"
                        onClick={() => onSelectProcedure(proc)}
                        className={cn(
                          'h-auto w-full justify-between px-2 py-1.5 font-mono text-xs',
                          isSelected
                            ? 'bg-primary/20 text-primary hover:bg-primary/30'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <span className={cn(isSelected && 'text-foreground')}>{proc.name}</span>
                        <span className="text-xs text-muted-foreground/60">
                          {proc.runway || t('procedures.allRunways')}
                        </span>
                      </Button>
                    );
                  })}
                  {procs.length > 20 && (
                    <div className="py-1 text-center text-xs text-muted-foreground/50">
                      +{procs.length - 20} more
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
