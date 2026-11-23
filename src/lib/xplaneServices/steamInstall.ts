import * as fs from 'fs';
import * as path from 'path';

/** True for a Steam copy of X-Plane: inside a `steamapps` folder, or carrying `steam_appid.txt`. */
export function isSteamInstallation(xplanePath: string): boolean {
  if (xplanePath.toLowerCase().includes('steamapps')) return true;
  return fs.existsSync(path.join(xplanePath, 'steam_appid.txt'));
}
