import { describe, expect, it } from 'vitest';
import { DEFAULT_NATIVE_LABELS, parseNativeLabels } from './labels';

describe('parseNativeLabels', () => {
  it('accepts a complete label set', () => {
    const labels = {
      menu: { ...DEFAULT_NATIVE_LABELS.menu, settings: 'Einstellungen…' },
      crash: { ...DEFAULT_NATIVE_LABELS.crash, reload: 'Neu laden' },
    };
    expect(parseNativeLabels(labels)).toEqual(labels);
  });

  it('falls back to English per field for missing or non-string values', () => {
    const parsed = parseNativeLabels({ menu: { settings: 'Réglages…', help: 42 }, crash: null });
    expect(parsed.menu.settings).toBe('Réglages…');
    expect(parsed.menu.help).toBe(DEFAULT_NATIVE_LABELS.menu.help);
    expect(parsed.crash).toEqual(DEFAULT_NATIVE_LABELS.crash);
  });

  it('returns the defaults for garbage input', () => {
    expect(parseNativeLabels(undefined)).toEqual(DEFAULT_NATIVE_LABELS);
    expect(parseNativeLabels('menu')).toEqual(DEFAULT_NATIVE_LABELS);
  });

  it('ignores empty strings so a missing translation never blanks a menu item', () => {
    expect(parseNativeLabels({ menu: { edit: '' } }).menu.edit).toBe(
      DEFAULT_NATIVE_LABELS.menu.edit
    );
  });
});
