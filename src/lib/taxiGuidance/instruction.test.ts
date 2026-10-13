import { describe, expect, it } from 'vitest';
import { guidanceView } from './instruction';
import type { GuidanceEvent } from './types';

const turnB: GuidanceEvent = { kind: 'turn', turn: 'turnLeft', name: 'B', at: 200 };
const turnC: GuidanceEvent = { kind: 'turn', turn: 'turnRight', name: 'C', at: 400 };
const hold: GuidanceEvent = { kind: 'holdShort', runway: '27', at: 450, pointIndex: 5 };
const arrive: GuidanceEvent = { kind: 'arrive', name: 'G1', at: 600 };

const on = (along: number, lateral = 2) => ({ segIndex: 0, along, lateral, joined: true });

describe('guidanceView', () => {
  it('shows the next instruction with the distance to it', () => {
    const view = guidanceView([turnB, turnC, arrive], on(50), 600);
    expect(view.next).toEqual({ event: turnB, distance: 150, now: false });
    expect(view.offRoute).toBe(false);
  });

  it('keeps a turn up until the aircraft is through it', () => {
    expect(guidanceView([turnB, turnC, arrive], on(205), 600).next?.event).toBe(turnB);
    expect(guidanceView([turnB, turnC, arrive], on(215), 600).next?.event).toBe(turnC);
  });

  it('adds the following instruction only when it comes soon after', () => {
    expect(guidanceView([turnB, turnC, arrive], on(50), 600).then).toBe(turnC);
    expect(guidanceView([turnB, { ...turnC, at: 900 }], on(50), 900).then).toBeNull();
  });

  it('holds short until the aircraft has lined up, then has nothing left', () => {
    expect(guidanceView([hold], on(452), 500).next).toEqual({
      event: hold,
      distance: 0,
      now: true,
    });
    expect(guidanceView([hold], on(490), 500).next).toBeNull();
  });

  it('counts the way to the route while the aircraft is still at the gate', () => {
    const view = guidanceView(
      [turnB, arrive],
      { segIndex: 0, along: 0, lateral: 80, joined: false },
      600
    );
    expect(view.offRoute).toBe(false);
    expect(view.next?.distance).toBe(280);
  });

  it('calls a turn now when it is just ahead, and the hold once at the line', () => {
    expect(guidanceView([turnB, arrive], on(190), 600).next?.now).toBe(true);
    expect(guidanceView([turnB, arrive], on(150), 600).next?.now).toBe(false);
    expect(guidanceView([hold], on(440), 500).next?.now).toBe(false);
    expect(guidanceView([hold], on(446), 500).next?.now).toBe(true);
  });

  it('tells the pilot when the aircraft has left the route', () => {
    expect(guidanceView([turnB, arrive], on(100, 60), 600).offRoute).toBe(true);
  });

  it('reports arrival at the end of an arrival route', () => {
    const view = guidanceView([turnB, arrive], on(590), 600);
    expect(view.arrived).toBe(true);
    expect(view.next).toBeNull();
  });
});
