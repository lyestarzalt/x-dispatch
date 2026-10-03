import { describe, expect, it } from 'vitest';
import { getPageZoom, setPageZoom } from './pageZoom';

function fakeRoot(): HTMLElement {
  return { style: {} } as unknown as HTMLElement;
}

describe('pageZoom', () => {
  it('applies the zoom factor as CSS zoom on the root element', () => {
    const root = fakeRoot();
    setPageZoom(1.2, root);
    expect(root.style.zoom).toBe('1.2');
  });

  it('reads the applied zoom factor back', () => {
    const root = fakeRoot();
    setPageZoom(0.8, root);
    expect(getPageZoom(root)).toBe(0.8);
  });

  it('reports 1 when no zoom has been applied', () => {
    expect(getPageZoom(fakeRoot())).toBe(1);
  });

  it('reports 1 when the root carries an unparsable zoom', () => {
    const root = fakeRoot();
    root.style.zoom = 'normal';
    expect(getPageZoom(root)).toBe(1);
  });
});
