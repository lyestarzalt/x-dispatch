import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { extractEaipRelativeSuffix, findPdfByBasename } from './pdfPathResolve';

describe('pdfPathResolve', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  it('finds PDF nested under extract root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vac-'));
    tmpDirs.push(root);
    const pdfDir = path.join(root, 'FRANCE', 'html', 'eAIP', 'AD', 'LFPO');
    fs.mkdirSync(pdfDir, { recursive: true });
    fs.writeFileSync(path.join(pdfDir, 'LFPO_ADC.pdf'), '%PDF');

    expect(findPdfByBasename(root, 'LFPO_ADC.pdf')).toBe(path.join(pdfDir, 'LFPO_ADC.pdf'));
  });

  it('extracts relocatable suffix from absolute path', () => {
    const abs =
      'C:\\Users\\x\\sia-data\\extracted\\eaip\\FRANCE\\html\\eAIP\\AD\\LFPO\\LFPO_ADC.pdf';
    expect(extractEaipRelativeSuffix(abs)?.replace(/\\/g, '/')).toBe(
      'html/eAIP/AD/LFPO/LFPO_ADC.pdf'
    );
  });
});
