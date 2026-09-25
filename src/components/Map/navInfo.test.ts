import { describe, expect, it } from 'vitest';
import { navInfoFromFeature } from './navInfo';

describe('navInfoFromFeature', () => {
  it('describes a navaid with its type and frequency', () => {
    const info = navInfoFromFeature(
      'nav-navaids',
      { id: 'DIA', name: 'DOHA', type: 'VOR-DME', freqDisplay: '114.40' },
      25.26,
      51.56
    );
    expect(info).toMatchObject({ id: 'DIA', kind: 'VOR-DME', frequency: '114.40 MHz' });
  });

  it('keeps kHz for an NDB', () => {
    const info = navInfoFromFeature(
      'nav-navaids',
      { id: 'LUC', type: 'NDB', freqDisplay: '375 kHz' },
      0,
      0
    );
    expect(info?.frequency).toBe('375 kHz');
  });

  it('describes a plan waypoint with its planned altitude', () => {
    const info = navInfoFromFeature(
      'flightplan-waypoints',
      { id: 'IVENA', navType: 11, frequency: 0, altitudeLabel: 'FL250' },
      0,
      0
    );
    expect(info).toMatchObject({ id: 'IVENA', kind: 'WPT', altitudeLabel: 'FL250' });
    expect(info?.frequency).toBeUndefined();
  });

  it('ignores badge features without an id', () => {
    expect(navInfoFromFeature('flightplan-waypoints', { index: -1 }, 0, 0)).toBeNull();
  });
});
