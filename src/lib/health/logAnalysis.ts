/**
 * What X-Plane's Log.txt says about the last session: the build, the GPU and
 * driver, whether the sim ended cleanly, and the lines that explain a problem.
 * Pure text in, structured facts out; the file is read elsewhere.
 */

export type LogIssueSeverity = 'error' | 'warning' | 'info';

export interface LogIssuePattern {
  id: string;
  severity: LogIssueSeverity;
  /** `line` is the raw line, `lower` its lower-case form. */
  test: (line: string, lower: string) => boolean;
}

export interface LogIssue {
  id: string;
  severity: LogIssueSeverity;
  /** 1-based line number in Log.txt. */
  lineNo: number;
  line: string;
  count: number;
}

export interface LogAnalysis {
  /** The file has X-Plane's own header, so it is a Log.txt and not something else. */
  isXPlaneLog: boolean;
  version: string | null;
  beta: boolean;
  gpu: string | null;
  driver: string | null;
  /** The sim wrote its shutdown line. */
  cleanShutdown: boolean;
  /** The sim wrote its crash line, or the log just stops. */
  crashed: boolean;
  /** Consecutive error lines around the crash marker, or the last lines when it just stopped. */
  context: string[];
  issues: LogIssue[];
  lineCount: number;
}

const CRASH_MARKER = 'This application has crashed';
const SHUTDOWN_MARKER = 'x-plane has shut down';
const CONTEXT_LINES = 30;

const has =
  (...needles: string[]): LogIssuePattern['test'] =>
  (line) =>
    needles.every((needle) => line.includes(needle));
const hasLower =
  (...needles: string[]): LogIssuePattern['test'] =>
  (_line, lower) =>
    needles.every((needle) => lower.includes(needle));
const any =
  (...tests: LogIssuePattern['test'][]): LogIssuePattern['test'] =>
  (line, lower) =>
    tests.some((test) => test(line, lower));

/** Known trouble lines, most specific first; the first match names the issue. */
export const LOG_ISSUE_PATTERNS: LogIssuePattern[] = [
  {
    id: 'plugin_manager_error',
    severity: 'error',
    test: has('MACIBM_alert', 'plugin manager internal error'),
  },
  { id: 'scenery_pack_problem', severity: 'error', test: has('MACIBM_alert: 以下地景包有问题') },
  {
    id: 'aircraft_unusable',
    severity: 'error',
    test: has('MACIBM_alert: The aircraft', 'has unusable'),
  },
  { id: 'vulkan_alert', severity: 'error', test: has('MACIBM_alert: Vulkan') },
  { id: 'system_alert', severity: 'error', test: has('E/SYS: MACIBM_alert') },
  { id: 'plugin_assert', severity: 'error', test: has('E/PLG: Plugin assert:') },
  {
    id: 'plugin_error',
    severity: 'error',
    test: (line, lower) =>
      line.includes(' E/PLG:') &&
      (lower.includes('error') || lower.includes('fail') || lower.includes('crash')),
  },
  { id: 'vulkan_error', severity: 'error', test: has(' E/GFX/VK:', 'VK_ERROR') },
  {
    id: 'graphics_error',
    severity: 'error',
    test: (line, lower) =>
      line.includes(' E/GFX:') &&
      (lower.includes('error') || lower.includes('fail') || lower.includes('crash')),
  },
  { id: 'aircraft_error', severity: 'error', test: has(' E/ACF:') },
  {
    id: 'memory_heavy',
    severity: 'error',
    test: any(
      has('W/MEM: Entered heavy memory pressure state'),
      has('I/MEM: Entered heavy memory pressure state'),
      has('E/MEM:', 'Physical memory usage')
    ),
  },
  {
    id: 'plugin_support_file',
    severity: 'error',
    test: hasLower('you are missing a required plugin support file'),
  },
  {
    id: 'out_of_memory',
    severity: 'error',
    test: any(
      hasLower('out of memory'),
      hasLower('memory allocation failed'),
      hasLower('cannot allocate'),
      has('内存已满'),
      has('内存不足'),
      has('E/SYS: THREAD FATAL ASSERT', '内存')
    ),
  },
  {
    id: 'memory_status',
    severity: 'warning',
    test: (line) =>
      line.includes(' E/MEM:') &&
      (line.includes('Memory status information') ||
        line.includes('Physical memory usage') ||
        line.includes('Virtual memory usage')),
  },
  {
    id: 'access_violation',
    severity: 'error',
    test: any(hasLower('access violation'), hasLower('segmentation fault'), hasLower('sigsegv')),
  },
  { id: 'dsf_error', severity: 'error', test: has(' E/DSF:') },
  { id: 'scenery_error', severity: 'error', test: has(' E/SCN:') },
  { id: 'network_error', severity: 'warning', test: has(' E/NET:') },
  { id: 'weather_error', severity: 'warning', test: has(' E/WXR:') },
  {
    id: 'sound_error',
    severity: 'warning',
    test: (line, lower) =>
      line.includes(' E/FMOD:') || (line.includes('FMOD') && lower.includes('error')),
  },
  {
    id: 'memory_negative',
    severity: 'warning',
    test: has('I/MEM: Entered negative memory pressure state'),
  },
  {
    id: 'textures_degraded',
    severity: 'warning',
    test: has('I/TEX: Target scale moved to 0.0625'),
  },
  { id: 'runloop_backed_up', severity: 'warning', test: has('W/RLP: Runloop is backed up') },
  {
    id: 'nvapi',
    severity: 'warning',
    test: any(has(' E/NVAPI:'), has('NVAPI_INVALID_USER_PRIVILEGE')),
  },
  {
    id: 'injector_disabled',
    severity: 'warning',
    test: (line) =>
      line.includes('I/GFX/VK: Disabled') && (line.includes('ReShade') || line.includes('GamePP')),
  },
  {
    id: 'plugin_twice',
    severity: 'warning',
    test: hasLower('a version of this plugin is already loaded'),
  },
  {
    id: 'tls_failed',
    severity: 'warning',
    test: (line, lower) =>
      line.includes('SSL/TLS connection failed') ||
      (lower.includes('schannel') && lower.includes('failed')),
  },
  {
    id: 'memory_regular',
    severity: 'info',
    test: has('I/MEM: Entered regular memory pressure state'),
  },
  { id: 'dataref_replaced', severity: 'info', test: has("Dataref '", 'has been replaced') },
  { id: 'betterpushback_warn', severity: 'info', test: has('BetterPushback', 'WARN:') },
  { id: 'art_controls', severity: 'info', test: has('(Art controls are modified.)') },
];

function isErrorLine(line: string): boolean {
  return line.includes(' E/');
}

/** The run of consecutive error lines around `index`, capped. */
function errorRunAround(lines: string[], index: number): string[] {
  let start = index;
  while (start > 0 && isErrorLine(lines[start - 1]!)) start--;
  let end = index;
  while (end + 1 < lines.length && isErrorLine(lines[end + 1]!)) end++;
  end = Math.min(end, start + CONTEXT_LINES - 1);
  return lines.slice(start, end + 1);
}

function afterLabel(line: string, label: string): string | null {
  const at = line.indexOf(label);
  if (at === -1) return null;
  const rest = line.slice(at + label.length).trim();
  return rest.replace(/^:\s*/, '') || null;
}

export function analyzeLog(text: string): LogAnalysis {
  const lines = text.split(/\r?\n/);
  const analysis: LogAnalysis = {
    isXPlaneLog: false,
    version: null,
    beta: false,
    gpu: null,
    driver: null,
    cleanShutdown: false,
    crashed: false,
    context: [],
    issues: [],
    lineCount: lines.length,
  };

  const counts = new Map<string, LogIssue>();
  let crashAt = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (i < 40) {
      const header = afterLabel(line, 'Log.txt for X-Plane ');
      if (header && !analysis.version) {
        analysis.isXPlaneLog = true;
        analysis.version = header.split(/\s+/)[0] ?? null;
        analysis.beta = /beta|rc|r\d/i.test(line) && !/-r\d+-[0-9a-f]{8}\b/.test(line);
      }
      if (!analysis.version && /^log\.txt for x-plane/i.test(line.trim()))
        analysis.isXPlaneLog = true;
      const vulkan = afterLabel(line, 'Vulkan Driver');
      if (vulkan) analysis.driver = vulkan;
      const opengl = afterLabel(line, 'OpenGL Version');
      if (opengl && !analysis.driver) analysis.driver = opengl;
      const gpu = afterLabel(line, 'Vulkan Device') ?? afterLabel(line, 'OpenGL Render');
      if (gpu && !analysis.gpu) analysis.gpu = gpu;
    }
    if (line.includes(CRASH_MARKER) && crashAt === -1) crashAt = i;
    if (line.toLowerCase().includes(SHUTDOWN_MARKER)) analysis.cleanShutdown = true;

    const lower = line.toLowerCase();
    for (const pattern of LOG_ISSUE_PATTERNS) {
      if (!pattern.test(line, lower)) continue;
      const seen = counts.get(pattern.id);
      if (seen) seen.count++;
      else {
        counts.set(pattern.id, {
          id: pattern.id,
          severity: pattern.severity,
          lineNo: i + 1,
          line: line.trim(),
          count: 1,
        });
      }
      break;
    }
  }

  analysis.issues = [...counts.values()];
  if (crashAt !== -1) {
    analysis.crashed = true;
    analysis.context = errorRunAround(lines, crashAt);
  } else if (analysis.isXPlaneLog && !analysis.cleanShutdown) {
    // No shutdown line: the sim stopped without saying so, or it is still running.
    analysis.crashed = true;
    const nonEmpty = lines.filter((line) => line.trim().length > 0);
    analysis.context = nonEmpty.slice(-CONTEXT_LINES);
  }
  return analysis;
}

/** Replace the X-Plane folder and the home folder in free text, for a report that can be shared. */
export function scrubPaths(
  text: string,
  xplanePath: string | null,
  homePath: string | null
): string {
  let out = text;
  for (const [needle, label] of [
    [xplanePath, '<X-Plane>'],
    [homePath, '<home>'],
  ] as const) {
    if (!needle) continue;
    const forms = new Set([needle, needle.replace(/\\/g, '/'), needle.replace(/\//g, '\\')]);
    for (const form of forms) {
      if (form.length < 3) continue;
      out = out.split(form).join(label);
    }
  }
  return out;
}
