/*
 * LUDO REALMS — game.js
 * Module 2: Rules Engine & Game State
 *
 * Handles all game logic. No drawing here — purely state and rules.
 * board.js calls into this to know what to display.
 *
 * Token positions use a unified number system:
 *   -1        = in yard (not yet on board)
 *   0–51      = outer track (0 = Red's start square)
 *   100–105   = Red home column (100 closest to track, 105 = finished)
 *   200–205   = Green home column
 *   300–305   = Yellow home column
 *   400–405   = Blue home column
 *   999       = finished (in centre)
 *
 * Each player's outer track starts at a different offset:
 *   Red    starts at track index 0
 *   Green  starts at track index 13
 *   Yellow starts at track index 26
 *   Blue   starts at track index 39
 */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────

const PLAYER_COLOURS = ['red', 'green', 'yellow', 'blue'];

const TRACK_START = { red: 0, green: 13, yellow: 26, blue: 39 };
const HOME_COL_ENTRY = { red: 51, green: 12, yellow: 25, blue: 38 };
// Each player enters their home column after passing their entry point
// Home column base index per player
const HOME_BASE = { red: 100, green: 200, yellow: 300, blue: 400 };
const HOME_COL_LENGTH = 6; // positions 0–5, with 5 being finished

// Safe squares on outer track (indices into the 52-square track)
const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Power-up spawn squares on outer track
const POWERUP_SQUARES = new Set([12, 25, 38]);

const TOKENS_PER_PLAYER = 4;
const TRACK_LENGTH = 52;

// ── GameState ──────────────────────────────────────────────────────────────

class GameState {
  constructor(playerCount = 4) {
    this.playerCount    = playerCount;
    this.players        = this._initPlayers(playerCount);
    this.currentPlayer  = 0;          // index into players array
    this.phase          = 'rolling';  // 'rolling' | 'moving' | 'finished'
    this.lastRoll       = 0;
    this.consecutiveSixes = 0;
    this.legalMoves     = [];         // [{tokenIndex, newPos, captures}]
    this.winner         = null;
    this.log            = [];         // move history strings for display
    this.turnCount      = 0;
  }

  _initPlayers(count) {
    return PLAYER_COLOURS.slice(0, count).map((colour, i) => ({
      colour,
      index: i,
      tokens: Array(TOKENS_PER_PLAYER).fill(-1), // all in yard
      heldPowerUp: null,
      mana: 3,
      finished: false,
      finishOrder: null, // 1st, 2nd, 3rd, 4th
    }));
  }

  get activePlayer() {
    return this.players[this.currentPlayer];
  }
}

// ── Rules Engine ───────────────────────────────────────────────────────────

class RulesEngine {
  constructor(state) {
    this.state = state;
  }

  // ── Dice ────────────────────────────────────────────────────────────────

  rollDice() {
    const state = this.state;
    if (state.phase !== 'rolling') return null;

    const roll = Math.floor(Math.random() * 6) + 1;
    state.lastRoll = roll;

    // Track consecutive sixes
    if (roll === 6) {
      state.consecutiveSixes++;
    } else {
      state.consecutiveSixes = 0;
    }

    // Triple 6 penalty — forfeit turn
    if (state.consecutiveSixes >= 3) {
      this._log(`${state.activePlayer.colour} rolled three 6s — turn forfeited!`);
      state.consecutiveSixes = 0;
      state.legalMoves = [];
      this._nextTurn(false);
      return { roll, forfeited: true };
    }

    // Calculate legal moves for this roll
    state.legalMoves = this._calcLegalMoves(state.activePlayer, roll);
    state.phase = 'moving';

    this._log(`${state.activePlayer.colour} rolled ${roll}`);

    // No legal moves — pass turn automatically
    if (state.legalMoves.length === 0) {
      this._log(`${state.activePlayer.colour} has no legal moves — turn passes`);
      this._nextTurn(roll === 6);
      return { roll, noMoves: true };
    }

    return { roll };
  }

  // ── Legal move calculator ────────────────────────────────────────────────

  _calcLegalMoves(player, roll) {
    const moves = [];

    player.tokens.forEach((pos, tokenIndex) => {
      // Skip already finished tokens
      if (pos === 999) return;

      // Token in yard — can only exit on a 6
      if (pos === -1) {
        if (roll === 6) {
          const startPos = TRACK_START[player.colour];
          // Can only exit if the starting square isn't blocked by own 2 tokens
          if (!this._isBlockedByOwn(player, startPos)) {
            moves.push({
              tokenIndex,
              fromPos: -1,
              newPos: startPos,
              captures: this._getCapturesAt(player, startPos),
              exitsYard: true,
            });
          }
        }
        return;
      }

      // Token in home column
      if (pos >= 100) {
        const newPos = this._advanceHomeCol(player.colour, pos, roll);
        if (newPos !== null) {
          moves.push({ tokenIndex, fromPos: pos, newPos, captures: [], inHomeCol: true });
        }
        return;
      }

      // Token on outer track
      const newPos = this._advanceOuterTrack(player.colour, pos, roll);
      if (newPos === null) return; // can't move (overshoots home col)

      // Check if new position is blocked by own tokens (2+ same colour)
      if (typeof newPos === 'number' && newPos < 100) {
        if (this._isBlockedByOwn(player, newPos)) return;
      }

      const captures = typeof newPos === 'number' && newPos < 100
        ? this._getCapturesAt(player, newPos)
        : [];

      moves.push({ tokenIndex, fromPos: pos, newPos, captures });
    });

    return moves;
  }

  // ── Movement helpers ─────────────────────────────────────────────────────

  // Advance a token on the outer track by `roll` steps.
  // Returns new position, or null if move is impossible.
  // If the token passes/lands on the home column entry point,
  // it enters the home column instead.
  _advanceOuterTrack(colour, currentPos, roll) {
    const entryPoint = HOME_COL_ENTRY[colour];
    const homeBase   = HOME_BASE[colour];
    const startPos   = TRACK_START[colour];

    // Calculate how many steps from start this token has travelled
    // (normalised so we can detect home column entry)
    const stepsFromStart = this._stepsFromStart(colour, currentPos);
    const newStepsFromStart = stepsFromStart + roll;

    // Total journey before home column = 51 steps (full lap - 1)
    // Home column is steps 52–57 (6 squares)
    if (newStepsFromStart > 57) {
      return null; // overshoots — can't move
    }

    if (newStepsFromStart >= 52) {
      // Entering home column
      const homeColStep = newStepsFromStart - 52; // 0-5
      if (homeColStep === 5) return 999; // finished!
      return homeBase + homeColStep;
    }

    // Still on outer track
    return (currentPos + roll) % TRACK_LENGTH;
  }

  // Advance a token already in the home column
  _advanceHomeCol(colour, currentPos, roll) {
    const homeBase = HOME_BASE[colour];
    const colStep  = currentPos - homeBase; // 0-4
    const newStep  = colStep + roll;
    if (newStep > 5) return null; // overshoots
    if (newStep === 5) return 999; // finished
    return homeBase + newStep;
  }

  // How many steps has this token travelled from its starting square?
  _stepsFromStart(colour, pos) {
    const start = TRACK_START[colour];
    if (pos >= start) return pos - start;
    return (TRACK_LENGTH - start) + pos;
  }

  // ── Block & capture helpers ──────────────────────────────────────────────

  // Is a square blocked by 2+ of the player's own tokens?
  _isBlockedByOwn(player, pos) {
    const count = player.tokens.filter(t => t === pos).length;
    return count >= 2;
  }

  // Is a square blocked by 2+ opponent tokens (impenetrable block)?
  _isBlockedByOpponent(activePlayer, pos) {
    for (const p of this.state.players) {
      if (p.colour === activePlayer.colour) continue;
      const count = p.tokens.filter(t => t === pos).length;
      if (count >= 2) return true;
    }
    return false;
  }

  // Returns list of {playerIndex, tokenIndex} for opponent tokens that
  // would be captured if active player moves to `pos`
  _getCapturesAt(activePlayer, pos) {
    // Can't capture on safe squares
    if (SAFE_SQUARES.has(pos)) return [];
    // Can't capture in home column or yard
    if (pos >= 100 || pos === -1) return [];

    const captures = [];
    this.state.players.forEach((p, pi) => {
      if (p.colour === activePlayer.colour) return;
      p.tokens.forEach((tPos, ti) => {
        if (tPos === pos) {
          captures.push({ playerIndex: pi, tokenIndex: ti });
        }
      });
    });
    return captures;
  }

  // ── Apply move ───────────────────────────────────────────────────────────

  applyMove(moveIndex) {
    const state = this.state;
    if (state.phase !== 'moving') return false;

    const move   = state.legalMoves[moveIndex];
    if (!move) return false;

    const player = state.activePlayer;

    // Move the token
    player.tokens[move.tokenIndex] = move.newPos;

    // Apply captures
    move.captures.forEach(({ playerIndex, tokenIndex }) => {
      state.players[playerIndex].tokens[tokenIndex] = -1;
      this._log(`${player.colour} captured ${state.players[playerIndex].colour}'s token!`);
    });

    // Check if player earned a power-up
    if (POWERUP_SQUARES.has(move.newPos) && !player.heldPowerUp) {
      player.heldPowerUp = this._randomPowerUp();
      this._log(`${player.colour} collected a power-up: ${player.heldPowerUp}`);
    }

    // Check if this token finished
    if (move.newPos === 999) {
      this._log(`${player.colour} got a token home!`);
    }

    // Check for win
    const allHome = player.tokens.every(t => t === 999);
    if (allHome) {
      player.finished = true;
      const finishers = state.players.filter(p => p.finished).length;
      player.finishOrder = finishers;
      state.winner = player.colour;
      state.phase  = 'finished';
      this._log(`🎉 ${player.colour} wins!`);
      return { won: true };
    }

    // Extra turn on 6 (but not triple 6 — already handled)
    const extraTurn = state.lastRoll === 6 || move.captures.length > 0;
    this._nextTurn(extraTurn);

    return { won: false, extraTurn };
  }

  // ── Turn management ──────────────────────────────────────────────────────

  _nextTurn(extraTurn) {
    const state = this.state;
    state.legalMoves = [];

    if (extraTurn) {
      // Same player rolls again
      state.phase = 'rolling';
      this._log(`${state.activePlayer.colour} gets an extra turn!`);
      return;
    }

    // Advance to next player
    let next = (state.currentPlayer + 1) % state.playerCount;
    // Skip finished players
    let attempts = 0;
    while (state.players[next].finished && attempts < state.playerCount) {
      next = (next + 1) % state.playerCount;
      attempts++;
    }

    state.currentPlayer = next;
    state.phase = 'rolling';
    state.consecutiveSixes = 0;
    state.turnCount++;

    // Regenerate mana for new active player (+1, cap 5)
    const p = state.activePlayer;
    p.mana = Math.min(5, p.mana + 1);
  }

  // ── Power-up helpers ─────────────────────────────────────────────────────

  _randomPowerUp() {
    const roll = Math.random();
    if (roll < 0.45) return 'guaranteed_6';
    if (roll < 0.75) return 'swap';
    return 'curse';
  }

  // ── Utility ─────────────────────────────────────────────────────────────

  _log(msg) {
    this.state.log.unshift(msg); // newest first
    if (this.state.log.length > 20) this.state.log.pop();
  }

  // Returns all token positions for a given player as track-visible coords
  // (for the board renderer to know where to draw tokens)
  getTokenPositions() {
    return this.state.players.map(p => ({
      colour: p.colour,
      tokens: p.tokens.map(pos => pos),
    }));
  }

  // Check if a specific track square is a block (2+ same colour tokens)
  getBlocks() {
    const blocks = [];
    this.state.players.forEach(p => {
      const seen = {};
      p.tokens.forEach(pos => {
        if (pos < 0 || pos === 999) return;
        seen[pos] = (seen[pos] || 0) + 1;
        if (seen[pos] === 2) blocks.push({ colour: p.colour, pos });
      });
    });
    return blocks;
  }
}

// ── Export as globals (no bundler needed) ──────────────────────────────────

window.GameState   = GameState;
window.RulesEngine = RulesEngine;
window.TRACK_START = TRACK_START;
window.HOME_BASE   = HOME_BASE;
window.SAFE_SQUARES   = SAFE_SQUARES;
window.POWERUP_SQUARES = POWERUP_SQUARES;
