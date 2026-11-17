import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { type ActiveRunway, ActiveRunwayLine, activeEndUse } from './ActiveRunwayLine';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { letter?: string }) =>
      key === 'airportInfo.atisLabel' ? `ATIS ${options?.letter}` : key,
  }),
}));

const atis = (
  split: boolean,
  arrivals: string[],
  departures: string[],
  arrivalLetter: string | null = null,
  departureLetter: string | null = null
): ActiveRunway => ({
  source: 'atis',
  ends: [...new Set([...arrivals, ...departures])],
  split,
  arrivals,
  departures,
  arrivalLetter,
  departureLetter,
});

const render = (activeRunway: ActiveRunway, atisLetter: string | null) =>
  renderToStaticMarkup(createElement(ActiveRunwayLine, { activeRunway, atisLetter }));
const letters = (html: string) => [...html.matchAll(/ATIS ([A-Z])/g)].map((m) => m[1]);

describe('activeEndUse', () => {
  it('tells arrival ends from departure ends when the ATIS splits them', () => {
    const use = activeEndUse(atis(true, ['04L', '04R'], ['04L', '31L']));
    expect(Object.fromEntries(use)).toEqual({
      '04L': 'both',
      '04R': 'arrival',
      '31L': 'departure',
    });
  });

  it('does not name a use when the ATIS does not split them', () => {
    expect(Object.fromEntries(activeEndUse(atis(false, ['27'], ['27'])))).toEqual({ '27': 'any' });
  });

  it('is empty with no active runway', () => {
    expect(activeEndUse(null).size).toBe(0);
  });
});

describe('ActiveRunwayLine ATIS letters', () => {
  // LEBL: one runway for both, an arrival ATIS on E and a departure ATIS on K.
  it('shows both letters when one runway is served by two broadcasts', () => {
    const html = render(atis(false, ['24L'], ['24L'], 'E', 'K'), 'E');
    expect(letters(html)).toEqual(['E', 'K']);
  });

  it('shows one letter when one broadcast serves the runway', () => {
    expect(letters(render(atis(false, ['27'], ['27'], 'D', 'D'), 'D'))).toEqual(['D']);
  });

  // EDDF: arrival and departure broadcasts both on L; each row carries its own.
  it('puts the letter on both rows when split runways share one letter', () => {
    const html = render(atis(true, ['25R', '25L'], ['25C'], 'L', 'L'), 'L');
    expect(letters(html)).toEqual(['L', 'L']);
  });

  it('takes the letters from the broadcasts that name the runways, not the first one online', () => {
    const html = render(atis(false, ['24L'], ['24L'], 'E', 'K'), 'Q');
    expect(letters(html)).not.toContain('Q');
  });
});
