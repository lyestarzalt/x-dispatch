import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './appStore';

function reset() {
  useAppStore.setState({
    selectedICAO: null,
    selectedAirportData: null,
    selectedAirportIsCustom: false,
    showSidebar: true,
    showSettings: false,
    showLaunchDialog: false,
    selectedProcedure: null,
    startPosition: null,
    pendingAirportSelectionIcao: null,
  });
}

beforeEach(reset);

describe('appStore — airport selection request channel', () => {
  it('requestSelectAirport sets pendingAirportSelectionIcao', () => {
    useAppStore.getState().requestSelectAirport('LOWS');
    expect(useAppStore.getState().pendingAirportSelectionIcao).toBe('LOWS');
  });

  it('uppercases the ICAO before storing', () => {
    useAppStore.getState().requestSelectAirport('lows');
    expect(useAppStore.getState().pendingAirportSelectionIcao).toBe('LOWS');
  });

  it('clearPendingAirportSelection clears the field', () => {
    useAppStore.getState().requestSelectAirport('LOWS');
    expect(useAppStore.getState().pendingAirportSelectionIcao).toBe('LOWS');
    useAppStore.getState().clearPendingAirportSelection();
    expect(useAppStore.getState().pendingAirportSelectionIcao).toBeNull();
  });

  it('latest request wins — second call replaces the first', () => {
    useAppStore.getState().requestSelectAirport('LOWS');
    useAppStore.getState().requestSelectAirport('EHEH');
    expect(useAppStore.getState().pendingAirportSelectionIcao).toBe('EHEH');
  });

  it('subscribers receive change notifications (subscribeWithSelector)', () => {
    const seen: (string | null)[] = [];
    const unsubscribe = useAppStore.subscribe(
      (state) => state.pendingAirportSelectionIcao,
      (value) => {
        seen.push(value);
      }
    );
    useAppStore.getState().requestSelectAirport('LOWS');
    useAppStore.getState().clearPendingAirportSelection();
    unsubscribe();
    expect(seen).toEqual(['LOWS', null]);
  });

  it('does not affect unrelated state fields', () => {
    const before = useAppStore.getState();
    useAppStore.getState().requestSelectAirport('LOWS');
    const after = useAppStore.getState();
    expect(after.selectedICAO).toBe(before.selectedICAO);
    expect(after.selectedAirportData).toBe(before.selectedAirportData);
    expect(after.startPosition).toBe(before.startPosition);
    expect(after.selectedProcedure).toBe(before.selectedProcedure);
    expect(after.showSidebar).toBe(before.showSidebar);
  });
});
