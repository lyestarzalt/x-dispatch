import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escape';

describe('escapeHtml', () => {
  it('escapes the five markup characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>R&D</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;R&amp;D&lt;/a&gt;'
    );
  });

  it('escapes an ampersand once, not the entities it produces', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves plain text alone', () => {
    expect(escapeHtml('NAT A 350-390')).toBe('NAT A 350-390');
  });
});
