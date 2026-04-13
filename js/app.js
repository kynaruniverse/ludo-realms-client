/*
 * LUDO REALMS — app.js v2
 *
 * BUG FIXES:
 * 1. Rolling 6 in yard: highlight placed on YARD TOKEN (where it is)
 *    not on destination track square. Player taps their token.
 * 2. AI turn chaining: properly passes through all AI turns.
 * 3. Extra turn: correctly stays with same player (human or AI).
 * 4. _aiThinking reset: always cleared to prevent lockup.
 */
'use strict';

const App = (()=>{

  let _board      = null;
  let _gs         = null;   // GameState
  let _eng        = null;   // RulesEngine
  let _ai         = {};     // {playerIndex: AIPlayer}
  let _aiThink    = false;
  let _hl         = [];     // highlights
  let _diff       = 'medium';
  let _settings   = {sfx:true,music:false,anim:true,showAI:true};
  let _stats      = {played:0,won:0,caps:0,pu:0};
  let _toastT     = null;

  const COLS      = ['red','green','yellow','blue'];
  const COL_HEX   = {red:'#E87060',green:'#68B870',yellow:'#E0A840',blue:'#5898D0'};

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(){
    _board = new window.BoardRenderer();
    _board.onTap = _onBoardTap;
    _loadData();
    showScreen('screen-home');
  }

  // ── Screens ───────────────────────────────────────────────────────────────
  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    if(id==='screen-game' && _board) setTimeout(()=>_board._resize(),80);
    if(id==='screen-stats') _renderStats();
  }

  function pauseGame(){
    document.getElementById('ov-pause').classList.remove('hidden');
  }

  function resumeGame(){
    document.getElementById('ov-pause').classList.add('hidden');
  }

  // ── Start game ────────────────────────────────────────────────────────────
  function startGame(diff){
    _diff    = diff;
    _ai      = {};
    _aiThink = false;
    _hl      = [];

    const cfgs = window.AI_CONFIGS[diff] || window.AI_CONFIGS.medium;
    cfgs.forEach((cfg,i)=>{
      if(i+1 < 4) _ai[i+1] = new window.AIPlayer(cfg.difficulty, cfg.personality);
    });

    _gs  = new window.GameState(4);
    _eng = new window.RulesEngine(_gs);

    document.getElementById('ov-pause').classList.add('hidden');
    document.getElementById('ov-winner').classList.add('hidden');

    _setDice(1);
    _updateHUD();
    _updateScores();
    _board.render(_gs,[]);

    showScreen('screen-game');
    setTimeout(()=>_runAI(), 400);
  }

  function rematch(){ startGame(_diff); }

  // ── Roll (human) ──────────────────────────────────────────────────────────
  function onRoll(){
    if(!_gs || _gs.phase !== 'rolling') return;
    if(_isAI()) return;
    _doRoll();
  }

  function _doRoll(){
    // Spin the dice
    const img = document.getElementById('dice-img');
    img.classList.remove('rolling');
    void img.offsetWidth;
    img.classList.add('rolling');

    const res = _eng.rollDice();
    if(!res) return;

    setTimeout(()=>{
      _setDice(res.roll);
      img.classList.remove('rolling');
    }, 280);

    _hl = [];

    if(res.forfeited || res.noMoves){
      _log(_gs.log[0] || '');
      _updateHUD();
      _board.render(_gs,[]);
      setTimeout(()=>_runAI(), 500);
      return;
    }

    // Build highlights with YARD FIX applied
    _hl = _buildHL();
    _log(`Rolled ${res.roll} — tap a move`);
    _updateHUD();
    _board.render(_gs, _hl);
  }

  // ── Board tap ─────────────────────────────────────────────────────────────
  function _onBoardTap(row, col){
    if(!_gs || _gs.phase !== 'moving') return;
    if(_isAI()) return;

    const hit = _hl.find(h=>h.row===row && h.col===col);
    if(!hit){
      _hl = [];
      _board.render(_gs,[]);
      return;
    }

    _doMove(hit.moveIndex);
  }

  function _doMove(idx){
    const prevLog = _gs.log.length;
    const res = _eng.applyMove(idx);

    // Check if a power-up was collected
    if(_gs.log.length > prevLog){
      const latest = _gs.log[0];
      if(latest.includes('power-up')){
        _toast('⚡ Power-up collected!');
        _stats.pu++;
      }
      if(latest.includes('captured')){
        _stats.caps++;
      }
    }

    _hl = [];
    _updateHUD();
    _updateScores();
    _board.render(_gs,[]);

    if(res && res.won){
      _stats.played++;
      if(_gs.winner === 'red') _stats.won++;
      _saveData();
      setTimeout(()=>_showWinner(), 500);
      return;
    }

    // Chain to next turn
    setTimeout(()=>_runAI(), 250);
  }

  // ── AI turns ──────────────────────────────────────────────────────────────
  function _isAI(){
    return !_gs ? false : !!_ai[_gs.currentPlayer];
  }

  function _runAI(){
    if(!_isAI() || _aiThink) return;
    if(!_gs || _gs.phase==='finished') return;

    _aiThink = true;
    const ai = _ai[_gs.currentPlayer];

    setTimeout(()=>{
      // Safety check
      if(!_gs || _gs.phase!=='rolling'){
        _aiThink=false; return;
      }

      _doRoll();

      if(_gs.phase!=='moving'){
        // No move available — already chained by _doRoll
        _aiThink=false; return;
      }

      // AI picks a move
      const moves = _gs.legalMoves;
      ai.chooseMoveIndex(_gs, moves).then(idx=>{
        if(!_gs || _gs.phase!=='moving'){
          _aiThink=false; return;
        }

        // Flash the AI's chosen square
        const move = moves[idx];
        if(move){
          const gp = _posGrid(move.newPos, _gs.activePlayer.colour);
          if(gp){
            _board.render(_gs,[{row:gp[0],col:gp[1],type:move.captures.length?'capture':'move'}]);
          }
        }

        setTimeout(()=>{
          _aiThink=false;
          _doMove(idx);
        }, 420);
      }).catch(()=>{ _aiThink=false; });

    }, Math.round(ai.thinkDelay * 0.55));
  }

  // ── Highlight builder (KEY FIX HERE) ─────────────────────────────────────
  function _buildHL(){
    if(!_gs) return [];
    return (_gs.legalMoves||[]).map((move,mi)=>{
      let row, col;

      if(move.exitsYard){
        // ── YARD EXIT FIX ──────────────────────────────────────────────────
        // Player needs to tap their token IN THE YARD.
        // Find which yard slot this token index occupies.
        const colour = _gs.activePlayer.colour;
        const ti     = move.tokenIndex;
        const gc     = window.YARD_GRID[colour][ti];
        if(!gc) return null;
        [row,col] = [gc[0], gc[1]];
      } else {
        const gp = _posGrid(move.newPos, _gs.activePlayer.colour);
        if(!gp) return null;
        [row,col] = gp;
      }

      return {
        row, col,
        type: move.captures.length ? 'capture' : 'move',
        moveIndex: mi,
      };
    }).filter(Boolean);
  }

  function _posGrid(pos, colour){
    if(pos===999||pos===-1) return null;
    if(pos>=100){
      const base={red:100,green:200,yellow:300,blue:400}[colour];
      return window.HOME_COLS[colour][pos-base]||null;
    }
    return window.TRACK[pos]||null;
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  function _updateHUD(){
    if(!_gs) return;
    const p    = _gs.activePlayer;
    const ai   = _isAI();
    const ph   = _gs.phase;
    const hex  = COL_HEX[p.colour];

    const dot  = document.getElementById('turn-dot');
    const name = document.getElementById('turn-name');
    const hint = document.getElementById('turn-hint');

    dot.style.background = hex;
    dot.style.boxShadow  = `0 0 8px ${hex}`;
    name.textContent     = p.colour.toUpperCase();
    name.style.color     = hex;

    hint.textContent =
      ph==='finished' ? '🏆 WINNER!' :
      ai&&ph==='rolling' ? '— THINKING...' :
      ai&&ph==='moving'  ? '— CHOOSING...' :
      ph==='rolling'  ? '— TAP ROLL' :
      ph==='moving'   ? '— TAP TOKEN/SQUARE' : '';

    document.getElementById('btn-roll').disabled = ph!=='rolling'||ai;
    document.getElementById('mana-val').textContent = p.mana+'/5';

    // Highlight active player score pill
    COLS.forEach(c=>{
      document.getElementById('sp-'+c)?.classList.toggle('active', c===p.colour);
    });
  }

  function _updateScores(){
    if(!_gs) return;
    _gs.players.forEach(p=>{
      const n = p.tokens.filter(t=>t===999).length;
      const el = document.getElementById('sn-'+p.colour);
      if(el) el.textContent = n+'/4';
    });
  }

  function _setDice(val){
    const img = document.getElementById('dice-img');
    if(img) img.src=`assets/dice-${val}.svg`;
  }

  function _log(msg){
    const el = document.getElementById('game-log');
    if(el) el.textContent = msg;
  }

  // ── Winner ────────────────────────────────────────────────────────────────
  function _showWinner(){
    const w  = _gs.winner;
    const me = _gs.players[0].colour===w;
    document.getElementById('ov-winner-name').textContent  = w.toUpperCase()+' WINS!';
    document.getElementById('ov-winner-name').style.color  = COL_HEX[w];
    document.getElementById('ov-winner-msg').textContent   =
      me ? '🎉 You won! Great game!' : '🤖 AI wins this round…';
    document.getElementById('ov-winner').classList.remove('hidden');
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function _toast(msg){
    const el=document.getElementById('toast');
    document.getElementById('toast-msg').textContent=msg;
    el.classList.remove('hidden');
    clearTimeout(_toastT);
    _toastT=setTimeout(()=>el.classList.add('hidden'),2400);
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  function setSetting(key,val){
    _settings[key]=val;
    _saveData();
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  function _renderStats(){
    document.getElementById('st-played').textContent = _stats.played;
    document.getElementById('st-won').textContent    = _stats.won;
    document.getElementById('st-rate').textContent   =
      _stats.played ? Math.round(_stats.won/_stats.played*100)+'%' : '—';
    document.getElementById('st-caps').textContent   = _stats.caps;
    document.getElementById('st-pu').textContent     = _stats.pu;
  }

  function resetStats(){
    _stats={played:0,won:0,caps:0,pu:0};
    _saveData();
    _renderStats();
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  function _saveData(){
    try{
      localStorage.setItem('lr',JSON.stringify({settings:_settings,stats:_stats}));
    }catch(e){}
  }

  function _loadData(){
    try{
      const d=JSON.parse(localStorage.getItem('lr')||'{}');
      if(d.settings) Object.assign(_settings,d.settings);
      if(d.stats)    Object.assign(_stats,d.stats);
      // Apply settings to UI
      ['sfx','music','anim','showAI'].forEach((k,i)=>{
        const ids=['set-sfx','set-music','set-anim','set-ai'];
        const el=document.getElementById(ids[i]);
        if(el && _settings[k]!==undefined) el.checked=_settings[k];
      });
    }catch(e){}
  }

  return {
    init, showScreen, pauseGame, resumeGame,
    startGame, rematch, onRoll, setSetting, resetStats,
  };

})();

document.addEventListener('DOMContentLoaded',()=>App.init());
