import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const selectedAirportData = {
  metadata: { iata_code: 'LHR' },
  runways: [],
  frequencies: [],
} as const;

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
  useNavDataQuery: () => ({ data: undefined }),
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
});
