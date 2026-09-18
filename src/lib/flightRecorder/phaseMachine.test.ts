import { describe, expect, it } from 'vitest';
import type { FlightPhase } from '@/types/flightRecorder';
import type { SimFrame } from './frames';
import { FlightPhaseMachine, type PhaseEvent } from './phaseMachine';
import { frame } from './testFrames';

interface Segment {
  seconds: number;
  frame: Partial<SimFrame>;
}

function drive(segments: Segment[], hz = 2) {
  const machine = new FlightPhaseMachine();
  const phases: FlightPhase[] = [];
  const events: PhaseEvent[] = [];
  let t = 0;
  for (const segment of segments) {
    const steps = Math.round(segment.seconds * hz);
    for (let i = 0; i < steps; i++) {
      t += 1 / hz;
      const update = machine.push(frame({ ...segment.frame, simT: t }));
      if (update.changed) phases.push(update.phase);
      events.push(...update.events);
    }
  }
  return { machine, phases, events };
}

const GROUND = { onGroundAny: true, onGroundAll: true, aglM: 0, altM: 100, vsFpm: 0 };

describe('FlightPhaseMachine', () => {
  it('walks a full flight from gate to gate', () => {
    const { phases, events } = drive([
      { seconds: 30, frame: { ...GROUND, groundspeedMs: 0 } },
      { seconds: 60, frame: { ...GROUND, groundspeedMs: 8 } },
      { seconds: 5, frame: { onGroundAny: false, onGroundAll: false, aglM: 20, vsFpm: 1500 } },
      { seconds: 20, frame: { onGroundAny: false, onGroundAll: false, aglM: 400, vsFpm: 1500 } },
      { seconds: 120, frame: { onGroundAny: false, onGroundAll: false, aglM: 3000, vsFpm: 0 } },
      { seconds: 30, frame: { onGroundAny: false, onGroundAll: false, aglM: 2500, vsFpm: -1200 } },
      { seconds: 30, frame: { onGroundAny: false, onGroundAll: false, aglM: 600, vsFpm: -700 } },
      { seconds: 5, frame: { ...GROUND, groundspeedMs: 65 } },
      { seconds: 30, frame: { ...GROUND, groundspeedMs: 8 } },
      { seconds: 30, frame: { ...GROUND, groundspeedMs: 0 } },
      { seconds: 100, frame: { ...GROUND, groundspeedMs: 0 } },
    ]);
    expect(phases).toEqual([
      'taxi-out',
      'takeoff',
      'climb',
      'cruise',
      'descent',
      'approach',
      'landed',
      'taxi-in',
      'parked',
    ]);
    expect(events).toEqual(['flightStart', 'liftoff', 'touchdown', 'flightEnd']);
  });

  it('opens a flight straight into climb when connecting mid-air', () => {
    const { phases, events, machine } = drive([
      { seconds: 5, frame: { onGroundAny: false, onGroundAll: false, aglM: 2000, vsFpm: 0 } },
    ]);
    expect(phases).toEqual(['climb']);
    expect(events).toEqual(['flightStart']);
    expect(machine.flightOpen).toBe(true);
  });

  it('keeps one flight through a touch-and-go and counts both touchdowns', () => {
    const { phases, events } = drive([
      { seconds: 10, frame: { onGroundAny: false, onGroundAll: false, aglM: 300, vsFpm: -600 } },
      { seconds: 5, frame: { ...GROUND, groundspeedMs: 60 } },
      { seconds: 10, frame: { onGroundAny: false, onGroundAll: false, aglM: 50, vsFpm: 1000 } },
      { seconds: 10, frame: { onGroundAny: false, onGroundAll: false, aglM: 400, vsFpm: -600 } },
      { seconds: 5, frame: { ...GROUND, groundspeedMs: 60 } },
    ]);
    expect(phases).toEqual(['approach', 'landed', 'takeoff', 'climb', 'approach', 'landed']);
    expect(events.filter((e) => e === 'touchdown')).toHaveLength(2);
    expect(events.filter((e) => e === 'flightStart')).toHaveLength(1);
  });

  it('does not open a flight while the aircraft only creeps at the gate', () => {
    const { machine, events } = drive([{ seconds: 120, frame: { ...GROUND, groundspeedMs: 0.5 } }]);
    expect(machine.flightOpen).toBe(false);
    expect(events).toEqual([]);
  });

  it('ends the flight and starts a new one when moving again after parking', () => {
    const { events } = drive([
      { seconds: 10, frame: { onGroundAny: false, onGroundAll: false, aglM: 300, vsFpm: -600 } },
      { seconds: 5, frame: { ...GROUND, groundspeedMs: 60 } },
      { seconds: 10, frame: { ...GROUND, groundspeedMs: 8 } },
      { seconds: 30, frame: { ...GROUND, groundspeedMs: 0 } },
      { seconds: 10, frame: { ...GROUND, groundspeedMs: 8 } },
    ]);
    expect(events).toEqual(['flightStart', 'touchdown', 'flightEnd', 'flightStart']);
  });

  it('treats a position jump as a new flight', () => {
    const machine = new FlightPhaseMachine();
    machine.push(frame({ simT: 1, onGroundAny: false, aglM: 2000 }));
    machine.push(frame({ simT: 2, onGroundAny: false, aglM: 2000 }));
    expect(machine.flightOpen).toBe(true);
    const update = machine.push(
      frame({ simT: 3, lat: 30, lon: -90, onGroundAny: false, aglM: 2000 })
    );
    expect(update.events).toEqual(['teleport', 'flightEnd']);
    expect(machine.flightOpen).toBe(false);
  });

  it('ignores paused and replay frames', () => {
    const machine = new FlightPhaseMachine();
    for (let i = 1; i <= 20; i++) {
      const update = machine.push(frame({ simT: i, onGroundAny: false, aglM: 2000, paused: true }));
      expect(update.changed).toBe(false);
    }
    const replay = machine.push(frame({ simT: 30, onGroundAny: false, aglM: 2000, replay: true }));
    expect(replay.events).toEqual([]);
    expect(machine.flightOpen).toBe(false);
  });

  it('closes an open flight on forceEnd', () => {
    const machine = new FlightPhaseMachine();
    machine.push(frame({ simT: 1, onGroundAny: false, aglM: 2000 }));
    machine.push(frame({ simT: 3, onGroundAny: false, aglM: 2000 }));
    expect(machine.forceEnd()).toEqual(['flightEnd']);
    expect(machine.forceEnd()).toEqual([]);
  });
});
