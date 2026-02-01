export { XPlaneDataManager, getXPlaneDataManager } from './XPlaneDataManager';
export type { Airport, DataLoadStatus } from './XPlaneDataManager';

export { loadConfig, saveConfig, getXPlanePath, setXPlanePath, isSetupComplete } from './config';
export type { XPlaneConfig } from './config';

export {
  XPLANE_PATHS,
  resolveDataPath,
  getNavDataPath,
  getFixDataPath,
  getAirwayDataPath,
  getAirspaceDataPath,
  getAptDataPath,
  getCifpPath,
  validateXPlanePath,
  detectXPlanePaths,
} from './paths';
