export interface SuggestedCompanionApp {
  id: string;
  name: string;
  description: string;
  args: string;
  delayBeforeXPlaneSec: number;
  pathHints: {
    win32: string;
    darwin: string;
    linux: string;
  };
}

export const SUGGESTED_COMPANION_APPS: SuggestedCompanionApp[] = [
  {
    id: 'xpme',
    name: 'X-Plane Map Enhancement',
    description: 'Adds satellite imagery to X-Plane scenery (FUSE-based).',
    args: '--start-service',
    delayBeforeXPlaneSec: 10,
    pathHints: {
      win32: 'C:\\Program Files\\XPlaneMapEnhancement\\XplaneMapEnhancement.exe',
      darwin: '/Applications/X-Plane Map Enhancement.app',
      linux: '/opt/XPlaneMapEnhancement/xplane-map-enhancement',
    },
  },
];
