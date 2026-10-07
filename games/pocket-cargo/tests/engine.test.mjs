import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, createGame, cellsFor, canPlace, place, depart, nextTrip, undo, legalMoves, validateState } from '../dist/engine.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));
const frozen = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
};
const withOffers = (state, shape) => ({ ...state, offers: [{ shape, color: 2 }, { shape, color: 4 }] });

test('same seed, trip, and turn produce the same offers, independently of placement position', () => {
  const initial = createGame('daily:2026-10-07');
  assert.deepEqual(initial, createGame('daily:2026-10-07'));
  const move = legalMoves(initial)[0];
  const equivalent = legalMoves(initial, move.offerIndex, move.rotation).at(-1);
  const a = place(initial, move.offerIndex, move.rotation, move.row, move.col);
  const b = place(initial, equivalent.offerIndex, equivalent.rotation, equivalent.row, equivalent.col);
  assert.deepEqual(a.offers, b.offers);
  assert.notDeepEqual(createGame('random:A').offers, createGame('random:B').offers);
});

test('every shape has four normalized, unique-cell rotations without changing source cells', () => {
  for (const [id, source] of Object.entries(SHAPES)) {
    const before = clone(source);
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const cells = cellsFor(id, rotation);
      assert.equal(cells.length, source.size);
      assert.equal(new Set(cells.map((cell) => cell.join(','))).size, source.size);
      assert.equal(Math.min(...cells.map(([row]) => row)), 0);
      assert.equal(Math.min(...cells.map(([, col]) => col)), 0);
      assert.deepEqual(cells, cellsFor(id, rotation + 4));
    }
    assert.deepEqual(source, before);
  }
  assert.deepEqual(cellsFor('domino', 1), [[0, 0], [1, 0]]);
  assert.deepEqual(cellsFor('missing', 0), []);
});

test('placements reject overlap, bounds, invalid offers and invalid anchors', () => {
  const state = withOffers(createGame('bounds'), 'domino');
  assert.equal(canPlace(state, 0, 0, 0, 3), false);
  assert.equal(canPlace(state, 0, 1, 3, 0), false);
  assert.equal(canPlace(state, 0, 0, -1, 0), false);
  assert.equal(canPlace(state, 0, 0, 0.5, 0), false);
  assert.equal(canPlace(state, 2, 0, 0, 0), false);
  assert.equal(canPlace(state, 0, NaN, 0, 0), false);
  const placed = place(state, 0, 0, 0, 0);
  assert.equal(placed.board[0].color, 2);
  assert.equal(placed.board[0].packageId, placed.board[1].packageId);
  assert.equal(canPlace(placed, 0, 0, 0, 0), false);
  assert.equal(place(placed, 0, 0, 0, 0), placed);
});

test('all transitions leave deeply frozen inputs unchanged; invalid placement returns same reference', () => {
  const state = frozen(createGame('immutable'));
  const before = clone(state);
  assert.equal(place(state, 0, 0, 9, 9), state);
  const move = legalMoves(state)[0];
  const placed = frozen(place(state, move.offerIndex, move.rotation, move.row, move.col));
  assert.notEqual(placed, state);
  assert.deepEqual(state, before);
  undo(placed);
  const ended = frozen(depart(placed));
  nextTrip(ended);
  assert.deepEqual(state, before);
});

test('fifth package automatically finalizes and counts complete lines', () => {
  let state = createGame('five');
  for (const [row, col] of [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0]]) {
    state = place(withOffers(state, 'mono'), 0, 0, row, col);
  }
  assert.equal(state.status, 'between');
  assert.equal(state.turn, 5);
  assert.equal(state.score, 55);
  assert.deepEqual(state.results, [{ trip: 1, filled: 5, score: 55, full: false, turns: 5 }]);
  assert.equal(depart(state), state);
  assert.equal(undo(state), state);
});

test('filling the board before five packages automatically awards all eight lines plus full bonus', () => {
  let state = createGame('full');
  for (let row = 0; row < 4; row += 1) {
    state = place(withOffers(state, 'tetroI'), 0, 0, row, 0);
  }
  assert.equal(state.status, 'between');
  assert.equal(state.turn, 4);
  assert.equal(state.score, 240);
  assert.deepEqual(state.results[0], { trip: 1, filled: 16, score: 240, full: true, turns: 4 });
});

test('voluntary early departures, three trips, and no transitions after finishing', () => {
  let state = createGame('three');
  for (let trip = 1; trip <= 3; trip += 1) {
    state = place(withOffers(state, 'mono'), 0, 0, 0, 0);
    assert.equal(state.score, (trip - 1) * 10);
    state = depart(state);
    assert.equal(state.score, trip * 10);
    assert.equal(state.trip, trip);
    assert.equal(state.status, trip === 3 ? 'finished' : 'between');
    if (trip < 3) {
      state = nextTrip(state);
      assert.equal(state.turn, 0);
      assert.equal(state.board.every((cell) => cell === null), true);
      assert.equal(state.undoAvailable, true);
    }
  }
  assert.equal(nextTrip(state), state);
  assert.equal(depart(state), state);
  assert.equal(undo(state), state);
  assert.deepEqual(legalMoves(state), []);
});

test('legalMoves enumerates every legal offer, rotation and anchor and supports filters', () => {
  let state = createGame('moves');
  const first = legalMoves(state)[0];
  state = place(state, first.offerIndex, first.rotation, first.row, first.col);
  const independent = [];
  for (let offerIndex = 0; offerIndex < 2; offerIndex += 1) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          const cells = cellsFor(state.offers[offerIndex].shape, rotation);
          const legal = cells.every(([r, c]) => row + r < 4 && col + c < 4 && state.board[(row + r) * 4 + col + c] === null);
          if (legal) independent.push({ offerIndex, rotation, row, col });
        }
      }
    }
  }
  assert.deepEqual(legalMoves(state), independent);
  assert.deepEqual(legalMoves(state, 1, 2), independent.filter((move) => move.offerIndex === 1 && move.rotation === 2));
  assert.deepEqual(legalMoves(state, 2), []);
});

test('undo restores board and exact seeded offers, works once per trip, and resets next trip', () => {
  const initial = createGame('undo');
  const move = legalMoves(initial)[0];
  const placed = place(initial, move.offerIndex, move.rotation, move.row, move.col);
  const restored = undo(placed);
  assert.deepEqual(restored.board, initial.board);
  assert.deepEqual(restored.offers, initial.offers);
  assert.equal(restored.turn, 0);
  assert.equal(restored.undoAvailable, false);
  const replayed = place(restored, move.offerIndex, move.rotation, move.row, move.col);
  assert.deepEqual(replayed.offers, placed.offers);
  assert.equal(undo(replayed), replayed);
  assert.equal(nextTrip(depart(replayed)).undoAvailable, true);
});

test('valid engine states round-trip through JSON; malformed or inconsistent saves are rejected', () => {
  let state = createGame('save');
  assert.equal(validateState(clone(state)), true);
  const first = legalMoves(state)[0];
  state = place(state, first.offerIndex, first.rotation, first.row, first.col);
  assert.equal(validateState(clone(state)), true);
  assert.equal(validateState(clone(undo(state))), true);
  assert.equal(validateState(clone(depart(state))), true);
  assert.equal(validateState(clone(nextTrip(depart(state)))), true);
  for (const changed of [null, {}, { ...state, board: [] }, { ...state, score: 99 },
    { ...state, trip: 4 }, { ...state, turn: 5 }, { ...state, history: [] },
    { ...state, offers: [{ shape: 'invalid', color: 0 }, state.offers[1]] }]) {
    assert.equal(validateState(changed), false);
  }
  const corruptCell = clone(state);
  corruptCell.board.find((cell) => cell !== null).color = 9;
  assert.equal(validateState(corruptCell), false);
});

test('complete seeded runs remain valid through placements, blocked departures, undo, and trip changes', () => {
  for (let seed = 0; seed < 200; seed += 1) {
    let state = createGame(`simulation:${seed}`);
    let actions = 0;
    while (state.status !== 'finished') {
      assert.equal(validateState(clone(state)), true, `invalid save for seed ${seed}, action ${actions}`);
      assert.ok(actions < 30, `run failed to terminate for seed ${seed}`);
      if (state.status === 'between') {
        state = nextTrip(state);
      } else if (state.turn === 1 && state.undoAvailable && seed % 3 === 0) {
        state = undo(state);
      } else {
        const moves = legalMoves(state);
        if (moves.length === 0) {
          state = depart(state);
        } else {
          const move = moves[(seed * 7 + actions * 11) % moves.length];
          state = place(state, move.offerIndex, move.rotation, move.row, move.col);
        }
      }
      actions += 1;
    }
    assert.equal(validateState(clone(state)), true);
    assert.equal(state.results.length, 3);
    assert.ok(state.score >= 0 && state.score <= 720);
  }
});
