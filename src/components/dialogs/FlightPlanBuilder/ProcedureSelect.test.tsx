// @vitest-environment jsdom
/**
 * A procedure select at a large airport has about a hundred entries. The
 * planner stays mounted while it is open, so every planner render would
 * re-render all of them unless the closed select keeps its options unmounted.
 */
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { initReactI18next } from 'react-i18next';
import i18next from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedProcedure } from '@/types/navigation';
import { countMountedComponents } from '../../../../tests/helpers/reactFibers';
import { ProcedureSelect } from './ProcedureSelect';

const procedures: ResolvedProcedure[] = Array.from({ length: 100 }, (_, i) => ({
  name: `SID${String(i).padStart(3, '0')}`,
  type: 'SID',
  runway: 'RW04L',
  transition: i % 2 === 0 ? `TR${i}` : undefined,
  waypoints: [],
})) as unknown as ResolvedProcedure[];

void i18next.use(initReactI18next).init({ lng: 'en', resources: {} });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ProcedureSelect', () => {
  it('mounts no option items while closed', () => {
    act(() => {
      root.render(
        <ProcedureSelect
          procedures={procedures}
          runway="04L"
          value={undefined}
          placeholder="Choose"
          onChange={() => {}}
        />
      );
    });
    expect(countMountedComponents(container, 'SelectItem')).toBe(0);
  });

  it('shows the chosen procedure and transition on the trigger while closed', () => {
    act(() => {
      root.render(
        <ProcedureSelect
          procedures={procedures}
          runway="04L"
          value={{ name: 'SID004', transition: 'TR4' }}
          placeholder="Choose"
          onChange={() => {}}
        />
      );
    });
    const trigger = container.querySelector('button[role="combobox"]');
    expect(trigger?.textContent).toContain('SID004');
    expect(trigger?.textContent).toContain('TR4');
  });

  it('shows the no-procedure label while nothing is chosen', () => {
    act(() => {
      root.render(
        <ProcedureSelect
          procedures={procedures}
          runway="04L"
          value={undefined}
          placeholder="Choose"
          onChange={() => {}}
        />
      );
    });
    const trigger = container.querySelector('button[role="combobox"]');
    expect(trigger?.textContent).toContain('planBuilder.noProcedure');
  });

  it('still jumps to a procedure when a letter is typed on the closed, focused select', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <ProcedureSelect
          procedures={procedures}
          runway="04L"
          value={undefined}
          placeholder="Choose"
          onChange={onChange}
        />
      );
    });
    const trigger = container.querySelector<HTMLButtonElement>('button[role="combobox"]');
    if (!trigger) throw new Error('no trigger');
    act(() => trigger.focus());
    // Typeahead needs the items in Radix's collection; a focused trigger mounts them
    expect(countMountedComponents(container, 'SelectItem')).toBeGreaterThan(0);
    act(() => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'SID000' }));

    act(() => trigger.blur());
    expect(countMountedComponents(container, 'SelectItem')).toBe(0);
  });
});
