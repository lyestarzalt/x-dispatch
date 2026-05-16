import { describe, expect, it } from 'vitest';
import type { LoadingProgress } from '@/types/xplane';
import {
  calculateLoadingProgress,
  clampDisplayedProgress,
  getLoadingDetailLabel,
  getLoadingMessage,
} from './progress';

describe('LoadingScreen progress helpers', () => {
  it('keeps completed step weight when the next step starts without detail progress', () => {
    const progress = calculateLoadingProgress([
      { id: 'airports', status: 'complete' },
      { id: 'navaids', status: 'loading' },
      { id: 'waypoints', status: 'pending' },
      { id: 'airspaces', status: 'pending' },
      { id: 'airways', status: 'pending' },
    ]);

    expect(progress).toBe(60.8);
  });

  it('never lets the displayed progress move backwards', () => {
    expect(clampDisplayedProgress(60, 12)).toBe(60);
    expect(clampDisplayedProgress(60, 64)).toBe(64);
  });

  it('reserves 100% for the final app-complete event', () => {
    expect(
      calculateLoadingProgress([
        { id: 'airports', status: 'complete' },
        { id: 'navaids', status: 'complete' },
        { id: 'waypoints', status: 'complete' },
        { id: 'airspaces', status: 'complete' },
        { id: 'airways', status: 'complete' },
      ])
    ).toBe(100);

    expect(clampDisplayedProgress(98, 100)).toBe(99);
    expect(clampDisplayedProgress(99, 100, true)).toBe(100);
  });

  it('does not give a still-loading step its full weight', () => {
    const progress = calculateLoadingProgress([
      { id: 'airports', status: 'loading', detail: { current: 1000, total: 1000 } },
      { id: 'navaids', status: 'complete' },
      { id: 'waypoints', status: 'complete' },
      { id: 'airspaces', status: 'complete' },
      { id: 'airways', status: 'complete' },
    ]);

    expect(progress).toBeLessThan(100);
  });

  it('uses i18n keys and parameters for progress messages', () => {
    const calls: Array<{ key: string; params?: Record<string, unknown> }> = [];
    const t = (key: string, params?: Record<string, unknown>) => {
      calls.push({ key, params });
      return `${key}:${params?.name ?? ''}`;
    };

    const progress: LoadingProgress = {
      step: 'airports',
      status: 'loading',
      messageKey: 'loading.messages.customScenery',
      messageParams: { name: 'Custom Pack' },
    };

    expect(getLoadingMessage(progress, t)).toBe('loading.messages.customScenery:Custom Pack');
    expect(calls).toEqual([
      { key: 'loading.messages.customScenery', params: { name: 'Custom Pack' } },
    ]);
  });

  it('translates detail labels when a detail key is available', () => {
    const t = (key: string, params?: Record<string, unknown>) =>
      `${key}:${params?.current ?? ''}/${params?.total ?? ''}`;

    expect(
      getLoadingDetailLabel(
        {
          current: 2,
          total: 5,
          labelKey: 'loading.details.customPack',
          labelParams: { current: 2, total: 5 },
        },
        t
      )
    ).toBe('loading.details.customPack:2/5');

    expect(getLoadingDetailLabel({ current: 1, label: 'Custom Pack' }, t)).toBe('Custom Pack');
  });
});
