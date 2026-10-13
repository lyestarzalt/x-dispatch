import { describe, expect, it } from 'vitest';
import { leg, makeRoute } from './__fixtures__/routes';
import { classifyTurn, computeEvents, holdBarLines } from './events';
import { buildGeometry } from './geometry';
import type { GuidanceRoute } from './types';

function eventsOf(route: GuidanceRoute) {
  return computeEvents(route, buildGeometry(route.points));
}

describe('classifyTurn', () => {
  it('splits heading changes into continue, bear, turn and sharp', () => {
    expect(classifyTurn(10)).toBe('continue');
    expect(classifyTurn(-40)).toBe('bearLeft');
    expect(classifyTurn(90)).toBe('turnRight');
    expect(classifyTurn(-90)).toBe('turnLeft');
    expect(classifyTurn(150)).toBe('sharpRight');
  });
});

describe('computeEvents', () => {
  it('announces a right turn where the taxiway name changes', () => {
    const route = makeRoute(
      [
        [0, 0],
        [0, 100],
        [0, 200],
        [100, 200],
      ],
      [leg('A'), leg('A'), leg('B')],
      { direction: 'arrival', gateName: 'G12' }
    );
    const events = eventsOf(route);
    expect(events[0]).toMatchObject({ kind: 'turn', turn: 'turnRight', name: 'B' });
    expect(events[0]!.at).toBeCloseTo(200, 0);
    expect(events[1]).toMatchObject({ kind: 'arrive', name: 'G12' });
    expect(events[1]!.at).toBeCloseTo(300, 0);
  });

  it('measures a turn through a blank-named connector, from where the route leaves the taxiway', () => {
    const route = makeRoute(
      [
        [0, 0],
        [0, 200],
        [60, 200],
        [120, 200],
        [220, 200],
      ],
      [leg('A'), leg(''), leg(''), leg('B')],
      { direction: 'arrival' }
    );
    const turn = eventsOf(route)[0]!;
    expect(turn).toMatchObject({ kind: 'turn', turn: 'turnRight', name: 'B' });
    expect(turn.at).toBeCloseTo(200, 0);
  });

  it('announces the first taxiway after a blank-named lead-in from the gate', () => {
    const route = makeRoute(
      [
        [0, 0],
        [0, 50],
        [200, 50],
      ],
      [leg(''), leg('A')],
      { direction: 'arrival' }
    );
    const turn = eventsOf(route)[0]!;
    expect(turn).toMatchObject({ kind: 'turn', turn: 'turnRight', name: 'A' });
    expect(turn.at).toBeCloseTo(50, 0);
  });

  it('does not announce a blank-named connector as a new taxiway', () => {
    const route = makeRoute(
      [
        [0, 0],
        [0, 100],
        [0, 200],
        [0, 300],
      ],
      [leg('A'), leg(''), leg('A')],
      { direction: 'arrival' }
    );
    expect(eventsOf(route).filter((e) => e.kind === 'turn')).toEqual([]);
  });

  it('holds short of the departure runway where its zone begins', () => {
    const route = makeRoute(
      [
        [0, 0],
        [0, 100],
        [0, 200],
        [0, 250],
        [100, 250],
      ],
      [leg('A'), leg('A'), leg('A', ['14L/32R']), leg('14L/32R', ['14L/32R'], true)],
      { runway: '14L' }
    );
    const events = eventsOf(route);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'holdShort', runway: '14L', pointIndex: 2 });
    expect(events[0]!.at).toBeCloseTo(200, 0);
  });

  it('says nothing past the departure runway hold: the rest is lining up', () => {
    const route = makeRoute(
      [
        [0, 0],
        [0, 100],
        [0, 200],
        [100, 200],
      ],
      [leg('A'), leg('A', ['14R/32L']), leg('S11', ['14R/32L'])],
      { runway: '14R' }
    );
    expect(eventsOf(route).map((e) => e.kind)).toEqual(['holdShort']);
  });

  it('marks a runway zone the route leaves again as a crossing, ahead of the turn at the same spot', () => {
    const route = makeRoute(
      [
        [0, 0],
        [0, 100],
        [100, 100],
        [200, 100],
        [200, 200],
      ],
      [leg('A'), leg('M4', ['14R/32L']), leg('M4', ['14R/32L']), leg('B')],
      { runway: '14L' }
    );
    const kinds = eventsOf(route).map((e) => ('runway' in e ? `${e.kind}:${e.runway}` : e.kind));
    expect(kinds).toEqual(['cross:14R/32L', 'turn', 'turn', 'holdShort:14L']);
  });

  it('falls back to holding short at the route end when the scenery has no zones', () => {
    const route = makeRoute(
      [
        [0, 0],
        [0, 100],
      ],
      [leg('A')],
      { runway: '32R' }
    );
    const events = eventsOf(route);
    expect(events).toEqual([
      { kind: 'holdShort', runway: '32R', at: expect.any(Number), pointIndex: null },
    ]);
  });

  it('starts an arrival on the runway without a hold, and announces the exit', () => {
    const route = makeRoute(
      [
        [0, 0],
        [0, 300],
        [-100, 300],
        [-200, 300],
      ],
      [leg('14L/32R', ['14L/32R'], true), leg('M4', ['14L/32R']), leg('M4')],
      { direction: 'arrival', gateName: 'B12' }
    );
    const events = eventsOf(route);
    expect(events.map((e) => e.kind)).toEqual(['turn', 'arrive']);
    expect(events[0]).toMatchObject({ turn: 'turnLeft', name: 'M4' });
  });
});

describe('holdBarLines', () => {
  it('draws two lines across the route at the hold point', () => {
    const route = makeRoute(
      [
        [0, 0],
        [0, 100],
        [0, 200],
      ],
      [leg('A'), leg('A', ['09/27'])],
      { runway: '27' }
    );
    const g = buildGeometry(route.points);
    const lines = holdBarLines(g, computeEvents(route, g));
    expect(lines).toHaveLength(2);
    // Square across a northbound taxiway: both ends share a latitude.
    for (const [a, b] of lines) expect(a!.lat).toBeCloseTo(b!.lat, 9);
  });
});
