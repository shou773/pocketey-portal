import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, createState, length, parseSave, RADIUS, STAGES, STEP, supported, track } from '../../../src/games/prototypes/ball/model';

test('authored trails are continuous and never have an invisible gap', () => {
  STAGES.forEach((stage, i) => {
    for (let z = 0; z < length(i); z += 0.01) {
      const a = track(i, z), b = track(i, z + 0.01);
      assert.ok(a.width >= 2.4); assert.ok(Math.abs(a.x - b.x) < 0.012);
    }
    stage.knots.forEach(k => { assert.ok(Math.abs(track(i, k.z).x - k.x) < 1e-12); assert.ok(Math.abs(track(i, k.z).width - k.width) < 1e-12); });
  });
});
test('braking reduces forward speed without stopping and counter-steering catches inertia', () => {
  const s = createState(); s.phase = 'playing';
  for (let i = 0; i < 120; i++) advance(s, { steer: 0, brake: false });
  const cruise = s.speed; assert.ok(cruise > 5.5);
  for (let i = 0; i < 120; i++) advance(s, { steer: 0, brake: true });
  assert.ok(s.speed > 2 && s.speed < 2.4);
  s.x = 0; s.z = 0;
  for (let i = 0; i < 24; i++) advance(s, { steer: 1, brake: true });
  const vx = s.vx, x = s.x;
  advance(s, { steer: 0, brake: true }); assert.ok(s.x > x); assert.ok(s.vx > 0 && s.vx < vx);
  for (let i = 0; i < 24; i++) advance(s, { steer: -1, brake: true });
  assert.ok(s.vx < 0);
});
test('visible support boundary triggers a fall, failure is delayed, and off-road finish cannot clear', () => {
  const s = createState(); s.phase = 'playing';
  s.x = track(0, 0).width / 2 - RADIUS * 0.35; assert.ok(supported(s));
  s.x += 0.001; assert.equal(supported(s), false);
  advance(s, { steer: 0, brake: false }); assert.equal(s.phase, 'falling');
  for (let i = 0; i < 85; i++) advance(s, { steer: 0, brake: false });
  assert.equal(s.phase, 'failed'); assert.ok(s.y < -3);
  const off = createState(); off.phase = 'playing'; off.z = length(0) - 0.001; off.x = 9; off.speed = 5;
  advance(off, { steer: 0, brake: false }); assert.equal(off.phase, 'falling');
});
test('finish on the road clears exactly once; pause and ready freeze simulation', () => {
  STAGES.forEach((_, i) => {
    const s = createState(i); s.phase = 'playing'; s.z = length(i) - 0.001; s.x = track(i, s.z).x; s.speed = 5;
    advance(s, { steer: 0, brake: false }); assert.equal(s.phase, 'clear'); assert.equal(s.z, length(i));
    const final = { ...s }; advance(s, { steer: 1, brake: true }); assert.deepEqual(s, final);
  });
  for (const phase of ['ready', 'paused'] as const) { const s = createState(); s.phase = phase; const before = { ...s }; advance(s, { steer: 1, brake: false }); assert.deepEqual(s, before); }
});
test('all authored trails can be cleared by discrete steering and braking', () => {
  STAGES.forEach((_, stage) => {
    const s = createState(stage); s.phase = 'playing';
    for (let frame = 0; frame < 15000 && s.phase === 'playing'; frame++) {
      const road = track(stage, s.z), future = track(stage, s.z + 0.7);
      const desired = (future.x - road.x) / 0.7 * s.speed + (road.x - s.x) * 3;
      const steer = desired - s.vx > 0.15 ? 1 : desired - s.vx < -0.15 ? -1 : 0;
      advance(s, { steer, brake: road.width < 4 }, STEP);
    }
    assert.equal(s.phase, 'clear', `stage ${stage + 1}, z=${s.z}, x=${s.x}`);
  });
});
test('save validation rejects damaged/non-finite values and retry is clean', () => {
  assert.deepEqual(parseSave('{bad'), { best: [null, null, null], muted: true });
  assert.deepEqual(parseSave('{"best":[-2,"3",4],"muted":false}'), { best: [null, null, 4], muted: false });
  assert.deepEqual(parseSave('{"best":[1e400,0,15]}').best, [null, null, 15]);
  assert.deepEqual(createState(2), { stage: 2, phase: 'ready', x: 0, z: 0, y: RADIUS, vx: 0, speed: 0, vy: 0, time: 0, fallTime: 0 });
});

