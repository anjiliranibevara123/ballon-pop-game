/* ==========================================================================
   GESTURE BALLOON POP - ENGINEERS' DAY 2026 EDITION
   Core Game Engine & MediaPipe AI Hand Tracking
   ========================================================================== */

// --- Global Application State ---
const state = {
  screen: 'HOME', // HOME, GAME, GAME_OVER
  score: 0,
  bestScore: parseInt(localStorage.getItem('gbp_best_score')) || 0,
  lastScore: parseInt(localStorage.getItem('gbp_last_score')) || 0,
  timeLeft: 30,
  timerInterval: null,
  difficulty: 'EASY', // EASY, MEDIUM, HARD
  wave: 1,
  
  // Multipliers & Combos
  combo: 0,
  multiplier: 1,
  misses: 0,
  
  // Special Mechanics & Timers
  freezeTimer: 0,
  speedMultiplier: 1.0,
  isCountingDown: false,
  
  // Game Statistics
  balloonsPopped: 0,
  goldenPopped: 0,
  specialPopped: 0,
  bombsHit: 0,
  totalTouches: 0,
  
  // Hand & Mouse/Touch Gesture Data
  handDetected: false,
  isPinching: false,
  wasPinching: false,
  pinchJustTriggered: false,
  pinchDist: 1.0,
  fingertip: { x: window.innerWidth / 2, y: window.innerHeight / 2, smoothX: window.innerWidth / 2, smoothY: window.innerHeight / 2 },
  cursor: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  mousePos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  
  // Settings & Canvas
  isMuted: false,
  canvas: null,
  ctx: null,
  gameLoopId: null,
  
  // Game Entities
  balloons: [],
  particles: [],
  popTexts: [],
  maxBalloons: 6
};

// --- Pre-populated Engineers' Day Leaderboard Defaults ---
const DEFAULT_LEADERBOARD = [
  { name: 'Rahul (EE)', score: 850, balloons: 72, date: '2026-09-08' },
  { name: 'Anjali (CSE)', score: 790, balloons: 65, date: '2026-09-08' },
  { name: 'Sravani (ECE)', score: 720, balloons: 58, date: '2026-09-08' },
  { name: 'Kiran (ME)', score: 650, balloons: 52, date: '2026-09-08' },
  { name: 'Varun (CIVIL)', score: 590, balloons: 48, date: '2026-09-08' }
];

// ==========================================================================
// 1. WEB AUDIO SYNTHESIZER MODULE (Zero External Audio Dependencies)
// ==========================================================================
class SoundEngine {
  constructor() {
    this.audioCtx = null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playPop() {
    if (state.isMuted) return;
    this.init();
    const now = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  playGoldenPop() {
    if (state.isMuted) return;
    this.init();
    const now = this.audioCtx.currentTime;

    [880, 1320, 1760].forEach((freq, index) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.04);

      gain.gain.setValueAtTime(0.25, now + index * 0.04);
      gain.gain.linearRampToValueAtTime(0.01, now + index * 0.04 + 0.12);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now + index * 0.04);
      osc.stop(now + index * 0.04 + 0.12);
    });
  }

  playSpecialPop() {
    if (state.isMuted) return;
    this.init();
    const now = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.18);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  playBomb() {
    if (state.isMuted) return;
    this.init();
    const now = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  playTick() {
    if (state.isMuted) return;
    this.init();
    const now = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.04);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  playGameOver() {
    if (state.isMuted) return;
    this.init();
    const now = this.audioCtx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    chord.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.2, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  }

  playFreeze() {
    if (state.isMuted) return;
    this.init();
    const now = this.audioCtx.currentTime;
    [1000, 800, 600, 400].forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.2, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.05 + 0.15);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.15);
    });
  }

  playTimeBonus() {
    if (state.isMuted) return;
    this.init();
    const now = this.audioCtx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.25, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.04 + 0.1);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.1);
    });
  }

  playSplit() {
    if (state.isMuted) return;
    this.init();
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

const sounds = new SoundEngine();

// ==========================================================================
// 2. BALLOON ENTITY CLASS & TYPES
// ==========================================================================
class Balloon {
  constructor(canvasWidth, canvasHeight, difficulty) {
    this.width = canvasWidth;
    this.height = canvasHeight;
    this.reset(difficulty);
  }

  reset(difficulty) {
    const rand = Math.random();
    const wave = state.wave || 1;

    if (wave === 1) {
      if (rand < 0.70) this.type = 'NORMAL';
      else if (rand < 0.88) this.type = 'BONUS';
      else this.type = 'TIME';
    } else if (wave === 2) {
      if (rand < 0.45) this.type = 'NORMAL';
      else if (rand < 0.65) this.type = 'BONUS';
      else if (rand < 0.78) this.type = 'TIME';
      else if (rand < 0.88) this.type = 'FREEZE';
      else this.type = 'SPEED';
    } else { // WAVE 3+
      if (rand < 0.30) this.type = 'NORMAL';
      else if (rand < 0.48) this.type = 'BONUS';
      else if (rand < 0.60) this.type = 'TIME';
      else if (rand < 0.72) this.type = 'FREEZE';
      else if (rand < 0.82) this.type = 'SPLIT';
      else if (rand < 0.90) this.type = 'SPEED';
      else this.type = 'BOMB';
    }

    if (this.type === 'BOMB') {
      this.radius = 34;
      this.color = '#1e293b';
      this.points = -20;
    } else if (this.type === 'SPLIT') {
      this.radius = 42;
      this.color = '#a855f7';
      this.points = 15;
    } else if (this.type === 'FREEZE') {
      this.radius = 40;
      this.color = '#00f3ff';
      this.points = 20;
    } else if (this.type === 'TIME') {
      this.radius = 42;
      this.color = '#00ff88';
      this.points = 15;
    } else if (this.type === 'SPEED') {
      this.radius = 32;
      this.color = '#ffb703';
      this.points = 40;
    } else if (this.type === 'BONUS') {
      this.radius = 44;
      this.color = '#ffd700';
      this.points = 35;
    } else if (this.type === 'MINI') {
      this.radius = 24;
      this.color = '#e879f9';
      this.points = 15;
    } else { // NORMAL
      this.radius = 46;
      const normalColors = ['#ff0055', '#00f3ff', '#00ff88', '#ff9900', '#a855f7'];
      this.color = normalColors[Math.floor(Math.random() * normalColors.length)];
      this.points = 10;
    }

    const margin = this.radius + 30;
    this.x = margin + Math.random() * (this.width - margin * 2);
    this.y = this.height + this.radius + Math.random() * 80;

    let baseSpeed = difficulty === 'EASY' ? 2.0 : (difficulty === 'MEDIUM' ? 2.8 : 3.8);
    if (this.type === 'SPEED') baseSpeed *= 1.7;
    if (this.type === 'MINI') baseSpeed *= 1.4;
    this.speedY = baseSpeed + Math.random() * 1.2;

    this.wobblePhase = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.03 + Math.random() * 0.03;
    this.wobbleAmplitude = 1.2 + Math.random() * 1.5;

    this.popped = false;
  }

  update() {
    const effectiveSpeed = this.speedY * state.speedMultiplier;
    this.y -= effectiveSpeed;
    this.wobblePhase += this.wobbleSpeed;
    this.x += Math.sin(this.wobblePhase) * this.wobbleAmplitude;

    if (this.y < -this.radius - 20) {
      if (this.type !== 'BOMB' && !this.popped && state.screen === 'GAME' && !state.isCountingDown) {
        state.misses++;
        state.combo = 0;
        state.multiplier = 1;
        state.popTexts.push(new PopText(this.x, 30, 'MISSED!', '#94a3b8'));
        updateHUD();
      }
      this.reset(state.difficulty);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === 'BOMB') {
      // Draw Spiked Metal Bomb 💣
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, 2, 0, 0, this.radius);
      grad.addColorStop(0, '#475569');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fill();

      // Glowing Fuse Cap
      ctx.beginPath();
      ctx.arc(0, -this.radius + 2, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0055';
      ctx.fill();

      // Burning Fuse Spark
      ctx.beginPath();
      ctx.arc(Math.sin(Date.now() * 0.01) * 4, -this.radius - 8, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.fill();

      // Bomb Symbol Icon
      ctx.fillStyle = '#ff0055';
      ctx.font = `${this.radius * 0.9}px Outfit`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💣', 0, 2);

    } else {
      // Draw 3D Glossy Balloon 🎈
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius * 0.85, this.radius, 0, 0, Math.PI * 2);

      const grad = ctx.createRadialGradient(
        -this.radius * 0.3, -this.radius * 0.3, this.radius * 0.1,
        0, 0, this.radius
      );

      if (this.type === 'GOLDEN') {
        grad.addColorStop(0, '#fff6a5');
        grad.addColorStop(0.5, '#ffd700');
        grad.addColorStop(1, '#b8860b');
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15;
      } else if (this.type === 'SPECIAL') {
        const pulse = (Math.sin(Date.now() * 0.008) + 1) / 2;
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, pulse > 0.5 ? '#9d4edd' : '#00f3ff');
        grad.addColorStop(1, '#4c1d95');
        ctx.shadowColor = '#9d4edd';
        ctx.shadowBlur = 20;
      } else { // NORMAL
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, this.color);
        grad.addColorStop(1, '#000000');
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
      }

      ctx.fillStyle = grad;
      ctx.fill();

      // Shiny Specular Highlight
      ctx.beginPath();
      ctx.ellipse(-this.radius * 0.35, -this.radius * 0.35, this.radius * 0.25, this.radius * 0.15, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fill();

      // Balloon Knot
      ctx.beginPath();
      ctx.moveTo(-5, this.radius - 2);
      ctx.lineTo(5, this.radius - 2);
      ctx.lineTo(0, this.radius + 6);
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();

      // Wavy String Tail
      ctx.beginPath();
      ctx.moveTo(0, this.radius + 6);
      const wave = Math.sin(this.wobblePhase * 2) * 8;
      ctx.quadraticCurveTo(wave, this.radius + 20, -wave / 2, this.radius + 35);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Badge for Special Balloon Icons
      if (this.type === 'BONUS' || this.type === 'GOLDEN' || this.type === 'SPECIAL') {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${this.radius * 0.48}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+${this.points}`, 0, 0);
      } else if (this.type === 'TIME') {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${this.radius * 0.55}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⏱️', 0, 0);
      } else if (this.type === 'FREEZE') {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${this.radius * 0.55}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❄️', 0, 0);
      } else if (this.type === 'SPLIT') {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${this.radius * 0.55}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💥', 0, 0);
      } else if (this.type === 'SPEED') {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${this.radius * 0.55}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, 0);
      }
    }

    ctx.restore();
  }
}

// ==========================================================================
// 3. PARTICLE & POP FX SYSTEM
// ==========================================================================
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = 3 + Math.random() * 5;
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.alpha = 1;
    this.decay = 0.02 + Math.random() * 0.03;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.15; // Gravity
    this.alpha -= this.decay;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }
}

class PopText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.alpha = 1;
    this.vy = -2;
  }

  update() {
    this.y += this.vy;
    this.alpha -= 0.025;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.font = 'bold 24px Orbitron';
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// ==========================================================================
// 4. MEDIAPIPE AI HAND TRACKING & WEBCAM ENGINE
// ==========================================================================
let handsTracker = null;

function initHandTracking() {
  const videoElement = document.getElementById('webcamVideo');
  const trackingStatus = document.getElementById('trackingStatus');
  const statusText = document.getElementById('statusText');
  const loadingOverlay = document.getElementById('loadingOverlay');

  // Check MediaPipe CDN readiness
  if (typeof window.Hands === 'undefined') {
    console.warn('MediaPipe Hands script not loaded yet, retrying...');
    setTimeout(initHandTracking, 500);
    return;
  }

  handsTracker = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  handsTracker.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  handsTracker.onResults(onHandResults);

  // Request browser webcam stream
  navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } })
    .then((stream) => {
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        
        // Process frames automatically
        const camera = new window.Camera(videoElement, {
          onFrame: async () => {
            if (state.screen === 'GAME') {
              await handsTracker.send({ image: videoElement });
            }
          },
          width: 1280,
          height: 720
        });
        camera.start();
        
        loadingOverlay.classList.add('hidden');
        trackingStatus.className = 'tracking-status active';
        statusText.innerText = 'HAND TRACKED';
      };
    })
    .catch((err) => {
      console.error('Camera access denied or missing:', err);
      loadingOverlay.classList.add('hidden');
      showModal('cameraErrorModal');
    });
}

function onHandResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    state.handDetected = true;
    const landmarks = results.multiHandLandmarks[0];

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const targetX = (1 - indexTip.x) * state.canvas.width;
    const targetY = indexTip.y * state.canvas.height;

    state.fingertip.smoothX += (targetX - state.fingertip.smoothX) * 0.55;
    state.fingertip.smoothY += (targetY - state.fingertip.smoothY) * 0.55;
    state.fingertip.x = state.fingertip.smoothX;
    state.fingertip.y = state.fingertip.smoothY;

    state.cursor.x = state.fingertip.x;
    state.cursor.y = state.fingertip.y;

    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const dist = Math.hypot(dx, dy);

    state.pinchDist = dist;
    const isPinchNow = dist < 0.075;

    if (isPinchNow && !state.wasPinching) {
      state.pinchJustTriggered = true;
    } else {
      state.pinchJustTriggered = false;
    }
    state.wasPinching = isPinchNow;
    state.isPinching = isPinchNow;

    const gestureBadge = document.getElementById('gestureStatusBadge');
    if (gestureBadge) {
      if (state.isPinching) {
        gestureBadge.innerText = '👌 PINCH!';
        gestureBadge.classList.add('pinching');
      } else {
        gestureBadge.innerText = '✋ HOVERING';
        gestureBadge.classList.remove('pinching');
      }
    }

    document.getElementById('trackingStatus').className = 'tracking-status active';
    document.getElementById('statusText').innerText = 'HAND TRACKED';
  } else {
    state.handDetected = false;
    state.isPinching = false;
    state.wasPinching = false;
    state.cursor.x = state.mousePos.x;
    state.cursor.y = state.mousePos.y;

    const gestureBadge = document.getElementById('gestureStatusBadge');
    if (gestureBadge) {
      gestureBadge.innerText = '🖱️ MOUSE';
      gestureBadge.classList.remove('pinching');
    }

    document.getElementById('trackingStatus').className = 'tracking-status searching';
    document.getElementById('statusText').innerText = 'SEARCHING HAND (MOUSE MODE)';
  }
}

// ==========================================================================
// 5. GAME LOOP, COLLISION PHYSICS & RENDERING
// ==========================================================================
function startNewGame() {
  state.screen = 'GAME';
  state.score = 0;
  state.timeLeft = 30;
  state.difficulty = 'EASY';
  state.wave = 1;
  state.combo = 0;
  state.multiplier = 1;
  state.misses = 0;
  state.balloonsPopped = 0;
  state.goldenPopped = 0;
  state.specialPopped = 0;
  state.bombsHit = 0;
  state.totalTouches = 0;
  state.freezeTimer = 0;
  state.speedMultiplier = 1.0;

  const vignette = document.getElementById('freezeVignette');
  if (vignette) vignette.classList.add('hidden');

  updateHUD();

  state.canvas = document.getElementById('gameCanvas');
  state.ctx = state.canvas.getContext('2d');
  resizeCanvas();

  setupCanvasInputListeners();

  state.cursor.x = state.canvas.width / 2;
  state.cursor.y = state.canvas.height / 2;
  state.mousePos.x = state.canvas.width / 2;
  state.mousePos.y = state.canvas.height / 2;

  state.balloons = [];
  state.particles = [];
  state.popTexts = [];

  for (let i = 0; i < state.maxBalloons; i++) {
    state.balloons.push(new Balloon(state.canvas.width, state.canvas.height, state.difficulty));
  }

  showScreen('gameScreen');

  runCountdown(() => {
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(gameTimerTick, 1000);

    if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
    gameLoop();
  });
}

function runCountdown(callback) {
  state.isCountingDown = true;
  const overlay = document.getElementById('countdownOverlay');
  const num = document.getElementById('countdownNumber');
  if (!overlay || !num) {
    state.isCountingDown = false;
    callback();
    return;
  }

  overlay.classList.remove('hidden');
  let count = 3;
  num.innerText = count;

  const countTimer = setInterval(() => {
    count--;
    if (count > 0) {
      num.innerText = count;
      sounds.playTick();
    } else if (count === 0) {
      num.innerText = 'GO!';
      sounds.playGoldenPop();
    } else {
      clearInterval(countTimer);
      overlay.classList.add('hidden');
      state.isCountingDown = false;
      showWaveBanner('🌊 WAVE 1', 'GET READY TO POP!');
      callback();
    }
  }, 850);
}

function showWaveBanner(title, sub) {
  const banner = document.getElementById('waveBanner');
  const titleEl = document.getElementById('waveBannerTitle');
  const subEl = document.getElementById('waveBannerSub');
  if (banner && titleEl && subEl) {
    titleEl.innerText = title;
    subEl.innerText = sub;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 2000);
  }
}

function gameTimerTick() {
  if (state.isCountingDown) return;

  state.timeLeft--;

  // Handle freeze timer countdown
  if (state.freezeTimer > 0) {
    state.freezeTimer -= 1000;
    if (state.freezeTimer <= 0) {
      state.speedMultiplier = 1.0;
      const vignette = document.getElementById('freezeVignette');
      if (vignette) vignette.classList.add('hidden');
    }
  }

  // Wave & Difficulty Progression
  const elapsed = 30 - state.timeLeft;

  if (elapsed === 10 && state.wave === 1) {
    state.wave = 2;
    state.difficulty = 'MEDIUM';
    showWaveBanner('🌊 WAVE 2', 'FREEZE & TIME BALLOONS UNLOCKED!');
  } else if (elapsed === 20 && state.wave === 2) {
    state.wave = 3;
    state.difficulty = 'HARD';
    showWaveBanner('🌊 WAVE 3', 'SPLIT & BOMB HAZARDS ACTIVE!');
  }

  if (state.timeLeft <= 5 && state.timeLeft > 0) {
    sounds.playTick();
  }

  updateHUD();

  if (state.timeLeft <= 0) {
    endGame();
  }
}

function gameLoop() {
  if (state.screen !== 'GAME') return;

  const ctx = state.ctx;
  ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);

  // 1. Update & Draw Balloons
  state.balloons.forEach((balloon) => {
    balloon.update();
    balloon.draw(ctx);

    // Collision Detection: Trigger pop when pinching OR mouse/touch active
    if (!balloon.popped && !state.isCountingDown) {
      const dx = state.cursor.x - balloon.x;
      const dy = state.cursor.y - balloon.y;
      const dist = Math.hypot(dx, dy);

      const isHovering = dist < balloon.radius + 20;
      const shouldPop = isHovering && (state.isPinching || !state.handDetected);

      if (shouldPop) {
        popBalloon(balloon);
      }
    }
  });

  // 2. Update & Draw Explosion Particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.update();
    p.draw(ctx);
    if (p.alpha <= 0) state.particles.splice(i, 1);
  }

  // 3. Update & Draw Score Pop Texts
  for (let i = state.popTexts.length - 1; i >= 0; i--) {
    const pt = state.popTexts[i];
    pt.update();
    pt.draw(ctx);
    if (pt.alpha <= 0) state.popTexts.splice(i, 1);
  }

  // 4. Always Draw Laser Reticle Cursor
  drawFingertipCursor(ctx, state.cursor.x, state.cursor.y);

  state.gameLoopId = requestAnimationFrame(gameLoop);
}

function popBalloon(balloon) {
  balloon.popped = true;
  state.totalTouches++;

  if (balloon.type === 'BOMB') {
    state.bombsHit++;
    state.combo = 0;
    state.multiplier = 1;
    sounds.playBomb();
    triggerScreenShake();
    state.score = Math.max(0, state.score + balloon.points);
    state.popTexts.push(new PopText(balloon.x, balloon.y - 10, '-20 (COMBO RESET)', '#ff0055'));
  } else {
    state.balloonsPopped++;
    state.combo++;
    state.multiplier = Math.min(5, Math.floor(state.combo / 3) + 1);

    const earnedPoints = balloon.points * state.multiplier;
    state.score += earnedPoints;

    let popLabel = `+${earnedPoints}`;
    if (state.multiplier > 1) popLabel += ` (${state.multiplier}x)`;

    if (balloon.type === 'TIME') {
      state.timeLeft = Math.min(60, state.timeLeft + 5);
      sounds.playTimeBonus();
      state.popTexts.push(new PopText(balloon.x, balloon.y - 10, '+5s TIME!', '#00ff88'));
    } else if (balloon.type === 'FREEZE') {
      triggerFreezeEffect();
      sounds.playFreeze();
      state.popTexts.push(new PopText(balloon.x, balloon.y - 10, '❄️ FREEZE (4s)!', '#00f3ff'));
    } else if (balloon.type === 'SPLIT') {
      spawnMiniBalloons(balloon.x, balloon.y);
      sounds.playSplit();
      state.popTexts.push(new PopText(balloon.x, balloon.y - 10, '💥 SPLIT!', '#a855f7'));
    } else if (balloon.type === 'BONUS' || balloon.type === 'GOLDEN') {
      state.goldenPopped++;
      sounds.playGoldenPop();
      state.popTexts.push(new PopText(balloon.x, balloon.y - 10, popLabel, '#ffd700'));
    } else if (balloon.type === 'SPEED') {
      sounds.playSpecialPop();
      state.popTexts.push(new PopText(balloon.x, balloon.y - 10, `${popLabel} ⚡`, '#ffb703'));
    } else {
      sounds.playPop();
      state.popTexts.push(new PopText(balloon.x, balloon.y - 10, popLabel, balloon.color));
    }
  }

  const particleColor = balloon.type === 'BOMB' ? '#ff0055' : balloon.color;
  for (let i = 0; i < 18; i++) {
    state.particles.push(new Particle(balloon.x, balloon.y, particleColor));
  }

  updateHUD();

  if (balloon.type !== 'MINI') {
    balloon.reset(state.difficulty);
  }
}

function spawnMiniBalloons(x, y) {
  for (let i = 0; i < 3; i++) {
    const mini = new Balloon(state.canvas.width, state.canvas.height, state.difficulty);
    mini.type = 'MINI';
    mini.radius = 24;
    mini.color = '#e879f9';
    mini.points = 15;
    mini.x = x + (i - 1) * 35;
    mini.y = y;
    mini.speedY = 3.5 + Math.random() * 1.5;
    state.balloons.push(mini);
  }
}

function triggerFreezeEffect() {
  state.freezeTimer = 4000;
  state.speedMultiplier = 0.4;
  const vignette = document.getElementById('freezeVignette');
  if (vignette) vignette.classList.remove('hidden');
}

function triggerScreenShake() {
  const gameScreen = document.getElementById('gameScreen');
  if (gameScreen) {
    gameScreen.classList.add('screen-shake');
    setTimeout(() => gameScreen.classList.remove('screen-shake'), 450);
  }
}

function drawFingertipCursor(ctx, x, y) {
  ctx.save();

  const isPinch = state.isPinching;
  const color = isPinch ? '#ff007f' : '#00f3ff';
  const radius = isPinch ? 16 : 24;

  const pulse = Math.sin(Date.now() * 0.015) * 3;
  ctx.beginPath();
  ctx.arc(x, y, radius + pulse, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = isPinch ? 4 : 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.stroke();

  // Crosshair Ticks
  const tickLen = 8;
  ctx.beginPath();
  ctx.moveTo(x - radius - tickLen, y); ctx.lineTo(x - radius + 2, y);
  ctx.moveTo(x + radius + tickLen, y); ctx.lineTo(x + radius - 2, y);
  ctx.moveTo(x, y - radius - tickLen); ctx.lineTo(x, y - radius + 2);
  ctx.moveTo(x, y + radius + tickLen); ctx.lineTo(x, y + radius - 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner Core Dot
  ctx.beginPath();
  ctx.arc(x, y, isPinch ? 9 : 5, 0, Math.PI * 2);
  ctx.fillStyle = isPinch ? '#ffffff' : '#ff0055';
  ctx.shadowColor = isPinch ? '#ff007f' : '#ff0055';
  ctx.shadowBlur = 20;
  ctx.fill();

  // Status Text next to reticle
  ctx.font = '700 11px Orbitron';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillText(isPinch ? '👌 PINCH!' : '✋ POINT', x + radius + 10, y + 4);

  ctx.restore();
}

function updateHUD() {
  document.getElementById('scoreDisplay').innerText = state.score;
  document.getElementById('timerDisplay').innerText = state.timeLeft;
  document.getElementById('balloonsPoppedDisplay').innerText = state.balloonsPopped;

  const comboEl = document.getElementById('comboDisplay');
  if (comboEl) comboEl.innerText = `${state.multiplier}x`;

  const waveEl = document.getElementById('waveDisplay');
  if (waveEl) waveEl.innerText = `WAVE ${state.wave}`;

  const badge = document.getElementById('difficultyBadge');
  badge.innerText = state.difficulty;
  badge.className = `difficulty-badge level-${state.difficulty.toLowerCase()}`;
}

// ==========================================================================
// 6. GAME OVER, SCORE CARD & LEADERBOARD SYSTEM
// ==========================================================================
function endGame() {
  state.screen = 'GAME_OVER';
  clearInterval(state.timerInterval);
  cancelAnimationFrame(state.gameLoopId);

  sounds.playGameOver();

  // Save Last & Best Score
  state.lastScore = state.score;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem('gbp_best_score', state.bestScore);
  }
  localStorage.setItem('gbp_last_score', state.lastScore);

  // Update Game Over Modal Displays
  document.getElementById('finalScoreDisplay').innerText = state.score;
  document.getElementById('statPopped').innerText = state.balloonsPopped;
  document.getElementById('statGolden').innerText = state.goldenPopped + state.specialPopped;
  document.getElementById('statBombs').innerText = state.bombsHit;

  const accuracy = state.totalTouches > 0 ? Math.round((state.balloonsPopped / state.totalTouches) * 100) : 100;
  document.getElementById('statAccuracy').innerText = `${accuracy}%`;

  // Generate Engineers' Day Canvas Score Card
  generateScoreCardBadge();

  showModal('gameOverModal');
}

function generateScoreCardBadge() {
  const cardCanvas = document.getElementById('scoreCardCanvas');
  const c = cardCanvas.getContext('2d');

  // Background gradient
  const grad = c.createLinearGradient(0, 0, 400, 200);
  grad.addColorStop(0, '#0a0e1d');
  grad.addColorStop(1, '#020617');
  c.fillStyle = grad;
  c.fillRect(0, 0, 400, 200);

  // Glowing Cyber Border
  const borderGrad = c.createLinearGradient(0, 0, 400, 200);
  borderGrad.addColorStop(0, '#00f3ff');
  borderGrad.addColorStop(0.5, '#a855f7');
  borderGrad.addColorStop(1, '#ff007f');
  c.strokeStyle = borderGrad;
  c.lineWidth = 3;
  c.strokeRect(5, 5, 390, 190);

  // Title & Header
  c.fillStyle = '#00f3ff';
  c.font = 'bold 16px "Chakra Petch", Orbitron';
  c.fillText("🚀 ENGINEERS' DAY 2026", 20, 35);

  c.fillStyle = '#94a3b8';
  c.font = '12px "Space Grotesk", Outfit';
  c.fillText('Gesture Balloon Pop Challenge', 20, 55);

  // Multi-stop Cyber Score Gradient (Replaced plain yellow)
  const scoreGrad = c.createLinearGradient(20, 0, 260, 0);
  scoreGrad.addColorStop(0, '#00f3ff');
  scoreGrad.addColorStop(0.4, '#a855f7');
  scoreGrad.addColorStop(1, '#ff007f');
  c.fillStyle = scoreGrad;
  c.font = '900 40px "Chakra Petch", Orbitron';
  c.fillText(`${state.score} PTS`, 20, 112);

  // Stats text
  c.fillStyle = '#f8fafc';
  c.font = '600 13px "Space Grotesk", Outfit';
  c.fillText(`🎈 Popped: ${state.balloonsPopped}  •  💣 Bombs: ${state.bombsHit}`, 20, 145);

  // Timestamp footer
  const dateStr = new Date().toLocaleDateString();
  c.fillStyle = '#64748b';
  c.font = '11px "Space Grotesk", Outfit';
  c.fillText(`Date: ${dateStr} • Top Engineer Performance Badge`, 20, 175);
}

function getLeaderboard() {
  const stored = localStorage.getItem('gbp_leaderboard');
  if (!stored) {
    localStorage.setItem('gbp_leaderboard', JSON.stringify(DEFAULT_LEADERBOARD));
    return DEFAULT_LEADERBOARD;
  }
  return JSON.parse(stored);
}

function saveLeaderboardEntry(name, score, balloons) {
  if (!name.trim()) name = 'Anonymous Engineer';
  const list = getLeaderboard();
  const dateStr = new Date().toISOString().split('T')[0];

  list.push({ name: name.trim(), score, balloons, date: dateStr });
  list.sort((a, b) => b.score - a.score);

  const top10 = list.slice(0, 10);
  localStorage.setItem('gbp_leaderboard', JSON.stringify(top10));
  renderLeaderboardTable();
}

function renderLeaderboardTable() {
  const tbody = document.getElementById('leaderboardTbody');
  const list = getLeaderboard();

  tbody.innerHTML = '';
  list.forEach((entry, idx) => {
    const tr = document.createElement('tr');
    const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx + 1}`));
    tr.innerHTML = `
      <td>${medal}</td>
      <td><strong>${escapeHtml(entry.name)}</strong></td>
      <td>${entry.score}</td>
      <td>${entry.balloons}</td>
      <td>${entry.date}</td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

// ==========================================================================
// 7. UI EVENT LISTENERS & NAVIGATION ROUTING
// ==========================================================================
function setupEventListeners() {
  // Navigation Buttons
  document.getElementById('startGameBtn').addEventListener('click', () => {
    sounds.init();
    startNewGame();
  });

  document.getElementById('howToPlayBtn').addEventListener('click', () => {
    showModal('howToPlayModal');
  });

  document.getElementById('closeHowToPlayBtn').addEventListener('click', () => {
    hideModal('howToPlayModal');
  });

  document.getElementById('startFromGuideBtn').addEventListener('click', () => {
    hideModal('howToPlayModal');
    sounds.init();
    startNewGame();
  });

  document.getElementById('viewLeaderboardBtn').addEventListener('click', () => {
    renderLeaderboardTable();
    showModal('leaderboardModal');
  });

  document.getElementById('closeLeaderboardBtn').addEventListener('click', () => {
    hideModal('leaderboardModal');
  });

  document.getElementById('closeLeaderboardFooterBtn').addEventListener('click', () => {
    hideModal('leaderboardModal');
  });

  document.getElementById('leaderboardHomeBtn').addEventListener('click', () => {
    hideModal('leaderboardModal');
    exitGameToHome();
  });

  document.getElementById('exitGameBtn').addEventListener('click', () => {
    exitGameToHome();
  });

  document.getElementById('playAgainBtn').addEventListener('click', () => {
    hideModal('gameOverModal');
    startNewGame();
  });

  document.getElementById('overLeaderboardBtn').addEventListener('click', () => {
    hideModal('gameOverModal');
    renderLeaderboardTable();
    showModal('leaderboardModal');
  });

  document.getElementById('homeBtn').addEventListener('click', () => {
    hideModal('gameOverModal');
    updateHomeScreenScores();
    showScreen('homeScreen');
  });

  document.getElementById('retryCameraBtn').addEventListener('click', () => {
    hideModal('cameraErrorModal');
    document.getElementById('loadingOverlay').classList.remove('hidden');
    initHandTracking();
  });

  const playMouseBtn = document.getElementById('playMouseBtn');
  if (playMouseBtn) {
    playMouseBtn.addEventListener('click', () => {
      hideModal('cameraErrorModal');
      document.getElementById('loadingOverlay').classList.add('hidden');
      sounds.init();
      startNewGame();
    });
  }

  // Sound Toggle Button
  document.getElementById('soundToggleBtn').addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    document.getElementById('soundIcon').innerText = state.isMuted ? '🔇' : '🔊';
  });

  // Save Score Button
  document.getElementById('saveScoreBtn').addEventListener('click', () => {
    const input = document.getElementById('playerNameInput');
    saveLeaderboardEntry(input.value, state.score, state.balloonsPopped);
    input.value = '';
    alert('Score successfully saved to Leaderboard!');
  });

  // Window Resize Listener
  window.addEventListener('resize', resizeCanvas);
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  state.screen = screenId === 'homeScreen' ? 'HOME' : 'GAME';
}

function showModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function hideModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function resizeCanvas() {
  if (state.canvas) {
    state.canvas.width = window.innerWidth;
    state.canvas.height = window.innerHeight;
  }
}

function updateHomeScreenScores() {
  document.getElementById('homeBestScore').innerText = state.bestScore;
  document.getElementById('homeLastScore').innerText = state.lastScore;
}

function exitGameToHome() {
  state.screen = 'HOME';
  clearInterval(state.timerInterval);
  if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
  updateHomeScreenScores();
  showScreen('homeScreen');
}

let canvasListenersAttached = false;
function setupCanvasInputListeners() {
  if (canvasListenersAttached) return;
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  const updatePointer = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    state.mousePos.x = clientX - rect.left;
    state.mousePos.y = clientY - rect.top;

    if (!state.handDetected) {
      state.cursor.x = state.mousePos.x;
      state.cursor.y = state.mousePos.y;
    }
  };

  canvas.addEventListener('mousemove', updatePointer);
  canvas.addEventListener('touchmove', updatePointer, { passive: true });
  canvas.addEventListener('touchstart', updatePointer, { passive: true });
  canvas.addEventListener('click', (e) => {
    updatePointer(e);
    if (state.screen === 'GAME') {
      state.balloons.forEach((balloon) => {
        if (!balloon.popped) {
          const dx = state.cursor.x - balloon.x;
          const dy = state.cursor.y - balloon.y;
          if (Math.hypot(dx, dy) < balloon.radius + 22) {
            popBalloon(balloon);
          }
        }
      });
    }
  });

  canvasListenersAttached = true;
}

// ==========================================================================
// 8. APP INITIALIZATION ENTRY POINT
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateHomeScreenScores();
  renderLeaderboardTable();
  initHandTracking();
});
