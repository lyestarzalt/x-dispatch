import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
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

function runway(name0: string, name1: string, dthr: [number, number] = [0, 0]): Runway {
  const end = (name: string, latitude: number, dthr_length: number): RunwayEnd => ({
    name,
    latitude,
    longitude: -0.45,
    dthr_length,
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
    ends: [end(name0, 51.47, dthr[0]), end(name1, 51.48, dthr[1])],
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

// The error toast logs through the renderer logger, which needs a real renderer.
vi.mock('@/lib/utils/loggerRenderer', () => ({
  default: { renderer: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { letter?: string }) => {
      switch (key) {
        case 'airportInfo.atisLabel':
          return `ATIS ${options?.letter}`;
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
  useGatewayInstall: () => ({ mutateAsync: async () => undefined, isPending: false }),
  useGatewayRemove: () => ({ mutateAsync: async () => undefined, isPending: false }),
  GatewayActionError: class extends Error {},
}));

vi.mock('@/queries/useAddonManager', () => ({
  useSceneryList: () => ({ data: undefined }),
}));

vi.mock('@/queries/useNetworkTraffic', () => ({
  useNetworkTraffic: () => networkState,
}));

/** The METAR wind a test blows: calm until one sets it. */
const metarState = { wind: undefined as { degrees: number; speed: number } | undefined };

vi.mock('@/queries/useVatsimMetarQuery', () => ({
  useVatsimMetarQuery: () => ({
    data: {
      parsed: {
        wind: metarState.wind,
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

    networkState.network = null;
    networkState.pilots = [];
  });

  // The switches sit in the bar above the scroll area, so scrolling the card keeps them.
  it('leaves the network switches out of the scrolling tab', async () => {
    const { default: InfoTab } = await import('./InfoTab');
    const html = renderToStaticMarkup(createElement(InfoTab));
    expect(html).not.toContain('toolbar.vatsim');
  });

  it('shows the network switches and the airport traffic in the bar', async () => {
    networkState.network = 'vatsim';
    networkState.pilots = [pilot('EGLL', 'LFPG'), pilot('EGLL', 'EHAM'), pilot('KJFK', 'EGLL')];

    const { NetworkBar } = await import('./info/NetworkBar');
    const html = renderToStaticMarkup(createElement(NetworkBar, { icao: 'EGLL' }));

    expect(html).toContain('toolbar.vatsim');
    expect(html).toContain('aria-label="2 airportInfo.conditions.departures"');
    expect(html).toContain('aria-label="1 airportInfo.conditions.arrivals"');

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

  it('matches a single-digit apt.dat runway end to its two-digit ILS record', async () => {
    // KACK: apt.dat names the end "6", earth_nav.dat names the localizer end "06".
    selectedAirportData.runways = [runway('6', '24')];
    navState.data = { ils: [ils('IRNE', 'EGLL', '06')], gs: [] };

    const { default: InfoTab } = await import('./InfoTab');

    expect(renderToStaticMarkup(createElement(InfoTab))).toMatch(/ILS<\//);

    selectedAirportData.runways = [];
    navState.data = undefined;
  });

  it('colours only the active end of a runway pair, and the active runway sentence', async () => {
    selectedAirportData.runways = [runway('06', '24')];
    metarState.wind = { degrees: 70, speed: 12 };

    const { default: InfoTab } = await import('./InfoTab');
    const html = renderToStaticMarkup(createElement(InfoTab));

    // One card per end: "06" in the active colour, "24" in the plain one.
    expect(html).toMatch(/<span class="[^"]*text-cat-emerald[^"]*">06<\/span>/);
    expect(html).not.toMatch(/<span class="[^"]*text-cat-emerald[^"]*">24<\/span>/);
    expect(html).toMatch(/<span class="[^"]*text-foreground[^"]*">24<\/span>/);
    // The sentence above the list names the runway in the same colour.
    expect(html).toMatch(
      /airportInfo\.activeRunway<\/span><span class="[^"]*text-cat-emerald[^"]*">06</
    );

    selectedAirportData.runways = [];
    metarState.wind = undefined;
  });

  // IVAO has no ATIS positions: the tower carries the broadcast, and its row says so.
  it('shows the ATIS letter on the frequency row of the position that broadcasts it', async () => {
    mapState.atcStaffing = {
      EGLL: {
        icao: 'EGLL',
        network: 'ivao',
        roles: ['TWR'],
        top: 'TWR',
        atisCode: 'E',
        stations: [
          {
            network: 'ivao',
            callsign: 'EGLL_TWR',
            name: '',
            frequency: '118.500',
            role: 'TWR',
            atis: { code: 'E', lines: ['HEATHROW INFORMATION E'] },
          },
        ],
      },
    };

    const { default: InfoTab } = await import('./InfoTab');
    const html = renderToStaticMarkup(createElement(TooltipProvider, null, createElement(InfoTab)));

    const row = html.slice(html.indexOf('EGLL_TWR') - 1500, html.indexOf('EGLL_TWR'));
    expect(row).toContain('>TWR<');
    expect(row).toContain('ATIS E');

    mapState.atcStaffing = {};
  });

  // Only the active runway shows until the list is expanded (GitHub #381).
  it('lists only the active runways when some are active', async () => {
    selectedAirportData.runways = [runway('06', '24'), runway('09', '27'), runway('18', '36')];
    metarState.wind = { degrees: 70, speed: 12 };

    const { default: InfoTab } = await import('./InfoTab');
    const html = renderToStaticMarkup(createElement(TooltipProvider, null, createElement(InfoTab)));

    expect(html).toContain('airportInfo.activeRunwaysHeading');
    expect(html).toMatch(/>06</);
    // The active end alone, as in the mockup: not the other end of its runway.
    expect(html).not.toMatch(/>24</);
    expect(html).not.toMatch(/>27</);
    expect(html).not.toMatch(/>36</);

    selectedAirportData.runways = [];
    metarState.wind = undefined;
  });

  it('lists every runway when none is active', async () => {
    selectedAirportData.runways = [runway('09', '27'), runway('18', '36')];

    const { default: InfoTab } = await import('./InfoTab');
    const html = renderToStaticMarkup(createElement(TooltipProvider, null, createElement(InfoTab)));

    expect(html).toContain('airportInfo.runwaysHeading');
    expect(html).not.toContain('airportInfo.activeRunwaysHeading');
    expect(html).toMatch(/>27</);
    expect(html).toMatch(/>36</);

    selectedAirportData.runways = [];
  });

  it('shows a landing distance only on the end whose threshold is displaced', async () => {
    selectedAirportData.runways = [runway('09', '27', [305, 0])];

    const { default: InfoTab } = await import('./InfoTab');
    // The landing-distance line carries a tooltip, which needs the provider the app mounts.
    const html = renderToStaticMarkup(createElement(TooltipProvider, null, createElement(InfoTab)));

    expect(html.match(/airportInfo\.displacedThreshold\.lda/g)).toHaveLength(1);
    expect(html.indexOf('airportInfo.displacedThreshold.lda')).toBeLessThan(html.indexOf('>27<'));

    selectedAirportData.runways = [];
  });
});
