/** The electron-log transport that sends warnings and errors to Sentry Logs. */
import type { LogMessage, Transport } from 'electron-log';
import * as Sentry from '@sentry/electron/main';
import { createLogForwarder } from './logForwarding';

/** `Sentry.logger` is a no-op until `Sentry.init` runs, so this is safe at module load. */
const forward = createLogForwarder();

export function sentryLogTransport(message: LogMessage): void {
  const entry = forward(message.level, message.data);
  if (!entry) return;
  Sentry.logger[entry.level](entry.message, entry.attributes);
}
sentryLogTransport.level = 'warn' as const;
sentryLogTransport.transforms = [] as Transport['transforms'];
