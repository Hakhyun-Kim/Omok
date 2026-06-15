/* ==========================================================================
   Premium Omok 3D Board
   ========================================================================== */

const BOARD_SIZE = 15;
const BOARD_REAL_SIZE = BOARD_SIZE - 1;
const BOARD_HALF = BOARD_REAL_SIZE / 2;
const STONE_RADIUS = 0.42;
const STONE_HEIGHT = 0.16;
const TURN_LIMIT = 30;

const BOARD_COLORS = {
  wood: { top: 0xdfb275, line: 0x3e2d1b, emissive: 0x000000 },
  neon: { top: 0x101018, line: 0x00f0ff, emissive: 0x002d47 }
};

let board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
let currentPlayer = 1;
let nextFirstPlayer = 1;
let lastMatchWinner = null;
let history = [];
let gameActive = true;
let winningLine = [];
let scores = { black: 0, white: 0 };
let currentTheme = 'wood';
let timeLeft = TURN_LIMIT;
let timerInterval = null;
let benefitMoves = 0;
let starterPlayer = 1;

let renderer = null;
let scene = null;
let camera = null;
let raycaster = null;
let boardMesh = null;
let boardPlane = null;
let gridGroup = null;
let stonesGroup = null;
let previewMesh = null;
let winningLineGroup = null;
let lastMoveMarker = null;
let isDrawing = false;
let activePointers = new Map();
let isPinching = false;
let lastPinchDistance = 0;
const minCameraDistance = 6;
const maxCameraDistance = 28;
const pinchZoomSpeed = 0.03;
const wheelZoomSpeed = 0.03;

let audioCtx = null;

const canvas = document.getElementById('omok-canvas');
const scoreBlackEl = document.getElementById('score-black');
const scoreWhiteEl = document.getElementById('score-white');
const currentTurnEl = document.getElementById('current-turn');
const btnUndo = document.getElementById('btn-undo');
const btnReset = document.getElementById('btn-reset');
const btnThemeWood = document.getElementById('btn-theme-wood');
const btnThemeNeon = document.getElementById('btn-theme-neon');
const selectBenefit = document.getElementById('select-benefit');
const victoryModal = document.getElementById('victory-modal');
const victoryTitle = document.getElementById('victory-title');
const victoryMessage = document.getElementById('victory-message');
const statMoves = document.getElementById('stat-moves');
const btnModalRestart = document.getElementById('btn-modal-restart');
const countdownValEl = document.getElementById('countdown-val');
const timerProgressEl = document.getElementById('timer-progress');
const timerIconEl = document.querySelector('.timer-icon');
const turnCenterHint = document.getElementById('turn-center-hint');
const turnCenterHintText = document.getElementById('turn-center-hint-text');
let turnHintTimeout = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playWarningBeep(isUrgent = false) {
  try {
    initAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isUrgent ? 1200 : 800, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(isUrgent ? 0.2 : 0.15, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch (e) {
    console.warn('Warning beep failed:', e);
  }
}

function playStoneSound(isWhite) {
  try {
    initAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(isWhite ? 0.38 : 0.42, now + 0.0015);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + (isWhite ? 0.08 : 0.12));

    const clickOsc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(isWhite ? 3400 : 2900, now);
    clickOsc.frequency.exponentialRampToValueAtTime(isWhite ? 700 : 550, now + 0.004);
    clickGain.gain.setValueAtTime(1.0, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.004);
    clickOsc.connect(clickGain);
    clickGain.connect(masterGain);

    const bodyOsc = audioCtx.createOscillator();
    const bodyGain = audioCtx.createGain();
    bodyOsc.type = 'triangle';
    const resonanceFreq = isWhite ? 220 : 180;
    bodyOsc.frequency.setValueAtTime(resonanceFreq, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(resonanceFreq * 0.88, now + 0.035);
    bodyGain.gain.setValueAtTime(0.7, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(550, now);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(filter);
    filter.connect(masterGain);

    const ringOsc = audioCtx.createOscillator();
    const ringGain = audioCtx.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(resonanceFreq * (isWhite ? 3.1 : 2.5), now);
    ringGain.gain.setValueAtTime(0.12, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    ringOsc.connect(ringGain);
    ringGain.connect(masterGain);

    masterGain.connect(audioCtx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.015);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.15);
    ringOsc.start(now);
    ringOsc.stop(now + 0.04);
  } catch (e) {
    console.warn('AudioContext failed:', e);
  }
}

function createBoardMaterial(themeName) {
  const palette = BOARD_COLORS[themeName];
  return new THREE.MeshPhysicalMaterial({
    color: palette.top,
    emissive: palette.emissive,
    roughness: themeName === 'wood' ? 0.92 : 0.14,
    metalness: themeName === 'wood' ? 0.05 : 0.35,
    clearcoat: themeName === 'wood' ? 0.36 : 0.7,
    clearcoatRoughness: 0.45,
    reflectivity: themeName === 'neon' ? 0.35 : 0.08,
  });
}

function createStoneMesh(player) {
  const geometry = new THREE.CylinderGeometry(STONE_RADIUS, STONE_RADIUS, STONE_HEIGHT, 48);
  const material = new THREE.MeshStandardMaterial({
    color: player === 1 ? 0x111111 : 0xf8f8f2,
    emissive: player === 1 ? 0x202020 : 0x111111,
    roughness: player === 1 ? 0.24 : 0.35,
    metalness: player === 1 ? 0.22 : 0.08,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createPreviewMesh() {
  const geometry = new THREE.CylinderGeometry(STONE_RADIUS * 1.05, STONE_RADIUS * 1.05, STONE_HEIGHT * 0.45, 32);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    emissive: 0xffffff,
    emissiveIntensity: 0.45,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  return mesh;
}

function createBoardPlane() {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_REAL_SIZE, BOARD_REAL_SIZE),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.02;
  return plane;
}

function createBoardMesh(themeName) {
  const geometry = new THREE.BoxGeometry(BOARD_REAL_SIZE + 0.5, 0.4, BOARD_REAL_SIZE + 0.5);
  const mesh = new THREE.Mesh(geometry, createBoardMaterial(themeName));
  mesh.receiveShadow = true;
  mesh.position.y = -0.2;
  return mesh;
}

function buildGridLines(themeName) {
  const palette = BOARD_COLORS[themeName];
  const material = new THREE.LineBasicMaterial({
    color: palette.line,
    transparent: true,
    opacity: themeName === 'neon' ? 0.75 : 0.65,
  });
  const grid = new THREE.Group();
  const lineHeight = 0.03;

  for (let i = 0; i < BOARD_SIZE; i++) {
    const position = i - BOARD_HALF;
    const horizontal = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-BOARD_HALF, lineHeight, position),
      new THREE.Vector3(BOARD_HALF, lineHeight, position),
    ]);
    const vertical = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(position, lineHeight, -BOARD_HALF),
      new THREE.Vector3(position, lineHeight, BOARD_HALF),
    ]);
    grid.add(new THREE.Line(horizontal, material));
    grid.add(new THREE.Line(vertical, material));
  }

  const starMaterial = new THREE.MeshBasicMaterial({
    color: palette.line,
    transparent: true,
    opacity: themeName === 'neon' ? 0.9 : 0.8,
  });

  for (let row of [3, 7, 11]) {
    for (let col of [3, 7, 11]) {
      const star = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), starMaterial);
      star.rotation.x = -Math.PI / 2;
      star.position.set(col - BOARD_HALF, lineHeight, row - BOARD_HALF);
      grid.add(star);
    }
  }

  return grid;
}

function updateSceneTheme() {
  if (!boardMesh || !gridGroup) return;
  boardMesh.material.dispose();
  boardMesh.material = createBoardMaterial(currentTheme);
  scene.remove(gridGroup);
  gridGroup = buildGridLines(currentTheme);
  scene.add(gridGroup);
}

function addStoneMesh(x, y, player) {
  const mesh = createStoneMesh(player);
  mesh.position.set(x - BOARD_HALF, STONE_HEIGHT / 2, y - BOARD_HALF);
  mesh.userData = { gridX: x, gridY: y };
  stonesGroup.add(mesh);
}

function createLastMoveMarker() {
  const geometry = new THREE.TorusGeometry(STONE_RADIUS * 1.12, 0.035, 16, 64);
  const material = new THREE.MeshStandardMaterial({
    color: 0xfff176,
    emissive: 0xfff176,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.85,
    metalness: 0.25,
    roughness: 0.15,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  return mesh;
}

function updateLastMoveMarker(x, y) {
  if (lastMoveMarker) {
    scene.remove(lastMoveMarker);
    lastMoveMarker.geometry.dispose();
    lastMoveMarker.material.dispose();
    lastMoveMarker = null;
  }
  if (x == null || y == null) return;
  lastMoveMarker = createLastMoveMarker();
  lastMoveMarker.position.set(x - BOARD_HALF, STONE_HEIGHT * 0.6, y - BOARD_HALF);
  scene.add(lastMoveMarker);
}

function removeStoneMesh(x, y) {
  const index = stonesGroup.children.findIndex((mesh) => mesh.userData.gridX === x && mesh.userData.gridY === y);
  if (index !== -1) {
    const removed = stonesGroup.children[index];
    stonesGroup.remove(removed);
    removed.geometry.dispose();
    removed.material.dispose();
  }
}

function updateWinningLineMesh() {
  winningLineGroup.clear();
  if (winningLine.length === 0) return;

  const points = winningLine.map((point) => new THREE.Vector3(point.x - BOARD_HALF, 0.26, point.y - BOARD_HALF));
  const material = new THREE.LineBasicMaterial({
    color: board[winningLine[0].y][winningLine[0].x] === 1 ? 0x00f0ff : 0xff007f,
    transparent: true,
    opacity: 0.9,
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  winningLineGroup.add(line);

  for (let point of points) {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16),
      new THREE.MeshBasicMaterial({ color: material.color, transparent: true, opacity: 0.35 })
    );
    glow.position.copy(point);
    winningLineGroup.add(glow);
  }
}

function init3DScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = null;

  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 13.5, 12.5);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.HemisphereLight(0xffffff, 0x222222, 0.75);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.85);
  directional.position.set(8, 22, 14);
  scene.add(directional);

  boardMesh = createBoardMesh(currentTheme);
  scene.add(boardMesh);

  boardPlane = createBoardPlane();
  scene.add(boardPlane);

  gridGroup = buildGridLines(currentTheme);
  scene.add(gridGroup);

  stonesGroup = new THREE.Group();
  scene.add(stonesGroup);

  previewMesh = createPreviewMesh();
  scene.add(previewMesh);

  winningLineGroup = new THREE.Group();
  scene.add(winningLineGroup);

  raycaster = new THREE.Raycaster();

  resizeCanvas();
  animate();
}

function renderScene() {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  renderScene();
}

function draw() {
  updateWinningLineMesh();
  renderScene();
}

function resizeCanvas() {
  const displayWidth = Math.max(canvas.clientWidth, 200);
  const displayHeight = Math.max(canvas.clientHeight, 200);
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(dpr);
  renderer.setSize(displayWidth, displayHeight, false);
  camera.aspect = displayWidth / displayHeight;
  camera.updateProjectionMatrix();
  renderScene();
}

function getBoardIntersection(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera({ x, y }, camera);
  const intersects = raycaster.intersectObject(boardPlane, false);
  return intersects.length > 0 ? intersects[0] : null;
}

function getPointerDistance(p1, p2) {
  return Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
}

function updateCameraZoom(delta) {
  const direction = camera.position.clone().normalize();
  const currentDistance = camera.position.length();
  let targetDistance = currentDistance + delta;
  targetDistance = Math.min(Math.max(targetDistance, minCameraDistance), maxCameraDistance);
  camera.position.copy(direction.multiplyScalar(targetDistance));
  camera.lookAt(0, 0, 0);
  draw();
}

function setPreviewPosition(gridX, gridY) {
  previewMesh.position.set(gridX - BOARD_HALF, STONE_HEIGHT / 2 + 0.02, gridY - BOARD_HALF);
  previewMesh.visible = true;
}

function clearPreview() {
  previewMesh.visible = false;
}

function handlePointerInput(clientX, clientY, isCommit = false) {
  if (!gameActive) return;
  const hit = getBoardIntersection(clientX, clientY);
  if (!hit) {
    clearPreview();
    return;
  }

  const gridX = Math.round(hit.point.x + BOARD_HALF);
  const gridY = Math.round(hit.point.z + BOARD_HALF);
  if (gridX < 0 || gridX >= BOARD_SIZE || gridY < 0 || gridY >= BOARD_SIZE) {
    clearPreview();
    return;
  }

  if (board[gridY][gridX] !== 0) {
    clearPreview();
    return;
  }

  setPreviewPosition(gridX, gridY);
  if (isCommit) {
    placeStone(gridX, gridY);
    clearPreview();
  }
}

function startTimer() {
  stopTimer();
  timeLeft = TURN_LIMIT;
  updateTimerUI();
  timerInterval = setInterval(() => {
    if (!gameActive) {
      stopTimer();
      return;
    }
    timeLeft--;
    updateTimerUI();
    if (timeLeft <= 5 && timeLeft > 0) {
      playWarningBeep(timeLeft <= 2);
    }
    if (timeLeft <= 0) {
      handleTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerUI() {
  countdownValEl.textContent = timeLeft;
  const percentage = (timeLeft / TURN_LIMIT) * 100;
  timerProgressEl.style.width = `${percentage}%`;
  if (timeLeft <= 5) {
    countdownValEl.classList.add('danger');
    timerProgressEl.classList.add('danger');
    timerIconEl.classList.add('ticking');
  } else {
    countdownValEl.classList.remove('danger');
    timerProgressEl.classList.remove('danger');
    timerIconEl.classList.remove('ticking');
  }
}

function handleTimeout() {
  stopTimer();
  gameActive = false;
  const winningPlayer = currentPlayer === 1 ? 2 : 1;
  lastMatchWinner = winningPlayer;
  nextFirstPlayer = getNextFirstPlayerAfterMatch(winningPlayer);
  if (winningPlayer === 1) {
    scores.black++;
    victoryTitle.textContent = '흑돌 승리! (시간 초과)';
    victoryMessage.textContent = '백돌(White)의 생각 시간이 초과되어 흑돌이 시간승 하였습니다.';
  } else {
    scores.white++;
    victoryTitle.textContent = '백돌 승리! (시간 초과)';
    victoryMessage.textContent = '흑돌(Black)의 생각 시간이 초과되어 백돌이 시간승 하였습니다.';
  }
  saveScores();
  statMoves.textContent = history.length;
  setTimeout(() => victoryModal.classList.add('active'), 750);
}

function loadScores() {
  const stored = localStorage.getItem('omok_score_data');
  if (stored) {
    try {
      scores = JSON.parse(stored);
      scoreBlackEl.textContent = scores.black;
      scoreWhiteEl.textContent = scores.white;
    } catch (e) {
      console.error(e);
    }
  }
}

function saveScores() {
  localStorage.setItem('omok_score_data', JSON.stringify(scores));
  scoreBlackEl.textContent = scores.black;
  scoreWhiteEl.textContent = scores.white;
}

function getNextFirstPlayerAfterMatch(winner) {
  if (benefitMoves === 0) {
    return winner === 1 ? 2 : 1;
  }
  return 1;
}

function clearStones() {
  while (stonesGroup.children.length > 0) {
    const mesh = stonesGroup.children[0];
    stonesGroup.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  updateLastMoveMarker(null, null);
}

function placeStone(x, y) {
  board[y][x] = currentPlayer;
  history.push({ x, y, player: currentPlayer });
  addStoneMesh(x, y, currentPlayer);
  updateLastMoveMarker(x, y);
  playStoneSound(currentPlayer === 2);
  const isWin = checkWin(x, y);
  if (isWin) {
    triggerVictory(isWin);
    return;
  }
  if (history.length < 1 + benefitMoves) {
    currentPlayer = starterPlayer;
  } else {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
  }
  updateUIControls();
  startTimer();
  draw();
}

function checkWin(x, y) {
  const targetColor = board[y][x];
  if (targetColor === 0) return null;
  const directions = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
  ];
  for (let dir of directions) {
    const matches = [{ x, y }];
    let r = y + dir.dy;
    let c = x + dir.dx;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === targetColor) {
      matches.push({ x: c, y: r });
      r += dir.dy;
      c += dir.dx;
    }
    r = y - dir.dy;
    c = x - dir.dx;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === targetColor) {
      matches.unshift({ x: c, y: r });
      r -= dir.dy;
      c -= dir.dx;
    }
    if (matches.length >= 5) return matches;
  }
  return null;
}

function triggerVictory(lineCoordinates) {
  stopTimer();
  gameActive = false;
  winningLine = lineCoordinates;
  draw();
  const winner = board[lineCoordinates[0].y][lineCoordinates[0].x];
  lastMatchWinner = winner;
  nextFirstPlayer = getNextFirstPlayerAfterMatch(winner);
  if (winner === 1) {
    scores.black++;
    victoryTitle.textContent = '흑돌 승리!';
    victoryMessage.textContent = '흑돌(Black)이 5목을 먼저 달성하여 게임에서 이겼습니다.';
  } else {
    scores.white++;
    victoryTitle.textContent = '백돌 승리!';
    victoryMessage.textContent = '백돌(White)이 5목을 먼저 달성하여 게임에서 이겼습니다.';
  }
  saveScores();
  statMoves.textContent = history.length;
  setTimeout(() => victoryModal.classList.add('active'), 750);
}

function showTurnCenterHint(message) {
  if (!turnCenterHint || !turnCenterHintText) return;
  if (turnHintTimeout) {
    clearTimeout(turnHintTimeout);
  }
  turnCenterHintText.textContent = message;
  turnCenterHint.classList.add('active');
  turnHintTimeout = setTimeout(() => {
    turnCenterHint.classList.remove('active');
    turnHintTimeout = null;
  }, 1800);
}

function showCurrentTurnCenterHint() {
  if (!gameActive) return;
  showTurnCenterHint(`${currentPlayer === 1 ? '흑돌' : '백돌'} 차례`);
}

function updateUIControls() {
  currentTurnEl.textContent = currentPlayer === 1 ? '흑돌' : '백돌';
  btnUndo.disabled = history.length === 0;
  if (selectBenefit) {
    selectBenefit.disabled = history.length > 0;
  }
  showCurrentTurnCenterHint();
}

function resetGame(fullResetScores = false) {
  stopTimer();
  board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
  starterPlayer = lastMatchWinner !== null ? nextFirstPlayer : 1;
  currentPlayer = starterPlayer;
  history = [];
  gameActive = true;
  winningLine = [];
  clearStones();
  clearPreview();
  if (fullResetScores) {
    scores = { black: 0, white: 0 };
    lastMatchWinner = null;
    nextFirstPlayer = 1;
    starterPlayer = 1;
    saveScores();
  }
  victoryModal.classList.remove('active');
  updateUIControls();
  startTimer();
  draw();
}

function undoMove() {
  if (history.length === 0) return;
  if (!gameActive) {
    gameActive = true;
    winningLine = [];
    victoryModal.classList.remove('active');
    const lastWinner = board[history[history.length - 1].y][history[history.length - 1].x];
    if (lastWinner === 1) scores.black = Math.max(0, scores.black - 1);
    if (lastWinner === 2) scores.white = Math.max(0, scores.white - 1);
    saveScores();
  }
  const lastMove = history.pop();
  board[lastMove.y][lastMove.x] = 0;
  removeStoneMesh(lastMove.x, lastMove.y);
  if (history.length > 0) {
    const previousMove = history[history.length - 1];
    updateLastMoveMarker(previousMove.x, previousMove.y);
  } else {
    updateLastMoveMarker(null, null);
  }
  if (history.length < 1 + benefitMoves) {
    currentPlayer = starterPlayer;
  } else {
    currentPlayer = lastMove.player;
  }
  updateUIControls();
  startTimer();
  draw();
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, e);

  if (activePointers.size === 2) {
    isPinching = true;
    const pointers = Array.from(activePointers.values());
    lastPinchDistance = getPointerDistance(pointers[0], pointers[1]);
    isDrawing = false;
    clearPreview();
    return;
  }

  if (!isPinching) {
    isDrawing = true;
    initAudio();
    handlePointerInput(e.clientX, e.clientY, false);
  }
});

canvas.addEventListener('pointermove', (e) => {
  e.preventDefault();
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, e);

  if (activePointers.size === 2) {
    isPinching = true;
    const pointers = Array.from(activePointers.values());
    const currentDistance = getPointerDistance(pointers[0], pointers[1]);
    const delta = (lastPinchDistance - currentDistance) * pinchZoomSpeed;
    updateCameraZoom(delta);
    lastPinchDistance = currentDistance;
    return;
  }

  if (isPinching) {
    return;
  }

  if (isDrawing) {
    handlePointerInput(e.clientX, e.clientY, false);
  } else {
    handlePointerInput(e.clientX, e.clientY, false);
  }
});

canvas.addEventListener('pointerup', (e) => {
  e.preventDefault();
  if (activePointers.has(e.pointerId)) {
    activePointers.delete(e.pointerId);
  }

  if (activePointers.size < 2) {
    isPinching = false;
    lastPinchDistance = 0;
  }

  if (isDrawing) {
    isDrawing = false;
    canvas.releasePointerCapture(e.pointerId);
    handlePointerInput(e.clientX, e.clientY, true);
  }
});

canvas.addEventListener('pointerleave', () => {
  isDrawing = false;
  isPinching = false;
  clearPreview();
  draw();
});

canvas.addEventListener('pointercancel', () => {
  isDrawing = false;
  isPinching = false;
  clearPreview();
  draw();
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY * wheelZoomSpeed * 0.1;
  updateCameraZoom(delta);
});

btnUndo.addEventListener('click', undoMove);
btnReset.addEventListener('click', () => {
  if (confirm('현재 대국을 기권하고 새 게임을 시작하시겠습니까?')) {
    resetGame(false);
  }
});
btnModalRestart.addEventListener('click', () => {
  resetGame(false);
});
btnThemeWood.addEventListener('click', () => {
  if (currentTheme !== 'wood') {
    currentTheme = 'wood';
    document.body.className = 'theme-wood';
    btnThemeWood.classList.add('active');
    btnThemeNeon.classList.remove('active');
    updateSceneTheme();
    draw();
  }
});
btnThemeNeon.addEventListener('click', () => {
  if (currentTheme !== 'neon') {
    currentTheme = 'neon';
    document.body.className = 'theme-neon';
    btnThemeNeon.classList.add('active');
    btnThemeWood.classList.remove('active');
    updateSceneTheme();
    draw();
  }
});
if (selectBenefit) {
  selectBenefit.addEventListener('change', (e) => {
    benefitMoves = parseInt(e.target.value, 10) || 0;
    resetGame(false);
  });
}

window.addEventListener('resize', resizeCanvas);

function initApp() {
  document.body.className = 'theme-wood';
  victoryModal.classList.remove('active');
  init3DScene();
  loadScores();
  updateUIControls();
  startTimer();
  draw();
}

initApp();
