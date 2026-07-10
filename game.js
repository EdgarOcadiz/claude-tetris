'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#ff1744', // + pentominó - rojo vivo
  '#00e676', // U pentominó - verde vivo
  '#d500f9', // Y pentominó - magenta vivo
  '#ffd600', // 1x1 recompensa - dorado vivo
  '#00b0ff', // 3x3 hueca (reto) - azul cian vivo
  '#ff3d00', // Bomba - naranja/rojo
  '#eeff41', // Rayo - amarillo eléctrico
  '#e040fb', // Tinte - magenta pastel
  '#8d6e63', // Gravedad - marrón
  '#80deea', // Congelar - celeste hielo
  '#616161', // Basura (desafío)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[0,8,0],[8,8,8],[0,8,0]],                  // + pentominó
  [[9,0,9],[9,9,9]],                          // U pentominó
  [[0,10],[10,10],[0,10],[0,10]],             // Y pentominó
  [[11]],                                     // 1x1 (recompensa tras Tetris)
  [[12,12,12],[12,0,12],[12,12,12]],          // 3x3 hueca (reto)
  [[13]],                                     // Bomba
  [[14]],                                     // Rayo
  [[15]],                                     // Tinte
  [[16]],                                     // Gravedad
  [[17]],                                     // Congelar
];

const SPECIAL_TYPES = [8, 9, 10, 12];
const REWARD_TYPE = 11;
const SPECIAL_CHANCE = 0.20;

const BOMB_TYPE = 13;
const LIGHTNING_TYPE = 14;
const DYE_TYPE = 15;
const GRAVITY_TYPE = 16;
const FREEZE_TYPE = 17;
const POWERUP_TYPES = [BOMB_TYPE, LIGHTNING_TYPE, DYE_TYPE, GRAVITY_TYPE, FREEZE_TYPE];
const POWERUP_ICONS = { [BOMB_TYPE]: '💣', [LIGHTNING_TYPE]: '⚡', [DYE_TYPE]: '🎨', [GRAVITY_TYPE]: '⬇', [FREEZE_TYPE]: '❄' };
const POWERUP_LINE_INTERVAL = 2;
const POWERUP_CELL_SCORE = 15;
const FREEZE_DURATION = 5000;

const LINE_SCORES = [0, 100, 300, 500, 800];

const GARBAGE_COLOR_INDEX = 18;

const CHALLENGES = [
  {
    id: 'lines40',
    name: 'Cuenta atrás',
    desc: 'Limpia 40 líneas en 2 minutos',
    targetLines: 40,
    timeLimitMs: 120000,
  },
  {
    id: 'garbage',
    name: 'Basura ascendente',
    desc: 'Sobrevive mientras sube basura desde abajo cada 10s',
    garbageIntervalMs: 10000,
  },
  {
    id: 'preplaced',
    name: 'Terreno accidentado',
    desc: 'Empieza con bloques fijos ya colocados',
    prePlacedBoardFn: () => buildPreplacedBoard(),
  },
  {
    id: 'invisible',
    name: 'Piezas fantasma',
    desc: 'Las piezas se vuelven invisibles al acercarse al suelo',
    invisibleLookaheadRows: 5,
  },
  {
    id: 'reverseRotation',
    name: 'Rotación inversa',
    desc: 'A partir del nivel 3 la rotación se invierte',
    reverseRotationLevel: 3,
  },
];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const retryBtn = document.getElementById('retry-btn');
const menuBtn = document.getElementById('menu-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const modeOverlay = document.getElementById('mode-overlay');
const modeSelectEl = document.getElementById('mode-select');
const challengeSelectEl = document.getElementById('challenge-select');
const challengeListEl = document.getElementById('challenge-list');
const modeBackBtn = document.getElementById('mode-back-btn');
const challengeHudEl = document.getElementById('challenge-hud');
const challengeHudLabelEl = document.getElementById('challenge-hud-label');
const challengeHudValueEl = document.getElementById('challenge-hud-value');

const THEME_KEY = 'tetris-theme';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, rewardPending;
let powerupPending, linesSincePowerup, freezeUntil;
let challenge = null;

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggleBtn.textContent = theme === 'light' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const newTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function buildPreplacedBoard() {
  const b = createBoard();
  // Layout fijo, alineado al fondo; sin filas completas y con margen superior libre.
  const layout = [
    '..........',
    '..3.....4.',
    '.33....44.',
    '333..5.444',
    '3.3.55.4.4',
  ];
  layout.forEach((rowStr, i) => {
    const r = ROWS - layout.length + i;
    [...rowStr].forEach((ch, c) => { if (ch !== '.') b[r][c] = Number(ch); });
  });
  return b;
}

function createPiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function pickType() {
  if (Math.random() < SPECIAL_CHANCE) {
    return SPECIAL_TYPES[Math.floor(Math.random() * SPECIAL_TYPES.length)];
  }
  return Math.floor(Math.random() * 7) + 1;
}

function randomPiece() {
  return createPiece(pickType());
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function rotateCCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[cols - 1 - c][r] = shape[r][c];
  return result;
}

function tryRotate() {
  const reversed = challenge && challenge.reverseRotationLevel && level >= challenge.reverseRotationLevel;
  const rotated = reversed ? rotateCCW(current.shape) : rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    if (cleared === 4) rewardPending = true;
    linesSincePowerup += cleared;
    if (linesSincePowerup >= POWERUP_LINE_INTERVAL) {
      linesSincePowerup -= POWERUP_LINE_INTERVAL;
      powerupPending = true;
    }
    updateHUD();
  }
}

function injectGarbageRow() {
  board.shift();
  const gapCol = Math.floor(Math.random() * COLS);
  const garbage = new Array(COLS).fill(GARBAGE_COLOR_INDEX);
  garbage[gapCol] = 0;
  board.push(garbage);
  current.y -= 1;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
}

function applyPowerup(type, x, y) {
  switch (type) {
    case BOMB_TYPE: bombArea(x, y); break;
    case LIGHTNING_TYPE: lightningClear(x, y); break;
    case DYE_TYPE: dyeWildcard(); break;
    case GRAVITY_TYPE: compactBoard(); break;
    case FREEZE_TYPE: freezeUntil = performance.now() + FREEZE_DURATION; break;
  }
  updateHUD();
}

function bombArea(cx, cy) {
  let cleared = 0;
  for (let r = cy - 1; r <= cy + 1; r++) {
    for (let c = cx - 1; c <= cx + 1; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (board[r][c]) { board[r][c] = 0; cleared++; }
    }
  }
  score += cleared * POWERUP_CELL_SCORE * level;
}

function lightningClear(x, y) {
  let cleared = 0;
  if (y >= 0 && y < ROWS) {
    for (let c = 0; c < COLS; c++) {
      if (board[y][c]) { board[y][c] = 0; cleared++; }
    }
  }
  if (x >= 0 && x < COLS) {
    for (let r = 0; r < ROWS; r++) {
      if (board[r][x]) { board[r][x] = 0; cleared++; }
    }
  }
  score += cleared * POWERUP_CELL_SCORE * level;
}

function dyeWildcard() {
  const counts = {};
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (v) counts[v] = (counts[v] || 0) + 1;
    }
  const colorKeys = Object.keys(counts);
  if (!colorKeys.length) return;
  const target = Number(colorKeys.reduce((a, b) => (counts[a] >= counts[b] ? a : b)));
  let cleared = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === target) { board[r][c] = 0; cleared++; }
  score += cleared * POWERUP_CELL_SCORE * level;
}

function compactBoard() {
  for (let c = 0; c < COLS; c++) {
    const values = [];
    for (let r = 0; r < ROWS; r++)
      if (board[r][c]) values.push(board[r][c]);
    for (let r = ROWS - 1; r >= 0; r--)
      board[r][c] = values.length ? values.pop() : 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function isAtLockPosition() {
  return collide(current.shape, current.x, current.y + 1);
}

function rowsUntilLock() {
  return ghostY() - current.y;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (POWERUP_TYPES.includes(current.type)) {
    applyPowerup(current.type, current.x, current.y);
  } else {
    merge();
  }
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (rewardPending) {
    next = createPiece(REWARD_TYPE);
    rewardPending = false;
  } else if (powerupPending) {
    next = createPiece(POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]);
    powerupPending = false;
  }
  if (collide(current.shape, current.x, current.y)) {
    if (challenge && challenge.timeLimitMs) {
      endChallenge(false);
    } else {
      endGame();
    }
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  updateChallengeHUD();
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateChallengeHUD() {
  if (!challenge) return;
  if (challenge.targetLines) {
    const remaining = challenge.timeLimitMs - (challenge.elapsedMs || 0);
    challengeHudValueEl.textContent = `${lines}/${challenge.targetLines} · ${formatTime(remaining)}`;
  } else if (challenge.garbageIntervalMs) {
    challengeHudValueEl.textContent = formatTime(challenge.elapsedMs || 0);
  } else {
    challengeHudValueEl.textContent = challenge.name;
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  const icon = POWERUP_ICONS[colorIndex];
  if (icon) {
    context.font = `${Math.floor(size * 0.6)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(icon, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  const invisibleMode = challenge && challenge.invisibleLookaheadRows;

  // ghost
  if (!invisibleMode) {
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  }

  // current piece
  const hideCurrent = invisibleMode && rowsUntilLock() <= challenge.invisibleLookaheadRows;
  if (!hideCurrent) {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }

  if (freezeUntil && performance.now() < freezeUntil) {
    ctx.save();
    ctx.fillStyle = 'rgba(128,222,234,0.9)';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('❄ CONGELADO', canvas.width / 2, 8);
    ctx.restore();
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlay.classList.remove('challenge-win', 'challenge-fail');
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  retryBtn.textContent = 'Reiniciar';
  menuBtn.classList.toggle('hidden', !challenge);
  overlay.classList.remove('hidden');
}

function endChallenge(won) {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlay.classList.toggle('challenge-win', won);
  overlay.classList.toggle('challenge-fail', !won);
  overlayTitle.textContent = won ? '¡Desafío superado!' : 'Desafío fallido';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · Líneas: ${lines}`;
  retryBtn.textContent = 'Reintentar';
  menuBtn.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlay.classList.remove('challenge-win', 'challenge-fail');
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    retryBtn.textContent = 'Reiniciar';
    menuBtn.classList.toggle('hidden', !challenge);
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  const frozen = freezeUntil && ts < freezeUntil;
  if (!frozen) {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  if (challenge && !gameOver) {
    challenge.elapsedMs = (challenge.elapsedMs || 0) + dt;
    updateChallengeHUD();

    if (challenge.targetLines && lines >= challenge.targetLines) {
      endChallenge(true);
      draw();
      return;
    }
    if (challenge.timeLimitMs && challenge.elapsedMs >= challenge.timeLimitMs) {
      endChallenge(false);
      draw();
      return;
    }
    if (challenge.garbageIntervalMs) {
      challenge.garbageAccumMs = (challenge.garbageAccumMs || 0) + dt;
      if (challenge.garbageAccumMs >= challenge.garbageIntervalMs) {
        challenge.garbageAccumMs -= challenge.garbageIntervalMs;
        injectGarbageRow();
      }
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = (challenge && challenge.prePlacedBoardFn) ? challenge.prePlacedBoardFn() : createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  rewardPending = false;
  powerupPending = false;
  linesSincePowerup = 0;
  freezeUntil = 0;
  if (challenge) {
    challenge.elapsedMs = 0;
    challenge.garbageAccumMs = 0;
  }
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  challengeHudEl.classList.toggle('hidden', !challenge);
  if (challenge) {
    challengeHudLabelEl.textContent = challenge.targetLines
      ? 'TIEMPO'
      : challenge.garbageIntervalMs
      ? 'SUPERVIVENCIA'
      : 'DESAFÍO';
  }
  overlay.classList.remove('challenge-win', 'challenge-fail');
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!current) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

function showModeOverlay() {
  cancelAnimationFrame(animId);
  gameOver = true;
  overlay.classList.add('hidden');
  modeSelectEl.classList.remove('hidden');
  challengeSelectEl.classList.add('hidden');
  modeOverlay.classList.remove('hidden');
}

function renderChallengeList() {
  challengeListEl.innerHTML = '';
  CHALLENGES.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'challenge-btn';
    btn.dataset.index = i;
    btn.innerHTML = `<span class="challenge-name">${c.name}</span><span class="challenge-desc">${c.desc}</span>`;
    challengeListEl.appendChild(btn);
  });
}

modeSelectEl.addEventListener('click', e => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  if (btn.dataset.mode === 'classic') {
    challenge = null;
    modeOverlay.classList.add('hidden');
    init();
  } else {
    renderChallengeList();
    modeSelectEl.classList.add('hidden');
    challengeSelectEl.classList.remove('hidden');
  }
});

challengeListEl.addEventListener('click', e => {
  const btn = e.target.closest('.challenge-btn');
  if (!btn) return;
  challenge = { ...CHALLENGES[Number(btn.dataset.index)] };
  modeOverlay.classList.add('hidden');
  init();
});

modeBackBtn.addEventListener('click', () => {
  challengeSelectEl.classList.add('hidden');
  modeSelectEl.classList.remove('hidden');
});

retryBtn.addEventListener('click', init);
menuBtn.addEventListener('click', showModeOverlay);
themeToggleBtn.addEventListener('click', toggleTheme);

initTheme();
