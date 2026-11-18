// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { initReactI18next } from 'react-i18next';
import i18next from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/stores/appStore';
import { RouteEnd } from './RouteEnd';

vi.mock('@/components/AirportLocalClock', () => ({ AirportLocalClock: () => null }));

void i18next.use(initReactI18next).init({ lng: 'en', resources: {} });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useAppStore.setState({ pendingAirportSelectionIcao: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('RouteEnd', () => {
  it('opens the airport on the map when its code is clicked', () => {
    const endpoint = { icao: 'KMVY', name: 'Marthas Vineyard', latitude: 41.39, longitude: -70.61 };
    act(() => root.render(<RouteEnd endpoint={endpoint} fallback="Arrival" />));

    const code = container.querySelector('button');
    expect(code?.textContent).toBe('KMVY');
    act(() => code!.click());

    expect(useAppStore.getState().pendingAirportSelectionIcao).toBe('KMVY');
  });

  it('leaves an empty slot as plain text', () => {
    act(() => root.render(<RouteEnd endpoint={null} fallback="Arrival" />));
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('----');
  });
});
