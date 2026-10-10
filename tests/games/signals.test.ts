import test from 'node:test';
import { signalHazardTarget } from './signal-policy';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createState, stages, step } from '../../src/games/model';
import { SIGNALS, SIGNAL_RADIUS, SIGNAL_COURSE_IDS, createSignalRun, collectSignals, signalCount, recordSignalClear, parseSignalProgress, serializeSignalProgress } from '../../src/games/signals';

test('all original Orbit and Amber course data remains unchanged', () => {
  assert.equal(createHash('sha256').update(JSON.stringify({orbit:stages.orbit,amber:stages.amber.slice(0,3)})).digest('hex'), 'ef69e447ad37527d07305e5934a983233fc8075206ea64f10d6fc2165c358552');
});

test('nine optional signals sit on real platforms outside hazard footprints and inside visible edges', () => {
  assert.equal(SIGNALS.length, stages.orbit.length); assert.equal(new Set(SIGNAL_COURSE_IDS).size, SIGNALS.length);
  for (const [i, signals] of SIGNALS.entries()) for (const signal of signals) {
    const tile = stages.orbit[i].platforms.find(p => signal.x > p.a + 3 && signal.x < p.b - 3);
    assert.ok(tile); assert.ok(Math.abs(signal.z - tile.z) + .34 < tile.w / 2);
    assert.ok(Math.abs(Math.abs(signal.z) - 1.85) > SIGNAL_RADIUS, 'safe normal line does not automatically collect');
    for (const h of stages.orbit[i].hazards) assert.ok(Math.abs(signal.x - h.x) > h.d / 2 + .34 || Math.abs(signal.z - h.z) > h.w / 2 + .34);
  }
});
for (const interval of [.025, .05, .075]) for (const collect of [false, true]) for (const index of [0, 1, 2]) test(`course${index+1}: completed ${collect?'3/3':'0/3'} route at ${interval}s observations`, () => {
  const s = createState('orbit', index), run = createSignalRun(index), level = stages.orbit[index];
  let input = { axis: 0, jump: false }, next = 0, lastJump = -10;
  for (let tick = 0; tick < 10000 && s.status === 'running'; tick++) {
    if (s.time >= next) {
      const tile = level.platforms.find(p => s.x >= p.a - .23 && s.x <= p.b + .23);
      const gap = !!tile && tile.b < level.length && tile.b - s.x < 1.1 && tile.b - s.x > -.15;
      const h = level.hazards.find(h => h.x + h.d / 2 + .3 > s.x);
      let target = signalHazardTarget(h, s.x, s.z);
      const signal = SIGNALS[index].find(p => p.x + .65 > s.x);
      if (collect && signal && signal.x - s.x < 8) target = signal.z;
      const jump = gap && s.grounded && s.time - lastJump > .3; if (jump) lastJump = s.time;
      input = { axis: Math.abs(target - s.z) < .12 ? 0 : Math.sign(target - s.z), jump }; next = s.time + interval;
    }
    step(s, input); input.jump = false; collectSignals(run, s);
  }
  assert.equal(s.status, 'clear'); assert.equal(signalCount(run), collect ? 3 : 0);
  assert.ok(Math.abs(s.time - level.length / 7) < .012, 'optional route does not alter fixed-speed clear time');
});
test('collection is one-shot and never awards on failure, wrong game, wrong stage or above the signal', () => {
  const s = createState('orbit', 0), run = createSignalRun(0), progress = parseSignalProgress(null);
  Object.assign(s, SIGNALS[0][0]); assert.equal(collectSignals(run, s), 1); assert.equal(collectSignals(run, s), 0);
  s.status = 'dead'; assert.equal(recordSignalClear(progress, run, s), false); assert.deepEqual(progress.best, [null,null,null]);
  const empty = createSignalRun(0); assert.equal(collectSignals(empty, s), 0);
  s.status = 'running'; s.kind = 'amber'; assert.equal(collectSignals(empty, s), 0);
  s.kind = 'orbit'; s.stage = 1; assert.equal(collectSignals(empty, s), 0);
  s.stage = 0; s.y = 2; assert.equal(collectSignals(empty, s), 0);
});
test('only a real clear records a best; retries and lower clears cannot reduce it', () => {
  const s = createState('orbit', 0), progress = parseSignalProgress(null), run = createSignalRun(0);
  assert.equal(recordSignalClear(progress, run, s), false); assert.equal(run.completed, false);
  run.mask = 7; s.status = 'clear'; assert.equal(recordSignalClear(progress, run, s), true); assert.equal(recordSignalClear(progress, run, s), false);
  assert.deepEqual(progress.best, [3,null,null]); const retry = createSignalRun(0); assert.equal(signalCount(retry), 0);
  recordSignalClear(progress, retry, s); assert.equal(progress.best[0], 3);
});
test('zero is a completed collection record, distinct from an unplayed objective', () => {
  const progress = parseSignalProgress(null), s = createState('orbit', 1); s.status = 'clear';
  recordSignalClear(progress, createSignalRun(1), s); assert.deepEqual(progress.best, [null,0,null]);
  assert.deepEqual(parseSignalProgress(serializeSignalProgress(progress)), progress);
});
test('stable IDs validate optional records; old timer-shaped data does not invent collections', () => {
  assert.deepEqual(parseSignalProgress('{"best":[14,17,21]}').best, [null,null,null]);
  const value = parseSignalProgress('{"version":1,"records":{"starbound-path":3,"first-orbit":0,"crossing-lights":2}}');
  assert.deepEqual(value.best, [0,2,3]); assert.deepEqual(parseSignalProgress(serializeSignalProgress(value)), value);
  for (const invalid of [-1,4,1.5,'3',null]) assert.deepEqual(parseSignalProgress(JSON.stringify({version:1,records:{'first-orbit':invalid}})).best,[null,null,null]);
  for (const raw of ['{','[]','null','{"version":1,"records":[]}']) assert.deepEqual(parseSignalProgress(raw).best,[null,null,null]);
  assert.equal(parseSignalProgress('{"version":2,"records":{"future":7}}').writable, false);
});

test('signal driver keeps either safe side of a centered pillar and preserves the default route', () => {
  const center = stages.orbit[1].hazards[0];
  assert.equal(signalHazardTarget(center, 14.7, 17 / 6), 17 / 6);
  assert.equal(signalHazardTarget(center, 14.7, -17 / 6), -17 / 6);
  assert.equal(signalHazardTarget(center, 5, 0), -1.85, 'zero-pickup start retains the original left route');
  assert.equal(signalHazardTarget(center, 4, 0), 0, 'look-ahead boundary remains twelve metres');
  assert.equal(signalHazardTarget(undefined, 14.7, 17 / 6), 0);
  for (const h of stages.orbit[1].hazards.filter(h => h.z !== 0)) {
    for (const z of [-2.9, 0, 2.9]) assert.equal(signalHazardTarget(h, h.x - 5, z), h.z > 0 ? -1.85 : 1.85);
  }
});

test('exact failed post-pickup fixture reproduces the old collision and the corrected policy stays clear of it', () => {
  // Retained 00f63f1 keyboard-all-course2 trace, immediately after signal 1.
  // Fixture state is model-only; native routes still use ordinary controls from launch.
  const fixture = () => Object.assign(createState('orbit', 1), { x: 14.7, z: 17 / 6, time: 2.1 });
  const failed = fixture();
  for (let tick = 0; tick < 33; tick++) step(failed, { axis: -1, jump: false });
  assert.equal(failed.status, 'dead');
  assert.ok(Math.abs(failed.x - 16.625) < 1e-10);
  assert.ok(Math.abs(failed.z - 35 / 24) < 1e-10);
  for (const side of [-1, 1]) for (const observeEvery of [3, 12, 18, 24]) {
    const safe = fixture(); safe.z *= side;
    const run = createSignalRun(1); run.mask = 1;
    let axis = 0;
    for (let tick = 0; tick < 48; tick++) {
      if (tick % observeEvery === 0) {
        const h = stages.orbit[1].hazards.find(h => h.x + h.d / 2 + .3 > safe.x);
        const target = signalHazardTarget(h, safe.x, safe.z);
        axis = Math.abs(target - safe.z) < .14 ? 0 : Math.sign(target - safe.z);
      }
      step(safe, { axis, jump: false }); collectSignals(run, safe);
      assert.equal(safe.status, 'running');
    }
    assert.ok(safe.x > 16.7, 'passed the full pillar collision region');
    assert.equal(signalCount(run), 1);
  }
});
