import * as fs from 'fs';
import { describe, expect, it } from 'vitest';
import { rarModulePath, rarWorkerPath } from './rarWorker';

describe('rarModulePath', () => {
  it('points at the RAR module entry file on disk, never inside an asar', () => {
    const modulePath = rarModulePath();
    expect(modulePath).toMatch(/node-unrar-js[\\/]dist[\\/]index\.js$/);
    expect(modulePath).not.toMatch(/app\.asar[\\/]/);
    expect(fs.existsSync(modulePath)).toBe(true);
  });
});

describe('rarWorkerPath', () => {
  it('is the built worker file beside the main bundle', () => {
    expect(rarWorkerPath()).toMatch(/[\\/]rarWorker\.js$/);
  });
});
