import { describe, expect, it } from 'vitest';
import { sanitizeEvent } from './events';

describe('sanitizeEvent', () => {
  it('accepts a valid event and strips unknown properties', () => {
    expect(sanitizeEvent('feature_opened', { feature: 'logbook', path: 'C:\\Users\\bob' })).toEqual(
      {
        event: 'feature_opened',
        properties: { feature: 'logbook' },
      }
    );
  });

  it('drops unknown events and values outside the allowlist', () => {
    expect(sanitizeEvent('secret_event', {})).toBeNull();
    expect(sanitizeEvent('feature_opened', { feature: 'secret_panel' })).toBeNull();
    expect(sanitizeEvent('layer_enabled', {})).toBeNull();
    expect(sanitizeEvent('__proto__', {})).toBeNull();
  });

  it('normalizes airport and aircraft codes and rejects free text', () => {
    expect(sanitizeEvent('airport_selected', { airport: ' egll ' })).toEqual({
      event: 'airport_selected',
      properties: { airport: 'EGLL' },
    });
    expect(sanitizeEvent('airport_selected', { airport: 'Heathrow Airport' })).toBeNull();
  });

  it('validates flight launches and allows an unknown aircraft type', () => {
    const launch = {
      mode: 'cold_start',
      airport: 'LFPG',
      aircraft_type: '',
      helicopter: false,
      start_type: 'ramp',
      success: true,
      companion_apps_launched: 1,
      livery: 'HB-ZQG',
    };
    expect(sanitizeEvent('flight_launched', launch)?.properties).toEqual({
      mode: 'cold_start',
      airport: 'LFPG',
      aircraft_type: null,
      helicopter: false,
      start_type: 'ramp',
      success: true,
      companion_apps_launched: 1,
    });
    expect(sanitizeEvent('flight_launched', { ...launch, success: 'yes' })).toBeNull();
  });

  it('accepts events without properties', () => {
    expect(sanitizeEvent('simbrief_imported', undefined)).toEqual({
      event: 'simbrief_imported',
      properties: {},
    });
  });
});

describe('classifyCompanionApp', () => {
  it('reports known tools by id from the file name only', async () => {
    const { classifyCompanionApp } = await import('./companionApps');
    expect(classifyCompanionApp('C:\\Users\\jane.doe\\AppData\\Local\\xPilot\\xPilot.exe')).toBe(
      'xpilot'
    );
    expect(classifyCompanionApp('/Applications/Little Navmap.app')).toBe('little_navmap');
    expect(classifyCompanionApp('/opt/XPlaneMapEnhancement/xplane-map-enhancement')).toBe('xpme');
    expect(classifyCompanionApp('C:\\Users\\jane.doe\\tools\\my-script.bat')).toBe('other');
  });
});
