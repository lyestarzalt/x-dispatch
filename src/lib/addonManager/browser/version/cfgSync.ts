import * as fs from 'fs';
import * as path from 'path';

/**
 * Update the disabled| field in skunkcrafts_updater.cfg.
 * Creates the field if it doesn't exist.
 */
export function setCfgDisabled(
  xplanePath: string,
  type: 'aircraft' | 'plugins',
  folderName: string,
  disabled: boolean
): void {
  // Security: validate folderName to prevent path traversal
  if (!folderName || folderName.includes('..')) {
    return;
  }

  let baseDir: string;
  let cfgPath: string;
  if (type === 'aircraft') {
    baseDir = path.join(xplanePath, 'Aircraft');
    cfgPath = path.join(baseDir, folderName, 'skunkcrafts_updater.cfg');
  } else {
    // Plugins use single folder name, no nested paths
    if (folderName.includes('/') || folderName.includes('\\')) {
      return;
    }
    baseDir = path.join(xplanePath, 'Resources', 'plugins');
    cfgPath = path.join(baseDir, folderName, 'skunkcrafts_updater.cfg');
  }

  // Validate resolved path is within expected directory
  const resolvedCfg = path.resolve(cfgPath);
  const resolvedBase = path.resolve(baseDir);
  if (!resolvedCfg.startsWith(resolvedBase + path.sep)) {
    return;
  }

  if (!fs.existsSync(resolvedCfg)) return;

  try {
    const content = fs.readFileSync(resolvedCfg, 'utf-8');
    const lines = content.split('\n');
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.trim().startsWith('disabled|')) {
        lines[i] = `disabled|${disabled}`;
        found = true;
        break;
      }
    }

    if (!found) {
      // Add disabled field at the end
      lines.push(`disabled|${disabled}`);
    }

    fs.writeFileSync(resolvedCfg, lines.join('\n'), 'utf-8');
  } catch {
    // Ignore write errors
  }
}
