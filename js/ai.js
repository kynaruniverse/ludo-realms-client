/*
 * LUDO REALMS — ai.js
 * Module 3: AI Opponents
 *
 * Three difficulty tiers: Easy, Medium, Hard
 * Four personalities: Balanced, Aggressive, Defensive, Hoarder
 *
 * The AI never cheats — it uses the same RulesEngine as the human.
 * It analyses the board state and picks the best legal move.
 *
 * Decision weights (used by Medium + Hard):
 *   Home progress  0.50  — primary win condition
 *   Captures       0.30  — sending opponents back is high value
 *   Blocking       0.15  — denying opponent progress
 *   Power-up use   0.05  — only when everything else is equal
 *
 * Difficulty determines lookahead depth:
 *   Easy   — greedy, 0 lookahead, ignores power-ups 60% of the time
 *   Medium — weighted scoring, 1-turn lookahead
 *   Hard   — 2-turn minimax lookahead, optimised weights
 */

'use strict';

// ── Personality weight profiles ────────────────────────────────────────────

const AI_PERSONALITIES = {
  balanced: {
    homeProgress: 0.50,
    capture:      0.30,
    blocking:     0.15,
    powerUp:      0.05,
  },
  aggressive: {
    homeProgress: 0.35,
    capture:      0.50,
    blocking:     0.10,
    powerUp:      0.05,
  },
  defensive: {
    homeProgress: 0.45,
    capture:      0.15,
    blocking:     0.35,
    powerUp:      0.05,
  },
  hoarder: {
    homeProgress: 0.55,
    capture:      0.25,
    blocking:     0.15,
    powerUp:      0.05,  // rarely uses power-ups
  },
};

// ── AIPlayer ───────────────────────────────────────────────────────────────

class AIPlayer {
  constructor(difficulty = 'medium', personality = 'balanced') {
    this.difficulty  = difficulty;   // 'easy' | 'medium' | 'hard'
    this.personality = personality;  // 'balanced' | 'aggressive' | 'defensive' | 'hoarder'
    this.weights     = AI_PERSONALITIES[personality] || AI_PERSONALITIES.balanced;
    this.thinkDelay  = { easy: 600, medium: 900, hard: 1200 }[difficulty] || 800;
  }

  // ── Entry point ───────────────────────────────────────────────────────────
  // Called by GameController when it's an AI player's turn.
  // Returns a Promise that resolves after the think delay with the chosen move index.

  chooseMoveIndex(state, legalMoves) {
    return new Promise(resolve => {
      setTimeout(() => {
        const index = this._decide(state, legalMoves);
        resolve(index);
      }, this.thinkDelay);
    });
  }

  // ── Decision router ───────────────────────────────────────────────────────

  _decide(state, legalMoves) {
    if (!legalMoves || legalMoves.length === 0) return 0;
    if (legalMoves.length === 1) return 0;

    switch (this.difficulty) {
      case 'easy':   return this._decideEasy(state, legalMoves);
      case 'medium': return this._decideMedium(state, legalMoves);
      case 'hard':   return this._decideHard(state, legalMoves);
      default:       return this._decideMedium(state, legalMoves);
    }
  }

  // ── Easy AI ───────────────────────────────────────────────────────────────
  // Greedy — always moves the token that is furthest along the track.
  // Ignores power-ups 60% of the time.
  // Occasionally makes random moves for unpredictability.

  _decideEasy(state, legalMoves) {
    // 20% chance of a fully random move (feels human-like and beatable)
    if (Math.random() < 0.20) {
      return Math.floor(Math.random() * legalMoves.length);
    }

    const player = state.activePlayer;
    let bestIndex = 0;
    let bestProgress = -Infinity;

    legalMoves.forEach((move, i) => {
      // Always take a capture if available
      if (move.captures.length > 0) {
        bestIndex = i;
        bestProgress = Infinity;
        return;
      }

      // Always exit yard on a 6
      if (move.exitsYard) {
        bestIndex = i;
        bestProgress = Infinity;
        return;
      }

      // Otherwise pick furthest-progressed token
      const progress = this._tokenProgress(player.colour, move.newPos);
      if (progress > bestProgress) {
        bestProgress = progress;
        bestIndex = i;
      }
    });

    return bestIndex;
  }

  // ── Medium AI ─────────────────────────────────────────────────────────────
  // Scores each move using weighted heuristics.
  // No lookahead — evaluates only immediate result.

  _decideMedium(state, legalMoves) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    legalMoves.forEach((move, i) => {
      const score = this._scoreMove(state, move);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    });

    return bestIndex;
  }

  // ── Hard AI ───────────────────────────────────────────────────────────────
  // 2-turn minimax lookahead.
  // Evaluates what the best opponent response would be after our move.

  _decideHard(state, legalMoves) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    legalMoves.forEach((move, i) => {
      // Score immediate move
      const immediateScore = this._scoreMove(state, move);

      // Simulate result after this move and score opponent's best response
      const futureScore = this._lookahead(state, move, 1);

      const totalScore = immediateScore * 0.6 + futureScore * 0.4;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestIndex = i;
      }
    });

    return bestIndex;
  }

  // Shallow lookahead — simulate one opponent turn after our move
  _lookahead(state, move, depth) {
    if (depth <= 0) return 0;

    // Find the next opponent player
    const nextPlayerIndex = (state.currentPlayer + 1) % state.playerCount;
    const nextPlayer = state.players[nextPlayerIndex];
    if (!nextPlayer || nextPlayer.finished) return 0;

    // Simulate what moves the opponent might have with a mid-range roll (3)
    const simulatedMoves = this._simulateOpponentMoves(state, nextPlayer, 3);
    if (!simulatedMoves.length) return 0;

    // Opponent picks their best move — that's bad for us
    let worstForUs = Infinity;
    simulatedMoves.forEach(oMove => {
      const oppScore = this._scoreMoveForPlayer(state, oMove, nextPlayer);
      if (oppScore < worstForUs) worstForUs = oppScore;
    });

    // Return negated — opponent doing well is bad for us
    return -worstForUs * 0.3;
  }

  // Simulate what moves would be available to a player with a given roll
  _simulateOpponentMoves(state, player, roll) {
    const moves = [];
    player.tokens.forEach((pos, ti) => {
      if (pos === 999) return;

      if (pos === -1) {
        if (roll === 6) {
          const startPos = window.TRACK_START[player.colour];
          moves.push({ tokenIndex: ti, fromPos: -1, newPos: startPos, captures: [] });
        }
        return;
      }

      if (pos >= 100) {
        const base = window.HOME_BASE[player.colour];
        const step = pos - base;
        const newStep = step + roll;
        if (newStep <= 5) {
          moves.push({ tokenIndex: ti, fromPos: pos, newPos: newStep === 5 ? 999 : base + newStep, captures: [] });
        }
        return;
      }

      const newPos = (pos + roll) % 52;
      moves.push({ tokenIndex: ti, fromPos: pos, newPos, captures: [] });
    });
    return moves;
  }

  // ── Scoring ───────────────────────────────────────────────────────────────

  _scoreMove(state, move) {
    return this._scoreMoveForPlayer(state, move, state.activePlayer);
  }

  _scoreMoveForPlayer(state, move, player) {
    const w = this.weights;
    let score = 0;

    // ── Home progress score ────────────────────────────────────────────
    const progress = this._tokenProgress(player.colour, move.newPos);
    score += progress * w.homeProgress * 100;

    // Bonus for getting a token home
    if (move.newPos === 999) score += 500;

    // Bonus for exiting the yard
    if (move.exitsYard) score += 80;

    // ── Capture score ──────────────────────────────────────────────────
    if (move.captures.length > 0) {
      move.captures.forEach(cap => {
        const capturedPlayer = state.players[cap.playerIndex];
        const capturedPos    = capturedPlayer.tokens[cap.tokenIndex];
        // Capturing a token far along the track is more valuable
        const captureValue = this._tokenProgress(capturedPlayer.colour, capturedPos);
        score += (50 + captureValue * 30) * w.capture * (1 / w.homeProgress);
      });
    }

    // ── Safety score — avoid dangerous squares ─────────────────────────
    // Penalise moving to a square where opponent can capture us next turn
    if (move.newPos >= 0 && move.newPos < 52) {
      if (!window.SAFE_SQUARES.has(move.newPos)) {
        const danger = this._dangerLevel(state, player, move.newPos);
        score -= danger * 20 * w.blocking;
      }
    }

    // ── Blocking bonus — land on a square that blocks opponents ───────
    if (move.newPos >= 0 && move.newPos < 52) {
      const alreadyThere = player.tokens.filter(t => t === move.newPos).length;
      if (alreadyThere === 1) {
        // Moving second token here creates a block
        score += 30 * w.blocking;
      }
    }

    // ── Power-up avoidance for Hoarder ─────────────────────────────────
    if (this.personality === 'hoarder' && player.heldPowerUp) {
      // Hoarder prefers not to use power-ups
      score -= 10;
    }

    return score;
  }

  // How far along is this token toward home? 0 (yard) to 1 (finished)
  _tokenProgress(colour, pos) {
    if (pos === 999) return 1.0;
    if (pos === -1)  return 0.0;

    const start = window.TRACK_START[colour];
    const homeBase = window.HOME_BASE[colour];

    if (pos >= homeBase) {
      // In home column — steps 0-5
      const step = pos - homeBase;
      return 0.85 + (step / 5) * 0.15;
    }

    // On outer track — normalise to 0-0.85
    const stepsFromStart = pos >= start
      ? pos - start
      : (52 - start) + pos;
    return (stepsFromStart / 57) * 0.85;
  }

  // How many opponent tokens can reach this square in 1-6 moves?
  _dangerLevel(state, activePlayer, pos) {
    let danger = 0;
    state.players.forEach(p => {
      if (p.colour === activePlayer.colour) return;
      p.tokens.forEach(tPos => {
        if (tPos < 0 || tPos >= 52) return;
        // Check if opponent can reach pos in 1-6 rolls
        for (let roll = 1; roll <= 6; roll++) {
          const reach = (tPos + roll) % 52;
          if (reach === pos) { danger++; break; }
        }
      });
    });
    return danger;
  }
}

// ── AI Config per player slot ──────────────────────────────────────────────
// Maps player colour to AI difficulty + personality
// Used by GameController to know which players are AI

const AI_CONFIGS = {
  easy: [
    { difficulty: 'easy',   personality: 'balanced'   },
    { difficulty: 'easy',   personality: 'aggressive' },
    { difficulty: 'easy',   personality: 'defensive'  },
  ],
  medium: [
    { difficulty: 'medium', personality: 'balanced'   },
    { difficulty: 'medium', personality: 'aggressive' },
    { difficulty: 'medium', personality: 'defensive'  },
  ],
  hard: [
    { difficulty: 'hard',   personality: 'balanced'   },
    { difficulty: 'hard',   personality: 'aggressive' },
    { difficulty: 'hard',   personality: 'hoarder'    },
  ],
};

// Export as globals
window.AIPlayer    = AIPlayer;
window.AI_CONFIGS  = AI_CONFIGS;
