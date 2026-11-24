import { beforeEach, describe, expect, it } from 'vitest';
import { useChartOverlayStore } from './chartOverlayStore';

const ils = {
  url: 'https://aeronav.faa.gov/d-tpp/2612/00582IL16C.PDF',
  name: 'ILS OR LOC RWY 16C',
  icao: 'KSEA',
};
const rnav = {
  url: 'https://aeronav.faa.gov/d-tpp/2612/00582RY16C.PDF',
  name: 'RNAV (GPS) Y RWY 16C',
  icao: 'KSEA',
};

beforeEach(() => useChartOverlayStore.getState().hide());

describe('chartOverlayStore', () => {
  it('shows one chart at a time, and the same chart again hides it', () => {
    const { toggle } = useChartOverlayStore.getState();
    toggle(ils);
    expect(useChartOverlayStore.getState()).toMatchObject({ chart: ils, status: 'loading' });
    toggle(rnav);
    expect(useChartOverlayStore.getState().chart).toEqual(rnav);
    toggle(rnav);
    expect(useChartOverlayStore.getState()).toMatchObject({ chart: null, status: 'idle' });
  });

  it('drops the result of a chart the pilot has already replaced', () => {
    const { toggle, setShown, setError } = useChartOverlayStore.getState();
    toggle(ils);
    toggle(rnav);
    setShown(ils.url);
    setError(ils.url, 'network');
    expect(useChartOverlayStore.getState()).toMatchObject({ status: 'loading', error: null });
    setShown(rnav.url);
    expect(useChartOverlayStore.getState().status).toBe('shown');
  });

  it('goes back to loading for another try at a chart that failed', () => {
    const { toggle, setError, retry } = useChartOverlayStore.getState();
    toggle(ils);
    setError(ils.url, 'network');
    retry();
    expect(useChartOverlayStore.getState()).toMatchObject({
      chart: ils,
      status: 'loading',
      error: null,
    });
  });

  it('keeps the opacity readable', () => {
    const { setOpacity } = useChartOverlayStore.getState();
    setOpacity(0);
    expect(useChartOverlayStore.getState().opacity).toBe(0.1);
    setOpacity(3);
    expect(useChartOverlayStore.getState().opacity).toBe(1);
  });
});
