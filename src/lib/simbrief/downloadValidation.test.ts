import { describe, expect, it } from 'vitest';
import { validateDownloadArgs } from './downloadValidation';

const VALID_URL = 'https://www.simbrief.com/ofp/flightplans/EGLL_KJFK_BAW.fms';
const VALID_DIR = '/Users/x/X-Plane 12/Output/FMS plans';

describe('validateDownloadArgs', () => {
  describe('happy path', () => {
    it('accepts a normal SimBrief OFP filename', () => {
      const r = validateDownloadArgs({
        url: VALID_URL,
        targetDir: VALID_DIR,
        filename: 'EGLL_KJFK_BAW123_v01.fms',
      });
      expect(r).toEqual({
        ok: true,
        url: VALID_URL,
        targetDir: VALID_DIR,
        filename: 'EGLL_KJFK_BAW123_v01.fms',
      });
    });

    it('accepts a filename containing two adjacent dots — the regression', () => {
      // SimBrief OFP layouts have produced filenames like `OFP..fms` and the
      // earlier `.includes('..')` check rejected them as path traversal.
      const r = validateDownloadArgs({
        url: VALID_URL,
        targetDir: VALID_DIR,
        filename: 'OFP..fms',
      });
      expect(r.ok).toBe(true);
    });

    it('accepts ToLiss .flp filename', () => {
      const r = validateDownloadArgs({
        url: VALID_URL,
        targetDir: VALID_DIR,
        filename: 'EGLLKJFK01.flp',
      });
      expect(r.ok).toBe(true);
    });

    it('accepts SimBrief CDN subdomain', () => {
      const r = validateDownloadArgs({
        url: 'https://files.simbrief.com/cdn/foo.fms',
        targetDir: VALID_DIR,
        filename: 'foo.fms',
      });
      expect(r.ok).toBe(true);
    });
  });

  describe('URL rejections', () => {
    it('rejects http://', () => {
      const r = validateDownloadArgs({
        url: 'http://www.simbrief.com/ofp/foo.fms',
        targetDir: VALID_DIR,
        filename: 'foo.fms',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/URL/);
    });

    it('rejects non-SimBrief hosts', () => {
      const r = validateDownloadArgs({
        url: 'https://evil.example.com/foo.fms',
        targetDir: VALID_DIR,
        filename: 'foo.fms',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('Refusing');
    });

    it('rejects malformed URLs', () => {
      const r = validateDownloadArgs({
        url: 'https://',
        targetDir: VALID_DIR,
        filename: 'foo.fms',
      });
      expect(r.ok).toBe(false);
    });

    it('rejects non-string URL', () => {
      const r = validateDownloadArgs({ url: 123, targetDir: VALID_DIR, filename: 'foo.fms' });
      expect(r.ok).toBe(false);
    });
  });

  describe('targetDir rejections', () => {
    it('rejects relative paths', () => {
      const r = validateDownloadArgs({
        url: VALID_URL,
        targetDir: 'relative/path',
        filename: 'foo.fms',
      });
      expect(r.ok).toBe(false);
    });

    it('rejects empty', () => {
      const r = validateDownloadArgs({
        url: VALID_URL,
        targetDir: '',
        filename: 'foo.fms',
      });
      expect(r.ok).toBe(false);
    });
  });

  describe('filename rejections', () => {
    it('rejects empty filename', () => {
      const r = validateDownloadArgs({ url: VALID_URL, targetDir: VALID_DIR, filename: '' });
      expect(r.ok).toBe(false);
    });

    it('rejects filename with forward slash', () => {
      const r = validateDownloadArgs({
        url: VALID_URL,
        targetDir: VALID_DIR,
        filename: 'foo/bar.fms',
      });
      expect(r.ok).toBe(false);
    });

    it('rejects parent directory `..` exactly', () => {
      const r = validateDownloadArgs({
        url: VALID_URL,
        targetDir: VALID_DIR,
        filename: '..',
      });
      expect(r.ok).toBe(false);
    });

    it('rejects current directory `.` exactly', () => {
      const r = validateDownloadArgs({
        url: VALID_URL,
        targetDir: VALID_DIR,
        filename: '.',
      });
      expect(r.ok).toBe(false);
    });

    it('rejects path traversal with embedded ../', () => {
      const r = validateDownloadArgs({
        url: VALID_URL,
        targetDir: VALID_DIR,
        filename: '../etc/passwd',
      });
      expect(r.ok).toBe(false);
    });
  });
});
