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

describe('appStore — app action requests', () => {
  it('requestStartRunway upper-cases both fields and clears on demand', () => {
    useAppStore.getState().requestStartRunway('daag', '23l');
    expect(useAppStore.getState().pendingStartRunway).toEqual({ icao: 'DAAG', runway: '23L' });
    useAppStore.getState().clearPendingStartRunway();
    expect(useAppStore.getState().pendingStartRunway).toBeNull();
  });

  it('openAddonManager opens on the requested tab and the tab clears separately', () => {
    useAppStore.getState().openAddonManager('installer');
    expect(useAppStore.getState().showAddonManager).toBe(true);
    expect(useAppStore.getState().pendingAddonTab).toBe('installer');
    useAppStore.getState().clearPendingAddonTab();
    expect(useAppStore.getState().pendingAddonTab).toBeNull();
    useAppStore.getState().closeAddonManager();
    expect(useAppStore.getState().showAddonManager).toBe(false);
  });

  it('resolveConfirmation answers the pending question and clears it', () => {
    const answers: boolean[] = [];
    useAppStore.getState().requestConfirmation({
      kind: 'import-url',
      url: 'https://example.com/a.fms',
      host: 'example.com',
      path: '/a.fms',
      resolve: (ok) => answers.push(ok),
    });
    useAppStore.getState().resolveConfirmation(true);
    expect(answers).toEqual([true]);
    expect(useAppStore.getState().pendingConfirmation).toBeNull();
  });

  it('a second request answers the first with no', () => {
    const answers: string[] = [];
    const ask = (name: string) =>
      useAppStore.getState().requestConfirmation({
        kind: 'import-url',
        url: `https://example.com/${name}`,
        host: 'example.com',
        path: `/${name}`,
        resolve: (ok) => answers.push(`${name}:${ok}`),
      });
    ask('first');
    ask('second');
    expect(answers).toEqual(['first:false']);
    expect(useAppStore.getState().pendingConfirmation?.path).toBe('/second');
    useAppStore.getState().resolveConfirmation(false);
    expect(answers).toEqual(['first:false', 'second:false']);
  });
});
