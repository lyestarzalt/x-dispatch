import { describe, expect, it, vi } from 'vitest';
import {
  addRecentAirport,
  buildDockMenuTemplate,
  buildJumpListCategories,
  parseRecentAirports,
} from './recentAirports';

const labels = { recentAirports: 'Recent Airports' };

describe('addRecentAirport', () => {
  it('puts the newest first and moves a repeat to the front without duplicating', () => {
    let list = addRecentAirport([], { icao: 'DAAG', name: 'Algiers' });
    list = addRecentAirport(list, { icao: 'LFPG', name: 'Paris CDG' });
    list = addRecentAirport(list, { icao: 'daag', name: 'Algiers' });
    expect(list.map((a) => a.icao)).toEqual(['DAAG', 'LFPG']);
  });

  it('caps the list', () => {
    let list: ReturnType<typeof addRecentAirport> = [];
    for (let i = 0; i < 12; i++) list = addRecentAirport(list, { icao: `AP${i}`, name: '' });
    expect(list).toHaveLength(8);
    expect(list[0]!.icao).toBe('AP11');
  });
});

describe('parseRecentAirports', () => {
  it('keeps valid entries and drops malformed ones', () => {
    expect(
      parseRecentAirports([
        { icao: 'DAAG', name: 'Algiers' },
        { icao: 'bad icao', name: 'x' },
        'nope',
        { icao: 'LFPG' },
      ])
    ).toEqual([
      { icao: 'DAAG', name: 'Algiers' },
      { icao: 'LFPG', name: '' },
    ]);
    expect(parseRecentAirports(null)).toEqual([]);
  });
});

describe('buildDockMenuTemplate', () => {
  it('is empty with no recents and otherwise lists a heading plus one item each', () => {
    const onPick = vi.fn();
    expect(buildDockMenuTemplate([], labels, onPick)).toEqual([]);
    const template = buildDockMenuTemplate([{ icao: 'DAAG', name: 'Algiers' }], labels, onPick);
    expect(template[0]).toMatchObject({ label: 'Recent Airports', enabled: false });
    expect(template[1]!.label).toBe('DAAG — Algiers');
    (template[1]!.click as () => void)();
    expect(onPick).toHaveBeenCalledWith('DAAG');
  });
});

describe('buildJumpListCategories', () => {
  it('launches the exe with the airport link as the argument', () => {
    const [category] = buildJumpListCategories(
      [{ icao: 'DAAG', name: 'Algiers' }],
      labels,
      'C:\\x\\x-dispatch.exe'
    );
    expect(category!.name).toBe('Recent Airports');
    expect(category!.items![0]).toMatchObject({
      type: 'task',
      program: 'C:\\x\\x-dispatch.exe',
      args: 'xdispatch://airport/DAAG',
      title: 'DAAG — Algiers',
    });
  });
});
