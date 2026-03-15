import { defineConfig } from 'drizzle-kit';
import * as os from 'os';
import * as path from 'path';

// Resolve the Electron userData path for the SQLite database
const userDataPath =
  process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'X-Dispatch')
    : process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'X-Dispatch')
      : path.join(os.homedir(), '.config', 'X-Dispatch');

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(userDataPath, 'xplane-data.db'),
  },
});
