import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { SiaMagentoCredentials } from './siaGraphqlClient';

const CREDENTIALS_FILE = 'sia-magento-credentials.bin';

function credentialsPath(): string {
  return path.join(app.getPath('userData'), CREDENTIALS_FILE);
}

export interface SiaCredentialsStatus {
  configured: boolean;
  email: string | null;
  encryptionAvailable: boolean;
}

export function getCredentialsStatus(): SiaCredentialsStatus {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  const file = credentialsPath();
  if (!encryptionAvailable || !fs.existsSync(file)) {
    return { configured: false, email: null, encryptionAvailable };
  }
  try {
    const buf = fs.readFileSync(file);
    const json = safeStorage.decryptString(buf);
    const parsed = JSON.parse(json) as { email: string; password: string };
    return {
      configured: !!parsed.email && !!parsed.password,
      email: parsed.email || null,
      encryptionAvailable,
    };
  } catch {
    return { configured: false, email: null, encryptionAvailable };
  }
}

export function loadCredentials(): SiaMagentoCredentials | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const file = credentialsPath();
  if (!fs.existsSync(file)) return null;
  try {
    const buf = fs.readFileSync(file);
    const json = safeStorage.decryptString(buf);
    const parsed = JSON.parse(json) as SiaMagentoCredentials;
    if (!parsed.email?.trim() || !parsed.password) return null;
    return { email: parsed.email.trim(), password: parsed.password };
  } catch (err) {
    logger.main.error('Failed to load SIA credentials', err);
    return null;
  }
}

export function saveCredentials(credentials: SiaMagentoCredentials): {
  success: boolean;
  error?: string;
} {
  if (!safeStorage.isEncryptionAvailable()) {
    return {
      success: false,
      error: 'Secure storage is not available on this system',
    };
  }
  try {
    const payload = JSON.stringify({
      email: credentials.email.trim(),
      password: credentials.password,
    });
    const encrypted = safeStorage.encryptString(payload);
    fs.writeFileSync(credentialsPath(), encrypted);
    return { success: true };
  } catch (err) {
    logger.main.error('Failed to save SIA credentials', err);
    return { success: false, error: (err as Error).message };
  }
}

export function clearCredentials(): void {
  const file = credentialsPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
