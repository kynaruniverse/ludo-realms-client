/*
 * LUDO REALMS — board.js v2
 *
 * KEY FIX: When rolling a 6 and a token is in the yard,
 * the highlight appears ON THE YARD TOKEN SLOT (where the token
 * currently is), NOT on the track starting square.
 * This way the player taps their actual token, not an abstract destination.
 */
'use strict';

const SVG_SIZE = 750;
const GRID     = 15;
const CELL     = SVG_SIZE / GRID; // 50

// Track coordinates — row,col for each of 52 outer squares
const TRACK = [
  [6,1],[7,1],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,8],[8,9],[8,10],[8,11],[8,12],[8,13],
  [8,14],[7,14],[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[6,8],
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[6,5],[6,4],[6,3],[6,2],
];

const HOME_COLS = {
  red:    [[5,7],[4,7],[3,7],[2,7],[1,7],[0,7]],
  green:  [[7,9],[7,10],[7,11],[7,12],[7,13],[7,14]],
  yellow: [[9,7],[10,7],[11,7],[12,7],[13,7],[14,7]],
  blue:   [[7,5],[7,4],[7,3],[7,2],[7,1],[7,0]],
};

// SVG pixel centres of yard token slots (matches board.svg exactly)
const YARD_PX = {
  red:    [[95,545],[205,545],[95,655],[205,655]],
  green:  [[95,95],[205,95],[95,205],[205,205]],
  yellow: [[545,95],[655,95],[545,205],[655,205]],
  blue:   [[545,545],[655,545],[545,655],[655,655]],
};

// Grid row/col for yard token slots (for tap detection)
// Each slot px / 50 gives approx grid cell
const YARD_GRID = {
  red:    [[10,1],[10,4],[13,1],[13,4]],
  green:  [[1,1],[1,4],[4,1],[4,4]],
  yellow: [[1,10],[1,13],[4,10],[4,13]],
  blue:   [[10,10],[10,13],[13,10],[13,13]],
};

const TOKEN_C = {
  red:    {m:'#CC3838',l:'#E87060',d:'#7A1010',s:'#F0C0C0'},
  green:  {m:'#3A8040',l:'#80C878',d:'#1A4820',s:'#B0D8A8'},
  yellow: {m:'#C88010',l:'#E8B848',d:'#704808',s:'#F0D890'},
  blue:   {m:'#2060A8',l:'#6898D0',d:'#102850',s:'#A0C0E0'},
};

function g2s(row,col){ return [col*CELL+CELL/2, row*CELL+CELL/2] }
function s2c(sx,sy,bp){ const sc=bp/SVG_SIZE; return [sx*sc, sy*sc] }

class BoardRenderer {
  constructor(){
    this.canvas  = document.getElementById('board-canvas');
    this.ctx     = this.canvas.getContext('2d');
    this.bp      = 0;
    this._hl     = [];
    this._st     = null;
    this._pulse  = 0;
    this.onTap   = null;

    this._bindEvents();
    this._resize();

    const tick = () => {
      this._pulse = (this._pulse + 0.08) % (Math.PI*2);
      if(this._hl.length) this._draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _bindEvents(){
    window.addEventListener('resize', ()=>this._resize());
    window.addEventListener('orientationchange', ()=>setTimeout(()=>this._resize(),150));
    this.canvas.addEventListener('click', e=>this._tap(e));
    this.canvas.addEventListener('touchend', e=>{
      e.preventDefault(); this._tap(e.changedTouches[0]);
    },{passive:false});
  }

  _resize(){
    const area = document.getElementById('board-area');
    if(!area) return;
    const w = area.clientWidth  - 12;
    const h = area.clientHeight - 12;
    const sz = Math.floor(Math.min(w,h));
    if(sz <= 0) return;
    this.bp = sz;
    const wrap = document.getElementById('board-wrap');
    if(wrap){ wrap.style.width=sz+'px'; wrap.style.height=sz+'px'; }
    this.canvas.width = this.canvas.height = sz;
    this._draw();
  }

  _tap(e){
    if(!this.onTap) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx   = this.canvas.width  / rect.width;
    const sy   = this.canvas.height / rect.height;
    const px   = (e.clientX - rect.left)*sx;
    const py   = (e.clientY - rect.top )*sy;
    const sc   = this.bp/SVG_SIZE;
    const col  = Math.floor(px/(CELL*sc));
    const row  = Math.floor(py/(CELL*sc));
    this.onTap(row, col);
  }

  render(state, highlights){
    this._st = state;
    this._hl = highlights || [];
    this._draw();
  }

  _draw(){
    const {ctx,canvas} = this;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(this._hl.length) this._drawHL();
    if(this._st) this._drawTokens();
  }

  _drawHL(){
    const {ctx,bp,_pulse} = this;
    const alpha = 0.4 + 0.3*Math.sin(_pulse);
    const sc    = bp/SVG_SIZE;
    const cp    = CELL*sc;
    const pad   = cp*0.06;
    const rad   = cp*0.2;

    this._hl.forEach(({row,col,type})=>{
      const x=col*cp+pad, y=row*cp+pad, s=cp-pad*2;
      ctx.fillStyle = type==='capture'
        ? `rgba(200,50,50,${alpha*0.7})`
        : `rgba(240,200,30,${alpha*0.65})`;
      this._rr(x,y,s,s,rad); ctx.fill();
      ctx.strokeStyle = type==='capture'
        ? `rgba(240,70,70,${alpha})`
        : `rgba(250,200,0,${alpha})`;
      ctx.lineWidth=2.5;
      this._rr(x,y,s,s,rad); ctx.stroke();
    });
  }

  _drawTokens(){
    this._st.players.forEach(player => {
      player.tokens.forEach((pos,ti) => {
        if(pos===999){
          this._drawDone(player.colour, ti, this._st.players.indexOf(player));
          return;
        }
        let sx,sy;
        if(pos===-1){
          [sx,sy] = YARD_PX[player.colour][ti];
        } else if(pos>=100){
          const base={red:100,green:200,yellow:300,blue:400}[player.colour];
          const gc=HOME_COLS[player.colour][pos-base];
          if(!gc) return;
          [sx,sy]=g2s(gc[0],gc[1]);
        } else {
          const gc=TRACK[pos]; if(!gc) return;
          [sx,sy]=g2s(gc[0],gc[1]);
        }
        const off=this._stkOff(this._st,player.colour,pos,ti);
        sx+=off.x; sy+=off.y;
        const [cx,cy]=s2c(sx,sy,this.bp);
        const R=CELL*(this.bp/SVG_SIZE)*0.34;
        const active=this._st.activePlayer.colour===player.colour&&this._st.phase!=='finished';
        this._pawn(cx,cy,player.colour,R,active);
      });
    });
  }

  _pawn(cx,cy,col,R,glow){
    const {ctx}=this;
    const c=TOKEN_C[col];
    ctx.save();
    if(glow){ctx.shadowColor=c.m;ctx.shadowBlur=16}
    else{ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=5;ctx.shadowOffsetY=2}

    // Base
    const bg=ctx.createLinearGradient(cx,cy+R*.1,cx,cy+R*.5);
    bg.addColorStop(0,c.m);bg.addColorStop(1,c.d);
    ctx.beginPath();ctx.ellipse(cx,cy+R*.28,R*.54,R*.2,0,0,Math.PI*2);
    ctx.fillStyle=bg;ctx.fill();

    // Neck
    ctx.fillStyle=c.d;
    ctx.fillRect(cx-R*.12,cy-R*.12,R*.24,R*.34);

    // Head
    const hg=ctx.createRadialGradient(cx-R*.3,cy-R*.55,0,cx,cy-R*.48,R*1.1);
    hg.addColorStop(0,c.s);hg.addColorStop(.2,c.l);hg.addColorStop(.6,c.m);hg.addColorStop(1,c.d);
    ctx.beginPath();ctx.arc(cx,cy-R*.48,R*.4,0,Math.PI*2);
    ctx.fillStyle=hg;ctx.fill();
    ctx.restore();

    // Specular
    ctx.beginPath();ctx.arc(cx-R*.16,cy-R*.64,R*.12,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,.6)';ctx.fill();

    // Borders
    ctx.strokeStyle=c.d+'88';ctx.lineWidth=.8;
    ctx.beginPath();ctx.arc(cx,cy-R*.48,R*.4,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.ellipse(cx,cy+R*.28,R*.54,R*.2,0,0,Math.PI*2);ctx.stroke();
  }

  _drawDone(col,ti,pi){
    const cx_s=SVG_SIZE/2+([-18,18,-18,18][ti]||0)+([-8,8,-8,8][pi]||0);
    const cy_s=SVG_SIZE/2+([-18,-18,18,18][ti]||0)+([-8,-8,8,8][pi]||0);
    const [cx,cy]=s2c(cx_s,cy_s,this.bp);
    this._pawn(cx,cy,col,CELL*(this.bp/SVG_SIZE)*.18,false);
  }

  _stkOff(st,col,pos,ti){
    if(pos<0||pos===999) return{x:0,y:0};
    const p=st.players.find(p=>p.colour===col);
    if(p.tokens.filter(t=>t===pos).length<2) return{x:0,y:0};
    const s=CELL*.17;
    return ti%2===0?{x:-s,y:-s}:{x:s,y:s};
  }

  _rr(x,y,w,h,r){
    const {ctx}=this;
    const rd=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+rd,y);ctx.lineTo(x+w-rd,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+rd);
    ctx.lineTo(x+w,y+h-rd);ctx.quadraticCurveTo(x+w,y+h,x+w-rd,y+h);
    ctx.lineTo(x+rd,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-rd);
    ctx.lineTo(x,y+rd);ctx.quadraticCurveTo(x,y,x+rd,y);
    ctx.closePath();
  }
}

// Expose
window.BoardRenderer = BoardRenderer;
window.TRACK         = TRACK;
window.HOME_COLS     = HOME_COLS;
window.YARD_GRID     = YARD_GRID;
window.YARD_PX       = YARD_PX;
