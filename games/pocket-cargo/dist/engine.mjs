/** Pure, deterministic rules for Pocket Cargo. No browser or network dependencies. */
const shape = (cells) => Object.freeze({
  cells: Object.freeze(cells.map((cell) => Object.freeze(cell))),
  size: cells.length,
});

export const SHAPES = Object.freeze({
  mono: shape([[0, 0]]),
  domino: shape([[0, 0], [0, 1]]),
  triI: shape([[0, 0], [0, 1], [0, 2]]),
  triL: shape([[0, 0], [1, 0], [1, 1]]),
  tetroI: shape([[0, 0], [0, 1], [0, 2], [0, 3]]),
  square: shape([[0, 0], [0, 1], [1, 0], [1, 1]]),
  T: shape([[0, 0], [0, 1], [0, 2], [1, 1]]),
  L: shape([[0, 0], [1, 0], [2, 0], [2, 1]]),
});

const SHAPE_IDS = Object.keys(SHAPES);
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  }
  return value >>> 0;
}

function offersFor(seed, trip, turn) {
  let value = hash(JSON.stringify([seed, trip, turn]));
  const random = () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
  return [0, 1].map(() => ({
    shape: SHAPE_IDS[Math.floor(random() * SHAPE_IDS.length)],
    color: Math.floor(random() * 5),
  }));
}

export function createGame(seed = 'pocket-cargo') {
  const normalizedSeed = String(seed);
  return {
    version: 1,
    seed: normalizedSeed,
    trip: 1,
    turn: 0,
    board: Array(16).fill(null),
    offers: offersFor(normalizedSeed, 1, 0),
    score: 0,
    history: [],
    results: [],
    status: 'playing',
    undoAvailable: true,
  };
}

/** Coordinates are always normalized to a top-left anchor, with clockwise rotation. */
export function cellsFor(shapeId, rotation = 0) {
  if (!Object.hasOwn(SHAPES, shapeId) || !Number.isInteger(rotation)) return [];
  let cells = SHAPES[shapeId].cells.map(([row, col]) => [row, col]);
  const turns = ((rotation % 4) + 4) % 4;
  for (let step = 0; step < turns; step += 1) {
    cells = cells.map(([row, col]) => [col, -row]);
  }
  const minRow = Math.min(...cells.map(([row]) => row));
  const minCol = Math.min(...cells.map(([, col]) => col));
  return cells.map(([row, col]) => [row - minRow, col - minCol])
    .sort(([rowA, colA], [rowB, colB]) => rowA - rowB || colA - colB);
}

export function canPlace(state, offerIndex, rotation, row, col) {
  if (!state || state.status !== 'playing' || state.turn >= 5
    || !integer(offerIndex, 0, 1) || !Number.isInteger(rotation)
    || !integer(row, 0, 3) || !integer(col, 0, 3)) return false;
  const offer = state.offers[offerIndex];
  const cells = cellsFor(offer?.shape, rotation);
  return cells.length > 0 && cells.every(([cellRow, cellCol]) => {
    const targetRow = row + cellRow;
    const targetCol = col + cellCol;
    return targetRow < 4 && targetCol < 4 && state.board[targetRow * 4 + targetCol] === null;
  });
}

export function legalMoves(state, offerIndex, rotation) {
  if (!state || state.status !== 'playing') return [];
  const offerIndices = offerIndex === undefined ? [0, 1] : [offerIndex];
  const rotations = rotation === undefined ? [0, 1, 2, 3] : [rotation];
  const moves = [];
  for (const index of offerIndices) {
    for (const turn of rotations) {
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          if (canPlace(state, index, turn, row, col)) {
            moves.push({ offerIndex: index, rotation: turn, row, col });
          }
        }
      }
    }
  }
  return moves;
}

function boardResult(board, trip, turns) {
  const filled = board.filter((cell) => cell !== null).length;
  let lines = 0;
  for (let index = 0; index < 4; index += 1) {
    if ([0, 1, 2, 3].every((col) => board[index * 4 + col] !== null)) lines += 1;
    if ([0, 1, 2, 3].every((row) => board[row * 4 + index] !== null)) lines += 1;
  }
  const full = filled === 16;
  return { trip, filled, score: filled * 10 + lines * 5 + (full ? 40 : 0), full, turns };
}

export function depart(state) {
  if (!state || state.status !== 'playing') return state;
  const result = boardResult(state.board, state.trip, state.turn);
  return {
    ...state,
    score: state.score + result.score,
    history: [],
    results: [...state.results, result],
    status: state.trip === 3 ? 'finished' : 'between',
  };
}

export function place(state, offerIndex, rotation, row, col) {
  if (!canPlace(state, offerIndex, rotation, row, col)) return state;
  const offer = state.offers[offerIndex];
  const board = state.board.slice();
  const packageId = (state.trip - 1) * 5 + state.turn + 1;
  for (const [cellRow, cellCol] of cellsFor(offer.shape, rotation)) {
    board[(row + cellRow) * 4 + col + cellCol] = { color: offer.color, packageId };
  }
  const turn = state.turn + 1;
  const next = {
    ...state,
    turn,
    board,
    offers: offersFor(state.seed, state.trip, turn),
    history: [...state.history, {
      turn: state.turn,
      board: state.board.slice(),
      offers: state.offers.map((entry) => ({ ...entry })),
    }],
  };
  return turn === 5 || board.every((cell) => cell !== null) ? depart(next) : next;
}

export function nextTrip(state) {
  if (!state || state.status !== 'between' || state.trip >= 3) return state;
  const trip = state.trip + 1;
  return {
    ...state,
    trip,
    turn: 0,
    board: Array(16).fill(null),
    offers: offersFor(state.seed, trip, 0),
    history: [],
    status: 'playing',
    undoAvailable: true,
  };
}

export function undo(state) {
  if (!state || state.status !== 'playing' || !state.undoAvailable || state.history.length === 0) return state;
  const previous = state.history[state.history.length - 1];
  return {
    ...state,
    turn: previous.turn,
    board: previous.board.slice(),
    offers: previous.offers.map((entry) => ({ ...entry })),
    history: state.history.slice(0, -1),
    undoAvailable: false,
  };
}

function validBoard(board, trip, turn) {
  if (!Array.isArray(board) || board.length !== 16) return false;
  const packages = new Map();
  for (const cell of board) {
    if (cell === null) continue;
    if (!cell || typeof cell !== 'object' || !integer(cell.color, 0, 4)
      || !integer(cell.packageId, (trip - 1) * 5 + 1, (trip - 1) * 5 + turn)) return false;
    if (packages.has(cell.packageId) && packages.get(cell.packageId) !== cell.color) return false;
    packages.set(cell.packageId, cell.color);
  }
  return packages.size === turn;
}

function validOffers(offers, seed, trip, turn) {
  if (!Array.isArray(offers) || offers.length !== 2) return false;
  const expected = offersFor(seed, trip, turn);
  return offers.every((offer, index) => offer && typeof offer === 'object'
    && offer.shape === expected[index].shape && offer.color === expected[index].color);
}

/** Checks structural integrity of local saves; this is not a server anti-cheat mechanism. */
export function validateState(candidate) {
  if (!candidate || typeof candidate !== 'object' || candidate.version !== 1
    || typeof candidate.seed !== 'string' || !integer(candidate.trip, 1, 3)
    || !integer(candidate.turn, 0, 5) || !integer(candidate.score, 0, 720)
    || !['playing', 'between', 'finished'].includes(candidate.status)
    || typeof candidate.undoAvailable !== 'boolean' || !Array.isArray(candidate.history)
    || !Array.isArray(candidate.results)) return false;
  const { seed, trip, turn, board, offers, history, results, status } = candidate;
  if (!validBoard(board, trip, turn) || !validOffers(offers, seed, trip, turn)) return false;
  if (status === 'finished' && trip !== 3) return false;
  if (status === 'between' && trip === 3) return false;
  if (status === 'playing' && (turn === 5 || board.every((cell) => cell !== null))) return false;
  if (results.length !== (status === 'playing' ? trip - 1 : trip)) return false;
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (!result || result.trip !== index + 1 || !integer(result.filled, 0, 16)
      || !integer(result.turns, 0, 5) || !integer(result.score, 0, 240)
      || result.full !== (result.filled === 16) || result.filled < result.turns
      || result.filled > result.turns * 4 || result.score % 5 !== 0
      || result.score < result.filled * 10 || result.score > result.filled * 10 + 80
      || (result.full && result.score !== 240)) return false;
  }
  if (candidate.score !== results.reduce((sum, result) => sum + result.score, 0)) return false;
  if (status !== 'playing') {
    const current = boardResult(board, trip, turn);
    if (history.length !== 0 || JSON.stringify(results.at(-1)) !== JSON.stringify(current)) return false;
  } else {
    if (history.length !== turn || history.some((entry, index) => !entry || entry.turn !== index
      || !validBoard(entry.board, trip, index) || !validOffers(entry.offers, seed, trip, index))) return false;
  }
  return true;
}
