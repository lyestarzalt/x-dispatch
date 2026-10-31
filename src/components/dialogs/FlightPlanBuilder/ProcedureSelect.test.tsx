// @vitest-environment jsdom
/**
 * A procedure select at a large airport has about a hundred entries, which
 * Radix keeps mounted so the closed trigger can show the choice and typing a
 * letter can search them. The component is memoised for that reason; a parent
 * Profiler cannot see a memo bail-out, so what is tested here is the behaviour
 * Radix provides once it owns the items.
 */
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { initReactI18next } from 'react-i18next';
import i18next from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedProcedure } from '@/types/navigation';
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

const noop = () => {};
const chosen = { name: 'SID004', transition: 'TR4' };

describe('ProcedureSelect', () => {
  it('shows the chosen procedure and transition on the trigger while closed', () => {
    act(() => {
      root.render(
        <ProcedureSelect
          procedures={procedures}
          runway="04L"
          value={chosen}
          placeholder="Choose"
          onChange={noop}
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
          onChange={noop}
        />
      );
    });
    const trigger = container.querySelector('button[role="combobox"]');
    expect(trigger?.textContent).toContain('planBuilder.noProcedure');
  });

  it('jumps to a procedure when a letter is typed on the closed select', () => {
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
    act(() => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'SID000' }));
  });
});
