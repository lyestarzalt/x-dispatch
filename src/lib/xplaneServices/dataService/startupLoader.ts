import type { LoadingProgress } from '@/types/xplane';
import type { AirportProgressCallback, AirportProgressEvent, DataLoadStatus } from './types';

type RequiredStep = 'navaids' | 'waypoints' | 'airspaces' | 'airways';

interface RequiredStepConfig {
  step: RequiredStep;
  loadingKey: string;
  completeKey: string;
  load: () => Promise<void>;
  getCount: (status: DataLoadStatus) => number;
}

export interface StartupDataManager {
  rebuildAirportCache: (xplanePath: string, onProgress?: AirportProgressCallback) => Promise<void>;
  loadNavaidsOnly: (xplanePath: string) => Promise<void>;
  loadWaypointsOnly: (xplanePath: string) => Promise<void>;
  loadAirspacesOnly: (xplanePath: string) => Promise<void>;
  loadAirwaysOnly: (xplanePath: string) => Promise<void>;
  getStatus: () => DataLoadStatus;
}

type SendLoadingProgress = (progress: LoadingProgress) => void;

function getStatusCount(
  manager: StartupDataManager,
  getCount: (status: DataLoadStatus) => number
): number {
  return getCount(manager.getStatus());
}

function sendAirportProgress(send: SendLoadingProgress, event: AirportProgressEvent): void {
  switch (event.phase) {
    case 'cache-check':
      send({
        step: 'airports',
        status: 'loading',
        messageKey: 'loading.messages.checking',
        phase: 'verifying',
      });
      break;
    case 'cache-valid':
      send({
        step: 'airports',
        status: 'loading',
        messageKey: 'loading.messages.upToDate',
        phase: 'verifying',
      });
      break;
    case 'cache-stale':
      send({
        step: 'airports',
        status: 'loading',
        messageKey:
          event.reason === 'first-launch'
            ? 'loading.messages.firstLaunch'
            : 'loading.messages.sceneryChanged',
        phase: 'loading',
      });
      break;
    case 'global':
      send({
        step: 'airports',
        status: 'loading',
        messageKey: 'loading.messages.globalAirports',
        phase: 'loading',
        detail: {
          current: event.parsed,
          total: event.estimated,
          labelKey: 'loading.details.globalAirports',
        },
      });
      break;
    case 'custom':
      send({
        step: 'airports',
        status: 'loading',
        messageKey: 'loading.messages.customScenery',
        messageParams: {
          current: event.packIndex + 1,
          total: event.packCount,
        },
        phase: 'loading',
        detail: {
          current: event.packIndex + 1,
          total: event.packCount,
          label: event.packName,
        },
      });
      break;
    case 'inserting':
      send({
        step: 'airports',
        status: 'loading',
        messageKey: 'loading.messages.savingDatabase',
        phase: 'loading',
      });
      break;
    case 'done':
      send({
        step: 'airports',
        status: 'complete',
        messageKey: 'loading.messages.airportsDone',
        count: event.count,
        phase: event.fromCache ? 'verifying' : 'loading',
      });
      break;
  }
}

async function runRequiredStep(
  manager: StartupDataManager,
  config: RequiredStepConfig,
  send: SendLoadingProgress
): Promise<void> {
  send({
    step: config.step,
    status: 'loading',
    messageKey: config.loadingKey,
    phase: 'loading',
  });

  await config.load();

  send({
    step: config.step,
    status: 'complete',
    messageKey: config.completeKey,
    count: getStatusCount(manager, config.getCount),
    phase: 'loading',
  });
}

export async function loadRequiredStartupData(
  manager: StartupDataManager,
  xplanePath: string,
  send: SendLoadingProgress
): Promise<void> {
  const requiredSteps: RequiredStepConfig[] = [
    {
      step: 'navaids',
      loadingKey: 'loading.messages.navaids',
      completeKey: 'loading.messages.navaidsDone',
      load: () => manager.loadNavaidsOnly(xplanePath),
      getCount: (status) => status.navaids.count,
    },
    {
      step: 'waypoints',
      loadingKey: 'loading.messages.waypoints',
      completeKey: 'loading.messages.waypointsDone',
      load: () => manager.loadWaypointsOnly(xplanePath),
      getCount: (status) => status.waypoints.count,
    },
    {
      step: 'airspaces',
      loadingKey: 'loading.messages.airspaces',
      completeKey: 'loading.messages.airspacesDone',
      load: () => manager.loadAirspacesOnly(xplanePath),
      getCount: (status) => status.airspaces.count,
    },
    {
      step: 'airways',
      loadingKey: 'loading.messages.airways',
      completeKey: 'loading.messages.airwaysDone',
      load: () => manager.loadAirwaysOnly(xplanePath),
      getCount: (status) => status.airways.count,
    },
  ];

  const loadTasks = [
    manager.rebuildAirportCache(xplanePath, (event) => sendAirportProgress(send, event)),
    ...requiredSteps.map((config) => runRequiredStep(manager, config, send)),
  ];

  const results = await Promise.allSettled(loadTasks);
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );

  if (failed) {
    throw failed.reason;
  }
}
