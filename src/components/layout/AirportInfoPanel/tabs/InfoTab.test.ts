import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const selectedAirportData = {
  metadata: { iata_code: 'LHR' },
  runways: [],
  frequencies: [],
} as const;

const mapState = {
  vatsimEnabled: false,
  ivaoEnabled: false,
};

const vatsimQueryState = {
  data: undefined,
};

const vatsimTrafficState = {
  departures: 0,
  arrivals: 0,
};

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
}));

vi.mock('@/queries/useGatewayQuery', () => ({
  useGatewayUpdateCheck: () => ({ data: undefined }),
}));

vi.mock('@/queries/useIvaoQuery', () => ({
  useIvaoQuery: () => ({ data: undefined }),
  getTrafficCountsForAirport: () => ({ departures: 0, arrivals: 0 }),
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

vi.mock('@/queries/useVatsimQuery', () => ({
  useVatsimQuery: () => vatsimQueryState,
  getATISForAirport: () => [],
  getControllersForAirport: () => [],
  getTrafficCountsForAirport: () => vatsimTrafficState,
  parseATISRunways: () => [],
}));

describe('InfoTab', () => {
  it('does not render the duplicated conditions section', async () => {
    const { default: InfoTab } = await import('./InfoTab');

    const html = renderToStaticMarkup(createElement(InfoTab));

    expect(html).not.toContain('Conditions');
    expect(html).toContain('Raw METAR');
  });

  it('does not claim there is no VATSIM activity when only pilot traffic exists', async () => {
    mapState.vatsimEnabled = true;
    vatsimTrafficState.departures = 2;
    vatsimTrafficState.arrivals = 1;

    const { default: InfoTab } = await import('./InfoTab');

    const html = renderToStaticMarkup(createElement(InfoTab));

    expect(html).not.toContain('No VATSIM activity');
    expect(html).toContain('2');
    expect(html).toContain('1');

    mapState.vatsimEnabled = false;
    vatsimTrafficState.departures = 0;
    vatsimTrafficState.arrivals = 0;
  });
});
