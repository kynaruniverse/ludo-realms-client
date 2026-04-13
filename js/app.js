/*
 * LUDO REALMS — app.js
 * Full application controller.
 * Handles: screen routing, game loop, AI turns, HUD updates,
 *          dice animation, power-up toasts, settings, win screen.
 */
'use strict';

const App = (() => {

  // ── State ──────────────────────────────────────────────────────────────────
  let _renderer    = null;
  let _gameState   = null;
  let _engine      = null;
  let _aiPlayers   = {};   // { playerIndex: AIPlayer }
  let _aiThinking  = false;
  let _highlights  = [];
  let _difficulty  = 'medium';
  let _settings    = {sfx:true, music:false, animations:true, showAI:true};
  let _toastTimer  = null;

  const COLOURS = ['red','green','yellow','blue'];
  const COLOUR_HEX = {
    red:'#FF5252', green:'#69F0AE', yellow:'#FFD740', blue:'#40C4FF'
  };

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    _renderer = new window.BoardRenderer();
    _renderer._onTap = handleBoardTap;
    _loadSettings();
    showScreen('screen-home');
  }

  // ── Screen routing ─────────────────────────────────────────────────────────

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    // Trigger board resize if showing game screen
    if (id === 'screen-game' && _renderer) {
      setTimeout(() => _renderer._resize(), 50);
    }
  }

  function showDifficultySelect() {
    showScreen('screen-difficulty');
  }

  function showPauseMenu() {
    document.getElementById('overlay-pause').classList.remove('hidden');
  }

  function resumeGame() {
    document.getElementById('overlay-pause').classList.add('hidden');
  }

  // ── Game start ─────────────────────────────────────────────────────────────

  function startGame(difficulty) {
    _difficulty  = difficulty;
    _aiPlayers   = {};
    _aiThinking  = false;
    _highlights  = [];

    // Build AI opponents for players 1, 2, 3
    const cfgs = window.AI_CONFIGS[difficulty] || window.AI_CONFIGS.medium;
    cfgs.forEach((cfg, i) => {
      const idx = i + 1;
      if (idx < 4) {
        _aiPlayers[idx] = new window.AIPlayer(cfg.difficulty, cfg.personality);
      }
    });

    // Init game state and rules engine
    _gameState = new window.GameState(4);
    _engine    = new window.RulesEngine(_gameState);

    // Hide overlays
    document.getElementById('overlay-pause').classList.add('hidden');
    document.getElementById('overlay-winner').classList.add('hidden');

    showScreen('screen-game');

    // Reset dice display
    _setDiceImg(1);
    _updateHUD();
    _renderer.render(_gameState, []);

    // Chain to AI if first player is AI (unlikely but safe)
    setTimeout(() => _maybeRunAI(), 300);
  }

  function rematch() {
    startGame(_difficulty);
  }

  // ── Roll button ────────────────────────────────────────────────────────────

  function onRollClick() {
    if (!_gameState || _gameState.phase !== 'rolling') return;
    if (_isAITurn()) return;
    _doRoll();
  }

  function _doRoll() {
    // Animate dice
    const diceImg = document.getElementById('dice-img');
    diceImg.classList.remove('rolling');
    void diceImg.offsetWidth;
    diceImg.classList.add('rolling');

    const result = _engine.rollDice();
    if (!result) return;

    // Set dice image to rolled value
    setTimeout(() => {
      _setDiceImg(result.roll);
      diceImg.classList.remove('rolling');
    }, 280);

    _highlights = [];

    if (result.forfeited) {
      _setLog(`${_gameState.log[0]}`);
    } else if (result.noMoves) {
      _setLog(`${_gameState.log[0]}`);
    } else {
      _highlights = _buildHighlights();
    }

    _updateHUD();
    _renderer.render(_gameState, _highlights);

    if (result.forfeited || result.noMoves) {
      setTimeout(() => _maybeRunAI(), 500);
    }
  }

  // ── Board tap handler ──────────────────────────────────────────────────────

  function handleBoardTap(row, col) {
    if (!_gameState || _gameState.phase !== 'moving') return;
    if (_isAITurn()) return;

    const hit = _highlights.find(h => h.row === row && h.col === col);
    if (!hit) {
      _highlights = [];
      _renderer.render(_gameState, []);
      return;
    }

    _applyMove(hit.moveIndex);
  }

  function _applyMove(moveIndex) {
    const prevMana = _gameState.activePlayer.mana;
    const result   = _engine.applyMove(moveIndex);
    _highlights    = [];

    // Check if power-up was collected this move
    const newPU = _gameState.log[0];
    if (newPU && newPU.includes('power-up')) {
      _showToast('⚡ ' + _gameState.activePlayer.colour.toUpperCase() + ' collected a power-up!');
    }

    _updateHUD();
    _updateScores();
    _renderer.render(_gameState, []);

    if (result && result.won) {
      setTimeout(() => _showWinner(), 500);
      return;
    }

    // Chain AI
    setTimeout(() => _maybeRunAI(), 300);
  }

  // ── AI turn logic ──────────────────────────────────────────────────────────

  function _isAITurn() {
    if (!_gameState) return false;
    return !!_aiPlayers[_gameState.currentPlayer];
  }

  function _maybeRunAI() {
    if (!_isAITurn() || _aiThinking) return;
    if (!_gameState || _gameState.phase === 'finished') return;

    _aiThinking = true;
    const ai    = _aiPlayers[_gameState.currentPlayer];

    // AI rolls after think delay
    setTimeout(() => {
      if (!_gameState || _gameState.phase !== 'rolling') {
        _aiThinking = false; return;
      }

      _doRoll();

      if (_gameState.phase !== 'moving') {
        _aiThinking = false;
        setTimeout(() => _maybeRunAI(), 400);
        return;
      }

      // AI picks move
      const moves = _gameState.legalMoves;
      ai.chooseMoveIndex(_gameState, moves).then(idx => {
        if (!_gameState || _gameState.phase !== 'moving') {
          _aiThinking = false; return;
        }

        // Show AI's chosen square briefly
        const move = moves[idx];
        if (move) {
          const gp = _posToGrid(move.newPos, _gameState.activePlayer.colour);
          if (gp) {
            _renderer.render(_gameState, [{
              row: gp[0], col: gp[1],
              type: move.captures.length > 0 ? 'capture' : 'move',
            }]);
          }
        }

        setTimeout(() => {
          _aiThinking = false;
          _applyMove(idx);
        }, 450);
      });
    }, ai.thinkDelay * 0.6);
  }

  // ── Highlights builder ─────────────────────────────────────────────────────

  function _buildHighlights() {
    return (_gameState.legalMoves || [])
      .map((move, moveIndex) => {
        const gp = _posToGrid(move.newPos, _gameState.activePlayer.colour);
        if (!gp) return null;
        return {
          row: gp[0], col: gp[1],
          type: move.captures.length > 0 ? 'capture' : 'move',
          moveIndex,
        };
      })
      .filter(Boolean);
  }

  function _posToGrid(pos, colour) {
    if (pos === 999 || pos === -1) return null;
    if (pos >= 100) {
      const base = {red:100,green:200,yellow:300,blue:400}[colour];
      return window.HOME_COL_COORDS[colour][pos - base] || null;
    }
    return window.TRACK_COORDS[pos] || null;
  }

  // ── HUD updates ────────────────────────────────────────────────────────────

  function _updateHUD() {
    if (!_gameState) return;
    const p       = _gameState.activePlayer;
    const isAI    = _isAITurn();
    const phase   = _gameState.phase;
    const hex     = COLOUR_HEX[p.colour];

    // Topbar colour indicator
    const dot   = document.getElementById('turn-colour-dot');
    const label = document.getElementById('turn-colour-label');
    const status= document.getElementById('turn-status-text');

    dot.style.background = hex;
    dot.style.boxShadow  = `0 0 8px ${hex}`;
    label.textContent    = p.colour.toUpperCase();
    label.style.color    = hex;

    status.textContent =
      phase === 'finished' ? '🏆 WINNER!' :
      isAI && phase === 'rolling' ? '— THINKING...' :
      isAI && phase === 'moving'  ? '— CHOOSING...' :
      phase === 'rolling'  ? '— TAP ROLL' :
      phase === 'moving'   ? '— TAP SQUARE' : '';

    // Roll button
    const btn = document.getElementById('btn-roll');
    btn.disabled = (phase !== 'rolling') || isAI;
    document.getElementById('btn-roll-label').textContent = 'ROLL';

    // Mana
    document.getElementById('mana-count').textContent = p.mana + '/5';

    // Active player highlight
    COLOURS.forEach(c => {
      const el = document.getElementById('cp-' + c);
      if (el) el.classList.toggle('active-player', c === p.colour);
    });

    // Log
    if (_gameState.log.length > 0) {
      _setLog(_gameState.log[0]);
    }
  }

  function _updateScores() {
    if (!_gameState) return;
    _gameState.players.forEach(p => {
      const finished = p.tokens.filter(t => t === 999).length;
      const el = document.getElementById('score-' + p.colour);
      if (el) el.textContent = finished + '/4';
    });
  }

  function _setLog(msg) {
    const el = document.getElementById('log-text');
    if (el) el.textContent = msg;
  }

  function _setDiceImg(val) {
    const img = document.getElementById('dice-img');
    if (img) img.src = `assets/dice-${val}.svg`;
  }

  // ── Winner screen ──────────────────────────────────────────────────────────

  function _showWinner() {
    const winner = _gameState.winner;
    const isHuman = _gameState.players[0].colour === winner;
    document.getElementById('winner-title').textContent = winner.toUpperCase() + ' WINS!';
    document.getElementById('winner-title').style.color = COLOUR_HEX[winner];
    document.getElementById('winner-sub').textContent = 'All tokens home!';
    document.getElementById('winner-human-msg').textContent =
      isHuman ? '🎉 You won! Well played!' : '🤖 The AI wins this round...';
    document.getElementById('overlay-winner').classList.remove('hidden');
  }

  // ── Toast ──────────────────────────────────────────────────────────────────

  function _showToast(msg) {
    const el = document.getElementById('toast-powerup');
    document.getElementById('toast-text').textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  function saveSetting(key, value) {
    _settings[key] = value;
    try { localStorage.setItem('lr_settings', JSON.stringify(_settings)); } catch(e){}
  }

  function _loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('lr_settings') || '{}');
      Object.assign(_settings, s);
      if (_settings.sfx   !== undefined) document.getElementById('snd-sfx').checked   = _settings.sfx;
      if (_settings.music !== undefined) document.getElementById('snd-music').checked  = _settings.music;
      if (_settings.animations !== undefined) document.getElementById('opt-anim').checked = _settings.animations;
      if (_settings.showAI !== undefined) document.getElementById('opt-ai-show').checked  = _settings.showAI;
    } catch(e){}
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    init,
    showScreen,
    showDifficultySelect,
    showPauseMenu,
    resumeGame,
    startGame,
    rematch,
    onRollClick,
    saveSetting,
    _showModeSelect: showDifficultySelect,
    get _lastDifficulty() { return _difficulty; },
  };

})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
