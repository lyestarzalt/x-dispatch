/**
 * Maps a companion app's executable to a known tool id. Only the file name is
 * inspected, and only the resulting id is ever sent: user-typed names and
 * paths (which can contain the OS username) never leave the machine.
 */
const KNOWN_TOOLS: ReadonlyArray<[id: string, pattern: RegExp]> = [
  ['xpme', /map[ _-]?enhancement/],
  ['xpilot', /xpilot/],
  ['swift', /^swift(gui|core|launcher)?\b/],
  ['altitude', /altitude/],
  ['little_navmap', /little[ _-]?navmap/],
  ['volanta', /volanta/],
  ['navigraph', /navigraph/],
  ['simbrief_downloader', /simbrief/],
  ['smartcopilot', /smart[ _-]?copilot/],
  ['skunkcrafts', /skunkcrafts/],
  ['orbx_central', /orbx/],
  ['vatspy', /vat[ _-]?spy/],
  ['discord', /discord/],
  ['teamspeak', /teamspeak|ts3client/],
];

export const ANALYTICS_COMPANION_APPS = [...KNOWN_TOOLS.map(([id]) => id), 'other'] as const;

export function classifyCompanionApp(exePath: string): string {
  const file = exePath.split(/[\\/]/).filter(Boolean).pop()?.toLowerCase() ?? '';
  const name = file.replace(/\.(exe|app|appimage|sh)$/, '');
  return KNOWN_TOOLS.find(([, pattern]) => pattern.test(name))?.[0] ?? 'other';
}
