import { describe, expect, it } from 'vitest';
import { mapPanelLayout } from './mapPanelLayout';

describe('mapPanelLayout', () => {
  it('folds one panel at minimum window width with 130% zoom and Large text', () => {
    expect(mapPanelLayout(1024 / 1.3 / 18, true)).toEqual({
      singlePanel: true,
      inlineExplore: true,
    });
  });

  it('can show both panels before there is room to open Explore beside them', () => {
    expect(mapPanelLayout(1200 / 16, true)).toEqual({
      singlePanel: false,
      inlineExplore: true,
    });
    expect(mapPanelLayout(1200 / 16, false).inlineExplore).toBe(false);
  });

  it('puts Explore beside the planner when there is still room for the inspector and map', () => {
    expect(mapPanelLayout(1440 / 16, true)).toEqual({
      singlePanel: false,
      inlineExplore: false,
    });
  });
});
