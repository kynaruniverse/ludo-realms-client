/*
 * LUDO REALMS — board.js (Final Visual)
 * Matches the Ludo King style from the reference image:
 *  - Bright sky blue background
 *  - Bold coloured yards with rounded corners and drop shadows
 *  - Sandy beige track tiles with individual 3D raised effect
 *  - Wooden corner decorations on yards
 *  - Coloured home column tiles
 *  - Chunky pawn-shaped tokens
 *  - Safe square stars, power-up lightning bolts
 *  - Classic centre triangle star
 */

'use strict';

// ── Palette (matching reference image) ────────────────────────────────────

const C = {
  // Background
  sky:         '#29B6F6',

  // Track tiles
  tile:        '#F5DEB3',   // warm sandy beige
  tileTop:     '#FFF8E7',   // highlight (top edge of 3D tile)
  tileBot:     '#C8A870',   // shadow (bottom edge of 3D tile)
  tileBorder:  '#D4AA70',

  // Safe tile
  safeTile:    '#FFF3CD',
  safeGold:    '#F9A825',

  // Power-up tile
  powerTile:   '#F3E5F5',
  powerPurple: '#9C27B0',

  // Yard colours (solid, bold, matching image)
  green:       '#4CAF50',
  greenDark:   '#388E3C',
  greenLight:  '#A5D6A7',

  yellow:      '#FFC107',
  yellowDark:  '#F57F17',
  yellowLight: '#FFF9C4',

  red:         '#F44336',
  redDark:     '#C62828',
  redLight:    '#FFCDD2',

  blue:        '#2196F3',
  blueDark:    '#1565C0',
  blueLight:   '#BBDEFB',

  // Home column tile tints
  greenCol:    '#C8E6C9',
  yellowCol:   '#FFF9C4',
  redCol:      '#FFCDD2',
  blueCol:     '#BBDEFB',

  // Centre
  centreRing:  '#ffffff',
  pink:        '#E91E63',

  // Wood
  wood:        '#8D6E63',
  woodDark:    '#5D4037',
  woodLight:   '#BCAAA4',

  white:       '#ffffff',
  black:       '#000000',
};

// ── Grid definitions ──────────────────────────────────────────────────────

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

// Starting squares (index into track) — show arrow/dot
const START_SET = new Set([0, 13, 26, 39]);

// ── BoardRenderer ──────────────────────────────────────────────────────────

class BoardRenderer {
  constructor(canvasId) {
    this.canvas      = document.getElementById(canvasId);
    this.ctx         = this.canvas.getContext('2d');
    this.trackCoords = getTrackCoords();
    this.cellSize    = 0;
    this.gameEngine  = null;
    this._highlights = [];
    this._lastState  = null;
    this._pulse      = 0;

    this._bindResize();
    this._bindTap();
    this._resize();
    this._startPulse();
  }

  attachEngine(e) { this.gameEngine = e; }

  // ── Resize ──────────────────────────────────────────────────────────────

  _bindResize() {
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._resize(), 150));
  }

  _resize() {
    const area  = document.getElementById('game-area');
    const avail = Math.min(area.clientWidth, area.clientHeight);
    const size  = Math.floor(avail * 0.97);
    this.canvas.width  = size;
    this.canvas.height = size;
    this.cellSize = size / GRID;
    this.draw(this._lastState, this._highlights);
  }

  // ── Pulse ────────────────────────────────────────────────────────────────

  _startPulse() {
    const tick = () => {
      this._pulse = (this._pulse + 0.07) % (Math.PI * 2);
      if (this._highlights.length > 0) {
        this.draw(this._lastState, this._highlights);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── Input ────────────────────────────────────────────────────────────────

  _bindTap() {
    this.canvas.addEventListener('click', e => this._onTap(e));
    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      this._onTap(e.changedTouches[0]);
    }, { passive: false });
  }

  _onTap(e) {
    if (!this.gameEngine) return;
    const rect  = this.canvas.getBoundingClientRect();
    const sx    = this.canvas.width  / rect.width;
    const sy    = this.canvas.height / rect.height;
    const col   = Math.floor((e.clientX - rect.left) * sx / this.cellSize);
    const row   = Math.floor((e.clientY - rect.top)  * sy / this.cellSize);
    this.gameEngine.handleBoardTap(row, col);
  }

  // ── Main draw ────────────────────────────────────────────────────────────

  draw(state = null, highlights = []) {
    this._lastState  = state;
    this._highlights = highlights;

    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sky blue board background
    ctx.fillStyle = C.sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw layers bottom to top
    this._drawYards();
    this._drawTrackTiles();
    this._drawHomeColumnTiles();
    this._drawCentre();
    this._drawWoodConnectors();
    this._drawHighlights(highlights);

    if (state) this._drawTokens(state);
  }

  // ── Yards ────────────────────────────────────────────────────────────────

  _drawYards() {
    const { ctx, cellSize } = this;
    const yards = [
      { r:0, c:0,  col:C.green,  dark:C.greenDark,  label:'green'  },
      { r:0, c:9,  col:C.yellow, dark:C.yellowDark, label:'yellow' },
      { r:9, c:0,  col:C.red,    dark:C.redDark,    label:'red'    },
      { r:9, c:9,  col:C.blue,   dark:C.blueDark,   label:'blue'   },
    ];

    yards.forEach(({ r, c, col, dark, label }) => {
      const x = c * cellSize;
      const y = r * cellSize;
      const s = 6 * cellSize;
      const rad = cellSize * 0.6;

      // Drop shadow
      ctx.save();
      ctx.shadowColor   = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur    = 12;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 5;

      // Main yard fill — rounded rectangle
      ctx.fillStyle = col;
      this._roundRect(ctx, x + 2, y + 2, s - 4, s - 4, rad);
      ctx.fill();
      ctx.restore();

      // Bottom edge (3D depth) — darker shade
      ctx.fillStyle = dark;
      this._roundRect(ctx, x + 2, y + s * 0.88, s - 4, s * 0.12, rad * 0.3);
      ctx.fill();

      // Top highlight strip
      const hGrad = ctx.createLinearGradient(x, y, x, y + s * 0.3);
      hGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
      hGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hGrad;
      this._roundRect(ctx, x + 2, y + 2, s - 4, s * 0.4, rad);
      ctx.fill();

      // Inner white panel (the slot area)
      const pad = cellSize * 0.55;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      this._roundRect(ctx, x + pad, y + pad, s - pad*2, s - pad*2, cellSize * 0.35);
      ctx.fill();

      // Draw the 4 token slot circles
      this._drawYardSlots(label, col, dark);
    });
  }

  _drawYardSlots(colour, col, dark) {
    const { ctx, cellSize } = this;
    YARD_SLOT_COORDS[colour].forEach(([r, c]) => {
      const cx = c * cellSize + cellSize / 2;
      const cy = r * cellSize + cellSize / 2;
      const R  = cellSize * 0.37;

      // Slot shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur  = 4;
      ctx.shadowOffsetY = 2;

      // Slot outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.restore();

      // Slot main fill
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();

      // Slot inner recess
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();

      // Slot shine
      ctx.beginPath();
      ctx.arc(cx - R*0.18, cy - R*0.18, R * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    });
  }

  // ── Track tiles ──────────────────────────────────────────────────────────

  _drawTrackTiles() {
    const { ctx, cellSize } = this;
    this.trackCoords.forEach(([r, c], i) => {
      const x = c * cellSize;
      const y = r * cellSize;
      const s = cellSize;
      const pad = s * 0.04;
      const rad = s * 0.18;

      let tileFill = C.tile;
      if (SAFE_SET.has(i))    tileFill = C.safeTile;
      if (POWERUP_SET.has(i)) tileFill = C.powerTile;

      this._draw3DTile(x + pad, y + pad, s - pad*2, s - pad*2, rad, tileFill);

      // Icons on special squares
      if (SAFE_SET.has(i)) {
        this._drawStar(x + s/2, y + s/2, s * 0.28, 5, C.safeGold);
      }
      if (POWERUP_SET.has(i)) {
        this._drawLightning(x + s/2, y + s/2, s * 0.28);
      }

      // Starting square arrow indicators
      if (START_SET.has(i)) {
        const arrows  = { 0:'▼', 13:'▶', 26:'▲', 39:'◀' };
        const colours = { 0:C.red, 13:C.green, 26:C.yellow, 39:C.blue };
        ctx.fillStyle = colours[i] + 'CC';
        ctx.font      = `bold ${Math.floor(s*0.36)}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(arrows[i], x + s/2, y + s/2);
      }
    });
  }

  // ── Home column tiles ─────────────────────────────────────────────────────

  _drawHomeColumnTiles() {
    const { ctx, cellSize } = this;

    const cols = [
      { cells:[[1,7],[2,7],[3,7],[4,7],[5,7]], fill:C.redCol,    arrow:'▲', acol:C.red    },
      { cells:[[7,9],[7,10],[7,11],[7,12],[7,13]], fill:C.greenCol, arrow:'▶', acol:C.green  },
      { cells:[[9,7],[10,7],[11,7],[12,7],[13,7]], fill:C.yellowCol,arrow:'▼', acol:C.yellow },
      { cells:[[7,1],[7,2],[7,3],[7,4],[7,5]], fill:C.blueCol,   arrow:'◀', acol:C.blue   },
    ];

    cols.forEach(({ cells, fill, arrow, acol }) => {
      cells.forEach(([r, c]) => {
        const x   = c * cellSize;
        const y   = r * cellSize;
        const s   = cellSize;
        const pad = s * 0.04;
        const rad = s * 0.18;
        this._draw3DTile(x + pad, y + pad, s - pad*2, s - pad*2, rad, fill);

        // Small arrow
        ctx.fillStyle = acol + '99';
        ctx.font      = `bold ${Math.floor(s * 0.34)}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(arrow, x + s/2, y + s/2);
      });
    });
  }

  // ── 3D tile helper ────────────────────────────────────────────────────────

  _draw3DTile(x, y, w, h, r, fill) {
    const { ctx } = this;
    const depth = h * 0.1;

    // Bottom shadow slab
    ctx.fillStyle = this._darken(fill, 30);
    this._roundRect(ctx, x, y + depth, w, h, r);
    ctx.fill();

    // Main face
    ctx.fillStyle = fill;
    this._roundRect(ctx, x, y, w, h - depth, r);
    ctx.fill();

    // Top shine strip
    const grad = ctx.createLinearGradient(x, y, x, y + (h - depth) * 0.5);
    grad.addColorStop(0, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    this._roundRect(ctx, x, y, w, (h - depth) * 0.55, r);
    ctx.fill();
  }

  // ── Centre star ───────────────────────────────────────────────────────────

  _drawCentre() {
    const { ctx, cellSize } = this;
    const x  = 6 * cellSize;
    const y  = 6 * cellSize;
    const s  = 3 * cellSize;
    const cx = x + s / 2;
    const cy = y + s / 2;

    // White background
    ctx.fillStyle = C.white;
    this._roundRect(ctx, x, y, s, s, cellSize * 0.25);
    ctx.fill();

    // Four triangles
    const tris = [
      { col: C.red,    pts:[[x,y],[x+s,y],[cx,cy]] },
      { col: C.green,  pts:[[x+s,y],[x+s,y+s],[cx,cy]] },
      { col: C.yellow, pts:[[x+s,y+s],[x,y+s],[cx,cy]] },
      { col: C.blue,   pts:[[x,y+s],[x,y],[cx,cy]] },
    ];

    tris.forEach(({ col, pts }) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    });

    // White dividers
    ctx.strokeStyle = C.white;
    ctx.lineWidth   = 2;
    [[x,y],[x+s,y],[x+s,y+s],[x,y+s]].forEach(([px, py]) => {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
    });

    // Centre circle
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur    = 6;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.restore();

    // Colour ring inside centre circle
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.42, 0, Math.PI * 2);
    // Rainbow ring segments
    const colours = [C.red, C.green, C.yellow, C.blue];
    colours.forEach((col, i) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, cellSize * 0.42, (i * Math.PI/2) - Math.PI/2, ((i+1) * Math.PI/2) - Math.PI/2);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    });

    // Inner white dot
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = C.white;
    ctx.fill();

    // Star in centre
    this._drawStar(cx, cy, cellSize * 0.13, 4, C.white);
  }

  // ── Wooden connectors ─────────────────────────────────────────────────────
  // The plank-like bridges between yard corners and track

  _drawWoodConnectors() {
    const { ctx, cellSize } = this;

    // Wood plank positions — the squares between yards and track corners
    const woodSquares = [
      [0,5],[0,6],[5,0],[6,0],     // top-left corner
      [0,8],[0,9],[5,14],[6,14],   // top-right corner
      [8,0],[9,0],[14,5],[14,6],   // bottom-left corner
      [8,14],[9,14],[14,8],[14,9], // bottom-right corner
    ];

    woodSquares.forEach(([r, c]) => {
      const x   = c * cellSize;
      const y   = r * cellSize;
      const s   = cellSize;
      const pad = s * 0.05;

      // Wood plank base
      ctx.fillStyle = C.wood;
      this._roundRect(ctx, x + pad, y + pad, s - pad*2, s - pad*2, s * 0.15);
      ctx.fill();

      // Wood grain lines
      ctx.strokeStyle = C.woodDark;
      ctx.lineWidth   = 0.8;
      for (let i = 0; i < 3; i++) {
        const ly = y + pad + (s - pad*2) * (0.25 + i * 0.25);
        ctx.beginPath();
        ctx.moveTo(x + pad * 2, ly);
        ctx.lineTo(x + s - pad * 2, ly);
        ctx.stroke();
      }

      // Top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      this._roundRect(ctx, x + pad, y + pad, s - pad*2, (s - pad*2) * 0.35, s * 0.15);
      ctx.fill();
    });
  }

  // ── Highlights ────────────────────────────────────────────────────────────

  _drawHighlights(highlights) {
    const { ctx, cellSize, _pulse } = this;
    const alpha = 0.5 + 0.3 * Math.sin(_pulse);

    highlights.forEach(({ r, c, type }) => {
      const x = c * cellSize, y = r * cellSize, s = cellSize;
      const pad = s * 0.06;

      ctx.fillStyle = type === 'capture'
        ? `rgba(244,67,54,${alpha * 0.7})`
        : `rgba(255,235,59,${alpha * 0.7})`;
      this._roundRect(ctx, x + pad, y + pad, s - pad*2, s - pad*2, s * 0.2);
      ctx.fill();

      ctx.strokeStyle = type === 'capture'
        ? `rgba(244,67,54,${alpha})`
        : `rgba(255,215,0,${alpha})`;
      ctx.lineWidth = 2.5;
      this._roundRect(ctx, x + pad, y + pad, s - pad*2, s - pad*2, s * 0.2);
      ctx.stroke();
    });
  }

  // ── Tokens — chunky pawn shape ────────────────────────────────────────────

  _drawTokens(state) {
    state.players.forEach(player => {
      player.tokens.forEach((pos, ti) => {
        if (pos === 999) return;

        let gridPos;
        if (pos === -1) {
          gridPos = YARD_SLOT_COORDS[player.colour][ti];
        } else if (pos >= 100) {
          const base = { red:100, green:200, yellow:300, blue:400 }[player.colour];
          gridPos = HOME_COL_COORDS[player.colour][pos - base];
        } else {
          gridPos = this.trackCoords[pos];
        }

        if (!gridPos) return;
        const [r, c] = gridPos;
        const off = this._stackOffset(state, player.colour, pos, ti);
        const cx  = c * this.cellSize + this.cellSize / 2 + off.x;
        const cy  = r * this.cellSize + this.cellSize / 2 + off.y;
        const isActive = state.activePlayer.colour === player.colour;

        this._drawPawn(cx, cy, player.colour, this.cellSize * 0.36, isActive);
      });
    });

    this._drawFinishedTokens(state);
  }

  _drawPawn(cx, cy, colour, size, glowing) {
    const { ctx } = this;

    const colMap = {
      red:    { main:C.red,    dark:C.redDark,    light:'#FF8A80' },
      green:  { main:C.green,  dark:C.greenDark,  light:'#B9F6CA' },
      yellow: { main:C.yellow, dark:C.yellowDark, light:'#FFE57F' },
      blue:   { main:C.blue,   dark:C.blueDark,   light:'#82B1FF' },
    };
    const col = colMap[colour];

    ctx.save();

    // Glow for active player
    if (glowing) {
      ctx.shadowColor   = col.main;
      ctx.shadowBlur    = 14;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.shadowColor   = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur    = 5;
      ctx.shadowOffsetY = 2;
    }

    const s = size; // shorthand

    // ── Pawn body path ─────────────────────────────────────────────────
    // Drawn top-to-bottom: head → neck → base

    // Head (circle)
    const headR  = s * 0.38;
    const headCY = cy - s * 0.55;

    ctx.beginPath();
    ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
    const headGrad = ctx.createRadialGradient(
      cx - headR * 0.3, headCY - headR * 0.3, 0,
      cx, headCY, headR
    );
    headGrad.addColorStop(0,   col.light);
    headGrad.addColorStop(0.5, col.main);
    headGrad.addColorStop(1,   col.dark);
    ctx.fillStyle = headGrad;
    ctx.fill();

    // Neck (thin rectangle)
    const neckW  = s * 0.18;
    const neckH  = s * 0.22;
    const neckY  = cy - s * 0.25;
    ctx.fillStyle = col.dark;
    ctx.fillRect(cx - neckW/2, neckY, neckW, neckH);

    // Base (wide oval)
    const baseRX = s * 0.52;
    const baseRY = s * 0.22;
    const baseY  = cy + s * 0.1;

    ctx.beginPath();
    ctx.ellipse(cx, baseY, baseRX, baseRY, 0, 0, Math.PI * 2);
    const baseGrad = ctx.createLinearGradient(cx, baseY - baseRY, cx, baseY + baseRY);
    baseGrad.addColorStop(0, col.main);
    baseGrad.addColorStop(1, col.dark);
    ctx.fillStyle = baseGrad;
    ctx.fill();

    ctx.restore();

    // Shine on head
    ctx.beginPath();
    ctx.arc(cx - headR * 0.25, headCY - headR * 0.25, headR * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();

    // Thin outline on entire pawn (for definition)
    // Head outline
    ctx.beginPath();
    ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
    ctx.strokeStyle = col.dark;
    ctx.lineWidth   = 0.8;
    ctx.stroke();

    // Base outline
    ctx.beginPath();
    ctx.ellipse(cx, baseY, baseRX, baseRY, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawFinishedTokens(state) {
    const { ctx, cellSize } = this;
    const cx = 7.5 * cellSize;
    const cy = 7.5 * cellSize;
    const offsets = [
      { x:-cellSize*0.22, y:-cellSize*0.22 },
      { x: cellSize*0.22, y:-cellSize*0.22 },
      { x:-cellSize*0.22, y: cellSize*0.22 },
      { x: cellSize*0.22, y: cellSize*0.22 },
    ];
    state.players.forEach((p, pi) => {
      p.tokens.forEach((pos, ti) => {
        if (pos !== 999) return;
        const off = offsets[ti] || offsets[0];
        const mx  = cx + off.x * (pi % 2 === 0 ? -0.5 : 0.5);
        const my  = cy + off.y * (pi < 2 ? -0.5 : 0.5);
        this._drawPawn(mx, my, p.colour, cellSize * 0.2, false);
      });
    });
  }

  _stackOffset(state, colour, pos, tokenIndex) {
    if (pos === -1 || pos === 999) return { x:0, y:0 };
    const player = state.players.find(p => p.colour === colour);
    const count  = player.tokens.filter(t => t === pos).length;
    if (count < 2) return { x:0, y:0 };
    const s = this.cellSize * 0.15;
    return tokenIndex % 2 === 0 ? { x:-s, y:-s } : { x:s, y:s };
  }

  // ── Icon helpers ──────────────────────────────────────────────────────────

  _drawStar(cx, cy, radius, points, colour) {
    const { ctx } = this;
    const step = Math.PI / points;
    ctx.save();
    ctx.shadowColor = colour;
    ctx.shadowBlur  = 4;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? radius : radius * 0.42;
      const a = i * step - Math.PI / 2;
      i === 0
        ? ctx.moveTo(cx + r*Math.cos(a), cy + r*Math.sin(a))
        : ctx.lineTo(cx + r*Math.cos(a), cy + r*Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.restore();
  }

  _drawLightning(cx, cy, size) {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = C.powerPurple;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = C.powerPurple;
    ctx.font        = `bold ${Math.floor(size * 2.2)}px Arial`;
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText('⚡', cx, cy);
    ctx.restore();
  }

  // ── Canvas helpers ────────────────────────────────────────────────────────

  _roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  _darken(hex, amt) {
    const n = parseInt(hex.replace('#',''), 16);
    const r = Math.max(0, (n>>16) - amt);
    const g = Math.max(0, ((n>>8)&0xFF) - amt);
    const b = Math.max(0, (n&0xFF) - amt);
    return `rgb(${r},${g},${b})`;
  }
}

// ── GameController ─────────────────────────────────────────────────────────

class GameController {
  constructor() {
    this.renderer    = new BoardRenderer('board-canvas');
    this.state       = null;
    this.engine      = null;
    this._highlights = [];

    this.renderer.attachEngine(this);
    document.getElementById('btn-roll').addEventListener('click', () => this.onRollClick());
  }

  startGame(playerCount = 4) {
    this.state       = new GameState(playerCount);
    this.engine      = new RulesEngine(this.state);
    this._highlights = [];

    const ov = document.getElementById('winner-overlay');
    ov.style.display = 'none';
    ov.classList.remove('show');

    this._updateHUD();
    this._render();
  }

  onRollClick() {
    if (!this.state || this.state.phase !== 'rolling') return;

    const face = document.getElementById('dice-face');
    face.classList.remove('rolling');
    void face.offsetWidth;
    face.classList.add('rolling');

    const result = this.engine.rollDice();
    if (!result) return;

    document.getElementById('dice-value').textContent = result.roll;
    this._highlights = [];

    if (!result.forfeited && !result.noMoves) {
      this._highlights = this._buildHighlights();
    }

    this._updateHUD();
    this._render();
  }

  handleBoardTap(row, col) {
    if (!this.state || this.state.phase !== 'moving') return;

    const hit = this._highlights.find(h => h.r === row && h.c === col);
    if (!hit) {
      this._highlights = [];
      this._render();
      return;
    }

    const result = this.engine.applyMove(hit.moveIndex);
    this._highlights = [];
    this._updateHUD();
    this._render();

    if (result && result.won) {
      setTimeout(() => this._showWinner(), 400);
    }
  }

  _buildHighlights() {
    return this.state.legalMoves
      .map((move, moveIndex) => {
        const gp = this._posToGrid(move.newPos, this.state.activePlayer.colour);
        if (!gp) return null;
        return { r:gp[0], c:gp[1], type: move.captures.length > 0 ? 'capture':'move', moveIndex };
      })
      .filter(Boolean);
  }

  _posToGrid(pos, colour) {
    if (pos === 999 || pos === -1) return null;
    if (pos >= 100) {
      const base = { red:100, green:200, yellow:300, blue:400 }[colour];
      return HOME_COL_COORDS[colour][pos - base] || null;
    }
    return this.renderer.trackCoords[pos] || null;
  }

  _render() {
    this.renderer.draw(this.state, this._highlights);
  }

  _updateHUD() {
    if (!this.state) return;
    const p   = this.state.activePlayer;
    const hex = { red:'#FF5252', green:'#69F0AE', yellow:'#FFD740', blue:'#40C4FF' }[p.colour];

    document.getElementById('turn-dot').style.background = hex;
    document.getElementById('turn-dot').style.boxShadow  = `0 0 8px ${hex}`;
    document.getElementById('current-colour').textContent = p.colour.toUpperCase();
    document.getElementById('current-colour').style.color = hex;

    const phase = this.state.phase;
    document.getElementById('status-text').textContent =
      phase === 'rolling'  ? '— TAP ROLL' :
      phase === 'moving'   ? '— TAP SQUARE' :
      phase === 'finished' ? '🏆 WINNER!' : '';

    document.getElementById('btn-roll').disabled = phase !== 'rolling';

    ['red','green','yellow','blue'].forEach(c => {
      document.getElementById(`pip-${c}`)?.classList.toggle('active', c === p.colour);
    });

    for (let i = 1; i <= 5; i++) {
      document.getElementById(`mp${i}`)?.classList.toggle('active', i <= p.mana);
    }

    const log = document.getElementById('last-log');
    if (log && this.state.log.length > 0) log.textContent = this.state.log[0];
  }

  _showWinner() {
    document.getElementById('winner-msg').textContent = `${this.state.winner.toUpperCase()} WINS`;
    const ov = document.getElementById('winner-overlay');
    ov.style.display = 'flex';
    ov.classList.add('show');
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  window.gameController = new GameController();
  window.gameController.startGame(4);
});
