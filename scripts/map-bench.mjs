#!/usr/bin/env node
// Benchmark the map inside the running dev app over the Chrome DevTools Protocol.
//
// The dev build opens remote debugging on port 9222 and exposes the MapLibre
// instance as window.__map. Frame time is the interval between MapLibre
// `render` events, so the floor is the display refresh interval (4.2 ms on a
// 240 Hz monitor, 16.7 ms on 60 Hz). The script reports that floor so numbers
// at the floor are read as "as fast as the display allows", not as real cost.
//
// Flags:
//   --scenarios a,b,c     Subset to run (default: all interactive ones). --list shows them.
//   --terrain <mode>      as-is | on | off | both. Terrain state for interactive
//                         scenarios (default: as-is). Needs zoom > 7 for on/both.
//   --duration <ms>       Length of each camera animation (default: 3000).
//   --json <file>         Write results and scene metadata to a JSON file.
//   --compare <file>      Diff this run against a previous --json file.
//   --port <n>            Remote debugging port (default: 9222).
//
// Usage:
//   npm run bench:map -- --scenarios rotate,zoom,terrain-load --json baseline.json
//   npm run bench:map -- --compare baseline.json
//
// Zoom into an airport first so the airport layers are loaded, and keep the
// app window visible while it runs: a hidden window freezes rAF and timers.

import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};

const PORT = Number(flag('port', 9222));
const DURATION = Number(flag('duration', 3000));
const TERRAIN_MODE = flag('terrain', 'as-is');
const JSON_OUT = flag('json', null);
const COMPARE = flag('compare', null);
const LIST = argv.includes('--list');

const SCENARIOS = {
  idle: 'No camera movement. Render count should be 0; rAF/s shows stray animation loops.',
  repaint: 'Forced continuous repaint at the current camera (what an animated icon costs).',
  rotate: 'Ease bearing +90 degrees.',
  zoom: 'Ease zoom out 1.5 levels, then back.',
  pan: 'Ease the center east by 0.02 degrees, then jump back.',
  pitch60: 'Repaint, rotate and zoom at 60 degrees pitch.',
  'terrain-load':
    'Jump to Innsbruck at zoom 11 / pitch 60 with terrain on, ease to zoom 13.5, wait for idle.',
};
const INTERACTIVE = ['idle', 'repaint', 'rotate', 'zoom', 'pan', 'pitch60'];

if (LIST) {
  for (const [k, v] of Object.entries(SCENARIOS)) console.log(`${k.padEnd(14)} ${v}`);
  process.exit(0);
}

const requested = flag('scenarios', null);
const selected = requested === null ? INTERACTIVE : String(requested).split(',');
for (const s of selected) {
  if (!SCENARIOS[s]) {
    console.error(`Unknown scenario "${s}". Use --list to see the options.`);
    process.exit(1);
  }
}
if (!['as-is', 'on', 'off', 'both'].includes(TERRAIN_MODE)) {
  console.error('--terrain must be one of as-is, on, off, both');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CDP client
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findPage() {
  let targets;
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  } catch {
    console.error(`Nothing is listening on port ${PORT}. Start the app with \`npm start\` first.`);
    process.exit(1);
  }
  const page = targets.find((t) => t.type === 'page' && t.title === 'X-Dispatch');
  if (!page) {
    console.error('The app is running but no "X-Dispatch" page target was found.');
    process.exit(1);
  }
  return page;
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      p(msg);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression, { awaitPromise = true, timeoutMs = 90_000 } = {}) => {
    const res = await Promise.race([
      send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true }),
      sleep(timeoutMs).then(() => {
        throw new Error(`evaluate timed out after ${timeoutMs} ms (is the window visible?)`);
      }),
    ]);
    const { result, exceptionDetails } = res.result;
    if (exceptionDetails) {
      const text = exceptionDetails.exception?.description ?? exceptionDetails.text;
      throw new Error(`In-page error: ${text}`);
    }
    return result.value;
  };
  return { send, evaluate, close: () => ws.close() };
}

// ---------------------------------------------------------------------------
// In-page helpers, installed once as window.__mapBench
// ---------------------------------------------------------------------------

const PAGE_HELPERS = `
window.__mapBench = (() => {
  const m = window.__map;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const mapEl = m.getContainer();

  // document.visibilityState reports "hidden" in Electron whenever another
  // window overlaps, even while frames still render. Only a frozen rAF means
  // the window is really throttled, so gate on that instead.
  async function waitVisible(maxMs) {
    const t0 = performance.now();
    while (performance.now() - t0 < maxMs) {
      const ticked = await Promise.race([
        new Promise((r) => requestAnimationFrame(() => r(true))),
        sleep(1500).then(() => false),
      ]);
      if (ticked) return true;
    }
    return false;
  }

  function stats(intervals) {
    const s = [...intervals].sort((a, b) => a - b);
    const pct = (p) => (s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1) : null);
    return {
      frames: s.length,
      medianMs: pct(0.5),
      p95Ms: pct(0.95),
      maxMs: pct(1),
      over16: intervals.filter((x) => x > 16.7).length,
    };
  }

  function rtt() {
    const r = m.painter.renderToTexture;
    return { stacks: r?._stacks?.length ?? 0, terrainTiles: r?._renderableTiles?.length ?? 0 };
  }

  function scene() {
    const style = m.getStyle();
    const visible = style.layers.filter((l) => !m.getLayer(l.id).isHidden(m.getZoom()));
    return {
      canvas: [m.getCanvas().width, m.getCanvas().height],
      dpr: window.devicePixelRatio,
      zoom: +m.getZoom().toFixed(2),
      pitch: +m.getPitch().toFixed(0),
      bearing: +m.getBearing().toFixed(0),
      projection: m.getProjection()?.type,
      terrain: !!m.getTerrain(),
      layers: style.layers.length,
      visibleLayers: visible.length,
      visibleSymbolLayers: visible.filter((l) => l.type === 'symbol').length,
      sources: Object.keys(style.sources).length,
      ...rtt(),
    };
  }

  async function refreshRate() {
    let n = 0;
    let running = true;
    const tick = () => { n++; if (running) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await sleep(1000);
    running = false;
    return n;
  }

  // The renderer CSP forbids new Function / eval, so camera actions are
  // evaluated from the CDP side between begin() and end().
  let active = null;

  async function begin(label) {
    if (!(await waitVisible(60000))) return false;
    const state = { label, renderTimes: [], start: performance.now(), longTasks: 0, mutationsOutsideMap: 0, rafRequests: 0 };
    state.onRender = () => { state.renderTimes.push(performance.now()); };
    state.po = new PerformanceObserver((list) => { state.longTasks += list.getEntries().length; });
    try { state.po.observe({ type: 'longtask' }); } catch {}
    state.mo = new MutationObserver((recs) => { for (const r of recs) if (!mapEl.contains(r.target)) state.mutationsOutsideMap++; });
    state.mo.observe(document.getElementById('root'), { subtree: true, childList: true, attributes: true, characterData: true });
    state.origRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) { state.rafRequests++; return state.origRaf.call(window, cb); };
    state.idle = new Promise((r) => m.once('idle', () => r(performance.now())));
    m.on('render', state.onRender);
    active = state;
    return true;
  }

  function teardown() {
    const s = active;
    active = null;
    m.off('render', s.onRender);
    window.requestAnimationFrame = s.origRaf;
    s.po.disconnect();
    s.mo.disconnect();
    m.repaint = false;
    return s;
  }

  // Called right after the camera action is dispatched: timing starts here so
  // the CDP round trip between begin() and the action is not counted.
  function mark() {
    active.start = performance.now();
    active.renderTimes = [];
    active.rafRequests = 0;
    active.mutationsOutsideMap = 0;
    return true;
  }

  // Frame time = gap between consecutive renders inside the window. A map
  // that idles legitimately renders nothing, so gaps that start after the
  // window closes are not frame costs and are dropped.
  function intervalsWithin(s, windowMs) {
    const end = s.start + windowMs;
    const times = s.renderTimes.filter((t) => t <= end);
    const out = [];
    for (let i = 1; i < times.length; i++) out.push(times[i] - times[i - 1]);
    return { intervals: out, frames: times.length };
  }

  function end(windowMs) {
    const s = teardown();
    const seconds = windowMs / 1000;
    const { intervals, frames } = intervalsWithin(s, windowMs);
    const st = stats(intervals);
    return {
      label: s.label,
      ...st,
      frames,
      fps: +(frames / seconds).toFixed(0),
      longTasks: s.longTasks,
      mutationsOutsideMap: s.mutationsOutsideMap,
      rafPerSec: +(s.rafRequests / seconds).toFixed(0),
      ...rtt(),
    };
  }

  async function endWhenIdle(maxMs) {
    const s = active;
    const idleAt = await Promise.race([s.idle, sleep(maxMs).then(() => null)]);
    teardown();
    const { intervals, frames } = intervalsWithin(s, (idleAt ?? performance.now()) - s.start);
    return {
      label: s.label,
      timeToIdleMs: idleAt === null ? null : Math.round(idleAt - s.start),
      ...stats(intervals),
      frames,
      longTasks: s.longTasks,
      ...rtt(),
    };
  }

  return { begin, mark, end, endWhenIdle, scene, refreshRate, waitVisible };
})();
true;
`;

// ---------------------------------------------------------------------------
// Scenario definitions. Each step is measured with the current camera.
// ---------------------------------------------------------------------------

const ease = (cam) =>
  `m.easeTo({ ...${JSON.stringify(cam)}, duration: ${DURATION}, easing: (x) => x });`;

function stepsFor(name, cam) {
  const { zoom, bearing, center } = cam;
  switch (name) {
    case 'idle':
      return [{ label: 'idle', action: null }];
    case 'repaint':
      return [{ label: 'repaint', action: 'm.repaint = true;' }];
    case 'rotate':
      return [
        { label: 'rotate', action: ease({ bearing: bearing + 90 }) },
        { setup: `m.jumpTo({ bearing: ${bearing} });`, wait: 500 },
      ];
    case 'zoom':
      return [
        { label: 'zoom out', action: ease({ zoom: zoom - 1.5 }) },
        { label: 'zoom back', action: ease({ zoom }) },
      ];
    case 'pan':
      return [
        { label: 'pan', action: ease({ center: [center.lng + 0.02, center.lat] }) },
        { setup: `m.jumpTo({ center: ${JSON.stringify([center.lng, center.lat])} });`, wait: 500 },
      ];
    case 'pitch60':
      return [
        { setup: 'm.jumpTo({ pitch: 60 });', wait: 1500 },
        { label: 'pitch60 repaint', action: 'm.repaint = true;' },
        { label: 'pitch60 rotate', action: ease({ bearing: bearing + 90 }) },
        { setup: `m.jumpTo({ bearing: ${bearing} });`, wait: 500 },
        { label: 'pitch60 zoom out', action: ease({ zoom: zoom - 1.5 }) },
        { label: 'pitch60 zoom back', action: ease({ zoom }) },
        { setup: `m.jumpTo({ pitch: ${cam.pitch} });`, wait: 800 },
      ];
    default:
      throw new Error(`no steps for ${name}`);
  }
}

const TERRAIN_ON = "m.setTerrain({ source: 'terrain-dem', exaggeration: 1 });";
const TERRAIN_OFF = 'm.setTerrain(null);';

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const COLS = [
  ['label', 26, 'l'],
  ['frames', 6],
  ['fps', 4],
  ['medianMs', 8],
  ['p95Ms', 6],
  ['maxMs', 6],
  ['over16', 6],
  ['longTasks', 9],
  ['mutationsOutsideMap', 8],
  ['rafPerSec', 6],
  ['stacks', 6],
  ['terrainTiles', 5],
];
const HEADERS = {
  label: 'scenario',
  medianMs: 'median',
  p95Ms: 'p95',
  maxMs: 'max',
  over16: '>16ms',
  longTasks: 'longTask',
  mutationsOutsideMap: 'domMut',
  rafPerSec: 'rAF/s',
  terrainTiles: 'tiles',
};

const cell = (v, w, align = 'r') => {
  const s = v === null || v === undefined ? '-' : String(v);
  return align === 'l' ? s.padEnd(w) : s.padStart(w);
};
const printHeader = () =>
  console.log(COLS.map(([k, w, a]) => cell(HEADERS[k] ?? k, w, a)).join(' '));
const printRow = (row) => {
  if (row.error) return console.log(`${cell(row.label, 26, 'l')} ERROR: ${row.error}`);
  // With nothing moving, gaps between the few renders are not frame costs.
  const shown = /idle$/.test(row.label) ? { ...row, medianMs: null, p95Ms: null, maxMs: null, over16: null } : row;
  const line = COLS.map(([k, w, a]) => cell(shown[k], w, a)).join(' ');
  console.log(row.timeToIdleMs !== undefined ? `${line}  idle after ${row.timeToIdleMs ?? '>max'} ms` : line);
};

function printCompare(baseline, current) {
  const base = new Map(baseline.results.map((r) => [r.label, r]));
  const b = baseline.meta, c = current.meta;
  if (b.canvas?.join('x') !== c.canvas?.join('x') || b.dpr !== c.dpr) {
    console.log(
      `\nWARNING: canvas differs (baseline ${b.canvas?.join('x')} @${b.dpr}, now ${c.canvas?.join('x')} @${c.dpr}); frame times are not comparable.`
    );
  }
  if (b.layers !== c.layers || b.sources !== c.sources || Math.abs((b.zoom ?? 0) - (c.zoom ?? 0)) > 0.1) {
    console.log(
      `\nWARNING: scene differs (baseline ${b.layers} layers / ${b.sources} sources at zoom ${b.zoom}, now ${c.layers} / ${c.sources} at zoom ${c.zoom}); select the same airport and camera before comparing.`
    );
  }
  console.log(`\nCompared with baseline from ${b.date} (${b.commit ?? 'no commit'})`);
  console.log(`${'scenario'.padEnd(26)} ${'median'.padStart(18)} ${'p95'.padStart(18)} ${'max'.padStart(18)}`);
  const delta = (from, to) => {
    if (from == null || to == null) return cell('-', 18);
    const pct = from === 0 ? 0 : ((to - from) / from) * 100;
    const sign = pct > 0 ? '+' : '';
    return `${String(from).padStart(6)} -> ${String(to).padStart(6)} ${(sign + pct.toFixed(0) + '%').padStart(5)}`.padStart(18);
  };
  for (const row of current.results) {
    const prev = base.get(row.label);
    if (!prev) continue;
    if (/idle$/.test(row.label)) {
      console.log(`${row.label.padEnd(26)} ${delta(prev.frames, row.frames)}  (renders while idle; fewer is better)`);
      continue;
    }
    console.log(
      `${row.label.padEnd(26)} ${delta(prev.medianMs, row.medianMs)} ${delta(prev.p95Ms, row.p95Ms)} ${delta(prev.maxMs, row.maxMs)}`
    );
  }
  console.log('Negative percentages are improvements.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let commit = null;
try {
  commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {}

const page = await findPage();
const cdp = await connect(page.webSocketDebuggerUrl);
const results = [];
let cam = null;
let terrainAtStart = null;

try {
  await cdp.send('Page.bringToFront');
  await sleep(800);
  await cdp.evaluate(PAGE_HELPERS, { awaitPromise: false });

  const visible = await cdp.evaluate('__mapBench.waitVisible(30000)');
  if (!visible) throw new Error('App window stayed hidden for 30 s. Bring it to the front and retry.');

  const sceneInfo = await cdp.evaluate('__mapBench.scene()', { awaitPromise: false });
  const refreshHz = await cdp.evaluate('__mapBench.refreshRate()');
  const floorMs = +(1000 / refreshHz).toFixed(1);
  cam = await cdp.evaluate(
    'JSON.parse(JSON.stringify({ center: __map.getCenter(), zoom: __map.getZoom(), bearing: __map.getBearing(), pitch: __map.getPitch() }))',
    { awaitPromise: false }
  );
  terrainAtStart = sceneInfo.terrain;

  console.log(
    `Scene: ${sceneInfo.canvas.join('x')} @${sceneInfo.dpr}x, zoom ${sceneInfo.zoom}, pitch ${sceneInfo.pitch}, ${sceneInfo.projection}, terrain ${sceneInfo.terrain ? 'on' : 'off'}, ` +
      `${sceneInfo.visibleLayers}/${sceneInfo.layers} layers visible (${sceneInfo.visibleSymbolLayers} symbol), ${sceneInfo.sources} sources, ${sceneInfo.stacks} RTT stacks`
  );
  console.log(
    `rAF ceiling right now: ~${refreshHz}/s, so ${floorMs} ms median is the floor (display refresh, or GPU contention from other apps). Animation length ${DURATION} ms.\n`
  );

  const interactive = selected.filter((s) => INTERACTIVE.includes(s));
  const wantsTerrainToggle = TERRAIN_MODE !== 'as-is';
  if (wantsTerrainToggle && sceneInfo.zoom <= 7) {
    throw new Error('Terrain needs mercator projection: zoom in past 7 before using --terrain on/off/both.');
  }
  const modes =
    TERRAIN_MODE === 'both' ? ['on', 'off'] : TERRAIN_MODE === 'as-is' ? [null] : [TERRAIN_MODE];

  // Camera code runs via Runtime.evaluate with `m` bound to the map.
  const inPage = (src) => cdp.evaluate(`(() => { const m = window.__map; ${src} return true; })()`, { awaitPromise: false });
  const run = async (src, waitMs = 0) => {
    await inPage(src);
    if (waitMs) await sleep(waitMs);
  };
  const measure = async (label, action) => {
    const ok = await cdp.evaluate(`__mapBench.begin(${JSON.stringify(label)})`);
    if (!ok) return { label, error: 'window not visible' };
    await cdp.evaluate(`(() => { const m = window.__map; ${action ?? ''} return __mapBench.mark(); })()`, { awaitPromise: false });
    await sleep(DURATION + 300);
    return cdp.evaluate(`__mapBench.end(${DURATION})`, { awaitPromise: false });
  };

  printHeader();
  for (const mode of modes) {
    if (mode) await run(mode === 'on' ? TERRAIN_ON : TERRAIN_OFF, 1500);
    const prefix = mode ? `${mode.toUpperCase().padEnd(3)} ` : '';
    for (const name of interactive) {
      for (const step of stepsFor(name, cam)) {
        if (step.setup) {
          await run(step.setup, step.wait);
          continue;
        }
        const row = await measure(prefix + step.label, step.action);
        results.push(row);
        printRow(row);
      }
    }
  }

  if (selected.includes('terrain-load')) {
    await run(`${TERRAIN_ON} m.jumpTo({ center: [11.344, 47.26], zoom: 11, pitch: 60, bearing: 0 });`, 600);
    const ok = await cdp.evaluate(`__mapBench.begin('terrain-load Innsbruck')`);
    let row = { label: 'terrain-load Innsbruck', error: 'window not visible' };
    if (ok) {
      await cdp.evaluate(
        `(() => { const m = window.__map; m.easeTo({ zoom: 13.5, duration: ${Math.max(DURATION, 4000)}, easing: (x) => x }); return __mapBench.mark(); })()`,
        { awaitPromise: false }
      );
      row = await cdp.evaluate('__mapBench.endWhenIdle(15000)');
    }
    results.push(row);
    printRow(row);
  }

  const output = {
    meta: {
      date: new Date().toISOString(),
      commit,
      duration: DURATION,
      terrainMode: TERRAIN_MODE,
      refreshHz,
      floorMs,
      ...sceneInfo,
    },
    results,
  };

  if (JSON_OUT && JSON_OUT !== true) {
    await writeFile(JSON_OUT, JSON.stringify(output, null, 2) + '\n');
    console.log(`\nSaved ${results.length} rows to ${JSON_OUT}`);
  }
  if (COMPARE && COMPARE !== true) {
    const baseline = JSON.parse(await readFile(COMPARE, 'utf8'));
    printCompare(baseline, output);
  }
} finally {
  if (cam) {
    const restore =
      (terrainAtStart ? TERRAIN_ON : TERRAIN_OFF) +
      ` m.repaint = false; m.jumpTo(${JSON.stringify({ center: [cam.center.lng, cam.center.lat], zoom: cam.zoom, bearing: cam.bearing, pitch: cam.pitch })});`;
    await cdp
      .evaluate(`(() => { const m = window.__map; ${restore} return true; })()`, { awaitPromise: false })
      .catch(() => {});
  }
  cdp.close();
}
