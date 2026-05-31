/* ==========================================================================
   Omok Premium Game Engine
   ========================================================================== */

// 1. Constants and Settings
const BOARD_SIZE = 15;
const LOGICAL_SIZE = 600;
const PADDING = 38;
const CELL_SPACING = (LOGICAL_SIZE - 2 * PADDING) / (BOARD_SIZE - 1);
const STONE_RADIUS = CELL_SPACING * 0.44;
const TURN_LIMIT = 30; // 30 seconds countdown (초읽기)

// 2. Game State variables
let board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
let currentPlayer = 1; // 1 = Black, 2 = White
let history = [];
let gameActive = true;
let winningLine = [];
let activePreview = { x: -1, y: -1 };
let isDrawing = false;
let scores = { black: 0, white: 0 };
let currentTheme = 'wood';
let timeLeft = TURN_LIMIT;
let timerInterval = null;

// Procedural wood grain random seeds
const woodGrains = [];
function initWoodGrains() {
  woodGrains.length = 0;
  for (let i = 0; i < 8; i++) {
    woodGrains.push({
      yOffset: Math.random() * 200 - 100,
      amplitude: Math.random() * 30 + 10,
      freq: Math.random() * 0.003 + 0.001,
      lineWidth: Math.random() * 2 + 1,
      opacity: Math.random() * 0.04 + 0.02
    });
  }
}
initWoodGrains();

// 3. Audio Context & Synthesizer (Web Audio API)
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Synthesizes a synthetic warning beep for turn timer count downs.
 */
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
    console.warn("Warning beep failed:", e);
  }
}

/**
 * Synthesizes a realistic stone placement sound using physical modeling.
 * Black (slate) sounds heavier and deep; White (shell) sounds lighter and crisper.
 */
function playStoneSound(isWhite) {
  try {
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    
    // Master envelope for volume
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    // Instant attack for contact transient
    masterGain.gain.linearRampToValueAtTime(isWhite ? 0.38 : 0.42, now + 0.0015);
    // Organic exponential decay
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + (isWhite ? 0.08 : 0.12));
    
    // --- 1. Impact Transient (Click) ---
    // A high frequency pitch sweep representing the hard surfaces striking
    const clickOsc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(isWhite ? 3400 : 2900, now);
    clickOsc.frequency.exponentialRampToValueAtTime(isWhite ? 700 : 550, now + 0.004);
    
    clickGain.gain.setValueAtTime(1.0, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.004);
    
    clickOsc.connect(clickGain);
    clickGain.connect(masterGain);
    
    // --- 2. Board Resonance (Body "Tock") ---
    // Lower frequency hollow wood chamber tone
    const bodyOsc = audioCtx.createOscillator();
    const bodyGain = audioCtx.createGain();
    bodyOsc.type = 'triangle'; // Triangle is rich in warm wood-like odd harmonics
    
    const resonanceFreq = isWhite ? 220 : 180; // Black slate is heavier = lower pitch
    bodyOsc.frequency.setValueAtTime(resonanceFreq, now);
    // Micro pitch drop as vibration dampens
    bodyOsc.frequency.exponentialRampToValueAtTime(resonanceFreq * 0.88, now + 0.035);
    
    bodyGain.gain.setValueAtTime(0.7, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    
    // Lowpass filter to shape the tone warm and deep
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(550, now);
    
    bodyOsc.connect(bodyGain);
    bodyGain.connect(filter);
    filter.connect(masterGain);
    
    // --- 3. High-Freq Shell Ring / Slate Gritty Resonance ---
    const ringOsc = audioCtx.createOscillator();
    const ringGain = audioCtx.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(resonanceFreq * (isWhite ? 3.1 : 2.5), now);
    ringGain.gain.setValueAtTime(0.12, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    
    ringOsc.connect(ringGain);
    ringGain.connect(masterGain);
    
    // Output chain
    masterGain.connect(audioCtx.destination);
    
    // Trigger nodes
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

// 4. Setup Elements & Event Listeners
const canvas = document.getElementById('omok-canvas');
const ctx = canvas.getContext('2d');

const playerBlackCard = document.getElementById('player-black');
const playerWhiteCard = document.getElementById('player-white');
const scoreBlackEl = document.getElementById('score-black');
const scoreWhiteEl = document.getElementById('score-white');
const btnUndo = document.getElementById('btn-undo');
const btnReset = document.getElementById('btn-reset');
const btnThemeWood = document.getElementById('btn-theme-wood');
const btnThemeNeon = document.getElementById('btn-theme-neon');

// Modals
const victoryModal = document.getElementById('victory-modal');
const victoryTitle = document.getElementById('victory-title');
const victoryMessage = document.getElementById('victory-message');
const statMoves = document.getElementById('stat-moves');
const btnModalRestart = document.getElementById('btn-modal-restart');

// Timer elements
const countdownValEl = document.getElementById('countdown-val');
const timerProgressEl = document.getElementById('timer-progress');
const timerIconEl = document.querySelector('.timer-icon');

// Timer Logic Functions
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
    
    // Play a warning ticking beep at 5, 4, 3, 2, 1 seconds
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
  
  // The player who timed out loses! The other player wins.
  const winningPlayer = currentPlayer === 1 ? 2 : 1;
  
  if (winningPlayer === 1) {
    scores.black++;
    victoryTitle.textContent = "흑돌 승리! (시간 초과)";
    victoryMessage.textContent = "백돌(White)의 생각 시간이 초과되어 흑돌이 시간승 하였습니다.";
  } else {
    scores.white++;
    victoryTitle.textContent = "백돌 승리! (시간 초과)";
    victoryMessage.textContent = "흑돌(Black)의 생각 시간이 초과되어 백돌이 시간승 하였습니다.";
  }
  saveScores();
  
  statMoves.textContent = history.length;
  setTimeout(() => {
    victoryModal.classList.add('active');
  }, 750);
}

// Initialize Scores from LocalStorage
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
loadScores();

function saveScores() {
  localStorage.setItem('omok_score_data', JSON.stringify(scores));
  scoreBlackEl.textContent = scores.black;
  scoreWhiteEl.textContent = scores.white;
}

// 5. Drawing & Rendering Engine
function draw() {
  ctx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
  
  if (currentTheme === 'wood') {
    drawWoodBoard();
  } else {
    drawNeonBoard();
  }
  
  drawGrid();
  drawStarPoints();
  drawPreviewCursor();
  drawStones();
  drawWinningHighlight();
}

// Draw Classic Wooden Board Texture
function drawWoodBoard() {
  // Base wood background gradient
  const grad = ctx.createRadialGradient(
    LOGICAL_SIZE / 2, LOGICAL_SIZE / 2, 80,
    LOGICAL_SIZE / 2, LOGICAL_SIZE / 2, LOGICAL_SIZE * 0.7
  );
  grad.addColorStop(0, '#e5be85');
  grad.addColorStop(0.5, '#dfb275');
  grad.addColorStop(1, '#cb9958');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
  
  // Draw organic wood grains using sine-wave sweeps
  ctx.save();
  ctx.strokeStyle = '#624629';
  for (let grain of woodGrains) {
    ctx.lineWidth = grain.lineWidth;
    ctx.globalAlpha = grain.opacity;
    ctx.beginPath();
    for (let x = 0; x <= LOGICAL_SIZE; x += 10) {
      // Procedural noise curve
      const y = grain.yOffset + x * 0.8 + Math.sin(x * grain.freq) * grain.amplitude;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Draw Cyber Neon Board Texture
function drawNeonBoard() {
  // High contrast futuristic gradient
  const grad = ctx.createRadialGradient(
    LOGICAL_SIZE / 2, LOGICAL_SIZE / 2, 40,
    LOGICAL_SIZE / 2, LOGICAL_SIZE / 2, LOGICAL_SIZE * 0.7
  );
  grad.addColorStop(0, '#101018');
  grad.addColorStop(0.7, '#07070a');
  grad.addColorStop(1, '#020204');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
}

// Draw Board Grid Lines
function drawGrid() {
  ctx.save();
  
  if (currentTheme === 'neon') {
    // Cyber neon grids have a subtle glow
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 3;
  } else {
    // Wooden board lines
    ctx.strokeStyle = 'rgba(62, 45, 27, 0.3)';
    ctx.lineWidth = 1;
  }
  
  // Draw 15 horizontal and 15 vertical lines
  for (let i = 0; i < BOARD_SIZE; i++) {
    const pos = PADDING + i * CELL_SPACING;
    
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(PADDING, pos);
    ctx.lineTo(LOGICAL_SIZE - PADDING, pos);
    ctx.stroke();
    
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(pos, PADDING);
    ctx.lineTo(pos, LOGICAL_SIZE - PADDING);
    ctx.stroke();
  }
  ctx.restore();
}

// Draw traditional star points (Hoshi) on the board
function drawStarPoints() {
  const stars = [3, 7, 11]; // Standard intersections in 0-indexed form
  
  ctx.save();
  if (currentTheme === 'neon') {
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
  } else {
    ctx.fillStyle = '#3e2d1b';
    ctx.globalAlpha = 0.8;
  }
  
  for (let row of stars) {
    for (let col of stars) {
      const cx = PADDING + col * CELL_SPACING;
      const cy = PADDING + row * CELL_SPACING;
      
      ctx.beginPath();
      ctx.arc(cx, cy, currentTheme === 'neon' ? 3.5 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Draw Touch / Mouse hover snap preview
function drawPreviewCursor() {
  if (activePreview.x === -1 || activePreview.y === -1 || !gameActive) return;
  
  const cx = PADDING + activePreview.x * CELL_SPACING;
  const cy = PADDING + activePreview.y * CELL_SPACING;
  
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, STONE_RADIUS, 0, Math.PI * 2);
  
  if (currentTheme === 'neon') {
    const activeNeon = currentPlayer === 1 ? '#00f0ff' : '#ff007f';
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.strokeStyle = activeNeon;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = activeNeon;
    ctx.shadowBlur = 10;
    ctx.stroke();
    
    // Small center dot preview
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = activeNeon;
    ctx.fill();
  } else {
    // Wooden theme: Draw translucent stone outline
    ctx.strokeStyle = currentPlayer === 1 ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = currentPlayer === 1 ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.25)';
    ctx.fill();
  }
  ctx.restore();
}

// Draw Placed Stones (High-fidelity 3D modeling)
function drawStones() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const stone = board[r][c];
      if (stone === 0) continue;
      
      const cx = PADDING + c * CELL_SPACING;
      const cy = PADDING + r * CELL_SPACING;
      
      ctx.save();
      
      // 1. Drop shadow for stones
      ctx.shadowColor = currentTheme === 'neon' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(40, 30, 20, 0.25)';
      ctx.shadowBlur = currentTheme === 'neon' ? 6 : 5;
      ctx.shadowOffsetX = currentTheme === 'neon' ? 2 : 2.5;
      ctx.shadowOffsetY = currentTheme === 'neon' ? 3 : 3.5;
      
      // Draw stone base circle
      ctx.beginPath();
      ctx.arc(cx, cy, STONE_RADIUS, 0, Math.PI * 2);
      
      // 2. High-fidelity 3D gradients
      if (stone === 1) { // BLACK STONE
        const grad = ctx.createRadialGradient(
          cx - STONE_RADIUS * 0.18, cy - STONE_RADIUS * 0.18, STONE_RADIUS * 0.1,
          cx, cy, STONE_RADIUS
        );
        if (currentTheme === 'neon') {
          // Cyber style metallic black with cyan core reflection
          grad.addColorStop(0, '#4d6270');
          grad.addColorStop(0.35, '#1e242a');
          grad.addColorStop(0.85, '#0c0e11');
          grad.addColorStop(1, '#000000');
        } else {
          // Traditional shell/slate black stone
          grad.addColorStop(0, '#505050');
          grad.addColorStop(0.3, '#2a2a2a');
          grad.addColorStop(0.8, '#141414');
          grad.addColorStop(1, '#050505');
        }
        ctx.fillStyle = grad;
        ctx.fill();
        
      } else { // WHITE STONE
        const grad = ctx.createRadialGradient(
          cx - STONE_RADIUS * 0.25, cy - STONE_RADIUS * 0.25, STONE_RADIUS * 0.05,
          cx, cy, STONE_RADIUS
        );
        if (currentTheme === 'neon') {
          // Glossy cyber magenta white
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.4, '#fcdde7');
          grad.addColorStop(0.85, '#e0b5c4');
          grad.addColorStop(1, '#b08395');
        } else {
          // Elegant natural shell white stone
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.4, '#f5f5f5');
          grad.addColorStop(0.85, '#e1dfda');
          grad.addColorStop(1, '#c0beba');
        }
        ctx.fillStyle = grad;
        ctx.fill();
        
        // Add subtle contour borders to give it natural shell roundness
        ctx.shadowColor = 'transparent'; // Reset shadow for boundary strokes
        ctx.strokeStyle = currentTheme === 'neon' ? 'rgba(255, 0, 127, 0.25)' : 'rgba(0, 0, 0, 0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      // 3. Last played stone indicator (subtle center marker)
      const isLastMove = history.length > 0 && history[history.length - 1].x === c && history[history.length - 1].y === r;
      if (isLastMove && gameActive) {
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = currentTheme === 'neon' 
          ? (stone === 1 ? '#00f0ff' : '#ff007f') 
          : (stone === 1 ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.4)');
        ctx.fill();
      }
      
      ctx.restore();
    }
  }
}

// Draw pulsing glow overlay along the winning five-in-a-row path
function drawWinningHighlight() {
  if (winningLine.length === 0) return;
  
  ctx.save();
  ctx.beginPath();
  
  const startX = PADDING + winningLine[0].x * CELL_SPACING;
  const startY = PADDING + winningLine[0].y * CELL_SPACING;
  ctx.moveTo(startX, startY);
  
  for (let i = 1; i < winningLine.length; i++) {
    const x = PADDING + winningLine[i].x * CELL_SPACING;
    const y = PADDING + winningLine[i].y * CELL_SPACING;
    ctx.lineTo(x, y);
  }
  
  // Winning connection line glow styling
  if (currentTheme === 'neon') {
    const winnerColor = board[winningLine[0].y][winningLine[0].x] === 1 ? '#00f0ff' : '#ff007f';
    ctx.strokeStyle = winnerColor;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.shadowColor = winnerColor;
    ctx.shadowBlur = 18;
  } else {
    ctx.strokeStyle = 'rgba(209, 141, 76, 0.8)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
  }
  
  ctx.stroke();
  ctx.restore();
}

// 6. Responsive Scaling & High DPI Setup
function resizeCanvas() {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  
  // Update internal canvas resolution
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  
  // Reset transforming and apply scaling ratio
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(canvas.width / LOGICAL_SIZE, canvas.height / LOGICAL_SIZE);
  
  draw();
}

// Initialize Resize observer to handle dynamic canvas layout resizing
const resizeObserver = new ResizeObserver(() => {
  resizeCanvas();
});
resizeObserver.observe(canvas);

// 7. Input Event Handling (Touch Snapping Mechanics)
function handlePointerInput(clientX, clientY, isCommit = false) {
  if (!gameActive) return;
  
  const rect = canvas.getBoundingClientRect();
  
  // Compute local screen space coordinates
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  
  // Transform to 600x600 logical coordinate grid system
  const logicalX = (localX / rect.width) * LOGICAL_SIZE;
  const logicalY = (localY / rect.height) * LOGICAL_SIZE;
  
  // Determine closest intersection coordinates
  const gridX = Math.round((logicalX - PADDING) / CELL_SPACING);
  const gridY = Math.round((logicalY - PADDING) / CELL_SPACING);
  
  // Validate grid bounds
  if (gridX >= 0 && gridX < BOARD_SIZE && gridY >= 0 && gridY < BOARD_SIZE) {
    const isEmpty = board[gridY][gridX] === 0;
    
    if (isEmpty) {
      if (isCommit) {
        // Place stone
        placeStone(gridX, gridY);
        activePreview = { x: -1, y: -1 };
      } else {
        // Just update visual pointer preview coordinates
        if (activePreview.x !== gridX || activePreview.y !== gridY) {
          activePreview = { x: gridX, y: gridY };
          draw();
        }
      }
    } else {
      // Clear preview if hovering over already placed stone
      if (activePreview.x !== -1 || activePreview.y !== -1) {
        activePreview = { x: -1, y: -1 };
        draw();
      }
    }
  } else {
    // Clear preview if outside bounds
    if (activePreview.x !== -1 || activePreview.y !== -1) {
      activePreview = { x: -1, y: -1 };
      draw();
    }
  }
}

// Attaching Unified Pointer Events for immediate mobile responsiveness (disables 300ms double-tap delay)
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId); // Keep tracking cursor even if finger/mouse slides outside canvas
  isDrawing = true;
  initAudio(); // Warm up Web Audio Context immediately upon user tap
  handlePointerInput(e.clientX, e.clientY, false);
});

canvas.addEventListener('pointermove', (e) => {
  e.preventDefault();
  if (isDrawing) {
    handlePointerInput(e.clientX, e.clientY, false);
  } else {
    // Hover previews for mouse users
    handlePointerInput(e.clientX, e.clientY, false);
  }
});

canvas.addEventListener('pointerup', (e) => {
  e.preventDefault();
  if (isDrawing) {
    isDrawing = false;
    canvas.releasePointerCapture(e.pointerId);
    handlePointerInput(e.clientX, e.clientY, true);
  }
});

canvas.addEventListener('pointerleave', (e) => {
  isDrawing = false;
  activePreview = { x: -1, y: -1 };
  draw();
});

canvas.addEventListener('pointercancel', (e) => {
  isDrawing = false;
  activePreview = { x: -1, y: -1 };
  draw();
});

// 8. Game Mechanics & State Mutation Logic
function placeStone(x, y) {
  // Update state grid
  board[y][x] = currentPlayer;
  
  // Record stack move for Undo utility
  history.push({ x, y, player: currentPlayer });
  
  // Play realistic wooden synthesized click audio
  playStoneSound(currentPlayer === 2);
  
  // Redraw
  draw();
  
  // Check win state
  const isWin = checkWin(x, y);
  if (isWin) {
    triggerVictory(isWin);
  } else {
    // Toggle active player
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateUIControls();
    startTimer(); // Reset and start turn countdown for the next player!
    draw();
  }
}

// 5-in-a-row connection validation checker
function checkWin(x, y) {
  const targetColor = board[y][x];
  if (targetColor === 0) return null;
  
  // Grid direction vectors (Horizontal, Vertical, Diag Down-Right, Diag Up-Right)
  const directions = [
    { dx: 1, dy: 0 },  // Horizontal
    { dx: 0, dy: 1 },  // Vertical
    { dx: 1, dy: 1 },  // Diagonal Down-Right
    { dx: 1, dy: -1 }  // Diagonal Up-Right
  ];
  
  for (let dir of directions) {
    let matches = [{ x, y }];
    
    // Check Forward direction
    let r = y + dir.dy;
    let c = x + dir.dx;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === targetColor) {
      matches.push({ x: c, y: r });
      r += dir.dy;
      c += dir.dx;
    }
    
    // Check Backward direction
    r = y - dir.dy;
    c = x - dir.dx;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === targetColor) {
      matches.unshift({ x: c, y: r }); // Keep sorted chronologically along alignment
      r -= dir.dy;
      c -= dir.dx;
    }
    
    // Standard Freestyle Gomoku: 5 or more in a row triggers winning state
    if (matches.length >= 5) {
      return matches; // Return list of victory coordinates
    }
  }
  return null;
}

// Transition game state to victory
function triggerVictory(lineCoordinates) {
  stopTimer(); // Stop turn countdown immediately!
  gameActive = false;
  winningLine = lineCoordinates;
  draw();
  
  const winner = board[lineCoordinates[0].y][lineCoordinates[0].x];
  
  // Modify scoreboards
  if (winner === 1) {
    scores.black++;
    victoryTitle.textContent = "흑돌 승리!";
    victoryMessage.textContent = "흑돌(Black)이 5목을 먼저 달성하여 게임에서 이겼습니다.";
  } else {
    scores.white++;
    victoryTitle.textContent = "백돌 승리!";
    victoryMessage.textContent = "백돌(White)이 5목을 먼저 달성하여 게임에서 이겼습니다.";
  }
  saveScores();
  
  // Animate and trigger victory stats overlay
  statMoves.textContent = history.length;
  setTimeout(() => {
    victoryModal.classList.add('active');
  }, 750); // Small dramatic delay so players see the pulsing connection highlight first
}

// Update Active Turn HUD classes & disabled control flags
function updateUIControls() {
  if (currentPlayer === 1) {
    playerBlackCard.classList.add('active');
    playerWhiteCard.classList.remove('active');
  } else {
    playerWhiteCard.classList.add('active');
    playerBlackCard.classList.remove('active');
  }
  
  // Disable undo button if move history is empty or game over
  btnUndo.disabled = history.length === 0;
}

// Reset Game board parameters
function resetGame(fullResetScores = false) {
  stopTimer();
  board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
  currentPlayer = 1;
  history = [];
  gameActive = true;
  winningLine = [];
  activePreview = { x: -1, y: -1 };
  isDrawing = false;
  
  if (fullResetScores) {
    scores = { black: 0, white: 0 };
    saveScores();
  }
  
  victoryModal.classList.remove('active');
  updateUIControls();
  startTimer(); // Restart countdown for Black who goes first!
  draw();
}

// Undo Last Move State
function undoMove() {
  if (history.length === 0) return;
  
  // If game was over, reactivate it and clear overlays
  if (!gameActive) {
    gameActive = true;
    winningLine = [];
    victoryModal.classList.remove('active');
    
    // Deduct last added score
    const lastWinner = board[history[history.length - 1].y][history[history.length - 1].x];
    if (lastWinner === 1) scores.black = Math.max(0, scores.black - 1);
    if (lastWinner === 2) scores.white = Math.max(0, scores.white - 1);
    saveScores();
  }
  
  const lastMove = history.pop();
  board[lastMove.y][lastMove.x] = 0;
  
  // Set turn to player who made that move
  currentPlayer = lastMove.player;
  
  updateUIControls();
  startTimer(); // Restart turn countdown for the reverted active player!
  draw();
}

// 9. Buttons event registrations
btnUndo.addEventListener('click', undoMove);

btnReset.addEventListener('click', () => {
  if (confirm('현재 대국을 기권하고 새 게임을 시작하시겠습니까?')) {
    resetGame(false);
  }
});

btnModalRestart.addEventListener('click', () => {
  resetGame(false);
});

// Theme Switching Listeners
btnThemeWood.addEventListener('click', () => {
  if (currentTheme !== 'wood') {
    currentTheme = 'wood';
    document.body.className = 'theme-wood';
    btnThemeWood.classList.add('active');
    btnThemeNeon.classList.remove('active');
    initWoodGrains(); // Regenerate grain details for organic appearance
    draw();
  }
});

btnThemeNeon.addEventListener('click', () => {
  if (currentTheme !== 'neon') {
    currentTheme = 'neon';
    document.body.className = 'theme-neon';
    btnThemeNeon.classList.add('active');
    btnThemeWood.classList.remove('active');
    draw();
  }
});

// Main execution bootstrapping
updateUIControls();
startTimer(); // Start turn countdown for Black on page load!
draw();
