/*
 * LUDO REALMS — board.js  (Visual Overhaul)
 * Premium canvas rendering: gradients, glows, 3D tokens, animations.
 * game.js is unchanged — this file only handles visuals + input.
 */

'use strict';

// ── Palette ────────────────────────────────────────────────────────────────

const C = {
  // Board surfaces
  boardBg:    '#0e1726',
  trackBg:    '#f0ebe0',
  trackLine:  'rgba(0,0,0,0.12)',
  outerBorder:'#1a2a45',

  // Yard fills (rich, deep tones)
  redYard:    '#3d0a0a',
  greenYard:  '#0a2a0e',
  yellowYard: '#2a1e00',
  blueYard:   '#0a1a3d',

  // Yard inner glow colours
  redGlow:    'rgba(229,57,53,0.5)',
  greenGlow:  'rgba(67,160,71,0.5)',
  yellowGlow: 'rgba(255,179,0,0.5)',
  blueGlow:   'rgba(30,136,229,0.5)',

  // Token colours
  red:    '#E53935',
  green:  '#43A047',
  yellow: '#FFB300',
  blue:   '#1E88E5',

  // Home column tints
  redCol:    'rgba(229,57,53,0.18)',
  greenCol:  'rgba(67,160,71,0.18)',
  yellowCol: 'rgba(255,179,0,0.18)',
  blueCol:   'rgba(30,136,229,0.18)',

  // Specials
  safeGold:   '#D4A843',
  safeGoldBg: 'rgba(212,168,67,0.15)',
  powerUp:    '#7B1FA2',
  powerUpBg:  'rgba(123,31,162,0.18)',
  highlight:  'rgba(255,230,50,0.55)',
  captureHL:  'rgba(229,57,53,0.55)',
  white:      '#ffffff',
  centreBg:   '#1a1008',
};

// ── Track & grid definitions ───────────────────────────────────────────────

const GRID = 15;

function getTrackCoords() {
  return [
    [6,1],[7,1],[8,1],
    [8,2],[8,3],[8,4],[8,5],[8,6],
    [9,6],[10,6],[11,6],[12,6],[13,6],
    [14,6],[14,7],[14,8],
    [13,8],[12,8],[11,8],[10,8],[9,8],[8,8],
    [8,9],[8,10],[8,11],[8,12],[8,13],
    [8,14],[7,14],[6,14],
    [6,13],[6,12],[6,11],[6,10],[6,9],[6,8],
    [5,8],[4,8],[3,8],[2,8],[1,8],
    [0,8],[0,7],[0,6],
    [1,6],[2,6],[3,6],[4,6],[5,6],[6,6],
    [6,5],[6,4],[6,3],[6,2],
  ];
}

const HOME_COL_COORDS = {
  red:    [[5,7],[4,7],[3,7],[2,7],[1,7],[0,7]],
  green:  [[7,9],[7,10],[7,11],[7,12],[7,13],[7,14]],
  yellow: [[9,7],[10,7],[11,7],[12,7],[13,7],[14,7]],
  blue:   [[7,5],[7,4],[7,3],[7,2],[7,1],[7,0]],
};

const YARD_SLOT_COORDS = {
  red:    [[1,1],[1,3],[3,1],[3,3]],
  green:  [[1,11],[1,13],[3,11],[3,13]],
  yellow: [[11,11],[11,13],[13,11],[13,13]],
  blue:   [[11,1],[11,3],[13,1],[13,3]],
};

const SAFE_SET    = new Set([0,8,13,21,26,34,39,47]);
const POWERUP_SET = new Set([12,25,38]);

// ── BoardRenderer ──────────────────────────────────────────────────────────

class BoardRenderer {
  constructor(canvasId) {
    this.canvas      = document.getElementById(canvasId);
    this.ctx         = this.canvas.getContext('2d');
    this.trackCoords = getTrackCoords();
    this.cellSize    = 0;
    this.gameEngine  = null;

    // Animation state
    this._animFrame  = null;
    this._highlights = [];   // {r,c,type,moveIndex,pulse}
    this._pulsePhase = 0;

    this._bindResize();
    this._bindTap();
    this._resize();
    this._startPulse();
  }

  attachEngine(engine) { this.gameEngine = engine; }

  // ── Resize ────────────────────────────────────────────────────────────────

  _bindResize() {
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._resize(), 150));
  }

  _resize() {
    const area = document.getElementById('game-area');
    const avail = Math.min(area.clientWidth, area.clientHeight);
    const size  = Math.floor(avail * 0.97);
    this.canvas.width  = size;
    this.canvas.height = size;
    this.cellSize = size / GRID;
    this.draw();
  }

  // ── Pulse animation ───────────────────────────────────────────────────────

  _startPulse() {
    const tick = () => {
      this._pulsePhase = (this._pulsePhase + 0.06) % (Math.PI * 2);
      if (this._highlights.length > 0) this.draw(this._lastState, this._highlights);
      this._animFrame = requestAnimationFrame(tick);
    };
    this._animFrame = requestAnimationFrame(tick);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  _bindTap() {
    this.canvas.addEventListener('click', e => this._onTap(e));
    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      this._onTap(e.changedTouches[0]);
    }, { passive: false });
  }

  _onTap(e) {
    if (!this.gameEngine) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top)  * scaleY;
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    this.gameEngine.handleBoardTap(row, col);
  }

  // ── Main draw ─────────────────────────────────────────────────────────────

  draw(state = null, highlights = []) {
    this._lastState  = state;
    this._highlights = highlights;

    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this._drawBoardBg();
    this._drawYards();
    this._drawTrackSquares();
    this._drawHomeColumns();
    this._drawCentre();
    this._drawBorders();
    this._drawHighlights(highlights);

    if (state) this._drawTokens(state);
  }

  // ── Board background ──────────────────────────────────────────────────────

  _drawBoardBg() {
    const { ctx, canvas } = this;
    // Deep dark board base
    ctx.fillStyle = C.boardBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ── Yards ─────────────────────────────────────────────────────────────────

  _drawYards() {
    const { ctx, cellSize } = this;
    const yards = [
      { r:0, c:0,  bg:C.redYard,    glow:C.redGlow,    key:'red' },
      { r:0, c:9,  bg:C.greenYard,  glow:C.greenGlow,  key:'green' },
      { r:9, c:9,  bg:C.yellowYard, glow:C.yellowGlow, key:'yellow' },
      { r:9, c:0,  bg:C.blueYard,   glow:C.blueGlow,   key:'blue' },
    ];

    yards.forEach(({ r, c, bg, glow, key }) => {
      const x = c * cellSize, y = r * cellSize, s = 6 * cellSize;

      // Dark yard fill
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, s, s);

      // Radial glow from centre of yard
      const grad = ctx.createRadialGradient(
        x + s/2, y + s/2, 0,
        x + s/2, y + s/2, s * 0.7
      );
      grad.addColorStop(0, glow);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, s, s);

      // Inner padding square
      const pad = cellSize * 0.4;
      const innerX = x + pad, innerY = y + pad;
      const innerS = s - pad * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      this._roundRect(innerX, innerY, innerS, innerS, cellSize * 0.3);
      ctx.fill();

      // Token slot circles
      this._drawYardSlots(key, glow);
    });
  }

  _drawYardSlots(colour, glowColour) {
    const { ctx, cellSize } = this;
    const slots = YARD_SLOT_COORDS[colour];
    const colMap = { red:C.red, green:C.green, yellow:C.yellow, blue:C.blue };
    const col = colMap[colour];

    slots.forEach(([r, c]) => {
      const cx = c * cellSize + cellSize / 2;
      const cy = r * cellSize + cellSize / 2;
      const radius = cellSize * 0.38;

      // Slot shadow/ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();

      // Slot outer ring (player colour)
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      const ringGrad = ctx.createRadialGradient(cx-radius*0.2, cy-radius*0.2, 0, cx, cy, radius);
      ringGrad.addColorStop(0, this._lighten(col, 40));
      ringGrad.addColorStop(1, col);
      ctx.fillStyle = ringGrad;
      ctx.fill();

      // Slot inner recess
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();

      // Inner recess highlight
      ctx.beginPath();
      ctx.arc(cx - radius*0.15, cy - radius*0.15, radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
    });
  }

  // ── Track squares ─────────────────────────────────────────────────────────

  _drawTrackSquares() {
    const { ctx, cellSize } = this;
    this.trackCoords.forEach(([r, c], i) => {
      const x = c * cellSize, y = r * cellSize, s = cellSize;

      // Track square base
      ctx.fillStyle = C.trackBg;
      ctx.fillRect(x, y, s, s);

      if (POWERUP_SET.has(i)) {
        // Power-up square: rich purple tint
        ctx.fillStyle = C.powerUpBg;
        ctx.fillRect(x, y, s, s);
        this._drawPowerUpIcon(x + s/2, y + s/2, s * 0.28);
      } else if (SAFE_SET.has(i)) {
        // Safe square: gold tint + star
        ctx.fillStyle = C.safeGoldBg;
        ctx.fillRect(x, y, s, s);
        this._drawStar(x + s/2, y + s/2, s * 0.32, 5);
      }
    });
  }

  // ── Home columns ──────────────────────────────────────────────────────────

  _drawHomeColumns() {
    const { ctx, cellSize } = this;
    const cols = [
      { coords: [[1,7],[2,7],[3,7],[4,7],[5,7]], fill: C.redCol,    arrow: '▲', colour: C.red },
      { coords: [[7,9],[7,10],[7,11],[7,12],[7,13]], fill: C.greenCol, arrow: '▶', colour: C.green },
      { coords: [[9,7],[10,7],[11,7],[12,7],[13,7]], fill: C.yellowCol,arrow: '▼', colour: C.yellow },
      { coords: [[7,1],[7,2],[7,3],[7,4],[7,5]], fill: C.blueCol,   arrow: '◀', colour: C.blue },
    ];

    cols.forEach(({ coords, fill, arrow, colour }) => {
      coords.forEach(([r, c]) => {
        const x = c * cellSize, y = r * cellSize, s = cellSize;

        // Base track colour
        ctx.fillStyle = C.trackBg;
        ctx.fillRect(x, y, s, s);

        // Coloured tint
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, s, s);

        // Subtle arrow
        ctx.fillStyle = colour + '55';
        ctx.font = `bold ${Math.floor(s * 0.38)}px Rajdhani, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(arrow, x + s/2, y + s/2);
      });
    });
  }

  // ── Centre ────────────────────────────────────────────────────────────────

  _drawCentre() {
    const { ctx, cellSize } = this;
    const x = 6 * cellSize, y = 6 * cellSize, s = 3 * cellSize;
    const cx = x + s/2, cy = y + s/2;

    // Dark base
    ctx.fillStyle = C.centreBg;
    ctx.fillRect(x, y, s, s);

    // Four triangles with gradient fills
    const tris = [
      { col: C.red,    pts: [[x,y],[x+s,y],[cx,cy]] },
      { col: C.green,  pts: [[x+s,y],[x+s,y+s],[cx,cy]] },
      { col: C.yellow, pts: [[x+s,y+s],[x,y+s],[cx,cy]] },
      { col: C.blue,   pts: [[x,y+s],[x,y],[cx,cy]] },
    ];

    tris.forEach(({ col, pts }) => {
      // Gradient from edge to centre
      const grad = ctx.createLinearGradient(
        (pts[0][0]+pts[1][0])/2, (pts[0][1]+pts[1][1])/2,
        cx, cy
      );
      grad.addColorStop(0, col + 'CC');
      grad.addColorStop(1, col + '44');
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    });

    // Dividing lines between triangles
    ctx.strokeStyle = C.centreBg;
    ctx.lineWidth = 1;
    [[x,y],[x+s,y],[x+s,y+s],[x,y+s]].forEach(([px,py]) => {
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(px,py); ctx.stroke();
    });

    // Centre home circle
    const homeGrad = ctx.createRadialGradient(cx - s*0.08, cy - s*0.08, 0, cx, cy, s * 0.22);
    homeGrad.addColorStop(0, '#e8d4a0');
    homeGrad.addColorStop(0.6, '#c8a840');
    homeGrad.addColorStop(1, '#8a6010');
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = homeGrad;
    ctx.fill();

    // Star inside centre circle
    this._drawStar(cx, cy, s * 0.14, 6);
  }

  // ── Borders & grid ────────────────────────────────────────────────────────

  _drawBorders() {
    const { ctx, canvas, cellSize } = this;

    // Subtle grid lines only on track squares
    ctx.strokeStyle = C.trackLine;
    ctx.lineWidth = 0.5;
    this.trackCoords.forEach(([r, c]) => {
      ctx.strokeRect(c*cellSize + 0.5, r*cellSize + 0.5, cellSize - 1, cellSize - 1);
    });
    // Home cols
    const homeCells = [
      ...[[1,7],[2,7],[3,7],[4,7],[5,7]],
      ...[[7,9],[7,10],[7,11],[7,12],[7,13]],
      ...[[9,7],[10,7],[11,7],[12,7],[13,7]],
      ...[[7,1],[7,2],[7,3],[7,4],[7,5]],
    ];
    homeCells.forEach(([r,c]) => {
      ctx.strokeRect(c*cellSize+0.5, r*cellSize+0.5, cellSize-1, cellSize-1);
    });

    // Yard borders — glowing coloured outline
    const yardBorders = [
      { r:0, c:0, col:C.red,    glow:C.redGlow },
      { r:0, c:9, col:C.green,  glow:C.greenGlow },
      { r:9, c:9, col:C.yellow, glow:C.yellowGlow },
      { r:9, c:0, col:C.blue,   glow:C.blueGlow },
    ];
    yardBorders.forEach(({ r, c, col, glow }) => {
      const x = c*cellSize, y = r*cellSize, s = 6*cellSize;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 8;
      ctx.strokeRect(x+1, y+1, s-2, s-2);
      ctx.shadowBlur = 0;
    });

    // Outer board border
    ctx.strokeStyle = C.outerBorder;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    ctx.strokeRect(1, 1, canvas.width-2, canvas.height-2);
  }

  // ── Highlights (legal move squares) ───────────────────────────────────────

  _drawHighlights(highlights) {
    const { ctx, cellSize, _pulsePhase } = this;
    const pulse = 0.55 + 0.25 * Math.sin(_pulsePhase);

    highlights.forEach(({ r, c, type }) => {
      const x = c * cellSize, y = r * cellSize, s = cellSize;

      if (type === 'capture') {
        ctx.fillStyle = `rgba(229,57,53,${pulse * 0.6})`;
      } else {
        ctx.fillStyle = `rgba(255,220,30,${pulse * 0.55})`;
      }
      ctx.fillRect(x, y, s, s);

      // Animated border
      ctx.strokeStyle = type === 'capture'
        ? `rgba(255,80,80,${pulse})`
        : `rgba(255,220,30,${pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x+1, y+1, s-2, s-2);
    });
  }

  // ── Tokens ────────────────────────────────────────────────────────────────

  _drawTokens(state) {
    state.players.forEach(player => {
      player.tokens.forEach((pos, ti) => {
        if (pos === 999) return;

        let gridPos = null;
        if (pos === -1) {
          gridPos = YARD_SLOT_COORDS[player.colour][ti];
        } else if (pos >= 100) {
          const homeBase = { red:100, green:200, yellow:300, blue:400 }[player.colour];
          const step = pos - homeBase;
          gridPos = HOME_COL_COORDS[player.colour][step];
        } else {
          gridPos = this.trackCoords[pos];
        }

        if (!gridPos) return;
        const [r, c] = gridPos;

        const offset = this._stackOffset(state, player.colour, pos, ti);
        const cx = c * this.cellSize + this.cellSize/2 + offset.x;
        const cy = r * this.cellSize + this.cellSize/2 + offset.y;

        // Glow for active player's tokens
        const isActive = state.activePlayer.colour === player.colour;
        this._drawToken3D(cx, cy, player.colour, this.cellSize * 0.33, isActive);
      });
    });

    this._drawFinishedTokens(state);
  }

  _drawToken3D(cx, cy, colour, radius, glowing) {
    const { ctx } = this;
    const colMap   = { red:C.red, green:C.green, yellow:C.yellow, blue:C.blue };
    const col = colMap[colour];

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur  = 6;
    ctx.shadowOffsetX = 1.5;
    ctx.shadowOffsetY = 3;

    // Outer glow for active player
    if (glowing) {
      ctx.shadowColor = col;
      ctx.shadowBlur  = 12;
    }

    // Main sphere gradient (3D look)
    const grad = ctx.createRadialGradient(
      cx - radius * 0.3, cy - radius * 0.35, radius * 0.05,
      cx, cy, radius
    );
    grad.addColorStop(0,   this._lighten(col, 60));
    grad.addColorStop(0.4, col);
    grad.addColorStop(1,   this._darken(col, 40));

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Specular highlight (top-left glint)
    const specGrad = ctx.createRadialGradient(
      cx - radius * 0.28, cy - radius * 0.3, 0,
      cx - radius * 0.28, cy - radius * 0.3, radius * 0.55
    );
    specGrad.addColorStop(0,   'rgba(255,255,255,0.6)');
    specGrad.addColorStop(0.4, 'rgba(255,255,255,0.15)');
    specGrad.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    // Thin border ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  _drawFinishedTokens(state) {
    const { ctx, cellSize } = this;
    const cx = 7.5 * cellSize;
    const cy = 7.5 * cellSize;
    const offsets = [
      { x:-cellSize*0.28, y:-cellSize*0.28 },
      { x: cellSize*0.28, y:-cellSize*0.28 },
      { x:-cellSize*0.28, y: cellSize*0.28 },
      { x: cellSize*0.28, y: cellSize*0.28 },
    ];
    state.players.forEach((p, pi) => {
      p.tokens.forEach((pos, ti) => {
        if (pos !== 999) return;
        const off = offsets[ti] || offsets[0];
        const mx = cx + off.x * (pi % 2 === 0 ? -0.6 : 0.6);
        const my = cy + off.y * (pi < 2 ? -0.6 : 0.6);
        this._drawToken3D(mx, my, p.colour, cellSize * 0.13, false);
      });
    });
  }

  _stackOffset(state, colour, pos, tokenIndex) {
    if (pos === -1 || pos === 999) return { x:0, y:0 };
    const player = state.players.find(p => p.colour === colour);
    const count = player.tokens.filter(t => t === pos).length;
    if (count < 2) return { x:0, y:0 };
    const s = this.cellSize * 0.16;
    return tokenIndex % 2 === 0 ? { x:-s, y:-s } : { x:s, y:s };
  }

  // ── Icon helpers ──────────────────────────────────────────────────────────

  _drawStar(cx, cy, radius, points) {
    const { ctx } = this;
    const step = Math.PI / points;
    ctx.save();

    // Glow
    ctx.shadowColor = C.safeGold;
    ctx.shadowBlur  = 6;

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? radius : radius * 0.42;
      const a = i * step - Math.PI / 2;
      i === 0
        ? ctx.moveTo(cx + r*Math.cos(a), cy + r*Math.sin(a))
        : ctx.lineTo(cx + r*Math.cos(a), cy + r*Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle   = C.safeGold;
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth   = 0.5;
    ctx.stroke();
    ctx.restore();
  }

  _drawPowerUpIcon(cx, cy, size) {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = C.powerUp;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = '#CE93D8';
    ctx.font        = `bold ${Math.floor(size * 2)}px Arial`;
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText('⚡', cx, cy);
    ctx.restore();
  }

  // ── Canvas utility ────────────────────────────────────────────────────────

  _roundRect(x, y, w, h, r) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _lighten(hex, amount) {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xFF) + amount);
    const b = Math.min(255, (num & 0xFF) + amount);
    return `rgb(${r},${g},${b})`;
  }

  _darken(hex, amount) {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xFF) - amount);
    const b = Math.max(0, (num & 0xFF) - amount);
    return `rgb(${r},${g},${b})`;
  }
}

// ── GameController ─────────────────────────────────────────────────────────

class GameController {
  constructor() {
    this.renderer = new BoardRenderer('board-canvas');
    this.state    = null;
    this.engine   = null;
    this._highlights = [];

    this.renderer.attachEngine(this);
    this._bindUI();
  }

  _bindUI() {
    document.getElementById('btn-roll').addEventListener('click', () => this.onRollClick());
  }

  startGame(playerCount = 4) {
    this.state       = new GameState(playerCount);
    this.engine      = new RulesEngine(this.state);
    this._highlights = [];

    // Hide winner overlay
    const ov = document.getElementById('winner-overlay');
    ov.style.display = 'none';
    ov.classList.remove('show');

    this._updateHUD();
    this._render();
  }

  onRollClick() {
    if (!this.state || this.state.phase !== 'rolling') return;

    // Animate the dice face
    const diceFace = document.getElementById('dice-face');
    diceFace.classList.remove('rolling');
    void diceFace.offsetWidth; // reflow to restart animation
    diceFace.classList.add('rolling');

    const result = this.engine.rollDice();
    if (!result) return;

    // Update dice display
    document.getElementById('dice-value').textContent = result.roll;

    this._updateHUD();
    this._highlights = [];

    if (!result.forfeited && !result.noMoves) {
      this._highlights = this._buildHighlights();
    }

    this._render();
  }

  handleBoardTap(row, col) {
    if (!this.state || this.state.phase !== 'moving') return;

    const tapped = this._highlights.find(h => h.r === row && h.c === col);
    if (!tapped) {
      this._highlights = [];
      this._render();
      return;
    }

    const result = this.engine.applyMove(tapped.moveIndex);
    this._highlights = [];
    this._updateHUD();
    this._render();

    if (result && result.won) {
      setTimeout(() => this._showWinner(), 400);
    }
  }

  _buildHighlights() {
    const highlights = [];
    this.state.legalMoves.forEach((move, moveIndex) => {
      const gridPos = this._posToGrid(move.newPos, this.state.activePlayer.colour);
      if (!gridPos) return;
      highlights.push({
        r: gridPos[0], c: gridPos[1],
        type: move.captures.length > 0 ? 'capture' : 'move',
        moveIndex,
      });
    });
    return highlights;
  }

  _posToGrid(pos, colour) {
    if (pos === 999 || pos === -1) return null;
    if (pos >= 100) {
      const homeBase = { red:100, green:200, yellow:300, blue:400 }[colour];
      return HOME_COL_COORDS[colour][pos - homeBase] || null;
    }
    return this.renderer.trackCoords[pos] || null;
  }

  _render() {
    this.renderer.draw(this.state, this._highlights);
  }

  _updateHUD() {
    if (!this.state) return;
    const p     = this.state.activePlayer;
    const phase = this.state.phase;
    const colourHex = { red:'#FF5252', green:'#69F0AE', yellow:'#FFD740', blue:'#40C4FF' };

    // Turn badge
    const dot = document.getElementById('turn-dot');
    const col = document.getElementById('current-colour');
    const hex = colourHex[p.colour];
    dot.style.background = hex;
    dot.style.boxShadow  = `0 0 8px ${hex}`;
    col.textContent = p.colour.toUpperCase();
    col.style.color = hex;

    // Status text
    document.getElementById('status-text').textContent =
      phase === 'rolling'  ? `${p.colour.toUpperCase()}'S TURN — TAP ROLL` :
      phase === 'moving'   ? 'TAP A GLOWING SQUARE' :
      phase === 'finished' ? `${this.state.winner.toUpperCase()} WINS!` : '';

    // Roll button
    const btn = document.getElementById('btn-roll');
    btn.disabled = phase !== 'rolling';

    // Player pips — highlight active
    ['red','green','yellow','blue'].forEach(c => {
      const pip = document.getElementById(`pip-${c}`);
      if (!pip) return;
      pip.classList.toggle('active', c === p.colour);
    });

    // Mana pips
    for (let i = 1; i <= 5; i++) {
      const mp = document.getElementById(`mp${i}`);
      if (mp) mp.classList.toggle('active', i <= p.mana);
    }

    // Last log entry
    const logEl = document.getElementById('last-log');
    if (logEl && this.state.log.length > 0) {
      logEl.textContent = this.state.log[0];
    }
  }

  _showWinner() {
    const overlay = document.getElementById('winner-overlay');
    document.getElementById('winner-msg').textContent =
      `${this.state.winner.toUpperCase()} WINS`;
    overlay.style.display = 'flex';
    overlay.classList.add('show');
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  window.gameController = new GameController();
  window.gameController.startGame(4);
});
