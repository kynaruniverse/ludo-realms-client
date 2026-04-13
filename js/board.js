/*
 * LUDO REALMS — board.js
 * Canvas renderer: draws tokens + highlight squares on top of SVG board image.
 * The SVG board is a static <img>. Canvas is transparent overlay.
 */
'use strict';

const SVG_SIZE   = 750;
const GRID_CELLS = 15;
const CELL_SVG   = SVG_SIZE / GRID_CELLS; // 50

const TRACK_COORDS = [
  [6,1],[7,1],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,8],[8,9],[8,10],[8,11],[8,12],[8,13],
  [8,14],[7,14],[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[6,8],
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[6,5],[6,4],[6,3],[6,2],
];

const HOME_COL_COORDS = {
  red:    [[5,7],[4,7],[3,7],[2,7],[1,7],[0,7]],
  green:  [[7,9],[7,10],[7,11],[7,12],[7,13],[7,14]],
  yellow: [[9,7],[10,7],[11,7],[12,7],[13,7],[14,7]],
  blue:   [[7,5],[7,4],[7,3],[7,2],[7,1],[7,0]],
};

// SVG pixel centres for each yard token slot (matches board_v3.svg exactly)
const YARD_SLOTS_SVG = {
  red:    [[95,545],[205,545],[95,655],[205,655]],
  green:  [[95,95],[205,95],[95,205],[205,205]],
  yellow: [[545,95],[655,95],[545,205],[655,205]],
  blue:   [[545,545],[655,545],[545,655],[655,655]],
};

const TOKEN_COLS = {
  red:    {main:'#E53935',light:'#FF8A80',dark:'#B71C1C',shine:'#FFCDD2'},
  green:  {main:'#43A047',light:'#A5D6A7',dark:'#1B5E20',shine:'#C8E6C9'},
  yellow: {main:'#F9A825',light:'#FFE082',dark:'#E65100',shine:'#FFF9C4'},
  blue:   {main:'#1E88E5',light:'#90CAF9',dark:'#0D47A1',shine:'#BBDEFB'},
};

// Convert SVG coords → canvas pixel coords
function s2c(svgX, svgY, bp) {
  const sc = bp / SVG_SIZE;
  return [svgX * sc, svgY * sc];
}

// Grid [row,col] → SVG pixel centre
function g2s(row, col) {
  return [col * CELL_SVG + CELL_SVG / 2, row * CELL_SVG + CELL_SVG / 2];
}

class BoardRenderer {
  constructor() {
    this.canvas  = document.getElementById('board-canvas');
    this.ctx     = this.canvas.getContext('2d');
    this.bp      = 0;  // board pixel size (set by resize)
    this._hl     = []; // highlights
    this._state  = null;
    this._pulse  = 0;
    this._onTap  = null; // callback set by GameController

    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._resize(), 150));

    this.canvas.addEventListener('click', e => this._tap(e));
    this.canvas.addEventListener('touchend', e => {
      e.preventDefault(); this._tap(e.changedTouches[0]);
    }, {passive:false});

    // Pulse loop
    const tick = () => {
      this._pulse = (this._pulse + 0.08) % (Math.PI * 2);
      if (this._hl.length > 0) this._draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _resize() {
    const area = document.getElementById('game-board-area');
    const w    = area.clientWidth  - 12;
    const h    = area.clientHeight - 12;
    const size = Math.floor(Math.min(w, h));
    this.bp    = size;

    const wrap = document.getElementById('board-wrap');
    wrap.style.width  = size + 'px';
    wrap.style.height = size + 'px';

    this.canvas.width  = size;
    this.canvas.height = size;
    this._draw();
  }

  _tap(e) {
    if (!this._onTap) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx   = this.canvas.width  / rect.width;
    const sy   = this.canvas.height / rect.height;
    const px   = (e.clientX - rect.left) * sx;
    const py   = (e.clientY - rect.top)  * sy;
    const sc   = this.bp / SVG_SIZE;
    const col  = Math.floor(px / (CELL_SVG * sc));
    const row  = Math.floor(py / (CELL_SVG * sc));
    this._onTap(row, col);
  }

  render(state, highlights) {
    this._state = state;
    this._hl    = highlights || [];
    this._draw();
  }

  _draw() {
    const {ctx, canvas} = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this._hl.length)  this._drawHighlights();
    if (this._state)       this._drawTokens();
  }

  _drawHighlights() {
    const {ctx, bp, _pulse} = this;
    const alpha  = 0.42 + 0.32 * Math.sin(_pulse);
    const sc     = bp / SVG_SIZE;
    const cellPx = CELL_SVG * sc;
    const pad    = cellPx * 0.06;
    const rad    = cellPx * 0.2;

    this._hl.forEach(({row, col, type}) => {
      const x = col * cellPx + pad;
      const y = row * cellPx + pad;
      const s = cellPx - pad * 2;

      ctx.fillStyle = type === 'capture'
        ? `rgba(229,57,53,${alpha*0.7})`
        : `rgba(255,220,30,${alpha*0.65})`;
      this._rr(x, y, s, s, rad); ctx.fill();

      ctx.strokeStyle = type === 'capture'
        ? `rgba(255,80,80,${alpha})`
        : `rgba(255,210,0,${alpha})`;
      ctx.lineWidth = 2.5;
      this._rr(x, y, s, s, rad); ctx.stroke();
    });
  }

  _drawTokens() {
    const {_state} = this;
    _state.players.forEach(player => {
      player.tokens.forEach((pos, ti) => {
        if (pos === 999) {
          this._drawFinished(player.colour, ti, _state.players.indexOf(player));
          return;
        }
        let svgX, svgY;

        if (pos === -1) {
          [svgX, svgY] = YARD_SLOTS_SVG[player.colour][ti];
        } else if (pos >= 100) {
          const base = {red:100,green:200,yellow:300,blue:400}[player.colour];
          const gc   = HOME_COL_COORDS[player.colour][pos - base];
          if (!gc) return;
          [svgX, svgY] = g2s(gc[0], gc[1]);
        } else {
          const gc = TRACK_COORDS[pos];
          if (!gc) return;
          [svgX, svgY] = g2s(gc[0], gc[1]);
        }

        const off = this._stackOff(_state, player.colour, pos, ti);
        svgX += off.x; svgY += off.y;

        const [cx, cy] = s2c(svgX, svgY, this.bp);
        const radius   = CELL_SVG * (this.bp / SVG_SIZE) * 0.35;
        const active   = _state.activePlayer.colour === player.colour
                      && _state.phase !== 'finished';

        this._drawPawn(cx, cy, player.colour, radius, active);
      });
    });
  }

  _drawPawn(cx, cy, colour, R, glow) {
    const {ctx} = this;
    const c = TOKEN_COLS[colour];

    ctx.save();
    if (glow) {
      ctx.shadowColor = c.main; ctx.shadowBlur = 18;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
    }

    // Base oval
    const bGrad = ctx.createLinearGradient(cx, cy+R*0.1, cx, cy+R*0.5);
    bGrad.addColorStop(0, c.main); bGrad.addColorStop(1, c.dark);
    ctx.beginPath();
    ctx.ellipse(cx, cy+R*0.28, R*0.54, R*0.2, 0, 0, Math.PI*2);
    ctx.fillStyle = bGrad; ctx.fill();

    // Neck
    ctx.fillStyle = c.dark;
    ctx.fillRect(cx-R*0.12, cy-R*0.12, R*0.24, R*0.34);

    // Head
    const hGrad = ctx.createRadialGradient(
      cx-R*0.3, cy-R*0.54, 0,
      cx, cy-R*0.48, R*1.1
    );
    hGrad.addColorStop(0, c.shine);
    hGrad.addColorStop(0.25, c.light);
    hGrad.addColorStop(0.6,  c.main);
    hGrad.addColorStop(1,    c.dark);
    ctx.beginPath();
    ctx.arc(cx, cy-R*0.48, R*0.4, 0, Math.PI*2);
    ctx.fillStyle = hGrad; ctx.fill();
    ctx.restore();

    // Specular
    ctx.beginPath();
    ctx.arc(cx-R*0.16, cy-R*0.64, R*0.13, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();

    // Outlines
    ctx.strokeStyle = c.dark + '99'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(cx, cy-R*0.48, R*0.4, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy+R*0.28, R*0.54, R*0.2, 0, 0, Math.PI*2); ctx.stroke();
  }

  _drawFinished(colour, ti, pi) {
    const cx_svg = SVG_SIZE/2 + ([-18,18,-18,18][ti]||0) + ([-8,8,-8,8][pi]||0);
    const cy_svg = SVG_SIZE/2 + ([-18,-18,18,18][ti]||0) + ([-8,-8,8,8][pi]||0);
    const [cx, cy] = s2c(cx_svg, cy_svg, this.bp);
    this._drawPawn(cx, cy, colour, CELL_SVG*(this.bp/SVG_SIZE)*0.18, false);
  }

  _stackOff(state, colour, pos, ti) {
    if (pos < 0 || pos === 999) return {x:0,y:0};
    const p = state.players.find(p=>p.colour===colour);
    const n = p.tokens.filter(t=>t===pos).length;
    if (n < 2) return {x:0,y:0};
    const s = CELL_SVG * 0.17;
    return ti%2===0 ? {x:-s,y:-s} : {x:s,y:s};
  }

  _rr(x, y, w, h, r) {
    const {ctx} = this;
    const rad = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rad,y); ctx.lineTo(x+w-rad,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+rad);
    ctx.lineTo(x+w,y+h-rad); ctx.quadraticCurveTo(x+w,y+h,x+w-rad,y+h);
    ctx.lineTo(x+rad,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-rad);
    ctx.lineTo(x,y+rad); ctx.quadraticCurveTo(x,y,x+rad,y);
    ctx.closePath();
  }
}

// Export
window.BoardRenderer = BoardRenderer;
window.TRACK_COORDS  = TRACK_COORDS;
window.HOME_COL_COORDS = HOME_COL_COORDS;
