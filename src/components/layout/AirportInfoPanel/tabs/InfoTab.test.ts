import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Runway, RunwayEnd } from '@/types/apt';
import type { Navaid } from '@/types/navigation';

const selectedAirportData: {
  metadata: { iata_code: string };
  runways: Runway[];
  frequencies: never[];
} = {
  metadata: { iata_code: 'LHR' },
  runways: [],
  frequencies: [],
};

/** What the nav-data query hands the tab: nothing until a test fills it. */
const navState = { data: undefined as { ils: Navaid[]; gs: Navaid[] } | undefined };

function runway(name0: string, name1: string): Runway {
  const end = (name: string, latitude: number): RunwayEnd => ({
    name,
    latitude,
    longitude: -0.45,
    dthr_length: 0,
    overrun_length: 0,
    marking: 0,
    lighting: 0,
    tdz_lighting: false,
    reil: 0,
  });
  return {
    width: 45,
    surface_type: 1,
    shoulder_surface_type: 0,
    shoulder_width: 0,
    smoothness: 0,
    centerline_lights: false,
    edge_lights: false,
    auto_distance_remaining_signs: false,
    ends: [end(name0, 51.47), end(name1, 51.48)],
  } as Runway;
}

/** A localizer record as earth_nav.dat carries it: the airport it serves and its runway end. */
function ils(id: string, airport: string, runwayEnd: string): Navaid {
  return {
    id,
    name: `${airport} ${runwayEnd}`,
    type: 'ILS',
    latitude: 51.47,
    longitude: -0.45,
    elevation: 80,
    frequency: 11010,
    range: 18,
    associatedAirport: airport,
    associatedRunway: runwayEnd,
  } as Navaid;
}

const mapState = {
  atcStaffing: {} as Record<string, unknown>,
};

/** What the network hook hands the tab: switched off until a test turns it on. */
const networkState = {
  network: null as 'vatsim' | null,
  pilots: [] as { flightPlan: { departure: string; arrival: string } }[],
  stations: [],
};

function pilot(departure: string, arrival: string) {
  return { flightPlan: { departure, arrival } };
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      switch (key) {
        case 'settings.tabs.vatsim':
          return 'VATSIM';
        case 'common.online':
          return 'online';
        case 'sidebar.vatsim.noActivity':
          return 'No VATSIM activity';
        default:
          return key;
      }
    },
  }),
}));

vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      selectedAirportData,
      selectedICAO: 'EGLL',
      selectedAirportIsCustom: false,
    }),
}));

vi.mock('@/stores/mapStore', () => ({
  useMapStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mapState),
}));

vi.mock('@/queries', () => ({
  useNavDataQuery: () => navState,
  useAirportATC: () => ({ data: undefined }),
}));

vi.mock('@/queries/useGatewayQuery', () => ({
  useGatewayUpdateCheck: () => ({ data: undefined }),
}));

vi.mock('@/queries/useNetworkTraffic', () => ({
  useNetworkTraffic: () => networkState,
}));

vi.mock('@/queries/useVatsimMetarQuery', () => ({
  useVatsimMetarQuery: () => ({
    data: {
      parsed: {
        wind: undefined,
        visibility: undefined,
        cavok: false,
        clouds: [],
        verticalVisibility: undefined,
        altimeter: undefined,
        temperature: null,
        dewPoint: null,
        weatherConditions: [],
      },
      raw: 'METAR EGLL 041050Z AUTO 18005KT 9999 SKC 18/09 Q1016',
    },
  }),
}));

describe('InfoTab', () => {
  it('does not claim there is no VATSIM activity when only pilot traffic exists', async () => {
    networkState.network = 'vatsim';
    networkState.pilots = [pilot('EGLL', 'LFPG'), pilot('EGLL', 'EHAM'), pilot('KJFK', 'EGLL')];

    const { default: InfoTab } = await import('./InfoTab');

    const html = renderToStaticMarkup(createElement(InfoTab));

    expect(html).not.toContain('No VATSIM activity');
    expect(html).toContain('2');
    expect(html).toContain('1');

    networkState.network = null;
    networkState.pilots = [];
  });

  it('marks a runway ILS only when the localizer belongs to this airport', async () => {
    // Cape Cod style: no ILS of its own, but neighbours have an ILS on the same runway number.
    selectedAirportData.runways = [runway('06', '24')];
    navState.data = { ils: [ils('IFMH', 'KFMH', '06'), ils('IOWD', 'KOWD', '24')], gs: [] };

    const { default: InfoTab } = await import('./InfoTab');

    expect(renderToStaticMarkup(createElement(InfoTab))).not.toMatch(/ILS<\//);

    navState.data = { ils: [ils('IFMH', 'KFMH', '06'), ils('ILL', 'EGLL', '24')], gs: [] };

    expect(renderToStaticMarkup(createElement(InfoTab))).toMatch(/ILS<\//);

    selectedAirportData.runways = [];
    navState.data = undefined;
  });
});
