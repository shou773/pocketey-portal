// Bounded diagnostic experiment. No gameplay, clock, input, renderer-size, or
// native-test changes. Run only in its dedicated GitHub Actions branch.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { appendFile, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASELINE_SHA = 'aed68c9933c281a62401535fb5822156cdb335d6';
const root = process.cwd();
const baselineRoot = path.resolve(process.env.TILT_BASELINE_DIR || '');
const output = path.resolve(root, 'test-results/tilt-front-side-comparison');
const rendererPath = 'src/games/prototypes/ball/render.ts';
const configPath = 'tests/prototypes/ball/playwright.config.ts';
const specPath = 'tests/prototypes/ball/browser.spec.ts';
const nativeArgs = ['test', '--config', configPath, '--grep', 'desktop keyboard'];
const pairs = [['baseline', 'candidate'], ['candidate', 'baseline'], ['baseline', 'candidate']];
const variantRoots = { baseline: baselineRoot, candidate: root };
const viewports = [
  { name: 'desktop', width: 1280, height: 800, hasTouch: false, isMobile: false },
  { name: 'mobile', width: 390, height: 844, hasTouch: true, isMobile: true },
];
// These are rendered model states, not native gameplay or completion evidence.
// Each starts with a fresh createView, so ball rotation has the same history.
const sceneSpecs = [
  { name: 'stage3-start', z: 0, position: 'center', phase: 'playing', y: 'radius', speed: 0, vx: 0, vy: 0, time: 0, fallTime: 0 },
  { name: 'stage3-bend-edge', z: 36, position: 'inside-right-edge', phase: 'playing', y: 'radius', speed: 2.15, vx: 0, vy: 0, time: 16, fallTime: 0 },
  { name: 'stage3-falling', z: 36, position: 'outside-right-edge', phase: 'falling', y: -0.9, speed: 2.15, vx: 1.5, vy: -6, time: 16, fallTime: 0.3 },
  { name: 'stage3-late', z: 116, position: 'center', phase: 'playing', y: 'radius', speed: 5.8, vx: 0, vy: 0, time: 45, fallTime: 0 },
];
const decisionCriteria = {
  automaticPromotion: false,
  candidateNativePassesRequired: 3,
  requireEqualFramebufferAndViewport: true,
  requireUnchangedModelAppNativeTestsAndOtherSources: true,
  positivePairedFpsGainsRequired: 2,
  medianPairedFpsGainPercentRequired: 5,
  requireHumanInspectionAndPixelComparisonWithoutMeaningfulVisualChange: true,
  meaning: 'Conditions to consider full validation, not replacements for native gates or proof of causality.',
};

const now = () => new Date().toISOString();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const json = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
const exists = async file => { try { await stat(file); return true; } catch { return false; } };
const errorText = error => error?.stack || String(error);
async function readJSON(file) {
  try { return { value: JSON.parse(await readFile(file, 'utf8')), error: null }; }
  catch (error) { return { value: null, error: errorText(error) }; }
}

// Every process keeps its log and exit status. Nonzero results never throw away
// an earlier sample, trigger retries, or prevent later planned samples.
async function run(command, args, cwd, logFile, extraEnv = {}) {
  const startedAt = now();
  const log = createWriteStream(logFile);
  return await new Promise(resolve => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
    let spawnError = null;
    child.stdout.on('data', chunk => { log.write(chunk); process.stdout.write(chunk); });
    child.stderr.on('data', chunk => { log.write(chunk); process.stderr.write(chunk); });
    child.on('error', error => { spawnError = errorText(error); log.write(spawnError); });
    child.on('close', (returnCode, signal) => {
      log.end(() => resolve({ command, args, cwd, startedAt, endedAt: now(), returnCode, signal, spawnError }));
    });
  });
}

async function portOpen(port) {
  return await new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let done = false;
    const finish = value => { if (!done) { done = true; socket.destroy(); resolve(value); } };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(true)); // Conservatively treat uncertainty as occupied.
  });
}

async function waitClosed(port, milliseconds = 20000) {
  const deadline = Date.now() + milliseconds;
  do { if (!await portOpen(port)) return true; await delay(250); } while (Date.now() < deadline);
  return false;
}

async function fingerprints() {
  const changedPaths = git('diff', '--name-only', BASELINE_SHA, 'HEAD').split('\n').filter(Boolean);
  const allowed = new Set([rendererPath, 'scripts/tilt-front-side-comparison.mjs', '.github/workflows/tilt-front-side-comparison.yml']);
  if (changedPaths.some(file => !allowed.has(file))) throw new Error(`Unexpected candidate changes: ${changedPaths.join(', ')}`);
  if (!changedPaths.includes(rendererPath)) throw new Error('The expected renderer candidate is missing.');
  const baselineRender = await readFile(path.join(baselineRoot, rendererPath), 'utf8');
  const candidateRender = await readFile(path.join(root, rendererPath), 'utf8');
  const oldLine = '  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.46, metalness: 0, side: THREE.DoubleSide });';
  const newLine = oldLine.replace('THREE.DoubleSide', 'THREE.FrontSide');
  if (baselineRender.split(oldLine).length !== 2 || candidateRender !== baselineRender.replace(oldLine, newLine)) {
    throw new Error('Renderer must differ by exactly the predeclared road-material side token.');
  }
  const selected = git('ls-tree', '-r', '--name-only', BASELINE_SHA, '--',
    'src/games/prototypes/ball', 'src/games/audio', 'src/games/audio.ts', 'src/lib',
    'src/pages/games/tilttrail.astro', 'public/games/tilttrail', 'tests/prototypes/ball',
    'package.json', 'package-lock.json', 'astro.config.mjs', '.github/workflows/games-quality.yml').split('\n').filter(Boolean);
  const files = [];
  for (const file of selected) {
    const baseline = sha256(await readFile(path.join(baselineRoot, file)));
    const candidate = sha256(await readFile(path.join(root, file)));
    files.push({ file, baseline, candidate, equal: baseline === candidate, expectedDifference: file === rendererPath });
  }
  const unchanged = files.filter(file => file.file !== rendererPath);
  if (unchanged.some(file => !file.equal)) throw new Error('A protected model/app/test/asset fingerprint changed.');
  return {
    algorithm: 'SHA-256', changedPaths, files,
    unchangedSourceDigest: sha256(unchanged.map(file => `${file.file}\0${file.baseline}\n`).join('')),
    exactOneTokenRendererChange: true,
    modelAppAndNativeTestIdentical: ['src/games/prototypes/ball/model.ts', 'src/games/prototypes/ball/app.ts', specPath, configPath]
      .every(file => files.some(entry => entry.file === file && entry.equal)),
  };
}

async function nativeSample(variant, pair, order, sequence, build) {
  const cwd = variantRoots[variant];
  const directory = path.join(output, 'native', `${String(sequence).padStart(2, '0')}-pair${pair}-${variant}`);
  const evidence = path.join(directory, 'evidence');
  await mkdir(evidence, { recursive: true });
  const result = { variant, pair, order, sequence, sourceRoot: cwd, evidence, attempted: false, process: null, errors: [] };
  try {
    if (build.returnCode !== 0) throw new Error('This variant did not build; native test cannot use a valid dist.');
    // Never let reuseExistingServer:true serve another variant's dist.
    result.portClosedBeforeRun = await waitClosed(4335);
    if (!result.portClosedBeforeRun) throw new Error('Port 4335 is occupied. Block this slot rather than reuse or kill an unrelated server.');
    // Playwright reporter versions resolve explicit outputFile against either
    // the config directory or cwd. Clear/read both without changing the test.
    const reportPaths = [path.join(cwd, 'tests/prototypes/ball/test-results/ball/report.json'),
      path.join(cwd, 'test-results/ball/report.json')];
    for (const reportPath of reportPaths) await rm(reportPath, { force: true });
    result.attempted = true;
    result.process = await run(process.execPath, [path.join(root, 'node_modules/@playwright/test/cli.js'), ...nativeArgs], cwd,
      path.join(directory, 'native.log'), { NEW_GAME_EVIDENCE: evidence });
    result.portClosedAfterRun = await waitClosed(4335);
    if (!result.portClosedAfterRun) result.errors.push('Playwright did not release port 4335; later slots must remain blocked while it is occupied.');
    for (const reportPath of reportPaths) if (await exists(reportPath)) {
      result.reportSourcePath = reportPath;
      await cp(reportPath, path.join(directory, 'report.json'));
      break;
    }
    // outputDir is resolved relative to the native config. Preserve its files.
    const nativeOutput = path.join(cwd, 'tests/prototypes/ball/test-results/ball/run');
    if (await exists(nativeOutput)) await cp(nativeOutput, path.join(directory, 'playwright-output'), { recursive: true });
  } catch (error) { result.errors.push(errorText(error)); }
  const performance = await readJSON(path.join(evidence, 'desktop-performance.json'));
  const completion = await readJSON(path.join(evidence, 'desktop-functional-completion.json'));
  const report = await readJSON(path.join(directory, 'report.json'));
  result.performance = performance.value;
  result.functionalCompletion = completion.value;
  result.reportStats = report.value?.stats || null;
  result.dataErrors = { performance: performance.error, functionalCompletion: completion.error, report: report.error };
  result.stageEnds = [];
  for (let stage = 1; stage <= 3; stage++) {
    const entry = await readJSON(path.join(evidence, `keyboard-stage${stage}.json`));
    result.stageEnds.push({ stage, end: entry.value?.end || null, error: entry.error });
  }
  result.threeStageClears = result.stageEnds.every(entry => entry.end?.phase === 'clear');
  result.functionalComplete = result.threeStageClears && completion.value?.threeNativeClears === true &&
    Array.isArray(completion.value.errors) && completion.value.errors.length === 0;
  const metric = result.performance;
  result.completeData = Boolean(metric && Number.isFinite(metric.fps) && Number.isFinite(metric.p95) &&
    Array.isArray(metric.intervals) && metric.intervals.length === 180 && Array.isArray(metric.framebuffer) &&
    Array.isArray(metric.viewport) && completion.value && report.value && result.stageEnds.every(entry => entry.end));
  result.nativePass = result.process?.returnCode === 0 && result.functionalComplete && result.completeData && result.errors.length === 0;
  await json(path.join(directory, 'sample.json'), result);
  return result;
}

async function startDevServer(variant, port) {
  if (await portOpen(port)) throw new Error(`Diagnostic port ${port} is already occupied; refusing to reuse it.`);
  const log = createWriteStream(path.join(output, `dev-${variant}.log`));
  const args = ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)];
  const child = spawn('npm', args, { cwd: variantRoots[variant], env: process.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  let spawnError = null;
  child.on('error', error => { spawnError = errorText(error); log.write(spawnError); });
  child.once('close', () => log.end());
  const server = { child, variant, sourceRoot: variantRoots[variant], port, origin: `http://127.0.0.1:${port}`, command: ['npm', ...args], ready: false };
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && child.exitCode === null && !spawnError) {
    try {
      const response = await fetch(`${server.origin}/games/tilttrail/`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) { server.ready = true; return server; }
    } catch { /* Readiness polling is not a benchmark or a test retry. */ }
    await delay(300);
  }
  server.error = spawnError || `Dev server failed to become ready; exit ${child.exitCode}.`;
  return server;
}

async function stopDevServer(server) {
  // Only signal the process group explicitly created above, never an unrelated port owner.
  if (!server?.child?.pid) return;
  try { process.kill(-server.child.pid, 'SIGTERM'); } catch { return; }
  await delay(300);
  try { process.kill(-server.child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
}

async function diagnosticViewport(browser, server, viewport) {
  const directory = path.join(output, 'screenshots', server.variant, viewport.name);
  await mkdir(directory, { recursive: true });
  const result = { variant: server.variant, sourceRoot: server.sourceRoot, sourceHead: server.variant === 'baseline' ? BASELINE_SHA : git('rev-parse', 'HEAD'),
    port: server.port, origin: server.origin, viewport, diagnosticOnly: true, gameplayProof: false, scenes: [], errors: [] };
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1, hasTouch: viewport.hasTouch, isMobile: viewport.isMobile, locale: 'ja-JP' });
  try {
    if (!server.ready) throw new Error(server.error || 'Dev server unavailable.');
    // Measure the real game page first. Closing it stops the app's RAF/audio.
    const game = await context.newPage();
    game.setDefaultTimeout(45000);
    game.on('pageerror', error => result.errors.push(`game page: ${error.message}`));
    await game.goto(`${server.origin}/games/tilttrail/?lang=en`);
    await game.waitForFunction(() => Number(document.querySelector('#tilttrail')?.dataset.drawCalls) > 0);
    result.actualGameCanvas = await game.locator('#tt-canvas').evaluate(canvas => {
      const rect = canvas.getBoundingClientRect();
      return { css: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, framebuffer: [canvas.width, canvas.height],
        viewport: [innerWidth, innerHeight], devicePixelRatio, finePointer: matchMedia('(hover: hover) and (pointer: fine)').matches };
    });
    await game.close();
    for (const specification of sceneSpecs) {
      const scene = { name: specification.name, specification, errors: [], console: [], assets: [] };
      const page = await context.newPage();
      page.setDefaultTimeout(45000);
      page.on('pageerror', error => scene.errors.push(`pageerror: ${error.message}`));
      page.on('console', message => { if (['error', 'warning'].includes(message.type())) scene.console.push({ type: message.type(), text: message.text() }); });
      page.on('requestfailed', request => scene.errors.push(`request: ${request.url()}: ${request.failure()?.errorText}`));
      page.on('response', response => {
        if (response.url().includes('/games/tilttrail/models/')) scene.assets.push({ url: response.url(), status: response.status() });
        if (response.status() >= 400) scene.errors.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      try {
        const fixtureURL = `${server.origin}/__tilt_front_side_diagnostic__`;
        const { width, height } = result.actualGameCanvas.css;
        // An isolated fixture uses the real source modules and their unmodified
        // camera/resize/geometry/material code. No app overlays obscure the road.
        await page.route(fixtureURL, route => route.fulfill({ contentType: 'text/html', body:
          `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0}canvas{display:block;width:${width}px;height:${height}px}</style></head><body><main id="tilttrail"><canvas id="tt-canvas"></canvas><button data-tt-input="brake" aria-pressed="false" hidden></button></main></body></html>` }));
        await page.goto(fixtureURL);
        scene.render = await page.evaluate(async specification => {
          const { createView } = await import('/src/games/prototypes/ball/render.ts');
          const { createState, track, RADIUS } = await import('/src/games/prototypes/ball/model.ts');
          const canvas = document.querySelector('#tt-canvas');
          const state = createState(2), road = track(2, specification.z);
          const x = specification.position === 'inside-right-edge' ? road.x + road.width / 2 - RADIUS * 0.5 :
            specification.position === 'outside-right-edge' ? road.x + road.width / 2 + 0.45 : road.x;
          Object.assign(state, { z: specification.z, x, phase: specification.phase,
            y: specification.y === 'radius' ? RADIUS : specification.y, speed: specification.speed, vx: specification.vx,
            vy: specification.vy, time: specification.time, fallTime: specification.fallTime });
          const view = createView(canvas);
          await view.ready;
          // Read-only observer of the draw arguments. It neither changes the
          // scene/camera nor affects any of the six native test processes.
          let observedScene = null, observedCamera = null;
          const originalRender = view.renderer.render;
          view.renderer.render = function(scene, camera) {
            observedScene = scene; observedCamera = camera;
            return originalRender.call(this, scene, camera);
          };
          // Let the native ResizeObserver settle before the deterministic draw.
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          view.draw(state);
          const meshes = [];
          observedScene.traverse(object => {
            if (!object.isMesh) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            meshes.push({ type: object.type, visible: object.visible, instanceCount: object.isInstancedMesh ? object.count : null,
              positions: object.geometry.getAttribute('position')?.count ?? 0, indices: object.geometry.index?.count ?? 0,
              position: object.position.toArray(), scale: object.scale.toArray(), rotation: object.rotation.toArray(),
              material: materials.map(material => ({ type: material.type, side: material.side, transparent: material.transparent, opacity: material.opacity,
                depthTest: material.depthTest, depthWrite: material.depthWrite, color: material.color?.getHexString() ?? null })) });
          });
          const gl = view.renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
          const rect = canvas.getBoundingClientRect();
          window.__tiltDiagnosticView = view; // Retain until the PNG is captured; dispose afterward.
          // WebGL's default preserveDrawingBuffer=false requires fresh draws
          // across screenshot compositor waits. Re-render the identical state;
          // never advance time, motion, input, geometry, or camera separately.
          const redraw = () => { view.draw(state); window.__tiltDiagnosticFrame = requestAnimationFrame(redraw); };
          window.__tiltDiagnosticFrame = requestAnimationFrame(redraw);
          return { state, road, css: { width: rect.width, height: rect.height }, framebuffer: [canvas.width, canvas.height],
            viewport: [innerWidth, innerHeight], pixelRatio: view.renderer.getPixelRatio(),
            renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            contextAttributes: gl.getContextAttributes(), drawCalls: view.renderer.info.render.calls, triangles: view.renderer.info.render.triangles,
            geometries: view.renderer.info.memory.geometries, textures: view.renderer.info.memory.textures, meshes,
            camera: { position: observedCamera.position.toArray(), quaternion: observedCamera.quaternion.toArray(),
              fov: observedCamera.fov, aspect: observedCamera.aspect, near: observedCamera.near, far: observedCamera.far,
              projectionMatrix: observedCamera.projectionMatrix.toArray(), matrixWorld: observedCamera.matrixWorld.toArray() } };
        }, specification);
        scene.png = `${specification.name}.png`;
        await page.locator('#tt-canvas').screenshot({ path: path.join(directory, scene.png), animations: 'allow' });
        scene.pngSha256 = sha256(await readFile(path.join(directory, scene.png)));
        scene.matchesActualGameFramebuffer = JSON.stringify(scene.render.framebuffer) === JSON.stringify(result.actualGameCanvas.framebuffer);
        scene.matchesActualGameCanvasCSS = scene.render.css.width === width && scene.render.css.height === height;
        scene.modelAssetsLoaded = ['wind-rock.glb', 'observatory.glb'].every(name => scene.assets.some(asset => asset.url.endsWith(name) && asset.status === 200));
      } catch (error) { scene.errors.push(errorText(error)); }
      finally {
        await page.evaluate(() => { cancelAnimationFrame(window.__tiltDiagnosticFrame); window.__tiltDiagnosticView?.dispose(); }).catch(() => {});
        await page.close();
      }
      result.scenes.push(scene);
      await json(path.join(directory, `${specification.name}.json`), scene);
    }
  } catch (error) { result.errors.push(errorText(error)); }
  finally { await context.close(); }
  await json(path.join(directory, 'capture.json'), result);
  return result;
}

function distribution(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return { count: sorted.length, values, min: sorted[0] ?? null, max: sorted.at(-1) ?? null,
    median: sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2 : null };
}

function summarize(samples, captures, builds, integrity) {
  const statistics = Object.fromEntries(['baseline', 'candidate'].map(variant => {
    const selected = samples.filter(sample => sample.variant === variant);
    return [variant, { fps: distribution(selected.map(sample => sample.performance?.fps ?? null)),
      p95: distribution(selected.map(sample => sample.performance?.p95 ?? null)), nativePasses: selected.filter(sample => sample.nativePass).length,
      functionalCompletions: selected.filter(sample => sample.functionalComplete).length,
      nativeThresholds: { fpsAtLeast: 45, p95AtMostMs: 40 } }];
  }));
  const paired = pairs.map((order, index) => {
    const baseline = samples.find(sample => sample.pair === index + 1 && sample.variant === 'baseline');
    const candidate = samples.find(sample => sample.pair === index + 1 && sample.variant === 'candidate');
    const before = baseline?.performance?.fps, after = candidate?.performance?.fps;
    return { pair: index + 1, order, baselineSequence: baseline?.sequence, candidateSequence: candidate?.sequence,
      baselineFps: before ?? null, candidateFps: after ?? null,
      deltaFps: Number.isFinite(before) && Number.isFinite(after) ? after - before : null,
      gainPercent: Number.isFinite(before) && before > 0 && Number.isFinite(after) ? (after / before - 1) * 100 : null };
  });
  const allNativeDimensionsMatch = samples.length === 6 && samples.every(sample =>
    JSON.stringify(sample.performance?.framebuffer) === JSON.stringify([633, 321]) &&
    JSON.stringify(sample.performance?.viewport) === JSON.stringify([1280, 800]));
  const visualComparisons = [];
  for (const viewport of viewports) for (const spec of sceneSpecs) {
    const base = captures.find(capture => capture.variant === 'baseline' && capture.viewport.name === viewport.name);
    const candidate = captures.find(capture => capture.variant === 'candidate' && capture.viewport.name === viewport.name);
    const before = base?.scenes.find(scene => scene.name === spec.name), after = candidate?.scenes.find(scene => scene.name === spec.name);
    const equal = field => Boolean(before?.render && after?.render) && JSON.stringify(before.render[field]) === JSON.stringify(after.render[field]);
    visualComparisons.push({ viewport: viewport.name, scene: spec.name, pngBytesIdentical: Boolean(before?.pngSha256 && before.pngSha256 === after?.pngSha256),
      equalState: equal('state'), equalCamera: equal('camera'), equalFramebuffer: equal('framebuffer'), equalViewport: equal('viewport'), equalCanvasCSS: equal('css'),
      baselinePngSha256: before?.pngSha256 ?? null, candidatePngSha256: after?.pngSha256 ?? null,
      pixelComparisonAndHumanReview: 'pending; PNG hash equality is recorded but is not a visual-acceptance decision' });
  }
  const screenshotDataComplete = captures.length === 4 && captures.every(capture => capture.errors.length === 0 && capture.scenes.length === 4 &&
    capture.scenes.every(scene => scene.errors.length === 0 && scene.pngSha256 && scene.modelAssetsLoaded && scene.matchesActualGameFramebuffer && scene.matchesActualGameCanvasCSS));
  const visualInvariantsMatch = visualComparisons.every(entry => entry.equalState && entry.equalCamera && entry.equalFramebuffer && entry.equalViewport && entry.equalCanvasCSS);
  const pairedGains = distribution(paired.map(pair => pair.gainPercent));
  const failures = [];
  if (Object.values(builds).some(build => build.returnCode !== 0)) failures.push('One or both builds failed.');
  if (samples.length !== 6 || samples.some(sample => !sample.completeData || sample.errors.length)) failures.push('Native data is missing or a native slot was blocked. No sample was discarded or retried.');
  if (statistics.candidate.nativePasses !== 3) failures.push('One or more candidate native tests failed.');
  if (!allNativeDimensionsMatch) failures.push('Native framebuffer/viewport invariants failed or data is missing.');
  if (!screenshotDataComplete || !visualInvariantsMatch) failures.push('Diagnostic screenshot data or state/camera/dimension invariants failed.');
  return { generatedAt: now(), statistics, paired, pairedGains, allNativeDimensionsMatch, screenshotDataComplete, visualInvariantsMatch,
    visualComparisons, decisionCriteria, preliminaryPerformanceConditionsMet: statistics.candidate.nativePasses === 3 && allNativeDimensionsMatch &&
      integrity.modelAppAndNativeTestIdentical && paired.filter(pair => pair.gainPercent > 0).length >= 2 && pairedGains.count === 3 && pairedGains.median >= 5,
    visualReview: 'pending external PNG pixel comparison and human inspection', automaticPromotion: false,
    interpretation: 'Only three paired samples on one shared runner. Gains, if present, do not alone establish causality or authorize promotion/full validation.',
    baselineNativeFailuresRetained: samples.filter(sample => sample.variant === 'baseline' && !sample.nativePass).map(sample => sample.sequence),
    failures, jobPass: failures.length === 0 };
}

async function main() {
  await mkdir(output, { recursive: true });
  if (await exists(path.join(output, 'plan.json'))) throw new Error('This output already contains an experiment plan; refusing an unplanned repeat.');
  if (!process.env.CI || !process.env.GITHUB_ACTIONS) throw new Error('Run this bounded experiment only in GitHub Actions, not as a local benchmark.');
  if (process.env.GITHUB_REF !== 'refs/heads/codex/tilt-front-side-comparison') throw new Error('Wrong diagnostic branch.');
  if (process.env.TILT_BASELINE_SHA !== BASELINE_SHA || !process.env.TILT_BASELINE_DIR || baselineRoot === root) throw new Error('Invalid baseline source root or SHA.');
  const candidateHead = git('rev-parse', 'HEAD');
  if (candidateHead !== process.env.GITHUB_SHA) throw new Error('Checked-out candidate does not match the triggering SHA.');
  const plan = { createdAt: now(), baselineHead: BASELINE_SHA, candidateHead, sourceRoots: variantRoots, nativeArgs, pairs,
    plannedSamples: pairs.flatMap((order, index) => order.map((variant, slot) => ({ sequence: index * 2 + slot + 1, pair: index + 1, order: slot + 1, variant }))),
    nativeRunsPerVariant: 3, retries: 0, nativeConfigUnmodified: true, nativeDesktopFramebuffer: [633, 321],
    nativeDesktopViewport: [1280, 800], decisionCriteria, sceneSpecs, viewports,
    scope: 'Six existing desktop keyboard all-three-stage tests. No full suite, mobile gameplay benchmark, clock mocking, or threshold/input changes.',
    screenshots: 'After all native slots: real createView diagnostic states, actual game canvas dimensions, no gameplay proof or promotion.',
    runner: { node: process.version, platform: process.platform, release: os.release(), arch: process.arch, cpu: os.cpus()[0]?.model,
      logicalCPUs: os.cpus().length, memoryBytes: os.totalmem(), githubRunId: process.env.GITHUB_RUN_ID, githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT },
  };
  await json(path.join(output, 'plan.json'), plan);
  const integrity = await fingerprints();
  await json(path.join(output, 'fingerprints.json'), integrity);
  if (!integrity.modelAppAndNativeTestIdentical) throw new Error('Required source fingerprints are missing.');
  const builds = {};
  for (const variant of ['baseline', 'candidate']) {
    builds[variant] = await run('npm', ['run', 'build'], variantRoots[variant], path.join(output, `build-${variant}.log`));
    await json(path.join(output, 'builds.json'), builds);
  }
  const samples = [];
  for (const slot of plan.plannedSamples) {
    console.log(`\nNative slot ${slot.sequence}/6: pair ${slot.pair}, ${slot.variant}`);
    samples.push(await nativeSample(slot.variant, slot.pair, slot.order, slot.sequence, builds[slot.variant]));
    await json(path.join(output, 'native-samples.json'), samples);
  }
  // No diagnostic servers or extra browser sessions run during native sampling.
  const captures = [], servers = [];
  let browser;
  const screenshotErrors = [];
  try {
    for (const [variant, port] of [['baseline', 4382], ['candidate', 4383]]) {
      try { servers.push(await startDevServer(variant, port)); }
      catch (error) { screenshotErrors.push(`${variant}: ${errorText(error)}`); }
    }
    await json(path.join(output, 'diagnostic-servers.json'), servers.map(({ child, ...server }) => ({ ...server, pid: child.pid })));
    browser = await chromium.launch({ headless: true,
      executablePath: process.env.CI ? undefined : '/usr/bin/chromium',
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    for (const viewport of viewports) for (const server of servers) {
      try { captures.push(await diagnosticViewport(browser, server, viewport)); }
      catch (error) { screenshotErrors.push(`${server.variant}/${viewport.name}: ${errorText(error)}`); }
      await json(path.join(output, 'diagnostic-captures.json'), captures);
    }
  } catch (error) { screenshotErrors.push(errorText(error)); }
  finally {
    await browser?.close();
    for (const server of servers) await stopDevServer(server);
    await json(path.join(output, 'diagnostic-errors.json'), screenshotErrors);
  }
  const summary = summarize(samples, captures, builds, integrity);
  if (screenshotErrors.length) { summary.failures.push(...screenshotErrors); summary.jobPass = false; }
  // Verify the source bytes after all activity as well as before it.
  try {
    const after = await fingerprints();
    await json(path.join(output, 'fingerprints-after.json'), after);
    summary.sourceBytesUnchangedThroughout = JSON.stringify(after) === JSON.stringify(integrity);
    if (!summary.sourceBytesUnchangedThroughout) { summary.failures.push('Source fingerprints changed during the experiment.'); summary.jobPass = false; }
  } catch (error) { summary.failures.push(errorText(error)); summary.jobPass = false; }
  await json(path.join(output, 'summary.json'), summary);
  const pretty = value => Number.isFinite(value) ? value.toFixed(3) : 'missing';
  const lines = ['# Tilt FrontSide diagnostic comparison', '', `Baseline: ${BASELINE_SHA}`, `Candidate: ${candidateHead}`, '',
    'Predeclared order: baseline/candidate; candidate/baseline; baseline/candidate. No retries or discarded runs.',
    'Native gates remain 45 FPS minimum and 40 ms p95 maximum.', ''];
  for (const sample of samples) lines.push(`- ${sample.sequence}. Pair ${sample.pair} ${sample.variant}: exit ${sample.process?.returnCode ?? 'blocked'}; FPS ${pretty(sample.performance?.fps)}; p95 ${pretty(sample.performance?.p95)} ms; functional completion ${sample.functionalComplete}; native pass ${sample.nativePass}.`);
  lines.push('');
  for (const [variant, stats] of Object.entries(summary.statistics)) lines.push(`- ${variant}: FPS median ${pretty(stats.fps.median)}, range ${pretty(stats.fps.min)}–${pretty(stats.fps.max)}; p95 median ${pretty(stats.p95.median)} ms, range ${pretty(stats.p95.min)}–${pretty(stats.p95.max)}; native passes ${stats.nativePasses}/3.`);
  lines.push('', ...summary.paired.map(pair => `- Pair ${pair.pair}: FPS difference ${pretty(pair.deltaFps)}; gain ${pretty(pair.gainPercent)}%.`), '',
    `Paired FPS gain median: ${pretty(summary.pairedGains.median)}%.`,
    `Framebuffer/viewport checks: ${summary.allNativeDimensionsMatch}. Screenshot completeness: ${summary.screenshotDataComplete}.`,
    `Preliminary performance conditions: ${summary.preliminaryPerformanceConditionsMet}. Visual review: pending.`,
    'The captured scenes are deterministic renderer diagnostics, not gameplay-completion proof.',
    'No automatic promotion. At least 2/3 positive paired gains, median gain ≥5%, all three candidate native passes, matching invariants and no meaningful visual change are required before considering full validation.',
    'Three pairs on one runner cannot establish causality by themselves.', '',
    ...(summary.failures.length ? ['## Failures', ...summary.failures.map(failure => `- ${failure}`)] : ['All experiment completeness checks passed. This is not full-suite validation.']), '');
  const markdown = lines.join('\n');
  await writeFile(path.join(output, 'SUMMARY.md'), markdown);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log(markdown);
  process.exitCode = summary.jobPass ? 0 : 1;
}

main().catch(async error => {
  console.error(error);
  await mkdir(output, { recursive: true });
  await json(path.join(output, 'infrastructure-error.json'), { at: now(), error: errorText(error),
    note: 'A prerequisite/integrity failure prevented completing the planned experiment. No performance conclusion is valid.' });
  process.exitCode = 1;
});
